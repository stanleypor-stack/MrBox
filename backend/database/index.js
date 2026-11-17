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

  const nombre = mongoose.connection.name;
  return nombre;
}

async function desconectar() {
  await mongoose.disconnect();
}

module.exports = { conectar, desconectar, mongoose };
