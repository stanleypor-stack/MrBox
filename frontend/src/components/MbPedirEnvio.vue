<template>
  <div class="mb-env" @click.self="cerrar">
    <div class="mb-env__caja" role="dialog" aria-modal="true" :aria-label="$t('ship.title')">
      <div class="mb-env__cabeza">
        <span class="mb-env__cabeza-t">{{ $t('ship.title') }}</span>
        <button type="button" class="mb-env__x" :aria-label="$t('action.cancel')" @click="cerrar">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"
               stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>

      <div class="mb-env__cuerpo">
        <!-- Los tres pasos, menos cuando está trabado o ya terminó. -->
        <div v-if="paso !== 'trabado' && paso !== 'listo'" class="mb-env__pasos">
          <template v-for="(p, i) in PASOS">
            <span
              :key="p" class="mb-env__paso"
              :class="{ 'is-ahora': ORDEN[paso] === i + 1, 'is-hecho': ORDEN[paso] > i + 1 }"
            >
              <span class="mb-env__paso-n">{{ i + 1 }}</span>{{ $t('ship.step.' + p) }}
            </span>
            <span v-if="i < PASOS.length - 1" :key="`r${p}`" class="mb-env__raya"></span>
          </template>
        </div>

        <!-- ── Sin verificar no hay envío ──────────────────────── -->
        <div v-if="paso === 'trabado'" class="mb-env__candado">
          <span class="mb-env__candado-ico" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
              <rect x="4" y="10" width="16" height="11" rx="2.5" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14.5v2.5" />
            </svg>
          </span>
          <b class="mb-env__candado-t">{{ $t('ship.lockedTitle') }}</b>
          <p class="mb-env__candado-p">{{ $t('ship.lockedBody') }}</p>
          <p class="mb-env__candado-n">
            {{ $t('wallet.verifyLevel', { tiene: nivel, pide: nivelQuePide }) }}
          </p>
          <router-link
            to="/profile?tab=verification" class="mb-env__b mb-env__b--enlace"
            @click.native="cerrar"
          >{{ $t('wallet.verifyCta') }}</router-link>
        </div>

        <!-- ── 1. Qué mandamos ─────────────────────────────────── -->
        <template v-else-if="paso === 'objetos'">
          <div class="mb-env__objetos">
            <div v-for="o in objetos" :key="o._id" class="mb-env__objeto">
              <span v-if="arte(o)" class="mb-prod mb-env__foto" :style="arte(o)" aria-hidden="true"></span>
              <span v-else class="mb-env__foto" aria-hidden="true"></span>
              <span class="mb-env__nombre">{{ o.name }}</span>
              <span class="mb-env__valor">
                <span class="mb-sc mb-sc--16" aria-hidden="true">SC</span>{{ plata(o.valueSc) }}
              </span>
            </div>
          </div>

          <div class="mb-env__total">
            <span>{{ $tc('ship.nItems', objetos.length, { n: objetos.length }) }}</span>
            <span class="mb-env__valor">
              <span class="mb-sc mb-sc--16" aria-hidden="true">SC</span>{{ plata(valorTotal) }}
            </span>
          </div>

          <p class="mb-env__aviso mb-env__aviso--ojo">{{ $t('ship.noRefund') }}</p>

          <div class="mb-env__pie">
            <button type="button" class="mb-env__b mb-env__b--fantasma" @click="cerrar">
              {{ $t('action.cancel') }}
            </button>
            <button type="button" class="mb-env__b" @click="aDirecciones">{{ $t('ship.pickAddress') }}</button>
          </div>
        </template>

        <!-- ── 2. A dónde ──────────────────────────────────────── -->
        <template v-else-if="paso === 'direccion'">
          <span class="mb-env__rotulo">{{ $t('profile.addresses') }}</span>

          <p v-if="!direcciones.length" class="mb-env__vacio">{{ $t('profile.noAddresses') }}</p>

          <div v-else class="mb-env__dirs">
            <button
              v-for="d in direcciones" :key="d._id" type="button"
              class="mb-env__dir" :class="{ 'is-elegida': elegida === d._id }"
              :aria-pressed="String(elegida === d._id)" @click="elegida = d._id"
            >
              <span class="mb-env__radio" aria-hidden="true"></span>
              <span class="mb-env__dir-t">
                <b>{{ d.nombre }}</b>
                <span v-if="d.predeterminada" class="mb-env__chapa">{{ $t('profile.defaultAddress') }}</span><br>
                {{ d.calle }}<template v-if="d.calle2">, {{ d.calle2 }}</template><br>
                {{ d.ciudad }}<template v-if="d.provincia">, {{ d.provincia }}</template> {{ d.codigoPostal }}<br>
                {{ d.pais }}<template v-if="d.telefono"> · {{ d.telefono }}</template>
              </span>
            </button>
          </div>

          <div class="mb-env__pie">
            <button type="button" class="mb-env__b mb-env__b--fantasma" @click="abrirForma">
              {{ $t('profile.addAddress') }}
            </button>
            <button type="button" class="mb-env__b" :disabled="!elegida" @click="paso = 'confirmar'">
              {{ $t('action.continue') }}
            </button>
          </div>
        </template>

        <!-- ── 2b. Una dirección nueva ─────────────────────────── -->
        <template v-else-if="paso === 'nueva'">
          <span class="mb-env__rotulo">{{ $t('profile.addAddress') }}</span>
          <p class="mb-env__p">{{ $t('ship.addressSub') }}</p>

          <form class="mb-env__forma" @submit.prevent="guardarDireccion">
            <label v-for="c in CAMPOS" :key="c.campo" class="mb-env__campo-g" :class="{ 'mb-env__ancho': c.ancho }">
              <span>
                {{ $t('profile.addr.' + c.campo) }}
                <em v-if="!c.obligatorio"> · {{ $t('create.optional') }}</em>
              </span>
              <input
                v-model="forma[c.campo]" type="text" :maxlength="c.largo"
                :required="c.obligatorio" :placeholder="c.ejemplo"
              >
            </label>

            <div class="mb-env__pie mb-env__ancho">
              <button type="button" class="mb-env__b mb-env__b--fantasma" @click="paso = 'direccion'">
                {{ $t('common.back') }}
              </button>
              <button type="submit" class="mb-env__b" :disabled="guardando">
                {{ guardando ? $t('common.loading') : $t('profile.saveAddress') }}
              </button>
            </div>
          </form>
        </template>

        <!-- ── 3. Confirmar ────────────────────────────────────── -->
        <template v-else-if="paso === 'confirmar'">
          <span class="mb-env__rotulo">{{ $t('ship.reviewTitle') }}</span>

          <div class="mb-env__objetos">
            <div class="mb-env__objeto">
              <span class="mb-env__foto mb-env__foto--ico" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9db6e8"
                     stroke-width="1.8" stroke-linejoin="round">
                  <path d="M12 2.5 21 7v10l-9 4.5L3 17V7zM3 7l9 4.5L21 7M12 11.5v10" />
                </svg>
              </span>
              <span class="mb-env__nombre">{{ $tc('ship.nItems', objetos.length, { n: objetos.length }) }}</span>
              <span class="mb-env__valor">
                <span class="mb-sc mb-sc--16" aria-hidden="true">SC</span>{{ plata(valorTotal) }}
              </span>
            </div>

            <div v-if="direccionElegida" class="mb-env__objeto">
              <span class="mb-env__foto mb-env__foto--ico" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9db6e8"
                     stroke-width="1.8" stroke-linejoin="round">
                  <path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" />
                  <circle cx="12" cy="9.5" r="2.5" />
                </svg>
              </span>
              <span class="mb-env__nombre mb-env__nombre--flojo">{{ enUnaLinea(direccionElegida) }}</span>
            </div>
          </div>

          <ul class="mb-env__notas">
            <li>{{ $t('ship.noteHeld') }}</li>
            <li>{{ $t('ship.noteCancel') }}</li>
          </ul>

          <div class="mb-env__pie">
            <button type="button" class="mb-env__b mb-env__b--fantasma" @click="paso = 'direccion'">
              {{ $t('common.back') }}
            </button>
            <button type="button" class="mb-env__b" :disabled="mandando" @click="pedir">
              {{ mandando ? $t('common.loading') : $t('ship.request') }}
            </button>
          </div>
        </template>

        <!-- ── Pedido hecho ────────────────────────────────────── -->
        <div v-else class="mb-env__listo">
          <span class="mb-env__listo-ico" aria-hidden="true">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          </span>
          <b class="mb-env__listo-t">{{ $t('ship.doneTitle') }}</b>
          <p class="mb-env__listo-p" v-html="$t('ship.doneBody', { code: codigoDelPedido })"></p>

          <div class="mb-env__pie mb-env__pie--centro">
            <router-link
              to="/profile?tab=pedidos" class="mb-env__b mb-env__b--fantasma mb-env__b--enlace"
              @click.native="cerrar"
            >{{ $t('ship.seeOrders') }}</router-link>
            <button type="button" class="mb-env__b" @click="cerrar">{{ $t('action.done') }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import api from "@/api";
import { sprite } from "@/utils/sprite";

/* Los campos de una dirección, los mismos que acepta el servidor. */
const CAMPOS = [
  { campo: "nombre", obligatorio: true, largo: 60, ancho: true, ejemplo: "" },
  { campo: "telefono", obligatorio: false, largo: 30, ejemplo: "+54 11 5555 1234" },
  { campo: "pais", obligatorio: true, largo: 56, ejemplo: "Argentina" },
  { campo: "calle", obligatorio: true, largo: 120, ancho: true, ejemplo: "Av. Corrientes 1234" },
  { campo: "calle2", obligatorio: false, largo: 120, ejemplo: "7º B" },
  { campo: "ciudad", obligatorio: true, largo: 60, ejemplo: "Buenos Aires" },
  { campo: "provincia", obligatorio: false, largo: 60, ejemplo: "CABA" },
  { campo: "codigoPostal", obligatorio: true, largo: 20, ejemplo: "C1043" },
];

const PASOS = ["items", "address", "confirm"];
const ORDEN = { objetos: 1, direccion: 2, nueva: 2, confirmar: 3 };

/**
 * PEDIR UN ENVIO.
 *
 * Tres pasos: qué mandamos, a dónde, y confirmar. Hasta ahora el botón
 * "Ship" del inventario mostraba un cartel de "pronto": el servidor
 * sabía hacerlo desde el principio, lo que faltaba era esto.
 *
 * EL NIVEL DE VERIFICACION SE MIRA ANTES DE TODO
 *
 * Por el paquete sale algo físico a una casa. Si no llega al nivel que
 * pide el panel, lo primero y lo único que ve es la pantalla que lo
 * manda a verificarse: llenar tres pasos para que al final le digan que
 * no es hacerle perder el tiempo dos veces.
 */
export default {
  name: "MbPedirEnvio",

  props: {
    /** Los objetos elegidos del inventario, ya cargados. */
    objetos: { type: Array, required: true },
    /** El nivel que tiene y el que pide el envío, los dice el servidor. */
    nivel: { type: Number, default: 0 },
    nivelQuePide: { type: Number, default: 3 },
  },

  data() {
    return {
      CAMPOS,
      PASOS,
      ORDEN,
      paso: "objetos",
      direcciones: [],
      elegida: "",
      forma: {},
      guardando: false,
      mandando: false,
      codigoDelPedido: "",
    };
  },

  computed: {
    valorTotal() {
      return Math.round(this.objetos.reduce((a, o) => a + Number(o.valueSc || 0), 0) * 100) / 100;
    },

    direccionElegida() {
      return this.direcciones.find((d) => d._id === this.elegida) || null;
    },
  },

  created() {
    if (this.nivel < this.nivelQuePide) this.paso = "trabado";
  },

  mounted() {
    window.addEventListener("keydown", this.tecla);
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

    arte(o) {
      const s = sprite(o.imageUrl);
      return s ? s.estilo : null;
    },

    enUnaLinea(d) {
      return [
        d.nombre,
        [d.calle, d.calle2].filter(Boolean).join(", "),
        [d.ciudad, d.provincia].filter(Boolean).join(", ") + " " + (d.codigoPostal || ""),
        d.pais,
      ].filter(Boolean).join(" · ");
    },

    async aDirecciones() {
      this.paso = "direccion";
      await this.traerDirecciones();
      if (!this.direcciones.length) this.abrirForma();
    },

    async traerDirecciones() {
      try {
        const { data } = await api.get("/profile/addresses");
        this.direcciones = data.data.items || data.data;

        /* La predeterminada viene elegida: es la que usa el 90%. */
        if (!this.elegida) {
          const pre = this.direcciones.find((d) => d.predeterminada) || this.direcciones[0];
          this.elegida = pre ? pre._id : "";
        }
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    abrirForma() {
      this.forma = CAMPOS.reduce((o, c) => ({ ...o, [c.campo]: "" }), {});
      this.paso = "nueva";
    },

    async guardarDireccion() {
      this.guardando = true;
      try {
        const { data } = await api.post("/profile/addresses", this.forma);
        const nueva = data.data;
        await this.traerDirecciones();
        if (nueva && nueva._id) this.elegida = nueva._id;
        this.paso = "direccion";
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.guardando = false;
      }
    },

    async pedir() {
      this.mandando = true;
      try {
        const { data } = await api.post("/inventory/ship", {
          ids: this.objetos.map((o) => o._id),
          addressId: this.elegida,
        });

        /*
          El numero que ve el jugador sale del id del pedido: los
          ultimos seis, en mayusculas. Es corto, se puede dictar por
          chat y no hace falta un contador aparte en la base.
        */
        const id = String((data.data && data.data._id) || "");
        this.codigoDelPedido = id ? `MB-${id.slice(-6).toUpperCase()}` : "";
        this.paso = "listo";
        this.$store.commit("inventarioCambio");
        this.$emit("hecho");
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.mandando = false;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-env {
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

.mb-env__caja {
  width: 100%;
  max-width: 760px;
  background: $panel-alto;
  border: 2px solid #2a4170;
  border-radius: 20px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, .55);
  overflow: hidden;
  max-height: calc(100vh - 36px);
  display: flex;
  flex-direction: column;
}

.mb-env__cabeza {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid #1f3355;
  flex: none;
}

.mb-env__cabeza-t { font-family: $fuente-cartel; font-size: 20px; flex: 1; min-width: 0; }

.mb-env__x {
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

.mb-env__cuerpo {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
}

/* ── Los pasos ──────────────────────────────────────────────── */
.mb-env__pasos { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

.mb-env__paso {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  font-weight: 800;
  color: $texto-4;
  text-transform: uppercase;
  letter-spacing: .06em;

  &.is-ahora { color: #fff; .mb-env__paso-n { background: $azul; border-color: #4f9bff; color: #fff; } }
  &.is-hecho .mb-env__paso-n { background: #2fd47a; border-color: #2fd47a; color: #06301a; }
}

.mb-env__paso-n {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #16263f;
  color: $texto-3;
  font-size: 12px;
  border: 1px solid #2a4170;
}

.mb-env__raya { flex: 1; min-width: 14px; height: 1px; background: #2a4170; }

/* ── Los objetos ────────────────────────────────────────────── */
.mb-env__objetos { display: flex; flex-direction: column; gap: 8px; }

.mb-env__objeto {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  background: #16263f;
  border: 1px solid #1f3355;
}

.mb-env__foto {
  width: 46px;
  height: 46px;
  flex: none;
  border-radius: 10px;
  background: radial-gradient(circle at 50% 55%, rgba(79, 155, 255, .3), rgba(18, 33, 58, 0) 72%), #0d1a30;

  &--ico { display: grid; place-items: center; }
}

.mb-env__nombre {
  flex: 1;
  min-width: 0;
  font-weight: 700;
  font-size: 14px;
  &--flojo { font-weight: 600; color: $texto-2; font-size: 13px; line-height: 1.4; }
}

.mb-env__valor { font-weight: 900; display: flex; align-items: center; gap: 4px; }

.mb-env__total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 1px dashed #2a4170;
  font-weight: 900;
}

/* ── Las direcciones ────────────────────────────────────────── */
.mb-env__rotulo {
  font-weight: 800;
  font-size: 12px;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: $texto-3;
}

.mb-env__p { margin: -4px 0 0; color: $texto-3; font-size: 14px; }
.mb-env__vacio { margin: 0; color: $texto-4; font-size: 14px; }

.mb-env__dirs { display: flex; flex-direction: column; gap: 10px; }

.mb-env__dir {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  text-align: left;
  padding: 14px;
  border-radius: 14px;
  background: #16263f;
  border: 1px solid #1f3355;
  color: inherit;
  font-family: inherit;
  cursor: pointer;
  @include foco;

  &.is-elegida {
    border-color: #4f9bff;
    background: rgba(47, 111, 224, .12);
    .mb-env__radio { border-color: #4f9bff; }
    .mb-env__radio::after { content: ""; width: 10px; height: 10px; border-radius: 50%; background: #4f9bff; }
  }
}

.mb-env__radio {
  width: 20px;
  height: 20px;
  flex: none;
  margin-top: 2px;
  border-radius: 50%;
  border: 2px solid #2a4170;
  display: grid;
  place-items: center;
}

.mb-env__dir-t {
  font-size: 13.5px;
  color: $texto-2;
  line-height: 1.45;
  min-width: 0;
  b { color: #fff; font-size: 14.5px; }
}

.mb-env__chapa {
  margin-left: 8px;
  font-size: 10.5px;
  font-weight: 900;
  letter-spacing: .08em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 6px;
  background: rgba(47, 212, 122, .16);
  color: #2fd47a;
}

/* ── La forma ───────────────────────────────────────────────── */
.mb-env__forma {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 14px;
  @include en-celular { grid-template-columns: 1fr; }
}

.mb-env__ancho { grid-column: 1 / -1; }

.mb-env__campo-g {
  display: flex;
  flex-direction: column;
  gap: 6px;

  > span {
    font-size: 12px;
    font-weight: 800;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: $texto-3;
  }

  em { font-style: normal; color: $texto-4; font-weight: 600; letter-spacing: 0; text-transform: none; }

  input {
    height: 46px;
    border-radius: 12px;
    border: 1px solid #2a4170;
    background: $fondo;
    color: #fff;
    font-family: inherit;
    font-size: 15px;
    padding: 0 12px;
    &:focus { outline: none; border-color: $azul; }
  }
}

/* ── Avisos, pie y pantallas enteras ────────────────────────── */
.mb-env__aviso {
  margin: 0;
  padding: 11px 13px;
  border-radius: 12px;
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.45;
  &--ojo { background: rgba(255, 211, 90, .1); border: 1px solid $amarillo; color: #ffe6a4; }
}

.mb-env__notas {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  li { color: $texto-3; font-size: 13.5px; }
}

.mb-env__pie {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  flex-wrap: wrap;
  &--centro { justify-content: center; }
}

.mb-env__b {
  height: 48px;
  padding: 0 24px;
  border-radius: 24px;
  border: 3px solid #fff;
  background: linear-gradient(180deg, #4fa2ff 0%, #2f6fe0 100%);
  color: #fff;
  font-family: inherit;
  font-weight: 900;
  font-size: 15px;
  cursor: pointer;
  @include foco;

  &:disabled { opacity: .45; cursor: not-allowed; }

  &--fantasma {
    background: transparent;
    border: 1px solid #2a4170;
    color: $texto-2;
    font-weight: 700;
    border-radius: 14px;
    padding: 0 18px;
  }

  &--enlace { display: inline-flex; align-items: center; justify-content: center; text-decoration: none; }
}

.mb-env__candado,
.mb-env__listo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
  padding: 24px 16px;
  border-radius: 16px;
}

.mb-env__candado { background: rgba(79, 155, 255, .08); border: 1px solid #2a4170; }

.mb-env__candado-ico {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: rgba(79, 155, 255, .16);
  color: #6bb4ff;
}

.mb-env__candado-t,
.mb-env__listo-t { font-family: $fuente-cartel; font-size: 20px; }

.mb-env__candado-p,
.mb-env__listo-p { margin: 0; color: $texto-2; font-size: 14px; max-width: 44ch; }

.mb-env__candado-n { margin: 0; font-size: 13px; font-weight: 800; color: $texto-4; }

.mb-env__listo-ico {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: rgba(47, 212, 122, .16);
  color: #2fd47a;
}

.mb-env__listo-p ::v-deep b {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: $amarillo;
}
</style>
