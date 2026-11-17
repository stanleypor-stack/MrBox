/**
 * LA ECONOMIA DE UNA CAJA.
 *
 * Acá vive la única cuenta que de verdad importa en todo el sitio: cuánto
 * sale abrir una caja.
 *
 * EN QUE SE DIFERENCIA DE BETSWEEPS
 *
 * En BetSweeps un premio es un MULTIPLICADOR del precio ("te llevás 3,5
 * veces lo que pusiste"), así que el retorno de la caja no depende del
 * precio y el precio se elige a mano.
 *
 * Acá no. Un premio de MR BOX es un OBJETO DE VERDAD con un valor propio:
 * un iPhone sale SC 1.277,29 y no cambia porque la caja sea barata o cara.
 * Entonces la flecha va al revés: primero se eligen los objetos y sus
 * chances, y de ahí SALE el precio.
 *
 *     lo que la caja paga en promedio  =  suma( valor_i x chance_i )
 *     precio                           =  eso / retorno objetivo
 *
 * Con el retorno en 92%, una caja que paga SC 12,62 en promedio sale
 * SC 13,72. De cada SC 100 que entran, SC 92 vuelven en objetos y SC 8
 * se los queda la casa.
 *
 * POR QUE EL PRECIO NO SE ESCRIBE A MANO
 *
 * Porque una caja mal preciada no avisa. Si alguien carga los objetos y
 * después pone el precio a ojo, la caja puede quedar pagando más de lo que
 * cobra y nadie se entera hasta que el mes cierra en rojo. Calculándolo,
 * el error es imposible por construcción: el precio SIEMPRE corresponde a
 * los objetos que tiene adentro.
 *
 * El admin igual puede fijar un precio a mano (una caja de promoción, por
 * ejemplo), pero entonces `retornoReal()` le dice qué retorno le quedó y
 * `revisarCaja()` le avisa si se pasó de la raya.
 */

const { sc } = require("../../utils/money");

/** El retorno que apunta el sitio. Se puede cambiar en Admin → Settings. */
const RETORNO_OBJETIVO = 0.92;

/**
 * Cuánto se tolera que las chances no sumen exactamente 1.
 *
 * Las chances se cargan en porcentaje con dos decimales, así que la suma
 * arrastra error de coma flotante. Una millonésima es holgado para eso y
 * sigue siendo mucho más chico que cualquier error de carga de verdad.
 */
const TOLERANCIA = 1e-6;

/** Lo que avisa `revisarCaja` sin llegar a rechazar la caja. */
const RETORNO_ALTO = 0.98; // arriba de esto la casa casi no gana
const RETORNO_BAJO = 0.8; // abajo de esto la caja es dura para el jugador

/** Cuántos objetos puede tener una caja de la comunidad. */
const OBJETOS_COMUNIDAD = { min: 5, max: 20 };

/**
 * Lo que la caja paga en promedio, en SC.
 *
 * Es el valor esperado: cada objeto por la probabilidad de que salga.
 */
function pagoPromedio(premios) {
  if (!Array.isArray(premios)) return 0;
  return sc(
    premios.reduce(
      (acc, p) => acc + (Number(p.valueSc) || 0) * (Number(p.chance) || 0),
      0
    )
  );
}

/** Lo que suman las chances. Tiene que dar 1. */
function sumaDeChances(premios) {
  if (!Array.isArray(premios)) return 0;
  return premios.reduce((acc, p) => acc + (Number(p.chance) || 0), 0);
}

/**
 * El precio que le corresponde a esta lista de objetos.
 *
 * Se redondea hacia ARRIBA al centavo, no al más cercano. La diferencia es
 * medio centavo por apertura, pero siempre a favor de la casa: redondear
 * para abajo deja el retorno real por encima del objetivo, y "por encima
 * del objetivo" en una caja que se abre cien mil veces es plata que se va.
 */
function precioDe(premios, retorno = RETORNO_OBJETIVO) {
  const promedio = pagoPromedio(premios);
  const r = Number(retorno);
  if (!(promedio > 0) || !(r > 0)) return 0;
  return Math.ceil((promedio / r) * 100) / 100;
}

/**
 * El retorno que de verdad tiene una caja con el precio que tiene puesto.
 *
 * Esto es lo que hay que mirar, no el objetivo: si alguien fijó el precio
 * a mano, el objetivo es una intención y esto es el hecho.
 */
function retornoReal(premios, precio) {
  const p = Number(precio);
  if (!(p > 0)) return 0;
  return pagoPromedio(premios) / p;
}

/**
 * El margen de la casa en porcentaje, para las cuentas compartidas.
 *
 * Se redondea a seis decimales porque `(1 - 0.92) * 100` da
 * `7.9999999999999964`, no 8. Ese número viaja a la comisión del afiliado
 * y al rakeback, se guarda en reportes y se muestra en el panel: que la
 * basura de coma flotante se quede acá y no llegue a ninguna de las tres.
 * Seis decimales es un millonésimo de punto porcentual, muchísimo más fino
 * que cualquier margen que alguien vaya a configurar.
 */
