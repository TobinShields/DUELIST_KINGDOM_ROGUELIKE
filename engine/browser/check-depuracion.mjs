/* ══════════════════════════════════════════════════════════════════
   LOS ATAJOS DE PRUEBA NO PUEDEN ESTAR SUELTOS EN LA VERSIÓN FINAL

   «Ganar sin jugar» y «Perder sin jugar» saltan un duelo del Reino
   dándolo por resuelto: existen porque recorrer el modo historia jugando
   cada combate son veinte minutos por vuelta y la mitad de lo que hay
   que probar está DESPUÉS del duelo.

   Estaban en el menú sin ninguna puerta, o sea que cualquiera que abriera
   el juego podía saltarse la aventura entera y cobrar todas las
   recompensas sin jugar una mano. Lo reportó E. Es la misma familia que
   la pantalla de victoria que resolvía el nodo del duelo siguiente: un
   botón que decide el resultado de una partida que no se ha jugado.

   Ahora hay que escribir la contraseña en Opciones. Esto comprueba las
   dos mitades, sobre el HTML CONSTRUIDO:
     · apagado (que es como arranca), los botones NO se pintan y el
       atajo no hace nada aunque se le llame;
     · encendido, vuelven a salir — porque un atajo que no se puede
       encender tampoco sirve de nada.

   Uso:  node check-depuracion.mjs
   ══════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";

let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t,d="") => { fallos++; console.log("  ✗ " + t + (d ? "   " + d : "")); };
console.log("\n═══ EL MODO DEPURACIÓN ═══\n");

const html = readFileSync("./out/goat.html","utf-8");

/* ── 1 · arranca APAGADO ── */
{
  /* La preferencia vive en su propia clave, no en `goatConfig`: así no
     viaja en el archivo de exportar/importar progreso. */
  if(!/localStorage\.getItem\("goatDebug"\)\s*===\s*"1"/.test(html))
    mal("el modo depuración se lee de su propia clave `goatDebug`",
        "si viaja en goatConfig, se cuela en el archivo de progreso");
  else ok("el modo depuración vive en su propia clave, fuera del progreso");

  if(/goatConfig[\s\S]{0,200}debug/i.test(html))
    mal("y NO está dentro de `goatConfig`");
  else ok("y no está dentro de `goatConfig`");
}

/* ── 2 · los botones dependen de la bandera, no son fijos ── */
{
  const m = html.match(/if\(globalThis\.__DEPURACION__\)\{([\s\S]{0,700}?)\n\s*\}/);
  if(!m) mal("los botones de saltar el duelo están dentro de la comprobación");
  else {
    const dentro = m[1];
    const tiene = /Ganar sin jugar/.test(dentro) && /Perder sin jugar/.test(dentro);
    if(!tiene) mal("los DOS botones están dentro de la comprobación",
                   "uno fuera es el agujero entero");
    else ok("los dos botones de saltar el duelo están dentro de la comprobación");
  }
  /* Y que no haya ninguna copia suelta fuera del `if`.
     OJO: se cuentan las LLAMADAS `T("…")`, no el texto a secas. El texto
     aparece también como clave de la tabla de traducción y como
     comentario, así que buscarlo suelto daba 2 y acusaba a un archivo
     que no tiene ningún botón dentro. Otra vez lo mismo: el test tiene
     que contar lo que CONSTRUYE el botón. */
  const apariciones = (html.match(/T\("Ganar sin jugar \(pruebas\)"\)/g) ?? []).length;
  if(apariciones > 1)
    mal("no hay más de un sitio que pinte el atajo", `se construye ${apariciones} veces`);
  else if(apariciones === 0)
    mal("el atajo sigue existiendo para cuando se encienda el modo");
  else ok("no hay ninguna copia suelta del atajo");
}

/* ── 3 · y el atajo se niega aunque se le llame ──
   El botón es la puerta, pero la regla no puede vivir SOLO en el botón:
   si mañana asoma por otra pantalla, esto lo para igual. */
{
  if(!/alSaltarDuelo:[\s\S]{0,400}?if\(!globalThis\.__DEPURACION__\) return;/.test(html))
    mal("`alSaltarDuelo` comprueba la bandera por su cuenta",
        "sin esto, la regla vive solo en el botón");
  else ok("`alSaltarDuelo` se niega por su cuenta si el modo está apagado");
}

/* ── 4 · la contraseña es la que dijo E, y no se enseña de más ── */
{
  /* La contraseña ya NO está en el HTML (es público en GitHub): solo su
     huella con sal. Aquí no se puede escribir la buena —este archivo
     también se publica—, así que se mira que la huella funcione con un
     vector conocido y que la vieja («debug») ya no abra. */
  const trozo = html.match(/const SAL_DEPURACION[\s\S]*?function claveDepuracionValida\(t\)\{[\s\S]*?\n\}/);
  if(/const CLAVE_DEPURACION\s*=/.test(html)) mal("la contraseña no está escrita en el HTML");
  else ok("la contraseña no está escrita en el HTML, solo su huella");
  if(!trozo) mal("hay huella y comprobación de la contraseña");
  else {
    const f = new Function(trozo[0] + "; return { sha256Hex, claveDepuracionValida };")();
    f.sha256Hex("abc") === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
      ? ok("el SHA-256 propio da el resultado de referencia") : mal("el SHA-256 propio da el resultado de referencia");
    !f.claveDepuracionValida("debug") && !f.claveDepuracionValida("") && !f.claveDepuracionValida("Debug")
      ? ok("«debug», vacío o cualquier otra cosa no abren") : mal("la contraseña vieja ya no abre");
  }

  /* La pista no puede estar escrita en la pantalla: si el texto de
     ayuda la dice, la puerta no existe. */
  const pantalla = html.match(/<div class="mpant" id="pOpciones"[\s\S]*?<\/div>\s*<\/div>/);
  if(pantalla && /["\s>]debug[<"\s.]/i.test(pantalla[0]))
    mal("la contraseña no está escrita en la propia pantalla");
  else ok("la contraseña no está escrita en la propia pantalla");
}

/* ── 5 · encender y apagar, de verdad ──
   Se ejecuta el código real del HTML con un `localStorage` de mentira,
   en vez de leer que las funciones existan. */
{
  const cuerpo = html.match(
    /function depuracionEncendida\(\)\{[\s\S]*?globalThis\.__DEPURACION__ = depuracionEncendida\(\);/);
  if(!cuerpo) mal("se encuentran las funciones del modo depuración");
  else {
    const mem = new Map();
    const localStorage = { getItem: k => mem.get(k) ?? null,
                           setItem: (k,v) => mem.set(k,String(v)) };
    const g = {};
    // eslint-disable-next-line no-new-func
    const run = new Function("localStorage","globalThis",
      cuerpo[0] + "\nreturn { depuracionEncendida, ponerDepuracion };");
    const api = run(localStorage, g);

    if(api.depuracionEncendida() !== false)
      mal("arranca apagado con el almacenamiento vacío");
    else ok("arranca apagado con el almacenamiento vacío");

    api.ponerDepuracion(true);
    if(api.depuracionEncendida() !== true || g.__DEPURACION__ !== true)
      mal("se enciende y se recuerda");
    else ok("se enciende, se recuerda y deja el puente puesto");

    api.ponerDepuracion(false);
    if(api.depuracionEncendida() !== false || g.__DEPURACION__ !== false)
      mal("y se vuelve a apagar");
    else ok("y se vuelve a apagar");
  }
}

console.log(`\n${fallos ? "FALLA: " + fallos : "Todo correcto"}`);
process.exit(fallos ? 1 : 0);
