/**
 * LA CAJA: CANJES.
 *
 * Es la única puerta por la que sale plata de verdad, así que lo que se
 * prueba acá es lo que cuesta plata si está mal:
 *
 *  - que el saldo se descuente AL PEDIR y no al pagar;
 *  - que rechazar lo devuelva, y una sola vez;
 *  - que no se pueda pedir más de lo que hay, ni menos del mínimo, ni
 *    sin verificación.
 *
 * Los depósitos no se prueban contra OxaPay: una prueba que llama a la
 * pasarela de verdad crea direcciones de verdad cada vez que corre.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DATABASE_URI = process.env.TEST_DB_URI || "mongodb://127.0.0.1:27017/mrbox_test_caja";
process.env.JWT_SECRET = "prueba-local";
process.env.TURNSTILE_SECRET_KEY = "";
process.env.AUTH_RATE_LIMIT = "500";
process.env.LOG_LEVEL = "error";
/* Sin claves: ni deposito ni pago salen a la red desde una prueba. */
process.env.OXAPAY_MERCHANT_KEY = "";
process.env.OXAPAY_PAYOUT_KEY = "";

const mongoose = require("mongoose");
const { app } = require("../index");
const { conectar } = require("../database");

const User = require("../database/models/User");
const Redemption = require("../database/models/Redemption");
const BalanceTransaction = require("../database/models/BalanceTransaction");

let servidor;
let base = "";
let hayBase = true;

const DIRECCION = "TQirXjMsnFbno5DmHkBj5qptiXNxzuCsy6";

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

async function pedir(metodo, ruta, opciones) {
  const o = opciones || {};
  const r = await fetch(base + ruta, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...(o.token ? { "x-auth-token": o.token } : {}) },
    body: o.cuerpo ? JSON.stringify(o.cuerpo) : undefined,
  });
  return { estado: r.status, datos: await r.json() };
}

let n = 0;
async function jugador(opciones) {
  const o = opciones || {};
  n += 1;
  const cuenta = { username: `caja${n}`, email: `caja${n}@test.local`, password: "unaclavelarga" };
  const { datos } = await pedir("POST", "/auth/register", { cuerpo: cuenta });

  await User.updateOne(
    { _id: datos.user._id },
    {
      $set: {
        balanceSc: o.saldo === undefined ? 500 : o.saldo,
        verificationLevel: o.nivel === undefined ? 2 : o.nivel,
      },
    }
  );

  return { id: datos.user._id, token: datos.token };
}

async function equipo() {
  n += 1;
  const cuenta = { username: `cadm${n}`, email: `cadm${n}@test.local`, password: "unaclavelarga" };
  const { datos } = await pedir("POST", "/auth/register", { cuerpo: cuenta });
  await User.updateOne({ _id: datos.user._id }, { $set: { rank: "admin" } });
  return { id: datos.user._id, token: datos.token };
}

function saldoDe(id) {
  return User.findById(id).select("+balanceSc").lean().then((u) => u.balanceSc);
}

/* ── Pedir ────────────────────────────────────────────────────────── */

test("pedir un canje descuenta el saldo EN EL MOMENTO", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 500 });

  const { estado, datos } = await pedir("POST", "/wallet/withdraw", {
    token: j.token,
    cuerpo: { montoSc: 120, coin: "USDT", network: "TRC20", address: DIRECCION },
  });

  assert.equal(estado, 200, JSON.stringify(datos));
  assert.equal(datos.data.pedido.estado, "pending");
  assert.equal(datos.data.balanceSc, 380);
  assert.equal(await saldoDe(j.id), 380, "el saldo se descuenta al pedir, no al pagar");

  const fila = await BalanceTransaction.findOne({ user: j.id, type: "redemption" }).lean();
  assert.ok(fila, "tiene que quedar en el libro");
  assert.equal(fila.amountSc, -120);
});

