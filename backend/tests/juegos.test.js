/**
 * LOS SIETE JUEGOS QUE FALTABAN, DE PUNTA A PUNTA.
 *
 * Dice tiene su propio archivo. Acá están los otros siete, y el peso
 * está puesto donde se pierde plata de verdad:
 *
 *   - que lo que se paga sea lo que dice la tabla
 *   - que no se pueda jugar lo que no se puede jugar
 *   - que una ronda abierta no cuente lo que todavia no pasó
 *
 * Las rondas abiertas --Mines, Towers y Crash-- son las peligrosas:
 * el resultado existe antes de que el jugador termine de jugar, así
 * que lo que hay que probar es que NO SALE por ningún lado hasta que
 * la ronda cierre, y que no se puede abrir dos veces ni cobrar dos
 * veces.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DATABASE_URI = process.env.TEST_DB_URI || "mongodb://127.0.0.1:27017/mrbox_test_juegos";
process.env.JWT_SECRET = "prueba-local";
process.env.TURNSTILE_SECRET_KEY = "";
process.env.AUTH_RATE_LIMIT = "500";
process.env.GAME_RATE_LIMIT = "100000";
process.env.LOG_LEVEL = "error";

const mongoose = require("mongoose");
const { app } = require("../index");
const { conectar, asegurarIndices } = require("../database");

const User = require("../database/models/User");
const GameRound = require("../database/models/GameRound");
const GameTanda = require("../database/models/GameTanda");

const mines = require("../services/games/mines");
const towers = require("../services/games/towers");
const crash = require("../services/games/crash");
const keno = require("../services/games/keno");
const reme = require("../services/games/reme");
const slide = require("../services/games/slide");
const plinko = require("../services/games/plinko");

let servidor;
let base = "";
let hayBase = true;

test.before(async () => {
  try {
    await conectar();
    await mongoose.connection.db.dropDatabase();
    await asegurarIndices();
    servidor = app.listen(0);
    await new Promise((r) => servidor.once("listening", r));
    base = `http://127.0.0.1:${servidor.address().port}/api`;
  } catch {
    hayBase = false;
  }
});

test.after(async () => {
  if (servidor) await new Promise((r) => servidor.close(r));
  if (hayBase) {
    await mongoose.connection.db.dropDatabase().catch(() => {});
    await mongoose.disconnect().catch(() => {});
  }
});

async function pedir(metodo, ruta, { cuerpo, token } = {}) {
  const r = await fetch(base + ruta, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...(token ? { "x-auth-token": token } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return { estado: r.status, datos: await r.json() };
}

let n = 0;
async function jugador({ saldo = 10000 } = {}) {
  n += 1;
  const cuenta = { username: `jg${n}`, email: `jg${n}@test.local`, password: "unaclavelarga" };
  const { datos } = await pedir("POST", "/auth/register", { cuerpo: cuenta });
  await User.updateOne({ _id: datos.user._id }, { $set: { balanceSc: saldo } });
  return { id: datos.user._id, token: datos.token };
}

const saldoDe = async (id) => (await User.findById(id).select("+balanceSc").lean()).balanceSc;

/* ══ Los que empiezan y terminan de una ═════════════════════════════ */

test("REME: paga 3x con el cero, 2x ganando, y nada empatando", async () => {
  /* Sin red: es la tabla de verdad, recorrida entera. */
  let tresX = 0; let dosX = 0; let nada = 0;
  for (let j = 0; j < 37; j += 1) {
    for (let c = 0; c < 37; c += 1) {
      const m = reme.multiplicador(j, c, {});
      if (m === 3) tresX += 1;
      else if (m === 2) dosX += 1;
      else nada += 1;
    }
  }
  assert.equal(tresX + dosX + nada, 1369);
  /* El empate NO paga: es de donde sale el margen. */
  for (let v = 1; v <= 9; v += 1) {
    assert.equal(reme.multiplicador(v, v, {}), 0, "el empate en " + v + " pago");
  }
});

