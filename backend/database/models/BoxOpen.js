const mongoose = require("mongoose");

/**
 * UNA APERTURA.
 *
 * El recibo de cada caja que se abrió. Es lo que le permite al jugador
 * comprobar que no le mentimos, y lo que nos permite a nosotros responder
 * cuando dice que sí.
 *
 * QUE SE GUARDA Y POR QUE
 *
 * Todo lo que hace falta para rehacer el sorteo sin consultar nada más:
 * las dos semillas, el contador, el HMAC que salió, el número que salió y
 * la lista de premios TAL COMO ESTABA en ese momento.
 *
 * Esa última copia es la que mucha gente se olvida. Si la caja se edita
 * después —se cambia una chance, se saca un objeto— y la verificación
 * usara la caja de hoy, el sorteo de ayer no cerraría y no habría forma de
 * distinguir un cambio inocente de una estafa. Con la copia, una apertura
 * de hace seis meses se verifica igual.
 *
 * `semillaServidor` queda tapada hasta que el jugador rota su semilla. Ese
 * es el punto de todo el mecanismo: no podemos elegir el premio porque la
 * semilla ya estaba comprometida por su hash antes de que abriera.
 */

const premioSorteadoSchema = new mongoose.Schema(
  {
    name: String,
    valueSc: Number,
    chance: Number,
    rarity: String,

    /* A que objeto del catalogo era, y su foto COPIADA.

       El feed de la portada dibuja esto. Sin la copia no tiene nada que
       mostrar, y buscarlo en el catalogo cada vez deja el hueco el dia
       que el objeto se da de baja. */
    item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", default: null },
    imageUrl: { type: String, default: "" },
  },
  { _id: false }
);

const boxOpenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    box: { type: mongoose.Schema.Types.ObjectId, ref: "Box", required: true, index: true },

    boxSlug: { type: String, required: true },
    boxName: { type: String, required: true },

    /* Lo que pagó. Cero cuando usó una apertura gratis. */
    priceSc: { type: Number, required: true, min: 0 },
    conAperturaGratis: { type: Boolean, default: false },

    /* El sorteo, entero. */
    semillaServidorHash: { type: String, required: true },
    semillaServidor: { type: String, default: null, select: false },
    semillaCliente: { type: String, required: true },
    nonce: { type: Number, required: true },
    hmac: { type: String, required: true },
    numero: { type: Number, required: true },

    /* La caja como estaba. Sin esto no se puede verificar nada viejo. */
    premios: { type: [premioSorteadoSchema], required: true },
    indicePremio: { type: Number, required: true },

    /* Lo que salió, copiado. */
    premio: {
      /* La foto, copiada. Sin esto el feed de la portada no tiene nada
         que dibujar: el objeto del catalogo puede haber cambiado de
         arte, o no existir mas. */
      imageUrl: { type: String, default: "" }, type: premioSorteadoSchema, required: true },

    inventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryItem", default: null },

    /*
      Una tirada de demostración: se sortea igual pero no cobra, no paga y
      no entra a ningún inventario. Existe para que alguien que todavía no
      se registró pueda ver cómo es.
    */
    demo: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

/* El historial del jugador, y el de la caja para el panel. */
boxOpenSchema.index({ user: 1, createdAt: -1 });
boxOpenSchema.index({ box: 1, createdAt: -1 });

/*
  LA CINTA DE LA PORTADA.

  `GET /boxes/feed/latest` no filtra por jugador ni por caja: pide las
  ultimas de verdad, ordenadas por fecha. Ninguno de los dos indices de
  arriba le sirve, asi que ordenaba EN MEMORIA barriendo la coleccion
  entera para devolver 24 filas.

  Eso con 171 aperturas tarda 3ms y no se nota. Pero la portada lo pide
  cada segundo y medio POR VISITANTE, y esta coleccion crece una fila
  por cada apertura que se haga en la vida del sitio. Con un millon de
  filas son un millon de documentos examinados, varias veces por
  segundo, hasta que el ordenamiento pasa los 100 MB y MongoDB corta.
*/
boxOpenSchema.index({ demo: 1, createdAt: -1 });

module.exports = mongoose.model("BoxOpen", boxOpenSchema);
