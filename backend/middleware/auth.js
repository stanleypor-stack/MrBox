const jwt = require("jsonwebtoken");
const User = require("../database/models/User");
const { errorDe } = require("../utils/errors");

/**
 * QUIEN ES EL QUE PIDE.
 *
 * La sesion viaja en la cabecera `x-auth-token`, igual que en BetSweeps.
 *
 * El token lleva SOLO el id. Nada de saldo, rango ni verificacion: eso
 * se lee de la base en cada pedido. Un token guarda lo que era verdad
 * cuando se firmo, y si adentro viajara el rango, alguien a quien se le
 * saco el acceso de admin seguiria entrando hasta que el token venza.
 */

const DIAS = 30;

function firmar(userId) {
  const secreto = process.env.JWT_SECRET;
  if (!secreto) throw new Error("Falta JWT_SECRET.");
  return jwt.sign({ id: String(userId) }, secreto, { expiresIn: `${DIAS}d` });
}

/**
 * @param {boolean} obligatorio  si `false`, deja pasar al visitante sin
 *   cuenta con `req.user = null`. Lo usan las pantallas que se pueden
 *   mirar sin registrarse.
 */
function autorizar(obligatorio = true) {
  return async (req, res, next) => {
    const token = req.headers["x-auth-token"];

    if (!token) {
      if (!obligatorio) { req.user = null; return next(); }
      const e = errorDe("NOT_LOGGED_IN", {}, 401);
      return res.status(401).json(e.aRespuesta());
    }

    try {
      const { id, iat } = jwt.verify(token, process.env.JWT_SECRET);
      const usuario = await User.findById(id)
        .select("+balanceSc +bonoPendienteSc")
        .lean();

      if (!usuario) throw new Error("no existe");

      /*
        UN TOKEN DE ANTES DEL CAMBIO DE CLAVE NO VALE.

        `iat` viene en segundos. Se descuenta uno para el borde: el
        token que se firma en el mismo segundo del cambio --el que se
        devuelve al cambiarla-- tiene que seguir sirviendo.
      */
      if (usuario.clavesDesde && iat) {
        const cambioEn = Math.floor(new Date(usuario.clavesDesde).getTime() / 1000);
        if (iat < cambioEn - 1) {
          const e = errorDe("SESSION_EXPIRED", {}, 401);
          return res.status(401).json(e.aRespuesta());
        }
      }

      /* Una cuenta cerrada no pasa, tenga el token que tenga. */
      if (usuario.banned) {
        const e = errorDe("ACCOUNT_BANNED", {}, 403);
        return res.status(403).json(e.aRespuesta());
      }

      req.user = usuario;
      return next();
    } catch {
      if (!obligatorio) { req.user = null; return next(); }
      const e = errorDe("SESSION_EXPIRED", {}, 401);
      return res.status(401).json(e.aRespuesta());
    }
  };
}

/** Solo para los que pueden entrar al panel. */
function soloAdmin(rangos = ["admin", "owner"]) {
  return (req, res, next) => {
    if (!req.user || !rangos.includes(req.user.rank)) {
      const e = errorDe("NOT_LOGGED_IN", {}, 403);
      return res.status(403).json(e.aRespuesta());
    }
    return next();
  };
}

module.exports = { firmar, autorizar, soloAdmin, DIAS };
