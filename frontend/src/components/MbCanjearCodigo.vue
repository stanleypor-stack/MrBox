<template>
  <div class="mb-cod" @click.self="cerrar">
    <div class="mb-cod__caja" role="dialog" aria-modal="true" :aria-label="$t('redeem.title')">
      <button type="button" class="mb-cod__x" :aria-label="$t('action.cancel')" @click="cerrar">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c9d7f7" stroke-width="3"
             stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>

      <div class="mb-cod__texto">
        <h3 class="mb-cod__t">{{ $t('redeem.heading') }}</h3>
        <p class="mb-cod__p">{{ $t('redeem.sub') }}</p>

        <!--
          EL CODIGO, ADENTRO DE SU PROPIO RECUADRO.

          En el celular el rotulo, el campo y el boton quedaban sueltos
          y centrados sobre el panel: tres cosas flotando que no se
          leian como un formulario. El rotulo parecia otro titulo y el
          boton, otro boton mas de la ventana.

          Juntos adentro de un recuadro --mas oscuro, con su borde y
          alineado a la izquierda-- se entiende de una que es un solo
          campo con su boton, que es lo que hace la referencia. En la
          pantalla grande el recuadro no existe: ahi los tres ya se
          leian juntos porque estan en una sola fila.
        -->
        <div class="mb-cod__grupo">
          <label class="mb-cod__rotulo" for="mb-cod-campo">{{ $t('redeem.label') }}</label>
          <form class="mb-cod__fila" @submit.prevent="canjear">
            <input
              id="mb-cod-campo" ref="campo" v-model="codigo" class="mb-cod__campo"
              :class="{ 'is-mal': !!error }" :placeholder="$t('redeem.placeholder')"
              autocomplete="off" maxlength="24" @input="error = ''"
            >
            <button type="submit" class="mb-cod__b" :disabled="!codigo.trim() || yendo">
              {{ yendo ? $t('common.loading') : $t('wallet.redeem') }}
            </button>
          </form>
        </div>

        <p v-if="error" class="mb-cod__aviso">{{ error }}</p>

        <!--
          EL PREMIO, CUANDO ENTRO.

          No un cartelito que se va solo: lo que gano se queda a la
          vista hasta que cierre. Un codigo se canjea una vez y merece
          verse.
        -->
        <div v-else-if="premio" class="mb-cod__premio">
          <span class="mb-cod__cifra">
            <span v-if="premio.conMoneda" class="mb-sc mb-sc--26" aria-hidden="true">SC</span>{{ premio.cifra }}
          </span>
          <span class="mb-cod__que"><b>{{ premio.titulo }}</b><br>{{ premio.detalle }}</span>
        </div>
      </div>

      <!--
        EL COFRE.

        El del arte de las carreras, recortado y al doble de tamaño
        (public/img/cofre.webp). Se sale del recuadro a proposito, como
        en la referencia: por eso la caja no recorta lo que sobresale.
      -->
      <img class="mb-cod__cofre" src="/img/cofre.webp" alt="" aria-hidden="true">
    </div>
  </div>
</template>

<script>
import api from "@/api";

/**
 * CANJEAR UN CODIGO.
 *
 * "Redeem" es esto: cambiar un codigo por saldo, por aperturas gratis o
 * por un empujon al proximo deposito. Para sacar plata esta "Withdraw",
 * que es otra ventana y otra cosa.
 *
 * Antes el boton Redeem de la billetera abria el RETIRO, que es
 * justamente lo contrario de lo que dice la palabra.
 *
 * EL MISMO CAMPO ACEPTA LOS DOS TIPOS
 *
 * El de una promocion y el de un afiliado. El jugador escribe "un
 * codigo": no tiene por que saber cual es el suyo, eso lo averigua el
 * servidor (ver backend/routes/wallet, POST /code).
 */
