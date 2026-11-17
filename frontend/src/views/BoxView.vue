<template>
  <div class="mb-abrir">
    <p v-if="cargando" class="mb-vacio">{{ $t('common.loading') }}</p>

    <template v-else-if="caja">
      <!-- ── La fila de arriba ────────────────────────────────────── -->
      <div class="mb-abrir__barra">
        <router-link to="/boxes" class="mb-abrir__volver">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff"
               stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>{{ $t('common.previous') }}
        </router-link>

        <div class="mb-abrir__quien">
          <div v-if="lamina" class="mb-art mb-abrir__tapa" :class="lamina.clase"
               :style="lamina.estilo" aria-hidden="true"></div>
          <h1>{{ caja.name }}</h1>
        </div>

        <div class="mb-abrir__herramientas">
          <router-link to="/profile" class="mb-redondito" :aria-label="$t('box.provablyFair')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c9d7f7"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 3" />
            </svg>
          </router-link>

          <button
            type="button" class="mb-redondito"
            :aria-pressed="mudo ? 'true' : 'false'"
            :aria-label="mudo ? $t('box.unmute') : $t('box.mute')"
            :style="{ opacity: mudo ? .55 : 1 }"
            @click="mudo = !mudo"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c9d7f7"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M11 5 6 9H3v6h3l5 4z" />
              <path v-if="!mudo" d="M16 9a4 4 0 0 1 0 6" />
              <path v-else d="M16 9l5 6M21 9l-5 6" />
            </svg>
          </button>

          <span class="mb-redondito mb-redondito--verificado" :title="$t('box.provablyFair')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#3f9bff" aria-hidden="true">
              <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5zm-1.2 14.2-3.5-3.5 1.4-1.4 2.1 2.1 4.6-4.6 1.4 1.4z" />
            </svg>
          </span>
        </div>
      </div>

      <!-- ── La ruleta ────────────────────────────────────────────── -->
      <MbRuleta
        ref="ruleta" :premios="caja.prizes" :cuantas="veces"
        :rapido="rapido" @termino="alFrenar"
      />

      <!-- ── Los controles ────────────────────────────────────────── -->
      <div class="mb-abrir__controles">
        <div class="mb-veces" role="radiogroup" :aria-label="$t('box.howMany')">
          <button
            v-for="n in caja.maximoALaVez" :key="n" type="button" role="radio"
            :aria-checked="veces === n ? 'true' : 'false'"
            class="mb-veces__b" :class="{ 'is-activo': veces === n }"
            :disabled="girando" @click="veces = n"
          >{{ n }}</button>
        </div>

        <div class="mb-abrir__botones">
          <button
            v-if="aperturasGratis > 0 && entro"
            type="button" class="mb-amarillo" :disabled="girando" @click="abrir(true)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0b2266"
                 stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7" />
            </svg>{{ $t('box.openFree') }}
          </button>

          <button type="button" class="mb-azul" :disabled="girando" @click="abrir(false)">
            {{ $t('box.openFor', { price: 'SC ' + plata(total) }) }}
          </button>

          <button type="button" class="mb-gris" :disabled="girando" @click="probar">
            {{ $t('box.demo') }}
          </button>
        </div>

        <label class="mb-rapido">
          <input v-model="rapido" type="checkbox" class="mb-chk-chico">
          {{ $t('box.fast') }}
        </label>
      </div>

      <!-- ── Lo que salió ─────────────────────────────────────────── -->
      <div v-if="resultado" class="mb-salio">
        <div class="mb-salio__texto">
          <span class="mb-salio__titulo">{{ $t('box.youWon') }}</span>
          <span class="mb-salio__cifra">
            <span class="mb-sc mb-sc--20" aria-hidden="true">SC</span>{{ plata(valorGanado) }}
          </span>
          <span v-if="resultado.demo" class="mb-salio__demo">{{ $t('box.demoNote') }}</span>
        </div>

        <div v-if="!resultado.demo" class="mb-salio__acciones">
          <button type="button" class="mb-azul" :disabled="vendiendo" @click="venderTodo">
            {{ $t('box.sellFor', { amount: 'SC ' + plata(valorGanado) }) }}
          </button>
          <router-link to="/inventory" class="mb-gris mb-gris--enlace">{{ $t('box.keep') }}</router-link>
        </div>
      </div>

      <!-- ── Lo que puede salir ───────────────────────────────────── -->
      <section class="mb-premios">
        <h2 class="mb-premios__titulo">
          {{ $t('box.chances') }}
          <span class="mb-premios__retorno">{{ $t('box.returnLabel') }} {{ caja.retornoMostrado }}%</span>
        </h2>

        <ul class="mb-premios__lista">
          <li
            v-for="(p, i) in premiosOrdenados" :key="i"
            class="mb-premio" :style="{ borderLeftColor: color(p.rarity) }"
          >
            <span v-if="spr(p)" class="mb-prod mb-premio__foto" :style="spr(p)" aria-hidden="true"></span>
            <span class="mb-premio__nombre">{{ p.name }}</span>
            <span class="mb-premio__valor">
              <span class="mb-sc mb-sc--16" aria-hidden="true">SC</span>{{ plata(p.valueSc) }}
            </span>
            <span class="mb-premio__chance">{{ chance(p.chance) }}</span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import api from "@/api";
