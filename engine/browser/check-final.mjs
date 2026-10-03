/* ════════════════════════════════════════════════════════════════
   CÓMO ACABA UN DUELO, Y QUÉ SEÑALA UN EFECTO

   Dos cosas que salieron de las notas de E (18-09):

   1. Todas sus partidas decían «se quedó sin cartas en el Deck» aunque
      hubieran acabado con el rival a 0 LP. El `reason` del mensaje WIN
      estaba corrido un puesto en la tabla `MOTIVOS`. Aquí se JUEGAN
      partidas de verdad y se comprueba contra los LP y los mazos: no se
      supone el valor, se mide.

   2. «Cuando se hace algo como Mystical Space Typhoon, tiene que marcar
      de alguna manera qué carta está seleccionando». El motor lo dice
      con BECOME_TARGET y el adaptador lo reenvía como evento `target`;
      se comprueba que el juego lo escuche y lo pinte.

   Uso: node check-final.mjs [partidas=6]
   ════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";
const N = Number(process.argv[2] ?? 6);
const R = await import(process.cwd()+"/registro.mjs");
const X = await import(process.cwd()+"/out/ocgcore.bundle.js");
const { makeAutoPlayer } = await import(process.cwd()+"/src/autopilot.mjs");
const { makeTrivialResolver } = await import(process.cwd()+"/src/trivial.js");
const { crearCerebro } = await import(process.cwd()+"/src/ai/brain.js");
const trivial = makeTrivialResolver(X), gen = makeAutoPlayer(X);
let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t,d="") => { fallos++; console.log("  ✗ " + t + (d?"   "+d:"")); };
console.log("\n═══ EL FINAL DEL DUELO Y LOS OBJETIVOS ═══\n");

/* ── 1 · el motivo del final ── */
let porLP = 0, porMazo = 0, raros = [];
for(let i=0;i<N;i++){
  const s=500+i*7919, r=R.xorshift(s);
  const a=R.MAZOS[i%R.MAZOS.length], b=R.MAZOS[(i*7+3)%R.MAZOS.length];
  const cab={semilla_motor:[String(s),"7","13","29"],mazos:[{main:R.barajar(a.main,r),extra:a.extra},{main:R.barajar(b.main,r),extra:b.extra}]};
  let fin=null;
  const duel = await R.duelDesde(cab, e=>{ if(e.t==="win") fin={player:e.player, reason:e.reason}; });
  const cer=[0,1].map(yo=>crearCerebro({X,duel,db:R.db,names:R.names,nivel:"experto",yo}));
  let ult=null,int=0;
  for(let p=0;p<8000 && !duel.finished;p++){
    const q=await duel.run(); if(!q||duel.finished)break;
    if(q!==ult){ult=q;int=0;}
    const resp = trivial(q) ?? cer[q.player](q,int) ?? gen(q,int);
    int++; if(!resp)break; duel.respond(resp); if(duel.turnCount>80)break;
  }
  if(!fin) continue;
  const perdedor = 1 - fin.player;
  const lpCero = duel.lp[perdedor] <= 0;
  const mazoVacio = (duel.zones[perdedor][1] ?? []).length === 0;
  if(fin.reason === 1){ porLP++; if(!lpCero) raros.push(`reason 1 con ${duel.lp[perdedor]} LP`); }
  else if(fin.reason === 2){ porMazo++; if(!mazoVacio) raros.push(`reason 2 con mazo de ${(duel.zones[perdedor][1]??[]).length}`); }
}
if(porLP) ok(`reason 1 es «puntos de vida a cero» (${porLP} partidas)`);
else mal("alguna partida acabó por LP (si no, esto no comprueba nada)");
if(!raros.length) ok("y el motivo casa con el estado final en todas");
else mal("el motivo casa con el estado final", raros.join(" · "));
if(porMazo) ok(`reason 2 es deckout (${porMazo} partidas)`);
else console.log("  ~ ninguna partida acabó por deckout en esta tanda");

/* La tabla del juego tiene que decir lo mismo que acabamos de medir. */
const main = readFileSync("./src/main.js","utf-8");
const tabla = main.slice(main.indexOf("const MOTIVOS="), main.indexOf("const MOTIVOS=")+260);
if(/1:"Puntos de vida a cero"/.test(tabla)) ok("la tabla MOTIVOS dice lo mismo");
else mal("la tabla MOTIVOS dice lo mismo", tabla.slice(0,120));

/* ── 2 · el objetivo se pinta ── */
{
  const hayCase = /case "target":/.test(main) && /marcarObjetivos/.test(main);
  hayCase ? ok("el juego escucha `target` y marca la carta señalada")
          : mal("el juego escucha `target` y marca la carta señalada");
  const view = readFileSync("./src/view.js","utf-8");
  /senalada/.test(view) ? ok("y la vista tiene su marca propia")
                        : mal("y la vista tiene su marca propia");
  const html = readFileSync("./out/goat.html","utf-8");
  /\.card\.senalada/.test(html) ? ok("con estilo en el HTML construido")
                               : mal("con estilo en el HTML construido");
  /marcarObjetivos/.test(html) ? ok("y la función llega al bundle")
                               : mal("y la función llega al bundle");
}

console.log(`\n${fallos ? "FALLA: " + fallos : "Todo correcto"}`);
process.exit(fallos ? 1 : 0);
