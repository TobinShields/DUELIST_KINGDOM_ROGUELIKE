# Encender el contador de uso

El juego trae un contador **apagado**. Sin código de sitio no manda un solo
byte, y desde un archivo abierto con doble clic (`file://`) tampoco manda nada
aunque esté configurado.

Se usa [GoatCounter](https://www.goatcounter.com): gratis, sin cookies, sin
datos personales y de código abierto. Al no usar cookies ni huella del
navegador, **no hace falta banner de consentimiento** en la UE.

## 1 · Registrar el sitio

En <https://www.goatcounter.com> se elige un código, por ejemplo `goatformat`.
El panel queda en `https://goatformat.goatcounter.com`.

## 2 · Las visitas de la portada

En `publicar/index.html`, al final del archivo, hay un `<script>` comentado.
Se descomenta y se cambia `TUCODIGO`:

```html
<script data-goatcounter="https://goatformat.goatcounter.com/count"
        async src="//gc.zgo.at/count.js"></script>
```

Eso cuenta visitas, referrers y navegadores. Nada más.

## 3 · Los eventos de dentro del juego

En `engine/browser/src/telemetria.js`, primera línea de configuración:

```js
const SITIO = "goatformat";
```

Y se reconstruye (`cd engine && ./rebuild.sh`). El código va DENTRO del HTML,
así que hay que reconstruir para que llegue al archivo publicado.

Comprobar que sigue siendo seguro:

```bash
cd engine/browser && node check-telemetria.mjs
```

## Qué se ve en el panel

Los eventos aparecen como si fueran páginas, con estos nombres:

| Evento | Qué contesta |
|---|---|
| `kingdom/run/start/{duelista}` | Cuántas aventuras se empiezan y con quién |
| `kingdom/node/{tipo}` | Qué nodos se pisan de verdad |
| `kingdom/act/{1,2,3}` | Hasta qué acto se llega |
| `kingdom/castle` | Cuántos juntan las diez fichas |
| `kingdom/run/end/{won,lost}/act{n}` | Cómo y dónde acaba cada run |
| `kingdom/run/chips/{tramo}` | Con cuántas fichas se cae |
| `duel/start/{kingdom,free}/{nivel}` | Duelos empezados, por modo y dificultad |
| `duel/end/{win,lose}` · `duel/turns/{tramo}` | Cuántos se terminan y cuánto duran |
| `deck/{mazo}` | Qué mazos se usan |
| `error/{tipo}` | Fallos que nadie ha reportado |
| `play/minutes/{tramo}` | Cuánto dura una sesión |

**La cifra que importa** para ajustar la dificultad es
`kingdom/run/start` contra `kingdom/castle` contra `kingdom/run/end/won`:
cuántos empiezan, cuántos llegan al castillo y cuántos ganan a Pegasus.

## Lo que NUNCA viaja

Ni semillas, ni listas de mazo, ni el nombre que le pongas a tu duelista, ni el
progreso, ni identificadores de ningún tipo. Los números van en tramos
(`duel/turns/20-30`), no exactos. La lista de eventos posibles está cerrada y
todo nombre pasa por un limpiador a `[a-z0-9-]`.

Se puede apagar desde Opciones, y apagado corta antes de construir la URL.
También se respeta `Do Not Track` del navegador.
