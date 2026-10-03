/* ¿Pensar juega mejor que la heurística? Experto+pensar contra experto,
   mismos mazos meta, lados alternos.
   Uso: node pensar-duelo.mjs [partidas=10] [mundos=4] [candidatos=6] [desde=0]
        GOAT_PENSAR_TRAZA=1 enseña cada decisión simulada. */
import { readFileSync } from "node:fs";
import * as X from "./out/ocgcore.bundle.js";
import { scriptReader } from "./out/scripts.bundle.js";
import { GoatDuel } from "./src/duel.mjs";
import { makeAutoPlayer } from "./src/autopilot.mjs";
import { makeTrivialResolver } from "./src/trivial.js";
import { crearCerebro } from "./src/ai/brain.js";
import { crearPensador } from "./src/ai/pensar.js";

const N = Number(process.argv[2] ?? 10), MUNDOS = Number(process.argv[3] ?? 4),
      CANDS = Number(process.argv[4] ?? 6), DESDE = Number(process.argv[5] ?? 0);
const raw = JSON.parse(readFileSync("./out/cards.subset.json","utf-8"));
const names = JSON.parse(readFileSync("./out/names.subset.json","utf-8"));
const db = new Map(); for(const k in raw){ const c=raw[k]; db.set(c.code,{...c, race:BigInt(c.race)}); }
const MAZOS = JSON.parse(readFileSync("../data/mazos.json","utf-8")).filter(m=>!m.aviso && m.main.length>=40)
  .map(m=>({ nombre:m.nombre, main:m.main, extra:m.extra ?? [] }));
const trivial = makeTrivialResolver(X), generico = makeAutoPlayer(X);
const xs = s => { let x=(s>>>0)||1; return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return((x>>>0)%100000)/100000;}; };
const barajar=(a,r)=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=(r()*(i+1))|0;[b[i],b[j]]=[b[j],b[i]];}return b;};

const pensador = crearPensador({ X, crearLib: () => X.default({ sync:true }), GoatDuel, crearCerebro, db, names,
  scriptReader, mazosMeta: MAZOS, mundos: MUNDOS, maxCandidatos: CANDS,
  traza: process.env.GOAT_PENSAR_TRAZA ? t => console.log("   ·", JSON.stringify(t)) : null })
  .conPilotos(trivial, generico);

let gP = 0, gH = 0, tablas = 0, decisiones = 0, msTotal = 0, cambios = 0;
for(let i = DESDE; i < DESDE + N; i++){
  const semilla = 4000 + i * 7919, r = xs(semilla);
  const mA = MAZOS[i % MAZOS.length], mB = MAZOS[(i * 7 + 3) % MAZOS.length];
  const lib = await X.default({ sync:true });
  let ganador = null;
  const duel = new GoatDuel({ lib, X, cardDb:db, scriptReader, onEvent: e => { if(e.t==="win") ganador = e.player; } });
  await duel.create({ deck0:barajar(mA.main,r), deck1:barajar(mB.main,r), extra0:mA.extra, extra1:mB.extra,
                      seed:[BigInt(semilla),7n,13n,29n] });
  const ladoPensar = i % 2;
  const cer = [0,1].map(p => crearCerebro({ X, duel, db, names, nivel:"experto", yo:p }));
  let ultimo = null, intento = 0;
  const atacoEnTurno = new Set();
  const limiteMs = Number(process.env.GOAT_TOPE_MS ?? 120000), tInicio = performance.now();
  for(let paso=0; paso<8000 && !duel.finished; paso++){
    if(performance.now() - tInicio > limiteMs){ console.log(`partida ${i} · CORTADA por tiempo en T${duel.turnCount}`); break; }
    const q = await duel.run(); if(!q || duel.finished) break;
    if(q !== ultimo){ ultimo = q; intento = 0; }
    let resp = trivial(q);
    if(!resp) resp = cer[q.player](q, intento);
    if(q.player === ladoPensar && q.type === X.OcgMessageType.SELECT_IDLECMD && duel.phase === 4 && intento === 0){
      const t0 = performance.now();
      const p = await pensador.pensarIdle(duel, q.player, q, cer[q.player], { semilla: semilla + paso });
      msTotal += performance.now() - t0; decisiones++;
      if(p){ if(!resp || p.action !== resp.action || p.index !== resp.index) cambios++; resp = p; }
    }
    if(q.player === ladoPensar && q.type === X.OcgMessageType.SELECT_CHAIN && intento === 0 && process.env.GOAT_SIN_CADENA !== "1"){
      const t0 = performance.now();
      const p = await pensador.pensarCadena(duel, q.player, q, cer[q.player], { semilla: semilla + paso });
      msTotal += performance.now() - t0;
      if(p){ decisiones++; if(!resp || p.index !== resp.index) cambios++; resp = p; }
    }
    if(q.player === ladoPensar && q.type === X.OcgMessageType.SELECT_BATTLECMD && intento === 0 && process.env.GOAT_SIN_BATALLA !== "1"){
      const primera = !atacoEnTurno.has(duel.turnCount);
      const t0 = performance.now();
      const p = await pensador.pensarBatalla(duel, q.player, q, cer[q.player], { semilla: semilla + paso, primeraDelTurno: primera });
      msTotal += performance.now() - t0;
      if(p){ decisiones++; if(!resp || p.action !== resp.action || p.index !== resp.index) cambios++; resp = p;
             if(p.action === X.SelectBattleCMDAction.SELECT_BATTLE) cer[q.player].fijarAtaque(q, p.index); }
    }
    if(q.player === ladoPensar && resp?.type === X.OcgResponseType.SELECT_BATTLECMD && resp.action === X.SelectBattleCMDAction.SELECT_BATTLE)
      atacoEnTurno.add(duel.turnCount);
    resp ??= generico(q, intento);
    intento++;
    if(!resp || intento > 12) break;
    duel.respond(resp);
    if(duel.turnCount > 60) break;
  }
  if(ganador === null) tablas++; else if(ganador === ladoPensar) gP++; else gH++;
  if(process.env.GOAT_RSS) console.log(`   rss ${Math.round(process.memoryUsage().rss/1048576)} MB`);
  console.log(`partida ${i} · ${mA.nombre} vs ${mB.nombre} · piensa el lado ${ladoPensar} · gana ${ganador === null ? "nadie" : ganador === ladoPensar ? "PENSAR" : "heurística"} · T${duel.turnCount}`);
}
console.log(`pensar ${gP} — ${gH} heurística (tablas ${tablas}) · ${decisiones} decisiones, ${(msTotal/Math.max(1,decisiones)).toFixed(0)} ms de media, ${cambios} cambios respecto a la heurística`);
