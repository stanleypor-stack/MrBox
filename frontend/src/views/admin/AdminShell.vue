<template>
  <div class="ad">
    <p v-if="cargando" class="ad__cargando">{{ $t('admin.loading') }}</p>

    <p v-else-if="!esAdmin" class="ad__no">{{ $t('admin.notAllowed') }}</p>

    <template v-else>
      <!-- ── El menú ──────────────────────────────────────────────── -->
      <nav class="ad__nav" :class="{ 'is-abierto': menuAbierto }" aria-label="Admin">
        <div class="ad__marca">
          <svg width="132" height="34" viewBox="0 0 1000 260" role="img" aria-label="MR BOX">
            <defs>
              <linearGradient id="adFace" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#ffffff" /><stop offset="1" stop-color="#b9cff5" />
              </linearGradient>
              <text
                id="adWord" x="490" y="185" text-anchor="middle" font-family="Titan One, sans-serif"
                font-size="170" letter-spacing="2" transform="skewX(-8) translate(26 0)"
              >MR BOX</text>
            </defs>
            <use href="#adWord" transform="translate(16 16)" fill="#0b2266" stroke="#0b2266" stroke-width="10" stroke-linejoin="round" />
            <use href="#adWord" transform="translate(10 10)" fill="#2c66dc" stroke="#2c66dc" stroke-width="14" stroke-linejoin="round" />
            <use href="#adWord" transform="translate(5 5)" fill="#2c66dc" stroke="#2c66dc" stroke-width="14" stroke-linejoin="round" />
            <use href="#adWord" fill="none" stroke="#0b2266" stroke-width="7" stroke-linejoin="round" />
            <use href="#adWord" fill="url(#adFace)" />
          </svg>
          <span class="ad__chapa">ADMIN</span>
        </div>

        <div class="ad__grupos">
          <div v-for="g in GRUPOS" :key="g.titulo" class="ad__grupo">
            <span class="ad__grupo-t">{{ $t(g.titulo) }}</span>
            <router-link
              v-for="it in g.items" :key="it.id" :to="`/admin/${it.id}`"
              class="ad__item" active-class="is-activo" @click.native="menuAbierto = false"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path :d="ICONOS[it.id]" />
              </svg>
              <span>{{ $t('admin.nav.' + it.id) }}</span>
              <span v-if="pendientes[it.id]" class="ad__cuenta">{{ pendientes[it.id] }}</span>
            </router-link>
          </div>
        </div>

        <div class="ad__salida">
          <router-link to="/">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />
            </svg>
            {{ $t('admin.backToSite') }}
          </router-link>
        </div>
      </nav>

      <!-- ── El contenido ─────────────────────────────────────────── -->
      <main class="ad__main">
        <header class="ad__head">
          <button type="button" class="ad__menu" :aria-label="$t('admin.menu')" @click="menuAbierto = !menuAbierto">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2"
                 stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>

          <label class="ad__buscar">
            <span class="ad-oculto">{{ $t('admin.searchPanel') }}</span>
            <input
              v-model="busqueda" type="search" class="ad-in"
              :placeholder="$t('admin.searchPlaceholder')" @keyup.enter="buscar"
            >
          </label>

          <span class="ad__hueco"></span>

          <span class="ad__vivos">
            <span class="ad__punto" aria-hidden="true"></span>
            {{ $t('admin.online', { n: conectados }) }}
          </span>

          <span class="ad__yo">
            <span class="ad__avatar">{{ inicial }}</span>
            {{ usuario.username }}
            <span class="ad__rango">{{ usuario.rank }}</span>
          </span>
        </header>

        <div class="ad__cuerpo">
          <router-view @pendientes="pendientes = $event" />
        </div>
      </main>
    </template>
  </div>
</template>

<script>
import { mapState, mapGetters } from "vuex";

