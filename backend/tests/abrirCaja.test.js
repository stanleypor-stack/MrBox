/**
 * ABRIR UNA CAJA, DE PUNTA A PUNTA.
 *
 * Contra el servidor y la base de verdad. Lo que se prueba acá no es
 * "anda": es que no se pueda sacar plata de donde no corresponde.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DATABASE_URI = process.env.TEST_DB_URI || "mongodb://127.0.0.1:27017/mrbox_test_cajas";
process.env.JWT_SECRET = "prueba-local";
process.env.TURNSTILE_SECRET_KEY = "";
process.env.AUTH_RATE_LIMIT = "500";
process.env.OPEN_RATE_LIMIT = "5000";
process.env.LOG_LEVEL = "error";

const mongoose = require("mongoose");
const { app } = require("../index");
const { conectar } = require("../database");

const User = require("../database/models/User");
const BalanceTransaction = require("../database/models/BalanceTransaction");
const Box = require("../database/models/Box");
const Item = require("../database/models/Item");
const BoxOpen = require("../database/models/BoxOpen");
const InventoryItem = require("../database/models/InventoryItem");
const UserSeed = require("../database/models/UserSeed");
const AffiliateCode = require("../database/models/AffiliateCode");

const wallet = require("../services/wallet");
const fair = require("../services/boxes/fair");
const { sc } = require("../utils/money");

let servidor;
let base = "";
let hayBase = true;

/*
  Una caja de prueba con dos premios y chances redondas. Sirve para
  poder razonar de cabeza: el barato sale el 90% de las veces.
*/
const PRECIO = 10;

test.before(async () => {
  try {
    await conectar();
    await mongoose.connection.db.dropDatabase();
    servidor = app.listen(0);
    await new Promise((r) => servidor.once("listening", r));
    base = `http://127.0.0.1:${servidor.address().port}/api`;

    const caro = await Item.create({ sku: "CARO", name: "Lo caro", valueSc: 80, rarity: "gold" });
    const barato = await Item.create({ sku: "BARATO", name: "Lo barato", valueSc: 1, rarity: "blue" });

    await Box.create({
      slug: "prueba", name: "Caja de prueba", category: "Mix", live: true,
      priceSc: PRECIO, pagoPromedio: 8.9, retorno: 0.89,
      prizes: [
        { item: caro._id, name: "Lo caro", valueSc: 80, chance: 0.1, rarity: "gold" },
        { item: barato._id, name: "Lo barato", valueSc: 1, chance: 0.9, rarity: "blue" },
      ],
    });

    await Box.create({
      slug: "apagada", name: "Caja apagada", live: false,
      priceSc: 5, prizes: [{ item: barato._id, name: "Lo barato", valueSc: 1, chance: 1, rarity: "blue" }],
    });
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
/** Un jugador con saldo y SIN aperturas de regalo, salvo que se pidan. */
async function jugador({ saldo = 100, gratis = 0, codigo = null } = {}) {
  n += 1;
  const cuenta = { username: `cj${n}`, email: `cj${n}@test.local`, password: "unaclavelarga" };
  if (codigo) cuenta.affiliateCode = codigo;
  const { datos } = await pedir("POST", "/auth/register", { cuerpo: cuenta });
  /*
    La gratis es de UNA CAJA, no una ficha suelta (ver services/boxes).
    Las pruebas que piden `gratis: 2` piden dos cajas de regalo, y como
    acá hay una sola caja de prueba, se reparte esa.
  */
  const laDePrueba = await Box.findOne({ slug: "prueba" }).select("slug name").lean();
  const cajasGratis = Array.from({ length: gratis }, () => ({
    box: laDePrueba._id,
    slug: laDePrueba.slug,
    nombre: laDePrueba.name,
    usadaEl: null,
  }));

  await User.updateOne(
    { _id: datos.user._id },
    { $set: { balanceSc: saldo, freeOpens: gratis, cajasGratis } }
  );
  return { id: datos.user._id, token: datos.token };
}

/* ── Lo basico ────────────────────────────────────────────────────── */

test("abrir cobra el precio y deja el objeto en el inventario", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 100 });

  const { estado, datos } = await pedir("POST", "/boxes/prueba/open", { token: j.token });
  assert.equal(estado, 200, JSON.stringify(datos));

  const r = datos.data;
  assert.equal(r.resultados.length, 1);
  assert.equal(r.gastadoSc, PRECIO);
  assert.equal(r.balanceSc, 100 - PRECIO);

  const premio = r.resultados[0].premio;
  assert.ok(["Lo caro", "Lo barato"].includes(premio.name));

  /* El objeto esta de verdad en el inventario, no solo en la respuesta. */
  const inv = await pedir("GET", "/inventory", { token: j.token });
  assert.equal(inv.datos.data.items.length, 1);
  assert.equal(inv.datos.data.items[0].name, premio.name);
  assert.equal(inv.datos.data.items[0].valueSc, premio.valueSc);
});

