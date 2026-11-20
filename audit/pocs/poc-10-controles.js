/* PoC 10: autoexclusion ("take a break") y limites diarios.
   ¿Que endpoints frenan y cuales no? */
const L = require("./lib");
const controles = require("C:/Users/Usuario/mrbox/backend/services/controls");
const deals = require("C:/Users/Usuario/mrbox/backend/services/deals");

(async () => {
  await L.conectar();
  const caja = await L.Box.findOne({ live: true, priceSc: { $gt: 0, $lte: 10 } }).lean();
  const item = await L.Item.findOne({ active: true, valueSc: { $gte: 50, $lte: 300 } }).lean();

  const j = await L.jugador({ saldo: 5000, nivel: 3 });
  await controles.tomarseUnDescanso({ userId: j.id, dias: 30 });
  const est = await controles.leer(j.id);
  console.log("pausaHasta:", est.pausaHasta);

  const inv = await L.InventoryItem.create({
    user: j.id, item: item._id, name: item.name, imageUrl: "", rarity: "blue",
    valueSc: item.valueSc, state: "held", source: { kind: "manual" },
  });
  await L.Address.create({ user: j.id, nombre: "A", calle: "C", ciudad: "X", codigoPostal: "1", pais: "AR", predeterminada: true });
  const inv2 = await L.InventoryItem.create({
    user: j.id, item: item._id, name: item.name, imageUrl: "", rarity: "blue",
    valueSc: 100, state: "held", source: { kind: "manual" },
  });
  const promo = await L.PromoCode.create({ codigo: "PAUSA" + Date.now().toString().slice(-7), tipo: "saldo", montoSc: 10, activo: true });

  const pruebas = [
    ["abrir caja           ", () => L.pedir(`/boxes/${caja.slug}/open`, { token: j.token, cuerpo: { veces: 1 } })],
    ["deals /play          ", () => L.pedir(`/deals/play`, { token: j.token, cuerpo: { itemId: String(item._id), chance: 0.5, veces: 1 } })],
    ["vender item          ", () => L.pedir(`/inventory/${inv._id}/sell`, { token: j.token })],
    ["pedir envio          ", () => L.pedir(`/inventory/ship`, { token: j.token, cuerpo: { ids: [String(inv2._id)] } })],
    ["pedir canje          ", () => L.pedir(`/wallet/withdraw`, { token: j.token, cuerpo: { montoSc: 60, coin: "USDT", network: "trc20", address: "0x1234567890abcdef1234567890abcdef12345678" } })],
    ["canjear promo        ", () => L.pedir(`/wallet/promo`, { token: j.token, cuerpo: { code: promo.codigo } })],
    ["cobrar rakeback      ", () => L.pedir(`/vip/rakeback/daily`, { token: j.token })],
  ];

  console.log("\n[PoC 10] cuenta EN PAUSA 30 dias — que deja pasar el servidor:");
  for (const [nombre, fn] of pruebas) {
    const r = await fn();
    const ok = r.datos && r.datos.success;
    console.log(`   ${nombre} -> ${ok ? "PASA IGUAL (!!)" : "frenado: " + (r.datos && r.datos.code)}`);
  }

  /* Limite diario de juego */
  const j2 = await L.jugador({ saldo: 5000, nivel: 0 });
  await controles.guardar({ userId: j2.id, juegoDiarioSc: 10, perdidaDiariaSc: null });
  console.log("\n   limite diario de juego SC 10, caja de SC", caja.priceSc);
  const r2 = await L.enParalelo(20, () => L.pedir(`/boxes/${caja.slug}/open`, { token: j2.token, cuerpo: { veces: 1 } }));
  const ok2 = r2.filter((x) => x.datos && x.datos.success).length;
  const hoy = await controles.loDeHoy(L.mongoose.Types.ObjectId.createFromHexString(j2.id));
  console.log("   20 aperturas simultaneas -> aceptadas:", ok2, "| jugado hoy segun el libro: SC", hoy.jugadoSc);
  console.log("   VEREDICTO:", hoy.jugadoSc <= 10 ? "PASA" : `FALLA — jugo SC ${hoy.jugadoSc} con tope de 10`);

  await L.mongoose.disconnect();
})();