test("no se puede pedir dos veces el mismo saldo", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 100 });
  const cuerpo = { montoSc: 100, coin: "USDT", network: "TRC20", address: DIRECCION };

  const uno = await pedir("POST", "/wallet/withdraw", { token: j.token, cuerpo });
  assert.equal(uno.estado, 200);

  const dos = await pedir("POST", "/wallet/withdraw", { token: j.token, cuerpo });
  assert.equal(dos.estado, 400);
  assert.equal(dos.datos.code, "NOT_ENOUGH_COINS");
  assert.equal(await saldoDe(j.id), 0);
});

test("abajo del mínimo no se puede", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 500 });

  const { estado, datos } = await pedir("POST", "/wallet/withdraw", {
    token: j.token,
    cuerpo: { montoSc: 5, coin: "USDT", network: "TRC20", address: DIRECCION },
  });

  assert.equal(estado, 400);
  assert.equal(datos.code, "BELOW_MINIMUM");
  assert.equal(await saldoDe(j.id), 500, "no se toca el saldo si rebota");
});

test("sin verificación de identidad no sale plata", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 500, nivel: 1 });

  const { estado, datos } = await pedir("POST", "/wallet/withdraw", {
    token: j.token,
    cuerpo: { montoSc: 100, coin: "USDT", network: "TRC20", address: DIRECCION },
  });

  assert.equal(estado, 400);
  assert.equal(datos.code, "VERIFICATION_LEVEL_TOO_LOW");
  assert.equal(await saldoDe(j.id), 500);
});

test("una dirección que no parece una dirección rebota", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 500 });

  const { estado } = await pedir("POST", "/wallet/withdraw", {
    token: j.token,
    cuerpo: { montoSc: 100, coin: "USDT", network: "TRC20", address: "ahi nomas" },
  });

  assert.equal(estado, 400);
  assert.equal(await saldoDe(j.id), 500);
});

/* ── Resolver ─────────────────────────────────────────────────────── */

test("rechazar devuelve la plata, y una sola vez", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 500 });
  const a = await equipo();

  const { datos } = await pedir("POST", "/wallet/withdraw", {
    token: j.token,
    cuerpo: { montoSc: 200, coin: "BTC", network: "BTC", address: DIRECCION },
  });
  const id = datos.data.pedido._id;
  assert.equal(await saldoDe(j.id), 300);

  const no = await pedir("POST", `/admin/redemptions/${id}/reject`, {
    token: a.token,
    cuerpo: { motivo: "la direccion no es de la red que dice" },
  });
  assert.equal(no.estado, 200, JSON.stringify(no.datos));
  assert.equal(await saldoDe(j.id), 500, "vuelve entero");

  /* Rechazarlo otra vez no puede devolverlo de nuevo. */
  const otra = await pedir("POST", `/admin/redemptions/${id}/reject`, {
    token: a.token,
    cuerpo: { motivo: "otra vez, a ver que pasa" },
  });
  assert.equal(await saldoDe(j.id), 500, "no se devuelve dos veces");
  assert.ok(otra.estado === 200 || otra.estado === 400);
});

test("rechazar sin motivo no se puede", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 500 });
  const a = await equipo();

  const { datos } = await pedir("POST", "/wallet/withdraw", {
    token: j.token,
    cuerpo: { montoSc: 60, coin: "USDT", network: "TRC20", address: DIRECCION },
  });

  const no = await pedir("POST", `/admin/redemptions/${datos.data.pedido._id}/reject`, {
    token: a.token,
    cuerpo: { motivo: "" },
  });

  assert.equal(no.estado, 400);
  assert.equal(no.datos.code, "REASON_REQUIRED");
});

