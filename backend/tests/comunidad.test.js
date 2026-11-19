/**
 * LAS CAJAS QUE ARMAN LOS JUGADORES.
 *
 * Lo que se prueba acá no es "se puede crear una caja": es que NO se
 * pueda armar una que le saque plata a la casa.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DATABASE_URI = process.env.TEST_DB_URI || "mongodb://127.0.0.1:27017/mrbox_test_comunidad";
process.env.JWT_SECRET = "prueba-local";
process.env.TURNSTILE_SECRET_KEY = "";
process.env.AUTH_RATE_LIMIT = "500";
process.env.OPEN_RATE_LIMIT = "5000";
process.env.LOG_LEVEL = "error";

const mongoose = require("mongoose");
const { app } = require("../index");
const { conectar } = require("../database");

const User = require("../database/models/User");
const Item = require("../database/models/Item");
const Box = require("../database/models/Box");
const BalanceTransaction = require("../database/models/BalanceTransaction");

const comunidad = require("../services/community");
const eco = require("../services/boxes/economia");
const { sc } = require("../utils/money");

let servidor;
let base = "";
let hayBase = true;
let objetos = [];

test.before(async () => {
  try {
    await conectar();
    await mongoose.connection.db.dropDatabase();
    servidor = app.listen(0);
    await new Promise((r) => servidor.once("listening", r));
    base = `http://127.0.0.1:${servidor.address().port}/api`;

    /* Seis objetos, de SC 1 a SC 1.000. */
    const valores = [1, 5, 20, 100, 400, 1000];
    objetos = await Promise.all(
      valores.map((v, i) => Item.create({ sku: `C-${i}`, name: `Objeto ${v}`, valueSc: v }))
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
async function jugador({ saldo = 10000 } = {}) {
  n += 1;
  const cuenta = { username: `cm${n}`, email: `cm${n}@test.local`, password: "unaclavelarga" };
  const { datos } = await pedir("POST", "/auth/register", { cuerpo: cuenta });
  await User.updateOne({ _id: datos.user._id }, { $set: { balanceSc: saldo } });
  return { id: datos.user._id, token: datos.token, username: cuenta.username };
}

/** Cinco objetos con peso 1: lo mínimo que se puede publicar. */
function premiosBase() {
  return objetos.slice(0, 5).map((o) => ({ itemId: String(o._id), peso: 1 }));
}

/* ── Las cuentas ──────────────────────────────────────────────────── */

test("las chances salen de los pesos y suman exactamente uno", () => {
  const chances = comunidad.chancesDesdePesos([1, 1, 1]);
  assert.equal(chances.length, 3);
  /* Un tercio no entra en seis decimales: el reparto del resto lo
     arregla en `cerrarEnUno`. */
  const premios = comunidad.cerrarEnUno(
    chances.map((c, i) => ({ chance: c, valueSc: [100, 50, 1][i] }))
  );
  const suma = premios.reduce((a, p) => a + p.chance, 0);
  assert.equal(Math.round(suma * 1e6) / 1e6, 1);
});

test("el sobrante del redondeo va al premio mas barato", () => {
  const premios = comunidad.cerrarEnUno([
    { chance: 0.333333, valueSc: 1000 },
    { chance: 0.333333, valueSc: 500 },
    { chance: 0.333333, valueSc: 2 },
  ]);
  /* El barato es el de SC 2 y es el que se lleva el 0,000001: darselo
     al caro movería el precio de la caja mucho mas. */
  assert.equal(premios[0].chance, 0.333333);
  assert.equal(premios[1].chance, 0.333333);
  assert.equal(premios[2].chance, 0.333334);
});

test("un peso de cero o negativo no es un peso", () => {
  assert.throws(() => comunidad.chancesDesdePesos([1, 0]));
  assert.throws(() => comunidad.chancesDesdePesos([1, -5]));
  assert.throws(() => comunidad.chancesDesdePesos([1, "ocho"]));
});

/* ── De punta a punta ─────────────────────────────────────────────── */

test("publicar una caja le pone el precio que sale de adentro", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador();

  const { estado, datos } = await pedir("POST", "/community", {
    token: j.token,
    cuerpo: { name: "Mi caja", premios: premiosBase(), portada: { color: "#7be22b", estilo: 1 } },
  });
  assert.equal(estado, 200, JSON.stringify(datos));

  const caja = await Box.findById(datos.data._id).lean();
  const esperado = eco.precioDe(caja.prizes);
  assert.equal(sc(caja.priceSc), esperado);

  /* Y el retorno es el mismo 92% de siempre. */
  assert.ok(Math.abs(eco.retornoReal(caja.prizes, caja.priceSc) - 0.92) < 0.01);

  /* Nace apagada y sin revisar: nadie publica solo. */
  assert.equal(caja.live, false);
  assert.equal(caja.approvalState, "none");
  assert.equal(caja.category, "Community");
});

