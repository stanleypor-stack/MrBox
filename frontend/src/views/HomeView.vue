<template>
  <div class="mb-home">
    <!-- ── La barra del regalo ──────────────────────────────────── -->
    <router-link v-if="!entro" to="/signup" class="mb-claim">
      <span class="mb-claim__arte" aria-hidden="true">
        <span class="mb-prod mb-claim__a1"></span>
        <span class="mb-prod mb-float mb-claim__a2"></span>
      </span>
      <span class="mb-claim__texto">
        <span class="mb-claim__titulo">{{ $t('home.claimTitle', { n: regalo }) }}</span>
        <span class="mb-claim__sub">{{ $t('home.claimSub') }}</span>
      </span>
      <span class="mb-claim__cta">{{ $t('home.claim') }}</span>
    </router-link>

    <!-- ── Las aperturas gratis que le quedan ───────────────────── -->
    <section v-if="entro && aperturasGratis > 0 && tickets.length" class="mb-gratis">
      <div class="mb-gratis__cabeza">
        <h2>{{ $t('home.yourFreeOpens') }}</h2>
        <span>{{ $t('home.freeLeft', { n: aperturasGratis, total: regalo }) }}</span>
      </div>
      <div class="mb-gratis__grilla">
        <router-link
          v-for="t in tickets" :key="t.slug" :to="`/boxes/${t.slug}`" class="mb-tix"
        >
          <span class="mb-tix__arriba">
            <span class="mb-tix__cinta">{{ $t('home.freeOpen') }}</span>
            <span class="mb-art mb-float mb-tix__arte" :style="arte(t)"></span>
          </span>
          <span class="mb-tix__abajo">
            <span class="mb-tix__nombre">{{ t.name }}</span>
            <span class="mb-tix__cat">{{ t.category }}</span>
            <span class="mb-tix__cta">{{ $t('action.open') }}</span>
          </span>
        </router-link>
      </div>
    </section>

    <!-- ── El carrusel ──────────────────────────────────────────── -->
    <section class="mb-banners" :aria-label="$t('home.highlights')" aria-roledescription="carousel">
      <div ref="tira" class="mb-banners__tira mb-snap" @scroll.passive="alDeslizar">
        <div v-for="(b, i) in bannersConArte" :key="i" class="mb-banner" :style="{ background: b.bg }">
          <div class="mb-rays mb-banner__rayos" aria-hidden="true"></div>

          <div class="mb-banner__arte" aria-hidden="true">
            <div class="mb-banner__halo" :style="{ background: b.glow }"></div>
            <div class="mb-art mb-float2 mb-banner__p1" :style="{ backgroundPosition: b.p1 }"></div>
            <div class="mb-art mb-float mb-banner__p2" :style="{ backgroundPosition: b.p2 }"></div>
            <div class="mb-art mb-float3 mb-banner__p3" :style="{ backgroundPosition: b.p3 }"></div>
          </div>

          <div class="mb-banner__texto">
            <span class="mb-banner__kicker">{{ $t(b.kicker) }}</span>
            <span class="mb-banner__titulo">{{ $t(b.title) }}</span>
            <span class="mb-banner__sub">{{ $t(b.sub) }}</span>
            <router-link :to="b.a" class="mb-banner__cta">{{ $t(b.cta) }}</router-link>
          </div>
        </div>
      </div>

      <div class="mb-banners__puntos">
        <button
          v-for="(b, i) in bannersConArte" :key="i" type="button"
          class="mb-punto" :class="{ 'is-activo': i === actual }"
          :aria-label="$t(b.title)" @click="irA(i)"
        ></button>
      </div>
    </section>

    <!-- ── Live pulls ───────────────────────────────────────────── -->
    <section class="mb-pulls" :aria-label="$t('home.livePulls')">
      <div class="mb-pulls__rotulo">
        <svg width="40" height="40" viewBox="0 0 48 48" aria-hidden="true">
          <defs>
            <linearGradient id="mbTrofeo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#ffe08a" />
              <stop offset=".45" stop-color="#ff86b8" />
              <stop offset="1" stop-color="#b44dff" />
            </linearGradient>
          </defs>
          <path d="M15 9h18v9a9 9 0 0 1-18 0z" fill="url(#mbTrofeo)" />
          <path d="M15 12H9.5a5.5 5.5 0 0 0 5.5 7M33 12h5.5a5.5 5.5 0 0 1-5.5 7"
                fill="none" stroke="url(#mbTrofeo)" stroke-width="3" stroke-linecap="round" />
          <path d="M19 11h3v10h-3z" fill="#ffffff" opacity=".35" />
          <rect x="21" y="27" width="6" height="6" fill="#ff9ac6" />
          <path d="M15 39h18l-2.5-6h-13z" fill="#c25cff" />
          <rect x="12.5" y="39" width="23" height="4.5" rx="1.5" fill="#8a35e0" />
          <path d="M38 4l1.2 2.8L42 8l-2.8 1.2L38 12l-1.2-2.8L34 8l2.8-1.2z" fill="#ffe08a" />
          <path d="M9 3l.8 1.7 1.7.8-1.7.8L9 8l-.8-1.7L6.5 5.5l1.7-.8z" fill="#ffffff" />
        </svg>
        <span class="mb-pulls__dos" v-html="$t('home.livePullsTwoLines')"></span>
        <span class="mb-pulls__una">{{ $t('home.livePulls') }}</span>
        <span class="mb-pulls__punto" aria-hidden="true"></span>
      </div>

      <div class="mb-pulls__via">
        <div class="mb-row mb-pulls__fila">
          <router-link
            v-for="p in pulls" :key="p._id" :to="`/boxes/${p.boxSlug}`" class="mb-pull-card"
          >
            <span class="mb-pull-card__marca">MB</span>
            <span v-if="sprPremio(p)" class="mb-prod mb-pull-card__foto" :style="sprPremio(p)" aria-hidden="true"></span>
            <span class="mb-pull-card__nombre">{{ p.premio.name }}</span>
            <span class="mb-pull-card__valor">
              <span class="mb-sc mb-sc--13" aria-hidden="true">SC</span>{{ corto(p.premio.valueSc) }}
            </span>
          </router-link>
        </div>
        <div class="mb-pulls__desvanece" aria-hidden="true"></div>
      </div>
    </section>

    <!-- ── Las filas de cajas ───────────────────────────────────── -->
    <section v-for="fila in filas" :key="fila.id" class="mb-fila">
      <div class="mb-fila__cabeza">
        <h2>{{ $t(fila.titulo) }}</h2>
        <div class="mb-fila__mandos">
          <router-link :to="verTodo(fila.id)" class="mb-fila__todo">{{ $t('home.viewAll') }}</router-link>
          <div class="mb-flechas">
            <button type="button" :aria-label="$t('common.previous')" @click="correr(fila.id, -1)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
            </button>
            <span aria-hidden="true"></span>
            <button type="button" :aria-label="$t('common.next')" @click="correr(fila.id, 1)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
            </button>
          </div>
        </div>
      </div>
      <div :ref="'tira-' + fila.id" class="mb-row mb-fila__tira">
        <MbTarjetaDeCaja v-for="c in fila.items" :key="c._id" :caja="c" class="mb-fila__caja" />
      </div>
    </section>

    <p v-if="cargando" class="mb-vacio">{{ $t('common.loading') }}</p>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import api from "@/api";
