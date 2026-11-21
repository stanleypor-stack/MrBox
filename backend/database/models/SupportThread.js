const mongoose = require("mongoose");

/**
 * UNA CONVERSACION CON SOPORTE.
 *
 * El chat del globito de abajo a la derecha y la bandeja del panel son
 * la misma cosa vista de los dos lados: esto.
 *
 * LOS MENSAJES VAN ADENTRO Y NO EN SU PROPIA COLECCION
 *
 * Una conversación de soporte tiene ocho mensajes, no ocho mil. Guardarlos
 * adentro hace que abrir una conversación sea UNA lectura --el jugador
 * abre el globito y ve todo-- en vez de dos y un `populate`. El tope de
 * 300 existe para que eso siga siendo cierto el día que alguien escriba
 * doscientas veces seguidas.
 *
 * EL ESTADO LO MUEVE QUIEN ESCRIBE
 *
 * Escribe el jugador y queda "waiting_us"; contesta el equipo y queda
 * "waiting_player". Así la bandeja se ordena sola por lo que falta
 * contestar, sin que nadie tenga que acordarse de marcar nada.
 */

const TOPE_DE_MENSAJES = 300;

const mensajeSchema = new mongoose.Schema(
  {
    /* Quién lo escribió. Se guarda el id además del lado para poder
       decir "contestó sol" en el registro del panel. */
    deAdmin: { type: Boolean, default: false },
    autor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    nombre: { type: String, default: "" },

    texto: { type: String, required: true, trim: true, maxlength: 4000 },

    /*
      Algunos mensajes no los escribe nadie: la respuesta automática.
      Se guarda como CODIGO y no como frase para que cada uno la lea en
      su idioma, igual que los errores (ver utils/errors.js).
    */
    codigo: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const supportThreadSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    /* Lo primero que escribió, recortado. Es el título de la lista. */
    asunto: { type: String, default: "", trim: true, maxlength: 120 },

    estado: {
      type: String,
      enum: ["waiting_us", "waiting_player", "closed"],
      default: "waiting_us",
      index: true,
    },

    /* Quién del equipo lo tomó. Vacío es "sin asignar". */
    asignado: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },

    mensajes: { type: [mensajeSchema], default: [] },

    /* Para ordenar la bandeja sin mirar adentro de cada conversación. */
    ultimoMensajeEl: { type: Date, default: Date.now, index: true },
    ultimoFueDelJugador: { type: Boolean, default: true },

    /* Para el puntito de "tenés un mensaje nuevo" de cada lado. */
    leidoPorElJugadorEl: { type: Date, default: null },
    leidoPorElEquipoEl: { type: Date, default: null },

    /**
     * EL BORRADOR QUE ESCRIBIO LA IA.
     *
     * Es una PROPUESTA: no se le muestra al jugador ni se manda sola.
     * Vive acá y no en `mensajes` justamente por eso --un mensaje es
     * algo que alguien dijo-- y porque así se puede rehacer sin dejar
     * basura en la conversación.
     *
     * Se guarda uno solo, el último. Rehacerlo pisa el anterior: el
     * del equipo quiere la mejor propuesta, no el historial de
     * intentos.
     */
    borradorIa: {
      texto: { type: String, default: "" },
      confianza: { type: Number, default: 0 },
      categoria: { type: String, default: "" },
      derivar: { type: Boolean, default: false },
      motivo: { type: String, default: "" },
      modelo: { type: String, default: "" },
      /* Cuántos mensajes tenía la conversación cuando se escribió: si
         después llegó otro, el borrador quedó viejo y el panel lo
         dice en vez de mostrarlo como si estuviera al día. */
      sobreMensajes: { type: Number, default: 0 },
      creadoEl: { type: Date, default: null },
      /* Quién lo pidió, para poder preguntarle. */
      pedidoPor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    },
  },
  { timestamps: true }
);

/* La bandeja: lo que falta contestar primero, y lo más fresco arriba. */
supportThreadSchema.index({ estado: 1, ultimoMensajeEl: -1 });
supportThreadSchema.index({ user: 1, ultimoMensajeEl: -1 });

/**
 * Agrega un mensaje y mueve el estado.
 *
 * No guarda: devuelve el documento para que quien llama decida cuándo.
 * Así una respuesta del equipo que además asigna la conversación es UN
 * guardado y no dos.
 */
supportThreadSchema.methods.agregar = function agregar(mensaje) {
  this.mensajes.push(mensaje);
  if (this.mensajes.length > TOPE_DE_MENSAJES) {
    this.mensajes = this.mensajes.slice(-TOPE_DE_MENSAJES);
  }

  /* La respuesta automática no cambia de quién es el turno: la escribe
     el sistema, no una persona, y la conversación sigue esperándonos. */
  if (!mensaje.codigo) {
    this.ultimoMensajeEl = new Date();
    this.ultimoFueDelJugador = !mensaje.deAdmin;
    if (this.estado !== "closed" || !mensaje.deAdmin) {
      this.estado = mensaje.deAdmin ? "waiting_player" : "waiting_us";
    }
  }

  return this;
};

module.exports = mongoose.model("SupportThread", supportThreadSchema);
module.exports.TOPE_DE_MENSAJES = TOPE_DE_MENSAJES;
