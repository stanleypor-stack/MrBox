const express = require("express");
const rateLimit = require("express-rate-limit");

const { autorizar } = require("../../middleware/auth");
const caja = require("../../services/cashier");
const oxapay = require("../../services/cashier/oxapay");
const wallet = require("../../services/wallet");
const Settings = require("../../database/models/Settings");
const BalanceTransaction = require("../../database/models/BalanceTransaction");
const User = require("../../database/models/User");
const DepositoAvisado = require("../../database/models/DepositoAvisado");
const afiliados = require("../../services/affiliates");
const cajas = require("../../services/boxes");
const controles = require("../../services/controls");
const PromoCode = require("../../database/models/PromoCode");
const WalletTx = require("../../database/models/WalletTx");
const { sc } = require("../../utils/money");
const { errorDe, esDeJugador } = require("../../utils/errors");
const { logger } = require("../../utils/logger");

const router = express.Router();

function responderError(res, err, donde) {
  if (esDeJugador(err)) return res.status(err.status || 400).json(err.aRespuesta());
  logger.error(`[wallet] ${donde}:`, err.message);
  return res.status(500).json(errorDe("SOMETHING_WENT_WRONG", {}, 500).aRespuesta());
}

/**
 * LA CAJA, DEL LADO DEL JUGADOR.
 *
 * Comprar SC y pedir un canje. Las reglas están en services/cashier;
 * acá solo entra y sale lo que la pantalla necesita.
 */

/* Pedir direcciones y canjes es caro y sensible: va con freno. */
const freno = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED" } },
});

/** Las monedas y sus redes. Se puede mirar sin cuenta. */
router.get("/coins", autorizar(false), async (req, res) => {
  try {
    const cfg = await Settings.leer();
    const deBienvenida = cfg.bonoDeBienvenida || {};

    /*
      Un visitante sin cuenta tambien lo ve: es la oferta con la que se
      registra. Quien ya lo uso, no: ofrecerle algo que ya no puede
      pasar es peor que no ofrecer nada.
    */
    const yaLoUso = !!(req.user && req.user.bonoDeBienvenidaEl);

    /* La ventana ya cerrada tampoco cuenta: la tira no puede ofrecer
       algo que el servidor va a rechazar. */
    const seLePaso = !!(req.user && !enVentanaDelBono(req.user, deBienvenida));

    const disponible = deBienvenida.activo !== false
      && Number(deBienvenida.pct) > 0
      && !yaLoUso
      && !seLePaso;

    return res.json({
      success: true,
      data: {
        monedas: caja.monedas(),
        minimoDepositoSc: 10,
        minimoCanjeSc: sc(cfg.canjeMinimoSc),
        /*
          `bonoPorDeposito` NO sale de aca.

          Es el bono que reciben los REFERIDOS de un socio, y el
          porcentaje real sale del rango de ese socio
          (`afiliados.bonoDe`), no de esta perilla. Mandarlo en la
          respuesta publica hacia que pareciera una promesa para todos,
          y no la cumple nadie: el que no tiene padrino cobra cero.

          Lo que si es para todos es el de bienvenida, que va abajo.
        */
        bonoDeBienvenida: {
          disponible,
          pct: Number(deBienvenida.pct) || 0,
          topeSc: Number(deBienvenida.topeSc) || 0,
          vecesAJugar: Number(deBienvenida.vecesAJugar) || 0,
          minutos: Number(deBienvenida.minutos) || 30,
          /* Desde cuando corre el reloj, para que el contador de la
             pantalla y la ventana del servidor sean la misma cuenta.
             Sin sesion no hay sello: la tira arranca de ahora. */
          desde: req.user ? arranqueDelBono(req.user) : null,
        },
        conectada: oxapay.configurada(),
      },
    });
  } catch (err) {
    return responderError(res, err, "coins");
  }
});

/* Todo lo de abajo pide sesión. */
router.use(autorizar(true));

/**
 * EL JUGADOR ABRIO EL CAJON Y VIO LA OFERTA: ARRANCA EL RELOJ.
 *
 * Se sella cada vez que se abre, asi que los minutos son el tiempo que
 * tiene para decidir DESDE QUE LA VE, y no desde que abrio la cuenta.
 * El que entraba al rato de registrarse se encontraba un contador casi
 * en cero por una oferta que nunca le habian mostrado.
 *
 * Lo que devuelve es lo que pinta el contador. Que la fecha salga de
 * acá y no del reloj del navegador es lo que hace que la pantalla y el
 * servidor no se puedan separar: los dos miden contra este sello.
 *
 * Al que ya lo uso no se le vuelve a sellar: no hay oferta que contar,
 * y reescribir la fecha solo ensucia la cuenta.
 */
