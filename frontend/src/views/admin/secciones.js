/**
 * LAS PANTALLAS DE LISTA DEL PANEL, EN UNA TABLA.
 *
 * Cada entrada dice de dónde saca los datos, qué columnas muestra, qué
 * ancho tiene cada una, qué se puede filtrar y qué botones tiene cada
 * fila. `AdminLista.vue` las dibuja todas.
 *
 * POR QUE ASI Y NO VEINTISEIS ARCHIVOS
 *
 * Porque son veintiséis veces la misma pantalla: buscar, filtrar, mirar
 * y a veces tocar un botón. Veintiséis archivos que empiezan iguales
 * terminan distintos --uno pagina y otro no, uno muestra el total y
 * otro no-- y nadie se da cuenta hasta que alguien pregunta por qué.
 *
 * Lo que de verdad es otra cosa --el tablero, la ficha de un jugador,
 * el editor de cajas, la bandeja de soporte, la configuración-- tiene
 * su propio archivo.
 *
 * LOS ANCHOS SON LOS DEL DISEÑO
 *
 * `w` es la línea de `grid-template-columns` de esa pantalla y sale del
 * prototipo. `ancho` es el mínimo antes de que la tabla se deslice de
 * costado: abajo de eso, ocho columnas en un teléfono no se leen.
 */

