<template>
  <div class="adt">
    <div class="adt__cabeza">
      <div class="adt__quien">
        <h1>{{ $t('admin.nav.' + seccion) }}</h1>
        <span class="adt__que">{{ $t('admin.what.' + seccion) }}</span>
      </div>

      <button type="button" class="ad-b ad-b--grande" :disabled="!hayCambios || guardando" @click="guardar">
        {{ guardando ? $t('admin.loading') : $t('admin.save') }}
      </button>
    </div>

    <p class="ad-aviso">{{ $t('admin.help.' + seccion) }}</p>

    <div class="ad-t">
      <div class="ad-t__scroll">
        <div class="ad-t__ancho" :style="{ minWidth: cfg.ancho }">
          <div class="ad-t__cab" :style="{ gridTemplateColumns: cfg.w }">
            <span v-for="c in cfg.columnas" :key="c.campo">{{ $t('admin.col.' + c.campo) }}</span>
          </div>

          <div v-for="(f, i) in filas" :key="i" class="ad-t__fila" :style="{ gridTemplateColumns: cfg.w }">
            <span v-for="c in cfg.columnas" :key="c.campo">
              <!-- Lo que no se toca se lee; lo demás se escribe acá mismo. -->
              <span v-if="!c.editable" :class="c.tenue ? 'ad-tenue' : ''">{{ texto(c, f) }}</span>

              <MbElegir
                v-else-if="c.tipo === 'siNo'" v-model="f[c.campo]" chico class="ad-elegir"
                :opciones="[{ valor: true, texto: $t('admin.state.on') }, { valor: false, texto: $t('admin.state.off') }]"
              />

              <input
                v-else v-model="f[c.campo]" class="ad-in adt__in"
                :inputmode="c.tipo === 'texto' ? 'text' : 'decimal'"
              >
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import MbElegir from "@/components/MbElegir.vue";
import api from "@/api";

/**
 * UNA TABLA QUE SE EDITA ENTERA.
 *
 * Para lo que no son filas sueltas sino UNA tabla: los nueve rangos
 * VIP y las filas de la portada. Se edita todo a la vez y se guarda una
 * vez, porque los valores se miran entre ellos --un rango tiene que
 * pedir más que el anterior-- y guardarlos de a uno deja estados
 * imposibles en el medio.
 */
const TABLAS = {
  ranks: {
    traer: "/admin/ranks",
    guardar: "/admin/ranks",
    clave: "rangos",
    ancho: "700px",
    w: "1.2fr 1.4fr 1.2fr 1fr",
    columnas: [
      { campo: "rango", de: "rango" },
      { campo: "desdeSc", de: "desdeSc", editable: true },
      { campo: "rakebackPct", de: "rakebackPct", editable: true },
      { campo: "jugadores", de: "jugadores", tenue: true },
    ],
    /* De lo que manda la pantalla de lista a lo que espera el servidor. */
    aFilas: (d) => d.items.map((r) => ({
      rango: r.rango,
      desdeSc: r.desdeSc,
      rakebackPct: r.rakebackPct,
      jugadores: r.jugadores,
      color: r.color,
    })),
    aServidor: (filas) => ({
      rangos: filas.map((f) => ({
        nombre: f.rango,
        desde: Number(f.desdeSc) || 0,
        color: f.color,
        rakebackSemanal: (Number(f.rakebackPct) || 0) / 100,
      })),
    }),
  },

  home: {
    traer: "/admin/home",
    guardar: "/admin/home",
    clave: "filas",
    ancho: "700px",
    w: ".6fr 1.6fr 2.4fr .8fr",
    columnas: [
      { campo: "orden", editable: true },
      { campo: "fila", tipo: "clave" },
      { campo: "regla", tipo: "clave", tenue: true },
      { campo: "visible", tipo: "siNo", editable: true },
    ],
    aFilas: (d) => d.items.map((f) => ({
      _id: f._id,
      orden: f.orden,
      fila: f.fila,
      regla: f.regla,
      visible: f.visible,
    })),
    aServidor: (filas) => ({
      filas: filas.map((f) => ({ id: f._id, orden: Number(f.orden) || 0, visible: !!f.visible })),
    }),
  },
};

export default {
  name: "AdminTabla",

  components: { MbElegir },

  data() { return { filas: [], original: "", guardando: false }; },

  computed: {
    seccion() { return this.$route.path.split("/")[2]; },
    cfg() { return TABLAS[this.seccion] || TABLAS.ranks; },
    hayCambios() { return JSON.stringify(this.filas) !== this.original; },
  },

  watch: {
    $route() { this.traer(); },
  },

  methods: {
    texto(c, f) {
      const v = f[c.campo];
      if (c.tipo === "clave" && v) return this.$t(v);
      if (v === undefined || v === null || v === "") return "—";
      return String(v);
    },

    async traer() {
      try {
        const { data } = await api.get(this.cfg.traer);
        this.filas = this.cfg.aFilas(data.data);
        this.original = JSON.stringify(this.filas);
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    async guardar() {
      this.guardando = true;
      try {
        await api.put(this.cfg.guardar, this.cfg.aServidor(this.filas));
        this.original = JSON.stringify(this.filas);
        this.$store.dispatch("avisar", { texto: this.$t("admin.done") });
        await this.traer();
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.guardando = false;
      }
    },
  },

  created() { this.traer(); },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.adt { display: flex; flex-direction: column; gap: 20px; }
.adt__cabeza { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.adt__quien { flex: 1 1 320px; display: flex; flex-direction: column; gap: 4px; }
.adt__quien h1 { margin: 0; font-weight: 900; font-size: 26px; }
.adt__que { max-width: 680px; font-size: 14px; line-height: 1.5; color: $texto-3; }
.adt__in { width: 100%; height: 36px; box-sizing: border-box; font-size: 13px; }
.ad-tenue { color: $texto-4; }
</style>
