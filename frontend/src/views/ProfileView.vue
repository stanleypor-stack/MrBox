<template>
  <div class="mb-perfil">
    <p v-if="!entro" class="mb-vacio">{{ $t('error.NOT_LOGGED_IN') }}</p>

    <div v-else class="mb-perfil__cols">
      <!-- ── El menú de la cuenta ─────────────────────────────────── -->
      <nav class="mb-pnav" :aria-label="$t('header.account')">
        <button
          v-for="t in pestanas" :key="t.id" type="button"
          class="mb-pnav__b" :class="{ 'is-activa': pestana === t.id }"
          :aria-current="pestana === t.id ? 'page' : 'false'"
          @click="irA(t.id)"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff"
               stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path :d="t.icono" />
          </svg>{{ $t(t.texto) }}
        </button>
      </nav>

      <div class="mb-perfil__cuerpo">
        <!-- ══ Perfil ═══════════════════════════════════════════════ -->
        <section v-show="pestana === 'perfil'" id="p-perfil" class="mb-psec">
          <section class="mb-tarjeta-user">
            <div class="mb-tarjeta-user__trama" aria-hidden="true"></div>

            <div class="mb-tarjeta-user__avatar">
              <span class="mb-avatar">{{ inicial }}</span>
            </div>

            <div class="mb-tarjeta-user__datos">
              <div class="mb-tarjeta-user__fila">
                <span class="mb-tarjeta-user__nombre">{{ usuario.username }}</span>
                <span class="mb-tarjeta-user__rango">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#c9d7f7" aria-hidden="true">
                    <path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z" />
                  </svg>{{ rango.nombre }}
                </span>
              </div>

              <span class="mb-tarjeta-user__desde">
                {{ $t('profile.memberSince', { fecha: fecha(usuario.createdAt) }) }}
              </span>

              <div class="mb-progreso__rotulo">
                <span>{{ $t('profile.progressTo', { rango: rango.siguiente }) }}</span>
                <span class="mb-tenue">SC {{ plata(usuario.jugadoSc) }} / {{ plata(rango.faltaPara) }}</span>
              </div>
              <div class="mb-progreso"><div :style="{ width: rango.pct }"></div></div>
              <span class="mb-tarjeta-user__puesto">
                {{ $t('profile.rankOf', { n: rango.numero, total: 9 }) }}
              </span>

              <div class="mb-tarjeta-user__pie">
                <span class="mb-id">
                  {{ $t('profile.userId') }}
                  <b>{{ idCorto }}</b>
                  <button type="button" class="mb-id__copiar" :aria-label="$t('profile.copyId')" @click="copiarId">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c9d7f7"
                         stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5h10" />
                    </svg>
                  </button>
                </span>
                <router-link to="/rewards" class="mb-ver-mas">{{ $t('profile.viewRewards') }}</router-link>
              </div>
            </div>
          </section>

          <div class="mb-dos">
            <section class="mb-panel">
              <h2>{{ $t('profile.accountInfo') }}</h2>
              <label class="mb-campo-g">
                {{ $t('auth.username') }}
                <input v-model="forma.username" type="text">
              </label>
              <label class="mb-campo-g">
                {{ $t('auth.email') }}
                <input v-model="forma.email" type="email" placeholder="you@example.com">
              </label>
              <button type="button" class="mb-guardar" @click="pendiente">{{ $t('action.save') }}</button>
            </section>

            <section class="mb-panel">
              <h2>{{ $t('profile.security') }}</h2>
              <div class="mb-caja-chica">
                <span class="mb-caja-chica__t">
                  {{ $t('profile.verifyEmail') }}
                  <span class="mb-tenue">•</span>
                  <span :class="usuario.verificationLevel > 0 ? 'mb-ok' : 'mb-pend'">
                    {{ usuario.verificationLevel > 0 ? $t('profile.verified') : $t('profile.notVerified') }}
                  </span>
                </span>
                <span class="mb-caja-chica__s">{{ $t('profile.verifyEmailSub') }}</span>
              </div>
              <div class="mb-caja-chica mb-caja-chica--fila">
                <span>
                  <span class="mb-caja-chica__t">{{ $t('profile.twoFactor') }}</span>
                  <span class="mb-caja-chica__s">{{ $t('profile.twoFactorSub') }}</span>
                </span>
                <button type="button" class="mb-chico" @click="pendiente">{{ $t('profile.enable') }}</button>
              </div>
              <button type="button" class="mb-chico" @click="pendiente">{{ $t('profile.changePassword') }}</button>
            </section>
          </div>
        </section>

        <!-- ══ Verificación ═════════════════════════════════════════ -->
        <section v-show="pestana === 'verificacion'" id="p-verificacion" class="mb-psec">
          <h1>{{ $t('nav.verification') }}</h1>

          <div class="mb-verif">
            <div class="mb-verif__niveles">
              <section v-for="n in kyc.niveles" :key="n.nivel" class="mb-nivel">
                <span class="mb-nivel__texto">
                  <span class="mb-nivel__t">
                    {{ $t('profile.level' + n.nivel) }}
                    <span class="mb-chapa" :class="'is-' + n.estado">{{ $t('kyc.state.' + n.estado) }}</span>
                  </span>
                  <span class="mb-nivel__s">{{ $t('profile.level' + n.nivel + 'Sub') }}</span>
                  <span v-if="n.motivo" class="mb-nivel__motivo">{{ n.motivo }}</span>
                </span>

                <span v-if="n.estado === 'approved'" class="mb-nivel__ok">{{ $t('profile.verified') }}</span>
                <span v-else-if="n.estado === 'pending'" class="mb-nivel__espera">{{ $t('kyc.inReview') }}</span>
                <button
                  v-else-if="n.sePuedeMandar" type="button" class="mb-guardar"
                  @click="abrirNivel(n)"
                >{{ n.estado === 'rejected' ? $t('kyc.tryAgain') : $t('profile.start') }}</button>
                <span v-else class="mb-nivel__espera">{{ $t('kyc.finishPrevious') }}</span>
              </section>

            </div>

            <!-- La tarjeta de ayuda del diseño. -->
            <aside class="mb-ayuda-card">
              <span class="mb-ayuda-card__icono">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#a9bbe6"
                     stroke-width="2" stroke-linecap="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17h.01" />
                </svg>
              </span>
              <span class="mb-ayuda-card__t">{{ $t('kyc.needHelp') }}</span>
              <span class="mb-ayuda-card__s">{{ $t('kyc.needHelpSub') }}</span>
              <button type="button" class="mb-guardar mb-guardar--ancho" @click="abrirSoporte">
                {{ $t('kyc.contactSupport') }}
              </button>
            </aside>
          </div>
        </section>

        <!-- ══ Números ══════════════════════════════════════════════ -->
        <section v-show="pestana === 'numeros'" id="p-numeros" class="mb-psec">
          <h1>{{ $t('profile.stats') }}</h1>
          <section class="mb-numeros">
            <div v-for="n in numeros" :key="n.clave" class="mb-numero">
              <span class="mb-numero__rot">{{ n.rotulo }}</span>
              <span class="mb-numero__val">
                <span v-if="n.moneda" class="mb-sc mb-sc--18" aria-hidden="true">SC</span>{{ n.valor }}
              </span>
              <span v-if="n.nota" class="mb-numero__nota">{{ n.nota }}</span>
            </div>
          </section>

          <p v-if="stats && !stats.cuadra" class="mb-descuadre">
            {{ $t('profile.mismatch', { contador: plata(stats.jugadoSc), libro: plata(stats.jugadoSegunElLibro) }) }}
          </p>
        </section>

        <!-- ══ Direcciones ══════════════════════════════════════════ -->
        <section v-show="pestana === 'direcciones'" id="p-direcciones" class="mb-psec">
          <div class="mb-titulo-fila">
            <div>
              <h1>{{ $t('profile.addresses') }}</h1>
              <p class="mb-sub">{{ $t('profile.addressesSub') }}</p>
            </div>
            <button type="button" class="mb-guardar" @click="nuevaDireccion">{{ $t('profile.addAddress') }}</button>
          </div>

          <p v-if="!direcciones.length" class="mb-vacio mb-vacio--chico">{{ $t('profile.noAddresses') }}</p>

          <div v-else class="mb-dos">
            <section v-for="d in direcciones" :key="d._id" class="mb-panel mb-dir">
              <span v-if="d.predeterminada" class="mb-chapa is-approved">{{ $t('profile.defaultAddress') }}</span>
              <p class="mb-dir__texto">
                <b>{{ d.nombre }}</b><br>
                {{ d.calle }}<template v-if="d.calle2">, {{ d.calle2 }}</template><br>
                {{ d.ciudad }}<template v-if="d.provincia">, {{ d.provincia }}</template> {{ d.codigoPostal }}<br>
                {{ d.pais }}<template v-if="d.telefono"> · {{ d.telefono }}</template>
              </p>
              <div class="mb-verif__botones">
                <button type="button" class="mb-chico" @click="formaDir = { ...d }">{{ $t('profile.edit') }}</button>
                <button
                  v-if="!d.predeterminada" type="button" class="mb-chico"
                  @click="hacerPredeterminada(d)"
                >{{ $t('profile.makeDefault') }}</button>
                <button type="button" class="mb-chico mb-chico--rojo" @click="borrarDireccion(d)">
                  {{ $t('profile.delete') }}
                </button>
              </div>
            </section>
          </div>
        </section>

        <!-- ══ Movimientos ══════════════════════════════════════════ -->
        <section v-show="pestana === 'movimientos'" id="p-movimientos" class="mb-psec">
          <div>
            <h1>{{ $t('profile.transactions') }}</h1>
            <p class="mb-sub">{{ $t('profile.transactionsSub') }}</p>
          </div>

          <section class="mb-panel mb-panel--tabla">
            <div class="mb-panel__cabeza">
              <div class="mb-sel-chico">
                <span class="mb-oculto">{{ $t('boxes.sort') }}</span>
                <MbElegir v-model="tipo" :opciones="tiposDeMovimiento" chico @elegida="traerMovimientos(1)" />
              </div>
            </div>

            <p v-if="!movimientos.items.length" class="mb-panel__vacio">{{ $t('profile.noTransactions') }}</p>

            <table v-else class="mb-tabla">
              <thead>
                <tr>
                  <th>{{ $t('profile.when') }}</th>
                  <th>{{ $t('profile.what') }}</th>
                  <th class="mb-der">{{ $t('profile.amount') }}</th>
                  <th class="mb-der">{{ $t('common.balance') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in movimientos.items" :key="m._id">
                  <td class="mb-tenue">{{ fechaHora(m.createdAt) }}</td>
                  <td>
                    <b>{{ $t('txType.' + m.type) }}</b>
                    <span v-if="m.label" class="mb-tenue"> · {{ m.label }}</span>
                    <span v-if="m.reason" class="mb-tenue"> · {{ m.reason }}</span>
                  </td>
                  <td class="mb-der" :class="m.amountSc >= 0 ? 'mb-entra' : 'mb-sale'">
                    {{ m.amountSc >= 0 ? '+' : '' }}{{ plata(m.amountSc) }}
                  </td>
                  <td class="mb-der mb-tenue">{{ plata(m.balanceAfter) }}</td>
                </tr>
              </tbody>
            </table>

            <nav v-if="movimientos.pages > 1" class="mb-paginas">
              <button type="button" class="mb-chico" :disabled="movimientos.page <= 1"
                      @click="traerMovimientos(movimientos.page - 1)">{{ $t('common.previous') }}</button>
              <span>{{ movimientos.page }} / {{ movimientos.pages }}</span>
              <button type="button" class="mb-chico" :disabled="movimientos.page >= movimientos.pages"
                      @click="traerMovimientos(movimientos.page + 1)">{{ $t('common.next') }}</button>
            </nav>
          </section>
        </section>

        <!-- ══ Historial ════════════════════════════════════════════ -->
        <section v-show="pestana === 'historial'" id="p-historial" class="mb-psec">
          <div>
            <h1>{{ $t('profile.history') }}</h1>
            <p class="mb-sub">{{ $t('profile.historySub') }}</p>
          </div>

          <section class="mb-panel mb-panel--tabla">
            <p v-if="!aperturas.items.length" class="mb-panel__vacio">{{ $t('profile.noOpenings') }}</p>

            <table v-else class="mb-tabla">
              <thead>
                <tr>
                  <th>{{ $t('profile.when') }}</th>
                  <th>{{ $t('nav.boxes') }}</th>
                  <th>{{ $t('box.youWon') }}</th>
                  <th class="mb-der">{{ $t('profile.amount') }}</th>
                  <th class="mb-der">{{ $t('profile.net') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="a in aperturas.items" :key="a._id">
                  <td class="mb-tenue">{{ fechaHora(a.createdAt) }}</td>
                  <td><b>{{ a.boxName }}</b></td>
                  <td>{{ a.premio.name }}</td>
                  <td class="mb-der mb-tenue">{{ a.conAperturaGratis ? $t('common.freeOpens') : plata(a.priceSc) }}</td>
                  <td class="mb-der" :class="a.diferenciaSc >= 0 ? 'mb-entra' : 'mb-sale'">
                    {{ a.diferenciaSc >= 0 ? '+' : '' }}{{ plata(a.diferenciaSc) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <!-- La prueba del sorteo. -->
          <section v-if="semillas" class="mb-panel">
            <h2>{{ $t('box.provablyFair') }}</h2>
            <p class="mb-panel__p">{{ $t('profile.fairIntro') }}</p>

            <div class="mb-semilla">
              <span class="mb-semilla__rot">{{ $t('profile.serverSeedHash') }}</span>
              <code>{{ semillas.actual.semillaServidorHash }}</code>
            </div>
            <div class="mb-semilla">
              <span class="mb-semilla__rot">{{ $t('profile.clientSeed') }}</span>
              <code>{{ semillas.actual.semillaCliente }}</code>
            </div>
            <div class="mb-semilla">
              <span class="mb-semilla__rot">{{ $t('profile.openingsWithIt') }}</span>
              <code>{{ semillas.actual.nonce }}</code>
            </div>

            <button type="button" class="mb-guardar" @click="rotar">{{ $t('profile.rotateSeed') }}</button>
            <p class="mb-panel__p mb-tenue">{{ $t('profile.rotateNote') }}</p>
          </section>
        </section>

        <!-- ══ Actividad ════════════════════════════════════════════ -->
        <section v-show="pestana === 'actividad'" id="p-actividad" class="mb-psec">
          <div>
            <h1>{{ $t('profile.activity') }}</h1>
            <p class="mb-sub">{{ $t('profile.activitySub') }}</p>
          </div>

          <section class="mb-panel mb-panel--tabla">
            <p v-if="!actividad.length" class="mb-panel__vacio">{{ $t('profile.noActivity') }}</p>

            <table v-else class="mb-tabla">
              <thead>
                <tr>
                  <th>{{ $t('profile.when') }}</th>
                  <th>{{ $t('profile.what') }}</th>
                  <th>{{ $t('profile.device') }}</th>
                  <th>{{ $t('profile.from') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in actividad" :key="s._id">
                  <td class="mb-tenue">{{ fechaHora(s.createdAt) }}</td>
                  <td><b>{{ $t('profile.session.' + s.tipo) }}</b></td>
                  <td>{{ s.dispositivo || '—' }}</td>
                  <td class="mb-tenue">{{ s.desde || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <p class="mb-ayuda">{{ $t('profile.activityNote') }}</p>
        </section>

        <!-- ══ Pedidos ══════════════════════════════════════════════ -->
        <section v-show="pestana === 'pedidos'" id="p-pedidos" class="mb-psec">
          <div>
            <h1>{{ $t('profile.orders') }}</h1>
            <p class="mb-sub">{{ $t('profile.ordersSub') }}</p>
          </div>

          <p v-if="!pedidos.length" class="mb-vacio mb-vacio--chico">{{ $t('profile.noOrders') }}</p>

          <section v-for="p in pedidos" :key="p._id" class="mb-panel mb-pedido">
            <div class="mb-pedido__cabeza">
              <span class="mb-chapa" :class="'is-' + p.estado">{{ $t('order.' + p.estado) }}</span>
              <span class="mb-tenue">{{ fecha(p.createdAt) }}</span>
              <span class="mb-pedido__valor">
                <span class="mb-sc mb-sc--16" aria-hidden="true">SC</span>{{ plata(p.valorSc) }}
              </span>
            </div>

            <ul class="mb-pedido__items">
              <li v-for="(i, k) in p.items" :key="k">{{ i.name }} <span class="mb-tenue">· {{ plata(i.valueSc) }}</span></li>
            </ul>

            <p class="mb-pedido__destino">
              {{ p.destino.nombre }} · {{ p.destino.calle }}, {{ p.destino.ciudad }} {{ p.destino.codigoPostal }}, {{ p.destino.pais }}
            </p>

            <p v-if="p.seguimiento" class="mb-pedido__destino">
              {{ p.transportista }} · <b>{{ p.seguimiento }}</b>
            </p>
            <p v-if="p.motivo" class="mb-nivel__motivo">{{ p.motivo }}</p>

            <button
              v-if="['pending', 'packing'].includes(p.estado)" type="button" class="mb-chico"
              @click="cancelarPedido(p)"
            >{{ $t('order.cancel') }}</button>
          </section>
        </section>

        <!-- ══ Controles ════════════════════════════════════════════ -->
        <section v-show="pestana === 'controles'" id="p-controles" class="mb-psec">
          <div>
            <h1>{{ $t('profile.controls') }}</h1>
            <p class="mb-sub">{{ $t('profile.controlsSub') }}</p>
          </div>

          <section v-if="controles.pausaHasta" class="mb-panel mb-pausa">
            <h2>{{ $t('controls.onABreak') }}</h2>
            <p class="mb-panel__p">{{ $t('controls.breakUntil', { fecha: fechaHora(controles.pausaHasta) }) }}</p>
          </section>

          <section class="mb-panel">
            <h2>{{ $t('controls.dailyLimits') }}</h2>
            <p class="mb-panel__p">{{ $t('controls.limitsHelp', { hs: controles.esperaHs }) }}</p>

            <div class="mb-dos">
              <label class="mb-campo-g">
                {{ $t('controls.playLimit') }}
                <input v-model="formaLimites.juegoDiarioSc" inputmode="decimal" :placeholder="$t('controls.noLimit')">
                <span class="mb-ayuda">
                  {{ $t('controls.playedToday', { amount: plata(controles.hoy.jugadoSc) }) }}
                </span>
              </label>

              <label class="mb-campo-g">
                {{ $t('controls.lossLimit') }}
                <input v-model="formaLimites.perdidaDiariaSc" inputmode="decimal" :placeholder="$t('controls.noLimit')">
                <span class="mb-ayuda">
                  {{ $t('controls.lostToday', { amount: plata(controles.hoy.perdidaSc) }) }}
                </span>
              </label>
            </div>

            <p v-if="controles.pendiente" class="mb-nivel__motivo">
              {{ $t('controls.pending', { fecha: fechaHora(controles.pendiente.desde) }) }}
            </p>

            <button type="button" class="mb-guardar" @click="guardarLimites">{{ $t('action.save') }}</button>
          </section>

          <section class="mb-panel">
            <h2>{{ $t('controls.takeABreak') }}</h2>
            <p class="mb-panel__p">{{ $t('controls.breakHelp') }}</p>
            <div class="mb-verif__botones">
              <button
                v-for="d in [1, 7, 30, 90]" :key="d" type="button" class="mb-chico"
                @click="descansar(d)"
              >{{ $tc('controls.days', d, { n: d }) }}</button>
            </div>
          </section>
        </section>

        <!-- ══ Refer & Earn ═════════════════════════════════════════ -->
        <section v-show="pestana === 'refer'" id="p-refer" class="mb-psec">
          <section class="mb-refer">
            <div class="mb-refer__rayos mb-rays" aria-hidden="true"></div>
            <div class="mb-refer__texto">
              <h1>{{ $t('refer.title') }}</h1>
              <p>{{ $t('refer.sub') }}</p>
              <button v-if="miCodigo" type="button" class="mb-refer__boton" @click="copiarEnlace">
                {{ $t('refer.copyLink') }}
              </button>
              <span class="mb-refer__copiado">{{ copiado }}</span>
            </div>
          </section>

          <section v-if="afiliado" class="mb-refer__numeros">
            <div v-for="n in numerosDeAfiliado" :key="n.clave" class="mb-refer__num">
              <span>{{ n.rotulo }}</span>
              <b>{{ n.valor }}</b>
            </div>
          </section>

          <section v-if="afiliado" class="mb-panel mb-panel--tabla">
            <h2>{{ $t('nav.affiliates') }}</h2>

            <p v-if="!afiliado.campanas.length" class="mb-panel__vacio">{{ $t('profile.noAffiliate') }}</p>

            <table v-else class="mb-tabla">
              <thead>
                <tr>
                  <th>{{ $t('profile.code') }}</th>
                  <th class="mb-der">{{ $t('profile.players') }}</th>
                  <th class="mb-der">{{ $t('profile.theirPlay') }}</th>
                  <th class="mb-der">{{ $t('profile.earned') }}</th>
                  <th class="mb-der">{{ $t('profile.toClaim') }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in afiliado.campanas" :key="c._id">
                  <td><b>{{ c.code }}</b></td>
                  <td class="mb-der">{{ c.jugadores }}</td>
                  <td class="mb-der">{{ plata(c.jugadoPorLosSuyosSc) }}</td>
                  <td class="mb-der">{{ plata(c.ganadoSc) }}</td>
                  <td class="mb-der"><b>{{ plata(c.porCobrarSc) }}</b></td>
                  <td>
                    <button type="button" class="mb-chico" :disabled="!c.porCobrarSc || cobrando"
                            @click="cobrar(c)">{{ $t('profile.claim') }}</button>
                  </td>
                </tr>
              </tbody>
            </table>

            <p v-if="afiliado.miCodigoDeEntrada" class="mb-panel__p mb-tenue">
              {{ $t('profile.joinedWith', { code: afiliado.miCodigoDeEntrada }) }}
            </p>
          </section>
        </section>
      </div>
    </div>

    <!--
      ══ Los carteles que saltan por encima ═══════════════════════════

      Cargar datos --un nivel de verificación, una dirección-- pasa acá
      arriba y no en el medio de la página: abierto ahí abajo, el
      formulario empuja todo y el botón de guardar se pierde de vista.
    -->
    <MbVentana
      v-if="nivelAbierto"
      :titulo="$t('profile.level' + nivelAbierto.nivel)"
      :sub="$t('profile.level' + nivelAbierto.nivel + 'Sub')"
      @cerrar="nivelAbierto = null"
    >
      <component
        :is="c.tipo === 'opcion' ? 'div' : 'label'" v-for="c in nivelAbierto.campos" :key="c.campo"
        class="mb-campo-g"
      >
        {{ $t('kyc.field.' + c.campo) }}
        <span v-if="!c.obligatorio" class="mb-tenue"> · {{ $t('create.optional') }}</span>

        <MbElegir
          v-if="c.tipo === 'opcion'" v-model="formaKyc[c.campo]"
          :opciones="c.opciones.map((o) => ({ valor: o, texto: $t('kyc.doc.' + o) }))"
        />

        <input
          v-else-if="c.tipo === 'archivo'" type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          @change="subirArchivo($event, c.campo)"
        >

        <input v-else v-model="formaKyc[c.campo]" :type="c.tipo === 'fecha' ? 'date' : 'text'">
      </component>

      <p class="mb-ayuda">{{ $t('kyc.fileHelp', { mb: kyc.maximoPorArchivoMb }) }}</p>

      <template #pie>
        <button type="button" class="mb-chico" @click="nivelAbierto = null">{{ $t('action.cancel') }}</button>
        <span class="mb-crece"></span>
        <button type="button" class="mb-guardar" :disabled="mandando" @click="mandarNivel">
          {{ mandando ? $t('common.loading') : $t('kyc.send') }}
        </button>
      </template>
    </MbVentana>

    <MbVentana
      v-if="formaDir"
      :titulo="formaDir._id ? $t('profile.editAddress') : $t('profile.addAddress')"
      :sub="$t('profile.addressesSub')"
      @cerrar="formaDir = null"
    >
      <div class="mb-dos">
        <label v-for="c in CAMPOS_DIR" :key="c.campo" class="mb-campo-g">
          {{ $t('profile.addr.' + c.campo) }}
          <span v-if="!c.obligatorio" class="mb-tenue"> · {{ $t('create.optional') }}</span>
          <input
            v-model="formaDir[c.campo]" type="text"
            :maxlength="c.largo" :placeholder="c.campo === 'pais' ? 'AR' : ''"
          >
        </label>
      </div>

      <template #pie>
        <button type="button" class="mb-chico" @click="formaDir = null">{{ $t('action.cancel') }}</button>
        <span class="mb-crece"></span>
        <button type="button" class="mb-guardar" @click="guardarDireccion">{{ $t('action.save') }}</button>
      </template>
    </MbVentana>
  </div>
</template>

<script>
import { mapGetters, mapState } from "vuex";
import api from "@/api";
import MbVentana from "@/components/MbVentana.vue";
import MbElegir from "@/components/MbElegir.vue";

const TIPOS = [
  "purchase", "redemption", "box_open", "item_sold", "deal", "rakeback",
  "race_prize", "challenge", "affiliate", "promo_code", "creator_share", "manual",
];

/* Los nueve rangos del diseño, con lo que hay que jugar para entrar. */
const RANGOS = [
  ["Bronze", 0], ["Silver", 25000], ["Gold", 50000], ["Sapphire", 75000],
  ["Emerald", 100000], ["Ruby", 250000], ["Diamond", 500000],
  ["Onyx", 750000], ["Opal", 1500000],
];

const CAMPOS_DIR = [
  { campo: "nombre", obligatorio: true, largo: 80 },
  { campo: "telefono", obligatorio: false, largo: 32 },
  { campo: "calle", obligatorio: true, largo: 120 },
  { campo: "calle2", obligatorio: false, largo: 120 },
  { campo: "ciudad", obligatorio: true, largo: 80 },
  { campo: "provincia", obligatorio: false, largo: 80 },
  { campo: "codigoPostal", obligatorio: true, largo: 20 },
  { campo: "pais", obligatorio: true, largo: 2 },
];

/**
 * EL PERFIL.
 *
 * Las diez pestañas del prototipo: Perfil, Verificación, Números,
 * Direcciones, Movimientos, Historial, Actividad, Pedidos, Refer & Earn
 * y Controles.
 *
 * LA PESTAÑA VIVE EN LA DIRECCION
 *
 * `/profile?tab=movimientos`. Así el menú de la cuenta del celular
 * puede llevar directo a una, se puede mandar un enlace a alguien
 * --"mirá acá tus movimientos"-- y el botón de atrás vuelve a la
 * pestaña anterior en vez de salirse del perfil.
 *
 * CADA PESTAÑA PIDE LO SUYO Y NADA MAS
 *
 * Cargarlas todas al entrar son nueve pedidos para mirar una. Se piden
 * al abrirla, una sola vez.
 */
export default {
  name: "ProfileView",

  components: { MbVentana, MbElegir },

  data() {
    return {
      TIPOS,
      CAMPOS_DIR,
      pestana: "perfil",
      pedidas: {},

      stats: null,
      afiliado: null,
      semillas: null,
      movimientos: { items: [], page: 1, pages: 0, total: 0 },
      aperturas: { items: [], page: 1, pages: 0 },
      actividad: [],
      pedidos: [],
      direcciones: [],
      kyc: { nivelActual: 0, niveles: [], maximoPorArchivoMb: 6 },
      controles: { hoy: { jugadoSc: 0, perdidaSc: 0 }, esperaHs: 24, pendiente: null, pausaHasta: null },

      tipo: "",
      cobrando: false,
      copiado: "",
      forma: { username: "", email: "" },
      formaDir: null,
      formaKyc: {},
      formaLimites: { juegoDiarioSc: "", perdidaDiariaSc: "" },
      nivelAbierto: null,
      mandando: false,

      pestanas: [
        { id: "perfil", texto: "nav.profile", icono: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" },
        { id: "verificacion", texto: "nav.verification", icono: "M3 5h18v14H3zM7 10h4M7 14h6M15 9h3v4h-3z" },
        { id: "numeros", texto: "profile.stats", icono: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
        { id: "direcciones", texto: "profile.addresses", icono: "M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" },
        { id: "movimientos", texto: "profile.transactions", icono: "M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h4" },
        { id: "historial", texto: "profile.history", icono: "M6 2h12M6 22h12M7 2c0 5 10 5 10 10S7 17 7 22M17 2c0 5-10 5-10 10s10 5 10 10" },
        { id: "actividad", texto: "profile.activity", icono: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 3" },
        { id: "pedidos", texto: "profile.orders", icono: "M1 4h14v12H1zM15 9h4l4 4v3h-8zM5.5 19a1.5 1.5 0 1 0 0-.01M18.5 19a1.5 1.5 0 1 0 0-.01" },
        { id: "refer", texto: "profile.refer", icono: "M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
        { id: "controles", texto: "profile.controls", icono: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" },
      ],

    };
  },

  computed: {
    /* El filtro del extracto: todos, y cada tipo de movimiento. */
    tiposDeMovimiento() {
      return [{ valor: "", texto: this.$t("boxes.allCategories") }]
        .concat(TIPOS.map((t) => ({ valor: t, texto: this.$t("txType." + t) })));
    },

    ...mapState(["usuario"]),
    ...mapGetters(["entro"]),

    inicial() { return (this.usuario && this.usuario.username || "?").charAt(0).toUpperCase(); },

    idCorto() {
      return "MBX" + String((this.usuario && this.usuario._id) || "").slice(-5).toUpperCase();
    },

    miCodigo() {
      const c = this.afiliado && this.afiliado.codigos && this.afiliado.codigos[0];
      return c ? c.code : "";
    },

    /** En qué rango está y cuánto le falta para el próximo. */
    rango() {
      const jugado = (this.usuario && this.usuario.jugadoSc) || 0;
      let i = 0;
      for (let k = 0; k < RANGOS.length; k += 1) if (jugado >= RANGOS[k][1]) i = k;
      const siguiente = RANGOS[Math.min(i + 1, RANGOS.length - 1)];
      const desde = RANGOS[i][1];
      const hasta = siguiente[1];
      const pct = hasta > desde ? ((jugado - desde) / (hasta - desde)) * 100 : 100;
      return {
        nombre: RANGOS[i][0],
        numero: i + 1,
        siguiente: siguiente[0],
        faltaPara: hasta,
        pct: Math.max(4, Math.min(100, pct)).toFixed(1) + "%",
      };
    },

    numeros() {
      const s = this.stats;
      if (!s) return [];
      return [
        { clave: "saldo", rotulo: this.$t("common.balance"), valor: this.plata(s.balanceSc), moneda: true },
        {
          clave: "canjeable", rotulo: this.$t("profile.withdrawable"),
          valor: this.plata(s.canjeableSc), moneda: true,
          nota: s.bonoPendienteSc > 0
            ? this.$t("profile.bonusPending", { amount: this.plata(s.bonoPendienteSc) }) : "",
        },
        { clave: "jugado", rotulo: this.$t("profile.wagered"), valor: this.plata(s.jugadoSc), moneda: true },
        { clave: "comprado", rotulo: this.$t("profile.purchased"), valor: this.plata(s.compradoSc), moneda: true },
        { clave: "canjeado", rotulo: this.$t("action.redeem"), valor: this.plata(s.canjeadoSc), moneda: true },
        { clave: "vendido", rotulo: this.$t("profile.sold"), valor: this.plata(s.vendidoSc), moneda: true },
        { clave: "aperturas", rotulo: this.$t("profile.opened"), valor: String(s.aperturas) },
        {
          clave: "inventario", rotulo: this.$t("inventory.title"),
          valor: this.plata(s.inventario.valorSc), moneda: true,
          nota: this.$t("box.items", { n: s.inventario.cuantos }),
        },
      ];
    },

    numerosDeAfiliado() {
      const t = this.afiliado && this.afiliado.total;
      if (!t) return [];
      return [
        { clave: "gente", rotulo: this.$t("refer.referrals"), valor: String(t.jugadores) },
        { clave: "jugado", rotulo: this.$t("refer.wagerVolume"), valor: "SC " + this.plata(t.jugadoSc) },
        { clave: "ganado", rotulo: this.$t("profile.earned"), valor: "SC " + this.plata(t.ganadoSc) },
        { clave: "cobrar", rotulo: this.$t("profile.toClaim"), valor: "SC " + this.plata(t.porCobrarSc) },
      ];
    },
  },

  watch: {
    entro() { this.arrancar(); },
    /*
      Cambio el `?tab=` estando ya en el perfil: el menu de la cuenta
      del celular, o un enlace compartido.
    */
    "$route.query.tab": function (v) {
      const id = this.valida(v);
      if (id === this.pestana) return;

      this.pestana = id;
      this.$nextTick(this.arriba);
    },
  },

  methods: {
    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },
    fecha(d) {
      return d ? new Date(d).toLocaleDateString(this.$i18n.locale, {
        day: "2-digit", month: "short", year: "numeric" }) : "";
    },
    fechaHora(d) {
      return d ? new Date(d).toLocaleString(this.$i18n.locale, {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
    },

    pendiente() { this.$store.dispatch("avisar", { texto: this.$t("auth.soon") }); },

    /* El boton dice "contactar a soporte": abre el chat de soporte. */
    abrirSoporte() { this.$store.dispatch("pedirSoporte", ""); },

    valida(id) {
      return this.pestanas.some((p) => p.id === id) ? id : "perfil";
    },

    /**
     * CAMBIA DE SECCION.
     *
     * Se ve UNA sola, la elegida. Con las diez una abajo de la otra no
     * se sabia donde terminaba una y empezaba la siguiente, y el menu
     * de la izquierda no servia de menu: solo bajaba.
     *
     * La direccion queda con `?tab=`, asi se puede compartir un enlace
     * directo a "Verificacion" y vuelve con el boton de atras.
     */
    irA(id) {
      this.pestana = id;

      if (this.$route.query.tab !== id) {
        this.$router.replace({ query: { ...this.$route.query, tab: id } }).catch(() => {});
      }

      this.arriba();
    },

    /** Al cambiar de seccion se empieza por el principio. */
    arriba() {
      const cuerpo = this.$el && this.$el.querySelector(".mb-perfil__cuerpo");
      const y = cuerpo
        ? Math.max(0, cuerpo.getBoundingClientRect().top + window.scrollY - 12)
        : 0;

      try {
        window.scrollTo({ top: y, behavior: "smooth" });
      } catch {
        window.scrollTo(0, y);
      }
    },

    copiarId() { this.alPortapapeles(this.idCorto, "profile.copied"); },

    copiarEnlace() {
      this.alPortapapeles(`${window.location.origin}/signup?code=${this.miCodigo}`, "refer.copied");
      this.copiado = this.$t("refer.copied");
    },

    async alPortapapeles(texto, clave) {
      try {
        await navigator.clipboard.writeText(texto);
        this.$store.dispatch("avisar", { texto: this.$t(clave) });
      } catch {
        /* Sin permiso de portapapeles no se puede; no es grave. */
      }
    },

    /* ── Lo que trae cada pestaña ──────────────────────────────── */

    async arrancar() {
      if (!this.entro) return;
      this.forma = { username: this.usuario.username, email: this.usuario.email };
      this.pestana = this.valida(this.$route.query.tab);

      /*
        SE TRAE TODO.

        La pagina muestra todas las secciones a la vez, asi que no
        tiene sentido esperar a que alguien "entre" a una: son ocho
        pedidos chicos en paralelo, una sola vez.
      */
      await this.traerTodo();

      /*
        Con `?tab=` en la direccion ya se abrio esa seccion: el perfil
        muestra UNA, la elegida. Antes bajaba hasta ella, y ese metodo
        se fue cuando dejaron de estar todas una abajo de la otra;
        llamarlo rompia la pantalla entera al entrar desde un enlace.
      */
      if (this.$route.query.tab) {
        await this.$nextTick();
        this.arriba();
      }
    },

    /** Todas las secciones, en paralelo y sin tumbar la pantalla si una falla. */
    async traerTodo() {
      await Promise.all(
        this.pestanas.map(async (t) => {
          this.pestana = this.pestana || t.id;
          await this.traerLoDe(t.id);
        })
      );
    },

    /**
     * Pide lo de la pestaña abierta, una sola vez.
     *
     * `pedidas` recuerda cuáles ya trajo: volver a una pestaña no vuelve
     * a pedir todo. Las que cambian con lo que hace el jugador --sus
     * direcciones, sus límites-- se refrescan a mano después de tocar
     * algo, que es cuando de verdad cambiaron.
     */
    async traerLoDe(cual) {
      const p = cual || this.pestana;
      if (!this.entro || this.pedidas[p]) return;
      this.$set(this.pedidas, p, true);

      try {
        if (p === "perfil" || p === "numeros") {
          const { data } = await api.get("/profile/stats");
          this.stats = data.data;
        }
        if (p === "verificacion") await this.traerKyc();
        if (p === "direcciones") await this.traerDirecciones();
        if (p === "movimientos") await this.traerMovimientos(1);
        if (p === "historial") {
          const [ap, sem] = await Promise.all([
            api.get("/inventory/openings", { params: { perPage: 25 } }),
            api.get("/inventory/fair/seed").catch(() => null),
          ]);
          this.aperturas = ap.data.data;
          if (sem) this.semillas = sem.data.data;
        }
        if (p === "actividad") {
          const { data } = await api.get("/profile/activity");
          this.actividad = data.data.items;
        }
        if (p === "pedidos") {
          const { data } = await api.get("/profile/orders");
          this.pedidos = data.data.items;
        }
        if (p === "controles") await this.traerControles();
        if (p === "refer") {
          const { data } = await api.get("/affiliates");
          this.afiliado = data.data;
        }
      } catch (err) {
        this.$set(this.pedidas, p, false);
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    async traerMovimientos(pagina) {
      try {
        const { data } = await api.get("/profile/transactions", {
          params: { page: pagina, perPage: 20, type: this.tipo || undefined },
        });
        this.movimientos = data.data;
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    async rotar() {
      try {
        const { data } = await api.post("/inventory/fair/rotate", {});
        this.semillas = { ...this.semillas, actual: data.data.nueva };
        this.$store.dispatch("avisar", { texto: this.$t("profile.rotated") });
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    async cobrar(c) {
      this.cobrando = true;
      try {
        const { data } = await api.post(`/affiliates/campaigns/${c._id}/claim`);
        this.$store.commit("saldo", data.data);
        const { data: af } = await api.get("/affiliates");
        this.afiliado = af.data;
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.cobrando = false;
      }
    },

    /* ── Verificación ──────────────────────────────────────────── */

    async traerKyc() {
      const { data } = await api.get("/profile/verification");
      this.kyc = data.data;
    },

    abrirNivel(n) {
      this.nivelAbierto = n;
      this.formaKyc = {};
    },

    async subirArchivo(e, campo) {
      const archivo = e.target.files && e.target.files[0];
      if (!archivo) return;

      const tope = (this.kyc.maximoPorArchivoMb || 6) * 1024 * 1024;
      if (archivo.size > tope) {
        this.$store.dispatch("avisar", {
          texto: this.$t("kyc.fileTooBig", { mb: this.kyc.maximoPorArchivoMb }), tono: "error",
        });
        e.target.value = "";
        return;
      }

      const leido = await new Promise((listo) => {
        const lector = new FileReader();
        lector.onload = () => listo(String(lector.result || ""));
        lector.onerror = () => listo("");
        lector.readAsDataURL(archivo);
      });

      this.$set(this.formaKyc, campo, leido);
      this.$set(this.formaKyc, campo + "Nombre", archivo.name);
    },

    async mandarNivel() {
      this.mandando = true;
      try {
        const { data } = await api.post(`/profile/verification/${this.nivelAbierto.nivel}`, this.formaKyc);
        this.kyc = data.data;
        this.nivelAbierto = null;
        this.formaKyc = {};
        this.$store.dispatch("avisar", { texto: this.$t("kyc.sent") });
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      } finally {
        this.mandando = false;
      }
    },

    /* ── Direcciones ───────────────────────────────────────────── */

    async traerDirecciones() {
      const { data } = await api.get("/profile/addresses");
      this.direcciones = data.data.items;
    },

    nuevaDireccion() {
      this.formaDir = {
        nombre: "", telefono: "", calle: "", calle2: "",
        ciudad: "", provincia: "", codigoPostal: "", pais: "",
      };
    },

    async guardarDireccion() {
      try {
        const d = this.formaDir;
        if (d._id) await api.put(`/profile/addresses/${d._id}`, d);
        else await api.post("/profile/addresses", d);
        this.formaDir = null;
        await this.traerDirecciones();
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    async hacerPredeterminada(d) {
      try {
        await api.post(`/profile/addresses/${d._id}/default`, {});
        await this.traerDirecciones();
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    async borrarDireccion(d) {
      try {
        await api.delete(`/profile/addresses/${d._id}`);
        await this.traerDirecciones();
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    /* ── Pedidos ───────────────────────────────────────────────── */

    async cancelarPedido(p) {
      try {
        await api.post(`/inventory/ship/${p._id}/cancel`, {});
        const { data } = await api.get("/profile/orders");
        this.pedidos = data.data.items;
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    /* ── Controles ─────────────────────────────────────────────── */

    async traerControles() {
      const { data } = await api.get("/profile/controls");
      this.controles = data.data;
      this.formaLimites = {
        juegoDiarioSc: data.data.juegoDiarioSc == null ? "" : String(data.data.juegoDiarioSc),
        perdidaDiariaSc: data.data.perdidaDiariaSc == null ? "" : String(data.data.perdidaDiariaSc),
      };
    },

    async guardarLimites() {
      try {
        const { data } = await api.put("/profile/controls", {
          juegoDiarioSc: this.formaLimites.juegoDiarioSc === "" ? null : this.formaLimites.juegoDiarioSc,
          perdidaDiariaSc: this.formaLimites.perdidaDiariaSc === "" ? null : this.formaLimites.perdidaDiariaSc,
        });
        this.controles = data.data;
        this.$store.dispatch("avisar", { texto: this.$t("controls.saved") });
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },

    async descansar(dias) {
      try {
        const { data } = await api.post("/profile/controls/break", { dias });
        this.controles = data.data;
        this.$store.dispatch("avisar", { texto: this.$t("controls.breakSet") });
      } catch (err) {
        this.$store.dispatch("avisar", { texto: err.textoParaElJugador, tono: "error" });
      }
    },
  },

  created() { this.arrancar(); },

  /*
    Ya no hace falta mirar por donde va la pantalla: se ve una seccion
    sola, asi que el menu marca la que esta abierta y listo. Antes un
    IntersectionObserver iba marcando la que pasaba por el medio.
  */
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

.mb-perfil__cols { display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-start; }

.mb-perfil h1 { margin: 0; font-weight: 900; font-size: 28px; }
.mb-sub { margin: 6px 0 0; font-size: 15px; color: $texto-3; }

.mb-titulo-fila {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.mb-pnav {
  flex: 1 1 220px;
  max-width: 260px;
  display: flex;
  flex-direction: column;
  gap: 10px;

  @include en-celular {
    max-width: none;
    flex-direction: row;
    overflow-x: auto;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
  }

  /* Se queda a la vista mientras se baja por las secciones: es el
     indice de la pagina, no un encabezado. */
  position: sticky;
  top: 12px;
  align-self: flex-start;
  max-height: calc(100vh / var(--escala, 1) - 24px);
  overflow-y: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}

.mb-pnav__b {
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 48px;
  padding: 0 18px;
  border-radius: 12px;
  border: 0;
  background: #12213a;
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  font-size: 15px;
  cursor: pointer;
  white-space: nowrap;
  @include foco;

  &:hover { background: #1d3354; }
  &.is-activa { background: linear-gradient(90deg, #2f9be0, #2f6fe0); }
}

.mb-perfil__cuerpo { flex: 999 1 420px; min-width: 0; display: flex; flex-direction: column; gap: 20px; }

/* ── La tarjeta del jugador ───────────────────────────────────────── */

.mb-tarjeta-user {
  position: relative;
  overflow: hidden;
  border-radius: 18px;
  background: #12213a;
  padding: clamp(18px, 3vw, 28px);
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-items: center;
}

.mb-tarjeta-user__trama {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(45deg, rgba(255, 255, 255, .025) 0 18px, rgba(255, 255, 255, 0) 18px 36px);
}

.mb-tarjeta-user__avatar { position: relative; width: 120px; height: 120px; flex: none; }

.mb-avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: #2f6fe0;
  border: 4px solid #c9d7f7;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: $fuente-cartel;
  font-size: 48px;
}

.mb-tarjeta-user__datos { position: relative; flex: 1 1 280px; display: flex; flex-direction: column; gap: 8px; }
.mb-tarjeta-user__fila { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.mb-tarjeta-user__nombre { font-weight: 900; font-size: 30px; }

.mb-tarjeta-user__rango {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 900;
  font-size: 13px;
  letter-spacing: .06em;
  color: $texto-2;
}

.mb-tarjeta-user__desde { font-size: 14px; color: $texto-3; }
.mb-progreso__rotulo { display: flex; justify-content: space-between; font-size: 13px; margin-top: 8px; gap: 10px; }

.mb-progreso {
  height: 8px;
  border-radius: 4px;
  background: #22385c;
  overflow: hidden;
  div { min-width: 4%; height: 100%; background: $texto-2; }
}

.mb-tarjeta-user__puesto { font-size: 12px; color: $texto-4; }

.mb-tarjeta-user__pie {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 10px;
}

.mb-id { display: flex; align-items: center; gap: 8px; font-size: 13px; color: $texto-3; b { color: #fff; font-weight: 900; } }

.mb-id__copiar {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: #0e1a2e;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  @include foco;
  &:hover { background: #1d3354; }
}

.mb-ver-mas {
  height: 40px;
  padding: 0 16px;
  border-radius: 20px;
  border: 2px solid #3a5687;
  background: transparent;
  color: #fff;
  font-weight: 800;
  font-size: 14px;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  @include foco;
  &:hover { color: #fff; background: rgba(255, 255, 255, .06); }
}

/* ── Los paneles ──────────────────────────────────────────────────── */

.mb-dos {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
  gap: 20px;
  align-items: start;
}

.mb-panel {
  border-radius: 18px;
  background: #12213a;
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;

  h2 { margin: 0; font-weight: 900; font-size: 20px; }
  &--tabla { padding: 0; h2 { padding: 20px 22px 0; } }
}

.mb-panel__p { margin: 0; color: $texto-3; font-size: 14px; line-height: 1.5; }
.mb-panel__vacio { margin: 0; padding: 40px 22px; text-align: center; color: $texto-4; font-weight: 700; }
.mb-panel__cabeza { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 16px 22px 0; }

.mb-campo-g {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-weight: 800;
  font-size: 15px;

  input, select {
    height: 50px;
    padding: 0 16px;
    border-radius: 14px;
    border: 1px solid #2a4170;
    background: #0e1a2e;
    color: #fff;
    font-family: inherit;
    font-size: 15px;
    font-weight: 600;
    &:focus { outline: none; border-color: $azul; }
  }

  input[type="file"] { padding: 12px 16px; height: auto; font-size: 13px; }
}

.mb-guardar {
  align-self: flex-start;
  height: 46px;
  padding: 0 22px;
  border-radius: 23px;
  border: 2px solid #fff;
  background: linear-gradient(180deg, #4fa2ff, #2f6fe0);
  color: #fff;
  font-family: inherit;
  font-weight: 900;
  font-size: 15px;
  cursor: pointer;
  @include foco;
  &:hover:not(:disabled) { filter: brightness(1.07); }
  &:disabled { opacity: .5; cursor: default; }
  &--ancho { align-self: stretch; width: 100%; height: 50px; border-radius: 25px; }
}

.mb-caja-chica {
  border-radius: 14px;
  background: #0e1a2e;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;

  &--fila { flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
  &__t { display: block; font-weight: 900; font-size: 16px; }
  &__s { display: block; font-size: 14px; color: $texto-3; }
}

.mb-ok { color: #2fd47a; }
.mb-pend { color: $amarillo; }
.mb-ayuda { font-size: 12px; color: $texto-4; line-height: 1.5; font-weight: 600; }

/* ── Verificación ─────────────────────────────────────────────────── */

.mb-verif { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; }
.mb-verif__niveles { flex: 999 1 380px; min-width: 0; display: flex; flex-direction: column; gap: 14px; }
.mb-verif__botones { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }

.mb-nivel {
  border-radius: 18px;
  background: #12213a;
  padding: 20px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.mb-nivel__texto { flex: 1 1 260px; display: flex; flex-direction: column; gap: 6px; }

.mb-nivel__t {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-weight: 900;
  font-size: 16px;
}

.mb-nivel__s { font-size: 13px; color: $texto-3; line-height: 1.4; }
.mb-nivel__motivo { margin: 0; font-size: 13px; color: #ff9aa5; line-height: 1.4; }
.mb-nivel__ok { color: #2fd47a; font-weight: 900; font-size: 15px; }
.mb-nivel__espera { color: $amarillo; font-weight: 900; font-size: 15px; }

.mb-chapa {
  padding: 2px 9px;
  border-radius: 8px;
  border: 1px solid #3a5687;
  background: #16294a;
  color: $texto-3;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: .06em;

  &.is-approved, &.is-delivered { border-color: #2fd47a; background: rgba(47, 212, 122, .12); color: #2fd47a; }
  &.is-pending, &.is-packing { border-color: $amarillo; background: rgba(255, 211, 90, .12); color: $amarillo; }
  &.is-rejected, &.is-cancelled { border-color: #ff5b6b; background: rgba(255, 91, 107, .12); color: #ff9aa5; }
  &.is-shipped { border-color: $azul; background: #12305e; color: #9cc4ff; }
}

.mb-ayuda-card {
  flex: 1 1 260px;
  max-width: 360px;
  border-radius: 18px;
  background: #12213a;
  padding: 26px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}

.mb-ayuda-card__icono {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #1d3354;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mb-ayuda-card__t { font-weight: 900; font-size: 18px; }
.mb-ayuda-card__s { font-size: 14px; line-height: 1.5; color: $texto-3; }

/* ── Números ──────────────────────────────────────────────────────── */

.mb-numeros { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }

.mb-numero {
  padding: 16px 18px;
  border-radius: 14px;
  background: #12213a;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mb-numero__rot {
  color: $texto-4;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .07em;
  text-transform: uppercase;
}

.mb-numero__val {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 900;
  font-size: 20px;
  font-variant-numeric: tabular-nums;
}

.mb-numero__nota { color: $texto-4; font-size: 11px; }

.mb-descuadre {
  margin: 0;
  padding: 12px 16px;
  border: 1px solid #ff5b6b;
  border-radius: 14px;
  background: rgba(255, 91, 107, .1);
  color: #ff9aa5;
  font-weight: 700;
}

/* ── Direcciones y pedidos ────────────────────────────────────────── */

.mb-dir { gap: 10px; }
.mb-dir .mb-chapa { align-self: flex-start; }
.mb-dir__texto { margin: 0; font-size: 14px; line-height: 1.6; color: $texto-2; b { color: #fff; } }

.mb-pedido { gap: 10px; }
.mb-pedido__cabeza { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.mb-pedido__valor { margin-left: auto; display: flex; align-items: center; gap: 6px; font-weight: 900; }
.mb-pedido__items { margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6; }
.mb-pedido__destino { margin: 0; font-size: 13px; color: $texto-3; line-height: 1.5; }

/* ── Las tablas ───────────────────────────────────────────────────── */

.mb-tabla {
  width: 100%;
  border-collapse: collapse;
  display: block;
  overflow-x: auto;
  white-space: nowrap;

  th, td { padding: 11px 22px; text-align: left; }
  thead th {
    color: $texto-4;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .07em;
    text-transform: uppercase;
    border-bottom: 1px solid $borde;
  }
  tbody tr { border-bottom: 1px solid rgba(31, 51, 85, .5); &:last-child { border-bottom: 0; } }
  tbody tr:hover { background: $panel-hover; }
}

.mb-der { text-align: right !important; font-variant-numeric: tabular-nums; }
.mb-tenue { color: $texto-4; }
.mb-crece { flex: 1; }
.mb-entra { color: #2fd47a; font-weight: 800; }
.mb-sale { color: $texto-2; font-weight: 800; }

.mb-sel-chico, .mb-chico {
  height: 38px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid #2a4170;
  background: #0e1a2e;
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  font-size: 13px;
  cursor: pointer;
  @include foco;
  &:hover:not(:disabled) { background: #1d3354; }
  &:disabled { opacity: .4; cursor: default; }
  &--rojo { border-color: #ff5b6b; color: #ff9aa5; }
}

.mb-sel-chico select {
  border: 0;
  background: transparent;
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  cursor: pointer;
}

.mb-paginas {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 14px;
  border-top: 1px solid $borde;
  color: $texto-3;
  font-weight: 800;
}

/* ── Las semillas ─────────────────────────────────────────────────── */

.mb-semilla {
  border-radius: 12px;
  background: #0e1a2e;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;

  code {
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    font-size: 12px;
    color: $texto-2;
    word-break: break-all;
  }
}

.mb-semilla__rot { font-size: 11px; font-weight: 800; letter-spacing: .07em; color: $texto-4; text-transform: uppercase; }

/* ── Controles ────────────────────────────────────────────────────── */

.mb-pausa { border: 1px solid $amarillo; }

/* ── Refer & Earn ─────────────────────────────────────────────────── */

.mb-refer {
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

.mb-refer__rayos {
  position: absolute;
  left: 70%;
  top: 50%;
  width: 1200px;
  height: 1200px;
  margin: -600px 0 0 -600px;
  background: repeating-conic-gradient(from 0deg, rgba(255, 255, 255, .08) 0deg 6deg, rgba(255, 255, 255, 0) 6deg 18deg);
}

.mb-refer__texto {
  position: relative;
  padding: 32px 36px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: min(620px, 100%);

  h1 {
    margin: 0;
    font-family: $fuente-cartel;
    font-weight: 400;
    font-size: clamp(30px, 4.4vw, 44px);
    line-height: 1.02;
    text-shadow: 0 3px 0 rgba(6, 20, 58, .55);
  }

  p { margin: 0; font-weight: 700; font-size: 16px; line-height: 1.45; color: #eef4ff; }
}

.mb-refer__boton {
  align-self: flex-start;
  height: 46px;
  padding: 0 26px;
  border-radius: 23px;
  border: 3px solid #fff;
  background: linear-gradient(180deg, #4fa2ff 0%, #2f6fe0 100%);
  color: #fff;
  font-family: inherit;
  font-weight: 900;
  font-size: 16px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, .3);
  @include foco;
}

.mb-refer__copiado { min-height: 16px; font-weight: 800; font-size: 13px; }

.mb-refer__numeros {
  border-radius: 22px;
  background: #12233d;
  padding: 14px;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
  gap: 12px;
}

.mb-refer__num {
  border-radius: 16px;
  background: #0b1729;
  padding: 22px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;

  span { font-weight: 900; font-size: 11px; letter-spacing: .12em; color: $texto-4; text-transform: uppercase; }
  b { font-family: $fuente-cartel; font-weight: 400; font-size: 34px; line-height: 1; }
}

.mb-vacio { margin: 40px 0; text-align: center; color: $texto-4; }
.mb-vacio--chico { margin: 16px 0; }
.mb-oculto { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
</style>
