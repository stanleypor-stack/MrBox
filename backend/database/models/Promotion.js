const mongoose = require("mongoose");

/**
 * UNA PROMOCION.
 *
 * Las tarjetas de la pantalla Promotions. Las carga el panel y las
 * muestra el sitio; no hay ninguna escrita en el código, a propósito:
 * una promo que vence un domingo no puede necesitar un despliegue para
 * apagarse.
 *
 * EL TEXTO VIVE ACA, NO EN LOS IDIOMAS
 *
 * Es la única parte del sitio donde eso es así, y es deliberado: una
 * promo la escribe quien hace marketing, no quien traduce, y cambia
 * cada semana. Por eso cada campo guarda un objeto { en, es, ... } y la
 * pantalla elige el idioma, cayendo al inglés si falta.
 *
 * Lo demás --botones, errores, títulos-- sigue viviendo en los nueve
 * archivos de idioma, porque eso sí cambia una vez al año.
 */
const textoMultiple = {
  type: Map,
  of: String,
  default: () => new Map(),
};

const promotionSchema = new mongoose.Schema(
  {
    /* Para encontrarla en el panel y para los informes. */
    clave: { type: String, required: true, unique: true, trim: true, lowercase: true },

    titulo: textoMultiple,
    texto: textoMultiple,
    boton: textoMultiple,

    /* Las cuatro líneas del arte, como en el diseño. */
    arte: {
      kicker: textoMultiple,
      linea1: textoMultiple,
      linea2: textoMultiple,
      fondo: { type: String, default: "#14306a" },
      acento: { type: String, default: "#ffc83d" },
      /* Dos recortes de la lámina de cajas, para el dibujo. */
      pos1: { type: String, default: "" },
      pos2: { type: String, default: "" },
    },

    /* Adónde lleva el botón. Una dirección del sitio, no de afuera. */
    destino: { type: String, default: "/boxes" },

    /* La ventana en la que se muestra. `null` es "sin límite". */
    desde: { type: Date, default: null },
    hasta: { type: Date, default: null },

    activa: { type: Boolean, default: true, index: true },
    orden: { type: Number, default: 0 },
  },
  { timestamps: true }
);

promotionSchema.index({ activa: 1, orden: 1 });

/** Si hay que mostrarla ahora mismo. */
promotionSchema.methods.vigente = function vigente(momento = new Date()) {
  if (!this.activa) return false;
  if (this.desde && momento < this.desde) return false;
  if (this.hasta && momento >= this.hasta) return false;
  return true;
};

module.exports = mongoose.model("Promotion", promotionSchema);
