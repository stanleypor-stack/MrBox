import api from "@/api";

/**
 * LO QUE HACEN IGUAL LOS OCHO JUEGOS EN LA PANTALLA.
 *
 * Pedir la jugada, mover el saldo de arriba, guardar el historial,
 * mostrar el error y, en automático, seguir solo hasta que se acabe
 * la cuenta o el jugador lo pare.
 *
 * Cada juego pone dos cosas: a qué ruta le pega y qué hace con lo que
 * vuelve. Todo lo demás es esto.
 *
 * EL AUTOMATICO PARA SOLO CUANDO ALGO FALLA
 *
 * Si una jugada rebota --se quedó sin saldo, el sitio cerró los
 * juegos-- el automático se corta ahí. Seguir intentando y fallando
 * no es una comodidad, es un cartel de error repetido.
 */
export default {
  data() {
    return {
      apuesta: "1.00",
      auto: false,
      cuantas: "0",
      girando: false,
      error: "",
      historial: [],
      quedan: 0,
    };
  },

  computed: {
    /** Mientras algo está andando no se toca el monto ni el modo. */
    trabado() {
      return this.girando || this.quedan > 0;
    },

    etiquetaDelBoton() {
      if (this.quedan > 0) return this.$t("games.stop");
      if (this.girando) return this.$t("common.loading");
      return this.auto ? this.$t("games.startAuto") : this.$t("games.play");
    },
  },

  beforeDestroy() {
    /* Si se va de la pantalla, el automático se termina: no puede
       quedar una tanda jugando sola en una pantalla que no se ve. */
    this.quedan = 0;
  },

  methods: {
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },

    /** Una jugada. `cuerpo()` y `alVolver()` los pone cada juego. */
    async unaJugada(ruta, cuerpo) {
      this.girando = true;
      this.error = "";
      try {
        const { data } = await api.post(ruta, {
          apuestaSc: parseFloat(this.apuesta) || 0,
          ...cuerpo,
        });
        this.$store.commit("saldo", data.data);
        return data.data;
      } catch (err) {
        this.error = err.textoParaElJugador || "";
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
        return null;
      } finally {
        this.girando = false;
      }
    },

    /** Guarda una ficha en el historial, que son diez como en el diseño. */
    anotar(ficha) {
      this.historial.unshift(ficha);
      this.historial = this.historial.slice(0, 10);
    },

    /**
     * EL BOTON.
     *
     * Si está parando, para. Si no, juega una y --en automático--
     * sigue hasta que se acabe la cuenta, falle algo o lo paren.
     */
    async apretar(unaVez) {
      if (this.quedan > 0) { this.quedan = 0; return; }

      if (!this.auto) { await unaVez(); return; }

      const n = parseInt(this.cuantas, 10) || 0;
      /* Cero es "hasta que lo pare", que es lo que dibuja el infinito. */
      this.quedan = n > 0 ? n : Infinity;

      while (this.quedan > 0) {
        const sigue = await unaVez();
        this.quedan -= 1;
        if (!sigue || this.quedan <= 0) break;
        await new Promise((r) => setTimeout(r, 420));
      }
      this.quedan = 0;
    },
  },
};
