<template>
  <div class="mb-rueda">
    <!-- El anillo. El verde mide exactamente la chance pedida. -->
    <div
      class="mb-rueda__anillo" aria-hidden="true"
      :style="{ background: `conic-gradient(${franja})`, boxShadow: `0 0 0 10px #12213a, 0 0 40px ${brillo}` }"
    ></div>
    <div class="mb-rueda__rayas" aria-hidden="true"></div>

    <!-- El centro: el objeto elegido, o el cartel de que falta elegir. -->
    <div class="mb-rueda__centro">
      <template v-if="!objeto">
        <span class="mb-rueda__vacio">{{ $t('deals.selectToStart') }}</span>
      </template>
      <template v-else>
        <div
          v-if="arte" class="mb-rueda__foto" :class="arte.clase"
          role="img" :aria-label="objeto.name" :style="arte.estilo"
        ></div>
        <img v-else class="mb-rueda__foto" :src="objeto.imageUrl" :alt="objeto.name">
        <span class="mb-rueda__nombre">{{ objeto.name }}</span>
        <span class="mb-rueda__valor">
          <span class="mb-sc mb-sc--15" aria-hidden="true">SC</span>{{ plata(objeto.valueSc) }}
        </span>
      </template>

      <div
        v-if="resultado && !girando" class="mb-rueda__final"
        :class="resultado.gano ? 'is-gano' : 'is-perdio'" aria-live="polite"
      >
        <span class="mb-rueda__final-t">
          {{ resultado.gano ? $t('deals.youWon') : $t('deals.soClose') }}
        </span>
        <span class="mb-rueda__final-s">{{ subtitulo }}</span>
      </div>
    </div>

    <!-- La aguja. Es ella la que gira, no el anillo. -->
    <div
      class="mb-rueda__aguja" aria-hidden="true"
      :style="{ transform: `rotate(${vuelta}deg)`, transition: transicion }"
    >
      <span></span>
    </div>
  </div>
</template>

<script>
import { sprite } from "@/utils/sprite";

/* El verde ocupa `chance × 3,6` grados: 360 grados son el 100%. */
const GRADOS_POR_PUNTO = 3.6;

/**
 * LA RUEDA DE DEALS.
 *
 * Una franja verde del tamaño de la chance y una aguja que da vueltas y
 * cae adentro o afuera.
 *
 * QUIEN DECIDE
 *
 * El servidor, siempre. Acá llega el resultado ya resuelto y la rueda
 * lo DIBUJA: se elige un ángulo que caiga adentro del verde si ganó y
 * afuera si perdió. Al revés --tirar un número acá y después contarle
 * al servidor-- cualquiera con la consola abierta gana siempre.
 *
 * POR QUE GIRA LA AGUJA Y NO EL ANILLO
 *
 * Porque el anillo es un `conic-gradient` que cambia de tamaño cada vez
 * que el jugador mueve la barra de la chance. Si girara el anillo,
 * cambiar la chance mientras está quieto movería la franja debajo de la
 * aguja y el resultado anterior pasaría a mentir.
 */
