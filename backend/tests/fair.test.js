/**
 * EL SORTEO.
 *
 * Dos cosas tienen que ser ciertas y las dos se prueban acá:
 *
 *   1. Que cada premio salga con la frecuencia que dice la caja. Si el
 *      objeto de 0,02% sale el 0,05% de las veces, la casa pierde plata
 *      sin que ninguna pantalla lo muestre.
 *   2. Que el jugador pueda rehacer la cuenta y comprobarlo. Si eso se
 *      rompe, "provably fair" pasa a ser una palabra en el pie de página.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const fair = require("../services/boxes/fair");

const PREMIOS = [
  { name: "Oro", valueSc: 1549.22, chance: 0.0002 },
  { name: "iPhone", valueSc: 1277.29, chance: 0.0003 },
  { name: "Soundbar", valueSc: 564.45, chance: 0.001 },
  { name: "GoPro", valueSc: 411.09, chance: 0.0015 },
  { name: "Labubu", valueSc: 248.5, chance: 0.004 },
  { name: "PS5 Pulse", valueSc: 128.51, chance: 0.008 },
  { name: "DualSense", valueSc: 69.58, chance: 0.01 },
  { name: "MagSafe", valueSc: 48.99, chance: 0.01 },
  { name: "Floaty", valueSc: 7.81, chance: 0.965 },
];

const SEMILLA = "a".repeat(64);

test("el mismo sorteo da siempre el mismo resultado", () => {
  const uno = fair.sortear({ semillaServidor: SEMILLA, semillaCliente: "cliente", nonce: 7, premios: PREMIOS });
  const dos = fair.sortear({ semillaServidor: SEMILLA, semillaCliente: "cliente", nonce: 7, premios: PREMIOS });
  assert.deepEqual(uno, dos);
});

test("cambiar cualquiera de los tres datos cambia el resultado", () => {
  const base = fair.calcularHmac(SEMILLA, "cliente", 1);
  assert.notEqual(base, fair.calcularHmac("b".repeat(64), "cliente", 1));
  assert.notEqual(base, fair.calcularHmac(SEMILLA, "otro", 1));
  assert.notEqual(base, fair.calcularHmac(SEMILLA, "cliente", 2));
});

test("el número sorteado siempre cae entre 0 y 1", () => {
  for (let n = 0; n < 5000; n += 1) {
    const numero = fair.hmacANumero(fair.calcularHmac(SEMILLA, "c", n));
    assert.ok(numero >= 0 && numero < 1, `nonce ${n} dio ${numero}`);
  }
});

test("CADA PREMIO SALE CON LA FRECUENCIA QUE DICE LA CAJA", () => {
  /*
    La prueba que importa. Se abren 200.000 cajas y se cuenta.

    El margen se calcula con el error estándar de una binomial
    (sqrt(p*(1-p)/n)) por 5: cinco desvíos es prácticamente imposible por
    azar, así que si esto falla no es mala suerte, es un error de verdad.
  */
  const VECES = 200000;
  const salieron = Object.fromEntries(PREMIOS.map((p) => [p.name, 0]));

  for (let n = 0; n < VECES; n += 1) {
    const { premio } = fair.sortear({
      semillaServidor: SEMILLA,
      semillaCliente: "distribucion",
      nonce: n,
      premios: PREMIOS,
    });
    salieron[premio.name] += 1;
  }

  for (const p of PREMIOS) {
    const esperadas = p.chance * VECES;
    const margen = 5 * Math.sqrt(p.chance * (1 - p.chance) * VECES);
    const diferencia = Math.abs(salieron[p.name] - esperadas);
    assert.ok(
      diferencia <= Math.max(margen, 5),
      `${p.name}: esperaba ~${esperadas.toFixed(1)} y salió ${salieron[p.name]} (margen ${margen.toFixed(1)})`
    );
  }
});

test("el jugador puede rehacer el sorteo y le da lo mismo", () => {
  const { premio, numero } = fair.sortear({
    semillaServidor: SEMILLA, semillaCliente: "mia", nonce: 42, premios: PREMIOS,
  });

  const revisado = fair.verificarApertura({
    semillaServidor: SEMILLA, semillaCliente: "mia", nonce: 42, premios: PREMIOS,
    premioEsperado: premio.name,
  });

  assert.equal(revisado.coincide, true);
  assert.equal(revisado.numero, numero);
});

test("si le decimos que ganó otra cosa, la verificación lo delata", () => {
  const revisado = fair.verificarApertura({
    semillaServidor: SEMILLA, semillaCliente: "mia", nonce: 42, premios: PREMIOS,
    premioEsperado: "Un premio que no salió",
  });
  assert.equal(revisado.coincide, false);
});

test("el hash tapa la semilla y la semilla coincide con el hash", () => {
  const hash = fair.hashDeSemilla(SEMILLA);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.notEqual(hash, SEMILLA, "el hash no puede ser la semilla");
  assert.equal(hash, fair.hashDeSemilla(SEMILLA), "el mismo hash para la misma semilla");
  assert.notEqual(hash, fair.hashDeSemilla("b".repeat(64)));
});

test("cada semilla nueva es distinta y tiene largo de sobra", () => {
  const vistas = new Set();
  for (let i = 0; i < 1000; i += 1) {
    const s = fair.semillaNueva();
    assert.match(s, /^[0-9a-f]{64}$/);
    assert.ok(!vistas.has(s), "se repitió una semilla");
    vistas.add(s);
  }
});

test("el orden de los premios no cambia a quién le toca cuánto", () => {
  /*
    Se sortea con la lista dada vuelta: cada premio tiene que seguir
    saliendo con su misma frecuencia. Lo que SI cambia es cuál sale en un
    nonce puntual, y está bien: por eso el orden guardado es parte de lo
    que se verifica.
  */
  const alReves = [...PREMIOS].reverse();
  const VECES = 40000;
  let floatyNormal = 0;
  let floatyAlReves = 0;

  for (let n = 0; n < VECES; n += 1) {
    const a = fair.sortear({ semillaServidor: SEMILLA, semillaCliente: "o", nonce: n, premios: PREMIOS });
    const b = fair.sortear({ semillaServidor: SEMILLA, semillaCliente: "o", nonce: n, premios: alReves });
    if (a.premio.name === "Floaty") floatyNormal += 1;
    if (b.premio.name === "Floaty") floatyAlReves += 1;
  }

  const esperadas = 0.965 * VECES;
  assert.ok(Math.abs(floatyNormal - esperadas) < 300, `normal: ${floatyNormal}`);
  assert.ok(Math.abs(floatyAlReves - esperadas) < 300, `al revés: ${floatyAlReves}`);
});

test("una caja cuyas chances no llegan a 1 no rompe una apertura", () => {
  /*
    `revisarCaja` no deja guardar una caja así, pero una vieja o tocada a
    mano en la base no puede tumbar la apertura de alguien: el hueco se lo
    lleva el último premio.
  */
  const rotas = [
    { name: "A", valueSc: 10, chance: 0.3 },
    { name: "B", valueSc: 1, chance: 0.3 },
  ];
  for (let n = 0; n < 500; n += 1) {
    const { premio } = fair.sortear({
      semillaServidor: SEMILLA, semillaCliente: "rota", nonce: n, premios: rotas,
    });
    assert.ok(premio, "no devolvió premio");
  }
});

test("una caja sin premios avisa en vez de devolver cualquier cosa", () => {
  for (const premios of [[], null, undefined]) {
    assert.throws(
      () => fair.sortear({ semillaServidor: SEMILLA, semillaCliente: "c", nonce: 1, premios }),
      /no tiene premios/
    );
  }
});
