/*
  PRUEBAS DE CONCURRENCIA contra una base DESCARTABLE (mrbox_audit_fair).
  No toca mrbox_local ni produccion.
*/
process.env.DATABASE_URI = "mongodb://127.0.0.1:27017/mrbox_audit_fair";
process.env.JWT_SECRET = "auditoria-local";
process.env.TURNSTILE_SECRET_KEY = "";
process.env.AUTH_RATE_LIMIT = "5000";
process.env.OPEN_RATE_LIMIT = "50000";
process.env.LOG_LEVEL = "error";

const path = "C:/Users/Usuario/mrbox/backend";
const mongoose = require(path + "/node_modules/mongoose");
const { app } = require(path + "/index");
const { conectar } = require(path + "/database");

const User = require(path + "/database/models/User");
const Box = require(path + "/database/models/Box");
const Item = require(path + "/database/models/Item");
const BoxOpen = require(path + "/database/models/BoxOpen");
const InventoryItem = require(path + "/database/models/InventoryItem");
const UserSeed = require(path + "/database/models/UserSeed");
const Deal = require(path + "/database/models/Deal");
const Order = require(path + "/database/models/Order");
const Address = require(path + "/database/models/Address");
const wallet = require(path + "/services/wallet");

let base = "";
let servidor;

async function pedir(metodo, ruta, opciones) {
  const o = opciones || {};
  const r = await fetch(base + ruta, {
    method: metodo,
    headers: Object.assign(
      { "Content-Type": "application/json" },
      o.token ? { "x-auth-token": o.token } : {}
    ),
    body: o.cuerpo ? JSON.stringify(o.cuerpo) : undefined,
  });
  let datos = null;
  try { datos = await r.json(); } catch (e) { datos = null; }
  return { estado: r.status, datos: datos };
}

function datosDe(r, donde) {
  if (!r.datos || !r.datos.data) throw new Error(donde + " -> " + r.estado + " " + JSON.stringify(r.datos));
  return r.datos.data;
}

let n = 0;
async function jugador(saldo) {
  n += 1;
  const marca = Date.now() % 1000000;
  const r = await pedir("POST", "/auth/register", {
    cuerpo: {
      username: "aud" + n + marca,
      email: "aud" + n + "_" + marca + "@test.local",
      password: "Contrasena123!",
      captcha: "x",
    },
  });
  const cuerpo = r.datos && (r.datos.data && r.datos.data.token ? r.datos.data : r.datos);
  if (!cuerpo || !cuerpo.token) {
    throw new Error("registro fallo: " + JSON.stringify(r.datos));
  }
  const id = cuerpo.user._id;
  await wallet.mover({ userId: id, amountSc: saldo, type: "manual", reference: { kind: "audit" } });
  return { token: cuerpo.token, id: id };
}

