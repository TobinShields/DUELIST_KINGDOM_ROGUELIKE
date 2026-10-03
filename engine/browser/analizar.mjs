/* ════════════════════════════════════════════════════════════════
   ESCÁNER DE PARTIDAS

   Juega cientos de duelos entre bots y saca los números que hacen
   falta para ajustar la IA con datos en vez de a ojo:

     · quién gana, en cuántos turnos y con cuántos LP
     · ataques buenos, ataques suicidas y ataques directos
     · qué cartas se juegan, en qué turno y cuántas se quedan muertas
       en la mano al acabar
     · cuántas partidas se atascan (nadie avanza y se llega al límite)

   Uso:  node analizar.mjs [partidas] [nivelA] [nivelB]
         node analizar.mjs 200 experto duro
   ════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";
import * as X from "./out/ocgcore.bundle.js";
import { scriptReader } from "./out/scripts.bundle.js";
import { GoatDuel } from "./src/duel.mjs";
import { makeAutoPlayer } from "./src/autopilot.mjs";
import { makeTrivialResolver } from "./src/trivial.js";
import { crearCerebro, NIVELES } from "./src/ai/brain.js";

const raw   = JSON.parse(readFileSync("./out/cards.subset.json","utf-8"));
const names = JSON.parse(readFileSync("./out/names.subset.json","utf-8"));
const MAZOS = JSON.parse(readFileSync("../data/mazos.json","utf-8"));
const db = new Map();
for(const k in raw){ const c=raw[k]; db.set(c.code, {...c, race:BigInt(c.race)}); }
const trivial = makeTrivialResolver(X), generico = makeAutoPlayer(X);
const nm = c => names[c]?.name ?? ("#"+c);
const barajar = (a,r)=>{ const b=[...a];
  for(let i=b.length-1;i>0;i--){ const j=(r()*(i+1))|0; [b[i],b[j]]=[b[j],b[i]]; } return b; };
const rng = s => { let x=s>>>0; return ()=>{ x^=x<<13; x^=x>>>17; x^=x<<5;
                   return ((x>>>0)%100000)/100000; }; };

/* ── JUGADAS SIN SENTIDO ──
   El marcador no basta. Dos bots igual de tontos siguen dando 50%, así que
   "no ha empeorado" no quiere decir "juega bien": lo que E ve al otro lado
   de la pantalla no es el porcentaje, es la Snatch Steal sobre una ficha de
   Scapegoat. Esto cuenta activaciones que no consiguen nada, con nombre y
   apellidos, para poder decir cuántas hace el bot por partida en vez de
   suponerlo. Cada regla viene de una jugada que alguien reportó. */
const L = { HAND:2, MZONE:4, SZONE:8, GRAVE:16, REMOVED:32 };
const canonN = n => String(n||"").replace(/\s*\((GOAT|Pre-errata|Pre-Errata|Anime)\)\s*$/i,"").trim();
const esFichaCarta = c => { const d=db.get(c.code);
  return !!d && (d.type & 0x4000 || ((d.type & 0x1) && !d.attack && !d.defense)); };

function absurda(duel, quien, code){
  const nom = canonN(nm(code));
  /* La Standby Phase no cuenta: ahí llegan los MANTENIMIENTOS de cartas ya
     puestas —Snatch Steal regalando 1000, Premature, Messenger of Peace— y
     el motor los manda como eslabón de cadena igual que una activación.
     Contarlos daba 144 "Snatch Steal sin nada que robar" que en realidad
     eran una sola Snatch Steal cobrando su peaje cada turno. */
  if(duel.phase === 2) return null;
  const suyos = (duel.zones[1-quien]?.[L.MZONE] ?? []).filter(Boolean);
  const caraArriba = suyos.filter(c=>!(c.position & 0x0a));
  const conValor = caraArriba.filter(c=>!esFichaCarta(c));

  if(nom==="Snatch Steal" && !conValor.length)
    return "Snatch Steal sin nada que robar (solo fichas o tapadas)";
  /* OJO CON LOS FALSOS POSITIVOS: Nobleman of Crossout va contra cartas
     TAPADAS, así que con una tapada en el campo su activación es correcta
     aunque lo demás sean fichas. Solo cuenta como absurda cuando el campo
     rival entero son fichas y no hay nada más a lo que apuntar. */
  const tapadas = suyos.filter(c=>(c.position & 0x0a));
  if((nom==="Smashing Ground" || nom==="Nobleman of Crossout" ||
      nom==="Ring of Destruction") && caraArriba.length && !conValor.length && !tapadas.length)
    return "remoción gastada en una ficha de Scapegoat";
  if(nom==="Torrential Tribute" && duel.turnPlayer===quien)
    return "Torrential Tribute sobre su propia invocación";
  if(nom==="Book of Moon" && duel.turnPlayer===quien && !caraArriba.length)
    return "Book of Moon sin monstruo rival boca arriba";
  if(nom==="Thunder Dragon"){
    // ¿quedaban copias de verdad en el mazo?
    const total = (duel.decklist?.[quien] ?? [])
      .filter(c=>canonN(nm(c))==="Thunder Dragon").length;
    let vistas = 0;
    for(const loc of [L.HAND,L.MZONE,L.SZONE,L.GRAVE,L.REMOVED])
      for(const c of (duel.zones[quien]?.[loc] ?? []))
        if(c && canonN(nm(c.code))==="Thunder Dragon") vistas++;
    if(total - vistas <= 0) return "Thunder Dragon sin copias en el mazo";
  }
  return null;
}

