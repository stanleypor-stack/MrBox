/**
 * ABRIR UNA CAJA.
 *
 * El centro del sitio. Todo lo demás existe para que esto pase.
 *
 * EL ORDEN IMPORTA, Y ES ESTE
 *
 *   1. mirar que la caja exista y esté al aire
 *   2. conseguir la semilla del jugador
 *   3. COBRAR (atómico, con la condición de saldo adentro)
 *   4. recién ahí sortear
 *   5. guardar el objeto en el inventario
 *   6. anotar el recibo de la apertura
 *   7. contarle al socio su comisión
 *
 * El 3 va ANTES del 4 a propósito. Si se sorteara primero y después se
 * cobrara, entre las dos cosas el jugador sabe lo que le salió: un
 * pedido cancelado justo ahí sería una apertura gratis con premio. Y si
 * el cobro falla, hay que tirar un sorteo ya hecho, que es exactamente
 * el momento donde alguien puede quedarse con un premio sin pagarlo.
 *
 * Cobrando primero, lo peor que puede pasar es que alguien pague y algo
 * explote antes de entregarle el objeto. Eso deja rastro en el libro,
 * se ve, y se arregla. Lo otro no deja rastro de nada.
 */

const Box = require("../../database/models/Box");
const BoxOpen = require("../../database/models/BoxOpen");
const InventoryItem = require("../../database/models/InventoryItem");
const UserSeed = require("../../database/models/UserSeed");
const User = require("../../database/models/User");
const Settings = require("../../database/models/Settings");

const fair = require("./fair");
const eco = require("./economia");
const wallet = require("../wallet");
const afiliados = require("../affiliates");
const comunidad = require("../community");
const controles = require("../controls");
const { sc } = require("../../utils/money");
const { errorDe } = require("../../utils/errors");
const { logger } = require("../../utils/logger");

/** La caja, con todo lo que hace falta para abrirla. */
async function cajaPorSlug(slug) {
  const caja = await Box.findOne({ slug: String(slug || "").toLowerCase() }).lean();
  if (!caja) throw errorDe("BOX_NOT_FOUND", {}, 404);
  if (!caja.prizes || !caja.prizes.length) throw errorDe("BOX_HAS_NO_PRIZES");
  return caja;
}

/**
 * La tanda de semillas activa del jugador.
 *
 * Si no tiene, se le crea una. Pasa con cuentas viejas o creadas a mano;
 * no es motivo para no dejarlo jugar.
 */
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

/**
 * Una apertura.
 *
 * @param {object} o
 * @param {object} o.user      el jugador, ya cargado
 * @param {string} o.slug      qué caja
 * @param {number} [o.veces]   cuántas de una (x1 a x4)
 * @param {boolean} [o.demo]   de prueba: no cobra, no paga, no guarda
 */
