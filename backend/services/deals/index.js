/**
 * DEALS: LA RULETA DE UN SOLO OBJETO.
 *
 * El otro juego del sitio. En una caja el jugador elige la caja y la caja
 * elige el premio; en Deals el jugador elige el PREMIO y después elige
 * cuánta chance quiere de llevárselo.
 *
 * LA CUENTA, QUE ES UNA SOLA
 *
 *     apuesta = valor del objeto × chance ÷ 0,92
 *
 * Es la misma ecuación que el precio de una caja, despejada al revés.
 * Una caja promete devolver 92 de cada 100 que entran; un deal promete
 * lo mismo. Si el objeto vale SC 1.000 y el jugador pide 10% de chance,
 * el premio esperado es SC 100, así que el tiro tiene que costar
 * SC 108,70 para que a la casa le queden sus ocho.
 *
 * LA CHANCE MANDA, LA APUESTA SALE DE AHI
 *
 * El jugador mueve la chance y el precio se acomoda. Podría ser al
 * revés, pero entonces el redondeo del precio movería la chance, y una
 * chance que dice 10,00% y por dentro es 9,97% es exactamente la clase
 * de cosa por la que un sitio de estos pierde la confianza del jugador.
 *
 * Redondeando el precio PARA ARRIBA, la chance que se muestra es la
 * chance exacta que se juega, y el medio centavo de redondeo queda del
 * lado de la casa, igual que en las cajas.
 *
 * EL ORDEN ES EL MISMO QUE EN LAS CAJAS
 *
 * Cobrar primero, sortear después. Las razones están escritas enteras
 * arriba de `boxes.abrir()` y valen igual acá.
 */

const Item = require("../../database/models/Item");
const Deal = require("../../database/models/Deal");
const InventoryItem = require("../../database/models/InventoryItem");
const UserSeed = require("../../database/models/UserSeed");
const Settings = require("../../database/models/Settings");

const fair = require("../boxes/fair");
const { RETORNO_OBJETIVO } = require("../boxes/economia");
const wallet = require("../wallet");
const afiliados = require("../affiliates");
const controles = require("../controls");
const { sc } = require("../../utils/money");
const { errorDe } = require("../../utils/errors");
const { logger } = require("../../utils/logger");

/*
  LOS LIMITES DE LA CHANCE.

  Abajo, 1%: más fino que eso el precio del tiro se vuelve centavos y el
  juego deja de tener sentido para nadie.

  Arriba, 80%: no es una restricción contra el jugador, es la que lo
  protege. A 95% de chance un objeto de SC 1.000 cuesta SC 1.032, y el
  5% de las veces que pierde se lleva un golpe de mil dólares por un
  objeto que podría haber comprado. El tope deja el peor caso donde se
  puede mirar.
*/
const CHANCE_MIN = 0.01;
const CHANCE_MAX = 0.8;

/*
  LA APUESTA MINIMA, Y POR QUE EXISTE.

  El precio del tiro se redondea al centavo para arriba. Sobre SC 100
  ese medio centavo no se ve; sobre SC 0,09 es el 11% del tiro, y ahí el
  juego deja de devolver 92 para devolver 87 sin que nadie lo haya
  decidido.

  Con un piso de SC 0,50, el redondeo nunca se come más de un centavo de
  cincuenta: el retorno real queda entre 90,2% y 92% para cualquier
  objeto y cualquier chance. Eso sí es mirable.

  Esto NO se arregla subiendo el piso de la chance: un objeto caro al 1%
  ya cuesta de sobra, y uno barato al 80% sigue siendo barato. Lo que
  manda es lo que sale de la cuenta, no la chance.
*/
const APUESTA_MINIMA = 0.5;

/*
  Y por lo mismo, un valor mínimo para el objeto: por debajo de esto ni
  siquiera la chance máxima llega a la apuesta mínima.

  De paso saca del juego al maní y al pañuelo de papel, que están en el
  catálogo como premio de consuelo de una caja y que nadie en su sano
  juicio elegiría acá.
*/
const VALOR_MINIMO = Math.ceil(((APUESTA_MINIMA * RETORNO_OBJETIVO) / CHANCE_MAX) * 100) / 100;