test("sin saldo no se abre, y no queda nada a medias", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 3 });

  const { datos } = await pedir("POST", "/boxes/prueba/open", { token: j.token });
  assert.equal(datos.code, "NOT_ENOUGH_COINS");
  assert.equal(datos.data.faltan, 7);

  assert.equal(await BoxOpen.countDocuments({ user: j.id }), 0, "quedo un recibo de una apertura que no paso");
  assert.equal(await InventoryItem.countDocuments({ user: j.id }), 0, "quedo un objeto regalado");
  const saldo = await wallet.saldoDe(j.id);
  assert.equal(saldo.balanceSc, 3, "le cobraron igual");
});

test("una caja apagada no se abre", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 100 });
  const { datos } = await pedir("POST", "/boxes/apagada/open", { token: j.token });
  assert.equal(datos.code, "BOX_NOT_LIVE");
});

test("una caja que no existe avisa, no explota", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 100 });
  const { estado, datos } = await pedir("POST", "/boxes/no-existe/open", { token: j.token });
  assert.equal(estado, 404);
  assert.equal(datos.code, "BOX_NOT_FOUND");
});

/* ── Las aperturas de regalo ──────────────────────────────────────── */

test("LAS GRATIS SE GASTAN ANTES QUE EL SALDO", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 100, gratis: 2 });

  const una = await pedir("POST", "/boxes/prueba/open", { token: j.token });
  assert.equal(una.datos.data.gastadoSc, 0, "cobro habiendo una gratis");
  assert.equal(una.datos.data.balanceSc, 100);
  assert.equal(una.datos.data.freeOpens, 1);
  assert.equal(una.datos.data.resultados[0].conAperturaGratis, true);

  await pedir("POST", "/boxes/prueba/open", { token: j.token });

  /* Ya no quedan: esta se paga. */
  const tercera = await pedir("POST", "/boxes/prueba/open", { token: j.token });
  assert.equal(tercera.datos.data.gastadoSc, PRECIO);
  assert.equal(tercera.datos.data.balanceSc, 90);
  assert.equal(tercera.datos.data.freeOpens, 0);
});

test("una apertura gratis SI suma a lo jugado, y deja sus dos filas", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  /*
    ANTES NO CONTABA, Y ESTABA MAL.

    Lo jugado mueve el rango VIP, las carreras, el rakeback y el margen
    del panel, y TODO eso sale del libro. Con la apertura gratis sin
    fila, el que abria sus tres cajas de regalo veia "jugado SC 0,00"
    --parecia roto-- y el premio que salio de esas cajas no aparecia
    como costo en ningun lado.

    Ahora el regalo entra y la apertura se cobra: el saldo queda igual y
    las dos filas dicen la verdad.

    El miedo era escalar rangos de arriba: no da. Las gratis son tres al
    registrarse y Silver pide SC 25.000. Y si un dia se regalan muchas,
    estan todas en el libro como `promo_code` para poder mirarlas.
  */
  const j = await jugador({ saldo: 100, gratis: 1 });
  const { datos } = await pedir("POST", "/boxes/prueba/open", { token: j.token });

  /* Del bolsillo no salio nada. */
  assert.equal(datos.data.gastadoSc, 0);
  assert.equal(datos.data.balanceSc, 100);

  const u = await User.findById(j.id).lean();
  assert.equal(u.jugadoSc, PRECIO, "la gratis tiene que contar como jugada");

  const filas = await BalanceTransaction.find({ user: j.id }).sort({ createdAt: 1 }).lean();
  assert.equal(filas.length, 2, "el regalo y la apertura");
  assert.equal(filas[0].type, "promo_code");
  assert.equal(filas[0].amountSc, PRECIO);
  assert.equal(filas[1].type, "box_open");
  assert.equal(filas[1].amountSc, -PRECIO);
  assert.equal(filas[1].balanceAfter, 100, "neto cero: el saldo no se movio");
});

