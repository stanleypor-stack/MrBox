/*
  EL BONO DE BIENVENIDA, DE PUNTA A PUNTA.

  Hace lo que haria un jugador de verdad, con un aviso de pago firmado
  igual que los de OxaPay:

    1. cuenta nueva
    2. deposito de USD 100  -> +50%, atado y con 10x por jugar
    3. segundo deposito     -> SIN bono de bienvenida
    4. deposito chico       -> el bono tambien aplica
    5. una cuenta vieja     -> la ventana de 30 minutos ya cerro

  Las cajas de regalo NO entran aca: son del registro.

  SOLO CONTRA LOCALHOST Y LA BASE DE DESARROLLO.

  Uso:  node audit/pocs/bono-de-bienvenida.js
*/
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const RAIZ = path.join(__dirname, "..", "..", "backend");
const API = "http://localhost:5001/api";

function leerEnv(clave) {
  const archivo = path.join(RAIZ, ".env");
  for (const linea of fs.readFileSync(archivo, "utf8").split(/\r?\n/)) {
    const i = linea.indexOf("=");
    if (i > 0 && linea.slice(0, i).trim() === clave) {
      return linea.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  return "";
}

const CLAVE = leerEnv("OXAPAY_CALLBACK_SECRET") || leerEnv("OXAPAY_MERCHANT_KEY");

/** Un aviso de pago firmado, con el formato real de OxaPay. */
async function depositar(userId, usd, etiqueta) {
  const cuerpo = JSON.stringify({
    status: "Paid",
    type: "static_address",
    track_id: `${etiqueta}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    order_id: String(userId),
    currency: "USDT",
    /* `amount` son unidades de la moneda y `value` son dolares: el
       servidor acredita `value`. Con USDT dan parecido, pero se mandan
       distintos a proposito para que se note cual usa. */
    amount: usd,
    value: usd,
  });

  const firma = crypto.createHmac("sha512", CLAVE).update(cuerpo).digest("hex");

  const r = await fetch(`${API}/hooks/oxapay`, {
    method: "POST",
    headers: { "content-type": "application/json", hmac: firma },
    body: cuerpo,
  });

  return { estado: r.status, texto: await r.text() };
}

function bien(ok, texto) {
  console.log(`  ${ok ? "OK  " : "MAL "} ${texto}`);
  return ok;
}

(async () => {
  const mongoose = require(path.join(RAIZ, "node_modules", "mongoose"));
  const uri = leerEnv("DATABASE_URI");

  if (!/127\.0\.0\.1|localhost/.test(uri) || !/mrbox_local/.test(uri)) {
    console.error("Solo contra mrbox_local en 127.0.0.1. Abortado.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const User = require(path.join(RAIZ, "database", "models", "User"));
  const wallet = require(path.join(RAIZ, "services", "wallet"));

  let todoBien = true;
  const nuevo = async (nombre, hace = 0) => {
    const u = await User.create({
      username: nombre,
      email: `${nombre}@prueba.local`,
      passwordHash: "x".repeat(60),
      balanceSc: 0,
    });
    /*
      Por el driver directo, no por mongoose: con `timestamps` prendido
      mongoose marca `createdAt` como inmutable y se come el cambio en
      silencio, asi que la cuenta "vieja" quedaba recien creada y la
      prueba de la ventana no probaba nada.
    */
    if (hace) {
      await User.collection.updateOne(
        { _id: u._id },
        { $set: { createdAt: new Date(Date.now() - hace) } }
      );
    }
    return u;
  };

  const marca = Date.now();

  // ── 1 y 2. Deposito de USD 100 ──────────────────────────────────
  console.log("\nUSD 100 en una cuenta nueva:");
  const a = await nuevo(`bono_a_${marca}`);
  const r1 = await depositar(a._id, 100, "A");

  todoBien &= bien(r1.estado === 200 && r1.texto === "ok", `la pasarela recibe "ok" (dio ${r1.estado} "${r1.texto}")`);

  let s = await wallet.saldoDe(a._id);
  let u = await User.findById(a._id).select("freeOpens bonoDeBienvenidaEl").lean();

  todoBien &= bien(s.balanceSc === 150, `saldo SC 150 (dio ${s.balanceSc})`);
  todoBien &= bien(s.bonoPendienteSc === 500, `por jugar SC 500 = 50 x 10 (dio ${s.bonoPendienteSc})`);
  todoBien &= bien(s.canjeableSc === 100, `canjeable SC 100, el bono atado (dio ${s.canjeableSc})`);
  todoBien &= bien(!!u.bonoDeBienvenidaEl, "queda marcado como usado");

  // ── 3. El segundo deposito ──────────────────────────────────────
  console.log("\nSegundo deposito de la misma cuenta:");
  await depositar(a._id, 100, "A2");
  s = await wallet.saldoDe(a._id);
  u = await User.findById(a._id).select("freeOpens").lean();

  todoBien &= bien(s.balanceSc === 250, `saldo SC 250, sin bono de nuevo (dio ${s.balanceSc})`);

  // ── 4. Abajo del piso de las cajas ──────────────────────────────
  console.log("\nUSD 20, abajo del piso de $50:");
  const b = await nuevo(`bono_b_${marca}`);
  await depositar(b._id, 20, "B");
  s = await wallet.saldoDe(b._id);
  u = await User.findById(b._id).select("freeOpens").lean();

  todoBien &= bien(s.balanceSc === 30, `saldo SC 30 = 20 + 50% (dio ${s.balanceSc})`);

  // ── 5. La ventana cerrada ───────────────────────────────────────
  console.log("\nCuenta de hace dos horas (la ventana es de 30 minutos):");
  const c = await nuevo(`bono_c_${marca}`, 2 * 60 * 60 * 1000);
  await depositar(c._id, 100, "C");
  s = await wallet.saldoDe(c._id);
  u = await User.findById(c._id).select("freeOpens bonoDeBienvenidaEl").lean();

  todoBien &= bien(s.balanceSc === 100, `saldo SC 100, sin bono (dio ${s.balanceSc})`);
  todoBien &= bien(!u.bonoDeBienvenidaEl, "no queda marcado: lo puede usar si se reabre la oferta");

  // ── Limpieza ────────────────────────────────────────────────────
  await User.deleteMany({ username: { $in: [a.username, b.username, c.username] } });
  console.log("\n(las tres cuentas de prueba quedaron borradas)");

  console.log(todoBien ? "\nTODO BIEN." : "\nHAY ALGO MAL, mirar arriba.");

  await mongoose.disconnect();
  process.exit(todoBien ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
