/**
 * DATOS DE PRUEBA PARA MR BOX.
 *
 *     node scripts/sembrar.js
 *
 * Llena la base LOCAL con lo mínimo para que el sitio y el panel tengan
 * algo que mostrar: las perillas, un dueño, un socio con su código,
 * jugadores, el catálogo de objetos y unas cajas armadas con ellos.
 *
 * SE PUEDE CORRER MIL VECES.
 *
 * Todo va por `updateOne` con `upsert`, así que volver a correrlo deja
 * la base igual en vez de duplicar todo. Lo que NO hace es borrar: si
 * querés empezar de cero, `--limpiar`.
 *
 * NUNCA CONTRA PRODUCCION.
 *
 * Lo primero que hace es mirar la dirección de la base y plantarse si no
 * es local. Un script de datos de prueba apuntando a la base de verdad
 * es de las pocas formas de arruinar un sitio en un segundo.
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const bcrypt = require("bcryptjs");
const { conectar, desconectar, mongoose } = require("../database");

const User = require("../database/models/User");
const Item = require("../database/models/Item");
const Box = require("../database/models/Box");
const Settings = require("../database/models/Settings");
const AffiliateCode = require("../database/models/AffiliateCode");
const UserSeed = require("../database/models/UserSeed");

const eco = require("../services/boxes/economia");
const fair = require("../services/boxes/fair");
const { sc } = require("../utils/money");

/* ── El catálogo ──────────────────────────────────────────────────── */

/* [sku, nombre, marca, valor en SC, rareza, categoría, se envía] */
const OBJETOS = [
  ["ROL-DJW", "Datejust Wimbledon", "Rolex", 12425, "gold", "Watches", true],
  ["TAG-F1S", "Formula 1 Solargraph", "TAG Heuer", 1988, "gold", "Watches", true],
  ["ABC-10G", "10g Gold Minted Tablet", "ABC Bullion", 1549.22, "gold", "Bullion", true],
  ["APL-I16P", "iPhone 16 Plus", "Apple", 1277.29, "gold", "Tech", true],
  ["BOS-SSB", "Bose Smart Soundbar", "Bose", 564.45, "red", "Audio", true],
  ["JRD-4RT", "Jordan 4 Retro Red Thunder", "Jordan", 426, "red", "Sneakers", true],
  ["GPR-MAX", "GoPro MAX", "GoPro", 411.09, "red", "Tech", true],
  ["PKM-LOD", "Lost Origin Booster Display", "Pokemon", 347.19, "pink", "Trading Cards", true],
  ["POP-LTC", "Labubu Time to Chill Plush 40cm", "Pop Mart", 248.5, "pink", "Collectables", true],
  ["MNS-MJ98", "Michael Jordan 1998-99 Bulls Jersey", "Mitchell & Ness", 227.2, "pink", "Collectables", true],
  ["SNY-P3D", "PS5 Pulse 3D Wireless", "Sony", 128.51, "pink", "Tech", true],
  ["SNY-DS", "PS5 DualSense Wireless", "Sony", 69.58, "purple", "Tech", true],
  ["PKM-SFB", "Shrouded Fable Booster Box", "Pokemon", 66.03, "purple", "Trading Cards", true],
  ["POP-LCH", "Labubu Chanel Outfit", "Pop Mart", 56.8, "purple", "Collectables", true],
  ["APL-MSC", "MagSafe Charger", "Apple", 48.99, "purple", "Tech", true],
  ["GPR-FLT", "GoPro Floaty", "GoPro", 7.81, "blue", "Tech", true],
  ["MRB-CR5", "MR BOX Credit 5", "MR BOX", 5, "blue", "Credit", false],
  ["MRB-CR1", "MR BOX Credit 1", "MR BOX", 1, "blue", "Credit", false],
];

