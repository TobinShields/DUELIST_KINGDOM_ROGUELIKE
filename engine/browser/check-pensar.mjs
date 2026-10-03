/* ════════════════════════════════════════════════════════════════
   PENSAR TAMPOCO PUEDE MIRAR TUS CARTAS

   `ai/pensar.js` monta mundos imaginados en el motor. Si para montarlos
   leyera algo oculto de la partida real —tu mano, tus tapadas, el orden
   de tu mazo, tu decklist— el bot volvería a jugar con trampa, solo que
   escondida en la simulación.

   Mismo método que `check-frontera`: en decisiones reales de Main Phase
   se piensa dos veces con la misma semilla, una con la partida tal cual
   y otra con todo lo oculto del rival cambiado. Tiene que salir la misma
   jugada Y los mismos números.

   Además: que en cada decisión haya al menos una opción simulable (si no,
   el mundo reconstruido no casa con la pregunta real y pensar no sirve).

   Uso: node check-pensar.mjs [partidas=3] [decisiones por partida=6]
   ════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";
import * as X from "./out/ocgcore.bundle.js";
import { scriptReader } from "./out/scripts.bundle.js";
import { GoatDuel } from "./src/duel.mjs";
import { makeAutoPlayer } from "./src/autopilot.mjs";
import { makeTrivialResolver } from "./src/trivial.js";
import { crearCerebro } from "./src/ai/brain.js";
import { crearPensador } from "./src/ai/pensar.js";

const N = Number(process.argv[2] ?? 3), POR = Number(process.argv[3] ?? 6);
const raw = JSON.parse(readFileSync("./out/cards.subset.json","utf-8"));
const names = JSON.parse(readFileSync("./out/names.subset.json","utf-8"));
const db = new Map(); for(const k in raw){ const c=raw[k]; db.set(c.code,{...c, race:BigInt(c.race)}); }
const MAZOS = JSON.parse(readFileSync("../data/mazos.json","utf-8")).filter(m=>!m.aviso && m.main.length>=40)
  .map(m=>({ nombre:m.nombre, main:m.main, extra:m.extra ?? [] }));
const CODIGOS = [...db.keys()].filter(c => names[c]?.name);
const trivial = makeTrivialResolver(X), generico = makeAutoPlayer(X);
const xs = s => { let x=(s>>>0)||1; return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return((x>>>0)%100000)/100000;}; };
const barajar=(a,r)=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=(r()*(i+1))|0;[b[i],b[j]]=[b[j],b[i]];}return b;};

let trazas = [];
const pensador = crearPensador({ X, crearLib: () => X.default({ sync:true }), GoatDuel, crearCerebro, db, names,
  scriptReader, mazosMeta: MAZOS, mundos: 3, maxCandidatos: 4, traza: t => trazas.push(t) })
  .conPilotos(trivial, generico);

/* Lo oculto para `yo`: mano, mazo y extra del rival, sus tapadas (código
   y ATK/DEF), su decklist; y el orden del mazo propio. */
function perturbar(duel, yo, r){
  const deshacer = [];
  for(const loc of [2, 1, 64, 4, 8]) for(const c of (duel.zones[1-yo][loc] ?? [])){
    if(!c) continue;
    if((loc === 4 || loc === 8) && !(c.position & 0x0a)) continue;
    deshacer.push([c, c.code, c.atkReal, c.defReal]);
    c.code = CODIGOS[(r()*CODIGOS.length)|0]; c.atkReal = (r()*30|0)*100; c.defReal = (r()*30|0)*100;
  }
  const mazo = duel.zones[yo][1], orden = [...mazo];
  mazo.splice(0, mazo.length, ...barajar(mazo, r));
  const lista = duel.decklist[1-yo];
  duel.decklist[1-yo] = lista.map(() => CODIGOS[(r()*CODIGOS.length)|0]);
  return () => { for(const [c,code,a,d] of deshacer){ c.code=code; c.atkReal=a; c.defReal=d; }
                 mazo.splice(0, mazo.length, ...orden); duel.decklist[1-yo] = lista; };
}