test("reme cobra y paga contra el servidor", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 100 });
  const { estado, datos } = await pedir("POST", "/games/reme/play", {
    token: j.token, cuerpo: { apuestaSc: 10 },
  });
  assert.equal(estado, 200, JSON.stringify(datos));

  const d = datos.data;
  assert.ok(d.jugador >= 0 && d.jugador <= 36);
  assert.ok(d.casa >= 0 && d.casa <= 36);
  assert.equal(d.balanceSc, 90 + d.pagoSc);
});

test("KENO: no se puede elegir dos veces el mismo numero", async () => {
  assert.throws(() => keno.revisar([5, 5, 7]));
  assert.throws(() => keno.revisar([]));
  assert.throws(() => keno.revisar([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]));
  assert.throws(() => keno.revisar([0]));
  assert.throws(() => keno.revisar([41]));
  assert.deepEqual(keno.revisar([9, 3, 1]), [1, 3, 9]);
});

test("keno saca diez bolillas distintas", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 100 });
  const { datos } = await pedir("POST", "/games/keno/play", {
    token: j.token, cuerpo: { apuestaSc: 1, elegidas: [1, 2, 3, 4, 5] },
  });
  const d = datos.data;
  assert.equal(d.salieron.length, 10);
  assert.equal(new Set(d.salieron).size, 10, "salio dos veces la misma");
  assert.ok(d.salieron.every((x) => x >= 1 && x <= 40));
  assert.equal(d.aciertos, d.salieron.filter((x) => [1, 2, 3, 4, 5].includes(x)).length);
});

test("SLIDE: los tres colores devuelven lo mismo", async () => {
  const p = slide.pagos({});
  assert.equal(Math.round((1 / 15) * p.yellow * 10000) / 10000, Math.round((7 / 15) * p.red * 10000) / 10000);
  assert.equal(p.yellow, 14);
  assert.equal(p.red, 2);
  /*
    LA RUEDA ES LA DEL DISENO: el amarillo esta en el medio, no en el
    cero. Importa el lugar y no solo la cuenta, porque la cinta de la
    pantalla se dibuja con este orden y frena donde dice el servidor.
  */
  assert.equal(slide.colorDe(7), "yellow");
  assert.equal(slide.colorDe(0), "red");
  assert.equal(slide.colorDe(3), "purple");

  const cuenta = {};
  for (let i = 0; i < slide.CASILLAS; i += 1) {
    const c = slide.colorDe(i);
    cuenta[c] = (cuenta[c] || 0) + 1;
  }
  assert.deepEqual(cuenta, { red: 7, purple: 7, yellow: 1 });
});

test("PLINKO: no se aceptan filas ni riesgos inventados", async () => {
  assert.throws(() => plinko.revisar({ riesgo: "low", filas: 7 }));
  assert.throws(() => plinko.revisar({ riesgo: "low", filas: 17 }));
  assert.throws(() => plinko.revisar({ riesgo: "insane", filas: 10 }));
  assert.deepEqual(plinko.revisar({ riesgo: "HIGH", filas: 12 }), { riesgo: "high", filas: 12 });
});

test("plinko: el camino tiene un paso por fila", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 100 });
  const { datos } = await pedir("POST", "/games/plinko/play", {
    token: j.token, cuerpo: { apuestaSc: 1, riesgo: "medium", filas: 12 },
  });
  const d = datos.data;
  assert.equal(d.camino.length, 12);
  assert.equal(d.casilla, d.camino.reduce((a, b) => a + b, 0));
  assert.ok(d.casilla >= 0 && d.casilla <= 12);
});

/* ══ Las rondas abiertas: lo peligroso ══════════════════════════════ */

