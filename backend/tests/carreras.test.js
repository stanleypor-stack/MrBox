/**
 * LAS CARRERAS.
 *
 * Lo que se prueba es que reparta bien y UNA SOLA VEZ. Una carrera que
 * paga dos veces es plata que sale del sitio sin que nadie la vea
 * salir.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DATABASE_URI = process.env.TEST_DB_URI || "mongodb://127.0.0.1:27017/mrbox_test_carreras";
process.env.JWT_SECRET = "prueba-local";
process.env.TURNSTILE_SECRET_KEY = "";
process.env.AUTH_RATE_LIMIT = "500";
process.env.LOG_LEVEL = "error";

const mongoose = require("mongoose");
const { conectar } = require("../database");

const User = require("../database/models/User");
const Race = require("../database/models/Race");
const BalanceTransaction = require("../database/models/BalanceTransaction");

const carreras = require("../services/races");
const { sc } = require("../utils/money");

let hayBase = true;

test.before(async () => {
  try {
    await conectar();
    await mongoose.connection.db.dropDatabase();
  } catch {
    hayBase = false;
  }
});

test.after(async () => {
  if (hayBase) {
    await mongoose.connection.db.dropDatabase().catch(() => {});
    await mongoose.disconnect().catch(() => {});
  }
});

/* ── Las cuentas ──────────────────────────────────────────────────── */

test("el reparto suma cien exacto", () => {
  const suma = carreras.REPARTO.reduce((a, b) => a + b, 0);
  assert.equal(suma, 100, `suma ${suma}`);
});

test("el pozo se reparte entero y nada se cae por el redondeo", () => {
  const pozo = 10000;
  const total = carreras.REPARTO
    .map((_, i) => carreras.premioDe(carreras.REPARTO, pozo, i + 1))
    .reduce((a, b) => a + b, 0);
  assert.equal(sc(total), pozo);
});

test("el puesto once no cobra", () => {
  assert.equal(carreras.premioDe(carreras.REPARTO, 10000, 11), 0);
  assert.equal(carreras.premioDe(carreras.REPARTO, 10000, 0), 0);
});

test("las ventanas van en UTC y la semana arranca el lunes", () => {
  /* Un miercoles. */
  const miercoles = new Date("2026-11-18T05:30:00Z");

  const d = carreras.ventanaDe("daily", miercoles);
  assert.equal(d.desde.toISOString(), "2026-11-18T00:00:00.000Z");
  assert.equal(d.hasta.toISOString(), "2026-11-19T00:00:00.000Z");

  const s = carreras.ventanaDe("weekly", miercoles);
  assert.equal(s.desde.toISOString(), "2026-11-16T00:00:00.000Z", "el lunes");
  assert.equal(s.hasta.toISOString(), "2026-11-23T00:00:00.000Z");

  const m = carreras.ventanaDe("monthly", miercoles);
  assert.equal(m.desde.toISOString(), "2026-11-01T00:00:00.000Z");
  assert.equal(m.hasta.toISOString(), "2026-12-01T00:00:00.000Z");
});

test("un domingo cae en la semana que arranco el lunes anterior", () => {
  /* El domingo es el dia 0 de `getUTCDay`, que es la trampa clasica. */
  const domingo = new Date("2026-11-22T23:59:00Z");
  const s = carreras.ventanaDe("weekly", domingo);
  assert.equal(s.desde.toISOString(), "2026-11-16T00:00:00.000Z");
  assert.equal(s.hasta.toISOString(), "2026-11-23T00:00:00.000Z");
});

/* ── Contra la base ───────────────────────────────────────────────── */

let n = 0;
async function jugador() {
  n += 1;
  return User.create({
    username: `cr${n}`,
    email: `cr${n}@test.local`,
    passwordHash: "x".repeat(20),
    balanceSc: 0,
  });
}

/** Le anota a alguien que jugo tanto, en tal momento. */
async function jugo(user, montoSc, cuando) {
  await BalanceTransaction.create({
    user: user._id,
    type: "box_open",
    amountSc: -montoSc,
    balanceBefore: 0,
    balanceAfter: 0,
    createdAt: cuando,
  });
}

test("la tabla sale del libro y ordena por lo jugado", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  const a = await jugador();
  const b = await jugador();
  const c = await jugador();

  const ahora = new Date();
  const { desde, hasta } = carreras.ventanaDe("daily", ahora);

  await jugo(a, 100, ahora);
  await jugo(b, 300, ahora);
  await jugo(c, 200, ahora);
  /* Y uno de ayer, que NO tiene que contar. */
  await jugo(a, 9999, new Date(desde.getTime() - 60000));

  const tabla = await carreras.tablaDe({ desde, hasta });
  assert.equal(tabla.length, 3);
  assert.equal(tabla[0].username, b.username);
  assert.equal(tabla[0].jugadoSc, 300);
  assert.equal(tabla[1].jugadoSc, 200);
  assert.equal(tabla[2].jugadoSc, 100);
});

