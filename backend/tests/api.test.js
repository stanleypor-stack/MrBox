/**
 * EL SITIO ENTERO, POR HTTP.
 *
 * Levanta el servidor de verdad contra una base de verdad y lo usa como
 * lo usaría el navegador. No hay nada simulado: si esto pasa, el flujo
 * funciona.
 *
 * EL CAPTCHA, ACA, QUEDA APAGADO
 *
 * Y no es un agujero: `services/turnstile.js` se apaga solo cuando no
 * hay clave configurada, que es lo que hace que alguien pueda levantar
 * el proyecto sin tener cuenta de Cloudflare. Acá se aprovecha eso.
 *
 * Que el captcha de verdad bloquea se prueba aparte, con la clave real y
 * un token inventado: Cloudflare lo rechaza y el registro devuelve
 * CAPTCHA_FAILED. Eso no se puede probar acá porque haría falta un
 * navegador resolviendo el desafío.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DATABASE_URI = process.env.TEST_DB_URI || "mongodb://127.0.0.1:27017/mrbox_test_api";
process.env.JWT_SECRET = "prueba-local";
process.env.TURNSTILE_SECRET_KEY = ""; // ver arriba
process.env.LOG_LEVEL = "error";
/*
  El limite de intentos cuenta por direccion, y acá los dieciocho casos
  salen de 127.0.0.1. Sin esto, a partir del decimo registro el servidor
  contesta 429 y las pruebas fallan por el motivo equivocado --que es
  justo lo que paso la primera vez que se corrieron.
*/
process.env.AUTH_RATE_LIMIT = "500";

const mongoose = require("mongoose");
const { app } = require("../index");
const { conectar } = require("../database");

const User = require("../database/models/User");
const Box = require("../database/models/Box");
const Item = require("../database/models/Item");
const AffiliateCode = require("../database/models/AffiliateCode");
const wallet = require("../services/wallet");
const afiliados = require("../services/affiliates");
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

    /*
      LAS TRES CAJAS DE REGALO.

      El regalo de bienvenida son tres CAJAS, no tres fichas: si no
      existen en el catálogo, no hay regalo que dar. Hacen falta acá
      para que el registro sea el mismo que en el sitio.
    */
    const algo = await Item.create({ sku: "REG-1", name: "Algo", valueSc: 2.76, rarity: "blue" });

    for (const slug of ["mac", "pokemon-boosters", "splash"]) {
      await Box.create({
        slug,
        name: slug,
        category: "Mix",
        live: true,
        priceSc: 3,
        prizes: [{ item: algo._id, name: algo.name, valueSc: algo.valueSc, chance: 1, rarity: "blue" }],
      });
    }
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

/** Un pedido, como lo haría el navegador. */
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
function cuentaNueva(extra = {}) {
  n += 1;
  return {
    username: "jug" + n + "x",
    email: `jug${n}x@test.local`,
    password: "unaclavelarga",
    ...extra,
  };
}

/* ── Registro ─────────────────────────────────────────────────────── */

test("alguien se registra y queda con sus aperturas de regalo", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const { estado, datos } = await pedir("POST", "/auth/register", { cuerpo: cuentaNueva() });

  assert.equal(estado, 201, JSON.stringify(datos));
  assert.ok(datos.token, "no vino el token");
  assert.equal(datos.user.balanceSc, 0);
  assert.equal(datos.user.freeOpens, 3, "el regalo de bienvenida son 3 cajas");

  /* Y son TRES CAJAS distintas, no tres fichas para la misma. */
  const enLaBase = await User.findById(datos.user._id).select("cajasGratis").lean();
  assert.equal(enLaBase.cajasGratis.length, 3);
  assert.equal(new Set(enLaBase.cajasGratis.map((c) => c.slug)).size, 3, "tres cajas distintas");
  assert.ok(enLaBase.cajasGratis.every((c) => c.usadaEl === null));
  assert.equal(datos.user.verificationLevel, 0);
  assert.equal(datos.user.rank, "user");
  assert.ok(!("passwordHash" in datos.user), "LA CONTRASENA NO PUEDE SALIR DEL SERVIDOR");
});

test("no se puede repetir el email ni el nombre de usuario", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const cuenta = cuentaNueva();
  await pedir("POST", "/auth/register", { cuerpo: cuenta });

  const repiteEmail = await pedir("POST", "/auth/register", {
    cuerpo: { ...cuentaNueva(), email: cuenta.email },
  });
  assert.equal(repiteEmail.datos.code, "EMAIL_TAKEN");

  const repiteUsuario = await pedir("POST", "/auth/register", {
    cuerpo: { ...cuentaNueva(), username: cuenta.username },
  });
  assert.equal(repiteUsuario.datos.code, "USERNAME_TAKEN");
});

