/**
 * LA BILLETERA, CONTRA UNA BASE DE VERDAD.
 *
 * Estas pruebas necesitan MongoDB andando. No se puede probar con una
 * base de mentira lo único que hace falta probar acá: que la BASE
 * resuelva las carreras. Un doble gasto no se reproduce con objetos en
 * memoria, porque el error justamente está en el momento entre leer y
 * escribir.
 *
 * Usa `mrbox_test`, que se borra sola al terminar. Nunca toca `mrbox_local`.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const URI = process.env.TEST_DB_URI || "mongodb://127.0.0.1:27017/mrbox_test";

const User = require("../database/models/User");
const BalanceTransaction = require("../database/models/BalanceTransaction");
const wallet = require("../services/wallet");
const { sc } = require("../utils/money");

let hayBase = true;

test.before(async () => {
  try {
    await mongoose.connect(URI, { serverSelectionTimeoutMS: 3000 });
    await mongoose.connection.db.dropDatabase();
  } catch {
    hayBase = false;
  }
});

test.after(async () => {
  if (hayBase) {
    await mongoose.connection.db.dropDatabase().catch(() => {});
    await mongoose.disconnect().catch(() => {});
  }
});

let n = 0;
async function jugadorCon(balanceSc, extra = {}) {
  n += 1;
  return User.create({
    username: "j" + n,
    email: `j${n}@test.local`,
    passwordHash: "x",
    balanceSc,
    ...extra,
  });
}

test("acreditar sube el saldo y deja la fila con el antes y el despues", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const u = await jugadorCon(10);

  const r = await wallet.mover({
    userId: u._id, amountSc: 25.5, type: "purchase",
    reference: { kind: "test", label: "compra" },
  });

  assert.equal(r.balanceBefore, 10);
  assert.equal(r.balanceAfter, 35.5);

  const fila = await BalanceTransaction.findById(r.transaction._id).lean();
  assert.equal(fila.amountSc, 25.5);
  assert.equal(fila.balanceBefore, 10);
  assert.equal(fila.balanceAfter, 35.5);

  const guardado = await User.findById(u._id).select("+balanceSc").lean();
  assert.equal(sc(guardado.balanceSc), 35.5, "el saldo guardado y la fila tienen que coincidir");
});

test("descontar mas de lo que hay NO pasa y no deja fila", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const u = await jugadorCon(5);

  await assert.rejects(
    () => wallet.mover({ userId: u._id, amountSc: -10, type: "box_open" }),
    (err) => {
      assert.equal(err.code, "NOT_ENOUGH_COINS");
      assert.equal(err.data.faltan, 5, "tiene que decir cuanto falta, para poder mostrarlo");
      return true;
    }
  );

  const guardado = await User.findById(u._id).select("+balanceSc").lean();
  assert.equal(sc(guardado.balanceSc), 5, "el saldo no se movio");
  assert.equal(await BalanceTransaction.countDocuments({ user: u._id }), 0, "no quedo fila");
});

test("NADIE GASTA DOS VECES LO MISMO", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  /*
    La prueba que justifica todo el diseño de este archivo.

    Saldo para UNA apertura, y veinte pedidos al mismo tiempo. Si la
    condicion de saldo se evaluara en JavaScript, los veinte leerian 13,77
    antes de que ninguno escriba y los veinte pasarian: el jugador abre
    veinte cajas con plata para una. Con la condicion dentro del filtro,
    la base deja pasar exactamente uno.
  */
  const u = await jugadorCon(13.77);

  const intentos = Array.from({ length: 20 }, () =>
    wallet.mover({ userId: u._id, amountSc: -13.77, type: "box_open" })
      .then(() => "ok")
      .catch((e) => e.code)
  );
  const resultados = await Promise.all(intentos);

  const pasaron = resultados.filter((r) => r === "ok").length;
  assert.equal(pasaron, 1, `pasaron ${pasaron} de 20 — hay doble gasto`);

  const guardado = await User.findById(u._id).select("+balanceSc").lean();
  assert.equal(sc(guardado.balanceSc), 0);
  assert.equal(await BalanceTransaction.countDocuments({ user: u._id }), 1);
});

