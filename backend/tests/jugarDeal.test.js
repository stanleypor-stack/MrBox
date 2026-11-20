/**
 * DEALS, DE PUNTA A PUNTA.
 *
 * Contra el servidor y la base de verdad. Las cuentas ya las prueba
 * `deals.test.js`; acá se prueba que el tiro cobre lo que dice, entregue
 * lo que promete y no se pueda jugar lo que no se puede jugar.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DATABASE_URI = process.env.TEST_DB_URI || "mongodb://127.0.0.1:27017/mrbox_test_deals";
process.env.JWT_SECRET = "prueba-local";
process.env.TURNSTILE_SECRET_KEY = "";
process.env.AUTH_RATE_LIMIT = "500";
process.env.OPEN_RATE_LIMIT = "5000";
process.env.LOG_LEVEL = "error";

const mongoose = require("mongoose");
const { app } = require("../index");
const { conectar, asegurarIndices } = require("../database");

const User = require("../database/models/User");
const Item = require("../database/models/Item");
const Deal = require("../database/models/Deal");
const InventoryItem = require("../database/models/InventoryItem");

const deals = require("../services/deals");
const { sc } = require("../utils/money");

let servidor;
let base = "";
let hayBase = true;
let caro;
let barato;
let impagable;

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

    caro = await Item.create({ sku: "D-CARO", name: "Lo caro", valueSc: 100, rarity: "gold" });
    barato = await Item.create({ sku: "D-BARATO", name: "Lo barato", valueSc: 7.81, rarity: "blue" });
    /* Por debajo del valor minimo: el mani del catalogo. */
    impagable = await Item.create({ sku: "D-MANI", name: "Mani", valueSc: 0.01, rarity: "blue" });
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
  const cuenta = { username: `dj${n}`, email: `dj${n}@test.local`, password: "unaclavelarga" };
  const { datos } = await pedir("POST", "/auth/register", { cuerpo: cuenta });
  await User.updateOne({ _id: datos.user._id }, { $set: { balanceSc: saldo } });
  return { id: datos.user._id, token: datos.token };
}

/* ── Lo basico ────────────────────────────────────────────────────── */

test("un tiro cobra la apuesta y deja rastro en el libro", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 1000 });

  const { estado, datos } = await pedir("POST", "/deals/play", {
    token: j.token,
    cuerpo: { itemId: caro._id, chance: 0.1 },
  });
  assert.equal(estado, 200, JSON.stringify(datos));

  const r = datos.data;
  /* 100 × 0,10 ÷ 0,92 = 10,8695…, para arriba 10,87 */
  assert.equal(r.apuestaSc, 10.87);
  assert.equal(r.tiros.length, 1);
  assert.equal(r.balanceSc, sc(1000 - 10.87 + (r.tiros[0].gano ? 0 : 0)));

  const recibo = await Deal.findById(r.tiros[0].dealId).lean();
  assert.ok(recibo, "tiene que quedar el recibo");
  assert.equal(recibo.stakeSc, 10.87);
  assert.equal(recibo.chance, 0.1);
  /* La prueba del sorteo viaja entera. */
  assert.ok(recibo.hmac.length >= 13);
  assert.ok(recibo.semillaServidorHash);
});

test("ganar deja el objeto en el inventario, perder no deja nada", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 100000 });

  /* Al 80% alcanzan unos pocos tiros para ver los dos casos. */
  let gano = 0;
  let perdio = 0;
  for (let i = 0; i < 12 && (!gano || !perdio); i += 1) {
    const { datos } = await pedir("POST", "/deals/play", {
      token: j.token,
      cuerpo: { itemId: caro._id, chance: 0.8 },
    });
    for (const tiro of datos.data.tiros) {
      if (tiro.gano) { gano += 1; assert.ok(tiro.premio, "el que gana trae premio"); }
      else { perdio += 1; assert.equal(tiro.premio, null); }
    }
  }

  const guardados = await InventoryItem.countDocuments({ user: j.id, state: "held" });
  assert.equal(guardados, gano, "un objeto por cada tiro ganado, ni uno mas");

  const recibos = await Deal.find({ user: j.id }).lean();
  assert.equal(recibos.filter((r) => r.gano).length, gano);
  assert.equal(recibos.filter((r) => !r.gano).length, perdio);
});

test("sin saldo no se juega, y el saldo no se mueve", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 1 });

  const { estado, datos } = await pedir("POST", "/deals/play", {
    token: j.token,
    cuerpo: { itemId: caro._id, chance: 0.5 },
  });
  assert.equal(estado, 400);
  assert.equal(datos.code, "NOT_ENOUGH_COINS");

  /* `balanceSc` esta oculto por defecto en el modelo: se pide a mano. */
  const despues = await User.findById(j.id).select("+balanceSc").lean();
  assert.equal(sc(despues.balanceSc), 1);
  assert.equal(await Deal.countDocuments({ user: j.id }), 0);
});

/* ── Los limites ──────────────────────────────────────────────────── */

