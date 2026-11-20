/**
 * LOS TRES MODELOS DE COMISION, Y LA VIDA DE UN REFERIDO.
 *
 * Esto es la plata del programa de afiliados, asi que cada numero se
 * prueba contra una cuenta hecha a mano en el comentario:
 *
 *   cpa ........ nada por jugada; SC fijos una vez, cuando califica
 *   revshare ... % del margen REAL; una jugada perdedora paga cero
 *   hibrido .... CPA + RevShare: un cpa mas chico al calificar, y un
 *                revshare mas chico de ahi en adelante
 *
 * Y la parte que mas duele si sale mal: que una cabeza se pague UNA vez.
 * No con un `if`, sino con el indice unico `(code, user)` y con la
 * condicion adentro del filtro.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DATABASE_URI = process.env.TEST_DB_URI || "mongodb://127.0.0.1:27017/mrbox_test_modelos";
process.env.JWT_SECRET = "prueba-local";
process.env.TURNSTILE_SECRET_KEY = "";
process.env.AUTH_RATE_LIMIT = "500";
process.env.LOG_LEVEL = "error";

const mongoose = require("mongoose");
const { conectar, asegurarIndices } = require("../database");

const User = require("../database/models/User");
const AffiliateCode = require("../database/models/AffiliateCode");
const AffiliateConversion = require("../database/models/AffiliateConversion");
const Settings = require("../database/models/Settings");

const afiliados = require("../services/affiliates");
const wallet = require("../services/wallet");

let hayBase = true;

test.before(async () => {
  try {
    await conectar();
    await mongoose.connection.db.dropDatabase();
    /* El `dropDatabase` se lleva puestos los indices, y los unicos
       son los que hacen cumplir media docena de reglas de esta
       suite. Hay que volver a crearlos a mano. */
    await asegurarIndices();
    /* La escalera de fábrica, por si otro test la dejó tocada. */
    await Settings.updateOne({}, { $set: { rangosAfiliado: [], afiliados: {} } }, { upsert: true });
    await afiliados.recargar();
  } catch {
    hayBase = false;
  }
});

test.after(async () => {
  if (hayBase) {
    await mongoose.connection.db.dropDatabase().catch(() => {});
    await mongoose.disconnect().catch(() => {});
  }
});

let n = 0;

/** Un socio con una campaña de ese modelo, y un jugador atado a ella. */
async function armar({ modelo, rango = 1 }) {
  n += 1;

  const socio = await User.create({
    username: `soc${n}`,
    email: `soc${n}@test.local`,
    passwordHash: "x",
    rangoAfiliado: rango,
  });

  const codigo = await AffiliateCode.create({
    code: `MOD${n}`,
    owner: socio._id,
    nombre: `campaña ${n}`,
    modelo,
  });

  const jugador = await User.create({
    username: `ref${n}`,
    email: `ref${n}@test.local`,
    passwordHash: "x",
    referredBy: socio._id,
    affiliateCode: codigo.code,
  });

  await AffiliateConversion.create({
    code: codigo._id,
    owner: socio._id,
    user: jugador._id,
    modelo,
  });

  return { socio, codigo, jugador };
}

/** Lo deja listo para calificar: depositó, jugó y está verificado. */
async function queCalifique(jugador, { depositoSc = 300, jugadoSc = 200 } = {}) {
  await wallet.mover({ userId: jugador._id, amountSc: depositoSc, type: "purchase" });
  await wallet.mover({ userId: jugador._id, amountSc: -jugadoSc, type: "box_open" });
  await User.updateOne({ _id: jugador._id }, { $set: { verificationLevel: 2 } });
  return User.findById(jugador._id).lean();
}

/* ══ 1. Cuánto paga cada modelo por una jugada ════════════════════ */

test("REVSHARE paga sobre el margen REAL, y nunca negativo", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  const { codigo, jugador } = await armar({ modelo: "revshare" });

  /* Jugó SC 1.000 y la casa ganó SC 80. Bronze cobra 35%: SC 28. */
  const r = await afiliados.anotarComision({ jugador, jugadoSc: 1000, margenSc: 80 });
  assert.equal(r.ganado, 28, "35% de los 80 de margen");

  /* Se llevó un premio más caro que la caja: la casa perdió 400. */
  const perdida = await afiliados.anotarComision({ jugador, jugadoSc: 50, margenSc: -400 });
  assert.equal(perdida.ganado, 0, "una jugada perdedora paga cero, no negativo");

  const c = await AffiliateCode.findById(codigo._id).lean();
  assert.equal(c.ganadoSc, 28, "lo ganado no baja por la suerte de nadie");
  assert.equal(c.jugadoPorLosSuyosSc, 1050, "lo jugado se cuenta igual");
});