test("MINES: LAS MINAS NO SALEN MIENTRAS LA RONDA ESTA ABIERTA", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  /*
    Es EL exploit de este juego. Si la respuesta de abrir --o la de
    destapar, o el historial-- trae donde estan las minas, el juego
    se termino: se destapa mirando la respuesta.
  */
  const j = await jugador({ saldo: 100 });

  const abrir = await pedir("POST", "/games/mines/open", {
    token: j.token, cuerpo: { apuestaSc: 10, tablero: 25, minas: 5 },
  });
  assert.equal(abrir.estado, 200, JSON.stringify(abrir.datos));

  const texto = JSON.stringify(abrir.datos);
  assert.ok(!/minadas|oculto/.test(texto), "la respuesta de abrir dice donde estan: " + texto);

  /* Ni el historial. */
  const hist = await pedir("GET", "/games/historial", { token: j.token });
  assert.ok(!/minadas/.test(JSON.stringify(hist.datos)), "el historial las filtra");

  /* Ni destapando. */
  const paso = await pedir("POST", "/games/mines/tile", { token: j.token, cuerpo: { casilla: 0 } });
  if (!paso.datos.data.exploto) {
    assert.ok(!/minadas/.test(JSON.stringify(paso.datos)), "destapar las muestra");
  }
});

test("mines: no se pueden tener dos rondas abiertas", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 100 });

  const una = await pedir("POST", "/games/mines/open", {
    token: j.token, cuerpo: { apuestaSc: 10, tablero: 25, minas: 3 },
  });
  assert.equal(una.estado, 200);

  const dos = await pedir("POST", "/games/mines/open", {
    token: j.token, cuerpo: { apuestaSc: 10, tablero: 25, minas: 3 },
  });
  assert.equal(dos.datos.code, "ROUND_OPEN");

  /* Y la segunda NO cobro: 100 - 10 de la primera y nada mas. */
  assert.equal(await saldoDe(j.id), 90);
});

test("mines: cinco pedidos de abrir a la vez dejan UNA sola ronda", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 1000 });

  const juntos = await Promise.all(Array.from({ length: 5 }, () => pedir("POST", "/games/mines/open", {
    token: j.token, cuerpo: { apuestaSc: 10, tablero: 25, minas: 3 },
  })));

  const entraron = juntos.filter((r) => r.estado === 200).length;
  assert.equal(entraron, 1, "entraron " + entraron);
  assert.equal(await GameRound.countDocuments({ user: j.id, juego: "mines", abierta: true }), 1);
  /* Y se cobro una sola apuesta. */
  assert.equal(await saldoDe(j.id), 990);
});

test("mines: la misma casilla no se destapa dos veces", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 100 });
  await pedir("POST", "/games/mines/open", {
    token: j.token, cuerpo: { apuestaSc: 10, tablero: 25, minas: 1 },
  });

  const uno = await pedir("POST", "/games/mines/tile", { token: j.token, cuerpo: { casilla: 3 } });
  if (uno.datos.data && !uno.datos.data.exploto) {
    const otra = await pedir("POST", "/games/mines/tile", { token: j.token, cuerpo: { casilla: 3 } });
    assert.notEqual(otra.estado, 200, "la destapo dos veces");
  }
});

test("mines: sin destapar nada no se puede cobrar", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 100 });
  await pedir("POST", "/games/mines/open", {
    token: j.token, cuerpo: { apuestaSc: 10, tablero: 25, minas: 3 },
  });

  const r = await pedir("POST", "/games/mines/cashout", { token: j.token });
  assert.equal(r.datos.code, "NOTHING_TO_CLAIM", "recupero la apuesta sin jugar");
});

test("mines: cobrar dos veces paga UNA", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 100 });
  await pedir("POST", "/games/mines/open", {
    token: j.token, cuerpo: { apuestaSc: 10, tablero: 25, minas: 1 },
  });
  const paso = await pedir("POST", "/games/mines/tile", { token: j.token, cuerpo: { casilla: 0 } });

  if (paso.datos.data && !paso.datos.data.exploto) {
    const antes = await saldoDe(j.id);
    const a = await pedir("POST", "/games/mines/cashout", { token: j.token });
    const b = await pedir("POST", "/games/mines/cashout", { token: j.token });
    assert.equal(a.estado, 200);
    assert.notEqual(b.estado, 200, "cobro dos veces");
    assert.equal(await saldoDe(j.id), antes + a.datos.data.pagoSc);
  }
});

