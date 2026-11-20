/*
  EL FLUJO DE LAS CAJAS DE REGALO, DE PUNTA A PUNTA.

  Las tres cajas son del REGISTRO. El que deposita se lleva el bono,
  que es otra cosa.

  Se recorre lo mismo que haria un jugador:

    1. se registra          -> 3 cajas, tres distintas, ninguna usada
    2. abre una             -> queda en 2, el objeto va al inventario,
                               el saldo NO se mueve y queda el asiento
    3. abre las otras dos   -> queda en 0 y el boton se apaga
    4. intenta una mas      -> rebota
    5. tres a la vez        -> no se crea saldo (el agujero de antes)
    6. un deposito          -> da el bono y NO da cajas

  SOLO CONTRA LOCALHOST Y LA BASE DE DESARROLLO.

  Uso:  node audit/pocs/cajas-de-regalo.js  [vueltas]
*/
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const RAIZ = path.join(__dirname, "..", "..", "backend");
const API = "http://localhost:5001/api";
const VUELTAS = Number(process.argv[2]) || 3;

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
  const BalanceTransaction = require(path.join(RAIZ, "database", "models", "BalanceTransaction"));
  const InventoryItem = require(path.join(RAIZ, "database", "models", "InventoryItem"));
  const BoxOpen = require(path.join(RAIZ, "database", "models", "BoxOpen"));

  const creadas = [];

  const registrar = async (nombre) => {
    const r = await fetch(`${API}/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: nombre,
        email: `${nombre}@prueba.local`,
        password: "unaclavelarga",
        /* El token de prueba de Cloudflare: con la clave de prueba
           (`1x00...`) siempre valida. Sin esto el registro rebota con
           CAPTCHA_FAILED y la prueba no llega a probar nada. */
        captchaToken: "XXXX.DUMMY.TOKEN.XXXX",
      }),
    });
    const d = await r.json();
    if (!d.user) throw new Error("no se pudo registrar: " + JSON.stringify(d));
    creadas.push(d.user._id);
    return { id: d.user._id, token: d.token, user: d.user };
  };

  const abrir = async (token, slug) => {
    const r = await fetch(`${API}/boxes/${slug}/open`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-auth-token": token },
      body: JSON.stringify({ veces: 1 }),
    });
    return { estado: r.status, datos: await r.json() };
  };

  for (let v = 0; v < VUELTAS; v += 1) {
    /* Corto: el nombre de usuario admite 20 caracteres y despues se
       le pegan sufijos. */
    const marca = `rg${Date.now().toString(36).slice(-6)}${v}`;
    console.log(`\n═══ vuelta ${v + 1} de ${VUELTAS} ═══`);

    // ── 1. El registro las da ─────────────────────────────────────
    const j = await registrar(marca);
    let u = await User.findById(j.id).select("+balanceSc freeOpens cajasGratis").lean();

    bien(j.user.freeOpens === 3, `al registrarse quedan 3 cajas (dio ${j.user.freeOpens})`);
    bien(u.cajasGratis.length === 3, `tres fichas guardadas (dio ${u.cajasGratis.length})`);
    bien(
      new Set(u.cajasGratis.map((c) => c.slug)).size === 3,
      "tres cajas DISTINTAS, no tres fichas de la misma"
    );
    bien(u.cajasGratis.every((c) => c.usadaEl === null), "ninguna usada todavia");
    bien(Number(u.balanceSc) === 0, `arranca sin saldo (dio ${u.balanceSc})`);

    const slugs = u.cajasGratis.map((c) => c.slug);

    // ── 2. Abre la primera ────────────────────────────────────────
    const una = await abrir(j.token, slugs[0]);
    bien(una.estado === 200, `abre la primera (HTTP ${una.estado})`);
    bien(una.datos.data.gastadoSc === 0, `del bolsillo no sale nada (dio ${una.datos.data.gastadoSc})`);
    bien(una.datos.data.freeOpens === 2, `quedan 2 (dio ${una.datos.data.freeOpens})`);

    u = await User.findById(j.id).select("+balanceSc +jugadoSc").lean();
    bien(Number(u.balanceSc) === 0, `el saldo sigue en cero (dio ${u.balanceSc})`);
    bien(Number(u.jugadoSc) > 0, `pero cuenta como jugado para el VIP (dio ${u.jugadoSc})`);

    const asientos = await BalanceTransaction.find({ user: j.id }).lean();
    bien(asientos.length === 1, `un solo asiento en el libro (dio ${asientos.length})`);
    bien(
      asientos[0] && asientos[0].amountSc === 0 && asientos[0].reference.kind === "freeOpen",
      "y es de monto cero, marcado como apertura de regalo"
    );

    const objetos = await InventoryItem.countDocuments({ user: j.id });
    bien(objetos === 1, `el objeto esta en el inventario (dio ${objetos})`);

    const recibos = await BoxOpen.countDocuments({ user: j.id, conAperturaGratis: true });
    bien(recibos === 1, `y el recibo dice que fue gratis (dio ${recibos})`);

    // ── 3. Las otras dos ──────────────────────────────────────────
    await abrir(j.token, slugs[1]);
    const tres = await abrir(j.token, slugs[2]);
    bien(tres.datos.data.freeOpens === 0, `quedan 0 (dio ${tres.datos.data.freeOpens})`);

    u = await User.findById(j.id).select("+balanceSc cajasGratis").lean();
    bien(u.cajasGratis.every((c) => c.usadaEl !== null), "las tres quedan marcadas como usadas");
    bien(Number(u.balanceSc) === 0, `el saldo nunca se movio (dio ${u.balanceSc})`);

    // ── 4. Una mas, sin tener ─────────────────────────────────────
    const demas = await abrir(j.token, slugs[0]);
    bien(demas.estado >= 400, `sin cajas y sin saldo, rebota (HTTP ${demas.estado})`);

    // ── 5. Las tres a la vez: no se crea saldo ────────────────────
    const otro = await registrar(`${marca}p`);
    const suyas = (await User.findById(otro.id).select("cajasGratis").lean()).cajasGratis;

    await Promise.allSettled(suyas.map((c) => abrir(otro.token, c.slug)));

    const u2 = await User.findById(otro.id).select("+balanceSc").lean();
    bien(Number(u2.balanceSc) === 0, `tres a la vez no crean saldo (dio ${u2.balanceSc})`);

    // ── 6. El deposito da bono, no cajas ──────────────────────────
    const tercero = await registrar(`${marca}d`);
    const antes = (await User.findById(tercero.id).select("freeOpens").lean()).freeOpens;

    const cuerpo = JSON.stringify({
      status: "Paid",
      type: "static_address",
      track_id: `reg-${Date.now()}-${v}`,
      order_id: String(tercero.id),
      currency: "USDT",
      amount: 100,
      value: 100,
    });
    const clave = leerEnv("OXAPAY_CALLBACK_SECRET") || leerEnv("OXAPAY_MERCHANT_KEY");
    const firma = crypto.createHmac("sha512", clave).update(cuerpo).digest("hex");
    await fetch(`${API}/hooks/oxapay`, {
      method: "POST",
      headers: { "content-type": "application/json", hmac: firma },
      body: cuerpo,
    });

    const u3 = await User.findById(tercero.id).select("+balanceSc freeOpens").lean();
    bien(Number(u3.balanceSc) === 150, `el deposito da el bono: SC 150 (dio ${u3.balanceSc})`);
    bien(u3.freeOpens === antes, `y NO da cajas de mas (sigue en ${u3.freeOpens})`);
  }

  // ── Limpieza ────────────────────────────────────────────────────
  await BalanceTransaction.deleteMany({ user: { $in: creadas } });
  await InventoryItem.deleteMany({ user: { $in: creadas } });
  await BoxOpen.deleteMany({ user: { $in: creadas } });
  await User.deleteMany({ _id: { $in: creadas } });
  console.log(`\n(se borraron las ${creadas.length} cuentas de prueba)`);

  console.log(fallas ? `\n${fallas} COSAS MAL, mirar arriba.` : "\nTODO BIEN.");

  await mongoose.disconnect();
  process.exit(fallas ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
