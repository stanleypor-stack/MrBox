const express = require("express");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");

const User = require("../../database/models/User");
const UserSeed = require("../../database/models/UserSeed");
const Settings = require("../../database/models/Settings");

const { firmar, autorizar } = require("../../middleware/auth");
const turnstile = require("../../services/turnstile");
const afiliados = require("../../services/affiliates");
const fair = require("../../services/boxes/fair");
const wallet = require("../../services/wallet");
const { errorDe, esDeJugador } = require("../../utils/errors");
const { logger } = require("../../utils/logger");

const router = express.Router();

/**
 * REGISTRO Y ENTRADA.
 *
 * Las dos puertas del sitio, y las dos que más se golpean: son donde se
 * prueban contraseñas y donde se arman cuentas en masa. Por eso las dos
 * tienen captcha y límite de pedidos, y por eso ninguna de las dos
 * cuenta de más sobre lo que pasó.
 */

/*
  EL LIMITE DE INTENTOS.

  Diez por cuarto de hora por direccion. No molesta a nadie real --quien
  se equivoca de contrasena lo hace dos o tres veces-- y le arruina el dia
  a quien prueba una lista.

  Se puede subir con AUTH_RATE_LIMIT. Hace falta por dos motivos de
  verdad, no para las pruebas: detras de un NAT grande --una universidad,
  una oficina, un pais entero con CGNAT-- miles de personas comparten
  direccion, y diez intentos entre todas es poco. Y al reves: si aparece
  una ola de registros falsos, se puede bajar sin desplegar.
*/
const limite = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json(errorDe("RATE_LIMITED", {}, 429).aRespuesta()),
});

/* Reglas de forma. Cortas a propósito: cada regla de más es gente que
   no se registra. */
const USUARIO_OK = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CLAVE_MINIMA = 8;

function responderError(res, err, donde) {
  if (esDeJugador(err)) return res.status(err.status || 400).json(err.aRespuesta());
  logger.error(`[auth] ${donde}:`, err.message);
  return res.status(500).json(errorDe("SOMETHING_WENT_WRONG", {}, 500).aRespuesta());
}

/** Lo que se le cuenta al navegador sobre su propia cuenta. */
async function retrato(userId) {
  const u = await User.findById(userId).lean();
  const saldo = await wallet.saldoDe(userId);
  return {
    _id: u._id,
    username: u.username,
    email: u.email,
    avatarUrl: u.avatarUrl,
    rank: u.rank,
    verificationLevel: u.verificationLevel,
    freeOpens: u.freeOpens,
    jugadoSc: u.jugadoSc,
    affiliateCode: u.affiliateCode,
    createdAt: u.createdAt,
    ...saldo,
  };
}

/* ── Registro ─────────────────────────────────────────────────────── */

router.post("/register", limite, async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const codigo = String(req.body.affiliateCode || "").trim();

    if (!USUARIO_OK.test(username)) {
      throw errorDe("INVALID_AMOUNT", { campo: "username" });
    }
    if (!EMAIL_OK.test(email)) {
      throw errorDe("INVALID_AMOUNT", { campo: "email" });
    }
    if (password.length < CLAVE_MINIMA) {
      throw errorDe("BELOW_MINIMUM", { campo: "password", minimo: CLAVE_MINIMA });
    }

    const captcha = await turnstile.comprobar(req.body.captchaToken, req.ip);
    if (!captcha.ok) throw errorDe("CAPTCHA_FAILED", {});

    /*
      Se pregunta antes para poder decir CUAL de los dos está tomado. El
      índice único de la base es el que de verdad lo impide —dos
      registros al mismo tiempo pasarían esta pregunta— así que abajo se
      atrapa igual el error de la base.
    */
    if (await User.exists({ username })) throw errorDe("USERNAME_TAKEN");
    if (await User.exists({ email })) throw errorDe("EMAIL_TAKEN");

    const cfg = await Settings.leer();
    const passwordHash = await bcrypt.hash(password, 12);

    let usuario;
    try {
      usuario = await User.create({
        username,
        email,
        passwordHash,
        freeOpens: cfg.aperturasDeRegalo || 0,
      });
    } catch (err) {
      /* 11000 es "ya existe". Llega acá cuando dos registros entraron
         juntos y la pregunta de arriba no alcanzó. */
      if (err && err.code === 11000) {
        const campo = Object.keys(err.keyPattern || {})[0];
        throw errorDe(campo === "email" ? "EMAIL_TAKEN" : "USERNAME_TAKEN");
      }
      throw err;
    }

    /*
      LAS SEMILLAS, DESDE EL MINUTO CERO.

      Se crean junto con la cuenta y no la primera vez que abre una caja:
      así el jugador puede mirar el hash de su semilla ANTES de jugar,
      que es lo único que hace verificable al sorteo.
    */
    const semillaServidor = fair.semillaNueva();
    await UserSeed.create({
      user: usuario._id,
      semillaServidor,
      semillaServidorHash: fair.hashDeSemilla(semillaServidor),
      semillaCliente: fair.semillaNueva().slice(0, 16),
      nonce: 0,
      activa: true,
    });

    const socio = codigo ? await afiliados.atarAlSocio(usuario, codigo) : null;

    return res.status(201).json({
      success: true,
      token: firmar(usuario._id),
      user: await retrato(usuario._id),
      /* Si puso un código que no sirve, se le dice: se registró igual,
         pero tiene que saber que no le quedó aplicado. */
      affiliate: socio
        ? { code: socio.code, bono: await afiliados.bonoDe(socio) }
        : codigo
          ? { code: null, invalido: codigo }
          : null,
    });
  } catch (err) {
    return responderError(res, err, "register");
  }
});

/* ── Entrada ──────────────────────────────────────────────────────── */

router.post("/login", limite, async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    const captcha = await turnstile.comprobar(req.body.captchaToken, req.ip);
    if (!captcha.ok) throw errorDe("CAPTCHA_FAILED", {});

    const usuario = await User.findOne({ email }).select("+passwordHash").lean();

    /*
      MISMO ERROR PARA LAS DOS COSAS.

      "Ese email no existe" le dice a quien prueba cuáles de su lista son
      cuentas de verdad. Con un solo mensaje para los dos casos, probar
      no le dice nada.

      Y se compara igual aunque el email no exista: si saliéramos antes,
      el pedido tardaría menos y el tiempo de respuesta contaría lo que
      el mensaje calla.
    */
    const hash = (usuario && usuario.passwordHash) || "$2a$12$" + "x".repeat(53);
    const coincide = await bcrypt.compare(password, hash);

    if (!usuario || !coincide) throw errorDe("BAD_CREDENTIALS", {}, 401);
    if (usuario.banned) throw errorDe("ACCOUNT_BANNED", {}, 403);

    await User.updateOne({ _id: usuario._id }, { $set: { lastSeenAt: new Date() } });

    return res.json({
      success: true,
      token: firmar(usuario._id),
      user: await retrato(usuario._id),
    });
  } catch (err) {
    return responderError(res, err, "login");
  }
});

/* ── Quién soy ────────────────────────────────────────────────────── */

router.get("/me", autorizar(true), async (req, res) => {
  try {
    return res.json({ success: true, user: await retrato(req.user._id) });
  } catch (err) {
    return responderError(res, err, "me");
  }
});

module.exports = router;
