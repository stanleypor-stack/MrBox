/**
 * LAS CAJAS QUE ARMAN LOS JUGADORES.
 *
 * Un jugador elige objetos del catálogo, les pone un peso a cada uno y
 * el sitio arma la caja: las chances salen de los pesos y el precio sale
 * de las chances. Después la revisa alguien y recién ahí sale al aire.
 *
 * SE GUARDAN PESOS, NO CHANCES
 *
 * El creador escribe "este 10, este 1" y no "este 0,0917". Los pesos son
 * la forma en que una persona piensa el problema: "quiero que la remera
 * salga diez veces más seguido que la consola". Las chances salen de una
 * división y se recalculan solas cada vez que toca algo.
 *
 * Si se guardaran chances, cada vez que agrega o saca un objeto habría
 * que reescribir las de todos los demás para que vuelvan a sumar 1, y a
 * la tercera edición alguna queda mal.
 *
 * EL PRECIO NO LO ELIGE EL CREADOR
 *
 * Sale de lo que puso adentro, igual que en una caja de la casa:
 *
 *     precio = suma(valor × chance) / 0,92
 *
 * Si pudiera elegirlo, pondría un iPhone al 50% y la caja a SC 10. El
 * creador decide QUE hay adentro y CADA CUANTO sale; cuánto cuesta es
 * una consecuencia, no una opinión.
 *
 * LO QUE SE LLEVA
 *
 * La mitad del margen de cada apertura: lo que entró menos lo que salió
 * en premio. Al jugador no le cuesta un peso más --la caja devuelve el
 * mismo 92% que cualquier otra-- y la casa se queda con la otra mitad.
 * Si una apertura da pérdida porque salió el premio grande, el creador
 * cobra cero, nunca negativo.
 */

const Box = require("../../database/models/Box");
const Item = require("../../database/models/Item");
const User = require("../../database/models/User");

const eco = require("../boxes/economia");
const wallet = require("../wallet");
const { sc } = require("../../utils/money");
const { errorDe } = require("../../utils/errors");
const { logger } = require("../../utils/logger");

/** La parte del creador sobre el margen. La otra mitad es de la casa. */
const PARTE_DEL_CREADOR = 0.5;

/** Cuántas cajas puede tener un creador a la vez, en cualquier estado. */
const CAJAS_POR_CREADOR = 20;

const PESO_MIN = 0.01;
const PESO_MAX = 10000;

/**
 * De pesos a chances.
 *
 * Una división y un reparto del resto. El resto existe porque las
 * chances se redondean a seis decimales y entonces no suman 1 exacto;
 * la diferencia se le da al premio MAS BARATO, que es el que menos
 * cambia el precio de la caja.
 */
function chancesDesdePesos(pesos) {
  const limpios = pesos.map((w) => {
    const n = Number(w);
    if (!Number.isFinite(n) || n < PESO_MIN) throw errorDe("INVALID_AMOUNT", { campo: "peso" });
    if (n > PESO_MAX) throw errorDe("ABOVE_MAXIMUM", { maximo: PESO_MAX });
    return n;
  });

  const total = limpios.reduce((a, w) => a + w, 0);
  if (total <= 0) throw errorDe("INVALID_AMOUNT", { campo: "peso" });

  return limpios.map((w) => Math.round((w / total) * 1e6) / 1e6);
}

/** Le da el sobrante --o le saca el exceso-- al premio más barato. */
function cerrarEnUno(premios) {
  const suma = premios.reduce((a, p) => a + p.chance, 0);
  const falta = Math.round((1 - suma) * 1e6) / 1e6;
  if (falta === 0) return premios;

  let barato = 0;
  for (let i = 1; i < premios.length; i += 1) {
    if (premios[i].valueSc < premios[barato].valueSc) barato = i;
  }

  const ajustado = premios.slice();
  ajustado[barato] = {
    ...ajustado[barato],
    chance: Math.max(1e-6, Math.round((ajustado[barato].chance + falta) * 1e6) / 1e6),
  };
  return ajustado;
}

/**
 * Arma la lista de premios a partir de lo que mandó la pantalla.
 *
 * Los valores y los nombres se leen DEL CATALOGO, no de lo que llegó:
 * quien manda el pedido podría decir que el iPhone vale SC 2 y armar una
 * caja de SC 0,30 con un iPhone adentro.
 */
