/**
 * SOPORTE, DE PUNTA A PUNTA.
 *
 * El globito del sitio y la bandeja del panel contra el servidor de
 * verdad. Lo que se prueba acá es lo que se rompe solo:
 *
 *  - que el ESTADO lo mueva quien escribe, porque de eso vive la bandeja;
 *  - que la respuesta automática salga UNA vez y no en cada mensaje;
 *  - que nadie lea la conversación de otro.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DATABASE_URI = process.env.TEST_DB_URI || "mongodb://127.0.0.1:27017/mrbox_test_soporte";
process.env.JWT_SECRET = "prueba-local";
process.env.TURNSTILE_SECRET_KEY = "";
process.env.AUTH_RATE_LIMIT = "500";
process.env.LOG_LEVEL = "error";

const mongoose = require("mongoose");
const { app } = require("../index");
const { conectar, asegurarIndices } = require("../database");

const User = require("../database/models/User");
const SupportThread = require("../database/models/SupportThread");

let servidor;
let base = "";
let hayBase = true;

test.before(async () => {
  try {
    await conectar();
    await mongoose.connection.db.dropDatabase();
    /* El `dropDatabase` se lleva puestos los indices, y los unicos
       son los que hacen cumplir media docena de reglas de esta
       suite. Hay que volver a crearlos a mano. */
    await asegurarIndices();
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

async function pedir(metodo, ruta, opciones) {
  const o = opciones || {};
  const r = await fetch(base + ruta, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...(o.token ? { "x-auth-token": o.token } : {}) },
    body: o.cuerpo ? JSON.stringify(o.cuerpo) : undefined,
  });
  return { estado: r.status, datos: await r.json() };
}

let n = 0;
async function jugador() {
  n += 1;
  const cuenta = { username: `sop${n}`, email: `sop${n}@test.local`, password: "unaclavelarga" };
  const { datos } = await pedir("POST", "/auth/register", { cuerpo: cuenta });
  return { id: datos.user._id, token: datos.token };
}

async function equipo() {
  n += 1;
  const cuenta = { username: `adm${n}`, email: `adm${n}@test.local`, password: "unaclavelarga" };
  const { datos } = await pedir("POST", "/auth/register", { cuerpo: cuenta });
  await User.updateOne({ _id: datos.user._id }, { $set: { rank: "admin" } });
  return { id: datos.user._id, token: datos.token };
}

/* ── Escribir ─────────────────────────────────────────────────────── */

test("el primer mensaje abre la conversación y trae la respuesta automática", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador();

  const { estado, datos } = await pedir("POST", "/support/threads", {
    token: j.token,
    cuerpo: { texto: "No me llegó el pedido" },
  });

  assert.equal(estado, 200, JSON.stringify(datos));
  const h = datos.data;
  assert.equal(h.estado, "waiting_us", "tiene que quedar esperándonos");
  assert.equal(h.mensajes.length, 2);
  assert.equal(h.mensajes[0].deAdmin, false);
  assert.equal(h.mensajes[1].codigo, "SUPPORT_AUTO_REPLY", "la automática viaja como código");
  assert.equal(h.asunto, "No me llegó el pedido");
});

test("el segundo mensaje va a la misma conversación y NO repite la automática", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador();

  await pedir("POST", "/support/threads", { token: j.token, cuerpo: { texto: "Hola" } });
  const { datos } = await pedir("POST", "/support/threads", { token: j.token, cuerpo: { texto: "Sigo esperando" } });

  const h = datos.data;
  assert.equal(h.mensajes.length, 3, "dos del jugador y una automática");
  assert.equal(h.mensajes.filter((m) => m.codigo === "SUPPORT_AUTO_REPLY").length, 1);

  const cuantas = await SupportThread.countDocuments({ user: j.id });
  assert.equal(cuantas, 1, "no se abre una conversación por mensaje");
});

test("un mensaje vacío no abre nada", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador();

  const { estado, datos } = await pedir("POST", "/support/threads", { token: j.token, cuerpo: { texto: "   " } });
  assert.equal(estado, 400);
  assert.equal(datos.code, "MESSAGE_REQUIRED");
});

