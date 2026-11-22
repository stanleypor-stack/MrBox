/**
 * DICE, DE PUNTA A PUNTA.
 *
 * Lo que de verdad importa de un juego es una sola cosa: que pague lo
 * que dice que paga, ni más ni menos. Eso se prueba de dos maneras
 * acá, porque una sola no alcanza:
 *
 *   - la cuenta: multiplicador x chance tiene que dar el retorno
 *     publicado, para TODAS las apuestas posibles, no para una
 *   - la realidad: cien mil tiradas de verdad, con el sorteo real,
 *     tienen que devolver ese mismo número
 *
 * Y después, que no se pueda hacer trampa: jugar sin saldo, mandar una
 * jugada imposible para forzar un multiplicador enorme, o repetir el
 * mismo tiro.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DATABASE_URI = process.env.TEST_DB_URI || "mongodb://127.0.0.1:27017/mrbox_test_dice";
process.env.JWT_SECRET = "prueba-local";
process.env.TURNSTILE_SECRET_KEY = "";
process.env.AUTH_RATE_LIMIT = "500";
process.env.GAME_RATE_LIMIT = "100000";
process.env.LOG_LEVEL = "error";

const mongoose = require("mongoose");
const { app } = require("../index");
const { conectar, asegurarIndices } = require("../database");

const User = require("../database/models/User");
const GameRound = require("../database/models/GameRound");
const BalanceTransaction = require("../database/models/BalanceTransaction");
const UserSeed = require("../database/models/UserSeed");

const dice = require("../services/games/dice");
const fair = require("../services/games/fair");
const cfgJuegos = require("../services/games/config");

let servidor;
let base = "";
let hayBase = true;

const MARGEN = 6;

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
async function jugador({ saldo = 10000 } = {}) {
  n += 1;
  const cuenta = { username: `dd${n}`, email: `dd${n}@test.local`, password: "unaclavelarga" };
  const { datos } = await pedir("POST", "/auth/register", { cuerpo: cuenta });
  await User.updateOne({ _id: datos.user._id }, { $set: { balanceSc: saldo } });
  return { id: datos.user._id, token: datos.token };
}

/* ── La cuenta ────────────────────────────────────────────────────── */

test("EL RETORNO ES 94% PARA TODAS LAS APUESTAS POSIBLES", async () => {
  /*
    No una muestra: todas. `over` y `under` con cada objetivo, y
    `between`/`outside` con cada par. Si alguna combinación paga de
    mas, acá se ve.
  */
  let cuantas = 0;

  const comprobar = (modo, desde, hasta) => {
    const chance = dice.cuantosGanan(modo, desde, hasta);
    if (chance <= 0) return;
    const mult = dice.multiplicador(modo, desde, hasta, {});
    const retorno = (mult * chance) / 100;
    assert.ok(
      Math.abs(retorno - (100 - MARGEN) / 100) < 1e-12,
      `${modo} ${desde}-${hasta}: retorno ${retorno}`
    );
    cuantas += 1;
  };

  for (let d = dice.MINIMO; d <= dice.MAXIMO; d += 1) {
    comprobar("over", d, null);
    comprobar("under", d, null);
    for (let h = d + 1; h <= 99; h += 1) {
      comprobar("between", d, h);
      comprobar("outside", d, h);
    }
  }

  assert.ok(cuantas > 9000, "probe solo " + cuantas);
});

test("el margen de las perillas manda sobre el pago", async () => {
  /* Con margen 0 el juego es justo; con 20, paga lo que dice 20. */
  const justo = dice.multiplicador("over", 49, null, { juegos: { margenes: { dice: 0 } } });
  assert.equal(Math.round(justo * 100 * 50) / 100, 100);

  const duro = dice.multiplicador("over", 49, null, { juegos: { margenes: { dice: 20 } } });
  assert.equal(Math.round(duro * 50 * 100) / 100, 80);
});

