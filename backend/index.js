/*
  El `.env` se busca AL LADO de este archivo, no en el directorio desde
  donde se arranco. Arrancar el servidor parado en otra carpeta pasa todo
  el tiempo --un script, el editor, una configuracion de despliegue-- y
  ahi `dotenv` no encuentra nada: el servidor levanta sin variables y se
  cae diciendo que falta la base, que no es el problema de verdad.
*/
require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const path = require("path");
const fs = require("fs");

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const compression = require("compression");

const { conectar } = require("./database");
const carreras = require("./services/races");
const afiliados = require("./services/affiliates");
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
/*
  CUANTOS SALTOS HAY ANTES DE NOSOTROS.

  Con el numero mal puesto el freno de intentos no sirve, para un lado
  o para el otro: de menos, el cliente elige su propia `req.ip`
  mandando `X-Forwarded-For` y nunca lo frena nada; de mas, todos
  cuentan como la misma IP y el primero que se equivoca de contraseña
  deja afuera a todos los demas.

  En Render es 1. Si manana entra Cloudflare adelante son 2, y eso se
  cambia acá sin tocar el codigo.
*/
app.set("trust proxy", Number(process.env.PROXIES_DELANTE ?? 1));

/*
  DE DONDE SE PUEDE LLAMAR A LA API.

  En produccion el sitio y la API viven en el mismo dominio, asi que no
  hace falta que ningun otro origen pueda llamarla: `SITIO_URL` dice
  cual es el nuestro y el resto queda afuera. Sin esa variable --o en
  desarrollo, donde el sitio corre en otro puerto-- se deja pasar a
  todos, que es lo que hacia siempre.

  Como la sesion viaja en una cabecera y no en una cookie, esto no es
  lo que impide un CSRF: eso ya estaba resuelto. Es una puerta menos.
*/
const ORIGENES = String(process.env.SITIO_URL || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

/*
  SIN `SITIO_URL` NO SE ARRANCA EN PRODUCCION.

  `cors({})` es `origin: "*"`. Olvidarse la variable al desplegar
  dejaba la API abierta a cualquier pagina, que es fallar ABIERTO en la
  variable mas facil de olvidar. Ahora falla fuerte y a la vista.

  En desarrollo el sitio corre en otro puerto y el comodin hace falta,
  asi que se permite con `PERMITIR_CUALQUIER_ORIGEN=1` a mano.
*/
if (!ORIGENES.length && process.env.PERMITIR_CUALQUIER_ORIGEN !== "1") {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Falta SITIO_URL. Sin ella el CORS queda abierto a cualquier origen. " +
      "Si de verdad lo querés así, poné PERMITIR_CUALQUIER_ORIGEN=1."
    );
  }
  logger.warn("[cors] sin SITIO_URL: abierto a cualquier origen (está bien en desarrollo)");
}

app.use(cors(ORIGENES.length ? { origin: ORIGENES } : {}));

/*
  TODO VIAJA COMPRIMIDO.

  El javascript del sitio son 500 KB de texto que gzip deja en 150. En
  una conexion de telefono eso es un segundo y medio menos de pantalla
  en blanco, y no cuesta nada: lo hace el servidor al vuelo.

  Las imagenes ya vienen comprimidas (webp) y `compression` las saltea
  solo, asi que no se gasta tiempo en recomprimir lo que no baja.
*/
app.use(compression());

/*
  LAS CABECERAS QUE NO CUESTAN NADA.

  `frameguard` es la que importa en un sitio con botones de plata: sin
  ella, esto se puede meter adentro de un iframe en otra pagina,
  taparlo con algo y hacer que el jugador toque "Pedir el retiro"
  creyendo que toca otra cosa.

  El CSP queda apagado: el frontend de desarrollo usa `eval` y estilos
  en linea, y un CSP que hay que apagar a mano en desarrollo es un CSP
  que alguien va a dejar apagado en produccion. Va cuando el sitio se
  sirva construido.
*/
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

/*
  EL CUERPO: 200 KB, SALVO DONDE SE SUBEN ARCHIVOS.

  Las fotos del documento y los logos de las cajas viajan adentro del
  JSON como `data:`, asi que esas dos rutas necesitan lugar. El resto
  del sitio no manda nunca mas de unos kilobytes, y dejarlo en 200 KB
  es lo que hace que un cuerpo enorme en cualquier otro lado no sea un
  problema.
*/
const SUBEN_ARCHIVOS = [/^\/api\/profile\/verification(\/|$)/, /^\/api\/community(\/|$)/];
const cuerpoChico = express.json({ limit: "200kb" });
const cuerpoGrande = express.json({ limit: "12mb" });

