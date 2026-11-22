require("dotenv").config();
const mongoose = require("mongoose");

const User = require("../database/models/User");

/**
 * RELLENA `jugadoPagoSc` DESDE EL LIBRO.
 *
 * El campo es nuevo: cuenta lo jugado que PAGÓ el jugador de su
 * bolsillo, y de ahí salen los beneficios del Club VIP. Las cuentas
 * que ya existían lo tienen en cero, así que un jugador de siempre
 * aparecería como Bronze y sin derecho a nada hasta volver a jugar.
 *
 * No hay que estimarlo: está en el libro. Cada apertura dejó una fila
 * con `juegaSc` --lo que contó como jugada-- y con `amountSc` --lo que
 * salió del saldo. Las aperturas de regalo son exactamente las de
 * monto cero, así que la cuenta es la suma de `juegaSc` de las filas
 * que ADEMÁS descontaron plata.
 *
 * Es la misma regla que aplica `wallet.mover` de ahora en adelante, y
 * por eso el relleno y lo que venga después dan el mismo número.
 *
 *   node scripts/rellenarJugadoPago.js            (muestra que haria)
 *   node scripts/rellenarJugadoPago.js --escribir (lo hace)
 *
 * Se puede correr mil veces: no suma, escribe el total.
 */
async function rellenar() {
  const escribir = process.argv.includes("--escribir");
  const uri = process.env.DATABASE_URI || "";
  if (!uri) throw new Error("Falta DATABASE_URI.");

  await mongoose.connect(uri);
  const base = mongoose.connection;
  console.log('base: "%s"  (%s)\n', base.name, escribir ? "SE VA A ESCRIBIR" : "solo mirando");

  const porJugador = await base.collection("balancetransactions").aggregate([
    { $match: { juegaSc: { $gt: 0 }, amountSc: { $lt: 0 } } },
    { $group: { _id: "$user", total: { $sum: "$juegaSc" } } },
  ]).toArray();

  console.log("cuentas que jugaron pagando: %d", porJugador.length);

  let movidas = 0;
  let iguales = 0;

  for (const fila of porJugador) {
    /* Dos decimales, como todo el dinero del sitio. */
    const total = Math.round(fila.total * 100) / 100;
    const u = await User.findById(fila._id).select("username jugadoSc jugadoPagoSc").lean();
    if (!u) continue;

    const tenia = Math.round((Number(u.jugadoPagoSc) || 0) * 100) / 100;
    if (tenia === total) { iguales += 1; continue; }

    movidas += 1;
    console.log(
      "  %s: jugado %s, pago %s  (tenia %s)",
      String(u.username).padEnd(16), u.jugadoSc, total, tenia,
    );

    if (escribir) {
      await User.updateOne({ _id: fila._id }, { $set: { jugadoPagoSc: total } });
    }
  }

  console.log("\n%d cuentas a corregir, %d ya estaban bien", movidas, iguales);
  if (!escribir) console.log("No se escribio nada. Para hacerlo: --escribir");

  await mongoose.disconnect();
}

rellenar().catch(async (err) => {
  console.error("se rompio:", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
