<template>
  <div class="mb-cod" @click.self="cerrar">
    <div class="mb-cod__caja" role="dialog" aria-modal="true" :aria-label="$t('redeem.title')">
      <div class="mb-cod__cabeza">
        <span class="mb-cod__cabeza-t">{{ $t('redeem.title') }}</span>
        <button type="button" class="mb-cod__x" :aria-label="$t('action.cancel')" @click="cerrar">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"
               stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>

      <div class="mb-cod__cuerpo">
        <div class="mb-cod__grilla">
          <div class="mb-cod__texto">
            <h3 class="mb-cod__t">{{ $t('redeem.heading') }}</h3>
            <p class="mb-cod__p">{{ $t('redeem.sub') }}</p>

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

            <p v-if="error" class="mb-cod__aviso mb-cod__aviso--mal">{{ error }}</p>

            <!--
              EL PREMIO, CUANDO ENTRO.

              No un cartelito que se va solo: lo que gano se queda a la
              vista hasta que cierre. Un codigo se canjea una vez y
              merece verse.
            -->
            <div v-else-if="premio" class="mb-cod__premio">
              <span class="mb-cod__cifra">
                <span v-if="premio.conMoneda" class="mb-sc mb-sc--26" aria-hidden="true">SC</span>{{ premio.cifra }}
              </span>
              <span class="mb-cod__que"><b>{{ premio.titulo }}</b><br>{{ premio.detalle }}</span>
            </div>
          </div>

          <!-- El cofre. Dibujado, no es un archivo. -->
          <div class="mb-cod__arte" aria-hidden="true">
            <svg viewBox="0 0 160 150" fill="none">
              <defs>
                <linearGradient :id="`${idArte}-tapa`" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#b96bff" /><stop offset="1" stop-color="#7a3ad6" />
                </linearGradient>
                <linearGradient :id="`${idArte}-caja`" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#8e4ae3" /><stop offset="1" stop-color="#5a24a8" />
                </linearGradient>
                <radialGradient :id="`${idArte}-luz`" cx=".5" cy=".4" r=".6">
                  <stop offset="0" stop-color="#ffe08a" stop-opacity=".9" />
                  <stop offset="1" stop-color="#ffe08a" stop-opacity="0" />
                </radialGradient>
              </defs>
              <ellipse cx="80" cy="74" rx="62" ry="46" :fill="`url(#${idArte}-luz)`" />
              <path d="M26 56c0-21 24-34 54-34s54 13 54 34v6H26z" :fill="`url(#${idArte}-tapa)`" />
              <rect x="26" y="62" width="108" height="10" rx="3" fill="#4a1d8f" />
              <rect x="26" y="72" width="108" height="48" rx="8" :fill="`url(#${idArte}-caja)`" />
              <rect x="60" y="56" width="40" height="30" rx="5" fill="#ffd35a" />
              <circle cx="80" cy="71" r="6" fill="#8a5a0a" />
              <g fill="#ffd35a">
                <circle cx="54" cy="84" r="7" /><circle cx="70" cy="90" r="6" />
                <circle cx="92" cy="86" r="7" /><circle cx="106" cy="92" r="5" />
                <circle cx="62" cy="99" r="5" /><circle cx="84" cy="101" r="6" />
              </g>
              <g fill="#fff" opacity=".9">
                <path d="M126 28l2.4 6.4 6.4 2.4-6.4 2.4-2.4 6.4-2.4-6.4-6.4-2.4 6.4-2.4z" />
                <path d="M36 22l1.6 4.2 4.2 1.6-4.2 1.6L36 33.6l-1.6-4.2-4.2-1.6 4.2-1.6z" />
                <circle cx="144" cy="62" r="2.6" /><circle cx="18" cy="48" r="2.2" />
              </g>
            </svg>
          </div>
        </div>

        <ul class="mb-cod__notas">
          <li>{{ $t('redeem.noteBoth') }}</li>
          <li>{{ $t('redeem.noteOnce') }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
import api from "@/api";

let contador = 0;

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
    contador += 1;
    return {
      idArte: `mbCofre${contador}`,
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

.mb-cod__caja {
  width: 100%;
  max-width: 620px;
  background: $panel-alto;
  border: 2px solid #2a4170;
  border-radius: 20px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, .55);
  overflow: hidden;
}

.mb-cod__cabeza {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid #1f3355;
}

.mb-cod__cabeza-t { font-family: $fuente-cartel; font-size: 20px; flex: 1; min-width: 0; }

.mb-cod__x {
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: 50%;
  border: 0;
  background: #16263f;
  cursor: pointer;
  display: grid;
  place-items: center;
  @include foco;
}

.mb-cod__cuerpo { padding: 20px 18px 22px; display: flex; flex-direction: column; gap: 16px; }

.mb-cod__grilla {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 190px;
  gap: 18px;
  align-items: center;

  @include en-celular {
    grid-template-columns: minmax(0, 1fr);
    .mb-cod__arte { order: -1; }
  }
}

.mb-cod__t { font-family: $fuente-cartel; font-size: 26px; line-height: 1.1; margin: 0 0 6px; }
.mb-cod__p { margin: 0 0 16px; color: $texto-3; font-size: 14px; }

.mb-cod__arte { display: flex; justify-content: center; svg { width: 100%; max-width: 190px; height: auto; } }

.mb-cod__rotulo {
  display: block;
  font-weight: 800;
  font-size: 12px;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: $texto-3;
}

.mb-cod__fila {
  display: flex;
  gap: 10px;
  margin-top: 8px;
  @include en-celular { flex-direction: column; }
}

.mb-cod__campo {
  flex: 1;
  min-width: 0;
  height: 50px;
  border-radius: 14px;
  border: 1px solid #2a4170;
  background: $fondo;
  color: #fff;
  font-family: inherit;
  font-size: 15px;
  padding: 0 14px;
  letter-spacing: .04em;
  text-transform: uppercase;

  &::placeholder { color: $placeholder; letter-spacing: 0; text-transform: none; }
  &:focus { outline: none; border-color: $azul; }
  &.is-mal { border-color: #ff6b75; }
}

.mb-cod__b {
  flex: none;
  height: 50px;
  padding: 0 26px;
  border-radius: 25px;
  border: 3px solid #fff;
  background: linear-gradient(180deg, #4fa2ff 0%, #2f6fe0 100%);
  color: #fff;
  font-family: inherit;
  font-weight: 900;
  font-size: 15px;
  cursor: pointer;
  @include foco;
  &:disabled { opacity: .45; cursor: not-allowed; }
}

.mb-cod__aviso {
  margin: 12px 0 0;
  padding: 11px 13px;
  border-radius: 12px;
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.45;

  &--mal { background: rgba(255, 107, 117, .12); border: 1px solid #ff6b75; color: #ffc2c6; }
}

.mb-cod__premio {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(47, 212, 122, .14), rgba(47, 111, 224, .14));
  border: 1px solid #2fd47a;
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

.mb-cod__notas {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  li { color: $texto-3; font-size: 13.5px; }
}
</style>
