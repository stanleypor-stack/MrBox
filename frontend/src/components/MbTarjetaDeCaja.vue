<template>
  <router-link :to="`/boxes/${caja.slug}`" class="mb-caja mb-card">
    <!-- La tapa. Mientras no haya foto va el mejor premio sobre un
         degradé del color de su rareza, que es lo que hace que la
         grilla no se vea vacía con el catálogo recién cargado. -->
    <div class="mb-caja__tapa" :style="estiloTapa">
      <img v-if="caja.imageUrl" :src="caja.imageUrl" :alt="caja.name" class="mb-caja__foto">
      <div v-else class="mb-caja__sinfoto" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2.5 21 7v10l-9 4.5L3 17V7zM3 7l9 4.5L21 7M12 11.5v10" />
        </svg>
      </div>

      <div class="mb-caja__cintas">
        <span v-if="caja.markedNew" class="mb-cinta mb-cinta--nueva">NEW</span>
        <span v-if="caja.featured" class="mb-cinta mb-cinta--destacada">HOT</span>
      </div>
    </div>

    <div class="mb-caja__pie">
      <span class="mb-caja__nombre">{{ caja.name }}</span>

      <span class="mb-caja__datos">
        <span class="mb-caja__objetos">{{ $t('box.items', { n: caja.cuantosObjetos }) }}</span>
        <span class="mb-caja__precio">
          <span class="mb-sc" aria-hidden="true">SC</span>{{ precio }}
        </span>
      </span>
    </div>
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
 * Es un `router-link` y no un div con un click: así se abre en pestaña
 * nueva con el botón del medio, se copia la dirección con el botón
 * derecho y el teclado la alcanza con Tab. Un div con `onClick` no hace
 * ninguna de las tres y se nota.
 */
const COLORES = {
  blue: "#3f7cf0",
  purple: "#8b4fe0",
  pink: "#e0418f",
  red: "#e2424b",
  gold: "#f5b80a",
};

export default {
  name: "MbTarjetaDeCaja",
  props: {
    caja: { type: Object, required: true },
  },
  computed: {
    precio() {
      return Number(this.caja.priceSc || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },
    estiloTapa() {
      const rareza = (this.caja.mejorPremio && this.caja.mejorPremio.rarity) || "blue";
      const color = COLORES[rareza] || COLORES.blue;
      /* Un resplandor del color de la rareza del mejor premio. Dice de
         un vistazo si la caja tiene algo grande adentro. */
      return { background: `radial-gradient(circle at 50% 35%, ${color}44 0%, #0e1a2e 70%)` };
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-caja {
  display: flex;
  flex-direction: column;
  border: 1px solid $borde;
  border-radius: $radio-tarjeta;
  background: $panel;
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  transition: transform .15s ease, border-color .15s ease;
  @include foco;

  &:hover {
    transform: translateY(-3px);
    border-color: $azul;
    color: inherit;
  }
}

.mb-caja__tapa {
  position: relative;
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mb-caja__foto {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.mb-caja__sinfoto {
  width: 46%;
  color: rgba(255, 255, 255, .22);
  svg { width: 100%; height: auto; }
}

.mb-caja__cintas {
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  gap: 6px;
}

.mb-cinta {
  padding: 3px 7px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: .08em;

  &--nueva { background: $verde; color: #06301d; }
  &--destacada { background: $amarillo-v; color: $azul-tinta; }
}

.mb-caja__pie {
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-top: 1px solid $borde;
}

.mb-caja__nombre {
  font-weight: 800;
  font-size: 14px;
  // Un nombre largo no puede empujar la tarjeta ni partirse en tres
  // renglones y desalinear toda la fila.
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mb-caja__datos {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.mb-caja__objetos {
  color: $texto-4;
  font-size: 12px;
  font-weight: 700;
}

.mb-caja__precio {
  display: flex;
  align-items: center;
  gap: 5px;
  font-weight: 900;
  font-size: 15px;
}

.mb-sc {
  display: inline-flex;
  flex: none;
  width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: linear-gradient($sc-verde-claro, $sc-verde);
  color: $sc-texto;
  font-weight: 900;
  font-size: 8px;
  line-height: 1;
}
</style>
