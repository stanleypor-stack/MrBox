<template>
  <router-link :to="`/boxes/${caja.slug}`" class="mb-gcaja mb-card">
    <!-- El cuadrado del arte, con el resplandor de su categoría. -->
    <span class="mb-gcaja__marco" :style="{ background: tinte }">
      <span
        v-if="lamina" class="mb-gcaja__arte" :class="lamina.clase"
        role="img" :aria-label="caja.name" :style="lamina.estilo"
      ></span>
      <img v-else-if="caja.imageUrl" class="mb-gcaja__arte" :src="caja.imageUrl" :alt="caja.name">
      <span v-else class="mb-gcaja__sinfoto" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2.5 21 7v10l-9 4.5L3 17V7zM3 7l9 4.5L21 7M12 11.5v10" />
        </svg>
      </span>

      <span class="mb-gcaja__cintas">
        <span v-if="caja.featured" class="mb-gcinta mb-gcinta--caliente">HOT</span>
        <span v-if="caja.markedNew" class="mb-gcinta mb-gcinta--nueva">{{ $t('box.featured') }}</span>
      </span>

      <span v-if="caja.category" class="mb-gcaja__categoria">{{ caja.category }}</span>
    </span>

    <span class="mb-gcaja__texto">
      <span class="mb-gcaja__nombre">{{ caja.name }}</span>

      <!-- El medidor: cuán impredecible es la caja, no cuán cara. -->
      <span class="mb-gcaja__riesgo" :title="$t('box.riskExplainer')">
        <span class="mb-gcaja__barra">
          <span :style="{ width: anchoDelRiesgo, background: colorDelRiesgo }"></span>
        </span>
        <span class="mb-gcaja__nivel" :style="{ color: colorDelRiesgo }">
          {{ $t('box.risk.' + nivel) }}
        </span>
      </span>
    </span>

    <span class="mb-gcaja__pie">
      <span class="mb-gcaja__precio">
        <span class="mb-sc mb-sc--20" aria-hidden="true">SC</span>{{ precio }}
      </span>
      <span class="mb-gcaja__abrir">{{ $t('action.open') }}</span>
    </span>
  </router-link>
</template>

<script>
/**
 * LA TARJETA DEL CATALOGO.
 *
 * Es OTRA tarjeta que la de las filas de la portada, y en el diseño
 * también lo es. La de la portada mide 190 × 250 y lleva todo encima
 * del arte, porque vive en una cinta que se desliza y tiene que leerse
 * de reojo. Esta se estira en la grilla, y como el que está acá está
 * comparando cajas, muestra lo que sirve para comparar: la categoría,
 * el riesgo y el precio, cada cosa en su renglón.
 */
import { sprite } from "@/utils/sprite";

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

/* Los mismos cuatro cortes y los mismos cuatro colores del diseño. */
const COLORES_DE_RIESGO = {
  low: "#2fd47a",
  medium: "#4f9bff",
  high: "#ffc83d",
  extreme: "#ff5b6b",
};

export default {
  name: "MbCajaEnGrilla",
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

    nivel() { return this.caja.nivelDeRiesgo || "low"; },
    colorDelRiesgo() { return COLORES_DE_RIESGO[this.nivel] || COLORES_DE_RIESGO.low; },

    /* Un mínimo de 4%: una barra de cero ancho parece rota, no vacía. */
    anchoDelRiesgo() {
      return Math.max(4, Math.min(100, Number(this.caja.riesgo) || 0)) + "%";
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-gcaja {
  min-width: 0;
  border-radius: 18px;
  background: $panel-alto;
  border: 1px solid $borde;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  text-decoration: none;
  color: #fff;
  transition: transform .15s ease, border-color .15s ease;
  @include foco;

  &:hover { transform: translateY(-3px); border-color: $azul; color: #fff; }
}

.mb-gcaja__marco {
  position: relative;
  aspect-ratio: 1 / 1;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.mb-gcaja__arte { width: 90%; aspect-ratio: 1 / 1; object-fit: contain; }

.mb-gcaja__sinfoto {
  width: 46%;
  color: rgba(255, 255, 255, .22);
  svg { width: 100%; height: auto; display: block; }
}

.mb-gcaja__cintas { position: absolute; top: 8px; left: 8px; display: flex; gap: 6px; }

.mb-gcinta {
  padding: 3px 8px;
  border-radius: 7px;
  font-weight: 900;
  font-size: 11px;

  &--caliente { background: #ff5b6b; color: #fff; }
  &--nueva { background: $amarillo-v; color: $azul-tinta; }
}

.mb-gcaja__categoria {
  position: absolute;
  bottom: 8px;
  left: 8px;
  padding: 3px 8px;
  border-radius: 7px;
  background: rgba(11, 20, 36, .6);
  font-weight: 800;
  font-size: 11px;
}

.mb-gcaja__texto { display: flex; flex-direction: column; gap: 6px; }

.mb-gcaja__nombre {
  font-weight: 800;
  font-size: 16px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mb-gcaja__riesgo { display: flex; align-items: center; gap: 8px; }

.mb-gcaja__barra {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: $borde-fuerte;
  overflow: hidden;

  span { display: block; height: 100%; }
}

.mb-gcaja__nivel { font-weight: 800; font-size: 11px; }

.mb-gcaja__pie {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.mb-gcaja__precio { display: flex; align-items: center; gap: 6px; font-weight: 900; font-size: 16px; }

.mb-gcaja__abrir {
  padding: 8px 14px;
  border-radius: 10px;
  background: $azul;
  font-weight: 800;
  font-size: 14px;
}
</style>
