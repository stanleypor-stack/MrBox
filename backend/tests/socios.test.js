/**
 * EL PROGRAMA DE AFILIADOS, POR HTTP.
 *
 * Las dos puntas: lo que hace un socio desde su pantalla --crear
 * campañas, elegir modelo, cambiar el código, cobrar, pedir rango-- y lo
 * que hace el equipo desde el panel --ver socios, otorgar rangos, mirar
 * la cola de cabezas y editar la escalera--.
 *
 * LO QUE IMPORTA ACA
 *
 *   - que un jugador no pueda tocar el panel aunque tenga sesión
 *   - que nadie cobre dos veces ni pise el código de otro
 *   - que el rango no se pueda subir solo: lo otorga una persona
 *   - que un rango o una escalera sin motivo no se guarden
 *   - que la escalera no se pueda dejar al revés, con un rango que
 *     pague menos que el anterior
 */

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DATABASE_URI = process.env.TEST_DB_URI || "mongodb://127.0.0.1:27017/mrbox_test_socios";
process.env.JWT_SECRET = "prueba-local";
process.env.TURNSTILE_SECRET_KEY = "";
process.env.AUTH_RATE_LIMIT = "500";
process.env.AFFILIATE_RATE_LIMIT = "500";
process.env.LOG_LEVEL = "error";

const mongoose = require("mongoose");
const { app } = require("../index");
const { conectar } = require("../database");

const User = require("../database/models/User");
const AffiliateCode = require("../database/models/AffiliateCode");
const AffiliateConversion = require("../database/models/AffiliateConversion");
const AdminLog = require("../database/models/AdminLog");
const Settings = require("../database/models/Settings");

const afiliados = require("../services/affiliates");
const wallet = require("../services/wallet");

let servidor;
let base = "";
let hayBase = true;

test.before(async () => {
  try {
    await conectar();
    await mongoose.connection.db.dropDatabase();
    await Settings.updateOne({}, { $set: { rangosAfiliado: [], afiliados: {} } }, { upsert: true });
    await afiliados.recargar();
    servidor = app.listen(0);
    await new Promise((r) => servidor.once("listening", r));
    base = `http://127.0.0.1:${servidor.address().port}/api`;
  } catch {
    hayBase = false;
  }
});

test.after(async () => {
  if (servidor) await new Promise((r) => servidor.close(r));
  if (hayBase) {
    await mongoose.connection.db.dropDatabase().catch(() => {});
    await mongoose.disconnect().catch(() => {});
  }
});

async function pedir(metodo, ruta, { cuerpo, token } = {}) {
  const r = await fetch(base + ruta, {
    method: metodo,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "x-auth-token": token } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return { estado: r.status, datos: await r.json() };
}

let n = 0;
async function cuenta(rank = "user") {
  n += 1;
  const { datos } = await pedir("POST", "/auth/register", {
    cuerpo: { username: "soc" + n + "x", email: `soc${n}x@test.local`, password: "unaclavelarga" },
  });
  if (rank !== "user") await User.updateOne({ _id: datos.user._id }, { $set: { rank } });
  return { id: datos.user._id, token: datos.token, username: datos.user.username };
}

/* ══ Lo que ve y hace el socio ════════════════════════════════════ */

test("la pantalla del socio trae su rango, la escalera y el bono de sus jugadores", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const yo = await cuenta();

  const r = await pedir("GET", "/affiliates", { token: yo.token });
  assert.equal(r.estado, 200);

  const d = r.datos.data;
  assert.equal(d.rango.numero, 1, "todo el mundo arranca en el primero");
  assert.equal(d.rango.nombre, "Bronce");
  assert.equal(d.escalera.length, 8);
  assert.equal(d.bonoParaElAmigo, 5, "Bronce: 5% para el que entra con su código");
  assert.equal(d.reglas.houseEdgePct, 8);
  assert.deepEqual(d.reglas.modelosAbiertos, ["revshare", "hibrido", "houseedge"]);
  assert.equal(d.campanas.length, 0, "todavía no creó ninguna");
  assert.deepEqual(d.embudo, { nuevo: 0, deposito: 0, califica: 0, pagado: 0, anulado: 0 });
});

