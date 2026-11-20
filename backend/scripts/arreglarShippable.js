/*
  RELLENA `shippable` DONDE FALTA.

  El flag vivia solo en el catalogo (`Item`). Ni los premios de las
  cajas ni las filas del inventario lo copiaban, asi que todo quedaba
  en `true` por defecto y un vale de credito se podia mandar por
  correo.

  Esto lo completa hacia atras, una vez. De ahi en mas lo copia la
  apertura.

  Uso:  node scripts/arreglarShippable.js
*/
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const { conectar, desconectar } = require("../database");

const Item = require("../database/models/Item");
const Box = require("../database/models/Box");
const InventoryItem = require("../database/models/InventoryItem");

(async () => {
  await conectar();

  const noEnviables = await Item.find({ shippable: false }).select("_id name").lean();
  const ids = noEnviables.map((i) => String(i._id));
  console.log(`objetos del catalogo que NO se mandan: ${ids.length}`);
  for (const i of noEnviables) console.log(`  · ${i.name}`);

  if (!ids.length) {
    await desconectar();
    return;
  }

  const comoObjetos = ids.map((i) => new mongoose.Types.ObjectId(i));

  /* Los premios de las cajas. */
  const cajas = await Box.updateMany(
    { "prizes.item": { $in: comoObjetos } },
    { $set: { "prizes.$[p].shippable": false } },
    { arrayFilters: [{ "p.item": { $in: comoObjetos } }] }
  );
  console.log(`cajas tocadas: ${cajas.modifiedCount}`);

  /* Y las filas de inventario que ya existen. */
  const filas = await InventoryItem.updateMany(
    { item: { $in: comoObjetos } },
    { $set: { shippable: false } }
  );
  console.log(`filas de inventario tocadas: ${filas.modifiedCount}`);

  await desconectar();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
