<template>
  <!--
    LA TIRA DE LA CARRERA DIARIA. SOLO EN EL TELEFONO.

    Copiada de la de giveaways.com: a la izquierda el pozo y el nombre,
    a la derecha el reloj en tres casilleros. Lo nuestro son los colores
    y la foto de las banderas, la misma del cartel de carreras.

    No se dibuja si no hay una carrera diaria viva. Un cartel que dice
    "$0" y un reloj en cero es peor que no tener cartel.
  -->
  <router-link
    v-if="hay"
    class="mb-tirac"
    :to="{ name: 'race', params: { tipo: 'daily' } }"
    :aria-label="$t('races.stripGo')"
  >
    <!-- La foto, sangrando por la derecha. Decorativa: lo que dice el
         cartel ya esta escrito al lado. -->
    <span class="mb-tirac__banderas" aria-hidden="true"></span>

    <span class="mb-tirac__texto">
      <span class="mb-tirac__pozo">{{ pozo }}</span>
      {{ $t('races.daily') }}
    </span>

    <span class="mb-tirac__reloj">
      <span class="mb-tirac__casillero">{{ reloj.hs }}</span>
      <span class="mb-tirac__dospuntos">:</span>
      <span class="mb-tirac__casillero">{{ reloj.min }}</span>
      <span class="mb-tirac__dospuntos">:</span>
      <span class="mb-tirac__casillero">{{ reloj.seg }}</span>
    </span>
  </router-link>
</template>

<script>
export default {
  name: "MbTiraDeCarrera",

  data() {
    return { ahora: Date.now(), tic: null };
  },

  computed: {
    /* La diaria de las tres que trae el resumen. */
    carrera() {
      const todas = this.$store.state.carreras || [];
      return todas.find((c) => c.tipo === "daily" && c.hasta) || null;
    },

    /* Viva es: existe y todavia no termino. Si el reloj llego a cero y
       el servidor no la cerro aun, la tira se va sola. */
    hay() {
      if (!this.carrera) return false;
      return new Date(this.carrera.hasta).getTime() > this.ahora;
    },

    /* "$2K" como en el cartel grande, no "SC 2,000.00": en 375px de
       ancho el numero largo empuja el reloj fuera de la pantalla. */
    pozo() {
      const v = this.carrera ? this.carrera.premioTotalSc : 0;
      return v >= 1000 ? `$${Math.round(v / 1000)}K` : `$${Math.round(v)}`;
    },

    /*
      HORAS, MINUTOS Y SEGUNDOS. SIN DIAS.

      La diaria nunca pasa de 24 horas, asi que un casillero de dias
      diria "00" todo el tiempo y le sacaria lugar a los que importan.
    */
    reloj() {
      const falta = this.carrera
        ? Math.max(0, new Date(this.carrera.hasta).getTime() - this.ahora)
        : 0;
      const s = Math.floor(falta / 1000);
      const dos = (n) => String(n).padStart(2, "0");
      return {
        hs: dos(Math.floor(s / 3600)),
        min: dos(Math.floor((s % 3600) / 60)),
        seg: dos(s % 60),
      };
    },
  },

  created() {
    /* El store lo pide una sola vez por visita: si ya esta, no viaja. */
    this.$store.dispatch("traerCarreras");
  },

  mounted() {
    this.tic = setInterval(() => { this.ahora = Date.now(); }, 1000);
  },

  beforeDestroy() {
    if (this.tic) clearInterval(this.tic);
  },
};
</script>

<style lang="scss" scoped>
@import "@/styles/tokens";

/*
  EN EL TELEFONO Y NADA MAS.

  Se apaga con CSS y no con un `v-if` sobre el ancho: asi girar el
  telefono o cambiar el tamano de la ventana la prende y la apaga sola,
  sin escuchar `resize` ni volver a dibujar nada.
*/
.mb-tirac { display: none; }