test("sin sesión no se puede escribir", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const { estado } = await pedir("POST", "/support/threads", { cuerpo: { texto: "hola" } });
  assert.equal(estado, 401);
});

/* ── Contestar ────────────────────────────────────────────────────── */

test("contestar mueve el estado, asigna la conversación y enciende el puntito", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador();
  const a = await equipo();

  const { datos: abierta } = await pedir("POST", "/support/threads", {
    token: j.token,
    cuerpo: { texto: "¿Por qué pide verificación?" },
  });
  const hiloId = abierta.data._id;

  const { estado, datos } = await pedir("POST", `/admin/support/${hiloId}/reply`, {
    token: a.token,
    cuerpo: { texto: "Porque protege tu cuenta antes de un canje." },
  });

  assert.equal(estado, 200, JSON.stringify(datos));
  assert.equal(datos.data.estado, "waiting_player");

  const enLaBase = await SupportThread.findById(hiloId).lean();
  assert.equal(String(enLaBase.asignado), String(a.id), "contestar es hacerse cargo");

  /* Y del lado del jugador, hay algo sin leer. */
  const { datos: mios } = await pedir("GET", "/support/threads", { token: j.token });
  assert.equal(mios.data.sinLeer, 1);

  /* Abrirla lo apaga. */
  await pedir("GET", `/support/threads/${hiloId}`, { token: j.token });
  const { datos: despues } = await pedir("GET", "/support/threads", { token: j.token });
  assert.equal(despues.data.sinLeer, 0);
});

test("escribir en una conversación cerrada la vuelve a abrir", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador();
  const a = await equipo();

  const { datos: abierta } = await pedir("POST", "/support/threads", { token: j.token, cuerpo: { texto: "Una duda" } });
  const hiloId = abierta.data._id;

  await pedir("POST", `/admin/support/${hiloId}/reply`, {
    token: a.token,
    cuerpo: { texto: "Listo, resuelto.", cerrar: true },
  });

  const cerrada = await SupportThread.findById(hiloId).lean();
  assert.equal(cerrada.estado, "closed");

  /* Contestando DENTRO de esa conversación: vuelve a abrirse. */
  const { datos } = await pedir("POST", "/support/threads", {
    token: j.token,
    cuerpo: { texto: "Volvió a pasar", hilo: hiloId },
  });
  assert.equal(datos.data._id, hiloId, "sigue en la misma, no abre otra");
  assert.equal(datos.data.estado, "waiting_us");

  /* Y "Nueva" abre otra, aunque esta siga abierta. */
  const { datos: otra } = await pedir("POST", "/support/threads", {
    token: j.token,
    cuerpo: { texto: "Otro tema", nueva: true },
  });
  assert.notEqual(otra.data._id, hiloId, "Nueva tiene que abrir una nueva");
});

/* ── Lo de cada uno ───────────────────────────────────────────────── */

test("nadie entra a la conversación de otro", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const uno = await jugador();
  const otro = await jugador();

  const { datos } = await pedir("POST", "/support/threads", { token: uno.token, cuerpo: { texto: "Algo privado" } });
  const hiloId = datos.data._id;

  const { estado } = await pedir("GET", `/support/threads/${hiloId}`, { token: otro.token });
  assert.equal(estado, 400, "la de otro no existe para mí");
});

test("el panel pide rango: un jugador no entra a la bandeja", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador();
  const { estado } = await pedir("GET", "/admin/support", { token: j.token });
  assert.ok(estado === 403 || estado === 401, `tendría que rebotar, dio ${estado}`);
});

test("la bandeja cuenta lo que espera respuesta", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const a = await equipo();
  const j = await jugador();

  await pedir("POST", "/support/threads", { token: j.token, cuerpo: { texto: "Otra consulta más" } });

  const { datos } = await pedir("GET", "/admin/support?estado=waiting_us", { token: a.token });
  assert.ok(datos.data.esperando >= 1);
  assert.ok(datos.data.items.every((h) => h.estado === "waiting_us"));
  assert.ok(datos.data.items[0].username, "la bandeja dice quién escribió");
});
