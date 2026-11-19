<template>
  <div class="mb-abrir">
    <p v-if="cargando" class="mb-vacio">{{ $t('common.loading') }}</p>

    <template v-else-if="caja">
      <!-- ── Volver · nombre de la caja ───────────────────────────── -->
      <div class="mb-abrir__barra">
        <button type="button" class="mb-abrir__volver" @click="$router.back()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.8"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
          <span>{{ $t('common.back') }}</span>
        </button>

        <div class="mb-abrir__quien">
          <span v-if="lamina" class="mb-art mb-abrir__arte" :class="lamina.clase" :style="lamina.estilo" aria-hidden="true"></span>
          <h1>{{ caja.name }}</h1>
        </div>

        <!-- Los tres del prototipo: la prueba del sorteo, el sonido y
             el sello de que esta caja se puede verificar. -->
        <div class="mb-abrir__botones">
          <button type="button" class="mb-cuadrado" :aria-label="$t('box.fairness')" @click="verJusto = !verJusto">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c9d7f7" stroke-width="2.2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 3v18M7 7l-4 8h8zM17 7l-4 8h8zM6 7h12" />
            </svg>
          </button>

          <button
            type="button" class="mb-cuadrado" :aria-pressed="String(mudo)"
            :aria-label="mudo ? $t('box.unmute') : $t('box.mute')" @click="mudo = !mudo"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c9d7f7" stroke-width="2.2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M11 5 6 9H3v6h3l5 4z" />
              <path :d="mudo ? 'M17 9l4 6M21 9l-4 6' : 'M16 8.5a5 5 0 0 1 0 7M19 6a9 9 0 0 1 0 12'" />
            </svg>
          </button>

          <span class="mb-cuadrado mb-cuadrado--sello" :title="$t('box.verified')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6bb4ff" stroke-width="2.4"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 3l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V6zM9 12l2 2 4-4" />
            </svg>
          </span>
        </div>
      </div>

      <!-- Como se sortea, cuando alguien toca la balanza. -->
      <p v-if="verJusto" class="mb-justo">{{ $t('box.fairnessHelp') }}</p>

      <!-- ── La cinta ─────────────────────────────────────────────── -->
      <mb-ruleta
        ref="ruleta" :premios="caja.prizes" :cuantas="veces"
        :rapido="rapido" :nombre-de-la-caja="caja.name" @termino="alFrenar"
      />

      <!-- ── Los mandos ───────────────────────────────────────────── -->
      <div class="mb-mandos">
        <div class="mb-veces" role="radiogroup" :aria-label="$t('box.howMany')">
          <button
            v-for="n in [1, 2, 3, 4]" :key="n" type="button" role="radio"
            :aria-checked="veces === n ? 'true' : 'false'"
            :class="{ 'is-activo': veces === n }" :disabled="girando" @click="veces = n"
          >{{ n }}</button>
        </div>

        <div class="mb-mandos__botones">
          <button
            v-if="gratisDeEstaCaja" type="button" class="mb-amarillo"
            :disabled="girando" @click="abrir(true)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#0b2266" aria-hidden="true">
              <path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7" />
            </svg>
            {{ $t('box.openFree') }}
          </button>

          <button type="button" class="mb-azul" :disabled="girando" @click="abrir(false)">
            <span class="mb-azul__cartel">{{ girando ? $t('box.opening') : $t('box.open') }}</span>
            <span class="mb-azul__precio">
              <span class="mb-sc mb-sc--18" aria-hidden="true">SC</span>{{ plata(total) }}
            </span>
          </button>

          <!--
            EL BOTON DE PRUEBA, CON LAS QUE LE QUEDAN.

            Son contadas, asi que el numero va encima del boton: sin el
            globito, el jugador se entera de que se le acabaron recien
            cuando lo aprieta y no pasa nada.
          -->
          <button
            type="button" class="mb-demo" :disabled="girando || !demosRestantes"
            :title="$tc('box.demosLeft', demosRestantes, { n: demosRestantes })" @click="probar"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff"
                 stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
            {{ $t('box.demo') }}
            <span class="mb-demo__cuenta" aria-hidden="true">{{ demosRestantes }}</span>
          </button>
        </div>

        <div class="mb-mandos__dos">
          <!-- Rapido: la misma tirada en 1,6s en vez de 5,2s. -->
          <button
            type="button" class="mb-cuadrado mb-cuadrado--grande" :aria-pressed="String(rapido)"
            :class="{ 'is-on': rapido }" :aria-label="$t('box.fast')" @click="rapido = !rapido"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" :fill="rapido ? '#0b2266' : 'none'"
                 :stroke="rapido ? '#0b2266' : '#c9d7f7'" stroke-width="2.2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
            </svg>
          </button>

          <!--
            AUTO.

            Sigue abriendo solo hasta que se apaga o hasta que no
            alcanza el saldo. Se apaga sola al quedarse sin plata: una
            pantalla que sigue intentando y fallando no es una
            comodidad, es un cartel de error repetido.
          -->
          <button
            type="button" role="switch" class="mb-auto" :aria-checked="String(automatico)"
            @click="automatico = !automatico"
          >
            {{ $t('box.auto') }}
            <span class="mb-auto__riel" :class="{ 'is-on': automatico }" aria-hidden="true"><span></span></span>
          </button>
        </div>
      </div>

      <div class="mb-abrir__salida">
        <!-- Lo que salió, en una línea. -->
        <div v-if="resultado" class="mb-salio" aria-live="polite">
          <span>{{ resultado.demo ? $t('box.demoNote') : $t('box.youWon') }}</span>
          <span class="mb-salio__punto" aria-hidden="true">·</span>
          <span class="mb-salio__que">{{ queSalio }}</span>
          <span class="mb-salio__punto" aria-hidden="true">·</span>
          <span class="mb-salio__valor">
            <span class="mb-sc mb-sc--16" aria-hidden="true">SC</span>{{ plata(valorGanado) }}
          </span>

          <template v-if="!resultado.demo">
            <button type="button" class="mb-salio__b" :disabled="vendiendo" @click="venderTodo">
              {{ $t('box.sellFor', { amount: 'SC ' + plata(valorGanado) }) }}
            </button>
            <router-link to="/inventory" class="mb-salio__b">{{ $t('box.keep') }}</router-link>
          </template>
        </div>
      </div>

      <!-- ── Lo que puede salir ───────────────────────────────────── -->
      <section class="mb-contenido">
        <div class="mb-contenido__titulo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#c9d7f7" aria-hidden="true">
            <path d="M4 6h11v14H4zM7 3h11v14h-1.5V4.5H7z" />
          </svg>
          <h2>{{ $t('box.contents') }}</h2>
          <span class="mb-contenido__cuantos">{{ caja.prizes.length }}</span>
        </div>

        <!-- Las cinco rarezas, cada una con cuántas hay. -->
        <div class="mb-row mb-rarezas" role="tablist" :aria-label="$t('box.rarity')">
          <button
            v-for="r in rarezas" :key="r.id" type="button" role="tab"
            :aria-selected="rareza === r.id ? 'true' : 'false'"
            :class="{ 'is-activa': rareza === r.id }"
            :style="{ borderColor: rareza === r.id ? r.color : 'transparent' }"
            @click="rareza = r.id"
          >
            <span class="mb-rarezas__punto" :style="{ background: r.color }" aria-hidden="true"></span>
            {{ $t(r.texto) }}
            <span class="mb-rarezas__n" :style="{ background: r.color }">{{ r.cuantos }}</span>
          </button>
        </div>

        <div class="mb-orden">
          <button type="button" :class="{ 'is-activo': orden === 'valor' }" @click="orden = 'valor'">
            {{ $t('box.highestValue') }}
          </button>
          <button type="button" :class="{ 'is-activo': orden === 'chance' }" @click="orden = 'chance'">
            {{ $t('box.bestOdds') }}
          </button>
        </div>

        <div class="mb-premios">
          <article
            v-for="(p, i) in premiosALaVista" :key="i" class="mb-premio"
            :style="{ background: fondoDe(p) }"
          >
            <div class="mb-premio__alto">
              <span class="mb-premio__chance">{{ chance(p.chance) }}</span>
              <span class="mb-premio__marca" :style="{ color: color(p.rarity) }">MB</span>
            </div>

            <div class="mb-premio__foto">
              <span class="mb-premio__marco mb-premio__marco--izq" :style="{ borderColor: color(p.rarity) }" aria-hidden="true"></span>
              <span class="mb-premio__marco mb-premio__marco--der" :style="{ borderColor: color(p.rarity) }" aria-hidden="true"></span>
              <span
                v-if="spr(p)" class="mb-prod mb-premio__img" :style="spr(p)"
                role="img" :aria-label="p.name"
              ></span>
              <img v-else-if="p.imageUrl" class="mb-premio__img" :src="p.imageUrl" :alt="p.name">
            </div>

            <span class="mb-premio__nombre">{{ p.name }}</span>
            <span class="mb-premio__valor">
              <span class="mb-sc mb-sc--16" aria-hidden="true">SC</span>{{ plata(p.valueSc) }}
            </span>
            <span class="mb-premio__barra" :style="{ background: color(p.rarity) }" aria-hidden="true"></span>
          </article>
        </div>

        <p class="mb-contenido__retorno">
          {{ $t('box.returnLabel', { pct: (caja.retorno * 100).toFixed(2) }) }}
        </p>
      </section>
    </template>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import api from "@/api";
