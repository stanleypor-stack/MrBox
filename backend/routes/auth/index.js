const express = require("express");
const bcrypt = require("bcryptjs");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

const User = require("../../database/models/User");
const SessionEvent = require("../../database/models/SessionEvent");
const UserSeed = require("../../database/models/UserSeed");
const Settings = require("../../database/models/Settings");

const { firmar, autorizar } = require("../../middleware/auth");
const turnstile = require("../../services/turnstile");
const afiliados = require("../../services/affiliates");
const cajas = require("../../services/boxes");
const google = require("../../services/google");
const fair = require("../../services/boxes/fair");
const vip = require("../../services/vip");
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

  /*
    LA LLAVE NO ES SOLO LA IP.

    `req.ip` sale de `X-Forwarded-For` cuando hay proxy, y si el numero
    de saltos quedo mal puesto, el que prueba contraseñas se inventa una
    IP distinta en cada intento y no lo frena nadie. Medido: 20 de 20
    pasaron rotando la cabecera.

    Sumando a quien apunta --el mail o el usuario del cuerpo-- esa parte
    de la llave ya no la elige el atacante: puede cambiar de IP todo lo
    que quiera, pero si sigue probando contra la misma cuenta, cuenta.

    Y al reves, el de la oficina con NAT compartido no queda afuera
    porque el de al lado se equivoco: son cuentas distintas.
  */
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req);
    const cuerpo = req.body || {};
    const apunta = String(cuerpo.email || cuerpo.username || "").trim().toLowerCase().slice(0, 80);
    return apunta ? `${ip}|${apunta}` : ip;
  },

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
    demosUsadas: u.demosUsadas || 0,
    jugadoSc: u.jugadoSc,
    /* Lo jugado MAS el piso del rango puesto a mano: es lo que muestra
       la barra del Club VIP y la del perfil. `jugadoSc` sigue siendo lo
       que de verdad jugo, que es lo que usan las carreras. */
    jugadoVipSc: vip.jugadoParaVip(u),
    affiliateCode: u.affiliateCode,
    createdAt: u.createdAt,
    ...saldo,
  };
}

/* ── Registro ─────────────────────────────────────────────────────── */

/**
 * ANOTA QUE ALGUIEN ENTRO A SU CUENTA.
 *
 * Es lo que ve el jugador en la pestaña Activity del perfil, y la única
 * forma que tiene de darse cuenta de que le entraron antes de que le
 * vacíen el saldo.
 *
 * Va en su propio try y sin esperar a que termine la respuesta: que
 * falle anotar un ingreso no puede impedir el ingreso.
 */
