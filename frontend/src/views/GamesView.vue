<template>
  <div class="gx-wrap">
    <template v-if="elJuego">
      <!-- El juego elegido. Cada uno trae su tablero y sus controles. -->
      <MbJuegoDice
        v-if="elJuego.id === 'dice'"
        :maximo-sc="maximoSc" :saldo-sc="saldo"
      />

      <MbJuegoReme
        v-else-if="elJuego.id === 'reme'"
        :maximo-sc="maximoSc" :saldo-sc="saldo"
      />

      <MbJuegoKeno
        v-else-if="elJuego.id === 'keno'"
        :maximo-sc="maximoSc" :saldo-sc="saldo" :margen="margenDe('keno')"
      />

      <MbJuegoPlinko
        v-else-if="elJuego.id === 'plinko'"
        :maximo-sc="maximoSc" :saldo-sc="saldo" :margen="margenDe('plinko')"
      />

      <!--
        LOS QUE TODAVIA NO ESTAN.

        Se dice, no se esconde. Una tarjeta que lleva a una pantalla
        en blanco es peor que una que avisa: el que entra se queda
        pensando que algo se rompió.
      -->
      <div v-else class="gx gx-dice">
        <div class="gx-pronto">
          <img :src="elJuego.icono" alt="" width="54" height="54">
          <b>{{ elJuego.nombre }}</b>
          <span>{{ $t('games.soon') }}</span>
        </div>
      </div>

      <!-- ── El pie, igual para los ocho ─────────────────────── -->
      <div class="gx">
        <div class="gx-foot">
          <div class="gx-fhead">
            <div class="gx-fname">
              <span class="gx-ficon"><img :src="elJuego.icono" alt=""></span>
              <div>
                <b>{{ elJuego.nombre }}</b>
                <small>MR BOX Originals</small>
              </div>
            </div>

            <!--
              LOS DOS DATOS DEL DISEÑO, CON LOS NUMEROS DE VERDAD.

              El diseño muestra "Max play" y "Max win" y los tiene
              escritos a mano, que es lo que corresponde a un
              prototipo. Acá los trae el servidor: son los mismos
              números que hace cumplir al pagar, así que la etiqueta
              no puede mentir.
            -->
            <div class="gx-fchips">
              <span>{{ $t('games.maxPlay') }}<em>{{ plata(maximoSc) }}</em></span>
              <span>{{ $t('games.maxWin') }}<em>{{ plata(maximoPremioSc) }}</em></span>
            </div>

            <div class="gx-sqbtns">
              <button
                type="button" class="gx-sqbtn" :aria-label="$t('games.provablyFair')"
                @click="avisarDelSorteo"
              >
                <img src="/img/juegos/fair.svg" alt="">
              </button>
              <button
                type="button" class="gx-sqbtn" :aria-label="$t('games.sound')"
                @click="sonido = !sonido"
              >
                <img :src="sonido ? '/img/juegos/volumen.svg' : '/img/juegos/mute.png'" alt="">
              </button>
            </div>
          </div>

          <div class="gx-ftitle">{{ $t('games.moreGames') }}</div>
          <div class="gx-sugg">
            <button
              v-for="g in otros" :key="g.id" type="button" class="gx-scard"
              @click="ir(g.id)"
            >
              <span class="ic"><img :src="g.icono" alt=""></span>
              <span class="nm">{{ g.nombre }}</span>
            </button>
          </div>
        </div>
      </div>
    </template>

    <p v-else class="mb-tenue" style="padding: 24px">{{ $t('common.loading') }}</p>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import api from "@/api";
import { JUEGOS } from "@/juegos";
import MbJuegoDice from "@/components/juegos/MbJuegoDice.vue";
import MbJuegoReme from "@/components/juegos/MbJuegoReme.vue";
import MbJuegoKeno from "@/components/juegos/MbJuegoKeno.vue";
import MbJuegoPlinko from "@/components/juegos/MbJuegoPlinko.vue";

/**
 * LA PANTALLA DE LOS JUEGOS.
 *
 * Una sola, con el juego elegido adentro. Cuál está elegido lo dice la
 * dirección --`/games/dice`-- y no un estado escondido: así se puede
 * compartir el enlace de un juego, el botón de atrás funciona y la
 * barra lateral puede marcar cuál está abierto.
 *
 * EL MARCO ES EL MISMO PARA LOS OCHO
 *
 * El pie --nombre, retorno, tope, sorteo verificable y "más juegos"--
 * vive acá y no adentro de cada juego, que es como lo dibuja el
 * diseño. Cada juego pone su tablero y sus controles, nada más.
 */
export default {
  name: "GamesView",

  components: { MbJuegoDice, MbJuegoReme, MbJuegoKeno, MbJuegoPlinko },

  data() {
    return {
      sonido: true,
      maximoSc: 0,
      maximoPremioSc: 0,
      minimoSc: 0.1,
      rtp: {},
      apagados: false,
    };
  },

  computed: {
    ...mapGetters(["saldo"]),

    juegos() {
      return JUEGOS.map((g) => ({ ...g, rtp: this.rtp[g.id] || 0 }));
    },

    elJuego() {
      const id = this.$route.params.juego || "dice";
      return this.juegos.find((g) => g.id === id) || this.juegos[0];
    },

    /* Los otros siete, para la fila de abajo. */
    otros() {
      return this.juegos.filter((g) => g.id !== this.elJuego.id);
    },
  },

  created() { this.traer(); },

  methods: {
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },

    async traer() {
      try {
        const { data } = await api.get("/games");
        const d = data.data;
        this.apagados = d.apagados;
        this.maximoSc = d.apuestaMaximaSc;
        this.maximoPremioSc = d.maximoPremioSc;
        this.minimoSc = d.apuestaMinimaSc;
        /* El retorno sale del servidor, que es el que paga: la pantalla
           no tiene por qué saberlo de memoria. */
        this.rtp = Object.fromEntries(d.juegos.map((g) => [g.id, g.rtp]));
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    /* El margen que publica el servidor, para que las tablas que
       dibuja cada juego digan lo que de verdad se paga. */
    margenDe(id) {
      return 100 - (this.rtp[id] || 94);
    },

    ir(id) {
      if (id === this.elJuego.id) return;
      this.$router.push(`/games/${id}`);
    },

    avisarDelSorteo() {
      this.$store.dispatch("avisar", { texto: this.$t("games.fairHelp") });
    },
  },
};
</script>

<style lang="scss">
/*
  SIN `scoped`, A PROPOSITO.

  El estilo viene calcado del diseño y usa selectores de descendencia
  --`.gx button`, `.gx-row > div`-- que `scoped` rompe: Vue solo le
  pone el atributo al elemento de arriba de cada componente, así que
  lo que dibuja el hijo se quedaría sin estilo. Todo cuelga de `.gx`,
  que no se usa en ningún otro lado del sitio.
*/
@import "@/styles/juegos";

/* Lo único que no está en el diseño: el cartel de los que faltan. */
.gx-pronto {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 60px 20px;
  background: var(--deep);
  border-radius: 14px;
  text-align: center;

  b { font-size: 20px; }
  span { color: var(--txt2); font-size: 14px; }
  img { opacity: .8; }
}
</style>
