/* ¿La versión nueva del cerebro juega mejor que la vieja?

   Enfrenta DOS cerebros distintos —el de `src/ai/brain.js` y el de la
   carpeta que le pases— con el mismo motor, el mismo mazo y las mismas
   semillas. Es la única forma honesta de saber si un cambio en la IA
   suma: comparar contra otro nivel no vale, porque los dos cambian a la
   vez.

   Uso:  node duelo-versiones.mjs <carpeta-vieja> [partidas] [nivel]
         node duelo-versiones.mjs /tmp/b2/browser 200 experto
*/
import { readFileSync } from "node:fs";
import * as X from "./out/ocgcore.bundle.js";
import { scriptReader } from "./out/scripts.bundle.js";
import { GoatDuel } from "./src/duel.mjs";
import { makeAutoPlayer } from "./src/autopilot.mjs";
import { makeTrivialResolver } from "./src/trivial.js";
import { crearCerebro as nuevo } from "./src/ai/brain.js";

const carpeta = process.argv[2] ?? "/tmp/b2/browser";
const N       = Number(process.argv[3] ?? 200);
const nivel   = process.argv[4] ?? "experto";
const { crearCerebro: viejo } = await import(`${carpeta}/src/ai/brain.js`);

const raw   = JSON.parse(readFileSync("./out/cards.subset.json","utf-8"));
const names = JSON.parse(readFileSync("./out/names.subset.json","utf-8"));
const { deck, extra } = JSON.parse(readFileSync("./out/deck.json","utf-8"));
const db = new Map();
for(const k in raw){ const c=raw[k]; db.set(c.code,{...c, race:BigInt(c.race)}); }
const trivial = makeTrivialResolver(X), generico = makeAutoPlayer(X);
const barajar=(a,r)=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=(r()*(i+1))|0;[b[i],b[j]]=[b[j],b[i]];}return b;};
const rng=s=>{let x=s>>>0;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return((x>>>0)%100000)/100000;};};

/* Con GOAT_MAZOS=todos se recorren las 20 barajas en vez de jugar siempre
   con la de `out/deck.json`. Hizo falta al darle a la IA un plan por mazo:
   midiendo solo con un Goat Control, un cambio que hace que el mazo de Burn
   deje de cambiar golpes no se ve por ningún lado. Los dos lados llevan el
   mismo mazo en cada partida, así que lo que se mide sigue siendo el
   cerebro y no la baraja. */
const TODOS_LOS_MAZOS = () => JSON.parse(readFileSync("../data/mazos.json","utf-8"))
  .filter(m=>!m.aviso && m.main.length>=40)
  .map(m=>({ nombre:m.nombre ?? m.name, main:m.main, extra:m.extra ?? [] }));
/* GOAT_MAZOS=todos recorre las 20; GOAT_MAZOS=<trozo del nombre> se
   queda con uno solo, que es lo que hace falta cuando el desglose por
   mazo señala a uno concreto (PACMAN salió al 15% y había que mirarlo
   aparte, no diluido entre veinte). */
const MAZOS = (()=>{
  const q = process.env.GOAT_MAZOS;
  if(!q) return [{ nombre:"por defecto", main:deck, extra }];
  if(q === "todos") return TODOS_LOS_MAZOS();
  const uno = TODOS_LOS_MAZOS().filter(m=>m.nombre.toLowerCase().includes(q.toLowerCase()));
  if(!uno.length){ console.log(`no hay ningún mazo que contenga "${q}"`); process.exit(1); }
  return uno;
})();

async function partida(semilla, nuevoEnLado0, mazo){
  const lib = await X.default({ sync:true });
  const duel = new GoatDuel({ lib, X, cardDb:db, scriptReader, onEvent:()=>{} });
  const r = rng(semilla);
  await duel.create({ deck0:barajar(mazo.main,r), deck1:barajar(mazo.main,r),
    extra0:mazo.extra, extra1:mazo.extra, seed:[BigInt(semilla),7n,13n,29n] });
  const hacer = (fn, yo) => fn({ X, duel, db, names, nivel, yo });
  const cerebros = nuevoEnLado0
    ? { 0:hacer(nuevo,0), 1:hacer(viejo,1) }
    : { 0:hacer(viejo,0), 1:hacer(nuevo,1) };
  let ganador=null, turnos=0;
  const orig = duel.emit.bind(duel);
  duel.emit=(t,d)=>{ if(t==="win") ganador=d.player; if(t==="turn") turnos=d.turn; orig(t,d); };
  for(let paso=0; paso<7000 && !duel.finished; paso++){
    const q = await duel.run();
    if(!q || duel.finished) break;
    let intento=0, resp=null;
    while(intento<8 && !resp){ resp = trivial(q) ?? cerebros[q.player]?.(q,intento) ?? generico(q,intento); intento++; }
    if(!resp) break;
    duel.respond(resp);
  }
  return { ganador, turnos, sinTerminar:!duel.finished };
}

let gNuevo=0, gViejo=0, tablas=0, turnos=0;
const porMazo = new Map();
const t0=Date.now();
for(let i=0;i<N;i++){
  const nuevoEn0 = i%2===0;                      // se alternan los lados
  const mazo = MAZOS[Math.floor(i/2) % MAZOS.length];   // cada mazo, los dos lados
  const r = await partida(1000+i*7919, nuevoEn0, mazo);
  turnos += r.turnos;
  const m = porMazo.get(mazo.nombre) ?? {n:0,v:0};
  if(r.ganador===null) tablas++;
  else if((r.ganador===0) === nuevoEn0){ gNuevo++; m.n++; }
  else { gViejo++; m.v++; }
  porMazo.set(mazo.nombre, m);
}
const jug=gNuevo+gViejo;
const pct=jug?Math.round(gNuevo/jug*100):0;
// margen de error aproximado a 95%
const err=jug?Math.round(196*Math.sqrt(0.25/jug)):0;
console.log(`═══ ${nivel} · ${N} partidas · ${((Date.now()-t0)/1000).toFixed(0)}s ═══`);
console.log(`nuevo ${gNuevo} — ${gViejo} viejo   →  ${pct}% ±${err}   (tablas ${tablas}, ${(turnos/N).toFixed(1)} turnos)`);
console.log(pct-err>50 ? "el nuevo es mejor" : pct+err<50 ? "el nuevo es PEOR" : "empate dentro del margen");
if(MAZOS.length>1){
  console.log("\n── por mazo (el nuevo, contra el viejo) ──");
  [...porMazo.entries()]
    .map(([k,{n,v}])=>[k, n+v ? Math.round(n/(n+v)*100) : 0, n+v])
    .sort((a,b)=>b[1]-a[1])
    .forEach(([k,p,j])=>console.log(`  ${String(p).padStart(3)}%  ${k}  (${j})`));
}
