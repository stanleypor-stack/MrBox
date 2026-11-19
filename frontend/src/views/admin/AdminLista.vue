<template>
  <div class="adl">
    <!-- ── Título, explicación y el botón de la pantalla ────────── -->
    <div class="adl__cabeza">
      <div class="adl__quien">
        <h1>{{ $t('admin.nav.' + seccion) }}</h1>
        <span class="adl__que">{{ $t('admin.what.' + seccion) }}</span>
      </div>

      <button v-if="cfg.editor" type="button" class="ad-b ad-b--grande" @click="editando = { nueva: true }">
        + {{ $t('admin.new', { que: $t('admin.nav.' + seccion) }) }}
      </button>

      <button v-if="cfg.accion" type="button" class="ad-b ad-b--grande" @click="hacerLoDeArriba">
        {{ $t(cfg.accion.texto) }}
      </button>
    </div>

    <!-- ── Lo que todavía no existe lo dice ─────────────────────── -->
    <p v-if="pendiente" class="ad-aviso">{{ $t('admin.pending.' + pendiente) }}</p>

    <!-- ── Los números de esta pantalla ─────────────────────────── -->
    <div v-if="numeros.length" class="adl__nums">
      <div v-for="n in numeros" :key="n.rotulo" class="adl__num">
        <span>{{ n.rotulo }}</span>
        <strong :class="n.clase">{{ n.valor }}</strong>
      </div>
    </div>

    <!-- ── Buscar y filtrar ─────────────────────────────────────── -->
    <div v-if="cfg.busca || cfg.filtros" class="ad-fila">
      <input
        v-if="cfg.busca" v-model="busqueda" type="search" class="ad-in adl__buscar"
        :placeholder="$t('admin.search')" :aria-label="$t('admin.search')" @input="conRetraso"
      >

      <div v-for="f in (cfg.filtros || [])" :key="f.campo" class="ad-campo">
        {{ $t('admin.filter.' + f.campo) }}
        <MbElegir
          v-model="filtros[f.campo]" chico class="ad-elegir"
          :opciones="[{ valor: '', texto: $t('admin.all') }].concat(f.opciones.map((o) => ({ valor: o, texto: $t(f.textos + '.' + o) })))"
          @elegida="traer(1)"
        />
      </div>

      <span class="ad-crece"></span>
      <span class="ad-tenue">{{ $t('admin.showing', { n: num(total) }) }}</span>
    </div>

    <!-- ── La tabla ─────────────────────────────────────────────── -->
    <div class="ad-t">
      <h2 v-if="cfg.tituloDeTabla" class="ad-t__titulo">{{ $t(cfg.tituloDeTabla) }}</h2>

      <div class="ad-t__scroll">
        <div class="ad-t__ancho" :style="{ minWidth: cfg.ancho || '900px' }">
          <div class="ad-t__cab" :style="{ gridTemplateColumns: columnas }">
            <span v-for="c in cfg.columnas" :key="c.campo" :class="{ 'ad-der': c.der }">
              {{ $t('admin.col.' + c.campo) }}
            </span>
            <span v-if="cfg.acciones || cfg.editor || cfg.detalle"></span>
          </div>

          <div v-for="(f, i) in filas" :key="f._id || i" class="ad-t__fila" :style="{ gridTemplateColumns: columnas }">
            <span v-for="c in cfg.columnas" :key="c.campo" :class="[{ 'ad-der': c.der }, claseDe(c, f)]">
              <!-- Un estado va de pastilla; lo demás, texto. -->
              <span v-if="c.tipo === 'estado'" class="ad-estado" :class="tono(valor(c, f))">
                {{ $t((c.textos || 'admin.state') + '.' + valor(c, f)) }}
              </span>

              <!-- Una foto de la lámina, cuando la fila tiene arte. -->
              <span v-else-if="c.tipo === 'arte'" class="adl__arte">
                <!--
                  La foto sale de SU campo --`c.foto`-- y no del que se
                  muestra. Cuando salia del mismo, el catalogo de
                  objetos pedia "G63 (2024)" como si fuera una imagen y
                  dibujaba el icono de foto rota en cada fila.
                -->
                <span
                  v-if="spr(f[c.foto])" class="adl__foto" :class="spr(f[c.foto]).clase"
                  :style="spr(f[c.foto]).estilo" aria-hidden="true"
                ></span>
                <img v-else-if="esFoto(f[c.foto])" class="adl__foto" :src="f[c.foto]" alt="" loading="lazy">
                <span v-else class="adl__foto adl__foto--sin" aria-hidden="true"></span>
                <span>{{ texto(c, f) }}</span>
              </span>

              <router-link v-else-if="c.enlace" :to="c.enlace(f)" class="adl__link">{{ texto(c, f) }}</router-link>
              <span v-else>{{ texto(c, f) }}</span>
            </span>

            <span v-if="cfg.acciones || cfg.editor || cfg.detalle" class="adl__acciones">
              <button
                v-if="cfg.detalle" type="button" class="ad-b ad-b--chico ad-b--suave"
                :disabled="ocupado === f._id" @click="verDatos(f)"
              >{{ $t('admin.act.seeData') }}</button>

              <button
                v-for="a in (cfg.acciones ? cfg.acciones(f) : [])" :key="a.clave" type="button"
                class="ad-b ad-b--chico" :class="a.clase"
                :disabled="ocupado === f._id" @click="hacer(a, f)"
              >{{ $t(a.texto) }}</button>

              <button
                v-if="cfg.editor" type="button" class="ad-b ad-b--chico ad-b--suave"
                @click="editando = { fila: f }"
              >{{ $t('admin.act.edit') }}</button>
            </span>
          </div>
        </div>
      </div>

      <p v-if="!filas.length" class="ad-t__vacio">{{ $t('admin.empty') }}</p>

      <nav v-if="paginas > 1" class="ad-paginas">
        <button type="button" class="ad-b ad-b--suave ad-b--chico" :disabled="pagina <= 1" @click="traer(pagina - 1)">
          {{ $t('admin.prev') }}
        </button>
        <span>{{ pagina }} / {{ paginas }}</span>
        <button type="button" class="ad-b ad-b--suave ad-b--chico" :disabled="pagina >= paginas" @click="traer(pagina + 1)">
          {{ $t('admin.next') }}
        </button>
      </nav>
    </div>

    <!-- Crear o editar: el mismo formulario para todas las secciones. -->
    <AdminEditor
      v-if="editando && cfg.editor" :cfg="cfg" :fila="editando.fila || null"
      @cerrar="editando = null" @listo="editando = null; traer(pagina)"
    />

    <!--
      LO QUE MANDO UNA PERSONA.

      Nombre real, documento y domicilio: por eso se pide aparte, no
      viene en la lista, y el servidor anota quien lo miro. Las fotos
      se piden de a una por lo mismo.
    -->
    <div v-if="detalle" class="adl__capa" @click.self="detalle = null">
      <div class="adl__ficha" role="dialog" aria-modal="true" :aria-label="$t('admin.act.seeData')">
        <div class="adl__ficha-cabeza">
          <b>{{ detalle.fila.username }}</b>
          <span class="ad-tenue">{{ $t('admin.col.nivel') }} {{ detalle.fila.nivel }}</span>
          <button type="button" class="ad-b ad-b--chico ad-b--suave" @click="detalle = null">
            {{ $t('action.cancel') }}
          </button>
        </div>

        <p v-if="detalle.cargando" class="ad-tenue">{{ $t('admin.loading') }}</p>

        <template v-else>
          <dl class="adl__datos">
            <div v-for="(v, k) in (detalle.datos || {})" :key="k">
              <dt>{{ k }}</dt>
              <dd>{{ v }}</dd>
            </div>
          </dl>

          <p v-if="!Object.keys(detalle.datos || {}).length" class="ad-tenue">{{ $t('admin.empty') }}</p>

          <div v-if="(detalle.adjuntos || []).length" class="adl__archivos">
            <div v-for="a in detalle.adjuntos" :key="a" class="adl__archivo">
              <button
                v-if="!detalle.archivos[a]" type="button" class="ad-b ad-b--chico"
                @click="verArchivo(a)"
              >{{ a }}</button>

              <template v-else>
                <span class="ad-tenue">{{ detalle.archivos[a].nombre || a }}</span>
                <img
                  v-if="esImagen(detalle.archivos[a].contenido)"
                  :src="detalle.archivos[a].contenido" :alt="a"
                >
                <a v-else :href="detalle.archivos[a].contenido" target="_blank" rel="noopener">
                  {{ detalle.archivos[a].nombre || a }}
                </a>
              </template>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>