test("HIBRIDO paga un revshare más chico por jugada", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  const { jugador } = await armar({ modelo: "hibrido" });

  /* Bronze híbrido: 30% del margen. De 80, SC 24. */
  const r = await afiliados.anotarComision({ jugador, jugadoSc: 1000, margenSc: 80 });
  assert.equal(r.ganado, 24);
});

test("CPA no paga NADA por jugada: cobra una sola vez, al calificar", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  const { codigo, jugador } = await armar({ modelo: "cpa" });

  const r = await afiliados.anotarComision({ jugador, jugadoSc: 5000, margenSc: 400 });
  assert.equal(r.ganado, 0);

  const c = await AffiliateCode.findById(codigo._id).lean();
  assert.equal(c.ganadoSc, 0);
  assert.equal(c.jugadoPorLosSuyosSc, 5000, "pero lo jugado se anota igual");
});

test("el RANGO sube la comisión de las campañas que ya existen", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  const { socio, jugador } = await armar({ modelo: "revshare", rango: 1 });

  const bronce = await afiliados.anotarComision({ jugador, jugadoSc: 1000, margenSc: 100 });
  assert.equal(bronce.ganado, 35, "Bronze: 35%");

  await afiliados.otorgarRango({ userId: socio._id, numero: 6 });

  const arriba = await afiliados.anotarComision({ jugador, jugadoSc: 1000, margenSc: 100 });
  assert.equal(arriba.ganado, 60, "Diamond: 60%, sin tocar la campaña");
});

test("una campaña apagada no sigue generando comisión", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  const { codigo, jugador } = await armar({ modelo: "revshare" });
  await AffiliateCode.updateOne({ _id: codigo._id }, { $set: { activo: false } });

  const r = await afiliados.anotarComision({ jugador, jugadoSc: 1000, margenSc: 100 });
  assert.equal(r, null);

  const c = await AffiliateCode.findById(codigo._id).lean();
  assert.equal(c.ganadoSc, 0);
});

/* ══ 2. La vida de un referido ════════════════════════════════════ */

test("un referido que no llegó a los mínimos NO califica", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  const { codigo, jugador } = await armar({ modelo: "cpa" });

  /* Depositó SC 10 --el mínimo son 20-- y jugó poco. */
  await wallet.mover({ userId: jugador._id, amountSc: 10, type: "purchase" });
  await wallet.mover({ userId: jugador._id, amountSc: -5, type: "box_open" });
  const u = await User.findById(jugador._id).lean();

  await afiliados.anotarComision({ jugador: u, jugadoSc: 5, margenSc: 0.4 });

  const ficha = await AffiliateConversion.findOne({ code: codigo._id, user: jugador._id }).lean();
  assert.equal(ficha.estado, "deposito", "puso plata, pero le falta");
  assert.equal(ficha.montoSc, 0, "nada congelado todavía");

  const c = await AffiliateCode.findById(codigo._id).lean();
  assert.equal(c.ganadoSc, 0);
});

test("CUANDO CALIFICA se congela lo que le toca y queda esperando", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  const { codigo, jugador } = await armar({ modelo: "cpa" });
  const u = await queCalifique(jugador);

  await afiliados.anotarComision({ jugador: u, jugadoSc: 200, margenSc: 16 });

  const ficha = await AffiliateConversion.findOne({ code: codigo._id, user: jugador._id }).lean();
  assert.equal(ficha.estado, "califica");
  assert.equal(ficha.montoSc, 15, "el CPA de Bronze: SC 15");
  assert.equal(ficha.nivelKyc, 2);
  assert.ok(ficha.calificoEl, "quedó la fecha en que calificó");

  /* La espera son 14 días: ni se paga hoy ni se paga nunca. */
  const dias = Math.round((new Date(ficha.liberaEl) - new Date(ficha.calificoEl)) / 86400000);
  assert.equal(dias, 14);

  /* Y todavía NO se le pagó al socio. */
  const c = await AffiliateCode.findById(codigo._id).lean();
  assert.equal(c.ganadoSc, 0, "calificar no es cobrar");
});

