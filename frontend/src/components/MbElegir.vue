<template>
  <div class="mb-el" :class="{ 'is-abierto': abierto, 'is-chico': chico, 'is-apagado': deshabilitado }">
    <button
      ref="boton" type="button" class="mb-el__boton"
      :disabled="deshabilitado" :aria-expanded="String(abierto)" aria-haspopup="listbox"
      @click="alternar" @keydown.down.prevent="abrir(1)" @keydown.up.prevent="abrir(-1)"
    >
      <slot name="icono" :o="elegida">
        <span
          v-if="elegida && elegida.color" class="mb-el__punto"
          :style="{ background: elegida.color }" aria-hidden="true"
        >{{ elegida.letra }}</span>
      </slot>

      <span class="mb-el__texto">
        {{ elegida ? elegida.texto : '—' }}
        <span v-if="elegida && elegida.nota" class="mb-el__nota">{{ elegida.nota }}</span>
      </span>

      <span v-if="elegida && elegida.derecha" class="mb-el__der">{{ elegida.derecha }}</span>

      <svg
        class="mb-el__flecha" width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"
      ><path d="m6 9 6 6 6-6" /></svg>
    </button>

    <!--
      LA LISTA LA DIBUJAMOS NOSOTROS.

      Un `<select>` abierto lo dibuja el sistema operativo: fondo
      blanco, resaltado azul y barra de scroll gris. En un sitio
      oscuro se ve como un parche de otra página --que es justo lo
      que pasaba acá-- y no hay CSS que lo arregle.
    -->
    <ul v-if="abierto" ref="lista" class="mb-el__lista" role="listbox" @keydown.esc="cerrar">
      <li v-for="(o, i) in opciones" :key="o.valor" role="none">
        <button
          type="button" role="option" class="mb-el__op"
          :class="{ 'is-elegida': o.valor === value, 'is-marcada': i === marcada }"
          :aria-selected="String(o.valor === value)"
          @click="elegir(o)" @mousemove="marcada = i"
        >
          <slot name="icono" :o="o">
            <span v-if="o.color" class="mb-el__punto" :style="{ background: o.color }" aria-hidden="true">{{ o.letra }}</span>
          </slot>

          <span class="mb-el__texto">
            {{ o.texto }}
            <span v-if="o.nota" class="mb-el__nota">{{ o.nota }}</span>
          </span>

          <span v-if="o.derecha" class="mb-el__der">{{ o.derecha }}</span>

          <svg
            v-if="o.valor === value" class="mb-el__tilde" width="15" height="15" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"
            aria-hidden="true"
          ><path d="m5 13 4 4L19 7" /></svg>
        </button>
      </li>
    </ul>
  </div>
</template>

<script>
/**
 * UN SELECTOR DIBUJADO POR NOSOTROS.
 *
 * El del navegador abre una lista que dibuja el sistema operativo:
 * blanca, con el resaltado azul de Windows y su barra de scroll gris.
 * En un sitio oscuro eso se ve como un pedazo de otra página.
 *
 * LO QUE HAY QUE DEVOLVER A MANO
 *
 * Un `<select>` traía gratis el teclado y el cierre al tocar afuera.
 * Acá va: flechas para moverse, Enter para elegir, Escape para salir,
 * `role="listbox"` para quien usa lector de pantalla, y un clic en
 * cualquier otro lado cierra la lista.
 */
