# El borrador de soporte, en producción

Qué hay que configurar el día que esto sale al aire. Son cuatro cosas y
tres de ellas se hacen una sola vez.

---

## 1. La llave, en el entorno del servidor

```
ANTHROPIC_API_KEY=sk-ant-...
```

**Va en las variables de entorno del servidor, no en un archivo del
repo.** En desarrollo vive en `backend/.env`, que está en el
`.gitignore`; en producción va donde las ponga el hosting (Railway,
Render, Fly, un panel de variables, un secret manager).

Por qué no en la base de datos: la base se respalda, se copia a una
máquina de pruebas para reproducir un problema, y se puede mirar desde
el panel. Una llave de API ahí adentro termina en sitios donde nadie
pensó que iba a estar.

**Sin la llave el botón directamente no se dibuja.** No hay un estado
intermedio donde alguien lo toca y no pasa nada.

### La llave que conviene usar

Una **llave propia de producción**, no la misma que uses para probar.
Dos motivos: se puede rotar sin cortar el desarrollo, y el consumo
queda separado, así se ve cuánto gasta el sitio de verdad.

Conviene además ponerle un **tope de gasto mensual** en la consola de
Anthropic. Con lo que cuesta esto (ver abajo) un tope de USD 20 al mes
es holgado y te cubre de un bucle o de una llave filtrada.

---

## 2. Las perillas del panel

En **Ajustes → Support**:

| Perilla | Qué hace | Para arrancar |
|---|---|---|
| `Draft replies with AI` | Prende y apaga el botón | **Sí** |
| `AI model` | Vacío usa `claude-haiku-5-5` | **Vacío** |
| `Send to a person below this confidence` | Abajo de esto el panel lo marca en rojo | **0.7** |
| `Name players see on replies` | Con qué nombre le llega la respuesta al jugador | **Soporte** (o el que quieras) |

La perilla y la llave son **dos** condiciones: hace falta que las dos
estén. Apagar la perilla sirve para cortarlo en caliente sin tocar el
servidor.

---

## 3. Con qué nombre firman las respuestas

Esto no es del borrador, es del soporte entero, y **hay que resolverlo
antes de abrir al público**.

Antes el jugador veía el **nombre de usuario** de quien contestaba, tal
cual está en la base. En local eso es `sol` y da igual. En producción es
el nombre interno de la cuenta de un empleado: no es asunto del jugador
y además es la mitad de un intento de entrar a esa cuenta.

Ahora funciona así, en este orden:

1. El **nombre propio** de la persona, si lo tiene puesto en su cuenta
   (`nombreDeSoporte`). Así "Martín" firma Martín.
2. Si no, la **firma de la casa** (`Ajustes → Support → Name players see
   on replies`).
3. Si no hay ninguna de las dos, `Soporte`.

El nombre de usuario no sale nunca. Quién contestó de verdad queda
guardado igual, en el campo `autor` de cada mensaje.

---

## 4. Qué cuesta y cómo vigilarlo

Medido con el pedido real: **USD 0,00022 por conversación**, o sea unos
dos centavos cada cien borradores.

Sale tan barato porque las reglas y las respuestas guardadas van
marcadas para caché: de la segunda conversación en adelante esa parte se
cobra al 10%. **Si editás las respuestas guardadas se invalida el
caché**, así que el primer borrador después de una edición sale más caro.
Es un centavo, pero si alguna vez el costo se dispara sin explicación,
mirá si alguien está editando las respuestas guardadas todo el tiempo.

El panel muestra el costo de cada borrador en la respuesta de la API
(`costoUsd`), por si alguna vez hace falta auditarlo.

---

## Lo que NO hay que hacer

- **No lo pongas a contestar solo.** Hoy escribe una propuesta y la manda
  una persona. Pasar a automático es otra decisión, y pide antes un par
  de semanas de datos sobre si acierta.
- **No metas la llave en `Settings`** para "que se configure desde el
  panel". Ver el punto 1.
- **No le saques el freno a las categorías de plata.** Retiros,
  depósitos, cuentas y quejas se derivan siempre, y eso está en el
  servidor a propósito: no lo decide el modelo.

---

## Para probar que quedó bien

```
node audit/pocs/soporte-borrador.js
```

52 controles, no gasta un peso en la API: usa un cliente de mentira.
Verifica que no se filtre el mail del jugador, que la plata vaya a una
persona, y que el jugador no vea el borrador.

Lo único que eso NO prueba es que el modelo conteste bien, porque hace
falta la llave. Esa es una prueba a mano de un minuto: abrir una
conversación en el panel y tocar el botón.
