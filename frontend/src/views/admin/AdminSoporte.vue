<template>
  <div class="ads">
    <!-- ── Título y filtros ─────────────────────────────────────── -->
    <div class="ads__cabeza">
      <div class="ads__quien">
        <h1>{{ $t('admin.nav.support') }}</h1>
        <span class="ads__que">{{ $t('admin.what.support') }}</span>
      </div>

      <label class="ad-campo">
        {{ $t('admin.filter.estado') }}
        <MbElegir v-model="estado" :opciones="estados" chico class="ad-elegir" @elegida="traer()" />
      </label>
    </div>

    <div class="ad-nums">
      <div class="ad-num">
        <span>{{ $t('admin.num.waitingOnUs') }}</span>
        <b :class="esperando ? 'ad-amarillo' : 'ad-verde'">{{ num(esperando) }}</b>
      </div>
      <div class="ad-num"><span>{{ $t('admin.thread.waiting_player') }}</span><b>{{ num(n.esperandoAlJugador) }}</b></div>
      <div class="ad-num">
        <span>{{ $t('admin.num.unassigned') }}</span>
        <b :class="n.sinDueno ? 'ad-amarillo' : ''">{{ num(n.sinDueno) }}</b>
      </div>
      <div class="ad-num"><span>{{ $t('admin.num.closedToday') }}</span><b>{{ num(n.cerradasHoy) }}</b></div>
      <div class="ad-num">
        <span>{{ $t('admin.num.firstReply') }}</span>
        <b>{{ n.primeraRespuestaMin === null ? '—' : espera(n.primeraRespuestaMin) }}</b>
        <em>{{ $t('admin.num.firstReplyHelp') }}</em>
      </div>
      <div class="ad-num"><span>{{ $t('admin.thread.closed') }}</span><b>{{ num(n.cerradas) }}</b></div>
    </div>

    <!-- ── La bandeja y la conversación ─────────────────────────── -->
    <div class="ads__dos">
      <section class="ads__lista">
        <button
          v-for="h in hilos" :key="h._id" type="button" class="ads__hilo"
          :class="{ 'is-elegido': elegido && elegido._id === h._id }"
          @click="abrir(h._id)"
        >
          <span class="ads__hilo-a">
            <span class="ads__hilo-quien">
              <span v-if="h.sinLeer" class="ads__punto" aria-hidden="true"></span>
              {{ h.username }}
            </span>
            <span class="ad-tenue">{{ fecha(h.ultimoMensajeEl) }}</span>
          </span>
          <span class="ads__hilo-t">{{ h.asunto }}</span>
          <span class="ads__hilo-b">
            <span class="ad-estado" :class="tono(h.estado)">{{ $t('admin.thread.' + h.estado) }}</span>
            <span v-if="h.asignadoA" class="ad-tenue">{{ h.asignadoA }}</span>
          </span>
        </button>

        <p v-if="!hilos.length" class="ad-t__vacio">{{ $t('admin.empty') }}</p>
      </section>

      <section v-if="elegido" class="ads__chat">
        <header class="ads__chat-cabeza">
          <div class="ads__chat-quien">
            <router-link :to="`/admin/players/${elegido.jugador._id}`" class="ads__link">
              {{ elegido.jugador.username }}
            </router-link>
            <span class="ad-tenue">
              {{ elegido.jugador.email }}
              · {{ $t('admin.wagered') }} SC {{ plata(elegido.jugador.jugadoSc) }}
              · {{ $t('admin.player.level', { n: elegido.jugador.verificationLevel }) }}
            </span>
          </div>

          <span class="ad-estado" :class="tono(elegido.estado)">{{ $t('admin.thread.' + elegido.estado) }}</span>
        </header>

        <div ref="hilo" class="ads__msgs">
          <div v-for="m in elegido.mensajes" :key="m._id" class="ads__msg" :class="{ 'is-nuestro': m.deAdmin }">
            <span class="ads__msg-quien">
              {{ m.deAdmin ? (m.nombre || $t('admin.auto')) : elegido.jugador.username }}
              <span class="ad-tenue">{{ fechaHora(m.createdAt) }}</span>
            </span>
            {{ m.codigo === 'SUPPORT_AUTO_REPLY' ? $t('support.autoReply') : m.texto }}
          </div>
        </div>

        <!-- Las respuestas guardadas, que se pegan en el cuadro -->
        <div v-if="guardadas.length" class="ads__guardadas">
          <button
            v-for="r in guardadas" :key="r.titulo" type="button" class="ads__guardada"
            @click="borrador = r.texto"
          >{{ r.titulo }}</button>
        </div>

        <form class="ads__escribir" @submit.prevent="responder(false)">
          <textarea
            v-model="borrador" rows="3" class="ad-in ads__texto"
            :placeholder="$t('admin.writeReply')" :aria-label="$t('admin.writeReply')"
          ></textarea>

          <div class="ads__botones">
            <button type="submit" class="ad-b" :disabled="!borrador.trim() || ocupado">
              {{ $t('admin.act.send') }}
            </button>
            <button type="button" class="ad-b ad-b--suave" :disabled="!borrador.trim() || ocupado" @click="responder(true)">
              {{ $t('admin.act.replyAndClose') }}
            </button>
            <span class="ad-crece"></span>
            <button
              v-if="elegido.estado !== 'closed'" type="button" class="ad-b ad-b--mal"
              :disabled="ocupado" @click="mover('closed')"
            >{{ $t('admin.act.close') }}</button>
            <button v-else type="button" class="ad-b ad-b--suave" :disabled="ocupado" @click="mover('waiting_us')">
              {{ $t('admin.act.reopen') }}
            </button>
          </div>
        </form>
      </section>

      <section v-else class="ads__chat ads__chat--vacio">
        <p class="ad-tenue">{{ $t('admin.pickThread') }}</p>
      </section>

      <!--
        ── Quién es el que escribió ──────────────────────────────

        Al lado de la conversación, porque casi todo lo que se
        pregunta en soporte se contesta mirando esto. Sin esta
        columna hay que abrir la ficha en otra pestaña, leerla y
        volver, por cada conversación.
      -->
      <aside v-if="elegido && j" class="ads__ficha">
        <div class="ads__ficha-quien">
          <span class="ads__avatar">{{ (j.username || '?').charAt(0).toUpperCase() }}</span>
          <span class="ads__ficha-nombre">
            <router-link :to="`/admin/players/${j._id}`" class="ads__link">{{ j.username }}</router-link>
            <span class="ad-tenue">{{ j.email }}</span>
          </span>
        </div>

        <div class="ads__chapas">
          <span class="ads__chapa" :style="{ color: j.rangoColor }">{{ j.rango }}</span>
          <span class="ads__chapa">{{ $t('admin.player.level', { n: j.verificationLevel }) }}</span>
          <span v-if="j.banned" class="ad-estado is-mal">{{ $t('admin.state.banned') }}</span>
        </div>

        <dl class="ads__datos">
          <div><dt>{{ $t('admin.balance') }}</dt><dd>SC {{ plata(j.balanceSc) }}</dd></div>
          <div><dt>{{ $t('admin.wagered') }}</dt><dd>SC {{ plata(j.jugadoSc) }}</dd></div>
          <div><dt>{{ $t('admin.player.bought') }}</dt><dd>SC {{ plata(j.compradoSc) }}</dd></div>
          <div><dt>{{ $t('admin.player.redeemed') }}</dt><dd>SC {{ plata(j.canjeadoSc) }}</dd></div>
          <div><dt>{{ $t('admin.player.openRedemptions') }}</dt><dd :class="j.canjesAbiertos ? 'ad-amarillo' : ''">{{ num(j.canjesAbiertos) }}</dd></div>
          <div><dt>{{ $t('admin.player.orders') }}</dt><dd>{{ num(j.pedidosAbiertos) }}</dd></div>
          <div><dt>{{ $t('admin.player.freeLeft') }}</dt><dd>{{ num(j.freeOpens) }}</dd></div>
          <div><dt>{{ $t('admin.col.createdAt') }}</dt><dd>{{ fecha(j.createdAt) }}</dd></div>
        </dl>

        <!-- Si alguien le puso una traba, se dice ACA: es la mitad de
             los "por qué no puedo retirar" que entran por soporte. -->
        <div v-if="trabas.length" class="ads__trabas">
          <span class="ads__ficha-t">{{ $t('admin.player.locks') }}</span>
          <span v-for="k in trabas" :key="k" class="ad-estado is-mal">{{ $t('admin.player.lock.' + k) }}</span>
          <span v-if="j.trabas.motivo" class="ad-tenue">{{ j.trabas.motivo }}</span>
        </div>

        <div v-if="j.notaInterna" class="ads__nota">
          <span class="ads__ficha-t">{{ $t('admin.player.note') }}</span>
          <p>{{ j.notaInterna }}</p>
        </div>

        <div v-if="(j.ultimos || []).length" class="ads__ultimos">
          <span class="ads__ficha-t">{{ $t('admin.player.tab.movimientos') }}</span>
          <span v-for="m in j.ultimos" :key="m._id" class="ads__mov">
            <span class="ad-tenue">{{ fecha(m.createdAt) }}</span>
            <span>{{ $t('txType.' + m.type) }}</span>
            <b :class="m.amountSc >= 0 ? 'ad-verde' : 'ad-rojo'">
              {{ m.amountSc >= 0 ? '+' : '' }}{{ plata(m.amountSc) }}
            </b>
          </span>
        </div>

        <router-link :to="`/admin/players/${j._id}`" class="ad-b ad-b--suave">
          {{ $t('admin.openPlayer') }}
        </router-link>
      </aside>
    </div>
  </div>
