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
    <section v-if="entro && tickets.length" class="mb-gratis">
      <div class="mb-gratis__cabeza">
        <h2>{{ $t('home.yourFreeOpens') }}</h2>
        <span>{{ $t('home.freeLeft', { n: aperturasGratis, total: regalo }) }}</span>
      </div>
      <div class="mb-gratis__grilla">
        <router-link
          v-for="t in tickets" :key="t.slug" :to="`/boxes/${t.slug}`"
          class="mb-tix" :class="{ 'is-usada': t.usada }"
        >
          <span class="mb-tix__arriba">
            <span class="mb-tix__cinta">{{ t.usada ? $t('home.freeUsed') : $t('home.freeOpen') }}</span>
            <span class="mb-art mb-float mb-tix__arte" :style="arte(t)"></span>
          </span>
          <span class="mb-tix__abajo">
            <span class="mb-tix__nombre">{{ t.name }}</span>
            <span class="mb-tix__cat">{{ t.category }}</span>
            <span class="mb-tix__cta">{{ t.usada ? $t('home.freeOpened') : $t('action.open') }}</span>
          </span>
        </router-link>
      </div>
    </section>

    <!-- ── El carrusel ──────────────────────────────────────────── -->
    <section class="mb-banners" :aria-label="$t('home.highlights')" aria-roledescription="carousel">
      <div ref="tira" class="mb-banners__tira mb-snap" @scroll.passive="alDeslizar">
        <router-link v-for="(b, i) in banners" :key="b.foto" :to="b.a" class="mb-banner">
          <img
            class="mb-banner__foto" :src="b.foto" :alt="$t(b.title)"
            :loading="i === 0 ? 'eager' : 'lazy'" :fetchpriority="i === 0 ? 'high' : 'auto'"
          >

          <!-- En el telefono la foto se recorta al arte y el texto va
               encima: entera, la letra del banner queda de 4px. -->
          <span class="mb-banner__velo" aria-hidden="true"></span>
          <span class="mb-banner__texto">
            <span class="mb-banner__titulo">{{ $t(b.title) }}</span>
            <span class="mb-banner__sub">{{ $t(b.sub) }}</span>
            <span class="mb-banner__cta">{{ $t(b.cta) }}</span>
          </span>
        </router-link>
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
        <!--
          `duration` NO ES DECORACION.

          Sin un numero explicito, Vue espera el `transitionend` del
          navegador para sacar del DOM la tarjeta que se fue. Cuando
          ese evento no llega --una pestaña en segundo plano, un
          telefono con las animaciones apagadas, la clase de "moverse"
          pisando a la de "irse"-- la tarjeta NUNCA se borra: la cinta
          junto casi trescientas tarjetas invisibles, cada una con su
          pedazo de lamina. Con el numero puesto, Vue usa un reloj.
        -->
        <transition-group
          name="mb-pull" tag="div" class="mb-row mb-pulls__fila"
          :duration="{ enter: 320, leave: 200 }"
        >
          <router-link
            v-for="p in pulls" :key="p._id" :to="`/boxes/${p.boxSlug}`"
            class="mb-pull-card" :style="colorDeLaTarjeta(p)"
          >
            <span class="mb-pull-card__marca">MB</span>
            <span v-if="sprPremio(p)" class="mb-prod mb-pull-card__foto" :style="sprPremio(p)" aria-hidden="true"></span>
            <img
              v-else-if="p.premio.imageUrl" class="mb-pull-card__foto"
              :src="p.premio.imageUrl" :alt="p.premio.name"
            >
            <span v-else class="mb-pull-card__foto mb-pull-card__sinfoto" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2.5 21 7v10l-9 4.5L3 17V7zM3 7l9 4.5L21 7M12 11.5v10" />
              </svg>
            </span>
            <span class="mb-pull-card__nombre">{{ p.premio.name }}</span>
            <span class="mb-pull-card__valor">
              <span class="mb-sc mb-sc--13" aria-hidden="true">SC</span>{{ corto(p.premio.valueSc) }}
            </span>
          </router-link>
        </transition-group>
        <div class="mb-pulls__desvanece" aria-hidden="true"></div>
      </div>
    </section>

    <!-- ── Las filas de cajas ───────────────────────────────────── -->
    <section v-for="fila in filas" :key="fila.id" class="mb-fila">
      <div class="mb-fila__cabeza">
        <h2>{{ $t(fila.titulo) }}</h2>
        <div class="mb-fila__mandos">
          <router-link :to="verTodo(fila.id)" class="mb-fila__todo">{{ $t('home.viewAll') }}</router-link>
        </div>
      </div>
      <div class="mb-row mb-fila__tira">
        <MbTarjetaDeCaja v-for="c in fila.items" :key="c._id" :caja="c" class="mb-fila__caja" />
      </div>
    </section>

    <!-- ── Top 10 ───────────────────────────────────────────────── -->
    <section v-if="top10.length" class="mb-top">
      <div class="mb-fila__cabeza">
        <h2>{{ $t('home.top10') }}</h2>
        <div class="mb-fila__mandos">
          <router-link to="/boxes?sort=popular" class="mb-fila__todo">{{ $t('home.viewAll') }}</router-link>
        </div>
      </div>

      <div class="mb-row mb-top__tira">
        <router-link
          v-for="(c, i) in top10" :key="c._id" :to="`/boxes/${c.slug}`"
          class="mb-top__caja" :aria-label="$t('home.topAria', { n: i + 1, name: c.name })"
        >
          <span class="mb-top__tarjeta mb-card" :style="{ background: tinte(c) }">
            <span class="mb-top__nombre">{{ c.name }}</span>
            <span v-if="arteDe(c)" class="mb-art mb-top__arte" :class="arteDe(c).clase"
                  :style="arteDe(c).estilo" aria-hidden="true"></span>
            <span class="mb-top__precio">
              <span class="mb-sc mb-sc--15" aria-hidden="true">SC</span>{{ plata(c.priceSc) }}
            </span>
          </span>
          <span class="mb-top__numero" aria-hidden="true">{{ i + 1 }}</span>
        </router-link>
      </div>
    </section>

    <!-- ── Las marcas ───────────────────────────────────────────── -->
    <section class="mb-marcas">
      <div class="mb-fila__cabeza">
        <h2>{{ $t('home.brands') }}</h2>
      </div>

      <div class="mb-row mb-marcas__tira">
        <router-link
          v-for="m in MARCAS" :key="m.nombre" class="mb-marca mb-card"
          :to="{ path: '/boxes', query: { search: m.busca } }"
          :aria-label="$t('home.brandAria', { name: m.nombre })"
          :style="{ fontSize: m.tamano, letterSpacing: m.espacio, textTransform: m.caja }"
        >{{ m.rotulo }}</router-link>
      </div>
    </section>

    <!-- ── Como funciona ────────────────────────────────────────── -->
    <section class="mb-como">
      <h2>{{ $t('home.howTitle') }}</h2>
      <div class="mb-como__grilla">
        <article v-for="(h, i) in comoFunciona" :key="i" class="mb-paso-c">
          <div class="mb-paso-c__arte" :style="{ background: h.fondo }" aria-hidden="true">
            <span class="mb-paso-c__rayos"></span>
            <span v-if="h.arte[0]" class="mb-art mb-paso-c__a1" :style="h.arte[0]"></span>
            <span v-if="h.arte[1]" class="mb-art mb-paso-c__a2" :style="h.arte[1]"></span>
            <span v-if="h.arte[2]" class="mb-art mb-paso-c__a3" :style="h.arte[2]"></span>
          </div>
          <div class="mb-paso-c__texto">
            <h3>{{ $t(h.titulo) }}</h3>
            <p>{{ $t(h.texto) }}</p>
          </div>
        </article>
      </div>
    </section>

    <!-- ── Las preguntas ────────────────────────────────────────── -->
    <section class="mb-faq">
      <h2>{{ $t('home.faqTitle') }}</h2>
      <div class="mb-faq__grilla">
        <div
          v-for="(q, i) in PREGUNTAS" :key="q" class="mb-faq__item"
          :class="{ 'is-abierta': abierta === i }"
        >
          <button type="button" :aria-expanded="abierta === i ? 'true' : 'false'" @click="abierta = abierta === i ? -1 : i">
            {{ $t('faq.' + q + '.q') }}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.8"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
                 :style="{ transform: abierta === i ? 'rotate(180deg)' : 'rotate(0deg)' }">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <p v-if="abierta === i">{{ $t('faq.' + q + '.a') }}</p>
        </div>
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

