/* PoC 8: rakeback, promo, desafio, premio de carrera y aviso de deposito,
   todos disparados en paralelo. */
const L = require("./lib");
const vip = require("C:/Users/Usuario/mrbox/backend/services/vip");
const retos = require("C:/Users/Usuario/mrbox/backend/services/challenges");
const carreras = require("C:/Users/Usuario/mrbox/backend/services/races");
const wallet = require("C:/Users/Usuario/mrbox/backend/services/wallet");
const Challenge = require("C:/Users/Usuario/mrbox/backend/database/models/Challenge");
const { ChallengeWin } = Challenge;
const Race = require("C:/Users/Usuario/mrbox/backend/database/models/Race");

(async () => {
  await L.conectar();

  /* ── A ── rakeback: 20 cobros simultaneos del mismo periodo ── */
  const j = await L.jugador({ saldo: 0, nivel: 0, extra: { jugadoSc: 2000000, rangoManual: "Opal" } });
  await wallet.mover({ userId: j.id, amountSc: 100000, type: "purchase", reference: { kind: "test" } });
  await wallet.mover({ userId: j.id, amountSc: -50000, type: "box_open", juegaSc: 50000, reference: { kind: "test" } });
  const antes = (await L.saldoDe(j.id)).balanceSc;
  const r = await Promise.all(Array.from({ length: 20 }, () =>
    vip.cobrarRakeback({ userId: L.mongoose.Types.ObjectId.createFromHexString(j.id), periodo: "daily" })
      .then((x) => x.montoSc).catch((e) => e.code)));
  const ok = r.filter((x) => typeof x === "number");
  const fin = (await L.saldoDe(j.id)).balanceSc;
  console.log("[A] rakeback diario x20 simultaneos");
  console.log("    cobros aceptados:", ok.length, "| montos:", JSON.stringify(ok), "| saldo", antes, "->", fin);
  console.log("    VEREDICTO:", ok.length <= 1 ? "PASA" : `FALLA — se cobro ${ok.length} veces`);

  /* ── B ── promo code: 20 canjes simultaneos del mismo codigo ── */
  const codigo = await L.PromoCode.create({ codigo: "AUDIT" + Date.now().toString().slice(-8), tipo: "saldo", montoSc: 25, activo: true });
  const j2 = await L.jugador({ saldo: 0, nivel: 0 });
  const r2 = await L.enParalelo(15, () => L.pedir("/wallet/promo", { token: j2.token, cuerpo: { code: codigo.codigo } }));
  const ok2 = r2.filter((x) => x.datos && x.datos.success).length;
  const fin2 = (await L.saldoDe(j2.id)).balanceSc;
  console.log("\n[B] codigo promocional de SC 25 canjeado x15 a la vez");
  console.log("    aceptados:", ok2, "| saldo final:", fin2);
  console.log("    VEREDICTO:", fin2 === 25 ? "PASA" : `FALLA — entraron SC ${fin2}`);

  /* ── C ── desafio con 1 cupo, 20 jugadores pegandole a la vez ── */
  const caja = await L.Box.findOne({ live: true, priceSc: { $gt: 0 } }).lean();
  const d = await Challenge.create({
    box: caja._id, boxSlug: caja.slug, boxName: caja.name, multiplicador: 1,
    premioSc: 100, cupos: 1, desde: new Date(Date.now() - 3600e3), hasta: new Date(Date.now() + 3600e3), activo: true,
  });
  const jugadores = [];
  for (let i = 0; i < 20; i += 1) jugadores.push(await L.jugador({ saldo: 0, nivel: 0 }));
  await Promise.all(jugadores.map((x) => retos.revisar({
    user: { _id: L.mongoose.Types.ObjectId.createFromHexString(x.id) },
    caja, precioSc: caja.priceSc, premioSc: caja.priceSc * 10, boxOpenId: null,
  })));
  const ganadores = await ChallengeWin.countDocuments({ challenge: d._id });
  const pagados = await L.BalanceTransaction.countDocuments({ type: "challenge", "reference.id": d._id });
  const dd = await Challenge.findById(d._id).lean();
  console.log("\n[C] desafio con 1 cupo, 20 jugadores a la vez");
  console.log("    ganadores:", ganadores, "| pagos en el libro:", pagados, "| cuposUsados:", dd.cuposUsados);
  console.log("    VEREDICTO:", pagados <= 1 && dd.cuposUsados <= 1 ? "PASA" : `FALLA — se pago ${pagados} veces (SC ${pagados * 100})`);

  /* ── D ── cerrar la misma carrera 20 veces a la vez ── */
  const jc = await L.jugador({ saldo: 100000, nivel: 0 });
  await wallet.mover({ userId: jc.id, amountSc: -500, type: "box_open", juegaSc: 500, reference: { kind: "test" } });
  const ahora = new Date();
  const v = carreras.ventanaDe("daily", ahora);
  const carrera = await Race.create({ tipo: "daily", desde: v.desde, hasta: v.hasta, premioTotalSc: 1000, reparto: [30], estado: "live" });
  await Promise.all(Array.from({ length: 20 }, () => carreras.cerrar(carrera).catch(() => null)));
  const pagosC = await L.BalanceTransaction.find({ type: "race_prize", "reference.id": carrera._id }).lean();
  console.log("\n[D] cerrar la misma carrera x20 a la vez");
  console.log("    pagos de premio en el libro:", pagosC.length, "| total SC", L.sc(pagosC.reduce((a, p) => a + p.amountSc, 0)));
  console.log("    VEREDICTO:", pagosC.length <= 1 ? "PASA" : "FALLA — premio pagado " + pagosC.length + " veces");

  await L.mongoose.disconnect();
})();
