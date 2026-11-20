/**
 * LOS OBJETOS SIN FOTO, CON LA FOTO DE SU GEMELO.
 *
 * El catalogo tiene entradas duplicadas: el mismo producto cargado dos
 * veces, una con foto y otra sin. Cinco cajas --pokemon-boosters,
 * apple-2k25, labubu, rolex y day-trader-- se armaron con las copias
 * sin foto, asi que todos sus premios salian con el dibujo del peso,
 * el mismo que usan los vales de credito. Una caja de Pokemon que
 * muestra cinco signos de peso parece una caja sin nada de Pokemon.
 *
 * El gemelo se busca por VALOR IGUAL y nombre parecido. El valor es lo
 * que hace fuerte la coincidencia: dos entradas distintas con el mismo
 * precio al centavo y un nombre que se solapa son, casi siempre, el
 * mismo producto cargado dos veces.
 *
 * La caja guarda una COPIA de la foto (ver models/Box.js), asi que no
 * alcanza con arreglar el catalogo: hay que volver a sellar los
 * premios de las cajas que lo usan.
 *
 * Uso:  node scripts/ponerImagenes.js          (muestra lo que haria)
 *       node scripts/ponerImagenes.js --aplicar
 */
require("dotenv").config();

const mongoose = require("mongoose");
const { conectar, desconectar } = require("../database");
const Item = require("../database/models/Item");
const Box = require("../database/models/Box");

const APLICAR = process.argv.includes("--aplicar");

/* Palabras que no distinguen nada: casi todos los nombres las tienen. */
const VACIAS = new Set(["the", "de", "del", "la", "el", "and", "y", "con", "box", "wireless", "series"]);

function palabras(nombre) {
  return new Set(
    String(nombre)
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((p) => p.length > 2 && !VACIAS.has(p))
  );
}

/* Cuanto se parecen dos nombres: de 0 a 1. */
function parecido(a, b) {
  const x = palabras(a);
  const y = palabras(b);
  if (!x.size || !y.size) return 0;
  let juntas = 0;
  for (const p of x) if (y.has(p)) juntas += 1;
  return juntas / Math.min(x.size, y.size);
}

(async () => {
  await conectar();

  const sinFoto = await Item.find({
    $or: [{ imageUrl: "" }, { imageUrl: null }, { imageUrl: { $exists: false } }],
  }).lean();

  console.log(`objetos sin foto: ${sinFoto.length}\n`);

  const arreglados = [];
  const huerfanos = [];

  for (const it of sinFoto) {
    /* Mismo valor al centavo: es la mitad de la evidencia. */
    const candidatos = await Item.find({
      _id: { $ne: it._id },
      valueSc: it.valueSc,
      imageUrl: { $nin: ["", null] },
    }).lean();

    let mejor = null;
    let puntaje = 0;
    for (const c of candidatos) {
      const p = parecido(it.name, c.name);
      if (p > puntaje) {
        puntaje = p;
        mejor = c;
      }
    }

    /* Menos de la mitad de las palabras en comun no es un gemelo, es
       otra cosa que cuesta lo mismo. */
    if (!mejor || puntaje < 0.5) {
      huerfanos.push(it);
      console.log(`  SIN GEMELO  ${it.name} (SC ${it.valueSc})`);
      continue;
    }

    arreglados.push({ it, mejor, puntaje });
    console.log(`  ${it.name}\n      -> ${mejor.name}  (${Math.round(puntaje * 100)}% del nombre, mismo valor)`);

    if (APLICAR) {
      await Item.updateOne({ _id: it._id }, { $set: { imageUrl: mejor.imageUrl } });
    }
  }

  console.log(`\ncon gemelo: ${arreglados.length}  |  sin gemelo: ${huerfanos.length}`);

  /* ── Volver a sellar los premios de las cajas ──────────────────── */
  if (APLICAR) {
    const porId = new Map(arreglados.map((a) => [String(a.it._id), a.mejor.imageUrl]));
    const cajas = await Box.find({ "prizes.imageUrl": "" });
    let tocadas = 0;

    for (const caja of cajas) {
      let cambio = false;
      for (const premio of caja.prizes) {
        if (premio.imageUrl) continue;
        const foto = porId.get(String(premio.item));
        if (foto) {
          premio.imageUrl = foto;
          cambio = true;
        }
      }
      if (cambio) {
        /* `validateBeforeSave: false`: solo se toca la foto, y las
           cuentas de la caja --precio, retorno-- no cambian. */
        await caja.save({ validateBeforeSave: false });
        tocadas += 1;
        console.log(`  caja resellada: ${caja.slug}`);
      }
    }
    console.log(`\ncajas reselladas: ${tocadas}`);
  } else {
    console.log("\n(prueba en seco: nada se guardo. Correr con --aplicar)");
  }

  await desconectar();
  await mongoose.disconnect().catch(() => {});
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
