<template>
  <section class="mb-ruleta" :aria-label="$t('box.opening')">
    <!-- Los punteros: arriba y abajo del centro, con sus rayas que se
         desvanecen. Marcan donde cae el premio. -->
    <svg class="mb-ruleta__punta mb-ruleta__punta--arriba" width="18" height="14"
         viewBox="0 0 24 18" fill="none" stroke="#fff" stroke-width="3"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M5 3l7 6 7-6M5 10l7 6 7-6" />
    </svg>
    <span class="mb-ruleta__raya mb-ruleta__raya--ai" aria-hidden="true"></span>
    <span class="mb-ruleta__raya mb-ruleta__raya--ad" aria-hidden="true"></span>

    <svg class="mb-ruleta__punta mb-ruleta__punta--abajo" width="18" height="14"
         viewBox="0 0 24 18" fill="none" stroke="#fff" stroke-width="3"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M5 15l7-6 7 6M5 8l7-6 7 6" />
    </svg>
    <span class="mb-ruleta__raya mb-ruleta__raya--bi" aria-hidden="true"></span>
    <span class="mb-ruleta__raya mb-ruleta__raya--bd" aria-hidden="true"></span>

    <div class="mb-ruleta__cintas">
      <div v-for="(cinta, c) in cintas" :key="c" class="mb-ruleta__via" :style="{ height: altoVia }">
        <div
          class="mb-ruleta__tira"
          :style="{
            transform: `translateX(${cinta.x}px)`,
            transition: animando ? `transform ${duracion}ms cubic-bezier(.12,.72,.12,1)` : 'none',
          }"
        >
          <div
            v-for="(it, i) in cinta.items" :key="i"
            class="mb-ruleta__casillero"
            :style="{ opacity: opacidad(c, i), width: ANCHO_ITEM + 'px' }"
          >
            <div class="mb-ruleta__marco" :style="{ transform: `scale(${escala(c, i)})` }">
              <!-- Los dos rectangulos girados del diseno, que le dan
                   profundidad al objeto sin ponerle una caja alrededor. -->
              <span class="mb-ruleta__borde mb-ruleta__borde--a" aria-hidden="true"></span>
              <span class="mb-ruleta__borde mb-ruleta__borde--b" aria-hidden="true"></span>
              <span
                class="mb-ruleta__brillo" aria-hidden="true"
                :style="{ background: color(it.rarity), opacity: brillo(c, i) }"
              ></span>
              <div
                class="mb-prod mb-ruleta__foto" aria-hidden="true"
                :style="{ backgroundPosition: posicion(it) }"
              ></div>
            </div>

            <!-- El nombre solo se lee cuando la cinta freno: durante el
                 giro es un borron ilegible que marea. -->
            <div class="mb-ruleta__rotulo" :style="{ visibility: quieta ? 'visible' : 'hidden' }">
              <span class="mb-ruleta__nombre">{{ it.name }}</span>
              <span class="mb-ruleta__valor">
                <span class="mb-sc mb-sc--16" aria-hidden="true">SC</span>{{ plata(it.valueSc) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
import { sprite } from "@/utils/sprite";

const COLORES = {
  blue: "#3f7cf0", purple: "#8b4fe0", pink: "#e0418f", red: "#e2424b", gold: "#f5b80a",
};

/* Los numeros del diseno. */
const ANCHO_ITEM = 120;
const GAP = 12;
const PASO = ANCHO_ITEM + GAP;   // 132: lo que avanza la cinta por objeto
const LARGO = 64;                // cuantos objetos tiene la tira
const GANADOR = 54;              // en que posicion cae el premio
const DESDE = 3;                 // donde arranca, para que ya se vea llena

export default {
  name: "MbRuleta",

  props: {
    /** Los premios posibles de la caja, para armar el relleno. */
    premios: { type: Array, required: true },
    /** Lo que el SERVIDOR decidio. Uno por caja abierta. */
    ganados: { type: Array, default: () => [] },
    /** Cuantas cintas dibujar mientras no hay resultado todavia. */
    cuantas: { type: Number, default: 1 },
    rapido: { type: Boolean, default: false },
  },

  data() {
    return {
      ANCHO_ITEM,
      cintas: [],
      animando: false,
      quieta: true,
      /* Mientras esto es `true`, nada puede reiniciar la cinta. */
      girandoAhora: false,
    };
  },

  computed: {
    duracion() { return this.rapido ? 1600 : 5200; },
    altoVia() { return this.cuantas > 2 ? "150px" : "190px"; },
  },

  methods: {
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },
    color(r) { return COLORES[r] || COLORES.blue; },
    posicion(it) {
      const s = sprite(it.imageUrl);
      return s ? s.estilo.backgroundPosition : "0% 0%";
    },

    /* El ganador queda grande; el resto se achica y se apaga. */
    esGanador(c, i) { return this.quieta && i === GANADOR; },
    escala(c, i) { return this.esGanador(c, i) ? 1.12 : 1; },
    opacidad(c, i) { return this.quieta && i !== GANADOR ? 0.35 : 1; },
    brillo(c, i) { return this.esGanador(c, i) ? 0.95 : 0.35; },

    /**
     * Un premio al azar de la caja, respetando sus chances.
     *
     * Es SOLO PARA EL RELLENO de la cinta: lo que se ve pasar volando.
     * El premio de verdad --el de la posicion 54-- lo decide el
     * servidor y llega en `ganados`. Si el relleno se sorteara mal no
     * cambiaria nada de lo que el jugador gana; solo se veria menos
     * creible.
     */
    alAzar() {
      const n = Math.random();
      let acc = 0;
      for (const p of this.premios) {
        acc += Number(p.chance) || 0;
        if (n < acc) return p;
      }
      return this.premios[this.premios.length - 1];
    },

    /**
     * ARRANCA EL GIRO.
     *
     * Lo llama la pantalla DESPUES de que el servidor contesto, con los
     * premios que de verdad salieron. La cinta no decide nada: muestra.
     *
     * El truco de los dos pasos --poner la cinta quieta, esperar un
     * cuadro, y recien ahi encender la transicion-- hace falta porque el
     * navegador junta los dos cambios en uno si pasan en el mismo
     * momento: la cinta aparecería ya en el final, sin moverse.
     */
    girar(ganados) {
      const cuantas = ganados.length || this.cuantas;

      this.cintas = Array.from({ length: cuantas }, (_, c) => {
        const items = Array.from({ length: LARGO }, () => this.alAzar());
        /* El premio de verdad, puesto donde cae el puntero. */
        items[GANADOR] = ganados[c] || items[GANADOR];
        return { items, x: -(DESDE * PASO + 60) };
      });

      this.animando = false;
      this.quieta = false;
      this.girandoAhora = true;

      this.arrancar();
    },

    /**
     * Enciende la transicion y recien DESPUES mueve la cinta.
     *
     * Hacen falta tres pasos separados y no dos. Vue junta todos los
     * cambios de un mismo momento en un solo dibujado, asi que si la
     * transicion y la posicion nueva se ponen juntas, el navegador no
     * llega a ver la posicion vieja CON la transicion puesta: salta al
     * final sin animar. Eso es lo que pasaba.
     *
     *   1. la cinta en su lugar de arranque, sin transicion
     *   2. se enciende la transicion, la cinta sigue donde estaba
     *   3. se mueve: ahi si, el navegador anima de uno al otro
     */
    async arrancar() {
      await this.$nextTick();                       // 1 pintado
      this.animando = true;
      await this.$nextTick();                       // 2 transicion puesta

      /*
        Un respiro antes de mover, para que el navegador pinte la cinta
        en su lugar de arranque CON la transicion ya puesta.

        Se usa un temporizador y NO requestAnimationFrame, que seria lo
        natural: el navegador congela rAF cuando la pestaña no esta a la
        vista, y entonces la cinta se quedaba clavada para siempre.
        Alguien que abre una caja y cambia de pestaña vuelve y encuentra
        el giro terminado, no congelado.
      */
      await new Promise((r) => window.setTimeout(r, 32));

      this.cintas = this.cintas.map((cinta) => ({
        ...cinta,
        /* Un empujoncito al azar para que las cuatro no frenen clavadas
           en el mismo pixel, que queda mecanico. */
        x: -(GANADOR * PASO + 60) + (Math.random() * 24 - 12),
      }));

      window.setTimeout(() => {
        this.quieta = true;
        this.girandoAhora = false;
        this.$emit("termino");
      }, this.duracion + 80);
    },

    /**
     * Deja la cinta llena y quieta, sin animar: el estado de reposo.
     *
     * NO HACE NADA SI HAY UN GIRO EN CURSO. Esto importa: cualquier
     * cambio de propiedad --que el jugador toque el x2, que llegue el
     * saldo nuevo-- dispara un watcher, y si ese watcher reiniciara la
     * cinta a mitad del giro, la animacion se cortaria y el premio
     * aparecería de la nada.
     */
    reposo() {
      if (this.girandoAhora) return;
      this.cintas = Array.from({ length: this.cuantas }, () => ({
        items: Array.from({ length: LARGO }, () => this.alAzar()),
        x: -(DESDE * PASO + 60),
      }));
      this.animando = false;
      this.quieta = false;
    },
  },

  watch: {
    cuantas() { if (this.quieta !== false || !this.cintas.length) this.reposo(); },
    premios() { this.reposo(); },
  },

  mounted() { this.reposo(); },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-ruleta {
  position: relative;
  overflow: hidden;
  border-radius: 18px;
  border: 2px solid #24365e;
  // El fondo del diseño: un resplandor azul al centro sobre una trama
  // de puntos, que le da textura sin pelear con los objetos.
  background:
    radial-gradient(ellipse 45% 70% at 50% 50%, rgba(63, 124, 240, .16) 0%, rgba(15, 26, 48, 0) 70%),
    radial-gradient(rgba(255, 255, 255, .05) 1px, transparent 1.2px) 0 0 / 18px 18px,
    #0f1a30;
  padding: 30px 0;
}

.mb-ruleta__punta {
  position: absolute;
  left: 50%;
  margin-left: -9px;
  z-index: 2;

  &--arriba { top: 8px; }
  &--abajo { bottom: 8px; }
}

.mb-ruleta__raya {
  position: absolute;
  height: 1px;
  z-index: 2;

  &--ai { top: 14px; left: 22%; right: calc(50% + 18px); background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.3)); }
  &--ad { top: 14px; right: 22%; left: calc(50% + 18px); background: linear-gradient(90deg, rgba(255,255,255,.3), rgba(255,255,255,0)); }
  &--bi { bottom: 14px; left: 22%; right: calc(50% + 18px); background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.3)); }
  &--bd { bottom: 14px; right: 22%; left: calc(50% + 18px); background: linear-gradient(90deg, rgba(255,255,255,.3), rgba(255,255,255,0)); }
}