async function abrir({ user, slug, veces = 1, demo = false }) {
  const cfg = await Settings.leer();
  const caja = await cajaPorSlug(slug);

  if (!demo && !caja.live) throw errorDe("BOX_NOT_LIVE");

  const cuantas = Math.max(1, Math.min(Number(veces) || 1, cfg.cajasALaVez || 4));
  if (Number(veces) > (cfg.cajasALaVez || 4)) {
    throw errorDe("TOO_MANY_AT_ONCE", { maximo: cfg.cajasALaVez || 4 });
  }

  /* ── La de demostración: se sortea igual, pero no existe ─────────── */
  if (demo) {
    const resultados = [];
    for (let i = 0; i < cuantas; i += 1) {
      const semilla = fair.semillaNueva();
      const { premio, numero, hmac } = fair.sortear({
        semillaServidor: semilla,
        semillaCliente: "demo",
        nonce: i,
        premios: caja.prizes,
      });
      resultados.push({
        premio: { name: premio.name, valueSc: sc(premio.valueSc), rarity: premio.rarity, imageUrl: premio.imageUrl },
        numero, hmac, demo: true,
      });
    }
    return { demo: true, caja: resumenDeCaja(caja), resultados, priceSc: 0 };
  }

  /* ── La de verdad ────────────────────────────────────────────────── */

  const precioUnitario = sc(caja.priceSc);

  /*
    LOS LIMITES QUE SE PUSO EL JUGADOR, ANTES DE COBRAR.

    Se miran por la tanda entera y no apertura por apertura: pedir x4
    con el tope a dos aperturas de distancia tiene que rebotar entero,
    no cobrar dos y fallar en la tercera dejando media tanda hecha.
  */
  await controles.revisarAntesDeJugar({
    userId: user._id,
    montoSc: sc(precioUnitario * cuantas),
  });

  const tanda = await semillaDe(user._id);
  if (!tanda) throw errorDe("NO_SEED");

  const resultados = [];

  /*
    Se abren de a una, en serie, y no todas juntas. Cada apertura usa el
    nonce siguiente, así que tienen que ir una atrás de otra: en
    paralelo, dos podrían tomar el mismo nonce y dar el mismo resultado
    con la misma prueba, que es justo lo que el sorteo verificable tiene
    que hacer imposible.
  */
  for (let i = 0; i < cuantas; i += 1) {
    /* ¿Le queda alguna gratis? Se gastan antes que el saldo. */
    const gratis = await gastarAperturaGratis(user._id);
    const precio = gratis ? 0 : precioUnitario;

    if (!gratis) {
      await wallet.mover({
        userId: user._id,
        amountSc: -precio,
        type: "box_open",
        juegaSc: precio,
        reference: { kind: "box", id: caja._id, label: caja.name },
      });
    }

    /*
      EL NONCE SE RESERVA ANTES DE SORTEAR.

      Con un `$inc` atómico que devuelve el valor nuevo. Leerlo, sortear
      y después guardarlo dejaría que dos aperturas al mismo tiempo
      tomaran el mismo número.
    */
    const movida = await UserSeed.findOneAndUpdate(
      { _id: tanda._id },
      { $inc: { nonce: 1 } },
      { new: true }
    ).select("+semillaServidor").lean();

    const nonce = movida.nonce;

    const { premio, indice, numero, hmac } = fair.sortear({
      semillaServidor: movida.semillaServidor,
      semillaCliente: movida.semillaCliente,
      nonce,
      premios: caja.prizes,
    });

    /* El objeto, con su valor congelado al día de hoy. */
    const guardado = await InventoryItem.create({
      user: user._id,
      item: premio.item,
      name: premio.name,
      imageUrl: premio.imageUrl,
      rarity: premio.rarity,
      valueSc: sc(premio.valueSc),
      state: "held",
      source: { kind: "box", box: caja._id },
    });

    const recibo = await BoxOpen.create({
      user: user._id,
      box: caja._id,
      boxSlug: caja.slug,
      boxName: caja.name,
      priceSc: precio,
      conAperturaGratis: gratis,
      semillaServidorHash: movida.semillaServidorHash,
      semillaCliente: movida.semillaCliente,
      nonce,
      hmac,
      numero,
      /* La caja COMO ESTABA. Sin esto, editar la caja rompe la
         verificación de todo lo que se abrió antes. */
      premios: caja.prizes.map((p) => ({
        name: p.name, valueSc: p.valueSc, chance: p.chance, rarity: p.rarity,
      })),
      indicePremio: indice,
      premio: { name: premio.name, valueSc: sc(premio.valueSc), chance: premio.chance, rarity: premio.rarity },
      inventoryItem: guardado._id,
    });

    await InventoryItem.updateOne({ _id: guardado._id }, { $set: { "source.boxOpen": recibo._id } });

    /*
      LA COMISION DEL SOCIO.

      El margen de ESTA apertura: lo que entró menos lo que salió en
      premio. Puede ser negativo --se llevó algo más caro que la caja--
      y ahí el socio cobra cero, no negativo.

      Va en su propio try: que falle anotarle la comisión a un socio no
      puede tumbar la apertura de un jugador que ya pagó.
    */
    const margen = sc(precio - sc(premio.valueSc));

    try {
      await afiliados.anotarComision({ jugador: user, jugadoSc: precio, margenSc: margen });
    } catch (err) {
      logger.error(`[boxes] comision del socio: ${err.message}`);
    }

    /*
      LA PARTE DEL CREADOR, SI LA CAJA ES DE LA COMUNIDAD.

      La mitad del margen de ESTA apertura. Igual que la comisión del
      socio: en su propio try, porque que falle pagarle al creador no
      puede tumbar la apertura de alguien que ya pagó.

      Y no se le paga por abrir su propia caja: si no, armar una cara y
      abrirla uno mismo devolvería el 96% en vez del 92%, que es una
      forma lenta pero segura de sacarle plata a la casa.
    */
    if (caja.creator && String(caja.creator) !== String(user._id)) {
      try {
        await comunidad.pagarAlCreador({ caja, margenSc: margen });
      } catch (err) {
        logger.error(`[boxes] parte del creador: ${err.message}`);
      }
    }

    resultados.push({
      premio: {
        _id: guardado._id,
        item: premio.item,
        name: premio.name,
        valueSc: sc(premio.valueSc),
        rarity: premio.rarity,
        imageUrl: premio.imageUrl,
      },
      precioSc: precio,
      conAperturaGratis: gratis,
      nonce,
      numero,
      hmac,
      boxOpenId: recibo._id,
    });
  }

  await Box.updateOne({ _id: caja._id }, { $inc: { opens: cuantas } });

  const saldo = await wallet.saldoDe(user._id);
  const despues = await User.findById(user._id).select("freeOpens").lean();

  return {
    demo: false,
    caja: resumenDeCaja(caja),
    resultados,
    gastadoSc: sc(resultados.reduce((a, r) => a + r.precioSc, 0)),
    ganadoSc: sc(resultados.reduce((a, r) => a + r.premio.valueSc, 0)),
    ...saldo,
    freeOpens: despues ? despues.freeOpens : 0,
  };
}