/** Cuántos tiros se pueden pedir de una. */
const MAXIMO_DE_TIROS = 4;

/**
 * La chance más chica que se puede pedir con este objeto.
 *
 * La que hace que el tiro llegue a la apuesta mínima. Para un objeto
 * caro es el 1% de siempre; para uno de SC 7,81 es casi el 6%.
 */
function chanceMinimaDe(valorSc) {
  const valor = Number(valorSc) || 0;
  if (valor <= 0) return CHANCE_MAX;
  const necesaria = (APUESTA_MINIMA * RETORNO_OBJETIVO) / valor;
  return Math.min(CHANCE_MAX, Math.max(CHANCE_MIN, Math.ceil(necesaria * 10000) / 10000));
}

/**
 * Lo que cuesta un tiro.
 *
 * Para arriba, al centavo. Ese medio centavo es de la casa; es la misma
 * decisión que toma `precioDe` con las cajas, por las mismas razones.
 */
function apuestaDe(valorSc, chance) {
  const bruto = (Number(valorSc) || 0) * (Number(chance) || 0);
  return Math.ceil((bruto / RETORNO_OBJETIVO) * 100) / 100;
}

/**
 * La chance que sale de una apuesta.
 *
 * El camino de vuelta, para el botón "Max" y para cuando el jugador
 * escribe el precio en vez de mover la barra. Lo que se juega sigue
 * siendo la chance: esto solo la propone.
 */
function chanceDe(valorSc, apuestaSc) {
  const valor = Number(valorSc) || 0;
  if (valor <= 0) return 0;
  const cruda = ((Number(apuestaSc) || 0) * RETORNO_OBJETIVO) / valor;
  return Math.min(CHANCE_MAX, Math.max(chanceMinimaDe(valor), Math.round(cruda * 10000) / 10000));
}

/** Deja la chance adentro de los límites y con cuatro decimales. */
function limpiarChance(valor, valorSc) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) throw errorDe("INVALID_AMOUNT", { campo: "chance" });
  const redondeada = Math.round(n * 10000) / 10000;
  const piso = chanceMinimaDe(valorSc);
  if (redondeada < piso) {
    throw errorDe("BELOW_MINIMUM", { minimo: Math.round(piso * 10000) / 100, apuestaMinimaSc: APUESTA_MINIMA });
  }
  if (redondeada > CHANCE_MAX) throw errorDe("ABOVE_MAXIMUM", { maximo: CHANCE_MAX * 100 });
  return redondeada;
}

/** La tanda de semillas activa, creándola si hiciera falta. */
async function semillaDe(userId) {
  let tanda = await UserSeed.findOne({ user: userId, activa: true }).select("+semillaServidor");
  if (tanda) return tanda;

  const semilla = fair.semillaNueva();
  tanda = await UserSeed.create({
    user: userId,
    semillaServidor: semilla,
    semillaServidorHash: fair.hashDeSemilla(semilla),
    semillaCliente: fair.semillaNueva().slice(0, 16),
    nonce: 0,
    activa: true,
  });
  return UserSeed.findById(tanda._id).select("+semillaServidor");
}

/** El objeto, mirado de verdad y no como lo mandó la pantalla. */
async function objetoPara(itemId) {
  const objeto = await Item.findById(itemId).lean();
  if (!objeto) throw errorDe("ITEM_NOT_FOUND", {}, 404);
  if (!objeto.active) throw errorDe("ITEM_NOT_FOUND", {}, 404);
  if (!(objeto.valueSc > 0)) throw errorDe("ITEM_NOT_FOUND", {}, 404);
  /* Demasiado barato para que la apuesta mínima tenga sentido. */
  if (objeto.valueSc < VALOR_MINIMO) throw errorDe("ITEM_NOT_FOUND", {}, 404);
  return objeto;
}