/*
  Las cajas: nombre, categoría, y qué objetos lleva con qué chance.
  Las chances suman 1 en todas; `revisarCaja` se planta si no.
  El precio NO se escribe: sale de los objetos.
*/
const CAJAS = [
  {
    slug: "day-trader", name: "Day Trader", category: "Mix", featured: true,
    premios: [
      ["ABC-10G", 0.0002], ["APL-I16P", 0.0003], ["BOS-SSB", 0.001],
      ["GPR-MAX", 0.0015], ["POP-LTC", 0.004], ["SNY-P3D", 0.008],
      ["SNY-DS", 0.01], ["APL-MSC", 0.01], ["GPR-FLT", 0.965],
    ],
  },
  {
    slug: "rolex", name: "Rolex", category: "Watches", featured: true,
    premios: [
      ["ROL-DJW", 0.0006], ["TAG-F1S", 0.004], ["ABC-10G", 0.006],
      ["BOS-SSB", 0.02], ["SNY-P3D", 0.08], ["APL-MSC", 0.2], ["MRB-CR5", 0.6894],
    ],
  },
  {
    slug: "pokemon-boosters", name: "Pokemon Boosters", category: "Trading Cards", markedNew: true,
    premios: [
      ["PKM-LOD", 0.004], ["POP-LTC", 0.006], ["PKM-SFB", 0.03],
      ["MRB-CR5", 0.26], ["MRB-CR1", 0.7],
    ],
  },
  {
    slug: "labubu", name: "Labubu", category: "Collectables",
    premios: [
      ["POP-LTC", 0.012], ["MNS-MJ98", 0.004], ["POP-LCH", 0.07],
      ["MRB-CR5", 0.3], ["MRB-CR1", 0.614],
    ],
  },
  {
    slug: "apple-2k25", name: "Apple 2K25", category: "Tech",
    premios: [
      ["APL-I16P", 0.008], ["GPR-MAX", 0.012], ["SNY-P3D", 0.06],
      ["APL-MSC", 0.22], ["GPR-FLT", 0.3], ["MRB-CR1", 0.4],
    ],
  },
];

/* ── Las cuentas ──────────────────────────────────────────────────── */

const CUENTAS = [
  { username: "dani", email: "dani@mrbox.local", rank: "owner", balanceSc: 0, verificationLevel: 3 },
  { username: "sol", email: "sol@mrbox.local", rank: "admin", balanceSc: 0, verificationLevel: 3 },
  { username: "funkmaster", email: "funk@mrbox.local", rank: "user", balanceSc: 412.5, verificationLevel: 3 },
  { username: "kaylope", email: "kay@mrbox.local", rank: "user", balanceSc: 88.2, verificationLevel: 2 },
  { username: "almondy", email: "almondy@mrbox.local", rank: "user", balanceSc: 15, verificationLevel: 0 },
];

const CLAVE_DE_PRUEBA = "mrbox12345";

/* ── El trabajo ───────────────────────────────────────────────────── */

