<template>
  <div class="mb-retos">
    <div class="mb-retos__cabeza">
      <div class="mb-retos__titulo">
        <h1>{{ $t('challenges.title') }}</h1>
        <p>{{ $t('challenges.sub') }}</p>
      </div>

      <div class="mb-retos__reloj">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffc83d"
             stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6" />
        </svg>
        <span>
          <span class="mb-retos__rot">{{ $t('challenges.newIn') }}</span>
          <span class="mb-retos__n">{{ cuentaAtras }}</span>
        </span>
      </div>
    </div>

    <p v-if="!cargando && !items.length" class="mb-vacio">{{ $t('challenges.empty') }}</p>

    <div v-else class="mb-retos__grilla">
      <article v-for="d in items" :key="d._id" class="mb-reto">
        <div class="mb-reto__arte" :style="{ background: fondoDe(d) }">
          <span class="mb-reto__rayos" aria-hidden="true"></span>
          <span
            v-if="arte(d)" class="mb-reto__caja" :class="arte(d).clase"
            role="img" :aria-label="d.itemName || d.caja.name" :style="arte(d).estilo"
          ></span>
          <span class="mb-reto__premio">
            <span class="mb-sc mb-sc--20" aria-hidden="true">SC</span>{{ plata(d.premioSc) }}
          </span>
        </div>

        <div class="mb-reto__cuerpo">
          <!--
            DOS CARTELES, UN SOLO MECANISMO.

            Por objeto: "Los primeros 3 que saquen un Rolex". Por
            multiplicador: "Pegá 50x". Lo de abajo --cupos, barra,
            boton-- es igual para los dos.
          -->
          <h2 v-if="d.itemName">{{ $t('challenges.hitItem', { n: d.cupos, item: d.itemName }) }}</h2>
          <h2 v-else>{{ $t('challenges.hit', { x: d.multiplicador }) }}</h2>

          <div class="mb-reto__chips">
            <template v-if="d.itemName">
              <span>{{ d.itemName }}</span>
              <span>{{ d.caja.name || $t('challenges.anyBox') }}</span>
            </template>
            <template v-else>
              <span>{{ $t('challenges.target', { amount: plata(d.hayQueSacarSc) }) }}</span>
              <span>{{ d.caja.name }}</span>
              <span>{{ $t('challenges.minPlay', { amount: plata(d.caja.priceSc) }) }}</span>
            </template>
          </div>

          <div class="mb-reto__cupos">
            <div class="mb-reto__cupos-rot">
              <span>{{ $t('challenges.rewardsLeft') }}</span>
              <span>{{ d.cuposLibres }} / {{ d.cupos }}</span>
            </div>
            <div class="mb-reto__barra">
              <div :style="{ width: (d.cuposLibres / d.cupos * 100) + '%' }"></div>
            </div>
          </div>

          <!-- Sin caja, a la lista: el desafio vale en todas. -->
          <router-link
            v-if="!d.yaLoGane && d.cuposLibres > 0"
            :to="d.caja.slug ? `/boxes/${d.caja.slug}` : '/boxes'" class="mb-reto__b"
          >{{ d.caja.name
            ? $t('challenges.play', { name: d.caja.name })
            : $t('challenges.playAny') }}</router-link>

          <span v-else-if="d.yaLoGane" class="mb-reto__b mb-reto__b--hecho">
            {{ $t('challenges.won') }}
          </span>

          <span v-else class="mb-reto__b mb-reto__b--agotado">
            {{ $t('challenges.allGone') }}
          </span>
        </div>
      </article>
    </div>
  </div>
</template>

<script>
import api from "@/api";
import { sprite } from "@/utils/sprite";

const TINTES = {
  Audio: "#1f8fc7", Collectables: "#b13d8c", Community: "#4a5b80", Cookware: "#d27d16",
  Fashion: "#c2449b", Gadgets: "#16936d", Games: "#6a4fe0", Gaming: "#5a4fd6",
  Memorabilia: "#b8862a", Mix: "#2f6fe0", Motorcycles: "#d24a55", Tech: "#1d7fbf",
  "Trading Cards": "#e0a21a", Watches: "#8a6a3a",
};

/**
 * LOS DESAFIOS DEL DIA.
 *
 * "Sacá 50x en la Junk Box y llevate SC 100."
 *
 * No hay nada que reclamar: si pegás el multiplicador y quedaban
 * cupos, el premio entra en esa misma apertura. Un desafío que hay que
 * reclamar es un desafío que la mitad de la gente gana y nunca cobra.
 */
