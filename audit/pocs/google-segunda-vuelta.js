/*
  ENTRAR CON GOOGLE, LA SEGUNDA VEZ, CONTRA LA CUENTA DE VERDAD.

  La primera vez ya se probo sola: Dani toco el boton y la cuenta
  quedo creada. Lo que falta comprobar es lo de despues, que es donde
  estaria el error caro:

    - que la segunda vez ENTRE, no que cree otra cuenta
    - que entre a la MISMA, no a una parecida
    - que no le vuelva a dar las tres cajas de regalo
    - que no le toque el saldo

  Google no puede firmar un token a pedido de una prueba, asi que se
  reemplaza SOLO la comprobacion de la firma --la que necesita a
  Google-- y se deja correr todo lo demas: la busqueda por `googleId`,
  el atado por mail, la creacion, las cajas y la sesion.

  Lo que se le hace creer al servidor es exactamente lo que Google le
  diria de esa cuenta, leido de la base.

  SOLO CONTRA LOCALHOST Y LA BASE DE DESARROLLO.

  Uso:  node audit/pocs/google-segunda-vuelta.js
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
process.env.GOOGLE_CLIENT_ID = leerEnv("GOOGLE_CLIENT_ID");
process.env.AUTH_RATE_LIMIT = "500";
process.env.LOG_LEVEL = "error";

(async () => {
  if (!/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URI)
      || !/mrbox_local/.test(process.env.DATABASE_URI)) {
    console.error("Solo contra mrbox_local en 127.0.0.1. Abortado.");
    process.exit(1);
  }

  /* Se reemplaza ANTES de cargar la aplicacion: la ruta se guarda el
     modulo cuando se la carga, asi que despues ya seria tarde. */
  const google = require(path.join(RAIZ, "services", "google"));

  let loQueDiriaGoogle = null;
  google.configurado = () => true;
  google.quienEs = async () => {
    if (!loQueDiriaGoogle) throw new Error("token invalido");
    return loQueDiriaGoogle;
  };

  const mongoose = require(path.join(RAIZ, "node_modules", "mongoose"));
  const { app } = require(path.join(RAIZ, "index"));
  const { conectar } = require(path.join(RAIZ, "database"));

  const User = require(path.join(RAIZ, "database", "models", "User"));
  const SessionEvent = require(path.join(RAIZ, "database", "models", "SessionEvent"));

  await conectar();

  const servidor = app.listen(0);
  await new Promise((r) => servidor.once("listening", r));
  const base = `http://127.0.0.1:${servidor.address().port}/api`;

  const nuevas = [];

  try {
    // ── La cuenta que ya existe ───────────────────────────────────
    const antes = await User.findOne({ googleId: { $ne: null } })
      .select("+balanceSc username email googleId freeOpens avatarUrl")
      .lean();

    if (!antes) {
      console.log("No hay ninguna cuenta creada con Google. Entra una vez desde el sitio y volve a correr esto.");
      return;
    }

    console.log(`\ncuenta de verdad: ${antes.username} <${antes.email}>`);
    console.log(`  cajas gratis: ${antes.freeOpens}  |  saldo: ${antes.balanceSc}\n`);

    const totalAntes = await User.countDocuments();

    const entrar = async (cuerpo = { credential: "da-igual" }) => {
      const r = await fetch(`${base}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      return { estado: r.status, datos: await r.json() };
    };

    // ══════════════════════════════════════════════════════════════
    console.log("=== 1. La segunda vez: entra, no se registra ===");

    loQueDiriaGoogle = {
      sub: antes.googleId,
      email: antes.email,
      emailVerificado: true,
      nombre: antes.username,
      foto: antes.avatarUrl || "",
    };

    const r1 = await entrar();
    bien(r1.estado === 200, `contesta 200 y no 201 (dio ${r1.estado})`);
    bien(r1.datos.nueva === false, "dice que no es nueva");
    bien(r1.datos.token, "vuelve con sesion abierta");
    bien(
      String(r1.datos.user._id) === String(antes._id),
      `entra a LA MISMA cuenta (${r1.datos.user.username})`
    );

    const despues = await User.findById(antes._id).select("+balanceSc freeOpens").lean();
    bien(despues.freeOpens === antes.freeOpens,
      `no le vuelve a dar cajas (sigue en ${despues.freeOpens})`);
    bien(Number(despues.balanceSc) === Number(antes.balanceSc),
      `no le toca el saldo (sigue en ${despues.balanceSc})`);
    bien(await User.countDocuments() === totalAntes,
      `no aparecio ninguna cuenta nueva (${totalAntes})`);

    // ══════════════════════════════════════════════════════════════
    console.log("\n=== 2. Diez veces seguidas, a la vez ===");

    /* Lo que pasa cuando alguien toca dos veces o se le va la
       conexion y reintenta: no puede terminar con dos cuentas. */
    await Promise.all(Array.from({ length: 10 }, () => entrar()));

    bien(await User.countDocuments({ googleId: antes.googleId }) === 1,
      "sigue habiendo UNA sola cuenta con ese googleId");
    bien(await User.countDocuments() === totalAntes,
      "y ninguna cuenta de mas en toda la base");

    // ══════════════════════════════════════════════════════════════
    console.log("\n=== 3. El mail de la cuenta, con otro googleId ===");

    /*
      El caso feo: alguien abre una cuenta de Google con el mail de
      Dani y entra. Si Google dice que no esta verificado, no tiene
      que pasar nada.
    */
    loQueDiriaGoogle = {
      sub: "otro-google-que-no-es-el-suyo",
      email: antes.email,
      emailVerificado: false,
      nombre: "El Que Se Hace Pasar",
      foto: "",
    };

    const r3 = await entrar();
    bien(r3.estado >= 400, `rebota (HTTP ${r3.estado}, ${r3.datos.code})`);

    const intacta = await User.findById(antes._id).select("googleId").lean();
    bien(String(intacta.googleId) === String(antes.googleId),
      "y la cuenta sigue atada al googleId de siempre");

    // ══════════════════════════════════════════════════════════════
    console.log("\n=== 4. Una cuenta vieja, con contrasena, se ata ===");

    const viejo = await User.create({
      username: `vieja${Date.now().toString(36).slice(-5)}`,
      email: `vieja${Date.now().toString(36).slice(-5)}@prueba.local`,
      passwordHash: "$2a$12$" + "z".repeat(53),
    });
    nuevas.push(viejo._id);

    loQueDiriaGoogle = {
      sub: `sub-nuevo-${Date.now()}`,
      email: viejo.email,
      emailVerificado: true,
      nombre: "Vieja Cuenta",
      foto: "",
    };

    const r4 = await entrar();
    bien(r4.estado === 200, `entra a la que ya tenia (HTTP ${r4.estado})`);
    bien(String(r4.datos.user._id) === String(viejo._id), "y es la misma cuenta");

    const atada = await User.findById(viejo._id).select("+passwordHash googleId").lean();
    bien(!!atada.googleId, "le quedo atada la de Google");
    bien(!!atada.passwordHash, "y NO perdio su contrasena: puede entrar de las dos maneras");
    bien(await User.countDocuments({ email: viejo.email }) === 1, "una sola cuenta con ese mail");
  } finally {
    if (nuevas.length) {
      await SessionEvent.deleteMany({ user: { $in: nuevas } });
      await User.deleteMany({ _id: { $in: nuevas } });
      console.log(`\n(se borro la cuenta de prueba)`);
    }
    await new Promise((r) => servidor.close(r));
  }

  console.log(fallas ? `\n${fallas} COSAS MAL, mirar arriba.` : "\nTODO BIEN.");

  await mongoose.disconnect();
  process.exit(fallas ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