/**
 * Gasta una apertura gratis si le queda.
 *
 * La condición `$gt: 0` va en el filtro: si no, dos aperturas al mismo
 * tiempo con una sola gratis disponible se la gastarían las dos y el
 * contador quedaría en -1.
 */
async function gastarAperturaGratis(userId) {
  const r = await User.findOneAndUpdate(
    { _id: userId, freeOpens: { $gt: 0 } },
    { $inc: { freeOpens: -1 } },
    { new: true }
  ).select("freeOpens").lean();
  return !!r;
}

/** Lo que se muestra de una caja, sin lo que no hace falta. */
function resumenDeCaja(caja) {
  return {
    _id: caja._id,
    slug: caja.slug,
    name: caja.name,
    category: caja.category,
    imageUrl: caja.imageUrl,
    priceSc: sc(caja.priceSc),
    retorno: caja.retorno,
    featured: caja.featured,
    markedNew: caja.markedNew,
    opens: caja.opens,

    /* El medidor de la grilla: cuán impredecible es, no cuán cara. Se
       calcula de la tabla de premios en cada lectura y no se guarda,
       así una caja editada nunca muestra el riesgo de la de ayer. */
    riesgo: eco.riesgoDe(caja.prizes, caja.priceSc),
    nivelDeRiesgo: eco.nivelDeRiesgo(eco.riesgoDe(caja.prizes, caja.priceSc)),

    cuantosObjetos: (caja.prizes || []).length,
    prizes: (caja.prizes || []).map((p) => ({
      item: p.item,
      name: p.name,
      valueSc: sc(p.valueSc),
      chance: p.chance,
      rarity: p.rarity,
      imageUrl: p.imageUrl,
    })),
  };
}

/**
 * VENDER UN OBJETO.
 *
 * Le devuelve SC por lo que vale --el 100%, según Settings-- y lo marca
 * vendido. No se puede deshacer: la plata ya está en el saldo.
 */
async function vender({ user, inventoryItemId }) {
  const cfg = await Settings.leer();

  /*
    La condición de estado va EN EL FILTRO. Dos pedidos de venta al
    mismo tiempo sobre el mismo objeto: el primero lo marca, el segundo
    no lo encuentra. Mirando el estado en JavaScript, los dos lo verían
    `held` y se pagaría dos veces por un objeto que existe una.
  */
  const objeto = await InventoryItem.findOneAndUpdate(
    { _id: inventoryItemId, user: user._id, state: "held" },
    { $set: { state: "sold", soldAt: new Date() } },
    { new: false }
  ).lean();

  if (!objeto) {
    const existe = await InventoryItem.findOne({ _id: inventoryItemId, user: user._id }).lean();
    if (!existe) throw errorDe("ITEM_NOT_FOUND", {}, 404);
    throw errorDe("ITEM_ALREADY_GONE", { estado: existe.state });
  }

  const pago = sc(objeto.valueSc * (cfg.tasaDeRecompra ?? 1));

  try {
    await wallet.mover({
      userId: user._id,
      amountSc: pago,
      type: "item_sold",
      reference: { kind: "inventoryItem", id: objeto._id, label: objeto.name },
    });
  } catch (err) {
    /* No se le pudo pagar: el objeto vuelve al inventario. Dejarlo
       vendido y sin pagar sería robarle. */
    await InventoryItem.updateOne(
      { _id: objeto._id },
      { $set: { state: "held" }, $unset: { soldAt: 1 } }
    );
    throw err;
  }

  await InventoryItem.updateOne({ _id: objeto._id }, { $set: { soldFor: pago } });

  return { vendidoSc: pago, item: { _id: objeto._id, name: objeto.name }, ...(await wallet.saldoDe(user._id)) };
}