import MbRuleta from "@/components/MbRuleta.vue";
import { sprite } from "@/utils/sprite";

const COLORES = {
  blue: "#3f7cf0", purple: "#8b4fe0", pink: "#e0418f", red: "#e2424b", gold: "#f5b80a",
};

/**
 * ABRIR UNA CAJA.
 *
 * LA CINTA NO DECIDE NADA
 *
 * Esto es lo que diferencia esta pantalla del prototipo. Allá el premio
 * lo elegía el navegador y la cinta frenaba donde él decía. Acá se le
 * pregunta al SERVIDOR --que cobra, sortea con la semilla comprometida
 * y guarda el recibo-- y recién entonces la cinta arranca, con el premio
 * de verdad puesto donde va a frenar.
 *
 * Por eso el saldo baja apenas se toca el botón y no cuando la cinta
 * para: la jugada ya pasó, la animación es el relato.
 *
 * LAS CHANCES ESTAN A LA VISTA
 *
 * Abajo, con todo lo que puede salir. Y debajo de un décimo de
 * porciento se muestran como "1 / 250.000", porque "0.0004%" no le dice
 * nada a nadie.
 */
export default {
  name: "BoxView",
  components: { MbRuleta },

  data() {
    return {
      caja: null,
      cargando: true,
      veces: 1,
      rapido: false,
      mudo: false,
      girando: false,
      vendiendo: false,
      resultado: null,
    };
  },

  computed: {
    ...mapGetters(["entro", "aperturasGratis"]),

    lamina() { return this.caja ? sprite(this.caja.imageUrl) : null; },

    premiosOrdenados() {
      return [...((this.caja && this.caja.prizes) || [])].sort((a, b) => b.valueSc - a.valueSc);
    },

    total() {
      return Math.round((this.caja ? this.caja.priceSc : 0) * this.veces * 100) / 100;
    },

    valorGanado() {
      if (!this.resultado) return 0;
      return Math.round(
        this.resultado.resultados.reduce((a, r) => a + r.premio.valueSc, 0) * 100
      ) / 100;
    },
  },

  methods: {
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },
    color(r) { return COLORES[r] || COLORES.blue; },
    spr(p) {
      const s = sprite(p.imageUrl);
      return s ? s.estilo : null;
    },

    chance(c) {
      const pct = c * 100;
      if (pct >= 0.1) return pct.toFixed(2) + "%";
      return "1 / " + Math.round(1 / c).toLocaleString("en-US");
    },

    async traer() {
      this.cargando = true;
      this.resultado = null;
      try {
        const { data } = await api.get(`/boxes/${this.$route.params.slug}`);
        this.caja = data.data;
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
        this.$router.push("/boxes");
      } finally {
        this.cargando = false;
      }
    },

    /**
     * Abre de verdad.
     *
     * Primero el servidor, después la cinta. Si el servidor dice que no
     * --no alcanza el saldo, la caja se apagó-- no se anima nada: sería
     * mentirle al jugador con un giro que no pasó.
     */
    async abrir(gratis) {
      if (!this.entro) {
        this.$router.push("/signup");
        return;
      }
      this.girando = true;
      this.resultado = null;
      try {
        const { data } = await api.post(`/boxes/${this.caja.slug}/open`, {
          veces: gratis ? 1 : this.veces,
        });
        this.$store.commit("saldo", data.data);
        this.pendiente = data.data;
        this.$refs.ruleta.girar(data.data.resultados.map((r) => r.premio));
      } catch (err) {
        this.girando = false;
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    async probar() {
      this.girando = true;
      this.resultado = null;
      try {
        const { data } = await api.post(`/boxes/${this.caja.slug}/demo`, { veces: this.veces });
        this.pendiente = data.data;
        this.$refs.ruleta.girar(data.data.resultados.map((r) => r.premio));
      } catch (err) {
        this.girando = false;
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    /* La cinta frenó: recién ahora se le muestra qué salió. */
    alFrenar() {
      this.girando = false;
      this.resultado = this.pendiente;
      this.pendiente = null;
      if (!this.mudo) this.sonar();
    },

    /**
     * El sonidito de premio.
     *
     * Tres notas que suben, armadas con el sintetizador del navegador.
     * No hay archivo de audio: son unos bytes de código contra unos
     * cientos de kilobytes que habría que bajar.
     */
    sonar() {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this._ac = this._ac || new AC();
        if (this._ac.state === "suspended") this._ac.resume();
        [523.25, 659.25, 783.99].forEach((f, i) => {
          const o = this._ac.createOscillator();
          const g = this._ac.createGain();
          o.type = "triangle";
          o.frequency.setValueAtTime(f, this._ac.currentTime + i * 0.09);
          g.gain.setValueAtTime(0.0001, this._ac.currentTime + i * 0.09);
          g.gain.exponentialRampToValueAtTime(0.07, this._ac.currentTime + i * 0.09 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, this._ac.currentTime + i * 0.09 + 0.3);
          o.connect(g).connect(this._ac.destination);
          o.start(this._ac.currentTime + i * 0.09);
          o.stop(this._ac.currentTime + i * 0.09 + 0.32);
        });
      } catch {
        /* Sin sonido el juego anda igual. */
      }
    },

    async venderTodo() {
      this.vendiendo = true;
      try {
        const ids = this.resultado.resultados.map((r) => r.premio._id).filter(Boolean);
        const { data } = await api.post("/inventory/sell-many", { ids });
        this.$store.commit("saldo", data.data);
        this.$store.dispatch("avisar", {
          texto: this.$t("box.sellFor", { amount: "SC " + this.plata(data.data.totalSc) }),
        });
        this.resultado = null;
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.vendiendo = false;
      }
    },
  },

  created() { this.traer(); },

  watch: {
    "$route.params.slug"() { this.veces = 1; this.traer(); },
  },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-abrir { display: flex; flex-direction: column; gap: 16px; }

.mb-vacio { margin: 40px 0; text-align: center; color: $texto-4; }

/* ── Arriba ───────────────────────────────────────────────────────── */

.mb-abrir__barra {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  @include en-celular { grid-template-columns: auto 1fr; }
}

.mb-abrir__volver {
  justify-self: start;
  height: 44px;
  padding: 0 8px;
  color: #fff;
  font-weight: 900;
  font-size: 14px;
  letter-spacing: .04em;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 8px;
  @include foco;
  &:hover { color: #fff; opacity: .8; }
}

.mb-abrir__quien {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;

  h1 {
    margin: 0;
    font-weight: 900;
    font-size: clamp(16px, 2.4vw, 22px);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.mb-abrir__tapa { width: 46px; height: 46px; flex: none; }

.mb-abrir__herramientas {
  justify-self: end;
  display: flex;
  gap: 8px;
  @include en-celular { grid-column: 1 / -1; justify-self: start; }
}

.mb-redondito {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  border: 0;
  background: #16253f;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  @include foco;
  &:hover { background: #1d3354; }
  &--verificado { background: #17305e; cursor: default; }
}

/* ── Controles ────────────────────────────────────────────────────── */

.mb-abrir__controles {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.mb-veces {
  display: flex;
  gap: 2px;
  padding: 4px;
  border-radius: 12px;
  background: #12213a;
}

.mb-veces__b {
  width: 40px;
  height: 38px;
  border-radius: 9px;
  border: 0;
  background: transparent;
  color: $texto-2;
  font-family: inherit;
  font-weight: 900;
  font-size: 15px;
  cursor: pointer;
  @include foco;

  &:hover:not(:disabled) { background: #1d3354; color: #fff; }
  &.is-activo { background: $azul; color: #fff; }
  &:disabled { opacity: .5; cursor: default; }
}

.mb-abrir__botones { display: flex; flex-wrap: wrap; gap: 10px; }

%boton {
  height: 50px;
  padding: 0 22px;
  border-radius: 25px;
  font-family: $fuente-cartel;
  font-size: 20px;
  letter-spacing: .03em;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-decoration: none;
  @include foco;
  &:disabled { opacity: .55; cursor: default; }
}

/* El botón de las gratis: el amarillo del diseño con su sombra dura. */
.mb-amarillo {
  @extend %boton;
  border: 3px solid #fff;
  background: linear-gradient(180deg, #ffd65a 0%, #f2a91c 100%);
  color: $azul-tinta;
  box-shadow: 0 4px 0 #b9780c;
  &:hover:not(:disabled) { filter: brightness(1.05); }
}

.mb-azul {
  @extend %boton;
  border: 3px solid #fff;
  background: linear-gradient(180deg, #5b9bff 0%, #2f6fe0 100%);
  color: #fff;
  box-shadow: 0 4px 0 #1c4fc4;
  &:hover:not(:disabled) { filter: brightness(1.07); }
}

.mb-gris {
  @extend %boton;
  border: 2px solid #2a4170;
  background: #16253f;
  color: #fff;
  font-size: 17px;
  &:hover:not(:disabled) { background: #1d3354; color: #fff; }
}

.mb-rapido {
  display: flex;
  align-items: center;
  gap: 8px;
  color: $texto-3;
  font-weight: 800;
  font-size: 13px;
  cursor: pointer;
}

.mb-chk-chico {
  appearance: none;
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  margin: 0;
  border-radius: 5px;
  border: 2px solid #3a5687;
  background: #0e1a2e;
  cursor: pointer;
  display: grid;
  place-content: center;
  @include foco;

  &:checked { background: $azul; border-color: $azul; }
  &:checked::after {
    content: "";
    width: 5px;
    height: 9px;
    border: solid #fff;
    border-width: 0 2.5px 2.5px 0;
    transform: translateY(-1px) rotate(45deg);
  }
}

/* ── Lo que salió ─────────────────────────────────────────────────── */

.mb-salio {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 20px;
  border: 2px solid #24365e;
  border-radius: 16px;
  background: #12213a;
}

.mb-salio__texto { display: flex; flex-direction: column; gap: 2px; }

.mb-salio__titulo {
  font-family: $fuente-cartel;
  font-size: 20px;
  letter-spacing: .5px;
}

.mb-salio__cifra {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 900;
  font-size: 26px;
}

.mb-salio__demo { color: $amarillo; font-size: 12px; font-weight: 700; }

.mb-salio__acciones { display: flex; flex-wrap: wrap; gap: 10px; }
.mb-gris--enlace { font-family: $fuente-cartel; }

/* ── Los premios ──────────────────────────────────────────────────── */

.mb-premios {
  border: 1px solid $borde;
  border-radius: 16px;
  background: $panel;
  overflow: hidden;
}

.mb-premios__titulo {
  margin: 0;
  padding: 16px 20px;
  border-bottom: 1px solid $borde;
  font-size: 15px;
  font-weight: 900;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.mb-premios__retorno { color: $texto-3; font-weight: 800; font-size: 13px; }

.mb-premios__lista { margin: 0; padding: 0; list-style: none; }

.mb-premio {
  display: grid;
  grid-template-columns: 40px 1fr auto 100px;
  align-items: center;
  gap: 12px;
  padding: 10px 20px;
  border-bottom: 1px solid rgba(31, 51, 85, .6);
  border-left: 3px solid transparent;

  &:last-child { border-bottom: 0; }
  &:hover { background: $panel-hover; }

  @include en-celular {
    grid-template-columns: 34px 1fr auto;
    row-gap: 2px;
  }
}

.mb-premio__foto { width: 40px; height: 40px; @include en-celular { width: 34px; height: 34px; } }
.mb-premio__nombre { font-weight: 700; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.mb-premio__valor { display: flex; align-items: center; gap: 5px; font-weight: 900; }

.mb-premio__chance {
  text-align: right;
  color: $texto-3;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  @include en-celular { grid-column: 2 / -1; text-align: left; font-size: 12px; }
}
</style>
