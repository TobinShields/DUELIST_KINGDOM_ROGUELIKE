/* ══════════════════════════════════════════════════════════════════
   EL RIVAL A CERO TERMINA EL DUELO. UNA VEZ.

   E jugó contra Pegasus y el marcador enseñó 0 LP en el turno 21; el
   duelo siguió aceptando ataques, costes y fases SEIS TURNOS más y el
   `win` no llegó hasta el 27. En el log adjunto está exactamente así:

     [517043ms] T21 · {"t":"damage","player":1,"amount":1300,"lp":0}
     ...
     [617104ms] T27 · {"t":"win","player":0,"reason":1}

   No era el motor tragándose el `win` ni la interfaz procesando eventos
   de más: era el ESPEJO. `duel.create` recibía `lp0`/`lp1` y se los
   pasaba a ocgcore correctamente, pero el espejo hacía
   `this.lp[0]=this.lp[1]=lp` con el valor por defecto. Pegasus juega con
   14000: tras 8000 de daño el espejo marcaba 0 y el motor seguía con
   6000 de verdad. La pantalla mentía; el duelo estaba bien.

   Por eso esto no comprueba "si lp<=0 gana" —eso rompería cadenas y
   costes—, sino lo único que importa: que el espejo diga lo mismo que el
   motor, y que el `win` llegue exactamente una vez.

   Uso:  node check-lp.mjs
   ══════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";
import * as X from "./out/ocgcore.bundle.js";
import { scriptReader } from "./out/scripts.bundle.js";
import { GoatDuel } from "./src/duel.mjs";
import { makeAutoPlayer } from "./src/autopilot.mjs";
import { makeTrivialResolver } from "./src/trivial.js";
import { crearCerebro } from "./src/ai/brain.js";

const D = "../data/";
const raw = JSON.parse(readFileSync(D + "cards.json", "utf-8"));
const names = JSON.parse(readFileSync("./out/names.subset.json", "utf-8"));
const DECKS = JSON.parse(readFileSync(D + "story/decks.json", "utf-8"));
const db = new Map();
for(const k in raw){ const c = raw[k]; db.set(c.code, { ...c, race:BigInt(c.race) }); }

let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t,d="") => { fallos++; console.log("  ✗ " + t + (d ? "   " + d : "")); };
console.log("\n═══ CERO PUNTOS DE VIDA TERMINA EL DUELO ═══\n");

const rng = s => { let x = s>>>0; return () => { x^=x<<13; x^=x>>>17; x^=x<<5;
                   return ((x>>>0)%100000)/100000; }; };
const barajar = (a,r) => { const b = [...a];
  for(let i=b.length-1;i>0;i--){ const j=(r()*(i+1))|0; [b[i],b[j]]=[b[j],b[i]]; } return b; };

/* ── 1 · EL ESPEJO ARRANCA DONDE ARRANCA EL MOTOR ── */
{
  const lib = await X.default({ sync:true });
  const duel = new GoatDuel({ lib, X, cardDb:db, scriptReader, onEvent:()=>{} });
  const A = DECKS["yugi-starter-a"], B = DECKS["pegasus-m0-boss"];
  await duel.create({ deck0:[...A.main], deck1:[...B.main],
    extra0:A.extra ?? [], extra1:B.extra ?? [],
    seed:[7n,7n,13n,29n], lp0:8000, lp1:14000 });
  if(duel.lp[0] !== 8000 || duel.lp[1] !== 14000)
    mal("el espejo arranca con los LP de cada lado",
        `espejo ${duel.lp[0]}/${duel.lp[1]}, pedidos 8000/14000`);
  else ok("el espejo arranca con 8000/14000, no con 8000 para los dos");
}