(async () => {
  await conectar();
  await mongoose.connection.db.dropDatabase();
  servidor = app.listen(0);
  await new Promise((r) => servidor.once("listening", r));
  base = "http://127.0.0.1:" + servidor.address().port + "/api";

  const caro = await Item.create({ sku: "AUDCARO", name: "Caro", valueSc: 90, rarity: "gold", active: true, shippable: true });
  const barato = await Item.create({ sku: "AUDBARATO", name: "Barato", valueSc: 1, rarity: "blue", active: true, shippable: true });

  const premios = [
    { item: caro._id, name: "Caro", valueSc: 90, chance: 0.1, rarity: "gold" },
    { item: barato._id, name: "Barato", valueSc: 1, chance: 0.9, rarity: "blue" },
  ];

  await Box.create({ slug: "auditoria", name: "Auditoria", category: "Mix", live: true, priceSc: 10, pagoPromedio: 9.2, retorno: 0.92, prizes: premios });
  await Box.create({ slug: "apagada", name: "Apagada", category: "Mix", live: false, priceSc: 10, pagoPromedio: 9.2, retorno: 0.92, prizes: premios });

  const R = {};

  /* 1. NONCE EN PARALELO */
  {
    const j = await jugador(100000);
    const N = 60;
    const res = await Promise.all(
      Array.from({ length: N }, () => pedir("POST", "/boxes/auditoria/open", { token: j.token }))
    );
    const okeys = res.filter((r) => r.estado === 200);
    const nonces = okeys.map((r) => r.datos.data.resultados[0].nonce);
    const hmacs = okeys.map((r) => r.datos.data.resultados[0].hmac);
    const enBase = await BoxOpen.find({ user: j.id }).select("nonce hmac numero premio").lean();
    const noncesBase = enBase.map((o) => o.nonce);
    R.nonceParalelo = {
      pedidos: N,
      ok: okeys.length,
      codigos: Array.from(new Set(res.map((r) => r.estado))),
      noncesUnicos: new Set(nonces).size,
      hmacsUnicos: new Set(hmacs).size,
      aperturasEnBase: enBase.length,
      noncesDuplicadosEnBase: noncesBase.length - new Set(noncesBase).size,
      rango: [Math.min.apply(null, noncesBase), Math.max.apply(null, noncesBase)],
      huecos: (Math.max.apply(null, noncesBase) - Math.min.apply(null, noncesBase) + 1) - new Set(noncesBase).size,
    };
  }

  /* 2. ROTAR EN PARALELO CON ABRIR */
  {
    const j = await jugador(100000);
    const tareas = [];
    for (let i = 0; i < 25; i += 1) tareas.push(pedir("POST", "/boxes/auditoria/open", { token: j.token, cuerpo: { veces: 4 } }));
    for (let i = 0; i < 10; i += 1) tareas.push(pedir("POST", "/inventory/fair/rotate", { token: j.token, cuerpo: { semillaCliente: "x" + i } }));
    const res = await Promise.all(tareas);
    const abiertas = await BoxOpen.find({ user: j.id }).select("nonce semillaServidorHash hmac").lean();
    const porTanda = {};
    for (const o of abiertas) {
      porTanda[o.semillaServidorHash] = porTanda[o.semillaServidorHash] || [];
      porTanda[o.semillaServidorHash].push(o.nonce);
    }
    let colisiones = 0;
    for (const k of Object.keys(porTanda)) colisiones += porTanda[k].length - new Set(porTanda[k]).size;
    const hmacs = abiertas.map((o) => o.hmac);
    const tandas = await UserSeed.find({ user: j.id }).lean();
    R.rotarYAbrir = {
      aperturas: abiertas.length,
      tandas: tandas.length,
      activas: tandas.filter((t) => t.activa).length,
      inactivasSinRevelar: tandas.filter((t) => !t.activa && !t.reveladaEn).length,
      colisionesNonceEnMismaTanda: colisiones,
      hmacsRepetidos: hmacs.length - new Set(hmacs).size,
      errores5xx: res.filter((r) => r.estado >= 500).length,
      codigos: Array.from(new Set(res.map((r) => r.estado))),
    };
  }

  /* 3. CAJA NO LIVE */
  {
    const j = await jugador(1000);
    const real = await pedir("POST", "/boxes/apagada/open", { token: j.token });
    const demo = await pedir("POST", "/boxes/apagada/demo", { token: j.token, cuerpo: { veces: 1 } });
    const demoSinSesion = await pedir("POST", "/boxes/apagada/demo", { cuerpo: { veces: 1 } });
    const ver = await pedir("GET", "/boxes/apagada", { token: j.token });
    const dd = demoSinSesion.datos && demoSinSesion.datos.data;
    R.cajaApagada = {
      open: [real.estado, real.datos && real.datos.code],
      demoConSesion: [demo.estado, demo.datos && demo.datos.code],
      demoSinSesion: [demoSinSesion.estado, demoSinSesion.datos && demoSinSesion.datos.code],
      demoExponeTabla: !!(dd && dd.caja && dd.caja.prizes),
      demoChances: dd && dd.caja ? (dd.caja.prizes || []).map((p) => p.name + "=" + p.chance) : null,
      getPublico: [ver.estado, ver.datos && ver.datos.code],
    };
  }

  /* 4. VENDER EL MISMO ITEM EN PARALELO */
  {
    const j = await jugador(1000);
    const ab = await pedir("POST", "/boxes/auditoria/open", { token: j.token });
    const item = datosDe(ab, "open/ventaDoble").resultados[0].premio;
    const antes = (await wallet.saldoDe(j.id)).balanceSc;
    const res = await Promise.all(Array.from({ length: 12 }, () => pedir("POST", "/inventory/" + item._id + "/sell", { token: j.token })));
    const ok = res.filter((r) => r.estado === 200).length;
    const despues = (await wallet.saldoDe(j.id)).balanceSc;
    const inv = await InventoryItem.findById(item._id).lean();
    R.ventaDoble = { intentos: 12, exitosas: ok, pagado: Number((despues - antes).toFixed(2)), valorItem: item.valueSc, estadoFinal: inv.state };
  }

  /* 5. PRECIO DE VENTA MANDADO POR EL CLIENTE */
  {
    const j = await jugador(1000);
    const ab = await pedir("POST", "/boxes/auditoria/open", { token: j.token });
    const item = datosDe(ab, "open/ventaDoble").resultados[0].premio;
    const antes = (await wallet.saldoDe(j.id)).balanceSc;
    const r = await pedir("POST", "/inventory/" + item._id + "/sell", {
      token: j.token,
      cuerpo: { valueSc: 999999, priceSc: 999999, amountSc: 999999, seVendePorSc: 999999, vendidoSc: 999999 },
    });
    const despues = (await wallet.saldoDe(j.id)).balanceSc;
    R.precioDeVenta = { estado: r.estado, pagado: Number((despues - antes).toFixed(2)), valorReal: item.valueSc, devueltoPorApi: r.datos && r.datos.data && r.datos.data.vendidoSc };
  }

  /* 6. ENVIOS */
  {
    const j = await jugador(1000);
    await User.updateOne({ _id: j.id }, { $set: { verificationLevel: 3 } });
    await Address.create({ user: j.id, nombre: "A", calle: "C 1", ciudad: "X", codigoPostal: "1000", pais: "AR", predeterminada: true });

    const ab = await pedir("POST", "/boxes/auditoria/open", { token: j.token, cuerpo: { veces: 2 } });
    const items = ab.datos.data.resultados.map((r) => r.premio);
    const envio = await pedir("POST", "/inventory/ship", { token: j.token, cuerpo: { ids: items.map((i) => i._id) } });
    const ventaDespues = await pedir("POST", "/inventory/" + items[0]._id + "/sell", { token: j.token });
    const orderId = envio.datos && envio.datos.data && envio.datos.data._id;
    const saldoAntes = (await wallet.saldoDe(j.id)).balanceSc;
    const cancels = orderId
      ? await Promise.all(Array.from({ length: 6 }, () => pedir("POST", "/inventory/ship/" + orderId + "/cancel", { token: j.token })))
      : [];
    const saldoDespues = (await wallet.saldoDe(j.id)).balanceSc;
    const invs = await InventoryItem.find({ _id: { $in: items.map((i) => i._id) } }).lean();
    R.envio = {
      envio: [envio.estado, envio.datos && envio.datos.code],
      ventaConEnvioPedido: [ventaDespues.estado, ventaDespues.datos && ventaDespues.datos.code],
      cancelacionesOk: cancels.filter((c) => c.estado === 200).length,
      plataDevuelta: Number((saldoDespues - saldoAntes).toFixed(2)),
      estadosFinales: invs.map((i) => i.state),
    };

    /* cancelar un pedido YA DESPACHADO */
    const ab2 = await pedir("POST", "/boxes/auditoria/open", { token: j.token });
    const it2 = ab2.datos.data.resultados[0].premio;
    const env2 = await pedir("POST", "/inventory/ship", { token: j.token, cuerpo: { ids: [it2._id] } });
    const oid2 = env2.datos.data._id;
    await Order.updateOne({ _id: oid2 }, { $set: { estado: "shipped" } });
    await InventoryItem.updateMany({ order: oid2 }, { $set: { state: "shipped" } });
    const saldoA = (await wallet.saldoDe(j.id)).balanceSc;
    const cancel2 = await pedir("POST", "/inventory/ship/" + oid2 + "/cancel", { token: j.token });
    const saldoB = (await wallet.saldoDe(j.id)).balanceSc;
    const inv2 = await InventoryItem.findById(it2._id).lean();
    R.cancelarDespachado = { estado: cancel2.estado, code: cancel2.datos && cancel2.datos.code, estadoItem: inv2.state, plataDevuelta: Number((saldoB - saldoA).toFixed(2)) };

    const vendeEnviado = await pedir("POST", "/inventory/" + it2._id + "/sell", { token: j.token });
    R.venderEnviado = { estado: vendeEnviado.estado, code: vendeEnviado.datos && vendeEnviado.datos.code };

    /* carrera: pedir el mismo item en dos envios a la vez */
    const ab3 = await pedir("POST", "/boxes/auditoria/open", { token: j.token });
    const it3 = ab3.datos.data.resultados[0].premio;
    const dobles = await Promise.all(Array.from({ length: 8 }, () => pedir("POST", "/inventory/ship", { token: j.token, cuerpo: { ids: [it3._id] } })));
    const pedidos = await Order.find({ user: j.id }).lean();
    R.envioDoble = {
      okeys: dobles.filter((d) => d.estado === 200).length,
      pedidosConEseItem: pedidos.filter((p) => (p.items || []).some((x) => String(x.inventoryItem) === String(it3._id)) && p.estado !== "cancelled").length,
    };
  }

  /* 7. DEALS */
  {
    const j = await jugador(500000);
    const q = await pedir("GET", "/deals/quote?itemId=" + caro._id + "&chance=0.5");
    let ganadas = 0;
    for (let i = 0; i < 500; i += 1) {
      const r = await pedir("POST", "/deals/play", { token: j.token, cuerpo: { itemId: String(caro._id), chance: 0.5, veces: 4 } });
      if (r.estado !== 200) { console.log("deal fallo", r.estado, JSON.stringify(r.datos)); break; }
      ganadas += r.datos.data.tiros.filter((t) => t.gano).length;
    }
    const todas = await Deal.find({ user: j.id }).lean();
    const realGanadas = todas.filter((d) => d.gano).length;
    const apostado = todas.reduce((a, d) => a + d.stakeSc, 0);
    const devuelto = realGanadas * 90;
    R.deals = {
      quote: q.datos && q.datos.data,
      tiros: todas.length,
      ganados: realGanadas,
      chanceReal: Number((realGanadas / todas.length).toFixed(4)),
      chanceAnunciada: 0.5,
      apostadoSc: Number(apostado.toFixed(2)),
      devueltoSc: Number(devuelto.toFixed(2)),
      rtpRealMedido: Number(((devuelto / apostado) * 100).toFixed(3)),
      rtpTeorico: Number(((90 * 0.5 / (Math.ceil((90 * 0.5 / 0.92) * 100) / 100)) * 100).toFixed(3)),
    };

    const fuera = await pedir("POST", "/deals/play", { token: j.token, cuerpo: { itemId: String(caro._id), chance: 0.99 } });
    const neg = await pedir("POST", "/deals/play", { token: j.token, cuerpo: { itemId: String(caro._id), chance: -1 } });
    const cero = await pedir("POST", "/deals/play", { token: j.token, cuerpo: { itemId: String(caro._id), chance: 0 } });
    const vecesRaro = await pedir("POST", "/deals/play", { token: j.token, cuerpo: { itemId: String(caro._id), chance: 0.5, veces: 99 } });
    R.dealsLimites = {
      chance099: [fuera.estado, fuera.datos && fuera.datos.code],
      chanceNegativa: [neg.estado, neg.datos && neg.datos.code],
      chanceCero: [cero.estado, cero.datos && cero.datos.code],
      veces99: [vecesRaro.estado, vecesRaro.datos && vecesRaro.datos.code],
    };
  }

  /* 8. VERIFY PUBLICO */
  {
    const a = await jugador(1000);
    const b = await jugador(1000);
    const r = await pedir("POST", "/deals/play", { token: a.token, cuerpo: { itemId: String(caro._id), chance: 0.5 } });
    const dealId = r.datos.data.tiros[0].dealId;
    const sinSesion = await pedir("GET", "/deals/verify/" + dealId);
    await pedir("POST", "/inventory/fair/rotate", { token: a.token });
    const trasRotar = await pedir("GET", "/deals/verify/" + dealId);
    R.verifyDeals = {
      sinSesionAntesDeRotar: {
        estado: sinSesion.estado,
        sePuede: sinSesion.datos.data.sePuede,
        exponeSemilla: !!sinSesion.datos.data.semillaServidor,
        exponeApuestaAjena: !!(sinSesion.datos.data.recibo && sinSesion.datos.data.recibo.stakeSc),
      },
      sinSesionTrasRotar: {
        estado: trasRotar.estado,
        sePuede: trasRotar.datos.data.sePuede,
        exponeSemilla: !!trasRotar.datos.data.semillaServidor,
        coincide: trasRotar.datos.data.coincide,
      },
    };

    const ab = await pedir("POST", "/boxes/auditoria/open", { token: a.token });
    const boxOpenId = ab.datos.data.resultados[0].boxOpenId;
    const ajeno = await pedir("GET", "/inventory/fair/verify/" + boxOpenId, { token: b.token });
    R.verifyCajaAjena = [ajeno.estado, ajeno.datos && ajeno.datos.code];
  }

  /* 9. veces fuera de rango */
  {
    const j = await jugador(100000);
    const neg = await pedir("POST", "/boxes/auditoria/open", { token: j.token, cuerpo: { veces: -5 } });
    const cien = await pedir("POST", "/boxes/auditoria/open", { token: j.token, cuerpo: { veces: 100 } });
    const txt = await pedir("POST", "/boxes/auditoria/open", { token: j.token, cuerpo: { veces: "4" } });
    R.veces = {
      negativo: [neg.estado, neg.datos && neg.datos.code, neg.estado === 200 ? neg.datos.data.resultados.length : null],
      cien: [cien.estado, cien.datos && cien.datos.code],
      texto: [txt.estado, txt.datos && txt.datos.code, txt.estado === 200 ? txt.datos.data.resultados.length : null],
    };
  }

  /* 10. DISTRIBUCION REAL DEL SORTEO (10.000 aperturas, chance 10% / 90%) */
  {
    const j = await jugador(2000000);
    let caros = 0;
    let total = 0;
    for (let i = 0; i < 2500; i += 1) {
      const r = await pedir("POST", "/boxes/auditoria/open", { token: j.token, cuerpo: { veces: 4 } });
      if (r.estado !== 200) { console.log("open fallo", r.estado, JSON.stringify(r.datos)); break; }
      for (const t of r.datos.data.resultados) { total += 1; if (t.premio.name === "Caro") caros += 1; }
    }
    const pagado = caros * 90 + (total - caros) * 1;
    R.distribucion = {
      aperturas: total,
      carosEsperados: total * 0.1,
      carosObtenidos: caros,
      frecuencia: Number((caros / total).toFixed(5)),
      z: Number(((caros - total * 0.1) / Math.sqrt(total * 0.1 * 0.9)).toFixed(3)),
      rtpMedido: Number(((pagado / (total * 10)) * 100).toFixed(3)),
      rtpTeorico: 92,
    };
  }

  console.log(JSON.stringify(R, null, 2));
  await mongoose.connection.db.dropDatabase();
  servidor.close();
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