/*
  El dorso de las cartas del feed: arriba, abajo y el borde. Lo de
  arriba es lo que toca el estallido de rayos, asi que va claro; lo de
  abajo queda en sombra.
*/
const DORSOS = {
  blue: ["#2a79e8", "#0e3d85", "#7db4ff"],
  purple: ["#8b4fe0", "#371b70", "#c79bff"],
  pink: ["#e0418f", "#71103f", "#ff9ccb"],
  red: ["#e2424b", "#73111a", "#ff9aa0"],
  gold: ["#e3a014", "#6f4206", "#ffd97a"],
};

/* El color de cada categoria, el mismo de las tarjetas. */
const TINTES = {
  Audio: "#1f8fc7", Collectables: "#b13d8c", Community: "#4a5b80", Cookware: "#d27d16",
  Fashion: "#c2449b", Gadgets: "#16936d", Games: "#6a4fe0", Gaming: "#5a4fd6",
  Memorabilia: "#b8862a", Mix: "#2f6fe0", Motorcycles: "#d24a55", Tech: "#1d7fbf",
  "Trading Cards": "#e0a21a", Watches: "#8a6a3a",
};

/*
  LAS QUINCE MARCAS DEL DISENO.

  Van escritas, no con su logo: el logo de Rolex en nuestro sitio es
  una marca ajena puesta donde no corresponde. El nombre con la
  tipografia justa dice lo mismo y no mete a nadie en un problema.

  `busca` es lo que se le pide al catalogo al tocarla.
*/
const MARCAS = [
  { nombre: "Apple", rotulo: "Apple", busca: "Apple", tamano: "30px", espacio: "0", caja: "none" },
  { nombre: "Rolex", rotulo: "Rolex", busca: "Rolex", tamano: "24px", espacio: ".28em", caja: "uppercase" },
  { nombre: "PlayStation", rotulo: "PS5", busca: "PS5", tamano: "24px", espacio: ".02em", caja: "none" },
  { nombre: "Pokemon", rotulo: "Pokemon", busca: "Pokemon", tamano: "26px", espacio: "0", caja: "none" },
  { nombre: "Porsche", rotulo: "Porsche", busca: "Porsche", tamano: "20px", espacio: ".32em", caja: "uppercase" },
  { nombre: "Nike", rotulo: "Nike", busca: "Nike", tamano: "30px", espacio: ".02em", caja: "uppercase" },
  { nombre: "Gucci", rotulo: "Gucci", busca: "Gucci", tamano: "24px", espacio: ".26em", caja: "uppercase" },
  { nombre: "Louis Vuitton", rotulo: "LV", busca: "LV", tamano: "18px", espacio: ".12em", caja: "uppercase" },
  { nombre: "Supreme", rotulo: "Supreme", busca: "Supreme", tamano: "24px", espacio: "0", caja: "none" },
  { nombre: "Chanel", rotulo: "Chanel", busca: "Chanel", tamano: "22px", espacio: ".3em", caja: "uppercase" },
  { nombre: "Nintendo", rotulo: "Nintendo", busca: "Nintendo", tamano: "24px", espacio: "0", caja: "none" },
  { nombre: "Hublot", rotulo: "Hublot", busca: "Hublot", tamano: "22px", espacio: ".24em", caja: "uppercase" },
  { nombre: "BMW", rotulo: "BMW", busca: "BMW", tamano: "28px", espacio: ".12em", caja: "uppercase" },
  { nombre: "Jordan", rotulo: "Jordan", busca: "Jordan", tamano: "24px", espacio: ".1em", caja: "uppercase" },
  { nombre: "Bose", rotulo: "Bose", busca: "Bose", tamano: "28px", espacio: ".04em", caja: "uppercase" },
];

