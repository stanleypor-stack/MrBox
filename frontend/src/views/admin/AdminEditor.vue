<template>
  <div class="ade" @keydown.esc="$emit('cerrar')">
    <button type="button" class="ade__fondo" :aria-label="$t('admin.cancel')" @click="$emit('cerrar')"></button>

    <form class="ade__caja" role="dialog" aria-modal="true" :aria-label="titulo" @submit.prevent="guardar">
      <header class="ade__cabeza">
        <h2>{{ titulo }}</h2>
        <button type="button" class="ade__x" :aria-label="$t('admin.cancel')" @click="$emit('cerrar')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.8"
               stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </header>

      <div class="ade__campos">
        <label v-for="c in campos" :key="c.campo" class="ade__campo" :class="{ 'ade__campo--ancho': c.ancho }">
          <!--
            El rotulo propio existe porque los nombres de columna se
            comparten entre secciones: `codigo` es "Order" en pedidos y
            "Code" en codigos promocionales.
          -->
          <span class="ade__rotulo">{{ $t(c.rotulo || ('admin.col.' + c.campo)) }}</span>

          <select v-if="c.tipo === 'siNo'" v-model="forma[c.campo]" class="ad-in">
            <option :value="true">{{ $t('admin.state.on') }}</option>
            <option :value="false">{{ $t('admin.state.off') }}</option>
          </select>

          <select v-else-if="c.opciones" v-model="forma[c.campo]" class="ad-in">
            <option v-for="o in c.opciones" :key="o" :value="o">{{ o }}</option>
          </select>

          <input
            v-else v-model="forma[c.campo]" class="ad-in"
            :type="c.tipo === 'fecha' ? 'datetime-local' : 'text'"
            :inputmode="c.tipo === 'numero' || c.tipo === 'sc' ? 'decimal' : 'text'"
            :placeholder="c.ejemplo || ''"
          >

          <span v-if="c.ayuda" class="ade__ayuda">{{ $t(c.ayuda) }}</span>
        </label>
      </div>

      <footer class="ade__pie">
        <button
          v-if="fila && cfg.editor.borrar" type="button" class="ad-b ad-b--mal"
          :disabled="ocupado" @click="borrar"
        >{{ $t('admin.delete') }}</button>

        <span class="ad-crece"></span>

        <button type="button" class="ad-b ad-b--suave" @click="$emit('cerrar')">{{ $t('admin.cancel') }}</button>
        <button type="submit" class="ad-b" :disabled="ocupado">
          {{ ocupado ? $t('admin.loading') : $t('admin.save') }}
        </button>
      </footer>
    </form>
  </div>
</template>

<script>
import api from "@/api";

/**
 * EL FORMULARIO DEL PANEL.
 *
 * Uno solo para todo lo que se crea y se edita: carreras, promociones,
 * códigos, desafíos, banners. Los campos salen de `secciones.js`, igual
 * que las columnas de la tabla.
 *
 * POR QUE UNO Y NO SEIS
 *
 * Porque son seis veces el mismo formulario: unos campos, Guardar y
 * Borrar. Seis archivos que empiezan iguales terminan distintos --uno
 * valida la fecha y otro no, uno pide motivo para borrar y otro no-- y
 * la diferencia se descubre el día que alguien borra algo sin querer.
 *
 * LO QUE DE VERDAD VALIDA ES EL SERVIDOR
 *
 * Acá se limpia lo que se puede para no hacer viajar un error obvio,
 * pero el que decide es el servidor: tiene la lista blanca de campos y
 * las reglas (ver routes/admin/editar.js).
 */
export default {
  name: "AdminEditor",

  props: {
    cfg: { type: Object, required: true },
    /* `null` es "uno nuevo". */
    fila: { type: Object, default: null },
  },

  data() {
    return { forma: {}, ocupado: false };
  },

  computed: {
    campos() { return this.cfg.editor.campos; },

    titulo() {
      const que = this.$t("admin.nav." + this.cfg.editor.cosa);
      return this.fila ? this.$t("admin.editing", { que }) : this.$t("admin.creating", { que });
    },
  },

  created() {
    const forma = {};

    for (const c of this.campos) {
      let v = this.fila ? this.fila[c.campoReal || c.campo] : c.porDefecto;
      if (v === undefined && this.fila) v = this.fila[c.campo];

      /* Un texto por idioma llega como objeto; en el formulario se
         edita el inglés, que es el que ve todo el mundo hasta que se
         traduzca. */
      if (c.tipo === "idiomas" && v && typeof v === "object") v = v.en || Object.values(v)[0] || "";

      /* El campo de fecha del navegador quiere "2026-11-18T21:30". */
      if (c.tipo === "fecha" && v) v = new Date(v).toISOString().slice(0, 16);

      if (c.tipo === "siNo") v = v === undefined ? true : !!v;
      forma[c.campo] = v === undefined || v === null ? "" : v;
    }

    this.forma = forma;
  },

  methods: {
    async guardar() {
      this.ocupado = true;
      try {
        const cuerpo = {};
        for (const c of this.campos) {
          const v = this.forma[c.campo];
          if (v === "" && !this.fila) continue;
          /* La etiqueta puede decir "caja" y el servidor esperar "box". */
          cuerpo[c.campoReal || c.campo] = v;
        }

        const base = `/admin/${this.cfg.editor.cosa}`;
        if (this.fila) await api.put(`${base}/${this.fila._id}`, cuerpo);
        else await api.post(base, cuerpo);

        this.$store.dispatch("avisar", { texto: this.$t("admin.done") });
        this.$emit("listo");
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.ocupado = false;
      }
    },

    /** Borrar pide motivo: no se puede deshacer y queda en el registro. */
    async borrar() {
      const motivo = window.prompt(this.$t("admin.whyDelete"));
      if (motivo === null) return;
      if (String(motivo).trim().length < 3) {
        this.$store.dispatch("avisar", { texto: this.$t("error.REASON_REQUIRED"), tono: "error" });
        return;
      }

      this.ocupado = true;
      try {
        await api.delete(`/admin/${this.cfg.editor.cosa}/${this.fila._id}`, { data: { motivo } });
        this.$store.dispatch("avisar", { texto: this.$t("admin.done") });
        this.$emit("listo");
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.ocupado = false;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.ade {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  box-sizing: border-box;
}

.ade__fondo { position: absolute; inset: 0; border: 0; background: rgba(3, 8, 18, .72); cursor: pointer; }

.ade__caja {
  position: relative;
  width: min(680px, 100%);
  max-height: calc(100vh - 32px);
  overflow: auto;
  border-radius: 18px;
  border: 1px solid $borde-fuerte;
  background: $panel;
  display: flex;
  flex-direction: column;
}

.ade__cabeza {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 16px 18px;
  border-bottom: 1px solid $borde;

  h2 { margin: 0; font-weight: 900; font-size: 18px; }
}

.ade__x {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  border: 0;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  @include foco;
}

.ade__campos {
  padding: 18px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
  gap: 14px;
}

.ade__campo { display: flex; flex-direction: column; gap: 6px; &--ancho { grid-column: 1 / -1; } }
.ade__rotulo { font-weight: 800; font-size: 13px; }
.ade__ayuda { font-size: 12px; line-height: 1.4; color: $texto-4; }

.ade__pie {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 18px;
  border-top: 1px solid $borde;
}
</style>
