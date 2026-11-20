/* PoC 7: ¿el saldo se reconstruye del libro?
   Para cada usuario: suma de amountSc vs balanceSc, y ademas la cadena
   balanceBefore/balanceAfter de sus filas en orden. */
const L = require("./lib");

(async () => {
  await L.conectar();
  const usuarios = await L.User.find({}).select("+balanceSc username createdAt").lean();
  let descuadrados = 0, cadenaRota = 0;
  const detalle = [];

  for (const u of usuarios) {
    const filas = await L.BalanceTransaction.find({ user: u._id }).sort({ createdAt: 1, _id: 1 }).lean();
    const suma = L.sc(filas.reduce((a, f) => a + f.amountSc, 0));
    const saldo = L.sc(u.balanceSc);
    /* El saldo inicial sembrado = balanceBefore de la primera fila. */
    const inicial = filas.length ? L.sc(filas[0].balanceBefore) : saldo;
    if (L.sc(inicial + suma) !== saldo) {
      descuadrados += 1;
      detalle.push({ u: u.username, inicial, suma, saldo, filas: filas.length });
    }
    /* La cadena: balanceAfter de una tiene que ser balanceBefore de la siguiente. */
    for (let i = 1; i < filas.length; i += 1) {
      if (L.sc(filas[i - 1].balanceAfter) !== L.sc(filas[i].balanceBefore)) { cadenaRota += 1; break; }
    }
  }

  console.log("[PoC 7] usuarios en mrbox_local:", usuarios.length);
  console.log("    saldo != saldoInicial + suma(libro):", descuadrados);
  console.log("    cadena balanceBefore/After rota:", cadenaRota);
  if (detalle.length) console.log("    ejemplos:", JSON.stringify(detalle.slice(0, 5), null, 1));

  /* Movimientos huerfanos: filas sin usuario, o tipos fuera del enum. */
  const tipos = await L.BalanceTransaction.aggregate([{ $group: { _id: "$type", n: { $sum: 1 }, total: { $sum: "$amountSc" } } }]);
  console.log("\n    tipos en el libro:");
  for (const t of tipos.sort((a, b) => b.n - a.n)) console.log(`      ${t._id}: ${t.n} filas, neto ${L.sc(t.total)}`);

  await L.mongoose.disconnect();
})();
