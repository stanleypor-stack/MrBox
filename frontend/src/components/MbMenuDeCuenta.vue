<template>
  <div class="mb-menuc" role="menu" :aria-label="$t('header.account')">
    <div class="mb-menuc__lista">
      <button
        v-for="m in items" :key="m.id" type="button" role="menuitem" @click="elegir(m)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c9d7f7"
             stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path :d="m.icono" />
        </svg>{{ $t(m.texto) }}
      </button>
    </div>

    <button type="button" role="menuitem" class="mb-menuc__solo" @click="$emit('soporte')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c9d7f7"
           stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
        <path d="M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v6H4zM17 14h3v6h-3z" />
      </svg>{{ $t('support.title') }}
    </button>

    <button v-if="entro" type="button" role="menuitem" class="mb-menuc__solo" @click="salir">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c9d7f7"
           stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
      </svg>{{ $t('action.logOut') }}
    </button>

    <router-link v-else to="/login" role="menuitem" class="mb-menuc__solo" @click.native="cerrar">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c9d7f7"
           stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M9 4H5v16h4M14 8l4 4-4 4M18 12H8" />
      </svg>{{ $t('action.signIn') }}
    </router-link>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import { ATAJOS, SECCION } from "@/utils/menuDeCuenta";

/*
  LOS NUEVE ATAJOS DEL DISEÑO.

  Casi todos llevan a una pestaña del perfil, no a una pantalla nueva:
  el perfil YA tiene esas pestañas, y una pantalla aparte por cada una
  sería la misma tabla dos veces en dos lugares distintos.
*/

/**
 * EL MENU DE LA CUENTA DEL CELULAR.
 *
 * Lo abre el último botón de la barra de abajo. Son atajos a las
 * pestañas del perfil, más soporte y salir.
 */


export default {
  name: "MbMenuDeCuenta",

  data() { return { items: ATAJOS }; },

  computed: { ...mapGetters(["entro"]) },

  methods: {
    cerrar() { this.$store.commit("abrir", null); },

    elegir(m) {
      if (m.id === "wallet") return this.$store.commit("abrir", "wallet");
      this.cerrar();

      if (m.id === "inventario") {
        if (this.$route.path !== "/inventory") this.$router.push("/inventory");
        window.scrollTo({ top: 0 });
        return undefined;
      }

      if (m.id === "recompensas") {
        if (this.$route.path !== "/rewards") this.$router.push("/rewards");
        window.scrollTo({ top: 0 });
        return undefined;
      }

      /*
        AL PEDAZO DEL PERFIL, NO AL PRINCIPIO DEL PERFIL.

        El perfil es UNA pagina larga, asi que cada atajo es una
        seccion de esa pagina. Antes todos empujaban `?tab=` y
        enseguida un `scrollTo(0)` que deshacia el salto: se tocara lo
        que se tocara, se terminaba arriba de todo, en "Perfil".

        El nombre de la seccion no siempre es el del atajo --"orders"
        es la seccion "pedidos"-- asi que va la tabla de arriba.
      */
      const seccion = SECCION[m.id] || m.id;

      if (this.$route.path !== "/profile") {
        this.$router.push({ path: "/profile", query: { tab: seccion } });
        return undefined;
      }

      /* Ya estando en el perfil: se cambia la direccion y el perfil
         baja solo (mira `$route.query.tab`). */
      if (this.$route.query.tab !== seccion) {
        this.$router.replace({ query: { ...this.$route.query, tab: seccion } }).catch(() => {});
      } else {
        const el = document.getElementById("p-" + seccion);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return undefined;
    },

    async salir() {
      this.cerrar();
      await this.$store.dispatch("salir");
      if (this.$route.path !== "/") this.$router.push("/");
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-menuc {
  position: fixed;
  right: max(8px, calc(50% - 232px));
  bottom: 80px;
  z-index: 70;
  width: 210px;
  box-sizing: border-box;
  padding: 8px;
  border-radius: 18px;
  border: 2px solid #fff;
  background: #0e2448;
  box-shadow: 0 20px 50px rgba(0, 0, 0, .55);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mb-menuc__lista {
  border-radius: 12px;
  background: #12305e;
  padding: 4px;
  display: flex;
  flex-direction: column;

  button {
    height: 40px;
    padding: 0 10px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: #fff;
    font-family: inherit;
    font-weight: 800;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 10px;
    text-align: left;
    @include foco;
    &:hover { background: #1a4484; }
  }
}

.mb-menuc__solo {
  height: 44px;
  padding: 0 14px;
  border: 0;
  border-radius: 12px;
  background: #12305e;
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  font-size: 14px;
  text-decoration: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  @include foco;
  &:hover { background: #1a4484; color: #fff; }
}
</style>
