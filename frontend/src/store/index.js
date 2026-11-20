import Vue from "vue";
import Vuex from "vuex";

import api, { guardarToken, leerToken } from "@/api";

Vue.use(Vuex);

/**
 * EL ESTADO DEL SITIO.
 *
 * Chico a propósito. Solo vive acá lo que necesitan VARIAS pantallas: el
 * jugador y su saldo, y el catálogo de cajas. Lo que usa una sola
 * pantalla se queda en esa pantalla.
 *
 * EL SALDO SIEMPRE VIENE DEL SERVIDOR
 *
 * Nunca se calcula acá. Toda respuesta que mueve plata trae el saldo
 * nuevo, y se guarda ese. Restar en el navegador "para que se vea
 * rápido" es cómo se termina mostrando un saldo que no existe, y el
 * jugador confía en lo que ve.
 */

export default new Vuex.Store({
  state: {
    usuario: null,
    cargandoUsuario: true,

    cajas: { items: [], total: 0, page: 1, pages: 0 },
    cargandoCajas: false,
    categorias: [],

    /* El cartel de arriba a la derecha. */
    aviso: null,

    /*
      LO QUE ESTA ABIERTO EN EL CELULAR.

      El cajón del menú, la billetera y el menú de la cuenta se abren
      desde la barra de abajo --que es un componente-- pero los dibujan
      la barra lateral y la cabecera, que son otros dos. Tres hermanos
      que no se ven entre sí.

      Vive acá y no en cada uno porque abrir uno tiene que cerrar los
      otros dos: con tres banderas sueltas, el cajón y la billetera
      terminan abiertos a la vez, uno encima del otro.
    */
    abierto: { cajon: false, wallet: false, cuenta: false },

    /*
      EL GLOBITO DE SOPORTE.

      `pedidos` es un contador y no una bandera: con una bandera, cerrar
      el globito y volver a tocar "Soporte" no lo abriria otra vez,
      porque el valor ya estaba en true.

      `borrador` es para los botones que abren el chat con el mensaje
      empezado --el traslado de rango del Club VIP-- en vez de dejar a
      la persona redactandolo de cero.
    */
    soporte: { pedidos: 0, borrador: "" },

    /*
      CUANDO CAMBIO EL INVENTARIO.

      Un contador, no una lista: lo unico que hace falta es avisarle a
      la cabecera que su resumen quedo viejo. Abrir una caja o vender
      un objeto lo suben, y la billetera de arriba se vuelve a leer.

      Sin esto, alguien abria cuatro cajas y la billetera seguia
      diciendo "0 objetos" hasta recargar la pagina.
    */
    inventarioCambio: 0,
  },

  getters: {
    entro: (s) => !!s.usuario,
    saldo: (s) => (s.usuario ? s.usuario.balanceSc : 0),
    canjeable: (s) => (s.usuario ? s.usuario.canjeableSc : 0),
    aperturasGratis: (s) => (s.usuario ? s.usuario.freeOpens : 0),
    esAdmin: (s) => !!s.usuario && ["admin", "owner"].includes(s.usuario.rank),
    /* Cuando se abrio la cuenta. La usa la cuenta regresiva del bono de
       bienvenida, que corre desde ahi y no desde que se dibuja. */
    cuentaDesde: (s) => (s.usuario ? s.usuario.createdAt : null),
  },

  mutations: {
    usuario(s, u) { s.usuario = u; },
    cargandoUsuario(s, v) { s.cargandoUsuario = !!v; },

    /**
     * Mete el saldo nuevo sin pisar el resto del jugador.
     *
     * Las respuestas de abrir, vender y cobrar traen el saldo pero no el
     * jugador entero: si se asignara la respuesta completa, se perderían
     * el nombre y el rango.
     */
    /* Un cambio suelto del jugador --la foto, por ejemplo-- sin tener
       que volver a pedir la cuenta entera. */
    parcheUsuario(s, datos) {
      if (!s.usuario || !datos) return;
      s.usuario = { ...s.usuario, ...datos };
    },

    saldo(s, datos) {
      if (!s.usuario || !datos) return;
      const campos = ["balanceSc", "bonoPendienteSc", "canjeableSc", "freeOpens", "jugadoSc"];
      const nuevo = { ...s.usuario };
      for (const c of campos) if (datos[c] !== undefined) nuevo[c] = datos[c];
      s.usuario = nuevo;
    },

    soporte(s, borrador) {
      s.soporte = { pedidos: s.soporte.pedidos + 1, borrador: borrador || "" };
    },

    inventarioCambio(s) { s.inventarioCambio += 1; },

    cajas(s, v) { s.cajas = v; },
    cargandoCajas(s, v) { s.cargandoCajas = !!v; },
    categorias(s, v) { s.categorias = v || []; },
    aviso(s, v) { s.aviso = v; },

    /** Abre uno y cierra los otros dos. `null` cierra todo. */
    abrir(s, cual) {
      s.abierto = {
        cajon: cual === "cajon",
        wallet: cual === "wallet",
        cuenta: cual === "cuenta",
      };
    },

    /** Lo mismo pero alternando: tocar el que ya está abierto lo cierra. */
    alternar(s, cual) {
      const estaba = s.abierto[cual];
      s.abierto = { cajon: false, wallet: false, cuenta: false, [cual]: !estaba };
    },
  },

  actions: {
    /** Abre el chat de soporte, con un texto ya escrito si hace falta. */
    pedirSoporte({ commit }, borrador) {
      commit("soporte", borrador);
      commit("abrir", null);
    },

    /** Al arrancar: si hay token, preguntar quién es. */
    async arrancar({ commit, dispatch }) {
      if (!leerToken()) {
        commit("cargandoUsuario", false);
        return;
      }
      try {
        const { data } = await api.get("/auth/me");
        commit("usuario", data.user);
      } catch {
        /* Token viejo o cuenta cerrada: el interceptor ya lo limpió. */
        commit("usuario", null);
      } finally {
        commit("cargandoUsuario", false);
      }
    },

    async entrar({ commit }, { email, password, captchaToken }) {
      const { data } = await api.post("/auth/login", { email, password, captchaToken });
      guardarToken(data.token);
      commit("usuario", data.user);
      return data.user;
    },

    async registrarse({ commit }, datos) {
      const { data } = await api.post("/auth/register", datos);
      guardarToken(data.token);
      commit("usuario", data.user);
      return data;
    },

    /*
      ENTRAR CON GOOGLE.

      Igual que `registrarse` y `entrar`: el token y el usuario se
      guardan ACA y no en la pantalla, asi hay un solo lugar donde
      empieza una sesion.
    */
    async conGoogle({ commit }, datos) {
      const { data } = await api.post("/auth/google", datos);
      guardarToken(data.token);
      commit("usuario", data.user);
      return data;
    },

    salir({ commit }) {
      guardarToken(null);
      commit("usuario", null);
    },

    async traerCajas({ commit }, opciones = {}) {
      commit("cargandoCajas", true);
      try {
        const { data } = await api.get("/boxes", { params: opciones });
        commit("cajas", data.data);
      } finally {
        commit("cargandoCajas", false);
      }
    },

    async traerCategorias({ commit }) {
      try {
        const { data } = await api.get("/boxes/categories");
        commit("categorias", data.data);
      } catch {
        /* Sin categorías la pantalla anda igual, con menos filtros. */
      }
    },

    /** Un cartel que se va solo. */
    avisar({ commit }, { texto, tono = "info" }) {
      commit("aviso", { texto, tono, id: Date.now() });
      setTimeout(() => commit("aviso", null), 4000);
    },
  },
});