import MbTarjetaDeCaja from "@/components/MbTarjetaDeCaja.vue";
import { sprite } from "@/utils/sprite";

const COLORES = {
  blue: "#3f7cf0", purple: "#8b4fe0", pink: "#e0418f", red: "#e2424b", gold: "#f5b80a",
};

/**
 * LA PORTADA.
 *
 * Portada del prototipo: la barra amarilla del regalo, los tickets de
 * las aperturas gratis, el carrusel de cuatro banners con sus rayos y
 * las cajas flotando, la cinta de Live Pulls y las filas de cajas.
 *
 * LAS CUATRO FILAS VIENEN EN UN SOLO PEDIDO
 *
 * Popular Picks, Featured, Luxury y Under SC 5 las arma el servidor
 * junto. Cuatro pedidos para dibujar una portada es medio segundo de
 * pantalla a medio armar en un telefono con mala señal, y esta es la
 * primera pantalla que ve cualquiera.
 */
export default {
  name: "HomeView",
  components: { MbTarjetaDeCaja },

  data() {
    return {
      filas: [],
      pulls: [],
      tickets: [],
      cargando: true,
      regalo: 3,
      actual: 0,
      /* Los cuatro banners del diseño, con su color y su destino. */
      banners: [
        { kicker: "banners.carsKicker", title: "banners.carsTitle", sub: "banners.carsSub",
          cta: "banners.carsCta", bg: "#14306a", glow: "#d24a55", a: "/boxes?sort=caras",
          filtro: (c) => /car|auto|porsche|audi|bmw|moto|harley|gta/i.test(c.name + c.category) },
        { kicker: "banners.goldKicker", title: "banners.goldTitle", sub: "banners.goldSub",
          cta: "banners.goldCta", bg: "#2a2a5e", glow: "#e0a21a", a: "/boxes?search=gold",
          filtro: (c) => /gold|bullion|diamond|ice/i.test(c.name) },
        { kicker: "banners.watchKicker", title: "banners.watchTitle", sub: "banners.watchSub",
          cta: "banners.watchCta", bg: "#0f2f58", glow: "#1d7fbf", a: "/boxes?category=Watches",
          filtro: (c) => /watch|rolex|hublot|heuer|first class/i.test(c.name + c.category) },
        { kicker: "banners.luxKicker", title: "banners.luxTitle", sub: "banners.luxSub",
          cta: "banners.luxCta", bg: "#1b2457", glow: "#6a4fe0", a: "/boxes?min=200&sort=caras",
          filtro: (c) => c.priceSc >= 100 },
      ],
    };
  },

  computed: {
    ...mapGetters(["entro", "aperturasGratis"]),

    /**
     * Los banners, con el arte de cajas DE VERDAD.
     *
     * Derivado y no guardado: calculado una vez al cargar quedaba viejo
     * --y si fallaba, los tres huecos caían en la posición 0% 0% de la
     * lámina, que es la primera caja: por eso salían tres Black Card
     * iguales en vez de tres cajas distintas.
     *
     * Cada banner busca cajas de su tema, como el diseño, y si no
     * encuentra sigue con las que haya: un banner con arte repetido es
     * feo, pero uno vacío es peor.
     */
    bannersConArte() {
      const todas = this.filas.flatMap((f) => f.items);
      if (!todas.length) return this.banners;

      const pos = (c) => {
        const s = c && sprite(c.imageUrl);
        return s ? s.estilo.backgroundPosition : null;
      };

      return this.banners.map((b, i) => {
        /* Primero las de su tema; después, cualquiera, salteando las ya
           usadas para que no se repitan dentro del mismo banner. */
        const suyas = todas.filter(b.filtro);
        const resto = todas.filter((c) => !suyas.includes(c));
        const fuente = [...suyas, ...resto];
        const usadas = [];

        const elegir = (n) => {
          for (let k = 0; k < fuente.length; k += 1) {
            const c = fuente[(n * 7 + k + i * 3) % fuente.length];
            if (!usadas.includes(c)) { usadas.push(c); return pos(c); }
          }
          return pos(fuente[0]);
        };

        return { ...b, p1: elegir(0), p2: elegir(1), p3: elegir(2) };
      });
    },
  },

  methods: {
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },
    color(r) { return COLORES[r] || COLORES.blue; },

    /**
     * El precio corto de una tarjeta de Live Pulls.
     *
     * Mil o mas se abrevia: en una tarjeta de 108px, "284,000.00" se
     * parte en tres renglones y no se lee ninguno. Asi lo hace el
     * diseno y asi queda.
     */
    corto(n) {
      const v = Number(n || 0);
      return v >= 1000 ? (v / 1000).toFixed(1) + "K" : v.toFixed(2);
    },

    /** Mueve una fila de cajas con las flechas de su cabecera. */
    correr(id, hacia) {
      const tira = this.$refs["tira-" + id];
      const caja = Array.isArray(tira) ? tira[0] : tira;
      if (!caja) return;
      /* Casi el ancho visible: deja una tarjeta a la vista para que no
         se pierda el hilo de donde estabas. */
      caja.scrollBy({ left: hacia * Math.max(200, caja.clientWidth - 206), behavior: "smooth" });
    },
    arte(c) {
      const s = sprite(c.imageUrl);
      return s ? s.estilo : {};
    },
    sprPremio(p) {
      const s = sprite(p.premio && p.premio.imageUrl);
      return s ? s.estilo : null;
    },

    verTodo(id) {
      const mapa = {
        popular: "/boxes?sort=popular",
        featured: "/boxes?sort=nuevas",
        luxury: "/boxes?min=200&sort=caras",
        cheap: "/boxes?max=5&sort=baratas",
      };
      return mapa[id] || "/boxes";
    },

    /* Qué banner se está viendo, para marcar el puntito. */
    alDeslizar() {
      const t = this.$refs.tira;
      if (!t) return;
      this.actual = Math.round(t.scrollLeft / t.clientWidth);
    },

    irA(i) {
      const t = this.$refs.tira;
      if (t) t.scrollTo({ left: i * t.clientWidth, behavior: "smooth" });
    },

    async traer() {
      this.cargando = true;
      try {
        const [filas, feed, cfg] = await Promise.all([
          api.get("/boxes/rows"),
          api.get("/boxes/feed/latest", { params: { limit: 24 } }),
          api.get("/public/settings").catch(() => null),
        ]);
        this.filas = filas.data.data;
        this.pulls = feed.data.data;
        if (cfg) this.regalo = cfg.data.data.aperturasDeRegalo;

        /* Los tickets de las gratis: las cajas baratas, que es lo que
           conviene abrir con un regalo. */
        const baratas = this.filas.find((f) => f.id === "cheap");
        this.tickets = ((baratas && baratas.items) || []).slice(0, 3);

      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.cargando = false;
      }
    },
  },

  created() { this.traer(); },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-home { display: flex; flex-direction: column; }