test("la escalera se puede mirar sin cuenta", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const r = await pedir("GET", "/affiliates/ranks");

  assert.equal(r.estado, 200);
  assert.equal(r.datos.data.escalera.length, 8);
  assert.equal(r.datos.data.mio, null);

  /* Y los extremos son los que dijo el dueño. */
  const E = r.datos.data.escalera;
  assert.equal(E[0].cpaSc, 15);
  assert.equal(E[0].revsharePct, 35);
  assert.equal(E[0].hibridoCpaSc, 10);
  assert.equal(E[0].hibridoPct, 30);
  assert.equal(E[0].houseEdgePct, 50);
  assert.equal(E[7].revsharePct, 50);
  assert.equal(E[7].houseEdgePct, 65);
});

test("crea una campaña y elige modelo; el cpa no se elige solo", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const yo = await cuenta();

  const malo = await pedir("POST", "/affiliates/campaigns", {
    token: yo.token,
    cuerpo: { nombre: "mía", code: "CPAYO" + n, modelo: "cpa" },
  });
  assert.equal(malo.datos.code, "MODEL_NOT_OPEN");

  const bueno = await pedir("POST", "/affiliates/campaigns", {
    token: yo.token,
    cuerpo: { nombre: "YouTube · reviews", code: "yt" + n, canal: "YouTube", modelo: "houseedge" },
  });
  assert.equal(bueno.estado, 200);

  const c = bueno.datos.data.campana;
  assert.equal(c.modelo, "houseedge");
  assert.equal(c.cobra.pct, 50, "el 50% del house edge de Bronce");
  assert.equal(c.cobra.sobre, "houseedge");
  assert.equal(c.nombre, "YouTube · reviews");

  /* Y aparece en su pantalla. */
  const pantalla = await pedir("GET", "/affiliates", { token: yo.token });
  assert.equal(pantalla.datos.data.campanas.length, 1);
});

test("cambiarle el texto al código no desata a los que ya trajo", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const yo = await cuenta();

  const { datos } = await pedir("POST", "/affiliates/campaigns", {
    token: yo.token,
    cuerpo: { code: "VIEJO" + n, modelo: "revshare" },
  });
  const campana = datos.data.campana;

  /* Alguien entra con el código viejo. */
  n += 1;
  const { datos: reg } = await pedir("POST", "/auth/register", {
    cuerpo: {
      username: "tra" + n + "x",
      email: `tra${n}x@test.local`,
      password: "unaclavelarga",
      affiliateCode: campana.code,
    },
  });

  const nuevo = "NUEVO" + n;
  const r = await pedir("POST", `/affiliates/campaigns/${campana._id}/code`, {
    token: yo.token,
    cuerpo: { code: nuevo },
  });
  assert.equal(r.datos.data.code, nuevo);

  const traido = await User.findById(reg.user._id).lean();
  assert.equal(String(traido.referredBy), String(yo.id), "sigue atado al socio");
  assert.equal(traido.affiliateCode, nuevo, "y su código apunta al texto nuevo");
});

test("nadie pisa el código de otro", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const uno = await cuenta();
  const otro = await cuenta();

  const mio = await pedir("POST", "/affiliates/campaigns", {
    token: uno.token,
    cuerpo: { code: "UNICO" + n, modelo: "revshare" },
  });

  const suyo = await pedir("POST", "/affiliates/campaigns", {
    token: otro.token,
    cuerpo: { code: "OTRO" + n, modelo: "revshare" },
  });

  const r = await pedir("POST", `/affiliates/campaigns/${suyo.datos.data.campana._id}/code`, {
    token: otro.token,
    cuerpo: { code: mio.datos.data.campana.code },
  });
  assert.equal(r.datos.code, "CODE_TAKEN");
});

test("una campaña de otro no se toca", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const dueno = await cuenta();
  const ajeno = await cuenta();

  const { datos } = await pedir("POST", "/affiliates/campaigns", {
    token: dueno.token,
    cuerpo: { code: "MIA" + n, modelo: "revshare" },
  });

  const r = await pedir("PATCH", `/affiliates/campaigns/${datos.data.campana._id}`, {
    token: ajeno.token,
    cuerpo: { nombre: "ahora es mía" },
  });
  assert.equal(r.datos.code, "CODE_NOT_FOUND");
});