/* ── Varias de una ────────────────────────────────────────────────── */

test("abrir x4 cobra cuatro veces y da cuatro objetos", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 100 });

  const { datos } = await pedir("POST", "/boxes/prueba/open", {
    token: j.token, cuerpo: { veces: 4 },
  });

  assert.equal(datos.data.resultados.length, 4);
  assert.equal(datos.data.gastadoSc, PRECIO * 4);
  assert.equal(datos.data.balanceSc, 100 - PRECIO * 4);
  assert.equal(await InventoryItem.countDocuments({ user: j.id }), 4);
});

test("CADA APERTURA USA UN NONCE DISTINTO", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  /*
    Si dos aperturas compartieran nonce darian el mismo resultado con la
    misma prueba, y el sorteo verificable dejaria de serlo.
  */
  const j = await jugador({ saldo: 1000 });
  await pedir("POST", "/boxes/prueba/open", { token: j.token, cuerpo: { veces: 4 } });
  await pedir("POST", "/boxes/prueba/open", { token: j.token, cuerpo: { veces: 4 } });

  const recibos = await BoxOpen.find({ user: j.id }).select("nonce").lean();
  const nonces = recibos.map((r) => r.nonce);
  assert.equal(nonces.length, 8);
  assert.equal(new Set(nonces).size, 8, `se repitieron: ${nonces.sort((a, b) => a - b).join(",")}`);
});

test("no se pueden abrir mas de las permitidas de una", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 1000 });
  const { datos } = await pedir("POST", "/boxes/prueba/open", { token: j.token, cuerpo: { veces: 99 } });
  assert.equal(datos.code, "TOO_MANY_AT_ONCE");
  assert.equal(datos.data.maximo, 4);
});

test("aperturas al mismo tiempo no comparten nonce ni gastan de mas", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 50 }); // alcanza para 5

  const intentos = Array.from({ length: 12 }, () =>
    pedir("POST", "/boxes/prueba/open", { token: j.token })
      .then((r) => (r.datos.success ? "ok" : r.datos.code))
  );
  const rs = await Promise.all(intentos);
  const pasaron = rs.filter((r) => r === "ok").length;

  assert.equal(pasaron, 5, `pasaron ${pasaron} con saldo para 5`);

  const saldo = await wallet.saldoDe(j.id);
  assert.equal(saldo.balanceSc, 0);

  const recibos = await BoxOpen.find({ user: j.id }).select("nonce").lean();
  assert.equal(new Set(recibos.map((r) => r.nonce)).size, recibos.length, "se repitio un nonce");
});

/* ── La de demostracion ───────────────────────────────────────────── */

test("la demo sortea pero NO cobra, NO paga y NO guarda", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const { estado, datos } = await pedir("POST", "/boxes/prueba/demo", { cuerpo: { veces: 3 } });

  assert.equal(estado, 200);
  assert.equal(datos.data.demo, true);
  assert.equal(datos.data.resultados.length, 3);
  assert.ok(datos.data.resultados[0].premio.name);

  assert.equal(await BoxOpen.countDocuments({ demo: true }), 0);
  const inventariosDeNadie = await InventoryItem.countDocuments({ user: null });
  assert.equal(inventariosDeNadie, 0);
});

test("la demo se puede usar sin cuenta", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const { estado } = await pedir("POST", "/boxes/prueba/demo");
  assert.equal(estado, 200, "alguien sin cuenta tiene que poder probar");
});

/* ── Vender ───────────────────────────────────────────────────────── */

test("vender paga lo que vale y marca el objeto", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 100 });
  const abierta = await pedir("POST", "/boxes/prueba/open", { token: j.token });
  const objeto = abierta.datos.data.resultados[0].premio;

  const { datos } = await pedir("POST", `/inventory/${objeto._id}/sell`, { token: j.token });
  assert.equal(datos.data.vendidoSc, objeto.valueSc);
  assert.equal(datos.data.balanceSc, sc(100 - PRECIO + objeto.valueSc));

  const guardado = await InventoryItem.findById(objeto._id).lean();
  assert.equal(guardado.state, "sold");
  assert.equal(guardado.soldFor, objeto.valueSc);
});