/* Las ocho preguntas del diseno. El texto vive en los idiomas. */
const PREGUNTAS = ["what", "fair", "deposit", "missing", "howOpen", "support", "afterWin", "track"];

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
      MARCAS,
      PREGUNTAS,
      abierta: -1,
      filas: [],
      pulls: [],
      relojPulls: null,
      tickets: [],
      cargando: true,
      regalo: 3,
      actual: 0,
      /*
        LOS CUATRO BANNERS.

        El arte es el que mando Dani, tal cual, y por eso NO se dibuja
        con sprites como antes: es una foto por banner. El texto sigue
        viviendo en los idiomas porque la foto solo se lee en el
        telefono, donde se recorta al arte y el titulo va encima.
      */
      banners: [
        { foto: "/img/banners/banner-50k.webp", title: "banners.rewardTitle",
          sub: "banners.rewardSub", cta: "banners.rewardCta", a: "/vip" },
        { foto: "/img/banners/banner-luxury.webp", title: "banners.luxTitle",
          sub: "banners.luxSub", cta: "banners.luxCta", a: "/boxes?sort=caras" },
        { foto: "/img/banners/banner-race.webp", title: "banners.raceTitle",
          sub: "banners.raceSub", cta: "banners.raceCta", a: "/races/weekly" },
        { foto: "/img/banners/banner-gta.webp", title: "banners.gtaTitle",
          sub: "banners.gtaSub", cta: "banners.gtaCta", a: "/promotions" },
      ],
    };
  },

  computed: {
    ...mapGetters(["entro", "aperturasGratis"]),

    /**
     * LAS DIEZ MAS ABIERTAS.
     *
     * Salen de la fila "popular", que el servidor ya ordeno por
     * aperturas. No es un pedido mas: es la misma lista, cortada.
     */
    top10() {
      const popular = this.filas.find((f) => f.id === "popular");
      return popular ? popular.items.slice(0, 10) : [];
    },

    /**
     * Los tres pasos, con arte de cajas DE VERDAD.
     *
     * Como los banners: derivado de lo que haya cargado. Con arte fijo,
     * el dia que una caja sale del catalogo quedan tres huecos.
     */
    comoFunciona() {
      const todas = this.filas.flatMap((f) => f.items);
      const pos = (c) => {
        const s = c && sprite(c.imageUrl);
        return s ? { backgroundPosition: s.estilo.backgroundPosition } : null;
      };
      const tres = (desde) => [0, 1, 2].map((k) => pos(todas[(desde + k * 5) % (todas.length || 1)]));

      return [
        { titulo: "home.how1", texto: "home.how1Sub", fondo: "#2a6be8", arte: tres(0) },
        { titulo: "home.how2", texto: "home.how2Sub", fondo: "#47b83a", arte: tres(2) },
        { titulo: "home.how3", texto: "home.how3Sub", fondo: "#7a3be0", arte: tres(4) },
      ];
    },

  },

  methods: {
    /*
      EL COLOR DE LA TARJETA, SEGUN LO QUE SALIO.

      Como en el prototipo: azul lo comun, rojo lo bueno y dorado lo
      mejor. Una cinta toda azul no dice nada; con el color, de reojo
      se ve que salio algo grande.
    */
    /**
     * EL COLOR DE UNA CARTA, SEGUN LO QUE SALIO.
     *
     * Tres numeros, no uno: el de arriba, el de abajo y el del borde.
     * El dorso de la carta es un degrade con un estallido de rayos, y
     * para eso hace falta saber donde empieza y donde termina (ver
     * .mb-pull-card en los estilos).
     */
    colorDeLaTarjeta(p) {
      const r = (p.premio && p.premio.rarity) || "blue";
      const t = DORSOS[r] || DORSOS.blue;
      return { "--carta-alto": t[0], "--carta-bajo": t[1], "--carta-borde": t[2] };
    },

    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },
    color(r) { return COLORES[r] || COLORES.blue; },

    arteDe(c) { return sprite(c.imageUrl); },

    tinte(c) {
      const color = TINTES[c.category] || TINTES.Mix;
      return `radial-gradient(circle at 50% 58%, ${color} 0%, #12213a 72%)`;
    },

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

    async traerPulls() {
      try {
        const { data } = await api.get("/boxes/feed/latest", { params: { limit: 24 } });

        /*
          SE PEGAN LAS NUEVAS, NO SE CAMBIA LA CINTA ENTERA.

          Reemplazar la lista hacia que Vue tratara como "nueva" a
          cada tarjeta y las animara a todas a la vez: la cinta
          quedaba en blanco un cuarto de segundo, dos veces por
          segundo. Pegando solo las que no estaban, lo que ya se ve
          no se vuelve a dibujar y entra una sola por vez, que es
          justo lo que hace mrloot.
        */
        const tengo = new Set(this.pulls.map((p) => p._id));
        const nuevas = data.data.filter((p) => !tengo.has(p._id));

        if (nuevas.length) this.pulls = nuevas.concat(this.pulls).slice(0, 24);
        else if (!this.pulls.length) this.pulls = data.data;
      } catch (err) {
        /* La cinta es decoracion: si falla, se queda con lo que tenia.
           Un cartel rojo en la portada porque no entro un pull seria
           peor que la cinta quieta. */
      }
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
        const [filas, feed, cfg, banners] = await Promise.all([
          api.get("/boxes/rows"),
          api.get("/boxes/feed/latest", { params: { limit: 24 } }),
          api.get("/public/settings").catch(() => null),
          api.get("/public/banners").catch(() => null),
        ]);
        this.filas = filas.data.data;
        this.pulls = feed.data.data;
        if (cfg) this.regalo = cfg.data.data.aperturasDeRegalo;

        /*
          Los banners los manda el servidor para que cambiarlos no sea
          desplegar el sitio. Si el pedido falla quedan los de adentro:
          una portada sin el carrusel se ve rota, y el respaldo son
          exactamente los mismos cuatro.
        */
        const deLaBase = banners && banners.data.data.items;
        if (deLaBase && deLaBase.length) {
          this.banners = deLaBase.map((b) => ({
            foto: b.foto, title: b.titulo, sub: b.sub, cta: b.cta, a: b.destino,
          }));
        }

        /*
          LOS TRES TICKETS SON TRES CAJAS DE VERDAD.

          No "tres cajas baratas cualesquiera": son LAS tres que se
          regalan, y cada una dice si ya se abrió. El regalo es una
          apertura en cada una, no tres fichas sueltas.
        */
        try {
          const regalos = await api.get("/boxes/gifts");
          const todas = this.filas.flatMap((f) => f.items);
          this.tickets = regalos.data.data.items.map((g) => {
            const caja = todas.find((c) => c.slug === g.slug);
            return { ...(caja || {}), slug: g.slug, name: g.nombre || (caja && caja.name), usada: g.usada };
          });
        } catch (err) {
          this.tickets = [];
        }

      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.cargando = false;
      }
    },
  },

  /**
   * LA CINTA SE MUEVE SOLA.
   *
   * Cada segundo y medio pide las ultimas y `:key` hace el resto: las
   * que ya estaban no se vuelven a dibujar y la nueva entra con su
   * animacion. Con la pestaña escondida no pide nada: un sitio abierto
   * en una pestaña olvidada no tiene por que pedir toda la noche.
   */
  created() {
    this.traer();
    this.relojPulls = window.setInterval(() => {
      if (!document.hidden) this.traerPulls();
    }, 1500);
  },

  beforeDestroy() { window.clearInterval(this.relojPulls); },
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
  background-image: url("/img/prod/34-0.webp");
}

