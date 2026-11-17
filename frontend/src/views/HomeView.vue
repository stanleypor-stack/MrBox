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
        <div v-for="(b, i) in banners" :key="i" class="mb-banner" :style="{ background: b.bg }">
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
          v-for="(b, i) in banners" :key="i" type="button"
          class="mb-punto" :class="{ 'is-activo': i === actual }"
          :aria-label="$t(b.title)" @click="irA(i)"
        ></button>
      </div>
    </section>

    <!-- ── Live pulls ───────────────────────────────────────────── -->
    <section class="mb-pulls" :aria-label="$t('home.livePulls')">
      <div class="mb-pulls__rotulo">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="#ffc83d" aria-hidden="true">
          <path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 21h8" />
        </svg>
        <span>{{ $t('home.livePulls') }}</span>
      </div>

      <div class="mb-pulls__via">
        <div class="mb-row mb-pulls__fila">
          <router-link
            v-for="p in pulls" :key="p._id" :to="`/boxes/${p.boxSlug}`"
            class="mb-pull-card" :style="{ borderColor: color(p.premio.rarity) }"
          >
            <span v-if="sprPremio(p)" class="mb-prod mb-pull-card__foto" :style="sprPremio(p)" aria-hidden="true"></span>
            <span class="mb-pull-card__nombre">{{ p.premio.name }}</span>
            <span class="mb-pull-card__valor">
              <span class="mb-sc mb-sc--16" aria-hidden="true">SC</span>{{ plata(p.premio.valueSc) }}
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
        <router-link :to="verTodo(fila.id)" class="mb-fila__todo">{{ $t('home.viewAll') }}</router-link>
      </div>
      <div class="mb-row mb-fila__tira">
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
          cta: "banners.carsCta", bg: "#14306a", glow: "#d24a55", a: "/boxes?sort=caras" },
        { kicker: "banners.goldKicker", title: "banners.goldTitle", sub: "banners.goldSub",
          cta: "banners.goldCta", bg: "#2a2a5e", glow: "#e0a21a", a: "/boxes?search=gold" },
        { kicker: "banners.watchKicker", title: "banners.watchTitle", sub: "banners.watchSub",
          cta: "banners.watchCta", bg: "#0f2f58", glow: "#1d7fbf", a: "/boxes?category=Watches" },
        { kicker: "banners.luxKicker", title: "banners.luxTitle", sub: "banners.luxSub",
          cta: "banners.luxCta", bg: "#1b2457", glow: "#6a4fe0", a: "/boxes?min=200&sort=caras" },
      ],
    };
  },

  computed: {
    ...mapGetters(["entro", "aperturasGratis"]),
  },

  methods: {
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },
    color(r) { return COLORES[r] || COLORES.blue; },
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

        /* Los banners se quedan con el arte de tres cajas de verdad en
           vez de una posición escrita a mano, así siempre muestran algo
           que existe en el catálogo. */
        const todas = this.filas.flatMap((f) => f.items);
        this.banners = this.banners.map((b, i) => {
          const elegir = (n) => {
            const c = todas[(i * 3 + n) % Math.max(1, todas.length)];
            const s = c && sprite(c.imageUrl);
            return s ? s.estilo.backgroundPosition : "0% 0%";
          };
          return { ...b, p1: elegir(0), p2: elegir(1), p3: elegir(2) };
        });
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
  padding: 12px 14px;
  border: 1px solid $borde;
  border-radius: 18px;
  background: $panel;
}

.mb-pulls__rotulo {
  flex: none;
  width: 84px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;

  span { font-weight: 900; font-size: 14px; line-height: 1.1; text-align: center; }
}

.mb-pulls__via { position: relative; flex: 1; min-width: 0; }

.mb-pulls__fila { display: flex; gap: 10px; overflow-x: auto; }

.mb-pull-card {
  flex: none;
  width: 88px;
  padding: 8px 6px;
  border: 2px solid;
  border-radius: 12px;
  background: #12213a;
  color: #fff;
  text-decoration: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  @include foco;
  &:hover { color: #fff; transform: translateY(-2px); }
}

.mb-pull-card__foto { width: 52px; height: 52px; }

.mb-pull-card__nombre {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
  font-family: $fuente-cartel;
  font-size: 10px;
  line-height: 1.15;
}

.mb-pull-card__valor {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 900;
  font-size: 12px;
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
  background: linear-gradient(90deg, rgba(14, 26, 46, 0), $panel);
}

/* ── Las filas ────────────────────────────────────────────────────── */

.mb-fila { margin-top: 36px; }

.mb-fila__cabeza {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;

  h2 { margin: 0; font-family: $fuente-cartel; font-size: 24px; letter-spacing: .5px; }
}

.mb-fila__todo {
  padding: 9px 16px;
  border-radius: 12px;
  background: $panel-alto;
  border: 1px solid $borde-fuerte;
  color: #fff;
  font-weight: 800;
  font-size: 13px;
  text-decoration: none;
  @include foco;
  &:hover { background: $lateral-hover; color: #fff; }
}

.mb-fila__tira {
  display: flex;
  gap: 14px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.mb-fila__caja { flex: none; width: 190px; @include en-celular { width: 150px; } }
</style>
