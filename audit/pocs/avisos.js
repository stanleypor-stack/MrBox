/*
  LA CAMPANITA, CONTRA LAS COSAS DE VERDAD.

  No alcanza con escribir filas de aviso a mano y mirarlas: eso prueba
  que la base guarda, no que el sitio avisa. Asi que acá se dispara
  cada evento POR SU CAMINO REAL --el que corre en produccion-- y se
  mira que el aviso aparezca:

    - se cierra una carrera con un ganador        -> premio pagado
    - se rechaza un retiro                        -> plata devuelta
    - se despacha un pedido desde el panel        -> salio el paquete
    - se le sube el rango a un socio              -> subio de rango

  Despues se prueba la API que usa la campanita: listar, contar y
  marcar leido. Y por ultimo --lo que mas se rompe sin que nadie se
  entere-- que cada clave de idioma que escribe el servidor EXISTA en
  los archivos de idioma. Una clave de mas en el servidor se ve como
  "notif.loQueSea" en la pantalla del jugador.

  SOLO CONTRA LOCALHOST Y LA BASE DE DESARROLLO.

  Uso:  node audit/pocs/avisos.js
*/
const path = require("path");
const fs = require("fs");

const RAIZ = path.join(__dirname, "..", "..", "backend");

function leerEnv(clave) {
  for (const linea of fs.readFileSync(path.join(RAIZ, ".env"), "utf8").split(/\r?\n/)) {
    const i = linea.indexOf("=");
    if (i > 0 && linea.slice(0, i).trim() === clave) {
      return linea.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  return "";
}

let fallas = 0;
function bien(ok, texto) {
  if (!ok) fallas += 1;
  console.log(`  ${ok ? "OK  " : "MAL "} ${texto}`);
  return ok;
}

process.env.DATABASE_URI = leerEnv("DATABASE_URI");
process.env.JWT_SECRET = leerEnv("JWT_SECRET");
process.env.AUTH_RATE_LIMIT = "500";
process.env.LOG_LEVEL = "error";

(async () => {
  if (!/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URI)
      || !/mrbox_local/.test(process.env.DATABASE_URI)) {
    console.error("Solo contra mrbox_local en 127.0.0.1. Abortado.");
    process.exit(1);
  }

  const mongoose = require(path.join(RAIZ, "node_modules", "mongoose"));
  const { app } = require(path.join(RAIZ, "index"));
  const { conectar } = require(path.join(RAIZ, "database"));

  const User = require(path.join(RAIZ, "database", "models", "User"));
  const Race = require(path.join(RAIZ, "database", "models", "Race"));
  const Order = require(path.join(RAIZ, "database", "models", "Order"));
  const Redemption = require(path.join(RAIZ, "database", "models", "Redemption"));
  const Notification = require(path.join(RAIZ, "database", "models", "Notification"));
  const SessionEvent = require(path.join(RAIZ, "database", "models", "SessionEvent"));

  const races = require(path.join(RAIZ, "services", "races"));
  const cashier = require(path.join(RAIZ, "services", "cashier"));
  const panel = require(path.join(RAIZ, "services", "admin"));
  const afiliados = require(path.join(RAIZ, "services", "affiliates"));

  await conectar();

  const servidor = app.listen(0);
  await new Promise((r) => servidor.once("listening", r));
  const base = `http://127.0.0.1:${servidor.address().port}/api`;

  const marca = Date.now().toString(36).slice(-6);
  const aBorrar = { usuarios: [], carreras: [], pedidos: [], canjes: [] };

  try {
    /* El de la prueba, y un admin para el panel. */
    const jugador = await User.create({
      username: `av${marca}`,
      email: `av${marca}@prueba.local`,
      passwordHash: "$2a$12$" + "n".repeat(53),
      verificationLevel: 3,
    });
    const admin = await User.create({
      username: `ad${marca}`,
      email: `ad${marca}@prueba.local`,
      passwordHash: "$2a$12$" + "n".repeat(53),
      rank: "owner",
    });
    aBorrar.usuarios.push(jugador._id, admin._id);

    const delJugador = (tipo) => Notification.findOne({ user: jugador._id, tipo }).lean();

    // ══════════════════════════════════════════════════════════════
    console.log("\n=== 1. Se cierra una carrera y se paga el premio ===");

    /*
      UNA VENTANA CHICA Y VIEJA, A PROPOSITO.

      La carrera reparte entre los PRIMEROS de su ventana. Con una
      ventana de un dia entero entran los jugadores sembrados, que
      jugaron mas que esta cuenta nueva, y el premio se lo lleva otro:
      la prueba fallaba sin que hubiera nada roto. Diez minutos de hace
      tres dias no los comparte con nadie.
    */
    const ayer = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const carrera = await Race.create({
      tipo: "daily",
      desde: ayer,
      hasta: new Date(ayer.getTime() + 10 * 60 * 1000),
      premioTotalSc: 100,
      reparto: [100],
      estado: "live",
      ganadores: [],
    });
    aBorrar.carreras.push(carrera._id);

    /* Jugado de verdad: la tabla sale de los movimientos, asi que se
       le anota una jugada adentro de la ventana de la carrera. */
    const wallet = require(path.join(RAIZ, "services", "wallet"));
    await wallet.mover({
      userId: jugador._id,
      amountSc: 50,
      type: "purchase",
      reference: { kind: "prueba", label: "para jugar" },
    });
    await wallet.mover({
      userId: jugador._id,
      amountSc: -20,
      type: "box_open",
      juegaSc: 20,
      reference: { kind: "prueba", label: "jugada de la carrera" },
    });

    /*
      Y se la corre adentro de la ventana de la carrera, POR LA
      COLECCION y no por el modelo: Mongoose marca `createdAt` como
      inmutable, asi que un `$set` por el modelo se descarta sin decir
      nada y la jugada se queda con la fecha de hoy. Esto es cosa de la
      prueba: en el sitio nadie mueve la fecha de un movimiento.
    */
    await mongoose.connection.collection("balancetransactions").updateMany(
      { user: jugador._id, type: "box_open" },
      { $set: { createdAt: new Date(ayer.getTime() + 60000) } }
    );

    await races.cerrar(await Race.findById(carrera._id));

    const avisoCarrera = await delJugador("carrera");
    bien(!!avisoCarrera, "deja aviso de carrera");
    if (avisoCarrera) {
      bien(avisoCarrera.clave === "notif.racePrize", `con la clave correcta (${avisoCarrera.clave})`);
      bien(Number(avisoCarrera.datos.monto) > 0, `y el premio adentro (SC ${avisoCarrera.datos.monto})`);
      bien(avisoCarrera.destino === "/races/daily", `y lleva a la carrera (${avisoCarrera.destino})`);
      bien(avisoCarrera.leidaEl === null, "nace sin leer");
    }

    // ══════════════════════════════════════════════════════════════
    console.log("\n=== 2. Se rechaza un retiro ===");

    const canje = await Redemption.create({
      user: jugador._id,
      montoSc: 25,
      moneda: "USDT",
      red: "TRON",
      direccion: "Tdireccion" + marca,
      estado: "pending",
    });
    aBorrar.canjes.push(canje._id);

    await cashier.resolver({ admin, id: canje._id, accion: "reject", motivo: "prueba de avisos" });

    const avisoRetiro = await delJugador("retiro");
    bien(!!avisoRetiro, "deja aviso de retiro");
    if (avisoRetiro) {
      bien(avisoRetiro.clave === "notif.withdrawNo", `con la clave correcta (${avisoRetiro.clave})`);
      bien(Number(avisoRetiro.datos.monto) === 25, `y el monto (SC ${avisoRetiro.datos.monto})`);
    }

    // ══════════════════════════════════════════════════════════════
    console.log("\n=== 3. Se despacha un pedido ===");

    const pedido = await Order.create({
      user: jugador._id,
      items: [],
      valorSc: 10,
      destino: { nombre: "Prueba", calle: "Calle 1", ciudad: "Ciudad", pais: "AR" },
      estado: "packing",
    });
    aBorrar.pedidos.push(pedido._id);

    await panel.moverPedido({
      admin,
      orderId: pedido._id,
      estado: "shipped",
      transportista: "Correo Prueba",
      seguimiento: "XYZ123",
    });

    const avisoEnvio = await delJugador("envio");
    bien(!!avisoEnvio, "deja aviso de envio");
    if (avisoEnvio) {
      bien(avisoEnvio.datos.seguimiento === "XYZ123", `con el seguimiento (${avisoEnvio.datos.seguimiento})`);
      bien(avisoEnvio.destino.startsWith("/profile"), "y lleva a sus pedidos");
    }

    /* Y que NO avise de los pasos que no le importan. */
    const antesDeEntregar = await Notification.countDocuments({ user: jugador._id });
    await panel.moverPedido({ admin, orderId: pedido._id, estado: "delivered" });
    bien(await Notification.countDocuments({ user: jugador._id }) === antesDeEntregar,
      "y no avisa de 'entregado', que ya lo ve en sus pedidos");

    // ══════════════════════════════════════════════════════════════
    console.log("\n=== 4. Sube de rango ===");

    await afiliados.otorgarRango({ userId: jugador._id, numero: 3 });
    const avisoRango = await delJugador("rango");
    bien(!!avisoRango, "deja aviso de rango");
    if (avisoRango) bien(!!avisoRango.datos.rango, `con el nombre del rango (${avisoRango.datos.rango})`);

    /* Bajarlo no avisa: eso se habla, no se notifica. */
    const antesDeBajar = await Notification.countDocuments({ user: jugador._id, tipo: "rango" });
    await afiliados.otorgarRango({ userId: jugador._id, numero: 1 });
    bien(await Notification.countDocuments({ user: jugador._id, tipo: "rango" }) === antesDeBajar,
      "y bajar de rango NO avisa");

    // ══════════════════════════════════════════════════════════════
    console.log("\n=== 5. La API de la campanita ===");

    const entrada = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: jugador.username, password: "no-importa" }),
    });
    /* Sin contrasena de verdad no se puede entrar: se firma un token
       con la misma llave que usa el servidor, que es lo que hace el
       login por dentro. */
    const jwt = require(path.join(RAIZ, "node_modules", "jsonwebtoken"));
    const token = jwt.sign({ id: String(jugador._id) }, process.env.JWT_SECRET, { expiresIn: "1h" });
    void entrada;

    const pedir = async (ruta, metodo = "GET", cuerpo = null) => {
      const r = await fetch(`${base}${ruta}`, {
        method: metodo,
        headers: { "Content-Type": "application/json", "x-auth-token": token },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      });
      return { estado: r.status, datos: await r.json() };
    };

    const lista = await pedir("/notifications");
    bien(lista.estado === 200, `lista: HTTP ${lista.estado}`);
    bien(lista.datos.data.items.length === 4, `trae los cuatro avisos (dio ${lista.datos.data.items.length})`);
    bien(lista.datos.data.sinLeer === 4, `y los cuatro sin leer (dio ${lista.datos.data.sinLeer})`);

    const primero = lista.datos.data.items[0];
    bien(new Date(primero.cuando) >= new Date(lista.datos.data.items[3].cuando),
      "el mas nuevo primero");

    const cuenta = await pedir("/notifications/count");
    bien(cuenta.datos.data.sinLeer === 4, "la cuenta sola da lo mismo");

    const marcado = await pedir("/notifications/read", "POST", {});
    bien(marcado.datos.data.marcados === 4, `marca los cuatro (dio ${marcado.datos.data.marcados})`);
    bien(marcado.datos.data.sinLeer === 0, "y quedan cero sin leer");

    const otraVez = await pedir("/notifications/read", "POST", {});
    bien(otraVez.datos.data.marcados === 0, "marcar de nuevo no pisa la fecha de lectura");

    const sinSesion = await fetch(`${base}/notifications`);
    bien(sinSesion.status === 401, `sin sesion no se ven (HTTP ${sinSesion.status})`);

    /* Y los de otro no son los mios. */
    const tokenAdmin = jwt.sign({ id: String(admin._id) }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const delOtro = await fetch(`${base}/notifications`, { headers: { "x-auth-token": tokenAdmin } });
    const datosDelOtro = await delOtro.json();
    bien(datosDelOtro.data.items.length === 0, "y cada uno ve solo los suyos");

    // ══════════════════════════════════════════════════════════════
    console.log("\n=== 6. Las claves existen en los nueve idiomas ===");

    const idiomas = ["en", "de", "fr", "es", "pt", "it", "ru", "ja", "zh"];
    const claves = await Notification.distinct("clave");
    const tipos = await Notification.distinct("tipo");

    for (const lang of idiomas) {
      const texto = fs.readFileSync(
        path.join(__dirname, "..", "..", "frontend", "src", "i18n", "locales", `${lang}.js`),
        "utf8"
      );
      const faltan = [];
      for (const c of claves) if (!texto.includes(`"${c.split(".")[1]}"`)) faltan.push(c);
      for (const t of tipos) if (!texto.includes(`"t_${t}"`)) faltan.push(`notif.t_${t}`);
      bien(faltan.length === 0, `${lang}: estan las ${claves.length + tipos.length} claves${faltan.length ? " · faltan " + faltan.join(", ") : ""}`);
    }
  } finally {
    await Notification.deleteMany({ user: { $in: aBorrar.usuarios } });
    await SessionEvent.deleteMany({ user: { $in: aBorrar.usuarios } });
    await Race.deleteMany({ _id: { $in: aBorrar.carreras } });
    await Order.deleteMany({ _id: { $in: aBorrar.pedidos } });
    await Redemption.deleteMany({ _id: { $in: aBorrar.canjes } });
    await require(path.join(RAIZ, "database", "models", "BalanceTransaction"))
      .deleteMany({ user: { $in: aBorrar.usuarios } });
    await require(path.join(RAIZ, "database", "models", "WalletTx"))
      .deleteMany({ user: { $in: aBorrar.usuarios } }).catch(() => {});
    await User.deleteMany({ _id: { $in: aBorrar.usuarios } });
    console.log("\n(se borro todo lo de la prueba)");
    await new Promise((r) => servidor.close(r));
  }

  console.log(fallas ? `\n${fallas} COSAS MAL, mirar arriba.` : "\nTODO BIEN.");

  await mongoose.disconnect();
  process.exit(fallas ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
