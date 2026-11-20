const mongoose = require("mongoose");

/**
 * UNA CAJA.
 *
 * Una lista de objetos del catálogo, cada uno con su chance. El precio NO
 * se escribe: sale de los objetos (ver services/boxes/economia.js).
 *
 * LO QUE SE GUARDA Y LO QUE SE CALCULA
 *
 * `priceSc`, `pagoPromedio` y `retorno` se guardan aunque sean calculados.
 * Parece redundante y no lo es: el precio tiene que quedar FIJO en el
 * momento en que se guarda la caja. Si se calculara al leer, cambiar el
 * valor de un objeto del catálogo cambiaría en silencio el precio de
 * catorce cajas, y alguien que está mirando una caja la vería saltar de
 * precio entre que la abre y la paga.
 *
 * Cuando un objeto cambia de valor, el panel avisa qué cajas quedaron
 * desactualizadas y se repricían a propósito, no solas.
 */

const premioSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },

    /*
      SI SE PUEDE MANDAR A UNA CASA.

      Copiado del catalogo al armar la caja, como el nombre y el valor.
      Sin esto el inventario lo daba por `true` siempre, y los vales de
      credito --que no se mandan a ningun lado-- entraban al flujo de
      envio igual.
    */
    shippable: { type: Boolean, default: true },

    /*
      COPIA DE LO QUE DICE EL OBJETO, AL MOMENTO DE GUARDAR LA CAJA.

      Es lo que hace que el precio sea estable y que el sorteo sea
      verificable: el jugador tiene que poder rehacer la cuenta con los
      números que vio, no con los que haya ahora en el catálogo.
    */
    name: { type: String, required: true },
    valueSc: { type: Number, required: true, min: 0 },
    imageUrl: { type: String, default: "" },
    rarity: { type: String, default: "blue" },

    /* Entre 0 y 1. Las de todos los premios tienen que sumar exactamente 1. */
    chance: { type: Number, required: true, min: 0, max: 1 },

    /*
      EL PESO QUE ESCRIBIO EL CREADOR.

      Solo en las cajas de la comunidad, y solo para poder mostrarselo
      tal cual cuando vuelva a editar. Lo que manda al sortear es
      `chance`; esto es la cuenta de la que salio.
    */
    peso: { type: Number, default: null },
  },
  { _id: false }
);

const boxSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, default: "", trim: true, index: true },
    imageUrl: { type: String, default: "" },

    prizes: {
      type: [premioSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "A box needs at least one item.",
      },
    },

    /* Calculados al guardar. Ver el comentario de arriba. */
    priceSc: { type: Number, required: true, min: 0 },
    pagoPromedio: { type: Number, default: 0 },
    retorno: { type: Number, default: 0 },

    /*
      SI EL PRECIO LO PUSO UNA PERSONA.

      Con esto en `true` el precio deja de recalcularse solo: es una caja
      de promoción o un precio redondo elegido a mano. El panel la marca
      distinto, porque es la única forma de que una caja pague más de lo
      que cobra.
    */
    precioAMano: { type: Boolean, default: false },

    featured: { type: Boolean, default: false, index: true },

    /*
      El cartelito "NEW" de la portada.
      Se llama `markedNew` y no `isNew` porque `isNew` es un nombre que usa
      Mongoose para sus propios documentos: definirlo acá lo pisa y rompe
      cosas sin avisar.
    */
    markedNew: { type: Boolean, default: false, index: true },

    /* Apagada deja de aparecer y de poder abrirse, sin borrar nada. */
    live: { type: Boolean, default: false, index: true },

    /*
      LAS CAJAS DE LA COMUNIDAD.

      La misma colección a propósito: una caja de la comunidad se abre, se
      sortea y se paga exactamente igual que una nuestra. Lo único distinto
      es quién la armó, que tiene que aprobarse, y que su creador se lleva
      la mitad del margen.
    */
    creator: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    approvalState: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
      index: true,
    },

    /* Lo que el creador escribió sobre su caja. Solo las suyas. */
    description: { type: String, default: "", trim: true, maxlength: 240 },

    /* Por qué se rechazó, para poder decírselo y que lo arregle. */
    motivoDelRechazo: { type: String, default: "" },

    /*
      COMO SE DIBUJA UNA CAJA DE COMUNIDAD.

      Las 163 de la casa tienen su arte en una lámina. Las que hace un
      jugador no: no hay nadie dibujando una por cada una. Así que se
      guardan las decisiones --color, armado, qué premios asoman, los
      logos-- y la pantalla la dibuja en SVG cada vez.

      Guardar las decisiones y no una imagen tiene una ventaja que se
      nota el día que se toca el dibujo: todas las cajas ya publicadas
      se actualizan solas. Con una imagen generada habría que rehacer
      mil y pico de archivos.
    */
    portada: {
      color: { type: String, default: "#9b30ff" },
      /* El estampado del cartón: ver TEXTURAS en services/community. */
      textura: { type: String, default: "liso" },
      /* 0 Hero, 1 Trio, 2 Spread. */
      estilo: { type: Number, default: 2, min: 0, max: 2 },
      /* Hasta tres premios de la caja, por su posición en `prizes`. */
      asoman: { type: [Number], default: [] },
      /* Corrimientos a mano: { "0": [x, y] }, en por ciento. */
      posiciones: { type: mongoose.Schema.Types.Mixed, default: {} },
      logoIzquierdo: { type: String, default: "" },
      logoDerecho: { type: String, default: "" },
    },

    /* Lo que el creador ya se llevó de esta caja, para su panel. */
    ganadoPorElCreadorSc: { type: Number, default: 0 },

    /*
      EL MARGEN QUE TODAVIA NO SE REPARTIO.

      Se suma el margen de cada apertura, NEGATIVO INCLUIDO, y solo se
      paga cuando el acumulado esta en verde. Sin esto, la casa paga la
      mitad de lo que gana y se come entera la apertura en la que
      pierde: con un premio gordo adentro, la caja le saca plata a la
      casa aunque tenga 92% de retorno.
    */
    margenPendienteSc: { type: Number, default: 0 },

    /* Para ordenar la portada sin contar aperturas cada vez. */
    opens: { type: Number, default: 0 },
  },
  { timestamps: true }
);

/* La portada pide las que están al aire, por categoría y por precio. */
boxSchema.index({ live: 1, category: 1, priceSc: 1 });
boxSchema.index({ live: 1, opens: -1 });

/** Si es una caja armada por un jugador. */
boxSchema.methods.esDeComunidad = function esDeComunidad() {
  return !!this.creator;
};

module.exports = mongoose.model("Box", boxSchema);