test("una clave corta o un email torcido no entran", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const corta = await pedir("POST", "/auth/register", { cuerpo: cuentaNueva({ password: "1234" }) });
  assert.equal(corta.estado, 400);

  const torcido = await pedir("POST", "/auth/register", { cuerpo: cuentaNueva({ email: "no-es-un-email" }) });
  assert.equal(torcido.estado, 400);
});

/* ── Entrada ──────────────────────────────────────────────────────── */

test("entra con su clave, y con otra no", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const cuenta = cuentaNueva();
  await pedir("POST", "/auth/register", { cuerpo: cuenta });

  const bien = await pedir("POST", "/auth/login", {
    cuerpo: { email: cuenta.email, password: cuenta.password },
  });
  assert.equal(bien.estado, 200);
  assert.ok(bien.datos.token);

  const mal = await pedir("POST", "/auth/login", {
    cuerpo: { email: cuenta.email, password: "otracosa" },
  });
  assert.equal(mal.estado, 401);
  assert.equal(mal.datos.code, "BAD_CREDENTIALS");
});

test("un email que no existe da EL MISMO error que una clave mala", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  /*
    Si dijera "ese email no existe", cualquiera con una lista de correos
    podria averiguar cuales son cuentas de este sitio probando de a uno.
  */
  const noExiste = await pedir("POST", "/auth/login", {
    cuerpo: { email: "nadie@test.local", password: "loquesea12345" },
  });
  assert.equal(noExiste.datos.code, "BAD_CREDENTIALS");
  assert.equal(noExiste.estado, 401);
});

test("sin token no se entra a lo privado, y con uno falso tampoco", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const sinNada = await pedir("GET", "/profile/stats");
  assert.equal(sinNada.estado, 401);
  assert.equal(sinNada.datos.code, "NOT_LOGGED_IN");

  const inventado = await pedir("GET", "/profile/stats", { token: "esto.no.es.un.token" });
  assert.equal(inventado.estado, 401);
  assert.equal(inventado.datos.code, "SESSION_EXPIRED");
});

test("una cuenta cerrada no entra aunque tenga token", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const cuenta = cuentaNueva();
  const { datos } = await pedir("POST", "/auth/register", { cuerpo: cuenta });

  await User.updateOne({ email: cuenta.email }, { $set: { banned: true } });

  const r = await pedir("GET", "/auth/me", { token: datos.token });
  assert.equal(r.estado, 403);
  assert.equal(r.datos.code, "ACCOUNT_BANNED");
});

/* ── El codigo de afiliado y el bono ──────────────────────────────── */

test("se registra con un codigo y queda atado al socio", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const socio = await User.create({
    username: "socio" + Date.now(), email: `socio${Date.now()}@test.local`, passwordHash: "x",
  });
  await AffiliateCode.create({ code: "TEST10", owner: socio._id, tramo: "destacado", comision: 0.3 });

  /* En minuscula a proposito: nadie se acuerda de como estaba escrito. */
  const { datos } = await pedir("POST", "/auth/register", {
    cuerpo: cuentaNueva({ affiliateCode: "test10" }),
  });

  assert.equal(datos.affiliate.code, "TEST10");
  assert.equal(datos.affiliate.bono, 0.1, "el tramo destacado da 10%");
  assert.equal(datos.user.affiliateCode, "TEST10");

  const codigo = await AffiliateCode.findOne({ code: "TEST10" }).lean();
  assert.equal(codigo.jugadores, 1, "el socio tiene que contar un jugador mas");
});

test("un codigo que no existe NO impide registrarse, pero avisa", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  /*
    Es un error de alguien escribiendo, no una razon para no dejarlo
    entrar. Perder un registro por una letra mal puesta es carisimo.
  */
  const { estado, datos } = await pedir("POST", "/auth/register", {
    cuerpo: cuentaNueva({ affiliateCode: "NOEXISTE" }),
  });
  assert.equal(estado, 201);
  assert.equal(datos.affiliate.code, null);
  assert.equal(datos.affiliate.invalido, "NOEXISTE");
});

