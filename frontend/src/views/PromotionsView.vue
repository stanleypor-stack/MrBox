<template>
  <div class="mb-promos">
    <div class="mb-promos__cabeza">
      <h1>{{ $t('nav.promotions') }}</h1>
      <p>{{ $t('promos.sub') }}</p>
    </div>

    <p v-if="!cargando && !items.length" class="mb-vacio">{{ $t('promos.empty') }}</p>

    <div v-else class="mb-promos__grilla">
      <article v-for="p in items" :key="p._id" class="mb-promo">
        <div class="mb-promo__arte" :style="{ background: p.arte.fondo }">
          <span class="mb-promo__rayos" aria-hidden="true"></span>
          <span v-if="p.arte.pos1" class="mb-art mb-promo__a1" :style="{ backgroundPosition: p.arte.pos1 }" aria-hidden="true"></span>
          <span v-if="p.arte.pos2" class="mb-art mb-promo__a2" :style="{ backgroundPosition: p.arte.pos2 }" aria-hidden="true"></span>

          <div class="mb-promo__texto">
            <span class="mb-promo__kicker" :style="{ color: p.arte.acento }">{{ p.arte.kicker }}</span>
            <span class="mb-promo__l1">{{ p.arte.linea1 }}</span>
            <span class="mb-promo__l2">{{ p.arte.linea2 }}</span>
          </div>
        </div>

        <div class="mb-promo__cuerpo">
          <h2>{{ p.titulo }}</h2>
          <p>{{ p.texto }}</p>
          <span v-if="p.hasta" class="mb-promo__vence">{{ $t('promos.endsOn', { fecha: fecha(p.hasta) }) }}</span>
          <router-link :to="p.destino" class="mb-promo__b">{{ p.boton || $t('promos.go') }}</router-link>
        </div>
      </article>
    </div>
  </div>
</template>

<script>
import api from "@/api";

/**
 * LAS PROMOCIONES.
 *
 * Todo lo que se ve acá lo carga el panel. No hay ni una escrita en el
 * código: una promo que vence un domingo a la noche no puede necesitar
 * un despliegue para apagarse.
 *
 * Por lo mismo, el texto viene del servidor ya en el idioma del
 * jugador en vez de salir de los archivos de idioma: lo escribe quien
 * hace marketing y cambia cada semana.
 */
export default {
  name: "PromotionsView",

  data() { return { items: [], cargando: true }; },

  watch: {
    "$i18n.locale"() { this.traer(); },
  },

  methods: {
    fecha(d) {
      return new Date(d).toLocaleDateString(this.$i18n.locale, {
        day: "2-digit", month: "short", year: "numeric",
      });
    },

    async traer() {
      this.cargando = true;
      try {
        const { data } = await api.get("/promotions", { params: { lang: this.$i18n.locale } });
        this.items = data.data.items;
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

.mb-promos { display: flex; flex-direction: column; gap: 20px; }

.mb-promos__cabeza {
  display: flex;
  flex-direction: column;
  gap: 6px;

  h1 {
    margin: 0;
    font-family: $fuente-cartel;
    font-weight: 400;
    font-size: clamp(2rem, 5vw, 2.75rem);
    line-height: 1;
    text-shadow: 0 4px 0 $azul-hondo, 0 7px 0 $azul-tinta;
  }

  p { margin: 0; color: $texto-3; font-size: 16px; }
}

.mb-promos__grilla {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
  gap: 20px;
}

.mb-promo {
  border-radius: 20px;
  overflow: hidden;
  background: $panel-alto;
  border: 1px solid $borde;
  display: flex;
  flex-direction: column;
}

.mb-promo__arte { position: relative; height: 200px; overflow: hidden; }

.mb-promo__rayos {
  position: absolute;
  inset: 0;
  background: repeating-conic-gradient(from 0deg at 80% 50%, rgba(255, 255, 255, .10) 0deg 6deg, rgba(255, 255, 255, 0) 6deg 22deg);
}

.mb-promo__a1 { position: absolute; right: -10px; top: 26px; width: 170px; height: 170px; }
.mb-promo__a2 { position: absolute; right: 110px; top: 96px; width: 110px; height: 110px; transform: rotate(-10deg); }

.mb-promo__texto {
  position: absolute;
  left: 20px;
  top: 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 62%;
}

.mb-promo__kicker {
  font-family: $fuente-cartel;
  font-size: 28px;
  line-height: 1;
  text-shadow: 0 3px 0 rgba(0, 0, 0, .35);
}

.mb-promo__l1 { font-weight: 900; font-size: 12px; letter-spacing: .12em; }
.mb-promo__l2 { font-family: $fuente-cartel; font-size: 24px; line-height: 1.05; margin-top: 6px; }

.mb-promo__cuerpo {
  padding: 18px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;

  h2 { margin: 0; font-weight: 800; font-size: 21px; }
  p { margin: 0; font-size: 15px; line-height: 1.5; color: $texto-3; flex: 1; }
}

.mb-promo__vence { font-size: 12px; color: $texto-4; }

.mb-promo__b {
  margin-top: 8px;
  height: 48px;
  border-radius: 12px;
  background: $azul;
  box-shadow: 0 4px 0 $azul-hondo;
  color: #fff;
  font-weight: 800;
  font-size: 15px;
  text-decoration: none;
  display: flex;
  align-items: center;
  justify-content: center;
  @include foco;
  &:hover { color: #fff; filter: brightness(1.06); }
}

.mb-vacio { margin: 40px 0; text-align: center; color: $texto-4; }
</style>
