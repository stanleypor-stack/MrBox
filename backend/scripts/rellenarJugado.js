require("dotenv").config();
const mongoose = require("mongoose");

const User = require("../database/models/User");
const BalanceTransaction = require("../database/models/BalanceTransaction");
const BoxOpen = require("../database/models/BoxOpen");
const Box = require("../database/models/Box");

/**
 * LE PONE `juegaSc` A LOS MOVIMIENTOS VIEJOS.
 *
 * El campo se agrego despues de que ya hubiera movimientos. Para una
 * apertura paga no hace falta --lo jugado es el importe-- pero para
 * una GRATIS si: esa fila quedo en cero y no hay forma de saber,
 * mirandola, que hubo una jugada. Por eso Stats le mostraba al jugador
 * un cartel rojo diciendo que el contador y el libro no cuadran.
 *
 * DE DONDE SALE EL NUMERO
 *
 * El recibo de la apertura guarda `priceSc: 0` --es lo que pago, y es
 * correcto-- asi que el precio de lista no esta ahi. Lo que si esta es
 * a que caja fue, y la caja tiene su precio. Es una reconstruccion, no
 * un dato guardado: si una caja cambio de precio desde entonces, el
 * numero sale de lo que vale hoy.
 *
 * Por eso al final compara contra el contador del jugador, que SI es
 * el numero de aquel momento, y avisa de cada cuenta que siga sin
 * cuadrar en vez de dar por hecho que salio bien.
 *
 *   node scripts/rellenarJugado.js             (muestra que haria)
 *   node scripts/rellenarJugado.js --escribir  (lo hace)
 *
 * Se puede correr mil veces: solo toca las filas que les falta.
 */
async function rellenar() {
  const escribir = process.argv.includes("--escribir");

  await mongoose.connect(process.env.DATABASE_URI || "mongodb://127.0.0.1:27017/mrbox_local");

  /*
    LAS PAGAS PRIMERO, QUE SON LA MAYORIA Y NO NECESITAN BUSCAR NADA.

    Lo jugado es el importe en positivo. Va en una sola operacion con
    pipeline en vez de fila por fila: son miles.
  */
  const pagas = await BalanceTransaction.updateMany(
    {
      type: { $in: ["box_open", "deal"] },
      amountSc: { $lt: 0 },
      $or: [{ juegaSc: { $exists: false } }, { juegaSc: 0 }],
    },
    [{ $set: { juegaSc: { $abs: "$amountSc" } } }],
    /* Mongoose 9 pide declararlo para aceptar un arreglo como
       actualizacion; sin esto lo toma por un error de tipeo. */
    { updatePipeline: true },
  );
  console.log("movimientos pagos al dia: %d", pagas.modifiedCount);

  /*
    LAS GRATIS, UNA POR UNA: hay que ir a buscar a que caja fue.
  */
  const gratis = await BalanceTransaction.find({
    type: "box_open",
    amountSc: 0,
    $or: [{ juegaSc: { $exists: false } }, { juegaSc: 0 }],
  }).lean();

  console.log("aperturas gratis sin el dato: %d", gratis.length);

  const precioDe = new Map();
  let puestas = 0;
  let sinCaja = 0;

  for (const t of gratis) {
    const ref = t.reference || {};

    /*
      OJO CON A QUE APUNTA CADA UNA.

      Una apertura PAGA referencia su recibo; una GRATIS referencia la
      CAJA (`kind: "freeOpen"`). Buscar un recibo con el id de una caja
      no encuentra nada, y la primera version de este script dejaba las
      dieciseis filas sin tocar diciendo "sin caja que mirar".
    */
    let slug = null;
    let comoSeLlama = ref.label || "";

    if (ref.kind === "freeOpen" && ref.id) {
      const caja = await Box.findById(ref.id).select("slug name priceSc").lean();
      if (caja) {
        slug = caja.slug;
        comoSeLlama = caja.name || comoSeLlama;
        if (!precioDe.has(slug)) precioDe.set(slug, caja.priceSc);
      }
    } else if (ref.id) {
      const recibo = await BoxOpen.findById(ref.id).select("boxSlug boxName").lean();
      if (recibo && recibo.boxSlug) {
        slug = recibo.boxSlug;
        comoSeLlama = recibo.boxName || comoSeLlama;
      }
    }

    if (!slug) {
      sinCaja += 1;
      continue;
    }

    if (!precioDe.has(slug)) {
      const caja = await Box.findOne({ slug }).select("priceSc").lean();
      precioDe.set(slug, caja ? caja.priceSc : 0);
    }

    const precio = precioDe.get(slug);
    if (!(precio > 0)) {
      sinCaja += 1;
      continue;
    }

    console.log("  %s -> %s", String(comoSeLlama || slug).padEnd(22), precio.toFixed(2));
    if (escribir) {
      await BalanceTransaction.updateOne({ _id: t._id }, { $set: { juegaSc: precio } });
    }
    puestas += 1;
  }

  if (sinCaja) console.log("  %d sin caja que mirar: se dejan como estan", sinCaja);

  /*
    Y EL CONTROL: que ahora el libro de lo mismo que el contador.

    Es la misma cuenta que hace la pantalla de Stats. Si una cuenta
    sigue sin cuadrar hay que mirarla a mano, y es mejor saberlo ahora
    que por un cartel rojo que ve el jugador.
  */
  console.log("\nCONTROL: contador contra libro");

  const porJugador = await BalanceTransaction.aggregate([
    { $match: { type: { $in: ["box_open", "deal"] } } },
    {
      $group: {
        _id: "$user",
        jugado: {
          $sum: {
            $cond: [
              { $gt: [{ $ifNull: ["$juegaSc", 0] }, 0] },
              "$juegaSc",
              { $abs: "$amountSc" },
            ],
          },
        },
      },
    },
  ]);

  let cuadran = 0;
  const torcidas = [];

  for (const f of porJugador) {
    const u = await User.findById(f._id).select("username jugadoSc").lean();
    if (!u) continue;
    const contador = Math.round((Number(u.jugadoSc) || 0) * 100) / 100;
    const libro = Math.round(f.jugado * 100) / 100;
    if (Math.abs(contador - libro) < 0.01) cuadran += 1;
    else torcidas.push({ username: u.username, contador, libro });
  }

  console.log("  cuadran: %d", cuadran);
  if (torcidas.length) {
    console.log("  NO cuadran: %d", torcidas.length);
    torcidas.forEach((t) => console.log("     %s  contador %s  libro %s  (%s)",
      t.username.padEnd(22), t.contador.toFixed(2), t.libro.toFixed(2),
      (t.contador - t.libro).toFixed(2)));
  }

  if (!escribir) console.log("\nNo se escribio nada. Para hacerlo: --escribir");

  await mongoose.disconnect();
}

rellenar().catch((err) => {
  console.error("se rompio:", err.message);
  process.exit(1);
});