</template>

<script>
import MbElegir from "@/components/MbElegir.vue";
import api from "@/api";
import { sprite } from "@/utils/sprite";
import AdminEditor from "./AdminEditor.vue";
import SECCIONES from "./secciones";

/** Un estado verde, amarillo o rojo, como en el diseño. */
const BIEN = /^(live|approved|delivered|shipped|confirmed|true|active|on|published|visible|settled|won|verified|paid)$/;
const ESPERA = /^(pending|packing|none|draft|review|waiting|waiting_us|scheduled)$/;
const MAL = /^(rejected|cancelled|failed|off|false|banned|ended|expired|hidden|lost|closed|blocked)$/;

/**
 * UNA PANTALLA DE LISTA DEL PANEL.
 *
 * Veintitantas de las treinta y tres pantallas del panel son la misma
 * pantalla con otra tabla: título, explicación, números arriba, filtros
 * y filas. En vez de veintitantos archivos que empiezan iguales y
 * terminan distintos, hay uno y una tabla de configuración en
 * `secciones.js`.
 *
 * LA TABLA ES UNA GRILLA, NO UN <TABLE>
 *
 * Como en el diseño: cada sección fija el ancho de sus columnas en
 * fracciones ("2.4fr 1.2fr …") y cada fila es una grilla con esos
 * anchos. Con un `<table>` el navegador reparte el ancho según lo que
 * haya adentro, y entonces la misma pantalla queda distinta cada vez
 * que cambian los datos.
 *
 * Las que NO entran acá --el tablero, la ficha de un jugador, el editor
 * de cajas, soporte y la configuración-- tienen su propio archivo,
 * porque de verdad son otra cosa.
 */
