/*
  SACA DE LA BASE LOCAL LO QUE DEJO LA AUDITORIA.

  Las cuentas de prueba (`audit_*`, `poc_*`, `dbg_*`, `bono_*`,
  `probador*`, `bienve*`, `jug*x`), todo lo que colgaba de ellas
  --saldo, inventario, aperturas, canjes, ordenes, deals-- y los
  movimientos absurdos que entraron por el aviso de pago mientras se
  probaba el techo, que son los que rompen las estadisticas del panel.

  SOLO CORRE CONTRA LA BASE LOCAL. Si `DATABASE_URI` no apunta a
  `mrbox_local` en 127.0.0.1, se niega.

  Uso:
    node scripts/limpiarAuditoria.js          <- muestra, no borra
    node scripts/limpiarAuditoria.js --borrar <- borra
*/
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const { conectar, desconectar } = require("../database");

const User = require("../database/models/User");
const BalanceTransaction = require("../database/models/BalanceTransaction");
const InventoryItem = require("../database/models/InventoryItem");
const BoxOpen = require("../database/models/BoxOpen");
const Redemption = require("../database/models/Redemption");
const Order = require("../database/models/Order");
const Deal = require("../database/models/Deal");
const Box = require("../database/models/Box");
const PromoCode = require("../database/models/PromoCode");
const SupportThread = require("../database/models/SupportThread");
const AffiliateCode = require("../database/models/AffiliateCode");
const AffiliateConversion = require("../database/models/AffiliateConversion");
const Verification = require("../database/models/Verification");
const UserSeed = require("../database/models/UserSeed");
const Address = require("../database/models/Address");
const DepositoAvisado = require("../database/models/DepositoAvisado");
const RakebackClaim = require("../database/models/RakebackClaim");
const SessionEvent = require("../database/models/SessionEvent");

const BORRAR = process.argv.includes("--borrar");

/* Los nombres que dejo la auditoria. Pegados al principio a proposito:
   un `audit` suelto en el medio de un nombre real no tiene que entrar. */
const NOMBRES = /^(audit[_-]|poc[_-]|dbg[_-]|bono[_-]|probador|bienve|jug\d+x$)/i;

/* Un deposito de verdad no llega a esto ni de casualidad. */
const ABSURDO = 1000000;

function esLocal(uri) {
  return /127\.0\.0\.1|localhost/.test(String(uri)) && /mrbox_local/.test(String(uri));
}

(async () => {
  if (!esLocal(process.env.DATABASE_URI)) {
    console.error("Esto solo corre contra mrbox_local en 127.0.0.1. Abortado.");
    process.exit(1);
  }

  await conectar();

  const cuentas = await User.find({ username: NOMBRES }).select("username").lean();
  const ids = cuentas.map((u) => u._id);

  const absurdos = await BalanceTransaction.find({
    $or: [{ amountSc: { $gt: ABSURDO } }, { amountSc: { $lt: -ABSURDO } }],
  }).select("user amountSc type").lean();

  const cajasDePrueba = await Box.find({ slug: NOMBRES }).select("slug").lean();
  const codigos = await PromoCode.find({ codigo: /^(AUDIT|PAUSA|POC)/i }).select("codigo").lean();

  const cuenta = async (modelo, filtro) => modelo.countDocuments(filtro);

  const resumen = {
    "cuentas de prueba": cuentas.length,
    "  · movimientos suyos": await cuenta(BalanceTransaction, { user: { $in: ids } }),
    "  · objetos de inventario": await cuenta(InventoryItem, { user: { $in: ids } }),
    "  · aperturas": await cuenta(BoxOpen, { user: { $in: ids } }),
    "  · deals": await cuenta(Deal, { user: { $in: ids } }),
    "  · canjes": await cuenta(Redemption, { user: { $in: ids } }),
    "  · ordenes de envio": await cuenta(Order, { user: { $in: ids } }),
    "  · verificaciones": await cuenta(Verification, { user: { $in: ids } }),
    "  · semillas": await cuenta(UserSeed, { user: { $in: ids } }),
    "  · direcciones": await cuenta(Address, { user: { $in: ids } }),
    "  · hilos de soporte": await cuenta(SupportThread, { user: { $in: ids } }),
    "  · campanias de afiliado": await cuenta(AffiliateCode, { owner: { $in: ids } }),
    "movimientos absurdos (mas de SC 1.000.000)": absurdos.length,
    "cajas de prueba": cajasDePrueba.length,
    "codigos de prueba": codigos.length,
    "avisos de deposito de prueba": await cuenta(DepositoAvisado, {
      $or: [{ user: { $in: ids } }, { trackId: /^(T-|poc|AUDIT)/i }],
    }),
  };

  console.log(BORRAR ? "BORRANDO:\n" : "LO QUE HAY (no se borro nada):\n");
  for (const [k, v] of Object.entries(resumen)) {
    if (v) console.log(`  ${k.padEnd(44)} ${v}`);
  }

  if (absurdos.length) {
    console.log("\n  Los movimientos absurdos:");
    for (const t of absurdos) console.log(`    ${t.type} SC ${t.amountSc}`);
  }

  if (!BORRAR) {
    console.log("\nPara borrarlo: node scripts/limpiarAuditoria.js --borrar");
    await desconectar();
    return;
  }

  const deUsuarios = { user: { $in: ids } };

  await BalanceTransaction.deleteMany({
    $or: [deUsuarios, { amountSc: { $gt: ABSURDO } }, { amountSc: { $lt: -ABSURDO } }],
  });
  await InventoryItem.deleteMany(deUsuarios);
  await BoxOpen.deleteMany(deUsuarios);
  await Deal.deleteMany(deUsuarios);
  await Redemption.deleteMany(deUsuarios);
  await Order.deleteMany(deUsuarios);
  await Verification.deleteMany(deUsuarios);
  await UserSeed.deleteMany(deUsuarios);
  await Address.deleteMany(deUsuarios);
  await SupportThread.deleteMany(deUsuarios);
  await RakebackClaim.deleteMany(deUsuarios);
  await SessionEvent.deleteMany(deUsuarios);
  await AffiliateConversion.deleteMany({ $or: [deUsuarios, { owner: { $in: ids } }] });
  await AffiliateCode.deleteMany({ owner: { $in: ids } });
  await DepositoAvisado.deleteMany({
    $or: [deUsuarios, { trackId: /^(T-|poc|AUDIT)/i }],
  });
  await PromoCode.deleteMany({ codigo: /^(AUDIT|PAUSA|POC)/i });
  await Box.deleteMany({ slug: NOMBRES });
  await User.deleteMany({ _id: { $in: ids } });

  console.log("\nListo. Quedan:");
  console.log(`  jugadores        ${await User.countDocuments()}`);
  console.log(`  movimientos      ${await BalanceTransaction.countDocuments()}`);
  console.log(`  cajas            ${await Box.countDocuments()}`);
  console.log(`  aperturas        ${await BoxOpen.countDocuments()}`);

  await desconectar();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
