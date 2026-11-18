/**
 * EL PANEL, POR HTTP.
 *
 * La ficha de un jugador y la de una carrera: las dos pantallas donde
 * el equipo toca plata, trabas y rangos. Se prueban como las usa el
 * navegador, con un admin de verdad y contra una base de verdad.
 *
 * LO QUE IMPORTA ACA
 *
 *   - que la ficha diga la verdad: los números salen del LIBRO
 *   - que un jugador no pueda entrar aunque tenga sesión
 *   - que una traba sin motivo no se guarde
 *   - que un premio de carrera no se pueda pagar dos veces
 */

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DATABASE_URI = process.env.TEST_DB_URI || "mongodb://127.0.0.1:27017/mrbox_test_panel";
process.env.JWT_SECRET = "prueba-local";
process.env.TURNSTILE_SECRET_KEY = "";
process.env.AUTH_RATE_LIMIT = "500";
process.env.LOG_LEVEL = "error";

const mongoose = require("mongoose");
const { app } = require("../index");
const { conectar } = require("../database");

const User = require("../database/models/User");
const Race = require("../database/models/Race");
const BalanceTransaction = require("../database/models/BalanceTransaction");
const AdminLog = require("../database/models/AdminLog");

const wallet = require("../services/wallet");
const carreras = require("../services/races");
const { sc } = require("../utils/money");

let servidor;
let base = "";
let hayBase = true;

test.before(async () => {
  try {
    await conectar();
    await mongoose.connection.db.dropDatabase();
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
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "x-auth-token": token } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return { estado: r.status, datos: await r.json() };
}

let n = 0;
async function cuenta(rank = "user") {
  n += 1;
  const { datos } = await pedir("POST", "/auth/register", {
    cuerpo: {
      username: "pan" + n + "x",
      email: `pan${n}x@test.local`,
      password: "unaclavelarga",
    },
  });
  if (rank !== "user") await User.updateOne({ _id: datos.user._id }, { $set: { rank } });
  return { id: datos.user._id, token: datos.token, username: datos.user.username };
}

/* ── Quién entra ──────────────────────────────────────────────────── */

test("un jugador con sesión no entra a la ficha de nadie", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const jug = await cuenta();
  const otro = await cuenta();

  const r = await pedir("GET", `/admin/players/${otro.id}/full`, { token: jug.token });
  assert.equal(r.estado, 403, "un jugador entró al panel");
});

/* ── La ficha ─────────────────────────────────────────────────────── */

test("la ficha de un jugador cuenta lo que dice el libro", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const jefe = await cuenta("admin");
  const jug = await cuenta();

  await wallet.mover({ userId: jug.id, amountSc: 500, type: "purchase" });
  await wallet.mover({ userId: jug.id, amountSc: -120, type: "box_open", juegaSc: 120 });
  await wallet.mover({ userId: jug.id, amountSc: 40, type: "item_sold" });
  await wallet.mover({ userId: jug.id, amountSc: 10, type: "race_prize" });

  const { datos } = await pedir("GET", `/admin/players/${jug.id}/full`, { token: jefe.token });
  const d = datos.data;

  assert.equal(d.numeros.compradoSc, 500);
  assert.equal(d.numeros.jugadoSc, 120);
  assert.equal(d.numeros.devueltoSc, 40);
  assert.equal(d.numeros.regaladoSc, 10);

  /* Lo que le dejó a la casa: jugó 120, se llevó 40 + 10. */
  assert.equal(d.margenSc, 70, "el margen no sale del libro");
  assert.equal(d.jugador.balanceSc, sc(500 - 120 + 40 + 10));
  assert.ok(Array.isArray(d.rangos) && d.rangos.length >= 9, "faltan los rangos para el selector");
});

