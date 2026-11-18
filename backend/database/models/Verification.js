const mongoose = require("mongoose");

/**
 * LO QUE EL JUGADOR MANDA PARA VERIFICARSE.
 *
 * Tres niveles, y cada uno es una fila acá:
 *
 *   1. quién dice ser: nombre, apellido, fecha de nacimiento
 *   2. que lo pruebe: un documento oficial y su foto
 *   3. dónde vive: la dirección y una factura o resumen a su nombre
 *
 * Cada nivel se manda, se revisa y se aprueba por separado. No se
 * guardan en el usuario porque el usuario es una fila que se lee en
 * cada pedido del sitio, y esto son datos sensibles que casi nunca
 * hacen falta.
 *
 * LO QUE HAY ACA ADENTRO ES LO MAS DELICADO DEL SITIO
 *
 * El nombre real, la fecha de nacimiento, el número de documento, la
 * foto del documento y la dirección de una persona. Por eso:
 *
 *   - `datos` y `archivos` son `select: false`: no salen de la base si
 *     no los piden por su nombre. Un `find()` distraído no los arrastra
 *     a una respuesta.
 *
 *   - la API NUNCA devuelve `archivos` al jugador ni al panel por esta
 *     vía: el panel los pide por una ruta propia que deja rastro de
 *     quién los miró.
 *
 *   - al aprobar o rechazar, los archivos se borran. Cumplida su
 *     función, guardar la foto del pasaporte de alguien es solo esperar
 *     a que te la roben.
 *
 * ANTES DE SALIR AL AIRE
 *
 * Los archivos van en un depósito aparte y cifrado, no en un campo de
 * la base. Acá van en `data:` porque con una base local y diez cuentas
 * de prueba alcanza, y porque la pieza que falta --el depósito-- se
 * enchufa sin cambiar nada de lo de arriba.
 */
const verificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    nivel: { type: Number, required: true, min: 1, max: 3, index: true },

    estado: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },

    /* Los campos del formulario de ese nivel. Ver VF en el diseño. */
    datos: { type: mongoose.Schema.Types.Mixed, default: {}, select: false },

    /* Las fotos, en `data:`. Ver arriba. */
    archivos: {
      type: [{
        campo: String,
        nombre: String,
        tipo: String,
        tamano: Number,
        contenido: String,
      }],
      default: [],
      select: false,
    },

    /* Para contarle al jugador qué subió, sin devolverle el archivo. */
    adjuntos: {
      type: [{ campo: String, nombre: String, tamano: Number }],
      default: [],
    },

    /* Quién lo miró y qué dijo. */
    revisadoPor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    revisadoEl: { type: Date, default: null },
    motivo: { type: String, default: "" },
  },
  { timestamps: true }
);

/* Un jugador tiene una sola fila por nivel: mandar de nuevo pisa la
   anterior en vez de apilar diez intentos que alguien tiene que leer. */
verificationSchema.index({ user: 1, nivel: 1 }, { unique: true });

/* La cola del panel: lo más viejo primero. */
verificationSchema.index({ estado: 1, createdAt: 1 });

module.exports = mongoose.model("Verification", verificationSchema);