test("cerrar una carrera paga a los que corresponde, UNA sola vez", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  await Race.deleteMany({});
  await BalanceTransaction.deleteMany({});

  const a = await jugador();
  const b = await jugador();

  /* Una carrera que ya vencio. */
  const desde = new Date(Date.UTC(2026, 0, 1));
  const hasta = new Date(Date.UTC(2026, 0, 2));

  const carrera = await Race.create({
    tipo: "daily", desde, hasta,
    premioTotalSc: 1000,
    reparto: carreras.REPARTO,
    estado: "live",
  });

  await jugo(a, 500, new Date(Date.UTC(2026, 0, 1, 12)));
  await jugo(b, 200, new Date(Date.UTC(2026, 0, 1, 13)));

  await carreras.cerrar(carrera.toObject());

  const cerrada = await Race.findById(carrera._id).lean();
  assert.equal(cerrada.estado, "settled");
  assert.equal(cerrada.ganadores.length, 2);
  assert.equal(cerrada.ganadores[0].premioSc, 300); // 30% de 1000
  assert.equal(cerrada.ganadores[1].premioSc, 180); // 18%

  const saldoA = await User.findById(a._id).select("+balanceSc").lean();
  assert.equal(sc(saldoA.balanceSc), 300);

  /* Cerrarla de nuevo no paga de nuevo. */
  await carreras.cerrar(carrera.toObject());
  const otraVez = await User.findById(a._id).select("+balanceSc").lean();
  assert.equal(sc(otraVez.balanceSc), 300, "no se puede pagar dos veces");

  const pagos = await BalanceTransaction.countDocuments({ user: a._id, type: "race_prize" });
  assert.equal(pagos, 1);
});

test("dos cierres al mismo tiempo pagan una sola vez", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  await Race.deleteMany({});
  await BalanceTransaction.deleteMany({});

  const a = await jugador();
  const desde = new Date(Date.UTC(2026, 0, 3));
  const hasta = new Date(Date.UTC(2026, 0, 4));

  const carrera = await Race.create({
    tipo: "daily", desde, hasta, premioTotalSc: 1000,
    reparto: carreras.REPARTO, estado: "live",
  });
  await jugo(a, 500, new Date(Date.UTC(2026, 0, 3, 12)));

  /* Las dos a la vez, como dos pedidos que llegan en el mismo segundo. */
  const [uno, dos] = await Promise.all([
    carreras.cerrar(carrera.toObject()),
    carreras.cerrar(carrera.toObject()),
  ]);

  assert.ok((uno && !dos) || (!uno && dos), "una sola tiene que ganar el cierre");

  const pagos = await BalanceTransaction.countDocuments({ user: a._id, type: "race_prize" });
  assert.equal(pagos, 1);
});

test("ponerAlDia abre las tres y cierra las vencidas", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  await Race.deleteMany({});

  await carreras.ponerAlDia();

  const vivas = await Race.find({ estado: "live" }).lean();
  assert.equal(vivas.length, 3, "una de cada tipo");
  assert.deepEqual(vivas.map((v) => v.tipo).sort(), ["daily", "monthly", "weekly"]);

  /* Llamarlo de nuevo no crea otras tres. */
  await carreras.ponerAlDia();
  assert.equal(await Race.countDocuments({ estado: "live" }), 3);
});

test("ver() dice en que puesto va aunque este afuera de la tabla", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  await Race.deleteMany({});
  await BalanceTransaction.deleteMany({});
  await carreras.ponerAlDia();

  const ahora = new Date();
  const muchos = [];
  for (let i = 0; i < 3; i += 1) {
    const u = await jugador();
    await jugo(u, 1000 - i, ahora);
    muchos.push(u);
  }

  const ultimo = await jugador();
  await jugo(ultimo, 1, ahora);

  const vista = await carreras.ver({ tipo: "daily", userId: ultimo._id });
  assert.ok(vista.yo, "tiene que haber un yo");
  assert.equal(vista.yo.jugadoSc, 1);
  assert.equal(vista.yo.puesto, 4);
  assert.equal(vista.filas[0].jugadoSc, 1000);
  assert.equal(vista.filas[0].premioSc, carreras.premioDe(carreras.REPARTO, vista.premioTotalSc, 1));
});

test("quien no jugo no tiene puesto, y no rompe", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const nadie = await jugador();
  const vista = await carreras.ver({ tipo: "weekly", userId: nadie._id });
  assert.equal(vista.yo.puesto, null);
  assert.equal(vista.yo.jugadoSc, 0);
});

test("sin sesion la tabla se ve igual, sin fila propia", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const vista = await carreras.ver({ tipo: "daily", userId: null });
  assert.equal(vista.yo, null);
  assert.ok(Array.isArray(vista.filas));
});
