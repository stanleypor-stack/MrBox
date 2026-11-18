import Vue from "vue";
import App from "./App.vue";
import i18n, { cargarIdioma } from "./i18n";
import router from "./router";
import store from "./store";
import "./styles/global.scss";

Vue.config.productionTip = false;

/* Antes de dibujar nada se pregunta quien es: asi la pantalla no
   parpadea de "entrar" a "hola fulano" un segundo despues. */
store.dispatch("arrancar");

/*
  Y se espera el idioma, que viene en su propio archivo (ver i18n/).
  Esperarlo es lo que evita que alguien vea medio segundo de ingles
  antes de que llegue el suyo. Si falla --sin red, archivo caido-- se
  dibuja igual: el ingles ya esta adentro del paquete.
*/
cargarIdioma(i18n.locale)
  .catch(() => {})
  .then(() => {
    new Vue({ i18n, router, store, render: (h) => h(App) }).$mount("#app");
  });
