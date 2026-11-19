/**
 * PAGAR DESDE LA BILLETERA DEL NAVEGADOR.
 *
 * El jugador aprieta un botón, su billetera le muestra el monto y la
 * dirección, él firma, y la plata sale. Sin copiar una dirección de 42
 * caracteres ni pegarla en otra pantalla, que es donde la gente se
 * equivoca y pierde el depósito.
 *
 * LA PLATA VA A LA MISMA DIRECCION DE SIEMPRE
 *
 * A la que ya nos da la pasarela para ese jugador y esa red. Nosotros no
 * custodiamos nada, no firmamos nada y no tocamos una llave: la billetera
 * firma del lado del jugador y la pasarela acredita cuando la red
 * confirma, igual que si hubiera copiado la dirección a mano. Por eso
 * esto es una comodidad de la pantalla y no un camino nuevo de la plata.
 *
 * SIN SDK NI DEPENDENCIAS
 *
 * Las billeteras de navegador se anuncian solas (EIP-6963) y hablan un
 * JSON-RPC de cuatro métodos. Meter WalletConnect sumaría medio mega al
 * paquete para el caso de escanear un QR desde la compu, que se puede
 * agregar después sin tocar nada de esto.
 *
 * LO QUE MAS IMPORTA DE TODO ESTE ARCHIVO
 *
 * Que nunca se mande a la red equivocada. Una dirección de Ethereum y
 * una de BNB Smart Chain se escriben igual, y mandar USDT de BEP20 a una
 * dirección de depósito de ERC20 es perder la plata sin que nadie pueda
 * devolverla. Por eso antes de armar la transferencia se obliga a la
 * billetera a estar en la cadena correcta, y recién ahí se firma.
 */

import { CADENAS, parDeBilletera } from "@/utils/cadenas";

/* ── Quién hay instalado ──────────────────────────────────────────── */

/**
 * LAS BILLETERAS QUE SE ANUNCIAN (EIP-6963).
 *
 * Cada una contesta con su nombre, su icono y su proveedor. Antes de
 * esto había una sola `window.ethereum`, y con dos extensiones
 * instaladas se peleaban por esa variable: el jugador apretaba MetaMask
 * y le abría otra.
 */
export function billeterasDisponibles({ espera = 350 } = {}) {
  return new Promise((listo) => {
    const vistas = new Map();

    const anotar = (e) => {
      const d = e.detail;
      if (d && d.info && d.provider) vistas.set(d.info.uuid || d.info.rdns, d);
    };

    window.addEventListener("eip6963:announceProvider", anotar);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    window.setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", anotar);

      const todas = Array.from(vistas.values()).map((d) => ({
        id: d.info.rdns || d.info.uuid,
        nombre: d.info.name,
        icono: d.info.icon,
        proveedor: d.provider,
      }));

      /* Las que todavía no se anuncian, por si hay una sola vieja. */
      if (!todas.length && window.ethereum) {
        todas.push({
          id: "inyectada",
          nombre: window.ethereum.isMetaMask ? "MetaMask" : "Wallet",
          icono: "",
          proveedor: window.ethereum,
        });
      }

      listo(todas);
    }, espera);
  });
}

/* ── Los números ──────────────────────────────────────────────────── */

/**
 * De "12,5" a la cantidad entera que entiende la cadena.
 *
 * Se hace con texto y no con `Number`: 0.1 + 0.2 en coma flotante no da
 * 0.3, y acá un redondeo es plata de alguien. `12.5` con 6 decimales es
 * `12500000`.
 */
export function aUnidades(monto, decimales) {
  const limpio = String(monto).trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(limpio)) throw new Error("monto invalido");

  const [enteros, fraccion = ""] = limpio.split(".");
  if (fraccion.length > decimales) throw new Error("demasiados decimales");

  const relleno = (fraccion + "0".repeat(decimales)).slice(0, decimales);
  const junto = (enteros + relleno).replace(/^0+(?=\d)/, "");
  return BigInt(junto);
}

/** A hexadecimal con `0x`, como lo quiere el JSON-RPC. */
function hex(n) {
  return "0x" + n.toString(16);
}

