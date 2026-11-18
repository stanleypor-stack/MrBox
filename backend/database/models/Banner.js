const mongoose = require("mongoose");

/**
 * UN BANNER DE LA PORTADA.
 *
 * Los cuatro que giran arriba de todo. Viven en la base y no en el
 * código del sitio por una razón concreta: cambiarlos es lo que más se
 * hace --una campaña dura dos semanas-- y pasar por un despliegue para
 * cambiar una imagen es lo que termina con banners viejos puestos.
 *
 * EL TEXTO ES UNA CLAVE DE IDIOMA, NO UNA FRASE
 *
 * `titulo` guarda `banners.rewardTitle`, no "50K REWARD". El sitio está
 * en nueve idiomas y una frase guardada acá se vería en inglés para
 * todos. El arte sí lleva su texto adentro --es una imagen-- y por eso
 * en el teléfono, donde la foto se recorta, el sitio escribe el título
 * encima con la traducción.
 */

const bannerSchema = new mongoose.Schema(
  {
    /* Para reconocerlo en el panel y en el código. */
    clave: { type: String, required: true, unique: true, trim: true },

    /* La imagen, tal cual se sirve. */
    foto: { type: String, required: true, trim: true },

    /* Claves de idioma (ver frontend/src/i18n). */
    titulo: { type: String, default: "", trim: true },
    sub: { type: String, default: "", trim: true },
    cta: { type: String, default: "", trim: true },

    /* A dónde lleva. Una dirección del sitio, no una externa. */
    destino: { type: String, default: "/boxes", trim: true },

    orden: { type: Number, default: 0 },
    visible: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

bannerSchema.index({ visible: 1, orden: 1 });

module.exports = mongoose.model("Banner", bannerSchema);
