require("dotenv").config();
const mongoose = require("mongoose");

const Item = require("../database/models/Item");
const Box = require("../database/models/Box");

/**
 * LAS FOTOS QUE FALTABAN.
 *
 * Los 1.712 objetos del catálogo salieron del diseño con su recorte de
 * lámina. Los siete "MR BOX Credit" no: esos los inventamos nosotros
 * para que una caja pueda devolver saldo, y se quedaron sin dibujo.
 *
 * Sin foto, la cinta de Live Pulls muestra un cuadrado vacío --que se
 * lee como un error del sitio-- y la grilla de premios de la caja
 * también. Se les pone la moneda del diseño, que es exactamente lo que
 * son.
 *
 * Y de paso se copia la foto a los premios de las cajas: el premio
 * guarda SU copia del arte (así el recibo no cambia si mañana se cambia
 * el catálogo), y los que se sembraron antes quedaron en blanco.
 *
 *   node scripts/ponerFotosQueFaltan.js
 */

const MONEDA = "/img/4397330e5a00828a237d1edfabb11f18.webp";

(async () => {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/mrbox_local");

  /* ── 1. El catálogo ──────────────────────────────────────────────── */
  const sinFoto = await Item.find({
    $or: [{ imageUrl: "" }, { imageUrl: null }, { imageUrl: { $exists: false } }],
  }).select("name").lean();

  if (sinFoto.length) {
    await Item.updateMany(
      { _id: { $in: sinFoto.map((i) => i._id) } },
      { $set: { imageUrl: MONEDA } }
    );
  }
  console.log("objetos sin foto arreglados:", sinFoto.length);

  /* ── 2. Los premios de las cajas ─────────────────────────────────── */
  const todos = await Item.find({}).select("name imageUrl").lean();
  const porNombre = new Map(todos.map((i) => [i.name, i.imageUrl || ""]));
  const porId = new Map(todos.map((i) => [String(i._id), i.imageUrl || ""]));

  const cajas = await Box.find({}).select("name prizes").lean();
  let tocadas = 0;
  let premios = 0;

  for (const c of cajas) {
    let cambio = false;
    const prizes = (c.prizes || []).map((p) => {
      if (p.imageUrl) return p;
      const foto = porId.get(String(p.item || "")) || porNombre.get(p.name) || "";
      if (!foto) return p;
      cambio = true;
      premios += 1;
      return { ...p, imageUrl: foto };
    });

    if (cambio) {
      await Box.updateOne({ _id: c._id }, { $set: { prizes } });
      tocadas += 1;
    }
  }

  console.log("cajas tocadas:", tocadas, "| premios con foto nueva:", premios);
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
