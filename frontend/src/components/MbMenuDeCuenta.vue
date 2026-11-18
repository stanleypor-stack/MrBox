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

/*
  LOS NUEVE ATAJOS DEL DISEÑO.

  Casi todos llevan a una pestaña del perfil, no a una pantalla nueva:
  el perfil YA tiene esas pestañas, y una pantalla aparte por cada una
  sería la misma tabla dos veces en dos lugares distintos.
*/
const ITEMS = [
  { id: "wallet", texto: "nav.wallet", icono: "M3 7a2 2 0 0 1 2-2h12v4M3 7v10a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z" },
  { id: "orders", texto: "profile.orders", icono: "M1 4h14v12H1zM15 9h4l4 4v3h-8z" },
  { id: "perfil", texto: "nav.profile", icono: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8a2 2 0 1 1-2.8 2.8a1.7 1.7 0 0 0-2.8 1.4V21a2 2 0 1 1-4 0a1.7 1.7 0 0 0-2.9-1.2a2 2 0 1 1-2.8-2.8A1.7 1.7 0 0 0 3 14H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9a2 2 0 1 1 2.8-2.8A1.7 1.7 0 0 0 10 3V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2a2 2 0 1 1 2.8 2.8A1.7 1.7 0 0 0 21 10H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" },
  { id: "movimientos", texto: "profile.transactions", icono: "M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h4" },
  { id: "historial", texto: "profile.history", icono: "M6 2h12M6 22h12M7 2c0 5 10 5 10 10S7 17 7 22M17 2c0 5-10 5-10 10s10 5 10 10" },
  { id: "actividad", texto: "profile.activity", icono: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 3" },
  { id: "controles", texto: "profile.controls", icono: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" },
  { id: "recompensas", texto: "nav.rewards", icono: "M20 12v9H4v-9M2 7h20v5H2zM12 21V7" },
  { id: "refer", texto: "profile.refer", icono: "M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
];

/**
 * EL MENU DE LA CUENTA DEL CELULAR.
 *
 * Lo abre el último botón de la barra de abajo. Son atajos a las
 * pestañas del perfil, más soporte y salir.
 */
export default {
  name: "MbMenuDeCuenta",

  data() { return { items: ITEMS }; },

  computed: { ...mapGetters(["entro"]) },

  methods: {
    cerrar() { this.$store.commit("abrir", null); },

    elegir(m) {
      if (m.id === "wallet") return this.$store.commit("abrir", "wallet");
      this.cerrar();

      const donde = m.id === "recompensas" ? "/rewards" : "/profile";
      const query = m.id === "recompensas" ? {} : { tab: m.id };
      if (this.$route.path !== donde || this.$route.query.tab !== query.tab) {
        this.$router.push({ path: donde, query });
      }
      window.scrollTo({ top: 0 });
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
