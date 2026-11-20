# QA funcional — MR BOX

Recorrido hecho sobre el entorno local (API en 5001, sitio en 8090) con el
navegador integrado, en escritorio 1440×900 y en teléfono 390×844, con una
sesión de jugador normal (`funkmaster`, SC 421,98, KYC 3).

Las capturas están en esta misma carpeta.

## Estado del entorno

| Qué | Resultado |
|---|---|
| `npm test` (backend) | **209 pruebas, 209 pasan, 0 fallan** |
| `npm run build` (frontend) | **exit 0**, sin avisos de error |
| Linter | no hay ninguno configurado en los dos paquetes |
| Bundle | bien partido: `app.js` 171 KiB, los idiomas en chunks aparte de ~25 KiB cada uno, el panel en su propio chunk |

## Lo que se probó y anduvo bien

### Autorización del panel — 76 rutas, todas correctas

Se probó por dos caminos independientes: montando el router sin base de datos y
pidiendo las 76 rutas sin token (76 de 76 dieron 401), y por HTTP contra el
servidor real con el token de un jugador normal (lo que sigue).

Probé **todas** las rutas de `/api/admin` con tres identidades: anónimo, jugador
normal y con el token de un jugador normal.

- 31 rutas GET: **403** con token de jugador, **401** sin token.
- 24 rutas POST/PUT/DELETE que cambian cosas (saldo, baneo, regalos, nivel de
  KYC, aprobación de canjes, estado de órdenes, ajustes, pago de conversiones):
  **403** con token de jugador, **401** sin token.

Esto incluye los sub-routers (`extra.js`, `afiliados.js`, `editar.js`,
`jugador.js`, `carreras.js`) que se montan **después** de las rutas propias en
`routes/admin/index.js:1271-1297`. Era lo que más me preocupaba del mapa y está
bien: el `router.use(autorizar(true), soloAdmin())` de la línea 36 los cubre a
todos. Sin excepciones.

### El doble clic no dispara dos operaciones

`frontend/src/views/BoxView.vue:430` pone `this.girando = true` **antes** del
`await`, y los botones de abrir, probar gratis y cambiar la cantidad están todos
con `:disabled="girando"`. Lo mismo con `vendiendo` en `venderTodo()`
(línea 548). Mientras hay un pedido en vuelo no se puede apretar de nuevo.

### Ningún temporizador queda colgado

Los 7 componentes que usan `setInterval` tienen su `beforeDestroy` con el
`clearInterval` correspondiente, incluido `RaceView.vue` que tiene dos relojes y
limpia los dos. Ningún `addEventListener` sin su `removeEventListener`.

Además los relojes se portan bien: el del soporte se adapta (8 s abierto, 60 s
cerrado), y todos chequean `document.hidden` para no pedir nada con la pestaña
escondida.

### Nada se desborda a lo ancho

15 rutas (`/`, `/boxes`, `/boxes/:slug`, `/deals`, `/community`, `/create`,
`/races/weekly`, `/promotions`, `/challenges`, `/rewards`, `/affiliates`,
`/vip`, `/inventory`, `/profile`, `/dashboard`) a 390 px: `scrollWidth` = 390 en
todas. Cero desbordes horizontales.

### Los 9 idiomas

Los 9 (`en, es, de, fr, pt, it, ru, ja, zh`) dibujan la portada sin desbordar y
**sin ninguna clave cruda a la vista** (nada tipo `box.autoOff` sin traducir).

### Sin errores de consola ni pedidos fallidos

Recorrido de 16 rutas con los XHR interceptados: **0 pedidos 4xx/5xx**, **0
errores de JavaScript**, **0 imágenes rotas** (revisadas tanto las `<img>` como
los `background-image`).

## Bugs funcionales encontrados

### QA-01 — La cinta de Live Pulls ordena en memoria y la colección no para de crecer

**Severidad: Alta** (rendimiento) · **Confianza: Confirmado** ·
`backend/routes/boxes/index.js:368` y `backend/database/models/BoxOpen.js:89-90`

La portada pide `/api/boxes/feed/latest` **cada 1,5 segundos**, por cada
visitante, sin sesión y sin límite de pedidos. La consulta es:

```js
BoxOpen.find({ demo: { $ne: true } })
  .sort({ createdAt: -1 })
  .limit(24)
```

`BoxOpen` tiene índices en `{user:1,createdAt:-1}` y `{box:1,createdAt:-1}`,
pero **ninguno que sirva para esta consulta**, que no filtra por usuario ni por
caja. El `explain` contra la base local lo confirma:

```
etapa ganadora : SORT (en memoria, memLimit 104857600)
devueltas      : 24
examinadas     : 171 docs / 171 claves
```

Examina **la colección entera** para devolver 24 filas. Y `BoxOpen` crece una
fila por cada apertura de caja que se haga en la vida del sitio: no tiene techo.

