const express = require("express");

const Promotion = require("../../database/models/Promotion");
const Challenge = require("../../database/models/Challenge");
const Race = require("../../database/models/Race");
const Banner = require("../../database/models/Banner");
const PromoCode = require("../../database/models/PromoCode");
const Box = require("../../database/models/Box");
const Settings = require("../../database/models/Settings");
const User = require("../../database/models/User");

const admin = require("../../services/admin");
const { sc } = require("../../utils/money");
const { errorDe, esDeJugador } = require("../../utils/errors");
const { logger } = require("../../utils/logger");

const router = express.Router();

function responderError(res, err, donde) {
  if (esDeJugador(err)) return res.status(err.status || 400).json(err.aRespuesta());
  logger.error(`[admin] ${donde}:`, err.message);
  return res.status(500).json(errorDe("SOMETHING_WENT_WRONG", {}, 500).aRespuesta());
}

/**
 * CREAR, EDITAR Y BORRAR, DESDE EL PANEL.
 *
 * Carreras, promociones, códigos, desafíos, banners, las filas de la
 * portada y los rangos VIP. Todo lo que antes había que cambiar en el
 * código y desplegar.
 *
 * UNA LISTA BLANCA POR ENTIDAD, NO `req.body` ENTERO
 *
 * Cada tipo dice qué campos acepta y cómo se limpia cada uno. Con el
 * cuerpo entero, alguien que mande `{ cuposUsados: 0 }` reinicia los
 * cupos de un desafío ya ganado, y `{ estado: "live" }` revive una
 * carrera cerrada y vuelve a pagar los premios.
 *
 * TODO QUEDA EN EL REGISTRO
 *
 * Cada cambio escribe su fila en el registro del panel con el antes y
 * el después. Es lo que permite contestar "¿quién bajó el pozo de la
 * carrera semanal?" sin tener que creerle a nadie.
 */

/* ── Cómo se limpia cada tipo de campo ─────────────────────────────── */

const LIMPIAR = {
  texto: (v) => String(v == null ? "" : v).trim().slice(0, 300),
  textoLargo: (v) => String(v == null ? "" : v).trim().slice(0, 4000),
  numero: (v) => {
    const n = Number(String(v).replace(",", "."));
    if (!Number.isFinite(n)) throw errorDe("INVALID_AMOUNT", { valor: v });
    return n;
  },
  sc: (v) => {
    const n = Number(String(v).replace(",", "."));
    if (!Number.isFinite(n) || n < 0) throw errorDe("INVALID_AMOUNT", { valor: v });
    return sc(n);
  },
  entero: (v) => {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n)) throw errorDe("INVALID_AMOUNT", { valor: v });
    return n;
  },
  siNo: (v) => v === true || v === "true" || v === 1 || v === "1",
  fecha: (v) => {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) throw errorDe("INVALID_AMOUNT", { valor: v });
    return d;
  },
  /* Un texto por idioma: { en: "...", es: "..." }. La pantalla manda
     el inglés y el resto se completa con él hasta que se traduzca. */
  idiomas: (v) => {
    if (v && typeof v === "object") return v;
    const texto = String(v == null ? "" : v).trim().slice(0, 300);
    return { en: texto };
  },
  lista: (v) => {
    if (Array.isArray(v)) return v.map((x) => Number(x) || 0);
    return String(v || "")
      .split(/[,\s]+/)
      .filter(Boolean)
      .map((x) => Number(x) || 0);
  },
};

/**
 * LAS ENTIDADES QUE SE PUEDEN TOCAR.
 *
 * `campos` es la lista blanca: nombre -> tipo. Lo que no está acá no
 * se guarda, venga como venga en el cuerpo.
 */