test("una jugada imposible no se acepta", async () => {
  /* `between 50 51` no deja ningun numero adentro: chance 0 y
     multiplicador infinito. Es la forma mas corta de romper un dice. */
  assert.throws(() => dice.revisar({ modo: "between", desde: 50, hasta: 51 }));
  assert.throws(() => dice.revisar({ modo: "between", desde: 60, hasta: 40 }));
  assert.throws(() => dice.revisar({ modo: "over", desde: 99 }));
  assert.throws(() => dice.revisar({ modo: "under", desde: 0 }));
  assert.throws(() => dice.revisar({ modo: "loquesea", desde: 50 }));
});

/* ── La realidad ──────────────────────────────────────────────────── */

test("CIEN MIL TIRADAS DEVUELVEN EL 94%", async () => {
  /*
    Con el sorteo de verdad, no con `Math.random`. Si la conversión de
    HMAC a número tuviera sesgo --el error clásico es usar modulo-- el
    retorno se iria de 94 y esto lo agarra.
  */
  const semillaServidor = "a".repeat(64);
  const TIRADAS = 100000;

  let apostado = 0;
  let pagado = 0;
  const cuenta = new Array(100).fill(0);

  for (let i = 0; i < TIRADAS; i += 1) {
    const r = dice.jugar({
      apuestaSc: 1,
      modo: "over",
      desde: 49,
      semillas: { semillaServidor, semillaCliente: "prueba", nonce: i },
      cfg: {},
    });
    apostado += 1;
    pagado += r.pagoSc;
    cuenta[r.numero] += 1;
  }

  const retorno = pagado / apostado;
  assert.ok(Math.abs(retorno - 0.94) < 0.01, "retorno " + retorno.toFixed(4));

  /* Y que los 100 números salgan parejo: ninguno puede faltar ni
     aparecer al doble. */
  const esperado = TIRADAS / 100;
  const flojos = cuenta.filter((c) => c < esperado * 0.8 || c > esperado * 1.2);
  assert.equal(flojos.length, 0, "hay numeros que salen torcido");
});

test("el mismo tiro se puede rehacer desde afuera", async () => {
  const semillas = { semillaServidor: "b".repeat(64), semillaCliente: "mia", nonce: 7 };
  const a = dice.jugar({ apuestaSc: 1, modo: "under", desde: 50, semillas, cfg: {} });

  /* Lo que haría la pantalla de verificación con la semilla revelada. */
  const { numeros } = fair.verificar({ ...semillas, cuantos: 1 });
  assert.equal(fair.entero(numeros[0], 100), a.numero);

  /* Y dos veces lo mismo da lo mismo. */
  const b = dice.jugar({ apuestaSc: 1, modo: "under", desde: 50, semillas, cfg: {} });
  assert.equal(b.numero, a.numero);
});

/* ── Contra el servidor ───────────────────────────────────────────── */

test("una tirada cobra, paga y queda anotada", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 100 });

  const { estado, datos } = await pedir("POST", "/games/dice/play", {
    token: j.token,
    cuerpo: { apuestaSc: 10, modo: "over", desde: 49 },
  });
  assert.equal(estado, 200, JSON.stringify(datos));

  const d = datos.data;
  assert.ok(d.numero >= 0 && d.numero <= 99);
  assert.equal(d.multiplicador, Math.round(((100 - MARGEN) / 50) * 10000) / 10000);

  const esperado = d.gano ? 100 - 10 + d.pagoSc : 90;
  assert.equal(d.balanceSc, esperado);

  const ronda = await GameRound.findById(d.rondaId).lean();
  assert.equal(ronda.juego, "dice");
  assert.equal(ronda.apuestaSc, 10);
  assert.equal(ronda.abierta, false);

  /* El libro: la apuesta siempre, el pago solo si gano. */
  const filas = await BalanceTransaction.find({ user: j.id }).sort({ createdAt: 1 }).lean();
  const apuesta = filas.find((f) => f.type === "game_bet");
  assert.equal(apuesta.amountSc, -10);
  assert.equal(apuesta.juegaSc, 10, "lo jugado tiene que contar para carreras y VIP");

  const pago = filas.find((f) => f.type === "game_win");
  assert.equal(!!pago, d.gano);
});

