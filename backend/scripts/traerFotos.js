/**
 * LAS FOTOS DE PRODUCTO, EN ALTA.
 *
 * Las que tenemos salieron del prototipo de diseño: son recortes de
 * una lámina, miden 192x192 y están aplastadas contra un fondo. En la
 * pantalla se dibujan a 132px, así que en cualquier teléfono --que
 * pinta a 2x-- se agrandan y se ven sucias.
 *
 * Las de origen miden 500x500, son PNG con transparencia y viven en un
 * almacenamiento público con una dirección predecible:
 *
 *   .../storage/v1/object/public/box-products/<nombre-del-producto>.png
 *
 * Así que el enganche es por NOMBRE: se convierte el del catálogo a esa
 * forma y se prueba. Lo que no engancha se deja como está --tener una
 * foto vieja es mejor que no tener ninguna-- y se lista al final.
 *
 * LOS VALES DE CREDITO NO SE TOCAN. Los "MR BOX Credit" son nuestros y
 * ya tienen su dibujo; el de ellos dice otra marca.
 *
 * SE GUARDA EN EL MISMO ARCHIVO DE SIEMPRE.
 *
 * El catálogo apunta a `sprite:prod:X% Y%`, que la pantalla convierte
 * en `/img/prod/<columna>-<fila>.webp`. Pisando ese archivo, la foto
 * mejora sin tocar una línea de la pantalla ni un registro de la base.
 * Son 1.712 posiciones para 1.712 objetos: uno por archivo.
 *
 *   node scripts/traerFotos.js --probar 40     mira cuántas enganchan
 *   node scripts/traerFotos.js --aplicar       las baja y las guarda
 *   node scripts/traerFotos.js --aplicar --solo "Rolex"   filtra por nombre
 */
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const { conectar, desconectar } = require("../database");
const Item = require("../database/models/Item");

const BASE = "https://nowjoovdhakosypddozi.supabase.co/storage/v1/object/public/box-products";

const DESTINO = path.join(__dirname, "..", "..", "frontend", "public", "img", "prod");
const CACHE = path.join(__dirname, "..", "..", ".fotos-cache");

/* Las mismas que usa `frontend/src/utils/sprite.js`. Si allá cambian,
   acá también: el archivo que se pisa sale de esta cuenta. */
const COLUMNAS = 42;
const FILAS = 41;

/* De a seis. No es una carrera: es el almacenamiento de otro y no hay
   ningún apuro. */
const A_LA_VEZ = 6;

const APLICAR = process.argv.includes("--aplicar");
const PROBAR = (() => {
  const i = process.argv.indexOf("--probar");
  return i > 0 ? Number(process.argv[i + 1]) || 40 : 0;
})();
const SOLO = (() => {
  const i = process.argv.indexOf("--solo");
  return i > 0 ? String(process.argv[i + 1] || "") : "";
})();

/* Sin nada que identifique a nadie: un nombre de programa y listo. */
const AGENTE = "mrbox-catalog-sync/1.0";

/** El archivo que le toca a un objeto, según su recorte de lámina. */
function archivoDe(imageUrl) {
  const m = /^sprite:prod:([\d.]+)% ([\d.]+)%/.exec(String(imageUrl || ""));
  if (!m) return "";
  const columna = Math.round((parseFloat(m[1]) * (COLUMNAS - 1)) / 100);
  const fila = Math.round((parseFloat(m[2]) * (FILAS - 1)) / 100);
  return `${columna}-${fila}.webp`;
}

/**
 * EL NOMBRE, CONVERTIDO A DIRECCION.
 *
 * Se devuelven varias formas y se prueban en orden, porque el mismo
 * producto puede estar cargado de maneras distintas de los dos lados:
 * "Post-it" / "post-it", "Sword & Shield X" / "sword-shield-x".
 */
