/**
 * EL REGISTRO DEL SERVIDOR.
 *
 * Sencillo a proposito. Lo unico que agrega sobre `console` es la hora y
 * el nivel, que son las dos cosas que uno siempre termina queriendo
 * cuando lee un registro viejo.
 */
const NIVELES = { error: 0, warn: 1, info: 2, debug: 3 };
const nivelActual = NIVELES[process.env.LOG_LEVEL] ?? NIVELES.info;

function escribir(nivel, args) {
  if (NIVELES[nivel] > nivelActual) return;
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

module.exports = { logger };
