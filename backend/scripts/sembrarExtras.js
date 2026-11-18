/**
 * SEMBRAR PROMOCIONES Y DESAFIOS DE PRUEBA.
 *
 * Las promos y los desafíos los carga el panel; esto es para que las
 * pantallas no estén vacías mientras se desarrolla, y para poder
 * mirarlas con datos que se parezcan a los de verdad.
 *
 * Es ADITIVO: no borra nada. Se puede correr las veces que haga falta.
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const { conectar } = require("../database");

const Promotion = require("../database/models/Promotion");
const Challenge = require("../database/models/Challenge");
const Box = require("../database/models/Box");
const { logger } = require("../utils/logger");

/* Tres promos como las del diseño, en los nueve idiomas de lo mínimo. */
const PROMOS = [
  {
    clave: "welcome",
    titulo: { en: "Three boxes on us", es: "Tres cajas de regalo", pt: "Três caixas por nossa conta" },
    texto: {
      en: "New here? Your first three opens are free. No deposit, no catch: sign up and they are in your account.",
      es: "¿Recién llegas? Tus primeras tres aperturas son gratis. Sin depósito y sin letra chica.",
      pt: "Chegou agora? Suas três primeiras aberturas são grátis. Sem depósito.",
    },
    boton: { en: "Claim them", es: "Llevarlas", pt: "Pegar" },
    arte: {
      kicker: { en: "WELCOME", es: "BIENVENIDA", pt: "BOAS-VINDAS" },
      linea1: { en: "FOR NEW PLAYERS", es: "PARA LOS QUE LLEGAN", pt: "PARA QUEM CHEGA" },
      linea2: { en: "3 FREE OPENS", es: "3 APERTURAS GRATIS", pt: "3 ABERTURAS GRÁTIS" },
      fondo: "#14306a",
      acento: "#ffc83d",
    },
    destino: "/signup",
    orden: 1,
  },
  {
    clave: "deposit-bonus",
    titulo: { en: "5% on every deposit", es: "5% en cada depósito", pt: "5% em cada depósito" },
    texto: {
      en: "Come in with a friend's code and every deposit you make gets 5% on top. It never expires.",
      es: "Entrá con el código de un amigo y cada depósito se lleva un 5% más. No vence nunca.",
      pt: "Entre com o código de um amigo e cada depósito ganha 5% a mais.",
    },
    boton: { en: "See how", es: "Cómo funciona", pt: "Como funciona" },
    arte: {
      kicker: { en: "+5%", es: "+5%", pt: "+5%" },
      linea1: { en: "ON EVERY DEPOSIT", es: "EN CADA DEPÓSITO", pt: "EM CADA DEPÓSITO" },
      linea2: { en: "WITH A FRIEND'S CODE", es: "CON CÓDIGO DE AMIGO", pt: "COM CÓDIGO DE AMIGO" },
      fondo: "#1b5e3a",
      acento: "#5dffb0",
    },
    destino: "/profile?tab=refer",
    orden: 2,
  },
  {
    clave: "weekly-race",
    titulo: { en: "$10,000 every week", es: "$10.000 todas las semanas", pt: "$10.000 toda semana" },
    texto: {
      en: "Every coin you play climbs the weekly board. The top ten split the pool when the clock hits zero.",
      es: "Cada SC que jugás te sube en la tabla semanal. Los diez primeros se reparten el pozo.",
      pt: "Cada moeda jogada sobe no ranking semanal. Os dez primeiros dividem o prêmio.",
    },
    boton: { en: "See the board", es: "Ver la tabla", pt: "Ver o ranking" },
    arte: {
      kicker: { en: "$10K", es: "$10K", pt: "$10K" },
      linea1: { en: "WEEKLY RACE", es: "CARRERA SEMANAL", pt: "CORRIDA SEMANAL" },
      linea2: { en: "TOP 10 SHARE IT", es: "SE LO LLEVAN 10", pt: "OS 10 PRIMEIROS" },
      fondo: "#0e3a8c",
      acento: "#ffd35a",
    },
    destino: "/races/weekly",
    orden: 3,
  },
];

async function main() {
  const base = await conectar();
  logger.info(`sembrando extras en "${base}"`);

  /* ── Las promos ─────────────────────────────────────────────── */
  for (const p of PROMOS) {
    await Promotion.findOneAndUpdate(
      { clave: p.clave },
      { $setOnInsert: { ...p, activa: true } },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }
  logger.info(`${PROMOS.length} promos listas`);

  /* ── Los desafíos del día ───────────────────────────────────── */
  const hoy = new Date();
  const desde = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()));
  const hasta = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate() + 1));

  /*
    Tres cajas de precios distintos, para que los desafíos no sean
    todos el mismo. Se eligen por precio y no por nombre: el catálogo
    puede cambiar y esto tiene que seguir andando.
  */
  const baratas = await Box.find({ live: true, priceSc: { $lt: 5 } }).sort({ priceSc: 1 }).limit(1).lean();
  const medias = await Box.find({ live: true, priceSc: { $gte: 5, $lt: 50 } }).sort({ priceSc: 1 }).limit(1).lean();
  const caras = await Box.find({ live: true, priceSc: { $gte: 50 } }).sort({ priceSc: 1 }).limit(1).lean();

  const planes = [
    { caja: baratas[0], multiplicador: 50, premioSc: 25, cupos: 20 },
    { caja: medias[0], multiplicador: 20, premioSc: 50, cupos: 10 },
    { caja: caras[0], multiplicador: 10, premioSc: 150, cupos: 5 },
  ].filter((p) => p.caja);

  for (const plan of planes) {
    await Challenge.findOneAndUpdate(
      { box: plan.caja._id, desde },
      {
        $setOnInsert: {
          box: plan.caja._id,
          boxSlug: plan.caja.slug,
          boxName: plan.caja.name,
          multiplicador: plan.multiplicador,
          premioSc: plan.premioSc,
          cupos: plan.cupos,
          desde,
          hasta,
          activo: true,
        },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }
  logger.info(`${planes.length} desafios para hoy`);

  await mongoose.disconnect();
}

main().catch((e) => {
  logger.error("no se pudo sembrar:", e.message);
  process.exit(1);
});