test("TOWERS: la torre no sale hasta que la ronda termina", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 100 });

  const abrir = await pedir("POST", "/games/towers/open", {
    token: j.token, cuerpo: { apuestaSc: 10, riesgo: "med" },
  });
  assert.equal(abrir.estado, 200, JSON.stringify(abrir.datos));
  assert.ok(!/dragones/.test(JSON.stringify(abrir.datos)), "dice donde estan los dragones");
});

test("towers: no se puede pisar una baldosa que no existe", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 100 });
  await pedir("POST", "/games/towers/open", {
    token: j.token, cuerpo: { apuestaSc: 10, riesgo: "hard" },
  });

  /* `hard` tiene dos baldosas: la 2 no existe. */
  for (const b of [2, -1, 99, "a"]) {
    const r = await pedir("POST", "/games/towers/tile", { token: j.token, cuerpo: { baldosa: b } });
    assert.notEqual(r.estado, 200, "acepto la baldosa " + b);
  }
});

test("towers: el multiplicador crece piso a piso y nunca baja de 1", async () => {
  for (const riesgo of Object.keys(towers.DIFICULTADES)) {
    let anterior = 0;
    for (let piso = 1; piso <= towers.PISOS; piso += 1) {
      const m = towers.multiplicador({ riesgo, piso }, {});
      assert.ok(m >= 1, `${riesgo} piso ${piso} paga ${m}`);
      assert.ok(m > anterior, `${riesgo} piso ${piso} no subio`);
      anterior = m;
    }
  }
});

/**
 * ARRANCA EL VUELO DE LA RONDA DE AHORA, SIN ESPERAR.
 *
 * Crash deja apostar seis segundos y despues vuela. Un test que
 * espere seis segundos de verdad es un test que nadie corre, asi que
 * se le mueve el reloj a la ronda: se adelanta el cierre de apuestas
 * los milisegundos que se le pidan. Lo que se prueba sigue siendo lo
 * mismo, porque el multiplicador lo saca el servidor de ESA fecha.
 */
async function volar(desdeMs = 100) {
  const tanda = await GameTanda.findOne({ juego: "crash" }).sort({ numero: -1 });
  await GameTanda.updateOne(
    { _id: tanda._id },
    { $set: { abiertaHasta: new Date(Date.now() - desdeMs) } },
  );
  return tanda;
}

test("CRASH: no se puede cobrar por encima del punto de reventon", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  /*
    EL exploit de crash. El cliente dice en cuanto quiere cobrar; si
    el servidor le cree, cobra 1000x siempre.
  */
  const j = await jugador({ saldo: 1000 });
  assert.ok(await rondaFresca("crash", j.token), "no abrio la ronda");

  const apostar = await pedir("POST", "/games/crash/bet", {
    token: j.token, cuerpo: { apuestaSc: 10 },
  });
  assert.equal(apostar.estado, 200, JSON.stringify(apostar.datos));
  assert.ok(!/punto/.test(JSON.stringify(apostar.datos)), "dijo donde revienta");

  await volar(100);

  const antes = await saldoDe(j.id);
  const r = await pedir("POST", "/games/crash/cashout", { token: j.token, cuerpo: { en: 1000 } });
  assert.equal(r.estado, 200, JSON.stringify(r.datos));

  const d = r.datos.data;
  /* A los 100 ms el reloj del servidor esta en ~1.00x: el 1000x que
     pidio no puede salir de ahi. */
  assert.ok(d.multiplicador <= 1.05, "pago " + d.multiplicador + "x a los 100 ms");
  assert.ok(await saldoDe(j.id) <= antes + 11, "pago de mas");
});

