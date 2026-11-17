<template>
  <div class="mb-inv">
    <header class="mb-inv__barra">
      <h1 class="mb-inv__titulo">{{ $t('inventory.title') }}</h1>

      <span v-if="resumen.cuantos" class="mb-inv__resumen">
        {{ $t('box.items', { n: resumen.cuantos }) }}
        <span class="mb-punto" aria-hidden="true">·</span>
        <span class="mb-sc" aria-hidden="true">SC</span><b>{{ plata(resumen.valorSc) }}</b>
      </span>

      <button
        v-if="elegidos.length"
        type="button" class="mb-boton mb-boton--primario"
        :disabled="vendiendo" @click="venderElegidos"
      >
        {{ $t('inventory.sellSelected') }} · SC {{ plata(totalElegido) }}
      </button>
    </header>

    <p v-if="cargando" class="mb-vacio">{{ $t('common.loading') }}</p>
    <p v-else-if="!items.length" class="mb-vacio">{{ $t('inventory.empty') }}</p>

    <ul v-else class="mb-grilla">
      <li
        v-for="o in items" :key="o._id"
        class="mb-obj" :class="{ 'is-elegido': elegidos.includes(o._id) }"
        :style="{ borderColor: elegidos.includes(o._id) ? color(o.rarity) : '' }"
      >
        <!--
          Toda la tarjeta es el botón de elegir. Un `label` con un
          checkbox de verdad adentro: se marca con el mouse, con el dedo
          y con la barra espaciadora, y el lector de pantalla lo anuncia
          como lo que es.
        -->
        <label class="mb-obj__elegir">
          <input
            type="checkbox" class="mb-obj__check"
            :checked="elegidos.includes(o._id)"
            @change="alternar(o._id)"
          >
          <span class="mb-obj__tapa" :style="{ background: fondo(o.rarity) }">
            <img v-if="o.imageUrl" :src="o.imageUrl" :alt="''">
            <span v-else class="mb-obj__inicial" aria-hidden="true">{{ o.name.charAt(0) }}</span>
          </span>
          <span class="mb-obj__nombre">{{ o.name }}</span>
          <span class="mb-obj__valor">
            <span class="mb-sc" aria-hidden="true">SC</span>{{ plata(o.valueSc) }}
          </span>
        </label>

        <div class="mb-obj__acciones">
          <button type="button" class="mb-mini" :disabled="vendiendo" @click="vender(o)">
            {{ $t('box.sellFor', { amount: 'SC ' + plata(o.seVendePorSc) }) }}
          </button>

          <!--
            POR QUE NO SE PUEDE ENVIAR, DICHO EN CRISTIANO.

            Un botón apagado sin explicación es la peor pantalla posible:
            el jugador no sabe si es un error nuestro o algo que puede
            resolver. El servidor manda el motivo y acá se traduce.
          -->
          <button
            type="button" class="mb-mini"
            :disabled="!o.puedeEnviarse"
            :title="motivo(o)"
          >{{ $t('action.ship') }}</button>
        </div>

        <p v-if="!o.puedeEnviarse" class="mb-obj__motivo">{{ motivo(o) }}</p>
      </li>
    </ul>
  </div>
</template>

<script>
import api from "@/api";

const COLORES = {
  blue: "#3f7cf0", purple: "#8b4fe0", pink: "#e0418f", red: "#e2424b", gold: "#f5b80a",
};

/**
 * EL INVENTARIO.
 *
 * Lo que gano. Se puede vender de a uno o elegir varios y vender todo
 * junto, que es lo que uno quiere después de abrir veinte cajas y
 * quedarse con un montón de cosas de SC 1.
 */
