const mongoose = require("mongoose");

/**
 * UN DESAFIO DEL DIA.
 *
 * Hay dos maneras de pegarla, y la unica diferencia es el disparador:
 *
 *   POR MULTIPLICADOR  "Sacá 50x en la Junk Box y llevate SC 100."
 *   POR OBJETO         "Los primeros 3 que saquen un Rolex se llevan
 *                       SC 500 cada uno."
 *
 * El segundo se entiende solo y se puede contar; el primero hay que
 * explicarlo. Lo demas --los cupos, el cobro, el techo de gasto-- es
 * exactamente igual para los dos.
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
    /*
      EN QUE CAJA HAY QUE PEGARLA. OPCIONAL.

      Sin caja, el desafio vale en TODAS. Para uno de multiplicador no
      tiene mucho sentido --50x no es lo mismo en una caja de SC 2 que
      en una de SC 300-- pero para uno de objeto es justamente lo que
      se quiere: el Rolex esta en varias cajas y la promesa es "el
      primero que saque un Rolex", no "en esta caja".
    */
    box: { type: mongoose.Schema.Types.ObjectId, ref: "Box", default: null, index: true },
    boxSlug: { type: String, default: "" },
    boxName: { type: String, default: "" },

    /*
      EL OBJETO QUE HAY QUE SACAR.

      Si esta puesto, el desafio es por objeto y `multiplicador` no se
      mira. Se guarda tambien el nombre porque es lo que va en el
      cartel y en el asiento del libro: el catalogo puede cambiar de
      nombre y el desafio de ayer tiene que seguir diciendo lo que
      decia.
    */
    item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", default: null, index: true },
    itemName: { type: String, default: "" },

    /*
      EL MULTIPLICADOR A PEGAR.

      Sobre el precio de la caja: con 50x en una caja de SC 2, hay que
      sacar algo de SC 100 o más. Se guarda el multiplicador y no el
      valor porque si la caja se reprecia, el desafío sigue siendo el
      mismo desafío.

      Vacío en los desafíos por objeto: ahí lo que dispara es el
      objeto, no cuánto valía.
    */
    multiplicador: { type: Number, default: null, min: 1 },

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

/* Las dos consultas de cada apertura: los vivos de ESTA caja y los
   vivos de ESTE objeto. Tienen que ser baratas, porque corren una vez
   por caja abierta. */
challengeSchema.index({ box: 1, activo: 1, hasta: 1 });
challengeSchema.index({ item: 1, activo: 1, hasta: 1 });

/*
  UN DESAFIO ES DE UNA COSA O DE LA OTRA.

  Sin esto se puede guardar uno sin objeto Y sin multiplicador, que no
  lo gana nadie nunca, o uno con los dos, donde no se sabe cual manda.
  Los dos son errores de carga que no avisan: el desafio aparece en la
  pantalla, promete un premio y no se cumple.
*/
/* Sin `next`: en Mongoose 9 los ganchos de documento son promesas y
   `next` no llega. Tirar el error es como se corta. */
challengeSchema.pre("validate", function alGuardar() {
  const porObjeto = !!this.item;
  const porMultiplicador = Number(this.multiplicador) > 0;

  if (porObjeto === porMultiplicador) {
    throw new Error("Un desafío lleva un objeto o un multiplicador, no los dos ni ninguno.");
  }
});

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