**Impacto.** Con 171 filas tarda 3 ms y no se nota. Con un millón de aperturas
examina un millón de documentos, y lo hace 0,67 veces por segundo por cada
visitante con la portada abierta. Cien visitantes son 67 consultas por segundo,
cada una barriendo la colección completa. Cuando el ordenamiento supere los
100 MB, MongoDB corta con `QueryExceededMemoryLimitNoDiskUseAllowed` y **la
portada se queda sin la cinta para todo el mundo a la vez**.

**Arreglo.** Un índice, en `backend/database/models/BoxOpen.js`:

```diff
 boxOpenSchema.index({ user: 1, createdAt: -1 });
 boxOpenSchema.index({ box: 1, createdAt: -1 });
+
+/* La cinta de la portada: sin usuario ni caja, solo las ultimas de
+   verdad. Se pide cada segundo y medio por visitante y la coleccion
+   crece una fila por apertura, asi que sin esto termina barriendo
+   todo para devolver 24. */
+boxOpenSchema.index({ demo: 1, createdAt: -1 });
```

Conviene además cambiar `{ demo: { $ne: true } }` por `{ demo: false }`: `$ne`
no usa el índice para acotar el rango. El campo tiene `default: false`, así que
hay que confirmar que no queden filas viejas sin el campo antes de cambiarlo.

**Cómo verificar.** Volver a correr el `explain`: la etapa ganadora tiene que
pasar de `SORT` a `IXSCAN` y `totalDocsExamined` tiene que bajar a 24.

### QA-02 — Faltan favicon.ico, apple-touch-icon y robots.txt

**Severidad: Baja** · **Confianza: Confirmado** · `frontend/public/`

Los 3 errores 404 que aparecen en la consola del navegador en cada carga son
estos. `favicon.svg` sí existe y está declarado, pero:

- `/favicon.ico` → 404 (lo pide todo navegador por costumbre)
- `/apple-touch-icon.png` y `/apple-touch-icon-precomposed.png` → 404 (es el
  ícono cuando alguien guarda el sitio en la pantalla de inicio del teléfono,
  que para un sitio que se usa del teléfono importa)
- `/robots.txt` → 404
- `/manifest.json` → 404

Y hay un detalle que en producción se pone peor: `backend/index.js:128` sirve
`index.html` para cualquier ruta que no empiece con `/api/`. O sea que en
producción `/robots.txt` no va a dar 404: va a devolver **la página HTML del
sitio con estado 200**, que es peor, porque el buscador la va a interpretar como
un robots.txt válido lleno de basura.

**Arreglo.** Poner los archivos en `frontend/public/` (se copian a `dist` solos)
y, si se quiere ser prolijo, excluir las extensiones de archivo del comodín de
`backend/index.js:128`.

### QA-04 — Las tarjetas del tablero no acotan los números grandes

**Severidad: Baja** · **Confianza: Confirmado** ·
`frontend/src/views/admin/AdminDashboard.vue` · captura
[`05-tablero-desborde.jpg`](05-tablero-desborde.jpg)

La tarjeta "Bought in SC" muestra `SC 1,000,000,000,001,000…` y el número se sale
de la tarjeta y queda cortado a mitad de dígito. Viene de un aviso de pago de
prueba por SC 1e21 que el servidor aceptó sin techo (HOOK-02), pero el problema
de la pantalla es propio: los valores no se abrevian ni se recortan.

Es cosmético hasta que no lo es: un solo aviso con un monto absurdo deja el
tablero y las analíticas rotos **para siempre**, porque el libro no se reescribe.

### Recorrido del panel

Las secciones que se abrieron con una sesión de `owner` responden bien y con
datos reales: Dashboard, Verification (muestra la cola de los tres niveles con
los datos cargados), Risk (detecta IP compartida, auto-referidos y quien retiró
más de lo que jugó — y durante esta auditoría levantó correctamente la actividad
de las cuentas de prueba), Players, Orders, Boxes, Community, Items, Support,
Settings. Ninguna dio error de consola ni pedido fallido.

### QA-03 — El inventario vacío no explica las aperturas gratis

**Severidad: Info** · `frontend/src/views/InventoryView.vue`

Con el inventario en cero la pantalla dice "Inventario vacío / Abrí cajas para
llenar tu inventario" con un botón, lo cual está bien, pero arriba la solapa
"Aperturas gratis" muestra **3** y no hay nada que conecte las dos cosas. El
jugador nuevo ve "vacío" y un 3 al lado sin relación aparente.

Es cosmético y discutible — lo dejo anotado, no es un bug.

## Lo que no se pudo probar

- **Compra real**: no hay sandbox de OxaPay configurado en local, así que el
  flujo de depósito se auditó leyendo el código y no recorriéndolo. Está en el
  informe de pagos.
- **EUPay**: la integración está a medias y bloqueada esperando el dominio.
- **Google y Facebook**: los botones están, el backend devuelve "pendiente".
  No hay nada que probar todavía.
