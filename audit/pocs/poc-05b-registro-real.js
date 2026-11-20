/* PoC 5b: escenario REAL. Cuenta recien registrada, saldo 0, con las tres
   cajas de regalo de fabrica (mac, pokemon-boosters, splash). Se disparan
   las tres aperturas gratis a la vez: el regalo de una queda en el saldo
   porque la otra se lo gasta antes de que la primera alcance a cobrarse. */
const L = require("./lib");
const cajas = require("C:/Users/Usuario/mrbox/backend/services/boxes");
const BoxOpen = require("C:/Users/Usuario/mrbox/backend/database/models/BoxOpen");

(async () => {
  await L.conectar();
  const RONDAS = 10;
  let total = 0, conFuga = 0;

  for (let k = 0; k < RONDAS; k += 1) {
    const j = await L.jugador({ saldo: 0, nivel: 0 });
    const regalo = await cajas.regalarCajasDeBienvenida(j.id);
    const slugs = regalo.map((r) => r.slug);

    /* Las tres gratis, a la vez (dos clics rapidos alcanzan; aca van las
       tres para que se vea en una sola corrida). */
    await Promise.all(slugs.map((s) => L.pedir(`/boxes/${s}/open`, { token: j.token, cuerpo: { veces: 1 } })));

    const u = await L.User.findById(j.id).select("+balanceSc freeOpens cajasGratis").lean();
    const abiertas = await BoxOpen.countDocuments({ user: j.id });
    const saldo = L.sc(u.balanceSc);
    if (saldo > 0) {
      conFuga += 1; total = L.sc(total + saldo);
      if (conFuga <= 2) {
        const libro = await L.BalanceTransaction.find({ user: j.id }).sort({ createdAt: 1 }).lean();
        console.log(`  ronda ${k}: puso SC 0, quedo con SC ${saldo}; aperturas ${abiertas}; gratis usadas ${u.cajasGratis.filter(c=>c.usadaEl).length}/3`);
        console.log("    libro:", libro.map((f) => `${f.type} ${f.amountSc}`).join(" | "));
      }
    }
  }

  console.log("\n[PoC 5b] cuenta nueva, saldo 0, tres cajas de regalo de fabrica — %s rondas", RONDAS);
  console.log("    cuentas que terminaron con saldo > 0 sin depositar nada:", conFuga, "/", RONDAS);
  console.log("    SC creados de la nada:", total, "(promedio", L.sc(total / Math.max(1, conFuga)), "por cuenta)");
  console.log("    VEREDICTO:", conFuga === 0 ? "PASA" : "FALLA");
  await L.mongoose.disconnect();
})();
