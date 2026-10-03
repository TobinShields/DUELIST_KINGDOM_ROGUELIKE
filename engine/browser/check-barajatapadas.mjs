/* ══════════════════════════════════════════════════════════════════
   CUANDO EL MOTOR BARAJA TUS TAPADAS

   Cada vez que colocas una carta boca abajo teniendo ya otra tapada, el
   motor REORDENA esas casillas: es lo que impide que el rival —o tú—
   siga la pista de qué tapada es cuál. Manda el mensaje 36,
   SHUFFLE_SET_CARD.

   Aquí se comprueban las dos cosas que fallaron, que son distintas:

   1. QUE EL PAQUETE SEPA LEER EL MENSAJE. ocgcore-wasm 0.1.2 lo lee mal
      de dos formas —la cuenta es u8 y él lee u32, y las posiciones no
      vienen en parejas sino en dos bloques— y se salía del buffer con
      "eof". En el navegador eso mata el bucle del duelo entero: la
      partida se queda muerta. Se parchea en `bundle.mjs`.

   2. QUE NUESTRO ESPEJO REORDENE IGUAL. Es la trampa de siempre, la que
      ya mordió con la mano y Delinquent Duo: el motor identifica las
      cartas por POSICIÓN. Si el espejo no sigue el barajado, volteas o
      eliges la carta equivocada — y no hay ningún error, solo juegas
      otra cosa.

   Se juegan partidas reales con mazos llenos de tapadas y se compara
   casilla por casilla contra el motor.
   ══════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";
import * as X from "./out/ocgcore.bundle.js";
import { scriptReader } from "./out/scripts.bundle.js";
import { GoatDuel } from "./src/duel.mjs";
import { makeAutoPlayer } from "./src/autopilot.mjs";
import { makeTrivialResolver } from "./src/trivial.js";
import { crearCerebro } from "./src/ai/brain.js";

const D = "../data/";
const leer = f => JSON.parse(readFileSync(D+f, "utf-8"));
const raw   = leer("cards.json");
const names = JSON.parse(readFileSync("./out/names.subset.json","utf-8"));
const MAZOS = leer("mazos.json");
const db = new Map();
for(const k in raw){ const c = raw[k]; db.set(c.code, {...c, race:BigInt(c.race)}); }
const trivial = makeTrivialResolver(X), generico = makeAutoPlayer(X);

const rng = s => { let x=s>>>0; return ()=>{ x^=x<<13; x^=x>>>17; x^=x<<5;
                   return ((x>>>0)%100000)/100000; }; };
const barajar = (a,r)=>{ const b=[...a];
  for(let i=b.length-1;i>0;i--){ const j=(r()*(i+1))|0; [b[i],b[j]]=[b[j],b[i]]; } return b; };

let fallos = 0, pasa = 0;
const ok  = (t,e="") => { pasa++; console.log("  ✓ " + t + (e?" — "+e:"")); };
const mal = (t,e="") => { fallos++; console.log("  ✗ " + t + (e?" — "+e:"")); };

console.log("═══ EL MOTOR BARAJA LAS TAPADAS ═══\n");

/* ── 1 · el lector del paquete ──
   Se le da a mano el mensaje exacto que reventaba, con los bytes que
   saqué del duelo real (Bonz, semilla 1037):
     36 · zona 4 · n=1 · desde{ctrl 1, zona 4, sec 2, pos 8} · hacia{0…}
   Si el parche desaparece, esto vuelve a lanzar "eof". */
{
  const { OcgMessageType } = X;
  if(OcgMessageType.SHUFFLE_SET_CARD !== 36)
    mal("SHUFFLE_SET_CARD sigue siendo el mensaje 36");
  else ok("SHUFFLE_SET_CARD sigue siendo el mensaje 36");

  const texto = readFileSync("./out/ocgcore.bundle.js","utf8");
  /* El parche escribe la cuenta como u8 y lee los dos bloques por
     separado. Si vuelve el original —`length:e.u32()` con `from:p(e),
     to:p(e)` en la misma vuelta— es que `bundle.mjs` no se ha aplicado. */
  const original = /case 36:return\{type:t,location:e\.u8\(\),cards:Array\.from\(\{length:e\.u32\(\)\}/;
  const parcheado = /case 36:\{const loc=e\.u8\(\),n=e\.u8\(\)/;
  if(original.test(texto)) mal("el bundle lleva el lector ROTO del paquete",
    "vuelve a ejecutar node bundle.mjs; sin el parche el duelo muere con 'eof'");
  else if(!parcheado.test(texto)) mal("el lector de SHUFFLE_SET_CARD no es el parcheado ni el original",
    "¿se ha actualizado ocgcore-wasm? revisa bundle.mjs");
  else ok("el bundle lleva el lector parcheado");
}

/* ── 2 · el espejo sigue el barajado ── */
async function partida(mazoA, mazoB, semilla){
  const lib  = await X.default({ sync:true });
  const duel = new GoatDuel({ lib, X, cardDb:db, scriptReader, onEvent:()=>{} });
  const r = rng(semilla);
  await duel.create({ deck0:barajar(mazoA.main,r), deck1:barajar(mazoB.main,r),
    extra0:mazoA.extra ?? [], extra1:mazoB.extra ?? [],
    seed:[BigInt(semilla),7n,13n,29n] });
  const cerebros = { 0:crearCerebro({X,duel,db,names,nivel:"experto",yo:0}),
                     1:crearCerebro({X,duel,db,names,nivel:"experto",yo:1}) };

  /* Contamos los barajados para saber si el caso se ha dado de verdad:
     un test que nunca llega a ejercitar lo que mide es peor que ninguno. */
  /* Solo cuentan las zonas del campo: `reorder` también lo emite el
     barajado de mano (Delinquent Duo) y ese es otro mensaje distinto. */
  let barajados = 0;
  const orig = duel.emit.bind(duel);
  duel.emit = (t,d) => { if(t==="reorder" && (d.location===4 || d.location===8)) barajados++;
                         orig(t,d); };

  let desajustes = 0, comparaciones = 0, reventon = null;
  try{
    for(let paso=0; paso<3000 && !duel.finished; paso++){
      const q = await duel.run();
      if(!q || duel.finished) break;

      /* LA COMPARACIÓN: casilla por casilla, lo que dice el motor contra
         lo que tiene el espejo. `duelQueryLocation` es la verdad. */
      /* Las dos zonas del campo donde el motor baraja: los monstruos
         colocados y —mucho más a menudo— las mágicas y trampas puestas. */
      for(const lado of [0,1])
      for(const zona of [X.OcgLocation.MZONE, X.OcgLocation.SZONE]){
        const real = lib.duelQueryLocation(duel.handle,
          { flags: X.OcgQueryFlags.CODE | X.OcgQueryFlags.POSITION,
            controller: lado, location: zona });
        (real ?? []).forEach((c, i) => {
          const mio = duel.zones[lado]?.[zona]?.[i] ?? null;
          if(!c && !mio) return;
          comparaciones++;
          if(!c || !mio){ desajustes++; return; }
          /* Una tapada nuestra sí sabemos qué código tiene: es la prueba
             de que el espejo la tiene en la casilla correcta. */
          if(mio.code && c.code && mio.code !== c.code) desajustes++;
        });
      }

      let intento=0, resp=null;
      while(intento<8 && !resp){
        resp = trivial(q) ?? cerebros[q.player]?.(q,intento) ?? generico(q,intento);
        intento++;
      }
      if(!resp) break;
      duel.respond(resp);
    }
  }catch(e){ reventon = e.message; }
  return { barajados, desajustes, comparaciones, reventon };
}

/* EL CRUCE IMPORTA. Con los mazos de torneo el motor no baraja casi
   nunca: 0 veces en ocho partidas, o sea que el test no medía nada. Lo
   que dispara el mensaje es COLOCAR MONSTRUOS BOCA ABAJO teniendo ya
   otro tapado, y de eso vive el mazo de Bonz —que es justo con el que
   apareció el fallo—. 16 barajados en 26 partidas contra el starter. */
const STORY = leer("story/decks.json");
const CRUCES = [
  ["yugi-starter-a", "bonz-t1"],
  ["yugi-starter-a", "bonz-t2"],
  ["yugi-starter-c", "bonz-t1"],
  ["yugi-starter-a", "bonz-t3"],
  ["bonz-t2",        "bonz-t3"],
];
{
  let barajados = 0, desajustes = 0, comparaciones = 0, reventones = [];
  for(let i=0;i<8;i++){
    const [ida, idb] = CRUCES[i % CRUCES.length];
    const A = STORY[ida] ?? MAZOS[0], B = STORY[idb] ?? MAZOS[1];
    A.nombre ??= ida; B.nombre ??= idb;
    const r = await partida(A, B, 1000 + i*37);
    barajados += r.barajados; desajustes += r.desajustes;
    comparaciones += r.comparaciones;
    if(r.reventon) reventones.push(`${A.nombre} vs ${B.nombre}: ${r.reventon}`);
  }
  if(reventones.length) mal("ninguna partida revienta leyendo mensajes del motor",
    reventones[0]);
  else ok("ninguna de las 8 partidas revienta leyendo mensajes del motor");

  if(!barajados) mal("el caso llega a darse",
    "0 barajados de tapadas en 8 partidas: este test no está midiendo nada");
  else ok("el motor barajó las tapadas", barajados + " veces en 8 partidas");

  if(desajustes) mal("el espejo sigue al motor casilla por casilla",
    `${desajustes} desajustes de ${comparaciones} comparaciones`);
  else ok("el espejo sigue al motor casilla por casilla",
    comparaciones + " comparaciones");
}

console.log(`\n${pasa}/${pasa+fallos}`);
if(fallos){ console.log("\nFALLA: " + fallos); process.exit(1); }
console.log("\nTodo correcto");