export default {
  name: "InventoryView",

  data() {
    return {
      items: [],
      resumen: { cuantos: 0, valorSc: 0 },
      cargando: true,
      vendiendo: false,
      elegidos: [],
    };
  },

  computed: {
    totalElegido() {
      return Math.round(
        this.items
          .filter((o) => this.elegidos.includes(o._id))
          .reduce((a, o) => a + o.seVendePorSc, 0) * 100
      ) / 100;
    },
  },

  methods: {
    color(r) { return COLORES[r] || COLORES.blue; },
    fondo(r) {
      const c = this.color(r);
      return `radial-gradient(circle at 50% 40%, ${c}44 0%, #12213a 72%)`;
    },
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },

    motivo(o) {
      const claves = {
        ITEM_NOT_SHIPPABLE: "inventory.notShippable",
        NECESITA_NIVEL_2: "inventory.needLevel2",
        NECESITA_NIVEL_3: "inventory.needLevel3",
      };
      return o.porQueNoSeEnvia ? this.$t(claves[o.porQueNoSeEnvia] || "inventory.notShippable") : "";
    },

    alternar(id) {
      const i = this.elegidos.indexOf(id);
      if (i === -1) this.elegidos.push(id);
      else this.elegidos.splice(i, 1);
    },

    async traer() {
      this.cargando = true;
      try {
        const { data } = await api.get("/inventory");
        this.items = data.data.items;
        this.resumen = data.data.resumen;
        /* Lo elegido que ya no está se saca, si no el botón suma objetos
           que se vendieron en otra pestaña. */
        const vivos = new Set(this.items.map((o) => o._id));
        this.elegidos = this.elegidos.filter((id) => vivos.has(id));
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.cargando = false;
      }
    },

    async vender(o) {
      this.vendiendo = true;
      try {
        const { data } = await api.post(`/inventory/${o._id}/sell`);
        this.$store.commit("saldo", data.data);
        await this.traer();
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
        /* Puede haberse vendido en otra pestaña: se refresca igual. */
        await this.traer();
      } finally {
        this.vendiendo = false;
      }
    },

    async venderElegidos() {
      this.vendiendo = true;
      try {
        const { data } = await api.post("/inventory/sell-many", { ids: this.elegidos });
        this.$store.commit("saldo", data.data);
        this.elegidos = [];
        await this.traer();
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.vendiendo = false;
      }
    },
  },

  created() { this.traer(); },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-inv {
  padding: 24px 28px 48px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  @include en-celular { padding: 16px; }
}

.mb-inv__barra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.mb-inv__titulo {
  flex: 1 1 auto;
  margin: 0;
  font-family: $fuente-titulo;
  font-size: 26px;
  font-weight: 400;
}

.mb-inv__resumen {
  display: flex;
  align-items: center;
  gap: 7px;
  color: $texto-3;
  font-weight: 700;
  b { color: $texto; }
}

.mb-punto { color: $texto-4; }

.mb-grilla {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 12px;
  @include en-celular { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
}

.mb-obj {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 2px solid $borde;
  border-radius: $radio-tarjeta;
  background: $panel;

  &.is-elegido { background: $panel-hover; }
}

.mb-obj__elegir {
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
}

.mb-obj__check {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;

  // El anillo de foco va en la tarjeta, porque la casilla es invisible.
  &:focus-visible + .mb-obj__tapa {
    outline: 2px solid $azul;
    outline-offset: 2px;
  }
}

.mb-obj__tapa {
  position: relative;
  aspect-ratio: 1 / 1;
  border-radius: $radio-chico;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  img { width: 100%; height: 100%; object-fit: contain; }
}

.mb-obj__inicial {
  font-family: $fuente-titulo;
  font-size: 34px;
  color: rgba(255, 255, 255, .3);
}

.mb-obj__nombre {
  font-weight: 800;
  font-size: 13px;
  line-height: 1.3;
}

.mb-obj__valor {
  display: flex;
  align-items: center;
  gap: 5px;
  font-weight: 900;
}

.mb-obj__acciones {
  display: flex;
  gap: 6px;
  > * { flex: 1; }
}

.mb-mini {
  min-height: 34px;
  padding: 0 8px;
  border: 1px solid $borde-fuerte;
  border-radius: $radio-chico;
  background: $panel-alto;
  color: $texto-2;
  font-family: inherit;
  font-weight: 800;
  font-size: 11px;
  cursor: pointer;
  @include foco;

  &:hover:not(:disabled) { background: $lateral-hover; color: $texto; }
  &:disabled { opacity: .45; cursor: not-allowed; }
}

.mb-obj__motivo {
  margin: 0;
  color: $texto-4;
  font-size: 11px;
  line-height: 1.35;
}

.mb-boton {
  min-height: 44px;
  padding: 0 18px;
  border: 1px solid $azul;
  border-radius: $radio;
  background: $azul;
  color: #fff;
  font-family: inherit;
  font-weight: 900;
  cursor: pointer;
  @include foco;
  &:disabled { opacity: .5; cursor: default; }
}

.mb-vacio { margin: 40px 0; text-align: center; color: $texto-4; }

.mb-sc {
  display: inline-flex;
  flex: none;
  width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: linear-gradient($sc-verde-claro, $sc-verde);
  color: $sc-texto;
  font-weight: 900;
  font-size: 8px;
  line-height: 1;
}
</style>
