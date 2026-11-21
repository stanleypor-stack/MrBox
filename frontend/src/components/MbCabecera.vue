<template>
  <header class="mb-head">
    <div class="mb-head__fila">
      <!-- ── El logo ──────────────────────────────────────────────── -->
      <router-link to="/" aria-label="MR BOX" class="mb-head__logo">
        <svg width="240" height="62" viewBox="0 0 1000 260" role="img" aria-label="MR BOX">
          <defs>
            <linearGradient id="hd2F" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#ffffff" />
              <stop offset=".55" stop-color="#e3eeff" />
              <stop offset="1" stop-color="#9fc3f7" />
            </linearGradient>
            <text
              id="hd2W" x="490" y="190" text-anchor="middle"
              font-family="Titan One, sans-serif" font-size="176"
              letter-spacing="-4" transform="skewX(-7) translate(22 0)"
            >MR BOX</text>
            <clipPath id="hd2C"><rect x="0" y="40" width="1100" height="78" /></clipPath>
          </defs>
          <!-- Las nueve capas que le dan el relieve. Van de la sombra
               mas honda a la cara, cada una un poco mas clara. -->
          <use href="#hd2W" transform="translate(16 18)" fill="#06143a" stroke="#06143a" stroke-width="22" stroke-linejoin="round" opacity=".55" />
          <use href="#hd2W" transform="translate(14 14)" fill="#0b2266" stroke="#0b2266" stroke-width="16" stroke-linejoin="round" />
          <use href="#hd2W" transform="translate(14 14)" fill="#123a9e" stroke="#123a9e" stroke-width="12" stroke-linejoin="round" />
          <use href="#hd2W" transform="translate(12 12)" fill="#1a4fc0" stroke="#1a4fc0" stroke-width="12" stroke-linejoin="round" />
          <use href="#hd2W" transform="translate(10 10)" fill="#2260d6" stroke="#2260d6" stroke-width="12" stroke-linejoin="round" />
          <use href="#hd2W" transform="translate(8 8)" fill="#2a6fe6" stroke="#2a6fe6" stroke-width="12" stroke-linejoin="round" />
          <use href="#hd2W" transform="translate(6 6)" fill="#3a80f0" stroke="#3a80f0" stroke-width="12" stroke-linejoin="round" />
          <use href="#hd2W" transform="translate(4 4)" fill="#4a8ff5" stroke="#4a8ff5" stroke-width="12" stroke-linejoin="round" />
          <use href="#hd2W" fill="none" stroke="#0b2266" stroke-width="10" stroke-linejoin="round" />
          <use href="#hd2W" fill="url(#hd2F)" />
          <use href="#hd2W" fill="#ffffff" opacity=".55" clip-path="url(#hd2C)" />
        </svg>

        <!--
          EL LOGO DE CELULAR: "MR" ARRIBA DE "BOX".

          A 375px de ancho, el logo de una linea ocupa la mitad de la
          cabecera y no queda lugar para la billetera. Apilado mide 70
          de ancho en vez de 240 y se lee igual de bien.

          Son dos SVG y no uno escalado porque las dos formas son
          distintas de verdad: la de dos renglones tiene su propio
          recorte de brillo, no es la otra achicada.
        -->
        <svg class="mb-head__logo--celu" width="70" height="55" viewBox="0 0 560 440" role="img" aria-label="MR BOX">
          <defs>
            <linearGradient id="hm3F" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#ffffff" />
              <stop offset=".55" stop-color="#e3eeff" />
              <stop offset="1" stop-color="#9fc3f7" />
            </linearGradient>
            <g
              id="hm3W" font-family="Titan One, sans-serif" font-size="200"
              text-anchor="middle" letter-spacing="-4" transform="skewX(-7) translate(36 0)"
            >
              <text x="270" y="200">MR</text>
              <text x="270" y="400">BOX</text>
            </g>
            <clipPath id="hm3C">
              <rect x="0" y="40" width="600" height="80" />
              <rect x="0" y="240" width="600" height="80" />
            </clipPath>
          </defs>
          <use href="#hm3W" transform="translate(16 18)" fill="#06143a" stroke="#06143a" stroke-width="22" stroke-linejoin="round" opacity=".55" />
          <use href="#hm3W" transform="translate(14 14)" fill="#0b2266" stroke="#0b2266" stroke-width="16" stroke-linejoin="round" />
          <use href="#hm3W" transform="translate(14 14)" fill="#123a9e" stroke="#123a9e" stroke-width="12" stroke-linejoin="round" />
          <use href="#hm3W" transform="translate(12 12)" fill="#1a4fc0" stroke="#1a4fc0" stroke-width="12" stroke-linejoin="round" />
          <use href="#hm3W" transform="translate(10 10)" fill="#2260d6" stroke="#2260d6" stroke-width="12" stroke-linejoin="round" />
          <use href="#hm3W" transform="translate(8 8)" fill="#2a6fe6" stroke="#2a6fe6" stroke-width="12" stroke-linejoin="round" />
          <use href="#hm3W" transform="translate(6 6)" fill="#3a80f0" stroke="#3a80f0" stroke-width="12" stroke-linejoin="round" />
          <use href="#hm3W" transform="translate(4 4)" fill="#4a8ff5" stroke="#4a8ff5" stroke-width="12" stroke-linejoin="round" />
          <use href="#hm3W" fill="none" stroke="#0b2266" stroke-width="10" stroke-linejoin="round" />
          <use href="#hm3W" fill="url(#hm3F)" />
          <use href="#hm3W" fill="#ffffff" opacity=".55" clip-path="url(#hm3C)" />
        </svg>
      </router-link>

      <!--
        ══ EL MEDIO ═══════════════════════════════════════════════

        Con sesion, la billetera. Sin sesion, la oferta: es el mismo
        lugar y la misma importancia, y el hueco no queda vacio.
      -->
      <router-link v-if="!entro" to="/signup" class="mb-regalo">
        <span class="mb-regalo__estrella" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#ffd34d">
            <path d="m12 2 2.6 6.3 6.8.5-5.2 4.4 1.6 6.6L12 16.6 6.2 19.8l1.6-6.6L2.6 8.8l6.8-.5z" />
          </svg>
        </span>

        <span class="mb-regalo__texto">
          <span class="mb-regalo__t">{{ $t('home.claim') }}</span>
          <span class="mb-regalo__s">{{ $t('header.freeOpens', { n: regalo }) }}</span>
        </span>

        <span class="mb-regalo__arte" aria-hidden="true"></span>
      </router-link>

      <!-- ── La billetera ─────────────────────────────────────────── -->
      <!-- Solo con sesion: a un visitante, "SC 0,00" no le dice nada
           y el boton de depositar lo manda a iniciar sesion. -->
      <div v-if="entro" class="mb-head__centro">
        <div class="mb-wallet" v-click-fuera="cerrarWallet">
          <button
            type="button" class="mb-wallet__saldo"
            :aria-expanded="walletAbierta ? 'true' : 'false'" aria-label="Wallet"
            @click="walletAbierta = !walletAbierta"
          >
            <span class="mb-sc mb-sc--20" aria-hidden="true">SC</span>{{ plata(saldo) }}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c9d7f7"
                 stroke-width="2.6" stroke-linecap="round" aria-hidden="true">
              <path :d="walletAbierta ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'" />
            </svg>
          </button>

          <button
            type="button" class="mb-wallet__mas" aria-label="Deposit"
            @click="$emit('depositar')"
          >
            <span class="mb-wallet__brillo" aria-hidden="true"></span>
            <svg style="position: relative" width="16" height="16" viewBox="0 0 24 24"
                 fill="none" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>

          <div v-if="walletAbierta" role="dialog" aria-label="Wallet" class="mb-wallet__panel">
            <div class="mb-wallet__total">
              <span class="mb-wallet__rotulo">{{ $t('wallet.total') }}</span>
              <span class="mb-wallet__cifra">
                <span class="mb-sc mb-sc--26" aria-hidden="true">SC</span>{{ plata(total) }}
              </span>
            </div>

            <div class="mb-wallet__acciones">
              <button type="button" class="mb-wallet__accion" @click="$emit('depositar')">
                <span class="mb-wallet__icono">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff"
                       stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>{{ $t('action.deposit') }}
              </button>
              <button type="button" class="mb-wallet__accion" @click="$emit('retirar')">
                <span class="mb-wallet__icono">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff"
                       stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M12 5v14M6 13l6 6 6-6" />
                  </svg>
                </span>{{ $t('wallet.withdraw') }}
              </button>
              <button type="button" class="mb-wallet__accion" @click="$emit('canjear')">
                <span class="mb-wallet__icono">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff"
                       stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M3 12V4h8l10 10-8 8zM7.5 7.5h.01" />
                  </svg>
                </span>{{ $t('wallet.redeem') }}
              </button>
            </div>

            <div class="mb-wallet__lista">
              <router-link to="/profile" class="mb-wallet__linea" @click.native="walletAbierta = false">
                <span class="mb-wallet__linea-izq">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#a9bbe6" aria-hidden="true">
                    <path d="M3 7a2 2 0 0 1 2-2h13v4h3v10H5a2 2 0 0 1-2-2z" />
                  </svg>{{ $t('common.balance') }}
                </span>
                <span class="mb-wallet__linea-der">
                  <span class="mb-sc mb-sc--16" aria-hidden="true">SC</span>{{ plata(saldo) }}
                </span>
              </router-link>

              <router-link to="/inventory" class="mb-wallet__linea" @click.native="walletAbierta = false">
                <span class="mb-wallet__linea-izq">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#a9bbe6" aria-hidden="true">
                    <path d="M4 8h16v12H4zM2 4h20v4H2z" />
                  </svg>{{ $t('wallet.items') }}
                  <span class="mb-wallet__cuenta">{{ inventario.cuantos }}</span>
                </span>
                <span class="mb-wallet__linea-der">
                  <span class="mb-sc mb-sc--16" aria-hidden="true">SC</span>{{ plata(inventario.valorSc) }}
                </span>
              </router-link>

              <!--
                Lleva a las cajas de regalo, igual que las otras dos
                lineas llevan a donde esta eso: un renglon que no se
                puede tocar al lado de dos que si es una trampa.
              -->
              <router-link to="/inventory" class="mb-wallet__linea" @click.native="walletAbierta = false">
                <span class="mb-wallet__linea-izq">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#a9bbe6" aria-hidden="true">
                    <path d="M3 13h8v8H3zM13 13h8v8h-8zM8 3h8v8H8z" />
                  </svg>{{ $t('wallet.freeOpens') }}
                </span>
                <span class="mb-wallet__linea-der mb-wallet__linea-der--sola">{{ aperturasGratis }}</span>
              </router-link>
            </div>
          </div>
        </div>
      </div>

      <!-- ── La derecha ───────────────────────────────────────────── -->
      <div class="mb-head__der">
        <router-link to="/boxes" class="mb-redondo" :aria-label="$t('action.search')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff"
               stroke-width="2.6" stroke-linecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
        </router-link>

        <!-- Avisos, premios e inventario son de una cuenta. Sin
             cuenta, las tres llevan a una pantalla vacia. -->
        <div v-if="entro" class="mb-iconos" v-click-fuera="cerrarAvisos">
          <div class="mb-iconos__caja">
            <button
              type="button"
              :aria-label="sinLeer ? `${$t('header.notifications')} (${sinLeer})` : $t('header.notifications')"
              :aria-expanded="avisosAbiertos ? 'true' : 'false'"
              class="mb-iconos__b" :class="{ 'is-on': avisosAbiertos }"
              @click="alternarAvisos"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                <path d="M12 2a1.6 1.6 0 0 0-1.6 1.6v.6A6.5 6.5 0 0 0 5.5 10.6V15l-1.8 2.3c-.4.5 0 1.2.6 1.2h15.4c.6 0 1-.7.6-1.2L18.5 15v-4.4a6.5 6.5 0 0 0-4.9-6.4v-.6A1.6 1.6 0 0 0 12 2zm-2.6 18a2.6 2.6 0 0 0 5.2 0z" />
              </svg>

              <!-- La bolita. Hasta 9, y de ahi "9+": el numero exacto
                   no cambia nada y tres cifras no entran. -->
              <span v-if="sinLeer" class="mb-iconos__bolita" aria-hidden="true">
                {{ sinLeer > 9 ? '9+' : sinLeer }}
              </span>
            </button>
            <span class="mb-iconos__raya" aria-hidden="true"></span>
            <router-link to="/profile" class="mb-iconos__b" :aria-label="$t('nav.rewards')">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                <path d="M20.5 7h-2.4c.3-.5.4-1 .4-1.5A3.5 3.5 0 0 0 12 3.4 3.5 3.5 0 0 0 5.5 5.5c0 .5.1 1 .4 1.5H3.5A1.5 1.5 0 0 0 2 8.5v2A1.5 1.5 0 0 0 3.5 12H11V7h2v5h7.5a1.5 1.5 0 0 0 1.5-1.5v-2A1.5 1.5 0 0 0 20.5 7zM9 7a1.5 1.5 0 1 1 0-3c1.2 0 1.8 1.7 2 3zm6 0h-2c.2-1.3.8-3 2-3a1.5 1.5 0 1 1 0 3zM3.5 13.5V20A2 2 0 0 0 5.5 22H11v-8.5zM13 22h5.5a2 2 0 0 0 2-2v-6.5H13z" />
              </svg>
            </router-link>
            <span class="mb-iconos__raya" aria-hidden="true"></span>
            <router-link to="/inventory" class="mb-iconos__b" :aria-label="$t('nav.inventory')">
              <svg width="19" height="17" viewBox="0 0 26 22" fill="#fff" aria-hidden="true">
                <path d="M3 9h20v10.5A1.5 1.5 0 0 1 21.5 21h-17A1.5 1.5 0 0 1 3 19.5zM1 5.5 7 2l6 3.5L7 9zM25 5.5 19 2l-6 3.5L19 9zM10 12.5h6v2h-6z" />
              </svg>
            </router-link>
          </div>

          <div v-if="avisosAbiertos" role="dialog" :aria-label="$t('header.notifications')" class="mb-avisos">
            <div class="mb-avisos__cabeza">
              <span class="mb-avisos__titulo">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff"
                     stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" />
                </svg>{{ $t('header.notifications') }}
              </span>
              <button type="button" class="mb-avisos__cerrar" :aria-label="$t('common.close')"
                      @click="cerrarAvisos()">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff"
                       stroke-width="3" stroke-linecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <div v-if="cargandoAvisos" class="mb-avisos__vacio">{{ $t('common.loading') }}</div>

            <div v-else-if="!avisos.length" class="mb-avisos__vacio">
              <span class="mb-avisos__vacioDibujo" aria-hidden="true">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" />
                </svg>
              </span>
              {{ $t('header.allCaughtUp') }}
            </div>

            <!--
              LA LISTA.

              Cada fila es un boton si lleva a algun lado y un div si
              no: un `div` con `@click` no se puede tocar con el
              teclado y no se anuncia como algo que se puede tocar.
            -->
            <ul v-else class="mb-avisos__lista">
              <li v-for="a in avisos" :key="a._id">
                <component
                  :is="a.destino ? 'button' : 'div'"
                  :type="a.destino ? 'button' : null"
                  class="mb-notif" :class="{ 'es-nuevo': !a.leida, 'es-tocable': !!a.destino }"
                  @click="a.destino ? irAlAviso(a) : null"
                >
                  <span class="mb-notif__icono" :class="'es-' + a.tipo" aria-hidden="true">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
                      <path :d="DIBUJOS[a.tipo] || DIBUJOS.aviso" />
                    </svg>
                  </span>

                  <span class="mb-notif__texto">
                    <span class="mb-notif__alto">
                      <b>{{ $t('notif.t_' + a.tipo) }}</b>
                      <span class="mb-notif__cuando">{{ haceCuanto(a.cuando) }}</span>
                    </span>
                    <span class="mb-notif__linea">{{ $t(a.clave, a.datos) }}</span>
                  </span>

                  <span v-if="!a.leida" class="mb-notif__punto" aria-hidden="true"></span>
                </component>
              </li>
            </ul>

            <!--
              "Marcar todo como leido" va ABAJO y a lo ancho.

              Arriba, al lado del titulo, no entra: en castellano son
              22 letras y en aleman mas, y el panel mide 330. Abajo
              tiene todo el ancho en los nueve idiomas.
            -->
            <button
              v-if="sinLeer" type="button" class="mb-avisos__todo"
              @click="marcarTodo"
            >{{ $t('notif.markAll') }}</button>
          </div>
        </div>

        <!-- ── La cuenta ──────────────────────────────────────────── -->
        <div class="mb-cuenta" :class="{ 'es-visita': !entro }" v-click-fuera="cerrarCuenta">
          <button
            v-if="entro" type="button" class="mb-cuenta__b"
            :aria-expanded="cuentaAbierta ? 'true' : 'false'" :aria-label="$t('header.account')"
            @click="cuentaAbierta = !cuentaAbierta"
          >
            <span class="mb-cuenta__avatar">{{ inicial }}</span>
            <span class="mb-cuenta__datos">
              <span class="mb-cuenta__nombre">{{ usuario.username }}</span>
              <!-- La barra de progreso al rango siguiente. -->
              <span class="mb-cuenta__xp"><span :style="{ width: xpPct }"></span></span>
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c9d7f7"
                 stroke-width="2.6" stroke-linecap="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          <!-- Lo unico que puede hacer el que no entro. En el
               telefono queda solo REGISTRARSE: "iniciar sesion" lo
               tiene igual adentro de esa pantalla. -->
          <div v-else class="mb-cuenta__entrar">
            <router-link to="/login" class="mb-entrar mb-entrar--enPc">{{ $t('action.signIn') }}</router-link>
            <router-link to="/signup" class="mb-entrar mb-entrar--fuerte">{{ $t('action.signUp') }}</router-link>
          </div>

          <div v-if="cuentaAbierta && entro" role="menu" :aria-label="$t('header.account')" class="mb-menu">
            <div class="mb-menu__grupo">
              <button
                v-for="m in menuCuenta" :key="m.id" type="button" role="menuitem"
                class="mb-menu__item" @click="irA(m)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c9d7f7"
                     stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path :d="m.icono" />
                </svg>{{ $t(m.texto) }}
              </button>
            </div>
            <button type="button" role="menuitem" class="mb-menu__pie" @click="$emit('soporte')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c9d7f7"
                   stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
                <path d="M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v6H4zM17 14h3v6h-3z" />
              </svg>{{ $t('support.title') }}
            </button>
            <button type="button" role="menuitem" class="mb-menu__pie" @click="salir">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c9d7f7"
                   stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
              </svg>{{ $t('action.logOut') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script>
import { mapState, mapGetters } from "vuex";
import { ATAJOS, aDonde } from "@/utils/menuDeCuenta";
import api from "@/api";

/**
 * LA CABECERA DEL DISENO.
 *
 * Portada del prototipo del dueno, capa por capa: el degradé azul que
 * cae hasta el fondo de la página, el logo en nueve capas, la píldora de
 * la billetera con el botón de depositar, los tres redondos y el menú de
 * la cuenta con su barra de progreso.
 *
 * Los estilos están en una hoja aparte y no en línea como el prototipo,
 * pero los VALORES son los mismos. El prototipo los tenía en línea
 * porque el editor de diseño los edita ahí; acá no hace falta y leerlos
 * agrupados es mucho más fácil.
 */
/*
  LOS AJUSTES PUBLICOS, UNA SOLA VEZ POR CARGA.

  La cabecera esta en todas las pantallas, asi que un pedido por
  montaje serian varios por visita. Guardada la promesa, el segundo
  montaje se cuelga del primer pedido en vez de hacer otro.
*/
/*
  UN DIBUJO POR TIPO DE AVISO.

  Van aca y no en la plantilla porque son datos: siete caminos de SVG
  metidos en el HTML lo vuelven ilegible.
*/
const DIBUJOS = {
  /* flecha que entra a una billetera */
  deposito: "M12 3v9m0 0 3.2-3.2M12 12 8.8 8.8M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5",
  /* flecha que sale */
  retiro: "M12 20v-9m0 0 3.2 3.2M12 11 8.8 14.2M4 11V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5",
  /* bandera a cuadros */
  carrera: "M5 21V4m0 0c3-1.6 6 1.6 9 0v8c-3 1.6-6-1.6-9 0",
  /* escudo con un tilde */
  desafio: "M12 3l7 3v5c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6zM9.2 12l2 2 3.6-3.8",
  /* una caja en un camion */
  envio: "M3 7h10v9H3zM13 10h4l3 3v3h-7zM7 19a1.6 1.6 0 1 0 0-3.2A1.6 1.6 0 0 0 7 19zM17 19a1.6 1.6 0 1 0 0-3.2a1.6 1.6 0 0 0 0 3.2z",
  /* una estrella */
  rango: "m12 3 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.4 6.7 19.2l1.1-5.9-4.3-4.1 5.9-.8z",
  /* la campana */
  aviso: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0",
};

let ajustesPublicos = null;

function traerAjustesPublicos() {
  if (!ajustesPublicos) {
    ajustesPublicos = api.get("/public/settings").then((r) => r.data.data).catch(() => null);
  }
  return ajustesPublicos;
}

export default {
  name: "MbCabecera",

  directives: {
    /*
      Cerrar al tocar afuera. Los tres desplegables de la cabecera lo
      necesitan, así que es una directiva y no tres copias del mismo
      oyente. Se limpia sola al desmontarse: un oyente en `document` que
      queda vivo es una pérdida de memoria de las que no avisan.

      PASA EL EVENTO porque no todo lo de afuera es "afuera": el botón
      de la barra de abajo que ABRE la billetera también está fuera de
      la cabecera, y cerrar con él sería apagarla en el mismo toque que
      la prendió. Quien recibe decide.
    */
    "click-fuera": {
      bind(el, binding) {
        el.__fuera = (e) => { if (!el.contains(e.target)) binding.value(e); };
        document.addEventListener("click", el.__fuera);
      },
      unbind(el) {
        document.removeEventListener("click", el.__fuera);
      },
    },
  },

  data() {
    return {
      DIBUJOS,
      avisosAbiertos: false,
      avisos: [],
      sinLeer: 0,
      cargandoAvisos: false,
      relojDeAvisos: null,
      /* Este es el desplegable DE LA CABECERA, que en el telefono ni
         se dibuja. No confundir con `abierto.cuenta`, que es el menu
         del telefono y lo dibuja App.vue. */
      cuentaAbierta: false,
      inventario: { cuantos: 0, valorSc: 0 },
      menuCuenta: ATAJOS,
      /* Cuantas aperturas regala el registro. El 3 es el mismo valor
         que trae el servidor de fabrica: si el panel lo cambia, lo
         corrige `traerRegalo` sin que la pastilla parpadee. */
      regalo: 3,
    };
  },

  computed: {
    ...mapState(["usuario", "abierto", "inventarioCambio"]),
    ...mapGetters(["entro", "saldo", "aperturasGratis"]),

    inicial() {
      return (this.usuario && this.usuario.username || "?").charAt(0).toUpperCase();
    },

    /*
      UNA SOLA FUENTE DE VERDAD.

      La billetera la abren tres cosas: el saldo de acá arriba, el
      botón de la barra de abajo y el menú de cuenta del teléfono. Las
      dos últimas son componentes hermanos que no se ven entre sí, así
      que lo único que comparten es el estado.

      Tener ADEMÁS una bandera acá adentro es lo que permitió que se
      desincronizaran: el botón de abajo movía una y el panel miraba la
      otra. Ahora las dos son la misma, y el estado ya sabe dejar uno
      solo abierto.

      El menú de cuenta NO se muda: `abierto.cuenta` es el del
      teléfono, que dibuja App.vue, y el de acá es otro. Compartir la
      bandera abriría los dos juntos en la computadora.

      Al cerrar se pregunta si estaba abierta: `cerrarWallet` corre en
      CUALQUIER toque de afuera, y apagar sin mirar cerraría también el
      menú lateral que alguien acabara de abrir.
    */
    walletAbierta: {
      get() { return this.abierto.wallet; },
      set(v) {
        if (v) this.$store.commit("abrir", "wallet");
        else if (this.abierto.wallet) this.$store.commit("abrir", null);
      },
    },

    /** Saldo más lo que vale el inventario: lo que de verdad tiene. */
    total() {
      return Math.round((this.saldo + this.inventario.valorSc) * 100) / 100;
    },

    /**
     * La barra de progreso.
     *
     * Por ahora mide contra SC 25.000, que es donde empieza el segundo
     * rango. Cuando estén los nueve rangos sale del rango de verdad.
     */
    xpPct() {
      const jugado = (this.usuario && this.usuario.jugadoSc) || 0;
      return Math.max(6, Math.min(100, (jugado / 25000) * 100)).toFixed(1) + "%";
    },
  },

  /*
    UN SOLO `watch`.

    Habia dos, y el segundo pisaba al primero: los avisos de "abrio una
    caja" y "entro o salio" no existian, asi que el encabezado traia el
    inventario una sola vez --al montarse, sin sesion todavia-- y se
    quedaba diciendo "Objetos 0" con objetos adentro.
  */
  watch: {
    /* Abrio una caja o vendio algo: la billetera de arriba quedo vieja. */
    inventarioCambio() { this.traerInventario(); },

    /* Al entrar o salir, el inventario del encabezado cambia. Y la
       campanita: la de otro no es la mia, y sin sesion no hay. */
    entro(hay) {
      this.traerInventario();
      this.avisos = [];
      this.sinLeer = 0;
      if (hay) this.arrancarElReloj();
      else this.pararElReloj();
    },

    /* Al abrirla se vuelve a contar: es un pedido chico y es el
       momento exacto en que alguien mira los numeros. */
    walletAbierta(v) { if (v) this.traerInventario(); },
  },

  methods: {
    /*
      EL RELOJ DE LA BOLITA.

      Un minuto, y SOLO con la pestana a la vista: nadie mira una
      bolita en una pestana de atras, y una pestana olvidada tres dias
      pidiendo cada minuto es ruido que alguien paga.
    */
    arrancarElReloj() {
      this.pararElReloj();
      if (!this.entro) return;
      this.contarAvisos();
      this.relojDeAvisos = window.setInterval(() => {
        if (document.visibilityState === "visible") this.contarAvisos();
      }, 60000);
    },

    pararElReloj() {
      if (this.relojDeAvisos) window.clearInterval(this.relojDeAvisos);
      this.relojDeAvisos = null;
    },

    medir() {
      if (!this.$el || !this.$el.getBoundingClientRect) return;
      const alto = Math.round(this.$el.getBoundingClientRect().height);
      if (alto > 0) document.documentElement.style.setProperty("--alto-cabecera", `${alto}px`);
    },

    plata(n) {
      return Number(n || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });
    },

    /*
      EL TOQUE QUE ABRE NO PUEDE SER EL QUE CIERRA.

      La barra de abajo y el menú de cuenta abren la billetera, y su
      click sigue subiendo hasta `document`, que es donde escucha el
      "tocar afuera". Sin esta excepción el mismo toque la prendía y la
      apagaba: por eso la billetera no abría nunca.

      Cerrar desde acá no hace falta: los dos piden abrir POR EL
      ESTADO, y el estado deja uno solo abierto.
    */
    deUnBotonQueAbre(e) {
      const t = e && e.target;
      return !!(t && t.closest && t.closest(".mb-abajo, .mb-menuc"));
    },

    cerrarWallet(e) {
      if (this.deUnBotonQueAbre(e)) return;
      this.walletAbierta = false;
    },
    /*
      ABRIR TRAE LA LISTA; CERRAR LA MARCA LEIDA.

      Marcarla al abrir apagaria el resaltado de "esto es nuevo" en el
      mismo momento en que lo ibas a leer.
    */
    alternarAvisos() {
      if (this.avisosAbiertos) { this.cerrarAvisos(); return; }
      this.avisosAbiertos = true;
      this.traerAvisos();
    },

    cerrarAvisos(e) {
      if (this.deUnBotonQueAbre(e)) return;
      if (!this.avisosAbiertos) return;
      this.avisosAbiertos = false;
      if (this.sinLeer) this.marcarTodo();
    },

    /** La lista, cuando se abre el panel. */
    async traerAvisos() {
      if (!this.entro) return;
      this.cargandoAvisos = !this.avisos.length;
      try {
        const { data } = await api.get("/notifications");
        this.avisos = data.data.items;
        this.sinLeer = data.data.sinLeer;
      } catch {
        /* Sin avisos la cabecera anda igual: no se le pone un cartel
           rojo a alguien por una campanita que no cargo. */
      } finally {
        this.cargandoAvisos = false;
      }
    },

    /** Solo el numero de la bolita. Es lo que se pide cada minuto. */
    async contarAvisos() {
      if (!this.entro) return;
      try {
        const { data } = await api.get("/notifications/count");
        this.sinLeer = data.data.sinLeer;
      } catch { /* la bolita puede esperar */ }
    },

    async marcarTodo() {
      if (!this.sinLeer) return;
      /* Se apaga en la pantalla antes de que conteste el servidor: la
         bolita es informacion del que mira, no del servidor, y si
         falla se vuelve a encender sola en el proximo conteo. */
      this.sinLeer = 0;
      this.avisos = this.avisos.map((a) => ({ ...a, leida: true }));
      try {
        await api.post("/notifications/read", {});
      } catch { /* se corrige solo en el proximo conteo */ }
    },

    /** Tocar un aviso lleva a donde paso. */
    irAlAviso(a) {
      this.cerrarAvisos();
      if (!a.destino) return;
      if (this.$route.fullPath !== a.destino) this.$router.push(a.destino).catch(() => {});
    },

    /**
     * "hace 2 h", en el idioma de quien mira.
     *
     * `Intl` lo arma solo y en los nueve idiomas. Escribirlo a mano
     * serian nueve tablas de singulares y plurales --y en ruso, tres
     * formas por unidad-- para decir algo que el navegador ya sabe.
     */
    haceCuanto(cuando) {
      const segundos = Math.round((Date.now() - new Date(cuando).getTime()) / 1000);
      const escalas = [
        [60, "second", 1],
        [3600, "minute", 60],
        [86400, "hour", 3600],
        [604800, "day", 86400],
        [2629800, "week", 604800],
        [31557600, "month", 2629800],
        [Infinity, "year", 31557600],
      ];

      const [, unidad, divisor] = escalas.find(([tope]) => Math.abs(segundos) < tope);

      try {
        return new Intl.RelativeTimeFormat(this.$i18n.locale, { numeric: "auto" })
          .format(-Math.round(segundos / divisor), unidad);
      } catch {
        return new Date(cuando).toLocaleDateString();
      }
    },
    cerrarCuenta(e) {
      if (this.deUnBotonQueAbre(e)) return;
      this.cuentaAbierta = false;
    },

    /*
      A DONDE LLEVA CADA ATAJO.

      Casi todos son una PESTAÑA del perfil, no una pantalla: el perfil
      ya las tiene. La billetera abre el cajón y no navega a ningún
      lado, que es lo que hace también en el teléfono.
    */
    irA(m) {
      const d = aDonde(m.id);

      if (d.que === "wallet") {
        this.cuentaAbierta = false;
        this.walletAbierta = true;
        return;
      }

      this.cuentaAbierta = false;

      if (d.que === "ruta") {
        if (this.$route.path !== d.a) this.$router.push(d.a);
        window.scrollTo({ top: 0 });
        return;
      }

      if (this.$route.path !== "/profile") {
        this.$router.push({ path: "/profile", query: { tab: d.a } });
        return;
      }

      if (this.$route.query.tab !== d.a) {
        this.$router.replace({ query: { ...this.$route.query, tab: d.a } }).catch(() => {});
      }
    },

    async traerInventario() {
      if (!this.entro) {
        this.inventario = { cuantos: 0, valorSc: 0 };
        return;
      }
      try {
        const { data } = await api.get("/inventory", { params: { perPage: 1 } });
        this.inventario = data.data.resumen;
      } catch {
        /* El encabezado no puede romperse porque el inventario no
           contestó: se queda en cero y listo. */
      }
    },

    salir() {
      this.cuentaAbierta = false;
      this.$store.dispatch("salir");
      if (this.$route.path !== "/") this.$router.push("/");
    },
  },

  async created() {
    this.traerInventario();

    /* Solo si no entro: la pastilla del regalo es lo unico que usa
       este numero, y solo se dibuja sin sesion. */
    if (!this.entro) {
      const ajustes = await traerAjustesPublicos();
      const n = ajustes && Number(ajustes.aperturasDeRegalo);
      if (Number.isFinite(n) && n > 0) this.regalo = n;
    }
  },

  mounted() {
    /*
      EL ALTO DE LA CABECERA, PUBLICADO PARA EL RESTO.

      La barra lateral se pega justo abajo y el cajon mide su alto
      descontandola, asi que el numero tiene que salir de la cabecera
      de verdad y no de una constante: cambia con el idioma, con el
      zoom y entre celular y escritorio.
    */
    this.medir();
    window.addEventListener("resize", this.medir);

    /* Y la bolita de la campanita, si ya hay sesion. */
    this.arrancarElReloj();
  },

  beforeDestroy() {
    window.removeEventListener("resize", this.medir);
    this.pararElReloj();
  },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

/* ── El marco ─────────────────────────────────────────────────────── */

.mb-head {
  /*
    SE QUEDA ARRIBA AUNQUE BAJES HASTA EL FONDO.

    El saldo, la billetera y el buscador son lo que mas se usa; con la
    cabecera yendose con la pagina, para depositar habia que subir
    hasta arriba de todo. Pegada, estan siempre a un clic.

    `--alto-cabecera` la publica para los demas: la barra lateral se
    pega justo abajo, y el cajon mide su alto descontandola.
  */
  position: sticky;
  top: 0;
  z-index: 30;
  // El degradé del diseño: azul fuerte arriba que cae al fondo de la
  // página. Es lo que le da el aire de portada.
  background: radial-gradient(ellipse 50% 170% at 50% 0%, #3a8dff 0%, #1d5fd0 32%, #0f2c66 66%, #0b1424 100%);
}

.mb-head__fila {
  padding: 10px 20px;
  box-sizing: border-box;

  /*
    66px DE PANTALLA: LA CABECERA DE MRLOOT, MEDIDA.

    La nuestra daba 69, que es lo que salia de sumar el logo --62-- y
    10 de relleno arriba y abajo. Ahora el alto se pide derecho y el
    relleno baja a 8, asi el logo entra sin empujar y no hay que
    achicarlo.

    Dividido por la escala porque el sitio vive adentro de un
    `zoom: .84`, donde un pixel mide menos. Y en el telefono no va:
    ahi la cabecera es otra y 66 la apretaria.
  */
  @include en-escritorio {
    min-height: calc(66px / var(--escala, 1));
    padding-top: 8px;
    padding-bottom: 8px;
  }

  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;

  /*
    EN CELULAR ES UNA SOLA FILA.

    Logo, billetera y dos botones, como el diseno de celular. La
    grilla de tres columnas del escritorio ahi no entra: la billetera
    terminaba en un segundo renglon y el boton de entrar se iba de la
    pantalla.
  */
  @include en-celular {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
  }
}

.mb-head__logo {
  display: flex;
  align-items: center;
  @include foco;
  flex: none;
  svg { width: 240px; height: 62px; }
  .mb-head__logo--celu { display: none; width: 70px; height: 55px; }

  @include en-celular {
    svg { display: none; }
    .mb-head__logo--celu { display: block; }
  }
}

.mb-head__centro {
  grid-column: 2;
  margin: 0 auto;
  /* En celular la billetera se estira y ocupa el hueco del medio. */
  @include en-celular { flex: 1; min-width: 0; margin: 0; }
}

.mb-head__der {
  display: flex;
  align-items: center;
  gap: 10px;
  /*
    LA TERCERA COLUMNA, DICHA A PROPOSITO.

    La fila es una grilla de tres: marca, medio y derecha. Cuando el
    medio no se dibuja --sin sesion y en el telefono, donde la
    pastilla de la oferta no entra-- la grilla no deja el hueco: corre
    todo una columna a la izquierda, y el boton de registrarse
    terminaba pegado al logo en vez de contra el borde.
  */
  grid-column: 3;
  justify-self: end;

  @include en-celular {
    gap: 8px;
    /*
      En el telefono la fila es `flex`, no grilla, y lo que empujaba
      esto contra el borde era la billetera con su `flex: 1`. Sin
      sesion no hay billetera, y el boton quedaba pegado al logo.
    */
    margin-left: auto;
  }
}

/*
  LO QUE NO VA EN LA CABECERA DE CELULAR.

  El buscador, la chapa de la cuenta y los botones de entrar y
  registrarse. No es que sobren: estan abajo, en la barra de cinco
  botones, que es donde llega el pulgar. Tenerlos dos veces solo
  empujaba la billetera a un segundo renglon.
*/
@include en-celular {
  .mb-head__der > .mb-redondo,
  /*
    En el telefono la cuenta vive en la barra de abajo, asi que arriba
    no se repite... salvo que no haya cuenta: el que todavia no se
    registro tiene que ver REGISTRARSE arriba, que es lo unico que
    puede hacer y es lo que hace mrloot.
  */
  .mb-cuenta { display: none; }
  .mb-cuenta.es-visita { display: flex; }

  /*
    LOS ICONOS, SUELTOS Y CUADRADOS.

    En escritorio los tres viven dentro de una pastilla con borde
    blanco. A 375px esa pastilla no entra al lado de la billetera, asi
    que se desarma en botones de 38 como en el diseno de celular.
  */
  .mb-iconos__caja {
    border: 0;
    background: transparent;
    padding: 0;
    gap: 8px;
    height: auto;
  }

  .mb-iconos__raya { display: none; }

  .mb-iconos__b {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: #16253f;
  }
}

/* ── La billetera ─────────────────────────────────────────────────── */

.mb-wallet {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 46px;
  padding: 0 5px 0 14px;
  border-radius: 23px;
  background: #0a1630;
  border: 2px solid #1d3a70;
  box-shadow: 0 6px 18px rgba(0, 0, 0, .35);
}

.mb-wallet__saldo {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #fff;
  font-family: inherit;
  font-weight: 900;
  font-size: 16px;
  cursor: pointer;
  @include foco;
}

.mb-wallet__mas {
  position: relative;
  overflow: hidden;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 3px solid #fff;
  background: radial-gradient(circle at 50% 28%, #9fd2ff 0%, #4a94f5 42%, #1f4fc6 100%);
  box-shadow: 0 0 0 2px #1c4fc4, 0 4px 14px rgba(63, 124, 240, .65);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  @include foco;
}

// El reflejo del botón, que es lo que lo hace parecer una pelotita.
.mb-wallet__brillo {
  position: absolute;
  left: 22%;
  top: 8%;
  width: 46%;
  height: 30%;
  border-radius: 50%;
  background: rgba(255, 255, 255, .55);
  transform: rotate(-18deg);
}

.mb-wallet__panel {
  position: absolute;
  left: 50%;
  top: 54px;
  transform: translateX(-50%);
  z-index: 50;
  width: min(320px, 92vw);
  box-sizing: border-box;
  padding: 18px;
  border-radius: 22px;
  border: 2px solid #fff;
  background: #12213a;
  box-shadow: 0 20px 50px rgba(0, 0, 0, .55);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/*
  EN EL TELEFONO, CENTRADA EN LA PANTALLA.

  Colgada debajo del saldo se salía 20px por la izquierda: el saldo no
  está en el medio de la pantalla y el panel mide 320. Fija y centrada
  entra siempre, y queda justo debajo de la cabecera.
*/
@include en-celular {
  .mb-wallet__panel {
    position: fixed;
    top: calc(var(--alto-cabecera, 64px) + 8px);
    width: min(340px, calc(100vw - 24px));
  }
}

.mb-wallet__total { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.mb-wallet__rotulo { font-size: 13px; color: #a9bbe6; }
.mb-wallet__cifra { display: flex; align-items: center; gap: 8px; font-weight: 900; font-size: 32px; }

.mb-wallet__acciones { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }

.mb-wallet__accion {
  border: 0;
  background: transparent;
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  @include foco;
}

.mb-wallet__icono {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: #1d3354;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mb-wallet__lista {
  border-radius: 16px;
  background: #0e1a2e;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mb-wallet__linea {
  height: 46px;
  padding: 0 14px;
  border-radius: 12px;
  background: #16253f;
  color: #fff;
  font-weight: 800;
  font-size: 15px;
  text-decoration: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  @include foco;

  &:hover { color: #fff; background: #1d3354; }
  &--quieta { cursor: default; &:hover { background: #16253f; } }
}

.mb-wallet__linea-izq { display: flex; align-items: center; gap: 10px; }
.mb-wallet__linea-der { display: flex; align-items: center; gap: 6px; font-weight: 900; }
.mb-wallet__linea-der--sola { gap: 0; }
.mb-wallet__cuenta { color: #8ea3c7; }

/* ── Los redondos ─────────────────────────────────────────────────── */

.mb-redondo {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: 2px solid #fff;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  @include foco;
  @include en-celular { display: none; }
}

.mb-iconos { position: relative; }

.mb-iconos__caja {
  display: flex;
  align-items: center;
  height: 46px;
  padding: 3px;
  box-sizing: border-box;
  border-radius: 23px;
  border: 2px solid #fff;
  background: #0b1424;
}

.mb-iconos__b {
  position: relative; /* el ancla de la bolita */
  width: 46px;
  height: 36px;
  border: 0;
  border-radius: 18px;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  @include foco;

  &.is-on { background: #1d3354; }
  &:hover { background: #16294a; }
}

.mb-iconos__raya { width: 1px; height: 20px; background: #3a5687; }

.mb-avisos {
  position: absolute;
  right: 0;
  top: 56px;
  z-index: 60;
  width: 330px;
  height: 430px;
  box-sizing: border-box;
  border-radius: 22px;
  border: 2px solid #fff;
  background: #0e2448;
  box-shadow: 0 20px 50px rgba(0, 0, 0, .55);
  display: flex;
  flex-direction: column;

  /*
    EN EL TELEFONO, CENTRADO EN LA PANTALLA.

    Colgado de la campanita se salia por la derecha: el panel mide 330
    y la campanita vive a 60px del borde. Fijo y centrado entra
    siempre, igual que la billetera.
  */
  @include en-celular {
    position: fixed;
    top: calc(var(--alto-cabecera, 64px) + 8px);
    right: auto;
    left: 50%;
    transform: translateX(-50%);
    width: min(360px, calc(100vw - 24px));
    height: min(430px, 70vh);
  }
}

.mb-avisos__cabeza {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
}

.mb-avisos__titulo { display: flex; align-items: center; gap: 8px; font-weight: 900; font-size: 16px; }

.mb-avisos__todo {
  flex: none;
  height: 38px;
  margin: 0 8px 8px;
  border-radius: 12px;
  border: 0;
  background: #16294a;
  color: $texto-2;
  font-family: inherit;
  font-weight: 800;
  font-size: 12.5px;
  cursor: pointer;
  @include foco;
  &:hover { background: #1d3354; color: #fff; }
}

.mb-avisos__cerrar {
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: 50%;
  border: 0;
  background: #16294a;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  @include foco;
}

.mb-avisos__vacio {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #8ea3c7;
  font-weight: 700;
  font-size: 14px;
}

.mb-avisos__vacioDibujo { color: #2f4a7a; }

/*
  LA LISTA.

  Se desliza ella sola adentro del panel, que mide 430 fijos: si
  creciera con los avisos, treinta de ellos taparian la pantalla.
*/
.mb-avisos__lista {
  flex: 1;
  margin: 0;
  padding: 0 8px 10px;
  list-style: none;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: #2a4472 transparent;
}

.mb-notif {
  width: 100%;
  box-sizing: border-box;
  padding: 10px;
  border: 0;
  border-radius: 14px;
  background: transparent;
  color: inherit;
  font-family: inherit;
  text-align: left;
  display: flex;
  align-items: flex-start;
  gap: 10px;

  /* El que lleva a algun lado se comporta como un boton; el que no, no
     finge que se puede tocar. */
  &.es-tocable {
    cursor: pointer;
    @include foco;
    &:hover { background: #16294a; }
  }

  /* Sin leer: un azul apenas mas claro, como mrloot. Un color fuerte
     para "no leido" convierte la lista en un semaforo. */
  &.es-nuevo { background: rgba(47, 111, 224, .1); }
  &.es-nuevo.es-tocable:hover { background: rgba(47, 111, 224, .18); }
}

.mb-notif__icono {
  width: 34px;
  height: 34px;
  flex: none;
  border-radius: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #16294a;
  color: $texto-2;

  /* Un color por tipo: de reojo se sabe si entro plata o salio un
     paquete sin leer una palabra. */
  &.es-deposito { background: rgba(93, 255, 176, .14); color: $verde; }
  &.es-retiro   { background: rgba(159, 192, 255, .14); color: $enlace; }
  &.es-carrera  { background: rgba(255, 211, 90, .14); color: $amarillo; }
  &.es-desafio  { background: rgba(139, 79, 224, .18); color: #c9a8ff; }
  &.es-envio    { background: rgba(63, 124, 240, .16); color: #8ab6ff; }
  &.es-rango    { background: rgba(245, 184, 10, .16); color: #ffd98a; }
}

.mb-notif__texto { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }

.mb-notif__alto {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;

  b { font-weight: 900; font-size: 13px; color: #fff; }
}

.mb-notif__cuando { flex: none; font-size: 11px; color: $texto-4; }

.mb-notif__linea {
  font-size: 12.5px;
  line-height: 1.4;
  color: $texto-3;
  /* Dos renglones y corta: un aviso es un titular, no un parrafo. */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.mb-notif__punto {
  width: 8px;
  height: 8px;
  flex: none;
  margin-top: 13px;
  border-radius: 50%;
  background: $azul;
}

/* La bolita del boton. */
.mb-iconos__bolita {
  position: absolute;
  top: 2px;
  right: 6px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  box-sizing: border-box;
  border-radius: 8px;
  background: $rareza-pink;
  color: #fff;
  font-weight: 900;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
}

/* ── La cuenta ────────────────────────────────────────────────────── */

.mb-cuenta { position: relative; }

.mb-cuenta__b {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 52px;
  padding: 0 12px 0 6px;
  border-radius: 26px;
  border: 0;
  background: #0b1424;
  color: #fff;
  font-family: inherit;
  cursor: pointer;
  @include foco;
}

.mb-cuenta__avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #2f6fe0;
  border: 2px solid #c9d7f7;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: $fuente-cartel;
  font-size: 18px;
}

.mb-cuenta__datos {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  @include en-celular { display: none; }
}

.mb-cuenta__nombre { font-weight: 800; font-size: 14px; }

.mb-cuenta__xp {
  width: 70px;
  height: 4px;
  border-radius: 2px;
  background: #22385c;
  overflow: hidden;
  span { display: block; min-width: 6%; height: 100%; background: #fff; }
}

.mb-cuenta__entrar { display: flex; gap: 8px; }

/* ── La oferta del encabezado, sin sesion ────────────────────────── */

.mb-regalo {
  grid-column: 2;
  display: flex;
  align-items: center;
  gap: 10px;
  /* Mas alta que los botones de la derecha a proposito: en mrloot la
     oferta del medio es la pieza grande del encabezado, y los dos
     botones son los que la acompanan. */
  height: 60px;
  padding: 0 6px 0 16px;
  border-radius: 30px;
  border: 2px solid rgba(255, 255, 255, .85);
  /* El mismo azul del boton de registrarse: las dos cosas que puede
     hacer el visitante son del mismo color, y se ven de lejos. */
  background: linear-gradient(180deg, #4d93ff, #1f62d8);
  box-shadow: 0 4px 0 rgba(8, 28, 72, .55), inset 0 2px 0 rgba(255, 255, 255, .35);
  text-decoration: none;
  color: #fff;
  white-space: nowrap;
  @include foco;

  &:hover { color: #fff; filter: brightness(1.07); }

  /* En el telefono no entra, y no hace falta: la portada tiene la
     cinta amarilla, que dice lo mismo con todo el ancho. */
  @include en-celular { display: none; }
}

.mb-regalo__estrella { display: flex; flex: none; }

.mb-regalo__texto { display: flex; flex-direction: column; gap: 2px; line-height: 1.05; }
.mb-regalo__t { font-weight: 800; font-size: 13px; opacity: .92; }
.mb-regalo__s { font-family: $fuente-cartel; font-size: 19px; }

/* Los tickets dorados, sobresaliendo de la pastilla como en el
   diseno: es lo que la convierte en un premio y no en un aviso. */
.mb-regalo__arte {
  flex: none;
  width: 76px;
  height: 54px;
  background: url("/img/bono-tickets.webp") center/contain no-repeat;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, .4));
}

.mb-entrar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 46px;
  /* Anchos como los de mrloot: con 16px de aire a los costados los
     dos quedaban mas cerca de un enlace que de un boton. */
  padding: 0 22px;
  text-decoration: none;
  border-radius: 23px;
  border: 2px solid #fff;
  /* Relleno oscuro, no transparente: la cabecera tiene un degrade azul
     claro detras y un boton calado se perdia encima. */
  background: rgba(9, 26, 60, .55);
  color: #fff;
  font-family: inherit;
  font-weight: 900;
  font-size: 14px;
  letter-spacing: .02em;
  cursor: pointer;
  white-space: nowrap;
  @include foco;

  &:hover { background: rgba(9, 26, 60, .78); }

  /*
    El de registrarse es el que queremos que toquen.

    Azul lleno con el brillo arriba, que es lo que lo levanta de la
    pantalla; el de iniciar sesion se queda oscuro. Dos botones del
    mismo peso no eligen por nadie.
  */
  &--fuerte {
    background: linear-gradient(180deg, #4d93ff, #1f62d8);
    color: #fff;
    /* El resplandor azul de alrededor, que es lo que lo despega del
       fondo: sin el, con la cabecera tambien azul, el boton se apoya
       sobre su propio color y no se nota. */
    box-shadow:
      0 4px 0 rgba(8, 28, 72, .55),
      0 0 18px rgba(77, 147, 255, .75),
      inset 0 2px 0 rgba(255, 255, 255, .35);
    &:hover { background: linear-gradient(180deg, #5fa0ff, #2a6ee6); }
  }

  /*
    En el telefono, uno solo.

    Con la billetera y los tres iconos fuera queda sitio, pero dos
    botones del mismo tamano no eligen por el visitante. El que ya
    tiene cuenta entra desde la misma pantalla de registro, que tiene
    el "ya tengo cuenta" arriba de todo.
  */
  &--enPc {
    @include en-celular { display: none; }
  }
}

.mb-menu {
  position: absolute;
  right: 0;
  top: 60px;
  z-index: 70;
  width: 210px;
  box-sizing: border-box;
  padding: 8px;
  border-radius: 18px;
  border: 2px solid #fff;
  background: #0e2448;
  box-shadow: 0 20px 50px rgba(0, 0, 0, .55);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mb-menu__grupo {
  border-radius: 12px;
  background: #12305e;
  padding: 4px;
  display: flex;
  flex-direction: column;
}

.mb-menu__item {
  height: 40px;
  padding: 0 10px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  font-size: 14px;
  text-decoration: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  @include foco;
  &:hover { background: #1b4287; color: #fff; }
}

.mb-menu__pie {
  height: 44px;
  padding: 0 14px;
  border: 0;
  border-radius: 12px;
  background: #12305e;
  color: #fff;
  font-family: inherit;
  font-weight: 800;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  @include foco;
  &:hover { background: #1b4287; }
}
</style>
