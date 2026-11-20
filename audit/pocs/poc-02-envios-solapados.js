/* PoC 2: dos pedidos de envio SOLAPADOS (comparten un objeto).
   El rollback de shipping.pedir() filtra por { state:"requested", order:null },
   y ese `order:null` tambien alcanza a los objetos del OTRO pedido que
   todavia no le grabo el `order`. */
const L = require("./lib");

(async () => {
  await L.conectar();
  const j = await L.jugador({ saldo: 0, nivel: 3 });
  await L.Address.create({
    user: j.id, nombre: "Audit", calle: "Calle 1", ciudad: "X",
    codigoPostal: "1000", pais: "AR", predeterminada: true,
  });
  const item = await L.Item.findOne({ active: true, valueSc: { $gte: 10, $lte: 300 } }).lean();

  const RONDAS = 25;
  let sueltos = 0;
  let vendidosYDespachados = 0;
  let plata = 0;

  for (let k = 0; k < RONDAS; k += 1) {
    const crear = () => L.InventoryItem.create({
      user: j.id, item: item._id, name: item.name, imageUrl: "", rarity: "blue",
      valueSc: item.valueSc, state: "held", source: { kind: "manual" },
    });
    const X = await crear(); const Y = await crear(); const Z = await crear();

    /* A pide X+Y, B pide Y+Z. Comparten Y. */
    const [a, b] = await Promise.all([
      L.pedir("/inventory/ship", { token: j.token, cuerpo: { ids: [String(X._id), String(Y._id)] } }),
      L.pedir("/inventory/ship", { token: j.token, cuerpo: { ids: [String(Y._id), String(Z._id)] } }),
    ]);

    const despues = await L.InventoryItem.find({ _id: { $in: [X._id, Y._id, Z._id] } }).lean();
    /* El caso roto: un objeto que quedo "held" (vendible) PERO con `order`
       puesto, o sea dentro de un pedido que el deposito va a despachar. */
    const rotos = despues.filter((o) => o.state === "held" && o.order);
    if (rotos.length) {
      sueltos += rotos.length;
      for (const r of rotos) {
        const orden = await L.Order.findById(r.order).lean();
        const estaEnElPedido = orden && orden.items.some((i) => String(i.inventoryItem) === String(r._id));
        if (!estaEnElPedido) continue;
        /* Y ademas se puede vender: la plata sale igual. */
        const v = await L.pedir(`/inventory/${r._id}/sell`, { token: j.token });
        if (v.datos && v.datos.success) {
          vendidosYDespachados += 1;
          plata = L.sc(plata + v.datos.data.vendidoSc);
        }
      }
    }
    if (k === 0) {
      console.log("ronda 0 ->", JSON.stringify({ a: a.datos && a.datos.success, b: b.datos && b.datos.success }));
    }
  }

  console.log("\n[PoC 2] dos envios solapados, %s rondas (objeto de SC %s)", RONDAS, item.valueSc);
  console.log("    objetos que quedaron 'held' PERO adentro de un pedido:", sueltos);
  console.log("    de esos, vendidos por SC mientras siguen en el pedido:", vendidosYDespachados);
  console.log("    plata cobrada por mercaderia que igual se despacha: SC", plata);
  console.log("    VEREDICTO:", sueltos === 0 ? "PASA" : "FALLA");

  await L.mongoose.disconnect();
})();
