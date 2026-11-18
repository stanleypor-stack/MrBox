/**
 * EL REGISTRO DEL SERVIDOR.
 *
 * Sencillo a proposito. Lo unico que agrega sobre `console` es la hora y
 * el nivel, que son las dos cosas que uno siempre termina queriendo
 * cuando lee un registro viejo.
 *
 * Y LAS ULTIMAS DOSCIENTAS, EN MEMORIA
 *
 * El panel tiene una pantalla de registro. Sin esto, esa pantalla
 * tendria que leer un archivo que en Render no existe --alla el registro
 * es la salida del proceso-- asi que se guardan las ultimas doscientas
 * lineas en memoria y listo.
 *
 * Doscientas y no dos mil: es para mirar que acaba de pasar cuando algo
 * se rompe, no para auditar. Lo que hay que poder auditar --quien toco
 * que en el panel, cada movimiento de saldo-- vive en la base, no aca.
 */
const NIVELES = { error: 0, warn: 1, info: 2, debug: 3 };
const nivelActual = NIVELES[process.env.LOG_LEVEL] ?? NIVELES.info;

const CUANTAS_GUARDA = 200;
const ultimas = [];

function recordar(nivel, args) {
  const texto = args
    .map((a) => {
      if (a instanceof Error) return a.message;
      if (a && typeof a === "object") {
        try { return JSON.stringify(a); } catch { return String(a); }
      }
      return String(a);
    })
    .join(" ");

  /* El origen es lo que va entre corchetes: "[vip] tabla: ..." */
  const marca = texto.match(/^\[([a-z0-9._-]+)\]\s*/i);

  ultimas.push({
    cuando: new Date(),
    nivel,
    origen: marca ? marca[1] : "server",
    texto: marca ? texto.slice(marca[0].length) : texto,
  });

  if (ultimas.length > CUANTAS_GUARDA) ultimas.splice(0, ultimas.length - CUANTAS_GUARDA);
}

function escribir(nivel, args) {
  if (NIVELES[nivel] > nivelActual) return;
  recordar(nivel, args);

  const hora = new Date().toISOString();
  const salida = nivel === "error" ? console.error : console.log;
  salida(`${hora} ${nivel.toUpperCase().padEnd(5)}`, ...args);
}

const logger = {
  error: (...a) => escribir("error", a),
  warn: (...a) => escribir("warn", a),
  info: (...a) => escribir("info", a),
  debug: (...a) => escribir("debug", a),
};

/** Lo ultimo que paso, de lo mas nuevo a lo mas viejo. */
function ultimasLineas(cuantas = 100, nivel = "") {
  const lista = nivel ? ultimas.filter((l) => l.nivel === nivel) : ultimas;
  return lista.slice(-cuantas).reverse();
}

module.exports = { logger, ultimasLineas, CUANTAS_GUARDA };
