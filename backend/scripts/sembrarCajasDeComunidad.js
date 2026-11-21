require("dotenv").config();
const mongoose = require("mongoose");

const Item = require("../database/models/Item");
const User = require("../database/models/User");
const Box = require("../database/models/Box");

const comunidad = require("../services/community");
const admin = require("../services/admin");
const eco = require("../services/boxes/economia");

/**
 * TRES CAJAS DE COMUNIDAD, PARA QUE LA SECCION TENGA ALGO ADENTRO.
 *
 * Van por el camino de verdad --se arman, se mandan a revisar y las
 * aprueba un admin-- y no a fuerza de escribir en la base: asi lo que
 * queda es lo mismo que dejaria un jugador, con el precio calculado
 * por la casa y no puesto a mano.
 *
 * LOS PESOS, NO LAS CHANCES
 *
 * Igual que en el editor: se escribe "este sale 4000 veces por cada
 * vez que sale aquel" y el sitio divide. Los pesos de cada caja suman
 * 10.000, asi que un peso de 1 es una chance entre diez mil y se lee
 * de un vistazo.
 *
 * EL PRECIO SALE SOLO
 *
 *     precio = suma(valor x chance) / 0,92
 *
 * Asi que aca no se elige el precio: se elige QUE hay adentro y CADA
 * CUANTO sale. El precio es la consecuencia, y por eso las tres
 * devuelven el mismo 92% que cualquier caja de la casa.
 *
 *   node scripts/sembrarCajasDeComunidad.js
 *
 * Se puede correr mil veces: si la caja ya existe, la deja como esta.
 */

const CAJAS = [
  {
    nombre: "PACK RIPPER",
    descripcion:
      "Sobres, bundles y cajas selladas. Casi siempre te llevas un sobre suelto; "
      + "una vez cada diez mil, la escultura de Charizard.",
    portada: { color: "#f0b429", textura: "chispas", estilo: 2 },
    /* Lo que asoma de la caja: el gral y dos del medio que se ven bien. */
    asoman: ["Charizard Sculpture", "Shrouded Fable Booster Box", "Scarlet & Violet 7: Stellar Crown Booster"],
    premios: [
      ["Trick or Trade - BOOster Pack", 4121],
      ["Cyber Judge SV5M Booster (JP)", 1600],
      ["Ancient Roar SV4K Booster (JP)", 1600],
      ["Scarlet & Violet 7: Stellar Crown Booster", 1200],
      ["Scarlet & Violet 8: Surging Sparks Booster", 900],
      ["Sword & Shield Astral Radiance Booster Build & Battle Box", 300],
      ["TCG Booster Bundle- Trick or Trade", 150],
      ["Shrouded Fable Booster Box", 120],
      ["XY Evolutions Booster Box", 6],
      ["Sun & Moon Team Up Booster Box", 2],
      ["Charizard Sculpture", 1],
    ],
  },

  {
    nombre: "BATTLE STATION",
    descripcion:
      "El escritorio entero, de la alfombrilla a la placa de video. "
      + "Dos de cada mil aperturas se llevan una 4090.",
    portada: { color: "#19c2a8", textura: "panal", estilo: 1 },
    asoman: ["Nvidia GeForce RTX 4090 ROG Strix OC", "34 QHD Curved Monitor", "Gaming Headset"],
    premios: [
      ["Computer Sticker", 6205],
      ["Mouse Mat", 1500],
      ["DeathAdder Essential Mouse", 900],
      ["Gaming Headset", 420],
      ["Prime Mouse", 380],
      ["23.8\" FHD Gaming Monitor", 260],
      ["32 FHD Monitor", 130],
      ["34 QHD Curved Monitor", 90],
      ["Nvidia GeForce RTX 4070 TUF OC", 60],
      ["Nvidia GeForce RTX 4080 TUF OC", 35],
      ["Nvidia GeForce RTX 4090 ROG Strix OC", 20],
    ],
  },

  {
    nombre: "SOLE SURVIVOR",
    descripcion:
      "Cordones, Dunks y, al fondo del todo, unas Jordan 1 Retro High. "
      + "La mayoria de las veces salis con los cordones.",
    portada: { color: "#e2542f", textura: "cuadros", estilo: 2 },
    asoman: ["Jordan 1 Retro High", "SB Dunk Low Grateful Dead Bears Orange", "Dunk Low Neapolitan"],
    premios: [
      ["Shoe Laces", 5400],
      ["Jibbit", 1800],
      ["Sneaker Keyring", 1100],
      ["Dunk Low Neapolitan", 620],
      ["Dunk Low Michigan State", 430],
      ["Yeezy Cotton Cap", 330],
      ["Dunk Low Polar Blue", 190],
      ["Air Max 1 '86 OG Camo Light Lemon Twist", 100],
      ["SB Dunk Low Raygun", 20],
      ["SB Dunk Low Grateful Dead Bears Orange", 8],
      ["Jordan 1 Retro High", 2],
    ],
  },
];


