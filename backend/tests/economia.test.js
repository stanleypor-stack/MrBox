/**
 * LAS CUENTAS DE UNA CAJA.
 *
 * Esto es lo que decide cuánta plata entra y cuánta sale del sitio. Si algo
 * de acá está mal, está mal en cada apertura de cada caja, y no avisa: la
 * caja sigue funcionando, solo que deja de ganar.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const eco = require("../services/boxes/economia");
const { sc } = require("../utils/money");

/*
  La caja "Day Trader" del diseño del admin: nueve objetos, el barato sale
  casi siempre. Es un buen caso de prueba porque mezcla un objeto de
  SC 1.549 con uno de SC 7,81 y chances de 0,02% a 96,5%.
*/
const DAY_TRADER = [
  { name: "10g Gold Minted Tablet", valueSc: 1549.22, chance: 0.0002 },
  { name: "iPhone 16 Plus", valueSc: 1277.29, chance: 0.0003 },
  { name: "Bose Smart Soundbar", valueSc: 564.45, chance: 0.001 },
  { name: "GoPro MAX", valueSc: 411.09, chance: 0.0015 },
  { name: "Labubu Time to Chill Plush 40cm", valueSc: 248.5, chance: 0.004 },
  { name: "PS5 Pulse 3D Wireless", valueSc: 128.51, chance: 0.008 },
  { name: "PS5 DualSense Wireless", valueSc: 69.58, chance: 0.01 },
  { name: "MagSafe Charger", valueSc: 48.99, chance: 0.01 },
  { name: "GoPro Floaty", valueSc: 7.81, chance: 0.965 },
].map((p, i) => ({ ...p, item: "item-" + i }));

test("lo que paga en promedio es la suma de valor por chance", () => {
  /* A mano: 1549,22*0,0002 + 1277,29*0,0003 + ... + 7,81*0,965 */
  assert.equal(eco.pagoPromedio(DAY_TRADER), 12.62);
});

test("el precio sale del pago promedio y el retorno, no al revés", () => {
  const precio = eco.precioDe(DAY_TRADER);
  /* 12,62 / 0,92 = 13,717…, que redondeado para arriba es 13,72 */
  assert.equal(precio, 13.72);
});

test("el precio se redondea para ARRIBA, nunca para abajo", () => {
  /*
    Medio centavo por apertura parece nada. En una caja que se abre cien
    mil veces son quinientos pesos, y siempre en la misma dirección. Para
    abajo, el retorno real queda POR ENCIMA del objetivo y la casa paga esa
    diferencia en cada una.
  */
  const premios = [{ item: "a", name: "A", valueSc: 1, chance: 1 }];
  const precio = eco.precioDe(premios); // 1 / 0,92 = 1,0869…
  assert.equal(precio, 1.09);
  assert.ok(eco.retornoReal(premios, precio) <= eco.RETORNO_OBJETIVO);
});

test("con el precio calculado, el retorno real nunca pasa el objetivo", () => {
  /* La propiedad que importa, probada sobre muchas cajas al azar. */
  let peor = 0;
  for (let n = 0; n < 500; n += 1) {
    const cuantos = 2 + (n % 8);
    const crudas = Array.from({ length: cuantos }, () => Math.random() + 0.01);
    const total = crudas.reduce((a, b) => a + b, 0);
    const premios = crudas.map((c, i) => ({
      item: "x" + i,
      name: "X" + i,
      valueSc: sc(1 + Math.random() * 2000),
      chance: c / total,
    }));

    const precio = eco.precioDe(premios);
    const retorno = eco.retornoReal(premios, precio);
    peor = Math.max(peor, retorno);
    assert.ok(
      retorno <= eco.RETORNO_OBJETIVO + 1e-9,
      `una caja quedó al ${(retorno * 100).toFixed(4)}%, por encima del objetivo`
    );
  }
  assert.ok(peor > 0.9, `el peor caso dio ${peor}, sospechosamente lejos del objetivo`);
});

