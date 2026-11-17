/**
 * SIEMBRA EL CATALOGO DEL DISENO.
 *
 *     node scripts/sembrarDesdeDiseno.js [--limpiar]
 *
 * Lee `datos/catalogo.json` --que sale del prototipo del dueno, ver
 * scripts/extraerCatalogoDelDiseno.py-- y lo deja en la base.
 *
 * Son 1.719 objetos y 163 cajas, con los nombres, los precios y la
 * curaduria que armo el dueno. Lo unico recalculado son las chances,
 * porque las del prototipo eran de adorno: daban un retorno mediano del
 * 770%.
 *
 * NUNCA CONTRA PRODUCCION: se planta si la base no es local.
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const fs = require("fs");
const path = require("path");

const { conectar, desconectar, mongoose } = require("../database");
const Item = require("../database/models/Item");
const Box = require("../database/models/Box");
const Settings = require("../database/models/Settings");
const eco = require("../services/boxes/economia");

const RUTA = path.join(__dirname, "..", "datos", "catalogo.json");

/* De cuanto en cuanto se escribe. Mil por tanda: con 1.719 objetos de a
   uno son 1.719 viajes a la base, y eso tarda minutos en vez de
   segundos. */
const TANDA = 500;

async function sembrar({ limpiar = false } = {}) {
  const uri = process.env.DATABASE_URI || "";
  if (!/localhost|127\.0\.0\.1/.test(uri)) {
    throw new Error("Esto solo corre contra una base local.");
  }
  if (!fs.existsSync(RUTA)) {
    throw new Error(
      `Falta ${RUTA}.\nCorré primero:\n` +
      `  python scripts/extraerCatalogoDelDiseno.py <Landing.dc.html> <datos.json>`
    );
  }

  const base = await conectar();
  console.log(`sembrando el diseño en "${base}"`);

  const { items, boxes } = JSON.parse(fs.readFileSync(RUTA, "utf8"));
  const cfg = await Settings.leer();

  if (limpiar) {
    await Promise.all([Item.deleteMany({}), Box.deleteMany({})]);
    console.log("  catálogo vaciado");
  }

  /* ── Los objetos ──────────────────────────────────────────────── */

  for (let i = 0; i < items.length; i += TANDA) {
    const tanda = items.slice(i, i + TANDA);
    await Item.bulkWrite(
      tanda.map((it) => ({
        updateOne: {
          filter: { sku: it.sku },
          update: {
            $set: {
              name: it.name,
              valueSc: it.valueSc,
              rarity: it.rarity,
              /*
                La "foto" es una posición en una lámina de sprites, igual
                que en el prototipo: una sola imagen para los 1.712
                objetos en vez de 1.712 pedidos al servidor.
              */
              imageUrl: it.spritePos ? `sprite:prod:${it.spritePos}` : "",
              shippable: it.shippable !== false,
              active: true,
            },
          },
          upsert: true,
        },
      }))
    );
    process.stdout.write(`\r  objetos: ${Math.min(i + TANDA, items.length)}/${items.length}`);
  }
  console.log("");

  const guardados = await Item.find().select("sku _id name valueSc rarity imageUrl").lean();
  const porSku = new Map(guardados.map((g) => [g.sku, g]));

  /* ── Las cajas ────────────────────────────────────────────────── */

  let listas = 0;
  const rechazadas = [];

  for (let i = 0; i < boxes.length; i += 50) {
    const tanda = boxes.slice(i, i + 50);
    const escrituras = [];

    for (const caja of tanda) {
      const prizes = caja.prizes.map((pz) => {
        const it = porSku.get(items[pz.item].sku);
        return {
          item: it._id,
          name: it.name,
          valueSc: it.valueSc,
          imageUrl: it.imageUrl,
          rarity: it.rarity,
          chance: pz.chance,
        };
      });

      /*
        SE REVISA CADA CAJA ANTES DE GUARDARLA.

        El mismo revisor que usa el panel. No es una formalidad: es lo
        que garantiza que las chances sumen 1 y que ningún premio pase
        el tope. Si una caja no pasa, NO entra: mejor 162 cajas sanas
        que 163 con una rota que nadie va a notar hasta que pague de más.
      */
      const revision = eco.revisarCaja(
        { prizes, priceSc: caja.priceSc },
        { retornoObjetivo: cfg.retornoObjetivo, topePremio: cfg.topePremioSc }
      );

      if (!revision.ok) {
        rechazadas.push({ name: caja.name, errores: revision.errores });
        continue;
      }

      escrituras.push({
        updateOne: {
          filter: { slug: caja.slug },
          update: {
            $set: {
              name: caja.name,
              category: caja.categories[0] || "",
              imageUrl: `sprite:art:${caja.spritePos}`,
              prizes,
              priceSc: caja.priceSc,
              pagoPromedio: revision.pagoPromedio,
              retorno: revision.retorno,
              featured: caja.featured,
              markedNew: caja.markedNew,
              live: true,
            },
          },
          upsert: true,
        },
      });
      listas += 1;
    }

    if (escrituras.length) await Box.bulkWrite(escrituras);
    process.stdout.write(`\r  cajas: ${Math.min(i + 50, boxes.length)}/${boxes.length}`);
  }
  console.log("");

  /* ── El informe ───────────────────────────────────────────────── */

  const enLaBase = await Box.find().select("name priceSc retorno prizes").lean();
  const retornos = enLaBase.map((c) => c.retorno).filter(Boolean);
  const premios = enLaBase.reduce((a, c) => a + c.prizes.length, 0);

  console.log("");
  console.log(`  objetos en la base: ${await Item.countDocuments()}`);
  console.log(`  cajas en la base:   ${enLaBase.length} (${premios} premios en total)`);
  if (rechazadas.length) {
    console.log(`  RECHAZADAS: ${rechazadas.length}`);
    rechazadas.slice(0, 5).forEach((r) => console.log(`     ${r.name}: ${r.errores[0]}`));
  }
  console.log(
    `  retorno: ${(Math.min(...retornos) * 100).toFixed(3)}% a ` +
    `${(Math.max(...retornos) * 100).toFixed(3)}%`
  );

  const categorias = await Box.distinct("category");
  console.log(`  categorías: ${categorias.filter(Boolean).sort().join(", ")}`);
  console.log("listo.");
}

if (require.main === module) {
  sembrar({ limpiar: process.argv.includes("--limpiar") })
    .then(() => desconectar())
    .catch(async (e) => {
      console.error("\nERROR:", e.message);
      await desconectar().catch(() => {});
      process.exit(1);
    });
}

module.exports = { sembrar };