/* ── 2 · UNA PARTIDA ENTERA: EL ESPEJO NUNCA LLEGA A 0 ANTES DEL WIN ──
   Es el caso de E tal cual: un jefe con 14000. Antes de arreglarlo, el
   rival marcaba 0 y la partida seguía; ahora, si el espejo dice 0 sin
   que haya llegado el `win`, esto falla. */
{
  const trivial = makeTrivialResolver(X), generico = makeAutoPlayer(X);
  let cerosAntesDelWin = 0, wins = 0, partidas = 0, eventosTrasWin = 0;

  for(let s = 0; s < 4; s++){
    const lib = await X.default({ sync:true });
    let ganado = false, aCero = false;
    const eventos = [];
    const duel = new GoatDuel({ lib, X, cardDb:db, scriptReader, onEvent:e => {
      eventos.push(e);
      if(e.t === "win"){ wins++; ganado = true; return; }
      /* OJO CON LO QUE SE MIDE: el golpe final SIEMPRE deja el marcador
         en 0 y el `win` llega justo detrás — eso es lo correcto y contarlo
         daba un falso rojo (4 de 4). El bug de E era otro: que después
         del 0 SE SEGUÍA JUGANDO. Así que se marca el cero y se vigila si
         llega alguna jugada antes del `win`. */
      if((e.t === "damage" || e.t === "lp" || e.t === "recover")
         && (e.lp === 0 || e.value === 0) && !ganado) aCero = true;
      if(aCero && !ganado && ["attack","battle","chain","summon","phase"].includes(e.t))
        cerosAntesDelWin++;
      if(ganado && ["damage","attack","battle","chain"].includes(e.t)) eventosTrasWin++;
    }});
    const r = rng(1000 + s * 37);
    const A = DECKS["kaiba-t3"] ?? DECKS["yugi-starter-a"], B = DECKS["pegasus-m0-boss"];
    await duel.create({ deck0:barajar(A.main, r), deck1:barajar(B.main, r),
      extra0:A.extra ?? [], extra1:B.extra ?? [],
      seed:[BigInt(1000 + s), 7n, 13n, 29n], lp0:8000, lp1:14000 });
    const cerebros = { 0:crearCerebro({X,duel,db,names,nivel:"experto",yo:0}),
                       1:crearCerebro({X,duel,db,names,nivel:"experto",yo:1}) };
    for(let paso = 0; paso < 7000 && !duel.finished; paso++){
      const q = await duel.run();
      if(!q || duel.finished) break;
      let intento = 0, resp = null;
      while(intento < 8 && !resp){
        resp = trivial(q) ?? cerebros[q.player]?.(q, intento) ?? generico(q, intento);
        intento++;
      }
      if(!resp) break;
      duel.respond(resp);
      if(duel.turnCount > 70) break;
    }
    partidas++;
  }

  if(cerosAntesDelWin)
    mal("con el rival a 0 no se juega ni una carta más",
        `${cerosAntesDelWin} jugadas después del cero en ${partidas} partidas`);
  else ok(`en ${partidas} partidas con un jefe de 14000, nadie jugó nada tras llegar el rival a 0`);

  if(eventosTrasWin)
    mal("no llegan jugadas después del `win`", `${eventosTrasWin} eventos`);
  else ok("no se juega ni una carta después del `win`");

  if(wins > partidas)
    mal("el `win` llega exactamente una vez por partida", `${wins} en ${partidas}`);
  else ok(`el \`win\` llegó ${wins} vez/veces en ${partidas} partidas: nunca dos por duelo`);
}

/* ── 3 · Y LA INTERFAZ CIERRA AL PRIMER WIN ──
   Se lee del HTML construido: si el bucle vuelve a pedir decisiones tras
   terminar, el duelo se puede seguir jugando contra un muerto. */
{
  const html = readFileSync("./out/goat.html", "utf-8");
  const js = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  if(!/if\(ended\|\|duel\.finished\) return;/.test(js))
    mal("el bucle del duelo para en cuanto el duelo ha terminado");
  else ok("el bucle no pide una decisión más con el duelo terminado");
  if(!/lp0:\s*ME===0/.test(js) || !/lp1:\s*ME===0/.test(js))
    mal("la interfaz manda los LP por lado al motor");
  else ok("la interfaz manda lp0/lp1 por separado, no un solo lp");
  if(!/this\.lp\[0\] = lp0 \?\? lp;/.test(js))
    mal("y el espejo se inicializa con esos mismos LP");
  else ok("y el espejo se inicializa con esos mismos LP");
}

console.log(`\n${fallos ? "FALLA: " + fallos : "Todo correcto"}`);
process.exit(fallos ? 1 : 0);
