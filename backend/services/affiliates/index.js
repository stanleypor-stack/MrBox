/**
 * LOS AFILIADOS.
 *
 * Tres momentos, y cada uno hace una cosa sola:
 *
 *   1. ALGUIEN SE REGISTRA con un código → queda atado al socio, para
 *      siempre. El lazo se arma una vez y no se toca más: si se pudiera
 *      cambiar después, cualquiera se cambia al código que más le
 *      conviene justo antes de un depósito grande.
 *
 *   2. ALGUIEN COMPRA → se le suma el bono (5% o 10%). Lo paga la casa,
 *      no el socio.
 *
 *   3. ALGUIEN JUEGA → el socio se lleva su parte DEL MARGEN que dejó esa
 *      jugada. No de lo jugado. Ver el comentario del modelo: la
 *      diferencia es la que funde el sitio.
 */

const AffiliateCode = require("../../database/models/AffiliateCode");
const Settings = require("../../database/models/Settings");
const User = require("../../database/models/User");
const wallet = require("../wallet");
const { sc } = require("../../utils/money");
const { errorDe } = require("../../utils/errors");

/** Busca un código, sin importar cómo lo hayan escrito. */
/**
 * LOS OCHO TRAMOS DEL PROTOTIPO.
 *
 * El socio sube de tramo con lo que juegan los suyos, y nunca baja: el
 * volumen es de toda la vida, como el rango VIP.
 *
 * SOBRE QUE SE PAGA ESE PORCENTAJE
 *
 * Sobre el MARGEN que dejan sus jugadores, no sobre lo que juegan.
 * Importa: la casa se queda con el 8% de lo jugado, asi que pagar "15%
 * de cada apuesta" seria pagar casi el doble de lo que entra. Sobre el
 * margen, el tramo VIII paga 15 centavos de cada peso que la casa gana
 * con esos jugadores, que es un trato bueno y que ademas existe.
 *
 * El porcentaje de un codigo se puede fijar a mano desde el panel
 * (`comision`), y en ese caso manda el del codigo: hay socios grandes
 * que negocian su numero.
 */
const TRAMOS = [
  { nombre: "Tier I", pct: 0.05, desdeSc: 0 },
  { nombre: "Tier II", pct: 0.06, desdeSc: 10000 },
  { nombre: "Tier III", pct: 0.07, desdeSc: 50000 },
  { nombre: "Tier IV", pct: 0.08, desdeSc: 100000 },
  { nombre: "Tier V", pct: 0.09, desdeSc: 250000 },
  { nombre: "Tier VI", pct: 0.1, desdeSc: 500000 },
  { nombre: "Tier VII", pct: 0.12, desdeSc: 1000000 },
  { nombre: "Tier VIII", pct: 0.15, desdeSc: 2500000 },
];

/** En qué tramo cae un código, por lo que jugaron los suyos. */
function tramoDe(jugadoPorLosSuyosSc) {
  const jugado = Number(jugadoPorLosSuyosSc) || 0;
  let i = 0;
  for (let k = 0; k < TRAMOS.length; k += 1) if (jugado >= TRAMOS[k].desdeSc) i = k;

  const siguiente = i < TRAMOS.length - 1 ? TRAMOS[i + 1] : null;
  const desde = TRAMOS[i].desdeSc;
  const hasta = siguiente ? siguiente.desdeSc : desde;

  return {
    ...TRAMOS[i],
    numero: i + 1,
    deCuantos: TRAMOS.length,
    siguiente,
    faltaSc: siguiente ? sc(Math.max(0, hasta - jugado)) : 0,
    progreso: siguiente && hasta > desde
      ? Math.max(0, Math.min(100, Math.round(((jugado - desde) / (hasta - desde)) * 1000) / 10))
      : 100,
  };
}

/** Lo que cobra ese código: lo suyo si se lo fijaron, o su tramo. */
function comisionDe(codigo) {
  if (codigo && Number(codigo.comision) > 0) return Number(codigo.comision);
  return tramoDe(codigo && codigo.jugadoPorLosSuyosSc).pct;
}

async function buscarCodigo(texto) {
  const code = String(texto || "").trim().toUpperCase();
  if (!code) return null;
  return AffiliateCode.findOne({ code }).populate("owner", "username").exec();
}

/**
 * El porcentaje de bono que da un código.
 *
 * El del código si tiene uno propio; si no, el del tramo.
 */
async function bonoDe(codigo, settings = null) {
  if (!codigo) return 0;
  if (codigo.bonoPropio !== null && codigo.bonoPropio !== undefined) {
    return Number(codigo.bonoPropio) || 0;
  }
  const cfg = settings || (await Settings.leer());
  const bonos = (cfg && cfg.bonoPorDeposito) || {};
  return Number(bonos[codigo.tramo] || bonos.normal || 0);
}

/**
 * Ata a un jugador recién registrado con el socio que lo trajo.
 *
 * Devuelve el código usado, o `null` si no puso ninguno. Que un código
 * no exista NO rompe el registro: es un error del jugador escribiendo,
 * no una razón para no dejarlo entrar. Se avisa y se sigue.
 */