test("el valor de los objetos sale del catalogo, no del pedido", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador();

  /* Dice que el de SC 1.000 vale SC 2: si le creyera, saldria una caja
     de dos pesos con mil adentro. */
  const premios = premiosBase();
  premios[0] = { itemId: String(objetos[5]._id), peso: 1, valueSc: 2, name: "Chirola" };

  const { datos } = await pedir("POST", "/community", {
    token: j.token, cuerpo: { name: "Trampa", premios },
  });

  const caja = await Box.findById(datos.data._id).lean();
  const mil = caja.prizes.find((p) => String(p.item) === String(objetos[5]._id));
  assert.equal(mil.valueSc, 1000, "el valor lo dice el catalogo");
  assert.equal(mil.name, "Objeto 1000");
  assert.ok(caja.priceSc > 40, `la caja no puede costar ${caja.priceSc}`);
});

test("menos de cinco objetos no se publica", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador();

  const { estado, datos } = await pedir("POST", "/community", {
    token: j.token, cuerpo: { name: "Corta", premios: premiosBase().slice(0, 3) },
  });
  assert.equal(estado, 400);
  assert.equal(datos.code, "TOO_FEW_ITEMS");
});

test("el mismo objeto dos veces tampoco", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador();

  const premios = premiosBase();
  premios[1] = { ...premios[0] };

  const { estado, datos } = await pedir("POST", "/community", {
    token: j.token, cuerpo: { name: "Repetida", premios },
  });
  assert.equal(estado, 400);
  assert.equal(datos.code, "DUPLICATE_ITEM");
});

test("editarla la baja del aire y la manda a revisar de nuevo", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador();

  const creada = await pedir("POST", "/community", {
    token: j.token, cuerpo: { name: "Editable", premios: premiosBase() },
  });
  const id = creada.datos.data._id;

  /* La aprueban a mano, como haria el panel. */
  await Box.updateOne({ _id: id }, { $set: { live: true, approvalState: "approved" } });

  await pedir("PUT", `/community/${id}`, {
    token: j.token,
    cuerpo: { name: "Editable", premios: objetos.slice(0, 6).map((o) => ({ itemId: String(o._id), peso: 2 })) },
  });

  const despues = await Box.findById(id).lean();
  assert.equal(despues.live, false, "una caja editada no puede seguir al aire");
  assert.equal(despues.approvalState, "none");
  assert.equal(despues.prizes.length, 6);
});

test("nadie puede editar la caja de otro", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const duenio = await jugador();
  const ajeno = await jugador();

  const creada = await pedir("POST", "/community", {
    token: duenio.token, cuerpo: { name: "Mia", premios: premiosBase() },
  });

  const { estado } = await pedir("PUT", `/community/${creada.datos.data._id}`, {
    token: ajeno.token, cuerpo: { name: "Robada", premios: premiosBase() },
  });
  assert.equal(estado, 404);
});

/* ── La plata ─────────────────────────────────────────────────────── */

test("el creador cobra la mitad del margen de cada apertura", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const autor = await jugador({ saldo: 0 });
  const abre = await jugador({ saldo: 100000 });

  const creada = await pedir("POST", "/community", {
    token: autor.token, cuerpo: { name: "Con plata", premios: premiosBase() },
  });
  const caja = await Box.findById(creada.datos.data._id).lean();
  await Box.updateOne({ _id: caja._id }, { $set: { live: true, approvalState: "approved" } });

  for (let i = 0; i < 20; i += 1) {
    await pedir("POST", `/boxes/${caja.slug}/open`, { token: abre.token });
  }

  const pagos = await BalanceTransaction.find({ user: autor.id, type: "creator_share" }).lean();
  assert.ok(pagos.length > 0, "tiene que haber cobrado algo");

  /* Cada pago es exactamente la mitad del margen de esa apertura, y
     nunca negativo. */
  for (const pago of pagos) {
    assert.ok(pago.amountSc > 0, `pago negativo: ${pago.amountSc}`);
    assert.ok(pago.amountSc <= caja.priceSc / 2 + 0.01, "no puede cobrar mas de medio precio");
  }

  const u = await User.findById(autor.id).select("+balanceSc").lean();
  assert.equal(sc(u.balanceSc), sc(pagos.reduce((a, p) => a + p.amountSc, 0)));
});

test("el creador NO cobra por abrir su propia caja", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const autor = await jugador({ saldo: 100000 });

  const creada = await pedir("POST", "/community", {
    token: autor.token, cuerpo: { name: "La propia", premios: premiosBase() },
  });
  const caja = await Box.findById(creada.datos.data._id).lean();
  await Box.updateOne({ _id: caja._id }, { $set: { live: true, approvalState: "approved" } });

  for (let i = 0; i < 10; i += 1) {
    await pedir("POST", `/boxes/${caja.slug}/open`, { token: autor.token });
  }

  const pagos = await BalanceTransaction.countDocuments({ user: autor.id, type: "creator_share" });
  assert.equal(pagos, 0, "abrir la propia caja devolveria el 96% en vez del 92%");
});

