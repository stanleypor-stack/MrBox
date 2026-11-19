const express = require("express");
const rateLimit = require("express-rate-limit");

const Box = require("../../database/models/Box");
const User = require("../../database/models/User");
const BoxOpen = require("../../database/models/BoxOpen");
const Item = require("../../database/models/Item");
const feed = require("../../services/feed");
const InventoryItem = require("../../database/models/InventoryItem");
const UserSeed = require("../../database/models/UserSeed");
const Settings = require("../../database/models/Settings");

const { autorizar } = require("../../middleware/auth");
const cajas = require("../../services/boxes");
const { sc } = require("../../utils/money");
const { errorDe, esDeJugador } = require("../../utils/errors");
const { logger } = require("../../utils/logger");

const router = express.Router();

function responderError(res, err, donde) {
  if (esDeJugador(err)) return res.status(err.status || 400).json(err.aRespuesta());
  logger.error(`[boxes] ${donde}:`, err.message);
  return res.status(500).json(errorDe("SOMETHING_WENT_WRONG", {}, 500).aRespuesta());
}

/*
  UN LIMITE PROPIO PARA ABRIR.

  Mas alto que el de la entrada --abrir muchas seguidas es lo normal de
  un jugador enganchado-- pero existe: sin el, un script abre cajas tan
  rapido como la red aguante y vacia un saldo en un segundo, y de paso
  deja al servidor sin aire para los demas.
*/
const limiteAbrir = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.OPEN_RATE_LIMIT) || 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json(errorDe("RATE_LIMITED", {}, 429).aRespuesta()),
});

/* ── El catalogo ──────────────────────────────────────────────────── */

/**
 * LAS CAJAS.
 *
 * Se puede mirar sin cuenta: alguien que todavia no se registro tiene
 * que poder ver que hay y cuanto sale, que es lo que lo hace registrarse.
 */
