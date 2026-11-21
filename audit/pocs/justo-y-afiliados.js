/*
  EL SORTEO VERIFICABLE, Y LO QUE COBRA UN SOCIO.

  Dos cosas que un jugador y un socio tienen que poder auditar solos, y
  que por eso se prueban rehaciendo la cuenta por afuera del producto:
  con `crypto` pelado, sin llamar al modulo que hace el sorteo. Si se
  probara `fair.js` contra `fair.js`, un error en la formula pasaria las
  dos veces y el test no diria nada.

  LO QUE SE PRUEBA DEL SORTEO

    1. El compromiso. Antes de jugar hay un hash y nada mas. La semilla
       del servidor no sale de la base ni por descuido.
    2. Mientras la tanda esta en uso NO se revela. Eso no es una falla:
       si se revelara antes, el jugador calcularia que le va a salir y
       abriria solo cuando conviene.
    3. Al rotar se revela, y el hash que se publico al principio es el
       de esa semilla. Es lo unico que ata a la casa.
    4. Con la semilla destapada, cada apertura se rehace y da el mismo
       premio. Se rehace aca, a mano.
    5. El contador no se repite ni salta. Dos aperturas con el mismo
       nonce serian dos resultados con la misma prueba.
    6. Y la prueba no es de adorno: con una semilla equivocada el
       resultado tiene que NO coincidir.

  LO QUE SE PRUEBA DEL SOCIO

    7. Revshare paga un porcentaje del margen REAL acumulado.
    8. Un premio gordo deja el acumulado en rojo y ahi no cobra, pero
       tampoco se le perdona: la proxima arranca desde el rojo.
    9. CPA no cobra por jugada.
   10. Y queda anotado si la comision se genera con plata que la casa
       REGALO, que es lo que hay que decidir antes de abrir.

  SOLO CONTRA LOCALHOST Y mrbox_local. No toca nada de produccion.

  Uso:  node audit/pocs/justo-y-afiliados.js
*/
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const RAIZ = path.join(__dirname, "..", "..", "backend");