function margenDeLaCasa(retorno) {
  const margen = (1 - (Number(retorno) || 0)) * 100;
  return Math.max(0, Math.round(margen * 1e6) / 1e6);
}

/**
 * Revisa una caja antes de guardarla.
 *
 * Devuelve errores (no se puede guardar) y avisos (se puede, pero mirá
 * esto). La diferencia importa: un error de chances que no suman 100% hace
 * que el sorteo sea incorrecto, mientras que un retorno del 95% es una
 * decisión comercial discutible pero válida.
 *
 * @returns {{ ok, errores, avisos, pagoPromedio, precioSugerido, retorno }}
 */
function revisarCaja(caja, opciones = {}) {
  const {
    retornoObjetivo = RETORNO_OBJETIVO,
    topePremio = Infinity,
    esDeComunidad = false,
  } = opciones;

  const errores = [];
  const avisos = [];
  const premios = Array.isArray(caja && caja.prizes) ? caja.prizes : [];

  if (premios.length === 0) {
    errores.push("A box needs at least one item.");
  }

  if (esDeComunidad) {
    const { min, max } = OBJETOS_COMUNIDAD;
    if (premios.length > 0 && premios.length < min) {
      errores.push(`A community box needs at least ${min} items.`);
    }
    if (premios.length > max) {
      errores.push(`A community box can hold at most ${max} items.`);
    }
  }

  premios.forEach((p, i) => {
    const nombre = (p && p.name) || `#${i + 1}`;

    if (!p || !p.item) {
      errores.push(`Item #${i + 1} is not linked to the catalogue.`);
    }

    const valor = Number(p && p.valueSc);
    if (!Number.isFinite(valor) || valor <= 0) {
      errores.push(`"${nombre}" has no worth.`);
    } else if (valor > topePremio) {
      errores.push(
        `"${nombre}" is worth SC ${valor.toFixed(2)}, over the payout cap.`
      );
    }

    const chance = Number(p && p.chance);
    if (!Number.isFinite(chance) || chance <= 0 || chance > 1) {
      errores.push(`"${nombre}" has an invalid chance: it must be above 0% and at most 100%.`);
    }
  });

  /*
    LAS CHANCES TIENEN QUE SUMAR 100%.

    No es una formalidad. El sorteo recorre los premios sumando chances
    hasta pasar el número sorteado; si suman 95%, el 5% de las aperturas
    cae en un hueco y se lleva el último premio de la lista, que es el que
    quedó ahí por casualidad. Y si suman 105%, los últimos de la lista no
    salen NUNCA.
  */
  const suma = sumaDeChances(premios);
  if (premios.length > 0 && Math.abs(suma - 1) > TOLERANCIA) {
    errores.push(
      `The chances add up to ${(suma * 100).toFixed(4)}%. They have to add up to 100%.`
    );
  }

  const promedio = pagoPromedio(premios);
  const precioSugerido = precioDe(premios, retornoObjetivo);

  /* Si tiene precio puesto a mano, se mide contra ese. Si no, contra el calculado. */
  const precio = Number(caja && caja.priceSc) > 0 ? Number(caja.priceSc) : precioSugerido;
  const retorno = retornoReal(premios, precio);

  if (errores.length === 0) {
    if (retorno > RETORNO_ALTO) {
      avisos.push(
        `Players get back ${(retorno * 100).toFixed(2)}%, above ${RETORNO_ALTO * 100}%: this box leaves the house almost nothing.`
      );
    }
    if (retorno < RETORNO_BAJO) {
      avisos.push(
        `Players get back ${(retorno * 100).toFixed(2)}%, below ${RETORNO_BAJO * 100}%: this box is harsh on players.`
      );
    }
    if (retorno > 1) {
      /* Esto sí es grave y va aparte del aviso de arriba: la caja pierde
         plata en cada apertura, y cuanto mejor le va, peor. */
      avisos.push(
        `This box pays out MORE than it charges (${(retorno * 100).toFixed(2)}%): every opening loses money.`
      );
    }
  }

  return {
    ok: errores.length === 0,
    errores,
    avisos,
    pagoPromedio: promedio,
    precioSugerido,
    precio: sc(precio),
    retorno,
  };
}

module.exports = {
  RETORNO_OBJETIVO,
  TOLERANCIA,
  RETORNO_ALTO,
  RETORNO_BAJO,
  OBJETOS_COMUNIDAD,
  pagoPromedio,
  sumaDeChances,
  precioDe,
  retornoReal,
  margenDeLaCasa,
  revisarCaja,
};
