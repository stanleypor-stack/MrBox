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
const { conectar, asegurarIndices } = require("../database");

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
    /* El `dropDatabase` se lleva puestos los indices, y los unicos
       son los que hacen cumplir media docena de reglas de esta
       suite. Hay que volver a crearlos a mano. */
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

  /*
    ESTAS PRUEBAS SON DEL BONO DEL SOCIO, QUE EMPIEZA EN EL SEGUNDO
    DEPOSITO.

    El primero se lo lleva el bono de bienvenida, que es del 50% y pisa
    al del codigo. Marcarlo como ya usado deja al descubierto el camino
    del socio, que es lo que se quiere medir aca. El de bienvenida
    tiene su propia prueba.
  */
  await User.updateOne({ _id: datos.user._id }, { $set: { bonoDeBienvenidaEl: new Date() } });

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
    type: "static_address",
    /*
      `amount` son unidades de la moneda y `value` son dolares. El
      servidor acredita `value`, que es lo unico que vale un dolar.
      Mandar los dos, como hace OxaPay de verdad.
    */
    currency: "USDT",
    amount: monto,
    value: monto,
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
  /* OxaPay exige que la respuesta sea el texto "ok", no un JSON: con
     cualquier otra cosa reintenta cinco veces y la da por fallida. */
  return { estado: r.status, texto: await r.text() };
}

test("EL PRIMER DEPOSITO SE LLEVA EL 50% DE BIENVENIDA, Y UNO SOLO", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  const { codigo } = await socioCon({}, 6);

  /* Sin marcar: este arranca limpio y le toca el de bienvenida. */
  const r = await fetch(`${base}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "bienve1x",
      email: "bienve1x@test.local",
      password: "unaclavelarga",
      affiliateCode: codigo.code,
    }),
  });
  const { user } = await r.json();

  await avisoDePago({ userId: user._id, monto: 100, trackId: "T-bienve-" + Date.now() });

  const uno = await wallet.saldoDe(user._id);
  assert.equal(uno.balanceSc, 150, "SC 100 + 50% de bienvenida");
  assert.equal(uno.bonoPendienteSc, 500, "el bono se juega 10 veces");

  /* El segundo ya no: ese es del socio, 5%. */
  await avisoDePago({ userId: user._id, monto: 100, trackId: "T-bienve2-" + Date.now() });

  const dos = await wallet.saldoDe(user._id);
  assert.equal(dos.balanceSc, 260, "SC 150 + 100 + el 10% del socio, que ya no es el de bienvenida");
});

test("EL DEPOSITO ACREDITA LA COMPRA MAS EL BONO, Y EL BONO QUEDA ATADO", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  const { codigo } = await socioCon({}, 6);
  const jug = await jugadorDe(codigo.code);

  const r = await avisoDePago({ userId: jug.id, monto: 300, trackId: "T-" + Date.now() });
  assert.equal(r.estado, 200);

  const saldo = await wallet.saldoDe(jug.id);
  assert.equal(saldo.balanceSc, 330, "SC 300 comprados + SC 30 de bono");

  /*
    Y el bono no se puede sacar hasta jugarlo. Lo que queda ATADO es el
    bono --SC 30-- y no lo que falta jugar, que con 10x son SC 300.
    Atar los 300 trababa tambien los 300 que el jugador deposito.
  */
  assert.equal(saldo.bonoPendienteSc, 300, "hay que jugar 10 veces el bono");
  assert.equal(saldo.bonoAtadoSc, 30, "pero atado esta el bono, no lo que falta jugar");
  assert.equal(saldo.canjeableSc, 300, "lo suyo lo puede sacar desde el primer dia");

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

  assert.equal(segundo.texto, "ok", "el repetido tambien contesta ok");

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

/* ── Un campo, los dos tipos de codigo ────────────────────────────── */

/** Pone un codigo desde el cajon, como lo hace la pantalla. */
async function ponerCodigo(token, code) {
  const r = await fetch(`${base}/wallet/code`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-auth-token": token },
    body: JSON.stringify({ code }),
  });
  return { estado: r.status, datos: await r.json() };
}

test("EL CODIGO PROPIO NO DICE 'no existe', DICE QUE ES EL PROPIO", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  /*
    Es el error que mas tiempo le hace perder a cualquiera: el socio
    prueba su codigo, le dice "no existe", y se va a revisar como lo
    escribio cuando el problema era otro.
  */
  const { codigo, socio } = await socioCon({}, 2);

  /* El socio entra con su propia cuenta. */
  const jwt = require("jsonwebtoken");
  const token = jwt.sign({ id: String(socio._id) }, process.env.JWT_SECRET, { expiresIn: "1h" });

  const r = await ponerCodigo(token, codigo.code);
  assert.equal(r.datos.code, "OWN_CODE");
});

test("un codigo de afiliado se ata desde el cajon, y una sola vez", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  const { codigo } = await socioCon({}, 3);
  const jug = await jugadorDe("");

  const r = await ponerCodigo(jug.token, codigo.code.toLowerCase());
  assert.equal(r.estado, 200);
  assert.equal(r.datos.data.tipo, "afiliado");
  assert.equal(r.datos.data.code, codigo.code, "lo toma escrito como sea");
  assert.equal(r.datos.data.bonoPct, 7, "el bono del rango Gold");

  const otra = await ponerCodigo(jug.token, codigo.code);
  assert.equal(otra.datos.code, "CODE_ALREADY_USED");

  /* Y lo que dice la pantalla es lo que se acredita. */
  const u = await User.findById(jug.id).lean();
  assert.equal((await afiliados.bonoDeCompra(u, 100)).bonoSc, 7);
});

test("un codigo promocional entra por el MISMO campo", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  const PromoCode = require("../database/models/PromoCode");
  n += 1;
  const texto = `PROMO${n}`;
  await PromoCode.create({ codigo: texto, tipo: "saldo", montoSc: 5, activo: true });

  const jug = await jugadorDe("");

  /*
    El jugador escribe "un codigo". No tiene por que saber si el suyo
    es de un afiliado o de una promocion.
  */
  const r = await ponerCodigo(jug.token, texto);
  assert.equal(r.estado, 200);
  assert.equal(r.datos.data.tipo, "promo");
  assert.equal(r.datos.data.montoSc, 5);

  const saldo = await wallet.saldoDe(jug.id);
  assert.equal(saldo.balanceSc, 5, "se acredito la promocion");

  const otra = await ponerCodigo(jug.token, texto);
  assert.equal(otra.datos.code, "CODE_ALREADY_USED");
});

test("uno que no existe sigue diciendo que no existe", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const jug = await jugadorDe("");
  const r = await ponerCodigo(jug.token, "NOEXISTENINGUNO");
  assert.equal(r.datos.code, "CODE_NOT_FOUND");
});
