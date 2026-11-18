require("dotenv").config();
const mongoose = require("mongoose");

const User = require("../database/models/User");
const cajas = require("../services/boxes");

/**
 * LAS TRES CAJAS DE REGALO, A LAS CUENTAS QUE YA EXISTEN.
 *
 * El regalo pasó de ser tres fichas sueltas a ser tres cajas, una
 * apertura en cada una. Las cuentas abiertas antes del cambio tienen
 * `freeOpens` pero ninguna caja asignada: sin esto, el botón amarillo
 * no les aparece en ningún lado.
 *
 * Solo toca a las que NO tienen cajas asignadas, así se puede correr
 * mil veces sin regalar dos veces.
 *
 *   node scripts/darCajasDeRegalo.js
 */
(async () => {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/mrbox_local");

  const sinRegalo = await User.find({
    $or: [{ cajasGratis: { $size: 0 } }, { cajasGratis: { $exists: false } }],
  }).select("username freeOpens").lean();

  let tocadas = 0;
  for (const u of sinRegalo) {
    /* Al que ya gastó todas sus fichas no se le regala de nuevo. */
    if (!u.freeOpens) continue;
    const dadas = await cajas.regalarCajasDeBienvenida(u._id);
    if (dadas.length) tocadas += 1;
  }

  console.log("cuentas miradas:", sinRegalo.length, "| con regalo nuevo:", tocadas);
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