test("SIN SALDO NO SE JUEGA", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 1 });

  const r = await pedir("POST", "/games/dice/play", {
    token: j.token,
    cuerpo: { apuestaSc: 50, modo: "over", desde: 49 },
  });
  assert.equal(r.datos.code, "NOT_ENOUGH_COINS");

  /* Y no quedo ninguna ronda ni se movio el nonce. */
  assert.equal(await GameRound.countDocuments({ user: j.id }), 0);
});

test("el cliente no elige el multiplicador", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 100 });

  /* Manda su propio multiplicador y su propio pago: tienen que ser
     ignorados, porque los calcula el servidor. */
  const { datos } = await pedir("POST", "/games/dice/play", {
    token: j.token,
    cuerpo: { apuestaSc: 10, modo: "over", desde: 49, multiplicador: 500, pagoSc: 9999 },
  });

  assert.equal(datos.data.multiplicador, Math.round(((100 - MARGEN) / 50) * 10000) / 10000);
  assert.ok(datos.data.pagoSc <= 10 * 2, "pago " + datos.data.pagoSc);
});

test("una jugada imposible tampoco pasa por la red", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 100 });

  for (const cuerpo of [
    { apuestaSc: 10, modo: "between", desde: 50, hasta: 51 },
    { apuestaSc: 10, modo: "over", desde: 99 },
    { apuestaSc: 10, modo: "nada", desde: 50 },
    { apuestaSc: -5, modo: "over", desde: 49 },
    { apuestaSc: 10, modo: "over", desde: "49; drop" },
  ]) {
    const r = await pedir("POST", "/games/dice/play", { token: j.token, cuerpo });
    assert.notEqual(r.estado, 200, "paso: " + JSON.stringify(cuerpo));
  }

  /* Ninguna de las cinco cobro nada. */
  const u = await User.findById(j.id).select("+balanceSc").lean();
  assert.equal(u.balanceSc, 100);
});

test("cada tirada usa un nonce nuevo", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 1000 });

  for (let i = 0; i < 5; i += 1) {
    await pedir("POST", "/games/dice/play", {
      token: j.token,
      cuerpo: { apuestaSc: 1, modo: "over", desde: 49 },
    });
  }

  const rondas = await GameRound.find({ user: j.id }).sort({ nonce: 1 }).lean();
  assert.equal(rondas.length, 5);
  assert.deepEqual(rondas.map((r) => r.nonce), [1, 2, 3, 4, 5]);

  const tanda = await UserSeed.findOne({ user: j.id, activa: true }).lean();
  assert.equal(tanda.nonce, 5);
});

test("diez tiradas a la vez no repiten el nonce", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  /* Es la carrera clasica: leer el nonce, sortear y despues guardarlo
     deja que dos rondas salgan identicas. */
  const j = await jugador({ saldo: 1000 });

  await Promise.all(Array.from({ length: 10 }, () => pedir("POST", "/games/dice/play", {
    token: j.token,
    cuerpo: { apuestaSc: 1, modo: "over", desde: 49 },
  })));

  const rondas = await GameRound.find({ user: j.id }).lean();
  const nonces = new Set(rondas.map((r) => r.nonce));
  assert.equal(nonces.size, rondas.length, "hay nonces repetidos");
});

test("la lista de juegos publica el retorno de verdad", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const { datos } = await pedir("GET", "/games");
  const porId = Object.fromEntries(datos.data.juegos.map((g) => [g.id, g.rtp]));

  assert.equal(porId.dice, 94);
  assert.equal(porId.mines, 94);
  assert.equal(porId.keno, 94);
  assert.equal(porId.plinko, 94);
  assert.equal(porId.towers, 94);
  assert.equal(porId.slide, 93.33);
  assert.equal(porId.reme, 97.3);
  /* Crash esta cuantizado: 4% pedido da 4% exacto con mod 25. */
  assert.equal(porId.crash, 96);
  assert.equal(cfgJuegos.crashMod({}), 25);
});