test("aprobar no paga: sin clave de pagos, pagar rebota", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 500 });
  const a = await equipo();

  const { datos } = await pedir("POST", "/wallet/withdraw", {
    token: j.token,
    cuerpo: { montoSc: 60, coin: "USDT", network: "TRC20", address: DIRECCION },
  });
  const id = datos.data.pedido._id;

  const ok = await pedir("POST", `/admin/redemptions/${id}/approve`, { token: a.token });
  assert.equal(ok.estado, 200);
  assert.equal(ok.datos.data.estado, "approved");
  assert.equal(await saldoDe(j.id), 440, "aprobar no mueve el saldo otra vez");

  const pago = await pedir("POST", `/admin/redemptions/${id}/pay`, { token: a.token });
  assert.notEqual(pago.estado, 200, "sin OXAPAY_PAYOUT_KEY no se puede pagar");

  const enLaBase = await Redemption.findById(id).lean();
  assert.equal(enLaBase.estado, "approved", "y no queda marcado como pagado");
});

/* ── Cancelar ─────────────────────────────────────────────────────── */

test("el jugador puede cancelar mientras nadie lo miró", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 500 });

  const { datos } = await pedir("POST", "/wallet/withdraw", {
    token: j.token,
    cuerpo: { montoSc: 75, coin: "LTC", network: "LTC", address: DIRECCION },
  });
  assert.equal(await saldoDe(j.id), 425);

  const cancelado = await pedir("POST", `/wallet/withdrawals/${datos.data.pedido._id}/cancel`, { token: j.token });
  assert.equal(cancelado.estado, 200);
  assert.equal(await saldoDe(j.id), 500);
});

test("un jugador no entra a la cola del panel", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({});
  const { estado } = await pedir("GET", "/admin/redemptions", { token: j.token });
  assert.ok(estado === 401 || estado === 403);
});

/* ── Depositar ────────────────────────────────────────────────────── */

test("sin pasarela conectada NO se inventa una dirección", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({});

  const { estado, datos } = await pedir("GET", "/wallet/deposit?coin=USDT&network=TRC20", { token: j.token });

  assert.equal(estado, 200);
  assert.equal(datos.data.conectada, false);
  assert.equal(datos.data.direccion, undefined, "una direccion de mentira es plata perdida");
});

/* ── El nivel que pide el canje lo dice el panel ──────────────────── */

test("el nivel de verificacion que pide un canje sale de los ajustes", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  /*
    Era un numero fijo en el codigo. Es una perilla porque la exigencia
    cambia: el dia que el proveedor pida domicilio para pagar, se sube a
    3 desde el panel y no hay que desplegar nada.
  */
  const Settings = require("../database/models/Settings");
  const cashier = require("../services/cashier");

  const j = await jugador({ saldo: 500, nivel: 2 });

  /* Con el 2 de siempre, el de nivel 2 pasa. */
  const normal = await pedir("POST", "/wallet/withdraw", {
    token: j.token,
    cuerpo: { montoSc: 100, coin: "USDT", network: "TRC20", address: DIRECCION },
  });
  assert.equal(normal.estado, 200, JSON.stringify(normal.datos));

  /* Subido a 3, el mismo jugador ya no pasa. */
  await Settings.updateOne({ key: "main" }, { $set: { canjeNivelMinimo: 3 } }, { upsert: true });

  const estricto = await pedir("POST", "/wallet/withdraw", {
    token: j.token,
    cuerpo: { montoSc: 100, coin: "USDT", network: "TRC20", address: DIRECCION },
  });
  assert.equal(estricto.datos.code, "VERIFICATION_LEVEL_TOO_LOW");
  assert.equal(estricto.datos.data.nivel, 3, "le dice QUE nivel le falta");

  /* Y la pantalla pide el mismo numero que el servidor exige. */
  const u = await User.findById(j.id).lean();
  const antes = await cashier.antesDeCanjear(u);
  assert.equal(antes.nivelQuePide, 3);

  /* Se deja como estaba, que las otras pruebas usan el 2. */
  await Settings.updateOne({ key: "main" }, { $set: { canjeNivelMinimo: 2 } });
});