function leerEnv(clave) {
  for (const linea of fs.readFileSync(path.join(RAIZ, ".env"), "utf8").split(/\r?\n/)) {
    const i = linea.indexOf("=");
    if (i > 0 && linea.slice(0, i).trim() === clave) {
      return linea.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  return "";
}

let fallas = 0;
function bien(ok, texto) {
  if (!ok) fallas += 1;
  console.log(`  ${ok ? "OK  " : "MAL "} ${texto}`);
  return ok;
}

process.env.DATABASE_URI = leerEnv("DATABASE_URI");
process.env.JWT_SECRET = leerEnv("JWT_SECRET");
process.env.LOG_LEVEL = "error";

const CERCA = (a, b, tol = 0.02) => Math.abs(a - b) <= tol;

/* ── EL SORTEO, REHECHO A MANO ─────────────────────────────────────── */

/*
  Esto es a proposito una segunda implementacion. Es la cuenta que
  cualquiera puede hacer leyendo la pagina publica, y es la que tiene
  que dar lo mismo que el producto.
*/
function sortearAMano(semillaServidor, semillaCliente, nonce, premios) {
  const hmac = crypto.createHmac("sha256", String(semillaServidor))
    .update(`${semillaCliente}:${nonce}`).digest("hex");
  const numero = parseInt(hmac.slice(0, 13), 16) / Math.pow(2, 52);

  let acumulado = 0;
  for (let i = 0; i < premios.length; i += 1) {
    acumulado += Number(premios[i].chance) || 0;
    if (numero < acumulado) return { hmac, numero, premio: premios[i], indice: i };
  }
  return { hmac, numero, premio: premios[premios.length - 1], indice: premios.length - 1 };
}

(async () => {
  if (!/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URI)
      || !/mrbox_local/.test(process.env.DATABASE_URI)) {
    console.error("Solo contra mrbox_local en 127.0.0.1. Abortado.");
    process.exit(1);
  }

  const mongoose = require(path.join(RAIZ, "node_modules", "mongoose"));
  await mongoose.connect(process.env.DATABASE_URI);

  const User = require(path.join(RAIZ, "database/models/User"));
  const Box = require(path.join(RAIZ, "database/models/Box"));
  const BoxOpen = require(path.join(RAIZ, "database/models/BoxOpen"));
  const UserSeed = require(path.join(RAIZ, "database/models/UserSeed"));
  const AffiliateCode = require(path.join(RAIZ, "database/models/AffiliateCode"));
  const BalanceTransaction = require(path.join(RAIZ, "database/models/BalanceTransaction"));
  const InventoryItem = require(path.join(RAIZ, "database/models/InventoryItem"));
  const cajas = require(path.join(RAIZ, "services/boxes"));
  const fair = require(path.join(RAIZ, "services/boxes/fair"));
  const afiliados = require(path.join(RAIZ, "services/affiliates"));
  const wallet = require(path.join(RAIZ, "services/wallet"));

  const marca = `poc${String(Date.now()).slice(-8)}`;
  const creados = { users: [], codigos: [] };

  async function jugadorNuevo(nombre, saldoSc, codigo, comprando = false) {
    const u = await User.create({
      username: `${marca}_${nombre}`,
      email: `${marca}_${nombre}@mrbox.local`,
      passwordHash: "x".repeat(60),
      verificationLevel: 2,
      freeOpens: 0,
      ...(codigo ? { affiliateCode: codigo } : {}),
    });
    creados.users.push(u._id);
    if (saldoSc > 0) {
      /*
        `manual` y no `purchase` a proposito: es saldo REGALADO. Para
        que cuente como comprado hay que pedirlo con `comprando`.
      */
      await wallet.mover({
        userId: u._id, amountSc: saldoSc, type: comprando ? "purchase" : "manual",
        reference: { kind: "poc", label: "saldo de prueba" },
      });
    }
    return User.findById(u._id).select("+balanceSc");
  }

  try {
    /* ══ 1. EL COMPROMISO ═══════════════════════════════════════════ */
    console.log("\n1. EL COMPROMISO ANTES DE JUGAR\n");

    const caja = await Box.findOne({ live: true, creator: null }).lean();
    if (!caja) throw new Error("no hay ninguna caja al aire para probar");
    console.log(`      (caja: ${caja.name}, ${caja.priceSc} SC, ${caja.prizes.length} premios)\n`);

    const jugador = await jugadorNuevo("jugador", 5000);

    const tanda = await cajas.semillaDe(jugador._id);
    bien(!!tanda.semillaServidorHash, "antes de abrir ya hay un hash publicado");
    bien(tanda.nonce === 0, "el contador arranca en cero");
    bien(fair.hashDeSemilla(tanda.semillaServidor) === tanda.semillaServidorHash,
      "el hash publicado es el de la semilla guardada");

    const tapada = await UserSeed.findById(tanda._id).lean();
    bien(tapada.semillaServidor === undefined,
      "la semilla del servidor NO sale de la base en una consulta normal");
    bien(tapada.reveladaEn === null, "y figura como todavia tapada");

    const hashOriginal = tanda.semillaServidorHash;
    const semillaReal = tanda.semillaServidor;

    /* ══ 2. SE ABRE DE VERDAD ═══════════════════════════════════════ */
    console.log("\n2. SE ABREN CINCO CAJAS POR EL CAMINO REAL\n");

    const VECES = 5;
    for (let i = 0; i < VECES; i += 1) {
      const fresco = await User.findById(jugador._id).select("+balanceSc");
      await cajas.abrir({ user: fresco, slug: caja.slug, veces: 1 });
    }

    const recibos = await BoxOpen.find({ user: jugador._id }).sort("nonce").lean();
    bien(recibos.length === VECES, `quedaron ${recibos.length} recibos, uno por apertura`);

    const nonces = recibos.map((r) => r.nonce);
    bien(new Set(nonces).size === nonces.length, "ningun nonce repetido");
    const seguidos = nonces.every((n, i) => i === 0 || n === nonces[i - 1] + 1);
    bien(seguidos, `los nonces van seguidos y sin saltos: ${nonces.join(", ")}`);

    const tandaAhora = await UserSeed.findById(tanda._id).lean();
    bien(tandaAhora.nonce === VECES, "el contador de la tanda quedo en cinco");
    bien(recibos.every((r) => r.semillaServidorHash === hashOriginal),
      "todos los recibos apuntan al hash que se publico antes de jugar");

    /* ══ 3. MIENTRAS ESTA EN USO, NO SE REVELA ══════════════════════ */
    console.log("\n3. MIENTRAS LA TANDA ESTA EN USO\n");

    const antes = await cajas.verificar({ user: jugador, boxOpenId: recibos[0]._id });
    bien(antes.verificable === false, "no se puede verificar todavia");
    bien(antes.motivo === "LA_SEMILLA_SIGUE_TAPADA", "y dice por que");
    bien(antes.semillaServidor === undefined,
      "la respuesta NO trae la semilla (si la trajera, se podria predecir)");
    bien(!!antes.hmac && !!antes.premios,
      "pero si trae el hmac y la tabla de premios, para que los guarde");

    /* ══ 4. ROTA, Y AHI SE DESTAPA ══════════════════════════════════ */
    console.log("\n4. ROTA LA SEMILLA\n");

    const MIA = "la-semilla-que-elijo-yo";
    const rot = await cajas.rotarSemilla({ user: jugador, semillaCliente: MIA });
    bien(!!rot.revelada, "al rotar revela la semilla vieja");
    bien(rot.nueva.semillaCliente === MIA,
      "la semilla nueva del cliente es la que eligio el jugador");
    bien(rot.nueva.nonce === 0, "y el contador vuelve a cero");
    bien(rot.nueva.semillaServidorHash !== hashOriginal, "con un hash nuevo, distinto del viejo");

    const vieja = await UserSeed.findById(tanda._id).select("+semillaServidor").lean();
    bien(vieja.activa === false, "la tanda vieja quedo apagada");
    bien(!!vieja.reveladaEn, "y marcada como revelada");
    bien(vieja.semillaServidor === semillaReal, "la revelada es la misma que se uso");
    bien(crypto.createHash("sha256").update(vieja.semillaServidor).digest("hex") === hashOriginal,
      "EL HASH PUBLICADO ANTES DE JUGAR ES EL DE LA SEMILLA REVELADA");

    /* ══ 5. SE REHACE CADA SORTEO, A MANO ═══════════════════════════ */
    console.log("\n5. SE REHACE CADA APERTURA POR AFUERA DEL PRODUCTO\n");

    let todas = true;
    for (const r of recibos) {
      const mio = sortearAMano(vieja.semillaServidor, r.semillaCliente, r.nonce, r.premios);
      const coincide = mio.premio.name === r.premio.name
        && mio.hmac === r.hmac
        && CERCA(mio.numero, r.numero, 1e-12)
        && mio.indice === r.indicePremio;
      if (!coincide) todas = false;
      const igual = coincide ? "=" : "!=";
      console.log(`      nonce ${r.nonce}: "${r.premio.name}" ${igual} "${mio.premio.name}"`);
    }
    bien(todas, "las cinco aperturas dan el mismo premio rehechas a mano");

    const despues = await cajas.verificar({ user: jugador, boxOpenId: recibos[0]._id });
    bien(despues.verificable === true, "y el endpoint ahora si las verifica");
    bien(despues.coincide === true, "y dice que coincide");
    bien(despues.semillaServidor === vieja.semillaServidor,
      "y entrega la semilla, que es el numero que el jugador necesita");

    /* ══ 6. QUE LA PRUEBA PUEDA FALLAR ══════════════════════════════ */
    console.log("\n6. LA PRUEBA TIENE QUE PODER FALLAR\n");

    const r0 = recibos[0];
    const falsa = crypto.randomBytes(32).toString("hex");
    bien(sortearAMano(falsa, r0.semillaCliente, r0.nonce, r0.premios).hmac !== r0.hmac,
      "con otra semilla del servidor el hmac cambia");
    bien(sortearAMano(vieja.semillaServidor, r0.semillaCliente, r0.nonce + 1000, r0.premios).hmac !== r0.hmac,
      "con otro nonce tambien");
    bien(sortearAMano(vieja.semillaServidor, "otra-cosa", r0.nonce, r0.premios).hmac !== r0.hmac,
      "y con otra semilla del cliente tambien");

    const suma = r0.premios.reduce((t, p) => t + (Number(p.chance) || 0), 0);
    bien(CERCA(suma, 1, 0.0001), `las chances de la caja suman 1 (${suma.toFixed(6)})`);

    /* ══ 7. REVSHARE ════════════════════════════════════════════════ */
    console.log("\n7. REVSHARE: UN PORCENTAJE DEL MARGEN REAL\n");

    const socio = await jugadorNuevo("socio", 0);
    await User.updateOne({ _id: socio._id }, { $set: { rangoAfiliado: 1 } });

    const codigo = await AffiliateCode.create({
      owner: socio._id, code: `${marca}RS`.toUpperCase().slice(0, 20),
      modelo: "revshare", activa: true,
    });
    creados.codigos.push(codigo._id);

    /* Este COMPRO sus SC: su margen si se comisiona. */
    const traido = await jugadorNuevo("traido", 3000, codigo.code, true);

    let margenReal = 0;
    let abiertas = 0;
    for (let i = 0; i < 14; i += 1) {
      const fresco = await User.findById(traido._id).select("+balanceSc");
      if ((fresco.balanceSc || 0) < caja.priceSc) break;
      await cajas.abrir({ user: fresco, slug: caja.slug, veces: 1 });
      abiertas += 1;
      const ultimo = await BoxOpen.findOne({ user: traido._id }).sort("-nonce").lean();
      margenReal += ultimo.priceSc - ultimo.premio.valueSc;
    }

    const cod = await AffiliateCode.findById(codigo._id).lean();
    const pozo = cod.margenPendienteSc || 0;
    const repartido = margenReal - pozo;
    const pct = (cod.ganadoSc || 0) / (repartido || 1) * 100;

    console.log(`      aperturas                    : ${abiertas}`);
    console.log(`      margen real de sus aperturas : ${margenReal.toFixed(2)}`);
    console.log(`      quedo en el pozo sin repartir: ${pozo.toFixed(2)}`);
    console.log(`      se repartio                  : ${repartido.toFixed(2)}`);
    console.log(`      le anotaron                  : ${(cod.ganadoSc || 0).toFixed(2)}`);
    console.log(`      o sea el                     : ${pct.toFixed(1)}% de lo repartido`);

    bien(repartido >= -0.01, "nunca se reparte un margen negativo");
    bien((cod.ganadoSc || 0) >= 0, "lo anotado nunca es negativo");
    bien((cod.ganadoSc || 0) <= repartido + 0.02,
      "lo anotado no pasa del margen que de verdad hubo");
    bien(CERCA(cod.jugadoPorLosSuyosSc || 0,
      (await BoxOpen.find({ user: traido._id }).lean()).reduce((t, r) => t + r.priceSc, 0), 0.05),
      "lo jugado por los suyos es lo que de verdad jugaron");

    /* ══ 8. EL POZO EN ROJO ═════════════════════════════════════════ */
    console.log("\n8. UN PREMIO GORDO DEJA EL POZO EN ROJO\n");

    const antesDelGolpe = (await AffiliateCode.findById(codigo._id).lean()).ganadoSc || 0;
    await afiliados.anotarComision({ jugador: traido, jugadoSc: 10, margenSc: -5000 });
    const enRojo = await AffiliateCode.findById(codigo._id).lean();
    bien((enRojo.margenPendienteSc || 0) < 0,
      `el pozo quedo en rojo (${(enRojo.margenPendienteSc || 0).toFixed(2)})`);
    bien(CERCA(enRojo.ganadoSc || 0, antesDelGolpe, 0.001), "y no le cobro nada por esa jugada");

    await afiliados.anotarComision({ jugador: traido, jugadoSc: 10, margenSc: 100 });
    const todavia = await AffiliateCode.findById(codigo._id).lean();
    bien(CERCA(todavia.ganadoSc || 0, antesDelGolpe, 0.001),
      "una ganancia chica despues del golpe tampoco le paga: primero se tapa el rojo");

    /* ══ 9. CPA ═════════════════════════════════════════════════════ */
    console.log("\n9. CPA\n");

    const socioCpa = await jugadorNuevo("sociocpa", 0);
    await User.updateOne({ _id: socioCpa._id }, { $set: { rangoAfiliado: 1 } });
    const codCpa = await AffiliateCode.create({
      owner: socioCpa._id, code: `${marca}CPA`.toUpperCase().slice(0, 20),
      modelo: "cpa", activa: true,
    });
    creados.codigos.push(codCpa._id);
    const traidoCpa = await jugadorNuevo("traidocpa", 500, codCpa.code);

    await afiliados.anotarComision({ jugador: traidoCpa, jugadoSc: 1000, margenSc: 500 });
    const cpa = await AffiliateCode.findById(codCpa._id).lean();
    bien((cpa.margenPendienteSc || 0) === 0, "cpa no acumula pozo de margen");
    bien(CERCA(cpa.jugadoPorLosSuyosSc || 0, 1000, 0.01), "pero si le cuenta lo jugado");

    /* ══ 10. SOLO SOBRE LO QUE COMPRO ══════════════════════════════ */
    console.log("\n10. LA COMISION SE PAGA SOLO SOBRE LO QUE EL JUGADOR COMPRO\n");

    /*
      Dos referidos del mismo socio, con la misma plata y las mismas
      aperturas. La unica diferencia es de donde salio el saldo: uno lo
      compro y al otro se lo regalo la casa.
    */
    const compras = await BalanceTransaction.aggregate([
      { $match: { user: traido._id, type: "purchase" } },
      { $group: { _id: null, t: { $sum: "$amountSc" } } },
    ]);
    const comprado = compras.length ? compras[0].t : 0;
    const codTrasCompra = await AffiliateCode.findById(codigo._id).lean();

    console.log(`      EL QUE COMPRO`);
    console.log(`        compro            : ${comprado.toFixed(2)} SC`);
    console.log(`        el socio tiene    : ${(codTrasCompra.ganadoSc || 0).toFixed(2)} SC`);
    bien(comprado > 0 && (codTrasCompra.ganadoSc || 0) > 0,
      "el que compro SI le genera comision a su socio");

    /* Y ahora el regalado, con su propio codigo para no mezclar. */
    const socio2 = await jugadorNuevo("socio2", 0);
    await User.updateOne({ _id: socio2._id }, { $set: { rangoAfiliado: 1 } });
    const cod2 = await AffiliateCode.create({
      owner: socio2._id, code: `${marca}RG`.toUpperCase().slice(0, 20),
      modelo: "revshare", activa: true,
    });
    creados.codigos.push(cod2._id);

    /* Mismo saldo, pero REGALADO: no pasa por `purchase`. */
    const regalado = await jugadorNuevo("regalado", 3000, cod2.code, false);

    let margenDelRegalado = 0;
    let aperturasDelRegalado = 0;
    for (let i = 0; i < 14; i += 1) {
      const fresco = await User.findById(regalado._id).select("+balanceSc");
      if ((fresco.balanceSc || 0) < caja.priceSc) break;
      await cajas.abrir({ user: fresco, slug: caja.slug, veces: 1 });
      aperturasDelRegalado += 1;
      const ultimo = await BoxOpen.findOne({ user: regalado._id }).sort("-nonce").lean();
      margenDelRegalado += ultimo.priceSc - ultimo.premio.valueSc;
    }

    const codRegalo = await AffiliateCode.findById(cod2._id).lean();
    const suyo = await User.findById(regalado._id).select("compradoSc margenDeAfiliadoSc").lean();

    console.log(`\n      EL QUE NO COMPRO NADA`);
    console.log(`        compro            : ${(suyo.compradoSc || 0).toFixed(2)} SC`);
    console.log(`        aperturas         : ${aperturasDelRegalado}`);
    console.log(`        margen que dejo   : ${margenDelRegalado.toFixed(2)} SC`);
    console.log(`        el socio tiene    : ${(codRegalo.ganadoSc || 0).toFixed(2)} SC`);

    bien((suyo.compradoSc || 0) === 0, "no compro nada");
    bien(margenDelRegalado > 0, "pero jugo y le dejo margen a la casa");
    bien((codRegalo.ganadoSc || 0) === 0,
      "Y SU SOCIO NO COBRA UN PESO: la comision sale de lo comprado, no de lo regalado");
    bien((codRegalo.margenPendienteSc || 0) === 0,
      "ese margen ni siquiera entra al pozo");
    bien((suyo.margenDeAfiliadoSc || 0) <= 0,
      "y el tope de la cuenta nunca sube de cero");

    /* ══ 11. UNA PERDIDA SI PASA ENTERA ════════════════════════════ */
    console.log("\n11. PERO UNA PERDIDA DE LA CASA SI CUENTA, AUNQUE NO HAYA COMPRADO\n");

    /*
      El tope es un maximo, no un filtro en los dos sentidos. Si fuera
      simetrico, un referido que nunca compro podria ganarle SC 5.000 a
      la casa y el socio seguiria cobrando de sus otros referidos como
      si nada.
    */
    await afiliados.anotarComision({ jugador: regalado, jugadoSc: 10, margenSc: -5000 });
    const trasLaPerdida = await AffiliateCode.findById(cod2._id).lean();
    bien((trasLaPerdida.margenPendienteSc || 0) < 0,
      `la perdida deja el pozo en rojo igual (${(trasLaPerdida.margenPendienteSc || 0).toFixed(2)})`);

    /* Y despues de eso, lo que gane vuelve a tapar ese rojo. */
    await afiliados.anotarComision({ jugador: regalado, jugadoSc: 10, margenSc: 100 });
    const despuesDeTapar = await AffiliateCode.findById(cod2._id).lean();
    bien(CERCA(despuesDeTapar.margenPendienteSc || 0, (trasLaPerdida.margenPendienteSc || 0) + 100, 0.02),
      "y una ganancia posterior tapa ese rojo en vez de perderse");
    bien((despuesDeTapar.ganadoSc || 0) === 0,
      "sin pagarle nada al socio mientras siga en rojo");

  } finally {
    /* No se deja basura: esto corre contra la base de desarrollo. */
    await BoxOpen.deleteMany({ user: { $in: creados.users } });
    await UserSeed.deleteMany({ user: { $in: creados.users } });
    await BalanceTransaction.deleteMany({ user: { $in: creados.users } });
    await InventoryItem.deleteMany({ user: { $in: creados.users } });
    await AffiliateCode.deleteMany({ _id: { $in: creados.codigos } });
    await User.deleteMany({ _id: { $in: creados.users } });
    console.log(`\n(limpio: ${creados.users.length} cuentas y ${creados.codigos.length} codigos de prueba)`);
    await mongoose.disconnect();
  }

  console.log(fallas ? `\n${fallas} FALLAS\n` : "\nTODO BIEN\n");
  process.exit(fallas ? 1 : 0);
})().catch((err) => {
  console.error("\nse rompio:", err.message);
  console.error(err.stack);
  process.exit(1);
});