async function atarAlSocio(usuario, textoDelCodigo) {
  const codigo = await buscarCodigo(textoDelCodigo);
  if (!codigo || !codigo.sirve()) return null;

  /* Nadie se trae a sí mismo. Es el autofraude más viejo que hay. */
  if (String(codigo.owner && codigo.owner._id) === String(usuario._id)) return null;

  await User.updateOne(
    { _id: usuario._id, referredBy: null },
    { $set: { referredBy: codigo.owner._id, affiliateCode: codigo.code } }
  );
  await AffiliateCode.updateOne({ _id: codigo._id }, { $inc: { jugadores: 1 } });

  return codigo;
}

/**
 * El bono que le toca a una compra.
 *
 * Devuelve `{ bonoSc, codigo }`. No acredita nada: eso lo hace quien
 * confirma la compra, para que el saldo y el bono se muevan juntos.
 */
async function bonoDeCompra(usuario, montoSc) {
  const monto = sc(montoSc);
  if (!(monto > 0) || !usuario || !usuario.affiliateCode) return { bonoSc: 0, codigo: null };

  const codigo = await buscarCodigo(usuario.affiliateCode);
  if (!codigo || !codigo.sirve()) return { bonoSc: 0, codigo: null };

  const porcentaje = await bonoDe(codigo);
  return { bonoSc: sc(monto * porcentaje), codigo, porcentaje };
}

/**
 * Le anota al socio lo que le dejó una jugada de uno de los suyos.
 *
 * `margenSc` es lo que la casa ganó con esa jugada, no lo que se jugó.
 * Para una caja: precio menos lo que pagó en premios.
 *
 * NO MUEVE EL SALDO DEL SOCIO. Lo anota como ganado, y el socio lo cobra
 * cuando quiere. Acreditarlo al instante dejaría el saldo del socio
 * subiendo solo cada vez que alguien abre una caja, y eso convierte el
 * libro de movimientos en algo ilegible.
 */
async function anotarComision({ jugador, jugadoSc, margenSc }) {
  if (!jugador || !jugador.affiliateCode) return null;

  const jugado = sc(jugadoSc);
  const margen = sc(margenSc);
  if (!(jugado > 0)) return null;

  const codigo = await AffiliateCode.findOne({ code: jugador.affiliateCode });
  if (!codigo) return null;

  /*
    Una jugada puede dejar margen NEGATIVO: el jugador se llevó un premio
    más caro que la caja. Eso es normal y se compensa con las demás. Lo
    que no corresponde es descontárselo al socio, que no tiene control
    sobre la suerte de nadie: la comisión de una jugada perdedora es
    cero, no negativa.
  */
  const ganado = margen > 0 ? sc(margen * comisionDe(codigo)) : 0;

  await AffiliateCode.updateOne(
    { _id: codigo._id },
    { $inc: { jugadoPorLosSuyosSc: jugado, ganadoSc: ganado } }
  );

  return { ganado, codigo: codigo.code };
}

/**
 * El socio cobra lo que tiene ganado.
 *
 * Mueve de "ganado" a "cobrado" y le acredita el saldo, las dos cosas
 * atadas: el `$inc` con la condición adentro impide que dos pedidos al
 * mismo tiempo cobren lo mismo dos veces.
 */
async function cobrar({ userId, codigoId }) {
  const codigo = await AffiliateCode.findOne({ _id: codigoId, owner: userId });
  if (!codigo) throw errorDe("CODE_NOT_FOUND");

  const porCobrar = sc((codigo.ganadoSc || 0) - (codigo.cobradoSc || 0));
  if (!(porCobrar > 0)) throw errorDe("BELOW_MINIMUM", { porCobrar });

  /*
    La condición va en el filtro: si entran dos pedidos juntos, el
    segundo no encuentra documento y no cobra de nuevo. Mismo criterio
    que la billetera.
  */
  const movido = await AffiliateCode.findOneAndUpdate(
    { _id: codigo._id, cobradoSc: codigo.cobradoSc },
    { $inc: { cobradoSc: porCobrar } },
    { new: true }
  );
  if (!movido) throw errorDe("SOMETHING_WENT_WRONG");

  try {
    await wallet.mover({
      userId,
      amountSc: porCobrar,
      type: "affiliate",
      reference: { kind: "affiliateCode", id: codigo._id, label: codigo.code },
    });
  } catch (err) {
    /* Si el saldo no se pudo mover, devolver lo cobrado: si no, el socio
       pierde la plata y el contador dice que ya la cobró. */
    await AffiliateCode.updateOne({ _id: codigo._id }, { $inc: { cobradoSc: -porCobrar } });
    throw err;
  }

  return { cobradoSc: porCobrar };
}

module.exports = {
  TRAMOS,
  tramoDe,
  comisionDe,
  buscarCodigo,
  bonoDe,
  atarAlSocio,
  bonoDeCompra,
  anotarComision,
  cobrar,
};
