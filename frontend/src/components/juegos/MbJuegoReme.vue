<template>
  <div class="gx gx-reme">
    <div class="gx-row">
      <MbControlesDeJuego
        v-model="apuesta" :auto="auto" :cuantas="cuantas" :trabado="trabado"
        :sin-jugar="sinJugar" :etiqueta="etiquetaDelBoton" :rojo="quedan > 0"
        :error="error" :maximo-sc="maximoSc" :saldo-sc="saldoSc" compacto
        @auto="auto = $event" @cuantas="cuantas = $event" @jugar="jugar"
      />

      <div class="gx-rgame">
        <div class="gx-rhist">
          <div v-for="(h, i) in historial" :key="i" :class="h.gano ? 'gx-chip w' : 'gx-chip'">
            {{ h.v }}
          </div>
        </div>

        <div class="gx-rscore">
          <div class="gx-rres">
            <span>{{ $t('games.you') }}</span>
            <div :class="claseDe(gano, true)">{{ mio }}</div>
          </div>
          <div class="gx-rres">
            <span>{{ $t('games.house') }}</span>
            <div :class="claseDe(gano, false)">{{ suyo }}</div>
          </div>
        </div>

        <div class="gx-rwheel">
          <div>
            <img class="w" :style="{ transform: `rotate(${vuelta}deg)` }" src="/img/juegos/reme-rueda.webp" alt="">
            <img class="b" src="/img/juegos/reme-base.webp" alt="">
          </div>
        </div>

        <img class="gx-rfloor" src="/img/juegos/reme-piso.png" alt="">
      </div>
    </div>
  </div>
</template>

<script>
import MbControlesDeJuego from "./MbControlesDeJuego.vue";
import jugar from "./jugar";

/**
 * REME.
 *
 * Dos ruedas de 0 a 36. Cada número se reduce a la suma de sus
 * dígitos y de eso vale el último: un 17 es 8. Gana el más alto; el
 * empate pierde, y un 0 del jugador paga 3x.
 *
 * LO QUE SE MUESTRA SON LOS NUMEROS REDUCIDOS
 *
 * El servidor manda los dos: el que salió en la rueda y el reducido.
 * En los cuadrados va el reducido, que es el que decide, porque un
 * jugador que ve "17 contra 9" y pierde no entiende nada hasta que
 * le explican que su 17 vale 8.
 */
export default {
  name: "MbJuegoReme",

  components: { MbControlesDeJuego },

  mixins: [jugar],

  props: {
    maximoSc: { type: Number, default: 0 },
    saldoSc: { type: Number, default: 0 },
  },

  data() {
    return {
      mio: "-",
      suyo: "-",
      gano: null,
      /* La rueda sigue girando para adelante: volver a cero de golpe
         entre tirada y tirada se ve como un salto. */
      vuelta: 0,
    };
  },

  computed: {
    sinJugar() {
      return this.girando || (parseFloat(this.apuesta) || 0) <= 0;
    },
  },

  methods: {
    /** El borde verde o rojo de cada cuadrado, como en el diseño. */
    claseDe(gano, esMio) {
      if (gano === null) return "";
      if (esMio) return gano ? "w" : "l";
      return gano ? "l" : "w";
    },

    jugar() {
      return this.apretar(async () => {
        /* Un giro largo mientras se espera la respuesta. */
        this.vuelta += 720 + Math.floor(Math.random() * 360);
        this.sonar("rueda");

        const d = await this.unaJugada("/games/reme/play", {});
        if (!d) return false;

        this.mio = String(d.jugadorReducido);
        this.suyo = String(d.casaReducido);
        this.gano = d.gano;
        this.anotar({ v: String(d.jugadorReducido), gano: d.gano });
        return true;
      });
    },
  },
};
</script>