test("la chance de la pantalla no manda: el servidor la revisa", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 100000 });

  /* Por arriba del techo. */
  const alta = await pedir("POST", "/deals/play", {
    token: j.token, cuerpo: { itemId: caro._id, chance: 0.99 },
  });
  assert.equal(alta.estado, 400);
  assert.equal(alta.datos.code, "ABOVE_MAXIMUM");

  /* Por debajo del piso de ESTE objeto: al 1% el tiro costaria nueve
     centavos y el redondeo al centavo se comeria el retorno. */
  const baja = await pedir("POST", "/deals/play", {
    token: j.token, cuerpo: { itemId: barato._id, chance: 0.01 },
  });
  assert.equal(baja.estado, 400);
  assert.equal(baja.datos.code, "BELOW_MINIMUM");

  /* Y una chance negativa tampoco es una chance. */
  const mala = await pedir("POST", "/deals/play", {
    token: j.token, cuerpo: { itemId: caro._id, chance: -0.5 },
  });
  assert.equal(mala.estado, 400);

  assert.equal(await Deal.countDocuments({ user: j.id }), 0);
});

test("un objeto demasiado barato no se puede jugar ni aparece en el catalogo", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 100 });

  const { estado } = await pedir("POST", "/deals/play", {
    token: j.token, cuerpo: { itemId: impagable._id, chance: 0.8 },
  });
  assert.equal(estado, 404);

  const lista = await pedir("GET", "/deals/items?perPage=60");
  const nombres = lista.datos.data.items.map((i) => i.name);
  assert.ok(!nombres.includes("Mani"), "el mani no se ofrece");
  assert.ok(nombres.includes("Lo caro"));
});

test("el piso de la chance viaja en la cotizacion", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  const { datos } = await pedir("GET", `/deals/quote?itemId=${barato._id}&chance=0.01`);
  assert.equal(datos.data.chanceMin, deals.chanceMinimaDe(7.81));
  assert.equal(datos.data.chance, datos.data.chanceMin, "la cotizacion sube la chance al piso");
  assert.ok(datos.data.apuestaSc >= deals.APUESTA_MINIMA);
});

/* ── La prueba de prueba ──────────────────────────────────────────── */

test("el tiro de demostracion no cobra, no paga y no queda", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const antes = await Deal.countDocuments({});
  const objetos = await InventoryItem.countDocuments({});

  const { estado, datos } = await pedir("POST", "/deals/demo", {
    cuerpo: { itemId: caro._id, chance: 0.5, veces: 3 },
  });
  assert.equal(estado, 200, JSON.stringify(datos));
  assert.equal(datos.data.demo, true);
  assert.equal(datos.data.apuestaSc, 0);
  assert.equal(datos.data.tiros.length, 3);

  assert.equal(await Deal.countDocuments({}), antes, "no deja recibo");
  assert.equal(await InventoryItem.countDocuments({}), objetos, "no deja objeto");
});

test("no se pueden pedir mas tiros de los permitidos", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 100000 });

  const { estado, datos } = await pedir("POST", "/deals/play", {
    token: j.token, cuerpo: { itemId: caro._id, chance: 0.1, veces: 99 },
  });
  assert.equal(estado, 400);
  assert.equal(datos.code, "TOO_MANY_AT_ONCE");
});

test("cada tiro usa su propio nonce", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 100000 });

  const { datos } = await pedir("POST", "/deals/play", {
    token: j.token, cuerpo: { itemId: caro._id, chance: 0.1, veces: 4 },
  });
  const nonces = datos.data.tiros.map((t2) => t2.nonce);
  assert.equal(new Set(nonces).size, 4, "cuatro tiros, cuatro numeros distintos");

  /* Y dos tiros con el mismo nonce darian el mismo hmac: que no se
     repitan es justo lo que hace que la prueba sirva. */
  const hmacs = datos.data.tiros.map((t2) => t2.hmac);
  assert.equal(new Set(hmacs).size, 4);
});

test("lo jugado suma al contador que usan el VIP y las carreras", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 100000 });

  await pedir("POST", "/deals/play", {
    token: j.token, cuerpo: { itemId: caro._id, chance: 0.25, veces: 2 },
  });

  const u = await User.findById(j.id).lean();
  /* 100 × 0,25 ÷ 0,92 = 27,1739…, para arriba 27,18, por dos. */
  assert.equal(sc(u.jugadoSc), sc(27.18 * 2));
});

test("el historial del jugador trae el neto de cada tiro", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 100000 });

  await pedir("POST", "/deals/play", {
    token: j.token, cuerpo: { itemId: caro._id, chance: 0.5, veces: 4 },
  });

  const { datos } = await pedir("GET", "/deals/mine", { token: j.token });
  assert.equal(datos.data.items.length, 4);
  for (const fila of datos.data.items) {
    const esperado = sc((fila.gano ? fila.valueSc : 0) - fila.stakeSc);
    assert.equal(fila.diferenciaSc, esperado);
  }
});
