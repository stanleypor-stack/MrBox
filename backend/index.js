/*
  El `.env` se busca AL LADO de este archivo, no en el directorio desde
  donde se arranco. Arrancar el servidor parado en otra carpeta pasa todo
  el tiempo --un script, el editor, una configuracion de despliegue-- y
  ahi `dotenv` no encuentra nada: el servidor levanta sin variables y se
  cae diciendo que falta la base, que no es el problema de verdad.
*/
require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");

const { conectar } = require("./database");
const { logger } = require("./utils/logger");
const { errorDe } = require("./utils/errors");

/**
 * EL SERVIDOR DE MR BOX.
 */

const app = express();

/*
  `trust proxy` en 1: en Render el pedido llega por un proxy, y sin esto
  `req.ip` es siempre la del proxy. El limite de intentos quedaria
  contando a todo el mundo junto, y el primero que se equivoca de
  contrasena dejaria afuera a todos los demas.
*/
app.set("trust proxy", 1);

app.use(cors());
/* Un cuerpo de mas de esto no es un pedido de este sitio, es un ataque. */
app.use(express.json({ limit: "200kb" }));

app.use("/api", require("./routes"));

/* Lo que no existe contesta como lo que existe, en el mismo formato. */
app.use((req, res) => res.status(404).json(errorDe("SOMETHING_WENT_WRONG", { ruta: req.path }, 404).aRespuesta()));

/*
  LA RED DE SEGURIDAD.

  Si algo exploto sin que nadie lo atrape, acá se registra entero y al
  navegador le llega un mensaje generico. El detalle de un error de la
  base no puede salir del servidor: suele traer nombres de campos y a
  veces datos de alguien.
*/
app.use((err, req, res, _next) => {
  logger.error("[sin atrapar]", err && err.stack ? err.stack : err);
  res.status(500).json(errorDe("SOMETHING_WENT_WRONG", {}, 500).aRespuesta());
});

async function arrancar() {
  const base = await conectar();
  const puerto = Number(process.env.PORT) || 5001;
  app.listen(puerto, () => {
    logger.info(`MR BOX escuchando en ${puerto}, contra la base "${base}"`);
  });
}

if (require.main === module) {
  arrancar().catch((e) => {
    logger.error("no arranco:", e.message);
    process.exit(1);
  });
}

module.exports = { app, arrancar };
