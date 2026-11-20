/*
  "LOS PRIMEROS N QUE SAQUEN UN <OBJETO> SE LLEVAN SC X CADA UNO."

  Se recorre lo mismo que pasaria un dia de promocion:

    1. se publica el desafio sobre un objeto, sin caja (vale en todas)
    2. el primero que lo saca cobra, y el asiento dice el objeto
    3. el segundo tambien
    4. el tercero NO: los cupos se acabaron
    5. el primero lo vuelve a sacar y NO cobra de nuevo
    6. un desafio sin objeto Y sin multiplicador no se puede guardar

  Para que el objeto salga sin esperar, se elige el premio MAS PROBABLE
  de una caja barata y se abre hasta que toca.

  SOLO CONTRA LOCALHOST Y LA BASE DE DESARROLLO.

  Uso:  node audit/pocs/desafio-por-objeto.js
*/
const path = require("path");
const fs = require("fs");

const RAIZ = path.join(__dirname, "..", "..", "backend");
const API = "http://localhost:5001/api";

/* Cuantas aperturas se le dan a cada jugador para que salga el objeto.
   Con el premio mas probable de la caja alcanza de sobra. */
const INTENTOS = 60;

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
  const Challenge = require(path.join(RAIZ, "database", "models", "Challenge"));
  const { ChallengeWin } = require(path.join(RAIZ, "database", "models", "Challenge"));
  const BalanceTransaction = require(path.join(RAIZ, "database", "models", "BalanceTransaction"));
  const InventoryItem = require(path.join(RAIZ, "database", "models", "InventoryItem"));
  const BoxOpen = require(path.join(RAIZ, "database", "models", "BoxOpen"));
  const wallet = require(path.join(RAIZ, "services", "wallet"));

  const creadas = [];
  let desafio = null;

  const limpiar = async () => {
    if (desafio) {
      await ChallengeWin.deleteMany({ challenge: desafio._id });
      await Challenge.deleteOne({ _id: desafio._id });
    }
    await BalanceTransaction.deleteMany({ user: { $in: creadas } });
    await InventoryItem.deleteMany({ user: { $in: creadas } });
    await BoxOpen.deleteMany({ user: { $in: creadas } });
    await User.deleteMany({ _id: { $in: creadas } });
  };

  try {
    // ── La caja y su premio mas probable ──────────────────────────
    const caja = await Box.findOne({ live: true, priceSc: { $gt: 0, $lt: 3 } })
      .sort({ priceSc: 1 })
      .lean();
    if (!caja) throw new Error("no encontre una caja barata y viva");

    const comun = [...caja.prizes].sort((a, b) => b.chance - a.chance)[0];
    console.log(`\ncaja: ${caja.slug} (SC ${caja.priceSc})`);
    console.log(`objeto: ${comun.name} — sale ${(comun.chance * 100).toFixed(1)}% de las veces\n`);

    // ── 1. Se publica el desafio ──────────────────────────────────
    console.log("=== 1. Se publica: los primeros 2 se llevan SC 5 ===");

    const PREMIO = 5;
    const CUPOS = 2;

    desafio = await Challenge.create({
      /* Sin caja a proposito: vale en todas las que tengan el objeto. */
      box: null,
      item: comun.item,
      itemName: comun.name,
      premioSc: PREMIO,
      cupos: CUPOS,
      desde: new Date(Date.now() - 60000),
      hasta: new Date(Date.now() + 60 * 60 * 1000),
      activo: true,
    });
    bien(!!desafio._id, `queda publicado, ${CUPOS} cupos de SC ${PREMIO}`);

    // ── El que no lleva ni objeto ni multiplicador, rebota ─────────
    let rebote = null;
    try {
      await Challenge.create({
        box: caja._id,
        premioSc: 1,
        cupos: 1,
        desde: new Date(),
        hasta: new Date(Date.now() + 1000),
      });
    } catch (err) {
      rebote = err;
    }
    bien(!!rebote, "y uno sin objeto NI multiplicador no se puede guardar");

    // ── Los jugadores ─────────────────────────────────────────────
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
      await wallet.mover({
        userId: d.user._id,
        amountSc: 200,
        type: "manual",
        reference: { kind: "poc", label: "saldo de prueba" },
      });
      return { id: d.user._id, token: d.token, nombre };
    };

    /** Abre hasta que salga el objeto. Devuelve si salio y si cobro. */
    const abrirHasta = async (j) => {
      for (let i = 0; i < INTENTOS; i += 1) {
        const r = await fetch(`${API}/boxes/${caja.slug}/open`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-auth-token": j.token },
          body: JSON.stringify({ veces: 1 }),
        });
        const d = await r.json();
        if (!d.data) throw new Error("no abrio: " + JSON.stringify(d));

        /* Cada apertura trae su `premio` adentro de `resultados`. */
        const salio = (d.data.resultados || [])
          .some((x) => x.premio && String(x.premio.name) === String(comun.name));
        if (salio) {
          const cobro = await BalanceTransaction.findOne({
            user: j.id,
            type: "challenge",
          }).lean();
          return { salio: true, cobro, vueltas: i + 1 };
        }
      }
      return { salio: false, cobro: null, vueltas: INTENTOS };
    };

    const marca = `do${Date.now().toString(36).slice(-6)}`;

    // ── 2 y 3. Los dos primeros cobran ────────────────────────────
    console.log("\n=== 2. Los dos primeros que lo sacan ===");

    const ganadores = [];
    for (let n = 1; n <= CUPOS; n += 1) {
      const j = await registrar(`${marca}g${n}`);
      const res = await abrirHasta(j);
      bien(res.salio, `jugador ${n}: le salio el objeto (en ${res.vueltas} aperturas)`);
      bien(!!res.cobro, `jugador ${n}: cobro el desafio`);
      if (res.cobro) {
        bien(Number(res.cobro.amountSc) === PREMIO, `jugador ${n}: SC ${PREMIO} (dio ${res.cobro.amountSc})`);
        bien(
          res.cobro.reference && res.cobro.reference.label === comun.name,
          `jugador ${n}: el asiento dice "${comun.name}" (dio "${res.cobro.reference && res.cobro.reference.label}")`
        );
      }
      ganadores.push(j);
    }

    const tras = await Challenge.findById(desafio._id).lean();
    bien(tras.cuposUsados === CUPOS, `los ${CUPOS} cupos quedaron tomados (dio ${tras.cuposUsados})`);

    // ── 4. El tercero llega tarde ─────────────────────────────────
    console.log("\n=== 3. El siguiente llega tarde ===");

    const tarde = await registrar(`${marca}t`);
    const resTarde = await abrirHasta(tarde);
    bien(resTarde.salio, `le salio el objeto igual (en ${resTarde.vueltas} aperturas)`);
    bien(!resTarde.cobro, "pero NO cobro: los cupos estaban agotados");

    const aun = await Challenge.findById(desafio._id).lean();
    bien(aun.cuposUsados === CUPOS, `y los cupos siguen en ${CUPOS} (dio ${aun.cuposUsados})`);

    // ── 5. El primero no cobra dos veces ──────────────────────────
    console.log("\n=== 4. El primero lo vuelve a sacar ===");

    const antes = await BalanceTransaction.countDocuments({ user: ganadores[0].id, type: "challenge" });
    await abrirHasta(ganadores[0]);
    const despues = await BalanceTransaction.countDocuments({ user: ganadores[0].id, type: "challenge" });
    bien(antes === 1 && despues === 1, `cobro una sola vez (antes ${antes}, despues ${despues})`);

    const filas = await ChallengeWin.countDocuments({ challenge: desafio._id });
    bien(filas === CUPOS, `hay ${CUPOS} ganadores anotados (dio ${filas})`);

    // ── 6. Lo que ve la pantalla ──────────────────────────────────
    console.log("\n=== 5. Lo que ve la pantalla ===");

    const r = await fetch(`${API}/challenges`, {
      headers: { "x-auth-token": ganadores[0].token },
    });
    const lista = ((await r.json()).data || {}).items || [];
    const mio = lista.find((x) => String(x._id) === String(desafio._id));

    bien(!!mio, "el desafio aparece en la lista");
    if (mio) {
      bien(mio.itemName === comun.name, `dice el objeto: "${mio.itemName}"`);
      bien(mio.multiplicador === null, "y no inventa un multiplicador");
      bien(mio.cuposLibres === 0, `no quedan cupos (dio ${mio.cuposLibres})`);
      bien(mio.yaLoGane === true, "y a este jugador le dice que ya lo gano");
    }
  } finally {
    await limpiar();
    console.log(`\n(se borraron las ${creadas.length} cuentas y el desafio de prueba)`);
  }

  console.log(fallas ? `\n${fallas} COSAS MAL, mirar arriba.` : "\nTODO BIEN.");

  await mongoose.disconnect();
  process.exit(fallas ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