test("pedir rango queda anotado, y no se puede pedir tres veces por día", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const yo = await cuenta();

  const r = await pedir("POST", "/affiliates/rank/request", { token: yo.token });
  assert.equal(r.estado, 200);
  assert.match(r.datos.data.telegram, /^https:\/\/t\.me\//);

  const u = await User.findById(yo.id).lean();
  assert.ok(u.pidioRangoEl, "quedó la fecha del pedido");
  assert.equal(u.rangoAfiliado, 1, "PEDIR NO ES SUBIR");

  const otra = await pedir("POST", "/affiliates/rank/request", { token: yo.token });
  assert.equal(otra.datos.code, "RANK_ALREADY_ASKED");
});

test("el socio cobra una sola vez, y respeta el mínimo de su rango", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const yo = await cuenta();

  const { datos } = await pedir("POST", "/affiliates/campaigns", {
    token: yo.token,
    cuerpo: { code: "COBRA" + n, modelo: "revshare" },
  });
  const id = datos.data.campana._id;

  await AffiliateCode.updateOne({ _id: id }, { $set: { ganadoSc: 40 } });
  const corto = await pedir("POST", `/affiliates/campaigns/${id}/claim`, { token: yo.token });
  assert.equal(corto.datos.code, "BELOW_MINIMUM", "Bronce pide SC 50");

  await AffiliateCode.updateOne({ _id: id }, { $set: { ganadoSc: 120 } });

  const intentos = await Promise.all(
    Array.from({ length: 8 }, () =>
      pedir("POST", `/affiliates/campaigns/${id}/claim`, { token: yo.token })
    )
  );
  assert.equal(intentos.filter((x) => x.datos.success).length, 1, "cobró más de una vez");

  const saldo = await wallet.saldoDe(yo.id);
  assert.equal(saldo.balanceSc, 120);
});

/* ══ Lo que ve y hace el equipo ═══════════════════════════════════ */

test("un jugador con sesión no entra a los socios del panel", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const jug = await cuenta();

  const r = await pedir("GET", "/admin/affiliates", { token: jug.token });
  assert.equal(r.estado, 403);
});

test("la lista de socios pone el margen al lado de lo que se le pagó", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const jefe = await cuenta("admin");
  const socio = await cuenta();

  const { datos } = await pedir("POST", "/affiliates/campaigns", {
    token: socio.token,
    cuerpo: { code: "LISTA" + n, modelo: "revshare" },
  });
  const id = datos.data.campana._id;

  /* Sus jugadores jugaron SC 10.000: el margen teórico son SC 800. */
  await AffiliateCode.updateOne(
    { _id: id },
    { $set: { jugadoPorLosSuyosSc: 10000, jugadores: 7, ganadoSc: 280, cobradoSc: 280 } }
  );
  /* Y eso es lo que de verdad se le fue, según el libro. */
  await wallet.mover({ userId: socio.id, amountSc: 280, type: "affiliate" });

  const r = await pedir("GET", "/admin/affiliates", { token: jefe.token });
  assert.equal(r.estado, 200);

  const fila = r.datos.data.items.find((x) => String(x._id) === String(socio.id));
  assert.ok(fila, "el socio tiene que estar en la lista");
  assert.equal(fila.jugadoSc, 10000);
  assert.equal(fila.margenSc, 800, "8% de lo jugado");
  assert.equal(fila.pagadoSc, 280, "sale del libro, no del contador");
  assert.equal(fila.netoSc, 520, "lo que nos queda");
  assert.equal(fila.tajadaPct, 35, "se lleva 35 centavos de cada peso de margen");
  assert.equal(fila.rango.numero, 1);
});