const SECCIONES = {

  /* ══ Operación ═══════════════════════════════════════════════════ */

  players: {
    ruta: "/admin/players",
    busca: true,
    porPagina: 25,
    ancho: "980px",
    w: "1.6fr 1.8fr .8fr .8fr 1fr 1fr 1fr .9fr",
    filtros: [
      { campo: "rank", opciones: ["user", "support", "admin", "owner"], textos: "admin.rank" },
    ],
    columnas: [
      { campo: "username", enlace: (f) => `/admin/players/${f._id}` },
      { campo: "email", tenue: true },
      { campo: "rank" },
      { campo: "verificationLevel", der: true, tipo: "numero" },
      { campo: "balanceSc", der: true, tipo: "sc" },
      { campo: "jugadoSc", der: true, tipo: "sc" },
      { campo: "createdAt", tipo: "fecha", tenue: true },
      {
        campo: "banned",
        tipo: "estado",
        valor: (f) => (f.banned ? "banned" : "active"),
        textos: "admin.state",
      },
    ],
  },

  movements: {
    ruta: "/admin/movements",
    porPagina: 50,
    ancho: "1000px",
    w: "1.1fr 1fr 1.1fr .9fr .9fr 1.8fr",
    accion: { texto: "admin.act.csv", que: "csv" },
    filtros: [
      {
        campo: "type",
        opciones: [
          "purchase", "redemption", "box_open", "deal", "item_sold", "rakeback",
          "race_prize", "challenge", "affiliate", "creator_share", "promo_code", "manual",
        ],
        textos: "txType",
      },
    ],
    numeros: (d, vm) => [
      { rotulo: vm.$t("admin.num.moved"), valor: "SC " + vm.plata(d.movidoSc) },
      { rotulo: vm.$t("admin.num.rows"), valor: vm.num(d.total) },
    ],
    columnas: [
      { campo: "createdAt", tipo: "fechaHora", tenue: true },
      { campo: "username" },
      { campo: "type", tipo: "tipoTx" },
      { campo: "amountSc", der: true, tipo: "scFirmado" },
      { campo: "balanceAfter", der: true, tipo: "sc", tenue: true },
      { campo: "label", valor: (f) => f.label || f.reason || "", tenue: true },
    ],
  },

  orders: {
    ruta: "/admin/orders",
    porPagina: 25,
    ancho: "1100px",
    w: ".9fr 1fr .6fr .9fr 1.6fr 1.2fr 1fr .9fr",
    anchoDeAcciones: "190px",
    filtros: [
      {
        campo: "estado",
        opciones: ["pending", "packing", "shipped", "delivered", "cancelled"],
        textos: "order",
      },
    ],
    numeros: (d, vm) => Object.entries(d.porEstado || {}).map(([k, v]) => ({
      rotulo: vm.$t("order." + k), valor: vm.num(v),
    })),
    columnas: [
      { campo: "codigo" },
      { campo: "username" },
      { campo: "cuantos", der: true, tipo: "numero", valor: (f) => f.items.length },
      { campo: "valorSc", der: true, tipo: "sc" },
      { campo: "destino", valor: (f) => `${f.destino.ciudad}, ${f.destino.pais}`, tenue: true },
      { campo: "seguimiento", valor: (f) => f.seguimiento || "", tenue: true },
      { campo: "createdAt", tipo: "fecha", tenue: true },
      { campo: "estado", tipo: "estado", textos: "order" },
    ],
    acciones: (f) => {
      if (f.estado === "pending") {
        return [
          { clave: "pack", texto: "admin.act.pack", ruta: (x) => `/admin/orders/${x._id}/state`, cuerpo: () => ({ estado: "packing" }) },
          { clave: "cancel", texto: "admin.act.cancel", clase: "ad-b--mal", pideMotivo: true, pregunta: "admin.whyCancel", ruta: (x) => `/admin/orders/${x._id}/state`, cuerpo: () => ({ estado: "cancelled" }) },
        ];
      }
      if (f.estado === "packing") {
        return [
          {
            clave: "ship",
            texto: "admin.act.ship",
            /* El transportista y el número se piden acá: un pedido
               despachado sin seguimiento es un mail a soporte. */
            ruta: (x) => `/admin/orders/${x._id}/state`,
            campos: [
              { clave: "transportista", rotulo: "admin.ship.carrier", ejemplo: "DHL" },
              { clave: "seguimiento", rotulo: "admin.ship.tracking", ejemplo: "1Z999AA10123456784" },
            ],
            cuerpo: () => ({ estado: "shipped" }),
          },
          { clave: "cancel", texto: "admin.act.cancel", clase: "ad-b--mal", pideMotivo: true, pregunta: "admin.whyCancel", ruta: (x) => `/admin/orders/${x._id}/state`, cuerpo: () => ({ estado: "cancelled" }) },
        ];
      }
      if (f.estado === "shipped") {
        return [
          { clave: "deliver", texto: "admin.act.delivered", ruta: (x) => `/admin/orders/${x._id}/state`, cuerpo: () => ({ estado: "delivered" }) },
        ];
      }
      return [];
    },
  },

  verification: {
    ruta: "/admin/verification",
    ancho: "980px",
    w: "1.2fr 1.6fr .7fr .7fr .7fr 1.1fr .9fr",
    anchoDeAcciones: "210px",
    filtros: [
      { campo: "estado", opciones: ["pending", "approved", "rejected"], textos: "kyc.state" },
    ],
    numeros: (d, vm) => Object.entries(d.porEstado || {}).map(([k, v]) => ({
      rotulo: vm.$t("kyc.state." + k), valor: vm.num(v),
    })),
    columnas: [
      { campo: "username", enlace: (f) => `/admin/players/${f.userId}` },
      { campo: "email", tenue: true },
      { campo: "nivel", der: true, tipo: "numero" },
      { campo: "nivelActual", der: true, tipo: "numero" },
      { campo: "adjuntos", valor: (f) => (f.adjuntos || []).length, der: true, tipo: "numero" },
      { campo: "createdAt", tipo: "fechaHora", tenue: true },
      { campo: "estado", tipo: "estado", textos: "kyc.state" },
    ],
    /*
      LO QUE MANDO, DESDE ACA.

      Antes habia que entrar a la ficha de cada jugador: para revisar
      diez documentos, diez idas y vueltas. Se pide aparte y queda
      anotado quien lo miro, que es lo que corresponde con el documento
      de una persona.
    */
    detalle: {
      ruta: (f) => `/admin/verification/${f._id}/data`,
      archivo: (f, campo) => `/admin/verification/${f._id}/files/${campo}`,
    },
    acciones: (f) => (f.estado !== "pending" ? [] : [
      { clave: "ok", texto: "admin.act.approve", ruta: (x) => `/admin/verification/${x.userId}/${x.nivel}`, cuerpo: () => ({ aprobar: true }) },
      { clave: "no", texto: "admin.act.reject", clase: "ad-b--mal", pideMotivo: true, pregunta: "admin.whyReject", ruta: (x) => `/admin/verification/${x.userId}/${x.nivel}`, cuerpo: () => ({ aprobar: false }) },
    ]),
  },

  redemptions: {
    ruta: "/admin/redemptions",
    porPagina: 25,
    ancho: "1100px",
    w: "1fr 1.1fr .8fr .7fr .9fr 2fr .9fr",
    anchoDeAcciones: "230px",
    filtros: [
      { campo: "estado", opciones: ["pending", "approved", "paid", "rejected"], textos: "cashier.state" },
    ],
    numeros: (d, vm) => [
      { rotulo: vm.$t("cashier.state.pending"), valor: vm.num(d.porEstado.pending || 0), clase: (d.porEstado.pending || 0) ? "ad-amarillo" : "" },
      { rotulo: vm.$t("admin.num.waitingSc"), valor: "SC " + vm.plata(d.pendienteSc) },
      { rotulo: vm.$t("cashier.state.paid"), valor: vm.num(d.porEstado.paid || 0) },
      {
        rotulo: vm.$t("admin.num.payouts"),
        valor: d.listaParaPagar ? vm.$t("admin.state.on") : vm.$t("admin.state.off"),
        clase: d.listaParaPagar ? "ad-verde" : "ad-amarillo",
      },
    ],
    columnas: [
      { campo: "createdAt", tipo: "fechaHora", tenue: true },
      { campo: "username", enlace: (f) => `/admin/players/${f.userId}` },
      { campo: "montoSc", der: true, tipo: "sc" },
      { campo: "nivel", der: true, tipo: "numero" },
      { campo: "moneda", valor: (f) => `${f.moneda} · ${f.red}` },
      { campo: "direccion", tenue: true },
      { campo: "estado", tipo: "estado", textos: "cashier.state" },
    ],
    acciones: (f) => {
      if (f.estado === "pending") {
        return [
          { clave: "ok", texto: "admin.act.approve", ruta: (x) => `/admin/redemptions/${x._id}/approve` },
          { clave: "no", texto: "admin.act.reject", clase: "ad-b--mal", pideMotivo: true, pregunta: "admin.whyReject", ruta: (x) => `/admin/redemptions/${x._id}/reject` },
        ];
      }
      if (f.estado === "approved") {
        return [
          { clave: "pay", texto: "admin.act.pay", confirma: "admin.confirmPay", ruta: (x) => `/admin/redemptions/${x._id}/pay` },
          { clave: "no", texto: "admin.act.reject", clase: "ad-b--mal", pideMotivo: true, pregunta: "admin.whyReject", ruta: (x) => `/admin/redemptions/${x._id}/reject` },
        ];
      }
      return [];
    },
  },

  risk: {
    ruta: "/admin/risk",
    ancho: "900px",
    w: "1.4fr 1.6fr 2fr 1fr",
    numeros: (d, vm) => [
      { rotulo: vm.$t("admin.signal.shared_ip"), valor: vm.num(d.porSenal.shared_ip) },
      { rotulo: vm.$t("admin.signal.self_referral"), valor: vm.num(d.porSenal.self_referral) },
      { rotulo: vm.$t("admin.signal.cashed_out_more"), valor: vm.num(d.porSenal.cashed_out_more) },
    ],
    columnas: [
      { campo: "senal", valor: (f) => f.senal, tipo: "clave", clase: () => "", enlace: null },
      { campo: "cuentas" },
      { campo: "detalle", tenue: true },
      { campo: "cuando", tipo: "fechaHora", tenue: true },
    ],
  },

  /* ══ Catálogo ════════════════════════════════════════════════════ */

  boxes: {
    ruta: "/admin/boxes",
    busca: true,
    porPagina: 50,
    ancho: "1100px",
    w: "2.2fr 1fr .9fr .7fr .8fr .9fr .8fr .9fr",
    anchoDeAcciones: "120px",
    columnas: [
      { campo: "name", enlace: (f) => `/admin/boxes/${f._id}` },
      { campo: "category", tenue: true },
      { campo: "priceSc", der: true, tipo: "sc" },
      { campo: "cuantosObjetos", der: true, tipo: "numero" },
      { campo: "retorno", der: true, tipo: "pct" },
      {
        campo: "retornoReal",
        der: true,
        tipo: "pct",
        /*
          El retorno real con pocas aperturas no dice nada: con cien
          tiradas, una caja puede marcar 70% o 130% sin que haya nada
          mal. Se muestra en gris hasta que haya suficientes.
        */
        clase: (f) => (f.pocasAperturas ? "ad-tenue" : (Math.abs(f.retornoReal - 92) > 3 ? "ad-amarillo" : "ad-verde")),
      },
      { campo: "opens", der: true, tipo: "numero" },
      { campo: "live", tipo: "estado", valor: (f) => (f.live ? "live" : "off"), textos: "admin.state" },
    ],
    acciones: (f) => [
      {
        clave: "live",
        texto: f.live ? "admin.act.unpublish" : "admin.act.publish",
        clase: f.live ? "ad-b--mal" : "",
        ruta: (x) => `/admin/boxes/${x._id}/live`,
        cuerpo: (x) => ({ live: !x.live }),
      },
    ],
  },

  community: {
    ruta: "/admin/community",
    ancho: "1000px",
    w: "2fr 1.1fr .9fr .7fr .8fr .8fr 1fr .9fr",
    anchoDeAcciones: "210px",
    filtros: [
      { campo: "estado", opciones: ["none", "pending", "approved", "rejected"], textos: "dashboard.state" },
    ],
    columnas: [
      { campo: "name" },
      { campo: "creador" },
      { campo: "priceSc", der: true, tipo: "sc" },
      { campo: "cuantosObjetos", der: true, tipo: "numero" },
      { campo: "retorno", der: true, tipo: "pct" },
      { campo: "opens", der: true, tipo: "numero" },
      { campo: "ganadoPorElCreadorSc", der: true, tipo: "sc" },
      { campo: "estado", tipo: "estado", textos: "dashboard.state" },
    ],
    acciones: (f) => (f.estado !== "pending" ? [] : [
      { clave: "ok", texto: "admin.act.approve", ruta: (x) => `/admin/community/${x._id}/review`, cuerpo: () => ({ aprobar: true }) },
      { clave: "no", texto: "admin.act.reject", clase: "ad-b--mal", pideMotivo: true, pregunta: "admin.whyReject", ruta: (x) => `/admin/community/${x._id}/review`, cuerpo: () => ({ aprobar: false }) },
    ]),
  },

  items: {
    /*
      EL CATALOGO SE EDITA ACA.

      Y cambiar el VALOR de un objeto repreciar todas las cajas que lo
      contienen: el precio sale de los premios, asi que si cambia uno,
      cambian las cajas. Lo hace el servidor y avisa cuantas toco.
    */
    editor: {
      cosa: "items",
      campos: [
        { campo: "name", rotulo: "admin.field.name", ancho: true },
        { campo: "brand" },
        { campo: "category" },
        { campo: "valueSc", tipo: "sc", ayuda: "admin.help.valor" },
        { campo: "rarity", opciones: ["blue", "purple", "pink", "red", "gold"] },
        { campo: "shippable", tipo: "siNo" },
        { campo: "active", rotulo: "admin.field.live", tipo: "siNo" },
      ],
    },

    ruta: "/admin/items",
    busca: true,
    porPagina: 50,
    ancho: "1000px",
    w: ".9fr 2.4fr 1fr 1fr .8fr .8fr .7fr .7fr .8fr",
    columnas: [
      { campo: "sku", tenue: true },
      { campo: "name", tipo: "arte", foto: "imageUrl", valor: (f) => f.name, enlace: null },
      { campo: "brand", tenue: true },
      { campo: "category", tenue: true },
      { campo: "valueSc", der: true, tipo: "sc" },
      { campo: "rarity" },
      { campo: "enCajas", der: true, tipo: "numero" },
      { campo: "shippable", tipo: "siNo" },
      { campo: "active", tipo: "estado", valor: (f) => (f.active ? "active" : "off"), textos: "admin.state" },
    ],
  },

  deals: {
    ruta: "/admin/deals",
    ancho: "900px",
    w: "1.1fr 1fr 2fr .8fr .8fr .8fr",
    tituloDeTabla: "admin.table.latestDeals",
    numeros: (d, vm) => [
      { rotulo: vm.$t("admin.num.spins"), valor: vm.num(d.tiros) },
      { rotulo: vm.$t("admin.dash.played"), valor: "SC " + vm.plata(d.jugadoSc) },
      { rotulo: vm.$t("admin.num.wonInItems"), valor: "SC " + vm.plata(d.ganadoSc) },
      {
        rotulo: vm.$t("admin.dash.margin"),
        valor: d.margenPct + "%",
        /* 8% es el objetivo. Lejos de ahí con muchos tiros, algo pasa. */
        clase: Math.abs(d.margenPct - 8) > 3 ? "ad-amarillo" : "ad-verde",
      },
    ],
    columnas: [
      { campo: "createdAt", tipo: "fechaHora", tenue: true },
      { campo: "username" },
      { campo: "itemName" },
      { campo: "valueSc", der: true, tipo: "sc" },
      { campo: "chance", der: true, valor: (f) => (f.chance * 100).toFixed(2) + "%" },
      { campo: "stakeSc", der: true, tipo: "sc" },
      { campo: "gano", tipo: "estado", valor: (f) => (f.gano ? "won" : "lost"), textos: "admin.state" },
    ],
  },

  home: {
    ruta: "/admin/home",
    ancho: "800px",
    w: ".6fr 1.4fr 2.4fr .8fr .8fr",
    columnas: [
      { campo: "orden", der: true, tipo: "numero" },
      { campo: "fila", tipo: "clave" },
      { campo: "regla", tipo: "clave", tenue: true },
      { campo: "cuantas", der: true, valor: (f) => (f.cuantas === null ? "—" : f.cuantas) },
      { campo: "visible", tipo: "estado", valor: (f) => (f.visible ? "visible" : "hidden"), textos: "admin.state" },
    ],
  },

  /* ══ Plata ═══════════════════════════════════════════════════════ */

  payments: {
    ruta: "/admin/payments",
    porPagina: 25,
    ancho: "900px",
    w: "1.1fr 1.2fr 1fr 1fr 1.8fr",
    accion: { texto: "admin.act.csv", que: "csv" },
    numeros: (d, vm) => [
      { rotulo: vm.$t("admin.num.purchased", { n: d.dias }), valor: "SC " + vm.plata(d.totalSc) },
      { rotulo: vm.$t("admin.num.rows"), valor: vm.num(d.total) },
      { rotulo: vm.$t("admin.num.average"), valor: "SC " + vm.plata(d.promedioSc) },
      {
        rotulo: vm.$t("admin.num.gateway"),
        valor: d.conectada ? vm.$t("admin.state.on") : vm.$t("admin.state.off"),
        clase: d.conectada ? "ad-verde" : "ad-amarillo",
      },
    ],
    columnas: [
      { campo: "createdAt", tipo: "fechaHora", tenue: true },
      { campo: "username", enlace: (f) => `/admin/players/${f.userId}` },
      { campo: "amountSc", der: true, tipo: "scFirmado" },
      { campo: "balanceAfter", der: true, tipo: "sc", tenue: true },
      { campo: "label", tenue: true },
    ],
  },

  /*
    Los AFILIADOS no estan aca: son tres pantallas propias --los socios,
    un socio por dentro y la escalera-- porque se otorga un rango y se
    paga por cabeza, y eso no es una lista. Ver views/admin/AdminSocios.
  */

  analytics: {
    ruta: "/admin/analytics",
    ancho: "800px",
    w: "1fr 1fr 1fr 1.2fr 1.2fr",
    tituloDeTabla: "admin.table.bySignupMonth",
    accion: { texto: "admin.act.csv", que: "csv" },
    numeros: (d, vm) => [
      { rotulo: vm.$t("admin.num.signedUp", { n: d.dias }), valor: vm.num(d.nuevos) },
      { rotulo: vm.$t("admin.num.boughtOnce"), valor: vm.num(d.compradores) + " · " + d.conversionPct + "%" },
      { rotulo: vm.$t("admin.num.perBuyer"), valor: "SC " + vm.plata(d.porCompradorSc) },
      { rotulo: vm.$t("admin.num.purchasedShort"), valor: "SC " + vm.plata(d.compradoSc) },
    ],
    columnas: [
      { campo: "mes" },
      { campo: "jugadores", der: true, tipo: "numero" },
      { campo: "compradores", der: true, tipo: "numero" },
      { campo: "compradoSc", der: true, tipo: "sc" },
      { campo: "jugadoSc", der: true, tipo: "sc" },
    ],
  },

  coins: {
    ruta: "/admin/coins",
    ancho: "800px",
    w: "1.4fr 1.6fr 1fr 1fr .8fr",
    columnas: [
      { campo: "moneda" },
      { campo: "red" },
      { campo: "confirmaciones", der: true, tipo: "numero" },
      { campo: "demora" },
      { campo: "activa", tipo: "estado", valor: (f) => (f.activa ? "on" : "off"), textos: "admin.state" },
    ],
  },

  /* ══ Marketing ═══════════════════════════════════════════════════ */

  races: {
    /*
      LAS CARRERAS SE CREAN Y SE EDITAN.

      Mientras estan al aire. Una cerrada ya pago: el servidor no deja
      tocarla, porque los premios pagados tienen que seguir cuadrando
      con lo que dice la fila.
    */
    editor: {
      cosa: "races",
      borrar: true,
      campos: [
        { campo: "tipo", rotulo: "admin.field.raceKind", opciones: ["daily", "weekly", "monthly"] },
        { campo: "premioTotalSc", tipo: "sc", ejemplo: "10000" },
        { campo: "desde", tipo: "fecha" },
        { campo: "hasta", tipo: "fecha" },
        { campo: "reparto", ancho: true, ejemplo: "30, 18, 12, 9, 7, 6, 5, 5, 4, 4", ayuda: "admin.help.reparto" },
      ],
    },
    ruta: "/admin/races",
    ancho: "1000px",
    w: "1fr 1fr .9fr 1.4fr 1fr 1.1fr .9fr",
    columnas: [
      { campo: "tipo", valor: (f) => f.tipo, enlace: (f) => `/admin/races/${f._id}` },
      { campo: "premioTotalSc", der: true, tipo: "sc" },
      { campo: "puestosQueCobran", der: true, tipo: "numero" },
      { campo: "lider" },
      { campo: "desde", tipo: "fecha", tenue: true },
      { campo: "hasta", tipo: "fechaHora", tenue: true },
      { campo: "estado", tipo: "estado", textos: "admin.state" },
    ],
  },

  challenges: {
    editor: {
      cosa: "challenges",
      borrar: true,
      campos: [
        { campo: "caja", campoReal: "box", ejemplo: "black-card", ayuda: "admin.help.caja" },
        { campo: "multiplicador", tipo: "numero", ejemplo: "100" },
        { campo: "premioSc", tipo: "sc", ejemplo: "300" },
        { campo: "cupos", tipo: "numero", ejemplo: "3" },
        { campo: "desde", tipo: "fecha" },
        { campo: "hasta", tipo: "fecha" },
        { campo: "activo", rotulo: "admin.field.live", tipo: "siNo", porDefecto: true },
      ],
    },
    ruta: "/admin/challenges",
    ancho: "900px",
    w: "2fr .8fr 1fr 1fr 1.2fr .9fr",
    columnas: [
      { campo: "caja" },
      { campo: "multiplicador", der: true, valor: (f) => f.multiplicador + "x" },
      { campo: "premioSc", der: true, tipo: "sc" },
      { campo: "cupos", der: true, valor: (f) => `${f.cuposUsados} / ${f.cupos}` },
      { campo: "hasta", tipo: "fechaHora", tenue: true },
      { campo: "activo", tipo: "estado", valor: (f) => (f.activo ? "live" : "off"), textos: "admin.state" },
    ],
  },

  ranks: {
    ruta: "/admin/ranks",
    ancho: "800px",
    w: "1.2fr 1.2fr 1.2fr 1.2fr 1fr",
    numeros: (d, vm) => [
      { rotulo: vm.$t("admin.num.aboveBronze"), valor: vm.num(d.conRango) },
      { rotulo: vm.$t("admin.num.rakebackPaid"), valor: "SC " + vm.plata(d.rakebackSc) },
      { rotulo: vm.$t("admin.num.claims"), valor: vm.num(d.reclamos) },
    ],
    columnas: [
      { campo: "rango" },
      { campo: "desdeSc", der: true, tipo: "sc" },
      { campo: "rakebackPct", der: true, tipo: "pct" },
      { campo: "beneficios", der: true, tipo: "numero" },
      { campo: "jugadores", der: true, tipo: "numero" },
    ],
  },

  segments: {
    ruta: "/admin/segments",
    ancho: "800px",
    w: "1.4fr 2.6fr .8fr",
    numeros: (d, vm) => [
      { rotulo: vm.$t("admin.num.players"), valor: vm.num(d.jugadores) },
      { rotulo: vm.$t("admin.num.segments"), valor: vm.num(d.total) },
      { rotulo: vm.$t("admin.num.biggest"), valor: d.masGrande ? vm.$t("admin.segment." + d.masGrande._id) : "—" },
    ],
    columnas: [
      { campo: "segmento", valor: (f) => f._id, tipo: "clave", enlace: null },
      { campo: "regla", tenue: true },
      { campo: "jugadores", der: true, tipo: "numero" },
    ],
  },

  promotions: {
    editor: {
      cosa: "promotions",
      borrar: true,
      campos: [
        { campo: "clave", rotulo: "admin.field.key", ejemplo: "vip-boost" },
        { campo: "orden", tipo: "numero", porDefecto: 1 },
        { campo: "titulo", tipo: "idiomas", ancho: true, ayuda: "admin.help.idiomas" },
        { campo: "texto", tipo: "idiomas", ancho: true },
        { campo: "boton", tipo: "idiomas" },
        { campo: "destino", ejemplo: "/vip" },
        { campo: "desde", tipo: "fecha" },
        { campo: "hasta", tipo: "fecha" },
        { campo: "activa", rotulo: "admin.field.live", tipo: "siNo", porDefecto: true },
      ],
    },
    ruta: "/admin/promotions",
    ancho: "900px",
    w: ".6fr 1.2fr 2fr 1fr 1fr .8fr",
    columnas: [
      { campo: "orden", der: true, tipo: "numero" },
      { campo: "clave" },
      { campo: "titulo", valor: (f) => (f.titulo && (f.titulo.en || Object.values(f.titulo)[0])) || "" },
      { campo: "destino", tenue: true },
      { campo: "hasta", tipo: "fecha", tenue: true },
      { campo: "activa", tipo: "estado", valor: (f) => (f.activa ? "live" : "off"), textos: "admin.state" },
    ],
  },

  promo: {
    numeros: (d, vm) => [
      { rotulo: vm.$t("admin.num.liveCodes"), valor: vm.num(d.vivos) },
      { rotulo: vm.$t("admin.num.given"), valor: "SC " + vm.plata(d.dadoSc) },
    ],

    editor: {
      cosa: "promo",
      borrar: true,
      campos: [
        { campo: "codigo", rotulo: "admin.field.code", ejemplo: "WELCOME3" },
        { campo: "tipo", rotulo: "admin.field.kind", opciones: ["saldo", "aperturas"], porDefecto: "saldo" },
        { campo: "montoSc", tipo: "sc", ejemplo: "5" },
        { campo: "aperturas", tipo: "numero", ejemplo: "3" },
        { campo: "usosMaximos", tipo: "numero", ejemplo: "1000", ayuda: "admin.help.sinTope" },
        { campo: "minimoJugadoSc", tipo: "sc", ejemplo: "50" },
        { campo: "hasta", tipo: "fecha" },
        { campo: "activo", rotulo: "admin.field.live", tipo: "siNo", porDefecto: true },
      ],
    },
    ruta: "/admin/promo",
    ancho: "800px",
    w: "1fr 1.4fr 1fr 1fr 1fr .8fr",
    columnas: [
      { campo: "codigo" },
      { campo: "premio" },
      { campo: "usos", der: true, tipo: "numero" },
      { campo: "minimoSc", der: true, tipo: "sc" },
      { campo: "hasta", tipo: "fecha", tenue: true },
      { campo: "activo", tipo: "estado", valor: (f) => (f.activo ? "live" : "off"), textos: "admin.state" },
    ],
  },

  banners: {
    editor: {
      cosa: "banners",
      borrar: true,
      campos: [
        { campo: "clave", rotulo: "admin.field.key", ejemplo: "reward" },
        { campo: "orden", tipo: "numero", porDefecto: 1 },
        { campo: "foto", ancho: true, ejemplo: "/img/banners/banner-50k.webp" },
        { campo: "titulo", rotulo: "admin.field.titleKey", ejemplo: "banners.rewardTitle", ayuda: "admin.help.claveDeIdioma" },
        { campo: "sub", ejemplo: "banners.rewardSub" },
        { campo: "cta", ejemplo: "banners.rewardCta" },
        { campo: "destino", ejemplo: "/vip" },
        { campo: "visible", rotulo: "admin.field.shown", tipo: "siNo", porDefecto: true },
      ],
    },
    ruta: "/admin/banners",
    ancho: "860px",
    w: ".6fr 2fr 1.4fr 1.6fr .8fr",
    anchoDeAcciones: "120px",
    numeros: (d, vm) => [
      { rotulo: vm.$t("admin.num.banners"), valor: vm.num(d.total) },
      { rotulo: vm.$t("admin.num.visible"), valor: vm.num(d.visibles) },
    ],
    columnas: [
      { campo: "orden", der: true, tipo: "numero" },
      { campo: "titulo", tipo: "arte", foto: "foto", valor: (f) => f.clave },
      { campo: "texto", valor: (f) => f.titulo, tipo: "clave", tenue: true },
      { campo: "destino", tenue: true },
      { campo: "visible", tipo: "estado", valor: (f) => (f.visible ? "visible" : "hidden"), textos: "admin.state" },
    ],
    acciones: (f) => [
      {
        clave: "ver",
        texto: f.visible ? "admin.act.hide" : "admin.act.show",
        clase: f.visible ? "ad-b--mal" : "",
        ruta: (x) => `/admin/banners/${x._id}/visible`,
        cuerpo: (x) => ({ visible: !x.visible }),
      },
    ],
  },

  seo: {
    ruta: "/admin/seo",
    ancho: "900px",
    w: "1fr 1.6fr 2.6fr .8fr",
    columnas: [
      { campo: "pagina" },
      { campo: "titulo" },
      { campo: "descripcion", tenue: true },
      { campo: "enSitemap", tipo: "siNo" },
    ],
  },

  /* ══ Sistema ═════════════════════════════════════════════════════ */

  legal: {
    ruta: "/admin/legal",
    ancho: "800px",
    w: "1.6fr 1.4fr 1fr .8fr .8fr",
    columnas: [
      { campo: "pagina" },
      { campo: "direccion", tenue: true },
      { campo: "editadoEl", tipo: "fecha", tenue: true },
      { campo: "porQuien" },
      { campo: "estado", tipo: "estado", textos: "admin.state" },
    ],
  },

  activity: {
    ruta: "/admin/activity",
    porPagina: 50,
    ancho: "1000px",
    w: "1fr .8fr 1.3fr 1.2fr 2.4fr .8fr",
    accion: { texto: "admin.act.csv", que: "csv" },
    columnas: [
      { campo: "createdAt", tipo: "fechaHora", tenue: true },
      { campo: "admin" },
      { campo: "evento" },
      { campo: "sobre", valor: (f) => (f.sobre && f.sobre.nombre) || "" },
      {
        campo: "detalle",
        tenue: true,
        valor: (f) => {
          const partes = [];
          if (f.antes && f.despues) {
            for (const k of Object.keys(f.despues)) {
              if (f.antes[k] !== undefined && f.antes[k] !== f.despues[k]) {
                partes.push(`${k}: ${f.antes[k]} → ${f.despues[k]}`);
              }
            }
          }
          if (f.motivo) partes.push(f.motivo);
          return partes.join(" · ");
        },
      },
      { campo: "desde", tenue: true },
    ],
  },

  logs: {
    ruta: "/admin/logs",
    ancho: "900px",
    w: ".9fr .6fr .9fr 3.6fr",
    filtros: [
      { campo: "nivel", opciones: ["error", "warn", "info", "debug"], textos: "admin.level" },
    ],
    columnas: [
      { campo: "cuando", tipo: "hora", tenue: true },
      {
        campo: "nivel",
        clase: (f) => (f.nivel === "error" ? "ad-rojo" : f.nivel === "warn" ? "ad-amarillo" : "ad-tenue"),
      },
      { campo: "origen", tenue: true },
      { campo: "texto" },
    ],
  },

  team: {
    ruta: "/admin/team",
    anchoDeAcciones: "260px",
    /*
      EL RANGO SE CAMBIA DESDE ACA.

      Solo el dueno, y nunca sobre uno mismo: el servidor lo rebota. Un
      dueno que se saca el rango por error deja el panel sin dueno.
    */
    acciones: (f) => (f.rank === "owner" ? [] : [
      { clave: "admin", texto: "admin.act.makeAdmin", ruta: (x) => `/admin/team/${x._id}`, cuerpo: () => ({ rank: "admin" }) },
      { clave: "support", texto: "admin.act.makeSupport", clase: "ad-b--suave", ruta: (x) => `/admin/team/${x._id}`, cuerpo: () => ({ rank: "support" }) },
      { clave: "quitar", texto: "admin.act.makePlayer", clase: "ad-b--mal", ruta: (x) => `/admin/team/${x._id}`, cuerpo: () => ({ rank: "user" }) },
    ]),
    ancho: "800px",
    w: "1fr 1.6fr .8fr 1.2fr",
    columnas: [
      { campo: "username" },
      { campo: "email", tenue: true },
      { campo: "rank" },
      { campo: "lastSeenAt", tipo: "fechaHora", tenue: true },
    ],
  },
};

export default SECCIONES;