router.post("/bonus/seen", async (req, res) => {
  try {
    const cfg = await Settings.leer();
    const deBienvenida = cfg.bonoDeBienvenida || {};
    const minutos = Number(deBienvenida.minutos) || 30;

    if (req.user.bonoDeBienvenidaEl) {
      return res.json({ success: true, data: { desde: null, minutos, disponible: false } });
    }

    const desde = new Date();
    await User.updateOne({ _id: req.user._id }, { $set: { bonoVisibleDesde: desde } });
    req.user.bonoVisibleDesde = desde;

    return res.json({
      success: true,
      data: {
        desde,
        minutos,
        disponible: deBienvenida.activo !== false && Number(deBienvenida.pct) > 0,
      },
    });
  } catch (err) {
    return responderError(res, err, "wallet/bonus/seen");
  }
});

/**
 * UNA DIRECCION PARA DEPOSITAR.
 *
 * Si la pasarela no está conectada devuelve `conectada: false` y la
 * pantalla muestra el cartel. Nunca una dirección inventada.
 */
router.get("/deposit", freno, async (req, res) => {
  try {
    const datos = await caja.direccionDeDeposito({
      userId: req.user._id,
      ticker: req.query.coin || "USDT",
      red: req.query.network || "",
    });
    return res.json({ success: true, data: datos });
  } catch (err) {
    return responderError(res, err, "deposit");
  }
});

/**
 * EL HASH DE UN PAGO HECHO DESDE LA BILLETERA.
 *
 * Lo anota y nada más: NO acredita, no decide y no se le cree. El saldo
 * lo sigue acreditando el aviso de la pasarela cuando la red confirma.
 *
 * Existe para soporte: "pagué y no me llegó" sin un hash no se puede
 * mirar, y con el hash se abre el explorador y se ve si la transferencia
 * salió, a dónde fue y cuántas confirmaciones lleva.
 */
router.post("/deposit/tx", freno, async (req, res) => {
  try {
    const hash = String(req.body.hash || "").trim().slice(0, 120);
    if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) throw errorDe("INVALID_AMOUNT", { campo: "hash" });

    await WalletTx.updateOne(
      { hash },
      {
        $setOnInsert: {
          user: req.user._id,
          hash,
          ticker: String(req.body.coin || "").slice(0, 10).toUpperCase(),
          red: String(req.body.network || "").slice(0, 20),
          direccion: String(req.body.address || "").slice(0, 120),
        },
      },
      { upsert: true }
    );

    return res.json({ success: true });
  } catch (err) {
    return responderError(res, err, "deposit/tx");
  }
});

/** Lo que hay que saber antes de pedir un canje. */
router.get("/withdraw", async (req, res) => {
  try {
    return res.json({ success: true, data: await caja.antesDeCanjear(req.user) });
  } catch (err) {
    return responderError(res, err, "withdraw");
  }
});

/** Pedirlo. Descuenta el saldo y deja el pedido esperando revisión. */
router.post("/withdraw", freno, async (req, res) => {
  try {
    const pedido = await caja.pedirCanje({
      user: req.user,
      montoSc: req.body.montoSc,
      ticker: req.body.coin,
      red: req.body.network,
      direccion: req.body.address,
    });

    return res.json({
      success: true,
      data: { pedido, ...(await wallet.saldoDe(req.user._id)) },
    });
  } catch (err) {
    return responderError(res, err, "withdraw.create");
  }
});

/**
 * UN CODIGO, DEL TIPO QUE SEA.
 *
 * El jugador escribe "un código": no tiene por qué saber si el suyo es
 * de un afiliado o de una promoción. Acá se averigua, se hace lo que
 * corresponda y se contesta qué pasó.
 *
 * Y CUANDO NO ENTRA, SE DICE POR QUE NO ENTRA
 *
 * "Ese código no existe" para todo es la peor respuesta posible:
 * mandaba a alguien a revisar cómo lo escribió cuando el problema era
 * que el código era el suyo propio, o que ya tenía uno puesto. Cada
 * caso tiene su mensaje.
 *
 * EL CODIGO DE AFILIADO SE PONE UNA SOLA VEZ
 *
 * Normalmente al registrarse, pero la mitad de la gente se entera
 * después. El que ya tiene uno no lo puede cambiar: si no, el primer
 * socio pierde al jugador que trajo.
 */