export default {
  name: "ChallengesView",

  data() { return { items: [], cargando: true, ahora: Date.now(), reloj: null }; },

  computed: {
    /** Lo que falta para la medianoche UTC, que es cuando se renuevan. */
    cuentaAtras() {
      const d = new Date(this.ahora);
      const finDelDia = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
      const s = Math.max(0, Math.floor((finDelDia - this.ahora) / 1000));
      const dos = (n) => String(n).padStart(2, "0");
      return `${dos(Math.floor(s / 3600))}:${dos(Math.floor((s % 3600) / 60))}:${dos(s % 60)}`;
    },
  },

  methods: {
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },

    /*
      En los de objeto, la foto del objeto: es lo que se promete. En
      los de multiplicador, la caja.

      La clase sale de `sprite()` y NO se fuerza `mb-art`: las cajas
      viven en una lamina de 14x14 (`background-size: 1400%`) y los
      objetos son un archivo cada uno (`contain`). Con las dos clases
      puestas ganaba la de la lamina y el objeto salia reventado.
    */
    arte(d) { return sprite(d.itemImage || d.caja.imageUrl); },

    fondoDe(d) {
      const c = TINTES[d.caja.category] || TINTES.Mix;
      return `radial-gradient(circle at 50% 55%, ${c} 0%, #12213a 75%)`;
    },

    async traer() {
      this.cargando = true;
      try {
        const { data } = await api.get("/challenges");
        this.items = data.data.items;
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.cargando = false;
      }
    },
  },

  created() {
    this.traer();
    this.reloj = window.setInterval(() => { this.ahora = Date.now(); }, 1000);
  },

  beforeDestroy() { window.clearInterval(this.reloj); },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-retos { display: flex; flex-direction: column; gap: 20px; }

.mb-retos__cabeza {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 14px;
}

.mb-retos__titulo {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 620px;

  h1 {
    margin: 0;
    font-family: $fuente-cartel;
    font-weight: 400;
    font-size: clamp(2rem, 5vw, 2.75rem);
    line-height: 1;
    text-shadow: 0 4px 0 $azul-hondo, 0 7px 0 $azul-tinta;
  }

  p { margin: 0; color: $texto-3; font-size: 16px; line-height: 1.5; }
}

.mb-retos__reloj {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 14px;
  background: $panel-alto;
  border: 1px solid #23397a;

  > span { display: flex; flex-direction: column; }
}

.mb-retos__rot { font-weight: 800; font-size: 12px; letter-spacing: .08em; color: $texto-4; }
.mb-retos__n { font-weight: 900; font-size: 22px; font-variant-numeric: tabular-nums; }

.mb-retos__grilla {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
  gap: 20px;
}

.mb-reto {
  border-radius: 20px;
  overflow: hidden;
  background: $panel-alto;
  border: 1px solid $borde;
  display: flex;
  flex-direction: column;
}

.mb-reto__arte {
  position: relative;
  height: 170px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mb-reto__rayos {
  position: absolute;
  inset: 0;
  background: repeating-conic-gradient(from 0deg at 50% 50%, rgba(255, 255, 255, .10) 0deg 6deg, rgba(255, 255, 255, 0) 6deg 22deg);
}

.mb-reto__caja { position: relative; width: 150px; height: 150px; }

.mb-reto__premio {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 10px;
  background: $fondo;
  font-weight: 900;
  font-size: 15px;
  color: #2fd47a;
}

.mb-reto__cuerpo {
  padding: 18px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  h2 { margin: 0; font-weight: 800; font-size: 20px; }
}

.mb-reto__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  span { padding: 6px 10px; border-radius: 9px; background: #1d3354; font-weight: 800; font-size: 13px; }
}

.mb-reto__cupos { display: flex; flex-direction: column; gap: 6px; }

.mb-reto__cupos-rot {
  display: flex;
  justify-content: space-between;
  font-weight: 700;
  font-size: 13px;
  color: $texto-3;
}

.mb-reto__barra {
  height: 8px;
  border-radius: 4px;
  background: $borde-fuerte;
  overflow: hidden;
  div { height: 100%; background: #2fd47a; }
}

.mb-reto__b {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  border-radius: 12px;
  background: $azul;
  box-shadow: 0 4px 0 $azul-hondo;
  text-decoration: none;
  color: #fff;
  font-weight: 800;
  font-size: 15px;
  @include foco;
  &:hover { color: #fff; filter: brightness(1.06); }

  &--hecho { background: rgba(93, 255, 176, .15); box-shadow: none; color: $verde; }
  &--agotado { background: $panel; box-shadow: none; color: $texto-4; }
}

.mb-vacio { margin: 40px 0; text-align: center; color: $texto-4; }
</style>