/* Un duelo completo, apuntando todo lo que pasa. */
async function partida(nivelA, nivelB, semilla, mazoA, mazoB, st){
  const lib  = await X.default({ sync:true });
  const duel = new GoatDuel({ lib, X, cardDb:db, scriptReader, onEvent:()=>{} });
  const r = rng(semilla);
  await duel.create({ deck0:barajar(mazoA.main,r), deck1:barajar(mazoB.main,r),
    extra0:mazoA.extra, extra1:mazoB.extra, seed:[BigInt(semilla),7n,13n,29n] });
  const cerebros = { 0:crearCerebro({X,duel,db,names,nivel:nivelA,yo:0}),
                     1:crearCerebro({X,duel,db,names,nivel:nivelB,yo:1}) };

  let ganador=null, turnos=0;
  const jugadas = [];            // {jugador, carta, turno, tipo}
  const orig = duel.emit.bind(duel);
  duel.emit = (t, d) => {
    if(t==="win")   ganador = d.player;
    if(t==="turn")  turnos = d.turn;
    if(t==="summon" && d.code){
      const c = duel.cards.get(d.uid);
      jugadas.push({ j:c?.controller ?? duel.turnPlayer, carta:nm(d.code),
                     turno:duel.turnCount, tipo:d.kind==="flip"?"volteo":"invoca" });
    }
    if(t==="chain" && d.code){
      jugadas.push({ j:d.controller, carta:nm(d.code), turno:duel.turnCount, tipo:"activa" });
      const mal = absurda(duel, d.controller, d.code);
      if(mal){ st.absurdas[d.controller]++;
               st.porQue.set(mal, (st.porQue.get(mal)??0)+1); }
      st.activaciones[d.controller]++;
    }
    /* TRAMPA DE LA MEDICIÓN: los ataques directos se contaban aquí, con el
       evento `battle`, y salía 0% en 1.500 partidas. Parecía un fallo de la
       IA y no lo era: el motor solo manda BATTLE cuando hay cálculo de daño
       entre dos monstruos. Un ataque directo llega como ATTACK sin objetivo
       y jamás pasaba por este contador. Se cuenta donde toca. */
    if(t==="attack" && !d.targetUid){
      const j = duel.cards.get(d.uid)?.controller ?? duel.turnPlayer;
      st.ataques[j]++; st.directos[j]++;
    }
    if(t==="battle" && d.atacante){
      const j = d.atacante.controller;
      st.ataques[j]++;
      if(!d.objetivo) st.directos[j]++;
      else {
        if(d.objetivo.muere) st.matan[j]++;
        /* SUICIDA es que muera el atacante Y SOBREVIVA el defensor. Antes
           contaba cualquier ataque en el que el atacante moría, así que un
           cambio limpio —dos monstruos de 1600 que se matan— salía como
           suicidio: al dejar que la IA hiciera esos cambios, el número
           saltó del 1% al 5% sin que hubiera empeorado nada. */
        if(d.atacante.muere && !d.objetivo.muere) st.suicidas[j]++;
        if(d.atacante.muere && d.objetivo.muere)  st.cambios[j]++;
        if(!d.objetivo.muere && !d.atacante.muere) st.rebotan[j]++;
      }
    }
    orig(t,d);
  };

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
  const enMano = [0,1].map(j => (duel.zones[j][2]??[]).filter(Boolean).map(c=>nm(c.code)));
  return { ganador, turnos, lp:{0:duel.lp[0],1:duel.lp[1]}, jugadas, enMano,
           desyncs:duel.desyncs, atascada: !duel.finished };
}