test("otorgar un rango pide motivo, y queda en el registro", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const jefe = await cuenta("admin");
  const socio = await cuenta();

  const sinMotivo = await pedir("POST", `/admin/affiliates/${socio.id}/rank`, {
    token: jefe.token,
    cuerpo: { numero: 5 },
  });
  assert.equal(sinMotivo.datos.code, "REASON_REQUIRED");

  const r = await pedir("POST", `/admin/affiliates/${socio.id}/rank`, {
    token: jefe.token,
    cuerpo: { numero: 5, motivo: "trae 300 jugadores por mes de su canal" },
  });
  assert.equal(r.estado, 200);
  assert.equal(r.datos.data.rango.numero, 5);
  assert.equal(r.datos.data.rango.nombre, "Esmeralda");

  const u = await User.findById(socio.id).lean();
  assert.equal(u.rangoAfiliado, 5);
  assert.equal(u.pidioRangoEl, null, "el pedido queda contestado");

  const log = await AdminLog.findOne({ evento: "affiliate.rank.grant", "sobre.id": socio.id }).lean();
  assert.ok(log, "sin registro no hay auditoría");
  assert.equal(log.antes.numero, 1);
  assert.equal(log.despues.numero, 5);
  assert.match(log.motivo, /300 jugadores/);

  /* Y el socio ve el rango nuevo en su pantalla, con el bono nuevo. */
  const mio = await pedir("GET", "/affiliates", { token: socio.token });
  assert.equal(mio.datos.data.rango.numero, 5);
  assert.equal(mio.datos.data.bonoParaElAmigo, 8, "Esmeralda da 8% a sus jugadores");
});

test("la cola de pedidos de rango trae los números para decidir", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const jefe = await cuenta("admin");
  const socio = await cuenta();

  await pedir("POST", "/affiliates/campaigns", {
    token: socio.token,
    cuerpo: { code: "PIDE" + n, modelo: "hibrido" },
  });
  await pedir("POST", "/affiliates/rank/request", { token: socio.token });

  const r = await pedir("GET", "/admin/affiliates/requests", { token: jefe.token });
  assert.equal(r.estado, 200);

  const fila = r.datos.data.items.find((x) => String(x._id) === String(socio.id));
  assert.ok(fila, "el pedido tiene que estar en la cola");
  assert.equal(fila.rango.numero, 1);
  assert.equal(fila.siguiente.numero, 2, "el que le toca si se le concede");
  assert.equal(fila.campanas, 1);
});

test("la cola de cabezas se puede pagar o frenar desde el panel", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const jefe = await cuenta("admin");
  const socio = await cuenta();

  const { datos } = await pedir("POST", "/affiliates/campaigns", {
    token: socio.token,
    cuerpo: { code: "CABEZA" + n, modelo: "hibrido" },
  });
  const campana = datos.data.campana;

  /* Una cabeza que calificó, con una señal: no se paga sola. */
  n += 1;
  const { datos: reg } = await pedir("POST", "/auth/register", {
    cuerpo: {
      username: "cab" + n + "x",
      email: `cab${n}x@test.local`,
      password: "unaclavelarga",
      affiliateCode: campana.code,
    },
  });

  await AffiliateConversion.updateOne(
    { code: campana._id, user: reg.user._id },
    {
      $set: {
        estado: "califica",
        montoSc: 10,
        calificoEl: new Date(),
        liberaEl: new Date(Date.now() - 1000),
        senales: ["pidio_retiro_temprano"],
      },
    }
  );

  const cola = await pedir("GET", "/admin/affiliates/conversions?estado=califica&senales=1", {
    token: jefe.token,
  });
  assert.equal(cola.estado, 200);
  const ficha = cola.datos.data.items.find((x) => String(x.campana._id) === String(campana._id));
  assert.ok(ficha, "la cabeza con señales tiene que aparecer en la cola");
  assert.equal(ficha.liberada, true);
  assert.deepEqual(ficha.senales, ["pidio_retiro_temprano"]);

  /* Pagarla pide motivo. */
  const sinMotivo = await pedir("POST", `/admin/affiliates/conversions/${ficha._id}/pay`, {
    token: jefe.token,
  });
  assert.equal(sinMotivo.datos.code, "REASON_REQUIRED");

  const pagada = await pedir("POST", `/admin/affiliates/conversions/${ficha._id}/pay`, {
    token: jefe.token,
    cuerpo: { motivo: "lo miré: el retiro es de otra cuenta" },
  });
  assert.equal(pagada.datos.data.estado, "pagado");
  assert.equal(pagada.datos.data.montoSc, 10);

  /* Y no se paga dos veces. */
  const otra = await pedir("POST", `/admin/affiliates/conversions/${ficha._id}/pay`, {
    token: jefe.token,
    cuerpo: { motivo: "a ver si entra dos veces" },
  });
  assert.equal(otra.datos.code, "ALREADY_CLAIMED");

  const c = await AffiliateCode.findById(campana._id).lean();
  assert.equal(c.ganadoSc, 10, "una cabeza, una vez");
});