.mb-ruleta__cintas { display: flex; flex-direction: column; gap: 6px; }

.mb-ruleta__via { position: relative; overflow: hidden; }

.mb-ruleta__tira {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  display: flex;
  gap: 12px;
  align-items: center;
  will-change: transform;
}

.mb-ruleta__casillero {
  flex: none;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: opacity .35s ease;
}

.mb-ruleta__marco {
  position: relative;
  width: 86px;
  aspect-ratio: 1 / 1;
  transition: transform .35s ease;
}

.mb-ruleta__borde {
  position: absolute;
  inset: 6% 18%;
  border-radius: 10px;

  &--a { border: 2px solid rgba(255, 255, 255, .13); transform: rotate(-7deg); }
  &--b { border: 2px solid rgba(255, 255, 255, .08); transform: rotate(7deg); }
}

// El resplandor del color de la rareza, debajo del objeto.
.mb-ruleta__brillo {
  position: absolute;
  left: 20%;
  right: 20%;
  bottom: 4%;
  height: 22%;
  border-radius: 50%;
  filter: blur(16px);
  transition: opacity .35s ease;
}

.mb-ruleta__foto {
  position: absolute;
  inset: 0;
  filter: drop-shadow(0 6px 10px rgba(0, 0, 0, .5));
}

.mb-ruleta__rotulo {
  height: 34px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  white-space: nowrap;
  text-align: center;
}

.mb-ruleta__nombre {
  max-width: 170px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 900;
  font-size: 14px;
}

.mb-ruleta__valor {
  font-weight: 800;
  font-size: 13px;
  color: $texto-2;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

/*
  Quien pidió que las cosas no se muevan NO ve la cinta volar: el premio
  aparece directo. La animación es adorno; el resultado es el mismo.
*/
@media (prefers-reduced-motion: reduce) {
  .mb-ruleta__tira { transition: none !important; }
}
</style>