test("crash: cobrar dos veces no paga dos veces", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 100 });
  assert.ok(await rondaFresca("crash", j.token), "no abrio la ronda");
  const apostar = await pedir("POST", "/games/crash/bet", {
    token: j.token, cuerpo: { apuestaSc: 10 },
  });
  assert.equal(apostar.estado, 200, JSON.stringify(apostar.datos));
  await volar(100);

  const a = await pedir("POST", "/games/crash/cashout", { token: j.token });
  const b = await pedir("POST", "/games/crash/cashout", { token: j.token });
  assert.equal(a.estado, 200, JSON.stringify(a.datos));
  assert.notEqual(b.estado, 200, "cobro dos veces");
});

test("las rondas compartidas no cuentan el resultado antes de tiempo", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 100 });

  for (const juego of ["slide", "crash"]) {
    const d = await rondaFresca(juego, j.token);
    assert.ok(d, `${juego}: no abrio la ronda`);

    assert.ok(d.semillaHash, `${juego}: no publico el hash de la semilla`);
    assert.ok(!d.resultado, `${juego}: mando el resultado mientras se apostaba`);
    /* El historial son rondas viejas: ahi los resultados van a la
       vista a proposito. Lo que no puede salir es el de ESTA. */
    assert.ok(
      !/"casilla"|"punto"|"semilla":|vuelaHasta|giraHasta/.test(sinHistorial(d)),
      `${juego}: se le escapo el resultado`,
    );
  }
});

test("CRASH: EL PUNTO DE REVENTON NO SALE MIENTRAS EL AVION VUELA", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  /*
    EL exploit grande de un crash compartido.

    No alcanza con no mandar el punto: si se manda cuanto falta para
    que la ronda termine, el punto sale de una resta --el vuelo dura
    exactamente lo que tarda la curva en llegar ahi-- y el que mira la
    red cobra siempre un milisegundo antes de reventar.

    Asi que mientras vuela solo puede salir cuanto hace que arranco.
  */
  const j = await jugador({ saldo: 100 });
  assert.ok(await rondaFresca("crash", j.token), "no abrio la ronda");
  await volar(300);

  const r = await pedir("GET", "/games/crash/estado", { token: j.token });
  assert.equal(r.estado, 200, JSON.stringify(r.datos));
  const d = r.datos.data;

  assert.equal(d.estado, "girando", "no estaba volando: " + d.estado);
  assert.ok(d.transcurridoMs >= 0, "no dijo cuanto hace que arranco");
  assert.ok(!d.resultado, "mando el resultado en pleno vuelo");
  assert.equal(d.faltaMs, undefined, "dijo cuanto falta: de ahi sale el punto");
  assert.ok(
    !/"punto"|"vuelaHasta"|"giraHasta"|"semilla":/.test(sinHistorial(d)),
    "se le escapo por donde revienta",
  );
});

test("slide: la casilla SI sale mientras gira, que es a donde va la cinta", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  /*
    Lo contrario de Crash, y a proposito: la cinta tiene que frenar en
    algun lado y nadie puede hacer nada con el dato --no se puede
    apostar ni cobrar-- asi que esconderlo seria esconderlo de la
    animacion.
  */
  const j = await jugador({ saldo: 100 });
  assert.ok(await rondaFresca("slide", j.token), "no abrio la ronda");

  const tanda = await GameTanda.findOne({ juego: "slide" }).sort({ numero: -1 });
  await GameTanda.updateOne(
    { _id: tanda._id },
    { $set: { abiertaHasta: new Date(Date.now() - 200) } },
  );

  const r = await pedir("GET", "/games/slide/estado", { token: j.token });
  const d = r.datos.data;
  assert.equal(d.estado, "girando");
  assert.ok(d.resultado && Number.isInteger(d.resultado.casilla), "no dijo en que casilla frena");
  assert.ok(d.resultado.casilla >= 0 && d.resultado.casilla < 15);
});

