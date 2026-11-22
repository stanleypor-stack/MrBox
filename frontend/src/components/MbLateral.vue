<template>
  <aside
    class="mb-side" :class="{ 'is-angosta': !abierta && !cajon, 'is-cajon': cajon }"
    :aria-label="$t('header.sideMenu')"
  >
    <!--
      PLEGAR LA BARRA.

      Una flechita contra una pared, como en mrloot: dice hacia donde
      se va a ir la barra. Antes era un dibujo de dos paneles que no
      decia nada y ademas ocupaba como un boton grande.

      De cajon --en el telefono-- el mismo boton la cierra.
    -->
    <button
      type="button" class="mb-side__plegar"
      :aria-label="cajon ? $t('header.closeMenu') : (abierta ? $t('header.collapse') : $t('header.expand'))"
      @click="plegar"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path :d="abierta || cajon ? 'M4 5v14M20 12H9M13 8l-4 4 4 4' : 'M20 5v14M4 12h11M11 8l4 4-4 4'" />
      </svg>
    </button>

    <div v-if="abierta || cajon" class="mb-side__cuerpo">
      <!-- ── Las carreras ─────────────────────────────────────────── -->
      <router-link to="/races/weekly" class="mb-race-card mb-race-card--grande">
        <span class="mb-race mb-race-card__arte mb-race-card__arte--grande" aria-hidden="true"
              style="background-position: 0% 0%"></span>
        <span class="mb-race-card__cifra">$10K</span>
        <span class="mb-race-card__plazo">{{ $t('races.weekly') }}</span>
      </router-link>

      <div class="mb-side__dos">
        <router-link to="/races/daily" class="mb-race-card">
          <span class="mb-race mb-race-card__arte" aria-hidden="true" style="background-position: 50% 0%"></span>
          <span class="mb-race-card__cifra mb-race-card__cifra--chica">$2K</span>
          <span class="mb-race-card__plazo">{{ $t('races.daily') }}</span>
        </router-link>
        <router-link to="/races/monthly" class="mb-race-card">
          <span class="mb-race mb-race-card__arte" aria-hidden="true" style="background-position: 100% 0%"></span>
          <span class="mb-race-card__cifra mb-race-card__cifra--chica">$30K</span>
          <span class="mb-race-card__plazo">{{ $t('races.monthly') }}</span>
        </router-link>
      </div>

      <!-- ── Cajas ────────────────────────────────────────────────── -->
      <div class="mb-grupo">
        <div class="mb-grupo__titulo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff"
               stroke-width="2" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 2.5 21 7v10l-9 4.5L3 17V7z" /><path d="M3 7l9 4.5L21 7M12 11.5v10" />
          </svg>
          {{ $t('nav.boxes') }}
        </div>
        <div class="mb-grupo__lista">
          <router-link to="/boxes" class="mb-grupo__item" active-class="is-activo" exact>
            {{ $t('side.allBoxes') }}
          </router-link>
          <router-link to="/community" class="mb-grupo__item" active-class="is-activo">
            {{ $t('nav.community') }}
          </router-link>
          <router-link to="/deals" class="mb-grupo__item" active-class="is-activo">
            {{ $t('nav.deals') }}
            <span class="mb-cinta-nueva">NEW</span>
          </router-link>
          <router-link to="/create" class="mb-grupo__item" active-class="is-activo">
            {{ $t('nav.createBox') }}
          </router-link>
          <router-link to="/dashboard" class="mb-grupo__item" active-class="is-activo">
            {{ $t('side.dashboard') }}
          </router-link>

          <!-- Para el equipo. El guardia de verdad esta en el servidor:
               cada ruta de /api/admin pide rango. Esto es el atajo. -->
          <router-link v-if="esAdmin" to="/admin" class="mb-grupo__item mb-grupo__item--admin">
            {{ $t('side.adminPanel') }}
          </router-link>
        </div>
      </div>

      <!-- ── Categorías ───────────────────────────────────────────── -->
      <!--
        ── Los juegos ────────────────────────────────────────────

        Plegable y con los ocho adentro, como lo dibuja el diseño: la
        barra es el único lugar desde donde se salta de un juego a
        otro sin volver atrás.
      -->
      <div class="mb-grupo">
        <button
          type="button" class="mb-grupo__plegable"
          :aria-expanded="juegosAbiertos ? 'true' : 'false'"
          @click="juegosAbiertos = !juegosAbiertos"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M6 11h4M8 9v4M15.5 10.5h.01M18 13h.01" />
            <rect x="2" y="6" width="20" height="12" rx="4" />
          </svg>
          {{ $t('nav.games') }}
          <span class="mb-grupo__chevron">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff"
                 stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path :d="juegosAbiertos ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'" />
            </svg>
          </span>
        </button>

        <div v-if="juegosAbiertos" class="mb-grupo__lista">
          <router-link
            v-for="g in juegos" :key="g.id"
            :to="`/games/${g.id}`"
            class="mb-grupo__item mb-grupo__item--cat"
            active-class="is-activo"
          >
            <img :src="g.icono" alt="" width="18" height="18">
            {{ g.nombre }}
          </router-link>
        </div>
      </div>

      <div class="mb-grupo">
        <button
          type="button" class="mb-grupo__plegable"
          :aria-expanded="categoriasAbiertas ? 'true' : 'false'"
          @click="categoriasAbiertas = !categoriasAbiertas"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff"
               stroke-width="2" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="3.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
          {{ $t('side.categories') }}
          <span class="mb-grupo__chevron">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff"
                 stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path :d="categoriasAbiertas ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'" />
            </svg>
          </span>
        </button>

        <div v-if="categoriasAbiertas" class="mb-grupo__lista">
          <router-link
            v-for="c in categorias" :key="c.name"
            :to="`/boxes?category=${encodeURIComponent(c.name)}`"
            class="mb-grupo__item mb-grupo__item--cat"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path :d="icono(c.name)" />
            </svg>
            {{ c.name }}
            <span class="mb-grupo__cuenta">{{ c.count }}</span>
          </router-link>
        </div>
      </div>

      <!-- ── Los accesos ──────────────────────────────────────────── -->
      <router-link
        v-for="l in enlaces" :key="l.a" :to="l.a"
        class="mb-acceso" active-class="is-activo"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path :d="l.icono" />
        </svg>
        {{ $t(l.texto) }}
        <!-- La chapita del prototipo: cuantos desafios hay al aire. -->
        <span v-if="l.contar && cuentas[l.contar]" class="mb-acceso__badge">{{ cuentas[l.contar] }}</span>
      </router-link>

      <div class="mb-side__pie">
        <MbSelectorDeIdioma />
      </div>
    </div>
  </aside>