test("la espera se respeta: antes de la fecha no se paga", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  const { codigo, jugador } = await armar({ modelo: "cpa" });
  const u = await queCalifique(jugador);
  await afiliados.anotarComision({ jugador: u, jugadoSc: 200, margenSc: 16 });

  const pagadas = await afiliados.liberarCalificados();
  assert.equal(pagadas, 0, "falta la espera");

  const c = await AffiliateCode.findById(codigo._id).lean();
  assert.equal(c.ganadoSc, 0);

  /* Pasada la fecha, se paga. */
  await AffiliateConversion.updateOne(
    { code: codigo._id, user: jugador._id },
    { $set: { liberaEl: new Date(Date.now() - 1000) } }
  );

  const ahora = await afiliados.liberarCalificados();
  assert.equal(ahora, 1);

  const despues = await AffiliateCode.findById(codigo._id).lean();
  assert.equal(despues.ganadoSc, 15);

  /* Y una segunda vuelta no paga de nuevo. */
  assert.equal(await afiliados.liberarCalificados(), 0);
  const final = await AffiliateCode.findById(codigo._id).lean();
  assert.equal(final.ganadoSc, 15, "una cabeza se paga UNA vez");
});

test("DIEZ PEDIDOS DE PAGO AL MISMO TIEMPO PAGAN UNA SOLA CABEZA", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  const { codigo, jugador } = await armar({ modelo: "hibrido" });
  const u = await queCalifique(jugador);
  await afiliados.anotarComision({ jugador: u, jugadoSc: 200, margenSc: 16 });

  const antes = await AffiliateCode.findById(codigo._id).lean();
  const ficha = await AffiliateConversion.findOne({ code: codigo._id, user: jugador._id }).lean();
  assert.equal(ficha.montoSc, 10, "el híbrido de Bronze: SC 10 por cabeza");

  const intentos = await Promise.all(
    Array.from({ length: 10 }, () => afiliados.pagarCabeza({ fichaId: ficha._id }))
  );
  const pasaron = intentos.filter(Boolean).length;
  assert.equal(pasaron, 1, `pagó ${pasaron} veces`);

  const c = await AffiliateCode.findById(codigo._id).lean();
  assert.equal(c.ganadoSc, antes.ganadoSc + 10);
});

test("un jugador le paga a UNA campaña, y una sola vez", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  const { codigo, jugador } = await armar({ modelo: "cpa" });

  /* El índice único es el que lo impide, no un `if`. */
  await assert.rejects(
    () =>
      AffiliateConversion.create({
        code: codigo._id,
        owner: codigo.owner,
        user: jugador._id,
        modelo: "cpa",
      }),
    (err) => err.code === 11000,
    "la base tiene que rechazar la segunda ficha"
  );
});

test("las señales dejan la cabeza esperando a que una persona la mire", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  const { codigo, jugador } = await armar({ modelo: "cpa" });
  const u = await queCalifique(jugador);
  await afiliados.anotarComision({ jugador: u, jugadoSc: 200, margenSc: 16 });

  await AffiliateConversion.updateOne(
    { code: codigo._id, user: jugador._id },
    { $set: { liberaEl: new Date(Date.now() - 1000), senales: ["misma_direccion_que_3"] } }
  );

  assert.equal(await afiliados.liberarCalificados(), 0, "con señales no se paga solo");

  const c = await AffiliateCode.findById(codigo._id).lean();
  assert.equal(c.ganadoSc, 0);

  /* Pero alguien del equipo la puede pagar a mano. */
  const ficha = await AffiliateConversion.findOne({ code: codigo._id, user: jugador._id }).lean();
  const pagada = await afiliados.pagarCabeza({ fichaId: ficha._id, porQuien: codigo.owner });
  assert.equal(pagada.estado, "pagado");

  const despues = await AffiliateCode.findById(codigo._id).lean();
  assert.equal(despues.ganadoSc, 15);
});

test("anular una cabeza pide motivo y no paga nada", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  const { codigo, jugador } = await armar({ modelo: "cpa" });
  const u = await queCalifique(jugador);
  await afiliados.anotarComision({ jugador: u, jugadoSc: 200, margenSc: 16 });

  const ficha = await AffiliateConversion.findOne({ code: codigo._id, user: jugador._id }).lean();

  await assert.rejects(
    () => afiliados.anularCabeza({ fichaId: ficha._id, motivo: "", porQuien: codigo.owner }),
    (err) => err.code === "REASON_REQUIRED"
  );

  const anulada = await afiliados.anularCabeza({
    fichaId: ficha._id,
    motivo: "tres cuentas desde la misma casa",
    porQuien: codigo.owner,
  });
  assert.equal(anulada.estado, "anulado");
  assert.match(anulada.motivo, /misma casa/);

  assert.equal(await afiliados.liberarCalificados(), 0);
  const c = await AffiliateCode.findById(codigo._id).lean();
  assert.equal(c.ganadoSc, 0);
});

