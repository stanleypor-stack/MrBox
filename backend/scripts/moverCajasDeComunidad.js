require("dotenv").config();
const mongoose = require("mongoose");

const Box = require("../database/models/Box");
const BoxOpen = require("../database/models/BoxOpen");
const BalanceTransaction = require("../database/models/BalanceTransaction");
const User = require("../database/models/User");

const cajas = require("../services/boxes");
const { sc } = require("../utils/money");

/**
 * MOVIMIENTO DE VERDAD EN LAS CAJAS DE COMUNIDAD, PARA MIRAR EL PANEL.
 *
 * El panel del creador --sus cajas, el grafico de treinta dias y la
 * lista de pagos-- no se puede juzgar con la base vacia: todo da cero
 * y no se sabe si esta bien o si no suma. Y tampoco con todo cargado
 * en el dia de hoy, que deja un grafico de una sola barra.
 *
 * Asi que esto abre cajas DE VERDAD --por `cajas.abrir`, el mismo
 * camino que usa un jugador-- con las cuentas de prueba que ya trae la
 * base, y despues corre las fechas de lo que quedo anotado para que
 * caigan repartidas en los ultimos catorce dias.
 *
 * LO QUE SE INVENTA ES LA FECHA, NO LA PLATA
 *
 * Los premios los sortea el servidor, el precio sale de la caja y la
 * comision la calcula el mismo codigo que en produccion. Lo unico que
 * se toca despues es el `createdAt`, y se toca por la coleccion nativa
 * porque Mongoose lo marca inmutable y un `$set` por el modelo se
 * descarta sin decir nada.
 *
 * ARRANCA DE CERO CADA VEZ
 *
 * Borra lo que haya de estas cajas --aperturas, asientos y contadores--
 * y le descuenta al creador lo que le habia entrado, para que el saldo
 * siga cuadrando con el libro. Si no, correrlo dos veces deja al
 * creador con plata que no gano.
 *
 * SOLO EN DESARROLLO.
 *
 *   node scripts/moverCajasDeComunidad.js
 */

const NOMBRES = ["PACK RIPPER", "BATTLE STATION", "SOLE SURVIVOR"];
const DIAS = 14;

/* Cuantas aperturas por caja y por dia. Un rango, no un numero: un
   grafico con la misma altura todos los dias se ve falso de lejos. */
const POR_DIA = { min: 3, max: 16 };

const alAzar = (a, b) => a + Math.floor(Math.random() * (b - a + 1));


async function limpiar(cajasMias, creador) {
  const ids = cajasMias.map((c) => c._id);

  const asientos = await BalanceTransaction.aggregate([
    { $match: { user: creador._id, type: "creator_share", "reference.id": { $in: ids } } },
    { $group: { _id: null, total: { $sum: "$amountSc" }, n: { $sum: 1 } } },
  ]);
  const devolver = sc((asientos[0] && asientos[0].total) || 0);

  if (devolver > 0) {
    await User.updateOne({ _id: creador._id }, { $inc: { balanceSc: -devolver } });
  }
  await BalanceTransaction.deleteMany({ user: creador._id, type: "creator_share", "reference.id": { $in: ids } });
  const aperturas = await BoxOpen.deleteMany({ box: { $in: ids } });
  await Box.updateMany({ _id: { $in: ids } }, {
    $set: { opens: 0, ganadoPorElCreadorSc: 0, margenPendienteSc: 0 },
  });

  /*
    Y LOS ASIENTOS DE CAJAS QUE YA NO EXISTEN.

    Una base de desarrollo junta restos: comisiones anotadas contra una
    caja de prueba que despues se borro. En el panel no se ven --lista
    cajas, y esa no esta-- pero en el grafico y en la lista de pagos
    si, y ahi parecen plata que salio de la nada.
  */
  const vivas = (await Box.find().select("_id").lean()).map((b) => String(b._id));
  const sueltos = await BalanceTransaction.find({ user: creador._id, type: "creator_share" })
    .select("amountSc reference").lean();
  const huerfanos = sueltos.filter(
    (t) => !t.reference || !t.reference.id || !vivas.includes(String(t.reference.id))
  );

  if (huerfanos.length) {
    const suma = sc(huerfanos.reduce((a, t) => a + t.amountSc, 0));
    await User.updateOne({ _id: creador._id }, { $inc: { balanceSc: -suma } });
    await BalanceTransaction.deleteMany({ _id: { $in: huerfanos.map((h) => h._id) } });
    console.log("restos de pruebas viejas: %d asientos, SC %s", huerfanos.length, suma.toFixed(2));
  }

  console.log("limpieza: %d asientos (SC %s devueltos del saldo), %d aperturas\n",
    (asientos[0] && asientos[0].n) || 0, devolver.toFixed(2), aperturas.deletedCount);
}


