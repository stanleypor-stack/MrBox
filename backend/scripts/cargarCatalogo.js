require("dotenv").config();
const mongoose = require("mongoose");

const Item = require("../database/models/Item");
const Box = require("../database/models/Box");
const Settings = require("../database/models/Settings");
const eco = require("../services/boxes/economia");
const { OBJETOS, CAJAS } = require("./sembrar");

/**
 * CARGA EL CATALOGO EN UNA BASE DE PRODUCCION.
 *
 * `sembrar.js` no sirve para esto y se niega a correr fuera de una base
 * de desarrollo, con razon: crea `dani` y `sol` con una clave que esta
 * escrita en el repositorio, que ademas ahora es publico.
 *
 * Esto carga SOLO lo que es catalogo --los objetos y las cajas-- y
 * nada mas:
 *
 *   - ninguna cuenta
 *   - ningun saldo
 *   - ninguna apertura, carrera ni actividad inventada
 *
 * La primera cuenta de administrador se crea desde el sitio, con una
 * clave que elija el dueño, y se le sube el rango despues.
 *
 * EL PRECIO NO SE ESCRIBE A MANO
 *
 * Sale de los objetos: `suma(valor x chance) / retornoObjetivo`. Es la
 * misma cuenta que usa el panel al aprobar una caja, y la misma que
 * hace que el retorno sea el que dicen las perillas y no otro. Si una
 * caja no pasa la revision, se corta: una caja mal armada en
 * produccion es plata que se va sola.
 *
 *   node scripts/cargarCatalogo.js            (muestra que haria)
 *   node scripts/cargarCatalogo.js --escribir (lo hace)
 *
 * Se puede correr mil veces: actualiza lo que ya esta, por `sku` y por
 * `slug`, y no duplica nada.
 */
async function cargar() {
  const escribir = process.argv.includes("--escribir");
  const uri = process.env.DATABASE_URI || "";

  if (!uri) {
    throw new Error("Falta DATABASE_URI. Ponela en el entorno antes de correr esto.");
  }

  await mongoose.connect(uri);

  /* De que base estamos hablando: conviene verlo antes de escribir. */
  const nombre = mongoose.connection.name;
  console.log('base: "%s"  (%s)', nombre, escribir ? "SE VA A ESCRIBIR" : "solo mirando");

  const cfg = await Settings.leer();
  console.log(
    "perillas: retorno %s%%, tope de premio SC %s",
    (cfg.retornoObjetivo * 100).toFixed(0),
    cfg.topePremioSc,
  );

  /* ── Los objetos ─────────────────────────────────────────────── */
  let objetosNuevos = 0;
  for (const [sku, name, brand, valueSc, rarity, category, shippable] of OBJETOS) {
    const existe = await Item.exists({ sku });
    if (!existe) objetosNuevos += 1;
    if (escribir) {
      await Item.updateOne(
        { sku },
        { $set: { name, brand, valueSc, rarity, category, shippable, active: true } },
        { upsert: true },
      );
    }
  }
  console.log("objetos: %d en total, %d nuevos", OBJETOS.length, objetosNuevos);

  if (!escribir) {
    console.log("\nNo se escribio nada. Para hacerlo: --escribir");
    await mongoose.disconnect();
    return;
  }

  /* ── Las cajas ───────────────────────────────────────────────── */
  const items = await Item.find().lean();
  const porSku = Object.fromEntries(items.map((i) => [i.sku, i]));

  for (const caja of CAJAS) {
    const prizes = caja.premios.map(([sku, chance]) => {
      const item = porSku[sku];
      if (!item) throw new Error(`la caja "${caja.slug}" pide un objeto que no existe: ${sku}`);
      return {
        item: item._id,
        name: item.name,
        valueSc: item.valueSc,
        imageUrl: item.imageUrl,
        rarity: item.rarity,
        chance,
      };
    });

    const revision = eco.revisarCaja(
      { prizes },
      { retornoObjetivo: cfg.retornoObjetivo, topePremio: cfg.topePremioSc },
    );
    if (!revision.ok) {
      throw new Error(`la caja "${caja.slug}" no pasa: ${revision.errores.join(" | ")}`);
    }

    await Box.updateOne(
      { slug: caja.slug },
      {
        $set: {
          name: caja.name,
          category: caja.category,
          prizes,
          priceSc: revision.precioSugerido,
          pagoPromedio: revision.pagoPromedio,
          retorno: revision.retorno,
          featured: !!caja.featured,
          markedNew: !!caja.markedNew,
          live: true,
        },
      },
      { upsert: true },
    );

    console.log(
      '  caja "%s": %d objetos, sale SC %s, retorno %s%%',
      caja.name,
      prizes.length,
      revision.precioSugerido.toFixed(2),
      (revision.retorno * 100).toFixed(2),
    );
  }

  /* ── El control ──────────────────────────────────────────────── */
  const [cuantosObjetos, cuantasCajas, cuantasCuentas] = await Promise.all([
    Item.countDocuments({}),
    Box.countDocuments({ live: true }),
    mongoose.connection.collection("users").countDocuments({}),
  ]);

  console.log("\nen la base quedan: %d objetos, %d cajas al aire", cuantosObjetos, cuantasCajas);
  console.log("cuentas: %d  (este script no crea ninguna)", cuantasCuentas);

  await mongoose.disconnect();
}

cargar().catch(async (err) => {
  console.error("se rompio:", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
