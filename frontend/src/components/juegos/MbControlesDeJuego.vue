<template>
  <div class="gx-ctl">
    <div class="gx-mode">
      <button type="button" :class="{ on: !auto }" :disabled="trabado" @click="$emit('auto', false)">
        {{ $t('games.manual') }}
      </button>
      <button type="button" :class="{ on: auto }" :disabled="trabado" @click="$emit('auto', true)">
        {{ $t('games.auto') }}
      </button>
    </div>

    <div :class="['gx-main', { p25: compacto }]">
      <div class="gx-betamt">
        <div class="gx-title">{{ $t('games.playAmount') }}</div>
        <div :class="['gx-amt', { err: !!error }]">
          <input
            type="text" inputmode="decimal" :placeholder="$t('games.amount')"
            :aria-label="$t('games.playAmount')" :value="apuesta"
            :disabled="trabado" @input="escribir" @blur="redondear"
          >
          <span class="mb-sc" style="width: 20px; height: 20px; font-size: 8px" aria-hidden="true">SC</span>
          <div class="gx-hx">
            <button type="button" :disabled="trabado" @click="mitad">&#189;</button>
            <button type="button" :disabled="trabado" @click="doble">2x</button>
          </div>
        </div>
        <p v-if="error" class="gx-errtxt">{{ error }}</p>
      </div>

      <!-- Lo propio de cada juego va en el medio, que es lo único
           que cambia de un juego a otro en esta columna. -->
      <slot></slot>

      <div v-if="auto" class="gx-count">
        <div class="gx-title">{{ $t('games.numberOfPlays') }}</div>
        <div class="gx-countbox">
          <input
            type="text" inputmode="numeric" :aria-label="$t('games.numberOfPlays')"
            :value="cuantas" @input="escribirCuantas"
          >
          <img v-show="!Number(cuantas)" src="/img/juegos/infinito.svg" alt="" style="width: 22px">
        </div>
      </div>

      <div class="gx-bet">
        <button
          type="button" :class="['gx-btn', { red: rojo }]"
          :disabled="sinJugar" @click="$emit('jugar')"
        >
          <span class="edge"></span>
          <span class="front">{{ etiqueta }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * LA COLUMNA DE CONTROLES, LA MISMA PARA LOS OCHO JUEGOS.
 *
 * En el diseño este bloque está dibujado igual en los ocho: las
 * pestañas Manual/Auto, el monto con su ½ y su 2x, la cantidad de
 * jugadas cuando está en automático, y el botón.
 *
 * Está acá una sola vez y no copiado ocho porque, si no, arreglar el
 * redondeo del monto sería arreglarlo ocho veces, y a la séptima ya
 * no serían iguales.
 *
 * Lo propio de cada juego --el objetivo del dice, las minas, el
 * riesgo-- entra por el hueco del medio.
 *
 * EL MONTO NUNCA PASA EL SALDO NI EL TOPE
 *
 * Se acota acá, mientras se escribe. No es seguridad --el servidor lo
 * vuelve a mirar y es el que manda-- es cortesía: que el botón no
 * rebote por algo que la pantalla ya sabía.
 */
export default {
  name: "MbControlesDeJuego",

  model: { prop: "apuesta", event: "apuesta" },

  props: {
    apuesta: { type: String, default: "1.00" },
    auto: { type: Boolean, default: false },
    cuantas: { type: String, default: "0" },
    /** Mientras hay una ronda andando no se puede cambiar nada. */
    trabado: { type: Boolean, default: false },
    sinJugar: { type: Boolean, default: false },
    etiqueta: { type: String, default: "" },
    /** El botón rojo es el de parar. */
    rojo: { type: Boolean, default: false },
    /** `p25` en el diseño: la variante con más aire. */
    compacto: { type: Boolean, default: false },
    error: { type: String, default: "" },
    maximoSc: { type: Number, default: 0 },
    saldoSc: { type: Number, default: 0 },
  },

  methods: {
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },

    /* Solo dígitos y UN punto, con dos decimales como mucho. */
    escribir(e) {
      let v = String(e.target.value).replace(",", ".").replace(/[^\d.]/g, "");
      const i = v.indexOf(".");
      if (i >= 0) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, "").slice(0, 2);
      this.$emit("apuesta", v);
    },

    acotar(n) {
      let x = Math.max(0.01, n);
      if (this.maximoSc > 0) x = Math.min(x, this.maximoSc);
      if (this.saldoSc > 0) x = Math.min(x, this.saldoSc);
      return x;
    },

    redondear() {
      const n = parseFloat(this.apuesta) || 0;
      this.$emit("apuesta", this.plata(n > 0 ? this.acotar(n) : 0));
    },

    mitad() {
      this.$emit("apuesta", this.plata(this.acotar((parseFloat(this.apuesta) || 0) / 2)));
    },

    doble() {
      this.$emit("apuesta", this.plata(this.acotar((parseFloat(this.apuesta) || 0) * 2)));
    },

    escribirCuantas(e) {
      this.$emit("cuantas", String(e.target.value).replace(/[^\d]/g, "").slice(0, 4));
    },
  },
};
</script>
