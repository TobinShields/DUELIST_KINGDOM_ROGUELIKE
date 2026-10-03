/* El sorteo debe fijar el lado ANTES de construir el tablero y la IA.
   Si no, acabas con el punto de vista cruzado y la IA jugando tu sitio. */
import { readFileSync, writeFileSync } from "node:fs";
import { installDOM } from "./domstub.mjs";
/* Sin argumento, `Number(undefined)` es NaN y el sorteo salía a cara o
   cruz de verdad: la comprobación fallaba una de cada tres veces sin que
   hubiera nada roto. Se fija el resultado del sorteo y la semilla del
   resto del azar. */
const forzar = Number.isFinite(Number(process.argv[2])) ? Number(process.argv[2]) : 0.9;
globalThis.GOAT_SEED = globalThis.GOAT_SEED ?? 20050401;
installDOM();
/* Las comprobaciones buscan los textos en español, así que se fuerza
   ese idioma: el juego arranca en inglés por defecto. */
/* OJO: se fija también el mazo del rival. Esta comprobación fuerza el
   sorteo secuestrando la PRIMERA llamada a Math.random, y con el mazo
   rival "al azar" esa primera llamada es la que elige la baraja, no el
   sorteo: la comprobación acababa mirando una moneda que nadie había
   trucado y fallaba una de cada tres veces. */
global.localStorage={getItem:k=>k==="goatConfig"
  ? '{"idioma":"es","mazoIA":"i0"}' : null, setItem(){}};
let primera=true; const real=Math.random;
Math.random=()=>{ if(primera){primera=false; return forzar;} return real(); };
const html=readFileSync("./out/goat.html","utf-8");
writeFileSync("./out/_lado.mjs", html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]);
console.warn=()=>{};
await import("./out/_lado.mjs");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await sleep(300);
document.getElementById("mJugar").onclick?.();
await sleep(6500);
const hud=String(document.getElementById("turnInfo").innerHTML).replace(/<[^>]+>/g,"").trim();
const p=document.getElementById("prompt");
const tit=String(p.innerHTML).replace(/<[^>]+>/g," ").trim().slice(0,44);
console.log(`Math.random=${forzar} → ${forzar<0.5?"empiezas tú":"empieza el rival"}`);
console.log(`  HUD: ${hud}`);
console.log(`  panel: ${p.style.display==="block" ? '"'+tit+'"' : "(oculto, juega la IA)"}`);
const coherente = forzar<0.5 ? /TU TURNO/.test(hud) : /TURNO RIVAL/.test(hud);
console.log(`  ${coherente ? "✓ el lado y el turno concuerdan" : "✗ punto de vista cruzado"}`);
