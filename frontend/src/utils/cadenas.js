/**
 * LAS CADENAS Y LOS TOKENS QUE SE PUEDEN PAGAR DESDE LA BILLETERA.
 *
 * Esto NO es una lista de monedas: las monedas las dice el servidor
 * (backend/services/cashier/monedas.js). Esto es el puñado de pares
 * moneda/red que, además, se pueden pagar apretando un botón porque hay
 * una billetera de navegador que los habla.
 *
 * EL RESTO SE SIGUE PAGANDO COPIANDO LA DIRECCION
 *
 * Bitcoin, Litecoin, Dogecoin, XRP, Monero, TON, Tron y todo lo de
 * Solana no tienen una billetera inyectada que podamos manejar igual, y
 * el que paga desde un exchange tampoco puede conectar nada. Para todos
 * ellos queda la dirección y el QR, que es lo que siempre hubo.
 *
 * CADA DIRECCION DE CONTRATO FUE VERIFICADA CONTRA LA CADENA
 *
 * Preguntándole al contrato su `symbol()` y sus `decimals()`. Mandar una
 * transferencia al contrato equivocado es perder la plata, así que
 * además se vuelve a verificar EN EL MOMENTO, antes de cada pago: si el
 * contrato no contesta lo que esperamos, no se manda nada y se muestra
 * la dirección. Ver `utils/billeteras.js`.
 *
 * OJO CON LOS DECIMALES
 *
 * USDT tiene 6 decimales en Ethereum y en Polygon, pero 18 en BNB Smart
 * Chain. Un cero de más o de menos es un factor de un billón.
 */

/** Las cadenas EVM que manejamos, con lo que pide `wallet_addEthereumChain`. */
export const CADENAS = {
  ethereum: {
    chainId: "0x1",
    nombre: "Ethereum",
    moneda: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpc: ["https://ethereum-rpc.publicnode.com"],
    explorador: "https://etherscan.io",
  },
  bsc: {
    chainId: "0x38",
    nombre: "BNB Smart Chain",
    moneda: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpc: ["https://bsc-dataseed.binance.org"],
    explorador: "https://bscscan.com",
  },
  polygon: {
    chainId: "0x89",
    nombre: "Polygon",
    moneda: { name: "POL", symbol: "POL", decimals: 18 },
    rpc: ["https://polygon-bor-rpc.publicnode.com"],
    explorador: "https://polygonscan.com",
  },
  base: {
    chainId: "0x2105",
    nombre: "Base",
    moneda: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpc: ["https://mainnet.base.org"],
    explorador: "https://basescan.org",
  },
};

/**
 * QUE PASA CON CADA PAR MONEDA/RED.
 *
 * La clave es `TICKER:RED`, con la red tal como la nombra el servidor.
 * `token: null` quiere decir que es la moneda nativa de la cadena.
 *
 * `simbolos` son los nombres que el contrato puede contestar: el USDT de
 * Polygon se llama USDT0 desde que pasó a la versión omnicadena, y sigue
 * siendo el mismo token de siempre en la misma dirección.
 */
export const PARES = {
  "ETH:ERC20": { cadena: "ethereum", token: null, decimales: 18 },
  "ETH:Base": { cadena: "base", token: null, decimales: 18 },
  "BNB:BEP20": { cadena: "bsc", token: null, decimales: 18 },
  "POL:Polygon": { cadena: "polygon", token: null, decimales: 18 },

  "ETH:BEP20": {
    cadena: "bsc",
    token: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
    decimales: 18,
    simbolos: ["ETH"],
  },

  "USDT:ERC20": {
    cadena: "ethereum",
    token: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    decimales: 6,
    simbolos: ["USDT"],
  },
  "USDT:BEP20": {
    cadena: "bsc",
    token: "0x55d398326f99059fF775485246999027B3197955",
    decimales: 18,
    simbolos: ["USDT"],
  },
  "USDT:Polygon": {
    cadena: "polygon",
    token: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    decimales: 6,
    simbolos: ["USDT", "USDT0"],
  },

  "USDC:ERC20": {
    cadena: "ethereum",
    token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimales: 6,
    simbolos: ["USDC"],
  },
  "USDC:BEP20": {
    cadena: "bsc",
    token: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    decimales: 18,
    simbolos: ["USDC"],
  },
  "USDC:Polygon": {
    cadena: "polygon",
    token: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    decimales: 6,
    simbolos: ["USDC"],
  },
  "USDC:Base": {
    cadena: "base",
    token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    decimales: 6,
    simbolos: ["USDC"],
  },
};

/** Lo que hace falta para pagar ese par con la billetera, o `null`. */
export function parDeBilletera(ticker, red) {
  const par = PARES[`${ticker}:${red}`];
  if (!par) return null;
  return { ...par, red: CADENAS[par.cadena] };
}