import MbRuleta from "@/components/MbRuleta.vue";
import { sprite } from "@/utils/sprite";
import { despertar, silenciar, sonarPremio } from "@/utils/sonido";

const COLORES = {
  blue: "#3f7cf0", purple: "#8b4fe0", pink: "#e0418f", red: "#e2424b", gold: "#f5b80a",
};

const RAREZAS = [
  { id: "all", texto: "boxes.allCategories", color: "#8ea3c7" },
  { id: "gold", texto: "rarity.gold", color: COLORES.gold },
  { id: "red", texto: "rarity.red", color: COLORES.red },
  { id: "pink", texto: "rarity.pink", color: COLORES.pink },
  { id: "purple", texto: "rarity.purple", color: COLORES.purple },
  { id: "blue", texto: "rarity.blue", color: COLORES.blue },
];

/**
 * ABRIR UNA CAJA.
 *
 * LA CINTA NO DECIDE NADA
 *
 * Esto es lo que diferencia esta pantalla del prototipo. Allá el premio
 * lo elegía el navegador y la cinta frenaba donde él decía. Acá se le
 * pregunta al SERVIDOR --que cobra, sortea con la semilla comprometida
 * y guarda el recibo-- y recién entonces la cinta arranca, con el premio
 * de verdad puesto donde va a frenar.
 *
 * Por eso el saldo baja apenas se toca el botón y no cuando la cinta
 * para: la jugada ya pasó, la animación es el relato.
 *
 * LAS CHANCES ESTAN A LA VISTA
 *
 * Abajo, con todo lo que puede salir, separado por rareza como en el
 * diseño. Debajo de un décimo de porciento se muestran como
 * "1 / 250.000", porque "0,0004%" no le dice nada a nadie.
 */