const COSAS = {
  promotions: {
    modelo: Promotion,
    nombre: (d) => d.clave,
    campos: {
      clave: "texto",
      titulo: "idiomas",
      texto: "idiomas",
      boton: "idiomas",
      destino: "texto",
      orden: "entero",
      activa: "siNo",
      desde: "fecha",
      hasta: "fecha",
    },
    obligatorios: ["clave"],
  },

  challenges: {
    modelo: Challenge,
    nombre: (d) => `${d.boxName} ${d.multiplicador}x`,
    campos: {
      box: "texto",
      multiplicador: "numero",
      premioSc: "sc",
      cupos: "entero",
      desde: "fecha",
      hasta: "fecha",
      activo: "siNo",
    },
    obligatorios: ["box", "multiplicador", "premioSc", "cupos", "hasta"],
    /* La caja viaja por slug: es lo que una persona puede escribir. */
    antesDeGuardar: async (datos) => {
      if (!datos.box) return datos;
      /*
        Por slug, que es lo que una persona puede escribir. Si lo que
        llega parece un id de Mongo, se busca por id: la pantalla manda
        el slug, pero una llamada directa puede mandar el id.

        El `$or` con `_id` no sirve: mongoose intenta convertir
        "black-card" a ObjectId y revienta antes de buscar.
        */
      const esId = /^[0-9a-f]{24}$/i.test(String(datos.box));
      const caja = await Box.findOne(esId ? { _id: datos.box } : { slug: datos.box })
        .select("slug name")
        .lean();
      if (!caja) throw errorDe("BOX_NOT_FOUND", { box: datos.box });
      return { ...datos, box: caja._id, boxSlug: caja.slug, boxName: caja.name };
    },
  },

  races: {
    modelo: Race,
    nombre: (d) => d.tipo,
    campos: {
      tipo: "texto",
      premioTotalSc: "sc",
      desde: "fecha",
      hasta: "fecha",
      reparto: "lista",
    },
    obligatorios: ["tipo", "premioTotalSc", "desde", "hasta"],
    /*
      UNA CARRERA CERRADA NO SE EDITA.

      Ya pagó: cambiarle el pozo o las fechas dejaría los premios
      pagados sin relación con lo que dice la fila.
    */
    sePuedeEditar: (actual) => actual.estado !== "settled",
    antesDeGuardar: async (datos) => {
      if (datos.reparto && datos.reparto.length) {
        const suma = datos.reparto.reduce((a, b) => a + b, 0);
        if (Math.abs(suma - 100) > 0.01) throw errorDe("INVALID_AMOUNT", { reparto: suma });
      }
      return datos;
    },
  },

  banners: {
    modelo: Banner,
    nombre: (d) => d.clave,
    campos: {
      clave: "texto",
      foto: "texto",
      titulo: "texto",
      sub: "texto",
      cta: "texto",
      destino: "texto",
      orden: "entero",
      visible: "siNo",
    },
    obligatorios: ["clave", "foto"],
  },

  promo: {
    modelo: PromoCode,
    nombre: (d) => d.codigo,
    campos: {
      codigo: "texto",
      tipo: "texto",
      montoSc: "sc",
      aperturas: "entero",
      usosMaximos: "entero",
      minimoJugadoSc: "sc",
      hasta: "fecha",
      activo: "siNo",
    },
    obligatorios: ["codigo", "tipo"],
    antesDeGuardar: async (datos) => ({
      ...datos,
      codigo: String(datos.codigo || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24),
    }),
  },
};

/* ── Las rutas, las mismas para todas ──────────────────────────────── */

/** Arma el documento mirando SOLO los campos permitidos. */
async function armar(cosa, cuerpo, esNuevo) {
  const datos = {};

  for (const [campo, tipo] of Object.entries(cosa.campos)) {
    if (cuerpo[campo] === undefined) continue;
    datos[campo] = LIMPIAR[tipo](cuerpo[campo]);
  }

  if (esNuevo) {
    for (const campo of cosa.obligatorios || []) {
      if (datos[campo] === undefined || datos[campo] === "" || datos[campo] === null) {
        throw errorDe("INVALID_AMOUNT", { falta: campo });
      }
    }
  }

  return cosa.antesDeGuardar ? cosa.antesDeGuardar(datos) : datos;
}

router.post("/:cosa", async (req, res) => {
  try {
    const cosa = COSAS[req.params.cosa];
    if (!cosa) throw errorDe("NOT_FOUND");

    const datos = await armar(cosa, req.body, true);
    const creado = await cosa.modelo.create(datos);

    await admin.anotar({
      admin: req.user,
      evento: `${req.params.cosa}.create`,
      sobre: { tipo: req.params.cosa, id: creado._id, nombre: cosa.nombre(creado) },
      despues: datos,
      req,
    });

    return res.json({ success: true, data: creado });
  } catch (err) {
    if (err && err.code === 11000) return responderError(res, errorDe("CODE_ALREADY_USED"), "crear");
    return responderError(res, err, "crear");
  }
});

router.put("/:cosa/:id", async (req, res) => {
  try {
    const cosa = COSAS[req.params.cosa];
    if (!cosa) throw errorDe("NOT_FOUND");

    const actual = await cosa.modelo.findById(req.params.id).lean();
    if (!actual) throw errorDe("NOT_FOUND");
    if (cosa.sePuedeEditar && !cosa.sePuedeEditar(actual)) throw errorDe("ALREADY_CLAIMED");

    const datos = await armar(cosa, req.body, false);
    if (!Object.keys(datos).length) throw errorDe("INVALID_AMOUNT", { campos: 0 });

    await cosa.modelo.updateOne({ _id: actual._id }, { $set: datos }, { runValidators: true });

    const antes = {};
    for (const k of Object.keys(datos)) antes[k] = actual[k];

    await admin.anotar({
      admin: req.user,
      evento: `${req.params.cosa}.edit`,
      sobre: { tipo: req.params.cosa, id: actual._id, nombre: cosa.nombre(actual) },
      antes,
      despues: datos,
      req,
    });

    return res.json({ success: true, data: await cosa.modelo.findById(actual._id).lean() });
  } catch (err) {
    return responderError(res, err, "editar");
  }
});

/**
 * BORRAR.
 *
 * Pide motivo, como todo lo que no se puede deshacer. Una carrera ya
 * cerrada no se borra: es el comprobante de a quién se le pagó.
 */