.mb-claim__a2 {
  position: absolute;
  left: 10%;
  top: -12%;
  width: 104%;
  aspect-ratio: 1 / 1;
  transform: rotate(6deg);
  background-image: url("/img/prod/34-0.webp");
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
/* La que ya se abrio queda apagada, pero a la vista: el prototipo las
   deja las tres para que se vea cuantas quedan. */
.mb-tix.is-usada { opacity: .55; filter: grayscale(.4); }


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
  /* La proporcion del arte, para que entre entero y sin recortes. */
  aspect-ratio: 1326 / 281;
  max-height: 300px;
  border-radius: 24px;
  overflow: hidden;
  border: 1px solid #2a4a85;
  background: #150b2e;

  @include en-celular {
    aspect-ratio: auto;
    height: 188px;
  }
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
  color: #fff;
  text-decoration: none;
  @include foco;
}

.mb-banner__foto {
  display: block;
  width: 100%;
  height: 100%;
  /*
    En la pc la caja tiene la proporcion del arte, asi que `cover` no
    recorta nada; solo entra a jugar arriba de 1.416px de ancho, donde
    el alto queda clavado en 300.
  */
  object-fit: cover;
  object-position: center;

  /* En el telefono la foto entera serian 76px de alto: se recorta al
     arte de la derecha y el texto del banner lo pone el sitio. */
  @include en-celular { object-position: 78% center; }
}

