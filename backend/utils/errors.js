/**
 * LOS ERRORES QUE VE EL JUGADOR.
 *
 * MR BOX va a estar en varios idiomas, así que el servidor NO puede
 * mandar frases hechas. Si manda "Not enough coins.", esa frase está en
 * inglés para siempre y para todos.
 *
 * Entonces cada error lleva un CODIGO estable —`NOT_ENOUGH_COINS`— y la
 * pantalla decide cómo se dice eso en el idioma del que está mirando. El
 * código no cambia nunca aunque el texto cambie mil veces.
 *
 * El `message` en inglés que viaja igual NO es para mostrar: es para los
 * registros del servidor y para cuando alguien mira la respuesta cruda.
 * Si una pantalla no conoce un código nuevo, lo muestra como último
 * recurso, que es mejor que un espacio en blanco.
 *
 * LOS DATOS VAN APARTE
 *
 * "No te alcanza: te faltan SC 4,20" no se arma acá. Acá va
 * `{ code: 'NOT_ENOUGH_COINS', data: { faltan: 4.2 } }` y la traducción
 * del idioma pone el número donde va. En alemán el número va en otro
 * lugar de la frase, y eso solo funciona si el texto y el dato viajan
 * separados.
 */

/** Los códigos que existen. Tenerlos en una lista evita inventar uno al vuelo. */
const CODIGOS = {
  /* Cuenta */
  NOT_LOGGED_IN: "You need to be signed in.",
  SESSION_EXPIRED: "Your session expired.",
  ACCOUNT_BANNED: "This account is closed.",
  USERNAME_TAKEN: "That username is taken.",
  EMAIL_TAKEN: "That email is already registered.",
  BAD_CREDENTIALS: "Wrong email or password.",
  GOOGLE_FAILED: "We could not check that Google account. Try again.",
  GOOGLE_NO_EMAIL: "That Google account has no verified email, so we cannot open an account with it.",
  CAPTCHA_FAILED: "The captcha check did not pass.",

  /* Plata */
  NOT_ENOUGH_COINS: "You do not have enough coins.",
  INVALID_AMOUNT: "That amount is not valid.",
  BELOW_MINIMUM: "That is below the minimum.",
  ABOVE_MAXIMUM: "That is above the maximum.",

  /* Verificación */
  VERIFICATION_REQUIRED: "You need to verify your account first.",
  VERIFICATION_LEVEL_TOO_LOW: "Your verification level is not high enough.",
  REDEMPTION_LOCKED: "Redemptions are on hold for this account.",
  SHIPPING_LOCKED: "Shipping is on hold for this account.",
  PROMOS_LOCKED: "Promotions are on hold for this account.",

  /* Cajas */
  BOX_NOT_FOUND: "That box does not exist.",
  CATALOG_ITEM_NOT_FOUND: "That item is not in the catalogue.",
  INVALID_FORM: "Check the form: {detalle}",
  BOX_NOT_LIVE: "That box is not available right now.",
  BOX_HAS_NO_PRIZES: "That box has no items.",
  TOO_MANY_AT_ONCE: "You cannot open that many at once.",
  NO_SEED: "No seed to play with.",
  GAMES_OFF: "Games are closed right now.",
  ROUND_OPEN: "You already have a round going.",
  NO_ROUND: "That round is not open.",
  ROUND_CLOSED: "Betting for this round is closed.",

  /* VIP y rakeback */
  RANK_TOO_LOW: "Your rank does not unlock that yet.",
  NOTHING_TO_CLAIM: "There is nothing to claim yet.",
  ALREADY_CLAIMED: "You already claimed that one.",

  /* Panel */
  REASON_REQUIRED: "A reason is required.",
  /* El que aprobo un canje no puede ser el que lo paga. */
  NEEDS_SECOND_PAIR_OF_EYES: "Someone else has to pay this one: you approved it.",
  NOT_ON_YOURSELF: "You cannot do that to your own account.",
  TRACKING_REQUIRED: "A carrier and a tracking number are required.",

  /* Carreras */
  RACE_NOT_FOUND: "That race does not exist.",
  RACE_SETTLED: "That race is already closed.",
  RACE_LIVE: "That race has not closed yet.",

  /* Limites que se puso el jugador */
  ON_A_BREAK: "You are on a break.",
  DAILY_PLAY_LIMIT: "You reached your daily play limit.",
  DAILY_LOSS_LIMIT: "You reached your daily loss limit.",

  /* Verificacion */
  ALREADY_VERIFIED: "You already passed that level.",
  ALREADY_IN_REVIEW: "That level is already being reviewed.",
  FINISH_PREVIOUS_LEVEL: "Finish the previous level first.",
  TOO_YOUNG: "You need to be of legal age.",
  BAD_FILE_TYPE: "That file type is not accepted.",
  FILE_TOO_BIG: "That file is too big.",

  /* Envios */
  NO_ADDRESS: "You need a shipping address first.",
  ADDRESS_NOT_FOUND: "That address does not exist.",
  NOTHING_TO_SHIP: "There is nothing to ship.",
  NO_DEMOS_LEFT: "You have used your free demo opens.",

  /* El borrador de soporte. Son del panel, no los ve un jugador. */
  FILE_NOT_FOUND: "That file is not on this submission any more.",

  AI_OFF: "The support assistant is off: no API key is configured.",
  AI_REFUSED: "The model declined to draft a reply to this one.",
  AI_BAD_OUTPUT: "The model answered with something that is not a draft.",
  AI_AUTH: "The API key is missing or no longer valid. Ask whoever runs the server.",
  AI_BUSY: "Too many drafts at once. Wait a few seconds and try again.",
  AI_UNREACHABLE: "Could not reach the model. Answer by hand this time.",
  AI_FAILED: "The model failed ({estado}). Answer by hand this time.",

  /* Cajas de la comunidad */
  BOX_NOT_VALID: "That box does not add up.",
  TOO_FEW_ITEMS: "That box needs more items.",
  TOO_MANY_ITEMS: "That box has too many items.",
  DUPLICATE_ITEM: "The same item is in the box twice.",
  TOO_MANY_BOXES: "You already have too many boxes.",

  /* Inventario */
  ITEM_NOT_FOUND: "That item is not in your inventory.",
  ITEM_ALREADY_GONE: "You already sold or shipped that item.",
  ITEM_NOT_SHIPPABLE: "That item cannot be shipped.",

  /* Afiliados y códigos */
  CODE_NOT_FOUND: "That code does not exist.",
  CODE_EXPIRED: "That code expired.",
  CODE_ALREADY_USED: "You already used that code.",
  OWN_CODE: "You cannot use your own code.",
  CODE_TAKEN: "Someone is already using that code.",
  CODE_TOO_SHORT: "That code is too short.",
  MODEL_NOT_OPEN: "That payout model is not open right now.",
  TOO_MANY_CAMPAIGNS: "You already have the most campaigns we allow.",
  RANK_ALREADY_ASKED: "You already asked for a review. We are on it.",

  /* Soporte */
  MESSAGE_REQUIRED: "Write a message first.",
  TOO_MANY_THREADS: "You have too many open conversations.",
  TOO_MANY_REDEMPTIONS: "You already have {maximo} cash outs waiting. Wait for one to be paid before asking for another.",

  /* General */
  NOT_FOUND: "That does not exist.",
  RATE_LIMITED: "Too many tries. Wait a moment.",
  SOMETHING_WENT_WRONG: "Something went wrong.",
};

/**
 * Un error que la pantalla puede traducir.
 *
 * Se usa `throw errorDe('NOT_ENOUGH_COINS', { faltan: 4.2 })` y la capa de
 * rutas lo convierte en la respuesta.
 */
class ErrorDeJugador extends Error {
  constructor(code, data = {}, status = 400) {
    const mensaje = CODIGOS[code] || CODIGOS.SOMETHING_WENT_WRONG;
    super(mensaje);
    this.name = "ErrorDeJugador";
    this.code = CODIGOS[code] ? code : "SOMETHING_WENT_WRONG";
    this.data = data;
    this.status = status;
    /* Que no se escape un código inventado sin que nadie lo note. */
    this.codigoDesconocido = !CODIGOS[code] ? String(code) : null;
  }

  /** Lo que se le manda al navegador. */
  aRespuesta() {
    return { success: false, code: this.code, message: this.message, data: this.data };
  }
}

function errorDe(code, data = {}, status = 400) {
  return new ErrorDeJugador(code, data, status);
}

/** Si un error es de los nuestros o se nos escapó algo inesperado. */
function esDeJugador(err) {
  return err instanceof ErrorDeJugador;
}

module.exports = { CODIGOS, ErrorDeJugador, errorDe, esDeJugador };