async function anotarSesion(userId, req, tipo) {
  try {
    await SessionEvent.create({
      user: userId,
      tipo,
      dispositivo: SessionEvent.resumirDispositivo(req.get("user-agent")),
      desde: SessionEvent.recortarIp(req.ip),
    });
  } catch (err) {
    logger.error(`[auth] anotar sesion: ${err.message}`);
  }
}

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

    const passwordHash = await bcrypt.hash(password, 12);

    let usuario;
    try {
      usuario = await User.create({ username, email, passwordHash });
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

    /*
      LAS TRES CAJAS DE REGALO.

      No son tres fichas sueltas: son UNA apertura en cada una de tres
      cajas, como en el prototipo. Con fichas, alguien abria tres veces
      la mas cara de las tres (ver services/boxes).
    */
    /*
      LAS TRES CAJAS DE REGALO, AL REGISTRARSE.

      Son del registro y de nadie mas: el que deposita se lleva el
      bono, que es otra cosa. Separar las dos promesas hace que cada
      una se entienda sola.
    */
    await cajas.regalarCajasDeBienvenida(usuario._id);

    const socio = codigo ? await afiliados.atarAlSocio(usuario, codigo) : null;
    await anotarSesion(usuario._id, req, "register");

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

/* ── Entrar con Google ────────────────────────────────────────────── */

/**
 * UNA SOLA PUERTA PARA ENTRAR Y PARA REGISTRARSE.
 *
 * El botón de Google no sabe --ni tiene por qué saber-- si la persona
 * ya tiene cuenta. Manda el token y acá se resuelve: si ya existe,
 * entra; si no, se crea. Dos botones distintos, "entrar con Google" y
 * "registrarse con Google", solo sirven para que alguien elija el
 * equivocado y reciba un error que no entiende.
 *
 * NO LLEVA CAPTCHA, Y ESTÁ BIEN.
 *
 * El captcha está para frenar el alta masiva de cuentas. Para llegar
 * acá hace falta un token que firmó Google, y para tenerlo hace falta
 * una cuenta de Google de verdad: el trabajo de crear cuentas en masa
 * ya lo hace Google, mejor que nosotros.
 *
 * LAS TRES SITUACIONES
 *
 *   ya entró antes con Google   se busca por `googleId` y entra
 *   tiene cuenta con ese mail   se le ATA la cuenta de Google a la que
 *                               ya tiene. Crear una segunda con el
 *                               mismo mail es partir a la persona en
 *                               dos: dos saldos, dos inventarios, y
 *                               soporte teniendo que fusionarlas.
 *   no tiene nada               se crea, igual que un registro normal:
 *                               semillas, tres cajas de regalo y, si
 *                               vino con código, su socio.
 */
router.post("/google", limite, async (req, res) => {
  try {
    if (!google.configurado()) throw errorDe("NOT_FOUND");

    let quien;
    try {
      quien = await google.quienEs(req.body.credential);
    } catch (err) {
      /* El detalle va al registro nuestro, no al jugador: "el token no
         trae kid" no le dice nada a nadie. */
      logger.warn(`[auth] token de google rechazado: ${err.message}`);
      throw errorDe("GOOGLE_FAILED");
    }

    /* ── 1. ¿Ya entró antes con esta cuenta de Google? ───────────── */
    let usuario = await User.findOne({ googleId: quien.sub });

    /* ── 2. ¿Tiene cuenta nuestra con ese mail? ──────────────────── */
    if (!usuario && quien.email && quien.emailVerificado) {
      usuario = await User.findOne({ email: quien.email });

      if (usuario) {
        /*
          Se le ata y listo. La condición `googleId: null` va en el
          filtro: si dos pedidos llegan juntos, uno ata y el otro no
          pisa nada.
        */
        await User.updateOne(
          { _id: usuario._id, googleId: null },
          { $set: { googleId: quien.sub } }
        );
      }
    }

    /* ── 3. No existe: se crea ───────────────────────────────────── */
    let reciénCreada = false;

    if (!usuario) {
      if (!quien.email || !quien.emailVerificado) {
        /* Sin un mail verificado no hay con qué armar la cuenta, y
           tampoco se podría recuperar nunca. */
        throw errorDe("GOOGLE_NO_EMAIL");
      }

      const username = await nombreLibre(quien.nombre || quien.email.split("@")[0]);

      try {
        usuario = await User.create({
          username,
          email: quien.email,
          googleId: quien.sub,
          /* Sin contraseña: entra con Google. Puede ponerse una
             después, desde el perfil. */
          passwordHash: "",
          avatarUrl: quien.foto || "",
        });
        reciénCreada = true;
      } catch (err) {
        /*
          Dos entradas al mismo tiempo con la misma cuenta de Google.
          La que perdió busca la que ganó en vez de devolver un error:
          la persona hizo una sola cosa, y las semillas y las cajas ya
          se las dio la que gano.
        */
        if (err && err.code === 11000) {
          usuario = await User.findOne({ googleId: quien.sub })
            || await User.findOne({ email: quien.email });
          if (!usuario) throw err;
        } else {
          throw err;
        }
      }
    }

    /* ── Lo que lleva toda cuenta nueva ──────────────────────────── */
    if (reciénCreada) {
      const semillaServidor = fair.semillaNueva();
      await UserSeed.create({
        user: usuario._id,
        semillaServidor,
        semillaServidorHash: fair.hashDeSemilla(semillaServidor),
        semillaCliente: fair.semillaNueva().slice(0, 16),
        nonce: 0,
        activa: true,
      });

      await cajas.regalarCajasDeBienvenida(usuario._id);
    }

    const codigo = String(req.body.affiliateCode || "").trim();
    const socio = reciénCreada && codigo ? await afiliados.atarAlSocio(usuario, codigo) : null;

    await anotarSesion(usuario._id, req, reciénCreada ? "register" : "login");

    return res.status(reciénCreada ? 201 : 200).json({
      success: true,
      token: firmar(usuario._id),
      user: await retrato(usuario._id),
      nueva: reciénCreada,
      affiliate: socio ? { code: socio.code, bono: await afiliados.bonoDe(socio) } : null,
    });
  } catch (err) {
    return responderError(res, err, "google");
  }
});

/**
 * UN NOMBRE DE USUARIO LIBRE, A PARTIR DEL DE GOOGLE.
 *
 * Google da un nombre de persona --"Dani Pérez"-- y nosotros pedimos
 * un nick. Se limpia a lo que el sitio admite y, si está tomado, se le
 * agrega un número hasta encontrar uno libre.
 *
 * El `while` tiene techo: sin él, una base con un problema raro lo
 * dejaría girando para siempre adentro de un pedido HTTP.
 */
async function nombreLibre(base) {
  let limpio = String(base)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .slice(0, 16);

  if (limpio.length < 3) limpio = `jugador${Math.floor(Math.random() * 900 + 100)}`;

  if (!(await User.exists({ username: limpio }))) return limpio;

  for (let i = 0; i < 40; i += 1) {
    const sufijo = String(Math.floor(Math.random() * 9000) + 1000);
    const intento = `${limpio.slice(0, 20 - sufijo.length)}${sufijo}`;
    if (!(await User.exists({ username: intento }))) return intento;
  }

  throw errorDe("USERNAME_TAKEN");
}

/* ── Entrada ──────────────────────────────────────────────────────── */

router.post("/login", limite, async (req, res) => {
  try {
    const escrito = String(req.body.email || "").trim();
    const password = String(req.body.password || "");

    const captcha = await turnstile.comprobar(req.body.captchaToken, req.ip);
    if (!captcha.ok) throw errorDe("CAPTCHA_FAILED", {});

    /*
      ENTRA CON EL EMAIL O CON EL NOMBRE DE USUARIO.

      La pantalla dice "email o nombre de usuario" --y es lo que
      cualquiera espera-- pero acá se buscaba SOLO por email: el que se
      acordaba de su nombre y no del email no podía entrar nunca, y el
      mensaje que le salía era "email o contraseña incorrectos".

      La arroba es lo que decide cuál de las dos cosas es. Un nombre de
      usuario no puede llevarla (ver USUARIO_OK), así que no hay caso
      ambiguo.

      El nombre se compara sin distinguir mayúsculas, que es como lo
      escribe la gente.
    */
    const esEmail = escrito.includes("@");
    const busqueda = esEmail ? { email: escrito.toLowerCase() } : { username: escrito };

    /*
      La comparacion va con `collation` y no con una expresion regular:
      el nombre se escribe como se escribe --dani, Dani, DANI-- y asi no
      hay texto del jugador metido adentro de un patron.
    */
    const usuario = escrito
      ? await User.findOne(busqueda)
        .collation({ locale: "en", strength: 2 })
        .select("+passwordHash")
        .lean()
      : null;

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
    await anotarSesion(usuario._id, req, "login");

    return res.json({
      success: true,
      token: firmar(usuario._id),
      user: await retrato(usuario._id),
    });
  } catch (err) {
    return responderError(res, err, "login");
  }
});

/* ── Cambiar la contraseña ────────────────────────────────────────── */

/**
 * CAMBIARLA ECHA A TODAS LAS DEMAS SESIONES.
 *
 * Es el punto de cambiarla. Si el que te la robo sigue adentro con su
 * token de hace una semana, cambiarla no sirvio de nada.
 *
 * Pide la vieja: sin eso, cualquiera que te agarre el teléfono
 * desbloqueado se queda con la cuenta para siempre.
 */
router.put("/password", autorizar(true), limite, async (req, res) => {
  try {
    const actual = String(req.body.actual || "");
    const nueva = String(req.body.nueva || "");

    if (nueva.length < CLAVE_MINIMA) {
      throw errorDe("INVALID_AMOUNT", { campo: "nueva", minimo: CLAVE_MINIMA });
    }

    if (nueva === actual) throw errorDe("INVALID_AMOUNT", { campo: "nueva" });

    const usuario = await User.findById(req.user._id).select("+passwordHash");
    if (!usuario) throw errorDe("NOT_LOGGED_IN", {}, 401);

    /*
      EL QUE ENTRA CON GOOGLE TODAVIA NO TIENE CONTRASENA.

      Entonces no hay "contrasena actual" que pedirle: esto no es
      cambiarla, es ponerle una por primera vez. Pedirle la que no
      tiene lo dejaria sin poder ponerse ninguna.

      No se pierde nada: para llegar hasta aca ya tiene la sesion
      abierta, que es mas de lo que da una contrasena.
    */
    const cierra = usuario.passwordHash
      ? await bcrypt.compare(actual, usuario.passwordHash)
      : true;
    if (!cierra) throw errorDe("BAD_CREDENTIALS", {}, 401);

    usuario.passwordHash = await bcrypt.hash(nueva, 12);
    /* Todo token firmado antes de esto deja de valer. */
    usuario.clavesDesde = new Date();
    await usuario.save();

    await anotarSesion(usuario._id, req, "password");

    /* Y se devuelve uno nuevo, para que el que la cambió no se quede
       afuera de su propia sesión. */
    return res.json({ success: true, token: firmar(usuario._id) });
  } catch (err) {
    return responderError(res, err, "password");
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
