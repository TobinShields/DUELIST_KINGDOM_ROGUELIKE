/* ════════════════════════════════════════════════════════════════
   DOS DUELOS SEGUIDOS SIN RECARGAR LA PÁGINA

   Hasta el Reino de los Duelistas esto no pasaba nunca: cada duelo venía
   con la página recién cargada. Ahora se encadenan ocho o nueve, y el
   estado del duelo anterior se quedaba dentro de la vista.

   Lo que E vio en el segundo duelo del Reino:
     · el rival empezaba con 0 puntos de vida (los del duelo anterior);
     · las cartas de su mano eran una en la mano y otra en el panel, y no
       se podían jugar.

   La causa: `els` guarda un elemento del DOM por uid, y los uids de un
   duelo nuevo empiezan otra vez en 1. Las cartas nuevas reutilizaban los
   elementos de las viejas. `initView` ahora limpia; esto lo vigila.

   Uso:  node check-encadenados.mjs
   ════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from "node:fs";
import { installDOM } from "./domstub.mjs";
installDOM();
global.localStorage = { getItem:k => k==="goatConfig" ? '{"idioma":"es"}' : null,
                        setItem(){}, removeItem(){} };
globalThis.GOAT_SEED = 20050401;
globalThis.GOAT_PENSAR = 0;
const html = readFileSync("./out/goat.html","utf-8");
writeFileSync("./out/_enc.mjs", html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]);
console.warn = () => {};
await import("./out/_enc.mjs");
const sleep = ms => new Promise(r=>setTimeout(r,ms));
await sleep(400);

let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t,d="") => { fallos++; console.log("  ✗ " + t + (d?"   "+d:"")); };
const $ = id => document.getElementById(id);
const cartas = () => [...($("cardLayer")?.children ?? [])];

console.log("\n═══ DOS DUELOS SEGUIDOS SIN RECARGAR ═══\n");

/* Primer duelo. */
$("mJugar").onclick?.();
/* El primer duelo carga el wasm: tarda bastante más que el segundo. */
await sleep(9000);
const tras1 = cartas().length;
const lpRival1 = $("lpOppVal")?.textContent;
if(!tras1) mal("el primer duelo reparte cartas");
else ok(`el primer duelo reparte cartas (${tras1} en el tablero)`);

/* Se fuerza un final: rendirse es la vía corta y además es lo que hace
   un jugador que ve el duelo perdido. */
const rendir = $("btnRendirse");
if(rendir?.onclick){ rendir.onclick(); await sleep(200);
  const si = $("confirm");
  const btn = [...(si?.children ?? [])].flatMap(c=>[...(c.children??[])])
    .find(b => /Rendirse|Surrender|Sí|Yes/i.test(b.textContent||""));
  btn?.onclick?.(); await sleep(1200);
}

/* Segundo duelo, sin recargar nada. */
$("mJugar").onclick?.();
await sleep(2500);
const tras2 = cartas().length;
const lpMio2 = Number(String($("lpMeVal")?.textContent ?? "").replace(/\D/g,""));
const lpRival2 = Number(String($("lpOppVal")?.textContent ?? "").replace(/\D/g,""));

if(!tras2) mal("el segundo duelo reparte cartas");
else ok(`el segundo duelo reparte cartas (${tras2} en el tablero)`);

/* EL FALLO CONCRETO: cartas del duelo anterior que se quedan en la mesa.
   Si no se limpiara, el tablero tendría las de los dos duelos. */
if(tras2 > tras1 * 1.6)
  mal("el tablero no arrastra las cartas del duelo anterior", `${tras1} → ${tras2}`);
else ok("el tablero del segundo duelo no arrastra cartas del primero");

if(lpRival2 !== 8000 || lpMio2 !== 8000)
  mal("los dos empiezan con 8000 puntos de vida", `tú ${lpMio2}, rival ${lpRival2}`);
else ok("los dos duelistas empiezan el segundo duelo con 8000");

/* Y que no queden restos de la pantalla final del duelo anterior. */
const fin = $("fin");
if(fin && fin.style.display !== "none" && (fin.children?.length ?? 0) > 0)
  mal("la pantalla de fin del duelo anterior se ha limpiado");
else ok("no quedan restos de la pantalla de fin del duelo anterior");

console.log(fallos ? `\n${fallos} fallo(s)\n` : "\nTodo correcto\n");
process.exit(fallos ? 1 : 0);