router.delete("/:cosa/:id", async (req, res) => {
  try {
    const cosa = COSAS[req.params.cosa];
    if (!cosa) throw errorDe("NOT_FOUND");

    const actual = await cosa.modelo.findById(req.params.id).lean();
    if (!actual) throw errorDe("NOT_FOUND");
    if (actual.estado === "settled") throw errorDe("ALREADY_CLAIMED");

    const motivo = String(req.body.motivo || "").trim();
    if (motivo.length < 3) throw errorDe("REASON_REQUIRED");

    await cosa.modelo.deleteOne({ _id: actual._id });

    await admin.anotar({
      admin: req.user,
      evento: `${req.params.cosa}.delete`,
      sobre: { tipo: req.params.cosa, id: actual._id, nombre: cosa.nombre(actual) },
      antes: { existia: true },
      motivo,
      req,
    });

    return res.json({ success: true, data: { borrado: true } });
  } catch (err) {
    return responderError(res, err, "borrar");
  }
});

/* ── Los rangos VIP y las filas de la portada ──────────────────────── */

/**
 * LOS NUEVE RANGOS, EDITABLES.
 *
 * Estaban en el código. Ahora viven en las perillas: cuánto hay que
 * jugar para cada uno y cuánto devuelve. Si alguien los deja vacíos,
 * el servicio vuelve a los de fábrica (ver services/vip).
 */
router.put("/ranks", async (req, res) => {
  try {
    const filas = Array.isArray(req.body.rangos) ? req.body.rangos : [];
    if (!filas.length) throw errorDe("INVALID_AMOUNT", { rangos: 0 });

    const rangos = filas.map((r) => ({
      nombre: LIMPIAR.texto(r.nombre),
      desde: LIMPIAR.sc(r.desde),
      color: LIMPIAR.texto(r.color || "#3f7cf0"),
      rakebackSemanal: Number(r.rakebackSemanal) || 0,
    }));

    /* Tienen que ir de menor a mayor: con un umbral fuera de orden,
       alguien "sube" a un rango que pide menos de lo que ya jugó. */
    for (let i = 1; i < rangos.length; i += 1) {
      if (rangos[i].desde <= rangos[i - 1].desde) {
        throw errorDe("INVALID_AMOUNT", { rango: rangos[i].nombre });
      }
    }

    const antes = (await Settings.leer()).rangosVip || [];
    await Settings.updateOne({}, { $set: { rangosVip: rangos } }, { upsert: true });

    await admin.anotar({
      admin: req.user,
      evento: "ranks.edit",
      sobre: { tipo: "settings", nombre: "vip" },
      antes: { cuantos: antes.length },
      despues: { cuantos: rangos.length },
      req,
    });

    return res.json({ success: true, data: { rangos } });
  } catch (err) {
    return responderError(res, err, "ranks");
  }
});

/**
 * LAS FILAS DE LA PORTADA.
 *
 * Qué se muestra, en qué orden. Las reglas de cada fila siguen en el
 * código --"las 14 más abiertas" es una consulta, no un dato-- pero
 * esconder una o moverla ya no necesita un despliegue.
 */
router.put("/home", async (req, res) => {
  try {
    const filas = Array.isArray(req.body.filas) ? req.body.filas : [];
    if (!filas.length) throw errorDe("INVALID_AMOUNT", { filas: 0 });

    const portada = filas.map((f, i) => ({
      id: LIMPIAR.texto(f.id),
      orden: Number(f.orden) || i + 1,
      visible: LIMPIAR.siNo(f.visible),
    }));

    await Settings.updateOne({}, { $set: { portada } }, { upsert: true });

    await admin.anotar({
      admin: req.user,
      evento: "home.edit",
      sobre: { tipo: "settings", nombre: "home" },
      despues: { filas: portada.length },
      req,
    });

    return res.json({ success: true, data: { portada } });
  } catch (err) {
    return responderError(res, err, "home");
  }
});

/* ── El equipo ─────────────────────────────────────────────────────── */

/**
 * DARLE O SACARLE ACCESO A ALGUIEN.
 *
 * Solo el dueño, y nunca a sí mismo: un dueño que se saca el rango por
 * error deja el panel sin dueño, y eso se arregla con la base en la
 * mano.
 */
router.post("/team/:id", async (req, res) => {
  try {
    if (req.user.rank !== "owner") throw errorDe("NOT_LOGGED_IN", {}, 403);
    if (String(req.params.id) === String(req.user._id)) throw errorDe("NOT_ON_YOURSELF");

    const rango = String(req.body.rank || "user");
    if (!["user", "support", "admin", "owner"].includes(rango)) throw errorDe("INVALID_AMOUNT");

    const antes = await User.findById(req.params.id).select("username rank").lean();
    if (!antes) throw errorDe("NOT_FOUND");

    await User.updateOne({ _id: antes._id }, { $set: { rank: rango } });

    await admin.anotar({
      admin: req.user,
      evento: "team.rank",
      sobre: { tipo: "user", id: antes._id, nombre: antes.username },
      antes: { rank: antes.rank },
      despues: { rank: rango },
      req,
    });

    return res.json({ success: true, data: { rank: rango } });
  } catch (err) {
    return responderError(res, err, "team");
  }
});

module.exports = router;
module.exports.COSAS = COSAS;