router.post("/code", freno, async (req, res) => {
  try {
    /* Un autoexcluido no canjea nada: los codigos reponen cajas
       gratis, y eso es un incentivo nuevo para volver. */
    await controles.revisarPausa(req.user._id);
    const texto = codigoEscrito(req.body.code);
    if (!texto) throw errorDe("CODE_NOT_FOUND");

    /* ── ¿Es de un afiliado? ──────────────────────────────────── */
    const codigo = await afiliados.buscarCodigo(texto);
    if (codigo) {
      const duenoId = String((codigo.owner && codigo.owner._id) || codigo.owner);
      if (duenoId === String(req.user._id)) throw errorDe("OWN_CODE");
      if (req.user.referredBy) throw errorDe("CODE_ALREADY_USED");
      if (!codigo.sirve()) throw errorDe("CODE_EXPIRED");

      await afiliados.atarAlSocio(req.user, texto);

      /*
        El porcentaje lo contesta el servicio, que es el que sabe el
        rango del socio: del 5% al 10%. Calcularlo acá con el número
        normal le mostraba de menos al jugador de un socio grande, y
        después se le acreditaba de más, que es peor que no decirle nada.
      */
      const pct = await afiliados.bonoDe(codigo);

      return res.json({
        success: true,
        data: { tipo: "afiliado", code: codigo.code, bonoPct: Math.round(pct * 1000) / 10 },
      });
    }

    /* ── ¿Es de una promoción? ────────────────────────────────── */
    const promo = await PromoCode.findOne({ codigo: texto.replace(/[^A-Z0-9]/g, "") });
    if (promo) {
      const r = await canjearPromo(req.user, promo);

      /*
        El `tipo` de la promoción --saldo o aperturas-- se llama igual
        que el tipo de código, así que va con otro nombre: con los dos
        como `tipo`, el de adentro pisaba al de afuera y la pantalla
        mostraba el mensaje equivocado.
      */
      return res.json({ success: true, data: { ...r, tipo: "promo", tipoPromo: r.tipo } });
    }

    throw errorDe("CODE_NOT_FOUND");
  } catch (err) {
    return responderError(res, err, "code");
  }
});

/**
 * CANJEAR UN CODIGO PROMOCIONAL.
 *
 * El de una campaña: da saldo o cajas gratis, una sola vez por persona.
 *
 * LO QUE IMPIDE EL DOBLE CANJE ES EL INDICE, NO UN `IF`
 *
 * La fila de uso se crea ANTES de mover la plata, con un índice único
 * por (código, jugador). Dos clics al mismo tiempo: el segundo choca
 * contra el índice y no acredita. Preguntando "¿ya lo usó?" y después
 * acreditando, los dos pasan.
 *
 * Está como función aparte porque lo usan DOS pantallas: la de
 * recompensas y el "¿tenés un código?" del cajón, que acepta cualquiera
 * de los dos tipos.
 */
async function canjearPromo(usuario, codigo) {
  /* Soporte le puede frenar las promociones a una cuenta sin cerrarla. */
  if (usuario.trabas && usuario.trabas.promos) throw errorDe("PROMOS_LOCKED", {}, 403);
  if (!codigo.sirve()) throw errorDe("CODE_EXPIRED");

  if (codigo.minimoJugadoSc > 0 && sc(usuario.jugadoSc) < codigo.minimoJugadoSc) {
    throw errorDe("BELOW_MINIMUM", { minimoJugadoSc: codigo.minimoJugadoSc });
  }

  /* La marca primero: es la que decide quién gana la carrera. */
  let uso;
  try {
    uso = await PromoCode.PromoUse.create({
      code: codigo._id,
      user: usuario._id,
      montoSc: codigo.montoSc,
      aperturas: codigo.aperturas,
    });
  } catch (err) {
    if (err && err.code === 11000) throw errorDe("CODE_ALREADY_USED");
    throw err;
  }

  try {
    if (codigo.tipo === "saldo" && codigo.montoSc > 0) {
      await wallet.mover({
        userId: usuario._id,
        amountSc: sc(codigo.montoSc),
        type: "promo_code",
        reference: { kind: "promoCode", id: codigo._id, label: codigo.codigo },
      });
    }

    if (codigo.tipo === "aperturas" && codigo.aperturas > 0) {
      await cajas.regalarCajasDeBienvenida(usuario._id);
    }
  } catch (err) {
    /* No se pudo dar: se borra la marca para que lo pueda reintentar. */
    await PromoCode.PromoUse.deleteOne({ _id: uso._id });
    throw err;
  }

  await PromoCode.updateOne({ _id: codigo._id }, { $inc: { usos: 1 } });

  return {
    codigo: codigo.codigo,
    tipo: codigo.tipo,
    montoSc: sc(codigo.montoSc),
    aperturas: codigo.aperturas,
    ...(await wallet.saldoDe(usuario._id)),
  };
}

