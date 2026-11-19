/**
 * EL BONO DE LOS CODIGOS DE AFILIADO.
 *
 * Tres numeros distintos pueden decidir cuanto bono recibe el jugador que
 * entra con un codigo:
 *
 *   1. el que tenga puesto ESE codigo (`bonoPropio`), si le pusieron uno
 *   2. el del RANGO del socio que lo trajo: 5% abajo, 10% arriba
 *   3. nada, si el codigo no sirve mas
 *
 * Y una cosa que vale la pena dejar escrita en un test: el bono va con
 * LOS CUATRO MODELOS. No existe un modelo donde el jugador cobre menos
 * para que el socio cobre mas.
 *
 * Cada uno de esos caminos se prueba aca, y despues el camino completo:
 * que cuando entra la plata de verdad, al jugador se le acredite lo que
 * compro MAS el bono, y que el bono quede atado hasta jugarlo.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

process.env.DATABASE_URI = process.env.TEST_DB_URI || "mongodb://127.0.0.1:27017/mrbox_test_afiliados";
process.env.JWT_SECRET = "prueba-local";
process.env.TURNSTILE_SECRET_KEY = "";
process.env.AUTH_RATE_LIMIT = "500";
process.env.LOG_LEVEL = "error";
/* La clave con la que se firma el aviso de pago. Es de prueba. */
process.env.OXAPAY_MERCHANT_KEY = "clave-de-prueba";

const mongoose = require("mongoose");
const { app } = require("../index");
const { conectar } = require("../database");

const User = require("../database/models/User");
const AffiliateCode = require("../database/models/AffiliateCode");
const Settings = require("../database/models/Settings");
const BalanceTransaction = require("../database/models/BalanceTransaction");

const afiliados = require("../services/affiliates");
const wallet = require("../services/wallet");
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

let n = 0;

/** Un socio de rango `rango` con una campaña, como la crearía el panel. */
async function socioCon(campos = {}, rango = 1) {
  n += 1;
  const socio = await User.create({
    username: `socio${n}x`,
    email: `socio${n}x@test.local`,
    passwordHash: "x",
    rangoAfiliado: rango,
  });
  const codigo = await AffiliateCode.create({
    code: `COD${n}`,
    owner: socio._id,
    ...campos,
  });
  return { socio, codigo };
}

