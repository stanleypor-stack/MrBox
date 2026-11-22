/**
 * LO QUE SE JUEGA EN LOS JUEGOS CUENTA EN TODOS LADOS.
 *
 * Una apuesta de dice no es solo una apuesta: mueve el rango del Club
 * VIP, el puesto en la carrera, el rakeback de la ventana, el "jugado
 * hoy" de los limites que se puso el jugador, la comision del que lo
 * trajo y los numeros del panel.
 *
 * Todo eso sale del MISMO libro, pero cada pantalla sumaba su propia
 * lista de tipos de movimiento, y cuando entraron los ocho juegos
 * originales entraron en una sola: el jugador veia subir su progreso
 * VIP y la carrera marcarle cero.
 *
 * Ahora la lista esta una sola vez, en el modelo. Estos tests son los
 * que avisan si alguna pantalla se vuelve a hacer la suya.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DATABASE_URI = process.env.TEST_DB_URI || "mongodb://127.0.0.1:27017/mrbox_test_cuenta";
process.env.JWT_SECRET = "prueba-local";
process.env.TURNSTILE_SECRET_KEY = "";
process.env.AUTH_RATE_LIMIT = "500";
process.env.GAME_RATE_LIMIT = "100000";
process.env.LOG_LEVEL = "error";

const mongoose = require("mongoose");
const { app } = require("../index");
const { conectar, asegurarIndices } = require("../database");

const User = require("../database/models/User");
const BalanceTransaction = require("../database/models/BalanceTransaction");
const AffiliateCode = require("../database/models/AffiliateCode");

const races = require("../services/races");
const vip = require("../services/vip");
const controles = require("../services/controls");

let servidor;
let base = "";
let hayBase = true;

test.before(async () => {
  try {
    await conectar();
    await mongoose.connection.db.dropDatabase();
    await asegurarIndices();
    servidor = app.listen(0);
    await new Promise((r) => servidor.once("listening", r));
    base = `http://127.0.0.1:${servidor.address().port}/api`;
  } catch {
    hayBase = false;
  }
});

test.after(async () => {
  if (servidor) await new Promise((r) => servidor.close(r));
  if (hayBase) {
    await mongoose.connection.db.dropDatabase().catch(() => {});
    await mongoose.disconnect().catch(() => {});
  }
});

async function pedir(metodo, ruta, { cuerpo, token } = {}) {
  const r = await fetch(base + ruta, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...(token ? { "x-auth-token": token } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return { estado: r.status, datos: await r.json() };
}

let n = 0;
async function jugador({ saldo = 1000 } = {}) {
  n += 1;
  const cuenta = { username: `jc${n}`, email: `jc${n}@test.local`, password: "unaclavelarga" };
  const { datos } = await pedir("POST", "/auth/register", { cuerpo: cuenta });
  await User.updateOne({ _id: datos.user._id }, { $set: { balanceSc: saldo } });
  return { id: datos.user._id, token: datos.token };
}

const oid = (id) => new mongoose.Types.ObjectId(String(id));

/* Una apuesta de dice, que es el mas simple de los ocho. */
const tirar = (token, apuestaSc) => pedir("POST", "/games/dice/play", {
  token, cuerpo: { apuestaSc, modo: "over", desde: 50 },
});

/* ══ El libro ═══════════════════════════════════════════════════════ */

test("LA LISTA ESTA UNA SOLA VEZ Y TIENE A LOS JUEGOS", async () => {
  /*
    Si alguien saca `game_bet` de aca, se apagan en silencio las
    carreras, el rakeback y la mitad del panel. Por eso se prueba la
    lista y no cada pantalla por separado.
  */
  assert.ok(BalanceTransaction.TIPOS_QUE_JUEGAN.includes("game_bet"));
  assert.ok(BalanceTransaction.TIPOS_QUE_JUEGAN.includes("box_open"));
  assert.ok(BalanceTransaction.TIPOS_QUE_JUEGAN.includes("deal"));

  /* Un premio NO es una jugada: si estuviera, cada vuelta ganada
     contaria como si hubiera apostado de nuevo. */
  assert.ok(!BalanceTransaction.TIPOS_QUE_JUEGAN.includes("game_win"));
  assert.ok(BalanceTransaction.TIPOS_QUE_DEVUELVEN.includes("game_win"));
  assert.ok(BalanceTransaction.TIPOS_QUE_DEVUELVEN.includes("item_sold"));
});