test("NO SE PUEDE VENDER DOS VECES EL MISMO OBJETO", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 100 });
  const abierta = await pedir("POST", "/boxes/prueba/open", { token: j.token });
  const objeto = abierta.datos.data.resultados[0].premio;

  /* Diez pedidos de venta al mismo tiempo sobre el mismo objeto. */
  const rs = await Promise.all(
    Array.from({ length: 10 }, () =>
      pedir("POST", `/inventory/${objeto._id}/sell`, { token: j.token })
        .then((r) => (r.datos.success ? "ok" : r.datos.code))
    )
  );
  assert.equal(rs.filter((x) => x === "ok").length, 1, `se vendio ${rs.filter((x) => x === "ok").length} veces`);

  const saldo = await wallet.saldoDe(j.id);
  assert.equal(saldo.balanceSc, sc(100 - PRECIO + objeto.valueSc), "le pagaron de mas");
});

test("nadie vende un objeto de otro", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const duenio = await jugador({ saldo: 100 });
  const ajeno = await jugador({ saldo: 100 });

  const abierta = await pedir("POST", "/boxes/prueba/open", { token: duenio.token });
  const objeto = abierta.datos.data.resultados[0].premio;

  const { estado, datos } = await pedir("POST", `/inventory/${objeto._id}/sell`, { token: ajeno.token });
  assert.equal(estado, 404);
  assert.equal(datos.code, "ITEM_NOT_FOUND");

  const guardado = await InventoryItem.findById(objeto._id).lean();
  assert.equal(guardado.state, "held", "se lo vendieron a otro");
});

/* ── El sorteo verificable ────────────────────────────────────────── */

test("la semilla del servidor NO sale antes de rotarla", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 100 });
  const abierta = await pedir("POST", "/boxes/prueba/open", { token: j.token });
  const id = abierta.datos.data.resultados[0].boxOpenId;

  const { datos } = await pedir("GET", `/inventory/fair/verify/${id}`, { token: j.token });
  assert.equal(datos.data.verificable, false);
  assert.equal(datos.data.motivo, "LA_SEMILLA_SIGUE_TAPADA");
  assert.ok(!datos.data.semillaServidor, "LA SEMILLA SE FILTRO: podria calcular lo que le va a salir");
  assert.ok(datos.data.semillaServidorHash, "el hash si tiene que verse");
});

test("despues de rotar, el jugador rehace el sorteo y le da igual", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 100 });
  const abierta = await pedir("POST", "/boxes/prueba/open", { token: j.token, cuerpo: { veces: 3 } });
  const ids = abierta.datos.data.resultados.map((r) => r.boxOpenId);

  const rotada = await pedir("POST", "/inventory/fair/rotate", {
    token: j.token, cuerpo: { semillaCliente: "la-mia-nueva" },
  });
  assert.equal(rotada.datos.data.revelada.aperturas, 3);
  assert.equal(rotada.datos.data.nueva.nonce, 0, "el contador arranca de cero");
  assert.equal(rotada.datos.data.nueva.semillaCliente, "la-mia-nueva");

  for (const id of ids) {
    const { datos } = await pedir("GET", `/inventory/fair/verify/${id}`, { token: j.token });
    assert.equal(datos.data.verificable, true);
    assert.equal(datos.data.coincide, true, "el sorteo no da lo mismo al rehacerlo");

    /* Y se rehace a mano, sin creerle al servidor. */
    const aMano = fair.sortear({
      semillaServidor: datos.data.semillaServidor,
      semillaCliente: datos.data.semillaCliente,
      nonce: datos.data.nonce,
      premios: datos.data.premios,
    });
    assert.equal(aMano.premio.name, datos.data.premio.name);
    assert.equal(fair.hashDeSemilla(datos.data.semillaServidor), datos.data.semillaServidorHash);
  }
});