/** Un jugador atado a ese código. */
async function jugadorDe(code) {
  n += 1;
  const r = await fetch(`${base}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: `jug${n}x`,
      email: `jug${n}x@test.local`,
      password: "unaclavelarga",
      affiliateCode: code,
    }),
  });
  const datos = await r.json();
  return { id: datos.user._id, token: datos.token, affiliate: datos.affiliate };
}

/* ── Cuánto da cada código ────────────────────────────────────────── */

test("el bono sale del RANGO del socio: 5% el primero, 10% el último", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  const escalera = afiliados.rangos();
  const abajo = await socioCon({}, 1);
  const arriba = await socioCon({}, escalera.length);

  const a = await jugadorDe(abajo.codigo.code);
  const b = await jugadorDe(arriba.codigo.code);

  const uno = await User.findById(a.id).lean();
  const dos = await User.findById(b.id).lean();

  const bonoA = await afiliados.bonoDeCompra(uno, 200);
  const bonoB = await afiliados.bonoDeCompra(dos, 200);

  assert.equal(bonoA.porcentaje, escalera[0].bonoPct / 100);
  assert.equal(bonoA.bonoSc, 10, "5% de 200");

  assert.equal(bonoB.porcentaje, escalera[escalera.length - 1].bonoPct / 100);
  assert.equal(bonoB.bonoSc, 20, "10% de 200");

  /* Y lo mismo que se le dijo al registrarse. */
  assert.equal(a.affiliate.bono, escalera[0].bonoPct / 100);
  assert.equal(b.affiliate.bono, escalera[escalera.length - 1].bonoPct / 100);
});

test("subirle el rango al socio le sube el bono a sus jugadores, sin tocar el código", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  const { socio, codigo } = await socioCon({}, 1);
  const jug = await jugadorDe(codigo.code);
  const u = await User.findById(jug.id).lean();

  assert.equal((await afiliados.bonoDeCompra(u, 100)).bonoSc, 5, "Bronze da 5%");

  await afiliados.otorgarRango({ userId: socio._id, numero: 6 });

  assert.equal((await afiliados.bonoDeCompra(u, 100)).bonoSc, 10, "Diamond da 10%");

  /* Y la campaña no se tocó: el número no vive ahí. */
  const sinTocar = await AffiliateCode.findById(codigo._id).lean();
  assert.equal(sinTocar.bonoPropio, null);
});

test("EL BONO VA CON LOS TRES MODELOS", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  for (const modelo of afiliados.MODELOS) {
    const { codigo } = await socioCon({ modelo }, 3);
    const jug = await jugadorDe(codigo.code);
    const u = await User.findById(jug.id).lean();

    const { bonoSc } = await afiliados.bonoDeCompra(u, 100);
    assert.equal(bonoSc, 7, `el modelo ${modelo} tiene que dar el 7% del rango Gold igual`);
  }
});

test("el porcentaje propio de un código manda sobre el del rango", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  const { codigo } = await socioCon({ bonoPropio: 0.25 }, 1);
  const jug = await jugadorDe(codigo.code);
  const u = await User.findById(jug.id).lean();

  const { porcentaje, bonoSc } = await afiliados.bonoDeCompra(u, 400);
  assert.equal(porcentaje, 0.25, "le pusieron 25% a mano y tiene que ganar ese");
  assert.equal(bonoSc, 100);

  /* Cero tambien es un numero puesto a mano, y no "no tiene". */
  await AffiliateCode.updateOne({ _id: codigo._id }, { $set: { bonoPropio: 0 } });
  const sinBono = await afiliados.bonoDeCompra(u, 400);
  assert.equal(sinBono.porcentaje, 0);
  assert.equal(sinBono.bonoSc, 0);
});

test("editar la escalera cambia lo que dan los códigos", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  const { codigo } = await socioCon({}, 1);
  const jug = await jugadorDe(codigo.code);
  const u = await User.findById(jug.id).lean();

  const original = afiliados.rangos();
  const tocada = original.map((r, i) => (i === 0 ? { ...r, bonoPct: 8 } : r));

  await Settings.updateOne({}, { $set: { rangosAfiliado: tocada } }, { upsert: true });
  await afiliados.recargar();

  const { porcentaje, bonoSc } = await afiliados.bonoDeCompra(u, 100);
  assert.equal(porcentaje, 0.08);
  assert.equal(bonoSc, 8);

  /* Y se deja como estaba, que los demás tests leen la de fábrica. */
  await Settings.updateOne({}, { $set: { rangosAfiliado: [] } });
  await afiliados.recargar();
  assert.equal(afiliados.rangoNumero(1).bonoPct, 5);
});

test("un código apagado o vencido no da bono", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  const apagado = await socioCon({ activo: false }, 6);
  const vencido = await socioCon({ venceEl: new Date(Date.now() - 60 * 1000) }, 6);

  /* El jugador se ata igual: el codigo existe, lo que no sirve es el bono. */
  const a = await jugadorDe(apagado.codigo.code);
  const b = await jugadorDe(vencido.codigo.code);

  const uno = await User.findById(a.id).lean();
  const dos = await User.findById(b.id).lean();

  assert.equal((await afiliados.bonoDeCompra(uno, 500)).bonoSc, 0);
  assert.equal((await afiliados.bonoDeCompra(dos, 500)).bonoSc, 0);
});

test("sin código no hay bono, y nunca se rompe", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const jug = await jugadorDe("");
  const u = await User.findById(jug.id).lean();

  const r = await afiliados.bonoDeCompra(u, 1000);
  assert.equal(r.bonoSc, 0);
  assert.equal(r.codigo, null);
});

/* ── El camino de verdad: entra plata, se acredita con el bono ────── */

/** El aviso de pago, firmado como lo firma OxaPay. */
async function avisoDePago({ userId, monto, trackId }) {
  const cuerpo = JSON.stringify({
    status: "paid",
    amount: monto,
    track_id: trackId,
    order_id: String(userId),
  });

  const firma = crypto
    .createHmac("sha512", process.env.OXAPAY_MERCHANT_KEY)
    .update(cuerpo)
    .digest("hex");

  const r = await fetch(`${base}/hooks/oxapay`, {
    method: "POST",
    headers: { "Content-Type": "application/json", hmac: firma },
    body: cuerpo,
  });
  return { estado: r.status, datos: await r.json() };
}

test("EL DEPOSITO ACREDITA LA COMPRA MAS EL BONO, Y EL BONO QUEDA ATADO", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  const { codigo } = await socioCon({}, 6);
  const jug = await jugadorDe(codigo.code);

  const r = await avisoDePago({ userId: jug.id, monto: 300, trackId: "T-" + Date.now() });
  assert.equal(r.estado, 200);

  const saldo = await wallet.saldoDe(jug.id);
  assert.equal(saldo.balanceSc, 330, "SC 300 comprados + SC 30 de bono");

  /*
    Y el bono no se puede sacar hasta jugarlo: `vecesAJugarElBono` es 1
    de fábrica, asi que quedan SC 30 atados.
  */
  assert.equal(saldo.canjeableSc, 300);

  /* En el libro queda UNA compra, por el total que entró a la cuenta. */
  const compras = await BalanceTransaction.find({ user: jug.id, type: "purchase" }).lean();
  assert.equal(compras.length, 1);
  assert.equal(sc(compras[0].amountSc), 330);
});

test("el mismo aviso dos veces no acredita dos veces", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  const { codigo } = await socioCon({}, 1);
  const jug = await jugadorDe(codigo.code);
  const track = "T-repetido-" + Date.now();

  await avisoDePago({ userId: jug.id, monto: 100, trackId: track });
  const segundo = await avisoDePago({ userId: jug.id, monto: 100, trackId: track });

  assert.equal(segundo.datos.repetido, true);

  const saldo = await wallet.saldoDe(jug.id);
  assert.equal(saldo.balanceSc, 105, "SC 100 + 5% una sola vez");
});

test("un aviso mal firmado no acredita nada", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  const jug = await jugadorDe("");
  const cuerpo = JSON.stringify({
    status: "paid", amount: 9999, track_id: "T-falso", order_id: String(jug.id),
  });

  const r = await fetch(`${base}/hooks/oxapay`, {
    method: "POST",
    headers: { "Content-Type": "application/json", hmac: "a".repeat(128) },
    body: cuerpo,
  });

  assert.notEqual(r.status, 200);

  const saldo = await wallet.saldoDe(jug.id);
  assert.equal(saldo.balanceSc, 0, "cualquiera con la direccion del aviso se regalaba SC");
});

/* ── Lo que el jugador ve cuando pone el código después ───────────── */

test("poner el código después dice el porcentaje del rango que de verdad le toca", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  const { codigo } = await socioCon({}, 6);
  const jug = await jugadorDe("");

  const r = await fetch(`${base}/wallet/code`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-auth-token": jug.token },
    body: JSON.stringify({ code: codigo.code }),
  });
  const datos = await r.json();

  assert.equal(datos.success, true);
  assert.equal(datos.data.bonoPct, 10, "Diamond da 10%, no el 5% de siempre");

  /* Y lo que se le dijo es lo que se le acredita. */
  await avisoDePago({ userId: jug.id, monto: 100, trackId: "T-tarde-" + Date.now() });
  const saldo = await wallet.saldoDe(jug.id);
  assert.equal(saldo.balanceSc, 110);
});