.mb-banner__velo,
.mb-banner__texto { display: none; }

@include en-celular {
  .mb-banner__velo {
    display: block;
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, rgba(8, 6, 26, .94) 0%, rgba(8, 6, 26, .86) 42%, rgba(8, 6, 26, 0) 86%);
  }

  .mb-banner__texto {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 74%;
    box-sizing: border-box;
    padding: 18px 20px 34px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 9px;
  }
}

.mb-banner__titulo {
  font-family: $fuente-cartel;
  font-size: 26px;
  line-height: 1.04;
  text-shadow: 0 3px 0 #1c4fc4, 0 6px 0 #0b2266;
}

.mb-banner__sub { font-weight: 700; font-size: 12px; line-height: 1.35; color: #d7e4ff; }

.mb-banner__cta {
  align-self: flex-start;
  padding: 9px 16px;
  border-radius: 12px;
  background: $amarillo-v;
  color: $azul-tinta;
  font-weight: 900;
  font-size: 13px;
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

/* La que llega entra corriendo desde la izquierda, como el prototipo. */
.mb-pull-enter-active { transition: transform .32s ease, opacity .32s ease; }
.mb-pull-enter { transform: translateX(-26px) scale(.96); opacity: 0; }
.mb-pull-move { transition: transform .32s ease; }

/*
  LA QUE SE VA TIENE QUE TENER SU PROPIA TRANSICION.

  Sin esto, Vue le pone la clase de "moverse" --que SI tiene duracion--
  y despues se queda esperando un `transitionend` que nunca llega,
  porque nada se mueve. La tarjeta no se borra nunca: la cinta junto
  288 tarjetas invisibles en cinco minutos, cada una con su pedazo de
  lamina, y el telefono se arrastraba.

  `absolute` para que las que se van no empujen a las que quedan.
*/
.mb-pull-leave-active { position: absolute; transition: opacity .2s ease; }
.mb-pull-leave-to { opacity: 0; }

.mb-pulls__via { position: relative; flex: 1; min-width: 0; }

.mb-pulls__fila { display: flex; gap: 10px; overflow-x: auto; @include en-celular { gap: 8px; } }

// =====================================================================
//  LA CARTA DEL FEED
//
//  No es un rectangulo de un color: es el DORSO de una carta. Un
//  estallido de rayos que sale de atras del objeto, el resplandor en el
//  medio, cuatro chispas y el degrade que se apaga hacia abajo.
//
//  Todo con degrades, ningun archivo: son doce cartas que ademas se
//  renuevan solas, y doce imagenes de fondo serian doce pedidos mas en
//  la pantalla que mas se mira.
//
//  Los tres colores los pone la pantalla segun lo que salio (ver
//  colorDeLaTarjeta): claro arriba, oscuro abajo, y el del borde.
// =====================================================================

.mb-pull-card {
  position: relative;
  overflow: hidden;
  flex: none;
  width: 108px;
  height: 150px;

  @include en-celular { width: 88px; height: 124px; padding: 6px; border-radius: 10px; }
  box-sizing: border-box;
  padding: 8px;
  border: 2px solid var(--carta-borde, #4f9bff);
  border-radius: 12px;
  background: linear-gradient(180deg, var(--carta-alto, #1c63c9) 0%, var(--carta-bajo, #0e3d85) 100%);
  color: #fff;
  text-decoration: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  @include foco;
  &:hover { color: #fff; }

  // El estallido, el resplandor y las chispas.
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(circle at 23% 30%, rgba(255, 255, 255, .8) 0 1px, transparent 1.7px),
      radial-gradient(circle at 77% 24%, rgba(255, 255, 255, .62) 0 1px, transparent 1.7px),
      radial-gradient(circle at 69% 54%, rgba(255, 255, 255, .5) 0 1px, transparent 1.7px),
      radial-gradient(circle at 31% 60%, rgba(255, 255, 255, .45) 0 1px, transparent 1.7px),
      radial-gradient(circle at 50% 38%, rgba(255, 255, 255, .5) 0%, rgba(255, 255, 255, 0) 26%),
      repeating-conic-gradient(
        from 0deg at 50% 38%,
        rgba(255, 255, 255, .11) 0deg 3deg,
        rgba(255, 255, 255, 0) 3deg 9deg
      );
    // Los rayos se apagan antes de llegar al borde.
    -webkit-mask-image: radial-gradient(circle at 50% 38%, #000 0%, #000 46%, transparent 88%);
    mask-image: radial-gradient(circle at 50% 38%, #000 0%, #000 46%, transparent 88%);
  }

  // La sombrita donde apoya el objeto.
  &::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 58%;
    width: 68%;
    height: 9px;
    transform: translateX(-50%);
    pointer-events: none;
    background: radial-gradient(closest-side, rgba(0, 0, 0, .45), rgba(0, 0, 0, 0));
  }

  // Todo lo que se lee va por encima del dorso.
  > * { position: relative; z-index: 1; }
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

.mb-pull-card__foto {
  width: 64px;
  height: 64px;
  object-fit: contain;
  @include en-celular { width: 52px; height: 52px; }
}

.mb-pull-card__sinfoto {
  color: rgba(255, 255, 255, .35);
  svg { width: 100%; height: 100%; }
}

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


.mb-fila__tira {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  scroll-behavior: smooth;
  padding: 4px 0 6px;
}

.mb-fila__caja { flex: none; width: 190px; @include en-celular { width: 150px; } }

/* ── Top 10 ───────────────────────────────────────────────────────── */

.mb-top { margin-top: 36px; }
.mb-top__tira { display: flex; gap: 10px; overflow-x: auto; scroll-behavior: smooth; padding-bottom: 6px; }

.mb-top__caja {
  position: relative;
  flex: none;
  width: clamp(160px, 22vw, 220px);
  height: clamp(210px, 28vw, 270px);
  text-decoration: none;
  color: #fff;
  @include foco;
  &:hover { color: #fff; }
}

// La tarjeta ocupa el 78% de la derecha: el 22% que queda a la
// izquierda es para que el numerazo asome por detras.
.mb-top__tarjeta {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 78%;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #23397a;
  display: block;
}

.mb-top__nombre {
  position: absolute;
  left: 0;
  right: 0;
  top: 12px;
  z-index: 2;
  text-align: center;
  padding: 0 8px;
  font-family: $fuente-cartel;
  font-size: clamp(18px, 2.4vw, 24px);
  line-height: 1;
  text-shadow: 0 3px 0 $azul-tinta, 0 5px 10px rgba(0, 0, 0, .5);
}

.mb-top__arte {
  position: absolute;
  left: 50%;
  top: 54%;
  width: 96%;
  aspect-ratio: 1 / 1;
  transform: translate(-50%, -50%);
}

.mb-top__precio {
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

// El numero gigante, con su relieve de cuatro capas.
.mb-top__numero {
  position: absolute;
  left: 0;
  bottom: -6px;
  font-family: $fuente-cartel;
  font-size: clamp(84px, 11vw, 120px);
  line-height: 1;
  color: #eef4ff;
  text-shadow:
    0 4px 0 #9cbcf5,
    0 8px 0 $azul-medio,
    0 12px 0 $azul-tinta,
    0 14px 18px rgba(0, 0, 0, .5);
}

/* ── Las marcas ───────────────────────────────────────────────────── */

.mb-marcas { margin-top: 36px; }
.mb-marcas__tira { display: flex; gap: 22px; overflow-x: auto; scroll-behavior: smooth; }

.mb-marca {
  flex: none;
  width: 180px;
  height: 96px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: linear-gradient(135deg, #17505f 0%, #173468 100%);
  color: #fff;
  font-weight: 800;
  text-decoration: none;
  display: flex;
  align-items: center;
  justify-content: center;
  @include foco;
  &:hover { color: #fff; }
  @include en-celular { width: 150px; height: 84px; }
}

/* ── Como funciona ────────────────────────────────────────────────── */

.mb-como { margin-top: 44px; }
.mb-como h2 { margin: 0 0 18px; font-weight: 800; font-size: 28px; }

.mb-como__grilla {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 30px;
  @include en-celular { gap: 18px; }
}

.mb-paso-c { border-radius: 18px; overflow: hidden; background: $panel-alto; }

.mb-paso-c__arte {
  position: relative;
  height: 200px;
  border-radius: 18px;
  overflow: hidden;
}

.mb-paso-c__rayos {
  position: absolute;
  inset: 0;
  background: repeating-conic-gradient(from 0deg at 50% 60%, rgba(255, 255, 255, .12) 0deg 6deg, rgba(255, 255, 255, 0) 6deg 20deg);
}

.mb-paso-c__a1, .mb-paso-c__a2, .mb-paso-c__a3 { position: absolute; }
.mb-paso-c__a1 { left: 4%; top: 46px; width: 132px; height: 132px; transform: rotate(-8deg); }
.mb-paso-c__a2 { left: 50%; top: 18px; width: 164px; height: 164px; margin-left: -82px; }
.mb-paso-c__a3 { right: 4%; top: 46px; width: 132px; height: 132px; transform: rotate(8deg); }

.mb-paso-c__texto {
  padding: 26px 28px 30px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 10px;

  h3 { margin: 0; font-weight: 800; font-size: 25px; }
  p { margin: 0; font-size: 16px; line-height: 1.5; color: $texto-3; }
}

/* ── Las preguntas ────────────────────────────────────────────────── */

.mb-faq { margin-top: 44px; }
.mb-faq h2 { margin: 0 0 16px; font-weight: 900; font-size: clamp(20px, 3vw, 28px); }

.mb-faq__grilla {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr));
  gap: 12px 16px;
  align-items: start;
}

.mb-faq__item {
  border-radius: 10px;
  background: $panel-alto;
  overflow: hidden;
  transition: background .2s ease;

  &.is-abierta { background: #1a3358; }

  button {
    width: 100%;
    min-height: 60px;
    padding: 0 20px;
    border: 0;
    background: transparent;
    color: #fff;
    font-family: inherit;
    font-weight: 800;
    font-size: 16px;
    text-align: left;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    @include foco;

    svg { flex: none; transition: transform .2s ease; }
  }

  p { margin: 0; padding: 0 20px 18px; font-size: 14px; line-height: 1.6; color: $texto-3; }
}
</style>