function candidatos(nombre) {
  const base = String(nombre)
    .toLowerCase()
    .replace(/&/g, " ")
    /* Solo las comillas se borran. El punto y la coma NO: "999.5" vive
       como "999-5" del otro lado, y borrandolos daba "9995", que no
       existe. Lo comprobe producto por producto. */
    .replace(/['‘’"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const fuera = [base];

  /* Sin la marca de delante: "Sword & Shield Lost Origin Booster
     Display Box" también vive como "lost-origin-booster-display-box". */
  const sinPrefijo = base.replace(/^(sword-shield|scarlet-violet|sun-moon|xy|pokemon)-/, "");
  if (sinPrefijo !== base) fuera.push(sinPrefijo);

  /* Y sin la cola de "box"/"display-box", que a veces no está. */
  const sinCola = base.replace(/-(booster-)?(display-)?box$/, "");
  if (sinCola !== base) fuera.push(sinCola);

  return [...new Set(fuera)].filter(Boolean);
}

async function bajar(url) {
  const r = await fetch(url, { headers: { "user-agent": AGENTE } });
  if (!r.ok) return null;
  const tipo = r.headers.get("content-type") || "";
  if (!/^image\//.test(tipo)) return null;
  return Buffer.from(await r.arrayBuffer());
}

(async () => {
  await conectar();

  if (!fs.existsSync(CACHE)) fs.mkdirSync(CACHE, { recursive: true });

  const filtro = { imageUrl: { $regex: "^sprite:prod:" } };
  if (SOLO) filtro.name = { $regex: SOLO, $options: "i" };

  let items = await Item.find(filtro).select("name imageUrl sku").lean();

  /* Los vales son nuestros. */
  items = items.filter((i) => !/^MR BOX Credit/i.test(i.name));

  /* Un archivo por objeto: si dos entradas duplicadas apuntan al mismo
     recorte, alcanza con bajarlo una vez. */
  const porArchivo = new Map();
  for (const it of items) {
    const archivo = archivoDe(it.imageUrl);
    if (archivo && !porArchivo.has(archivo)) porArchivo.set(archivo, it);
  }

  let tareas = [...porArchivo.entries()];
  if (PROBAR) tareas = tareas.slice(0, PROBAR);

  console.log(`objetos: ${items.length}  |  archivos a mirar: ${tareas.length}`);
  console.log(APLICAR ? "bajando y guardando\n" : "PRUEBA EN SECO: solo mira si existen\n");

  const encontrados = [];
  const perdidos = [];
  let hechos = 0;

  const unaTarea = async ([archivo, it]) => {
    for (const slug of candidatos(it.name)) {
      const url = `${BASE}/${encodeURIComponent(slug)}.png`;
      const guardado = path.join(CACHE, `${slug}.png`);

      let datos = null;
      if (fs.existsSync(guardado)) {
        datos = fs.readFileSync(guardado);
      } else {
        try {
          datos = await bajar(url);
        } catch {
          datos = null;
        }
        if (datos && APLICAR) fs.writeFileSync(guardado, datos);
      }

      if (datos) {
        encontrados.push({ archivo, nombre: it.name, slug, bytes: datos.length });
        return;
      }
    }
    perdidos.push(it.name);
  };

  for (let i = 0; i < tareas.length; i += A_LA_VEZ) {
    await Promise.all(tareas.slice(i, i + A_LA_VEZ).map(unaTarea));
    hechos += Math.min(A_LA_VEZ, tareas.length - i);
    if (hechos % 60 === 0 || hechos === tareas.length) {
      process.stdout.write(`  ${hechos}/${tareas.length}  (${encontrados.length} con foto)\r`);
    }
  }

  console.log("\n");
  console.log(`CON FOTO NUEVA: ${encontrados.length} de ${tareas.length} ` +
    `(${Math.round((encontrados.length / tareas.length) * 100)}%)`);
  console.log(`SIN ENGANCHE:   ${perdidos.length}`);

  if (perdidos.length) {
    console.log("\nlos primeros que no engancharon:");
    for (const n of perdidos.slice(0, 15)) console.log("   ", n);
  }

  if (APLICAR) {
    console.log(`\nlas fotos quedaron en ${CACHE}`);
    console.log("ahora: python backend/scripts/convertirFotos.py");
  }

  await desconectar();
  await mongoose.disconnect().catch(() => {});
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
