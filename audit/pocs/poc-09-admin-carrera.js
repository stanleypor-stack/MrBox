/* PoC 9: POST /admin/races/:id/pay/:userId — el "ya cobro?" es un
   findOne seguido de un mover: leer-y-despues-escribir. */
const L = require("./lib");
const path = require("path");
const jwt = require("C:/Users/Usuario/mrbox/backend/node_modules/jsonwebtoken");
const Race = require("C:/Users/Usuario/mrbox/backend/database/models/Race");
const carreras = require("C:/Users/Usuario/mrbox/backend/services/races");

(async () => {
  await L.conectar();
  /* Un admin de prueba y un ganador de prueba. */
  const admin = await L.jugador({ saldo: 0, nivel: 3, extra: { rank: "owner" } });
  const ganador = await L.jugador({ saldo: 0, nivel: 0 });

  const v = carreras.ventanaDe("daily", new Date());
  const c = await Race.create({
    tipo: "daily", desde: new Date(v.desde.getTime() - 86400e3 * 3), hasta: new Date(v.desde.getTime() - 86400e3 * 2),
    premioTotalSc: 1000, reparto: [30, 18], estado: "settled",
    ganadores: [{ user: ganador.id, username: "audit", puesto: 1, jugadoSc: 100, premioSc: 300 }],
  });

  const r = await L.enParalelo(20, () =>
    L.pedir(`/admin/races/${c._id}/pay/${ganador.id}`, { token: admin.token, cuerpo: { motivo: "auditoria" } }));
  const ok = r.filter((x) => x.datos && x.datos.success).length;
  const pagos = await L.BalanceTransaction.find({ type: "race_prize", "reference.id": c._id, user: ganador.id }).lean();
  const saldo = (await L.saldoDe(ganador.id)).balanceSc;
  console.log("[PoC 9] 20 clics simultaneos en 'pagar' el mismo premio (SC 300)");
  console.log("    respuestas OK:", ok, "| pagos en el libro:", pagos.length, "| saldo del ganador:", saldo);
  console.log("    VEREDICTO:", pagos.length <= 1 ? "PASA" : `FALLA — pagado ${pagos.length} veces, SC ${L.sc(saldo)} en vez de 300 (SC ${L.sc(saldo - 300)} de mas)`);
  await L.mongoose.disconnect();
})();