/*
  LAS CINCO FAMILIAS DEL PANEL, COMO EN EL DISEÑO.

  Operación es lo del día a día: lo que alguien del equipo mira a la
  mañana. Catálogo es lo que se vende, Plata lo que entra y sale,
  Marketing lo que trae gente, y Sistema lo que casi nunca se toca.

  El orden importa: lo que se usa todos los días va arriba.
*/
const GRUPOS = [
  {
    titulo: "admin.group.operation",
    items: [
      { id: "dashboard" }, { id: "movements" }, { id: "players" },
      { id: "orders" }, { id: "support" }, { id: "verification" },
      { id: "redemptions" }, { id: "risk" },
    ],
  },
  {
    titulo: "admin.group.catalogue",
    items: [
      { id: "boxes" }, { id: "community" }, { id: "items" },
      { id: "deals" }, { id: "home" },
    ],
  },
  {
    titulo: "admin.group.money",
    items: [{ id: "payments" }, { id: "affiliates" }, { id: "analytics" }, { id: "coins" }],
  },
  {
    titulo: "admin.group.marketing",
    items: [
      { id: "races" }, { id: "challenges" }, { id: "ranks" }, { id: "segments" },
      { id: "promotions" }, { id: "promo" }, { id: "banners" }, { id: "seo" },
    ],
  },
  {
    titulo: "admin.group.system",
    items: [
      { id: "settings" }, { id: "legal" }, { id: "activity" },
      { id: "logs" }, { id: "team" },
    ],
  },
];

const ICONOS = {
  dashboard: "M3 3h8v10H3zM13 3h8v6h-8zM13 11h8v10h-8zM3 15h8v6H3z",
  movements: "M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4",
  players: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5M16 14.5a5 5 0 0 1 5 5.5",
  orders: "M1 5h14v11H1zM15 9h4l4 4v3h-8zM5.5 19a1.5 1.5 0 1 0 0-.01M18.5 19a1.5 1.5 0 1 0 0-.01",
  support: "M4 5h16v11H9l-5 4z",
  verification: "M3 5h18v14H3zM7 10h4M7 14h6M15 9h3v4h-3z",
  redemptions: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5",
  risk: "M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7zM12 9v4M12 16h.01",
  boxes: "M12 2.5 21 7v10l-9 4.5L3 17V7zM3 7l9 4.5L21 7M12 11.5v10",
  community: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M19 8v6M16 11h6",
  items: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  deals: "M12 3a9 9 0 1 0 9 9h-9z",
  home: "M3 11 12 4l9 7v9h-6v-6H9v6H3z",
  payments: "M2 6h20v12H2zM2 10h20M6 15h4",
  affiliates: "M6 12a3 3 0 1 0 0-.01M18 6a3 3 0 1 0 0-.01M18 18a3 3 0 1 0 0-.01M8.6 10.6l6.8-3.4M8.6 13.4l6.8 3.4",
  analytics: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  coins: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1.1 1.6 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-2-.5-2.5-1.5",
  races: "M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 21h8",
  challenges: "M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7z",
  ranks: "M3 8l4 4 5-7 5 7 4-4-2 11H5z",
  segments: "M3 5h18l-7 8v6l-4 2v-8z",
  promotions: "M20 12v9H4v-9M2 7h20v5H2zM12 21V7",
  promo: "M3 12V4h8l10 10-8 8zM7.5 8.5h.01",
  banners: "M3 5h18v12H3zM3 14l5-4 4 3 3-2 6 4",
  seo: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z",
  settings: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
  legal: "M6 2h9l4 4v16H6zM14 2v5h5M9 12h7M9 16h7",
  activity: "M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h4",
  logs: "M4 5h16v14H4zM7 9l3 3-3 3M12 15h5",
  team: "M15 7a4 4 0 1 0-4 4M11 11l9 9M17 17l-2 2M20 20l-2 2",
};

/**
 * EL ARMAZON DEL PANEL.
 *
 * Menú a la izquierda, cabecera arriba y la pantalla en el medio. No
 * reusa el armazón del sitio a propósito: son dos productos distintos
 * con dos públicos distintos, y mezclarlos termina en una barra
 * lateral que tiene "Deals" y "Riesgo" una debajo de la otra.
 *
 * EL GUARDIA ESTA ACA Y EN EL SERVIDOR
 *
 * Esto esconde el panel al que no es admin, que es lo correcto para la
 * pantalla. Lo que de verdad lo protege es que CADA ruta de
 * `/api/admin` pide rango: esconder un botón no protege nada.
 */
