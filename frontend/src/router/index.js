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
  { path: "/", redirect: "/boxes" },
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
    path: "/inventory",
    name: "inventory",
    component: () => import(/* webpackChunkName: "cuenta" */ "@/views/InventoryView.vue"),
  },
  {
    path: "/profile",
    name: "profile",
    component: () => import(/* webpackChunkName: "cuenta" */ "@/views/ProfileView.vue"),
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
