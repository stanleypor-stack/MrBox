<template>
  <div class="ads">
    <div class="ads__cabeza">
      <div class="ads__quien">
        <h1>{{ $t('admin.nav.affiliates') }}</h1>
        <span class="ads__que">{{ $t('admin.what.affiliates') }}</span>
      </div>

      <router-link to="/admin/affiliates/ladder" class="ad-b ad-b--grande">
        {{ $t('admin.afi.ladder') }}
      </router-link>
    </div>

    <!-- ── Las tres colas ───────────────────────────────────────── -->
    <div class="ads__solapas">
      <button
        v-for="s in solapas" :key="s.id" type="button" class="ads__solapa"
        :class="{ 'is-ahora': solapa === s.id }" @click="irA(s.id)"
      >
        {{ s.texto }}
        <em v-if="s.cuantos">{{ s.cuantos }}</em>
      </button>
    </div>

    <!-- ══ Los socios ═══════════════════════════════════════════ -->
    <template v-if="solapa === 'socios'">
      <div v-if="d" class="ad-nums">
        <div class="ad-num"><span>{{ $t('admin.afi.partners') }}</span><b>{{ num(d.totales.socios) }}</b></div>
        <div class="ad-num"><span>{{ $t('admin.afi.brought') }}</span><b>{{ num(d.totales.jugadores) }}</b></div>
        <div class="ad-num"><span>{{ $t('admin.afi.theirPlay') }}</span><b>SC {{ plata(d.totales.jugadoSc) }}</b></div>
        <div class="ad-num">
          <span>{{ $t('admin.afi.margin') }}</span>
          <b>SC {{ plata(d.totales.margenSc) }}</b>
          <em>{{ $t('admin.afi.marginHelp', { pct: d.reglas.houseEdgePct }) }}</em>
        </div>
        <div class="ad-num"><span>{{ $t('admin.afi.paid') }}</span><b>SC {{ plata(d.totales.pagadoSc) }}</b></div>
        <div class="ad-num">
          <span>{{ $t('admin.afi.share') }}</span>
          <b :class="d.totales.tajadaPct > 60 ? 'ad-rojo' : ''">{{ pct(d.totales.tajadaPct) }}</b>
          <em>{{ $t('admin.afi.shareHelp') }}</em>
        </div>
      </div>

      <div class="ad-fila">
        <input v-model="busca" class="ad-in ad-crece" :placeholder="$t('admin.afi.search')" @keyup.enter="traer">
        <mb-elegir v-model="modelo" class="ad-elegir" :opciones="filtroModelos" chico />
        <mb-elegir v-model="rango" class="ad-elegir" :opciones="filtroRangos" chico />
        <button type="button" class="ad-b ad-b--suave" @click="traer">{{ $t('admin.afi.find') }}</button>
      </div>

      <p class="ad-aviso">{{ $t('admin.afi.help') }}</p>

      <div class="ad-t">
        <div class="ad-t__scroll">
          <div class="ad-t__ancho ads__ancho">
            <div class="ad-t__cab ads__fila">
              <span>{{ $t('admin.afi.partner') }}</span>
              <span>{{ $t('admin.afi.rank') }}</span>
              <span>{{ $t('admin.afi.models') }}</span>
              <span class="ad-der">{{ $t('admin.afi.players') }}</span>
              <span class="ad-der">{{ $t('admin.afi.theirPlay') }}</span>
              <span class="ad-der">{{ $t('admin.afi.margin') }}</span>
              <span class="ad-der">{{ $t('admin.afi.paid') }}</span>
              <span class="ad-der">{{ $t('admin.afi.pending') }}</span>
              <span class="ad-der">{{ $t('admin.afi.net') }}</span>
              <span class="ad-der">{{ $t('admin.afi.share') }}</span>
            </div>

            <router-link
              v-for="f in (d ? d.items : [])" :key="f._id" class="ad-t__fila ads__fila"
              :to="`/admin/affiliates/${f._id}`"
            >
              <span class="ads__socio">
                <b>{{ f.socio }}</b>
                <em>{{ f.codigos.join(' · ') || '—' }}</em>
              </span>

              <span class="ads__rango">
                <mb-gema :numero="f.rango.numero" :lado="20" />
                {{ f.rango.numero }} · {{ f.rango.nombre }}
                <span v-if="f.pidioRangoEl" class="ad-estado is-espera">{{ $t('admin.afi.asked') }}</span>
              </span>

              <span class="ads__modelos">
                <em v-for="m in f.modelos" :key="m" :class="'is-' + m">{{ $t('admin.afi.m_' + m) }}</em>
              </span>

              <span class="ad-der">{{ num(f.jugadores) }}</span>
              <span class="ad-der">SC {{ plata(f.jugadoSc) }}</span>
              <span class="ad-der">SC {{ plata(f.margenSc) }}</span>
              <span class="ad-der">SC {{ plata(f.pagadoSc) }}</span>
              <span class="ad-der ad-amarillo">SC {{ plata(f.porCobrarSc) }}</span>
              <span class="ad-der" :class="f.netoSc < 0 ? 'ad-rojo' : 'ad-verde'">SC {{ plata(f.netoSc) }}</span>
              <span class="ad-der" :class="f.tajadaPct > 60 ? 'ad-rojo' : 'ad-tenue'">{{ pct(f.tajadaPct) }}</span>
            </router-link>

            <div v-if="d && !d.items.length" class="ad-t__vacio">{{ $t('admin.empty') }}</div>
          </div>
        </div>
      </div>
    </template>

    <!-- ══ Los pedidos de rango ═════════════════════════════════ -->
    <template v-if="solapa === 'pedidos'">
      <p class="ad-aviso">{{ $t('admin.afi.requestsHelp') }}</p>

      <div class="ad-tabla">
        <div class="ad-tabla__scroll">
          <table>
            <thead>
              <tr>
                <th>{{ $t('admin.afi.partner') }}</th>
                <th>{{ $t('admin.afi.asked') }}</th>
                <th>{{ $t('admin.afi.rank') }}</th>
                <th>{{ $t('admin.afi.wouldBe') }}</th>
                <th class="ad-der">{{ $t('admin.afi.players') }}</th>
                <th class="ad-der">{{ $t('admin.afi.theirPlay') }}</th>
                <th class="ad-der">{{ $t('admin.afi.margin') }}</th>
                <th class="ad-der">{{ $t('admin.afi.paid') }}</th>
                <th class="ad-der">{{ $t('admin.afi.net') }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in pedidos" :key="p._id">
                <td>
                  <router-link :to="`/admin/affiliates/${p._id}`"><b>{{ p.socio }}</b></router-link>
                </td>
                <td class="ad-tenue">{{ fecha(p.pidioEl) }}</td>
                <td>{{ p.rango.numero }} · {{ p.rango.nombre }}</td>
                <td class="ad-verde">
                  {{ p.siguiente ? p.siguiente.numero + ' · ' + p.siguiente.nombre : '—' }}
                </td>
                <td class="ad-der">{{ num(p.jugadores) }}</td>
                <td class="ad-der">SC {{ plata(p.jugadoSc) }}</td>
                <td class="ad-der">SC {{ plata(p.margenSc) }}</td>
                <td class="ad-der">SC {{ plata(p.pagadoSc) }}</td>
                <td class="ad-der" :class="p.netoSc < 0 ? 'ad-rojo' : 'ad-verde'">SC {{ plata(p.netoSc) }}</td>
                <td>
                  <router-link :to="`/admin/affiliates/${p._id}`" class="ad-b ad-b--chico">
                    {{ $t('admin.afi.decide') }}
                  </router-link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="!pedidos.length" class="ad-tabla__vacio">{{ $t('admin.afi.noRequests') }}</div>
      </div>
    </template>

    <!-- ══ La cola de cabezas ═══════════════════════════════════ -->
    <template v-if="solapa === 'cabezas'">
      <div class="ad-fila">
        <mb-elegir v-model="estado" class="ad-elegir" :opciones="estados" chico @input="traerCabezas" />
        <label class="ads__chk">
          <input v-model="soloSenales" type="checkbox" @change="traerCabezas">
          {{ $t('admin.afi.onlyFlagged') }}
        </label>
      </div>

      <p class="ad-aviso">{{ $t('admin.afi.headsHelp') }}</p>

      <div class="ad-tabla">
        <div class="ad-tabla__scroll">
          <table>
            <thead>
              <tr>
                <th>{{ $t('admin.afi.player') }}</th>
                <th>{{ $t('admin.afi.partner') }}</th>
                <th>{{ $t('admin.afi.campaign') }}</th>
                <th>{{ $t('admin.afi.model') }}</th>
                <th class="ad-der">{{ $t('admin.afi.pays') }}</th>
                <th class="ad-der">{{ $t('admin.afi.deposited') }}</th>
                <th class="ad-der">{{ $t('admin.afi.played') }}</th>
                <th class="ad-der">{{ $t('admin.afi.kyc') }}</th>
                <th>{{ $t('admin.afi.signals') }}</th>
                <th>{{ $t('admin.afi.releases') }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in cabezas" :key="c._id">
                <td>
                  <router-link v-if="c.jugador" :to="`/admin/players/${c.jugador._id}`">
                    {{ c.jugador.username }}
                  </router-link>
                  <span v-else class="ad-tenue">—</span>
                </td>
                <td>
                  <router-link v-if="c.socio" :to="`/admin/affiliates/${c.socio._id}`">
                    {{ c.socio.username }}
                  </router-link>
                </td>
                <td class="ad-tenue">{{ c.campana ? c.campana.code : '—' }}</td>
                <td><span class="ads__m" :class="'is-' + c.modelo">{{ $t('admin.afi.m_' + c.modelo) }}</span></td>
                <td class="ad-der ad-amarillo">SC {{ plata(c.montoSc) }}</td>
                <td class="ad-der">SC {{ plata(c.depositadoSc) }}</td>
                <td class="ad-der">SC {{ plata(c.jugadoSc) }}</td>
                <td class="ad-der" :class="c.nivelKyc >= 2 ? 'ad-verde' : 'ad-rojo'">{{ c.nivelKyc }}</td>
                <td>
                  <span v-if="!c.senales.length" class="ad-estado is-bien">{{ $t('admin.afi.clean') }}</span>
                  <span v-for="s in c.senales" :key="s" class="ad-estado is-mal ads__senal">
                    {{ $t('admin.afi.sig_' + base(s), { n: numeroDe(s) }) }}
                  </span>
                </td>
                <td :class="c.liberada ? 'ad-verde' : 'ad-tenue'">
                  {{ c.liberaEl ? fecha(c.liberaEl) : '—' }}
                </td>
                <td class="ads__acciones">
                  <button
                    v-if="c.estado === 'califica'" type="button" class="ad-b ad-b--chico"
                    @click="pagar(c)"
                  >{{ $t('admin.afi.pay') }}</button>
                  <button
                    v-if="c.estado !== 'pagado' && c.estado !== 'anulado'" type="button"
                    class="ad-b ad-b--chico ad-b--mal" @click="anular(c)"
                  >{{ $t('admin.afi.void') }}</button>
                  <span v-if="c.estado === 'pagado'" class="ad-estado is-bien">{{ $t('admin.afi.st_pagado') }}</span>
                  <span v-if="c.estado === 'anulado'" class="ad-estado is-mal" :title="c.motivo">
                    {{ $t('admin.afi.st_anulado') }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="!cabezas.length" class="ad-tabla__vacio">{{ $t('admin.empty') }}</div>
      </div>
    </template>

    <!-- El motivo, que es obligatorio -->
    <mb-ventana
      v-if="porQue" :titulo="porQue.titulo" :sub="porQue.sub"
      @cerrar="porQue = null"
    >
      <label class="ad-campo">
        {{ $t('admin.reason') }}
        <input v-model="motivo" class="ad-in" maxlength="300">
      </label>

      <template #pie>
        <button type="button" class="ad-b ad-b--suave" @click="porQue = null">
          {{ $t('admin.cancel') }}
        </button>
        <button type="button" class="ad-b" :disabled="motivo.trim().length < 3" @click="confirmar">
          {{ porQue.boton }}
        </button>
      </template>
    </mb-ventana>
  </div>
</template>

<script>
import api from "@/api";
import MbGema from "@/components/MbGema.vue";
import MbElegir from "@/components/MbElegir.vue";
import MbVentana from "@/components/MbVentana.vue";

/**
 * LOS SOCIOS.
 *
 * Tres colas en una pantalla, porque son tres cosas que se miran el
 * mismo día:
 *
 *   1. LOS SOCIOS, con el margen que generaron al lado de lo que se les
 *      pagó. Sin esas dos columnas juntas no hay manera de saber si un
 *      socio conviene: el que trae mil jugadores que no depositan cuesta
 *      plata.
 *
 *   2. LOS PEDIDOS DE RANGO, con los números para decidir sin salir de
 *      acá. Un pedido que obliga a abrir tres pantallas se queda sin
 *      contestar.
 *
 *   3. LAS CABEZAS, los pagos por cabeza que esperan. Las que tienen
 *      señales no se pagan solas: están acá para que alguien las mire.
 *
 * NADA SE TOCA SIN MOTIVO
 *
 * Pagar, frenar y otorgar un rango piden motivo y quedan en el registro.
 * En seis meses nadie se acuerda por qué un socio cobra el doble.
 */
export default {
  name: "AdminSocios",

  components: { MbGema, MbElegir, MbVentana },

  data() {
    return {
      d: null,
      pedidos: [],
      cabezas: [],
      busca: "",
      modelo: "",
      rango: 0,
      estado: "califica",
      soloSenales: false,
      porQue: null,
      motivo: "",
    };
  },

  computed: {
    solapa() { return this.$route.query.cola || "socios"; },

    solapas() {
      const p = (this.d && this.d.pendientes) || {};
      return [
        { id: "socios", texto: this.$t("admin.afi.partners"), cuantos: 0 },
        { id: "pedidos", texto: this.$t("admin.afi.requests"), cuantos: p.rangos || 0 },
        { id: "cabezas", texto: this.$t("admin.afi.heads"), cuantos: p.cabezas || 0 },
      ];
    },

    filtroModelos() {
      return [
        { valor: "", texto: this.$t("admin.afi.allModels") },
        { valor: "cpa", texto: this.$t("admin.afi.m_cpa") },
        { valor: "revshare", texto: this.$t("admin.afi.m_revshare") },
        { valor: "hibrido", texto: this.$t("admin.afi.m_hibrido") },
      ];
    },

    filtroRangos() {
      const e = (this.d && this.d.escalera) || [];
      return [{ valor: 0, texto: this.$t("admin.afi.allRanks") }].concat(
        e.map((r) => ({ valor: r.numero, texto: `${r.numero} · ${r.nombre}` }))
      );
    },

    estados() {
      return ["califica", "deposito", "nuevo", "pagado", "anulado"].map((e) => ({
        valor: e, texto: this.$t("admin.afi.st_" + e),
      }));
    },
  },

  methods: {
    num(n) { return Number(n || 0).toLocaleString("en-US"); },
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },
    pct(n) { return `${Math.round((Number(n) || 0) * 10) / 10}%`; },
    fecha(f) {
      return f ? new Date(f).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
    },

    /* Una señal viene como `misma_direccion_que_3` o `4_altas_en_15_min`. */
    base(s) { return String(s).replace(/\d+/g, "n"); },
    numeroDe(s) { return (String(s).match(/\d+/) || ["0"])[0]; },

    irA(id) {
      this.$router.replace({ query: { ...this.$route.query, cola: id } });
    },

    async traer() {
      try {
        const { data } = await api.get("/admin/affiliates", {
          params: {
            q: this.busca || undefined,
            modelo: this.modelo || undefined,
            rango: this.rango || undefined,
            perPage: 50,
          },
        });
        this.d = data.data;
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    async traerPedidos() {
      try {
        const { data } = await api.get("/admin/affiliates/requests");
        this.pedidos = data.data.items;
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    async traerCabezas() {
      try {
        const { data } = await api.get("/admin/affiliates/conversions", {
          params: { estado: this.estado, senales: this.soloSenales ? 1 : undefined, perPage: 100 },
        });
        this.cabezas = data.data.items;
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    pagar(c) {
      this.motivo = "";
      this.porQue = {
        titulo: this.$t("admin.afi.payTitle"),
        sub: this.$t("admin.afi.paySub", {
          amount: this.plata(c.montoSc),
          partner: c.socio ? c.socio.username : "",
        }),
        boton: this.$t("admin.afi.pay"),
        que: "pay",
        id: c._id,
      };
    },

    anular(c) {
      this.motivo = "";
      this.porQue = {
        titulo: this.$t("admin.afi.voidTitle"),
        sub: this.$t("admin.afi.voidSub"),
        boton: this.$t("admin.afi.void"),
        que: "void",
        id: c._id,
      };
    },

    async confirmar() {
      const { que, id } = this.porQue;
      try {
        await api.post(`/admin/affiliates/conversions/${id}/${que}`, { motivo: this.motivo });
        this.porQue = null;
        this.$store.dispatch("avisar", { texto: this.$t("admin.done") });
        await Promise.all([this.traerCabezas(), this.traer()]);
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },
  },

  watch: {
    solapa(id) {
      if (id === "pedidos") this.traerPedidos();
      if (id === "cabezas") this.traerCabezas();
    },
  },

  created() {
    this.traer();
    if (this.solapa === "pedidos") this.traerPedidos();
    if (this.solapa === "cabezas") this.traerCabezas();
  },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.ads { display: flex; flex-direction: column; gap: 20px; }
.ads__cabeza { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.ads__quien { flex: 1 1 320px; display: flex; flex-direction: column; gap: 4px; }
.ads__quien h1 { margin: 0; font-weight: 900; font-size: 26px; }
.ads__que { max-width: 700px; font-size: 14px; line-height: 1.5; color: $texto-3; }

/* ── Las solapas ──────────────────────────────────────────────────── */

.ads__solapas { display: flex; flex-wrap: wrap; gap: 8px; }

.ads__solapa {
  height: 38px;
  padding: 0 16px;
  border-radius: 10px;
  border: 0;
  background: $panel;
  color: $texto-3;
  font-family: inherit;
  font-weight: 800;
  font-size: 14px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  @include foco;

  &.is-ahora { background: $azul; color: #fff; }

  em {
    padding: 1px 7px;
    border-radius: 999px;
    background: rgba(255, 211, 90, .18);
    color: $amarillo;
    font-style: normal;
    font-weight: 900;
    font-size: 11px;
  }
}

/* ── La tabla de socios ───────────────────────────────────────────── */

.ads__ancho { min-width: 1280px; }
.ads__fila { grid-template-columns: 1.4fr 1.4fr 1.3fr .8fr 1.1fr 1fr 1fr 1fr 1fr .7fr; }

.ads__socio {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  b { font-weight: 900; font-size: 14px; }
  em { font-style: normal; font-size: 11px; color: $texto-4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
}

.ads__rango { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-weight: 800; font-size: 13px; }

.ads__modelos {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;

  em {
    padding: 2px 7px;
    border-radius: 999px;
    font-style: normal;
    font-weight: 900;
    font-size: 10px;
    background: #1d3354;
    color: $texto-3;

    &.is-cpa { background: rgba(255, 211, 90, .14); color: $amarillo; }
    &.is-revshare { background: rgba(63, 155, 255, .16); color: #8fb4ff; }
    &.is-hibrido { background: rgba(93, 255, 176, .14); color: $verde; }
  }
}

.ads__m {
  padding: 2px 7px;
  border-radius: 999px;
  font-weight: 900;
  font-size: 10px;
  background: #1d3354;

  &.is-cpa { background: rgba(255, 211, 90, .14); color: $amarillo; }
  &.is-revshare { background: rgba(63, 155, 255, .16); color: #8fb4ff; }
  &.is-hibrido { background: rgba(93, 255, 176, .14); color: $verde; }
}

.ads__senal { margin-right: 4px; }
.ads__acciones { display: flex; flex-wrap: wrap; gap: 6px; }

.ads__chk {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 13px;
  color: $texto-3;
  input { width: 18px; height: 18px; }
}
</style>