export default {
  name: "AdminShell",

  data() { return { GRUPOS, ICONOS, menuAbierto: false, pendientes: {}, busqueda: "", conectados: 0 }; },

  computed: {
    ...mapState(["usuario", "cargandoUsuario"]),
    ...mapGetters(["esAdmin"]),

    cargando() { return this.cargandoUsuario; },
    seccion() { return this.$route.path.split("/")[2] || "dashboard"; },
    inicial() {
      return String((this.usuario && this.usuario.username) || "?").charAt(0).toUpperCase();
    },
  },

  watch: {
    $route() { this.menuAbierto = false; },
  },

  methods: {
    /**
     * El buscador de arriba manda a Jugadores con el texto puesto.
     *
     * Es lo que se busca el 90% de las veces. Una busqueda que mire
     * todo a la vez suena mejor y en la practica devuelve una mezcla
     * de cajas, pedidos y gente que no sirve para nada.
     */
    buscar() {
      const texto = this.busqueda.trim();
      if (!texto) return;
      this.$router.push({ path: "/admin/players", query: { q: texto } });
    },
  },
};
</script>

<style lang="scss">
@import "@/styles/tokens";

/*
  LAS PIEZAS QUE COMPARTEN TODAS LAS PANTALLAS DEL PANEL.

  Sin `scoped` a propósito: son las tarjetas, las tablas y los botones
  que usan las quince pantallas de adentro. Repetirlas en cada una
  serían quince copias que se van separando sola.

  Todo lleva el prefijo `ad-`, que no existe en el resto del sitio.
*/