async function sembrar({ limpiar = false } = {}) {
  const uri = process.env.DATABASE_URI || "";
  if (!/localhost|127\.0\.0\.1/.test(uri)) {
    throw new Error(`Esto solo corre contra una base local. DATABASE_URI apunta a otro lado.`);
  }

  const base = await conectar();
  console.log(`sembrando "${base}"`);

  if (limpiar) {
    await mongoose.connection.db.dropDatabase();
    console.log("  base vaciada");
  }

  /* Las perillas, con los valores por defecto del diseño. */
  const cfg = await Settings.leer();
  console.log(`  perillas: retorno ${(cfg.retornoObjetivo * 100).toFixed(0)}%, ` +
              `bono ${(cfg.bonoPorDeposito.normal * 100).toFixed(0)}%/${(cfg.bonoPorDeposito.destacado * 100).toFixed(0)}%`);

  /* Los objetos. */
  for (const [sku, name, brand, valueSc, rarity, category, shippable] of OBJETOS) {
    await Item.updateOne(
      { sku },
      { $set: { name, brand, valueSc, rarity, category, shippable, active: true } },
      { upsert: true }
    );
  }
  const items = await Item.find().lean();
  const porSku = Object.fromEntries(items.map((i) => [i.sku, i]));
  console.log(`  objetos: ${items.length}`);

  /* Las cuentas. */
  const passwordHash = await bcrypt.hash(CLAVE_DE_PRUEBA, 12);
  for (const c of CUENTAS) {
    await User.updateOne(
      { username: c.username },
      {
        $set: {
          email: c.email, rank: c.rank, verificationLevel: c.verificationLevel,
          balanceSc: c.balanceSc, freeOpens: cfg.aperturasDeRegalo,
        },
        $setOnInsert: { passwordHash },
      },
      { upsert: true }
    );
  }

  /* Las semillas de cada uno: sin esto no puede abrir una caja. */
  for (const u of await User.find().lean()) {
    if (await UserSeed.exists({ user: u._id, activa: true })) continue;
    const semilla = fair.semillaNueva();
    await UserSeed.create({
      user: u._id, semillaServidor: semilla,
      semillaServidorHash: fair.hashDeSemilla(semilla),
      semillaCliente: fair.semillaNueva().slice(0, 16), nonce: 0, activa: true,
    });
  }
  console.log(`  cuentas: ${await User.countDocuments()} (clave de todas: ${CLAVE_DE_PRUEBA})`);

  /* Un socio con código destacado, y uno normal. */
  const funk = await User.findOne({ username: "funkmaster" }).lean();
  const kay = await User.findOne({ username: "kaylope" }).lean();
  await AffiliateCode.updateOne(
    { code: "FUNK" },
    { $set: { owner: funk._id, tramo: "destacado", comision: 0.3, activo: true } },
    { upsert: true }
  );
  await AffiliateCode.updateOne(
    { code: "KAY" },
    { $set: { owner: kay._id, tramo: "normal", comision: 0.2, activo: true } },
    { upsert: true }
  );
  console.log(`  codigos de afiliado: FUNK (destacado, 10% al jugador), KAY (normal, 5%)`);

  /* Las cajas. El precio sale de los objetos. */
  for (const caja of CAJAS) {
    const prizes = caja.premios.map(([sku, chance]) => {
      const item = porSku[sku];
      if (!item) throw new Error(`la caja "${caja.slug}" pide un objeto que no existe: ${sku}`);
      return {
        item: item._id, name: item.name, valueSc: item.valueSc,
        imageUrl: item.imageUrl, rarity: item.rarity, chance,
      };
    });

    const revision = eco.revisarCaja(
      { prizes },
      { retornoObjetivo: cfg.retornoObjetivo, topePremio: cfg.topePremioSc }
    );
    if (!revision.ok) {
      throw new Error(`la caja "${caja.slug}" no pasa: ${revision.errores.join(" | ")}`);
    }

    await Box.updateOne(
      { slug: caja.slug },
      {
        $set: {
          name: caja.name, category: caja.category, prizes,
          priceSc: revision.precioSugerido,
          pagoPromedio: revision.pagoPromedio,
          retorno: revision.retorno,
          featured: !!caja.featured, markedNew: !!caja.markedNew, live: true,
        },
      },
      { upsert: true }
    );
    console.log(
      `  caja "${caja.name}": ${prizes.length} objetos, ` +
      `paga ${revision.pagoPromedio.toFixed(2)} en promedio, sale SC ${revision.precioSugerido.toFixed(2)}, ` +
      `retorno ${(revision.retorno * 100).toFixed(2)}%`
    );
  }

  console.log("listo.");
}

if (require.main === module) {
  sembrar({ limpiar: process.argv.includes("--limpiar") })
    .then(() => desconectar())
    .catch(async (e) => {
      console.error("ERROR:", e.message);
      await desconectar().catch(() => {});
      process.exit(1);
    });
}

module.exports = { sembrar, OBJETOS, CAJAS, CLAVE_DE_PRUEBA };
