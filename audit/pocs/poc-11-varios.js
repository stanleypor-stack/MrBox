/* PoC 11: sell-many, KYC del canje y del envio, y el promo de "aperturas". */
const L = require("./lib");
const cajas = require("C:/Users/Usuario/mrbox/backend/services/boxes");
const DIR = "0x1234567890abcdef1234567890abcdef12345678";

(async () => {
  await L.conectar();
  const item = await L.Item.findOne({ active: true, valueSc: { $gte: 50, $lte: 300 } }).lean();

  /* ── A ── sell-many con ids REPETIDOS ── */
  const j = await L.jugador({ saldo: 0, nivel: 3 });
  const inv = await L.InventoryItem.create({
    user: j.id, item: item._id, name: item.name, imageUrl: "", rarity: "blue",
    valueSc: item.valueSc, state: "held", source: { kind: "manual" },
  });
  const ids = Array.from({ length: 200 }, () => String(inv._id));
  const a = await L.pedir("/inventory/sell-many", { token: j.token, cuerpo: { ids } });
  const sa = await L.saldoDe(j.id);
  console.log("[A] sell-many con el MISMO id 200 veces (objeto de SC %s)", item.valueSc);
  console.log("    vendidos:", a.datos.data.vendidos, "| totalSc:", a.datos.data.totalSc, "| saldo:", sa.balanceSc);
  console.log("    VEREDICTO:", sa.balanceSc === L.sc(item.valueSc) ? "PASA" : "FALLA");

  /* ── A2 ── sell-many con un array gigante ── */
  const j2 = await L.jugador({ saldo: 0, nivel: 3 });
  const gigante = Array.from({ length: 50000 }, (_, i) => String(inv._id));
  const t0 = Date.now();
  const a2 = await L.pedir("/inventory/sell-many", { token: j2.token, cuerpo: { ids: gigante } });
  console.log("    array de 50.000 ids -> status", a2.status, "| ms", Date.now() - t0, "| fallaron:", JSON.stringify(a2.datos).slice(0,200));

  /* ── A3 ── sell-many con ids basura ── */
  const a3 = await L.pedir("/inventory/sell-many", { token: j2.token, cuerpo: { ids: [{ $ne: null }, "no-es-un-id", null, 1, true] } });
  console.log("    ids basura ->", JSON.stringify(a3.datos).slice(0, 220));

  /* ── B ── KYC del canje ── */
  console.log("\n[B] canje con nivel de verificacion por debajo del minimo (2)");
  for (const nivel of [0, 1, 2, 3]) {
    const u = await L.jugador({ saldo: 1000, nivel });
    const r = await L.pedir("/wallet/withdraw", { token: u.token, cuerpo: { montoSc: 60, coin: "USDT", network: "trc20", address: DIR } });
    console.log(`    nivel ${nivel} -> ${r.datos && r.datos.success ? "ACEPTADO (!!)" : r.datos && r.datos.code}`);
  }

  /* ── C ── KYC del envio y tope de valor ── */
  console.log("\n[C] envio: nivel minimo y tope de SC 1.000");
  for (const [nivel, valor] of [[0, 100], [2, 100], [3, 100], [2, 5000], [3, 5000]]) {
    const u = await L.jugador({ saldo: 0, nivel });
    await L.Address.create({ user: u.id, nombre: "A", calle: "C", ciudad: "X", codigoPostal: "1", pais: "AR", predeterminada: true });
    const it = await L.InventoryItem.create({
      user: u.id, item: item._id, name: item.name, imageUrl: "", rarity: "blue",
      valueSc: valor, state: "held", source: { kind: "manual" },
    });
    const r = await L.pedir("/inventory/ship", { token: u.token, cuerpo: { ids: [String(it._id)] } });
    console.log(`    nivel ${nivel}, objeto SC ${valor} -> ${r.datos && r.datos.success ? "ACEPTADO" : r.datos && r.datos.code}`);
  }

  /* ── D ── promo tipo "aperturas": ¿respeta codigo.aperturas? ── */
  const cfg = await L.Settings.leer();
  const cod = await L.PromoCode.create({ codigo: "APER" + Date.now().toString().slice(-7), tipo: "aperturas", aperturas: 1, activo: true });
  const j4 = await L.jugador({ saldo: 0, nivel: 0 });
  await cajas.regalarCajasDeBienvenida(j4.id);                 // las de bienvenida
  await L.User.updateOne({ _id: j4.id }, { $set: { "cajasGratis.$[].usadaEl": new Date(), freeOpens: 0 } }); // ya las gasto
  const r4 = await L.pedir("/wallet/promo", { token: j4.token, cuerpo: { code: cod.codigo } });
  const u4 = await L.User.findById(j4.id).select("freeOpens cajasGratis").lean();
  console.log("\n[D] promo tipo 'aperturas' con aperturas=1, sobre una cuenta que YA gasto las de bienvenida");
  console.log("    respuesta:", r4.datos && r4.datos.success ? "OK" : r4.datos && r4.datos.code);
  console.log("    freeOpens despues:", u4.freeOpens, "| sin usar:", u4.cajasGratis.filter((c) => !c.usadaEl).length, "| aperturasDeRegalo cfg:", cfg.aperturasDeRegalo);
  console.log("    VEREDICTO:", u4.freeOpens === 1 ? "PASA" : `FALLA — el codigo decia 1 y dio ${u4.freeOpens}`);

  await L.mongoose.disconnect();
})();
