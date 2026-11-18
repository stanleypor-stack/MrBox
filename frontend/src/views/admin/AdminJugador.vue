<template>
  <div v-if="d" class="adj">
    <!-- ── Quién es ─────────────────────────────────────────────── -->
    <div class="adj__cabeza">
      <span class="adj__avatar">{{ inicial }}</span>

      <div class="adj__quien">
        <span class="adj__nombre">
          {{ j.username }}
          <span v-if="j.banned" class="ad-estado is-mal">{{ $t('admin.state.banned') }}</span>
          <span v-if="j.rank !== 'user'" class="ad-estado">{{ j.rank }}</span>
          <span class="adj__rango" :style="{ color: d.rango.color }">{{ d.rango.nombre }}</span>
        </span>
        <span class="ad-tenue">{{ j.email }}</span>
        <span class="ad-tenue">
          {{ $t('admin.player.since', { fecha: fecha(j.createdAt) }) }}
          · {{ $t('admin.player.lastSeen', { fecha: j.lastSeenAt ? fechaHora(j.lastSeenAt) : '—' }) }}
        </span>
      </div>

      <router-link to="/admin/players" class="ad-b ad-b--suave">{{ $t('admin.back') }}</router-link>
    </div>

    <!-- ── Sus números ──────────────────────────────────────────── -->
    <div class="ad-nums">
      <div class="ad-num">
        <span>{{ $t('admin.balance') }}</span>
        <b>SC {{ plata(j.balanceSc) }}</b>
        <em v-if="j.bonoPendienteSc > 0">{{ $t('admin.player.bonusLocked', { amount: plata(j.bonoPendienteSc) }) }}</em>
      </div>
      <div class="ad-num"><span>{{ $t('admin.player.bought') }}</span><b>SC {{ plata(n.compradoSc) }}</b></div>
      <div class="ad-num"><span>{{ $t('admin.player.redeemed') }}</span><b>SC {{ plata(n.canjeadoSc) }}</b></div>
      <div class="ad-num">
        <span>{{ $t('admin.player.played') }}</span>
        <b>SC {{ plata(j.jugadoSc) }}</b>
        <em>{{ $t('admin.player.ofItems', { n: num(n.aperturas) }) }}</em>
      </div>
      <div class="ad-num">
        <span>{{ $t('admin.player.margin') }}</span>
        <b :class="d.margenSc >= 0 ? 'ad-verde' : 'ad-rojo'">SC {{ plata(d.margenSc) }}</b>
      </div>
      <div class="ad-num">
        <span>{{ $t('admin.player.inventory') }}</span>
        <b>SC {{ plata(n.inventarioSc) }}</b>
        <em>{{ $t('admin.player.ofItems', { n: num(n.inventarioN) }) }}</em>
      </div>
      <div class="ad-num"><span>{{ $t('admin.kyc') }}</span><b>{{ $t('admin.player.level', { n: j.verificationLevel }) }}</b></div>
      <div class="ad-num"><span>{{ $t('admin.player.freeLeft') }}</span><b>{{ num(j.freeOpens) }}</b></div>
    </div>

    <p class="ad-aviso">{{ $t('admin.player.marginHelp') }}</p>

    <!-- ── La ficha: lo que se mira, y al costado lo que se toca ── -->
    <div class="adj__cuerpo">
      <div class="adj__principal">
        <nav class="adj__solapas">
          <button
            v-for="s in SOLAPAS" :key="s" type="button"
            class="adj__solapa" :class="{ 'is-ahora': solapa === s }"
            @click="irA(s)"
          >{{ $t('admin.player.tab.' + s) }}</button>
        </nav>

        <!-- ── Resumen ──────────────────────────────────────────── -->
        <div v-if="solapa === 'resumen'" class="adj__pila">
          <section class="ad-caja">
            <h2>{{ $t('admin.player.info') }}</h2>
            <dl class="adj__datos">
              <div><dt>{{ $t('admin.col.username') }}</dt><dd>{{ j.username }}</dd></div>
              <div><dt>{{ $t('admin.col.email') }}</dt><dd>{{ j.email }}</dd></div>
              <div><dt>{{ $t('admin.col.createdAt') }}</dt><dd>{{ fechaHora(j.createdAt) }}</dd></div>
              <div><dt>{{ $t('admin.col.lastSeenAt') }}</dt><dd>{{ j.lastSeenAt ? fechaHora(j.lastSeenAt) : '—' }}</dd></div>
              <div><dt>{{ $t('admin.player.affiliateCode') }}</dt><dd>{{ j.affiliateCode || '—' }}</dd></div>
              <div><dt>{{ $t('admin.player.referredBy') }}</dt><dd>{{ j.referredBy ? String(j.referredBy).slice(-6).toUpperCase() : '—' }}</dd></div>
              <div><dt>{{ $t('admin.player.soldBack') }}</dt><dd>SC {{ plata(n.devueltoSc) }}</dd></div>
              <div><dt>{{ $t('admin.player.given') }}</dt><dd>SC {{ plata(n.regaladoSc) }}</dd></div>
              <div><dt>{{ $t('admin.player.deals') }}</dt><dd>{{ num(n.deals) }}</dd></div>
              <div><dt>{{ $t('admin.player.orders') }}</dt><dd>{{ num(n.pedidos) }}</dd></div>
              <div><dt>{{ $t('admin.player.openRedemptions') }}</dt><dd>{{ num(n.canjesAbiertos) }}</dd></div>
              <div><dt>{{ $t('admin.nav.ranks') }}</dt><dd>{{ d.rango.nombre }} · {{ d.rango.progreso }}%</dd></div>
            </dl>
          </section>

          <!-- Verificación: acá se MIRA lo que mandó, no sólo el estado. -->
          <section class="ad-caja">
            <h2>{{ $t('admin.kyc') }}</h2>
            <p v-if="!d.verificaciones.length" class="ad-tenue">{{ $t('admin.player.kycNone') }}</p>

            <div v-for="v in d.verificaciones" :key="v._id" class="adj__kyc-fila">
              <span class="adj__kyc-que">
                <strong>{{ $t('admin.kycLevel', { n: v.nivel }) }}</strong>
                <span class="ad-tenue">{{ fechaHora(v.createdAt) }}</span>
              </span>
              <span class="ad-estado" :class="tono(v.estado)">{{ $t('kyc.state.' + v.estado) }}</span>
              <button type="button" class="ad-b ad-b--chico ad-b--suave" @click="verKyc(v)">
                {{ $t('admin.player.viewKyc') }}
              </button>
            </div>
          </section>

          <section v-if="d.codigos.length" class="ad-caja">
            <h2>{{ $t('admin.nav.affiliates') }}</h2>
            <div class="ad-tabla">
              <div class="ad-tabla__scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{{ $t('admin.code') }}</th>
                      <th class="ad-der">{{ $t('admin.players') }}</th>
                      <th class="ad-der">{{ $t('admin.earned') }}</th>
                      <th class="ad-der">{{ $t('admin.col.cobradoSc') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="c in d.codigos" :key="c.code">
                      <td>{{ c.code }}</td>
                      <td class="ad-der">{{ num(c.jugadores) }}</td>
                      <td class="ad-der">SC {{ plata(c.ganadoSc) }}</td>
                      <td class="ad-der">SC {{ plata(c.cobradoSc) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section class="ad-caja">
            <h2>{{ $t('admin.player.multi') }}</h2>
            <p class="ad-tenue">{{ $t('admin.player.multiHelp') }}</p>
            <p v-if="!d.multicuentas.length" class="ad-tenue">{{ $t('admin.player.noMulti') }}</p>
            <div v-else class="adj__chips">
              <span v-for="o in d.multicuentas" :key="o" class="adj__chip">{{ o }}</span>
            </div>
          </section>
        </div>

        <!-- ── Las solapas que son una tabla ────────────────────── -->
        <div v-else class="ad-tabla">
          <div class="ad-tabla__scroll">
            <table>
              <thead>
                <tr><th v-for="c in columnas" :key="c.k" :class="{ 'ad-der': c.der }">{{ $t(c.t) }}</th></tr>
              </thead>

              <tbody>
                <!-- Movimientos -->
                <tr v-for="m in (solapa === 'movimientos' ? lista : [])" :key="m._id">
                  <td class="ad-tenue">{{ fechaHora(m.createdAt) }}</td>
                  <td>
                    {{ $t('txType.' + m.type) }}
                    <span v-if="m.label" class="ad-tenue">· {{ m.label }}</span>
                  </td>
                  <td class="ad-der" :class="m.amountSc >= 0 ? 'ad-verde' : 'ad-rojo'">
                    {{ m.amountSc >= 0 ? '+' : '' }}{{ plata(m.amountSc) }}
                  </td>
                  <td class="ad-der ad-tenue">{{ plata(m.balanceAfter) }}</td>
                </tr>

                <!-- Aperturas -->
                <tr v-for="a in (solapa === 'aperturas' ? lista : [])" :key="a._id">
                  <td class="ad-tenue">{{ fechaHora(a.createdAt) }}</td>
                  <td>{{ a.caja }}</td>
                  <td>{{ a.premio }}</td>
                  <td class="ad-der">{{ a.gratis ? $t('admin.player.free') : plata(a.precioSc) }}</td>
                  <td class="ad-der" :class="a.premioSc >= a.precioSc ? 'ad-verde' : ''">{{ plata(a.premioSc) }}</td>
                  <td class="ad-tenue adj__mono">#{{ a.nonce }} · {{ String(a.hmac).slice(0, 10) }}</td>
                </tr>

                <!-- Inventario -->
                <tr v-for="i in (solapa === 'inventario' ? lista : [])" :key="i._id">
                  <td class="ad-tenue">{{ fechaHora(i.createdAt) }}</td>
                  <td class="adj__cosa">
                    <img v-if="i.imageUrl" class="adj__foto" :src="i.imageUrl" alt="">
                    <span>{{ i.name }}</span>
                  </td>
                  <td>{{ $t('rarity.' + i.rarity) }}</td>
                  <td class="ad-der">SC {{ plata(i.valueSc) }}</td>
                  <td><span class="ad-estado" :class="tono(i.estado)">{{ i.estado }}</span></td>
                </tr>

                <!-- Pedidos -->
                <tr v-for="p in (solapa === 'pedidos' ? lista : [])" :key="p._id">
                  <td class="adj__mono">MB-{{ p.codigo }}</td>
                  <td class="ad-tenue">{{ fechaHora(p.createdAt) }}</td>
                  <td>{{ $t('admin.player.ofItems', { n: p.cuantos }) }}</td>
                  <td class="ad-der">SC {{ plata(p.valorSc) }}</td>
                  <td>{{ p.destino || '—' }}</td>
                  <td><span class="ad-estado" :class="tono(p.estado)">{{ p.estado }}</span></td>
                </tr>

                <!-- Canjes -->
                <tr v-for="c in (solapa === 'canjes' ? lista : [])" :key="c._id">
                  <td class="ad-tenue">{{ fechaHora(c.createdAt) }}</td>
                  <td class="ad-der">SC {{ plata(c.montoSc) }}</td>
                  <td>{{ c.moneda }}</td>
                  <td class="adj__mono">{{ corto(c.direccion) }}</td>
                  <td><span class="ad-estado" :class="tono(c.estado)">{{ c.estado }}</span></td>
                </tr>

                <!-- Accesos -->
                <tr v-for="s in (solapa === 'accesos' ? lista : [])" :key="s._id">
                  <td class="ad-tenue">{{ fechaHora(s.createdAt) }}</td>
                  <td>{{ s.tipo }}</td>
                  <td>{{ s.dispositivo || '—' }}</td>
                  <td class="adj__mono">{{ s.desde || '—' }}</td>
                  <td>
                    <span class="ad-estado" :class="s.ok ? 'is-bien' : 'is-mal'">
                      {{ s.ok ? $t('admin.state.on') : $t('admin.state.off') }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p v-if="!lista.length" class="ad-tabla__vacio">{{ $t('admin.player.nothing') }}</p>

          <!-- Las direcciones van abajo de los accesos: se miran juntas. -->
          <div v-if="solapa === 'accesos' && direcciones.length" class="adj__dirs">
            <div v-for="dir in direcciones" :key="dir._id" class="adj__dir">
              <strong>
                {{ dir.nombre }}
                <span v-if="dir.predeterminada" class="ad-estado is-bien">{{ $t('admin.state.active') }}</span>
              </strong>
              <span class="ad-tenue">{{ dir.calle }}</span>
              <span class="ad-tenue">{{ dir.ciudad }}, {{ dir.provincia }} {{ dir.codigoPostal }} · {{ dir.pais }}</span>
            </div>
          </div>

          <nav v-if="paginas > 1" class="ad-paginas">
            <button type="button" class="ad-b ad-b--suave ad-b--chico" :disabled="pagina <= 1" @click="traerSolapa(pagina - 1)">
              {{ $t('admin.prev') }}
            </button>
            <span>{{ pagina }} / {{ paginas }}</span>
            <button type="button" class="ad-b ad-b--suave ad-b--chico" :disabled="pagina >= paginas" @click="traerSolapa(pagina + 1)">
              {{ $t('admin.next') }}
            </button>
          </nav>
        </div>
      </div>

      <!-- ── Lo que el equipo le puede hacer ──────────────────────── -->
      <aside class="adj__lado">
        <section class="ad-caja">
          <h2>{{ $t('admin.player.adjust') }}</h2>
          <p>{{ $t('admin.player.adjustHelp') }}</p>

          <label class="ad-campo">
            {{ $t('admin.amount') }}
            <input v-model="monto" class="ad-in" inputmode="decimal" placeholder="25.00 / -25.00">
          </label>
          <label class="ad-campo">
            {{ $t('admin.reason') }}
            <input v-model="motivo" class="ad-in" :placeholder="$t('admin.player.reasonExample')">
          </label>

          <button type="button" class="ad-b" :disabled="!sePuedeAjustar || ocupado" @click="ajustar">
            {{ $t('admin.player.apply') }}
          </button>
        </section>

        <section class="ad-caja">
          <h2>{{ $t('admin.player.locks') }}</h2>
          <p>{{ $t('admin.player.locksHelp') }}</p>

          <label v-for="k in LLAVES" :key="k" class="adj__sw">
            <input v-model="trabas[k]" type="checkbox">
            <span class="adj__pista"><span class="adj__bolita"></span></span>
            <span>{{ $t('admin.player.lock.' + k) }}</span>
          </label>

          <label class="ad-campo">
            {{ $t('admin.reason') }}
            <input v-model="trabas.motivo" class="ad-in" :placeholder="$t('admin.player.reasonExample')">
          </label>

          <span v-if="j.trabas && j.trabas.puestaEl" class="ad-tenue">
            {{ $t('admin.player.locksSince', { fecha: fechaHora(j.trabas.puestaEl), motivo: j.trabas.motivo || '—' }) }}
          </span>

          <button type="button" class="ad-b" :disabled="trabas.motivo.trim().length < 3 || ocupado" @click="guardarTrabas">
            {{ $t('admin.player.saveLocks') }}
          </button>
        </section>

        <section class="ad-caja">
          <h2>{{ $t('admin.player.tier') }}</h2>
          <p>{{ $t('admin.player.tierHelp') }}</p>
          <span class="ad-tenue">{{ $t('admin.player.tierNow', { rango: d.rango.nombre }) }}</span>

          <select v-model="rango" class="ad-in">
            <option value="">{{ $t('admin.player.tierAuto') }}</option>
            <option v-for="r in d.rangos" :key="r" :value="r">{{ r }}</option>
          </select>

          <label class="ad-campo">
            {{ $t('admin.reason') }}
            <input v-model="motivoRango" class="ad-in" :placeholder="$t('admin.player.reasonExample')">
          </label>

          <button
            type="button" class="ad-b"
            :disabled="ocupado || (!!rango && motivoRango.trim().length < 3)" @click="guardarRango"
          >{{ $t('admin.save') }}</button>
        </section>

        <section class="ad-caja">
          <h2>{{ $t('admin.player.note') }}</h2>
          <p>{{ $t('admin.player.noteHelp') }}</p>
          <textarea v-model="nota" class="ad-in adj__nota" rows="4" :placeholder="$t('admin.player.noteExample')"></textarea>
          <button type="button" class="ad-b ad-b--suave" :disabled="ocupado" @click="guardarNota">
            {{ $t('admin.player.saveNote') }}
          </button>
        </section>

        <section class="ad-caja">
          <h2>{{ $t('admin.player.account') }}</h2>
          <p>{{ $t('admin.player.banHelp') }}</p>

          <button
            type="button" class="ad-b" :class="j.banned ? '' : 'ad-b--mal'"
            :disabled="ocupado" @click="alternarCuenta"
          >{{ j.banned ? $t('admin.act.unban') : $t('admin.act.ban') }}</button>

          <p>{{ $t('admin.player.giftsHelp') }}</p>
          <button type="button" class="ad-b ad-b--suave" :disabled="ocupado" @click="regalar">
            {{ $t('admin.player.gifts') }}
          </button>
        </section>
      </aside>
    </div>

    <!-- ── El visor de verificación ─────────────────────────────── -->
    <div v-if="kyc" class="adk" @keydown.esc="kyc = null">
      <button type="button" class="adk__fondo" :aria-label="$t('admin.cancel')" @click="kyc = null"></button>

      <div class="adk__caja" role="dialog" aria-modal="true">
        <header class="adk__cabeza">
          <h2>{{ $t('admin.player.kycTitle', { n: kyc.nivel }) }}</h2>
          <button type="button" class="adk__x" :aria-label="$t('admin.cancel')" @click="kyc = null">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.8"
                 stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </header>

        <div class="adk__cuerpo">
          <p class="ad-aviso">{{ $t('admin.player.kycWarn') }}</p>

          <dl class="adj__datos">
            <div v-for="(v, k) in (kyc.datos || {})" :key="k">
              <dt>{{ $te('kyc.field.' + k) ? $t('kyc.field.' + k) : k }}</dt>
              <dd>{{ $te('kyc.doc.' + v) ? $t('kyc.doc.' + v) : v }}</dd>
            </div>
          </dl>

          <h3>{{ $t('admin.player.kycFiles') }}</h3>
          <p v-if="!(kyc.adjuntos || []).length" class="ad-tenue">{{ $t('admin.player.kycNoFiles') }}</p>

          <div v-for="a in (kyc.adjuntos || [])" :key="a.campo" class="adk__arch">
            <span>
              <strong>{{ $te('kyc.field.' + a.campo) ? $t('kyc.field.' + a.campo) : a.campo }}</strong>
              <span class="ad-tenue">{{ a.nombre }} · {{ pesa(a.tamano) }}</span>
            </span>
            <button type="button" class="ad-b ad-b--chico ad-b--suave" :disabled="ocupado" @click="abrirArchivo(a)">
              {{ $t('admin.act.openFile') }}
            </button>
          </div>

          <img v-if="kyc.mirando && esFoto(kyc.mirando)" class="adk__foto" :src="kyc.mirando.contenido" alt="">
          <a v-else-if="kyc.mirando" class="ad-b ad-b--suave" :href="kyc.mirando.contenido" :download="kyc.mirando.nombre">
            {{ kyc.mirando.nombre }}
          </a>
        </div>

        <footer v-if="kyc.estado === 'pending'" class="adk__pie">
          <button type="button" class="ad-b ad-b--mal" :disabled="ocupado" @click="revisar(false)">
            {{ $t('admin.act.reject') }}
          </button>
          <span class="ad-crece"></span>
          <button type="button" class="ad-b" :disabled="ocupado" @click="revisar(true)">
            {{ $t('admin.act.approve') }}
          </button>
        </footer>
      </div>
    </div>
  </div>
</template>

<script>
import api from "@/api";

/**
 * LA FICHA DE UN JUGADOR.
 *
 * La pantalla más grande del panel, porque es la que se abre cuando
 * alguien escribe: quién es, qué tiene, qué jugó, qué sacó, qué pidió,
 * desde dónde entró y qué mandó para verificarse.
 *
 * LAS SOLAPAS SE PIDEN CUANDO SE ABREN
 *
 * La ficha trae el resumen. El extracto, las aperturas, el inventario,
 * los pedidos y los accesos se piden al abrir cada solapa: traerlo todo
 * junto son seis consultas pesadas para alguien que casi siempre quiere
 * mirar una sola.
 *
 * MIRAR UNA VERIFICACION DEJA RASTRO
 *
 * El nombre, el documento y la dirección de una persona no viajan en la
 * ficha: se piden aparte, y cada vez queda anotado quién miró qué. Por
 * eso el visor lo avisa antes de abrirlo.
 */
const SOLAPAS = ["resumen", "movimientos", "aperturas", "inventario", "pedidos", "canjes", "accesos"];
const LLAVES = ["canje", "envio", "promos", "carreras"];

/* Los encabezados de cada solapa que es una tabla. */
const COLUMNAS = {
  movimientos: [
    { k: "cuando", t: "admin.when" }, { k: "que", t: "admin.col.detalle" },
    { k: "monto", t: "admin.col.amountSc", der: true }, { k: "saldo", t: "admin.col.balanceAfter", der: true },
  ],
  aperturas: [
    { k: "cuando", t: "admin.when" }, { k: "caja", t: "admin.col.caja" },
    { k: "premio", t: "admin.col.premio" }, { k: "precio", t: "admin.col.priceSc", der: true },
    { k: "valor", t: "admin.prizeValue", der: true }, { k: "prueba", t: "admin.player.fair" },
  ],
  inventario: [
    { k: "cuando", t: "admin.when" }, { k: "name", t: "admin.col.name" },
    { k: "rarity", t: "admin.col.rarity" }, { k: "valor", t: "admin.col.valueSc", der: true },
    { k: "estado", t: "admin.col.estado" },
  ],
  pedidos: [
    { k: "codigo", t: "admin.col.codigo" }, { k: "cuando", t: "admin.when" },
    { k: "cuantos", t: "admin.col.cuantosObjetos" }, { k: "valor", t: "admin.col.valorSc", der: true },
    { k: "destino", t: "admin.col.destino" }, { k: "estado", t: "admin.col.estado" },
  ],
  canjes: [
    { k: "cuando", t: "admin.when" }, { k: "monto", t: "admin.col.montoSc", der: true },
    { k: "moneda", t: "admin.col.moneda" }, { k: "direccion", t: "admin.col.direccion" },
    { k: "estado", t: "admin.col.estado" },
  ],
  accesos: [
    { k: "cuando", t: "admin.when" }, { k: "tipo", t: "admin.col.tipo" },
    { k: "dispositivo", t: "admin.col.detalle" }, { k: "desde", t: "admin.col.origen" },
    { k: "ok", t: "admin.col.estado" },
  ],
};

export default {
  name: "AdminJugador",

  data() {
    return {
      SOLAPAS,
      LLAVES,
      d: null,
      solapa: "resumen",
      lista: [],
      direcciones: [],
      pagina: 1,
      paginas: 1,
      monto: "",
      motivo: "",
      trabas: { canje: false, envio: false, promos: false, carreras: false, motivo: "" },
      nota: "",
      rango: "",
      motivoRango: "",
      kyc: null,
      ocupado: false,
    };
  },

  computed: {
    j() { return this.d.jugador; },
    n() { return this.d.numeros; },
    inicial() { return String(this.j.username || "?").charAt(0).toUpperCase(); },
    columnas() { return COLUMNAS[this.solapa] || []; },

    sePuedeAjustar() {
      const n = Number(String(this.monto).replace(",", "."));
      return Number.isFinite(n) && n !== 0 && this.motivo.trim().length >= 3;
    },
  },

  watch: {
    "$route.params.id"() { this.solapa = "resumen"; this.traer(); },
  },

  methods: {
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },
    num(n) { return Number(n || 0).toLocaleString("en-US"); },
    fecha(d) { return d ? new Date(d).toLocaleDateString(this.$i18n.locale, { day: "2-digit", month: "short", year: "numeric" }) : "—"; },
    fechaHora(d) { return d ? new Date(d).toLocaleString(this.$i18n.locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"; },
    corto(s) { return String(s || "").length > 18 ? `${String(s).slice(0, 8)}…${String(s).slice(-6)}` : s; },
    pesa(n) { return `${Math.max(1, Math.round((Number(n) || 0) / 1024))} KB`; },
    esFoto(a) { return /^data:image\//.test(String(a.contenido || "")); },

    tono(e) {
      if (/^(approved|delivered|shipped|paid|held|active)$/.test(e)) return "is-bien";
      if (/^(pending|packing|sold)$/.test(e)) return "is-espera";
      if (/^(rejected|cancelled|banned)$/.test(e)) return "is-mal";
      return "";
    },

    async traer() {
      try {
        const { data } = await api.get(`/admin/players/${this.$route.params.id}/full`);
        this.d = data.data;

        const t = this.j.trabas || {};
        this.trabas = {
          canje: !!t.canje, envio: !!t.envio, promos: !!t.promos, carreras: !!t.carreras, motivo: "",
        };
        this.nota = this.j.notaInterna || "";
        this.rango = this.j.rangoManual || "";
        this.motivoRango = "";
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
        this.$router.push("/admin/players");
      }
    },

    irA(s) {
      this.solapa = s;
      this.lista = [];
      this.direcciones = [];
      if (s !== "resumen") this.traerSolapa(1);
    },

    async traerSolapa(pagina) {
      try {
        const { data } = await api.get(`/admin/players/${this.j._id}/${this.solapa}`, { params: { page: pagina } });
        this.lista = data.data.items;
        this.direcciones = data.data.direcciones || [];
        this.pagina = pagina;
        this.paginas = data.data.pages || 1;
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    /** Una acción del costado: la manda, avisa y vuelve a traer la ficha. */
    async hacer(url, cuerpo) {
      this.ocupado = true;
      try {
        await api.post(`/admin/players/${this.j._id}/${url}`, cuerpo);
        this.$store.dispatch("avisar", { texto: this.$t("admin.done") });
        await this.traer();
        return true;
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
        return false;
      } finally {
        this.ocupado = false;
      }
    },

    async ajustar() {
      const ok = await this.hacer("balance", {
        montoSc: Number(String(this.monto).replace(",", ".")),
        motivo: this.motivo.trim(),
      });
      if (ok) { this.monto = ""; this.motivo = ""; }
    },

    guardarTrabas() {
      return this.hacer("locks", { ...this.trabas, motivo: this.trabas.motivo.trim() });
    },

    guardarNota() { return this.hacer("note", { nota: this.nota }); },

    guardarRango() { return this.hacer("tier", { rango: this.rango, motivo: this.motivoRango.trim() }); },

    regalar() {
      const motivo = window.prompt(this.$t("admin.reason"));
      if (motivo === null) return null;
      if (String(motivo).trim().length < 3) {
        this.$store.dispatch("avisar", { texto: this.$t("error.REASON_REQUIRED"), tono: "error" });
        return null;
      }
      return this.hacer("gifts", { motivo: String(motivo).trim() });
    },

    async alternarCuenta() {
      const cerrar = !this.j.banned;
      let motivo = "";
      if (cerrar) {
        motivo = window.prompt(this.$t("admin.whyBan"));
        if (motivo === null) return;
        if (String(motivo).trim().length < 3) {
          this.$store.dispatch("avisar", { texto: this.$t("error.REASON_REQUIRED"), tono: "error" });
          return;
        }
      }
      await this.hacer("ban", { cerrar, motivo });
    },

    /* ── La verificación ──────────────────────────────────────── */

    async verKyc(v) {
      this.ocupado = true;
      try {
        const { data } = await api.get(`/admin/verification/${v._id}/data`);
        this.kyc = { ...v, ...data.data, mirando: null };
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.ocupado = false;
      }
    },

    async abrirArchivo(a) {
      this.ocupado = true;
      try {
        const { data } = await api.get(`/admin/verification/${this.kyc._id}/files/${a.campo}`);
        this.kyc = { ...this.kyc, mirando: data.data };
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.ocupado = false;
      }
    },

    async revisar(aprobar) {
      let motivo = "";
      if (!aprobar) {
        motivo = window.prompt(this.$t("admin.player.whyReject"));
        if (motivo === null) return;
        if (String(motivo).trim().length < 3) {
          this.$store.dispatch("avisar", { texto: this.$t("error.REASON_REQUIRED"), tono: "error" });
          return;
        }
      }

      this.ocupado = true;
      try {
        await api.post(`/admin/verification/${this.j._id}/${this.kyc.nivel}`, { aprobar, motivo });
        this.kyc = null;
        this.$store.dispatch("avisar", { texto: this.$t("admin.done") });
        await this.traer();
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.ocupado = false;
      }
    },
  },

  created() { this.traer(); },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.adj { display: flex; flex-direction: column; gap: 20px; }
.adj__cabeza { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; }

.adj__avatar {
  width: 56px;
  height: 56px;
  flex: none;
  border-radius: 14px;
  background: $azul;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: 22px;
}

.adj__quien { flex: 1 1 240px; display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
.adj__nombre { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; font-weight: 900; font-size: 22px; }
.adj__rango { font-size: 13px; font-weight: 900; letter-spacing: .04em; }

/* La ficha: lo que se mira a la izquierda, lo que se toca a la derecha. */
.adj__cuerpo { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 16px; align-items: start; }
.adj__principal { min-width: 0; display: flex; flex-direction: column; gap: 14px; }
.adj__lado { display: flex; flex-direction: column; gap: 14px; }
.adj__pila { display: flex; flex-direction: column; gap: 14px; }

@media (max-width: 1080px) {
  .adj__cuerpo { grid-template-columns: minmax(0, 1fr); }
}

.adj__solapas {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 5px;
  border-radius: 12px;
  background: $panel;
  border: 1px solid $borde;
}

.adj__solapa {
  padding: 9px 14px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: $texto-3;
  font: inherit;
  font-weight: 800;
  font-size: 13px;
  cursor: pointer;
  @include foco;

  &.is-ahora { background: $panel-alto; color: #fff; }
}

/* Los datos de la cuenta: etiqueta y valor, de a dos o tres por fila. */
.adj__datos {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
  gap: 10px 18px;

  div { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  dt { font-size: 12px; font-weight: 700; color: $texto-4; }
  dd { margin: 0; font-size: 14px; font-weight: 800; overflow-wrap: anywhere; }
}

.adj__kyc-fila {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-top: 1px solid $borde;
  font-size: 13px;

  &:first-of-type { border-top: 0; }
}

.adj__kyc-que { flex: 1; display: flex; flex-direction: column; gap: 2px; }

.adj__chips { display: flex; flex-wrap: wrap; gap: 8px; }

.adj__chip {
  padding: 6px 11px;
  border-radius: 999px;
  background: $panel-alto;
  border: 1px solid $borde;
  font-size: 12px;
  font-weight: 800;
}

.adj__cosa { display: flex; align-items: center; gap: 10px; }
.adj__foto { width: 30px; height: 30px; object-fit: contain; border-radius: 7px; background: $panel-alto; }
.adj__mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }

.adj__dirs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr));
  gap: 12px;
  padding: 14px 16px;
  border-top: 1px solid $borde;
}

.adj__dir {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 13px;

  strong { display: flex; align-items: center; gap: 8px; }
}

/* Los interruptores de las trabas. */
.adj__sw {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;

  input { position: absolute; opacity: 0; width: 0; height: 0; }
  input:focus-visible + .adj__pista { outline: 2px solid $azul; outline-offset: 2px; }
  input:checked + .adj__pista { background: $azul; }
  input:checked + .adj__pista .adj__bolita { transform: translateX(16px); }
}

.adj__pista {
  width: 36px;
  height: 20px;
  flex: none;
  border-radius: 999px;
  background: #22304a;
  transition: background .15s;
  display: flex;
  align-items: center;
  padding: 2px;
  box-sizing: border-box;
}

.adj__bolita { width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform .15s; }

.adj__nota { min-height: 92px; padding: 10px 12px; resize: vertical; font: inherit; }

/* ── El visor de verificación ───────────────────────────────── */

.adk {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  box-sizing: border-box;
}

.adk__fondo { position: absolute; inset: 0; border: 0; background: rgba(3, 8, 18, .72); cursor: pointer; }

.adk__caja {
  position: relative;
  width: min(620px, 100%);
  max-height: calc(100vh - 32px);
  overflow: auto;
  border-radius: 18px;
  border: 1px solid $borde-fuerte;
  background: $panel;
  display: flex;
  flex-direction: column;
}

.adk__cabeza {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 16px 18px;
  border-bottom: 1px solid $borde;

  h2 { margin: 0; font-weight: 900; font-size: 18px; }
}

.adk__x {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  border: 0;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  @include foco;
}

.adk__cuerpo {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;

  h3 { margin: 0; font-weight: 900; font-size: 14px; }
}

.adk__arch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;

  span { display: flex; flex-direction: column; gap: 2px; }
}

.adk__foto { width: 100%; border-radius: 12px; border: 1px solid $borde; }

.adk__pie {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 18px;
  border-top: 1px solid $borde;
}

.ad-tenue { color: $texto-4; }
</style>