test("una apuesta deja su fila con lo jugado adentro", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador();

  const r = await tirar(j.token, 20);
  assert.equal(r.estado, 200, JSON.stringify(r.datos));

  const fila = await BalanceTransaction.findOne({ user: j.id, type: "game_bet" }).lean();
  assert.ok(fila, "la apuesta no dejo movimiento");
  assert.equal(fila.amountSc, -20);
  assert.equal(fila.juegaSc, 20, "la fila no dice cuanto se jugo");
});

/* ══ El contador del jugador ════════════════════════════════════════ */

test("los juegos suben lo jugado y lo jugado con plata propia", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador();

  const antes = await User.findById(j.id).lean();
  await tirar(j.token, 30);
  const despues = await User.findById(j.id).lean();

  assert.equal(
    Math.round((despues.jugadoSc - (antes.jugadoSc || 0)) * 100) / 100, 30,
    "no subio lo jugado",
  );
  assert.equal(
    Math.round((despues.jugadoPagoSc - (antes.jugadoPagoSc || 0)) * 100) / 100, 30,
    "no subio lo jugado con plata propia",
  );
  assert.ok(vip.jugadoParaVip(despues) >= 30, "el Club VIP no vio la apuesta");
});

/* ══ Las carreras ═══════════════════════════════════════════════════ */

test("LAS CARRERAS CUENTAN LO QUE SE JUEGA EN LOS JUEGOS", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador();

  await tirar(j.token, 40);

  const { desde, hasta } = races.ventanaDe("daily");
  const tabla = await races.tablaDe({ desde, hasta, cuantos: 50 });
  const mio = tabla.find((f) => String(f.user) === String(j.id));

  assert.ok(mio, "el jugador no aparece en la tabla de la carrera");
  assert.ok(mio.jugadoSc >= 40, "la carrera le conto " + mio.jugadoSc + " de 40");
});

/* ══ El rakeback del Club VIP ═══════════════════════════════════════ */

test("la ventana del rakeback ve lo jugado en los juegos", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador();

  /*
    Lo que se prueba aca es que la VENTANA cuenta la apuesta, no
    cuanto paga: el rakeback se gana jugando con plata propia y el
    rango de una cuenta nueva no cobra.
  */
  await tirar(j.token, 100);

  const { desde, hasta } = vip.ventanaDe("daily");
  const jugado = await vip.jugadoEn(oid(j.id), desde, hasta);
  assert.ok(jugado >= 100, "la ventana del rakeback conto " + jugado + " de 100");
});

/* ══ Los limites que se pone el jugador ═════════════════════════════ */

test("EL TOPE DIARIO DE JUEGO CORTA UNA APUESTA DE UN JUEGO", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador();

  await User.updateOne({ _id: j.id }, { $set: { limites: { juegoDiarioSc: 50 } } });

  const primera = await tirar(j.token, 40);
  assert.equal(primera.estado, 200, JSON.stringify(primera.datos));

  const segunda = await tirar(j.token, 40);
  assert.equal(segunda.datos.code, "DAILY_PLAY_LIMIT", "paso el tope diario");
  assert.equal(segunda.estado, 403);
});