/* ══════════ programa ══════════ */
const N = Number(process.argv[2] ?? 100);
const A = process.argv[3] ?? "experto";
const B = process.argv[4] ?? "duro";
if(!NIVELES.includes(A) || !NIVELES.includes(B)){
  console.log("niveles válidos:", NIVELES.join(", ")); process.exit(1);
}
const incluidos = MAZOS.filter(m=>!m.aviso && m.main.length>=40);

const st = { ataques:[0,0], directos:[0,0], matan:[0,0], suicidas:[0,0], cambios:[0,0], rebotan:[0,0],
             absurdas:[0,0], activaciones:[0,0], porQue:new Map() };
const jugadasPorCarta = new Map();   // carta -> {veces, turnos:[], ganadas}
const muertasEnMano   = new Map();   // carta -> veces que se queda sin jugar
let ganaA=0, ganaB=0, tablas=0, turnosTot=0, atascadas=0, desyncs=0;
const t0 = Date.now();

for(let i=0;i<N;i++){
  const invertido = i%2===1;                       // se alternan los lados
  const mazo = incluidos[i % incluidos.length];    // mismo mazo los dos: mide la IA, no el mazo
  const r = await partida(invertido?B:A, invertido?A:B, 1000+i*7919, mazo, mazo, st);
  turnosTot += r.turnos; desyncs += r.desyncs;
  if(r.atascada) atascadas++;
  if(r.ganador===null) tablas++;
  else {
    const ladoA = invertido ? 1 : 0;
    (r.ganador===ladoA ? ganaA++ : ganaB++);
    for(const j of r.jugadas){
      const e = jugadasPorCarta.get(j.carta) ?? { veces:0, turnos:[], ganadas:0 };
      e.veces++; e.turnos.push(j.turno);
      if(j.j===r.ganador) e.ganadas++;
      jugadasPorCarta.set(j.carta, e);
    }
  }
  for(const lado of [0,1]) for(const c of r.enMano[lado])
    muertasEnMano.set(c, (muertasEnMano.get(c)??0)+1);
}

const media = a => a.length ? a.reduce((s,x)=>s+x,0)/a.length : 0;
const pct = (x,t) => t ? Math.round(x/t*100)+"%" : "—";
console.log(`═══ ${N} partidas · ${A} vs ${B} · ${((Date.now()-t0)/1000).toFixed(0)}s ═══\n`);
console.log(`resultado          ${A} ${ganaA} — ${ganaB} ${B}   (${pct(ganaA,ganaA+ganaB)} para ${A}`
          + `, tablas ${tablas})`);
console.log(`duración media     ${(turnosTot/N).toFixed(1)} turnos`
          + `   ·   partidas atascadas: ${atascadas}`);
console.log(`desincronizaciones ${desyncs} en total (${(desyncs/N).toFixed(1)} por partida)\n`);

console.log("── jugadas sin sentido (lo que un humano ve y comenta) ──");
{
  const act = st.activaciones[0]+st.activaciones[1];
  const abs = st.absurdas[0]+st.absurdas[1];
  console.log(`  ${abs} de ${act} activaciones (${pct(abs,act)})`
            + `  ·  ${(abs/N).toFixed(2)} por partida`);
  [...st.porQue.entries()].sort((a,b)=>b[1]-a[1])
    .forEach(([k,v])=>console.log(`    ${String(v).padStart(4)}  ${k}`));
  if(!abs) console.log("    (ninguna en la muestra)");
}
console.log("");

console.log("── calidad de los ataques ──");
for(const [j,quien] of [[0,"lado 0"],[1,"lado 1"]]){
  const t=st.ataques[j];
  console.log(`  ${quien}: ${t} ataques · matan ${pct(st.matan[j],t)}`
    + ` · directos ${pct(st.directos[j],t)}`
    + ` · cambios ${pct(st.cambios[j],t)}`
    + ` · SUICIDAS ${pct(st.suicidas[j],t)}`
    + ` · sin efecto ${pct(st.rebotan[j],t)}`);
}

console.log("\n── cartas más jugadas (turno medio · % en partidas ganadas) ──");
[...jugadasPorCarta.entries()]
  .sort((a,b)=>b[1].veces-a[1].veces).slice(0,14)
  .forEach(([c,e])=>console.log(`  ${c.padEnd(42)} ${String(e.veces).padStart(4)} veces`
    + ` · turno ${media(e.turnos).toFixed(1).padStart(4)}`
    + ` · gana ${pct(e.ganadas,e.veces)}`));

console.log("\n── cartas que se quedan muertas en la mano ──");
[...muertasEnMano.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12)
  .forEach(([c,v])=>console.log(`  ${c.padEnd(42)} ${String(v).padStart(4)} veces`));
