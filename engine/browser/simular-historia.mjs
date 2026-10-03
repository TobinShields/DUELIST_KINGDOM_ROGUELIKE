/* ════════════════════════════════════════════════════════════════
   ¿ESTÁ EQUILIBRADO? — DUELOS REALES DEL MODO HISTORIA

   Todo lo demás del modo historia se puede probar sin motor. Esto no:
   la pregunta "¿puede el mazo inicial con el primer rival?" solo la
   contesta ocgcore jugando la partida.

   Se juegan duelos REALES entre los mazos del modo historia, con el
   mismo nivel de IA que tendría el rival en ese nodo, y sale el
   porcentaje. Como el jugador humano juega mejor que el bot, estos
   números son un SUELO, no una predicción: si el bot con el starter ya
   gana el 60% contra Weevil tier 1, un humano ganará más. El objetivo
   del brief para los primeros duelos es 65-80% humano.

   OJO CON LEER ESTO COMO SI FUERA EL JUEGO: dos bots del mismo nivel
   dan 50% jueguen bien o mal (ver CLAUDE.md). Aquí lo que se mide es la
   diferencia entre MAZOS, con el nivel de IA fijado por el nodo.

   Uso:  node simular-historia.mjs [partidas por cruce]
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
const raw   = leer("cards.json");
const names = JSON.parse(readFileSync("./out/names.subset.json","utf-8"));
const DECKS = leer("story/decks.json");
const db = new Map();
for(const k in raw){ const c = raw[k]; db.set(c.code, {...c, race:BigInt(c.race)}); }
const trivial = makeTrivialResolver(X), generico = makeAutoPlayer(X);

const rng = s => { let x=s>>>0; return ()=>{ x^=x<<13; x^=x>>>17; x^=x<<5;
                   return ((x>>>0)%100000)/100000; }; };
const barajar = (a,r)=>{ const b=[...a];
  for(let i=b.length-1;i>0;i--){ const j=(r()*(i+1))|0; [b[i],b[j]]=[b[j],b[i]]; } return b; };

const DATOS = leer("story/personajes.json");
const nombreDe = c => names[c]?.name ?? "";

async function duelo(mazoA, mazoB, nivelA, nivelB, semilla, manoJefe=null, lpB=8000, manoB=5){
  const lib  = await X.default({ sync:true });
  const duel = new GoatDuel({ lib, X, cardDb:db, scriptReader, onEvent:()=>{} });
  const r = rng(semilla);
  /* Si el rival es un jefe con mano sembrada, se le coloca su motor
     arriba del mazo DESPUÉS de barajar. */
  let mazoRival = barajar(mazoB.main, r);
  if(manoJefe) mazoRival = sembrarManoDeJefe(mazoRival, manoJefe,
                              rngDeSemilla("JEFE-"+semilla), nombreDe);
  await duel.create({ deck0:barajar(mazoA.main,r), deck1:mazoRival,
    extra0:mazoA.extra ?? [], extra1:mazoB.extra ?? [],
    seed:[BigInt(semilla),7n,13n,29n], lp0:8000, lp1:lpB, mano0:5, mano1:manoB });
  const cerebros = { 0:crearCerebro({X,duel,db,names,nivel:nivelA,yo:0}),
                     1:crearCerebro({X,duel,db,names,nivel:nivelB,yo:1}) };
  let ganador = null;
  const orig = duel.emit.bind(duel);
  duel.emit = (t,d) => { if(t==="win") ganador = d.player; orig(t,d); };
  for(let paso=0; paso<7000 && !duel.finished; paso++){
    const q = await duel.run();
    if(!q || duel.finished) break;
    let intento=0, resp=null;
    while(intento<8 && !resp){
      resp = trivial(q) ?? cerebros[q.player]?.(q,intento) ?? generico(q,intento);
      intento++;
    }
    if(!resp) break;
    duel.respond(resp);
  }
  return { ganador, turnos:duel.turnCount, atascada: !duel.finished };
}

const N = Number(process.argv[2] ?? 40);
/* Los cruces que de verdad deciden si la curva funciona: el mazo inicial
   contra lo primero que se encuentra, y los tres tiers de un mismo
   personaje para ver que subir de tier significa algo. */
/* TODO en experto, porque eso es lo que juega el juego. Los niveles bajos
   se quitaron del modo historia: no juegan peor, llevan lastres concretos
   —atacar sin mirar, encadenar lo primero, descartar al azar— y eso en una
   aventura se lee como un juego roto, no como un rival flojo. La curva la
   hace el MAZO. Medir aquí en "normal" y "duro" era medir un juego que ya
   no existe, y encima maquillaba los números: el starter parecía más
   fuerte de lo que es porque enfrente había un bot con lastres. */
const CRUCES = JSON.parse(process.env.GOAT_CRUCES ?? "null") ?? [

  ["yugi-starter-a", "weevil-t1", "experto", "Starter Mago Oscuro vs Weevil T1 (primer duelo)"],
  ["yugi-starter-b", "rex-t1",    "experto", "Starter Guerreros vs Rex T1"],
  ["yugi-starter-c", "mako-t1",   "experto", "Starter Ritual vs Mako T1"],
  ["yugi-starter-a", "joey-t2",   "experto", "Starter sin mejorar vs Joey T2 (acto II)"],
  ["yugi-starter-a", "kaiba-t3",  "experto", "Starter sin mejorar vs Kaiba T3 (castillo)"],
  ["yugi-starter-a", "pegasus-m0-boss", "experto", "Starter sin mejorar vs Pegasus (sin mano sembrada)"],
  ["yugi-starter-a", "pegasus-m0-boss", "experto", "Starter sin mejorar vs Pegasus (CON mano sembrada)", "pegasus"],
  ["kaiba-t3",       "pegasus-m0-boss", "experto", "Mazo de tier 3 vs Pegasus (CON mano sembrada)", "pegasus"],
  ["weevil-t1",  "weevil-t2", "experto", "Weevil T1 vs T2 (¿el tier significa algo?)"],
  ["weevil-t2",  "weevil-t3", "experto", "Weevil T2 vs T3"],
  ["joey-t1",    "joey-t3",   "experto", "Joey T1 vs T3"],
];

console.log(`\n═══ EQUILIBRIO DEL MODO HISTORIA · ${N} partidas por cruce ═══\n`);
console.log("  (bot contra bot: el humano juega mejor, así que esto es el suelo)\n");

for(const [a, b, nivel, titulo, jefe, lpB, manoB] of CRUCES){
  const A = DECKS[a], B = DECKS[b];
  if(!A || !B){ console.log(`  ${titulo}: falta un mazo`); continue; }
  let gana=0, atascadas=0, turnos=0;
  for(let i=0;i<N;i++){
    const r = await duelo(A, B, nivel, nivel, 1000+i*37,
                          jefe === "pegasus" ? DATOS.pegasus.manoInicial : null,
                          lpB ?? 8000, manoB ?? 5);
    if(r.ganador===0) gana++;
    if(r.atascada) atascadas++;
    turnos += r.turnos;
  }
  const pct = Math.round(gana*100/N);
  const barra = "█".repeat(Math.round(pct/5)).padEnd(20, "·");
  console.log(`  ${titulo}`);
  console.log(`     ${String(gana).padStart(3)}-${String(N-gana).padEnd(3)} ${barra} ${pct}%` +
              `   (${(turnos/N).toFixed(0)} turnos de media${atascadas?`, ${atascadas} atascadas`:""})`);
}
console.log("");