</template>

<script>
import MbElegir from "@/components/MbElegir.vue";
import api from "@/api";

/**
 * LA BANDEJA DE SOPORTE.
 *
 * La lista a la izquierda y la conversación a la derecha, como la ficha
 * de un jugador del diseño. Lo que espera respuesta va primero porque
 * la bandeja está ordenada por lo último que pasó y el estado lo mueve
 * quien escribe: nadie tiene que marcar nada a mano.
 *
 * LAS RESPUESTAS GUARDADAS SE PEGAN, NO SE MANDAN
 *
 * Tocar una pone el texto en el cuadro. Nunca lo manda sola: la mitad
 * de las veces hay que cambiarle una fecha o un nombre, y una respuesta
 * guardada mandada tal cual a la persona equivocada es peor que no
 * contestar.
 */
export default {
  name: "AdminSoporte",

  components: { MbElegir },

  data() {
    return {
      hilos: [],
      elegido: null,
      guardadas: [],
      borrador: "",
      estado: "",
      esperando: 0,
      porEstado: {},
      n: { esperandoNos: 0, esperandoAlJugador: 0, cerradas: 0, sinDueno: 0, cerradasHoy: 0, primeraRespuestaMin: null },
      ocupado: false,
      reloj: null,
    };
  },

  computed: {
    /* El que escribió, con todo lo suyo al lado del chat. */
    j() { return this.elegido && this.elegido.jugador ? this.elegido.jugador : null; },

    /* Qué trabas tiene puestas, para decirlo antes de que pregunte. */
    trabas() {
      const t = (this.j && this.j.trabas) || {};
      return ["canje", "envio", "promos", "carreras"].filter((k) => t[k]);
    },

    estados() {
      return [{ valor: "", texto: this.$t("admin.all") }].concat(
        ["waiting_us", "waiting_player", "closed"].map((e) => ({ valor: e, texto: this.$t("admin.thread." + e) }))
      );
    },
  },

  methods: {
    /* "18 min" mientras sea razonable; "3 h" cuando ya no lo es. */
    espera(min) {
      const n = Number(min) || 0;
      return n < 90 ? `${n} min` : `${Math.round(n / 60)} h`;
    },

    num(n) { return Number(n || 0).toLocaleString("en-US"); },
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },
    fecha(d) { return d ? new Date(d).toLocaleDateString(this.$i18n.locale, { day: "2-digit", month: "short" }) : ""; },
    fechaHora(d) { return d ? new Date(d).toLocaleString(this.$i18n.locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""; },

    tono(e) {
      if (e === "waiting_us") return "is-espera";
      if (e === "closed") return "is-mal";
      return "is-bien";
    },

    alFondo() {
      const c = this.$refs.hilo;
      if (c) c.scrollTop = c.scrollHeight;
    },

    async traer() {
      try {
        const { data } = await api.get("/admin/support", { params: { estado: this.estado || undefined } });
        this.hilos = data.data.items;
        this.esperando = data.data.esperando;
        this.porEstado = data.data.porEstado;
        this.n = data.data.numeros || this.n;
        this.$emit("pendientes", { support: this.esperando });
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    async abrir(id) {
      try {
        const { data } = await api.get(`/admin/support/${id}`);
        this.elegido = data.data;
        this.borrador = "";
        this.$nextTick(this.alFondo);
        await this.traer();
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    async responder(cerrar) {
      const texto = this.borrador.trim();
      if (!texto) return;

      this.ocupado = true;
      try {
        const { data } = await api.post(`/admin/support/${this.elegido._id}/reply`, { texto, cerrar });
        this.elegido = { ...this.elegido, ...data.data };
        this.borrador = "";
        this.$nextTick(this.alFondo);
        await this.traer();
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.ocupado = false;
      }
    },

    async mover(estado) {
      this.ocupado = true;
      try {
        const { data } = await api.post(`/admin/support/${this.elegido._id}/state`, { estado });
        this.elegido = { ...this.elegido, ...data.data };
        await this.traer();
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.ocupado = false;
      }
    },

    async traerGuardadas() {
      try {
        const { data } = await api.get("/admin/support/canned");
        this.guardadas = data.data.items;
      } catch (err) {
        /* Sin respuestas guardadas se escribe a mano, nada más. */
      }
    },
  },

  created() {
    this.traer();
    this.traerGuardadas();

    /* La bandeja se mira con el chat abierto del otro lado: cada quince
       segundos alcanza para no quedarse con una lista vieja. */
    this.reloj = window.setInterval(() => {
      if (!document.hidden) this.traer();
    }, 15000);
  },

  beforeDestroy() { window.clearInterval(this.reloj); },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.ads { display: flex; flex-direction: column; gap: 20px; }

.ads__cabeza { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.ads__quien { flex: 1 1 320px; display: flex; flex-direction: column; gap: 4px; }
.ads__quien h1 { margin: 0; font-weight: 900; font-size: 26px; }
.ads__que { max-width: 680px; font-size: 14px; line-height: 1.5; color: $texto-3; }

.ads__dos { display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-start; }

/* ── La ficha del que escribió ─────────────────────────────────── */

.ads__ficha {
  flex: 1 1 260px;
  max-width: 320px;
  box-sizing: border-box;
  padding: 16px;
  border-radius: 16px;
  background: $panel-alto;
  border: 1px solid $borde;
  display: flex;
  flex-direction: column;
  gap: 14px;
  font-size: 13px;
}

.ads__ficha-quien { display: flex; align-items: center; gap: 10px; }

.ads__avatar {
  width: 38px;
  height: 38px;
  flex: none;
  border-radius: 11px;
  background: $azul;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
}

.ads__ficha-nombre { display: flex; flex-direction: column; gap: 2px; min-width: 0; font-weight: 900; overflow-wrap: anywhere; }
.ads__ficha-t { font-weight: 900; font-size: 12px; letter-spacing: .04em; color: $texto-4; }

.ads__chapas { display: flex; flex-wrap: wrap; gap: 6px; }

.ads__chapa {
  padding: 4px 9px;
  border-radius: 999px;
  background: $panel;
  border: 1px solid $borde;
  font-weight: 900;
  font-size: 11px;
}

.ads__datos {
  margin: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;

  div { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  dt { font-size: 11px; font-weight: 700; color: $texto-4; }
  dd { margin: 0; font-weight: 800; }
}

.ads__trabas, .ads__nota, .ads__ultimos { display: flex; flex-direction: column; gap: 6px; }
.ads__nota p { margin: 0; line-height: 1.5; }

.ads__mov {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 8px;
  align-items: baseline;
  font-size: 12px;
}

.ads__lista {
  flex: 2 1 320px;
  min-width: 0;
  max-height: 70vh;
  overflow-y: auto;
  border-radius: 16px;
  background: $panel-alto;
  border: 1px solid $borde;
  display: flex;
  flex-direction: column;
}

.ads__hilo {
  padding: 12px 14px;
  border: 0;
  border-bottom: 1px solid #1a2d4d;
  background: transparent;
  color: #fff;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 5px;
  @include foco;

  &:hover { background: $panel-hover; }
  &.is-elegido { background: $azul-activo; }
}

.ads__hilo-a { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; }
.ads__hilo-quien { display: flex; align-items: center; gap: 6px; font-weight: 900; font-size: 14px; }
.ads__hilo-t { font-size: 13px; color: $texto-2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ads__hilo-b { display: flex; align-items: center; gap: 8px; font-size: 12px; }

.ads__punto { width: 8px; height: 8px; border-radius: 50%; background: $amarillo-v; }

.ads__chat {
  flex: 3 1 420px;
  min-width: 0;
  border-radius: 16px;
  background: $panel-alto;
  border: 1px solid $borde;
  display: flex;
  flex-direction: column;

  &--vacio { padding: 60px 20px; align-items: center; justify-content: center; }
}

.ads__chat-cabeza {
  padding: 14px 18px;
  border-bottom: 1px solid $borde;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.ads__chat-quien { flex: 1 1 240px; display: flex; flex-direction: column; gap: 3px; font-size: 13px; }
.ads__link { font-weight: 900; font-size: 18px; color: #fff; text-decoration: none; &:hover { color: #9fc0ff; } }

.ads__msgs {
  flex: 1;
  min-height: 240px;
  max-height: 46vh;
  overflow-y: auto;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ads__msg {
  align-self: flex-start;
  max-width: 78%;
  padding: 10px 12px;
  border-radius: 14px;
  background: $panel-hover;
  font-size: 14px;
  line-height: 1.45;
  overflow-wrap: anywhere;

  &.is-nuestro { align-self: flex-end; background: #2f6fe0; }
}

.ads__msg-quien {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
  font-weight: 800;
  font-size: 11px;
  color: #c9d7f7;
}

.ads__guardadas { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 18px; }

.ads__guardada {
  height: 30px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid $borde-fuerte;
  background: $panel;
  color: $texto-2;
  font-family: inherit;
  font-weight: 700;
  font-size: 12px;
  cursor: pointer;
  @include foco;
  &:hover { background: $panel-hover; color: #fff; }
}

.ads__escribir { padding: 14px 18px 18px; display: flex; flex-direction: column; gap: 10px; }
.ads__texto { height: auto; min-height: 76px; padding: 10px 12px; line-height: 1.45; resize: vertical; }
.ads__botones { display: flex; flex-wrap: wrap; gap: 8px; }

.ad-tenue { color: $texto-4; }
</style>