test("cada solapa de la ficha trae lo suyo, paginado", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const jefe = await cuenta("admin");
  const jug = await cuenta();

  await wallet.mover({ userId: jug.id, amountSc: 400, type: "purchase" });
  for (let i = 0; i < 30; i += 1) {
    await wallet.mover({ userId: jug.id, amountSc: -1, type: "box_open", juegaSc: 1 });
  }

  const p1 = await pedir("GET", `/admin/players/${jug.id}/movimientos`, { token: jefe.token });
  assert.equal(p1.datos.data.items.length, 25);
  assert.equal(p1.datos.data.total, 31);
  assert.equal(p1.datos.data.pages, 2);

  const p2 = await pedir("GET", `/admin/players/${jug.id}/movimientos?page=2`, { token: jefe.token });
  assert.equal(p2.datos.data.items.length, 6);

  /* Las que todavía no tienen nada contestan vacío, no se rompen. */
  for (const solapa of ["aperturas", "inventario", "pedidos", "canjes", "accesos"]) {
    const r = await pedir("GET", `/admin/players/${jug.id}/${solapa}`, { token: jefe.token });
    assert.equal(r.estado, 200, `la solapa ${solapa} se rompió`);
    assert.ok(Array.isArray(r.datos.data.items));
  }
});

/* ── Lo que el equipo le hace ─────────────────────────────────────── */

test("las trabas piden motivo y quedan anotadas", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const jefe = await cuenta("admin");
  const jug = await cuenta();

  const sinMotivo = await pedir("POST", `/admin/players/${jug.id}/locks`, {
    token: jefe.token,
    cuerpo: { canje: true },
  });
  assert.equal(sinMotivo.estado, 400, "una traba sin motivo se guardó");

  const r = await pedir("POST", `/admin/players/${jug.id}/locks`, {
    token: jefe.token,
    cuerpo: { canje: true, envio: true, motivo: "canje raro del 12" },
  });
  assert.equal(r.estado, 200);

  const enLaBase = await User.findById(jug.id).lean();
  assert.equal(enLaBase.trabas.canje, true);
  assert.equal(enLaBase.trabas.envio, true);
  assert.equal(enLaBase.trabas.promos, false);
  assert.equal(enLaBase.trabas.motivo, "canje raro del 12");

  const anotado = await AdminLog.findOne({ evento: "player.locks" }).lean();
  assert.ok(anotado, "la traba no quedó en el registro");
});

test("el rango puesto a mano sube pero nunca baja", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const jefe = await cuenta("admin");
  const jug = await cuenta();

  /* Lo ponen en Gold sin haber jugado: sube. */
  const r = await pedir("POST", `/admin/players/${jug.id}/tier`, {
    token: jefe.token,
    cuerpo: { rango: "Gold", motivo: "viene de otro sitio" },
  });
  assert.equal(r.estado, 200);

  let ficha = await pedir("GET", `/admin/players/${jug.id}/full`, { token: jefe.token });
  assert.equal(ficha.datos.data.rango.nombre, "Gold");

  /* Después juega lo de un rango más alto: manda lo jugado. */
  await wallet.mover({ userId: jug.id, amountSc: 600000, type: "purchase" });
  await wallet.mover({ userId: jug.id, amountSc: -600000, type: "box_open", juegaSc: 600000 });

  ficha = await pedir("GET", `/admin/players/${jug.id}/full`, { token: jefe.token });
  assert.notEqual(ficha.datos.data.rango.nombre, "Gold", "lo jugado quedó tapado por el rango a mano");

  /* Un rango que no existe no entra. */
  const mal = await pedir("POST", `/admin/players/${jug.id}/tier`, {
    token: jefe.token,
    cuerpo: { rango: "Platino", motivo: "a ver" },
  });
  assert.equal(mal.estado, 400);
});

test("la nota interna se guarda y no la ve el jugador", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const jefe = await cuenta("admin");
  const jug = await cuenta();

  await pedir("POST", `/admin/players/${jug.id}/note`, {
    token: jefe.token,
    cuerpo: { nota: "pidió no recibir promociones" },
  });

  const ficha = await pedir("GET", `/admin/players/${jug.id}/full`, { token: jefe.token });
  assert.equal(ficha.datos.data.jugador.notaInterna, "pidió no recibir promociones");

  const suyo = await pedir("GET", "/profile", { token: jug.token });
  assert.equal(JSON.stringify(suyo.datos).includes("no recibir promociones"), false, "el jugador vio la nota");
});

/*
  LAS TRABAS FRENAN DE VERDAD.

  Un interruptor que se guarda pero no frena nada es peor que no
  tenerlo: soporte cree que freno la cuenta y la cuenta sigue
  cobrando.
*/

