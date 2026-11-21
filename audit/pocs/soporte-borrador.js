/*
  EL BORRADOR DE SOPORTE, SIN GASTAR UN PESO EN LA API.

  La llamada a Claude se reemplaza por un cliente de mentira que
  guarda el pedido y devuelve lo que yo le diga. Con eso se puede
  mirar lo unico que importa de verdad antes de darle una llave:

    1. QUE SE MANDA. Que vaya el modelo correcto, el formato de
       salida, las respuestas guardadas y el estado del jugador. Y
       sobre todo QUE NO VAYA: ni el mail, ni el nombre de usuario,
       ni el id. Eso no se puede probar mirando la pantalla.

    2. QUIEN DECIDE DERIVAR. El modelo propone, el servidor dispone:
       plata, cuenta o queja van a una persona aunque el modelo diga
       que esta segurisimo. Es el caso que esto tiene que atajar.

    3. QUE NO MANDA NADA. Pedir un borrador no le escribe al jugador,
       no mueve el estado de la conversacion y no la saca de la cola
       de pendientes.

    4. QUE EL JUGADOR NO LO VE. El borrador --y el motivo, que a
       veces dice "este viene enojado"-- sale en la ficha del equipo
       y NO en el chat del jugador.

    5. QUE SE ROMPE BIEN. Sin llave, con una respuesta que no es
       JSON, o con una negativa del modelo: tres errores distintos y
       claros, ninguno silencioso.

  Lo unico que NO prueba es que Claude conteste bien, porque para eso
  hace falta la llave de Dani. Eso es una prueba en vivo de un minuto
  y esta explicada al final.

  SOLO CONTRA mrbox_local.

  Uso:  node audit/pocs/soporte-borrador.js
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
process.env.LOG_LEVEL = "error";

/* El cliente de mentira: anota lo que le piden y contesta lo guionado. */
function clienteFalso(guion) {
  const visto = [];
  return {
    visto,
    messages: {
      create: async (pedido) => {
        visto.push(pedido);
        const r = typeof guion === "function" ? guion(pedido) : guion;
        if (r instanceof Error) throw r;
        return r;
      },
    },
  };
}

/* Lo que contestaria el modelo. `opciones` por omision, que es lo
   que ahora pide el esquema. */
const conOpciones = (extra = {}) => Object.assign({
  opciones: [
    { etiqueta: "corta y al grano", texto: "Ya lo estoy mirando, te confirmo por acá." },
    { etiqueta: "con el detalle", texto: "Lo estoy mirando con el detalle del pago delante. Te confirmo por acá apenas tenga la respuesta." },
  ],
  confianza: 0.9, categoria: "caja", derivar: false, motivo: "Respuesta guardada 1.",
}, extra);

const respuestaDe = (obj, extra = {}) => Object.assign({
  model: "claude-haiku-5-5",
  stop_reason: "end_turn",
  content: [{ type: "text", text: JSON.stringify(obj) }],
  usage: { input_tokens: 1200, output_tokens: 180, cache_read_input_tokens: 1000 },
}, extra);