export default {
  name: "AdminLista",
  components: { MbElegir, AdminEditor },

  data() {
    return {
      filas: [],
      numeros: [],
      total: 0,
      pagina: 1,
      paginas: 0,
      pendiente: "",
      busqueda: "",
      filtros: {},
      ocupado: "",
      /* Lo que mando una persona, cuando se abre a mirarlo. */
      detalle: null,
      editando: null,
      reloj: null,
    };
  },

  computed: {
    seccion() { return this.$route.path.split("/")[2] || "players"; },
    cfg() { return SECCIONES[this.seccion] || SECCIONES.players; },

    /** Los anchos del diseño, más una columna para los botones. */
    columnas() {
      const base = this.cfg.w || this.cfg.columnas.map(() => "1fr").join(" ");
      const hayBotones = this.cfg.acciones || this.cfg.editor || this.cfg.detalle;
      return hayBotones ? `${base} ${this.cfg.anchoDeAcciones || "150px"}` : base;
    },
  },

  watch: {
    $route() { this.arrancar(); },
  },

  methods: {
    /* Una foto de verdad: una direccion, no el nombre de algo. */
    esFoto(v) { return typeof v === "string" && /^(https?:|\/|data:)/.test(v); },

    num(n) { return Number(n || 0).toLocaleString("en-US"); },

    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },

    spr(url) { return sprite(url); },

    valor(c, f) {
      const v = c.valor ? c.valor(f) : f[c.campo];
      return v === undefined || v === null ? "" : v;
    },

    /** El texto ya formateado según el tipo de la columna. */
    texto(c, f) {
      const v = this.valor(c, f);
      if (c.tipo === "sc") return "SC " + this.plata(v);
      if (c.tipo === "scFirmado") return (v >= 0 ? "+" : "") + this.plata(v);
      if (c.tipo === "dolar") return "$" + this.plata(v);
      if (c.tipo === "numero") return this.num(v);
      if (c.tipo === "pct") return v === null || v === "" ? "—" : v + "%";
      if (c.tipo === "fecha") return v ? new Date(v).toLocaleDateString(this.$i18n.locale, { day: "2-digit", month: "short", year: "numeric" }) : "—";
      if (c.tipo === "fechaHora") return v ? new Date(v).toLocaleString(this.$i18n.locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
      if (c.tipo === "hora") return v ? new Date(v).toLocaleTimeString(this.$i18n.locale) : "—";
      if (c.tipo === "tipoTx") return this.$t("txType." + v);
      if (c.tipo === "siNo") return v ? this.$t("admin.state.on") : this.$t("admin.state.off");
      if (c.tipo === "clave") return v ? this.$t(v) : "—";
      return String(v === "" ? "—" : v);
    },

    claseDe(c, f) {
      if (c.clase) return c.clase(f);
      if (c.tipo === "scFirmado") return this.valor(c, f) >= 0 ? "ad-verde" : "ad-rojo";
      if (c.tenue) return "ad-tenue";
      return "";
    },

    tono(v) {
      const s = String(v).toLowerCase();
      if (BIEN.test(s)) return "is-bien";
      if (ESPERA.test(s)) return "is-espera";
      if (MAL.test(s)) return "is-mal";
      return "";
    },

    conRetraso() {
      window.clearTimeout(this.reloj);
      this.reloj = window.setTimeout(() => this.traer(1), 320);
    },

    arrancar() {
      this.filas = [];
      this.numeros = [];
      this.pendiente = "";
      this.busqueda = this.$route.query.q || "";
      this.filtros = {};
      this.pagina = 1;
      this.traer(1);
    },

    async traer(pagina) {
      try {
        const { data } = await api.get(this.cfg.ruta, {
          params: {
            page: pagina,
            perPage: this.cfg.porPagina || 25,
            q: this.busqueda || undefined,
            ...this.filtros,
          },
        });

        const d = data.data;
        this.filas = d.items || [];
        this.total = d.total != null ? d.total : this.filas.length;
        this.pagina = d.page || 1;
        this.paginas = d.pages || 1;
        this.pendiente = d.pendiente || "";
        this.numeros = this.cfg.numeros ? this.cfg.numeros(d, this) : [];
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    /**
     * El botón de arriba a la derecha.
     *
     * Hoy exporta lo que está en pantalla. Está hecho así a propósito:
     * un "exportar todo" que recorre cien mil filas del libro es el
     * pedido que tumba el servidor justo cuando alguien lo necesita.
     */
    hacerLoDeArriba() {
      if (!this.cfg.accion || this.cfg.accion.que !== "csv") return;

      const cabecera = this.cfg.columnas.map((c) => this.$t("admin.col." + c.campo));
      const filas = this.filas.map((f) => this.cfg.columnas.map((c) => {
        const t = c.tipo === "estado" ? this.valor(c, f) : this.texto(c, f);
        return `"${String(t).replace(/"/g, '""')}"`;
      }));

      const csv = [cabecera.join(","), ...filas.map((f) => f.join(","))].join("\n");
      const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));

      const a = document.createElement("a");
      a.href = url;
      a.download = `mrbox-${this.seccion}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    },

    /**
     * VER LO QUE MANDO.
     *
     * Un pedido aparte --no viene en la lista-- porque devuelve el
     * nombre real, el documento y el domicilio de una persona, y el
     * servidor anota quien lo miro.
     */
    async verDatos(fila) {
      this.ocupado = fila._id;
      this.detalle = { fila, datos: null, archivos: {}, cargando: true };

      try {
        const { data } = await api.get(this.cfg.detalle.ruta(fila));
        this.detalle = { fila, ...data.data, archivos: {}, cargando: false };
      } catch (err) {
        this.detalle = null;
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.ocupado = "";
      }
    },

    /* Lo que se puede dibujar: lo demas se abre aparte. */
    esImagen(contenido) {
      return typeof contenido === "string" && contenido.startsWith("data:image/");
    },

    /** Una foto, que tambien se pide de a una y tambien queda anotada. */
    async verArchivo(campo) {
      if (!this.detalle || this.detalle.archivos[campo]) return;

      try {
        const { data } = await api.get(this.cfg.detalle.archivo(this.detalle.fila, campo));
        this.$set(this.detalle.archivos, campo, data.data);
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    /**
     * Un botón de una fila.
     *
     * Lo que pide un motivo lo pide ACA, antes de mandar nada: el
     * servidor también lo exige, pero enterarse después de haber
     * tocado el botón es una vuelta de más.
     */
    async hacer(accion, fila) {
      let motivo = "";
      if (accion.pideMotivo) {
        motivo = window.prompt(this.$t(accion.pregunta || "admin.reason"));
        if (motivo === null) return;
        if (String(motivo).trim().length < 3) {
          this.$store.dispatch("avisar", { texto: this.$t("error.REASON_REQUIRED"), tono: "error" });
          return;
        }
      } else if (accion.confirma && !window.confirm(this.$t(accion.confirma))) {
        return;
      }

      this.ocupado = fila._id;
      try {
        await api.post(accion.ruta(fila), { ...(accion.cuerpo ? accion.cuerpo(fila) : {}), motivo });
        this.$store.dispatch("avisar", { texto: this.$t("admin.done") });
        await this.traer(this.pagina);
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.ocupado = "";
      }
    },
  },

  created() { this.arrancar(); },
  beforeDestroy() { window.clearTimeout(this.reloj); },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.adl { display: flex; flex-direction: column; gap: 20px; }

.adl__cabeza { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.adl__quien { flex: 1 1 320px; display: flex; flex-direction: column; gap: 4px; }
.adl__quien h1 { margin: 0; font-weight: 900; font-size: 26px; }
.adl__que { max-width: 680px; font-size: 14px; line-height: 1.5; color: $texto-3; }

/* Las tarjetas de números, las del diseño. */
.adl__nums { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr)); gap: 16px; }

.adl__num {
  padding: 16px 18px;
  border-radius: 14px;
  background: $panel;
  border: 1px solid $borde;
  display: flex;
  flex-direction: column;
  gap: 4px;

  span { font-weight: 700; font-size: 13px; color: $texto-3; }
  strong { font-weight: 900; font-size: 22px; font-variant-numeric: tabular-nums; }
}

.adl__buscar { flex: 1 1 280px; max-width: 420px; }
.adl__acciones { display: flex; gap: 6px; flex-wrap: wrap; }

/* ── La ficha con lo que mando una persona ──────────────────────── */

.adl__capa {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(4, 10, 20, .72);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  overflow-y: auto;
}

.adl__ficha {
  width: 100%;
  max-width: 620px;
  max-height: calc(100vh - 36px);
  overflow-y: auto;
  background: $panel-alto;
  border: 1px solid #2a4170;
  border-radius: 16px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.adl__ficha-cabeza {
  display: flex;
  align-items: center;
  gap: 10px;
  b { font-size: 17px; }
  button { margin-left: auto; }
}

.adl__datos {
  margin: 0;
  display: grid;
  grid-template-columns: minmax(0, 150px) minmax(0, 1fr);
  gap: 8px 14px;

  dt { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: $texto-4; }
  dd { margin: 0; font-size: 14px; word-break: break-word; }
}

.adl__archivos { display: flex; flex-direction: column; gap: 12px; }

.adl__archivo {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;

  img { max-width: 100%; border-radius: 10px; border: 1px solid #2a4170; }
  a { color: #6bb4ff; font-size: 13px; }
}
.adl__link { color: #9fc0ff; text-decoration: none; &:hover { color: #fff; } }

.adl__foto--sin { background: $panel-alto; border: 1px dashed $borde-fuerte; }

.adl__arte { display: flex; align-items: center; gap: 10px; min-width: 0; }
.adl__foto { width: 34px; height: 34px; flex: none; border-radius: 8px; }
</style>
