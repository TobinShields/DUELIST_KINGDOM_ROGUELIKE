/* Comprueba el HTML REAL, no el DOM simulado.
   El stub crea elementos a demanda, así que "existe el botón" siempre
   daba verde aunque el elemento no estuviera en la página. */
import { readFileSync } from "node:fs";


/* ══════════════════════════════════════════════════════════════════
   EL CSS TIENE QUE ESTAR CERRADO

   Una sola llave sin cerrar y el navegador se traga TODO el CSS que
   viene detrás: la página sale entera sin estilos, con los botones
   nativos y el tablero deshecho, y no hay ni un error en la consola
   porque el CSS no lanza errores, se recupera en silencio.

   Pasó de verdad: un `sed` para quitar un color mal escrito se llevó por
   delante el cierre de la regla y dejó `.rActo.a0{background:...,` sin
   cerrar. El juego "arrancaba bien" —los hitos llegaban al final— y aun
   así era inusable. Dos comprobaciones tontas que lo cazan en un
   segundo. */
function revisarCSS(html){
  const bloque = html.match(/<style>([\s\S]*?)<\/style>/);
  if(!bloque) return ["no hay hoja de estilos"];
  const css = bloque[1];
  const fallos = [];
  let abre = 0, cierra = 0;
  for(const c of css){ if(c === "{") abre++; if(c === "}") cierra++; }
  if(abre !== cierra) fallos.push(`llaves descuadradas: ${abre} abiertas y ${cierra} cerradas`);
  const cA = (css.match(/\/\*/g) || []).length, cC = (css.match(/\*\//g) || []).length;
  if(cA !== cC) fallos.push(`comentarios sin cerrar: ${cA} abiertos y ${cC} cerrados`);
  /* Una declaración cortada deja una propiedad sin punto y coma justo
     antes de un selector. Se detecta buscando una línea que acabe en
     coma seguida de otra que empiece por selector. */
  const lineas = css.split("\n");
  for(let i = 0; i < lineas.length - 1; i++){
    if(/,\s*$/.test(lineas[i]) && /^\s*[.#][\w-]+\s*\{/.test(lineas[i+1]))
      fallos.push(`regla cortada en la línea ${i+1}: "${lineas[i].trim().slice(-50)}"`);
  }
  return fallos;
}
const html=readFileSync("./out/goat.html","utf-8");
const css=html.match(/<style>([\s\S]*?)<\/style>/)[1].replace(/\s*\n\s*/g,"");
const js=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
const necesarios=["menu","pHome","pJugar","pOpciones","irJugar","irOpciones","volver1","volver2",
  "mCadenas","mTiempo","mGaleria","mMazoIA","mJugar","mDeck","coin","boot","stage","grid",
  "cardLayer","prompt","controles","btnFase","btnFin","btnFaseTxt","fasesCentro","phasecard",
  "zoneview","ghost","turnInfo","lpMeVal","lpOppVal","detail","log","banner","flash","choice"];
let fallan=[];
for(const id of necesarios) if(!html.includes(`id="${id}"`)) fallan.push(id);
console.log("═══ ELEMENTOS EN EL HTML REAL ═══");
console.log(`comprobados: ${necesarios.length} · ausentes: ${fallan.length}`, fallan.length?fallan:"");
// los ids que el JS usa deben existir en el HTML
const usados=[...new Set([...js.matchAll(/getElementById\("([^"]+)"\)/g)].map(m=>m[1]))];
const huerfanos=usados.filter(id=>!html.includes(`id="${id}"`));
console.log(`ids usados por el JS: ${usados.length} · sin elemento en la página: ${huerfanos.length}`,
            huerfanos.length?huerfanos:"");
const c=[
 ["controles con estilo propio", /#controles\{position:absolute/.test(css)],
 ["botón de fase visualmente distinto", /\.cFase\{color:#04121a;background:linear-gradient\(180deg,#7fe3d0/.test(css)],
 ["tira de fases sobre el divisor, sin tapar cartas", /#fasesCentro\{position:absolute;left:50%;transform:translateX\(-50%\);z-index:6/.test(css) && /#fasesCentro \*\{pointer-events:none\}/.test(css)],
 ["la moneda se lanza tras ocultar la carga", /getElementById\("boot"\)\.style\.display="none";\s*await View\.sorteo/.test(js.replace(/\s+/g," "))],
];
let ok=0; for(const [t,v] of c){ console.log(v?"  ✓":"  ✗",t); if(v) ok++; }
{
  const fallosCSS = revisarCSS(html);
  for(const f of fallosCSS) console.log("  ✗ CSS: " + f);
  if(!fallosCSS.length) console.log("  ✓ la hoja de estilos está bien cerrada");
  else process.exitCode = 1;
}

/* ══════════════════════════════════════════════════════════════════
   UNA PANTALLA OCULTA TIENE QUE ESTAR OCULTA

   Las pantallas del menú se esconden con el atributo `hidden`, que es
   una regla del NAVEGADOR con especificidad cero. Al quitarle la caja al
   menú de escritorio añadí `#menu .mpant{display:flex}` y eso la pisó:
   el menú salía con el duelo libre y los desafíos apilados debajo, todo
   a la vez. E lo vio en cuanto abrió el build.
   ══════════════════════════════════════════════════════════════════ */
{
  /* Cualquier regla que le dé `display` a `.mpant` sin excluir las
     ocultas es el bug. Se quitan los COMENTARIOS primero: si no, el
     propio comentario que explica el bug lo dispara. */
  const cssLimpio = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const malas = [...cssLimpio.matchAll(/([^{}]*\.mpant[^{}]*)\{([^}]*)\}/g)]
    .filter(m => /display:\s*(?!none)/.test(m[2]) && !/\[hidden\]/.test(m[1])
                 && !/:not\(\[hidden\]\)/.test(m[1]));
  if(malas.length)
  { console.log(`  ✗ una regla le da display a .mpant sin excluir las ocultas: «${malas[0][1].trim()}»`);
    process.exitCode = 1; }
  else console.log("  ✓ ninguna regla de .mpant pisa el atributo `hidden`");
  if(!/\.mpant\[hidden\]\{display:none\}/.test(css))
  { console.log("  ✗ hay una regla explícita que oculta las pantallas con `hidden`");
    process.exitCode = 1; }
  else console.log("  ✓ y hay una regla explícita que las oculta");
}

/* ══════════════════════════════════════════════════════════════════
   TODO LO QUE `main.js` LE PIDE A `View` TIENE QUE EXISTIR

   `view.js` se empaqueta dentro de una función y lo que sale es un
   objeto con los nombres de una LISTA ESCRITA A MANO en `build-html.mjs`.
   Añadí `atajos` y se me olvidó ponerla: el bundle se construyó sin una
   queja y en el navegador salió «V.atajos is not a function» en mitad de
   un duelo, con el tablero muerto y el cartel de SOMETHING BROKE. E lo
   pilló jugando.

   Es la misma familia que `import * as` y los alias de import: el
   empaquetado pierde algo y no lo dice. `build-html.mjs` ya para la
   construcción si falta alguna, y esto lo comprueba desde el otro lado:
   cada `V.loQueSea(` que aparece en el código tiene que estar en el
   objeto que se construye.
   ══════════════════════════════════════════════════════════════════ */
{
  const devuelve = html.slice(html.indexOf("return {initView"));
  const lista = devuelve.slice(0, devuelve.indexOf("}"))
    .replace("return {", "").split(",").map(x => x.trim()).filter(Boolean);
  /* Todo lo que se llama como V.algo( o View.algo( en el bundle. */
  const usadas = new Set([...js.matchAll(/\bV(?:iew)?\??\.(\w+)\??\(/g)].map(m => m[1]));
  const faltan = [...usadas].filter(n => !lista.includes(n));
  if(!lista.length) console.log("  ✗ no encuentro la lista de exports de View");
  else if(faltan.length){
    console.log(`  ✗ se llaman pero NO están en el objeto View: ${faltan.join(", ")}`);
    process.exitCode = 1;
  }
  else console.log(`  ✓ las ${usadas.size} funciones de View que se usan están en el objeto`);
}

console.log(`\n${ok}/${c.length} · ${fallan.length===0&&huerfanos.length===0?"✓ sin elementos huérfanos":"✗ revisar"}`);
