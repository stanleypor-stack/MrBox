require("dotenv").config();
const { MongoClient } = require("mongodb");

/**
 * COPIA EL CATALOGO DE LA BASE LOCAL A OTRA.
 *
 * Para que el sitio publicado se vea igual que el de desarrollo:
 * las 166 cajas, los 1737 objetos, los banners, las promociones y las
 * perillas. `cargarCatalogo.js` solo sube las 5 cajas de ejemplo del
 * sembrado; esto sube lo que de verdad hay.
 *
 * LO QUE NO COPIA, A PROPOSITO
 *
 *   - las cuentas, con sus saldos y sus claves
 *   - los movimientos, las aperturas y el inventario
 *   - las carreras ya cerradas, los canjes, los pedidos, los tickets
 *   - la actividad del feed
 *
 * Nada de eso es catalogo: es la historia de una base de pruebas.
 * Copiarla a un sitio publicado seria inventar un pasado que no
 * existe, y ademas dejaria cuentas con la clave del sembrado, que
 * esta escrita en el repositorio.
 *
 * Las carreras se arman solas: el servidor crea la del dia cuando
 * alguien las mira.
 *
 * LOS IDENTIFICADORES SE RESPETAN
 *
 * Cada documento se copia con su `_id`. Sin eso, las cajas apuntarian
 * a objetos que no existen y no se podria abrir ninguna.
 *
 *   node scripts/copiarCatalogo.js            (muestra que haria)
 *   node scripts/copiarCatalogo.js --escribir (lo hace)
 *
 * El destino sale de DESTINO_URI. El origen, de DATABASE_URI.
 * Se puede correr mil veces: actualiza por `_id`, no duplica.
 */

/*
  Las cajas de comunidad quedan afuera: apuntan a un `creator` que es
  una cuenta de la base de pruebas, y alla esa cuenta no existe. Una
  caja sin dueño rompe el panel del creador y la pantalla de
  aprobaciones.
*/
const QUE_COPIAR = [
  { nombre: "items", filtro: {} },
  { nombre: "boxes", filtro: { creator: null } },
  { nombre: "settings", filtro: {} },
  { nombre: "banners", filtro: {} },
  { nombre: "promotions", filtro: {} },
  { nombre: "challenges", filtro: {} },
  { nombre: "promocodes", filtro: {} },
  { nombre: "deals", filtro: {} },
];

async function copiar() {
  const escribir = process.argv.includes("--escribir");

  const origenUri = process.env.DATABASE_URI || "";
  const destinoUri = process.env.DESTINO_URI || "";

  if (!destinoUri) throw new Error("Falta DESTINO_URI (la base a la que copiar).");
  if (!origenUri) throw new Error("Falta DATABASE_URI (la base de donde copiar).");
  if (origenUri === destinoUri) throw new Error("El origen y el destino son la misma base.");

  const origen = new MongoClient(origenUri);
  const destino = new MongoClient(destinoUri);
  await origen.connect();
  await destino.connect();

  const bOrigen = origen.db();
  const bDestino = destino.db();

  console.log('de   "%s"', bOrigen.databaseName);
  console.log('a    "%s"   %s\n', bDestino.databaseName, escribir ? "SE VA A ESCRIBIR" : "solo mirando");

  for (const { nombre, filtro } of QUE_COPIAR) {
    const docs = await bOrigen.collection(nombre).find(filtro).toArray();
    const habia = await bDestino.collection(nombre).countDocuments();

    if (!docs.length) {
      console.log("  %s: nada que copiar", nombre.padEnd(14));
      continue;
    }

    if (escribir) {
      /*
        Por lotes y con `replaceOne` + upsert: una copia entera de
        1737 objetos en una sola operacion se pasa del limite de 16 MB
        que acepta Mongo por pedido.
      */
      const LOTE = 300;
      for (let i = 0; i < docs.length; i += LOTE) {
        await bDestino.collection(nombre).bulkWrite(
          docs.slice(i, i + LOTE).map((d) => ({
            replaceOne: { filter: { _id: d._id }, replacement: d, upsert: true },
          })),
          { ordered: false },
        );
      }
    }

    const quedan = escribir ? await bDestino.collection(nombre).countDocuments() : habia;
    console.log("  %s %s  (alla habia %d, ahora %d)", nombre.padEnd(14), String(docs.length).padStart(5), habia, quedan);
  }

  /* ── El control: que no se haya colado ninguna cuenta ─────────── */
  if (escribir) {
    const cuentas = await bDestino.collection("users").countDocuments();
    const cajas = await bDestino.collection("boxes").countDocuments({ live: true });
    const objetos = await bDestino.collection("items").countDocuments();

    console.log("\nen el destino: %d objetos, %d cajas al aire", objetos, cajas);
    console.log("cuentas: %d  (este script no copia ninguna)", cuentas);
  } else {
    console.log("\nNo se escribio nada. Para hacerlo: --escribir");
  }

  await origen.close();
  await destino.close();
}

copiar().catch((err) => {
  console.error("se rompio:", err.message);
  process.exit(1);
});