test("la traba del canje no deja pedir un canje", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const jefe = await cuenta("admin");
  const jug = await cuenta();

  await User.updateOne({ _id: jug.id }, { $set: { verificationLevel: 2 } });
  await wallet.mover({ userId: jug.id, amountSc: 500, type: "purchase" });

  await pedir("POST", `/admin/players/${jug.id}/locks`, {
    token: jefe.token,
    cuerpo: { canje: true, motivo: "revisando un deposito" },
  });

  const r = await pedir("POST", "/wallet/withdraw", {
    token: jug.token,
    cuerpo: { montoSc: 50, ticker: "BTC", red: "BTC", direccion: "bc1qarealishlongaddress000000" },
  });
  assert.equal(r.estado, 400);
  assert.equal(r.datos.code, "REDEMPTION_LOCKED");
});

test("la traba de las promos no deja canjear un código", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const jefe = await cuenta("admin");
  const jug = await cuenta();

  await pedir("POST", `/admin/players/${jug.id}/locks`, {
    token: jefe.token,
    cuerpo: { promos: true, motivo: "abuso de códigos" },
  });

  const r = await pedir("POST", "/wallet/promo", { token: jug.token, cuerpo: { code: "LOQUESEA" } });
  assert.equal(r.estado, 403);
  assert.equal(r.datos.code, "PROMOS_LOCKED");
});

test("la traba de las carreras lo saca de la tabla", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const jefe = await cuenta("admin");
  const mucho = await cuenta();
  const poco = await cuenta();

  const desde = new Date();
  await wallet.mover({ userId: mucho.id, amountSc: 900, type: "purchase" });
  await wallet.mover({ userId: poco.id, amountSc: 900, type: "purchase" });
  await wallet.mover({ userId: mucho.id, amountSc: -400, type: "box_open", juegaSc: 400 });
  await wallet.mover({ userId: poco.id, amountSc: -10, type: "box_open", juegaSc: 10 });

  const carrera = await Race.create({
    tipo: "daily",
    desde,
    hasta: new Date(Date.now() + 60 * 60 * 1000),
    premioTotalSc: 100,
    reparto: [100],
    estado: "live",
  });

  const antes = await pedir("GET", `/admin/races/${carrera._id}`, { token: jefe.token });
  assert.equal(antes.datos.data.puestos[0].username, mucho.username);

  await pedir("POST", `/admin/players/${mucho.id}/locks`, {
    token: jefe.token,
    cuerpo: { carreras: true, motivo: "multicuenta" },
  });

  const despues = await pedir("GET", `/admin/races/${carrera._id}`, { token: jefe.token });
  assert.equal(despues.datos.data.puestos.length, 1, "el trabado sigue en la tabla");
  assert.equal(despues.datos.data.puestos[0].username, poco.username, "no corrió el puesto");
});

/* ── Una carrera por dentro ───────────────────────────────────────── */

test("la carrera muestra quién va ganando y cuánto le toca", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const jefe = await cuenta("admin");
  const uno = await cuenta();
  const dos = await cuenta();

  /*
    LA VENTANA EMPIEZA ACA.

    Todas las pruebas comparten una base: si la carrera arrancara una
    hora atras, contaria tambien lo que jugaron las pruebas anteriores
    y el podio seria de otros. Arrancando ahora, adentro queda solo lo
    de esta prueba --que es justo lo que una carrera de verdad hace.
  */
  const desde = new Date();
  const hasta = new Date(Date.now() + 60 * 60 * 1000);
  const carrera = await Race.create({
    tipo: "daily",
    desde,
    hasta,
    premioTotalSc: 1000,
    reparto: [50, 30, 20],
    estado: "live",
  });

  await wallet.mover({ userId: uno.id, amountSc: 900, type: "purchase" });
  await wallet.mover({ userId: dos.id, amountSc: 900, type: "purchase" });
  await wallet.mover({ userId: uno.id, amountSc: -300, type: "box_open", juegaSc: 300 });
  await wallet.mover({ userId: dos.id, amountSc: -100, type: "box_open", juegaSc: 100 });

  const { datos } = await pedir("GET", `/admin/races/${carrera._id}`, { token: jefe.token });
  const d = datos.data;

  assert.equal(d.puestos.length, 2);
  assert.equal(d.puestos[0].username, uno.username, "el que más jugó no va primero");
  assert.equal(d.puestos[0].premioSc, 500, "el 50% de 1000");
  assert.equal(d.puestos[1].premioSc, 300);
  assert.equal(d.puestos[0].cobradoSc, null, "una carrera viva no pagó todavía");
  assert.equal(d.numeros.pagadoSc, 0);
});