test("EL BONO DEL 10% SE ACREDITA Y NO SE PUEDE CANJEAR HASTA JUGARLO", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const socio = await User.create({
    username: "socio2" + Date.now(), email: `socio2${Date.now()}@test.local`, passwordHash: "x",
  });
  await AffiliateCode.create({ code: "BONO10", owner: socio._id, tramo: "destacado", comision: 0.3 });

  const { datos } = await pedir("POST", "/auth/register", {
    cuerpo: cuentaNueva({ affiliateCode: "BONO10" }),
  });
  const id = datos.user._id;
  const token = datos.token;

  /* Compra de SC 1.000. */
  const usuario = await User.findById(id).lean();
  const { bonoSc, porcentaje } = await afiliados.bonoDeCompra(usuario, 1000);
  assert.equal(porcentaje, 0.1);
  assert.equal(bonoSc, 100);

  await wallet.mover({ userId: id, amountSc: 1000, type: "purchase", reference: { label: "USDT" } });
  await wallet.mover({ userId: id, amountSc: bonoSc, type: "affiliate", bonoSc, reference: { label: "BONO10" } });

  const s1 = await pedir("GET", "/profile/stats", { token });
  assert.equal(s1.datos.data.balanceSc, 1100);
  assert.equal(s1.datos.data.bonoPendienteSc, 100);
  assert.equal(s1.datos.data.canjeableSc, 1000, "los SC 100 de regalo todavia no se pueden sacar");

  /* Juega los 100 del bono. */
  await wallet.mover({ userId: id, amountSc: -100, type: "box_open", juegaSc: 100 });

  const s2 = await pedir("GET", "/profile/stats", { token });
  assert.equal(s2.datos.data.bonoPendienteSc, 0);
  assert.equal(s2.datos.data.canjeableSc, 1000, "ahora si puede sacar todo lo que le queda");
  assert.equal(s2.datos.data.jugadoSc, 100);
});

test("nadie se trae a si mismo", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const cuenta = cuentaNueva();
  const { datos } = await pedir("POST", "/auth/register", { cuerpo: cuenta });
  await AffiliateCode.create({ code: "YOMISMO", owner: datos.user._id, tramo: "normal" });

  const atado = await afiliados.atarAlSocio({ _id: datos.user._id }, "YOMISMO");
  assert.equal(atado, null, "el autofraude mas viejo que hay");
});

/* ── La comision del socio ────────────────────────────────────────── */

test("la comision del socio sale del MARGEN, no de lo jugado", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const socio = await User.create({
    username: "socio3" + Date.now(), email: `socio3${Date.now()}@test.local`, passwordHash: "x",
  });
  await AffiliateCode.create({ code: "MARGEN", owner: socio._id, tramo: "normal", comision: 0.3 });

  const { datos } = await pedir("POST", "/auth/register", {
    cuerpo: cuentaNueva({ affiliateCode: "MARGEN" }),
  });
  const jugador = await User.findById(datos.user._id).lean();

  /* Jugo SC 1.000 en cajas al 92%: el margen son SC 80. */
  const r = await afiliados.anotarComision({ jugador, jugadoSc: 1000, margenSc: 80 });

  assert.equal(r.ganado, 24, "30% de los 80 de margen, no 300 de los 1000 jugados");

  const codigo = await AffiliateCode.findOne({ code: "MARGEN" }).lean();
  assert.equal(codigo.jugadoPorLosSuyosSc, 1000);
  assert.equal(codigo.ganadoSc, 24);
});

test("una jugada que dejo margen negativo no le descuenta al socio", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const socio = await User.create({
    username: "socio4" + Date.now(), email: `socio4${Date.now()}@test.local`, passwordHash: "x",
  });
  await AffiliateCode.create({ code: "SUERTE", owner: socio._id, comision: 0.3, ganadoSc: 50 });

  const { datos } = await pedir("POST", "/auth/register", {
    cuerpo: cuentaNueva({ affiliateCode: "SUERTE" }),
  });
  const jugador = await User.findById(datos.user._id).lean();

  /* Se llevo un premio mas caro que la caja: la casa perdio 400. */
  const r = await afiliados.anotarComision({ jugador, jugadoSc: 13.72, margenSc: -400 });
  assert.equal(r.ganado, 0, "la comision de una jugada perdedora es cero, no negativa");

  const codigo = await AffiliateCode.findOne({ code: "SUERTE" }).lean();
  assert.equal(codigo.ganadoSc, 50, "lo que ya tenia ganado no se toca");
});