test("el saldo siempre se puede reconstruir sumando los movimientos", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const u = await jugadorCon(0);

  const movimientos = [100, -13.77, -13.77, 4.12, -0.5, 250, -99.99];
  for (const m of movimientos) {
    await wallet.mover({ userId: u._id, amountSc: m, type: m > 0 ? "purchase" : "box_open" });
  }

  const filas = await BalanceTransaction.find({ user: u._id }).sort({ createdAt: 1 }).lean();
  const sumado = filas.reduce((acc, f) => sc(acc + f.amountSc), 0);

  const guardado = await User.findById(u._id).select("+balanceSc").lean();
  assert.equal(sc(guardado.balanceSc), sumado, "la suma del libro no da el saldo");

  /* Y cada fila encadena con la anterior: sin huecos ni saltos. */
  for (let i = 1; i < filas.length; i += 1) {
    assert.equal(
      filas[i].balanceBefore, filas[i - 1].balanceAfter,
      `la fila ${i} arranca en ${filas[i].balanceBefore} y la anterior terminó en ${filas[i - 1].balanceAfter}`
    );
  }
});

test("un movimiento de cero se rechaza", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const u = await jugadorCon(10);
  for (const monto of [0, 0.001, null, undefined, NaN, "hola"]) {
    await assert.rejects(
      () => wallet.mover({ userId: u._id, amountSc: monto, type: "manual" }),
      (e) => e.code === "INVALID_AMOUNT",
      `paso con ${monto}`
    );
  }
});

/* ── El bono por codigo de afiliado ──────────────────────────────────── */

test("el bono se acredita y queda pendiente de jugar", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const u = await jugadorCon(0);

  /* Compra de SC 100 con un codigo del 10%: entran 110, 10 son bono. */
  await wallet.mover({ userId: u._id, amountSc: 100, type: "purchase" });
  await wallet.mover({ userId: u._id, amountSc: 10, type: "affiliate", bonoSc: 10 });

  const s = await wallet.saldoDe(u._id);
  assert.equal(s.balanceSc, 110);
  assert.equal(s.bonoPendienteSc, 10);
  assert.equal(s.canjeableSc, 100, "el bono sin jugar no se puede canjear todavia");
});

test("jugar baja el bono pendiente, y nunca lo deja negativo", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const u = await jugadorCon(0);
  await wallet.mover({ userId: u._id, amountSc: 110, type: "purchase", bonoSc: 10 });

  /* Abre una caja de SC 4: quedan 6 de bono por jugar. */
  await wallet.mover({ userId: u._id, amountSc: -4, type: "box_open", juegaSc: 4 });
  let s = await wallet.saldoDe(u._id);
  assert.equal(s.bonoPendienteSc, 6);
  assert.equal(s.canjeableSc, 100);

  /* Abre otra de SC 50: ya jugo mas que el bono entero. */
  await wallet.mover({ userId: u._id, amountSc: -50, type: "box_open", juegaSc: 50 });
  s = await wallet.saldoDe(u._id);
  assert.equal(s.bonoPendienteSc, 0, "el bono pendiente no puede quedar negativo");
  assert.equal(s.canjeableSc, 56, "ya puede canjear todo lo que le queda");

  const guardado = await User.findById(u._id).select("+jugadoSc").lean();
  assert.equal(guardado.jugadoSc, 54, "lo jugado se acumula para el VIP y las carreras");
});

test("sin bono, todo el saldo es canjeable de una", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const u = await jugadorCon(0);
  await wallet.mover({ userId: u._id, amountSc: 200, type: "purchase" });
  const s = await wallet.saldoDe(u._id);
  assert.equal(s.canjeableSc, 200);
});