/*
  EL AVISO DE LA PASARELA NO PASA POR ACA.

  Se firma sobre los BYTES. Si este parser se come el cuerpo, la ruta
  solo puede reconstruirlo con `JSON.stringify`, que no devuelve los
  mismos bytes, y la firma deja de significar nada. Lo lee el
  `express.raw` de su propia ruta.
*/
const CRUDO = /^\/api\/hooks(\/|$)/;

app.use((req, res, next) => {
  if (CRUDO.test(req.path)) return next();
  const grande = SUBEN_ARCHIVOS.some((r) => r.test(req.path));
  return (grande ? cuerpoGrande : cuerpoChico)(req, res, next);
});

app.use("/api", require("./routes"));

/*
  EL SITIO CONSTRUIDO, SI ESTA.

  En produccion este mismo servidor sirve el `dist` del frontend: una
  sola cosa que arrancar, un solo dominio, y nada de CORS entre el
  sitio y su API. En desarrollo la carpeta no existe y esto no hace
  nada, porque ahi el sitio lo sirve el servidor de Vue con recarga en
  caliente.

  LOS ARCHIVOS CON HASH SE GUARDAN UN AÑO

  `app.1a2b3c.js` no cambia nunca --si cambia el contenido cambia el
  nombre-- asi que el navegador no tiene por que volver a pedirlo. El
  `index.html` es el unico que NO se guarda: es el que dice cuales son
  los nombres de hoy.
*/
const dist = path.join(__dirname, "..", "frontend", "dist");

if (fs.existsSync(dist)) {
  app.use(express.static(dist, {
    index: false,
    setHeaders(res, ruta) {
      const guardable = /[.-][0-9a-f]{8,}\.[a-z0-9]+$/i.test(ruta) || /\.(webp|png|jpg|svg|otf|woff2?)$/i.test(ruta);
      res.setHeader("Cache-Control", guardable ? "public, max-age=31536000, immutable" : "no-cache");
    },
  }));

  /* Cualquier direccion del sitio la resuelve el router del navegador. */
  app.get(/^(?!\/api\/).*/, (req, res, next) => {
    if (req.method !== "GET") return next();
    return res.sendFile(path.join(dist, "index.html"));
  });
}

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
  /*
    UN CUERPO QUE NO ENTRA NO ES UN ERROR DEL SERVIDOR.

    body-parser tira con `status` propio --413 si se paso del limite,
    400 si el JSON esta roto-- y contestarlos como 500 confunde al
    cliente y escribe un stack entero cada vez, que es una forma comoda
    de empujar fuera del registro las lineas que importan.
  */
  const suyo = err && Number(err.status || err.statusCode);

  if (suyo === 413) {
    return res.status(413).json(errorDe("FILE_TOO_BIG", {}, 413).aRespuesta());
  }

  if (suyo === 400 && err.type === "entity.parse.failed") {
    return res.status(400).json(errorDe("INVALID_AMOUNT", { campo: "body" }, 400).aRespuesta());
  }

  logger.error("[sin atrapar]", err && err.stack ? err.stack : err);
  res.status(500).json(errorDe("SOMETHING_WENT_WRONG", {}, 500).aRespuesta());
});

/*
  EL PISO DE LAS CARRERAS.

  Una carrera se cierra sola cuando alguien la mira despues de su hora,
  que cubre el 99% de los casos. Esto es para el 1%: la diaria que
  vence a las tres de la manana de un martes sin nadie conectado.

  Una vuelta por hora alcanza y no cuesta nada: cuando no hay nada
  vencido es una consulta que no devuelve filas.

  `unref()` para que este reloj no sea razon suficiente para que el
  proceso siga vivo: si todo lo demas termino, que termine.
*/
function revisarLasCarreras() {
  const UNA_HORA = 60 * 60 * 1000;

  const vuelta = async () => {
    try {
      await carreras.ponerAlDia();
    } catch (err) {
      logger.error(`[races] la vuelta de la hora: ${err.message}`);
    }

    /*
      Y LOS PAGOS POR CABEZA QUE YA CUMPLIERON LA ESPERA.

      Va en la misma vuelta porque es lo mismo: algo que vence a una hora
      en la que no hay nadie mirando. Las que tienen señales NO se pagan
      acá; esperan a que una persona las mire en el panel.
    */
    try {
      await afiliados.liberarCalificados();
    } catch (err) {
      logger.error(`[afiliados] la vuelta de la hora: ${err.message}`);
    }
  };

  vuelta();
  const reloj = setInterval(vuelta, UNA_HORA);
  if (reloj.unref) reloj.unref();
}

async function arrancar() {
  const base = await conectar();
  const puerto = Number(process.env.PORT) || 5001;
  app.listen(puerto, () => {
    logger.info(`MR BOX escuchando en ${puerto}, contra la base "${base}"`);
    revisarLasCarreras();
  });
}

if (require.main === module) {
  arrancar().catch((e) => {
    logger.error("no arranco:", e.message);
    process.exit(1);
  });
}

module.exports = { app, arrancar };