</template>

<script>
import { mapGetters } from "vuex";
import api from "@/api";
import MbSelectorDeIdioma from "@/components/MbSelectorDeIdioma.vue";
import { JUEGOS } from "@/juegos";

/* Los iconos de categoria del diseno. */
const ICONOS = {
  Mix: "M12 2.5 21 7v10l-9 4.5L3 17V7z",
  Fashion: "M8 3l4 3 4-3 5 4-3 4v10H6V11L3 7z",
  Tech: "M4 5h16v11H4zM9 20h6M12 16v4",
  Gaming: "M7 12h4M9 10v4M6 7h12a4 4 0 0 1 0 14c-2 0-3-1-6-1s-4 1-6 1a4 4 0 0 1 0-14z",
  Watches: "M12 8v4l3 2M8 3h8l-1 4M8 21h8l-1-4M12 6a6 6 0 1 1 0 12 6 6 0 0 1 0-12z",
  Games: "M4 6h16v12H4zM9 10h6M12 10v4",
  Collectables: "M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.2l5.9-.9z",
  Gadgets: "M7 3h10v18H7zM10 6h4",
  Audio: "M11 5 6 9H3v6h3l5 4zM16 9a4 4 0 0 1 0 6",
  Cookware: "M5 10h14v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3zM19 11h2v3h-2M8 7V4M12 7V4M16 7V4",
  Memorabilia: "M7 4h10v7a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 16v4M9 21h6",
  Motorcycles: "M5 17a3 3 0 1 0 0-.01M19 17a3 3 0 1 0 0-.01M5 17h7l4-7h3M9 10h5",
  "Trading Cards": "M4 4h9v16H4zM15 7l5 2-4 11-5-2",
};

