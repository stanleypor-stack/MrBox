/**
 * LAS MONEDAS QUE SE ACEPTAN.
 *
 * Las que estan prendidas en la cuenta de OxaPay, con sus redes,
 * confirmaciones, minimos y comisiones. Es la UNICA lista: la usa la
 * caja del sitio, la pantalla de Monedas del panel y el pedido de
 * direccion a la pasarela.
 *
 * POR QUE EL COLOR Y LA LETRA VIVEN ACA
 *
 * Porque la pantalla dibuja la monedita con un circulo de color y su
 * marca adentro, en vez de bajarse doce logos. Son marcas registradas
 * de terceros: un circulo naranja con una B no es el logo de Bitcoin,
 * y encima pesa cero.
 *
 * LAS CONFIRMACIONES NO SON DECORACION
 *
 * Es lo que hay que esperar antes de acreditar. Bajarlas acelera el
 * deposito y abre la puerta a que una cadena reorganice un bloque y el
 * pago desaparezca despues de haber acreditado.
 *
 * LOS NUMEROS SON LOS DE OXAPAY, NO LOS QUE NOS GUSTARIAN
 *
 * Confirmaciones, minimo de retiro y comision de red salen de lo que
 * contesta `GET /v1/common/currencies` de la cuenta, leidos el 18 de
 * noviembre de 2026. Si el sitio promete "10 confirmaciones" y la
 * pasarela pide 15, el jugador mira una pantalla que le miente.
 *
 * `clave` TIENE QUE SER UN NOMBRE QUE OXAPAY ENTIENDA
 *
 * Es lo que se manda como `network`. OxaPay acepta alias --"TRC20" por
 * Tron, "ERC20" por Ethereum, "BEP20" por BSC-- pero no cualquiera:
 * "SPL" por Solana NO existe, y pedir una direccion de USDC en Solana
 * contestaba `invalid_network`. Todo lo de abajo esta probado contra
 * la API, par por par (ver tests/monedas.test.js).
 *
 * LA COMISION DE RED NO LA INVENTAMOS
 *
 * `comision` es lo que cobra la cadena por sacar, en unidades de esa
 * moneda. Importa de verdad: sacar USDT por Ethereum cuesta 2 USDT y
 * por Tron cuesta 1, asi que un canje chico por la red equivocada se
 * come la mitad. La pantalla de retiro lo muestra antes de pedirlo.
 *
 * EL ORDEN ES EL ORDEN EN QUE SE VEN
 *
 * Primero lo que usa la gente para pagar --USDT, BTC, ETH, USDC-- y
 * dentro de cada moneda, la red mas barata primero. El que no sabe
 * cual elegir elige la de arriba, asi que la de arriba tiene que ser
 * la que le conviene.
 */

