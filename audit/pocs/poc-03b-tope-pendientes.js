/* PoC 3b: el tope PEDIDOS_A_LA_VEZ (3) se cuenta con countDocuments antes
   de crear -> leer-y-despues-escribir. Se llama al servicio directo para
   saltear el rate limit del router (que es lo unico que lo tapa). */
const L = require("./lib");
const caja = require("C:/Users/Usuario/mrbox/backend/services/cashier");
const DIR = "0x1234567890abcdef1234567890abcdef12345678";

(async () => {
  await L.conectar();
  const j = await L.jugador({ saldo: 100000, nivel: 3 });
  const u = await L.User.findById(j.id).select("+balanceSc +bonoPendienteSc").lean();

  const r = await Promise.all(Array.from({ length: 20 }, () =>
    caja.pedirCanje({ user: u, montoSc: 60, ticker: "USDT", red: "trc20", direccion: DIR })
      .then(() => "ok").catch((e) => e.code || e.message)
  ));
  const ok = r.filter((x) => x === "ok").length;
  const pend = await L.Redemption.countDocuments({ user: j.id, estado: { $in: ["pending", "approved"] } });
  const saldo = await L.saldoDe(j.id);
  console.log("[3b] 20 pedidos de canje simultaneos, tope declarado = 3");
  console.log("    aceptados:", ok, "| pendientes en base:", pend, "| saldo:", saldo.balanceSc);
  console.log("    motivos:", JSON.stringify(r.reduce((a, x) => (a[x] = (a[x] || 0) + 1, a), {})));
  console.log("    VEREDICTO:", pend <= 3 ? "PASA" : `FALLA — ${pend} pendientes contra un tope de 3`);
  await L.mongoose.disconnect();
})();
