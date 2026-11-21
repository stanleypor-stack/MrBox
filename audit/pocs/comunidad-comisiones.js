/*
  LO QUE COBRA EL QUE ARMA UNA CAJA, Y LO QUE VE EN SU PANEL.

  Dos cosas distintas que tienen que dar el mismo numero:

    1. EL PAGO. Se abre una caja de comunidad muchas veces --por el
       camino real, `cajas.abrir`-- y se mira que al creador le entre
       la mitad del margen, ni mas ni menos. El margen es lo que entro
       menos lo que salio en premio, ACUMULADO: una apertura que paga
       un premio gordo deja el acumulado en rojo y ahi el creador no
       cobra, pero tampoco se le perdona a la casa.

    2. EL PANEL. Las tres pantallas que mira el creador --sus cajas,
       el grafico de 30 dias y la lista de pagos-- salen de tres
       consultas distintas sobre la misma base. Si una suma de una
       manera y otra de otra, el creador ve que le falta plata.

  Y dos cosas que NO tienen que pasar:

    - que cobre por abrir su propia caja (seria devolverse el 96%)
    - que el acumulado en rojo le pague igual

  SOLO CONTRA LOCALHOST Y mrbox_local.

  Uso:  node audit/pocs/comunidad-comisiones.js
*/
const path = require("path");
const fs = require("fs");

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

/* Dos centavos de aire: todo pasa por `sc()`, que redondea a dos. */
const CERCA = (a, b, tol = 0.02) => Math.abs(a - b) <= tol;