async function correrLasFechas(desde, cuando) {
  /*
    Por la coleccion nativa: Mongoose marca `createdAt` inmutable --es
    `timestamps: true`-- y un `$set` por el modelo se descarta callado.
  */
  for (const modelo of [BoxOpen, BalanceTransaction]) {
    await modelo.collection.updateMany(
      { createdAt: { $gte: desde } },
      { $set: { createdAt: cuando, updatedAt: cuando } }
    );
  }
}


async function mover() {
  await mongoose.connect(process.env.DATABASE_URI || "mongodb://127.0.0.1:27017/mrbox_local");

  const creador = await User.findOne({ username: "funkmaster" });
  const mias = await Box.find({ name: { $in: NOMBRES }, creator: creador._id }).lean();
  if (mias.length !== NOMBRES.length) {
    throw new Error("faltan cajas: corre antes sembrarCajasDeComunidad.js");
  }

  await limpiar(mias, creador);

  /*
    LOS JUGADORES SON LOS QUE YA TRAE LA BASE, CON DOS DESCARTES.

    El creador, porque a el no se le paga por abrir lo suyo y entonces
    no moveria nada.

    Y el que esta en pausa o tiene un tope diario puesto. Eso es una
    autoexclusion, y no se desactiva para llenar un grafico: ni aca ni
    en ningun lado. Se lo saltea y listo.
  */
  const todos = await User.find({ _id: { $ne: creador._id }, rank: "user" })
    .select("_id username limites").limit(14).lean();

  const ahora = new Date();
  const jugadores = todos.filter((u) => {
    const l = u.limites || {};
    if (l.pausaHasta && new Date(l.pausaHasta) > ahora) return false;
    return l.juegoDiarioSc == null && l.perdidaDiariaSc == null;
  });

  const salteados = todos.length - jugadores.length;
  if (salteados) console.log("saltados por pausa o tope propio: %d", salteados);
  if (!jugadores.length) throw new Error("no quedo ningun jugador sin limites");

  console.log("jugando con: %s\n", jugadores.map((j) => j.username).join(", "));

  const hoy = new Date();
  let total = 0;

  for (let d = DIAS - 1; d >= 0; d -= 1) {
    const cuando = new Date(hoy.getTime() - d * 24 * 60 * 60 * 1000);
    /* Una hora cualquiera del dia, para que no caigan todas juntas. */
    cuando.setUTCHours(alAzar(9, 22), alAzar(0, 59), alAzar(0, 59), 0);

    const marca = new Date();
    let delDia = 0;

    for (const caja of mias) {
      const cuantas = alAzar(POR_DIA.min, POR_DIA.max);
      for (let i = 0; i < cuantas; i += 1) {
        const j = jugadores[alAzar(0, jugadores.length - 1)];
        /* Que le alcance: el saldo de las cuentas de prueba no es el
           tema de esta prueba. */
        await User.updateOne({ _id: j._id }, { $set: { balanceSc: 100000 } });
        await cajas.abrir({ user: await User.findById(j._id).select("+balanceSc"), slug: caja.slug, veces: 1 });
        delDia += 1;
      }
    }

    await correrLasFechas(marca, cuando);
    total += delDia;
    process.stdout.write(`  ${cuando.toISOString().slice(0, 10)}: ${delDia} aperturas\n`);
  }

  console.log("\n%d aperturas en %d dias\n", total, DIAS);

  for (const c of await Box.find({ _id: { $in: mias.map((m) => m._id) } }).lean()) {
    console.log("  %s %s aperturas | el creador lleva SC %s",
      c.name.padEnd(15), String(c.opens).padStart(4), (c.ganadoPorElCreadorSc || 0).toFixed(2));
  }

  const libro = await BalanceTransaction.aggregate([
    { $match: { user: creador._id, type: "creator_share" } },
    { $group: { _id: null, total: { $sum: "$amountSc" } } },
  ]);
  console.log("\ntotal en el libro: SC %s", sc((libro[0] && libro[0].total) || 0).toFixed(2));

  await mongoose.disconnect();
}

mover().catch((err) => {
  console.error("se rompio:", err.message);
  process.exit(1);
});