test("el revshare puro no genera pagos por cabeza", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  const { codigo, jugador } = await armar({ modelo: "revshare" });
  const u = await queCalifique(jugador);
  await afiliados.anotarComision({ jugador: u, jugadoSc: 200, margenSc: 16 });

  const ficha = await AffiliateConversion.findOne({ code: codigo._id, user: jugador._id }).lean();
  assert.equal(ficha.estado, "nuevo", "el revshare no mueve la ficha: no hay cabeza que pagar");
  assert.equal(ficha.montoSc, 0);
});

/* ══ 3. Cobrar ════════════════════════════════════════════════════ */

test("el mínimo para cobrar sale del rango", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  const { socio, codigo } = await armar({ modelo: "revshare", rango: 1 });
  await AffiliateCode.updateOne({ _id: codigo._id }, { $set: { ganadoSc: 30 } });

  /* Bronze pide SC 50. */
  await assert.rejects(
    () => afiliados.cobrar({ userId: socio._id, codigoId: codigo._id }),
    (err) => err.code === "BELOW_MINIMUM"
  );

  /* Emerald no pide mínimo. */
  await afiliados.otorgarRango({ userId: socio._id, numero: 5 });
  const r = await afiliados.cobrar({ userId: socio._id, codigoId: codigo._id });
  assert.equal(r.cobradoSc, 30);

  const saldo = await wallet.saldoDe(socio._id);
  assert.equal(saldo.balanceSc, 30, "le entró a la billetera");
});

test("crear una campaña: el modelo tiene que estar abierto", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  n += 1;
  const socio = await User.create({
    username: `crea${n}`, email: `crea${n}@test.local`, passwordHash: "x",
  });

  /*
    LOS TRES MODELOS SE ELIGEN SOLOS, PERO LA PUERTA TIENE QUE CERRAR.

    El `cpa` ahora esta abierto como los otros dos. Lo que se prueba
    acá es que la lista del panel --`afiliados.modelos`-- siga
    mandando: el día que se cierre un modelo desde el panel, esto es
    lo que avisa si la puerta no cerró.
  */
  const cpaAbierto = await afiliados.crearCampana({
    usuario: socio, code: `CPAMIO${n}`, modelo: "cpa",
  });
  assert.equal(cpaAbierto.modelo, "cpa", "el cpa se elige solo y queda guardado");

  await Settings.updateOne({}, { $set: { "afiliados.modelos": ["revshare", "hibrido"] } });
  await afiliados.recargar();

  await assert.rejects(
    () => afiliados.crearCampana({ usuario: socio, code: `CPANO${n}`, modelo: "cpa" }),
    (err) => err.code === "MODEL_NOT_OPEN",
    "cerrado desde el panel, rebota"
  );

  await Settings.updateOne({}, { $set: { "afiliados.modelos": [] } });
  await afiliados.recargar();

  const buena = await afiliados.crearCampana({
    usuario: socio,
    nombre: "YouTube · reviews",
    code: "mi-codigo",
    canal: "YouTube",
    modelo: "revshare",
  });
  assert.equal(buena.code, "MI-CODIGO", "el código se guarda en mayúsculas");
  assert.equal(buena.modelo, "revshare");

  /* Y nadie pisa el código de otro. */
  await assert.rejects(
    () => afiliados.crearCampana({ usuario: socio, code: "MI-CODIGO", modelo: "hibrido" }),
    (err) => err.code === "CODE_TAKEN"
  );

  /* Ni se queda con cincuenta campañas. */
  for (let i = 0; i < afiliados.COMO_MAXIMO; i += 1) {
    await afiliados
      .crearCampana({ usuario: socio, code: `LLENO${n}X${i}`, modelo: "revshare" })
      .catch(() => {});
  }
  await assert.rejects(
    () => afiliados.crearCampana({ usuario: socio, code: `UNAMAS${n}`, modelo: "revshare" }),
    (err) => err.code === "TOO_MANY_CAMPAIGNS"
  );
});