.mb-vacio { margin: 30px 0; text-align: center; color: $texto-4; }

/* ── La barra del regalo ──────────────────────────────────────────── */

.mb-claim {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  border-radius: 18px;
  background: $amarillo-v;
  color: $azul-tinta;
  text-decoration: none;
  box-shadow: 0 5px 0 #c9921a;
  @include foco;

  &:hover { color: $azul-tinta; filter: brightness(1.04); }
}

.mb-claim__arte { position: relative; width: 70px; height: 60px; flex: none; }

.mb-claim__a1 {
  position: absolute;
  left: -14%;
  top: 10%;
  width: 100%;
  aspect-ratio: 1 / 1;
  transform: rotate(-16deg);
  background-position: 82.9268% 0%;
}

.mb-claim__a2 {
  position: absolute;
  left: 10%;
  top: -12%;
  width: 104%;
  aspect-ratio: 1 / 1;
  transform: rotate(6deg);
  background-position: 82.9268% 0%;
}

.mb-claim__texto { display: flex; flex-direction: column; min-width: 0; }
.mb-claim__titulo { font-family: $fuente-cartel; font-size: 22px; line-height: 1.1; }
.mb-claim__sub { font-weight: 700; font-size: 14px; }

.mb-claim__cta {
  margin-left: auto;
  flex: none;
  padding: 12px 18px;
  border-radius: 12px;
  background: $azul-tinta;
  color: #fff;
  font-weight: 900;
  font-size: 15px;
}

