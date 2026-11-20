/**
 * ENTRAR CON GOOGLE, DE PUNTA A PUNTA.
 *
 * Lo único que no se prueba acá es la firma del token de Google: para
 * eso haría falta que Google firme uno, y eso no se puede pedir desde
 * una prueba. Lo que SI se prueba es todo lo demás, que es donde están
 * las decisiones:
 *
 *   - una cuenta nueva nace con sus semillas y sus tres cajas
 *   - la segunda vez entra, no se crea una segunda cuenta
 *   - si ya había cuenta con ese mail, se le ATA la de Google en vez
 *     de partir a la persona en dos
 *   - un mail sin verificar no abre cuenta: cualquiera puede crear una
 *     cuenta de Google con el mail de otro
 *   - un token que no pasa la comprobación no entra
 *
 * La comprobación se reemplaza por una de mentira --el mismo `require`
 * que usa la ruta-- para poder decidir qué contesta Google en cada
 * caso. Es la única manera de probar el "mail sin verificar" sin tener
 * una cuenta de Google sin verificar.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DATABASE_URI = process.env.TEST_DB_URI || "mongodb://127.0.0.1:27017/mrbox_test_google";
process.env.JWT_SECRET = "prueba-local";
process.env.TURNSTILE_SECRET_KEY = "";
process.env.AUTH_RATE_LIMIT = "500";
process.env.GOOGLE_CLIENT_ID = "prueba.apps.googleusercontent.com";
process.env.LOG_LEVEL = "error";

const mongoose = require("mongoose");

/*
  Se reemplaza ANTES de cargar la aplicación: la ruta guarda el módulo
  cuando se la carga, así que después ya sería tarde.
*/
const google = require("../services/google");

let loQueContestaGoogle = null;

google.configurado = () => true;
google.quienEs = async () => {
  if (!loQueContestaGoogle) throw new Error("token invalido");
  return loQueContestaGoogle;
};

const { app } = require("../index");
const { conectar, asegurarIndices } = require("../database");

const User = require("../database/models/User");
const UserSeed = require("../database/models/UserSeed");
const Item = require("../database/models/Item");
const Box = require("../database/models/Box");

let servidor;
let base = "";
let hayBase = true;