/**
 * Un deal.
 *
 * @param {object}  o
 * @param {object}  o.user      el jugador, ya cargado
 * @param {string}  o.itemId    qué objeto quiere
 * @param {number}  o.chance    entre 0,01 y 0,80
 * @param {number}  [o.veces]   cuántos tiros de una
 * @param {boolean} [o.demo]    de prueba: no cobra, no paga, no guarda
 */
async function jugar({ user, itemId, chance, veces = 1, demo = false }) {
  const cfg = await Settings.leer();
  const objeto = await objetoPara(itemId);
  const laChance = limpiarChance(chance, objeto.valueSc);

  const tope = Math.min(MAXIMO_DE_TIROS, cfg.cajasALaVez || MAXIMO_DE_TIROS);
  if (Number(veces) > tope) throw errorDe("TOO_MANY_AT_ONCE", { maximo: tope });
  /* Para abajo y entero: con 2,5 tiraba tres veces, informaba el
     precio de dos y medio y cobraba el de tres. */
  const cuantos = Math.max(1, Math.min(Math.floor(Number(veces) || 1), tope));

  const valorSc = sc(objeto.valueSc);
  const apuestaSc = apuestaDe(valorSc, laChance);

  const resumenDelObjeto = {
    _id: objeto._id,
    name: objeto.name,
    valueSc: valorSc,
    rarity: objeto.rarity,
    imageUrl: objeto.imageUrl,
    shippable: objeto.shippable,
  };

  /* ── El de prueba: se sortea igual, pero no existe ───────────────── */
  if (demo) {
    const tiros = [];
    for (let i = 0; i < cuantos; i += 1) {
      const semilla = fair.semillaNueva();
      const hmac = fair.calcularHmac(semilla, "demo", i);
      const numero = fair.hmacANumero(hmac);
      tiros.push({ gano: numero < laChance, numero, hmac, demo: true });
    }
    return {
      demo: true,
      objeto: resumenDelObjeto,
      chance: laChance,
      apuestaSc: 0,
      tiros,
    };
  }

  /* ── El de verdad ────────────────────────────────────────────────── */

  /* Los límites del jugador, por la tanda entera y antes de cobrar. */
  await controles.revisarAntesDeJugar({ userId: user._id, montoSc: sc(apuestaSc * cuantos) });

  const tanda = await semillaDe(user._id);
  if (!tanda) throw errorDe("NO_SEED");

  const tiros = [];

  /*
    De a uno y en serie, por el nonce: dos tiros en paralelo podrían
    tomar el mismo número y dar el mismo resultado con la misma prueba.
  */
  for (let i = 0; i < cuantos; i += 1) {
    await wallet.mover({
      userId: user._id,
      amountSc: -apuestaSc,
      type: "deal",
      juegaSc: apuestaSc,
      reference: { kind: "item", id: objeto._id, label: objeto.name },
    });

    const movida = await UserSeed.findOneAndUpdate(
      { _id: tanda._id },
      { $inc: { nonce: 1 } },
      { new: true }
    ).select("+semillaServidor").lean();

    const nonce = movida.nonce;
    const hmac = fair.calcularHmac(movida.semillaServidor, movida.semillaCliente, nonce);
    const numero = fair.hmacANumero(hmac);

    /*
      `<` y no `<=`, a propósito. El número vive en [0, 1), así que con
      `<` la franja que gana mide exactamente la chance pedida. Con `<=`
      mediría un pelo más, lo cual sería a favor del jugador pero
      rompería la cuenta del 92%: la verificación de afuera daría otra
      cosa que la nuestra, y una prueba que no cierra no prueba nada.
    */
    const gano = numero < laChance;

    let guardado = null;
    if (gano) {
      guardado = await InventoryItem.create({
        user: user._id,
        item: objeto._id,
        name: objeto.name,
        imageUrl: objeto.imageUrl,
        rarity: objeto.rarity,
        valueSc: valorSc,
        state: "held",
        source: { kind: "deal" },
      });
    }

    const recibo = await Deal.create({
      user: user._id,
      item: objeto._id,
      itemName: objeto.name,
      imageUrl: objeto.imageUrl,
      rarity: objeto.rarity,
      valueSc: valorSc,
      chance: laChance,
      stakeSc: apuestaSc,
      gano,
      semillaServidorHash: movida.semillaServidorHash,
      semillaCliente: movida.semillaCliente,
      nonce,
      hmac,
      numero,
      inventoryItem: guardado ? guardado._id : null,
    });

    if (guardado) {
      await InventoryItem.updateOne({ _id: guardado._id }, { $set: { "source.deal": recibo._id } });
    }

    /* La comisión del socio, sobre el margen de ESTE tiro. En su propio
       try: que falle no puede tumbar un tiro ya cobrado. */
    try {
      await afiliados.anotarComision({
        jugador: user,
        jugadoSc: apuestaSc,
        margenSc: sc(apuestaSc - (gano ? valorSc : 0)),
      });
    } catch (err) {
      logger.error(`[deals] comision del socio: ${err.message}`);
    }

    tiros.push({
      gano,
      numero,
      hmac,
      nonce,
      dealId: recibo._id,
      premio: gano
        ? {
          _id: guardado._id,
          item: objeto._id,
          name: objeto.name,
          valueSc: valorSc,
          rarity: objeto.rarity,
          imageUrl: objeto.imageUrl,
        }
        : null,
    });
  }

  const saldo = await wallet.saldoDe(user._id);

  return {
    demo: false,
    objeto: resumenDelObjeto,
    chance: laChance,
    apuestaSc,
    tiros,
    gastadoSc: sc(apuestaSc * cuantos),
    ganadoSc: sc(tiros.filter((t) => t.gano).length * valorSc),
    ...saldo,
  };
}

