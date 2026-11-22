require("dotenv").config();
const { MongoClient } = require("mongodb");

/**
 * LE CAMBIA EL RANGO A UNA CUENTA.
 *
 * La base de un sitio recien publicado arranca sin ninguna cuenta: ni
 * `cargarCatalogo.js` ni `copiarCatalogo.js` crean una, a proposito.
 * El dueño se registra desde el sitio, con la clave que el elija, y
 * esto le sube el rango despues. Asi la unica cuenta con panel tiene
 * una clave que nunca estuvo escrita en ningun archivo.
 *
 *   node scripts/darRango.js celu owner            (muestra que haria)
 *   node scripts/darRango.js celu owner --escribir (lo hace)
 *
 * La base sale de DESTINO_URI si esta, y si no de DATABASE_URI. El
 * nombre de la base se imprime antes de tocar nada: conviene leerlo.
 */

const RANGOS = ["user", "support", "admin", "owner"];

async function darRango() {
  const [usuario, rango] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const escribir = process.argv.includes("--escribir");

  if (!usuario || !rango) {
    throw new Error("Se usa asi: node scripts/darRango.js <usuario> <rango> [--escribir]");
  }
  if (!RANGOS.includes(rango)) {
    throw new Error(`El rango "${rango}" no existe. Son: ${RANGOS.join(", ")}`);
  }

  const uri = process.env.DESTINO_URI || process.env.DATABASE_URI || "";
  if (!uri) throw new Error("Falta DESTINO_URI o DATABASE_URI.");

  const cliente = new MongoClient(uri);
  await cliente.connect();
  const base = cliente.db();
  const cuentas = base.collection("users");

  console.log('base: "%s"  (%s)\n', base.databaseName, escribir ? "SE VA A ESCRIBIR" : "solo mirando");

  /* Por nombre exacto: dos cuentas no pueden llamarse igual. */
  const cuenta = await cuentas.findOne({ username: usuario }, { projection: { username: 1, rank: 1 } });
  if (!cuenta) {
    await cliente.close();
    throw new Error(`No hay ninguna cuenta que se llame "${usuario}" en esta base.`);
  }

  console.log('  "%s": %s  ->  %s', cuenta.username, cuenta.rank, rango);

  if (!escribir) {
    console.log("\nNo se escribio nada. Para hacerlo: --escribir");
    await cliente.close();
    return;
  }

  await cuentas.updateOne({ _id: cuenta._id }, { $set: { rank: rango } });

  /*
    Se relee de la base en vez de confiar en el resultado del update:
    es la unica forma de ver lo que de verdad quedo guardado.
  */
  const despues = await cuentas.findOne({ _id: cuenta._id }, { projection: { username: 1, rank: 1 } });
  console.log('\nquedo: "%s" es %s', despues.username, despues.rank);

  const owners = await cuentas.countDocuments({ rank: "owner" });
  console.log("cuentas con rango owner en esta base: %d", owners);

  await cliente.close();
}

darRango().catch((err) => {
  console.error("se rompio:", err.message);
  process.exit(1);
});