test.before(async () => {
  try {
    await conectar();
    await mongoose.connection.db.dropDatabase();
    await asegurarIndices();
    servidor = app.listen(0);
    await new Promise((r) => servidor.once("listening", r));
    base = `http://127.0.0.1:${servidor.address().port}/api`;

    /*
      LAS TRES CAJAS DEL REGALO TIENEN QUE EXISTIR.

      El regalo de bienvenida son tres CAJAS, no tres fichas: en una
      base sin catálogo no hay regalo que dar, y la cuenta nueva
      quedaría con cero sin que eso sea un error.
    */
    const algo = await Item.create({ sku: "G-1", name: "Algo", valueSc: 2.76, rarity: "blue" });

    for (const slug of ["mac", "pokemon-boosters", "splash"]) {
      await Box.create({
        slug,
        name: slug,
        category: "Mix",
        live: true,
        priceSc: 3,
        prizes: [{ item: algo._id, name: algo.name, valueSc: algo.valueSc, chance: 1, rarity: "blue" }],
      });
    }
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

async function entrar(cuerpo = { credential: "lo-que-sea" }) {
  const r = await fetch(`${base}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  return { estado: r.status, datos: await r.json() };
}

test("una cuenta nueva nace con sus semillas y sus tres cajas", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  loQueContestaGoogle = {
    sub: "google-111",
    email: "nuevo@prueba.local",
    emailVerificado: true,
    nombre: "Dani Pérez",
    foto: "https://ejemplo/foto.jpg",
  };

  const r = await entrar();
  assert.equal(r.estado, 201, "una cuenta nueva contesta 201");
  assert.equal(r.datos.nueva, true);
  assert.ok(r.datos.token, "vuelve con sesión abierta");

  const u = await User.findOne({ googleId: "google-111" }).lean();
  assert.ok(u, "quedó la cuenta");
  assert.equal(u.email, "nuevo@prueba.local");
  assert.equal(u.freeOpens, 3, "y sus tres cajas de regalo");

  /* El nombre de Google se limpia a lo que admite el sitio: sin
     espacio y sin tilde. */
  assert.match(u.username, /^[a-zA-Z0-9_]+$/, `el nombre queda usable (dio "${u.username}")`);

  const semilla = await UserSeed.findOne({ user: u._id }).lean();
  assert.ok(semilla && semilla.semillaServidorHash, "y su semilla, para poder verificar el sorteo");
});

test("la segunda vez entra, no se crea otra cuenta", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  loQueContestaGoogle = {
    sub: "google-111",
    email: "nuevo@prueba.local",
    emailVerificado: true,
    nombre: "Dani Pérez",
    foto: "",
  };

  const r = await entrar();
  assert.equal(r.estado, 200, "entra, no se registra");
  assert.equal(r.datos.nueva, false);

  const cuantas = await User.countDocuments({ googleId: "google-111" });
  assert.equal(cuantas, 1, `una sola cuenta (dio ${cuantas})`);
});

test("si ya tenía cuenta con ese mail, se le ata la de Google", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  /* Una cuenta de las de siempre: con contraseña y sin Google. */
  const vieja = await User.create({
    username: "deantes",
    email: "deantes@prueba.local",
    passwordHash: "$2a$12$" + "x".repeat(53),
  });

  loQueContestaGoogle = {
    sub: "google-222",
    email: "deantes@prueba.local",
    emailVerificado: true,
    nombre: "De Antes",
    foto: "",
  };

  const r = await entrar();
  assert.equal(r.estado, 200, "entra a la cuenta que ya tenía");
  assert.equal(String(r.datos.user._id), String(vieja._id), "y es LA MISMA cuenta");

  const u = await User.findById(vieja._id).lean();
  assert.equal(u.googleId, "google-222", "le quedó atada la de Google");

  const cuantas = await User.countDocuments({ email: "deantes@prueba.local" });
  assert.equal(cuantas, 1, `no se partió en dos (dio ${cuantas})`);
});

test("un mail sin verificar no abre cuenta", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  loQueContestaGoogle = {
    sub: "google-333",
    email: "sinverificar@prueba.local",
    emailVerificado: false,
    nombre: "Sin Verificar",
    foto: "",
  };

  const r = await entrar();
  assert.ok(r.estado >= 400, `rebota (HTTP ${r.estado})`);
  assert.equal(r.datos.code, "GOOGLE_NO_EMAIL");

  const u = await User.findOne({ googleId: "google-333" }).lean();
  assert.equal(u, null, "y no quedó ninguna cuenta");
});

test("un mail sin verificar tampoco se ata a una cuenta que ya existe", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  /*
    Esta es la que importa de verdad: cualquiera puede abrir una
    cuenta de Google escribiendo el mail de otro. Si el mail sin
    verificar sirviera para encontrar una cuenta nuestra, se entra a
    la cuenta ajena sin saber la contraseña.
  */
  await User.create({
    username: "lavictima",
    email: "lavictima@prueba.local",
    passwordHash: "$2a$12$" + "y".repeat(53),
  });

  loQueContestaGoogle = {
    sub: "google-444",
    email: "lavictima@prueba.local",
    emailVerificado: false,
    nombre: "El Que Se Hace Pasar",
    foto: "",
  };

  const r = await entrar();
  assert.ok(r.estado >= 400, `rebota (HTTP ${r.estado})`);

  const u = await User.findOne({ email: "lavictima@prueba.local" }).lean();
  assert.equal(u.googleId, null, "y la cuenta de la víctima sigue sin Google atado");
});

test("un token que no pasa la comprobación no entra", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  loQueContestaGoogle = null; // la comprobación tira

  const r = await entrar({ credential: "token-falso" });
  assert.ok(r.estado >= 400, `rebota (HTTP ${r.estado})`);
  assert.equal(r.datos.code, "GOOGLE_FAILED");
  assert.ok(
    !/kid|firma|jwt/i.test(JSON.stringify(r.datos)),
    "y no le cuenta al de afuera por qué falló"
  );
});

test("el que entró con Google puede ponerse una contraseña", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");

  loQueContestaGoogle = {
    sub: "google-555",
    email: "sinclave@prueba.local",
    emailVerificado: true,
    nombre: "Sin Clave",
    foto: "",
  };

  const entrada = await entrar();
  assert.equal(entrada.estado, 201);

  /*
    No tiene contraseña, así que no hay "contraseña actual" que
    pedirle. Pedírsela lo dejaría sin poder ponerse ninguna.
  */
  const r = await fetch(`${base}/auth/password`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-auth-token": entrada.datos.token },
    body: JSON.stringify({ actual: "", nueva: "unaclavelarga" }),
  });

  assert.equal(r.status, 200, `la pone (HTTP ${r.status})`);

  const u = await User.findOne({ googleId: "google-555" }).select("+passwordHash").lean();
  assert.ok(u.passwordHash, "y le quedó guardada");
});
