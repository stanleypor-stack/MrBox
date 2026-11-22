<template>
  <div class="mb-afi">
    <!-- ── El cartel ────────────────────────────────────────────── -->
    <section class="mb-acartel">
      <div class="mb-rays mb-acartel__rayos" aria-hidden="true"></div>

      <div class="mb-acartel__texto">
        <h1>{{ $t('affil.title') }}</h1>
        <p>{{ $t('affil.sub', { pct: bonoPct }) }}</p>

        <button type="button" class="mb-acartel__b" @click="copiarEnlace(principal)">
          {{ $t('affil.invite') }}
        </button>
        <span class="mb-acartel__copiado">{{ copiado ? $t('affil.copied') : '' }}</span>
      </div>
    </section>

    <template v-if="d">
      <!-- ── Los cuatro números ─────────────────────────────────── -->
      <section class="mb-acaja mb-acaja--rejilla">
        <div class="mb-adato">
          <span>{{ $t('affil.referrals') }}</span>
          <b>{{ num(d.total.jugadores) }}</b>
        </div>
        <div class="mb-adato">
          <span>{{ $t('affil.deposits') }}</span>
          <b><span class="mb-sc mb-sc--20" aria-hidden="true">SC</span>{{ corto(d.total.depositadoSc) }}</b>
        </div>
        <div class="mb-adato">
          <span>{{ $t('affil.volume') }}</span>
          <b><span class="mb-sc mb-sc--20" aria-hidden="true">SC</span>{{ corto(d.total.jugadoSc) }}</b>
        </div>
        <div class="mb-adato">
          <span>{{ $t('affil.totalEarned') }}</span>
          <b class="mb-verde"><span class="mb-sc mb-sc--20" aria-hidden="true">SC</span>{{ corto(d.total.ganadoSc) }}</b>
        </div>
      </section>

      <!-- ── Lo que hay para cobrar, y el rango ─────────────────── -->
      <section class="mb-ados">
        <div class="mb-acaja mb-acaja--col">
          <div class="mb-adato mb-adato--fila">
            <span class="mb-adato__t">
              {{ $t('affil.available') }}
              <b class="mb-verde">
                <span class="mb-sc mb-sc--20" aria-hidden="true">SC</span>{{ plata(d.total.porCobrarSc) }}
              </b>
            </span>
            <button
              type="button" class="mb-acobrar"
              :disabled="!d.total.porCobrarSc || cobrando" @click="cobrarTodo"
            >{{ $t('affil.claim') }}</button>
          </div>

          <div class="mb-adato">
            <span>{{ $t('affil.waiting') }}</span>
            <b class="mb-ambar">
              <span class="mb-sc mb-sc--20" aria-hidden="true">SC</span>{{ plata(d.total.enEsperaSc) }}
            </b>
            <p class="mb-anota">
              {{ $t('affil.waitingSub', {
                n: num(d.embudo.deposito + d.embudo.califica),
                play: corto(d.reglas.cpaJugadoSc),
                days: d.reglas.cpaEsperaDias,
              }) }}
            </p>
            <p v-if="rango.minimoCobroSc" class="mb-anota">
              {{ $t('affil.claimMin', { min: corto(rango.minimoCobroSc) }) }}
            </p>
          </div>
        </div>

        <!-- El rango, con los tres números que de verdad se miran -->
        <div class="mb-acaja mb-acaja--col">
          <div class="mb-arango">
            <div class="mb-arango__cab">
              <span>
                {{ $t('affil.yourRank') }}
                <b>{{ rango.numero }}/{{ rango.deCuantos }}</b>
              </span>
              <router-link to="/affiliates/ranks">{{ $t('affil.seeAllRanks') }}</router-link>
            </div>

            <span class="mb-arango__quien">
              <mb-gema :numero="gemaDe(rango.numero)" :lado="40" />
              <span>
                <b>{{ rango.nombre }}</b>
                <span>{{ $t('affil.bonusForYours', { pct: rango.bonoPct }) }}</span>
              </span>
            </span>

            <div class="mb-arango__modelos">
              <span>
                <span>{{ $t('affil.mCpa') }}</span>
                <b class="mb-ambar">SC {{ rango.cpaSc }}</b>
              </span>
              <span>
                <span>{{ $t('affil.mRev') }}</span>
                <b class="mb-azul">{{ rango.revsharePct }}%</b>
              </span>
              <span class="mb-arango__ancho">
                <span>{{ $t('affil.mHyb') }}</span>
                <b class="mb-verde">SC {{ rango.hibridoCpaSc }} + {{ rango.hibridoPct }}%</b>
              </span>
            </div>

            <div v-if="rango.siguiente" class="mb-arango__sigue">
              <div class="mb-arango__fila">
                <span class="mb-tenue">
                  {{ $t('affil.next') }} <b>{{ rango.siguiente.nombre }}</b>
                </span>
                <span class="mb-azul">
                  SC {{ rango.siguiente.cpaSc }} · {{ rango.siguiente.revsharePct }}%
                </span>
              </div>
              <span class="mb-anota">{{ $t('affil.ranksNotAuto') }}</span>
            </div>

            <a
              class="mb-arango__pedir" :href="d.telegram" target="_blank" rel="noopener"
              @click="pedirRango"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M21.5 4.3 2.9 11.4c-.9.3-.9 1.6 0 2l4.6 1.5 1.8 5.6c.3.8 1.3 1 1.9.4l2.6-2.5 4.6 3.4c.7.5 1.6.1 1.8-.7l3-15c.2-.9-.7-1.6-1.7-1.3zM9.6 14.1l9-5.6-7.6 6.8-.3 3.3-1.1-4.5z" />
              </svg>
              {{ $t('affil.askRank') }}
            </a>
          </div>
        </div>
      </section>

      <!-- ── Las campañas ───────────────────────────────────────── -->
      <section class="mb-acaja mb-acaja--col">
        <div class="mb-acab">
          <h2>{{ $t('affil.campaigns') }}</h2>
          <span class="mb-tenue">{{ $t('affil.campaignsSub') }}</span>
        </div>

        <div v-if="d.campanas.length" class="mb-acamps">
          <article v-for="c in d.campanas" :key="c._id" class="mb-acamp">
            <div class="mb-acamp__cab">
              <span class="mb-acamp__quien">
                <b v-if="editando !== c._id">{{ c.nombre }}</b>
                <input
                  v-else v-model="borrador" maxlength="16" class="mb-ain"
                  :aria-label="$t('affil.code')" @input="limpiarBorrador"
                >
                <span class="mb-acamp__url">
                  {{ host }}/r/<b>{{ c.code }}</b>
                </span>
              </span>

              <span class="mb-achip" :class="'is-' + c.modelo">{{ etiqueta(c) }}</span>
            </div>

            <div class="mb-acamp__nums">
              <span>
                <span>{{ $t('affil.signups') }}</span>
                <b>{{ num(c.jugadores) }}</b>
              </span>
              <span>
                <span>{{ $t('affil.played') }}</span>
                <b>SC {{ corto(c.jugadoPorLosSuyosSc) }}</b>
              </span>
              <span>
                <span>{{ $t('affil.earnedYou') }}</span>
                <b class="mb-verde">SC {{ plata(c.ganadoSc) }}</b>
              </span>
              <span>
                <span>{{ $t('affil.available') }}</span>
                <b class="mb-ambar">SC {{ plata(c.porCobrarSc) }}</b>
              </span>
            </div>

            <div class="mb-acamp__pies">
              <button type="button" class="mb-achico" @click="copiarEnlace(c)">
                {{ $t('affil.copyLink') }}
              </button>
              <button
                v-if="editando !== c._id" type="button" class="mb-achico"
                @click="empezarAEditar(c)"
              >{{ $t('affil.editCode') }}</button>
              <button
                v-else type="button" class="mb-achico mb-achico--azul" :disabled="guardando"
                @click="guardarCodigo(c)"
              >{{ $t('action.save') }}</button>
              <button
                type="button" class="mb-achico mb-achico--verde"
                :disabled="!c.porCobrarSc || cobrando" @click="cobrar(c)"
              >{{ $t('affil.claim') }}</button>
            </div>
          </article>
        </div>

        <div v-else class="mb-avacio">
          <span>{{ $t('affil.noCampaigns') }}</span>
          <span class="mb-tenue">{{ $t('affil.noCampaignsSub') }}</span>
        </div>

        <!-- Crear una campaña -->
        <div class="mb-anueva">
          <button
            v-if="!creando" type="button" class="mb-acartel__b mb-acartel__b--chico"
            :disabled="d.campanas.length >= d.reglas.comoMaximo" @click="creando = true"
          >{{ $t('affil.newCampaign') }}</button>

          <template v-else>
            <h3>{{ $t('affil.newCampaign') }}</h3>

            <label class="mb-acampo">
              <span>{{ $t('affil.cName') }}</span>
              <input
                v-model="nueva.nombre" maxlength="60" class="mb-ain"
                :aria-label="$t('affil.cName')"
              >
            </label>

            <label class="mb-acampo">
              <span>{{ $t('affil.cCode') }}</span>
              <input
                v-model="nueva.code" maxlength="16" class="mb-ain"
                :aria-label="$t('affil.cCode')"
                @input="nueva.code = nueva.code.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase()"
              >
            </label>

            <label class="mb-acampo">
              <span>{{ $t('affil.cChannel') }}</span>
              <mb-elegir v-model="nueva.canal" :opciones="canales" />
            </label>

            <span class="mb-alab">{{ $t('affil.cModel') }}</span>

            <div class="mb-amodelos">
              <button
                v-for="m in modelos" :key="m.id" type="button" class="mb-amodelo"
                :class="{ 'is-elegido': nueva.modelo === m.id }" @click="nueva.modelo = m.id"
              >
                <span class="mb-amodelo__punto" :class="'is-' + m.id"></span>
                <span class="mb-amodelo__texto">
                  <b>
                    {{ m.titulo }}
                    <span v-if="m.id === 'hibrido'" class="mb-amodelo__sello">{{ $t('affil.mostPicked') }}</span>
                  </b>
                  <span>{{ m.sub }}</span>
                </span>
                <b class="mb-amodelo__num" :class="'is-' + m.id">{{ m.cuanto }}</b>
              </button>
            </div>

            <div class="mb-acomo">
              <span class="mb-alab">{{ $t('affil.howItEnds') }}</span>
              <span class="mb-acomo__t">{{ comoQueda }}</span>
              <span class="mb-anota">
                {{ $t('affil.qualifies', {
                  dep: corto(d.reglas.cpaDepositoSc),
                  play: corto(d.reglas.cpaJugadoSc),
                  days: d.reglas.cpaEsperaDias,
                }) }}
                {{ $t('affil.bonusAlways', { pct: rango.bonoPct }) }}
              </span>
            </div>

            <div class="mb-acamp__pies">
              <button type="button" class="mb-acartel__b mb-acartel__b--chico" :disabled="creandola" @click="crear">
                {{ $t('affil.create') }}
              </button>
              <button type="button" class="mb-achico" @click="creando = false">
                {{ $t('action.cancel') }}
              </button>
            </div>
          </template>
        </div>
      </section>

      <!-- ── Los que trajo ──────────────────────────────────────── -->
      <section class="mb-acaja mb-acaja--col">
        <div class="mb-acab mb-acab--apilada">
          <h2>{{ $t('affil.yourReferrals') }}</h2>
          <span class="mb-tenue">
            {{ $t('affil.funnel', {
              total: num(d.total.jugadores),
              qualified: num(d.embudo.califica + d.embudo.pagado),
            }) }}
          </span>
        </div>

        <div v-if="d.referidos.length" class="mb-alista">
          <div class="mb-alista__fila mb-alista__fila--cab">
            <span>{{ $t('affil.player') }}</span>
            <span>{{ $t('affil.campaign') }}</span>
            <span>{{ $t('affil.status') }}</span>
            <span class="mb-der">{{ $t('affil.deposits') }}</span>
            <!-- La misma clave que el recuadro de arriba: es el mismo
                 numero, repartido por jugador. -->
            <span class="mb-der">{{ $t('affil.volume') }}</span>
            <span class="mb-der">{{ $t('affil.earnedYou') }}</span>
          </div>

          <!--
            Los seis datos son los mismos que en la cabecera de arriba
            y van en el mismo orden. Lo que cambia en el celular es
            como se acomodan, y eso lo hace la hoja de estilos; aca
            cada uno solo dice cual es. `data-rotulo` lleva el titulo
            de su columna, ya traducido, para que en el celular ---
            donde la cabecera no se ve --- el numero no quede suelto.
          -->
          <div v-for="r in d.referidos" :key="r._id" class="mb-alista__fila">
            <span class="mb-afila__nombre">{{ r.username }}</span>
            <span class="mb-afila__codigo mb-tenue">
              <svg class="mb-afila__tag" width="11" height="11" viewBox="0 0 24 24"
                   fill="currentColor" aria-hidden="true">
                <path d="M10.6 2.5H4.8A2.3 2.3 0 0 0 2.5 4.8v5.8c0 .6.2 1.2.7 1.6l8.6 8.6a2.3 2.3 0 0 0 3.2 0l5.8-5.8a2.3 2.3 0 0 0 0-3.2l-8.6-8.6a2.3 2.3 0 0 0-1.6-.7zm-3 5.8a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
              </svg>{{ r.codigo || '—' }}
            </span>
            <span class="mb-afila__estado">
              <span class="mb-achip" :class="'is-' + r.estado">{{ $t('affil.st_' + r.estado) }}</span>
            </span>
            <span class="mb-afila__dato mb-der" :data-rotulo="$t('affil.deposits')">
              SC {{ plata(r.depositadoSc) }}
            </span>
            <span class="mb-afila__dato mb-der" :data-rotulo="$t('affil.volume')">
              SC {{ plata(r.jugadoSc) }}
            </span>
            <span class="mb-afila__dato mb-der" :data-rotulo="$t('affil.earnedYou')"
                  :class="r.montoSc ? 'mb-verde' : 'mb-tenue'">
              {{ r.montoSc ? 'SC ' + plata(r.montoSc) : '—' }}
            </span>
          </div>
        </div>

        <div v-else class="mb-avacio">
          <span>{{ $t('affil.noReferrals') }}</span>
          <span class="mb-tenue">{{ $t('affil.noReferralsSub') }}</span>
        </div>
      </section>

      <!-- ── El programa de socios ──────────────────────────────── -->
      <section class="mb-acaja mb-acaja--col">
        <div class="mb-aprog">
          <span class="mb-aprog__texto">
            <span class="mb-alab">{{ $t('affil.program') }}</span>
            <b>{{ $t('affil.programTitle', { cpa: tope.cpaSc, rev: tope.revsharePct }) }}</b>
            <span class="mb-tenue">{{ $t('affil.programSub') }}</span>
          </span>
          <router-link to="/affiliates/ranks" class="mb-acartel__b mb-acartel__b--chico">
            {{ $t('affil.seeRanks') }}
          </router-link>
        </div>
      </section>
    </template>

    <p v-else-if="!entro" class="mb-avacio">{{ $t('error.NOT_LOGGED_IN') }}</p>
    <p v-else class="mb-tenue">{{ $t('common.loading') }}</p>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import api from "@/api";
