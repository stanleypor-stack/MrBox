<template>
  <router-link
    :to="`/boxes/${caja.slug}`" class="mb-caja mb-card"
    :aria-label="$t('box.openAria', { name: caja.name })" :style="{ background: tinte }"
  >
    <!-- El nombre va ARRIBA y encima del arte, no debajo en un pie: es
         lo que hace que la tarjeta se lea de un vistazo en una fila que
         se desliza. -->
    <span class="mb-caja__nombre">{{ caja.name }}</span>

    <!-- El arte sale de la lámina del diseño: un recorte, no un archivo
         por caja. Ocupa casi toda la tarjeta y se centra un poco abajo
         para dejarle aire al nombre. -->
    <span
      v-if="lamina" class="mb-caja__arte" :class="lamina.clase"
      :style="lamina.estilo" aria-hidden="true"
    ></span>
    <img v-else-if="caja.imageUrl" :src="caja.imageUrl" :alt="caja.name" class="mb-caja__arte">
    <span v-else class="mb-caja__sinfoto" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2.5 21 7v10l-9 4.5L3 17V7zM3 7l9 4.5L21 7M12 11.5v10" />
      </svg>
    </span>

    <span class="mb-caja__cintas">
      <span v-if="caja.featured" class="mb-cinta mb-cinta--caliente">HOT</span>
      <span v-if="caja.markedNew" class="mb-cinta mb-cinta--nueva">NEW</span>
    </span>

    <span class="mb-caja__precio">
      <span class="mb-sc mb-sc--15" aria-hidden="true">SC</span>{{ precio }}
    </span>
  </router-link>
</template>

<script>
/**
 * LA TARJETA DE UNA CAJA.
 *
 * La pieza que más se repite del sitio: hay veinticuatro por pantalla.
 * Por eso no pide nada al servidor ni calcula de más — lo que muestra
 * viene todo armado del catálogo.
 *
 * COMO EN EL DISENO: TODO ENCIMA DEL ARTE
 *
 * 190 × 250, el nombre arriba con su sombra dura, el arte ocupando casi
 * toda la tarjeta y el precio en una pastilla abajo a la derecha. Nada
 * de pie con texto debajo: eso alargaba la tarjeta a 261px y hacía ver
 * todo el catálogo más grande que en el prototipo.
 *
 * Es un `router-link` y no un div con un click: así se abre en pestaña
 * nueva con el botón del medio, se copia la dirección con el botón
 * derecho y el teclado la alcanza con Tab. Un div con `onClick` no hace
 * ninguna de las tres y se nota.
 */
import { sprite } from "@/utils/sprite";

/*
  EL COLOR DE CADA CATEGORIA.

  Sacado del diseño tal cual. El fondo de la tarjeta es un resplandor de
  este color: sin leer el nombre ya se sabe si es de relojes o de
  gaming, y una fila de veinte tarjetas deja de ser una pared gris.
*/
const TINTES = {
  Audio: "#1f8fc7",
  Collectables: "#b13d8c",
  Community: "#4a5b80",
  Cookware: "#d27d16",
  Fashion: "#c2449b",
  Gadgets: "#16936d",
  Games: "#6a4fe0",
  Gaming: "#5a4fd6",
  Memorabilia: "#b8862a",
  Mix: "#2f6fe0",
  Motorcycles: "#d24a55",
  Tech: "#1d7fbf",
  "Trading Cards": "#e0a21a",
  Watches: "#8a6a3a",
};

export default {
  name: "MbTarjetaDeCaja",
  props: {
    caja: { type: Object, required: true },
  },
  computed: {
    lamina() { return sprite(this.caja.imageUrl); },

    precio() {
      return Number(this.caja.priceSc || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },

    tinte() {
      const color = TINTES[this.caja.category] || TINTES.Mix;
      return `radial-gradient(circle at 50% 58%, ${color} 0%, #12213a 72%)`;
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-caja {
  position: relative;
  flex: none;
  width: 190px;
  height: 250px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid #23397a;
  text-decoration: none;
  color: #fff;
  transition: transform .15s ease, border-color .15s ease;
  @include foco;

  &:hover {
    transform: translateY(-3px);
    border-color: $azul;
    color: #fff;
  }
}

.mb-caja__nombre {
  position: absolute;
  left: 0;
  right: 0;
  top: 12px;
  z-index: 2;
  padding: 0 8px;
  text-align: center;
  font-family: $fuente-cartel;
  font-size: 20px;
  line-height: 1.05;
  text-shadow: 0 3px 0 $azul-tinta, 0 5px 10px rgba(0, 0, 0, .5);
}

.mb-caja__arte {
  position: absolute;
  left: 50%;
  top: 56%;
  width: 98%;
  aspect-ratio: 1 / 1;
  transform: translate(-50%, -50%);
  object-fit: contain;
}

.mb-caja__sinfoto {
  position: absolute;
  left: 50%;
  top: 56%;
  width: 46%;
  transform: translate(-50%, -50%);
  color: rgba(255, 255, 255, .22);
  svg { width: 100%; height: auto; display: block; }
}

.mb-caja__cintas { position: absolute; left: 8px; bottom: 8px; z-index: 2; display: flex; gap: 4px; }

.mb-cinta {
  padding: 3px 7px;
  border-radius: 6px;
  font-weight: 900;
  font-size: 10px;

  &--caliente { background: #ff5b6b; color: #fff; }
  &--nueva { background: $amarillo-v; color: $azul-tinta; }
}

.mb-caja__precio {
  position: absolute;
  right: 8px;
  bottom: 8px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  border-radius: 8px;
  background: #2f6fe0;
  font-weight: 900;
  font-size: 13px;
}
</style>
