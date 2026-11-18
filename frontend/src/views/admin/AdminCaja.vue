<template>
  <div v-if="caja" class="adc">
    <div class="adc__cabeza">
      <span v-if="arte" class="mb-art adc__arte" :class="arte.clase" :style="arte.estilo" aria-hidden="true"></span>

      <div class="adc__quien">
        <input v-model="caja.name" class="ad-in adc__nombre" :aria-label="$t('admin.name')">
        <span class="ad-tenue">/{{ caja.slug }}</span>
      </div>

      <router-link to="/admin/boxes" class="ad-b ad-b--suave">{{ $t('admin.back') }}</router-link>
      <button type="button" class="ad-b" :disabled="guardando || !revision.ok" @click="guardar">
        {{ guardando ? $t('admin.loading') : $t('admin.save') }}
      </button>
    </div>

    <!-- ── Lo que la caja dice de sí misma ──────────────────────── -->
    <div class="ad-nums">
      <div class="ad-num">
        <span>{{ $t('admin.box.price') }}</span>
        <b>SC {{ plata(caja.priceSc) }}</b>
        <em v-if="!caja.precioAMano">{{ $t('admin.box.fromItems') }}</em>
      </div>
      <div class="ad-num">
        <span>{{ $t('admin.box.avgPayout') }}</span>
        <b>SC {{ plata(pagoPromedio) }}</b>
      </div>
      <div class="ad-num">
        <span>{{ $t('admin.box.return') }}</span>
        <b :class="Math.abs(retorno - 92) > 1 ? 'ad-amarillo' : 'ad-verde'">{{ retorno.toFixed(2) }}%</b>
        <em>{{ $t('admin.box.target') }}</em>
      </div>
      <div class="ad-num">
        <span>{{ $t('admin.box.chancesSum') }}</span>
        <b :class="Math.abs(sumaChances - 100) > 0.01 ? 'ad-rojo' : 'ad-verde'">{{ sumaChances.toFixed(4) }}%</b>
      </div>
      <div class="ad-num">
        <span>{{ $t('admin.items', { n: caja.prizes.length }) }}</span>
        <b>{{ caja.prizes.length }}</b>
      </div>
    </div>

    <!-- ── Lo que no cierra ─────────────────────────────────────── -->
    <p v-for="(e, i) in revision.errores" :key="'e' + i" class="adc__error">{{ e }}</p>
    <p v-for="(a, i) in revision.avisos" :key="'a' + i" class="ad-aviso">{{ a }}</p>

    <!-- ── Los interruptores ────────────────────────────────────── -->
    <div class="ad-caja">
      <h2>{{ $t('admin.box.flags') }}</h2>
      <div class="adc__flags">
        <label><input v-model="caja.featured" type="checkbox"> {{ $t('admin.box.featured') }}</label>
        <label><input v-model="caja.markedNew" type="checkbox"> {{ $t('admin.box.new') }}</label>
        <label>
          <input v-model="caja.precioAMano" type="checkbox"> {{ $t('admin.box.manualPrice') }}
        </label>
        <label class="ad-campo adc__cat">
          {{ $t('admin.col.category') }}
          <input v-model="caja.category" class="ad-in">
        </label>
      </div>
      <p class="ad-tenue">{{ $t('admin.box.manualPriceHelp') }}</p>

      <label v-if="caja.precioAMano" class="ad-campo">
        {{ $t('admin.box.price') }}
        <input v-model.number="caja.priceSc" class="ad-in" inputmode="decimal">
      </label>
    </div>

    <!-- ── Los premios ──────────────────────────────────────────── -->
    <div class="ad-tabla">
      <div class="ad-tabla__scroll">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>{{ $t('admin.col.name') }}</th>
              <th class="ad-der">{{ $t('admin.worth') }}</th>
              <th class="ad-der">{{ $t('admin.chance') }}</th>
              <th class="ad-der">{{ $t('admin.box.addsToPrice') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(p, i) in caja.prizes" :key="i">
              <td>
                <span v-if="spr(p)" class="mb-prod adc__foto" :style="spr(p)" aria-hidden="true"></span>
              </td>
              <td>{{ p.name }}</td>
              <td class="ad-der">SC {{ plata(p.valueSc) }}</td>
              <td class="ad-der">
                <span class="adc__pct">
                  <input
                    :value="(p.chance * 100).toFixed(p.chance < 0.001 ? 4 : 2)"
                    class="ad-in adc__in-pct" inputmode="decimal"
                    :aria-label="$t('admin.chanceFor', { name: p.name })"
                    @change="ponerChance(i, $event.target.value)"
                  >%
                </span>
              </td>
              <td class="ad-der ad-tenue">SC {{ plata(p.valueSc * p.chance) }}</td>
              <td>
                <button type="button" class="ad-b ad-b--chico ad-b--mal" @click="sacar(i)">
                  {{ $t('admin.delete') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <p class="ad-tenue">{{ $t('admin.box.editHelp') }}</p>
  </div>
</template>

<script>
import api from "@/api";
import { sprite } from "@/utils/sprite";

const RETORNO = 0.92;

/**
 * EL EDITOR DE UNA CAJA.
 *
 * EL PRECIO SALE DE LOS PREMIOS, NO AL REVES
 *
 * Mientras se tocan las chances, el precio y el retorno se recalculan
 * acá para que se vea el efecto; al guardar, el servidor los vuelve a
 * calcular y los suyos son los que valen.
 *
 * `precioAMano` existe para la excepción --una caja de campaña que
 * tiene que costar SC 9,99 redondo-- y por eso está marcado como lo
 * que es: una forma de romper el 92% a propósito.
 *
 * LA SUMA DE CHANCES EN ROJO
 *
 * Si no da 100% exacto, la caja no se guarda: el servidor la rechaza.
 * Se avisa acá para no tener que descubrirlo al tocar Guardar.
 */
export default {
  name: "AdminCaja",

  data() { return { caja: null, guardando: false }; },

  computed: {
    arte() { return this.caja ? sprite(this.caja.imageUrl) : null; },

    pagoPromedio() {
      if (!this.caja) return 0;
      return Math.round(this.caja.prizes.reduce((a, p) => a + p.valueSc * p.chance, 0) * 100) / 100;
    },

    /* El precio que saldría de estos premios. */
    precioCalculado() {
      return Math.ceil((this.pagoPromedio / RETORNO) * 100) / 100;
    },

    retorno() {
      const precio = this.caja && this.caja.precioAMano ? this.caja.priceSc : this.precioCalculado;
      return precio > 0 ? (this.pagoPromedio / precio) * 100 : 0;
    },

    sumaChances() {
      if (!this.caja) return 0;
      return this.caja.prizes.reduce((a, p) => a + p.chance, 0) * 100;
    },

    /** Lo mismo que revisa el servidor, para avisar antes. */
    revision() {
      const errores = [];
      const avisos = [];
      if (!this.caja) return { ok: false, errores, avisos };

      if (!this.caja.prizes.length) errores.push(this.$t("admin.box.needItems"));
      if (Math.abs(this.sumaChances - 100) > 0.01) {
        errores.push(this.$t("admin.box.chancesMustAdd", { suma: this.sumaChances.toFixed(4) }));
      }
      if (this.caja.prizes.some((p) => !(p.chance > 0))) errores.push(this.$t("admin.box.zeroChance"));

      if (Math.abs(this.retorno - 92) > 1) {
        avisos.push(this.$t("admin.box.offTarget", { pct: this.retorno.toFixed(2) }));
      }

      return { ok: !errores.length, errores, avisos };
    },
  },

  methods: {
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },

    spr(p) {
      const s = sprite(p.imageUrl);
      return s ? s.estilo : null;
    },

    ponerChance(i, valor) {
      const n = Number(String(valor).replace(",", ".")) / 100;
      if (!Number.isFinite(n) || n < 0) { this.$forceUpdate(); return; }
      this.$set(this.caja.prizes, i, { ...this.caja.prizes[i], chance: Math.min(1, n) });
      if (!this.caja.precioAMano) this.caja.priceSc = this.precioCalculado;
    },

    sacar(i) {
      this.caja.prizes.splice(i, 1);
      if (!this.caja.precioAMano) this.caja.priceSc = this.precioCalculado;
    },

    async traer() {
      try {
        const { data } = await api.get(`/admin/boxes/${this.$route.params.id}`);
        this.caja = data.data;
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
        this.$router.push("/admin/boxes");
      }
    },

    async guardar() {
      this.guardando = true;
      try {
        const { data } = await api.put(`/admin/boxes/${this.caja._id}`, {
          name: this.caja.name,
          category: this.caja.category,
          featured: this.caja.featured,
          markedNew: this.caja.markedNew,
          precioAMano: this.caja.precioAMano,
          priceSc: this.caja.priceSc,
          prizes: this.caja.prizes.map((p) => ({ item: p.item, chance: p.chance })),
        });
        this.caja.priceSc = data.data.priceSc;
        this.$store.dispatch("avisar", { texto: this.$t("admin.done") });
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.guardando = false;
      }
    },
  },

  created() { this.traer(); },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.adc { display: flex; flex-direction: column; gap: 20px; }
.adc__cabeza { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; }
.adc__arte { width: 64px; height: 64px; flex: none; }
.adc__quien { flex: 1 1 240px; display: flex; flex-direction: column; gap: 4px; }
.adc__nombre { font-weight: 900; font-size: 18px; }

.adc__flags {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 18px;

  label { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; cursor: pointer; }
  input[type="checkbox"] { width: 18px; height: 18px; accent-color: $azul; }
}

.adc__cat { align-items: stretch; cursor: default; input { width: 160px; } }

.adc__error {
  margin: 0;
  padding: 12px 16px;
  border-radius: 12px;
  background: rgba(255, 91, 107, .1);
  border: 1px solid #ff5b6b;
  color: #ff9aa5;
  font-weight: 700;
  font-size: 13px;
}

.adc__foto { display: block; width: 36px; height: 36px; }

.adc__pct { display: inline-flex; align-items: center; gap: 4px; color: $texto-4; }
.adc__in-pct { width: 96px; height: 34px; text-align: right; font-size: 13px; }

.ad-tenue { color: $texto-4; }
</style>
