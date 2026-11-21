<template>
  <div class="mb-com">
    <div class="mb-com__cabeza">
      <h1>{{ $t('nav.community') }}</h1>
      <router-link to="/create" class="mb-com__armar">{{ $t('community.buildYourOwn') }}</router-link>
    </div>

    <p class="mb-com__intro">{{ $t('community.intro') }}</p>

    <p v-if="!cargando && !cajas.length" class="mb-vacio">{{ $t('community.empty') }}</p>

    <div v-else class="mb-com__grilla">
      <router-link v-for="c in cajas" :key="c._id" :to="`/boxes/${c.slug}`" class="mb-ccaja mb-card">
        <span class="mb-ccaja__marco" :style="{ background: halo(c) }">
          <mb-caja-dibujada
            :color="c.portada.color" :textura="c.portada.textura || 'liso'" :estilo="c.portada.estilo"
            :portada="asoman(c)" :posiciones="c.portada.posiciones || {}"
            :logo-izquierdo="c.portada.logoIzquierdo" :logo-derecho="c.portada.logoDerecho"
          />
          <span v-if="esNueva(c)" class="mb-ccaja__nueva">NEW</span>
        </span>

        <span class="mb-ccaja__nombre">{{ c.name }}</span>

        <span class="mb-ccaja__pie">
          <span class="mb-ccaja__precio">
            <span class="mb-sc mb-sc--18" aria-hidden="true">SC</span>{{ plata(c.priceSc) }}
          </span>
          <span class="mb-ccaja__objetos">{{ $t('box.items', { n: c.prizes.length }) }}</span>
        </span>

        <span v-if="c.creador" class="mb-ccaja__autor">{{ $t('community.by', { who: c.creador.username }) }}</span>
      </router-link>
    </div>

    <button
      v-if="pagina < paginas" type="button" class="mb-com__mas"
      :disabled="cargando" @click="traer(pagina + 1)"
    >{{ cargando ? $t('common.loading') : $t('deals.showMore') }}</button>
  </div>
</template>

<script>
import api from "@/api";
import MbCajaDibujada from "@/components/MbCajaDibujada.vue";

/* Una caja es "nueva" durante su primera semana al aire. */
const UNA_SEMANA = 7 * 24 * 60 * 60 * 1000;

/**
 * EL CATALOGO DE LA COMUNIDAD.
 *
 * Las cajas que armaron los jugadores. Se abren, se sortean y se pagan
 * exactamente igual que una de la casa: devuelven el mismo 92% y los
 * premios y las chances se ven antes de abrir, como en todas.
 *
 * Lo único distinto es el dibujo: estas no tienen arte en la lámina, se
 * dibujan en SVG a partir de lo que eligió su creador.
 */
export default {
  name: "CommunityView",
  components: { MbCajaDibujada },

  data() {
    return { cajas: [], pagina: 1, paginas: 0, cargando: true };
  },

  methods: {
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },

    esNueva(c) { return Date.now() - new Date(c.createdAt || 0).getTime() < UNA_SEMANA; },

    /*
      EL HALO, DEL COLOR DE SU PROPIO CARTON.

      Las cajas de la casa tienen uno detras, del color de su
      categoria (ver MbCajaEnGrilla). Las de la comunidad no tenian
      nada: la caja quedaba apoyada sobre un cuadrado gris plano, y
      los premios que asoman --que suelen ser fotos oscuras-- se
      perdian contra el fondo.

      La misma formula que las de la casa, pero el color lo pone el
      creador sin saberlo: es el del carton que eligio.
    */
    halo(c) {
      const hex = ((c.portada && c.portada.color) || "#9b30ff").replace("#", "");
      const n = parseInt(hex.length === 3 ? hex.replace(/(.)/g, "$1$1") : hex, 16);
      const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(",");
      return `radial-gradient(circle at 50% 56%, rgba(${rgb}, .30) 0%, #12213a 72%)`;
    },

    /** Los premios que asoman, en el orden que eligió el creador. */
    asoman(c) {
      const indices = (c.portada && c.portada.asoman) || [];
      const elegidos = indices.map((i) => c.prizes[i]).filter(Boolean);
      /* Si no eligió ninguno, asoman los tres más caros: es lo que
         cualquiera habría elegido. */
      const lista = elegidos.length
        ? elegidos
        : c.prizes.slice().sort((a, b) => b.valueSc - a.valueSc).slice(0, 3);
      return lista.map((p, i) => ({ clave: String(indices[i] != null ? indices[i] : i), imageUrl: p.imageUrl }));
    },

    async traer(pagina) {
      this.cargando = true;
      try {
        const { data } = await api.get("/community/boxes", { params: { page: pagina, perPage: 24 } });
        this.cajas = pagina === 1 ? data.data.items : this.cajas.concat(data.data.items);
        this.pagina = data.data.page;
        this.paginas = data.data.pages;
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.cargando = false;
      }
    },
  },

  created() { this.traer(1); },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-com { display: flex; flex-direction: column; gap: 20px; }

.mb-com__cabeza {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  h1 { margin: 0; font-weight: 900; font-size: clamp(26px, 3.6vw, 34px); }
}

.mb-com__armar {
  height: 46px;
  padding: 0 18px;
  border-radius: 12px;
  background: #1d3354;
  color: #fff;
  font-weight: 800;
  font-size: 14px;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  @include foco;
  &:hover { background: $lateral-hover; color: #fff; }
}

.mb-com__intro { margin: -8px 0 0; max-width: 70ch; color: $texto-3; font-size: 15px; line-height: 1.5; }

.mb-com__grilla {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(46%, 200px), 1fr));
  gap: 16px;
}

.mb-ccaja {
  border-radius: 18px;
  background: $panel-alto;
  border: 1px solid $borde;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-decoration: none;
  color: #fff;
  transition: transform .15s ease, border-color .15s ease;
  @include foco;

  &:hover { transform: translateY(-3px); border-color: $azul; color: #fff; }
}

.mb-ccaja__marco {
  position: relative;
  aspect-ratio: 1 / 1;
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;

  /*
    El dibujo es más ancho que alto y se centra adentro del cuadrado.

    Antes arrancaba en el 22% y dejaba casi un cuarto de tarjeta de
    aire muerto arriba. Ahora entra más grande y más alto: lo que
    asoma de la caja usa ese espacio, que es justo para lo que está.
  */
  > div { position: absolute; left: 2%; right: 2%; top: 13%; }
}

.mb-ccaja__nueva {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 3px 8px;
  border-radius: 7px;
  background: #2fd47a;
  color: $azul-tinta;
  font-weight: 900;
  font-size: 11px;
}

.mb-ccaja__nombre { font-weight: 900; font-size: 15px; }

.mb-ccaja__pie { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.mb-ccaja__precio { display: flex; align-items: center; gap: 6px; font-weight: 900; font-size: 15px; }
.mb-ccaja__objetos { font-size: 12px; font-weight: 700; color: $texto-4; }
.mb-ccaja__autor { font-size: 12px; color: $texto-4; }

.mb-com__mas {
  align-self: center;
  height: 46px;
  padding: 0 22px;
  border-radius: 12px;
  border: 0;
  background: #1d3354;
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  font-size: 14px;
  cursor: pointer;
  @include foco;
  &:disabled { opacity: .5; cursor: default; }
}

.mb-vacio { margin: 40px 0; text-align: center; color: $texto-4; }
</style>