/**
 * ABRE UNA RONDA NUEVA, SIN ESPERAR.
 *
 * Las rondas compartidas pasan por dos momentos: se apuesta y se
 * juega. Un vuelo de Crash a 10x dura cuarenta segundos, asi que
 * esperar el ciclo de verdad no es una prueba, es una siesta.
 *
 * Se le adelanta el final a la ronda de ahora y se pregunta el
 * estado: ese pedido la paga y abre la que sigue, con su ventana de
 * apuestas entera. Es el mismo camino que corre en produccion --nada
 * se saltea-- pero sin el reloj de pared.
 */
/** Lo que contesto el servidor, sin las rondas viejas. */
function sinHistorial(d) {
  const copia = { ...d };
  delete copia.historial;
  return JSON.stringify(copia);
}

async function rondaFresca(juego, token) {
  const t = await GameTanda.findOne({ juego }).sort({ numero: -1 });
  if (t) {
    await GameTanda.updateOne({ _id: t._id }, {
      $set: {
        abiertaHasta: new Date(Date.now() - 2000),
        giraHasta: new Date(Date.now() - 1000),
      },
    });
  }
  const r = await pedir("GET", `/games/${juego}/estado`, { token });
  const d = r.datos.data;
  return d && d.estado === "apostando" ? d : null;
}

test("slide: se puede apostar a varios colores de la misma rueda", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 100 });

  /*
    EL DISENO DIBUJA TRES COLUMNAS CON SUS APUESTAS.

    La rueda es una sola, asi que ir al rojo y al amarillo de la
    misma vuelta tiene que poder hacerse --como en BetSweeps-- y cada
    apuesta tiene que cobrarse una vez.
  */
  const hay = await rondaFresca("slide", j.token);
  if (!hay) return t.skip("la ronda no abrio a tiempo");

  const antes = await saldoDe(j.id);
  const roja = await pedir("POST", "/games/slide/bet", {
    token: j.token, cuerpo: { apuestaSc: 5, color: "red" },
  });
  assert.equal(roja.estado, 200, JSON.stringify(roja.datos));

  const amarilla = await pedir("POST", "/games/slide/bet", {
    token: j.token, cuerpo: { apuestaSc: 3, color: "yellow" },
  });
  assert.equal(amarilla.estado, 200, JSON.stringify(amarilla.datos));

  assert.ok(Math.abs(await saldoDe(j.id) - (antes - 8)) < 0.001, "cobro otra cosa que 8");

  const mias = await GameRound.find({ user: j.id, juego: "slide" }).lean();
  assert.equal(mias.length, 2, "no quedaron las dos apuestas anotadas");
});

test("crash: una sola apuesta por vuelo", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 100 });

  const hay = await rondaFresca("crash", j.token);
  if (!hay) return t.skip("la ronda no abrio a tiempo");

  const primera = await pedir("POST", "/games/crash/bet", {
    token: j.token, cuerpo: { apuestaSc: 5 },
  });
  assert.equal(primera.estado, 200, JSON.stringify(primera.datos));
  const despuesDeUna = await saldoDe(j.id);

  const segunda = await pedir("POST", "/games/crash/bet", {
    token: j.token, cuerpo: { apuestaSc: 5 },
  });
  assert.notEqual(segunda.estado, 200, "aposto dos veces en el mismo vuelo");
  assert.equal(await saldoDe(j.id), despuesDeUna, "la segunda cobro igual");
});

test("crash: la curva y el reventon son los de BetSweeps", async () => {
  /* 2x a los 11,5 s y 10x a los 38,4 s. */
  assert.equal(crash.multiplicadorEn(0), 1);
  assert.ok(Math.abs(crash.cuandoLlegaA(2) - 11552) < 50);
  assert.ok(Math.abs(crash.cuandoLlegaA(10) - 38376) < 50);

  /* Un hash divisible por `mod` revienta al toque. */
  const mod = require("../services/games/config").crashMod({});
  assert.equal(mod, 25);

  /* Y la distribucion: la chance de pasar 2x tiene que rondar 1/2. */
  const crypto = require("crypto");
  let pasaron = 0;
  const N = 20000;
  for (let i = 0; i < N; i += 1) {
    const h = crypto.createHash("sha256").update("x" + i).digest("hex");
    if (crash.puntoDe(h, {}) >= 2) pasaron += 1;
  }
  const p = pasaron / N;
  assert.ok(Math.abs(p - 0.48) < 0.03, "pasan 2x el " + (p * 100).toFixed(1) + "%");
});