@include en-celular {
  .mb-tirac {
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    gap: 9px;
    height: 46px;
    padding: 0 14px;
    text-decoration: none;

    /*
      DE LADO A LADO, SIN BORDES.

      El contenido de la pagina tiene 14px de aire a cada lado en el
      telefono (ver `.mb-contenido` en App.vue). Los margenes negativos
      se los comen para que la tira toque los dos bordes.

      Con margenes negativos y no con `100vw`: `100vw` incluye el ancho
      de la barra de desplazamiento, asi que en cuanto alguien abre esto
      en una ventana angosta de escritorio la tira sobresale y aparece
      un desplazamiento horizontal en toda la pagina.
    */
    margin-left: -14px;
    margin-right: -14px;

    /*
      Y PEGADA A LA CABECERA, SIN AIRE EN EL MEDIO.

      Los mismos 14px de relleno que sobran a los costados sobran
      arriba: dejaban una franja del fondo de la pagina entre el
      degrade azul de la cabecera y la tira, y las dos se leian como
      dos cosas sueltas en vez de una barra continua.
    */
    margin-top: -14px;

    /*
      El azul de la foto, seguido hacia la izquierda: el mismo par de
      capas del cartel de carreras, para que la tira y el cartel se vean
      de la misma familia. El halo va mas a la derecha que en el cartel
      porque aca la foto entra recien al final.
    */
    background:
      radial-gradient(130% 230% at 74% 28%,
        rgba(83, 152, 247, .46) 0%,
        rgba(83, 152, 247, .12) 50%,
        rgba(83, 152, 247, 0) 76%),
      linear-gradient(180deg, #16263f 0%, #22406f 100%);

    @include foco;
  }
}

/*
  LA FOTO.

  Un recorte propio --`banderas-tira.webp`, la banda ancha y baja con
  las dos banderas cruzadas-- y no la foto entera. La entera mide 737
  x 468: metida en un hueco de 132 x 46 con `cover` entra tan de cerca
  que se ven cuatro cuadros gigantes y no se reconoce que son
  banderas. El recorte ya viene con la proporcion del hueco, pesa la
  mitad, y de paso no baja la foto grande quien solo ve la tira.

  Desvanecida hacia la izquierda con una mascara, igual que en el
  cartel. Sin la mascara se ve el borde de la foto como una linea
  vertical en el medio de la tira.
*/
.mb-tirac__banderas {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  width: 132px;
  /*
    El recorte llega hasta donde empieza la zapatilla: cortada a 46px
    de alto se leia como una mancha, y sacarla del archivo es mas
    limpio que esconderla moviendo el encuadre. Lo que queda son las
    dos telas cruzadas, que es lo que se tiene que reconocer de un
    vistazo.
  */
  background: url("/img/carreras/banderas-tira.webp") center 44% / cover no-repeat;

  mask-image: linear-gradient(90deg, transparent 0%, #000 52%, #000 100%);
  -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 52%, #000 100%);
}

.mb-tirac__texto {
  position: relative;
  flex-grow: 1;
  min-width: 0;
  font-weight: 900;
  font-size: 13px;
  letter-spacing: .035em;
  color: $texto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mb-tirac__pozo { color: $amarillo; }

.mb-tirac__reloj {
  position: relative;
  flex: none;
  display: flex;
  align-items: center;
  gap: 3px;
}

/*
  Fondo propio y oscuro en cada numero: la foto le pasa por detras, y
  sin el los digitos caen sobre los cuadros blancos de la bandera y no
  se leen.
*/
.mb-tirac__casillero {
  min-width: 25px;
  padding: 4px 5px;
  border-radius: 7px;
  background: rgba(5, 14, 32, .62);
  color: $texto;
  text-align: center;
  font-weight: 800;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

/*
  Los dos puntos no tienen casillero, asi que caen directo sobre la
  foto. Sobre un cuadro blanco de la bandera un gris al 45% desaparece
  y el reloj se lee "05 46 24", tres numeros sueltos. Mas opacos y con
  una sombra dura debajo, se leen sobre cualquiera de los dos cuadros.
*/
.mb-tirac__dospuntos {
  color: rgba(255, 255, 255, .72);
  font-weight: 800;
  font-size: 11px;
  text-shadow: 0 1px 2px rgba(5, 14, 32, .95), 0 0 3px rgba(5, 14, 32, .9);
}
</style>
