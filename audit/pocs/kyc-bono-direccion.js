/*
  TRES COSAS, DE PUNTA A PUNTA.

    1. LOS NIVELES DE VERIFICACION se habilitan con el anterior MANDADO,
       no aprobado. Y el nivel del jugador sale de la corrida de
       aprobados desde el uno, mire el panel en el orden que mire.

    2. EL RELOJ DEL BONO arranca cuando se abre el cajon de deposito y
       vuelve a arrancar en cada apertura. La pantalla y el servidor
       miden contra el mismo sello.

    3. LA DIRECCION DE DEPOSITO es siempre la misma para un jugador,
       moneda y red. La pasarela crea una nueva en cada llamada; esto
       comprueba que la guardamos y la reusamos.

  SOLO CONTRA LOCALHOST Y LA BASE DE DESARROLLO.

  Uso:  node audit/pocs/kyc-bono-direccion.js
*/
const path = require("path");
const fs = require("fs");

const RAIZ = path.join(__dirname, "..", "..", "backend");
const API = "http://localhost:5001/api";

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

(async () => {
  const uri = leerEnv("DATABASE_URI");
  if (!/127\.0\.0\.1|localhost/.test(uri) || !/mrbox_local/.test(uri)) {
    console.error("Solo contra mrbox_local en 127.0.0.1. Abortado.");
    process.exit(1);
  }

  const mongoose = require(path.join(RAIZ, "node_modules", "mongoose"));
  await mongoose.connect(uri);

  const User = require(path.join(RAIZ, "database", "models", "User"));
  const Verification = require(path.join(RAIZ, "database", "models", "Verification"));
  const DireccionDeDeposito = require(path.join(RAIZ, "database", "models", "DireccionDeDeposito"));
  const verificacion = require(path.join(RAIZ, "services", "verification"));

  const creadas = [];

  const registrar = async (nombre) => {
    const r = await fetch(`${API}/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: nombre,
        email: `${nombre}@prueba.local`,
        password: "unaclavelarga",
        captchaToken: "XXXX.DUMMY.TOKEN.XXXX",
      }),
    });
    const d = await r.json();
    if (!d.user) throw new Error("no se pudo registrar: " + JSON.stringify(d));
    creadas.push(d.user._id);
    return { id: d.user._id, token: d.token };
  };

  const marca = `kb${Date.now().toString(36).slice(-6)}`;

  // ════════════════════════════════════════════════════════════════
  console.log("\n=== 1. Los tres niveles, sin esperar al revisor ===");

  const j = await registrar(marca);

  const estado = async () => {
    const r = await fetch(`${API}/profile/verification`, { headers: { "x-auth-token": j.token } });
    const d = await r.json();
    if (!d.data) throw new Error("sin estado: " + JSON.stringify(d));
    return d.data;
  };

  const mandar = async (nivel, cuerpo) => {
    const r = await fetch(`${API}/profile/verification/${nivel}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-auth-token": j.token },
      body: JSON.stringify(cuerpo),
    });
    return { estado: r.status, datos: await r.json() };
  };

  let e = await estado();
  bien(e.niveles[0].sePuedeMandar === true, "de entrada se puede mandar el 1");
  bien(e.niveles[1].sePuedeMandar === false, "el 2 todavia no");
  bien(e.niveles[2].sePuedeMandar === false, "el 3 tampoco");

  /* Los campos de cada nivel salen del propio servidor: asi la prueba
     no se rompe si manana el formulario pide una cosa mas. */
  const relleno = (nivel) => {
    const campos = {};
    for (const c of verificacion.FORMULARIOS[nivel]) {
      if (c.tipo === "fecha") campos[c.campo] = "1990-05-05";
      else if (c.tipo === "opcion") campos[c.campo] = c.opciones[0];
      else if (c.tipo === "archivo") {
        /* Una cadena `data:`, que es lo que manda la pantalla. El
           nombre viaja aparte, en `<campo>Nombre`. */
        campos[c.campo] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
        campos[`${c.campo}Nombre`] = "documento.png";
      } else campos[c.campo] = "Prueba Prueba";
    }
    return campos;
  };

  const uno = await mandar(1, relleno(1));
  bien(uno.estado === 200, `manda el 1 (HTTP ${uno.estado}) ${uno.estado === 200 ? "" : JSON.stringify(uno.datos)}`);

  e = await estado();
  bien(e.niveles[0].estado === "pending", "el 1 queda en revision");
  bien(e.niveles[1].sePuedeMandar === true, "y AHORA SI se puede mandar el 2, sin esperar aprobacion");
  bien(e.niveles[2].sePuedeMandar === false, "pero el 3 todavia no");

  const dos = await mandar(2, relleno(2));
  bien(dos.estado === 200, `manda el 2 (HTTP ${dos.estado})`);

  e = await estado();
  bien(e.niveles[2].sePuedeMandar === true, "con el 2 mandado, se habilita el 3");

  const tres = await mandar(3, relleno(3));
  bien(tres.estado === 200, `manda el 3 (HTTP ${tres.estado})`);

  e = await estado();
  bien(e.niveles.every((n) => n.estado === "pending"), "los tres en revision a la vez");
  bien(e.nivelActual === 0, `y el nivel sigue en 0 hasta que alguien mire (dio ${e.nivelActual})`);

  // -- El panel los mira al reves --------------------------------
  console.log("  (el panel aprueba 3, despues 1, despues 2)");
  await verificacion.resolver({ adminId: null, userId: j.id, nivel: 3, aprobar: true });
  e = await estado();
  bien(e.nivelActual === 0, `aprobar el 3 solo no sube nada (dio ${e.nivelActual})`);

  await verificacion.resolver({ adminId: null, userId: j.id, nivel: 1, aprobar: true });
  e = await estado();
  bien(e.nivelActual === 1, `con el 1 aprobado, nivel 1 (dio ${e.nivelActual})`);

  await verificacion.resolver({ adminId: null, userId: j.id, nivel: 2, aprobar: true });
  e = await estado();
  bien(e.nivelActual === 3, `y con el 2, salta a 3 de una (dio ${e.nivelActual})`);

  // -- Rechazar el 1 tiene que bajarlo ---------------------------
  await verificacion.resolver({ adminId: null, userId: j.id, nivel: 1, aprobar: false, motivo: "prueba" });
  e = await estado();
  bien(e.nivelActual === 0, `rechazar el 1 vuelve a 0, no deja el 3 puesto (dio ${e.nivelActual})`);
  bien(e.niveles[1].sePuedeMandar === false, "y con el 1 rechazado, el 2 no se puede volver a mandar");
  bien(e.niveles[0].sePuedeMandar === true, "el 1 si, para corregirlo");

  // ════════════════════════════════════════════════════════════════
  console.log("\n=== 2. El reloj del bono arranca al abrir el cajon ===");

  const b = await registrar(`${marca}b`);

  /* Una cuenta de hace dos horas: con el reloj viejo, la ventana de 30
     minutos ya estaba cerrada y el bono perdido. */
  await User.collection.updateOne(
    { _id: new mongoose.Types.ObjectId(String(b.id)) },
    { $set: { createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) } }
  );

  const monedas = async (token) => {
    const r = await fetch(`${API}/wallet/coins`, { headers: token ? { "x-auth-token": token } : {} });
    return (await r.json()).data.bonoDeBienvenida;
  };

  let bono = await monedas(b.token);
  bien(bono.disponible === false, "cuenta de hace dos horas, sin abrir el cajon: la oferta esta cerrada");

  const avisar = async (token) => {
    const r = await fetch(`${API}/wallet/bonus/seen`, {
      method: "POST",
      headers: { "x-auth-token": token },
    });
    return (await r.json()).data;
  };

  const sello1 = await avisar(b.token);
  bien(!!sello1.desde, "abrir el cajon deja el sello");

  bono = await monedas(b.token);
  bien(bono.disponible === true, "y con el sello la oferta vuelve a estar viva");
  bien(!!bono.desde, "la pantalla recibe desde cuando contar");

  const u1 = await User.findById(b.id).select("bonoVisibleDesde").lean();
  bien(
    Math.abs(new Date(u1.bonoVisibleDesde).getTime() - new Date(bono.desde).getTime()) < 1500,
    "el contador de la pantalla y la ventana del servidor miden contra la MISMA fecha"
  );

  /* Se vuelve a abrir: tiene que volver a empezar. */
  await new Promise((r) => setTimeout(r, 1200));
  const sello2 = await avisar(b.token);
  bien(
    new Date(sello2.desde).getTime() > new Date(sello1.desde).getTime(),
    "volver a abrir el cajon reinicia el contador"
  );

  /* Y si el sello es viejo, la oferta se cierra igual: los minutos son
     de verdad, no decorado. */
  await User.updateOne(
    { _id: b.id },
    { $set: { bonoVisibleDesde: new Date(Date.now() - 31 * 60 * 1000) } }
  );
  bono = await monedas(b.token);
  bien(bono.disponible === false, "con el sello de hace 31 minutos, la oferta esta cerrada");

  // ════════════════════════════════════════════════════════════════
  console.log("\n=== 3. La direccion de deposito no cambia ===");

  const d = await registrar(`${marca}d`);
  const pedirDir = async () => {
    const r = await fetch(`${API}/wallet/deposit?coin=USDT&network=BEP20`, {
      headers: { "x-auth-token": d.token },
    });
    const datos = await r.json();
    return datos.data || {};
  };

  const a = await pedirDir();
  if (a.conectada === false) {
    console.log("  (pasarela no configurada: no se puede probar)");
  } else {
    const b2 = await pedirDir();
    const c2 = await pedirDir();
    bien(!!a.direccion, `la primera trae direccion (${String(a.direccion).slice(0, 8)}...)`);
    bien(
      a.direccion === b2.direccion && b2.direccion === c2.direccion,
      "tres pedidos seguidos dan LA MISMA, no una nueva cada vez"
    );

    const guardadas = await DireccionDeDeposito.countDocuments({ user: d.id });
    bien(guardadas === 1, `queda una sola guardada (dio ${guardadas})`);

    const otra = await fetch(`${API}/wallet/deposit?coin=USDT&network=TRC20`, {
      headers: { "x-auth-token": d.token },
    }).then((r) => r.json());
    bien(otra.data.direccion !== a.direccion, "pero otra red tiene su propia direccion");
  }

  // -- Limpieza ---------------------------------------------------
  await Verification.deleteMany({ user: { $in: creadas } });
  await DireccionDeDeposito.deleteMany({ user: { $in: creadas } });
  await User.deleteMany({ _id: { $in: creadas } });
  console.log(`\n(se borraron las ${creadas.length} cuentas de prueba)`);

  console.log(fallas ? `\n${fallas} COSAS MAL, mirar arriba.` : "\nTODO BIEN.");

  await mongoose.disconnect();
  process.exit(fallas ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