export default {
  name: "BoxView",
  components: { MbRuleta },

  data() {
    return {
      caja: null,
      cargando: true,
      /* Las que gasto en esta pantalla sin sesion (ver demosRestantes). */
      demosUsadasAqui: 0,
      veces: 1,
      rapido: false,
      mudo: false,
      automatico: false,
      verJusto: false,
      relojAuto: null,
      girando: false,
      vendiendo: false,
      resultado: null,
      pendiente: null,
      rareza: "all",
      orden: "valor",
    };
  },

  computed: {
    ...mapGetters(["entro", "saldo"]),

    /** Cuantas pruebas gratis le quedan, de las que dice el panel. */
    demosRestantes() {
      const tope = Number(this.caja && this.caja.aperturasDeDemo) || 0;
      const usadas = this.entro
        ? Number(this.$store.state.usuario && this.$store.state.usuario.demosUsadas) || 0
        : this.demosUsadasAqui;

      return Math.max(0, tope - usadas);
    },

    /*
      LA GRATIS ES DE ESTA CAJA.

      El regalo son tres cajas, una apertura en cada una: el boton
      amarillo aparece solo en las tres que le tocaron y solo mientras
      no la haya abierto. El servidor manda el dato con la caja.
    */
    gratisDeEstaCaja() { return !!(this.caja && this.caja.gratisAca); },

    lamina() { return this.caja ? sprite(this.caja.imageUrl) : null; },

    /** Las rarezas con cuántos premios tiene cada una. */
    rarezas() {
      const lista = (this.caja && this.caja.prizes) || [];
      return RAREZAS.map((r) => ({
        ...r,
        cuantos: r.id === "all" ? lista.length : lista.filter((p) => p.rarity === r.id).length,
      })).filter((r) => r.cuantos > 0 || r.id === "all");
    },

    premiosALaVista() {
      const lista = [...((this.caja && this.caja.prizes) || [])]
        .filter((p) => this.rareza === "all" || p.rarity === this.rareza);

      return this.orden === "chance"
        ? lista.sort((a, b) => b.chance - a.chance)
        : lista.sort((a, b) => b.valueSc - a.valueSc);
    },

    total() {
      return Math.round((this.caja ? this.caja.priceSc : 0) * this.veces * 100) / 100;
    },

    valorGanado() {
      if (!this.resultado) return 0;
      return Math.round(
        this.resultado.resultados.reduce((a, r) => a + r.premio.valueSc, 0) * 100
      ) / 100;
    },

    /** Lo que salió, en una línea: el nombre, o "4 objetos". */
    queSalio() {
      if (!this.resultado) return "";
      const r = this.resultado.resultados;
      if (r.length === 1) return r[0].premio.name;
      return this.$t("box.items", { n: r.length });
    },
  },

  methods: {
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },

    color(r) { return COLORES[r] || COLORES.blue; },

    spr(p) {
      const s = sprite(p.imageUrl);
      return s ? s.estilo : null;
    },

    fondoDe(p) {
      const c = this.color(p.rarity);
      return `radial-gradient(ellipse 80% 55% at 50% 30%, ${c}40 0%, rgba(18,33,58,0) 70%), #12213a`;
    },

    chance(c) {
      const pct = c * 100;
      if (pct >= 0.1) return pct.toFixed(2) + "%";
      return "1 / " + Math.round(1 / c).toLocaleString("en-US");
    },

    async traer() {
      this.cargando = true;
      this.resultado = null;
      try {
        const { data } = await api.get(`/boxes/${this.$route.params.slug}`);
        this.caja = data.data;
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
        this.$router.push("/boxes");
      } finally {
        this.cargando = false;
      }
    },

    /**
     * Abre de verdad.
     *
     * Primero el servidor, después la cinta. Si el servidor dice que no
     * --no alcanza el saldo, la caja se apagó-- no se anima nada: sería
     * mentirle al jugador con un giro que no pasó.
     */
    async abrir(gratis) {
      if (!this.entro) {
        this.$router.push("/signup");
        return;
      }

      /* El navegador no deja sonar hasta que alguien toca algo: este
         click es ese momento. */
      despertar();

      this.girando = true;
      this.resultado = null;
      try {
        const { data } = await api.post(`/boxes/${this.caja.slug}/open`, {
          veces: gratis ? 1 : this.veces,
        });
        this.$store.commit("saldo", data.data);
        this.$store.commit("inventarioCambio");
        this.pendiente = data.data;

        /* Si esta era la gratis de esta caja, ya no lo es. */
        if (data.data.resultados.some((r) => r.conAperturaGratis)) {
          this.caja = { ...this.caja, gratisAca: false };
        }

        await this.$refs.ruleta.girar(data.data.resultados.map((r) => r.premio));

        /*
          AUTOMATICO: SIGUE SOLO.

          Con una pausa para que se vea lo que salió. Se apaga sola si
          ya no alcanza el saldo: seguir intentando y fallando no es
          una comodidad, es un cartel de error repetido.
        */
        if (this.automatico && !gratis) {
          if (this.saldo < this.total) {
            this.automatico = false;
            this.$store.dispatch("avisar", { texto: this.$t("box.autoOff") });
            return;
          }
          this.relojAuto = window.setTimeout(() => {
            if (this.automatico) this.abrir(false);
          }, 1200);
        }
      } catch (err) {
        this.girando = false;
        this.automatico = false;
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    /*
      CUANTAS PRUEBAS LE QUEDAN.

      Con sesion las cuenta el servidor --van en la cuenta y no se
      pueden borrar desde el navegador-- y sin sesion las cuenta esta
      pantalla, que es lo unico que hay. El demo no mueve un peso, asi
      que alcanza.
    */
    demosGuardadas() {
      try {
        return Number(window.localStorage.getItem("mrbox:demos") || 0) || 0;
      } catch {
        return 0;
      }
    },

    anotarDemo(veces) {
      if (this.entro) return;
      try {
        window.localStorage.setItem("mrbox:demos", String(this.demosGuardadas() + veces));
      } catch {
        /* Sin almacenamiento no se cuentan, y es lo de menos. */
      }
      this.demosUsadasAqui += veces;
    },

    async probar() {
      this.girando = true;
      this.resultado = null;
      try {
        const { data } = await api.post(`/boxes/${this.caja.slug}/demo`, { veces: this.veces });
        this.pendiente = data.data;
        this.anotarDemo(this.veces);
        await this.$refs.ruleta.girar(data.data.resultados.map((r) => r.premio));
      } catch (err) {
        this.girando = false;
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    /* La cinta frenó: recién ahora se le muestra qué salió. */
    alFrenar() {
      this.girando = false;
      this.resultado = this.pendiente;
      this.pendiente = null;

      /* El acorde va por lo MEJOR que salió de la tanda: abrir cuatro y
         escuchar el sonido del peor premio es un anticlímax. */
      const mejor = (this.resultado.resultados || [])
        .reduce((a, r) => (!a || r.premio.valueSc > a.premio.valueSc ? r : a), null);
      sonarPremio(mejor && mejor.premio.rarity);
    },

    async venderTodo() {
      this.vendiendo = true;
      try {
        const ids = this.resultado.resultados.map((r) => r.premio._id).filter(Boolean);
        const { data } = await api.post("/inventory/sell-many", { ids });
        this.$store.commit("saldo", data.data);
        this.$store.commit("inventarioCambio");
        this.$store.dispatch("avisar", {
          texto: this.$t("box.sellFor", { amount: "SC " + this.plata(data.data.totalSc) }),
        });
        this.resultado = null;
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.vendiendo = false;
      }
    },
  },

  created() {
    this.demosUsadasAqui = this.demosGuardadas();
    this.traer();
  },

  beforeDestroy() {
    window.clearTimeout(this.relojAuto);
    /* Que no quede mudo el resto del sitio por haber apagado el sonido
       en una caja. */
    silenciar(false);
  },

  watch: {
    /* El modulo de sonido es uno solo para toda la pantalla: la cinta
       tambien lo usa para los tics. */
    mudo: { immediate: true, handler(v) { silenciar(v); } },

    /* Apagar el automatico corta la cadena pendiente. */
    automatico(v) { if (!v) window.clearTimeout(this.relojAuto); },

    "$route.params.slug"() { this.veces = 1; this.traer(); },
  },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-abrir { display: flex; flex-direction: column; gap: 16px; }
.mb-vacio { margin: 40px 0; text-align: center; color: $texto-4; }

/* ── Arriba ───────────────────────────────────────────────────────── */

.mb-abrir__barra {
  display: grid;
  /*
    En un telefono el nombre de la caja se montaba arriba de los tres
    botones. Dos arreglos, los dos necesarios:

    - La del medio es `minmax(0, auto)`: una columna `auto` nunca se
      achica mas que su palabra mas larga, y asi el nombre se recorta
      con puntitos, que es lo que ya pedia el h1.
    - Las de los costados arrancan en `min-content`: con el minimo en
      cero, la de los botones quedaba mas angosta que los botones y,
      como van pegados a la derecha, se salian para el lado del nombre.
  */
  grid-template-columns: minmax(min-content, 1fr) minmax(0, auto) minmax(min-content, 1fr);
  align-items: center;
  gap: 10px;
}

.mb-abrir__volver {
  justify-self: start;
  min-width: 0;
  /* En celular queda la flechita sola: el nombre de la caja va al
     medio y es lo que importa. */
  @include en-celular { padding: 0; span { display: none; } }
  height: 44px;
  padding: 0 8px;
  border: 0;
  background: transparent;
  color: #fff;
  font-family: inherit;
  font-weight: 900;
  font-size: 14px;
  letter-spacing: .04em;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  @include foco;
}

.mb-abrir__quien { display: flex; align-items: center; gap: 10px; min-width: 0; }
.mb-abrir__arte {
  width: 46px;
  height: 46px;
  flex: none;
  /* En un telefono la tapita se va: abajo esta la caja entera, y esos
     46 px son los que le faltaban al nombre para entrar sin puntitos. */
  @include en-celular { display: none; }
}

.mb-abrir__quien h1 {
  margin: 0;
  font-weight: 900;
  font-size: clamp(16px, 2.4vw, 22px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Los mandos ───────────────────────────────────────────────────── */

.mb-mandos {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;

  /*
    EN EL TELEFONO SE ARMA EN DOS RENGLONES, COMO EL DISEÑO.

      [1][2][3][4]                    [Auto ●]
      [      ABRIR  SC 1,12      ][Demo][rayo]

    En la compu no cambia nada: ahí los tres grupos entran en una línea
    y es como está dibujado.

    Para poder mezclar los grupos sin tocar el HTML, en celular los dos
    contenedores pasan a `display: contents`: sus botones se vuelven
    hijos directos de esta fila y se acomodan con `order`. Es la única
    manera de que el Auto suba al primer renglón y el rayo baje al
    segundo sin armar un DOM distinto para cada tamaño.
  */
  @include en-celular {
    gap: 8px;

    .mb-mandos__botones, .mb-mandos__dos { display: contents; }

    .mb-veces { order: 1; }
    .mb-auto { order: 2; margin-left: auto; }

    /* El de gratis, cuando está, se lleva el renglón entero. */
    .mb-amarillo { order: 3; flex: 1 1 100%; justify-content: center; }

    /*
      Y el de abrir empuja: con 140px de base no entra arriba, así que
      el renglón se corta solo y Demo y el rayo lo acompañan abajo.
    */
    .mb-azul { order: 4; flex: 1 1 140px; min-width: 0; }
.mb-demo { order: 5; flex: none; }
    .mb-cuadrado--grande { order: 6; }
  }
}


/* Los tres cuadraditos de la cabecera y el de rapido. */
.mb-cuadrado {
  width: 44px;
  height: 44px;
  flex: none;
  border-radius: 10px;
  border: 0;
  background: #16253f;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  @include foco;
  &:hover { background: $panel-hover; }

  &--sello { background: #17305e; cursor: default; }
  &--grande { width: 46px; height: 46px; border-radius: 12px; }
  &.is-on { background: $amarillo-v; }
}

.mb-abrir__botones { justify-self: end; display: flex; gap: 8px; }

.mb-justo {
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: $panel-alto;
  border: 1px solid $borde;
  font-size: 13px;
  line-height: 1.5;
  color: $texto-3;
}

.mb-mandos__dos { display: flex; align-items: center; gap: 8px; }

.mb-auto {
  height: 46px;
  padding: 0 12px 0 14px;
  border-radius: 12px;
  border: 0;
  background: $panel-alto;
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  @include foco;
}

.mb-auto__riel {
  position: relative;
  width: 44px;
  height: 26px;
  border-radius: 13px;
  background: #2a3d5e;
  transition: background .15s ease;

  span {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #fff;
    transition: left .15s ease;
  }

  &.is-on { background: $azul; span { left: 21px; } }
}

.mb-abrir__salida { display: flex; flex-direction: column; gap: 10px; }

.mb-veces {
  display: flex;
  gap: 2px;
  padding: 4px;
  border-radius: 12px;
  background: $panel-alto;

  button {
    width: 40px;
    height: 38px;
    border-radius: 9px;
    border: 0;
    background: transparent;
    color: $texto-4;
    font-family: inherit;
    font-weight: 900;
    font-size: 15px;
    cursor: pointer;
    @include foco;
    &.is-activo { background: #24365e; color: #fff; }
    &:disabled { opacity: .5; cursor: default; }
  }
}

.mb-rapido {
  height: 46px;
  padding: 0 12px 0 14px;
  @include en-celular { padding: 0 10px; font-size: 13px; }
  border-radius: 12px;
  border: 0;
  background: $panel-alto;
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  @include foco;
}

.mb-rapido__estado {
  font-size: 12px;
  color: $texto-4;
  @include en-celular { display: none; }
}

.mb-rapido__riel {
  position: relative;
  width: 36px;
  height: 20px;
  border-radius: 10px;
  background: #2a3d5e;
  transition: background .2s ease;

  span {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    transition: left .2s ease;
  }

  &.is-on { background: $azul; span { left: 19px; } }
}

.mb-mudo {
  width: 46px;
  height: 46px;
  flex: none;
  border-radius: 12px;
  border: 0;
  background: $panel-alto;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  @include foco;
}

.mb-mandos__botones { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }

.mb-azul {
  flex: 1;
  justify-content: center;
  height: 50px;
  padding: 0 16px;
  border-radius: 25px;
  border: 3px solid #fff;
  background: linear-gradient(180deg, #4fa2ff 0%, #2f6fe0 100%);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: inherit;
  @include foco;
  &:hover:not(:disabled) { filter: brightness(1.07); }
  &:disabled { opacity: .6; cursor: default; }
}

.mb-azul__cartel {
  font-family: $fuente-cartel;
  font-size: 20px;
  letter-spacing: .03em;
  font-style: italic;
}

.mb-azul__precio { display: flex; align-items: center; gap: 6px; font-weight: 900; font-size: 15px; }

.mb-amarillo {
  flex: 1 1 100%;
  justify-content: center;
  white-space: nowrap;
  height: 50px;
  padding: 0 22px;
  border-radius: 25px;
  border: 3px solid #fff;
  background: linear-gradient(180deg, #ffd65a 0%, #f2a91c 100%);
  color: $azul-tinta;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: inherit;
  font-weight: 900;
  font-size: 16px;
  @include foco;
  &:disabled { opacity: .6; cursor: default; }
}

.mb-amarillo__cuantas {
  padding: 2px 8px;
  border-radius: 8px;
  background: rgba(11, 34, 102, .18);
  font-size: 13px;
}

.mb-demo {
  position: relative;
  height: 50px;
  padding: 0 18px;
  border-radius: 25px;
  border: 2px solid #3a5687;
  background: $panel-alto;
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  font-size: 15px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  @include foco;
  &:disabled { opacity: .6; cursor: default; }
}

.mb-salio {
  align-self: center;
  padding: 6px 14px;
  border-radius: 10px;
  background: $panel-alto;
  font-weight: 800;
  font-size: 13px;
  color: $texto-2;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.mb-salio__punto { opacity: .5; }
.mb-salio__que { color: #fff; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mb-salio__valor { display: flex; align-items: center; gap: 5px; color: $verde; font-weight: 900; }

.mb-salio__b {
  height: 32px;
  padding: 0 12px;
  border-radius: 9px;
  border: 0;
  background: #1d3354;
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  font-size: 12px;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  @include foco;
  &:hover { background: $lateral-hover; color: #fff; }
  &:disabled { opacity: .5; cursor: default; }
}

/* ── Lo que puede salir ───────────────────────────────────────────── */

.mb-contenido { display: flex; flex-direction: column; gap: 14px; margin-top: 8px; }
.mb-contenido__titulo { display: flex; align-items: center; gap: 10px; h2 { margin: 0; font-weight: 900; font-size: 18px; } }

.mb-contenido__cuantos {
  padding: 2px 9px;
  border-radius: 8px;
  background: #1d3354;
  font-weight: 900;
  font-size: 13px;
}

.mb-rarezas {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 6px;
  border-radius: 14px;
  background: $panel;

  button {
    flex: none;
    height: 42px;
    padding: 0 14px;
    border-radius: 10px;
    border: 2px solid transparent;
    background: $panel-alto;
    color: #fff;
    font-family: inherit;
    font-weight: 800;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    @include foco;
  }
}

.mb-rarezas__punto { width: 14px; height: 18px; border-radius: 4px; }
.mb-rarezas__n { padding: 2px 7px; border-radius: 6px; font-size: 11px; font-weight: 900; color: #0b1424; }

.mb-orden {
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 12px;
  background: $panel;
  align-self: flex-start;

  button {
    height: 38px;
    padding: 0 14px;
    border-radius: 9px;
    border: 0;
    background: transparent;
    color: #fff;
    font-family: inherit;
    font-weight: 800;
    font-size: 14px;
    cursor: pointer;
    @include foco;
    &.is-activo { background: $azul; }
  }
}

.mb-premios {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(46%, 170px), 1fr));
  gap: 12px;
}

.mb-premio {
  position: relative;
  overflow: hidden;
  border-radius: 14px;
  padding: 10px 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.mb-premio__alto { display: flex; justify-content: space-between; align-items: center; }
.mb-premio__chance { font-weight: 900; font-size: 12px; color: $texto-2; }
.mb-premio__marca { font-family: $fuente-cartel; font-size: 13px; }

.mb-premio__foto { position: relative; width: 100%; aspect-ratio: 1 / 1; }

.mb-premio__marco {
  position: absolute;
  inset: 4% 16%;
  border-radius: 10px;
  border: 2px solid;

  &--izq { opacity: .35; transform: rotate(-6deg); }
  &--der { opacity: .2; transform: rotate(6deg); }
}

.mb-premio__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 6px 10px rgba(0, 0, 0, .45));
}

.mb-premio__nombre {
  font-weight: 900;
  font-size: 12px;
  line-height: 1.25;
  height: 30px;
  overflow: hidden;
  text-align: center;
  text-transform: uppercase;
}

.mb-premio__valor {
  align-self: center;
  display: flex;
  align-items: center;
  gap: 5px;
  font-weight: 900;
  font-size: 15px;
}

.mb-premio__barra {
  position: absolute;
  left: 30%;
  right: 30%;
  bottom: 0;
  height: 4px;
  border-radius: 4px 4px 0 0;
}

.mb-contenido__retorno { margin: 0; font-size: 13px; color: $texto-4; }

/*
  EL GLOBITO DE LAS PRUEBAS QUE LE QUEDAN.

  Pegado a la esquina del boton, como en el prototipo: sin el, uno se
  entera de que se le acabaron recien cuando aprieta y no pasa nada.
*/
.mb-demo { position: relative; overflow: visible; }

.mb-demo__cuenta {
  position: absolute;
  right: -6px;
  top: -8px;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  box-sizing: border-box;
  border-radius: 10px;
  background: $azul;
  border: 2px solid $fondo;
  font-weight: 900;
  font-size: 11px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

</style>