test("el panel cuenta lo que de verdad cobro", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const autor = await jugador({ saldo: 0 });
  const abre = await jugador({ saldo: 100000 });

  const creada = await pedir("POST", "/community", {
    token: autor.token, cuerpo: { name: "Del panel", premios: premiosBase() },
  });
  const caja = await Box.findById(creada.datos.data._id).lean();
  await Box.updateOne({ _id: caja._id }, { $set: { live: true, approvalState: "approved" } });

  for (let i = 0; i < 8; i += 1) {
    await pedir("POST", `/boxes/${caja.slug}/open`, { token: abre.token });
  }

  const panel = await pedir("GET", "/community/mine", { token: autor.token });
  const mia = panel.datos.data.cajas.find((c) => String(c._id) === String(caja._id));
  assert.equal(mia.opens, 8);
  assert.equal(mia.estado, "live");

  const pagos = await pedir("GET", "/community/payments", { token: autor.token });
  assert.equal(sc(pagos.datos.data.totalSc), sc(mia.ganadoSc));

  /* Y el grafico trae los treinta dias completos, con o sin plata. */
  const gan = await pedir("GET", "/community/earnings", { token: autor.token });
  assert.equal(gan.datos.data.serie.length, 30);
  assert.equal(sc(gan.datos.data.ganadoSc), sc(mia.ganadoSc));
});

test("la cotizacion no guarda nada", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const antes = await Box.countDocuments({});

  const { estado, datos } = await pedir("POST", "/community/quote", {
    cuerpo: { premios: premiosBase() },
  });
  assert.equal(estado, 200);
  assert.ok(datos.data.priceSc > 0);
  assert.equal(datos.data.premios.length, 5);

  assert.equal(await Box.countDocuments({}), antes);
});

/* ── El estampado del carton ──────────────────────────────────────── */

test("el estampado se guarda, y uno inventado cae en liso", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  /*
    El color es libre --cualquiera da una caja que se entiende-- pero el
    estampado lo dibuja el componente. Uno que no exista dejaria la caja
    sin textura y sin decir por que, asi que se cae en "liso".
  */
  const j = await jugador();

  const buena = await pedir("POST", "/community", {
    token: j.token,
    cuerpo: {
      name: "Con panal",
      premios: premiosBase(),
      portada: { color: "#16c79a", textura: "panal", estilo: 1 },
    },
  });
  assert.equal(buena.estado, 200, JSON.stringify(buena.datos));
  const conPanal = await Box.findById(buena.datos.data._id).lean();
  assert.equal(conPanal.portada.textura, "panal");
  assert.equal(conPanal.portada.color, "#16c79a");

  const rara = await pedir("POST", "/community", {
    token: j.token,
    cuerpo: {
      name: "Con cualquiera",
      premios: premiosBase(),
      portada: { color: "#16c79a", textura: "<script>", estilo: 1 },
    },
  });
  assert.equal(rara.estado, 200, JSON.stringify(rara.datos));
  const otra = await Box.findById(rara.datos.data._id).lean();
  assert.equal(otra.portada.textura, "liso");
});

/* ── El margen negativo se arrastra ───────────────────────────────── */

test("el creador no cobra hasta que la caja vuelve a estar en verde", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  /*
    EL AGUJERO QUE ESTO TAPA.

    Se pagaba la mitad del margen de CADA apertura con el negativo
    pisado en cero: la apertura que ganaba el jugador la perdia la casa
    sola. Con un premio gordo adentro, una caja de 92% de retorno le
    sacaba plata a la casa.
  */
  const j = await jugador();
  const caja = await Box.create({
    slug: "arrastre", name: "Arrastre", category: "Community", live: true,
    creator: j.id, priceSc: 10,
    prizes: [{ item: objetos[0]._id, name: "x", valueSc: 1, chance: 1, rarity: "blue" }],
  });

  const pagado = async () => {
    const c = await Box.findById(caja._id).select("ganadoPorElCreadorSc margenPendienteSc").lean();
    return { ganado: sc(c.ganadoPorElCreadorSc), pendiente: sc(c.margenPendienteSc) };
  };

  /* Una apertura en rojo: no paga, y queda anotada la deuda. */
  await comunidad.pagarAlCreador({ caja, margenSc: -100 });
  assert.deepEqual(await pagado(), { ganado: 0, pendiente: -100 });

  /* Cuarenta de margen bueno: sigue en rojo, sigue sin pagar. */
  await comunidad.pagarAlCreador({ caja, margenSc: 40 });
  assert.deepEqual(await pagado(), { ganado: 0, pendiente: -60 });

  /* Y recien cuando la caja vuelve al verde se reparte lo que sobra. */
  await comunidad.pagarAlCreador({ caja, margenSc: 100 });
  const fin = await pagado();
  assert.equal(fin.pendiente, 0, "el acumulado se consume entero");
  assert.equal(fin.ganado, 20, "la mitad de los 40 que quedaron en verde");

  /*
    La cuenta cierra: la casa gano 40 en total (-100 +40 +100) y el
    creador se llevo 20, la mitad. Antes se habria llevado 70.
  */
});