test("editar la caja NO rompe la verificacion de lo que ya se abrio", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  /*
    Esto es lo que hace honesta a la verificacion. Si usara la caja de
    HOY, cambiarle una chance manana haria que los sorteos viejos no
    cerraran, y no habria forma de distinguir un cambio inocente de una
    estafa.
  */
  const j = await jugador({ saldo: 100 });
  const abierta = await pedir("POST", "/boxes/prueba/open", { token: j.token });
  const id = abierta.datos.data.resultados[0].boxOpenId;

  await pedir("POST", "/inventory/fair/rotate", { token: j.token });

  /* Se cambia la caja DESPUES de la apertura. */
  const caja = await Box.findOne({ slug: "prueba" });
  await Box.updateOne(
    { _id: caja._id },
    { $set: { "prizes.0.chance": 0.5, "prizes.1.chance": 0.5 } }
  );

  const { datos } = await pedir("GET", `/inventory/fair/verify/${id}`, { token: j.token });
  assert.equal(datos.data.coincide, true, "la apertura vieja dejo de verificar");

  /* Y la copia guardada tiene las chances VIEJAS, no las nuevas. */
  assert.equal(datos.data.premios.find((p) => p.name === "Lo caro").chance, 0.1);

  /* Se deja la caja como estaba, para las pruebas que vengan. */
  await Box.updateOne(
    { _id: caja._id },
    { $set: { "prizes.0.chance": 0.1, "prizes.1.chance": 0.9 } }
  );
});

/* ── Lo jugado y la comision ──────────────────────────────────────── */

test("abrir suma a lo jugado y le anota la comision al socio", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const socio = await User.create({
    username: "sociocaja", email: "sociocaja@test.local", passwordHash: "x",
  });
  await AffiliateCode.create({ code: "CAJA30", owner: socio._id });

  const j = await jugador({ saldo: 1000, codigo: "CAJA30" });
  await pedir("POST", "/boxes/prueba/open", { token: j.token, cuerpo: { veces: 4 } });

  const u = await User.findById(j.id).lean();
  assert.equal(u.jugadoSc, PRECIO * 4, "lo jugado no subio");

  const codigo = await AffiliateCode.findOne({ code: "CAJA30" }).lean();
  assert.equal(codigo.jugadoPorLosSuyosSc, PRECIO * 4);

  /*
    Lo ganado depende de lo que haya salido: cada apertura que dejo
    margen positivo le da el 30% de ese margen, y las que salieron caras
    le dan cero. Asi que tiene que estar entre 0 y el maximo posible.
  */
  const maximo = sc(PRECIO * 4 * 0.3);
  assert.ok(codigo.ganadoSc >= 0 && codigo.ganadoSc <= maximo,
    `la comision dio ${codigo.ganadoSc}, fuera de [0, ${maximo}]`);
});

/* ── El catalogo ──────────────────────────────────────────────────── */

test("el catalogo se ve sin cuenta y no manda los premios enteros", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const { estado, datos } = await pedir("GET", "/boxes");
  assert.equal(estado, 200);

  const caja = datos.data.items.find((c) => c.slug === "prueba");
  assert.ok(caja, "no aparecio la caja");
  assert.equal(caja.prizes, undefined, "la grilla no tiene que arrastrar todos los premios");
  assert.equal(caja.cuantosObjetos, 2);
  assert.equal(caja.mejorPremio.name, "Lo caro", "la tarjeta muestra el mejor premio");

  /* La apagada no se ve. */
  assert.ok(!datos.data.items.some((c) => c.slug === "apagada"));
});

test("una caja sola trae los premios con sus chances a la vista", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const { datos } = await pedir("GET", "/boxes/prueba");
  assert.equal(datos.data.prizes.length, 2);
  assert.equal(datos.data.prizes.find((p) => p.name === "Lo caro").chance, 0.1);
  assert.equal(datos.data.maximoALaVez, 4);
  assert.ok(datos.data.retornoMostrado > 0, "el retorno se muestra");
});

test("el feed enmascara los nombres", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 100 });
  await pedir("POST", "/boxes/prueba/open", { token: j.token });

  const { datos } = await pedir("GET", "/boxes/feed/latest?limit=5");
  assert.ok(datos.data.length > 0);
  for (const fila of datos.data) {
    assert.ok(/\*\*\*\*/.test(fila.username) || fila.username.length <= 3,
      `nombre sin tapar: ${fila.username}`);
    assert.ok(fila.premio.name);
  }
});
