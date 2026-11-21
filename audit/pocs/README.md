# Pruebas de concepto

**Todas corren únicamente contra `localhost` y la base de desarrollo.**
Comprobado: las únicas direcciones que aparecen en estos archivos son
`http://localhost` y `http://127.0.0.1`. Ninguno toca producción, ninguno llama
a OxaPay, a EUPay ni a Cloudflare, y ninguno ejecuta un pago real.

Antes de correr cualquiera hay que tener levantada la API:

```
cd backend && npm start
```

o, desde la sesión, el servidor `mrbox-api` del `launch.json`.

## Las dos del coordinador

| Script | Qué demuestra | Hallazgo |
|---|---|---|
| `gratis-crea-plata.js` | Una cuenta recién registrada termina con SC canjeable sin depositar, abriendo sus tres cajas de regalo a la vez | DINERO-01 (Crítica) |
| `hook-cuerpo-crudo.js` | El mismo aviso de pago, firmado correctamente, pasa compacto y rebota con sangría: la firma se verifica contra una reserialización | HOOK-01 (Alta) |

Uso:

```
node audit/pocs/gratis-crea-plata.js 10
node audit/pocs/hook-cuerpo-crudo.js
```

`gratis-crea-plata.js` se niega a correr si `DATABASE_URI` no apunta a
`mrbox_local` en `127.0.0.1`.

## Las de las auditorías de área

Necesitan `lib.js` al lado (helpers de sesión y de base).

| Script | Qué demuestra | Hallazgo |
|---|---|---|
| `poc-02-envios-solapados.js` | El mismo objeto se vende **y** se despacha: 12 de 25 rondas | DINERO-02 |
| `poc-09-admin-carrera.js` | 20 clics en "Pagar" → 20 pagos del mismo premio | DINERO-03 |
| `poc-10-controles.js` | El límite diario se pasa de largo; la pausa no frena los promos | DINERO-05, DINERO-09 |
| `poc-05b-registro-real.js` | La misma fuga que `gratis-crea-plata.js`, llamando al servicio sin el freno de HTTP | DINERO-01 |
| `poc-03b-tope-pendientes.js` | 20 canjes simultáneos contra un tope de 3 | DINERO-08 |
| `poc-06b-montos.js` | `veces: 2.5` cobra más de lo que informa | DINERO-07 |
| `poc-11-varios.js` | Un promo de 1 apertura entrega 3 | DINERO-06 |
| `poc-07-ledger.js` | El libro cierra: suma de asientos = saldo | verificación |
| `poc-08-idempotencia.js` | El mismo `track_id` 20 veces → 1 sola acreditación | verificación |
| `concurrencia.js` | 60 aperturas en paralelo → 60 nonces únicos, 0 colisiones | verificación |
| `analisis-cajas.js` | Las 165 cajas suman 100 % y ninguna paga más de lo que cobra | verificación |
| `api-vs-sorteo.js` | Lo que muestra la API es lo que usa el sorteo | verificación |
| `replay-aperturas.js` | 251 aperturas reales reproducidas exactas | verificación |
| `comunidad-comisiones.js` | Al que arma una caja le entra su mitad, y el panel dice el mismo numero | verificacion |
| `soporte-borrador.js` | El borrador de la IA: que no mande, que no filtre el mail, y que la plata vaya a una persona | verificacion |
| `probar.js` | Arnés de los casos de inyección (`node probar.js <caso>`) | INY-* |

## Después de correrlas

Dejan usuarios de prueba y filas en `mrbox_local`. Se limpian con un filtro por
los prefijos `audit`, `poc_` y `dbg_` en `username`.
