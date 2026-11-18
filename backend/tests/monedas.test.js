/**
 * LAS MONEDAS Y SUS REDES, CONTRA LO QUE ACEPTA LA PASARELA.
 *
 * El nombre de red que elige el jugador viaja tal cual a OxaPay. Si no
 * es uno de los que esa moneda acepta, la pasarela contesta
 * `invalid_network` y el jugador ve un error en vez de su direccion de
 * deposito --que es exactamente lo que pasaba con USDC en Solana, que
 * estaba puesto como "SPL".
 *
 * LA TABLA DE ABAJO NO SE INVENTA
 *
 * Son los alias que devolvio `GET /v1/common/currencies` de la cuenta
 * el 18 de noviembre de 2026. Esta prueba no llama a internet: compara
 * nuestra lista contra esa foto. Si OxaPay agrega una red, se actualiza
 * la foto; si alguien escribe mal una clave, esto se da cuenta antes
 * que un jugador.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const { MONEDAS, buscar } = require("../services/cashier/monedas");

/* ticker -> alias que acepta OxaPay para cada una de sus redes */
const ACEPTA = {
  BTC: [["Bitcoin", "BTC"]],
  ETH: [["Ethereum", "ERC20", "ETH"], ["BSC", "BEP20", "BNB", "Binance"], ["Base"]],
  USDT: [
    ["Ethereum", "ERC20", "ETH"],
    ["Tron", "TRC20", "TRX"],
    ["BSC", "BEP20", "BNB", "Binance"],
    ["Solana", "SOL"],
    ["Polygon", "POL"],
    ["The Open Network", "TON", "GRAM"],
  ],
  USDC: [
    ["Ethereum", "ERC20", "ETH"],
    ["BSC", "BEP20", "BNB", "Binance"],
    ["Solana", "SOL"],
    ["Polygon", "POL"],
    ["Base"],
  ],
  SOL: [["Solana", "SOL"]],
  LTC: [["Litecoin", "LTC"]],
};

/* Las confirmaciones que pide la pasarela, por moneda y red. */
const CONFIRMACIONES = {
  "BTC/BTC": 2,
  "USDT/TRC20": 10,
  "USDT/ERC20": 10,
  "USDT/BEP20": 15,
  "ETH/ERC20": 10,
  "USDC/ERC20": 10,
  "USDC/SOL": 30,
  "SOL/SOL": 30,
  "LTC/LTC": 3,
};

test("cada red que ofrecemos es una que OxaPay entiende", () => {
  for (const m of MONEDAS) {
    const alias = ACEPTA[m.ticker];
    assert.ok(alias, `${m.ticker} no existe en la pasarela`);

    for (const r of m.redes) {
      const sirve = alias.some((lista) => lista.includes(r.clave));
      assert.ok(sirve, `${m.ticker} por "${r.clave}" lo rechaza la pasarela`);
    }
  }
});

test("las confirmaciones que mostramos son las que pide la pasarela", () => {
  for (const m of MONEDAS) {
    for (const r of m.redes) {
      const pide = CONFIRMACIONES[`${m.ticker}/${r.clave}`];
      if (pide === undefined) continue;
      assert.equal(
        r.confirmaciones, pide,
        `${m.ticker}/${r.clave}: decimos ${r.confirmaciones} y la pasarela pide ${pide}`
      );
    }
  }
});

test("toda red tiene su minimo de retiro y su comision", () => {
  for (const m of MONEDAS) {
    for (const r of m.redes) {
      assert.equal(typeof r.retiroMinimo, "number", `${m.ticker}/${r.clave} sin minimo`);
      assert.equal(typeof r.comision, "number", `${m.ticker}/${r.clave} sin comision`);
      assert.ok(r.retiroMinimo > 0);
      assert.ok(r.comision >= 0);
    }
  }
});

test("buscar() acepta como lo escriba el jugador, y rechaza lo que no existe", () => {
  assert.ok(buscar("usdt", "trc20"), "en minuscula tambien");
  assert.ok(buscar("USDT"), "sin red, la primera");
  assert.equal(buscar("USDC", "SPL"), null, "la red que rebotaba la pasarela");
  assert.equal(buscar("DOGE", "DOGE"), null, "una moneda que no ofrecemos");
});