export default {
  name: "MbElegir",

  props: {
    /* v-model */
    value: { type: [String, Number, Boolean], default: "" },

    /** [{ valor, texto, nota?, derecha?, color?, letra? }] */
    opciones: { type: Array, required: true },

    chico: { type: Boolean, default: false },
    deshabilitado: { type: Boolean, default: false },
  },

  data() { return { abierto: false, marcada: -1 }; },

  computed: {
    elegida() { return this.opciones.find((o) => o.valor === this.value) || null; },
  },

  methods: {
    alternar() { return this.abierto ? this.cerrar() : this.abrir(0); },

    abrir(paso) {
      const i = this.opciones.findIndex((o) => o.valor === this.value);
      this.marcada = Math.max(0, i + (paso || 0));
      this.abierto = true;
      document.addEventListener("mousedown", this.afuera);
      document.addEventListener("keydown", this.tecla);
    },

    cerrar() {
      this.abierto = false;
      document.removeEventListener("mousedown", this.afuera);
      document.removeEventListener("keydown", this.tecla);
    },

    afuera(e) { if (!this.$el.contains(e.target)) this.cerrar(); },

    tecla(e) {
      if (!this.abierto) return;
      if (e.key === "Escape") { this.cerrar(); this.$refs.boton.focus(); return; }

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const n = this.opciones.length;
        this.marcada = (this.marcada + (e.key === "ArrowDown" ? 1 : n - 1)) % n;
        return;
      }

      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const o = this.opciones[this.marcada];
        if (o) this.elegir(o);
      }
    },

    elegir(o) {
      this.cerrar();
      this.$refs.boton.focus();
      if (o.valor !== this.value) this.$emit("input", o.valor);
      this.$emit("elegida", o.valor);
    },
  },

  beforeDestroy() { this.cerrar(); },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-el { position: relative; }

.mb-el__boton,
.mb-el__op {
  width: 100%;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  height: 52px;
  border: 0;
  background: transparent;
  color: #fff;
  font: inherit;
  font-weight: 800;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  @include foco;
}

.mb-el__boton {
  border-radius: 12px;
  border: 1px solid $borde;
  background: $panel-alto;

  &:hover:not(:disabled) { border-color: $borde-fuerte; }
  &:disabled { cursor: not-allowed; opacity: .55; }
}

.is-chico .mb-el__boton, .is-chico .mb-el__op { height: 40px; font-size: 13px; }

.mb-el__texto { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mb-el__nota { font-weight: 700; font-size: 12px; color: $texto-4; }
.mb-el__der { font-weight: 800; font-size: 12px; color: $texto-4; }
.mb-el__flecha { flex: none; color: $texto-3; transition: transform .15s; }
.is-abierto .mb-el__flecha { transform: rotate(180deg); }
.mb-el__tilde { flex: none; color: $verde; }

/* La monedita: un círculo de color con su inicial. */
.mb-el__punto {
  width: 26px;
  height: 26px;
  flex: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: 13px;
  color: #fff;
}

.is-chico .mb-el__punto { width: 20px; height: 20px; font-size: 11px; }

.mb-el__lista {
  position: absolute;
  z-index: 30;
  top: calc(100% + 6px);
  left: 0;

  /*
    TAN ANCHA COMO HAGA FALTA, NUNCA MAS ANGOSTA QUE EL BOTON.

    Estaba con `left: 0; right: 0`, o sea exactamente el ancho del
    boton. Con un boton que dice "Todas" las opciones de adentro
    --"Compra", "Canje", "Apertura de caja", "Objeto vendido"-- no
    entraban y las cortaba el `text-overflow` en "Compr...", "Aper...".
    El filtro quedaba inservible: habia que adivinar cual era cual.

    `min-width: 100%` la deja alineada con el boton como antes, y
    `max-content` la estira hasta la opcion mas larga. El tope la
    frena antes del borde de la pantalla en un telefono.
  */
  right: auto;
  min-width: 100%;
  width: max-content;
  max-width: min(84vw, 340px);
  box-sizing: border-box;
  margin: 0;
  padding: 6px;
  list-style: none;
  max-height: 320px;
  overflow-y: auto;
  border-radius: 14px;
  border: 1px solid $borde-fuerte;
  background: $panel;
  box-shadow: 0 18px 40px rgba(2, 6, 14, .55);

  /* Sin barra gris: el diseño no la tiene en ningún lado. */
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}

.mb-el__op {
  border-radius: 10px;

  &.is-marcada { background: $panel-hover; }
  &.is-elegida { background: $azul-activo; }
}
</style>