async function premiosDesdeElPedido(lista) {
  if (!Array.isArray(lista) || !lista.length) throw errorDe("BOX_HAS_NO_PRIZES");

  const { min, max } = eco.OBJETOS_COMUNIDAD;
  if (lista.length < min) throw errorDe("TOO_FEW_ITEMS", { minimo: min });
  if (lista.length > max) throw errorDe("TOO_MANY_ITEMS", { maximo: max });

  const ids = lista.map((p) => String(p.itemId || p.item || ""));
  if (new Set(ids).size !== ids.length) throw errorDe("DUPLICATE_ITEM");

  const objetos = await Item.find({ _id: { $in: ids }, active: true }).lean();
  const porId = new Map(objetos.map((o) => [String(o._id), o]));

  const chances = chancesDesdePesos(lista.map((p) => p.peso));

  const premios = lista.map((p, i) => {
    const objeto = porId.get(String(p.itemId || p.item));
    if (!objeto) throw errorDe("ITEM_NOT_FOUND", { cual: String(p.itemId || p.item) }, 404);

    return {
      item: objeto._id,
      name: objeto.name,
      valueSc: sc(objeto.valueSc),
      imageUrl: objeto.imageUrl,
      rarity: objeto.rarity,
      chance: chances[i],
      /* El peso que escribió, para poder mostrárselo tal cual cuando
         vuelva a editar. */
      peso: Number(lista[i].peso),
    };
  });

  return cerrarEnUno(premios);
}