import MbGema from "@/components/MbGema.vue";
import MbElegir from "@/components/MbElegir.vue";

/**
 * AFILIADOS.
 *
 * Lo que ve un socio: su rango con los cuatro modelos, sus campañas, lo
 * que hay para cobrar, lo que está esperando calificar y los que trajo.
 *
 * LOS NUMEROS NO SE CALCULAN ACA
 *
 * Todos llegan del servidor, incluida la escalera: si la pantalla
 * guardara su propia copia de "Bronce paga 35%", el día que el equipo
 * edite la escalera el sitio mostraría un número y pagaría otro.
 *
 * LOS CUATRO MODELOS, EN UNA LINEA CADA UNO
 *
 *   por cabeza ... SC fijos por jugador que califica
 *   comisión ..... % del margen REAL
 *   híbrido ...... algo al calificar y algo siempre
 *   house edge ... % del margen TEORICO, sin suerte de por medio
 */
export default {
  name: "AffiliatesView",

  components: { MbGema, MbElegir },

  data() {
    return {
      d: null,
      copiado: false,
      cobrando: false,
      creando: false,
      creandola: false,
      editando: "",
      borrador: "",
      guardando: false,
      nueva: { nombre: "", code: "", canal: "YouTube", modelo: "hibrido" },
    };
  },

  computed: {
    ...mapGetters(["entro"]),

    rango() {
      return (this.d && this.d.rango) || { numero: 1, nombre: "", bonoPct: 5, deCuantos: 8 };
    },

    /** El último rango de la escalera: lo que se promete arriba. */
    tope() {
      const e = (this.d && this.d.escalera) || [];
      return e.length ? e[e.length - 1] : { cpaSc: 60, revsharePct: 60 };
    },

    principal() {
      return (this.d && this.d.campanas.length && this.d.campanas[0]) || null;
    },

    host() {
      return window.location.host;
    },

    bonoPct() {
      return this.rango.bonoPct;
    },

    canales() {
      return [
        { valor: "YouTube", texto: "YouTube" },
        { valor: "Telegram", texto: "Telegram" },
        { valor: "Instagram", texto: "Instagram" },
        { valor: "TikTok", texto: "TikTok" },
        { valor: "Twitch", texto: "Twitch" },
        { valor: "X", texto: "X" },
        { valor: "Discord", texto: "Discord" },
        { valor: "ads", texto: this.$t("affil.chAds") },
        { valor: "otro", texto: this.$t("affil.chOther") },
      ];
    },

    /** Los modelos que el socio puede elegir solo, con lo que paga su rango. */
    modelos() {
      const abiertos = (this.d && this.d.reglas.modelosAbiertos) || [];
      const r = this.rango;

      const todos = [
        {
          id: "revshare",
          titulo: this.$t("affil.mRevTitle"),
          sub: this.$t("affil.mRevSub"),
          cuanto: `${r.revsharePct}%`,
        },
        {
          id: "cpa",
          titulo: this.$t("affil.mCpaTitle"),
          sub: this.$t("affil.mCpaSub"),
          cuanto: `SC ${r.cpaSc}`,
        },
        {
          id: "hibrido",
          titulo: this.$t("affil.mHybTitle"),
          sub: this.$t("affil.mHybSub"),
          cuanto: `SC ${r.hibridoCpaSc} + ${r.hibridoPct}%`,
        },
      ];

      return todos.filter((m) => abiertos.includes(m.id));
    },

    /** La misma cuenta en una frase, antes de crear la campaña. */
    comoQueda() {
      const r = this.rango;
      const m = this.nueva.modelo;

      if (m === "cpa") return this.$t("affil.endsCpa", { cpa: r.cpaSc });
      if (m === "revshare") return this.$t("affil.endsRev", { pct: r.revsharePct });
      return this.$t("affil.endsHyb", { cpa: r.hibridoCpaSc, pct: r.hibridoPct });
    },
  },

  methods: {
    num(n) { return Number(n || 0).toLocaleString("en-US"); },

    /**
     * LA PIEDRA DE CADA RANGO.
     *
     * Las gemas son nueve y los rangos de afiliado son seis, asi que no
     * van uno a uno: el ultimo usa el diamante y no la piedra que le
     * tocaria por posicion. Es la misma piedra que el VIP, para que un
     * color siempre quiera decir lo mismo.
     */
    gemaDe(numero) {
      return [1, 2, 3, 4, 5, 7][Math.max(0, Math.min(5, (Number(numero) || 1) - 1))];
    },

    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },

    /** "2.5M", "10K": en una tarjeta no entra "2,500,000.00". */
    corto(n) {
      const v = Number(n) || 0;
      if (v >= 1000000) return (v / 1000000).toFixed(v % 1000000 ? 1 : 0) + "M";
      if (v >= 10000) return Math.round(v / 1000) + "K";
      return this.num(Math.round(v * 100) / 100);
    },

    /** El sello de la campaña: el modelo y lo que paga hoy. */
    etiqueta(c) {
      if (c.modelo === "cpa") return `CPA · SC ${c.cobra.porCabezaSc}`;
      if (c.modelo === "revshare") return `RevShare · ${c.cobra.pct}%`;
      return `${this.$t("affil.mHybTitle")} · SC ${c.cobra.porCabezaSc} + ${c.cobra.pct}%`;
    },

    /*
      EL ENLACE QUE SE COPIA, CON EL ESQUEMA QUE DE VERDAD TIENE.

      Decia `https://` a mano. En mrbox.gg esta bien, pero en la
      maquina de desarrollo escupia https://localhost:8090, que no
      habla https: el que copiaba el enlace y lo abria se comia un
      ERR_SSL_PROTOCOL_ERROR y parecia que el codigo no servia.

      `origin` ya trae el esquema correcto en los dos lados.
    */
    enlaceDe(c) {
      return `${window.location.origin}/r/${c ? c.code : ""}`;
    },

    async copiarEnlace(c) {
      const campana = c || this.principal;
      if (!campana) {
        this.$store.dispatch("avisar", { texto: this.$t("affil.noCampaigns"), tono: "error" });
        return;
      }

      try {
        await navigator.clipboard.writeText(this.enlaceDe(campana));
        this.copiado = true;
        window.setTimeout(() => { this.copiado = false; }, 2000);
      } catch (err) {
        this.$store.dispatch("avisar", { texto: this.enlaceDe(campana) });
      }
    },

    limpiarBorrador() {
      this.borrador = this.borrador.replace(/[^a-zA-Z0-9_-]/g, "").toUpperCase();
    },

    empezarAEditar(c) {
      this.editando = c._id;
      this.borrador = c.code;
    },

    async guardarCodigo(c) {
      if (this.borrador.length < 3) {
        this.$store.dispatch("avisar", { texto: this.$t("affil.codeShort"), tono: "error" });
        return;
      }

      this.guardando = true;
      try {
        await api.post(`/affiliates/campaigns/${c._id}/code`, { code: this.borrador });
        this.editando = "";
        await this.traer();
        this.$store.dispatch("avisar", { texto: this.$t("admin.done") });
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.guardando = false;
      }
    },

    async crear() {
      this.creandola = true;
      try {
        await api.post("/affiliates/campaigns", this.nueva);
        this.creando = false;
        this.nueva = { nombre: "", code: "", canal: "YouTube", modelo: "hibrido" };
        await this.traer();
        this.$store.dispatch("avisar", { texto: this.$t("admin.done") });
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.creandola = false;
      }
    },

    async cobrar(c) {
      this.cobrando = true;
      try {
        const { data } = await api.post(`/affiliates/campaigns/${c._id}/claim`);
        this.$store.commit("saldo", data.data);
        this.$store.dispatch("avisar", {
          texto: this.$t("affil.claimed", { amount: this.plata(data.data.cobradoSc) }),
        });
        await this.traer();
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.cobrando = false;
      }
    },

    /**
     * Cobra todas las campañas que tengan algo.
     *
     * De una en una y a propósito: cada campaña es su propio cobro, con
     * su propio mínimo. Si una no llega, las demás se cobran igual y se
     * cuenta lo que entró.
     */
    async cobrarTodo() {
      const conPlata = this.d.campanas.filter((c) => c.porCobrarSc > 0);
      if (!conPlata.length) return;
      if (conPlata.length === 1) return this.cobrar(conPlata[0]);

      this.cobrando = true;
      let total = 0;
      let ultimoError = "";

      for (const c of conPlata) {
        try {
          const { data } = await api.post(`/affiliates/campaigns/${c._id}/claim`);
          this.$store.commit("saldo", data.data);
          total += Number(data.data.cobradoSc) || 0;
        } catch (err) {
          ultimoError = err.textoParaElJugador;
        }
      }

      this.cobrando = false;
      await this.traer();

      if (total > 0) {
        this.$store.dispatch("avisar", {
          texto: this.$t("affil.claimed", { amount: this.plata(total) }),
        });
      } else if (ultimoError) {
        this.$store.dispatch("avisar", { texto: ultimoError, tono: "error" });
      }

      return null;
    },

    /**
     * Deja anotado el pedido de rango.
     *
     * No frena el enlace de Telegram: el socio va a hablar igual, y si
     * el pedido no se pudo anotar eso es nuestro problema, no suyo.
     */
    async pedirRango() {
      try {
        await api.post("/affiliates/rank/request");
        this.$store.dispatch("avisar", { texto: this.$t("affil.asked") });
      } catch (err) {
        /* Ya pidió esta semana: no hace falta decirle nada. */
      }
    },

    async traer() {
      if (!this.entro) return;
      try {
        const { data } = await api.get("/affiliates");
        this.d = data.data;
        if (!this.nueva.nombre && !this.d.campanas.length) this.creando = true;
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },
  },

  watch: {
    /* El usuario llega DESPUES de dibujar la pantalla: el token se
       canjea en un pedido. Por eso se espera a que llegue en vez de
       mandar a /login al que ya tiene sesion. */
    entro() { this.traer(); },
  },

  created() { this.traer(); },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-afi { display: flex; flex-direction: column; gap: 20px; }

/* ── El cartel ────────────────────────────────────────────────────── */

.mb-acartel {
  position: relative;
  overflow: hidden;
  border-radius: 22px;
  min-height: 250px;
  background:
    radial-gradient(circle at 18% 55%, rgba(255, 190, 60, .55) 0%, rgba(255, 190, 60, 0) 32%),
    linear-gradient(115deg, #0f2f7a 0%, #1f5fd6 45%, #2fa6f0 75%, #7fd3ff 100%);
  display: flex;
  align-items: center;
}

.mb-acartel__rayos {
  position: absolute;
  left: 70%;
  top: 50%;
  width: 1200px;
  height: 1200px;
  margin: -600px 0 0 -600px;
  background: repeating-conic-gradient(from 0deg, rgba(255, 255, 255, .08) 0deg 6deg, rgba(255, 255, 255, 0) 6deg 18deg);
}

.mb-acartel__texto {
  position: relative;
  padding: 32px 36px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: min(640px, 100%);

  h1 {
    margin: 0;
    font-family: $fuente-cartel;
    font-weight: 400;
    font-size: clamp(28px, 4.4vw, 44px);
    line-height: 1.02;
    text-shadow: 0 3px 0 rgba(6, 20, 58, .55);
  }

  p { margin: 0; font-weight: 700; font-size: 16px; line-height: 1.45; color: #eef4ff; }

  @include en-celular { padding: 22px 18px; }
}

.mb-acartel__b {
  align-self: flex-start;
  height: 52px;
  padding: 0 32px;
  border-radius: 26px;
  border: 3px solid #fff;
  background: linear-gradient(180deg, #4fa2ff, #2f6fe0);
  color: #fff;
  font-family: inherit;
  font-weight: 900;
  font-size: 17px;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(0, 0, 0, .35);
  @include foco;

  &:hover { filter: brightness(1.06); }
  &:disabled { opacity: .5; cursor: default; }

  &--chico { height: 46px; padding: 0 26px; border-radius: 23px; font-size: 15px; }
}

.mb-acartel__copiado { min-height: 16px; font-weight: 800; font-size: 13px; }

/* ── Las tarjetas ─────────────────────────────────────────────────── */

.mb-acaja {
  border-radius: 22px;
  background: #12233d;
  padding: 14px;
  box-sizing: border-box;
  display: grid;
  gap: 12px;

  &--rejilla { grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); }
  &--col { display: flex; flex-direction: column; }

  /* La ultima tarjeta de la columna se queda con el espacio que sobra. */
  &--col > .mb-adato:last-child { flex: 1; }
}

/*
  LAS DOS COLUMNAS, DE LA MISMA ALTURA.

  La de cobrar tiene menos texto que la del rango, asi que sin esto
  quedaba media caja vacia al lado de una llena. Las dos estiran y la
  tarjeta de abajo se queda con lo que sobre.
*/
.mb-ados {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
  gap: 20px;
  align-items: stretch;

  > .mb-acaja { height: 100%; }
}

.mb-adato {
  border-radius: 16px;
  background: #0b1729;
  padding: 22px 24px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 14px;

  > span:first-child { font-weight: 900; font-size: 11px; letter-spacing: .12em; color: $texto-4; }

  /* `line-height: 1` le corta la panza a la Luckiest Guy, que baja de
     la línea de base. 1.15 la deja entera sin separar las tarjetas. */
  b { display: flex; align-items: center; gap: 8px; font-family: $fuente-cartel; font-weight: 400; font-size: 30px; line-height: 1.15; }

  &--fila { flex-direction: row; align-items: flex-start; justify-content: space-between; gap: 12px; }

  @include en-celular { padding: 16px 18px; b { font-size: 24px; } }
}

.mb-adato__t { display: flex; flex-direction: column; gap: 14px; font-weight: 900; font-size: 11px; letter-spacing: .12em; color: $texto-4; }

.mb-anota { margin: 0; font-weight: 700; font-size: 13px; line-height: 1.5; color: $texto-4; }
.mb-alab { font-weight: 900; font-size: 11px; letter-spacing: .12em; color: $texto-4; }

.mb-acobrar {
  flex: none;
  height: 42px;
  padding: 0 22px;
  border-radius: 12px;
  border: 0;
  background: $verde;
  color: #06331f;
  font-family: inherit;
  font-weight: 900;
  font-size: 14px;
  cursor: pointer;
  @include foco;
  &:disabled { opacity: .45; cursor: default; }
}

/* ── El rango ─────────────────────────────────────────────────────── */

.mb-arango {
  flex: 1;
  border-radius: 16px;
  background:
    radial-gradient(ellipse 70% 80% at 80% 0%, rgba(255, 200, 61, .18) 0%, rgba(11, 23, 41, 0) 70%),
    #0b1729;
  padding: 22px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;

  @include en-celular { padding: 18px; }
}

.mb-arango__cab {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-weight: 900;
  font-size: 11px;
  letter-spacing: .12em;
  color: $texto-4;

  b { color: $placeholder; }
  a { color: $texto-4; font-weight: 800; font-size: 13px; letter-spacing: 0; text-decoration: none; &:hover { color: #fff; } }
}

.mb-arango__quien {
  display: flex;
  align-items: center;
  gap: 12px;

  > span { display: flex; flex-direction: column; min-width: 0; }
  b { font-family: $fuente-cartel; font-weight: 400; font-size: 28px; line-height: 1.1; }
  > span > span { font-weight: 800; font-size: 13px; color: $texto-4; }
}

.mb-arango__modelos {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;

  /* El hibrido es el numero mas largo: ocupa la fila entera. */
  .mb-arango__ancho { grid-column: 1 / -1; }

  > span {
    padding: 10px 12px;
    border-radius: 11px;
    background: #12233d;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  > span > span { font-weight: 900; font-size: 10px; letter-spacing: .1em; color: $texto-4; }
  b { font-weight: 900; font-size: 16px; white-space: nowrap; }
}

.mb-arango__sigue { margin-top: auto; display: flex; flex-direction: column; gap: 6px; }
.mb-arango__fila { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px; font-weight: 800; font-size: 13px; }

.mb-arango__pedir {
  height: 46px;
  border-radius: 23px;
  border: 3px solid #fff;
  background: linear-gradient(180deg, #45b6ff, #1d8fe0);
  color: #fff;
  font-weight: 900;
  font-size: 15px;
  text-decoration: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, .35);
  @include foco;
  &:hover { filter: brightness(1.06); color: #fff; }
}

/* ── Las campañas ─────────────────────────────────────────────────── */

.mb-acab {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px 0;

  /* Con `line-height: 1` la Luckiest Guy pierde la cola de la "j". */
  h2 { margin: 0; font-family: $fuente-cartel; font-weight: 400; font-size: 22px; line-height: 1.25; }
  span { font-weight: 700; font-size: 13px; }
}

/*
  En el celular el titulo y su contador no entran en la misma linea:
  "Your referrals" en Luckiest Guy a 22px se lleva el ancho y el
  contador queda apretado contra el borde. Uno abajo del otro se leen
  los dos. Solo esta cabecera: las otras son mas cortas.
*/
.mb-acab--apilada {
  @include en-celular {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }
}

.mb-acamps { display: flex; flex-direction: column; gap: 10px; }

.mb-acamp {
  border-radius: 16px;
  background: #0b1729;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  @include en-celular { padding: 14px 16px; }
}

.mb-acamp__cab { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }

.mb-acamp__quien {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  b { font-weight: 900; font-size: 16px; }
}

.mb-acamp__url {
  font-weight: 700;
  font-size: 12px;
  color: $texto-4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  b { font-weight: 900; font-size: 12px; color: #8fb4ff; }
}

.mb-acamp__nums {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(45%, 120px), 1fr));
  gap: 10px;

  > span { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  > span > span { font-weight: 900; font-size: 10px; letter-spacing: .1em; color: $texto-4; }
  b { font-weight: 900; font-size: 15px; }
}

.mb-acamp__pies { display: flex; flex-wrap: wrap; gap: 8px; }

.mb-achico {
  height: 40px;
  padding: 0 16px;
  border-radius: 10px;
  border: 0;
  background: #1d3354;
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  font-size: 13px;
  cursor: pointer;
  @include foco;

  &--azul { background: $azul; }
  &--verde { background: $verde; color: #06331f; }
  &:disabled { opacity: .45; cursor: default; }
  &:hover:not(:disabled) { filter: brightness(1.1); }
}

/* ── Crear una campaña ────────────────────────────────────────────── */

.mb-anueva {
  border-radius: 16px;
  background: #0b1729;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  h3 { margin: 0; font-family: $fuente-cartel; font-weight: 400; font-size: 20px; }
}

.mb-acampo {
  display: flex;
  flex-direction: column;
  gap: 6px;
  > span { font-weight: 900; font-size: 11px; letter-spacing: .12em; color: $texto-4; }
}

.mb-ain {
  height: 46px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid $borde-fuerte;
  background: $panel;
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  font-size: 15px;
  box-sizing: border-box;
  width: 100%;
  &:focus { outline: none; border-color: $azul; }
}

.mb-amodelos { display: flex; flex-direction: column; gap: 8px; }

.mb-amodelo {
  padding: 14px;
  border-radius: 14px;
  background: $panel;
  border: 2px solid $borde;
  color: #fff;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  @include foco;

  &.is-elegido { border-color: $verde; }
}

.mb-amodelo__punto {
  flex: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid $borde;

  .is-elegido & { border-color: $verde; background: $verde; }
}

.mb-amodelo__texto {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;

  b { font-weight: 900; font-size: 14px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  > span { font-weight: 700; font-size: 11px; color: $texto-4; }
}

.mb-amodelo__sello {
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(93, 255, 176, .14);
  color: $verde;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: .06em;
}

.mb-amodelo__num {
  flex: none;
  font-family: $fuente-cartel;
  font-weight: 400;
  font-size: 18px;
  text-align: right;

  &.is-cpa { color: $amarillo-v; }
  &.is-revshare { color: #3f9bff; }
  &.is-hibrido { color: $verde; }
}

.mb-acomo {
  padding: 14px;
  border-radius: 12px;
  background: #12233d;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mb-acomo__t { font-weight: 800; font-size: 13px; line-height: 1.55; color: $texto-2; }

/* ── Los sellos ───────────────────────────────────────────────────── */

.mb-achip {
  flex: none;
  padding: 4px 10px;
  border-radius: 999px;
  font-weight: 900;
  font-size: 10px;
  letter-spacing: .04em;
  white-space: nowrap;

  &.is-cpa, &.is-deposito { background: rgba(255, 200, 61, .14); border: 1px solid rgba(255, 200, 61, .45); color: $amarillo-v; }
  &.is-revshare { background: rgba(63, 155, 255, .14); border: 1px solid rgba(63, 155, 255, .45); color: #3f9bff; }
  &.is-hibrido, &.is-califica, &.is-pagado { background: rgba(93, 255, 176, .14); border: 1px solid rgba(93, 255, 176, .45); color: $verde; }
  &.is-nuevo { background: rgba(142, 163, 199, .14); border: 1px solid rgba(142, 163, 199, .4); color: $texto-4; }
  &.is-anulado { background: rgba(255, 154, 165, .14); border: 1px solid rgba(255, 154, 165, .45); color: #ff9aa5; }
}

/* ── La lista ─────────────────────────────────────────────────────── */

.mb-alista {
  border-radius: 16px;
  background: #0b1729;
  overflow: hidden;

  /*
    En el celular deja de ser una caja con renglones y pasa a ser una
    pila de tarjetas, una por referido. El fondo y el recorte se los
    queda cada tarjeta.
  */
  @include en-celular {
    background: none;
    border-radius: 0;
    overflow: visible;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
}

.mb-alista__fila {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1.1fr .9fr .9fr .9fr;
  gap: 10px;
  align-items: center;
  padding: 12px 18px;
  border-bottom: 1px solid #14233c;
  font-weight: 700;
  font-size: 14px;

  &:last-child { border-bottom: 0; }

  &--cab {
    font-weight: 900;
    font-size: 11px;
    letter-spacing: .1em;
    color: $texto-4;
    text-transform: uppercase;
  }

  /*
    UNA TARJETA POR REFERIDO.

    La fila tiene seis datos y en la pantalla grande cada uno cae
    abajo de su cabecera. En el celular la cabecera se escondia y los
    seis valores caian en dos columnas sueltas: el volumen y lo que
    te dejo quedaban como dos numeros sin nombre, imposibles de
    distinguir.

    El orden lo arma `grid-template-areas`, no el orden del HTML: el
    nombre con su estado arriba, la campaña abajo, una linea, y los
    tres numeros en fila con su rotulo encima. El rotulo es el
    `::before` de cada numero y sale de `data-rotulo`. La linea es el
    `::after` de la fila, que en una grilla es una celda como
    cualquier otra.
  */
  @include en-celular {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-template-areas:
      "nombre nombre estado"
      "campana campana campana"
      "linea linea linea"
      "d1 d2 d3";
    column-gap: 8px;
    row-gap: 9px;
    /*
      `stretch` y no `start`: los tres rotulos de abajo no miden lo
      mismo --"lo que jugaron" entra en dos lineas donde "te dejo"
      entra en una-- y con `start` cada numero arrancaba a la altura
      que le tocaba, escalonados. Estirados a la misma altura, los
      tres numeros se apoyan en el mismo renglon.
    */
    align-items: stretch;
    padding: 12px 13px;
    border: 1px solid #14233c;
    border-radius: 14px;
    background: #0b1729;

    &::after { content: ""; grid-area: linea; height: 1px; background: #14233c; }
    &--cab { display: none; }
  }
}

.mb-afila__nombre {
  @include en-celular { grid-area: nombre; font-size: 15px; font-weight: 800; }
}

.mb-afila__estado {
  @include en-celular { grid-area: estado; justify-self: end; }
}

.mb-afila__codigo {
  @include en-celular {
    grid-area: campana;
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .08em;
    text-transform: uppercase;
  }
}

/* La etiquetita, solo en el celular: en la pantalla grande la columna
   ya se llama "Campaign" y el icono seria ruido. */
.mb-afila__tag {
  display: none;
  @include en-celular { display: block; flex: none; }
}

.mb-afila__dato {
  @include en-celular {
    display: flex;
    flex-direction: column;
    /* El rotulo arriba y el numero abajo del todo: ver `stretch`. */
    justify-content: space-between;
    gap: 2px;
    font-size: 14px;
    font-weight: 800;

    &::before {
      content: attr(data-rotulo);
      font-size: 10px;
      font-weight: 900;
      letter-spacing: .09em;
      text-transform: uppercase;
      color: $texto-4;
    }

    &:nth-child(4) { grid-area: d1; }
    &:nth-child(5) { grid-area: d2; }
    &:nth-child(6) { grid-area: d3; }
  }
}

.mb-der { text-align: right; font-variant-numeric: tabular-nums; @include en-celular { text-align: left; } }

/* ── El programa ──────────────────────────────────────────────────── */

.mb-aprog {
  border-radius: 16px;
  background: #0b1729;
  padding: 22px 24px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;

  @include en-celular { padding: 18px; }
}

.mb-aprog__texto {
  display: flex;
  flex-direction: column;
  gap: 6px;
  b { font-family: $fuente-cartel; font-weight: 400; font-size: 24px; }
  > span:last-child { font-weight: 700; font-size: 14px; }
}

/* ── Lo vacío y los colores ───────────────────────────────────────── */

.mb-avacio {
  border-radius: 16px;
  background: #0b1729;
  padding: 36px 10px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 6px;
  span:first-child { font-weight: 900; font-size: 16px; }
}

.mb-tenue { color: $texto-4; }
.mb-verde { color: $verde; }
.mb-ambar { color: $amarillo-v; }
.mb-azul { color: #3f9bff; }
.mb-lila { color: #c4b5fd; }
</style>
