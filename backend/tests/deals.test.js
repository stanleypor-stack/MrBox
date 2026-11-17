/**
 * LAS CUENTAS DE DEALS.
 *
 * El mismo 92% que las cajas, pero despejado al revés: acá el jugador
 * elige el premio y la chance, y lo que sale es el precio del tiro.
 *
 * Si esto está mal, está mal en cada tiro de cada jugador y no avisa.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const deals = require("../services/deals");
const fair = require("../services/boxes/fair");
const { RETORNO_OBJETIVO } = require("../services/boxes/economia");

test("la apuesta sale del valor y la chance, no al reves", () => {
  /* SC 1.000 al 10%: el premio esperado es SC 100, y para que a la casa
     le quede el 8% el tiro tiene que costar 100 / 0,92 = 108,6956… */
  assert.equal(deals.apuestaDe(1000, 0.1), 108.7);
});

test("la apuesta redondea para arriba, nunca para abajo", () => {
  const valor = 1000;
  for (const chance of [0.01, 0.05, 0.1234, 0.5, 0.7777, 0.8]) {
    const apuesta = deals.apuestaDe(valor, chance);
    const exacta = (valor * chance) / RETORNO_OBJETIVO;
    assert.ok(apuesta >= exacta, `${chance}: ${apuesta} < ${exacta}`);
    assert.ok(apuesta - exacta < 0.01, `${chance}: redondeo de mas`);
  }
});

test("el retorno real queda entre 90,2% y 92% para todo el catalogo", () => {
  /*
    Lo que de verdad importa: por cada SC que entra, cuanto sale.

    El redondeo para arriba lo deja SIEMPRE en 92% o menos --eso es la
    casa-- y la apuesta minima de SC 0,50 lo deja siempre arriba de
    90,2% --eso es el jugador--. Un centavo sobre cincuenta es el peor
    mordisco posible.

    Sin la apuesta minima, un objeto de SC 7,81 al 1% paga SC 0,09 y el
    retorno se cae al 86,8% sin que nadie lo haya decidido.
  */
  const PEOR = (RETORNO_OBJETIVO * deals.APUESTA_MINIMA) / (deals.APUESTA_MINIMA + 0.01);

  for (const valor of [0.58, 7.81, 48.99, 128.51, 1277.29, 24999.99]) {
    const piso = deals.chanceMinimaDe(valor);
    for (const chance of [piso, 0.025, 0.1, 0.25, 0.5, 0.8].filter((c) => c >= piso)) {
      const apuesta = deals.apuestaDe(valor, chance);
      const retorno = (valor * chance) / apuesta;
      assert.ok(apuesta >= deals.APUESTA_MINIMA, `${valor} @ ${chance}: apuesta ${apuesta}`);
      assert.ok(retorno <= RETORNO_OBJETIVO + 1e-9, `${valor} @ ${chance}: ${retorno}`);
      assert.ok(retorno >= PEOR - 1e-9, `${valor} @ ${chance}: ${retorno} es demasiado poco`);
    }
  }
});

test("por debajo del valor minimo ni la chance maxima llega a la apuesta minima", () => {
  assert.equal(deals.VALOR_MINIMO, 0.58);
  /* Justo en el limite, la chance maxima alcanza. */
  assert.ok(deals.chanceMinimaDe(deals.VALOR_MINIMO) <= deals.CHANCE_MAX);
  /* Un centavo por debajo, la cuenta exacta ya no alcanza: solo llega a
     la apuesta minima porque el centavo de redondeo la empuja, y eso es
     el jugador pagando el redondeo en vez de la casa. Por eso el corte
     esta en la cuenta exacta, y por eso el mani del catalogo no juega. */
  const exacta = (0.57 * deals.CHANCE_MAX) / RETORNO_OBJETIVO;
  assert.ok(exacta < deals.APUESTA_MINIMA, `${exacta}`);
});

test("la chance que sale de una apuesta vuelve a dar esa apuesta", () => {
  const valor = 1277.29;
  for (const chance of [0.01, 0.1, 0.33, 0.5, 0.8]) {
    const apuesta = deals.apuestaDe(valor, chance);
    const vuelta = deals.chanceDe(valor, apuesta);
    /* El redondeo del precio al centavo mueve la chance un pelo. Un
       pelo es menos de una decima de punto porcentual. */
    assert.ok(Math.abs(vuelta - chance) < 0.001, `${chance} -> ${vuelta}`);
  }
});

test("la chance tiene piso y techo", () => {
  assert.equal(deals.CHANCE_MIN, 0.01);
  assert.equal(deals.CHANCE_MAX, 0.8);
  /* Un objeto caro llega al 1%; uno de SC 7,81 no, porque al 1% el
     tiro costaria nueve centavos. */
  assert.equal(deals.chanceMinimaDe(1000), 0.01);
  assert.equal(deals.chanceMinimaDe(7.81), 0.0589);
  /* El techo existe para que el peor caso siga siendo mirable: a 80% de
     chance un objeto de SC 1.000 cuesta SC 869,57 y se pierde una de
     cada cinco veces. */
  assert.equal(deals.apuestaDe(1000, deals.CHANCE_MAX), 869.57);
});

test("chanceDe no se sale de los limites aunque la apuesta sea absurda", () => {
  assert.equal(deals.chanceDe(1000, 999999), deals.CHANCE_MAX);
  assert.equal(deals.chanceDe(1000, 0), deals.CHANCE_MIN);
  assert.equal(deals.chanceDe(7.81, 0), deals.chanceMinimaDe(7.81));
  assert.equal(deals.chanceDe(0, 100), 0);
});

test("a la larga gana la chance pedida, no otra", () => {
  /*
    Diez mil tiros con semillas de verdad. No es una prueba de
    aleatoriedad --eso ya lo cubre fair.test.js-- sino de que la
    comparacion `numero < chance` mide la franja que dice medir.
  */
  const semilla = "0".repeat(64);
  const chance = 0.25;
  let ganados = 0;
  const tiros = 10000;

  for (let i = 0; i < tiros; i += 1) {
    const hmac = fair.calcularHmac(semilla, "prueba", i);
    if (fair.hmacANumero(hmac) < chance) ganados += 1;
  }

  const salio = ganados / tiros;
  /* Con 10.000 tiros, tres desvios estandar son ~1,3 puntos. */
  assert.ok(Math.abs(salio - chance) < 0.015, `salio ${salio}`);
});

test("el numero vive en [0, 1), asi que `<` mide exacto", () => {
  /*
    Con `<=` la franja ganadora mediria un paso de mas. Con 52 bits ese
    paso es invisible en la practica, pero la verificacion de afuera
    daria otra cosa que la nuestra, y una prueba que no cierra no
    prueba nada.
  */
  for (let i = 0; i < 500; i += 1) {
    const n = fair.hmacANumero(fair.calcularHmac("abc", "def", i));
    assert.ok(n >= 0 && n < 1, `fuera de rango: ${n}`);
  }
});