/** Limpia lo que escribió el jugador. Los de afiliado llevan - y _. */
function codigoEscrito(texto) {
  return String(texto || "").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 24);
}

router.post("/promo", freno, async (req, res) => {
  try {
    await controles.revisarPausa(req.user._id);
    /*
      La traba va PRIMERO, antes de mirar si el código existe: una
      cuenta frenada no tiene por qué poder averiguar qué códigos hay
      probando uno por uno.
    */
    if (req.user.trabas && req.user.trabas.promos) throw errorDe("PROMOS_LOCKED", {}, 403);

    const texto = codigoEscrito(req.body.code).replace(/[^A-Z0-9]/g, "");
    if (!texto) throw errorDe("CODE_NOT_FOUND");

    const codigo = await PromoCode.findOne({ codigo: texto });
    if (!codigo) throw errorDe("CODE_NOT_FOUND");

    return res.json({ success: true, data: await canjearPromo(req.user, codigo) });
  } catch (err) {
    return responderError(res, err, "promo");
  }
});

/** Los míos. */
router.get("/withdrawals", async (req, res) => {
  try {
    return res.json({ success: true, data: { items: await caja.mios(req.user._id) } });
  } catch (err) {
    return responderError(res, err, "withdrawals");
  }
});

/** Cancelarlo mientras nadie lo miró. */
router.post("/withdrawals/:id/cancel", async (req, res) => {
  try {
    const pedido = await caja.cancelar(req.user._id, req.params.id);
    return res.json({
      success: true,
      data: { pedido, ...(await wallet.saldoDe(req.user._id)) },
    });
  } catch (err) {
    return responderError(res, err, "withdrawals.cancel");
  }
});

module.exports = router;

/* ══ El aviso de la pasarela ═════════════════════════════════════ */

/**
 * EL AVISO DE PAGO DE OXAPAY.
 *
 * Va aparte y sin `autorizar`: lo llama OxaPay, no un jugador. Lo que
 * lo protege es la FIRMA: sin ella, cualquiera que sepa la dirección se
 * acredita SC mandando un JSON.
 *
 * Y la idempotencia: el mismo pago avisado dos veces --pasa, los
 * proveedores reintentan-- no puede acreditar dos veces. La fila del
 * libro con ese `track_id` es la que lo impide.
 */
/* Los `type` que SI son un cobro nuestro. El resto --payout-- no
   acredita nada. Salen de la documentacion de OxaPay. */
const TIPOS_DE_COBRO = ["invoice", "white_label", "static_address", "payment_link", "donation"];

/* Mas que esto en un solo aviso no es un deposito, es un problema. */
const TOPE_POR_AVISO = 100000;

/**
 * ¿Le queda tiempo de la oferta de bienvenida?
 *
 * La ventana arranca cuando el jugador ABRIO EL CAJON DE DEPOSITO y
 * vio el cartel (`bonoVisibleDesde`), y vuelve a arrancar cada vez que
 * lo abre. Antes contaba desde que se había abierto la cuenta, y el
 * que entraba al rato veía un contador casi en cero sin haber visto
 * nunca la oferta.
 *
 * El que nunca abrió el cajón cae en `createdAt`: es el único momento
 * que conocemos, y es el más estricto de los dos.
 *
 * Es la misma cuenta que hace el contador de la pantalla, hecha en un
 * solo lugar para que las dos no se puedan separar.
 */
function arranqueDelBono(usuario) {
  if (!usuario) return null;
  return usuario.bonoVisibleDesde || usuario.createdAt || null;
}

