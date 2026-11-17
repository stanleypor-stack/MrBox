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
  },

  getters: {
    entro: (s) => !!s.usuario,
    saldo: (s) => (s.usuario ? s.usuario.balanceSc : 0),
    canjeable: (s) => (s.usuario ? s.usuario.canjeableSc : 0),
    aperturasGratis: (s) => (s.usuario ? s.usuario.freeOpens : 0),
    esAdmin: (s) => !!s.usuario && ["admin", "owner"].includes(s.usuario.rank),
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
    saldo(s, datos) {
      if (!s.usuario || !datos) return;
      const campos = ["balanceSc", "bonoPendienteSc", "canjeableSc", "freeOpens", "jugadoSc"];
      const nuevo = { ...s.usuario };
      for (const c of campos) if (datos[c] !== undefined) nuevo[c] = datos[c];
      s.usuario = nuevo;
    },

    cajas(s, v) { s.cajas = v; },
    cargandoCajas(s, v) { s.cargandoCajas = !!v; },
    categorias(s, v) { s.categorias = v || []; },
    aviso(s, v) { s.aviso = v; },
  },

  actions: {
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
