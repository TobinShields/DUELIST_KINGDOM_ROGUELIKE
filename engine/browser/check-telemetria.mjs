/* ══════════════════════════════════════════════════════════════════
   EL CONTADOR DE USO NO PUEDE FILTRAR NADA

   Saber cuántas runs se empiezan y en qué acto se abandonan es la única
   forma de ajustar la dificultad con datos. Pero un contador metido en
   un juego que la gente se DESCARGA y abre con doble clic tiene tres
   formas de salir mal, y las tres se comprueban aquí:

     1 · que el archivo descargado llame a casa. Quien abre el HTML
         desde su disco no ha pedido participar en ninguna estadística
         —y puede no tener red—. Desde `file://` no se manda un byte.
     2 · que viaje algo identificable. Solo salen nombres de evento de
         una lista cerrada, con los números redondeados a tramos. Ni
         semillas, ni mazos, ni nada escrito por el jugador.
     3 · que un fallo del contador tire la partida. Una estadística no
         puede costarte una run de cuarenta minutos.

   Y una cuarta que no es de privacidad sino de honestidad: si no hay
   contador configurado, la casilla de Opciones no se enseña. Ofrecer
   apagar algo que no existe es mentir.

   Uso:  node check-telemetria.mjs
   ══════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";

const fuente = readFileSync("./src/telemetria.js", "utf-8");
const html   = readFileSync("./out/goat.html", "utf-8");
const js     = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];

let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t,d="") => { fallos++; console.log("  ✗ " + t + (d ? "   " + d : "")); };
console.log("\n═══ EL CONTADOR DE USO ═══\n");

/* ── 1 · MUDO DESDE EL DISCO ── */
{
  if(!/\/\^https\?:\$\/\.test\(l\.protocol\)/.test(fuente))
    mal("desde `file://` no se manda nada", "hay que exigir http o https");
  else ok("desde `file://` no se manda nada");

  if(!/PUBLICADO\.test\(l\.hostname\)/.test(fuente))
    mal("y solo desde el dominio publicado",
        "sin esto, cualquiera que lo sirva en su localhost te ensucia los datos");
  else ok("y solo desde el dominio publicado");

  if(!/doNotTrack === "1"/.test(fuente))
    mal("y se respeta Do Not Track");
  else ok("y se respeta Do Not Track del navegador");
}

/* ── 2 · APAGADO ES APAGADO, Y SIN CÓDIGO NO EXISTE ── */
{
  if(!/if\(!SITIO\) return activa;/.test(fuente))
    mal("sin código de sitio configurado no se manda nada");
  else ok("sin código de sitio configurado no se manda nada");

  /* Y hoy está vacío: el repositorio no publica el contador de nadie. */
  const sitio = fuente.match(/const SITIO = "([^"]*)"/);
  if(sitio && sitio[1]) console.log(`      (configurado como «${sitio[1]}»)`);
  else ok("y ahora mismo está vacío: la copia del repositorio es muda");

  if(!/localStorage\.getItem\(CLAVE\) === "0"/.test(fuente))
    mal("la preferencia de apagarlo se respeta ANTES de construir la URL");
  else ok("apagado corta antes de construir la URL, no después");

  if(!/disponible\(\)\{ return !!SITIO; \}/.test(fuente))
    mal("la casilla de Opciones solo se enseña si hay contador de verdad");
  else ok("la casilla de Opciones solo se enseña si hay contador de verdad");
  if(!/__TELE__\?\.disponible\?\.\(\)/.test(js))
    mal("y la pantalla lo comprueba");
  else ok("y la pantalla lo comprueba antes de pintarla");
}

/* ── 3 · NADA IDENTIFICABLE ──
   La lista de lo que se manda está cerrada: si alguien añade un evento
   nuevo con una plantilla libre, esto se entera. */
{
  /* Todo nombre de evento pasa por `limpiar`, que quita acentos,
     espacios y cualquier cosa que no sea [a-z0-9-]. */
  if(!/const limpiar = s =>/.test(fuente) || !/\[\^a-z0-9\]\+/.test(fuente))
    mal("todo nombre de evento se limpia a [a-z0-9-]");
  else ok("todo nombre de evento se limpia a [a-z0-9-]");

  if(!/export function tramo\(/.test(fuente))
    mal("los números viajan en tramos, no exactos");
  else ok("los números viajan en tramos, no exactos");

  /* Ni semilla, ni nombre de duelista escrito por el jugador. */
  /* Sin comentarios: el propio archivo EXPLICA que no manda semillas, y
     buscar la palabra en el texto la encontraba ahí. Se mira el código. */
  const codigo = fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const prohibidas = ["semilla", "binder", "goatProgreso", "run.mazo", "run.historial"];
  const coladas = prohibidas.filter(p => codigo.includes(p));
  if(coladas.length) mal("no viaja nada del estado de la partida", coladas.join(" · "));
  else ok("no viaja nada del estado de la partida");

  /* El referrer se manda vacío a propósito. */
  if(!/&r=`/.test(fuente)) mal("el referrer va vacío");
  else ok("el referrer va vacío");
}

/* ── 4 · NO PUEDE TIRAR EL JUEGO ── */
{
  const cuerpo = fuente.slice(fuente.indexOf("export function evento("));
  const trozo  = cuerpo.slice(0, cuerpo.indexOf("\n}") + 2);
  if(!/try\{/.test(trozo) || !/catch\(e\)/.test(trozo))
    mal("el envío va dentro de un try/catch");
  else ok("el envío va dentro de un try/catch: un fallo suyo no toca la partida");

  /* Y todas las llamadas desde el juego son opcionales. */
  /* La ASIGNACIÓN del bundle (`globalThis.__TELE__ = Tele`) no es una
     llamada: se descarta o el test se acusa a sí mismo. */
  const duras = [...js.matchAll(/globalThis\.__TELE__(?!\?|\s*=)/g)];
  if(duras.length) mal("todas las llamadas usan `?.`", `${duras.length} sin encadenamiento opcional`);
  else ok("todas las llamadas desde el juego usan `?.`");

  /* Tope por sesión: si algo entra en bucle, no se convierte en un
     ataque a GoatCounter desde el navegador de un jugador. */
  if(!/mandados >= TOPE/.test(fuente))
    mal("hay tope de eventos por sesión");
  else ok("hay tope de eventos por sesión");
}

/* ── 5 · Y MIDE LO QUE SE PIDIÓ ── */
{
  const quiero = {
    "kingdom/run/start": "cuántas runs se empiezan",
    "kingdom/node":      "qué nodos se pisan",
    "kingdom/act":       "hasta qué acto se llega",
    "kingdom/castle":    "cuántos llegan al castillo",
    "kingdom/run/end":   "cómo acaba la run",
    "duel/start":        "duelos empezados",
    "duel/end":          "y terminados",
    "error/":            "los fallos que nadie reporta",
  };
  const faltan = Object.keys(quiero).filter(k => !fuente.includes(k));
  if(faltan.length) mal("mide las tres cosas que se pidieron", faltan.join(" · "));
  else ok(`mide ${Object.keys(quiero).length} cosas: ${Object.values(quiero).join(", ")}`);

  /* Y están enganchadas de verdad al juego, no solo definidas. */
  const enganches = (js.match(/__TELE__\?\./g) ?? []).length;
  if(enganches < 8) mal("y está enganchado al juego", `solo ${enganches} llamadas`);
  else ok(`y está enganchado al juego en ${enganches} sitios`);
}

console.log(`\n${fallos ? "FALLA: " + fallos : "Todo correcto"}`);
process.exit(fallos ? 1 : 0);