/** Un slug que no choque con otro. */
async function slugLibre(nombre) {
  const base = String(nombre || "box")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "box";

  for (let i = 0; i < 50; i += 1) {
    const intento = i === 0 ? base : `${base}-${i + 1}`;
    if (!(await Box.exists({ slug: intento }))) return intento;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/*
  LOS ESTAMPADOS DEL CARTON.

  Es una lista cerrada a proposito. El color es libre --cualquier color
  da una caja que se entiende, porque las once superficies salen de el--
  pero el estampado lo dibuja el componente, asi que uno que no exista
  dejaria la caja sin textura y sin decir por que.
*/
const TEXTURAS = ["liso", "rayas", "lunares", "cuadros", "panal", "chispas", "carton", "cinta"];

/** Limpia la portada: nada de lo que llega se usa sin mirarlo. */
function portadaLimpia(entra, cuantosPremios) {
  const p = entra || {};
  const color = /^#[0-9a-fA-F]{6}$/.test(p.color) ? p.color : "#9b30ff";
  const textura = TEXTURAS.includes(p.textura) ? p.textura : "liso";
  const estilo = [0, 1, 2].includes(Number(p.estilo)) ? Number(p.estilo) : 2;

  const asoman = Array.isArray(p.asoman)
    ? p.asoman
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n >= 0 && n < cuantosPremios)
      .slice(0, 3)
    : [];

  /* Los corrimientos se recortan: un objeto a 400% de distancia no se
     ve, y la caja queda vacía sin que nadie entienda por qué. */
  const posiciones = {};
  if (p.posiciones && typeof p.posiciones === "object") {
    for (const [clave, valor] of Object.entries(p.posiciones)) {
      if (!Array.isArray(valor) || valor.length !== 2) continue;
      const x = Number(valor[0]);
      const y = Number(valor[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      posiciones[String(clave).slice(0, 40)] = [
        Math.max(-60, Math.min(60, Math.round(x * 10) / 10)),
        Math.max(-60, Math.min(60, Math.round(y * 10) / 10)),
      ];
    }
  }

  /*
    Los logos llegan como `data:` y se guardan así.

    No es lo que haría con cien mil cajas --ahí van a un depósito de
    archivos-- pero con dos logos de 2 MB por caja y un tope de veinte
    cajas por creador, un campo en la base alcanza y no agrega una pieza
    de infraestructura que todavía no hace falta.

    Lo que SI se revisa es que sea una imagen y que no sea enorme: un
    `data:text/html` ahí adentro es un agujero, y uno de 50 MB es una
    base que no entra en memoria.
  */
  const logo = (valor) => {
    if (typeof valor !== "string") return "";
    if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(valor)) return "";
    /* 2 MB de archivo son ~2,8 MB en base64. */
    if (valor.length > 2.9 * 1024 * 1024) return "";
    return valor;
  };

  return {
    color,
    textura,
    estilo,
    asoman,
    posiciones,
    logoIzquierdo: logo(p.logoIzquierdo),
    logoDerecho: logo(p.logoDerecho),
  };
}

/** Crea o actualiza la caja de un creador. Siempre vuelve a borrador. */
async function guardar({ user, boxId, nombre, descripcion, premios, portada }) {
  const lista = await premiosDesdeElPedido(premios);
  const revision = eco.revisarCaja({ prizes: lista }, { esDeComunidad: true });
  if (!revision.ok) throw errorDe("BOX_NOT_VALID", { errores: revision.errores });

  const precio = eco.precioDe(lista);
  const titulo = String(nombre || "").trim().slice(0, 18);
  if (titulo.length < 3) throw errorDe("INVALID_AMOUNT", { campo: "name" });

  const campos = {
    name: titulo,
    description: String(descripcion || "").trim().slice(0, 240),
    category: "Community",
    prizes: lista,
    priceSc: precio,
    pagoPromedio: revision.pagoPromedio,
    retorno: eco.retornoReal(lista, precio),
    portada: portadaLimpia(portada, lista.length),
    /*
      TOCARLA LA BAJA DEL AIRE.

      Una caja aprobada que se puede editar es una caja que se aprueba
      con medias y se publica con relojes. Cada cambio vuelve a
      borrador y hay que mandarla a revisar de nuevo.
    */
    live: false,
    approvalState: "none",
    motivoDelRechazo: "",
  };

  if (boxId) {
    const mia = await Box.findOne({ _id: boxId, creator: user._id });
    if (!mia) throw errorDe("BOX_NOT_FOUND", {}, 404);
    await Box.updateOne({ _id: mia._id }, { $set: campos });
    return Box.findById(mia._id).lean();
  }

  const cuantas = await Box.countDocuments({ creator: user._id });
  if (cuantas >= CAJAS_POR_CREADOR) throw errorDe("TOO_MANY_BOXES", { maximo: CAJAS_POR_CREADOR });

  const creada = await Box.create({
    ...campos,
    slug: await slugLibre(titulo),
    creator: user._id,
  });
  return Box.findById(creada._id).lean();
}

/** La manda a revisar. De ahí en más no se toca hasta que la miren. */
async function mandarARevisar({ user, boxId }) {
  const mia = await Box.findOne({ _id: boxId, creator: user._id }).lean();
  if (!mia) throw errorDe("BOX_NOT_FOUND", {}, 404);
  if (mia.approvalState === "pending") return mia;

  const revision = eco.revisarCaja(mia, { esDeComunidad: true });
  if (!revision.ok) throw errorDe("BOX_NOT_VALID", { errores: revision.errores });

  await Box.updateOne({ _id: mia._id }, { $set: { approvalState: "pending", motivoDelRechazo: "" } });
  return Box.findById(mia._id).lean();
}

/** Borra una caja propia. Solo si nunca salió al aire. */
async function borrar({ user, boxId }) {
  const mia = await Box.findOne({ _id: boxId, creator: user._id }).lean();
  if (!mia) throw errorDe("BOX_NOT_FOUND", {}, 404);

  /* Una caja que ya se abrió tiene recibos que la nombran: borrarla
     dejaría un historial que apunta a la nada. Se apaga, no se borra. */
  if (mia.opens > 0) {
    await Box.updateOne({ _id: mia._id }, { $set: { live: false, approvalState: "none" } });
    return { apagada: true };
  }

  await Box.deleteOne({ _id: mia._id });
  return { borrada: true };
}

/**
 * LA PARTE DEL CREADOR, DE UNA APERTURA.
 *
 * Se llama después de cobrar y sortear, con el margen de ESA apertura.
 * Va en su propio try arriba: que falle pagarle al creador no puede
 * tumbar la apertura de un jugador que ya pagó.
 */
async function pagarAlCreador({ caja, margenSc }) {
  if (!caja || !caja.creator) return null;

  const parte = sc(Math.max(0, Number(margenSc) || 0) * PARTE_DEL_CREADOR);
  if (parte <= 0) return null;

  /* Al creador no se le paga por abrir su propia caja: si no, armar una
     cara y abrirla uno mismo devuelve el 96% en vez del 92%, que es una
     forma lenta pero segura de sacarle plata a la casa. */
  await wallet.mover({
    userId: caja.creator,
    amountSc: parte,
    type: "creator_share",
    reference: { kind: "box", id: caja._id, label: caja.name },
  });

  await Box.updateOne({ _id: caja._id }, { $inc: { ganadoPorElCreadorSc: parte } });
  return parte;
}

/** Lo que ve el creador en su panel. */
async function panelDe(userId) {
  const cajas = await Box.find({ creator: userId })
    .sort({ createdAt: -1 })
    .select("slug name priceSc live approvalState motivoDelRechazo opens ganadoPorElCreadorSc portada prizes retorno createdAt")
    .lean();

  const total = cajas.reduce(
    (acc, c) => ({
      cajas: acc.cajas + 1,
      alAire: acc.alAire + (c.live ? 1 : 0),
      aperturas: acc.aperturas + (c.opens || 0),
      ganadoSc: sc(acc.ganadoSc + (c.ganadoPorElCreadorSc || 0)),
    }),
    { cajas: 0, alAire: 0, aperturas: 0, ganadoSc: 0 }
  );

  return { cajas, total, parte: PARTE_DEL_CREADOR, tope: CAJAS_POR_CREADOR };
}

module.exports = {
  PARTE_DEL_CREADOR,
  CAJAS_POR_CREADOR,
  chancesDesdePesos,
  cerrarEnUno,
  premiosDesdeElPedido,
  guardar,
  mandarARevisar,
  borrar,
  pagarAlCreador,
  panelDe,
};
