require("dotenv").config();
const mongoose = require("mongoose");

const User = require("../database/models/User");
const BalanceTransaction = require("../database/models/BalanceTransaction");

/**
 * LE PONE `compradoSc` A LAS CUENTAS QUE YA EXISTIAN.
 *
 * El campo se agrego para que la comision del socio se pague sobre lo
 * que el jugador compro y no sobre lo que la casa le regalo. Lo sube
 * `wallet.mover` con cada `purchase`, pero eso solo corre de ahora en
 * adelante: las cuentas de antes quedarian en cero y se las trataria
 * como si nunca hubieran puesto un peso.
 *
 * Y eso no es un detalle: con `compradoSc` en cero, el tope deja el
 * margen comisionable en cero y los socios dejan de cobrar por gente
 * que si compro.
 *
 * El numero sale del libro, que es la fuente: la suma de los
 * movimientos `purchase` positivos de cada cuenta. Las devoluciones
 * --un `purchase` en negativo-- no se restan a proposito: lo comprado
 * es un maximo historico, igual que `jugadoSc`, y restarlas bajaria el
 * tope de alguien a quien ya se le comisiono.
 *
 *   node scripts/rellenarComprado.js            (muestra que haria)
 *   node scripts/rellenarComprado.js --escribir (lo hace)
 *
 * Se puede correr mil veces: deja el mismo numero.
 */
async function rellenar() {
  const escribir = process.argv.includes("--escribir");

  await mongoose.connect(process.env.DATABASE_URI || "mongodb://127.0.0.1:27017/mrbox_local");

  const compras = await BalanceTransaction.aggregate([
    { $match: { type: "purchase", amountSc: { $gt: 0 } } },
    { $group: { _id: "$user", total: { $sum: "$amountSc" } } },
  ]);

  console.log("cuentas que alguna vez compraron: %d", compras.length);

  let cambiadas = 0;
  let iguales = 0;

  for (const c of compras) {
    const u = await User.findById(c._id).select("username compradoSc").lean();
    if (!u) continue;

    const tiene = Math.round((Number(u.compradoSc) || 0) * 100) / 100;
    const deberia = Math.round(c.total * 100) / 100;

    if (Math.abs(tiene - deberia) < 0.005) {
      iguales += 1;
      continue;
    }

    cambiadas += 1;
    console.log("  %s: %s -> %s", String(u.username).padEnd(22), tiene.toFixed(2), deberia.toFixed(2));
    if (escribir) {
      await User.updateOne({ _id: c._id }, { $set: { compradoSc: deberia } });
    }
  }

  /*
    Y las que no compraron nunca: el campo tiene que existir igual. Sin
    el, `$ifNull` lo resuelve en cero --que es lo correcto-- pero el
    campo ausente no sirve para contar ni para ordenar, y una ficha a
    medias se lee mal desde el panel.
  */
  const sinCampo = await mongoose.connection.collection("users")
    .countDocuments({ compradoSc: { $exists: false } });

  console.log("\ncuentas sin el campo: %d", sinCampo);
  if (escribir && sinCampo) {
    const r = await mongoose.connection.collection("users").updateMany(
      { compradoSc: { $exists: false } },
      { $set: { compradoSc: 0, margenDeAfiliadoSc: 0 } },
    );
    console.log("  puestas en cero: %d", r.modifiedCount);
  }

  console.log("\n%d al dia, %d %s", iguales, cambiadas, escribir ? "corregidas" : "por corregir");
  if (!escribir) console.log("\nNo se escribio nada. Para hacerlo: --escribir");

  await mongoose.disconnect();
}

rellenar().catch((err) => {
  console.error("se rompio:", err.message);
  process.exit(1);
});