/** El objeto del catalogo que se llama EXACTAMENTE asi. */
async function objetoPorNombre(nombre) {
  const encontrados = await Item.find({ active: true, name: nombre }).select("name valueSc").lean();
  if (!encontrados.length) throw new Error(`no esta en el catalogo: "${nombre}"`);
  if (encontrados.length > 1) {
    /* Hay nombres repetidos con precios distintos. Se toma el mas
       barato, que es el que no infla la caja sin avisar. */
    encontrados.sort((a, b) => a.valueSc - b.valueSc);
  }
  return encontrados[0];
}


async function sembrar() {
  await mongoose.connect(process.env.DATABASE_URI || "mongodb://127.0.0.1:27017/mrbox_local");

  const creador = await User.findOne({ username: "funkmaster" });
  if (!creador) throw new Error("no esta la cuenta del creador");

  const jefe = await User.findOne({ rank: { $in: ["admin", "owner"] } });
  if (!jefe) throw new Error("no hay ningun admin para aprobarlas");

  console.log("creador: %s | admin: %s\n", creador.username, jefe.username);

  for (const d of CAJAS) {
    const yaEsta = await Box.findOne({ name: d.nombre, creator: creador._id }).lean();
    if (yaEsta) {
      console.log("%s ya existe (%s), la dejo como esta", d.nombre.padEnd(15), yaEsta.slug);
      continue;
    }

    /* De nombres a objetos del catalogo, en el orden escrito. */
    const premios = [];
    for (const [nombre, peso] of d.premios) {
      const o = await objetoPorNombre(nombre);
      premios.push({ itemId: String(o._id), peso, _nombre: o.name, _valor: o.valueSc });
    }

    /* Los que asoman se nombran, no se numeran: un indice se rompe
       solo en cuanto alguien reordena la lista de arriba. */
    const asoman = d.asoman
      .map((n) => premios.findIndex((p) => p._nombre === n))
      .filter((i) => i >= 0);
    if (asoman.length !== d.asoman.length) {
      throw new Error(`${d.nombre}: alguno de los que asoman no esta entre los premios`);
    }

    const caja = await comunidad.guardar({
      user: creador,
      nombre: d.nombre,
      descripcion: d.descripcion,
      premios: premios.map((p) => ({ itemId: p.itemId, peso: p.peso })),
      portada: { ...d.portada, asoman },
    });

    await comunidad.mandarARevisar({ user: creador, boxId: caja._id });
    await admin.revisarCajaDeComunidad({ admin: jefe, boxId: caja._id, aprobar: true });

    const lista = await Box.findById(caja._id).lean();
    const chase = lista.prizes.reduce((a, p) => (p.valueSc > a.valueSc ? p : a), lista.prizes[0]);

    console.log("%s SC %s | retorno %s%% | %d objetos | %s",
      d.nombre.padEnd(15),
      lista.priceSc.toFixed(2).padStart(8),
      (eco.retornoReal(lista.prizes, lista.priceSc) * 100).toFixed(2),
      lista.prizes.length,
      `gral: ${chase.name} SC ${chase.valueSc} (1 en ${Math.round(1 / chase.chance).toLocaleString("en-US")})`);
  }

  const alAire = await Box.countDocuments({ creator: { $ne: null }, live: true });
  console.log("\ncajas de comunidad al aire: %d", alAire);
  await mongoose.disconnect();
}

sembrar().catch((err) => {
  console.error("se rompio:", err.message);
  process.exit(1);
});