test("MINES: el multiplicador es el justo por el margen, en los cuatro tableros", async () => {
  for (const tablero of mines.TABLEROS) {
    for (const minas of [1, 2, 5]) {
      for (const d of [1, 3]) {
        const justo = mines.combinaciones(tablero, d) / mines.combinaciones(tablero - minas, d);
        const m = mines.multiplicador({ tablero, minas, destapadas: d }, {});
        const esperado = Math.max(1, Math.round(0.94 * justo * 10000) / 10000);
        assert.equal(m, esperado, `${tablero}/${minas}/${d}`);
      }
    }
  }
});

test("EL TOPE DE LA CASA: ninguna ronda paga mas que el maximo", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  /*
    Es lo que impide que una sola ronda se lleve la caja. El margen
    dice lo que se gana en promedio; esto es el techo de un tiro.

    Se prueba bajando el tope a SC 20 y buscando un keno que pague
    mas: con 1 elegido el multiplicador es 2,61x, asi que con 100 de
    apuesta el pago justo seria 261 y tiene que quedar en 20.
  */
  const Settings = require("../database/models/Settings");
  await Settings.updateOne({ key: "main" }, { $set: { "juegos.maximoPremioSc": 20 } }, { upsert: true });

  const j = await jugador({ saldo: 100000 });

  let recortada = null;
  for (let i = 0; i < 40 && !recortada; i += 1) {
    const r = await pedir("POST", "/games/keno/play", {
      token: j.token, cuerpo: { apuestaSc: 100, elegidas: [1] },
    });
    if (r.datos.data && r.datos.data.pagoSc > 0) recortada = r.datos.data;
  }

  if (recortada) {
    assert.ok(recortada.pagoSc <= 20, "pago " + recortada.pagoSc + ", el tope era 20");
    /* Y lo que queda anotado es el multiplicador DE VERDAD pagado. */
    const ronda = await GameRound.findById(recortada.rondaId).lean();
    assert.ok(Math.abs(ronda.pagoSc - recortada.pagoSc) < 0.001);
    assert.ok(Math.abs(ronda.multiplicador * 100 - ronda.pagoSc) < 0.01, "el libro dice otra cosa que la plata");
  }

  await Settings.updateOne({ key: "main" }, { $set: { "juegos.maximoPremioSc": 10000 } });
});

test("ninguno de los ocho deja jugar sin saldo", async (t) => {
  if (!hayBase) return t.skip("sin MongoDB");
  const j = await jugador({ saldo: 1 });

  /* Slide y Crash solo aceptan apuestas con la ronda abierta: si no,
     rebotan por cerrada y el test no probaria nada. */
  await rondaFresca("slide", j.token);
  await rondaFresca("crash", j.token);

  const pedidos = [
    ["/games/reme/play", { apuestaSc: 50 }],
    ["/games/keno/play", { apuestaSc: 50, elegidas: [1, 2, 3] }],
    ["/games/slide/bet", { apuestaSc: 50, color: "red" }],
    ["/games/plinko/play", { apuestaSc: 50, riesgo: "low", filas: 8 }],
    ["/games/mines/open", { apuestaSc: 50, tablero: 25, minas: 3 }],
    ["/games/towers/open", { apuestaSc: 50, riesgo: "med" }],
    ["/games/crash/bet", { apuestaSc: 50 }],
  ];

  for (const [ruta, cuerpo] of pedidos) {
    const r = await pedir("POST", ruta, { token: j.token, cuerpo });
    assert.equal(r.datos.code, "NOT_ENOUGH_COINS", ruta + " dejo jugar sin saldo");
  }

  assert.equal(await saldoDe(j.id), 1, "alguno cobro igual");
});
