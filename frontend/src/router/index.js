import Vue from "vue";
import VueRouter from "vue-router";

Vue.use(VueRouter);

/**
 * LAS PANTALLAS.
 *
 * Cada una se carga cuando hace falta y no antes: asi el que entra a ver
 * cajas no se baja el inventario ni el perfil. En un sitio donde la
 * mitad de la gente llega del telefono, eso es medio segundo menos de
 * pantalla en blanco.
 */
const routes = [
  {
    path: "/",
    name: "home",
    component: () => import(/* webpackChunkName: "portada" */ "@/views/HomeView.vue"),
  },
  {
    path: "/boxes",
    name: "boxes",
    component: () => import(/* webpackChunkName: "cajas" */ "@/views/BoxesView.vue"),
  },
  {
    path: "/boxes/:slug",
    name: "box",
    component: () => import(/* webpackChunkName: "cajas" */ "@/views/BoxView.vue"),
  },
  {
    path: "/deals",
    name: "deals",
    component: () => import(/* webpackChunkName: "deals" */ "@/views/DealsView.vue"),
  },
  {
    /* Las tres carreras son la misma pantalla con otro `tipo`. */
    path: "/races/:tipo",
    name: "race",
    component: () => import(/* webpackChunkName: "carreras" */ "@/views/RaceView.vue"),
  },
  { path: "/races", redirect: "/races/weekly" },
  {
    path: "/community",
    name: "community",
    component: () => import(/* webpackChunkName: "comunidad" */ "@/views/CommunityView.vue"),
  },
  {
    path: "/create",
    name: "create",
    component: () => import(/* webpackChunkName: "comunidad" */ "@/views/CreateBoxView.vue"),
  },
  {
    path: "/dashboard",
    name: "dashboard",
    component: () => import(/* webpackChunkName: "comunidad" */ "@/views/DashboardView.vue"),
  },
  {
    path: "/promotions",
    name: "promotions",
    component: () => import(/* webpackChunkName: "extras" */ "@/views/PromotionsView.vue"),
  },
  {
    path: "/challenges",
    name: "challenges",
    component: () => import(/* webpackChunkName: "extras" */ "@/views/ChallengesView.vue"),
  },
  {
    path: "/rewards",
    name: "rewards",
    component: () => import(/* webpackChunkName: "extras" */ "@/views/RewardsView.vue"),
  },
  {
    path: "/affiliates",
    name: "affiliates",
    component: () => import(/* webpackChunkName: "extras" */ "@/views/AffiliatesView.vue"),
  },
  {
    path: "/vip",
    name: "vip",
    component: () => import(/* webpackChunkName: "extras" */ "@/views/VipView.vue"),
  },
  {
    path: "/inventory",
    name: "inventory",
    component: () => import(/* webpackChunkName: "cuenta" */ "@/views/InventoryView.vue"),
  },
  {
    path: "/profile",
    name: "profile",
    component: () => import(/* webpackChunkName: "cuenta" */ "@/views/ProfileView.vue"),
  },
  /*
    Registrarse y entrar son PANTALLAS, no una ventanita.

    Asi tienen direccion propia --se puede mandar el link de registro en
    una campana-- vuelven con el boton de atras, y el cartel del diseno
    entra entero. En una ventanita flotante ese cartel no cabe.
  */
  {
    path: "/signup",
    name: "signup",
    component: () => import(/* webpackChunkName: "entrar" */ "@/views/AuthView.vue"),
  },
  {
    path: "/login",
    name: "login",
    component: () => import(/* webpackChunkName: "entrar" */ "@/views/AuthView.vue"),
  },

  /*
    EL PANEL.

    Cuelga todo de /admin con el armazon afuera y la pantalla adentro,
    asi el menu lateral no se vuelve a dibujar al cambiar de seccion.

    LAS VEINTITANTAS LISTAS SON UNA SOLA PANTALLA

    `AdminLista` las dibuja a todas desde `secciones.js` (ver el
    comentario de ese archivo). Las que de verdad son otra cosa --el
    tablero, un jugador, una caja, soporte, la configuracion-- tienen
    su componente.

    El guardia de verdad esta en el SERVIDOR: cada ruta de /api/admin
    pide rango. Esto solo decide que se dibuja.
  */
  {
    path: "/admin",
    component: () => import(/* webpackChunkName: "panel" */ "@/views/admin/AdminShell.vue"),
    children: [
      { path: "", redirect: "dashboard" },
      {
        path: "dashboard",
        name: "admin",
        component: () => import(/* webpackChunkName: "panel" */ "@/views/admin/AdminDashboard.vue"),
      },
      {
        path: "players/:id",
        name: "adminPlayer",
        component: () => import(/* webpackChunkName: "panel" */ "@/views/admin/AdminJugador.vue"),
      },
      {
        path: "boxes/:id",
        name: "adminBox",
        component: () => import(/* webpackChunkName: "panel" */ "@/views/admin/AdminCaja.vue"),
      },
      {
        path: "support",
        name: "adminSupport",
        component: () => import(/* webpackChunkName: "panel" */ "@/views/admin/AdminSoporte.vue"),
      },
      {
        path: "settings",
        name: "adminSettings",
        component: () => import(/* webpackChunkName: "panel" */ "@/views/admin/AdminSettings.vue"),
      },
      /*
        Las dos que son UNA tabla y no filas sueltas: los nueve rangos
        VIP y las filas de la portada. Se editan enteras y se guardan
        de una, porque sus valores se miran entre ellos.
      */
      {
        path: "ranks",
        name: "adminRanks",
        component: () => import(/* webpackChunkName: "panel" */ "@/views/admin/AdminTabla.vue"),
      },
      {
        path: "home",
        name: "adminHome",
        component: () => import(/* webpackChunkName: "panel" */ "@/views/admin/AdminTabla.vue"),
      },

      /* Y el resto: una lista, la que diga la direccion. */
      {
        path: ":seccion",
        name: "adminList",
        component: () => import(/* webpackChunkName: "panel" */ "@/views/admin/AdminLista.vue"),
      },
    ],
  },

  /* Lo que no existe vuelve al catalogo, que es de donde arranca todo. */
  { path: "*", redirect: "/boxes" },
];

const router = new VueRouter({
  mode: "history",
  routes,
  /* Al cambiar de pantalla se vuelve arriba. Sin esto, entrar a una caja
     desde la mitad de la grilla te deja mirando el pie de pagina. */
  scrollBehavior: (to, from, guardada) => guardada || { x: 0, y: 0 },
});

export default router;