test("el socio cobra, y no puede cobrar dos veces lo mismo", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const cuenta = cuentaNueva();
  const { datos } = await pedir("POST", "/auth/register", { cuerpo: cuenta });
  const codigo = await AffiliateCode.create({
    code: "COBRO" + n, owner: datos.user._id, comision: 0.3, ganadoSc: 120, cobradoSc: 0,
  });

  /* Diez pedidos de cobro al mismo tiempo: tiene que cobrar UNA vez. */
  const intentos = Array.from({ length: 10 }, () =>
    pedir("POST", "/profile/affiliate/claim", { token: datos.token, cuerpo: { codigoId: codigo._id } })
  );
  const rs = await Promise.all(intentos);
  const pasaron = rs.filter((r) => r.datos.success).length;

  assert.equal(pasaron, 1, `cobro ${pasaron} veces`);

  const final = await AffiliateCode.findById(codigo._id).lean();
  assert.equal(final.cobradoSc, 120);

  const saldo = await wallet.saldoDe(datos.user._id);
  assert.equal(saldo.balanceSc, 120, "le entro una sola vez");
});

/* ── El extracto ──────────────────────────────────────────────────── */

test("el extracto muestra cada movimiento encadenado con el anterior", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const cuenta = cuentaNueva();
  const { datos } = await pedir("POST", "/auth/register", { cuerpo: cuenta });
  const id = datos.user._id;

  await wallet.mover({ userId: id, amountSc: 200, type: "purchase", reference: { label: "USDT TRC20" } });
  await wallet.mover({ userId: id, amountSc: -13.72, type: "box_open", juegaSc: 13.72, reference: { label: "Day Trader" } });
  await wallet.mover({ userId: id, amountSc: 7.81, type: "item_sold", reference: { label: "GoPro Floaty" } });

  const { datos: d } = await pedir("GET", "/profile/transactions", { token: datos.token });
  const filas = d.data.items;

  assert.equal(d.data.total, 3);
  assert.equal(filas[0].type, "item_sold", "lo mas nuevo primero");
  assert.equal(filas[0].label, "GoPro Floaty", "tiene que decir QUE fue, no solo cuanto");
  assert.equal(filas[2].type, "purchase");

  /* El saldo final del extracto tiene que ser el saldo de verdad. */
  const saldo = await wallet.saldoDe(id);
  assert.equal(filas[0].balanceAfter, saldo.balanceSc);
  assert.equal(saldo.balanceSc, sc(200 - 13.72 + 7.81));
});

test("los numeros del perfil cuadran con el libro", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const cuenta = cuentaNueva();
  const { datos } = await pedir("POST", "/auth/register", { cuerpo: cuenta });
  const id = datos.user._id;

  await wallet.mover({ userId: id, amountSc: 500, type: "purchase" });
  for (let i = 0; i < 5; i += 1) {
    await wallet.mover({ userId: id, amountSc: -13.72, type: "box_open", juegaSc: 13.72 });
  }

  const { datos: d } = await pedir("GET", "/profile/stats", { token: datos.token });
  const s = d.data;

  assert.equal(s.compradoSc, 500);
  assert.equal(s.jugadoSc, sc(13.72 * 5), "lo jugado, que es lo que manda para el VIP");
  assert.equal(s.jugadoSegunElLibro, sc(13.72 * 5));
  assert.equal(s.cuadra, true, "el contador y el libro tienen que decir lo mismo");
  assert.equal(s.balanceSc, sc(500 - 13.72 * 5));
});

test("el extracto se puede filtrar por tipo y viene paginado", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const cuenta = cuentaNueva();
  const { datos } = await pedir("POST", "/auth/register", { cuerpo: cuenta });
  const id = datos.user._id;

  await wallet.mover({ userId: id, amountSc: 300, type: "purchase" });
  for (let i = 0; i < 12; i += 1) {
    await wallet.mover({ userId: id, amountSc: -1, type: "box_open", juegaSc: 1 });
  }

  const soloCompras = await pedir("GET", "/profile/transactions?type=purchase", { token: datos.token });
  assert.equal(soloCompras.datos.data.total, 1);

  const pagina = await pedir("GET", "/profile/transactions?perPage=5", { token: datos.token });
  assert.equal(pagina.datos.data.items.length, 5);
  assert.equal(pagina.datos.data.total, 13);
  assert.equal(pagina.datos.data.pages, 3);
});

test("nadie ve el extracto de otro", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const uno = await pedir("POST", "/auth/register", { cuerpo: cuentaNueva() });
  const otro = await pedir("POST", "/auth/register", { cuerpo: cuentaNueva() });

  await wallet.mover({ userId: uno.datos.user._id, amountSc: 999, type: "purchase" });

  const { datos } = await pedir("GET", "/profile/transactions", { token: otro.datos.token });
  assert.equal(datos.data.total, 0, "vio movimientos que no son suyos");
});
