const mongoose = require("mongoose");

/**
 * LA CONEXION A LA BASE.
 *
 * Una sola, compartida. Mongoose maneja el pool solo; abrir conexiones
 * por pedido es la forma más rápida de quedarse sin ninguna.
 */

/*
  Se exige que la dirección esté. Un valor por defecto que apunte a algún
  lado es peligroso: el día que falte la variable en el servidor, en vez
  de romper fuerte y a la vista, el sitio arranca contra una base vacía y
  parece que se borraron todos los jugadores.
*/
async function conectar() {
  const uri = process.env.DATABASE_URI;
  if (!uri) {
    throw new Error("Falta DATABASE_URI. Copiá backend/.env.example a backend/.env.");
  }

  mongoose.set("strictQuery", true);

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });

  await asegurarIndices();

  const nombre = mongoose.connection.name;
  return nombre;
}

/**
 * ESPERAR A QUE LOS INDICES ESTEN, ANTES DE ATENDER A NADIE.
 *
 * Mongoose los construye solo, pero en segundo plano: entre que la
 * conexion abre y que el indice unico existe hay una ventana, y en esa
 * ventana el indice no rechaza nada.
 *
 * Eso no es un detalle: varias de las garantias de plata de este
 * backend no son un `if`, son un indice unico --que un aviso de pago no
 * acredite dos veces, que un codigo promocional no se canjee dos veces,
 * que nadie pise el codigo de otro socio--. Arrancar antes de que
 * existan es arrancar sin esas garantias.
 *
 * Si alguno no se puede construir --datos repetidos de antes, por
 * ejemplo-- se rompe fuerte y a la vista. Un sitio que atiende sin sus
 * indices unicos es peor que un sitio que no arranca: el primero pierde
 * plata en silencio.
 */
async function asegurarIndices() {
  /* `createIndexes` y no `init`: `init` guarda su promesa y no vuelve a
     construir nada, asi que despues de un `dropDatabase` --lo que hace
     cada prueba-- dejaria la base sin indices. */
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).createIndexes()));
}

async function desconectar() {
  await mongoose.disconnect();
}

module.exports = { conectar, desconectar, asegurarIndices, mongoose };