const MONEDAS = [
  {
    nombre: "Tether",
    ticker: "USDT",
    color: "#26a17b",
    letra: "T",
    redes: [
      { nombre: "Tron Network", clave: "TRC20", confirmaciones: 10, demora: "~1 min", color: "#e8343a", retiroMinimo: 0.01, comision: 1 },
      { nombre: "BNB Smart Chain", clave: "BEP20", confirmaciones: 15, demora: "~1 min", color: "#f0b90b", retiroMinimo: 0.01, comision: 0.25 },
      { nombre: "Polygon", clave: "Polygon", confirmaciones: 50, demora: "~2 min", color: "#8247e5", retiroMinimo: 0.01, comision: 0.2 },
      { nombre: "TON", clave: "TON", confirmaciones: 3, demora: "~1 min", color: "#0098ea", retiroMinimo: 0.01, comision: 0.25 },
      { nombre: "Solana", clave: "Solana", confirmaciones: 30, demora: "~1 min", color: "#9945ff", retiroMinimo: 0.1, comision: 0.5 },
      { nombre: "Ethereum", clave: "ERC20", confirmaciones: 10, demora: "~3 min", color: "#627eea", retiroMinimo: 1, comision: 2 },
    ],
  },
  {
    nombre: "Bitcoin",
    ticker: "BTC",
    color: "#f7931a",
    letra: "₿",
    redes: [
      { nombre: "Bitcoin", clave: "BTC", confirmaciones: 2, demora: "~20 min", color: "#f7931a", retiroMinimo: 0.000045, comision: 0.00001 },
    ],
  },
  {
    nombre: "Ethereum",
    ticker: "ETH",
    color: "#627eea",
    letra: "Ξ",
    redes: [
      { nombre: "Base", clave: "Base", confirmaciones: 10, demora: "~2 min", color: "#0052ff", retiroMinimo: 0.0002, comision: 0.0000008 },
      { nombre: "BNB Smart Chain", clave: "BEP20", confirmaciones: 15, demora: "~1 min", color: "#f0b90b", retiroMinimo: 0.00025, comision: 0.000014 },
      { nombre: "Ethereum", clave: "ERC20", confirmaciones: 10, demora: "~3 min", color: "#627eea", retiroMinimo: 0.0001, comision: 0.0002 },
    ],
  },
  {
    nombre: "USD Coin",
    ticker: "USDC",
    color: "#2775ca",
    letra: "$",
    redes: [
      { nombre: "Polygon", clave: "Polygon", confirmaciones: 50, demora: "~2 min", color: "#8247e5", retiroMinimo: 0.1, comision: 0 },
      { nombre: "BNB Smart Chain", clave: "BEP20", confirmaciones: 15, demora: "~1 min", color: "#f0b90b", retiroMinimo: 0.1, comision: 0.25 },
      { nombre: "Solana", clave: "Solana", confirmaciones: 30, demora: "~1 min", color: "#9945ff", retiroMinimo: 0.1, comision: 0.25 },
      { nombre: "Base", clave: "Base", confirmaciones: 10, demora: "~2 min", color: "#0052ff", retiroMinimo: 0.1, comision: 0.5 },
      { nombre: "Ethereum", clave: "ERC20", confirmaciones: 10, demora: "~3 min", color: "#627eea", retiroMinimo: 1, comision: 2 },
    ],
  },
  {
    nombre: "Solana",
    ticker: "SOL",
    color: "#9945ff",
    letra: "S",
    redes: [
      { nombre: "Solana", clave: "Solana", confirmaciones: 30, demora: "~1 min", color: "#9945ff", retiroMinimo: 0.001, comision: 0.00005 },
    ],
  },
  {
    nombre: "Litecoin",
    ticker: "LTC",
    color: "#345d9d",
    letra: "Ł",
    redes: [
      { nombre: "Litecoin", clave: "LTC", confirmaciones: 3, demora: "~8 min", color: "#345d9d", retiroMinimo: 0.002, comision: 0.00016 },
    ],
  },
  {
    nombre: "Tron",
    ticker: "TRX",
    color: "#e8343a",
    letra: "T",
    redes: [
      { nombre: "Tron Network", clave: "TRC20", confirmaciones: 10, demora: "~1 min", color: "#e8343a", retiroMinimo: 0.0001, comision: 1 },
    ],
  },
  {
    nombre: "BNB",
    ticker: "BNB",
    color: "#f0b90b",
    letra: "B",
    redes: [
      { nombre: "BNB Smart Chain", clave: "BEP20", confirmaciones: 15, demora: "~1 min", color: "#f0b90b", retiroMinimo: 0.0004, comision: 0.000048 },
    ],
  },
  {
    nombre: "Dogecoin",
    ticker: "DOGE",
    color: "#c2a633",
    letra: "Ð",
    redes: [
      { nombre: "Dogecoin", clave: "Dogecoin", confirmaciones: 12, demora: "~12 min", color: "#c2a633", retiroMinimo: 0.01, comision: 0.0096 },
    ],
  },
  {
    nombre: "Polygon",
    ticker: "POL",
    color: "#8247e5",
    letra: "P",
    redes: [
      { nombre: "Polygon", clave: "Polygon", confirmaciones: 50, demora: "~2 min", color: "#8247e5", retiroMinimo: 0.001, comision: 0.02 },
    ],
  },
  {
    nombre: "XRP",
    ticker: "XRP",
    color: "#4a5568",
    letra: "X",
    redes: [
      { nombre: "XRP Ledger", clave: "xrpl", confirmaciones: 5, demora: "~1 min", color: "#4a5568", retiroMinimo: 1.5, comision: 0.01 },
    ],
  },
  {
    nombre: "Monero",
    ticker: "XMR",
    color: "#ff6600",
    letra: "M",
    redes: [
      { nombre: "Monero", clave: "Monero", confirmaciones: 6, demora: "~12 min", color: "#ff6600", retiroMinimo: 0.0001, comision: 0.00009 },
    ],
  },
];

/**
 * La moneda y la red pedidas, o `null` si no existen.
 *
 * La clave se compara sin mirar mayusculas: la misma red se escribe de
 * las dos formas segun de donde venga --"Solana" en esta lista,
 * "solana" en un enlace que alguien comparta-- y las dos son la misma.
 */
function buscar(ticker, redClave) {
  const moneda = MONEDAS.find((m) => m.ticker === String(ticker || "").toUpperCase());
  if (!moneda) return null;

  const pedida = String(redClave || "").toUpperCase();
  const red = redClave
    ? moneda.redes.find((r) => r.clave.toUpperCase() === pedida)
    : moneda.redes[0];
  if (!red) return null;

  return { moneda, red };
}

module.exports = { MONEDAS, buscar };
