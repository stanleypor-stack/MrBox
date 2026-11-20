/* Utilidades compartidas de los PoC de la auditoria de MR BOX.
   Solo lectura sobre el repo; escribe unicamente en mrbox_local. */
const path = require("path");
const BE = "C:/Users/Usuario/mrbox/backend";
const mongoose = require(path.join(BE, "node_modules/mongoose"));
const jwt = require(path.join(BE, "node_modules/jsonwebtoken"));

const URI = "mongodb://127.0.0.1:27017/mrbox_local";
require(path.join(BE, "node_modules/dotenv")).config({ path: path.join(BE, ".env"), quiet: true });
const SECRETO = process.env.JWT_SECRET;
const BASE = "http://127.0.0.1:5001/api";

const User = require(path.join(BE, "database/models/User"));
const InventoryItem = require(path.join(BE, "database/models/InventoryItem"));
const BalanceTransaction = require(path.join(BE, "database/models/BalanceTransaction"));
const Redemption = require(path.join(BE, "database/models/Redemption"));
const Item = require(path.join(BE, "database/models/Item"));
const Box = require(path.join(BE, "database/models/Box"));
const Settings = require(path.join(BE, "database/models/Settings"));
const Address = require(path.join(BE, "database/models/Address"));
const Order = require(path.join(BE, "database/models/Order"));
const UserSeed = require(path.join(BE, "database/models/UserSeed"));
const PromoCode = require(path.join(BE, "database/models/PromoCode"));
const { sc } = require(path.join(BE, "utils/money"));

async function conectar() {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
}

let n = 0;
async function jugador({ saldo = 0, nivel = 3, extra = {} } = {}) {
  n += 1;
  const marca = `audit_${Date.now()}_${n}`;
  const u = await User.create({
    username: marca,
    email: `${marca}@audit.local`,
    passwordHash: "x",
    balanceSc: saldo,
    verificationLevel: nivel,
    ...extra,
  });
  const fair = require(path.join(BE, "services/boxes/fair"));
  const s = fair.semillaNueva();
  await UserSeed.create({
    user: u._id, semillaServidor: s, semillaServidorHash: fair.hashDeSemilla(s),
    semillaCliente: fair.semillaNueva().slice(0, 16), nonce: 0, activa: true,
  });
  return { id: String(u._id), token: jwt.sign({ id: String(u._id) }, SECRETO, { expiresIn: "1d" }) };
}

async function saldoDe(id) {
  const u = await User.findById(id).select("+balanceSc +bonoPendienteSc").lean();
  return { balanceSc: sc(u.balanceSc), bonoPendienteSc: sc(u.bonoPendienteSc || 0), jugadoSc: sc(u.jugadoSc) };
}

async function pedir(ruta, { token, metodo = "POST", cuerpo } = {}) {
  const r = await fetch(BASE + ruta, {
    method: metodo,
    headers: {
      "content-type": "application/json",
      ...(token ? { "x-auth-token": token } : {}),
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  let datos = null;
  try { datos = await r.json(); } catch { datos = null; }
  return { status: r.status, datos };
}

/** N pedidos simultaneos de verdad: se arman todos y se esperan juntos. */
async function enParalelo(cuantos, fn) {
  return Promise.all(Array.from({ length: cuantos }, (_, i) => fn(i).catch((e) => ({ error: e.message }))));
}

module.exports = {
  mongoose, conectar, jugador, saldoDe, pedir, enParalelo, sc, BASE, SECRETO,
  User, InventoryItem, BalanceTransaction, Redemption, Item, Box, Settings, Address, Order, UserSeed, PromoCode,
};