/**
 * VERIFICAR UNA APERTURA.
 *
 * Rehace el sorteo con los datos guardados. Solo sirve una vez revelada
 * la semilla del servidor, o sea después de que el jugador rotó la suya:
 * mostrarla antes le dejaría calcular lo que va a salir.
 */
async function verificar({ user, boxOpenId }) {
  const recibo = await BoxOpen.findOne({ _id: boxOpenId, user: user._id })
    .select("+semillaServidor")
    .lean();
  if (!recibo) throw errorDe("ITEM_NOT_FOUND", {}, 404);

  const tanda = await UserSeed.findOne({
    user: user._id,
    semillaServidorHash: recibo.semillaServidorHash,
  }).select("+semillaServidor").lean();

  const revelada = tanda && tanda.reveladaEn ? tanda.semillaServidor : null;

  if (!revelada) {
    return {
      verificable: false,
      motivo: "LA_SEMILLA_SIGUE_TAPADA",
      semillaServidorHash: recibo.semillaServidorHash,
      semillaCliente: recibo.semillaCliente,
      nonce: recibo.nonce,
      hmac: recibo.hmac,
      numero: recibo.numero,
      premio: recibo.premio,
      premios: recibo.premios,
    };
  }

  const r = fair.verificarApertura({
    semillaServidor: revelada,
    semillaCliente: recibo.semillaCliente,
    nonce: recibo.nonce,
    premios: recibo.premios,
    premioEsperado: recibo.premio.name,
  });

  return {
    verificable: true,
    coincide: r.coincide,
    semillaServidor: revelada,
    semillaServidorHash: recibo.semillaServidorHash,
    semillaCliente: recibo.semillaCliente,
    nonce: recibo.nonce,
    hmac: r.hmac,
    numero: r.numero,
    premio: recibo.premio,
    premios: recibo.premios,
  };
}

/**
 * ROTAR LA SEMILLA.
 *
 * Cierra la tanda, revela la semilla vieja y abre una nueva con el
 * contador en cero. A partir de acá, todo lo que se abrió con la vieja
 * se puede verificar.
 */
async function rotarSemilla({ user, semillaCliente }) {
  const vieja = await UserSeed.findOne({ user: user._id, activa: true });

  const nueva = fair.semillaNueva();
  const creada = await UserSeed.create({
    user: user._id,
    semillaServidor: nueva,
    semillaServidorHash: fair.hashDeSemilla(nueva),
    semillaCliente: String(semillaCliente || "").trim().slice(0, 64) || fair.semillaNueva().slice(0, 16),
    nonce: 0,
    activa: false, // se enciende recién cuando la vieja se apagó
  });

  if (vieja) {
    await UserSeed.updateOne(
      { _id: vieja._id },
      { $set: { activa: false, reveladaEn: new Date() } }
    );
  }
  await UserSeed.updateOne({ _id: creada._id }, { $set: { activa: true } });

  const activa = await UserSeed.findById(creada._id).lean();

  return {
    nueva: {
      semillaServidorHash: activa.semillaServidorHash,
      semillaCliente: activa.semillaCliente,
      nonce: activa.nonce,
    },
    revelada: vieja
      ? { semillaServidorHash: vieja.semillaServidorHash, aperturas: vieja.nonce }
      : null,
  };
}

module.exports = {
  abrir,
  vender,
  verificar,
  rotarSemilla,
  semillaDe,
  cajaPorSlug,
  resumenDeCaja,
  economia: eco,
};