test("cerrarla a mano paga una sola vez", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const jefe = await cuenta("admin");
  const uno = await cuenta();

  const carrera = await Race.create({
    tipo: "weekly",
    desde: new Date(), // ver arriba: la ventana empieza acá
    hasta: new Date(Date.now() + 60 * 60 * 1000),
    premioTotalSc: 200,
    reparto: [100],
    estado: "live",
  });

  await wallet.mover({ userId: uno.id, amountSc: 500, type: "purchase" });
  await wallet.mover({ userId: uno.id, amountSc: -50, type: "box_open", juegaSc: 50 });

  const sinMotivo = await pedir("POST", `/admin/races/${carrera._id}/settle`, { token: jefe.token, cuerpo: {} });
  assert.equal(sinMotivo.estado, 400, "se cerró sin motivo");

  const r = await pedir("POST", `/admin/races/${carrera._id}/settle`, {
    token: jefe.token,
    cuerpo: { motivo: "cierre adelantado por mantenimiento" },
  });
  assert.equal(r.estado, 200);

  /* Dos clics no pagan dos veces. */
  const otraVez = await pedir("POST", `/admin/races/${carrera._id}/settle`, {
    token: jefe.token,
    cuerpo: { motivo: "cierre adelantado por mantenimiento" },
  });
  assert.equal(otraVez.estado, 400);

  const pagos = await BalanceTransaction.find({ type: "race_prize", user: uno.id }).lean();
  assert.equal(pagos.length, 1, "le pagaron el premio dos veces");
  assert.equal(sc(pagos[0].amountSc), 200);

  const ficha = await pedir("GET", `/admin/races/${carrera._id}`, { token: jefe.token });
  assert.equal(ficha.datos.data.numeros.pagadoSc, 200);
  assert.equal(ficha.datos.data.numeros.sinPagar, 0);
});

test("un premio que quedó sin pagar se paga de a uno, y una sola vez", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const jefe = await cuenta("admin");
  const uno = await cuenta();

  /*
    Una carrera YA cerrada con un ganador al que nunca se le pagó: es
    lo que queda cuando un pago falla en el cierre.
  */
  const carrera = await Race.create({
    tipo: "monthly",
    desde: new Date(Date.now() - 2 * 60 * 60 * 1000),
    hasta: new Date(Date.now() - 60 * 60 * 1000),
    premioTotalSc: 300,
    reparto: [100],
    estado: "settled",
    cerradaEl: new Date(),
    ganadores: [{ user: uno.id, username: uno.username, puesto: 1, jugadoSc: 90, premioSc: 300 }],
  });

  const antes = await pedir("GET", `/admin/races/${carrera._id}`, { token: jefe.token });
  assert.equal(antes.datos.data.numeros.sinPagar, 1, "no marcó el premio sin pagar");

  const r = await pedir("POST", `/admin/races/${carrera._id}/pay/${uno.id}`, { token: jefe.token, cuerpo: {} });
  assert.equal(r.estado, 200);

  const otraVez = await pedir("POST", `/admin/races/${carrera._id}/pay/${uno.id}`, { token: jefe.token, cuerpo: {} });
  assert.equal(otraVez.estado, 400, "pagó el mismo premio dos veces");

  const pagos = await BalanceTransaction.find({ type: "race_prize", user: uno.id }).lean();
  assert.equal(pagos.length, 1);
  assert.equal(sc(pagos[0].amountSc), 300);

  const despues = await pedir("GET", `/admin/races/${carrera._id}`, { token: jefe.token });
  assert.equal(despues.datos.data.numeros.sinPagar, 0);
});

/* `carreras` se usa arriba sólo a través de las rutas: esto deja claro
   que el cálculo del premio es el mismo de un lado y del otro. */
test("el premio del puesto es el mismo que calcula el servicio", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  assert.equal(carreras.premioDe([50, 30, 20], 1000, 1), 500);
  assert.equal(carreras.premioDe([50, 30, 20], 1000, 4), 0);
});
