/* ════════════════════════════════════════════════════════════════
   M9 · CADA RIVAL CONTRA EL MAZO QUE TENDRÁS CUANDO TE LO CRUCES

   `simular-historia.mjs` enfrenta un rival al mazo inicial sin mejorar,
   y eso solo vale para el primer duelo: a Rex o a PaniK te los cruzas
   en el acto II, con veinte cartas ya cambiadas. Aquí cada rival juega
   contra una muestra de mazos REALES de jugadores en ese punto de la
   run, sacados de `simular-run.mjs` (GOAT_RUN_JSON).

     acto I    · mazos al empezar la run
     acto II   · mazos al entrar en el acto II
     castillo  · mazos al entrar en el castillo

   Uso:  node medir-escalera.mjs <runs.json> [partidas por rival=60] [filtro]
   ════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";
import * as X from "./out/ocgcore.bundle.js";
import { scriptReader } from "./out/scripts.bundle.js";
import { GoatDuel } from "./src/duel.mjs";
import { makeAutoPlayer } from "./src/autopilot.mjs";
import { makeTrivialResolver } from "./src/trivial.js";
import { crearCerebro } from "./src/ai/brain.js";
import { sembrarManoDeJefe } from "./src/story/personajes.js";
import { rngDeSemilla } from "./src/story/rng.js";

const D = "../data/";
const leer = f => JSON.parse(readFileSync(D+f, "utf-8"));
const DECKS = leer("story/decks.json");
const DATOS = leer("story/personajes.json");
const raw = leer("cards.json");
const names = JSON.parse(readFileSync("./out/names.subset.json","utf-8"));
const db = new Map();
for(const k in raw){ const c = raw[k]; db.set(c.code, {...c, race:BigInt(c.race)}); }
const trivial = makeTrivialResolver(X), generico = makeAutoPlayer(X);
const nombreDe = c => names[c]?.name ?? "";

const RUNS = JSON.parse(readFileSync(process.argv[2], "utf-8"));
const N = Number(process.argv[3] ?? 60);
const FILTRO = process.argv[4] ?? "";

const xr = s => { let x=s>>>0||1; return ()=>{ x^=x<<13; x^=x>>>17; x^=x<<5; return ((x>>>0)%100000)/100000; }; };
const barajar = (a,r)=>{ const b=[...a]; for(let i=b.length-1;i>0;i--){ const j=(r()*(i+1))|0; [b[i],b[j]]=[b[j],b[i]]; } return b; };
async function duelo(mio, rival, semilla, { mano=null, lpRival=8000, manoRival=5 } = {}){
  const lib = await X.default({ sync:true });
  const duel = new GoatDuel({ lib, X, cardDb:db, scriptReader, onEvent:()=>{} });
  const r = xr(semilla);
  const ME = semilla % 2;
  const a = barajar(mio.main, r);
  let b = barajar(rival.main, r);
  if(mano) b = sembrarManoDeJefe(b, mano, rngDeSemilla("J"+semilla), nombreDe);
  await duel.create({
    deck0: ME===0 ? a : b, deck1: ME===0 ? b : a,
    extra0: ME===0 ? (mio.extra ?? []) : (rival.extra ?? []),
    extra1: ME===0 ? (rival.extra ?? []) : (mio.extra ?? []),
    seed:[BigInt(semilla),7n,13n,29n],
    lp0: ME===0 ? 8000 : lpRival, lp1: ME===0 ? lpRival : 8000,
    mano0: ME===0 ? 5 : manoRival, mano1: ME===0 ? manoRival : 5 });
  const cer = { 0:crearCerebro({X,duel,db,names,nivel:"experto",yo:0}),
                1:crearCerebro({X,duel,db,names,nivel:"experto",yo:1}) };
  let ganador = null;
  const orig = duel.emit.bind(duel);
  duel.emit = (t,d) => { if(t==="win") ganador = d.player; orig(t,d); };
  for(let paso=0; paso<9000 && !duel.finished; paso++){
    const q = await duel.run();
    if(!q || duel.finished) break;
    let i=0, resp=null;
    while(i<8 && !resp){ resp = trivial(q) ?? cer[q.player]?.(q,i) ?? generico(q,i); i++; }
    if(!resp) break;
    duel.respond(resp);
    if(duel.turnCount > 60) break;
  }
  return ganador === ME;
}

const muestra = acto => (process.env.ESC_ACTO1 && acto===0) ? RUNS.map(t=>t.mazoMitad).filter(Boolean)
                                                          : RUNS.map(t => t.mazos?.[acto]).filter(Boolean);
const P = DATOS.pegasus;
const ESCALONES = [
  { acto:0, nombre:"acto I",   rivales:[
      "weevil-t1","mai-t1","joey-t1","mako-t1",            // duelos (tier 1)
      "weevil-t2","mai-t2","joey-t2","mako-t2",            // Elite (tier 2)
      "ghost-kaiba-t2" ] },                                 // jefe
  { acto:1, nombre:"acto II",  rivales:[
      "rex-t2","panik-t2","bonz-t2","labyrinth-brothers-t2",
      "rex-t3","panik-t3","bonz-t3","labyrinth-brothers-t3",
      "weevil-t3","mai-t3","joey-t3","mako-t3",
      "weevil-t2","mai-t2","joey-t2","mako-t2" ] },        // la última oportunidad, a tier 2
  { acto:2, nombre:"castillo", rivales:[
      "mai-torre","keith-torre","joey-torre","kaiba-torre","yugi-torre",
      { id:"pegasus-m0-boss", mano:P.manoInicial, lpRival:P.lp ?? 8000,
        manoRival:P.manoInicial?.cartasEnMano ?? 5 } ] },
];

console.log(`\n═══ LA ESCALERA · cada rival contra mazos reales de ese punto · ${N} partidas ═══`);
console.log("  (experto contra experto: un humano que juega bien gana más)\n");
for(const e of ESCALONES){
  const mazos = muestra(e.acto);
  console.log(`── ${e.nombre} · ${mazos.length} mazos de jugador ──`);
  for(const rv of e.rivales){
    const def = typeof rv === "string" ? { id:rv } : rv;
    if(FILTRO && !FILTRO.split(",").some(f => def.id === f || (f.endsWith("*") && def.id.startsWith(f.slice(0,-1))))) continue;
    const rival = DECKS[def.id];
    if(!rival){ console.log(`  ${def.id}: no existe`); continue; }
    let g = 0;
    for(let i=0;i<N;i++){
      const mio = mazos[i % mazos.length];
      if(await duelo(mio, rival, 101 + i*37, def)) g++;
    }
    const pct = Math.round(g*100/N);
    console.log(`  ${def.id.padEnd(24)} ${"█".repeat(Math.round(pct/5)).padEnd(20,"·")} ${pct}%`);
  }
}