/** Una dirección de 20 bytes, rellenada a 32 para los datos de la llamada. */
function relleno32(direccion) {
  return direccion.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

/* ── Hablar con la billetera ──────────────────────────────────────── */

async function pedir(proveedor, method, params = []) {
  return proveedor.request({ method, params });
}

/** Pide las cuentas. Es lo que abre la ventanita de la billetera. */
export async function conectar(proveedor) {
  const cuentas = await pedir(proveedor, "eth_requestAccounts");
  if (!cuentas || !cuentas.length) throw new Error("sin cuenta");
  return cuentas[0];
}

/**
 * DEJA A LA BILLETERA EN LA CADENA QUE CORRESPONDE.
 *
 * Y si no la tiene, se la agrega. Esto es lo que impide el error que no
 * tiene vuelta: firmar en BNB Smart Chain una transferencia pensada para
 * la dirección de Ethereum.
 */
export async function asegurarCadena(proveedor, clave) {
  const cadena = CADENAS[clave];
  if (!cadena) throw new Error("cadena desconocida");

  const ahora = await pedir(proveedor, "eth_chainId");
  if (String(ahora).toLowerCase() === cadena.chainId) return cadena;

  try {
    await pedir(proveedor, "wallet_switchEthereumChain", [{ chainId: cadena.chainId }]);
  } catch (err) {
    /* 4902: la billetera no conoce esa cadena. Se la pasamos entera. */
    if (err && (err.code === 4902 || err.code === -32603)) {
      await pedir(proveedor, "wallet_addEthereumChain", [{
        chainId: cadena.chainId,
        chainName: cadena.nombre,
        nativeCurrency: cadena.moneda,
        rpcUrls: cadena.rpc,
        blockExplorerUrls: [cadena.explorador],
      }]);
    } else {
      throw err;
    }
  }

  /* Y se vuelve a preguntar: que la billetera acepte el pedido no
     quiere decir que el jugador haya apretado "cambiar". */
  const despues = await pedir(proveedor, "eth_chainId");
  if (String(despues).toLowerCase() !== cadena.chainId) throw new Error("otra cadena");

  return cadena;
}

/**
 * QUE EL CONTRATO SEA EL QUE DECIMOS QUE ES.
 *
 * Le pregunta su símbolo y sus decimales a la cadena, en el momento. Si
 * no contesta lo que esperamos, no se manda nada: una dirección de
 * contrato mal copiada manda la transferencia a cualquier lado y no hay
 * forma de traerla de vuelta.
 */
export async function verificarToken(proveedor, par) {
  const pregunta = (data) => pedir(proveedor, "eth_call", [{ to: par.token, data }, "latest"]);

  const leerTexto = (crudo) => {
    const bytes = (crudo || "0x").slice(2);
    if (bytes.length === 64) {
      /* Los contratos viejos contestan un bytes32 fijo (el USDT de
         Ethereum es de esos). */
      return hexATexto(bytes).replace(/\0+$/, "");
    }
    const largo = parseInt(bytes.slice(64, 128) || "0", 16);
    return hexATexto(bytes.slice(128, 128 + largo * 2));
  };

  const simbolo = leerTexto(await pregunta("0x95d89b41")).toUpperCase();
  const decimales = parseInt(await pregunta("0x313ce567"), 16);

  const esperados = par.simbolos || [];
  if (!esperados.includes(simbolo)) throw new Error(`el contrato dice ${simbolo}`);
  if (decimales !== par.decimales) throw new Error(`decimales ${decimales}`);

  return { simbolo, decimales };
}

function hexATexto(hexa) {
  let texto = "";
  for (let i = 0; i < hexa.length; i += 2) {
    const c = parseInt(hexa.slice(i, i + 2), 16);
    if (c) texto += String.fromCharCode(c);
  }
  return texto;
}

/**
 * MANDA EL PAGO Y DEVUELVE EL HASH.
 *
 * Para la moneda nativa es una transferencia común. Para un token es una
 * llamada a `transfer(address,uint256)`, que son los cuatro bytes del
 * método más la dirección y el monto, cada uno en 32 bytes.
 *
 * No estima el gas ni arma el precio: eso lo hace la billetera, que
 * además se lo muestra al jugador antes de firmar.
 */
export async function pagar({ proveedor, ticker, red, destino, monto }) {
  const par = parDeBilletera(ticker, red);
  if (!par) throw new Error("ese par no se paga desde la billetera");

  const desde = await conectar(proveedor);
  await asegurarCadena(proveedor, par.cadena);

  if (!/^0x[a-fA-F0-9]{40}$/.test(destino)) throw new Error("direccion invalida");

  if (!par.token) {
    const unidades = aUnidades(monto, par.decimales);
    return pedir(proveedor, "eth_sendTransaction", [{
      from: desde,
      to: destino,
      value: hex(unidades),
    }]);
  }

  await verificarToken(proveedor, par);

  const unidades = aUnidades(monto, par.decimales);
  const datos = "0xa9059cbb" + relleno32(destino) + unidades.toString(16).padStart(64, "0");

  return pedir(proveedor, "eth_sendTransaction", [{
    from: desde,
    to: par.token,
    data: datos,
  }]);
}

/** El enlace al explorador, para que el jugador vea su pago. */
export function enlaceDeTx(ticker, red, hash) {
  const par = parDeBilletera(ticker, red);
  return par && par.red ? `${par.red.explorador}/tx/${hash}` : "";
}
