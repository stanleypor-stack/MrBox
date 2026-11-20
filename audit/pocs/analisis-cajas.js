/* Analisis estadistico de las cajas de la base local. SOLO LECTURA. */
const m = require("C:/Users/Usuario/mrbox/backend/node_modules/mongoose");
const URI = "mongodb://127.0.0.1:27017/mrbox_local";
const RETORNO = 0.92;
const TOL = 1e-6;

(async () => {
  await m.connect(URI, { serverSelectionTimeoutMS: 5000 });
  const db = m.connection.db;
  const cajas = await db.collection("boxes").find({}).toArray();

  const noCierran = [];
  const rtpAlto = [];
  const rtpBajo = [];
  const todas = [];
  const precioMal = [];
  const chanceCero = [];
  const retornoGuardadoMal = [];

  for (const c of cajas) {
    const premios = c.prizes || [];
    const suma = premios.reduce((a, p) => a + (Number(p.chance) || 0), 0);
    const ev = premios.reduce((a, p) => a + (Number(p.valueSc) || 0) * (Number(p.chance) || 0), 0);
    const precio = Number(c.priceSc) || 0;
    const rtp = precio > 0 ? ev / precio : 0;
    const precioTeorico = Math.ceil((ev / RETORNO) * 100) / 100;

    todas.push({ slug: c.slug, name: c.name, live: !!c.live, creator: !!c.creator,
      n: premios.length, suma, ev: +ev.toFixed(4), precio, rtp: +(rtp * 100).toFixed(3),
      precioTeorico, guardado: +(((c.retorno || 0)) * 100).toFixed(3), opens: c.opens || 0,
      precioAMano: !!c.precioAMano, approvalState: c.approvalState });

    if (Math.abs(suma - 1) > TOL) noCierran.push({ slug: c.slug, name: c.name, live: !!c.live, suma, delta: +(suma - 1).toExponential(3), n: premios.length });
    if (rtp > 1) rtpAlto.push({ slug: c.slug, rtp: +(rtp*100).toFixed(2), precio, ev: +ev.toFixed(2), live: !!c.live });
    else if (rtp > 0.98) rtpAlto.push({ slug: c.slug, rtp: +(rtp*100).toFixed(2), precio, ev: +ev.toFixed(2), live: !!c.live, soloAviso: true });
    if (rtp > 0 && rtp < 0.80) rtpBajo.push({ slug: c.slug, rtp: +(rtp*100).toFixed(2), precio, ev: +ev.toFixed(2), live: !!c.live });
    if (!c.precioAMano && Math.abs(precio - precioTeorico) > 0.011) precioMal.push({ slug: c.slug, precio, precioTeorico, rtp: +(rtp*100).toFixed(2), live: !!c.live });
    const ceros = premios.filter((p) => !(Number(p.chance) > 0));
    if (ceros.length) chanceCero.push({ slug: c.slug, cuantos: ceros.length, nombres: ceros.map(p=>p.name).slice(0,5) });
    if (Math.abs((c.retorno || 0) - rtp) > 0.0005) retornoGuardadoMal.push({ slug: c.slug, guardado: +(((c.retorno||0))*100).toFixed(3), real: +(rtp*100).toFixed(3), live: !!c.live });
  }

  const vivas = todas.filter(t => t.live);
  const prom = (a) => a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0;

  console.log("== TOTALES ==");
  console.log("cajas:", cajas.length, "| live:", vivas.length, "| de comunidad:", todas.filter(t=>t.creator).length);
  console.log("RTP promedio (live):", prom(vivas.map(v=>v.rtp)).toFixed(3) + "%");
  console.log("RTP min/max (live):", Math.min(...vivas.map(v=>v.rtp)).toFixed(3), "/", Math.max(...vivas.map(v=>v.rtp)).toFixed(3));

  console.log("\n== CHANCES QUE NO SUMAN 1 (tol 1e-6) ==", noCierran.length);
  noCierran.slice(0, 40).forEach(x => console.log("  ", x.slug, "suma=", x.suma, "delta=", x.delta, "live=", x.live, "n=", x.n));

  console.log("\n== PREMIOS CON CHANCE 0 ==", chanceCero.length);
  chanceCero.slice(0,20).forEach(x => console.log("  ", x.slug, x.cuantos, JSON.stringify(x.nombres)));

  console.log("\n== RTP > 98% (la casa casi no gana / pierde) ==");
  rtpAlto.sort((a,b)=>b.rtp-a.rtp).forEach(x => console.log("  ", x.slug, x.rtp + "%", "precio=", x.precio, "ev=", x.ev, "live=", x.live, x.rtp>100?"<<< PIERDE":""));

  console.log("\n== RTP < 80% ==", rtpBajo.length);
  rtpBajo.sort((a,b)=>a.rtp-b.rtp).slice(0,30).forEach(x => console.log("  ", x.slug, x.rtp + "%", "precio=", x.precio, "ev=", x.ev, "live=", x.live));

  console.log("\n== PRECIO != precio teorico (sin precioAMano) ==", precioMal.length);
  precioMal.slice(0,30).forEach(x => console.log("  ", x.slug, "precio=", x.precio, "teorico=", x.precioTeorico, "rtp=", x.rtp, "live=", x.live));

  console.log("\n== box.retorno guardado != RTP real ==", retornoGuardadoMal.length);
  retornoGuardadoMal.slice(0,30).forEach(x => console.log("  ", x.slug, "guardado=", x.guardado, "real=", x.real, "live=", x.live));

  /* Distribucion de RTP */
  const bandas = {};
  for (const v of vivas) {
    const b = Math.floor(v.rtp);
    bandas[b] = (bandas[b]||0)+1;
  }
  console.log("\n== DISTRIBUCION RTP (live, por punto entero) ==");
  Object.keys(bandas).sort((a,b)=>a-b).forEach(k => console.log("  ", k + "%-" + (+k+1) + "%:", bandas[k]));

  await m.disconnect();
})().catch(e => { console.error("ERR", e); process.exit(1); });
