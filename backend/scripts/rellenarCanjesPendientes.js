require("dotenv").config();
const mongoose = require("mongoose");

const User = require("../database/models/User");
const Redemption = require("../database/models/Redemption");

/**
 * LE PONE `canjesPendientes` A LAS CUENTAS QUE NO LO TIENEN.
 *
 * El campo se agrego al esquema despues de que ya hubiera cuentas, y
 * `default: 0` solo corre al CREAR el documento. Las anteriores
 * quedaron sin el, y `pedirCanje` buscaba `{ $lt: 3 }`, que en Mongo
 * no empareja un campo ausente: esas cuentas no podian hacer su
 * primer canje nunca.
 *
 * La consulta ya esta arreglada --`$not: { $gte: N }` si empareja el
 * ausente-- asi que esto no hace falta para que funcione. Se corre
 * igual por dos motivos: deja la base pareja, y hace que el campo
 * sirva para contar y para ordenar, que con documentos a medias no
 * sirve.
 *
 * El valor no se pone en cero a ciegas: se cuenta lo que esa cuenta
 * tiene pendiente de verdad. Poner cero a una cuenta con tres canjes
 * esperando le daria lugar para tres mas.
 *
 *   node scripts/rellenarCanjesPendientes.js
 *
 * Se puede correr mil veces: solo toca las que les falta.
 */
async function rellenar() {
  await mongoose.connect(process.env.DATABASE_URI || "mongodb://127.0.0.1:27017/mrbox_local");

  const col = mongoose.connection.collection("users");
  const faltan = await col.find({ canjesPendientes: { $exists: false } })
    .project({ _id: 1, username: 1 }).toArray();

  console.log("cuentas sin el campo: %d", faltan.length);
  if (!faltan.length) {
    console.log("no hay nada que hacer");
    await mongoose.disconnect();
    return;
  }

  let conPendientes = 0;

  for (const u of faltan) {
    const pendientes = await Redemption.countDocuments({
      user: u._id,
      estado: { $in: ["pending", "approved"] },
    });

    await col.updateOne({ _id: u._id }, { $set: { canjesPendientes: pendientes } });
    if (pendientes) {
      conPendientes += 1;
      console.log("  %s -> %d (tenia canjes esperando)", u.username, pendientes);
    }
  }

  console.log("\nlistas %d cuentas, %d de ellas con canjes esperando", faltan.length, conPendientes);

  /* Y que no quede ninguna: si quedo alguna, algo salio mal. */
  const quedan = await col.countDocuments({ canjesPendientes: { $exists: false } });
  console.log("quedan sin el campo: %d", quedan);

  await mongoose.disconnect();
}

rellenar().catch((err) => {
  console.error("se rompio:", err.message);
  process.exit(1);
});