function enVentanaDelBono(usuario, cfgBono) {
  const arranque = arranqueDelBono(usuario);
  if (!arranque) return true;

  const minutos = Number(cfgBono && cfgBono.minutos);
  if (!Number.isFinite(minutos) || minutos <= 0) return true;

  const vence = new Date(arranque).getTime() + minutos * 60 * 1000;
  return Date.now() < vence;
}

const aviso = express.Router();

aviso.post("/oxapay", express.raw({ type: "*/*" }), async (req, res) => {
  /*
    TIENE QUE LLEGAR CRUDO.

    La firma se calcula sobre los BYTES que mando la pasarela.
    Reconstruirlos con `JSON.stringify` no devuelve lo mismo --se
    pierde el formato y los numeros se renormalizan-- asi que la firma
    dejaba de cerrar con cualquier cuerpo que no fuera exactamente el
    que produce Node. Si esto llega parseado es que algun parser se
    adelanto al `express.raw`, y hay que arreglar eso, no disimularlo.
  */
  if (!(req.body instanceof Buffer)) {
    logger.error("[oxapay] el aviso llego parseado: hay un parser antes del raw");
    return res.status(500).send("error");
  }

  const crudo = req.body.toString("utf8");

  try {
    if (!oxapay.avisoEsDeOxaPay(crudo, req.headers.hmac || req.headers["x-signature"])) {
      logger.warn("[oxapay] aviso con firma que no cierra");
      return res.status(401).send("invalid signature");
    }

    const datos = JSON.parse(crudo || "{}");
    const estado = String(datos.status || "").toLowerCase();
    const tipo = String(datos.type || "").toLowerCase();
    const trackId = String(datos.track_id || datos.trackId || "");
    const userId = String(datos.order_id || "");

    /*
      ESTO TIENE QUE SER UN COBRO, NO UN PAGO NUESTRO.

      Los avisos de payout llegan a la misma direccion, con `type:
      "payout"` y estado "Confirmed". Hoy no acreditaban porque no
      traen `order_id`, pero depender de eso es depender de que ellos
      no cambien el formato.
    */
    if (tipo && !TIPOS_DE_COBRO.includes(tipo)) {
      return res.status(200).send("ok");
    }

    /* El primer aviso es "Paying" y avisa que llego pero falta la red.
       Se acredita en el segundo. */
    if (estado !== "paid") return res.status(200).send("ok");

    /*
      SE ACREDITA `value`, QUE SON DOLARES.

      `amount` son unidades de la moneda: 10 POL, 0,01 BTC. `value` es
      lo que valen. SC vale un dolar, asi que lo que entra al saldo es
      `value` y nada mas. Tomar `amount` acreditaba mil dolares por mil
      DOGE.
    */
    const monto = sc(Number(datos.value) || 0);
    if (!userId || monto <= 0 || !trackId) return res.status(200).send("ok");

    /*
      UN TECHO.

      No hay deposito legitimo de un millon de dolares, y sin tope un
      solo aviso raro deja el libro y las estadisticas rotos para
      siempre, porque los asientos no se reescriben.
    */
    if (monto > TOPE_POR_AVISO) {
      logger.error(`[oxapay] aviso de SC ${monto}, por encima del tope: no se acredita`);
      return res.status(200).send("ok");
    }

    const jugador = await User.findById(userId).select("referredBy affiliateCode createdAt").lean();
    const jugadorCompleto = jugador;
    if (!jugador) return res.status(200).send("ok");

    /*
      LA MARCA SE PONE ANTES DE MOVER LA PLATA.

      El indice unico del `trackId` es lo que impide acreditar dos
      veces. Preguntar "¿ya esta?" y despues acreditar deja una ventana:
      dos avisos del mismo pago a la vez --las pasarelas reintentan--
      leen los dos que no esta y acreditan los dos.
    */
    let marca;
    try {
      marca = await DepositoAvisado.create({
        trackId,
        pasarela: "oxapay",
        user: userId,
        montoSc: monto,
      });
    } catch (err) {
      if (err && err.code === 11000) return res.status(200).send("ok");
      throw err;
    }

    /*
      El bono por código de afiliado lo calcula el servicio, que es el
      que sabe si ese código es de los destacados --10% en vez de 5%--
      y si sigue vivo. Calcularlo acá con el porcentaje normal le
      pagaba de menos a los socios grandes.
    */
    const cfg = await Settings.leer();

    /*
      EL BONO DE BIENVENIDA: EL PRIMERO Y UNO SOLO.

      La marca va EN EL FILTRO, no en un `if`. Dos avisos del mismo
      jugador al mismo tiempo --pasa, las pasarelas reintentan-- leerian
      los dos que todavia no lo tiene y los dos lo acreditarian. Asi, el
      segundo no encuentra documento que cumpla y no hay bono doble.
    */
    const deBienvenida = cfg.bonoDeBienvenida || {};
    let bono = 0;
    let vecesAJugar = cfg.vecesAJugarElBono || 0;

    /*
      LA VENTANA TIENE QUE SEGUIR ABIERTA.

      La pantalla muestra un contador de `minutos` desde que se abrio la
      cuenta. Si el servidor acreditara igual despues de que llega a
      cero, el contador seria decorado; y si alguien lo mira dos veces,
      deja de creerle a todo lo demas que diga la pantalla.
    */
    const aTiempo = enVentanaDelBono(jugadorCompleto, deBienvenida);

    if (aTiempo && deBienvenida.activo !== false && Number(deBienvenida.pct) > 0) {
      const reclamado = await User.findOneAndUpdate(
        { _id: userId, bonoDeBienvenidaEl: null },
        { $set: { bonoDeBienvenidaEl: new Date() } }
      ).lean();

      if (reclamado) {
        const tope = Number(deBienvenida.topeSc);
        const crudo = monto * Number(deBienvenida.pct);
        bono = sc(Number.isFinite(tope) && tope > 0 ? Math.min(crudo, tope) : crudo);
        vecesAJugar = Number(deBienvenida.vecesAJugar) || 0;
      }
    }

    /* Sin bono de bienvenida, queda el del codigo del socio, que es
       otro y aplica a cada compra. */
    if (bono <= 0) {
      const { bonoSc } = await afiliados.bonoDeCompra(jugador, monto);
      bono = sc(bonoSc);
    }

    await wallet.mover({
      userId,
      amountSc: sc(monto + bono),
      type: "purchase",
      /* El bono, y aparte cuantas veces hay que jugarlo: la billetera
         necesita los dos por separado para saber cuanto trabar. */
      bonoSc: sc(bono),
      vecesAJugarElBono: vecesAJugar,
      reference: { kind: "oxapay", label: trackId },
    });

    await DepositoAvisado.updateOne({ _id: marca._id }, { $set: { acreditado: true } });

    logger.info(
      `[oxapay] acreditado SC ${monto} (+${bono}) a ${userId} ` +
      `(${datos.amount} ${datos.currency})`
    );

    /*
      ELLOS ESPERAN EL TEXTO "ok", NO UN JSON.

      "Merchant's callback_url must return an HTTP 200 response with
      content 'ok' for the OxaPay API to consider the callback
      successful". Con cualquier otra cosa lo reintentan cinco veces y
      despues lo dan por fallido.
    */
    return res.status(200).send("ok");
  } catch (err) {
    /*
      SI SE CAYO DESPUES DE PONER LA MARCA, SE SACA LA MARCA.

      La marca con `trackId` unico es lo que impide acreditar dos veces.
      Pero si el fallo pasa DESPUES de ponerla y ANTES de acreditar, el
      reintento de OxaPay choca contra el indice, contesta "repetido" y
      no acredita nunca: el jugador pago y no recibe nada, y el campo
      `acreditado: false` no lo mira ningun lado.

      Asi que se saca, pero solo despues de comprobar en el libro que de
      verdad no se acredito. Si hay asiento, la marca se queda donde
      esta: mejor un deposito que hay que revisar a mano que uno pagado
      dos veces.
    */
    try {
      const trackId = String((JSON.parse(crudo || "{}") || {}).track_id || "");

      if (trackId) {
        const enElLibro = await BalanceTransaction.findOne({
          type: "purchase",
          "reference.kind": "oxapay",
          "reference.label": trackId,
        }).lean();

        if (!enElLibro) {
          await DepositoAvisado.deleteOne({ trackId, acreditado: false });
          logger.error(
            `[oxapay] ${trackId} fallo antes de acreditar: se saco la marca ` +
            `para que el reintento pueda entrar`
          );
        } else {
          logger.error(`[oxapay] ${trackId} fallo DESPUES de acreditar: revisar a mano`);
        }
      }
    } catch (otro) {
      logger.error("[oxapay] limpiando la marca:", otro.message);
    }

    logger.error("[oxapay] aviso:", err.message);
    return res.status(500).send("error");
  }
});

module.exports.aviso = aviso;
