require("dotenv").config();
const mongoose = require("mongoose");

const Banner = require("../database/models/Banner");

/**
 * LOS CUATRO BANNERS DE LA PORTADA.
 *
 * El arte lo mandó Dani. El texto son CLAVES de idioma, no frases: el
 * sitio está en nueve idiomas (ver frontend/src/i18n).
 *
 * Se puede correr mil veces: actualiza por clave y no duplica nada.
 *
 *   node scripts/sembrarBanners.js
 */

const BANNERS = [
  {
    clave: "gta",
    foto: "/img/banners/banner-gta.webp",
    titulo: "banners.gtaTitle",
    sub: "banners.gtaSub",
    cta: "banners.gtaCta",
    destino: "/promotions",
    orden: 1,
  },
  {
    clave: "luxury",
    foto: "/img/banners/banner-luxury.webp",
    titulo: "banners.luxTitle",
    sub: "banners.luxSub",
    cta: "banners.luxCta",
    destino: "/boxes?sort=caras",
    orden: 2,
  },
  {
    clave: "race",
    foto: "/img/banners/banner-race.webp",
    titulo: "banners.raceTitle",
    sub: "banners.raceSub",
    cta: "banners.raceCta",
    destino: "/races/weekly",
    orden: 3,
  },
  {
    clave: "reward",
    foto: "/img/banners/banner-50k.webp",
    titulo: "banners.rewardTitle",
    sub: "banners.rewardSub",
    cta: "banners.rewardCta",
    destino: "/vip",
    orden: 4,
  },
];

async function sembrar() {
  for (const b of BANNERS) {
    await Banner.updateOne(
      { clave: b.clave },
      { $set: b, $setOnInsert: { visible: true } },
      { upsert: true }
    );
  }
  return BANNERS.length;
}

module.exports = { sembrar, BANNERS };

if (require.main === module) {
  (async () => {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/mrbox_local");
    console.log("banners:", await sembrar());
    await mongoose.disconnect();
  })().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