/**
 * Rehacer la cuenta de un tiro ya jugado.
 *
 * Solo se puede sobre una semilla ya retirada: mientras la tanda sigue
 * activa, la semilla del servidor es secreta. Es la misma regla que en
 * las cajas.
 */
async function verificar({ dealId, userId }) {
  /* Por dueño, no solo por id: el recibo trae la apuesta. */
  const filtro = userId ? { _id: dealId, user: userId } : { _id: dealId };
  const recibo = await Deal.findOne(filtro).lean();
  if (!recibo) throw errorDe("ITEM_NOT_FOUND", {}, 404);

  const tanda = await UserSeed.findOne({
    user: recibo.user,
    semillaServidorHash: recibo.semillaServidorHash,
  }).select("+semillaServidor").lean();

  if (!tanda || tanda.activa) {
    return { sePuede: false, motivo: "SEED_STILL_ACTIVE", recibo: sinSecretos(recibo) };
  }

  const hmac = fair.calcularHmac(tanda.semillaServidor, recibo.semillaCliente, recibo.nonce);
  const numero = fair.hmacANumero(hmac);

  return {
    sePuede: true,
    semillaServidor: tanda.semillaServidor,
    hashCalculado: fair.hashDeSemilla(tanda.semillaServidor),
    hmacCalculado: hmac,
    numeroCalculado: numero,
    ganoSegunLaCuenta: numero < recibo.chance,
    coincide: hmac === recibo.hmac && (numero < recibo.chance) === recibo.gano,
    recibo: sinSecretos(recibo),
  };
}

function sinSecretos(recibo) {
  return {
    _id: recibo._id,
    itemName: recibo.itemName,
    valueSc: sc(recibo.valueSc),
    chance: recibo.chance,
    stakeSc: sc(recibo.stakeSc),
    gano: recibo.gano,
    semillaServidorHash: recibo.semillaServidorHash,
    semillaCliente: recibo.semillaCliente,
    nonce: recibo.nonce,
    hmac: recibo.hmac,
    numero: recibo.numero,
    createdAt: recibo.createdAt,
  };
}

module.exports = {
  jugar,
  verificar,
  apuestaDe,
  chanceDe,
  chanceMinimaDe,
  CHANCE_MIN,
  CHANCE_MAX,
  APUESTA_MINIMA,
  VALOR_MINIMO,
  MAXIMO_DE_TIROS,
};
