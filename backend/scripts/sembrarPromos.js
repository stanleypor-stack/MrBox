/**
 * LAS PROMOCIONES QUE FALTABAN.
 *
 * Habia cuatro cargadas. Faltaban las tres que trajo Dani de
 * BetSweeps y que acá tienen a dónde llevar:
 *
 *   Reyes de socios    la competencia entre afiliados   -> /affiliates
 *   Desafíos del día   los que ya funcionan             -> /challenges
 *   50% de bono        el del primer depósito           -> /?cajon=in
 *
 * Y la de VIP Boost pasa a ser la DESTACADA: la que va ancha arriba.
 *
 * Esto NO es el estado final: es la carga inicial. De acá en adelante
 * las promociones se tocan desde el panel, que es el que puede
 * apagarlas un domingo a la noche sin un despliegue.
 *
 * Se puede correr dos veces: cada una se busca por su clave y se
 * actualiza, no se duplica.
 *
 *   node scripts/sembrarPromos.js
 */
require("dotenv").config();

const mongoose = require("mongoose");
const { conectar, desconectar } = require("../database");
const Promotion = require("../database/models/Promotion");

/*
  Los nueve idiomas. El texto de una promoción lo escribe el panel y
  viaja ya traducido al jugador; lo de acá es la carga de arranque.
*/
const PROMOS = [
  {
    clave: "affiliate-kings",
    orden: 4,
    destino: "/affiliates",
    arte: {
      fondo: "linear-gradient(135deg, #0e2a1c 0%, #136b3f 55%, #1fa05c 100%)",
      acento: "#5dffb0",
      kicker: { en: "$30,000", es: "$30.000", pt: "$30.000", de: "30.000 $", fr: "30 000 $", it: "30.000 $", ru: "$30 000", ja: "$30,000", zh: "$30,000" },
      linea1: { en: "FOR PARTNERS", es: "PARA SOCIOS", pt: "PARA PARCEIROS", de: "FÜR PARTNER", fr: "POUR LES PARTENAIRES", it: "PER I PARTNER", ru: "ДЛЯ ПАРТНЁРОВ", ja: "パートナー向け", zh: "合作伙伴专属" },
      linea2: { en: "Partner kings", es: "Reyes de socios", pt: "Reis dos parceiros", de: "Partnerkönige", fr: "Rois du parrainage", it: "Re dei partner", ru: "Короли партнёров", ja: "パートナー王", zh: "合作之王" },
    },
    titulo: { en: "Partner kings", es: "Reyes de socios", pt: "Reis dos parceiros", de: "Partnerkönige", fr: "Rois du parrainage", it: "Re dei partner", ru: "Короли партнёров", ja: "パートナー王", zh: "合作之王" },
    texto: {
      en: "Compete with the other partners for a share of $30,000. The one who brings the most new players wins.",
      es: "Competí con los demás socios por una parte de $30.000. Gana el que más jugadores nuevos trae.",
      pt: "Compita com os outros parceiros por uma parte de $30.000. Ganha quem traz mais jogadores novos.",
      de: "Tritt gegen die anderen Partner um einen Anteil an 30.000 $ an. Es gewinnt, wer die meisten neuen Spieler bringt.",
      fr: "Affrontez les autres partenaires pour une part de 30 000 $. Le gagnant est celui qui amène le plus de nouveaux joueurs.",
      it: "Sfida gli altri partner per una parte di 30.000 $. Vince chi porta più giocatori nuovi.",
      ru: "Соревнуйтесь с другими партнёрами за долю из $30 000. Побеждает тот, кто приведёт больше новых игроков.",
      ja: "他のパートナーと $30,000 の分け前を競おう。新規プレイヤーを最も多く連れてきた人が勝ち。",
      zh: "与其他合作伙伴争夺 $30,000 奖池。带来最多新玩家的人获胜。",
    },
    boton: { en: "How to join", es: "Cómo entrar", pt: "Como entrar", de: "So machst du mit", fr: "Comment participer", it: "Come partecipare", ru: "Как участвовать", ja: "参加方法", zh: "如何参加" },
  },

  {
    clave: "challenges",
    orden: 5,
    destino: "/challenges",
    arte: {
      fondo: "linear-gradient(135deg, #2b0f3d 0%, #6a2592 50%, #a13bc9 100%)",
      acento: "#5dffb0",
      kicker: { en: "CHALLENGES", es: "DESAFÍOS", pt: "DESAFIOS", de: "CHALLENGES", fr: "DÉFIS", it: "SFIDE", ru: "ЗАДАНИЯ", ja: "チャレンジ", zh: "挑战" },
      linea1: { en: "LIMITED SPOTS", es: "CUPOS LIMITADOS", pt: "VAGAS LIMITADAS", de: "BEGRENZTE PLÄTZE", fr: "PLACES LIMITÉES", it: "POSTI LIMITATI", ru: "МЕСТ МАЛО", ja: "枠に限りあり", zh: "名额有限" },
      linea2: { en: "First come, first served", es: "Se los llevan los primeros", pt: "Os primeiros levam", de: "Die Ersten holen sie", fr: "Les premiers servis", it: "Se li prendono i primi", ru: "Достаются первым", ja: "早い者勝ち", zh: "先到先得" },
    },
    titulo: { en: "Challenges of the day", es: "Desafíos del día", pt: "Desafios do dia", de: "Challenges des Tages", fr: "Défis du jour", it: "Sfide del giorno", ru: "Задания дня", ja: "今日のチャレンジ", zh: "今日挑战" },
    texto: {
      en: "Unbox the item the challenge asks for and you get paid on the spot. Spots are limited: the first ones take them.",
      es: "Sacá el objeto que pide el desafío y cobrás al instante. Los cupos son limitados: se los llevan los primeros.",
      pt: "Tire o item que o desafio pede e receba na hora. As vagas são limitadas: os primeiros levam.",
      de: "Zieh den Gegenstand, den die Challenge verlangt, und du wirst sofort ausgezahlt. Die Plätze sind begrenzt: die Ersten holen sie.",
      fr: "Sortez l'objet demandé par le défi et vous êtes payé sur-le-champ. Les places sont limitées : les premiers servis.",
      it: "Tira fuori l'oggetto che chiede la sfida e vieni pagato subito. I posti sono limitati: se li prendono i primi.",
      ru: "Выбейте предмет, который требует задание, и получите выплату сразу. Мест мало: достаются первым.",
      ja: "チャレンジが指定するアイテムを引けば、その場で報酬がもらえる。枠には限りがあり、早い者勝ち。",
      zh: "开出挑战指定的物品，立即获得奖励。名额有限，先到先得。",
    },
    boton: { en: "See the challenges", es: "Ver los desafíos", pt: "Ver os desafios", de: "Challenges ansehen", fr: "Voir les défis", it: "Vedi le sfide", ru: "Смотреть задания", ja: "チャレンジを見る", zh: "查看挑战" },
  },

  {
    clave: "welcome-bonus",
    orden: 6,
    /* Abre el cajón de depósito: ver `App.vue`. */
    destino: "/?cajon=in",
    arte: {
      fondo: "linear-gradient(135deg, #0a2233 0%, #0f6b7a 50%, #17b3c4 100%)",
      acento: "#ffc83d",
      kicker: { en: "50% BONUS", es: "50% DE BONO", pt: "50% DE BÔNUS", de: "50% BONUS", fr: "50% DE BONUS", it: "50% DI BONUS", ru: "БОНУС 50%", ja: "50% ボーナス", zh: "50% 奖励" },
      linea1: { en: "FIRST DEPOSIT", es: "PRIMER DEPÓSITO", pt: "PRIMEIRO DEPÓSITO", de: "ERSTE EINZAHLUNG", fr: "PREMIER DÉPÔT", it: "PRIMO DEPOSITO", ru: "ПЕРВОЕ ПОПОЛНЕНИЕ", ja: "初回入金", zh: "首次充值" },
      linea2: { en: "Up to SC 300", es: "Hasta SC 300", pt: "Até SC 300", de: "Bis zu SC 300", fr: "Jusqu'à SC 300", it: "Fino a SC 300", ru: "До SC 300", ja: "最大 SC 300", zh: "最高 SC 300" },
    },
    titulo: { en: "50% on your first deposit", es: "50% en tu primer depósito", pt: "50% no seu primeiro depósito", de: "50% auf deine erste Einzahlung", fr: "50% sur ton premier dépôt", it: "50% sul tuo primo deposito", ru: "50% на первое пополнение", ja: "初回入金に 50%", zh: "首次充值 50%" },
    texto: {
      en: "Deposit and we add half on top, up to SC 300. It applies on its own, once, on the account's first deposit.",
      es: "Depositás y te sumamos la mitad, hasta SC 300. Se aplica solo, una vez, en el primer depósito de la cuenta.",
      pt: "Deposite e somamos a metade, até SC 300. Entra sozinho, uma vez, no primeiro depósito da conta.",
      de: "Zahl ein und wir legen die Hälfte drauf, bis zu SC 300. Wird automatisch gutgeschrieben, einmal, bei der ersten Einzahlung.",
      fr: "Déposez et on ajoute la moitié, jusqu'à SC 300. Appliqué automatiquement, une fois, au premier dépôt du compte.",
      it: "Deposita e aggiungiamo la metà, fino a SC 300. Si applica da solo, una volta, al primo deposito dell'account.",
      ru: "Пополните — и мы добавим половину сверху, до SC 300. Начисляется автоматически, один раз, при первом пополнении.",
      ja: "入金すると半分を上乗せ、最大 SC 300。アカウントの初回入金に一度だけ、自動で適用されます。",
      zh: "充值后我们再加一半，最高 SC 300。首次充值时自动发放，仅限一次。",
    },
    boton: { en: "Deposit", es: "Depositar", pt: "Depositar", de: "Einzahlen", fr: "Déposer", it: "Deposita", ru: "Пополнить", ja: "入金する", zh: "去充值" },
  },
];

(async () => {
  await conectar();

  for (const p of PROMOS) {
    /* Por clave: correr esto dos veces actualiza, no duplica. */
    await Promotion.findOneAndUpdate(
      { clave: p.clave },
      { $set: { ...p, activa: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`  ${p.clave.padEnd(18)} -> ${p.destino}`);
  }

  /* La de VIP Boost va ancha arriba. Una sola destacada. */
  await Promotion.updateMany({}, { $set: { destacada: false } });
  const ancha = await Promotion.findOneAndUpdate(
    { clave: "vip-boost" },
    { $set: { destacada: true } },
    { new: true }
  );
  console.log(`\n  destacada: ${ancha ? ancha.clave : "(no existe vip-boost)"}`);

  const total = await Promotion.countDocuments({ activa: true });
  console.log(`\npromociones al aire: ${total}`);

  await desconectar();
  await mongoose.disconnect().catch(() => {});
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