(async () => {
  if (!/mrbox_local/.test(process.env.DATABASE_URI)) {
    console.error("Solo contra mrbox_local. Abortado.");
    process.exit(1);
  }

  const mongoose = require(path.join(RAIZ, "node_modules", "mongoose"));
  const jwt = require(path.join(RAIZ, "node_modules", "jsonwebtoken"));
  const { app } = require(path.join(RAIZ, "index"));
  const { conectar } = require(path.join(RAIZ, "database"));

  const User = require(path.join(RAIZ, "database", "models", "User"));
  const Settings = require(path.join(RAIZ, "database", "models", "Settings"));
  const SupportThread = require(path.join(RAIZ, "database", "models", "SupportThread"));

  const ia = require(path.join(RAIZ, "services", "ia"));
  const soporte = require(path.join(RAIZ, "services", "support"));

  await conectar();
  const servidor = app.listen(0);
  await new Promise((r) => servidor.once("listening", r));
  const base = `http://127.0.0.1:${servidor.address().port}/api`;

  const marca = Date.now().toString(36).slice(-6);
  const jugador = await User.create({
    username: `sop_${marca}`,
    email: `sop_${marca}@audit.local`,
    passwordHash: "x",
    balanceSc: 412.5,
    verificationLevel: 2,
  });
  const admin = await User.findOne({ rank: { $in: ["admin", "owner"] } });

  /* Una conversación de verdad, por el camino del jugador. */
  const hilo = await soporte.escribir({
    userId: jugador._id,
    nombre: jugador.username,
    texto: "Hola, pedi un retiro hace tres dias y todavia no me llego. Que pasa?",
  });

  const ficha = await soporte.fichaDelJugador(jugador._id);

  console.log("\n1. QUE SE LE MANDA A LA API");

  const falso = clienteFalso(respuestaDe(conOpciones({ categoria: "retiro", confianza: 0.95 })));

  await ia.borradorDeSoporte({ hilo, ficha, conQue: falso });
  const pedido = falso.visto[0];
  const todo = JSON.stringify(pedido);

  bien(pedido.model === "claude-haiku-5-5", `va al modelo acordado (${pedido.model})`);
  bien(pedido.output_config && pedido.output_config.format
    && pedido.output_config.format.type === "json_schema",
  "pide la respuesta con forma de JSON y no texto suelto");
  bien(pedido.output_config.format.schema.additionalProperties === false,
    "y con el esquema cerrado, asi no vuelve nada de mas");
  bien(Array.isArray(pedido.system) && pedido.system.length === 2,
    "el sistema va en dos bloques: lo fijo y lo del jugador");
  bien(!!(pedido.system[0].cache_control),
    "lo fijo va marcado para cache, que es lo que lo hace barato");
  bien(!pedido.system[1].cache_control,
    "y lo del jugador NO, porque cambia en cada conversacion");
  bien(/retiro hace tres dias/.test(todo), "va el texto que escribio el jugador");
  bien(/412\.50/.test(todo), "va su saldo");
  /* Contra el texto crudo y no contra el JSON: ahi las comillas van
     escapadas y el patron no engancharia nunca. */
  const crudo = pedido.messages.map((m) => m.content).join("\n");
  bien(crudo.includes('<mensaje de="JUGADOR">'),
    "y sus mensajes van marcados como material, no como ordenes");
  bien(/<conversacion>/.test(crudo) && /<\/conversacion>/.test(crudo),
    "con la conversacion entera delimitada");

  /* Lo que NO puede salir de casa. */
  console.log("\n2. LO QUE NO SE MANDA");
  bien(!todo.includes(jugador.email), "no va el mail");
  bien(!todo.includes(jugador.username), "no va el nombre de usuario");
  bien(!todo.includes(String(jugador._id)), "no va el id");
  bien(!/ANTHROPIC|sk-ant/i.test(todo), "y obviamente no va ninguna llave");

  console.log("\n3. EL SERVIDOR TIENE LA ULTIMA PALABRA");

  /*
    El caso que importa: el modelo dice que NO hace falta una persona
    y encima esta segurisimo. Como es un retiro, se deriva igual.
  */
  const seguro = clienteFalso(respuestaDe(conOpciones({
    opciones: [
      { etiqueta: "directa", texto: "Tu retiro ya fue aprobado, te llega hoy." },
      { etiqueta: "con plazo", texto: "Tu retiro salio, te llega antes de la noche." },
    ],
    confianza: 0.99, categoria: "retiro", derivar: false, motivo: "Estoy seguro.",
  })));
  const r1 = await ia.borradorDeSoporte({ hilo, ficha, conQue: seguro });
  bien(r1.derivar === true,
    "un retiro se deriva aunque el modelo diga que no y tenga 99% de confianza");

  const flojo = clienteFalso(respuestaDe(conOpciones({ confianza: 0.4, motivo: "No estoy seguro." })));
  const r2 = await ia.borradorDeSoporte({ hilo, ficha, conQue: flojo });
  bien(r2.derivar === true, "con 40% de confianza tambien se deriva");

  const bueno = clienteFalso(respuestaDe(conOpciones({ confianza: 0.93 })));
  const r3 = await ia.borradorDeSoporte({ hilo, ficha, conQue: bueno });
  bien(r3.derivar === false, "una pregunta de cajas con 93% no se deriva");

  const inventado = clienteFalso(respuestaDe(conOpciones({ categoria: "lo-que-sea" })));
  const r4 = await ia.borradorDeSoporte({ hilo, ficha, conQue: inventado });
  bien(r4.categoria === "otro", "una categoria que no existe cae en 'otro'");

  console.log("\n3b. SIEMPRE MAS DE UNA, Y DISTINTAS");

  const esquema = pedido.output_config.format.schema.properties.opciones;
  bien(esquema.minItems === 2, "el esquema exige dos como minimo");
  bien(esquema.maxItems === 3, "y tres como maximo, que mas no se leen");
  bien(r3.opciones.length >= 2, `devuelve ${r3.opciones.length} opciones`);
  bien(r3.opciones.every((o) => o.texto && o.etiqueta),
    "cada una con su texto y su etiqueta de en que se diferencia");

  /* Dos que dicen lo mismo no son dos opciones. */
  const repetidas = clienteFalso(respuestaDe(conOpciones({
    opciones: [
      { etiqueta: "a", texto: "Ya lo estoy mirando." },
      { etiqueta: "b", texto: "ya lo   estoy MIRANDO." },
      { etiqueta: "c", texto: "Lo paso al area de pagos y te confirmo." },
    ],
  })));
  const rRep = await ia.borradorDeSoporte({ hilo, ficha, conQue: repetidas });
  bien(rRep.opciones.length === 2,
    `dos que dicen lo mismo cuentan como una (quedaron ${rRep.opciones.length})`);

  const vacias = clienteFalso(respuestaDe(conOpciones({ opciones: [] })));
  let codigoVacio = "";
  try { await ia.borradorDeSoporte({ hilo, ficha, conQue: vacias }); }
  catch (e) { codigoVacio = e.codigo || e.code || ""; }
  bien(codigoVacio === "AI_BAD_OUTPUT",
    "si no manda ninguna, es un error y no un borrador vacio");

  console.log("\n3c. COMO SUENA, Y CON QUE NOMBRE SALE");

  const reglas = pedido.system[0].text;
  bien(reglas.includes("Nunca decís que sos una inteligencia artificial"),
    "las reglas le prohiben presentarse como IA");
  bien(reglas.includes("consultar con mi responsable"),
    "y le dan la formula para cuando lo decide un humano");
  bien(reglas.includes("Lamento los inconvenientes") && reglas.includes("no dudes en contactarnos"),
    "con la lista de muletillas que delatan a una maquina");
  bien(reglas.includes("Sin firma ni nombre al final"),
    "y no firma el texto: eso lo pone el sitio");

  /* La firma: el jugador no ve el nombre de usuario de nadie. */
  const cfg0 = await Settings.leer();
  await soporte.responder({ hiloId: hilo._id, admin, texto: "Probando la firma." });
  const trasResponder = await soporte.verDelEquipo(hilo._id);
  const ultimo = trasResponder.mensajes[trasResponder.mensajes.length - 1];

  bien(ultimo.nombre !== admin.username,
    `no firma con el usuario del panel (firmo "${ultimo.nombre}", el usuario es "${admin.username}")`);
  bien(ultimo.nombre === ((cfg0.soporte || {}).firma || "Soporte"),
    "firma con el nombre de la casa");

  await User.updateOne({ _id: admin._id }, { $set: { nombreDeSoporte: "Martin" } });
  const admin2 = await User.findById(admin._id).lean();
  await soporte.responder({ hiloId: hilo._id, admin: admin2, texto: "Y ahora con el mio." });
  const trasPropio = await soporte.verDelEquipo(hilo._id);
  bien(trasPropio.mensajes[trasPropio.mensajes.length - 1].nombre === "Martin",
    "y si la persona tiene nombre propio, gana el suyo");
  await User.updateOne({ _id: admin._id }, { $unset: { nombreDeSoporte: "" } });

  console.log("\n4. PEDIR UN BORRADOR NO LE ESCRIBE A NADIE");

  const antes = await SupportThread.findById(hilo._id).lean();
  await SupportThread.updateOne({ _id: hilo._id }, {
    $set: {
      borradorIa: {
        opciones: [
          { etiqueta: "corta", texto: "Propuesta de prueba." },
          { etiqueta: "con detalle", texto: "Propuesta de prueba, la segunda." },
        ],
        confianza: 0.9, categoria: "retiro",
        derivar: true, motivo: "ojo, viene enojado", modelo: "claude-haiku-5-5",
        sobreMensajes: antes.mensajes.length, creadoEl: new Date(), pedidoPor: admin._id,
      },
    },
  });
  const despues = await SupportThread.findById(hilo._id).lean();

  bien(despues.mensajes.length === antes.mensajes.length,
    "no se agrego ningun mensaje a la conversacion");
  bien(despues.estado === antes.estado,
    `el estado no se movio (${despues.estado}): sigue esperando respuesta`);
  bien(+despues.ultimoMensajeEl === +antes.ultimoMensajeEl,
    "y no se toco la fecha que la ordena en la bandeja");

  console.log("\n5. EL JUGADOR NO LO VE");

  const tokenJugador = jwt.sign({ id: String(jugador._id) }, process.env.JWT_SECRET, { expiresIn: "1h" });
  const suyo = await fetch(`${base}/support/threads/${hilo._id}`, {
    headers: { "x-auth-token": tokenJugador },
  });
  const cuerpoJugador = JSON.stringify(await suyo.json());

  bien(!/Propuesta de prueba/.test(cuerpoJugador), "el borrador no sale en su chat");
  bien(!/viene enojado/.test(cuerpoJugador), "y el motivo, menos todavia");
  bien(!/borradorIa|borrador/.test(cuerpoJugador), "ni siquiera viaja el campo");

  const delEquipo = await soporte.verDelEquipo(hilo._id);
  bien(!!delEquipo.borrador && delEquipo.borrador.opciones.length === 2
    && delEquipo.borrador.opciones[0].texto === "Propuesta de prueba.",
  "pero el equipo si ve las dos opciones en su ficha");
  bien(delEquipo.borrador.derivar === true, "con su marca de 'esto lo contesta una persona'");
  bien(delEquipo.borrador.viejo === false, "y al dia, porque no llegaron mensajes despues");

  /* Y cuando llega uno nuevo, el borrador queda viejo. */
  await soporte.escribir({
    userId: jugador._id, hiloId: hilo._id, texto: "Hola? sigo esperando",
  });
  const trasElMensaje = await soporte.verDelEquipo(hilo._id);
  bien(trasElMensaje.borrador.viejo === true,
    "llega otro mensaje y el borrador se marca viejo, no se muestra como al dia");

  console.log("\n6. CUANDO SE ROMPE, SE ROMPE CLARO");

  const basura = clienteFalso(respuestaDe({}, {
    content: [{ type: "text", text: "perdon, no puedo" }],
  }));
  let codigo = "";
  try { await ia.borradorDeSoporte({ hilo, ficha, conQue: basura }); }
  catch (e) { codigo = e.codigo || e.code || ""; }
  bien(codigo === "AI_BAD_OUTPUT", `una respuesta que no es JSON da AI_BAD_OUTPUT (${codigo})`);

  const negada = clienteFalso(respuestaDe({}, {
    stop_reason: "refusal", stop_details: { type: "refusal", category: "general_harms" },
  }));
  codigo = "";
  try { await ia.borradorDeSoporte({ hilo, ficha, conQue: negada }); }
  catch (e) { codigo = e.codigo || e.code || ""; }
  bien(codigo === "AI_REFUSED", `si el modelo se niega da AI_REFUSED (${codigo})`);

  const sinLlave = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  bien(ia.prendida() === false, "sin llave, la funcion se declara apagada");
  codigo = "";
  try { await ia.borradorDeSoporte({ hilo, ficha }); }
  catch (e) { codigo = e.codigo || e.code || ""; }
  bien(codigo === "AI_OFF", `y pedirlo igual da AI_OFF (${codigo})`);
  if (sinLlave) process.env.ANTHROPIC_API_KEY = sinLlave;

  console.log("\n7. LA PERILLA Y LA PUERTA DEL PANEL");

  await Settings.updateOne({}, { $set: { "soporte.borradorDeIa": false } });
  codigo = "";
  try { await soporte.escribirBorrador({ hiloId: hilo._id, admin }); }
  catch (e) { codigo = e.codigo || e.code || ""; }
  bien(codigo === "AI_OFF", "con la perilla apagada no se puede pedir, aunque haya llave");
  await Settings.updateOne({}, { $set: { "soporte.borradorDeIa": true } });

  const tokenAdmin = jwt.sign({ id: String(admin._id) }, process.env.JWT_SECRET, { expiresIn: "1h" });
  const comoJugador = await fetch(`${base}/admin/support/${hilo._id}/draft`, {
    method: "POST", headers: { "x-auth-token": tokenJugador },
  });
  bien(comoJugador.status === 403 || comoJugador.status === 401,
    `un jugador no puede pedir un borrador (${comoJugador.status})`);

  const sinNadie = await fetch(`${base}/admin/support/${hilo._id}/draft`, { method: "POST" });
  bien(sinNadie.status === 401, `sin sesion tampoco (${sinNadie.status})`);

  const bandeja = await fetch(`${base}/admin/support`, { headers: { "x-auth-token": tokenAdmin } });
  const datosBandeja = (await bandeja.json()).data;
  bien(datosBandeja.ia !== undefined, "la bandeja le dice al panel si la IA esta disponible");
  bien(datosBandeja.ia.prendida === ia.prendida(),
    `y dice la verdad: ${datosBandeja.ia.prendida ? "disponible" : "no hay llave"}`);
  bien(!/sk-ant|ANTHROPIC_API_KEY/.test(JSON.stringify(datosBandeja)),
    "sin filtrar la llave en la respuesta");

  console.log("\n8. LO QUE CUESTA");
  const costo = ia.costoAproximado({ entrada: 1200, salida: 180, cacheLeido: 1000, cacheEscrito: 0 });
  bien(costo > 0 && costo < 0.01, `una conversacion sale USD ${costo.toFixed(6)}`);

  /* ── Limpieza ───────────────────────────────────────────────────── */
  await SupportThread.deleteMany({ user: jugador._id });
  await User.deleteOne({ _id: jugador._id });

  console.log(fallas ? `\n${fallas} MAL\n` : "\nTodo bien.\n");
  console.log("Lo unico que falta es una prueba en vivo: poner ANTHROPIC_API_KEY");
  console.log("en backend/.env, reiniciar el API y tocar el boton en una conversacion.\n");

  await mongoose.disconnect();
  servidor.close();
  process.exit(fallas ? 1 : 0);
})();
