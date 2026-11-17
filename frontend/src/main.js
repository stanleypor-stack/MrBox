import Vue from "vue";
import App from "./App.vue";
import i18n from "./i18n";
import router from "./router";
import store from "./store";
import "./styles/global.scss";

Vue.config.productionTip = false;

/* Antes de dibujar nada se pregunta quien es: asi la pantalla no
   parpadea de "entrar" a "hola fulano" un segundo despues. */
store.dispatch("arrancar");

new Vue({ i18n, router, store, render: (h) => h(App) }).$mount("#app");