.ad { display: flex; align-items: stretch; min-height: 100vh; background: $fondo; color: #fff; }
.ad__cargando, .ad__no { margin: 80px auto; color: $texto-4; }

/* ── El menú ──────────────────────────────────────────────────────── */

.ad__nav {
  flex: 1 1 248px;
  max-width: 264px;
  box-sizing: border-box;
  background: $panel;
  border-right: 1px solid $borde;
  display: flex;
  flex-direction: column;

  /*
    EL MENU MIDE UNA PANTALLA, NO LA PAGINA.

    Sin esto crece con lo que haya a la derecha --una tabla de
    doscientas filas-- y el menu se hace infinito: hay que scrollear
    la pagina entera para volver arriba. Pegado y de alto fijo, lo
    que se mueve adentro es la lista de secciones y nada mas.
  */
  position: sticky;
  top: 0;
  align-self: flex-start;
  height: 100vh;

  @media (max-width: 900px) {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 40;
    width: 264px;
    transform: translateX(-100%);
    transition: transform .2s ease;
    &.is-abierto { transform: none; }
  }
}

.ad__marca {
  height: 68px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-bottom: 1px solid $borde;
}

.ad__chapa {
  padding: 4px 8px;
  border-radius: 6px;
  background: $azul-hondo;
  font-weight: 900;
  font-size: 11px;
  letter-spacing: .08em;
}

.ad__grupos {
  flex: 1;
  min-height: 0;
  padding: 12px 10px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;

  /* Como en el diseño: se desliza, no se ve la barra. */
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}

.ad__grupo { display: flex; flex-direction: column; gap: 2px; }

.ad__grupo-t {
  padding: 4px 10px;
  font-weight: 800;
  font-size: 11px;
  letter-spacing: .1em;
  color: $texto-4;
}

.ad__item {
  height: 38px;
  padding: 0 10px;
  border-radius: 9px;
  color: $texto-2;
  font-weight: 700;
  font-size: 14px;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 10px;
  @include foco;

  > span:first-of-type { flex: 1; }
  &:hover { background: $lateral-hover; color: #fff; }
  &.is-activo { background: $azul-activo; color: #fff; }
}

.ad__cuenta {
  min-width: 20px;
  padding: 2px 6px;
  border-radius: 10px;
  background: $amarillo-v;
  color: $azul-tinta;
  font-weight: 900;
  font-size: 11px;
  text-align: center;
}

.ad__salida {
  padding: 10px;
  border-top: 1px solid $borde;

  a {
    height: 38px;
    padding: 0 10px;
    border-radius: 9px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 700;
    color: $texto-3;
    text-decoration: none;
    @include foco;
    &:hover { background: $lateral-hover; color: #fff; }
  }
}

/* ── La cabecera ──────────────────────────────────────────────────── */

.ad__main { flex: 999 1 560px; min-width: 0; display: flex; flex-direction: column; }

.ad__head {
  min-height: 68px;
  box-sizing: border-box;
  padding: 12px 28px;
  border-bottom: 1px solid $borde;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  @media (max-width: 900px) { padding: 12px 16px; }
}

.ad__menu {
  display: none;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  border: 1px solid $borde-fuerte;
  background: $panel-alto;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  @include foco;
  @media (max-width: 900px) { display: flex; }
}

.ad__hueco { flex: 1; }

.ad__buscar {
  flex: 1 1 260px;
  max-width: 420px;
  display: flex;
  input { width: 100%; box-sizing: border-box; }
}

.ad__vivos {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  color: $texto-3;
  @media (max-width: 900px) { display: none; }
}

.ad__punto { width: 8px; height: 8px; border-radius: 50%; background: $verde; }
.ad-oculto { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }

.ad__yo {
  height: 44px;
  padding: 0 12px 0 6px;
  border-radius: 10px;
  background: $panel-alto;
  border: 1px solid $borde-fuerte;
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 800;
}

.ad__avatar {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: $azul;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ad__rango { font-size: 11px; color: $texto-4; text-transform: uppercase; letter-spacing: .06em; }

.ad__cuerpo { padding: 28px; display: flex; flex-direction: column; gap: 20px; @media (max-width: 900px) { padding: 16px; } }

/* ══ Lo que comparten las pantallas de adentro ════════════════════ */

.ad-fila { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.ad-crece { flex: 1; }

/* Las tarjetas de números de arriba de cada pantalla. */
.ad-nums { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }

.ad-num {
  padding: 16px 18px;
  border-radius: 14px;
  background: $panel;
  border: 1px solid $borde;
  display: flex;
  flex-direction: column;
  gap: 4px;

  span { font-weight: 700; font-size: 13px; color: $texto-3; }
  b { font-weight: 900; font-size: 22px; font-variant-numeric: tabular-nums; }
  em { font-style: normal; font-size: 12px; color: $texto-4; }
}

/*
  LA TABLA DEL PANEL, QUE ES UNA GRILLA.

  Cada pantalla fija los anchos de sus columnas en fracciones, como en
  el diseno ("2.4fr 1.2fr .8fr"), y la cabecera y las filas comparten
  esa misma linea. Con un <table> el navegador reparte el ancho segun lo
  que haya adentro: la misma pantalla sale distinta cada vez que cambian
  los datos, y dos pantallas parecidas nunca quedan alineadas.

  El ancho minimo lo pone cada seccion: abajo de eso, la tabla se
  desliza de costado en vez de apretar ocho columnas en un telefono.
*/

.ad-t {
  border-radius: 16px;
  background: $panel-alto;
  border: 1px solid $borde;
  overflow: hidden;
}

.ad-t__titulo {
  margin: 0;
  padding: 16px 18px;
  border-bottom: 1px solid $borde;
  font-weight: 900;
  font-size: 18px;
}

.ad-t__scroll { overflow-x: auto; }

.ad-t__cab {
  display: grid;
  gap: 12px;
  padding: 12px 18px;
  border-bottom: 1px solid $borde;
  font-weight: 800;
  font-size: 12px;
  letter-spacing: .06em;
  color: $texto-4;
  text-transform: uppercase;
}

.ad-t__fila {
  display: grid;
  gap: 12px;
  align-items: center;
  min-height: 52px;
  padding: 8px 18px;
  border-bottom: 1px solid #1a2d4d;
  font-weight: 700;
  font-size: 14px;

  &:hover { background: $panel-hover; }
  &:last-child { border-bottom: 0; }

  > span { min-width: 0; overflow-wrap: anywhere; }
}

.ad-t__vacio { padding: 40px; text-align: center; color: $texto-4; font-weight: 700; }

/* La tabla. Es la pieza que más se repite del panel. */
.ad-tabla {
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid $borde;
  background: $panel-alto;
}

.ad-tabla__scroll { overflow-x: auto; }

.ad-tabla table { width: 100%; border-collapse: collapse; white-space: nowrap; }

.ad-tabla th {
  padding: 12px 16px;
  text-align: left;
  background: $panel;
  font-weight: 900;
  font-size: 11px;
  letter-spacing: .1em;
  color: $texto-4;
  text-transform: uppercase;
}

.ad-tabla td { padding: 13px 16px; border-top: 1px solid #1a2a45; font-weight: 700; font-size: 14px; }
.ad-tabla tbody tr:hover { background: $panel-hover; }
.ad-tabla__vacio { padding: 40px; text-align: center; color: $texto-4; font-weight: 700; }
.ad-der { text-align: right; font-variant-numeric: tabular-nums; }
.ad-tenue { color: $texto-4; font-weight: 600; }
.ad-verde { color: $verde; }
.ad-rojo { color: #ff9aa5; }
.ad-amarillo { color: $amarillo; }

/* La pastilla de estado: verde bien, amarillo esperando, rojo mal. */
.ad-estado {
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border-radius: 8px;
  font-weight: 900;
  font-size: 11px;
  letter-spacing: .04em;
  background: #1d3354;
  color: $texto-3;

  &.is-bien { background: rgba(93, 255, 176, .14); color: $verde; }
  &.is-espera { background: rgba(255, 211, 90, .14); color: $amarillo; }
  &.is-mal { background: rgba(255, 91, 107, .14); color: #ff9aa5; }
}

/* Los controles. */
.ad-b {
  height: 40px;
  padding: 0 16px;
  border-radius: 10px;
  border: 0;
  background: $azul;
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  font-size: 14px;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  @include foco;
  &:hover:not(:disabled) { filter: brightness(1.08); color: #fff; }
  &:disabled { opacity: .5; cursor: default; }

  &--suave { background: #1d3354; }

  /* El de arriba a la derecha: mas alto, con borde claro y sombra. */
  &--grande {
    height: 46px;
    padding: 0 20px;
    border: 2px solid #9cc4ff;
    box-shadow: 0 4px 0 $azul-hondo;
    font-weight: 900;
    font-size: 15px;
  }
  &--mal { background: transparent; border: 1px solid #ff5b6b; color: #ff9aa5; }
  &--chico { height: 32px; padding: 0 10px; font-size: 12px; }
}

/*
  EL SELECTOR DIBUJADO.

  Es el mismo componente del sitio; acá solo se le dan las medidas
  de los campos del panel. El `<select>` del navegador abria una
  lista BLANCA dibujada por Windows en medio de un panel oscuro.
*/
.ad-elegir {
  min-width: 170px;

  .mb-el__boton {
    height: 40px;
    border-radius: 10px;
    border-color: $borde-fuerte;
    background: $panel-alto;
    font-size: 13px;
  }
}

.ad-campo .ad-elegir, .ade__campo .ad-elegir, .adt__in.ad-elegir { width: 100%; min-width: 0; }

.ad-in, .ad-sel {
  height: 42px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid $borde-fuerte;
  background: $panel;
  color: #fff;
  font-family: inherit;
  font-size: 14px;
  &:focus { outline: none; border-color: $azul; }
}

.ad-sel { padding-right: 32px; cursor: pointer; }

.ad-campo {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-weight: 800;
  font-size: 11px;
  letter-spacing: .08em;
  color: $texto-4;
  text-transform: uppercase;
}

.ad-caja {
  border-radius: 16px;
  background: $panel-alto;
  border: 1px solid $borde;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;

  h2 { margin: 0; font-weight: 900; font-size: 18px; }
  p { margin: 0; font-size: 14px; line-height: 1.5; color: $texto-3; }
}

.ad-aviso {
  padding: 12px 16px;
  border-radius: 12px;
  background: rgba(255, 211, 90, .1);
  border: 1px solid $amarillo;
  color: $amarillo;
  font-weight: 700;
  font-size: 13px;
  line-height: 1.5;
}

.ad-paginas {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 14px;
  border-top: 1px solid $borde;
  color: $texto-3;
  font-weight: 800;
}
</style>