(async () => {
  if (!/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URI)
      || !/mrbox_local/.test(process.env.DATABASE_URI)) {
    console.error("Solo contra mrbox_local en 127.0.0.1. Abortado.");
    process.exit(1);
  }

  const mongoose = require(path.join(RAIZ, "node_modules", "mongoose"));
  const jwt = require(path.join(RAIZ, "node_modules", "jsonwebtoken"));
  const { app } = require(path.join(RAIZ, "index"));
  const { conectar } = require(path.join(RAIZ, "database"));

  const User = require(path.join(RAIZ, "database", "models", "User"));
  const Box = require(path.join(RAIZ, "database", "models", "Box"));
  const BoxOpen = require(path.join(RAIZ, "database", "models", "BoxOpen"));
  const BalanceTransaction = require(path.join(RAIZ, "database", "models", "BalanceTransaction"));
  const Settings = require(path.join(RAIZ, "database", "models", "Settings"));

  const cajas = require(path.join(RAIZ, "services", "boxes"));
  const comunidad = require(path.join(RAIZ, "services", "community"));
  const { sc } = require(path.join(RAIZ, "utils", "money"));

  await conectar();
  const servidor = app.listen(0);
  await new Promise((r) => servidor.once("listening", r));
  const base = `http://127.0.0.1:${servidor.address().port}/api`;

  const creador = await User.findOne({ username: "funkmaster" });
  const mias = await Box.find({ creator: creador._id, live: true }).lean();

  console.log(`\nCreador: ${creador.username} | cajas al aire: ${mias.length}`);
  bien(mias.length === 3, "tiene las tres cajas al aire");
  if (!mias.length) { process.exit(1); }

  const cfg = await Settings.leer();
  const parte = Number(cfg.parteDelCreador);
  console.log(`Parte del creador: ${(parte * 100).toFixed(0)}% del margen\n`);

  /* -- 1. Un jugador cualquiera abre, y el creador cobra ----------- */
  console.log("1. EL PAGO, APERTURA POR APERTURA");

  const marca = Date.now().toString(36).slice(-6);
  const jugador = await User.create({
    username: `com_${marca}`,
    email: `com_${marca}@audit.local`,
    passwordHash: "x",
    balanceSc: 500000,
    verificationLevel: 3,
  });

  const caja = mias.find((c) => c.name === "PACK RIPPER") || mias[0];

  /* Se parte de cero para que las cuentas sean de ESTA corrida. */
  await Box.updateOne({ _id: caja._id }, { $set: { margenPendienteSc: 0 } });
  const ganadoAntes = sc((await Box.findById(caja._id).lean()).ganadoPorElCreadorSc || 0);

  /*
    EL SALDO HAY QUE PEDIRLO.

    `balanceSc` esta marcado `select: false` en el modelo, asi que una
    consulta comun lo devuelve `undefined` y no cero. Sin el `+` de
    abajo, esta prueba decia que al creador no le habia entrado nada
    --y le habia entrado-- que es justo el error que se supone que
    tiene que cazar.
  */
  const saldoDe = async () =>
    sc((await User.findById(creador._id).select("+balanceSc").lean()).balanceSc || 0);
  const saldoAntes = await saldoDe();

  const desdeLaCorrida = new Date();

  const VUELTAS = 400;
  let entrado = 0;
  let pagado = 0;

  for (let i = 0; i < VUELTAS; i += 1) {
    const r = await cajas.abrir({ user: jugador, slug: caja.slug, veces: 1 });
    entrado = sc(entrado + caja.priceSc);
    pagado = sc(pagado + r.resultados[0].premio.valueSc);
  }

  const margenTotal = sc(entrado - pagado);
  const cajaDespues = await Box.findById(caja._id).lean();
  const ganado = sc(sc(cajaDespues.ganadoPorElCreadorSc || 0) - ganadoAntes);
  const pendiente = sc(cajaDespues.margenPendienteSc || 0);

  console.log(`   ${VUELTAS} aperturas de ${caja.name} a SC ${caja.priceSc}`);
  console.log(`   entro SC ${entrado.toFixed(2)} | salio en premios SC ${pagado.toFixed(2)} | margen SC ${margenTotal.toFixed(2)}`);
  console.log(`   cobro el creador SC ${ganado.toFixed(2)} | quedo pendiente SC ${pendiente.toFixed(2)}`);

  /*
    LA IDENTIDAD QUE TIENE QUE CERRAR.

    Todo el margen que entro se fue a uno de dos lados: a la parte del
    creador, o quedo esperando en el acumulado. Y lo que cobro es
    exactamente su parte de lo que SI se repartio.
  */
  const repartido = sc(margenTotal - pendiente);

  /*
    LA TOLERANCIA SALE DE CUANTOS PAGOS HUBO, NO DE UN NUMERO LINDO.

    Cada pago se redondea a dos decimales, asi que cada uno puede
    quedar hasta medio centavo lejos. Con trescientos pagos la deriva
    puede llegar a un peso y medio sin que nada este mal. Poner "0,05"
    porque queda prolijo seria una prueba que falla sola en cuanto se
    abren mas cajas.
  */
  const cuantosPagos = await BalanceTransaction.countDocuments({
    user: creador._id, type: "creator_share",
    "reference.id": caja._id, createdAt: { $gte: desdeLaCorrida },
  });
  const deriva = Math.max(0.02, 0.005 * cuantosPagos);
  const esperado = sc(repartido * parte);

  bien(CERCA(ganado, esperado, deriva),
    `cobro su parte de lo repartido: SC ${ganado.toFixed(2)} vs SC ${esperado.toFixed(2)} `
    + `(${cuantosPagos} pagos, deriva de redondeo hasta SC ${deriva.toFixed(2)})`);
  bien(ganado >= 0, "nunca cobra negativo");

  /* -- 2. El libro dice lo mismo que el contador de la caja -------- */
  console.log("\n2. EL LIBRO CONTRA EL CONTADOR");

  const libro = await BalanceTransaction.aggregate([
    { $match: { user: creador._id, type: "creator_share", "reference.id": caja._id } },
    { $group: { _id: null, total: { $sum: "$amountSc" }, n: { $sum: 1 } } },
  ]);
  const enElLibro = sc((libro[0] && libro[0].total) || 0);
  const contador = sc(cajaDespues.ganadoPorElCreadorSc || 0);

  bien(CERCA(enElLibro, contador),
    `el libro (SC ${enElLibro.toFixed(2)}) y el contador de la caja (SC ${contador.toFixed(2)}) coinciden`);

  const saldoDespues = await saldoDe();
  bien(CERCA(sc(saldoDespues - saldoAntes), ganado, 0.05),
    `le entro al saldo: SC ${sc(saldoDespues - saldoAntes).toFixed(2)} (cobro SC ${ganado.toFixed(2)})`);

  /* -- 3. Abrir la propia no paga ---------------------------------- */
  console.log("\n3. ABRIR LA PROPIA NO PAGA");

  await User.updateOne({ _id: creador._id }, { $set: { balanceSc: 500000 } });
  const antesPropia = await Box.findById(caja._id).lean();

  for (let i = 0; i < 25; i += 1) {
    await cajas.abrir({ user: await User.findById(creador._id), slug: caja.slug, veces: 1 });
  }

  const trasPropia = await Box.findById(caja._id).lean();
  bien(CERCA(sc(trasPropia.ganadoPorElCreadorSc || 0), sc(antesPropia.ganadoPorElCreadorSc || 0)),
    "25 aperturas propias no le sumaron un peso");
  bien(CERCA(sc(trasPropia.margenPendienteSc || 0), sc(antesPropia.margenPendienteSc || 0)),
    "y tampoco movieron el acumulado");

  /* -- 4. El acumulado en rojo no paga ----------------------------- */
  console.log("\n4. EL ACUMULADO EN ROJO");

  await Box.updateOne({ _id: caja._id }, { $set: { margenPendienteSc: 0 } });
  const antesRojo = sc((await Box.findById(caja._id).lean()).ganadoPorElCreadorSc || 0);

  await comunidad.pagarAlCreador({ caja, margenSc: -5000 });
  const enRojo = await Box.findById(caja._id).lean();
  bien(CERCA(sc(enRojo.ganadoPorElCreadorSc || 0), antesRojo), "con el acumulado en rojo no cobro nada");
  bien(sc(enRojo.margenPendienteSc) === -5000, "y el rojo quedo anotado, no perdonado");

  await comunidad.pagarAlCreador({ caja, margenSc: 3000 });
  const aMedias = await Box.findById(caja._id).lean();
  bien(CERCA(sc(aMedias.ganadoPorElCreadorSc || 0), antesRojo),
    "3000 no alcanzan para tapar 5000: sigue sin cobrar");

  await comunidad.pagarAlCreador({ caja, margenSc: 4000 });
  const enVerde = await Box.findById(caja._id).lean();
  const cobroAlVolver = sc(sc(enVerde.ganadoPorElCreadorSc || 0) - antesRojo);
  bien(CERCA(cobroAlVolver, sc(2000 * parte)),
    `al volver al verde cobro sobre los 2000 netos: SC ${cobroAlVolver.toFixed(2)}`);

  /* -- 5. El panel: tres consultas, el mismo numero ----------------- */
  console.log("\n5. EL PANEL DEL CREADOR");

  const token = jwt.sign({ id: String(creador._id) }, process.env.JWT_SECRET, { expiresIn: "1h" });
  const pedir = async (ruta) => {
    const r = await fetch(`${base}${ruta}`, { headers: { "x-auth-token": token } });
    return { estado: r.status, cuerpo: await r.json() };
  };

  const mine = await pedir("/community/mine");
  bien(mine.estado === 200, "GET /community/mine responde");
  const panel = mine.cuerpo.data;
  bien(panel.cajas.length === 3, `lista las tres cajas (${panel.cajas.length})`);
  bien(panel.total.alAire === 3, `dice que hay tres al aire (${panel.total.alAire})`);
  bien(CERCA(panel.parte, parte), `la parte que muestra es la del ajuste (${panel.parte})`);

  const sumaDeCajas = sc(panel.cajas.reduce((a, c) => a + c.ganadoSc, 0));
  bien(CERCA(sumaDeCajas, panel.total.ganadoSc),
    `el total del panel es la suma de sus cajas: SC ${panel.total.ganadoSc.toFixed(2)}`);

  /*
    EL PANEL SUMA CONTADORES DE CAJA; EL LIBRO SUMA ASIENTOS.

    Son dos caminos distintos al mismo numero, y por eso vale
    compararlos. Pero el libro se compara CONTRA SUS CAJAS: un asiento
    que apunta a una caja que ya no existe no puede estar en un panel
    que lista cajas. En produccion eso no pasa --solo se borra de
    verdad una caja con cero aperturas, y una caja con cero aperturas
    no genero un peso-- pero una base de desarrollo junta restos de
    pruebas viejas, y la prueba no puede confundir eso con un error.
  */
  /*
    DE VUELTA A OBJECTID, A MANO.

    Los ids del panel llegan por JSON, o sea texto. `find` los castea
    solo contra el esquema, pero `aggregate` NO: un `$match` con texto
    contra un campo ObjectId no empareja con nada y entonces TODOS los
    asientos parecen huerfanos. Es el mismo error que hace que una
    consulta de panel devuelva cero y uno jure que falta la plata.
  */
  const idsDeSusCajas = panel.cajas.map((c) => new mongoose.Types.ObjectId(String(c._id)));
  const libroDeSusCajas = await BalanceTransaction.aggregate([
    { $match: { user: creador._id, type: "creator_share", "reference.id": { $in: idsDeSusCajas } } },
    { $group: { _id: null, total: { $sum: "$amountSc" } } },
  ]);
  bien(CERCA(sc((libroDeSusCajas[0] && libroDeSusCajas[0].total) || 0), panel.total.ganadoSc, 0.05),
    "y coincide, caja por caja, con lo que dice el libro");

  const sueltos = await BalanceTransaction.aggregate([
    { $match: { user: creador._id, type: "creator_share", "reference.id": { $nin: idsDeSusCajas } } },
    { $group: { _id: null, total: { $sum: "$amountSc" }, n: { $sum: 1 } } },
  ]);
  const colgado = sc((sueltos[0] && sueltos[0].total) || 0);
  if (colgado) {
    console.log(`       (hay ${sueltos[0].n} asientos por SC ${colgado.toFixed(2)} de cajas que ya no existen:`
      + " restos de pruebas viejas en esta base, no del sitio)");
  }

  const aperturasReales = await BoxOpen.countDocuments({
    box: { $in: panel.cajas.map((c) => c._id) }, demo: { $ne: true },
  });
  bien(panel.total.aperturas === aperturasReales,
    `las aperturas del panel son las del libro de aperturas: ${panel.total.aperturas} vs ${aperturasReales}`);

  /* -- 6. El grafico de 30 dias ------------------------------------ */
  console.log("\n6. EL GRAFICO");

  const graf = await pedir("/community/earnings?days=30");
  bien(graf.estado === 200, "GET /community/earnings responde");
  const g = graf.cuerpo.data;
  bien(g.serie.length === 30, `trae los treinta dias completos (${g.serie.length})`);

  const sumaSerie = sc(g.serie.reduce((a, d) => a + d.ganadoSc, 0));
  bien(CERCA(sumaSerie, g.ganadoSc), `el total del grafico es la suma de sus dias: SC ${g.ganadoSc.toFixed(2)}`);

  /*
    El grafico sale del LIBRO y el panel de los CONTADORES, asi que
    tienen que coincidir salvo por los asientos de cajas que ya no
    existen, que el panel no puede listar.
  */
  bien(CERCA(g.ganadoSc, sc(panel.total.ganadoSc + colgado), 0.05),
    `y lo mismo que el panel: SC ${g.ganadoSc.toFixed(2)} vs SC ${sc(panel.total.ganadoSc + colgado).toFixed(2)}`);

  const hoy = new Date().toISOString().slice(0, 10);
  bien(g.serie[g.serie.length - 1].dia === hoy,
    `el ultimo dia de la serie es hoy en UTC (${g.serie[g.serie.length - 1].dia})`);

  bien(g.aperturas > 0 && g.porAperturaSc > 0,
    `calcula el por-apertura: SC ${g.porAperturaSc} sobre ${g.aperturas} aperturas`);
  bien(CERCA(g.porAperturaSc, sc(g.ganadoSc / g.aperturas), 0.02),
    "y el por-apertura es la division de los dos de arriba");

  /* -- 7. La lista de pagos ---------------------------------------- */
  console.log("\n7. LOS PAGOS, UNO POR UNO");

  const pagos = await pedir("/community/payments?perPage=100");
  bien(pagos.estado === 200, "GET /community/payments responde");
  const p = pagos.cuerpo.data;
  bien(p.items.length > 0, `trae pagos (${p.items.length})`);
  bien(p.items.every((x) => x.caja), "cada pago dice de que caja salio");
  bien(p.items.every((x) => x.amountSc > 0), "y ninguno es cero o negativo");
  /*
    EL TOTAL ES DE TODOS LOS PAGOS, NO DE LOS QUE SE VEN.

    Aca habia un error: la lista trae veinticinco por omision y el
    total era la suma de esas veinticinco, pero la pantalla lo muestra
    como "pagados en total". Con trescientos pagos, el creador leia
    arriba SC 2.400 ganados y abajo SC 196 pagados.

    Asi que el total se compara contra EL LIBRO ENTERO, no contra lo
    que vino en la pagina. Si alguien vuelve a sumar la pagina, esto
    se pone rojo.
  */
  const libroEntero = await BalanceTransaction.aggregate([
    { $match: { user: creador._id, type: "creator_share" } },
    { $group: { _id: null, total: { $sum: "$amountSc" }, cuantos: { $sum: 1 } } },
  ]);
  const deVerdad = libroEntero[0] || { total: 0, cuantos: 0 };

  bien(CERCA(p.totalSc, sc(deVerdad.total), 0.05),
    `el total es el del libro entero, no el de la pagina: SC ${p.totalSc.toFixed(2)} vs SC ${sc(deVerdad.total).toFixed(2)}`);
  bien(p.cuantos === deVerdad.cuantos,
    `y dice cuantos pagos hay en total: ${p.cuantos}`);
  bien(p.items.length <= p.cuantos, `la lista trae ${p.items.length} de esos ${p.cuantos}`);

  const pocos = await pedir("/community/payments?perPage=5");
  bien(pocos.cuerpo.data.items.length === 5 && CERCA(pocos.cuerpo.data.totalSc, sc(deVerdad.total), 0.05),
    "y pidiendo 5 filas el total sigue siendo el de todos");

  const fechas = p.items.map((x) => new Date(x.createdAt).getTime());
  bien(fechas.every((t, i) => i === 0 || t <= fechas[i - 1]), "vienen del mas nuevo al mas viejo");

  /* -- 8. El panel es de cada uno ---------------------------------- */
  console.log("\n8. CADA UNO VE EL SUYO");

  const otro = jwt.sign({ id: String(jugador._id) }, process.env.JWT_SECRET, { expiresIn: "1h" });
  const ajeno = await fetch(`${base}/community/mine`, { headers: { "x-auth-token": otro } });
  const cuerpoAjeno = await ajeno.json();
  bien(ajeno.status === 200 && cuerpoAjeno.data.cajas.length === 0,
    "un jugador sin cajas ve su panel vacio, no el del creador");

  const sinSesion = await fetch(`${base}/community/mine`);
  bien(sinSesion.status === 401, `sin sesion no hay panel (${sinSesion.status})`);

  /* -- Limpieza ---------------------------------------------------- */
  await User.deleteOne({ _id: jugador._id });

  console.log(fallas ? `\n${fallas} MAL\n` : "\nTodo bien.\n");
  await mongoose.disconnect();
  servidor.close();
  process.exit(fallas ? 1 : 0);
})();
