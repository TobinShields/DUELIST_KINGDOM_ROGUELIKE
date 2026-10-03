/* EXPERIMENTO: ¿cuándo cambia la simulación una jugada de la heurística por
   «terminar» o «a batalla», y con qué diferencia? Juega partidas con el
   pensador en los dos lados y apunta cada caso. */
import { readFileSync } from "node:fs";
import * as X from "./out/ocgcore.bundle.js";
import { scriptReader } from "./out/scripts.bundle.js";
import { GoatDuel } from "./src/duel.mjs";
import { makeAutoPlayer } from "./src/autopilot.mjs";
import { makeTrivialResolver } from "./src/trivial.js";
import { crearCerebro } from "./src/ai/brain.js";
import { crearPensador } from "./src/ai/pensar.js";
const N = Number(process.argv[2] ?? 6);
const raw = JSON.parse(readFileSync("./out/cards.subset.json","utf-8"));
const names = JSON.parse(readFileSync("./out/names.subset.json","utf-8"));
const db = new Map(); for(const k in raw){ const c=raw[k]; db.set(c.code,{...c, race:BigInt(c.race)}); }
const MAZOS = JSON.parse(readFileSync("../data/mazos.json","utf-8")).filter(m=>!m.aviso && m.main.length>=40)
  .map(m=>({ nombre:m.nombre, main:m.main, extra:m.extra ?? [] }));
const trivial = makeTrivialResolver(X), generico = makeAutoPlayer(X);
const xs = s => { let x=(s>>>0)||1; return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return((x>>>0)%100000)/100000;}; };
const barajar=(a,r)=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=(r()*(i+1))|0;[b[i],b[j]]=[b[j],b[i]];}return b;};
let traza = null;
const pensador = crearPensador({ X, crearLib: () => X.default({ sync:true }), GoatDuel, crearCerebro, db, names,
  scriptReader, mazosMeta: MAZOS, mundos: 8, maxCandidatos: 6, traza: t => { traza = t; } }).conPilotos(trivial, generico);
let casos = [], total = 0;
for(let i=0;i<N;i++){
  const semilla = 9100 + i*7919, r = xs(semilla);
  const mA = MAZOS[(i*3) % MAZOS.length], mB = MAZOS[(i*7+2) % MAZOS.length];
  const lib = await X.default({ sync:true });
  const duel = new GoatDuel({ lib, X, cardDb:db, scriptReader, onEvent:()=>{} });
  await duel.create({ deck0:barajar(mA.main,r), deck1:barajar(mB.main,r), extra0:mA.extra, extra1:mB.extra, seed:[BigInt(semilla),7n,13n,29n] });
  const cer = [0,1].map(p => crearCerebro({ X, duel, db, names, nivel:"experto", yo:p }));
  let ultimo=null, intento=0;
  for(let paso=0; paso<5000 && !duel.finished; paso++){
    const q = await duel.run(); if(!q || duel.finished) break;
    if(q!==ultimo){ ultimo=q; intento=0; }
    let resp = trivial(q) ?? cer[q.player](q, intento);
    if(q.type === X.OcgMessageType.SELECT_IDLECMD && duel.phase === 4 && intento === 0 && !trivial(q)){
      traza = null;
      const plan0 = cer[q.player].ultimoPlan()?.[0];
      const a = await pensador.pensarIdle(duel, q.player, q, cer[q.player], { semilla: semilla + paso });
      if(traza) total++;
      if(a && traza && traza.elige === "simulación" && a.index == null && plan0 && plan0.puntos > 0.8){
        const op = traza.opciones; const mejor = op[0]; const heur = op.find(o => o.jugada !== "terminar" && o.jugada !== "a batalla" && plan0.por.includes(o.jugada.split(" ").slice(1).join(" ")));
        casos.push({ partida:i, turno:duel.turnCount, mano: duel.zones[q.player][2].length, lp:[duel.lp[q.player], duel.lp[1-q.player]],
                     heur: plan0.por.slice(0,70), p: plan0.puntos.toFixed(2), opciones: op.slice(0,4).map(o=>`${o.jugada} ${o.media}`).join(" | ") });
        cer[q.player].anotar(q, a);
      }
      if(a) resp = a;
    }
    resp ??= generico(q, intento);
    intento++; if(!resp || intento > 12) break;
    duel.respond(resp);
  }
}
console.log(`decisiones simuladas: ${total} · la simulación eligió pasar sobre una jugada de la heurística: ${casos.length}`);
for(const c of casos) console.log(JSON.stringify(c));