/* ── Las aperturas gratis ─────────────────────────────────────────── */

.mb-gratis { margin-top: 16px; display: flex; flex-direction: column; gap: 12px; }

.mb-gratis__cabeza {
  display: flex;
  align-items: center;
  justify-content: space-between;

  h2 { margin: 0; font-weight: 900; font-size: 20px; }
  span { font-weight: 800; font-size: 13px; color: $texto-4; }
}

.mb-gratis__grilla {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 200px));
  gap: 12px;
  @include en-celular { grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); }
}

/*
  EL TICKET.

  La forma de entrada de cine del diseño: los dos semicírculos mordidos
  a los costados se hacen con una máscara de gradientes radiales, no con
  una imagen. Así el ticket se adapta a cualquier ancho.
*/
.mb-tix {
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  overflow: hidden;
  filter: drop-shadow(0 8px 16px rgba(0, 0, 0, .45));
  text-decoration: none;
  color: #fff;
  text-align: center;
  @include foco;

  &:hover { color: #fff; filter: drop-shadow(0 10px 20px rgba(0, 0, 0, .55)) brightness(1.05); }
}

.mb-tix__arriba {
  position: relative;
  flex: none;
  aspect-ratio: 1 / 0.86;
  overflow: hidden;
  background: radial-gradient(circle at 50% 70%, #7cc4ff 0%, #3f8cf5 38%, #1c4fc4 78%, #123a9e 100%);
  -webkit-mask:
    radial-gradient(circle 11px at 0 100%, #0000 97%, #000) left / 51% 100% no-repeat,
    radial-gradient(circle 11px at 100% 100%, #0000 97%, #000) right / 51% 100% no-repeat;
  mask:
    radial-gradient(circle 11px at 0 100%, #0000 97%, #000) left / 51% 100% no-repeat,
    radial-gradient(circle 11px at 100% 100%, #0000 97%, #000) right / 51% 100% no-repeat;
}

.mb-tix__cinta {
  position: absolute;
  left: 50%;
  top: 9%;
  transform: translateX(-50%);
  z-index: 2;
  padding: 3px 10px;
  border-radius: 8px;
  background: $amarillo-v;
  border: 2px solid $azul-tinta;
  font-family: $fuente-cartel;
  font-size: 13px;
  color: $azul-tinta;
  white-space: nowrap;
  box-shadow: 0 3px 0 $azul-tinta;
}

.mb-tix__arte { position: absolute; left: 13%; bottom: 2%; width: 74%; aspect-ratio: 1 / 1; }

.mb-tix__abajo {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 10px 8px 12px;
  // La línea punteada de la perforación, hecha con un gradiente a rayas.
  background-image:
    linear-gradient(90deg, rgba(255, 255, 255, .4) 50%, rgba(255, 255, 255, 0) 50%),
    linear-gradient(180deg, #123a9e, #0b2266);
  background-size: 12px 3px, 100% 100%;
  background-repeat: repeat-x, no-repeat;
  -webkit-mask:
    radial-gradient(circle 11px at 0 0, #0000 97%, #000) left / 51% 100% no-repeat,
    radial-gradient(circle 11px at 100% 0, #0000 97%, #000) right / 51% 100% no-repeat;
  mask:
    radial-gradient(circle 11px at 0 0, #0000 97%, #000) left / 51% 100% no-repeat,
    radial-gradient(circle 11px at 100% 0, #0000 97%, #000) right / 51% 100% no-repeat;
}

.mb-tix__nombre {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: $fuente-cartel;
  font-size: clamp(14px, 3.6vw, 18px);
  line-height: 1.15;
  text-shadow: 0 2px 0 #06143a;
}

.mb-tix__cat {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 800;
  font-size: 11px;
  letter-spacing: .08em;
  color: #a9c8ff;
}

.mb-tix__cta {
  margin-top: 4px;
  padding: 4px 10px;
  border-radius: 14px;
  background: #fff;
  color: $azul-tinta;
  font-weight: 900;
  font-size: 12px;
  white-space: nowrap;
}

/* ── El carrusel ──────────────────────────────────────────────────── */

.mb-banners {
  position: relative;
  margin-top: 18px;
  height: 300px;
  border-radius: 24px;
  overflow: hidden;
  border: 1px solid #2a4a85;
  @include en-celular { height: 230px; }
}

.mb-banners__tira {
  display: flex;
  height: 100%;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}

.mb-banner {
  position: relative;
  flex: 0 0 100%;
  height: 100%;
  overflow: hidden;
  scroll-snap-align: start;
}

// Los rayos que giran despacio detrás del arte.
.mb-banner__rayos {
  position: absolute;
  left: 72%;
  top: 50%;
  width: 1100px;
  height: 1100px;
  margin: -550px 0 0 -550px;
  background: repeating-conic-gradient(from 0deg, rgba(255, 255, 255, .07) 0deg 6deg, rgba(255, 255, 255, 0) 6deg 18deg);
}

.mb-banner__arte { position: absolute; top: 0; right: 0; bottom: 0; width: 56%; }

.mb-banner__halo {
  position: absolute;
  right: -60px;
  top: -60px;
  width: 420px;
  height: 420px;
  border-radius: 50%;
  opacity: .55;
}

.mb-banner__p1 { position: absolute; left: 6%; top: 70px; width: 190px; height: 190px; }
.mb-banner__p2 { position: absolute; left: 34%; top: 22px; width: 240px; height: 240px; }
.mb-banner__p3 { position: absolute; left: 66%; top: 92px; width: 180px; height: 180px; }

.mb-banner__texto {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 52%;
  min-width: 320px;
  box-sizing: border-box;
  padding: 36px 48px 56px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 12px;

  @include en-celular { width: 78%; min-width: 0; padding: 20px 22px 44px; }
}

.mb-banner__kicker {
  align-self: flex-start;
  padding: 5px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, .14);
  font-weight: 800;
  font-size: 13px;
  letter-spacing: .08em;
}

.mb-banner__titulo {
  font-family: $fuente-cartel;
  font-size: 52px;
  line-height: 1.02;
  white-space: nowrap;
  text-shadow: 0 4px 0 #1c4fc4, 0 8px 0 #0b2266;
  @include en-celular { font-size: 30px; white-space: normal; }
}

.mb-banner__sub { font-weight: 700; font-size: 15px; color: #d7e4ff; @include en-celular { font-size: 13px; } }

.mb-banner__cta {
  align-self: flex-start;
  padding: 14px 24px;
  border-radius: 14px;
  background: $amarillo-v;
  color: $azul-tinta;
  font-weight: 900;
  font-size: 15px;
  text-decoration: none;
  @include foco;
  &:hover { color: $azul-tinta; filter: brightness(1.06); }
}

.mb-banners__puntos {
  position: absolute;
  left: 48px;
  bottom: 18px;
  display: flex;
  gap: 8px;
  @include en-celular { left: 22px; bottom: 12px; }
}

.mb-punto {
  width: 10px;
  height: 10px;
  border-radius: 5px;
  border: 0;
  background: rgba(255, 255, 255, .35);
  cursor: pointer;
  transition: width .2s ease, background .2s ease;
  @include foco;

  &.is-activo { width: 28px; background: #fff; }
}

/* ── Live pulls ───────────────────────────────────────────────────── */

.mb-pulls {
  margin-top: 18px;
  display: flex;
  align-items: stretch;
  gap: 14px;
  padding: 12px;
  border: 1px solid #1a2a45;
  border-radius: 18px;
  background: $panel-pulls;

  /*
    EN CELULAR EL ROTULO VA ARRIBA, NO AL COSTADO.

    La columna de 84px del escritorio se lleva un cuarto de una
    pantalla de 375 y deja la cinta tan angosta que entra una tarjeta y
    media. Arriba, en una linea, la cinta queda entera.
  */
  @include en-celular { flex-direction: column; gap: 10px; }
}

.mb-pulls__rotulo {
  flex: none;
  width: 84px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-right: 1px solid $borde-fuerte;
  padding-right: 12px;

  span { font-weight: 900; font-size: 14px; line-height: 1.1; text-align: center; }

  @include en-celular {
    width: auto;
    flex-direction: row;
    justify-content: flex-start;
    border-right: 0;
    padding-right: 0;
    svg { width: 26px; height: 26px; }
  }
}

.mb-pulls__una { display: none; }
.mb-pulls__punto { display: none; width: 8px; height: 8px; border-radius: 50%; background: #2fd47a; }

@include en-celular {
  .mb-pulls__dos { display: none; }
  .mb-pulls__una, .mb-pulls__punto { display: block; }
}

.mb-pulls__via { position: relative; flex: 1; min-width: 0; }

.mb-pulls__fila { display: flex; gap: 10px; overflow-x: auto; @include en-celular { gap: 8px; } }

.mb-pull-card {
  flex: none;
  width: 108px;
  height: 150px;

  @include en-celular { width: 88px; height: 124px; padding: 6px; border-radius: 10px; }
  box-sizing: border-box;
  padding: 8px;
  border: 2px solid #4f9bff;
  border-radius: 12px;
  background: #1c63c9;
  color: #fff;
  text-decoration: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  @include foco;
  &:hover { color: #fff; }
}

// La etiquetita de la casa, arriba a la izquierda.
.mb-pull-card__marca {
  align-self: flex-start;
  padding: 1px 5px;
  border-radius: 5px;
  background: #fff;
  color: $azul-tinta;
  font-family: $fuente-cartel;
  font-size: 10px;
  line-height: 1.4;
}

.mb-pull-card__foto { width: 64px; height: 64px; @include en-celular { width: 52px; height: 52px; } }

.mb-pull-card__nombre {
  text-align: center;
  font-family: $fuente-cartel;
  font-size: 10px;
  line-height: 1.15;
  text-transform: uppercase;
  @include en-celular { font-size: 9px; }
}

.mb-pull-card__valor {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 6px;
  background: $fondo;
  font-weight: 800;
  font-size: 11px;
}

// El velo que desvanece la cinta contra el borde, para que se note que
// sigue habiendo más al costado.
.mb-pulls__desvanece {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 90px;
  pointer-events: none;
  background: linear-gradient(90deg, rgba(16, 29, 51, 0), $panel-pulls);
  @include en-celular { width: 50px; }
}

/* ── Las filas ────────────────────────────────────────────────────── */

.mb-fila { margin-top: 36px; }

.mb-fila__cabeza {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;

  h2 { margin: 0; font-weight: 800; font-size: 28px; }
}

.mb-fila__mandos { display: flex; gap: 10px; }

.mb-fila__todo {
  display: flex;
  align-items: center;
  height: 44px;
  padding: 0 20px;
  border-radius: 12px;
  border: 0;
  background: #1d3354;
  color: #fff;
  font-weight: 800;
  font-size: 15px;
  text-decoration: none;
  @include foco;
  &:hover { background: $lateral-hover; color: #fff; }
}

// Las dos flechas, pegadas, con una rayita en el medio.
.mb-flechas {
  display: flex;
  border-radius: 12px;
  overflow: hidden;
  background: #1d3354;

  button {
    width: 48px;
    height: 44px;
    border: 0;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    @include foco;
    &:hover { background: $lateral-hover; }
  }

  span { width: 1px; background: #2c4670; }
}

.mb-fila__tira {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  scroll-behavior: smooth;
  padding: 4px 0 6px;
}

.mb-fila__caja { flex: none; width: 190px; @include en-celular { width: 150px; } }
</style>
