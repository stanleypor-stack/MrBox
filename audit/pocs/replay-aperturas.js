/* Rehace TODAS las aperturas reales de la base local con el verificador. SOLO LECTURA. */
const m = require("C:/Users/Usuario/mrbox/backend/node_modules/mongoose");
const fair = require("C:/Users/Usuario/mrbox/backend/services/boxes/fair");

(async () => {
  await m.connect("mongodb://127.0.0.1:27017/mrbox_local", { serverSelectionTimeoutMS: 5000 });
  const db = m.connection.db;
  const opens = await db.collection("boxopens").find({}).sort({ createdAt: 1 }).toArray();
  const seeds = await db.collection("userseeds").find({}).toArray();
  const porHash = new Map(seeds.map(s => [s.semillaServidorHash, s]));

  let ok = 0, mal = 0, sinSemilla = 0, hashMal = 0, snapshotFalta = 0;
  const problemas = [];
  const nonceVistos = new Map(); // seedHash -> Set(nonce)
  const dupNonce = [];

  for (const o of opens) {
    const s = porHash.get(o.semillaServidorHash);
    const clave = o.semillaServidorHash;
    if (!nonceVistos.has(clave)) nonceVistos.set(clave, new Set());
    if (nonceVistos.get(clave).has(o.nonce)) dupNonce.push({ id: String(o._id), hash: clave.slice(0,12), nonce: o.nonce });
    nonceVistos.get(clave).add(o.nonce);

    if (!o.premios || !o.premios.length) { snapshotFalta++; continue; }
    if (!s) { sinSemilla++; problemas.push({ id: String(o._id), motivo: "no existe UserSeed con ese hash" }); continue; }

    // 1) el hash publicado corresponde a la semilla guardada
    if (fair.hashDeSemilla(s.semillaServidor) !== o.semillaServidorHash) {
      hashMal++; problemas.push({ id: String(o._id), motivo: "sha256(semilla) != hash publicado" }); continue;
    }

    // 2) rehacer el sorteo
    const r = fair.verificarApertura({
      semillaServidor: s.semillaServidor,
      semillaCliente: o.semillaCliente,
      nonce: o.nonce,
      premios: o.premios,
      premioEsperado: o.premio.name,
    });

    const hmacOk = r.hmac === o.hmac;
    const numOk = Math.abs(r.numero - o.numero) < 1e-12;
    const premioOk = r.premio.name === o.premio.name;
    const valorOk = Math.abs((r.premio.valueSc||0) - (o.premio.valueSc||0)) < 0.011;

    if (hmacOk && numOk && premioOk && valorOk) ok++;
    else { mal++; problemas.push({ id: String(o._id), slug: o.boxSlug, nonce: o.nonce, hmacOk, numOk, premioOk, valorOk,
      esperado: o.premio.name, calculado: r.premio.name, numeroGuardado: o.numero, numeroCalc: r.numero }); }
  }

  console.log("aperturas totales:", opens.length);
  console.log("  reproducidas EXACTAS:", ok);
  console.log("  NO coinciden:", mal);
  console.log("  sin UserSeed:", sinSemilla);
  console.log("  hash != sha256(semilla):", hashMal);
  console.log("  sin snapshot de premios:", snapshotFalta);
  console.log("  nonce repetido dentro de la misma tanda:", dupNonce.length, JSON.stringify(dupNonce));
  if (problemas.length) console.log("PROBLEMAS:", JSON.stringify(problemas, null, 2));

  // Chequeo extra: el premio guardado coincide con premios[indicePremio]
  let indiceMal = 0;
  for (const o of opens) {
    if (!o.premios || typeof o.indicePremio !== "number") continue;
    const p = o.premios[o.indicePremio];
    if (!p || p.name !== o.premio.name) { indiceMal++; console.log("indicePremio no apunta al premio:", String(o._id)); }
  }
  console.log("  indicePremio incoherente:", indiceMal);

  // Chequeo: snapshot guardado suma 1
  let snapMal = 0;
  for (const o of opens) {
    if (!o.premios || !o.premios.length) continue;
    const s = o.premios.reduce((a,p)=>a+(Number(p.chance)||0),0);
    if (Math.abs(s-1) > 1e-6) { snapMal++; console.log("snapshot no suma 1:", String(o._id), o.boxSlug, s); }
  }
  console.log("  snapshots que no suman 1:", snapMal);

  // Estado de las tandas
  console.log("\nUserSeeds:", seeds.length,
    "| activas:", seeds.filter(s=>s.activa).length,
    "| reveladas:", seeds.filter(s=>s.reveladaEn).length,
    "| inactivas SIN reveladaEn:", seeds.filter(s=>!s.activa && !s.reveladaEn).length);
  const porUser = {};
  for (const s of seeds) { const k = String(s.user); porUser[k] = (porUser[k]||0) + (s.activa?1:0); }
  const dosActivas = Object.entries(porUser).filter(([,n]) => n > 1);
  console.log("usuarios con MAS DE UNA tanda activa:", dosActivas.length, JSON.stringify(dosActivas));

  await m.disconnect();
})().catch(e => { console.error("ERR", e); process.exit(1); });
