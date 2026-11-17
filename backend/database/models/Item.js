const mongoose = require("mongoose");

/**
 * UN OBJETO DEL CATALOGO.
 *
 * Esta es la pieza de la que cuelga todo lo demás. Un objeto existe UNA
 * vez y lo usan muchas cajas: si mañana el iPhone baja de SC 1.277 a
 * SC 1.150, se cambia acá y todas las cajas que lo tienen se reprecían
 * solas.
 *
 * POR QUE NO SE GUARDA EL PRECIO DENTRO DE LA CAJA
 *
 * Porque entonces habría una copia del precio por cada caja que lo use, y
 * tarde o temprano una de esas copias queda vieja. Una caja guarda a qué
 * objeto apunta y con qué chance; lo que vale lo dice el objeto.
 *
 * Sí se copia el valor al INVENTARIO cuando alguien lo gana, y eso es a
 * propósito: lo que ganaste vale lo que valía el día que lo ganaste, no lo
 * que valga dentro de seis meses. Ver InventoryItem.
 */

/*
  Las cinco rarezas del diseño. Son una etiqueta visual, no una regla: lo
  que de verdad hace raro a un objeto es su chance dentro de la caja, y eso
  vive en la caja. Acá solo decide de qué color se dibuja la tarjeta.
*/
const RAREZAS = ["blue", "purple", "pink", "red", "gold"];

const itemSchema = new mongoose.Schema(
  {
    /* El identificador que usa el admin para encontrarlo y para los informes. */
    sku: { type: String, required: true, unique: true, trim: true, index: true },

    name: { type: String, required: true, trim: true },
    brand: { type: String, default: "", trim: true, index: true },

    /*
      LO QUE VALE, EN SC.

      De acá sale el precio de toda caja que lo tenga adentro, lo que
      cuesta jugarlo en Deals y lo que se le acredita al jugador si lo
      vende. Es el número más sensible del catálogo.
    */
    valueSc: { type: Number, required: true, min: 0 },

    rarity: { type: String, enum: RAREZAS, default: "blue", index: true },

    imageUrl: { type: String, default: "" },
    category: { type: String, default: "", trim: true, index: true },

    /*
      SI SE PUEDE MANDAR A UNA CASA.

      No todo objeto se envía. Una tarjeta de regalo o un crédito se
      entregan de otra forma, y hay objetos que simplemente no tenemos
      stock para mandar. Cuando está en `false`, el jugador lo gana igual
      pero solo puede venderlo por SC.
    */
    shippable: { type: Boolean, default: true, index: true },

    /*
      Cuántos hay de verdad en el depósito. `null` es "no lo llevamos",
      que es distinto de cero: cero significa que se agotó.
    */
    stock: { type: Number, default: null },

    /* Apagado deja de ofrecerlo en cajas nuevas, sin tocar las que ya lo tienen. */
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

/* El buscador del panel escribe el nombre o la marca, no el SKU. */
itemSchema.index({ name: "text", brand: "text" });

/* La grilla del catálogo ordena por valor dentro de una categoría. */
itemSchema.index({ active: 1, category: 1, valueSc: -1 });

module.exports = mongoose.model("Item", itemSchema);
module.exports.RAREZAS = RAREZAS;
