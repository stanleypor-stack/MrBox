/**
 * LAS MONEDAS QUE SE ACEPTAN.
 *
 * Las del prototipo, con sus redes, confirmaciones y demoras. Es la
 * UNICA lista: la usa la caja del sitio, la pantalla de Monedas del
 * panel y, cuando entre OxaPay, el mapeo contra lo que ese proveedor
 * llama a cada red.
 *
 * POR QUE EL COLOR Y LA LETRA VIVEN ACA
 *
 * Porque la pantalla dibuja la monedita con un circulo de color y la
 * inicial adentro, en vez de bajarse seis logos. Son marcas registradas
 * de terceros: un circulo naranja con una B no es el logo de Bitcoin,
 * y encima pesa cero.
 *
 * LAS CONFIRMACIONES NO SON DECORACION
 *
 * Es lo que hay que esperar antes de acreditar. Bajarlas acelera el
 * deposito y abre la puerta a que una cadena reorganice un bloque y el
 * pago desaparezca despues de haber acreditado. Las del prototipo son
 * las que usa todo el mundo.
 */

const MONEDAS = [
  {
    nombre: "Tether",
    ticker: "USDT",
    color: "#26a17b",
    letra: "T",
    redes: [
      { nombre: "Tron Network", clave: "TRC20", confirmaciones: 10, demora: "~1 min", color: "#e8343a" },
      { nombre: "Ethereum", clave: "ERC20", confirmaciones: 12, demora: "~3 min", color: "#627eea" },
      { nombre: "BNB Smart Chain", clave: "BEP20", confirmaciones: 15, demora: "~1 min", color: "#f0b90b" },
    ],
  },
  {
    nombre: "Bitcoin",
    ticker: "BTC",
    color: "#f7931a",
    letra: "₿",
    redes: [
      { nombre: "Bitcoin", clave: "BTC", confirmaciones: 2, demora: "~20 min", color: "#f7931a" },
    ],
  },
  {
    nombre: "Ethereum",
    ticker: "ETH",
    color: "#627eea",
    letra: "Ξ",
    redes: [
      { nombre: "Ethereum", clave: "ERC20", confirmaciones: 12, demora: "~3 min", color: "#627eea" },
    ],
  },
  {
    nombre: "USD Coin",
    ticker: "USDC",
    color: "#2775ca",
    letra: "$",
    redes: [
      { nombre: "Ethereum", clave: "ERC20", confirmaciones: 12, demora: "~3 min", color: "#627eea" },
      { nombre: "Solana", clave: "SPL", confirmaciones: 32, demora: "~1 min", color: "#9945ff" },
    ],
  },
  {
    nombre: "Solana",
    ticker: "SOL",
    color: "#9945ff",
    letra: "S",
    redes: [
      { nombre: "Solana", clave: "SOL", confirmaciones: 32, demora: "~1 min", color: "#9945ff" },
    ],
  },
  {
    nombre: "Litecoin",
    ticker: "LTC",
    color: "#345d9d",
    letra: "Ł",
    redes: [
      { nombre: "Litecoin", clave: "LTC", confirmaciones: 6, demora: "~15 min", color: "#345d9d" },
    ],
  },
];

/** La moneda y la red pedidas, o `null` si no existen. */
function buscar(ticker, redClave) {
  const moneda = MONEDAS.find((m) => m.ticker === String(ticker || "").toUpperCase());
  if (!moneda) return null;

  const red = redClave
    ? moneda.redes.find((r) => r.clave === String(redClave).toUpperCase())
    : moneda.redes[0];
  if (!red) return null;

  return { moneda, red };
}

module.exports = { MONEDAS, buscar };