let comparadas = 0, fugas = 0, vacias = 0, cadenas = 0;
for(let i=0;i<N;i++){
  const semilla = 6100 + i*7919, r = xs(semilla);
  const mA = MAZOS[i % MAZOS.length], mB = MAZOS[(i*5+2) % MAZOS.length];
  const lib = await X.default({ sync:true });
  const duel = new GoatDuel({ lib, X, cardDb:db, scriptReader, onEvent:()=>{} });
  await duel.create({ deck0:barajar(mA.main,r), deck1:barajar(mB.main,r), extra0:mA.extra, extra1:mB.extra, seed:[BigInt(semilla),7n,13n,29n] });
  const cer = [0,1].map(p => crearCerebro({ X, duel, db, names, nivel:"experto", yo:p }));
  let ultimo=null, intento=0, hechas=0;
  for(let paso=0; paso<6000 && !duel.finished && hechas<POR; paso++){
    const q = await duel.run(); if(!q || duel.finished) break;
    if(q!==ultimo){ ultimo=q; intento=0; }
    let resp = trivial(q) ?? cer[q.player](q, intento);
    /* La ventana de cadena en el turno del rival: misma prueba. */
    if(q.type === X.OcgMessageType.SELECT_CHAIN && !q.forced && intento === 0 && duel.atacante
       && duel.atacante.controller !== q.player && !trivial(q)){
      const s = semilla + paso;
      trazas = [];
      const a = await pensador.pensarCadena(duel, q.player, q, cer[q.player], { semilla:s });
      const ta = JSON.stringify(trazas.map(({ms, ...x}) => x));
      const deshacer = perturbar(duel, q.player, xs(s ^ 0x77af));
      trazas = [];
      let b; try { b = await pensador.pensarCadena(duel, q.player, q, cer[q.player], { semilla:s }); } finally { deshacer(); }
      const tb = JSON.stringify(trazas.map(({ms, ...x}) => x));
      if(a || b){
        comparadas++; cadenas++;
        if(JSON.stringify(a) !== JSON.stringify(b) || ta !== tb){ fugas++; console.log(`  ✗ cadena partida ${i} T${duel.turnCount}: cambia al cambiar lo oculto\n     ${ta.slice(0,240)}\n     ${tb.slice(0,240)}`); }
      }
      if(a) resp = a;
    }
    if(q.type === X.OcgMessageType.SELECT_IDLECMD && duel.phase === 4 && intento === 0 && !trivial(q)){
      const s = semilla + paso;
      trazas = [];
      const a = await pensador.pensarIdle(duel, q.player, q, cer[q.player], { semilla:s });
      const ta = JSON.stringify(trazas.map(({ms, ...x}) => x));
      const deshacer = perturbar(duel, q.player, xs(s ^ 0x5bd1));
      trazas = [];
      let b; try { b = await pensador.pensarIdle(duel, q.player, q, cer[q.player], { semilla:s }); } finally { deshacer(); }
      const tb = JSON.stringify(trazas.map(({ms, ...x}) => x));
      comparadas++; hechas++;
      if(JSON.stringify(a) !== JSON.stringify(b) || ta !== tb){ fugas++; console.log(`  ✗ partida ${i} T${duel.turnCount}: cambia al cambiar lo oculto\n     ${ta.slice(0,300)}\n     ${tb.slice(0,300)}`); }
      if(a == null) vacias++;
      if(a) resp = a;
    }
    resp ??= generico(q, intento);
    intento++; if(!resp || intento > 12) break;
    duel.respond(resp);
  }
}
console.log(`\n═══ PENSAR · ${comparadas} decisiones comparadas (${cadenas} en ventana de cadena) ═══`);
console.log(vacias ? `  ~ ${vacias} decisiones sin ninguna opción simulable` : "  ✓ todas las decisiones tuvieron opciones simulables");
console.log(fugas ? `✗ ${fugas} decisiones dependen de información oculta` : "✓ pensar no depende de información oculta");
process.exit(fugas ? 1 : 0);