router.get("/", autorizar(false), async (req, res) => {
  try {
    const filtro = { live: true };

    /* El admin puede pedir tambien las apagadas, para el panel. */
    if (req.query.all === "1" && req.user && ["admin", "owner"].includes(req.user.rank)) {
      delete filtro.live;
    }

    if (req.query.category) filtro.category = String(req.query.category);
    if (req.query.search) {
      const texto = String(req.query.search).trim();
      if (texto) filtro.name = { $regex: texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    }

    /* Por precio: "las de menos de SC 5", "las de mas de SC 200". */
    const min = Number(req.query.min);
    const max = Number(req.query.max);
    if (Number.isFinite(min) || Number.isFinite(max)) {
      filtro.priceSc = {};
      if (Number.isFinite(min)) filtro.priceSc.$gte = min;
      if (Number.isFinite(max)) filtro.priceSc.$lte = max;
    }

    const ORDENES = {
      popular: { opens: -1 },
      nuevas: { createdAt: -1 },
      baratas: { priceSc: 1 },
      caras: { priceSc: -1 },
      nombre: { name: 1 },
      /* Lo que devuelve cada caja, de mayor a menor. */
      retorno: { retorno: -1 },
    };
    const orden = ORDENES[req.query.sort] || ORDENES.popular;

    const pagina = Math.max(1, Number(req.query.page) || 1);
    const porPagina = Math.min(60, Math.max(1, Number(req.query.perPage) || 24));

    const [lista, total] = await Promise.all([
      Box.find(filtro).sort(orden).skip((pagina - 1) * porPagina).limit(porPagina).lean(),
      Box.countDocuments(filtro),
    ]);

    return res.json({
      success: true,
      data: {
        items: lista.map((c) => {
          const resumen = cajas.resumenDeCaja(c);
          /*
            En la grilla NO viajan los premios enteros: son hasta veinte
            objetos por caja y en una pagina de veinticuatro cajas eso es
            medio megabyte para dibujar unas tarjetas. Va el conteo y el
            mejor premio, que es lo que la tarjeta muestra.
          */
          const mejor = (c.prizes || []).reduce(
            (a, p) => (!a || p.valueSc > a.valueSc ? p : a), null
          );
          return {
            ...resumen,
            prizes: undefined,
            cuantosObjetos: (c.prizes || []).length,
            mejorPremio: mejor
              ? { name: mejor.name, valueSc: sc(mejor.valueSc), rarity: mejor.rarity, imageUrl: mejor.imageUrl }
              : null,
            live: c.live,
          };
        }),
        page: pagina, perPage: porPagina, total, pages: Math.ceil(total / porPagina),
      },
    });
  } catch (err) {
    return responderError(res, err, "catalogo");
  }
});

/**
 * Las categorias que existen de verdad, con cuantas cajas tiene cada una.
 *
 * El conteo viaja porque la barra lateral lo muestra al lado del nombre.
 * Se hace con una agregacion y no contando una por una: trece consultas
 * para dibujar un menu es un desperdicio que se nota.
 */
router.get("/categories", autorizar(false), async (req, res) => {
  try {
    const filas = await Box.aggregate([
      { $match: { live: true, category: { $nin: ["", null] } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
    ]);
    return res.json({
      success: true,
      data: filas.map((f) => ({ name: f._id, count: f.count })),
    });
  } catch (err) {
    return responderError(res, err, "categories");
  }
});

/*
  OJO CON EL ORDEN: ESTA RUTA VA ANTES QUE /:slug.

  Express prueba las rutas en el orden en que se declaran, y "/rows" es
  un solo segmento igual que un slug: puesta despues, /boxes/rows caia
  en /boxes/:slug y el servidor contestaba "esa caja no existe". Pasa
  con cualquier ruta fija de un segmento que viva al lado de una
  variable.
*/
/**
 * LAS FILAS DE LA PORTADA, EN UN SOLO PEDIDO.
 *
 * Popular Picks, Featured, Luxury Picks, Under SC 5 y Best Odds. Van
 * juntas a proposito: cinco pedidos para dibujar una portada es medio segundo
 * de pantalla a medio armar en un telefono con mala senal, y la portada
 * es lo primero que ve cualquiera.
 *
 * Cada fila dice que REGLA la arma, para que el panel pueda mostrarlo
 * y para que nadie tenga que adivinar por que una caja esta ahi.
 */
router.get("/rows", autorizar(false), async (req, res) => {
  try {
    const comun = { live: true };
    const campos = "slug name category imageUrl priceSc retorno featured markedNew opens prizes";

    const resumir = (lista) =>
      lista.map((c) => {
        const mejor = (c.prizes || []).reduce((a, p) => (!a || p.valueSc > a.valueSc ? p : a), null);
        return {
          ...cajas.resumenDeCaja(c),
          prizes: undefined,
          cuantosObjetos: (c.prizes || []).length,
          mejorPremio: mejor
            ? { name: mejor.name, valueSc: sc(mejor.valueSc), rarity: mejor.rarity, imageUrl: mejor.imageUrl }
            : null,
        };
      });

    const [populares, destacadas, lujo, baratas, generosas] = await Promise.all([
      Box.find(comun).sort({ opens: -1 }).limit(14).select(campos).lean(),
      Box.find({ ...comun, $or: [{ featured: true }, { markedNew: true }] })
        .sort({ createdAt: -1 }).limit(14).select(campos).lean(),
      Box.find({ ...comun, priceSc: { $gte: 200 } }).sort({ priceSc: -1 }).limit(14).select(campos).lean(),
      Box.find({ ...comun, priceSc: { $lt: 5 } }).sort({ priceSc: 1 }).limit(14).select(campos).lean(),
      /*
        LAS QUE MAS DEVUELVEN.

        El retorno de cada caja ya se calcula y ya se muestra en su
        tarjeta: esta fila solo las ordena por ese numero. Es la fila
        que una maquinita no puede tener, porque para armarla hay que
        decir cuanto devuelve cada cosa.
      */
      Box.find({ ...comun, retorno: { $gt: 0 } })
        .sort({ retorno: -1 }).limit(14).select(campos).lean(),
    ]);

    /*
      EL ORDEN Y LO QUE SE MUESTRA LO DICE EL PANEL.

      La REGLA de cada fila sigue acá --"las 14 más abiertas" es una
      consulta, no un dato-- pero esconder una fila o moverla se hace
      desde Settings.portada, sin desplegar nada.
    */
    const cfgPortada = (await Settings.leer()).portada || [];
    const puesto = new Map(cfgPortada.map((f) => [f.id, f]));

    const todas = [
      { id: "popular", titulo: "rows.popular", regla: "rows.popularRule", items: resumir(populares) },
      { id: "featured", titulo: "rows.featured", regla: "rows.featuredRule", items: resumir(destacadas) },
      { id: "luxury", titulo: "rows.luxury", regla: "rows.luxuryRule", items: resumir(lujo) },
      { id: "cheap", titulo: "rows.cheap", regla: "rows.cheapRule", items: resumir(baratas) },
      { id: "generous", titulo: "rows.generous", regla: "rows.generousRule", items: resumir(generosas) },
    ];

    return res.json({
      success: true,
      data: todas
        .filter((f) => f.items.length)
        .filter((f) => !puesto.has(f.id) || puesto.get(f.id).visible !== false)
        .sort((a, b) => {
          const pa = puesto.has(a.id) ? puesto.get(a.id).orden : 99;
          const pb = puesto.has(b.id) ? puesto.get(b.id).orden : 99;
          return pa - pb;
        }),
    });
  } catch (err) {
    return responderError(res, err, "rows");
  }
});

/**
 * UNA CAJA, CON TODOS SUS PREMIOS Y SUS CHANCES.
 *
 * Las chances se muestran. Es lo que diferencia a este sitio de una
 * maquinita: el jugador ve exactamente que puede salir y con que
 * probabilidad, antes de poner un peso.
 */
/**
 * LAS CAJAS DE REGALO DE QUIEN MIRA.
 *
 * Las tres de bienvenida y cuales ya abrio. Sin sesion devuelve las
 * tres que SE REGALAN, para poder mostrarlas en la portada a quien
 * todavia no se registro: son el argumento para que lo haga.
 */
router.get("/gifts", autorizar(false), async (req, res) => {
  try {
    if (req.user) {
      return res.json({ success: true, data: { items: await cajas.cajasGratisDe(req.user._id) } });
    }

    const cfg = await Settings.leer();
    const lista = await Box.find({ slug: { $in: cfg.cajasDeRegalo || [] }, live: true })
      .select("slug name imageUrl priceSc")
      .lean();

    return res.json({
      success: true,
      data: {
        items: lista.map((b) => ({
          slug: b.slug,
          nombre: b.name,
          imageUrl: b.imageUrl,
          priceSc: sc(b.priceSc),
          usada: false,
        })),
      },
    });
  } catch (err) {
    return responderError(res, err, "gifts");
  }
});

router.get("/:slug", autorizar(false), async (req, res) => {
  try {
    const caja = await cajas.cajaPorSlug(req.params.slug);
    if (!caja.live && !(req.user && ["admin", "owner"].includes(req.user.rank))) {
      throw errorDe("BOX_NOT_LIVE");
    }
    const cfg = await Settings.leer();

    return res.json({
      success: true,
      data: {
        ...cajas.resumenDeCaja(caja),
        live: caja.live,
        /* Lo que se puede abrir de una, para dibujar el x1..x4. */
        maximoALaVez: cfg.cajasALaVez,
        /* Y cuantas pruebas gratis hay en total, para el globito del
           boton Demo. Las que ya gasto van en su cuenta. */
        aperturasDeDemo: Number(cfg.aperturasDeDemo) || 0,
        /* El retorno, a la vista. No tenemos nada que esconder y es el
           numero que un jugador informado quiere ver. */
        retornoMostrado: Math.round((caja.retorno || 0) * 10000) / 100,

        /* Si tiene una apertura de regalo EN ESTA caja. El regalo es
           por caja, no una ficha para usar donde sea. */
        gratisAca: req.user
          ? (await cajas.cajasGratisDe(req.user._id)).some((c) => c.slug === caja.slug && !c.usada)
          : false,
      },
    });
  } catch (err) {
    return responderError(res, err, "caja");
  }
});

/* ── Abrir ────────────────────────────────────────────────────────── */

/**
 * DE PRUEBA: SE SORTEA IGUAL, NO COBRA, NO PAGA Y NO GUARDA NADA.
 *
 * SON CONTADAS
 *
 * El ajuste `aperturasDeDemo` dice cuantas, y hasta ahora no lo miraba
 * nadie: se podia girar de gratis para siempre. Con sesion se cuentan
 * en la cuenta, que es lo unico que no se puede borrar desde el
 * navegador. Sin sesion las cuenta la pantalla: no hay a quien
 * contarselas, y como el demo no mueve un peso, tampoco hace falta.
 */
router.post("/:slug/demo", autorizar(false), limiteAbrir, async (req, res) => {
  try {
    const cfg = await Settings.leer();
    const tope = Number(cfg.aperturasDeDemo) || 0;
    const veces = Math.max(1, Math.min(4, Number(req.body.veces) || 1));

    if (req.user) {
      const usadas = Number(req.user.demosUsadas) || 0;
      if (usadas + veces > tope) {
        throw errorDe("NO_DEMOS_LEFT", { quedan: Math.max(0, tope - usadas) }, 403);
      }
      await User.updateOne({ _id: req.user._id }, { $inc: { demosUsadas: veces } });
    }

    const r = await cajas.abrir({ user: null, slug: req.params.slug, veces, demo: true });

    const usadas = (Number(req.user && req.user.demosUsadas) || 0) + (req.user ? veces : 0);
    return res.json({
      success: true,
      data: { ...r, demosRestantes: Math.max(0, tope - usadas), demosTope: tope },
    });
  } catch (err) {
    return responderError(res, err, "demo");
  }
});

/** La de verdad. */
router.post("/:slug/open", autorizar(true), limiteAbrir, async (req, res) => {
  try {
    const r = await cajas.abrir({ user: req.user, slug: req.params.slug, veces: req.body.veces });
    return res.json({ success: true, data: r });
  } catch (err) {
    return responderError(res, err, "open");
  }
});

/** Las ultimas aperturas de todo el sitio, para el feed de la portada. */
router.get("/feed/latest", autorizar(false), async (req, res) => {
  try {
    const cuantas = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const filas = await BoxOpen.find({ demo: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(cuantas)
      .populate("user", "username avatarUrl")
      .select("boxName boxSlug premio createdAt user")
      .lean();

    /*
      Las fotos que falten, de una sola vez.

      Los recibos de antes de que se copiara el arte no la tienen. Un
      `find` por los objetos que hagan falta es un pedido mas; uno por
      cada fila serian veinte.
    */
    const sinFoto = filas.filter((f) => f.premio && !f.premio.imageUrl);
    const porId = sinFoto.filter((f) => f.premio.item).map((f) => f.premio.item);
    const porNombre = sinFoto.filter((f) => !f.premio.item).map((f) => f.premio.name);

    const arte = new Map();
    if (porId.length || porNombre.length) {
      /* Por id, y los mas viejos --que ni id guardaban-- por nombre: una
         tarjeta sin foto se ve como un error del sitio. */
      const objetos = await Item.find({
        $or: [{ _id: { $in: porId } }, { name: { $in: porNombre } }],
      }).select("name imageUrl").lean();

      for (const o of objetos) {
        arte.set(String(o._id), o.imageUrl || "");
        arte.set(o.name, o.imageUrl || "");
      }
    }

    const reales = filas.map((f) => ({
      _id: f._id,
      /* El nombre se tapa a medias, como en el diseno: se reconoce el
         propio sin exponer el de los demas. */
      username: enmascarar(f.user && f.user.username),
      avatarUrl: (f.user && f.user.avatarUrl) || "",
      boxName: f.boxName,
      boxSlug: f.boxSlug,
      premio: {
        name: f.premio.name,
        valueSc: sc(f.premio.valueSc),
        rarity: f.premio.rarity,
        /* Si el recibo es viejo y no la trae, se busca en el
           catalogo: mejor una foto de hoy que un hueco. */
        imageUrl: f.premio.imageUrl
          || arte.get(String(f.premio.item || ""))
          || arte.get(f.premio.name)
          || "",
      },
      createdAt: f.createdAt,
    }));

    /*
      Y el relleno, SOLO para llenar la cinta.

      Lo de verdad va siempre primero: si hubo veinte aperturas en el
      ultimo minuto, la cinta es de verdad entera y esto no se ve. Lo de
      relleno no toca la base ni el libro (ver services/feed).
    */
    const relleno = await feed.ambiente(cuantas);

    /*
      TODO JUNTO Y ORDENADO POR HORA.

      Antes iban las de verdad primero y el relleno atras, y entonces
      cuatro aperturas viejas quedaban clavadas a la izquierda --que es
      por donde entran las nuevas-- y lo que se movia empezaba recien
      despues de ellas. La cinta muestra lo ULTIMO que paso, sea de
      quien sea: se mezcla y se ordena por fecha.
    */
    const todo = reales
      .concat(relleno)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, cuantas);

    return res.json({ success: true, data: todo });
  } catch (err) {
    return responderError(res, err, "feed");
  }
});

function enmascarar(nombre) {
  const n = String(nombre || "");
  if (n.length <= 3) return n;
  return n.slice(0, 1) + "****" + n.slice(-2);
}

module.exports = router;
module.exports.enmascarar = enmascarar;