export default {
  name: "MbRuedaDeDeal",

  props: {
    objeto: { type: Object, default: null },
    /** La chance, entre 0 y 1. */
    chance: { type: Number, default: 0 },
    /** `true` corre la animación corta. */
    rapido: { type: Boolean, default: false },
  },

  data() {
    return {
      vuelta: 0,
      duracion: 4200,
      girando: false,
      resultado: null,
    };
  },

  computed: {
    arte() { return this.objeto ? sprite(this.objeto.imageUrl) : null; },

    porciento() { return Math.max(0, Math.min(100, this.chance * 100)); },

    franja() {
      if (!this.objeto) return "#24365e 0% 100%";
      return `#2fd47a 0% ${this.porciento}%, #24365e ${this.porciento}% 100%`;
    },

    brillo() {
      if (!this.resultado || this.girando) return "rgba(63,124,240,.25)";
      return this.resultado.gano ? "rgba(47,212,122,.55)" : "rgba(255,91,107,.45)";
    },

    transicion() {
      return `transform ${this.duracion}ms cubic-bezier(.12,.75,.18,1)`;
    },

    subtitulo() {
      if (!this.resultado) return "";
      if (!this.resultado.gano) return this.$t("deals.tryAgain");
      return this.resultado.demo ? this.$t("deals.freeTryNote") : this.$t("deals.addedToInventory");
    },
  },

  methods: {
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },

    /**
     * Gira hasta el resultado que ya trajo el servidor.
     *
     * @param {{gano: boolean, demo?: boolean}} tiro
     * @returns {Promise<void>} se resuelve cuando la rueda frenó
     */
    girar(tiro) {
      const arco = this.porciento * GRADOS_POR_PUNTO;

      /*
        El ángulo final. Adentro del verde si ganó, afuera si no.

        Los márgenes --8% del arco de cada lado, 6% afuera-- son para
        que la aguja no quede nunca pegada al borde: parada justo en la
        costura, el jugador no sabe si ganó o no, y eso es peor que
        perder.
      */
      const angulo = tiro.gano
        ? arco * (0.08 + Math.random() * 0.84)
        : arco + (360 - arco) * (0.06 + Math.random() * 0.88);

      const vueltas = this.rapido ? 3 : 6;
      const desde = this.vuelta;

      this.duracion = this.rapido ? 1300 : 4200;
      this.girando = true;
      this.resultado = null;

      /* Se arranca desde la vuelta entera más cercana para abajo, así
         las vueltas que se agregan siempre son completas. */
      this.vuelta = desde - (desde % 360) + 360 * vueltas + angulo;

      return new Promise((listo) => {
        window.setTimeout(() => {
          this.girando = false;
          this.resultado = tiro;
          listo();
        }, this.duracion + 60);
      });
    },

    /** Borra el resultado sin mover la aguja. */
    limpiar() { this.resultado = null; },
  },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-rueda {
  position: relative;
  width: min(360px, 82vw);
  aspect-ratio: 1 / 1;
  margin-top: 6px;
}

.mb-rueda__anillo {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  transition: box-shadow .3s ease;
}

// Las rayitas finas que le dan textura al anillo.
.mb-rueda__rayas {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: repeating-conic-gradient(rgba(11, 20, 36, .55) 0deg 0.6deg, rgba(0, 0, 0, 0) 0.6deg 6deg);
}

.mb-rueda__centro {
  position: absolute;
  inset: 9%;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 40%, #1d3a66 0%, #0e1a2e 75%);
  border: 4px solid $fondo;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  overflow: hidden;
}

.mb-rueda__vacio {
  font-family: $fuente-cartel;
  font-size: clamp(20px, 4vw, 28px);
  line-height: 1.1;
  color: $texto-2;
  padding: 0 20%;
}

.mb-rueda__foto {
  width: 58%;
  aspect-ratio: 1 / 1;
  filter: drop-shadow(0 10px 16px rgba(0, 0, 0, .5));
  object-fit: contain;
}

.mb-rueda__nombre {
  max-width: 76%;
  font-weight: 900;
  font-size: 14px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mb-rueda__valor { display: flex; align-items: center; gap: 5px; font-weight: 900; font-size: 14px; color: $amarillo; }

.mb-rueda__final {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;

  &.is-gano { background: rgba(22, 130, 72, .88); }
  &.is-perdio { background: rgba(150, 30, 45, .85); }
}

.mb-rueda__final-t {
  font-family: $fuente-cartel;
  font-size: clamp(26px, 5vw, 38px);
  line-height: 1;
  text-shadow: 0 3px 0 rgba(0, 0, 0, .35);
}

.mb-rueda__final-s { font-weight: 800; font-size: 13px; }

.mb-rueda__aguja {
  position: absolute;
  inset: 0;

  span {
    position: absolute;
    left: 50%;
    top: -6px;
    width: 22px;
    height: 22px;
    margin-left: -11px;
    border-radius: 50%;
    background: #fff;
    border: 4px solid $fondo;
    box-shadow: 0 0 14px rgba(255, 255, 255, .9);
  }
}
</style>
