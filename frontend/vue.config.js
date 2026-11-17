const { defineConfig } = require("@vue/cli-service");

module.exports = defineConfig({
  transpileDependencies: true,
  // El backend corre aparte, en 5001. El navegador pide a /api y el
  // servidor de desarrollo lo reenvia: asi no hay CORS ni direcciones
  // distintas entre desarrollo y produccion.
  devServer: {
    port: 8090,
    proxy: { "/api": { target: "http://localhost:5001", changeOrigin: true } },
  },
});