test("las chances tienen que sumar 100%", () => {
  const corta = eco.revisarCaja({ prizes: [
    { item: "a", name: "A", valueSc: 10, chance: 0.5 },
    { item: "b", name: "B", valueSc: 1, chance: 0.4 },
  ] });
  assert.equal(corta.ok, false);
  assert.ok(corta.errores.some((e) => /add up to 100%/.test(e)), corta.errores.join(" | "));

  const pasada = eco.revisarCaja({ prizes: [
    { item: "a", name: "A", valueSc: 10, chance: 0.5 },
    { item: "b", name: "B", valueSc: 1, chance: 0.6 },
  ] });
  assert.equal(pasada.ok, false);
});

test("una caja bien cargada pasa, y trae su precio", () => {
  const r = eco.revisarCaja({ prizes: DAY_TRADER });
  assert.equal(r.ok, true, r.errores.join(" | "));
  assert.equal(r.precioSugerido, 13.72);
  assert.ok(Math.abs(r.retorno - 0.92) < 0.001, `retorno ${r.retorno}`);
});

test("ningún premio puede pasar el tope de premio del sitio", () => {
  const r = eco.revisarCaja(
    { prizes: [
      { item: "a", name: "Un auto", valueSc: 400000, chance: 0.00001 },
      { item: "b", name: "Nada", valueSc: 1, chance: 0.99999 },
    ] },
    { topePremio: 300000 }
  );
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => /payout cap/.test(e)), r.errores.join(" | "));
});

test("una chance de 0% o negativa no se guarda", () => {
  for (const chance of [0, -0.1]) {
    const r = eco.revisarCaja({ prizes: [
      { item: "a", name: "A", valueSc: 10, chance },
      { item: "b", name: "B", valueSc: 1, chance: 1 - chance },
    ] });
    assert.equal(r.ok, false, `pasó con chance ${chance}`);
  }
});

test("un objeto sin valor no se guarda", () => {
  const r = eco.revisarCaja({ prizes: [{ item: "a", name: "Fantasma", valueSc: 0, chance: 1 }] });
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => /no worth/.test(e)), r.errores.join(" | "));
});

test("una caja de la comunidad necesita entre 5 y 20 objetos", () => {
  const armar = (n) => Array.from({ length: n }, (_, i) => ({
    item: "i" + i, name: "I" + i, valueSc: 10, chance: 1 / n,
  }));

  assert.equal(eco.revisarCaja({ prizes: armar(4) }, { esDeComunidad: true }).ok, false);
  assert.equal(eco.revisarCaja({ prizes: armar(21) }, { esDeComunidad: true }).ok, false);
  assert.equal(eco.revisarCaja({ prizes: armar(5) }, { esDeComunidad: true }).ok, true);
  assert.equal(eco.revisarCaja({ prizes: armar(20) }, { esDeComunidad: true }).ok, true);

  /* La del sitio no tiene ese límite: puede tener un objeto solo. */
  assert.equal(eco.revisarCaja({ prizes: armar(1) }).ok, true);
});

test("avisa cuando una caja paga más de lo que cobra", () => {
  /* Precio puesto a mano, muy por debajo de lo que valen los objetos. */
  const r = eco.revisarCaja({
    priceSc: 1,
    prizes: [{ item: "a", name: "A", valueSc: 100, chance: 1 }],
  });
  assert.equal(r.ok, true, "no es un error: es una decisión, pero tiene que avisar");
  assert.ok(
    r.avisos.some((a) => /loses money/.test(a)),
    r.avisos.join(" | ")
  );
});

test("el margen de la casa es lo que no vuelve al jugador, sin basura decimal", () => {
  /*
    `(1 - 0.92) * 100` en JavaScript da 7.9999999999999964. Ese número
    viaja a la comisión del afiliado, al rakeback y a los reportes: tiene
    que salir de acá limpio.
  */
  assert.equal(eco.margenDeLaCasa(0.92), 8);
  assert.equal(eco.margenDeLaCasa(0.769), 23.1);
  assert.equal(eco.margenDeLaCasa(1), 0);
  assert.equal(eco.margenDeLaCasa(1.5), 0, "un retorno de más de 100% no da margen negativo");
  assert.equal(eco.margenDeLaCasa(undefined), 100);
});

test("una caja sin premios no se guarda", () => {
  assert.equal(eco.revisarCaja({ prizes: [] }).ok, false);
  assert.equal(eco.revisarCaja({}).ok, false);
  assert.equal(eco.revisarCaja(null).ok, false);
});
