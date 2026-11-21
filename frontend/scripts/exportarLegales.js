/**
 * LOS TEXTOS LEGALES, COMO DOCUMENTO.
 *
 * El sitio los dibuja desde `src/legal/*.js`, que es una lista de
 * bloques. Un abogado no va a leer eso: esto los pasa a Markdown, que
 * se abre en cualquier lado y se puede comentar al margen.
 *
 * Y lista aparte los huecos --lo que esta escrito «[[asi]]»-- para
 * que se vea de un vistazo que falta decidir. Son decisiones de Dani
 * y de su abogado, no mias: la razon social, la ley que rige, los
 * paises excluidos.
 *
 *   node scripts/exportarLegales.js
 *
 * Deja el archivo en `audit/legales/`.
 */
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..", "..");
const ORIGEN = path.join(__dirname, "..", "src", "legal");
const DESTINO = path.join(RAIZ, "audit", "legales");

/*
  El modulo es ESM (`export const`) y esto corre en CommonJS. En vez
  de sumar un transpilador para dos archivos, se lee el texto y se
  evalua el trozo que importa. Es un archivo nuestro del repo, no
  algo que llegue de afuera.
*/
/*
  Los ladrillos, escritos otra vez aca.

  Los archivos los importan de `./bloques`, y esto corre en
  CommonJS: un `import` revienta. Son seis funciones de una linea;
  traer un transpilador para eso no se justifica.
*/
const LADRILLOS = `
  const h = (texto) => ({ t: "h2", texto });
  const s = (texto) => ({ t: "h3", texto });
  const p = (texto) => ({ t: "p", texto });
  const li = (items) => ({ t: "ul", items });
  const nota = (texto) => ({ t: "nota", texto });
  const tabla = (filas) => ({ t: "tabla", filas });
`;

function cargar(archivo) {
  const crudo = fs.readFileSync(path.join(ORIGEN, archivo), "utf8");
  const cuerpo = LADRILLOS + crudo
    .replace(/^import .*;$/gm, "")
    .replace(/^export const /gm, "const ")
    .replace(/^export default .*;$/gm, "")
    .concat("\nreturn { ACTUALIZADO, TEXTO };");
  // eslint-disable-next-line no-new-func
  return new Function(cuerpo)();
}

function aMarkdown(titulo, { ACTUALIZADO, TEXTO }) {
  const lineas = [`# ${titulo}`, "", `*Last updated: ${ACTUALIZADO}*`, ""];

  for (const b of TEXTO) {
    if (b.t === "h2") lineas.push("", `## ${b.texto}`, "");
    else if (b.t === "h3") lineas.push("", `### ${b.texto}`, "");
    else if (b.t === "ul") { b.items.forEach((x) => lineas.push(`- ${x}`)); lineas.push(""); }
    else if (b.t === "nota") lineas.push(`> **${b.texto}**`, "");
    else if (b.t === "tabla") {
      lineas.push("| | |", "|---|---|");
      b.filas.forEach(([a, c]) => lineas.push(`| **${a}** | ${c} |`));
      lineas.push("");
    } else lineas.push(b.texto, "");
  }

  return lineas.join("\n").replace(/\n{3,}/g, "\n\n");
}

function huecos(md) {
  const vistos = new Map();
  for (const m of md.matchAll(/\[\[([^\]]+)\]\]/g)) {
    vistos.set(m[1], (vistos.get(m[1]) || 0) + 1);
  }
  return [...vistos.entries()].sort((a, b) => b[1] - a[1]);
}

const docs = [
  { archivo: "terminos.js", titulo: "MR BOX — Terms of Service", salida: "1-terminos.md" },
  { archivo: "justo.js", titulo: "MR BOX — Provably Fair", salida: "2-provably-fair.md" },
  { archivo: "envios.js", titulo: "MR BOX — Shipping Policy", salida: "3-envios.md" },
  { archivo: "reembolsos.js", titulo: "MR BOX — Refund Policy", salida: "4-reembolsos.md" },
  { archivo: "responsable.js", titulo: "MR BOX — Responsible Play", salida: "5-juego-responsable.md" },
  { archivo: "privacidad.js", titulo: "MR BOX — Privacy Policy", salida: "6-privacidad.md" },
  { archivo: "cookies.js", titulo: "MR BOX — Cookie Policy", salida: "7-cookies.md" },
  { archivo: "aml.js", titulo: "MR BOX — AML and Customer Acceptance", salida: "8-aml.md" },
];

fs.mkdirSync(DESTINO, { recursive: true });

for (const d of docs) {
  const md = aMarkdown(d.titulo, cargar(d.archivo));
  const faltan = huecos(md);

  const cabecera = [
    "<!--",
    "  BORRADOR. No esta revisado por un abogado.",
    "",
    "  Generado desde frontend/src/legal/ con scripts/exportarLegales.js.",
    "  Si se edita ESTE archivo, el cambio no llega al sitio: el texto",
    "  que se publica es el del .js.",
    "-->",
    "",
  ].join("\n");

  const pendientes = faltan.length
    ? ["", "---", "", "## Lo que falta decidir", "",
      "Cada uno de estos aparece en el texto escrito `[[así]]`. Son decisiones",
      "del titular del sitio y de su abogado.", "",
      ...faltan.map(([q, n]) => `- **${q}** — ${n} ${n === 1 ? "vez" : "veces"}`), ""].join("\n")
    : "";

  fs.writeFileSync(path.join(DESTINO, d.salida), cabecera + md + pendientes, "utf8");

  const palabras = md.split(/\s+/).filter(Boolean).length;
  console.log("%s  %d palabras, %d huecos por decidir", d.salida, palabras, faltan.length);
  faltan.forEach(([q, n]) => console.log("   %s (%d)", q, n));
}

console.log("\nen", path.relative(RAIZ, DESTINO));