/**
 * LA BARRA LATERAL DEL DISENO.
 *
 * Las tres carreras con su trofeo, el grupo de cajas, las categorias con
 * sus contadores y los accesos.
 *
 * LAS CATEGORIAS SALEN DE LA BASE
 *
 * Con sus contadores de verdad, no escritas a mano. El prototipo las
 * tenia fijas porque era un prototipo; acá, si se agrega una caja de una
 * categoria nueva, aparece sola.
 */
export default {
  name: "MbLateral",

  computed: { ...mapGetters(["esAdmin"]) },
  components: { MbSelectorDeIdioma },

  props: {
    /*
      En celular esta misma barra se dibuja como un cajon que tapa la
      pantalla. Es el MISMO componente y no una copia: dos listas de
      secciones es una lista que se olvidan de actualizar.
    */
    cajon: { type: Boolean, default: false },
  },

  data() {
    return {
      /*
        ARRANCA PLEGADA EN PANTALLAS CHICAS.

        El diseño está dibujado a 1440px de ancho. En una ventana de
        1200 la barra se lleva 300px de los que faltan y entran dos
        cajas menos por fila: el catálogo se ve "de cerca" sin que nada
        haya cambiado de tamaño.

        Plegada son 72px y vuelven a entrar. Es el mismo botón que ya
        tiene el diseño; lo único que se decide acá es cómo empieza. En
        cuanto el jugador lo toca, manda él y esto no vuelve a opinar.
      */
      abierta: typeof window === "undefined" || window.innerWidth >= 1280,
      categoriasAbiertas: true,
      juegosAbiertos: true,
      /* El listado es uno solo, compartido con la pantalla de juegos. */
      juegos: JUEGOS,
      categorias: [],
      cuentas: {},
      enlaces: [
        { a: "/inventory", texto: "nav.inventory", icono: "M3 7h18v13H3zM3 7l2-4h14l2 4M9 11h6" },
        { a: "/promotions", texto: "nav.promotions", icono: "M20 12v9H4v-9M2 7h20v5H2zM12 21V7" },
        { a: "/challenges", texto: "nav.challenges", icono: "M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7z", contar: "desafios" },
        { a: "/rewards", texto: "nav.rewards", icono: "M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.2l5.9-.9z" },
        { a: "/vip", texto: "nav.vip", icono: "M3 8l4 4 5-7 5 7 4-4-2 11H5z" },
        { a: "/affiliates", texto: "nav.affiliates", icono: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M19 8v6M16 11h6" },
      ],
    };
  },

  methods: {
    /** Plegada en la pc; en el telefono, el mismo boton cierra el cajon. */
    plegar() {
      if (this.cajon) { this.$store.commit("abrir", null); return; }
      this.abierta = !this.abierta;
    },

    icono(nombre) { return ICONOS[nombre] || ICONOS.Mix; },

    async traerCategorias() {
      try {
        const { data } = await api.get("/boxes/categories");
        this.categorias = data.data;
      } catch {
        /* Sin categorías la barra anda igual, con un grupo menos. */
      }
    },
    /** Los numeritos de los accesos. Hoy, los desafios al aire. */
    async traerCuentas() {
      try {
        const { data } = await api.get("/public/counts");
        this.cuentas = data.data;
      } catch {
        /* Sin numeritos la barra anda igual. */
      }
    },
  },

  created() {
    this.traerCategorias();
    this.traerCuentas();
  },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-side {
  /*
    207, QUE ES LA DE MRLOOT.

    Era `flex: 1 1 250px` y el reparto le daba 211 en una pantalla de
    1365 --y otra cosa en cada ancho--. Clavada, el contenido de al
    lado empieza siempre en el mismo lugar, que es de donde sale el
    ancho del banner.
  */
  flex: 0 0 calc(207px / var(--escala, 1));
  max-width: 300px;
  box-sizing: border-box;
  padding: 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #0e1a2e;
  border-right: 1px solid #1a2a45;

  /*
    SE QUEDA A LA VISTA, NO CRECE CON LA PAGINA.

    Antes era `align-self: stretch`, asi que tomaba el alto de la fila
    --o sea, el de la pagina entera-- y en el catalogo quedaba una
    columna azul vacia de varias pantallas de largo.

    Pegada arriba se queda donde se la ve mientras el catalogo baja, que
    ademas es como funciona en el prototipo. Si no entra, se desliza
    ella sola.
  */
  position: sticky;
  /*
    Justo abajo de la cabecera, que ahora tambien se queda pegada.

    El alto se mide en pixeles de pantalla, pero aca adentro estamos en
    un `zoom`, donde un pixel mide menos: sin dividir por la escala, la
    barra arrancaba unos pixeles mas arriba y la cabecera le tapaba el
    primer renglon.
  */
  top: calc(var(--alto-cabecera, 0px) / var(--escala, 1));
  align-self: flex-start;

  /*
    ALTO FIJO DE UNA PANTALLA, NO "LO QUE MIDA EL CONTENIDO".

    Con `max-height`, la columna mide lo que mide su contenido: al bajar
    por una pagina larga, abajo de la barra aparecia una franja negra
    --el fondo de la pagina-- donde deberia seguir el panel. Con `height`
    el fondo llega siempre hasta abajo.
  */
  height: calc((100vh - var(--alto-cabecera, 0px)) / var(--escala, 1));
  overflow-y: auto;

  /* Se desliza, pero sin la barrita gris: afea la columna y en el
     prototipo no esta. Se sigue pudiendo con la rueda y con el dedo. */
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }

  &.is-angosta { flex: 0 0 auto; max-width: 72px; }

  /*
    EN CELULAR NO SE DIBUJA, SALVO DE CAJON.

    La navegacion de celular es la barra de abajo; esta barra aparece
    solo cuando se toca MENU. La regla va aca y no en App.vue porque
    los estilos de este archivo tienen mas peso que los de afuera, y
    desde afuera `display: none` perdia contra el `display: flex` de
    arriba.
  */
  @include en-celular {
    &:not(.is-cajon) { display: none; }
    max-width: none;
    flex: 1 1 100%;
    border-right: 0;
    border-bottom: 1px solid #1a2a45;
  }

  /* De cajon ocupa todo el hueco entre la cabecera y la barra de abajo
     y se desliza solo, sin mover la pagina de atras. */
  &.is-cajon {
    /*
      Adentro del cajon mide lo que mida su contenido, y el que se
      desliza es el cajon (ver App.vue). Asi se llega al final del
      menu en el telefono, que antes se cortaba.
    */
    position: relative;
    /*
      Y SIN EL DESPLAZAMIENTO DE LA PEGADA.

      Arriba la barra es `sticky` con `top: 75px` para quedar debajo
      de la cabecera. De cajon pasa a `relative`, donde ese mismo
      `top` ya no la pega a nada: la EMPUJA 75px para abajo. Eso era
      la franja que quedaba arriba del menu, y los 75px que faltaban
      abajo, que se comian el selector de idioma.
    */
    top: 0;
    height: auto;
    min-height: 100%;
    max-height: none;
    max-width: none;
    overflow: visible;
    /* `stretch` las deja todas del alto del contenido y entonces el
       fondo no llega abajo. `flex-start` las deja de su alto y el
       fondo del cajon se ve entero. */
    align-items: stretch;
    border: 0;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
    > * { flex: none; }
  }
}

.mb-side__plegar {
  align-self: flex-start;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  border: 1px solid #22385c;
  background: #14243f;
  color: #c9d7f7;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  @include foco;
  &:hover { background: #22406f; color: #fff; }
}


.mb-side__cuerpo { display: flex; flex-direction: column; gap: 10px; flex: 1; }
.mb-side__dos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; flex: none; }

/* ── Las carreras ─────────────────────────────────────────────────── */

.mb-race-card {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 74px;
  border-radius: 14px;
  border: 1px solid rgba(107, 180, 255, .32);
  // El resplandor detrás del trofeo, del diseño.
  background:
    radial-gradient(60% 90% at 78% 55%, rgba(63, 124, 240, .55) 0, rgba(63, 124, 240, .18) 45%, rgba(63, 124, 240, 0) 75%),
    linear-gradient(#173468, #12264f);
  color: #fff;
  text-decoration: none;
  padding: 12px 14px;
  box-sizing: border-box;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: center;
  @include foco;

  &--grande { height: 88px; }
  &:hover { color: #fff; border-color: rgba(107, 180, 255, .6); }
}

.mb-race-card__arte {
  position: absolute;
  right: 2px;
  top: 50%;
  width: 54px;
  height: 54px;
  transform: translateY(-50%);

  &--grande { width: 84px; height: 84px; }
}

.mb-race-card__cifra {
  position: relative;
  font-weight: 900;
  font-size: 30px;
  line-height: 1;
  &--chica { font-size: 22px; }
}

.mb-race-card__plazo {
  position: relative;
  font-weight: 900;
  font-size: 11px;
  letter-spacing: .08em;
  text-transform: uppercase;
}

/* ── Los grupos ───────────────────────────────────────────────────── */

.mb-grupo { border-radius: 14px; background: #1a2d4d; overflow: hidden; }

.mb-grupo__titulo {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 48px;
  padding: 0 14px;
  font-weight: 800;
  font-size: 15px;
}

.mb-grupo__plegable {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 50px;
  padding: 0 10px 0 14px;
  border: 0;
  background: transparent;
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  font-size: 15px;
  cursor: pointer;
  @include foco;
}

.mb-grupo__chevron {
  margin-left: auto;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: #2b4c80;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mb-grupo__lista {
  display: flex;
  flex-direction: column;
  padding-bottom: 6px;
  background: #132440;
}

.mb-grupo__item {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 42px;
  padding: 0 16px;
  border: 0;
  background: transparent;
  color: #fff;
  font-family: inherit;
  font-weight: 700;
  font-size: 14px;
  text-decoration: none;
  cursor: pointer;
  @include foco;

  &:hover { background: #1b3764; color: #fff; }
  &.is-activo { background: #24467c; }
  &--cat { height: 40px; }
}
.mb-grupo__item--admin { color: $amarillo-v; font-weight: 900; }


.mb-grupo__cuenta { margin-left: auto; color: #7f93b8; font-size: 12px; font-weight: 800; }

.mb-cinta-nueva {
  padding: 2px 8px;
  border-radius: 7px;
  background: $amarillo-v;
  color: $azul-tinta;
  font-size: 11px;
  font-weight: 900;
}

/* ── Los accesos ──────────────────────────────────────────────────── */

.mb-acceso {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 46px;
  padding: 0 14px;
  border-radius: 14px;
  background: #1a2d4d;
  color: #fff;
  text-decoration: none;
  font-weight: 800;
  font-size: 15px;
  @include foco;

  &:hover { background: #22406f; color: #fff; }
  &.is-activo { background: #24467c; }
}

.mb-acceso__badge {
  margin-left: auto;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  box-sizing: border-box;
  border-radius: 11px;
  background: #ff5b6b;
  font-size: 12px;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mb-side__pie { margin-top: auto; padding-top: 8px; }
</style>
