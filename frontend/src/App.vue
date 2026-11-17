<template>
  <div class="mb-app">
    <!--
      LA BARRA LATERAL.

      En escritorio queda pegada arriba mientras se baja la página; en
      celular se convierte en una fila que se desliza al costado, igual
      que en el diseño. El corte es 760px.
    -->
    <nav class="mb-side" :aria-label="$t('nav.boxes')">
      <div class="mb-side__logo">
        <svg viewBox="0 0 1000 260" role="img" aria-label="MR BOX" class="mb-logo">
          <defs>
            <linearGradient id="mbCara" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#ffffff" />
              <stop offset="1" stop-color="#b9cff5" />
            </linearGradient>
            <text
              id="mbPalabra" x="490" y="185" text-anchor="middle"
              font-family="Titan One, sans-serif" font-size="170"
              letter-spacing="2" transform="skewX(-8) translate(26 0)"
            >MR BOX</text>
          </defs>
          <!-- Las capas que le dan el relieve de dibujo animado. -->
          <use href="#mbPalabra" transform="translate(16 16)" fill="#0b2266" stroke="#0b2266" stroke-width="10" stroke-linejoin="round" />
          <use href="#mbPalabra" transform="translate(5 5)" fill="#2c66dc" stroke="#2c66dc" stroke-width="14" stroke-linejoin="round" />
          <use href="#mbPalabra" transform="translate(10 10)" fill="#2c66dc" stroke="#2c66dc" stroke-width="14" stroke-linejoin="round" />
          <use href="#mbPalabra" fill="none" stroke="#0b2266" stroke-width="7" stroke-linejoin="round" />
          <use href="#mbPalabra" fill="url(#mbCara)" />
        </svg>
      </div>

      <ul class="mb-side__menu">
        <li v-for="item in menu" :key="item.clave">
          <a
            :href="item.a"
            class="mb-side__item"
            :class="{ 'is-activo': item.clave === activo }"
            :aria-current="item.clave === activo ? 'page' : null"
            @click.prevent="activo = item.clave"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path :d="item.icono" />
            </svg>
            <span>{{ $t('nav.' + item.clave) }}</span>
          </a>
        </li>
      </ul>

      <div class="mb-side__pie">
        <MbSelectorDeIdioma />
      </div>
    </nav>

    <main class="mb-main">
      <header class="mb-head">
        <h1 class="mb-head__titulo">{{ $t('nav.' + activo) }}</h1>
        <span class="mb-head__saldo">
          <span class="mb-sc" aria-hidden="true">SC</span>
          <span>{{ $t('common.balance') }}: 0.00</span>
        </span>
      </header>

      <section class="mb-aviso">
        <p>
          El esqueleto del sitio, con los nueve idiomas andando. Probá el
          selector de abajo a la izquierda: cambia todo el menú y el
          encabezado, y se acuerda de tu elección la próxima vez.
        </p>
      </section>
    </main>
  </div>
</template>

<script>
import MbSelectorDeIdioma from "@/components/MbSelectorDeIdioma.vue";

export default {
  name: "App",
  components: { MbSelectorDeIdioma },

  data() {
    return {
      activo: "boxes",
      /*
        El menú del diseño. Los íconos son trazos sueltos y no una
        librería: nueve caminos pesan menos que cualquier paquete de
        íconos, y así siguen el color del texto sin pelear.
      */
      menu: [
        { clave: "boxes", a: "/boxes", icono: "M12 2.5 21 7v10l-9 4.5L3 17V7zM3 7l9 4.5L21 7M12 11.5v10" },
        { clave: "deals", a: "/deals", icono: "M12 3a9 9 0 1 0 9 9h-9z" },
        { clave: "community", a: "/community", icono: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M19 8v6M16 11h6" },
        { clave: "createBox", a: "/create", icono: "M12 5v14M5 12h14" },
        { clave: "inventory", a: "/inventory", icono: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" },
        { clave: "races", a: "/races", icono: "M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 21h8" },
        { clave: "challenges", a: "/challenges", icono: "M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7z" },
        { clave: "rewards", a: "/rewards", icono: "M20 12v9H4v-9M2 7h20v5H2zM12 21V7" },
        { clave: "vip", a: "/vip", icono: "M3 8l4 4 5-7 5 7 4-4-2 11H5z" },
      ],
    };
  },
};
</script>

<style lang="scss">
@import "@/styles/tokens";

.mb-app {
  min-height: 100vh;
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  background: $fondo;
}

/* ── La barra lateral ─────────────────────────────────────────────── */

.mb-side {
  flex: 1 1 248px;
  max-width: 264px;
  padding: 0 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: $panel;
  border-right: 1px solid $borde;

  @include en-escritorio {
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
    align-self: flex-start;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
  }

  @include en-celular {
    max-width: none;
    border-right: 0;
    border-bottom: 1px solid $borde;
  }
}

.mb-side__logo {
  height: 68px;
  display: flex;
  align-items: center;
}

.mb-logo {
  width: 132px;
  height: 34px;
}

.mb-side__menu {
  flex: 1;
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;

  // En celular el menú pasa a ser una fila que se desliza.
  @include en-celular {
    flex-direction: row;
    overflow-x: auto;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
  }
}

.mb-side__item {
  height: 40px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: 9px;
  color: $texto-2;
  font-weight: 700;
  font-size: 14px;
  text-decoration: none;
  white-space: nowrap;
  @include foco;

  &:hover {
    background: $lateral-hover;
    color: $texto;
  }

  &.is-activo {
    background: $azul-activo;
    color: $texto;
  }
}

.mb-side__pie {
  @include en-celular { display: none; }
}

/* ── El resto ─────────────────────────────────────────────────────── */

.mb-main {
  flex: 999 1 560px;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.mb-head {
  min-height: 68px;
  padding: 12px 28px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid $borde;
}

.mb-head__titulo {
  flex: 1;
  margin: 0;
  font-family: $fuente-titulo;
  font-size: 24px;
  font-weight: 400;
  letter-spacing: .5px;
}

.mb-head__saldo {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  height: 44px;
  border: 1px solid $borde-fuerte;
  border-radius: $radio;
  background: $panel-alto;
  font-weight: 800;
}

// La moneda. Por ahora es un círculo; cuando esté el dibujo del diseño
// se cambia el fondo acá y listo.
.mb-sc {
  display: inline-flex;
  flex: none;
  width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: linear-gradient($sc-verde-claro, $sc-verde);
  color: $sc-texto;
  font-weight: 900;
  font-size: 9px;
  line-height: 1;
}

.mb-aviso {
  margin: 28px;
  padding: 20px 24px;
  max-width: 640px;
  border: 1px solid $borde;
  border-radius: $radio-panel;
  background: $panel;
  color: $texto-3;

  p { margin: 0; line-height: 1.6; }
}
</style>
