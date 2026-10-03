/* ══════════════════════════════════════════════════════════════════
   UN ERROR DE LUA NO ROMPE EL DUELO: SE COME UN EFECTO Y SIGUE

   E: «he descartado Kuriboh y aun así me he comido el daño y mi
   monstruo se ha destruido». Y no era la interfaz ni el adaptador. En
   su log, con Kuriboh ya en el cementerio y la cadena montada:

     [string "chain.lua"]:85: Passed invalid CHAININFO flag.

   La causa no es de Kuriboh. `chain.lua` envuelve `Duel.RegisterEffect`
   para apuntarse las propiedades de la carta que lo registra, y para eso
   recorre TODAS las `CHAININFO_*` que conocen los CardScripts modernos.
   El core que usamos es ocgcore 0.1.2, más antiguo, y algunas no las
   reconoce: lanza un error de Lua que se lleva por delante la
   resolución ENTERA del efecto. La carta se descarta, la cadena se
   resuelve, y no pasa nada.

   Y no es una carta: revienta cualquiera que registre un efecto al
   resolverse. Por eso esto no es un test de Kuriboh sino un BARRIDO: se
   juegan partidas con los 20 mazos y no puede salir ni un error del
   motor. Es la comprobación que habría cazado esto el primer día — el
   mensaje estaba en todos los logs, pero nadie lo miraba porque el
   duelo seguía tan tranquilo.

   El parche vive en `build-scripts.mjs`.

   Uso:  node check-lua.mjs [partidas]     (por defecto 30)
   ══════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";
import * as X from "./out/ocgcore.bundle.js";
import { scriptReader } from "./out/scripts.bundle.js";
import { GoatDuel } from "./src/duel.mjs";
import { makeAutoPlayer } from "./src/autopilot.mjs";
import { makeTrivialResolver } from "./src/trivial.js";
import { crearCerebro } from "./src/ai/brain.js";

const raw   = JSON.parse(readFileSync("./out/cards.subset.json","utf-8"));
const names = JSON.parse(readFileSync("./out/names.subset.json","utf-8"));
const mazos = JSON.parse(readFileSync("../data/mazos.json","utf-8"));
const db = new Map();
for(const k in raw){ const c = raw[k]; db.set(c.code, {...c, race:BigInt(c.race)}); }
const trivial = makeTrivialResolver(X), generico = makeAutoPlayer(X);

const listaMazos = Array.isArray(mazos) ? mazos : Object.values(mazos);
const rng = s => { let x = s>>>0;
  return () => { x^=x<<13; x^=x>>>17; x^=x<<5; return ((x>>>0)%100000)/100000; }; };
const barajar = (a,r) => { const b=[...a];
  for(let i=b.length-1;i>0;i--){ const j=(r()*(i+1))|0; [b[i],b[j]]=[b[j],b[i]]; } return b; };

/* Los errores, agrupados por su primera línea: el mismo fallo sale
   cientos de veces y la lista en crudo no se puede leer. */
const errores = new Map();
const apunta = (texto, mazo) => {
  const clave = String(texto).split("\n")[0].trim().slice(0,140);
  if(!clave) return;
  const e = errores.get(clave) ?? { veces:0, mazos:new Set() };
  e.veces++; e.mazos.add(mazo);
  errores.set(clave, e);
};

async function partida(mA, mB, semilla){
  const lib = await X.default({sync:true});
  const duel = new GoatDuel({ lib, X, cardDb:db, scriptReader, onEvent:()=>{} });
  const r = rng(semilla);
  await duel.create({
    deck0:barajar(mA.main ?? mA.deck ?? [], r), deck1:barajar(mB.main ?? mB.deck ?? [], r),
    extra0:mA.extra ?? [], extra1:mB.extra ?? [],
    seed:[BigInt(semilla),7n,13n,29n] });
  const cerebros = { 0: crearCerebro({X,duel,db,names,nivel:"experto",yo:0}),
                     1: crearCerebro({X,duel,db,names,nivel:"experto",yo:1}) };
  duel.onEvent = e => {
    /* El adaptador ya emite esto (`errorHandler` en duel.mjs). Lo único
       que faltaba era que alguien lo mirase. */
    if(e.t === "coreError") apunta(e.text, `${mA.nombre ?? "?"} vs ${mB.nombre ?? "?"}`);
  };
  let last=null, att=0;
  for(let s=0;s<12000;s++){
    const q = await duel.run();
    if(duel.finished || !q) break;
    if(q !== last){ last = q; att = 0; }
    const r2 = trivial(q) ?? cerebros[q.player](q,att) ?? generico(q,att);
    att++;
    if(!r2) break;
    duel.respond(r2);
    if(duel.turnCount > 60) break;
  }
  return duel.turnCount;
}

const N = Number(process.argv[2] ?? 30);
console.log(`\n═══ ERRORES DEL MOTOR · ${N} partidas ═══\n`);
let turnos = 0;
for(let i=0;i<N;i++){
  /* Se recorren los 20 mazos en vez de repetir uno: cada arquetipo toca
     cartas distintas, y esto es justo un fallo POR CARTA. */
  const a = listaMazos[i % listaMazos.length];
  const b = listaMazos[(i*7 + 3) % listaMazos.length];
  turnos += await partida(a, b, 4100 + i*7919);
  if((i+1) % 10 === 0) process.stdout.write(`  ${i+1}/${N}\r`);
}

console.log(`  ${N} partidas · ${Math.round(turnos/N)} turnos de media\n`);
if(!errores.size){
  console.log("  ✓ ni un error del motor en toda la tanda");
  console.log("\nTodo correcto");
  process.exit(0);
}
for(const [texto, e] of [...errores].sort((x,y)=>y[1].veces-x[1].veces))
  console.log(`  ✗ ×${e.veces}  ${texto}\n         en: ${[...e.mazos].slice(0,3).join(" · ")}`);
console.log(`\n  Un error de Lua no para el duelo: se come el efecto de la carta`);
console.log(`  y sigue como si nada. Cada uno de estos es una carta que no hace`);
console.log(`  lo que dice.\n\nFALLA: ${errores.size} errores distintos`);
process.exit(1);
