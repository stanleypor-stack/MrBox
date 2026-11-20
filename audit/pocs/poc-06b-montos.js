/* PoC 6b: un jugador NUEVO por caso, para que el tope de 3 pendientes no
   tape los resultados. Y la cuenta de lo que de verdad se cobro en deals. */
const L = require("./lib");
const caja = require("C:/Users/Usuario/mrbox/backend/services/cashier");
const deals = require("C:/Users/Usuario/mrbox/backend/services/deals");
const DIR = "0x1234567890abcdef1234567890abcdef12345678";

(async () => {
  await L.conectar();
  console.log("== pedirCanje, un jugador nuevo por caso (saldo 1e6, minimo 50) ==");
  for (const v of [49.995, 50.004, 50.005, 1e15, Number.MAX_SAFE_INTEGER, [60], "60.00000001", "  60  ", 1e21]) {
    const j = await L.jugador({ saldo: 1e6, nivel: 3 });
    const u = await L.User.findById(j.id).select("+balanceSc +bonoPendienteSc").lean();
    let r;
    try {
      const p = await caja.pedirCanje({ user: u, montoSc: v, ticker: "USDT", red: "trc20", direccion: DIR });
      const d = await L.saldoDe(j.id);
      r = `ACEPTADO montoSc=${p.montoSc} saldo->${d.balanceSc}`;
    } catch (e) { r = "rechazado: " + (e.code || e.message); }
    console.log("  ", JSON.stringify(v), "->", r);
  }

  console.log("\n== deals: lo que dice que cobro vs lo que cobro ==");
  const item = await L.Item.findOne({ active: true, valueSc: { $gte: 50, $lte: 500 } }).lean();
  for (const v of [1, 2.5, 3.9, "4"]) {
    const j = await L.jugador({ saldo: 100000, nivel: 0 });
    const u = await L.User.findById(j.id).select("+balanceSc").lean();
    const p = await deals.jugar({ user: u, itemId: item._id, chance: 0.5, veces: v });
    const libro = await L.BalanceTransaction.find({ user: j.id, type: "deal" }).lean();
    const cobrado = L.sc(libro.reduce((a, f) => a + Math.abs(f.amountSc), 0));
    console.log(`   veces=${JSON.stringify(v)} -> ${p.tiros.length} tiros | dice gastadoSc=${p.gastadoSc} | cobro de verdad=${cobrado} | diferencia=${L.sc(cobrado - p.gastadoSc)}`);
  }

  console.log("\n== cajas: `veces` fraccionario y el contador de aperturas ==");
  const c = await L.Box.findOne({ live: true, priceSc: { $gte: 1, $lte: 20 } }).lean();
  const antes = (await L.Box.findById(c._id).lean()).opens;
  const j3 = await L.jugador({ saldo: 100000, nivel: 0 });
  const x = await L.pedir(`/boxes/${c.slug}/open`, { token: j3.token, cuerpo: { veces: 2.7 } });
  const despues = (await L.Box.findById(c._id).lean()).opens;
  const libro3 = await L.BalanceTransaction.find({ user: j3.id, type: "box_open" }).lean();
  console.log(`   veces=2.7 -> ${x.datos.data.resultados.length} aperturas | dice gastadoSc=${x.datos.data.gastadoSc} | cobro=${L.sc(libro3.reduce((a,f)=>a+Math.abs(f.amountSc),0))}`);
  console.log(`   Box.opens: ${antes} -> ${despues} (delta ${despues - antes})`);

  await L.mongoose.disconnect();
})();
