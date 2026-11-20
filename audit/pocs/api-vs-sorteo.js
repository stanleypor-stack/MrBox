/*
  ¿Lo que la API le muestra al jugador es EXACTAMENTE lo que usa el sorteo?
  Se compara, caja por caja y premio por premio:
    - resumenDeCaja(caja).prizes   (lo que devuelve GET /api/boxes/:slug)
    - caja.prizes                  (lo que recorre fair.elegirPremio)
  SOLO LECTURA sobre mrbox_local.
*/
const path = "C:/Users/Usuario/mrbox/backend";
const m = require(path + "/node_modules/mongoose");
const cajasSvc = require(path + "/services/boxes");
const fair = require(path + "/services/boxes/fair");

(async () => {
  await m.connect("mongodb://127.0.0.1:27017/mrbox_local", { serverSelectionTimeoutMS: 5000 });
  const db = m.connection.db;
  const cajas = await db.collection("boxes").find({}).toArray();

  let desalineadas = 0;
  let ordenDistinto = 0;
  const problemas = [];

  for (const c of cajas) {
    const resumen = cajasSvc.resumenDeCaja(c);
    const mostrados = resumen.prizes || [];
    const usados = c.prizes || [];

    if (mostrados.length !== usados.length) {
      desalineadas++; problemas.push({ slug: c.slug, motivo: "distinta cantidad", mostrados: mostrados.length, usados: usados.length });
      continue;
    }
    for (let i = 0; i < usados.length; i += 1) {
      if (mostrados[i].name !== usados[i].name) { ordenDistinto++; problemas.push({ slug: c.slug, i, motivo: "orden/nombre", mostrado: mostrados[i].name, usado: usados[i].name }); }
      if (Number(mostrados[i].chance) !== Number(usados[i].chance)) {
        desalineadas++; problemas.push({ slug: c.slug, i, motivo: "chance distinta", mostrada: mostrados[i].chance, usada: usados[i].chance });
      }
      if (Number(mostrados[i].valueSc) !== Number(usados[i].valueSc)) {
        problemas.push({ slug: c.slug, i, motivo: "valor distinto (redondeo sc())", mostrado: mostrados[i].valueSc, usado: usados[i].valueSc });
      }
    }
  }

  console.log("cajas comparadas:", cajas.length);
  console.log("chances mostradas != chances del sorteo:", desalineadas);
  console.log("orden/nombre distinto:", ordenDistinto);
  console.log("otros:", problemas.filter((p) => p.motivo.startsWith("valor")).length);
  if (problemas.length) console.log(JSON.stringify(problemas.slice(0, 20), null, 2));

  /* Y el numero que se le MUESTRA como retorno vs el RTP real de la tabla */
  let peor = null;
  const deltas = [];
  for (const c of cajas) {
    const evCrudo = (c.prizes || []).reduce((a, p) => a + Number(p.valueSc) * Number(p.chance), 0);
    const rtpReal = c.priceSc > 0 ? evCrudo / c.priceSc : 0;
    const mostrado = Math.round((c.retorno || 0) * 10000) / 100; // lo que devuelve retornoMostrado
    const delta = mostrado - rtpReal * 100;
    deltas.push({ slug: c.slug, mostrado, real: Number((rtpReal * 100).toFixed(4)), delta: Number(delta.toFixed(4)) });
    if (!peor || Math.abs(delta) > Math.abs(peor.delta)) peor = { slug: c.slug, mostrado, real: Number((rtpReal * 100).toFixed(4)), delta: Number(delta.toFixed(4)) };
  }
  deltas.sort((a, b) => b.delta - a.delta);
  console.log("\nretornoMostrado vs RTP real de la tabla:");
  console.log("  peor desvio:", JSON.stringify(peor));
  console.log("  top 5 sobreestimados:", JSON.stringify(deltas.slice(0, 5)));
  console.log("  top 5 subestimados:", JSON.stringify(deltas.slice(-5)));
  console.log("  cajas con |delta| > 0.05 pp:", deltas.filter((d) => Math.abs(d.delta) > 0.05).length, "/", deltas.length);

  /* Sanidad del sorteo: ninguna caja puede dejar numero sin premio */
  let sinCubrir = 0;
  for (const c of cajas) {
    const suma = (c.prizes || []).reduce((a, p) => a + Number(p.chance), 0);
    if (suma < 1 - 1e-9) sinCubrir++;
  }
  console.log("\ncajas cuyo acumulado NO llega a 1 (caerian en el fallback del ultimo premio):", sinCubrir);

  /* Simulacion directa del sorteo sobre cada caja: 20.000 numeros por caja de muestra */
  const muestra = cajas.slice(0, 5);
  for (const c of muestra) {
    const semilla = fair.semillaNueva();
    const cuenta = new Map();
    const N = 20000;
    for (let i = 0; i < N; i += 1) {
      const r = fair.sortear({ semillaServidor: semilla, semillaCliente: "auditoria", nonce: i, premios: c.prizes });
      cuenta.set(r.premio.name, (cuenta.get(r.premio.name) || 0) + 1);
    }
    const filas = (c.prizes || []).map((p) => {
      const obs = (cuenta.get(p.name) || 0) / N;
      const esp = Number(p.chance);
      const z = esp > 0 ? (obs - esp) / Math.sqrt(esp * (1 - esp) / N) : 0;
      return { premio: p.name, esperada: esp, observada: Number(obs.toFixed(5)), z: Number(z.toFixed(2)) };
    });
    const zMax = Math.max.apply(null, filas.map((f) => Math.abs(f.z)));
    console.log("\n" + c.slug, "| N=" + N, "| |z| maximo =", zMax.toFixed(2));
    if (zMax > 4) console.log(JSON.stringify(filas, null, 2));
  }

  await m.disconnect();
})().catch((e) => { console.error("ERR", e); process.exit(1); });