test("lo jugado de hoy y lo perdido de hoy incluyen los juegos", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador();

  for (let i = 0; i < 6; i += 1) await tirar(j.token, 10);

  const hoy = await controles.loDeHoy(oid(j.id));
  assert.ok(hoy.jugadoSc >= 60, "el jugado de hoy conto " + hoy.jugadoSc + " de 60");

  /*
    LO PERDIDO ES LO JUGADO MENOS LO COBRADO.

    Seis vueltas al 50% dejan premios casi seguro. Si los premios no
    contaran, lo perdido diria 60 y el tope de perdida se le cerraria
    al jugador por plata que no perdio.
  */
  const cobrado = await BalanceTransaction.aggregate([
    { $match: { user: oid(j.id), type: "game_win" } },
    { $group: { _id: null, total: { $sum: "$amountSc" } } },
  ]);
  const premios = cobrado.length ? Math.round(cobrado[0].total * 100) / 100 : 0;

  assert.ok(Math.abs(hoy.recuperadoSc - premios) < 0.01, "no conto los premios como recuperado");
  assert.ok(
    Math.abs(hoy.perdidaSc - Math.max(0, hoy.jugadoSc - premios)) < 0.01,
    "lo perdido no es lo jugado menos lo cobrado",
  );
});

/* ══ La comision del socio ════════════════════════════════ */

test("EL SOCIO COBRA POR LO QUE JUEGAN LOS SUYOS EN LOS JUEGOS", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  const socio = await User.create({
    username: "sociodejuegos",
    email: "sociodejuegos@test.local",
    passwordHash: "x",
    rangoAfiliado: 1,
  });
  const codigo = await AffiliateCode.create({ code: "JUEGOS1", owner: socio._id });

  n += 1;
  const alta = await pedir("POST", "/auth/register", {
    cuerpo: {
      username: `jc${n}`,
      email: `jc${n}@test.local`,
      password: "unaclavelarga",
      affiliateCode: codigo.code,
    },
  });
  assert.equal(alta.datos.success, true, JSON.stringify(alta.datos));
  const referido = { id: alta.datos.user._id, token: alta.datos.token };
  await User.updateOne({ _id: referido.id }, { $set: { balanceSc: 500 } });

  for (let i = 0; i < 10; i += 1) await tirar(referido.token, 10);

  const despues = await AffiliateCode.findById(codigo._id).lean();
  assert.ok(
    despues.jugadoPorLosSuyosSc >= 100,
    "el socio vio " + despues.jugadoPorLosSuyosSc + " de 100 jugados",
  );
});

/* ══ Las pantallas ════════════════════════════════════════ */

test("LOS NUMEROS DEL JUGADOR CUADRAN DESPUES DE JUGAR", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador();

  await tirar(j.token, 25);

  const r = await pedir("GET", "/profile/stats", { token: j.token });
  assert.equal(r.estado, 200, JSON.stringify(r.datos));
  const d = r.datos.data;

  assert.ok(d.jugadoSc >= 25, "Stats le conto " + d.jugadoSc + " de 25");
  assert.ok(d.jugadoSegunElLibro >= 25, "el libro de Stats no vio la apuesta");
  assert.equal(d.cuadra, true, "Stats le muestra el cartel de que los numeros no cuadran");
});

test("el panel suma lo apostado y RESTA lo pagado", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  const admin = await jugador();
  await User.updateOne({ _id: admin.id }, { $set: { rank: "owner" } });

  const j = await jugador();
  for (let i = 0; i < 5; i += 1) await tirar(j.token, 20);

  const r = await pedir("GET", "/admin/dashboard?dias=30", { token: admin.token });
  assert.equal(r.estado, 200, JSON.stringify(r.datos));
  const d = r.datos.data;

  assert.ok(d.jugadoSc >= 100, "el panel conto " + d.jugadoSc + " de 100 jugados");
  assert.ok(d.jugadas >= 5, "el panel no conto las jugadas");

  /*
    EL MARGEN NO PUEDE SER EL 100%.

    Los juegos devuelven 94 de cada 100: si el panel sumara las
    apuestas sin restar los premios, mostraria un margen que no
    existe, y sobre ese numero se toman decisiones de plata.
  */
  assert.ok(d.pagadoEnJuegosSc >= 0, "el panel no mira los premios de los juegos");
  assert.ok(
    d.margenSc < d.jugadoSc,
    "margen " + d.margenSc + " sobre " + d.jugadoSc + " jugados: no resto los premios",
  );
});
