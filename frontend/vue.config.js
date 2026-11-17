const { defineConfig } = require("@vue/cli-service");

module.exports = defineConfig({
  transpileDependencies: true,
  // El backend corre aparte, en 5001. El navegador pide a /api y el
  // servidor de desarrollo lo reenvia: asi no hay CORS ni direcciones
  // distintas entre desarrollo y produccion.
  /*
    LAS RUTAS QUE EMPIEZAN CON "/" SON DE public/, NO MODULOS.

    Por defecto css-loader intenta resolver cada url() del CSS como si
    fuera un archivo del codigo, y se planta con "Can't resolve
    '/img/...'". Las laminas de arte y las fuentes viven en public/ y el
    navegador las pide por su direccion: hay que dejarlas pasar tal cual.

    Las relativas se siguen procesando como siempre.
  */
  css: {
    loaderOptions: {
      css: {
        url: { filter: (url) => !url.startsWith("/") },
      },
    },
  },

  devServer: {
    port: 8090,
    proxy: { "/api": { target: "http://localhost:5001", changeOrigin: true } },
  },
});