export default {
  name: "MbCanjearCodigo",

  data() {
    return {
      codigo: "",
      yendo: false,
      error: "",
      premio: null,
    };
  },

  mounted() {
    window.addEventListener("keydown", this.tecla);
    this.$nextTick(() => this.$refs.campo && this.$refs.campo.focus());
  },

  beforeDestroy() {
    window.removeEventListener("keydown", this.tecla);
  },

  methods: {
    tecla(e) { if (e.key === "Escape") this.cerrar(); },
    cerrar() { this.$emit("cerrar"); },

    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },

    async canjear() {
      const texto = this.codigo.trim();
      if (!texto || this.yendo) return;

      this.yendo = true;
      this.error = "";

      try {
        const { data } = await api.post("/wallet/code", { code: texto });
        const d = data.data;
        this.codigo = "";

        if (d.tipo === "promo") {
          /* El saldo de arriba cambia en el momento: lo acaba de ganar. */
          this.$store.commit("saldo", d);

          this.premio = d.tipoPromo === "aperturas"
            ? {
              conMoneda: false,
              cifra: String(d.aperturas),
              titulo: this.$t("redeem.wonOpens"),
              detalle: this.$t("redeem.wonOpensSub"),
            }
            : {
              conMoneda: true,
              cifra: this.plata(d.montoSc),
              titulo: this.$t("redeem.wonBalance"),
              detalle: this.$t("redeem.wonBalanceSub"),
            };
        } else {
          this.premio = {
            conMoneda: false,
            cifra: `${d.bonoPct}%`,
            titulo: this.$t("redeem.wonBonus"),
            detalle: this.$t("redeem.wonBonusSub", { code: d.code }),
          };
        }
      } catch (err) {
        this.premio = null;
        this.error = err.textoParaElJugador;
      } finally {
        this.yendo = false;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-cod {
  position: fixed;
  inset: 0;
  z-index: 70;
  background: rgba(4, 10, 20, .72);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  overflow-y: auto;
}

/*
  LA VENTANA.

  Ancha y baja, con el filo blanco: el texto a la izquierda y el cofre
  a la derecha, saliendose del recuadro. Nada de `overflow: hidden`,
  que es justo lo que recortaria el cofre.
*/
.mb-cod__caja {
  position: relative;
  width: 100%;
  max-width: 780px;
  padding: 30px 300px 32px 34px;
  border-radius: 22px;
  border: 2px solid #fff;
  background: $panel;
  box-shadow: 0 24px 60px rgba(0, 0, 0, .55);

  @include en-celular {
    padding: 190px 16px 22px;
    text-align: center;
  }
}

.mb-cod__x {
  position: absolute;
  /* Por encima del cofre, que le pasa justo por abajo. */
  z-index: 2;
  top: 14px;
  right: 14px;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  border: 0;
  background: $panel-alto;
  cursor: pointer;
  display: grid;
  place-items: center;
  @include foco;
}

.mb-cod__texto { display: flex; flex-direction: column; }

.mb-cod__t {
  margin: 0 0 8px;
  font-weight: 900;
  font-size: 30px;
  line-height: 1.12;
  letter-spacing: -.01em;

  @include en-celular { font-size: 24px; }
}

.mb-cod__p { margin: 0 0 20px; color: $texto-3; font-size: 14.5px; line-height: 1.45; }

/*
  El recuadro del codigo. Solo en el celular: ver el comentario del
  template. Mas oscuro que el panel para que se despegue, y alineado a
  la izquierda aunque el resto de la ventana este centrado --un rotulo
  y su campo se leen de arriba a abajo por el borde izquierdo, no por
  el medio.
*/
.mb-cod__grupo {
  @include en-celular {
    text-align: left;
    padding: 14px 12px 15px;
    border-radius: 16px;
    border: 1px solid #27406b;
    background: rgba(4, 11, 27, .55);
  }
}

.mb-cod__rotulo {
  font-weight: 800;
  font-size: 14px;
  margin-bottom: 9px;

  @include en-celular { display: block; font-size: 13px; margin-bottom: 8px; }
}

.mb-cod__fila {
  display: flex;
  gap: 10px;
  @include en-celular { flex-direction: column; }
}

.mb-cod__campo {
  flex: 1;
  min-width: 0;
  height: 48px;
  border-radius: 12px;
  border: 1px solid #27406b;
  background: $fondo;
  color: #fff;
  font-family: inherit;
  font-size: 15px;
  padding: 0 14px;

  /*
    En el celular, mas alto y con mas aire adentro: es EL campo de la
    ventana y tiene que verse como tal, no como un renglon.

    Y 16px de letra, no 15: por debajo de 16 Safari en iPhone le hace
    zoom a toda la pagina apenas tocas el campo, y despues el que
    escribe queda con la pantalla corrida.
  */
  @include en-celular {
    /*
      `flex: none` ANTES QUE EL ALTO, O EL ALTO NO EXISTE.

      Arriba el campo es `flex: 1` para ocupar lo que le sobra a la
      fila, que al lado del boton esta bien. Pero en el celular la
      fila se apila en columna, y ahi el eje principal pasa a ser el
      vertical: `flex: 1` quiere decir `flex-basis: 0` de ALTO, el
      alto lo reparte el flex y el `height` queda de adorno. Por eso
      el campo venia del alto justo de la letra --25 px-- aunque
      dijera 48, y el boton no, que es `flex: none`.
    */
    flex: none;
    height: 54px;
    font-size: 16px;
    padding: 0 16px;
    border-radius: 13px;
  }

  &::placeholder { color: $placeholder; }
  &:focus { outline: none; border-color: $azul; }
  &.is-mal { border-color: #ff6b75; }
}

.mb-cod__b {
  flex: none;
  min-width: 120px;
  height: 48px;
  padding: 0 24px;
  border-radius: 24px;
  border: 2px solid rgba(255, 255, 255, .55);
  background: linear-gradient(180deg, #4fa2ff 0%, #2f6fe0 100%);
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  font-size: 15px;
  cursor: pointer;
  @include foco;

  /*
    Adentro del recuadro, un rectangulo redondeado y no una pastilla:
    la pastilla al ancho de la pantalla parecia el boton principal de
    la ventana.
  */
  @include en-celular { width: 100%; height: 52px; border-radius: 13px; }

  /*
    Apagado, un azul apagado de verdad y no el mismo boton transparente.
    Con `opacity` el degrade y el borde blanco se veian atras del
    panel y el boton quedaba como roto, no como esperando.
  */
  &:disabled {
    background: #26416f;
    border-color: rgba(255, 255, 255, .18);
    color: rgba(255, 255, 255, .62);
    cursor: not-allowed;
  }
}

/* ── El cofre ───────────────────────────────────────────────────── */

.mb-cod__cofre {
  position: absolute;
  /* Corrido y un pelin abajo: asi la tapa no le pasa por encima a la
     cruz de cerrar, que vive en la misma esquina. */
  right: 10px;
  top: 56%;
  width: 252px;
  height: auto;
  transform: translateY(-50%);
  pointer-events: none;
  filter: drop-shadow(0 12px 24px rgba(0, 0, 0, .45));

  @include en-celular {
    top: -14px;
    right: 50%;
    width: 200px;
    transform: translateX(50%);
  }
}

/* ── Lo que pasa después de canjear ─────────────────────────────── */

.mb-cod__aviso {
  margin: 14px 0 0;
  padding: 11px 13px;
  border-radius: 12px;
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.45;
  background: rgba(255, 107, 117, .12);
  border: 1px solid #ff6b75;
  color: #ffc2c6;
}

.mb-cod__premio {
  margin-top: 14px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(47, 212, 122, .14), rgba(47, 111, 224, .14));
  border: 1px solid #2fd47a;

  @include en-celular { text-align: left; }
}

.mb-cod__cifra {
  font-family: $fuente-cartel;
  font-size: 30px;
  line-height: 1;
  display: flex;
  align-items: center;
  gap: 6px;
}

.mb-cod__que { color: $texto-2; font-size: 13.5px; line-height: 1.45; }
</style>
