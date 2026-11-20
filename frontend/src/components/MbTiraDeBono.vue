<template>
  <div v-if="bono && bono.disponible && !vencido" class="mb-bono">
    <p class="mb-bono__rotulo">{{ $t('bonus.available') }}</p>

    <div class="mb-bono__tira">
      <img class="mb-bono__arte" src="/img/bono-tickets.webp" alt="" aria-hidden="true">

      <div class="mb-bono__texto">
        <p class="mb-bono__t"><b>{{ pct }}%</b> {{ $t('bonus.headline') }}</p>
        <p class="mb-bono__p">{{ reclamado ? $t('bonus.activeSub') : $t('bonus.sub') }}</p>
      </div>

      <!-- El contador, chico. Marca hasta cuándo está la oferta. -->
      <div class="mb-bono__cuenta" :aria-label="$t('bonus.timeLeft')">
        <div class="mb-bono__u">
          <b>{{ dos(quedan.minutos) }}</b><span>{{ $t('bonus.minutes') }}</span>
        </div>
        <div class="mb-bono__u">
          <b>{{ dos(quedan.segundos) }}</b><span>{{ $t('bonus.seconds') }}</span>
        </div>
      </div>

      <!-- Antes de confirmarlo, el boton; despues, el sello. Se
           sigue pudiendo tocar para volver a leer las condiciones. -->
      <button
        type="button" class="mb-bono__claim"
        :class="{ 'is-activo': reclamado }" @click="abierta = true"
      >
        <svg
          v-if="reclamado" width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="3" stroke-linecap="round"
          stroke-linejoin="round" aria-hidden="true"
        ><path d="M20 6 9 17l-5-5" /></svg>
        {{ reclamado ? $t('bonus.active') : $t('bonus.claim') }}
      </button>
    </div>

    <!-- ── Los detalles ──────────────────────────────────────────── -->
    <div
      v-if="abierta" class="mb-bono__fondo" role="dialog" aria-modal="true"
      :aria-label="$t('bonus.detailsTitle')" @click.self="abierta = false"
    >
      <div class="mb-bono__caja">
        <div class="mb-bono__cab">
          <span class="mb-bono__icono" aria-hidden="true">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff"
                 stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7" />
              <path d="M12 7S9.5 3 7.5 3a2.5 2.5 0 0 0 0 5M12 7s2.5-4 4.5-4a2.5 2.5 0 0 1 0 5" />
            </svg>
          </span>
          <h2 class="mb-bono__titulo">{{ $t('bonus.detailsTitle') }}</h2>
          <button
            type="button" class="mb-bono__cerrar" :aria-label="$t('common.close')"
            @click="abierta = false"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div class="mb-bono__cuerpo">
          <p>{{ $t('bonus.ruleWager', { n: bono.vecesAJugar }) }}</p>
          <p>{{ $t('bonus.ruleAmount', { pct: pct, max: 'SC ' + plata(bono.topeSc) }) }}</p>
          <p>{{ $t('bonus.ruleWindow', { n: bono.minutos }) }}</p>
          <p>{{ $t('bonus.ruleFirst') }}</p>
        </div>

        <div class="mb-bono__pie">
          <button type="button" class="mb-bono__b mb-bono__b--gris" @click="abierta = false">
            {{ $t('common.cancel') }}
          </button>
          <button type="button" class="mb-bono__b mb-bono__b--azul" @click="confirmar">
            {{ $t('common.confirm') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * LA TIRA DEL BONO DE BIENVENIDA, CON SUS DETALLES.
 *
 * Copiada de mrloot: el arte a la izquierda, el porcentaje al medio, el
 * tiempo que queda y el botón. Los números salen del servidor
 * (`/wallet/coins`), no del código: cambiar el 50%, el piso de $50 o
 * los 30 minutos en el panel cambia esto sin tocar una línea.
 *
 * EL RELOJ NO ES DECORACION
 *
 * Cuenta una ventana de verdad, que arranca cuando se abrió la cuenta y
 * que el SERVIDOR tambien respeta: pasada esa hora el bono no se
 * acredita. Un contador que llega a cero y no pasa nada es mentirle al
 * jugador, y encima entrena a no creerle al resto de la pantalla.
 *
 * Por eso tambien desaparece sola cuando llega a cero, sin esperar a
 * que el servidor conteste: lo que se ve y lo que pasa tienen que ser
 * lo mismo.
 */
export default {
  name: "MbTiraDeBono",

  props: {
    /** Lo que devuelve `/wallet/coins` en `bonoDeBienvenida`. */
    bono: { type: Object, default: null },
    /** Cuándo se creó la cuenta: de ahí arranca la ventana. */
    desde: { type: [String, Date], default: null },
  },

  data() {
    return {
      abierta: false,
      /* Si ya toco Confirmar. Es un acuse de recibo de esta pantalla,
         no el estado del bono: eso lo dice el servidor. */
      reclamado: false,
      ahora: Date.now(),
      reloj: null,
    };
  },

  computed: {
    pct() {
      return Math.round((this.bono && this.bono.pct ? this.bono.pct : 0) * 100);
    },

    /** Cuántos minutos dura la oferta. Lo dice el panel. */
    minutos() {
      const n = Number(this.bono && this.bono.minutos);
      return Number.isFinite(n) && n > 0 ? n : 30;
    },

    fin() {
      const arranque = this.desde ? new Date(this.desde).getTime() : Date.now();
      return arranque + this.minutos * 60 * 1000;
    },

    falta() { return Math.max(0, this.fin - this.ahora); },

    vencido() { return this.falta <= 0; },

    quedan() {
      const seg = Math.floor(this.falta / 1000);
      return { minutos: Math.floor(seg / 60), segundos: seg % 60 };
    },
  },

  methods: {
    dos(n) { return String(n).padStart(2, "0"); },

    plata(n) {
      return Number(n || 0).toLocaleString("es-AR", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },

    /**
     * CONFIRMAR DEJA LA TIRA MARCADA.
     *
     * No hay nada que pedirle al servidor: el bono entra solo con el
     * primer depósito. Pero cerrar la ventana sin que cambie nada es
     * lo mismo que cancelar, y el jugador se queda sin saber si quedó
     * algo hecho.
     */
    confirmar() {
      this.reclamado = true;
      this.recordar();
      this.abierta = false;
      this.$emit("depositar");
    },

    /* La llave lleva el id del jugador: en una computadora compartida,
       lo que confirmó uno no es lo que confirmó el otro. */
    llave() {
      const u = this.$store.state.usuario;
      return u && u._id ? `mrbox:bono:${u._id}` : null;
    },

    recordar() {
      const k = this.llave();
      if (!k) return;
      try { window.localStorage.setItem(k, "1"); } catch { /* navegación privada */ }
    },

    recordado() {
      const k = this.llave();
      if (!k) return false;
      try { return window.localStorage.getItem(k) === "1"; } catch { return false; }
    },
  },

  created() {
    this.reclamado = this.recordado();

    /* Cada segundo, porque ahora se muestran segundos. Es un contador
       en pantalla, no un pedido a la red: no cuesta nada. */
    this.reloj = window.setInterval(() => { this.ahora = Date.now(); }, 1000);
  },

  beforeDestroy() { window.clearInterval(this.reloj); },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-bono { margin-bottom: 14px; }

.mb-bono__rotulo {
  margin: 0 0 9px;
  font-size: 13px;
  font-weight: 800;
  color: $texto-2;
}

.mb-bono__tira {
  display: flex;
  align-items: center;
  gap: 14px;
  border: 1px solid $borde;
  border-radius: 14px;
  background:
    radial-gradient(ellipse 36% 180% at 9% 50%, rgba(255, 200, 61, .13) 0%, rgba(14, 26, 46, 0) 72%),
    linear-gradient(90deg, #101c32 0%, $panel 55%);
  padding: 13px 14px;
  overflow: hidden;
}

.mb-bono__arte {
  flex: none;
  width: 104px;
  height: auto;
  // Sobresale un poco, como en el diseño: los tickets se salen del
  // borde de arriba en vez de quedar encajonados.
  margin: -10px 0;
  filter: drop-shadow(0 6px 12px rgba(0, 0, 0, .45));
}

.mb-bono__texto { flex: 1 1 auto; min-width: 0; }

.mb-bono__t {
  margin: 0;
  font-size: 17px;
  font-weight: 900;
  line-height: 1.15;

  b { color: $amarillo; font-weight: 900; }
}

.mb-bono__p {
  margin: 3px 0 0;
  font-size: 12.5px;
  color: $texto-4;
}

// El contador: chico, que no le gane al porcentaje.
.mb-bono__cuenta {
  flex: none;
  display: flex;
  gap: 1px;
  background: $borde;
  border-radius: 9px;
  overflow: hidden;
}

.mb-bono__u {
  background: #0a1020;
  padding: 5px 9px;
  text-align: center;
  min-width: 44px;

  b {
    display: block;
    font-size: 14px;
    font-weight: 900;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
  }

  span {
    display: block;
    font-size: 9px;
    font-weight: 700;
    color: $texto-4;
    margin-top: 1px;
  }
}

.mb-bono__claim {
  flex: none;
  font: inherit;
  font-weight: 900;
  font-size: 13.5px;
  color: #3a2a00;
  background: linear-gradient(180deg, $amarillo, $amarillo-v);
  border: none;
  border-radius: 9px;
  padding: 10px 19px;
  cursor: pointer;

  &:hover { filter: brightness(1.07); }

  /* Confirmado: deja de ser un boton que pide algo y pasa a ser un
     sello de que ya esta. Se sigue pudiendo tocar para releer. */
  &.is-activo {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #0b2b16;
    background: linear-gradient(180deg, $verde, #37d98c);
  }
}

// ── La ventana ──────────────────────────────────────────────────
.mb-bono__fondo {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(5, 10, 20, .72);
}

.mb-bono__caja {
  width: min(430px, 100%);
  border: 1px solid $borde-fuerte;
  border-radius: 16px;
  background: $panel;
  box-shadow: 0 24px 60px rgba(0, 0, 0, .55);
  overflow: hidden;
}

.mb-bono__cab {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 16px 16px 14px;
}

.mb-bono__icono {
  flex: none;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: linear-gradient(180deg, $azul, $azul-hondo);
}

.mb-bono__titulo {
  flex: 1 1 auto;
  margin: 0;
  font-size: 17px;
  font-weight: 900;
}

.mb-bono__cerrar {
  flex: none;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  border: 1px solid $borde;
  background: $panel-alto;
  color: $texto-3;
  cursor: pointer;

  &:hover { background: $panel-hover; color: $texto; }
}

.mb-bono__cuerpo {
  border-top: 1px solid $borde;
  padding: 18px 18px 6px;

  p {
    margin: 0 0 11px;
    font-size: 14px;
    line-height: 1.5;
    color: $texto-3;
  }
}

.mb-bono__pie {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 12px 18px 18px;
}

.mb-bono__b {
  font: inherit;
  font-weight: 800;
  font-size: 14.5px;
  border-radius: 11px;
  padding: 12px 10px;
  cursor: pointer;

  &--gris {
    background: $panel-alto;
    border: 1px solid $borde-fuerte;
    color: $texto-2;

    &:hover { background: $panel-hover; color: $texto; }
  }

  &--azul {
    background: linear-gradient(180deg, $azul, $azul-hondo);
    border: 1px solid $azul;
    color: #fff;

    &:hover { filter: brightness(1.08); }
  }
}

// ── Teléfono ────────────────────────────────────────────────────
@media (max-width: 760px) {
  .mb-bono__tira { flex-wrap: wrap; gap: 11px; padding: 12px; }
  .mb-bono__arte { width: 76px; margin: -8px 0; }
  .mb-bono__texto { flex: 1 1 130px; }
  .mb-bono__t { font-size: 15.5px; }
  .mb-bono__cuenta { order: 3; }
  .mb-bono__claim { order: 4; flex: 1 1 auto; }
}
</style>
