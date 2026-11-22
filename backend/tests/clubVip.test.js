/**
 * LOS BENEFICIOS DEL CLUB VIP, DE PUNTA A PUNTA.
 *
 * La regla de negocio que prueba este archivo es una sola, y es la que
 * se pidió explícitamente:
 *
 *   los beneficios se GANAN jugando con plata propia.
 *
 * O sea que NO los gana el que jugó lo que le regaló la casa, ni el
 * que tiene el rango puesto a mano desde el panel. Eso último importa
 * especialmente: el rango a mano existe para que un jugador trasladado
 * de otro sitio vea su insignia de siempre, y es justo el camino por
 * el que alguien podría regalarse cajas sin querer.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DATABASE_URI = process.env.TEST_DB_URI || "mongodb://127.0.0.1:27017/mrbox_test_club";
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
const Box = require("../database/models/Box");
const Settings = require("../database/models/Settings");

const wallet = require("../services/wallet");
const vip = require("../services/vip");

let servidor;
let base = "";
let hayBase = true;

/* Lo que hay que jugar para cada uno, de la tabla de fábrica. */
const SILVER = 25000;
const GOLD = 50000;

test.before(async () => {
  try {
    await conectar();
    await mongoose.connection.db.dropDatabase();
    await asegurarIndices();
    servidor = app.listen(0);
    await new Promise((r) => servidor.once("listening", r));
    base = `http://127.0.0.1:${servidor.address().port}/api`;

    const cosa = await Item.create({ sku: "C-1", name: "Una cosa", valueSc: 5, rarity: "blue" });
    await Box.create({
      slug: "club", name: "La del club", category: "Mix", priceSc: 5, live: true,
      prizes: [{ item: cosa._id, name: cosa.name, valueSc: 5, rarity: "blue", chance: 1 }],
    });

    /*
      Que los tres beneficios den esa caja, que es la única que hay.
      `Settings.leer()` devuelve un objeto plano --tiene `.lean()`--
      así que esto se escribe con un update y no con `save`.
    */
    await Settings.updateOne(
      { key: "main" },
      {
        $set: {
          cajasDeRegalo: ["club"],
          cajasDelClub: { alSubir: "club", semanal: "club", mensual: "club" },
        },
      },
      { upsert: true },
    );
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
async function jugador(extra = {}) {
  n += 1;
  const cuenta = { username: `cv${n}`, email: `cv${n}@test.local`, password: "unaclavelarga" };
  const { datos } = await pedir("POST", "/auth/register", { cuerpo: cuenta });
  if (Object.keys(extra).length) {
    await User.updateOne({ _id: datos.user._id }, { $set: extra });
  }
  return { id: datos.user._id, token: datos.token };
}

/** Compra: es lo único que hace que lo jugado cuente para el club. */
async function comprar(id, cuanto) {
  await wallet.mover({
    userId: id, amountSc: cuanto, type: "purchase",
    reference: { kind: "oxapay", label: "prueba" },
  });
}

/** Jugar pagando del saldo. */
async function jugarPagando(id, cuanto) {
  await wallet.mover({
    userId: id, amountSc: -cuanto, type: "box_open", juegaSc: cuanto,
    reference: { kind: "box", label: "prueba" },
  });
}

/** Jugar una apertura de regalo: cuenta como jugada, la paga la casa. */
async function jugarDeRegalo(id, cuanto) {
  await wallet.mover({
    userId: id, amountSc: 0, type: "box_open", juegaSc: cuanto,
    reference: { kind: "freeOpen", label: "prueba" },
  });
}

/* ── Lo que separa una cosa de la otra ────────────────────────────── */

test("lo jugado de regalo NO cuenta para el club", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador();
  await jugarDeRegalo(j.id, GOLD + 1000);

  const u = await User.findById(j.id).select("jugadoSc jugadoPagoSc").lean();
  assert.equal(u.jugadoSc, GOLD + 1000, "tiene que contar para carreras y margen");
  assert.equal(u.jugadoPagoSc, 0, "pero no como plata propia");

  const { datos } = await pedir("GET", "/vip/beneficios", { token: j.token });
  assert.equal(datos.data.rangoGanado.nombre, "Bronze");
  assert.equal(datos.data.compro, false);
});

test("sin haber comprado nunca, jugar no da beneficios", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  /*
    Puede pasar: saldo de un código promocional o de un premio. Es
    plata que entro sin que el jugador pusiera nada.
  */
  const j = await jugador();
  await User.updateOne({ _id: j.id }, { $set: { balanceSc: GOLD + 1000 } });
  await jugarPagando(j.id, GOLD);

  const { datos } = await pedir("GET", "/vip/beneficios", { token: j.token });
  assert.equal(datos.data.rangoGanado.nombre, "Bronze");

  const cobro = await pedir("POST", "/vip/beneficios/levelUpBox", { token: j.token });
  assert.equal(cobro.datos.code, "RANK_TOO_LOW");
});

test("COMPRANDO Y JUGANDO LO SUYO, SI", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador();
  await comprar(j.id, GOLD + 1000);
  await jugarPagando(j.id, GOLD);

  const { datos } = await pedir("GET", "/vip/beneficios", { token: j.token });
  assert.equal(datos.data.rangoGanado.nombre, "Gold");
  assert.equal(datos.data.compro, true);
  assert.equal(datos.data.jugadoPagoSc, GOLD);

  const antes = await User.findById(j.id).select("freeOpens").lean();
  const cobro = await pedir("POST", "/vip/beneficios/levelUpBox", { token: j.token });
  assert.equal(cobro.estado, 200, JSON.stringify(cobro.datos));
  assert.equal(cobro.datos.data.caja.slug, "club");

  const despues = await User.findById(j.id).select("freeOpens cajasGratis").lean();
  assert.equal(despues.freeOpens, antes.freeOpens + 1, "no le entro la caja");
  assert.ok(despues.cajasGratis.some((c) => c.slug === "club" && !c.usadaEl));
});

