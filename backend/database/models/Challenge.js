const mongoose = require("mongoose");

/**
 * UN DESAFIO DEL DIA.
 *
 * "Sacá 50x en la Junk Box y llevate SC 100. Hay diez premios."
 *
 * El jugador no se anota ni reclama nada: abre la caja y, si pegó, el
 * premio se le acredita en esa misma apertura. Un desafío que hay que
 * reclamar es un desafío que la mitad de la gente gana y nunca cobra.
 *
 * LOS CUPOS SON LA PARTE DELICADA
 *
 * Son lo que hace que esto cueste lo que se decidió que cueste. Diez
 * cupos de SC 100 son SC 1.000 y ni un peso más, aunque mil personas
 * peguen el multiplicador en el mismo minuto.
 *
 * Por eso `cuposUsados` se mueve con un `$inc` que lleva la condición
 * adentro del filtro. Leer "quedan cupos", pagar, y después sumar uno
 * es exactamente cómo se regalan treinta premios de diez cupos.
 */
const challengeSchema = new mongoose.Schema(
  {
    /* En qué caja hay que pegarla. */
    box: { type: mongoose.Schema.Types.ObjectId, ref: "Box", required: true, index: true },
    boxSlug: { type: String, default: "" },
    boxName: { type: String, default: "" },

    /*
      EL MULTIPLICADOR A PEGAR.

      Sobre el precio de la caja: con 50x en una caja de SC 2, hay que
      sacar algo de SC 100 o más. Se guarda el multiplicador y no el
      valor porque si la caja se reprecia, el desafío sigue siendo el
      mismo desafío.
    */
    multiplicador: { type: Number, required: true, min: 1 },

    premioSc: { type: Number, required: true, min: 0 },

    cupos: { type: Number, required: true, min: 1 },
    cuposUsados: { type: Number, default: 0, min: 0 },

    /* La ventana en la que vale. */
    desde: { type: Date, required: true },
    hasta: { type: Date, required: true, index: true },

    activo: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

/* La consulta de cada apertura: los vivos de ESTA caja. Tiene que ser
   barata, porque corre una vez por caja abierta. */
challengeSchema.index({ box: 1, activo: 1, hasta: 1 });

module.exports = mongoose.model("Challenge", challengeSchema);

/**
 * QUIEN YA GANO QUE DESAFIO.
 *
 * Una fila por jugador y desafío, con índice único: el mismo desafío no
 * se gana dos veces aunque se pegue el multiplicador diez veces.
 */
const challengeWinSchema = new mongoose.Schema(
  {
    challenge: { type: mongoose.Schema.Types.ObjectId, ref: "Challenge", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    boxOpen: { type: mongoose.Schema.Types.ObjectId, ref: "BoxOpen", default: null },
    premioSc: { type: Number, default: 0 },
    multiplicadorLogrado: { type: Number, default: 0 },
  },
  { timestamps: true }
);

challengeWinSchema.index({ challenge: 1, user: 1 }, { unique: true });

module.exports.ChallengeWin = mongoose.models.ChallengeWin
  || mongoose.model("ChallengeWin", challengeWinSchema);
