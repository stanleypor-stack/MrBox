/*
  LAS DOS MANERAS DE ARMAR UN DESAFIO, DESDE EL PANEL.

  Por el mismo formulario salen los dos, y lo que los distingue es cual
  de los dos campos se llena:

    POR OBJETO         `objeto` con el nombre del catalogo, `multiplicador`
                       vacio. La caja puede ir vacia: vale en todas.
    POR MULTIPLICADOR  `multiplicador` con el numero, `objeto` vacio.

  Se comprueba que:

    1. el de objeto se guarda, resuelve el nombre a su id y no inventa
       multiplicador
    2. el de multiplicador se guarda con su caja
    3. los dos a la vez, y ninguno de los dos, se rechazan
    4. un objeto que no esta en el catalogo se rechaza
    5. la lista del panel muestra lo que corresponde a cada uno
    6. "ver las cajas" devuelve EXACTAMENTE las que tienen el objeto

  SOLO CONTRA LOCALHOST Y LA BASE DE DESARROLLO.

  Uso:  node audit/pocs/desafios-desde-el-panel.js
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
  const Box = require(path.join(RAIZ, "database", "models", "Box"));
  const Item = require(path.join(RAIZ, "database", "models", "Item"));
  const Challenge = require(path.join(RAIZ, "database", "models", "Challenge"));

  const creados = [];

  try {
    /*
      EL PANEL PIDE SESION DE DUENO.

      Se firma un token para el dueno que ya existe en vez de crear
      uno: la prueba es del formulario, no del login, y crear duenos
      de prueba en la base es exactamente lo que no hay que dejar.
    */
    const jwt = require(path.join(RAIZ, "node_modules", "jsonwebtoken"));
    require(path.join(RAIZ, "node_modules", "dotenv")).config({
      path: path.join(RAIZ, ".env"),
      quiet: true,
    });

    const dueno = await User.findOne({ rank: "owner" }).select("_id username clavesDesde").lean();
    if (!dueno) throw new Error("no hay un dueno en la base");

    const token = jwt.sign(
      { id: String(dueno._id), desde: dueno.clavesDesde ? new Date(dueno.clavesDesde).getTime() : 0 },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const panel = async (metodo, ruta, cuerpo) => {
      const r = await fetch(`${API}/admin${ruta}`, {
        method: metodo,
        headers: { "content-type": "application/json", "x-auth-token": token },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      });
      return { estado: r.status, datos: await r.json() };
    };

    /* Que el token sirva: si no, todo lo de abajo da 401 y la prueba
       diria "rechaza" por el motivo equivocado. */
    const prueba = await panel("GET", "/challenges");
    if (prueba.estado !== 200) throw new Error("el token no entra al panel: " + JSON.stringify(prueba.datos));

    const objeto = await Item.findOne({ name: "Datejust Wimbeldon" }).lean()
      || await Item.findOne({ imageUrl: { $nin: ["", null] } }).lean();
    const caja = await Box.findOne({ live: true }).select("slug name").lean();

    const hasta = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

    /* Marca de tiempo: todo lo que se mire despues tiene que ser de
       ESTA corrida. Si no, un desafio que ya estaba en la base --el de
       muestra, por ejemplo-- hace pasar una prueba que no probo nada. */
    const desdeYa = new Date();

    // ════════════════════════════════════════════════════════════
    console.log("\n=== 1. Por objeto, sin caja ===");

    const unoDeObjeto = await panel("POST", "/challenges", {
      item: objeto.name,
      box: "",
      premioSc: 500,
      cupos: 3,
      hasta,
      activo: true,
    });

    bien(unoDeObjeto.estado === 200, `se guarda (HTTP ${unoDeObjeto.estado}) ${unoDeObjeto.estado === 200 ? "" : JSON.stringify(unoDeObjeto.datos)}`);

    const guardadoA = await Challenge.findOne({ itemName: objeto.name, createdAt: { $gte: desdeYa } })
      .sort({ createdAt: -1 }).lean();
    if (guardadoA) creados.push(guardadoA._id);

    bien(!!guardadoA, "queda en la base");
    if (guardadoA) {
      bien(String(guardadoA.item) === String(objeto._id), "el nombre se resolvio al objeto del catalogo");
      bien(guardadoA.multiplicador == null, `y NO inventa multiplicador (dio ${guardadoA.multiplicador})`);
      bien(guardadoA.box == null, "la caja queda vacia: vale en todas");
      bien(guardadoA.cupos === 3, `3 cupos (dio ${guardadoA.cupos})`);
    }

    // ════════════════════════════════════════════════════════════
    console.log("\n=== 2. Por multiplicador, con caja ===");

    const unoDeMulti = await panel("POST", "/challenges", {
      box: caja.slug,
      item: "",
      multiplicador: 100,
      premioSc: 50,
      cupos: 5,
      hasta,
      activo: true,
    });

    bien(unoDeMulti.estado === 200, `se guarda (HTTP ${unoDeMulti.estado})`);

    const guardadoB = await Challenge.findOne({ multiplicador: 100, boxSlug: caja.slug, createdAt: { $gte: desdeYa } })
      .sort({ createdAt: -1 }).lean();
    if (guardadoB) creados.push(guardadoB._id);

    bien(!!guardadoB, "queda en la base");
    if (guardadoB) {
      bien(String(guardadoB.boxSlug) === caja.slug, `atado a ${caja.slug}`);
      bien(!guardadoB.item, "y sin objeto");
    }

    // ════════════════════════════════════════════════════════════
    console.log("\n=== 3. Lo que NO se puede guardar ===");

    const losDos = await panel("POST", "/challenges", {
      box: caja.slug, item: objeto.name, multiplicador: 50,
      premioSc: 10, cupos: 1, hasta, activo: true,
    });
    /* Con objeto, el multiplicador se limpia: no es un error, es que
       el objeto manda. Lo que importa es que NO queden los dos. */
    const dobles = await Challenge.findOne({ itemName: objeto.name, multiplicador: 50, createdAt: { $gte: desdeYa } }).lean();
    if (losDos.estado === 200) {
      const ultimo = await Challenge.findOne({ itemName: objeto.name, createdAt: { $gte: desdeYa } }).sort({ createdAt: -1 }).lean();
      if (ultimo) creados.push(ultimo._id);
      bien(ultimo && ultimo.multiplicador == null, "con los dos cargados, manda el objeto y el multiplicador se limpia");
    }
    bien(!dobles, "nunca queda uno con objeto Y multiplicador a la vez");

    const ninguno = await panel("POST", "/challenges", {
      box: caja.slug, item: "", premioSc: 10, cupos: 1, hasta, activo: true,
    });
    bien(ninguno.estado >= 400, `sin objeto NI multiplicador, rebota (HTTP ${ninguno.estado})`);

    const inventado = await panel("POST", "/challenges", {
      item: "Un objeto que no existe en ningun catalogo",
      premioSc: 10, cupos: 1, hasta, activo: true,
    });
    bien(inventado.estado >= 400, `un objeto que no esta en el catalogo, rebota (HTTP ${inventado.estado})`);
    bien(
      inventado.datos && inventado.datos.code === "CATALOG_ITEM_NOT_FOUND",
      `y lo dice con su propio codigo (dio ${inventado.datos && inventado.datos.code})`
    );

    // ════════════════════════════════════════════════════════════
    console.log("\n=== 4. La lista del panel ===");

    const lista = await panel("GET", "/challenges");
    const items = (lista.datos.data && lista.datos.data.items) || [];
    const filaA = items.find((x) => String(x._id) === String(guardadoA && guardadoA._id));
    const filaB = items.find((x) => String(x._id) === String(guardadoB && guardadoB._id));

    bien(!!filaA && filaA.objeto === objeto.name, `el de objeto dice "${filaA && filaA.objeto}"`);
    bien(!!filaA && !filaA.caja, "y su caja viene vacia, para que la lista diga Cualquiera");
    bien(!!filaB && filaB.multiplicador === 100, `el de multiplicador dice 100 (dio ${filaB && filaB.multiplicador})`);

    // ════════════════════════════════════════════════════════════
    console.log("\n=== 5. \"Ver las cajas\" trae las que lo tienen ===");

    const r = await fetch(`${API}/boxes?item=${objeto._id}&perPage=60`);
    const datos = (await r.json()).data || {};
    const devueltas = (datos.items || []).map((c) => c.slug).sort();

    const esperadas = (await Box.find({ "prizes.item": objeto._id, live: true }).select("slug").lean())
      .map((c) => c.slug).sort();

    bien(
      JSON.stringify(devueltas) === JSON.stringify(esperadas),
      `${devueltas.length} cajas, las mismas que tienen el objeto (${esperadas.length} en la base)`
    );
    bien(datos.objeto && datos.objeto.name === objeto.name, `y dice de que objeto habla: "${datos.objeto && datos.objeto.name}"`);

    const todas = await fetch(`${API}/boxes?perPage=1`).then((x) => x.json());
    bien(
      todas.data.total > datos.total,
      `filtra de verdad: ${datos.total} de ${todas.data.total}`
    );

    /* Y que una basura en el parametro no tire el servidor abajo. */
    const basura = await fetch(`${API}/boxes?item=no-es-un-id`);
    bien(basura.status === 200, `un id invalido no rompe nada (HTTP ${basura.status})`);
  } finally {
    if (creados.length) await Challenge.deleteMany({ _id: { $in: creados } });
    console.log(`\n(se borraron los ${creados.length} desafios de prueba)`);
  }

  console.log(fallas ? `\n${fallas} COSAS MAL, mirar arriba.` : "\nTODO BIEN.");

  await mongoose.disconnect();
  process.exit(fallas ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