test("la misma caja no se cobra dos veces", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador();
  await comprar(j.id, GOLD + 1000);
  await jugarPagando(j.id, GOLD);

  const una = await pedir("POST", "/vip/beneficios/monthlyBox", { token: j.token });
  assert.equal(una.estado, 200);

  const otra = await pedir("POST", "/vip/beneficios/monthlyBox", { token: j.token });
  assert.equal(otra.datos.code, "ALREADY_CLAIMED");
});

test("dos clicks al mismo tiempo entregan UNA sola caja", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  /* El índice único es la regla; un `if` en el código pierde acá. */
  const j = await jugador();
  await comprar(j.id, GOLD + 1000);
  await jugarPagando(j.id, GOLD);

  const antes = await User.findById(j.id).select("freeOpens").lean();
  const juntos = await Promise.all([
    pedir("POST", "/vip/beneficios/levelUpBox", { token: j.token }),
    pedir("POST", "/vip/beneficios/levelUpBox", { token: j.token }),
    pedir("POST", "/vip/beneficios/levelUpBox", { token: j.token }),
  ]);
  const entraron = juntos.filter((r) => r.estado === 200).length;
  assert.equal(entraron, 1, "entraron " + entraron);

  const despues = await User.findById(j.id).select("freeOpens").lean();
  assert.equal(despues.freeOpens, antes.freeOpens + 1);
});

test("un rango que pide mas, no se cobra", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador();
  await comprar(j.id, GOLD + 1000);
  await jugarPagando(j.id, GOLD);

  /* La semanal es desde Sapphire, y este es Gold. */
  const r = await pedir("POST", "/vip/beneficios/weeklyBox", { token: j.token });
  assert.equal(r.datos.code, "RANK_TOO_LOW");
});

/* ── El rango puesto a mano ───────────────────────────────────────── */

test("EL RANGO PUESTO A MANO NO DA NI CAJAS NI RAKEBACK", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ rangoManual: "Opal", jugadoBaseSc: 1500000 });

  const { datos } = await pedir("GET", "/vip/beneficios", { token: j.token });
  assert.equal(datos.data.rango.nombre, "Opal", "la insignia si se ve");
  assert.equal(datos.data.rangoGanado.nombre, "Bronze", "pero no se gano nada");

  const caja = await pedir("POST", "/vip/beneficios/levelUpBox", { token: j.token });
  assert.equal(caja.datos.code, "RANK_TOO_LOW");

  const rake = await pedir("POST", "/vip/rakeback/daily", { token: j.token });
  assert.equal(rake.datos.code, "RANK_TOO_LOW");
});

test("el piso puesto a mano tampoco alcanza para el rakeback", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ jugadoBaseSc: SILVER + 1000 });
  const rake = await pedir("POST", "/vip/rakeback/daily", { token: j.token });
  assert.equal(rake.datos.code, "RANK_TOO_LOW");
});

/* ── Y lo que SI tiene que seguir pagando ─────────────────────────── */

test("el que compro y jugo lo suyo cobra el rakeback", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador();
  await comprar(j.id, GOLD + 1000);
  await jugarPagando(j.id, GOLD);

  const antes = await User.findById(j.id).select("+balanceSc").lean();
  const r = await pedir("POST", "/vip/rakeback/daily", { token: j.token });
  assert.equal(r.estado, 200, JSON.stringify(r.datos));

  /* Gold devuelve 0,04% del dia: SC 20 sobre SC 50.000. */
  const esperado = GOLD * vip.RANGOS[2].rakeback.daily;
  assert.equal(r.datos.data.montoSc, esperado);

  const despues = await User.findById(j.id).select("+balanceSc").lean();
  assert.equal(despues.balanceSc, antes.balanceSc + esperado);
});

test("la tarjeta no promete menos de lo que el servidor paga", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  /*
    Estaban separados: los porcentajes de `RANGOS` pagan rakeback
    desde Silver y la tarjeta lo mostraba con candado hasta Ruby.
    Esto los ata.
  */
  const tabla = vip.tabla();
  for (const fila of tabla) {
    const pagaAlgo = Object.values(vip.RANGOS[fila.numero - 1].rakeback).some((x) => x > 0);
    const loMuestra = fila.beneficios.find((b) => b.clave === "rakeback").tiene;
    assert.equal(
      loMuestra, pagaAlgo,
      `${fila.nombre}: la tarjeta dice ${loMuestra} y el servidor paga ${pagaAlgo}`
    );
  }
});