test("la ficha de un socio cuenta sus campañas, su embudo y lo que cobró", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const jefe = await cuenta("admin");
  const socio = await cuenta();

  await pedir("POST", "/affiliates/campaigns", {
    token: socio.token,
    cuerpo: { code: "FICHA" + n, modelo: "houseedge" },
  });
  await wallet.mover({ userId: socio.id, amountSc: 75, type: "affiliate" });

  const r = await pedir("GET", `/admin/affiliates/${socio.id}`, { token: jefe.token });
  assert.equal(r.estado, 200);

  const d = r.datos.data;
  assert.equal(d.socio.username, socio.username);
  assert.equal(d.campanas.length, 1);
  assert.equal(d.campanas[0].modelo, "houseedge");
  assert.equal(d.campanas[0].cobra.pct, 50);
  assert.equal(d.numeros.pagadoSc, 75, "del libro");
  assert.equal(d.rango.numero, 1);
});

/* ══ La escalera, editable ════════════════════════════════════════ */

test("editar la escalera: se limpia, se le pone tope y no puede ir al revés", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const jefe = await cuenta("admin");
  const original = afiliados.rangos();

  /* Al revés: el segundo paga menos que el primero. */
  const alReves = original.map((r, i) => (i === 1 ? { ...r, revsharePct: 10 } : r));
  const mal = await pedir("PUT", "/admin/affiliates/ladder", {
    token: jefe.token,
    cuerpo: { escalera: alReves, reglas: {}, motivo: "a ver si pasa" },
  });
  assert.equal(mal.datos.code, "INVALID_AMOUNT");

  /* Un revshare del 200% se recorta al tope, no se guarda. */
  const exagerada = original.map((r, i) => (i === 7 ? { ...r, revsharePct: 200 } : r));
  const r = await pedir("PUT", "/admin/affiliates/ladder", {
    token: jefe.token,
    cuerpo: {
      escalera: exagerada,
      reglas: {
        cpaDepositoSc: 25,
        cpaJugadoSc: 250,
        cpaNivelKyc: 2,
        cpaEsperaDias: 10,
        cpaTopeDiario: 30,
        telegram: "https://t.me/mrbox_socios",
        modelos: ["revshare", "hibrido", "houseedge", "inventado"],
      },
      motivo: "subimos el último rango",
    },
  });

  assert.equal(r.estado, 200);
  assert.equal(r.datos.data.escalera[7].revsharePct, 70, "tope del 70%");
  assert.equal(r.datos.data.reglas.cpaEsperaDias, 10);
  assert.deepEqual(
    r.datos.data.reglas.modelos,
    ["revshare", "hibrido", "houseedge"],
    "un modelo inventado no entra"
  );
  assert.equal(r.datos.data.reglas.houseEdgePct, 8, "el house edge del sitio no se edita acá");

  /* El servicio ya lo ve, sin esperar el minuto. */
  assert.equal(afiliados.rangoNumero(8).revsharePct, 70);
  const log = await AdminLog.findOne({ evento: "affiliate.ladder.edit" }).lean();
  assert.ok(log);

  /* Y se deja como estaba. */
  await pedir("PUT", "/admin/affiliates/ladder", {
    token: jefe.token,
    cuerpo: { escalera: original, reglas: {}, motivo: "volver a la de siempre" },
  });
  assert.equal(afiliados.rangoNumero(8).revsharePct, 50);
});
