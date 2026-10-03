/* ════════════════════════════════════════════════════════════════
   LA FRONTERA DE INFORMACIÓN — ¿el bot decide con lo que no debería ver?

   `ai/view.js` dice que el bot juega limpio, pero el cerebro recibe el
   objeto `duel` entero y el mensaje del motor sin filtrar. Decirlo no
   basta: esto lo PRUEBA.

   En cada decisión real de una partida bot contra bot se hacen dos
   preguntas con el MISMO azar (rng con semilla):
     1. la de verdad;
     2. la misma, a un cerebro gemelo, después de cambiar TODO lo que ese
        jugador no puede saber: la mano del rival, su mazo y su extra, sus
        cartas boca abajo, su decklist, y el orden del mazo propio. En el
        mensaje del motor se cambian igual los códigos de esas cartas.
   Lo observable y las acciones legales no se tocan. Si las dos respuestas
   difieren, la decisión dependía de información oculta: es una fuga.

   Tras la primera diferencia en una partida se deja de comparar esa
   partida (el gemelo ya ha tomado otro camino y todo lo que siga sería
   ruido), pero se sigue jugando.

   Uso:  node check-frontera.mjs [partidas=12] [niveles=experto,duro,normal]
         GOAT_FRONTERA_DETALLE=1 imprime cada fuga con su mensaje.
   ════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";
import * as X from "./out/ocgcore.bundle.js";
import { scriptReader } from "./out/scripts.bundle.js";
import { GoatDuel } from "./src/duel.mjs";
import { makeAutoPlayer } from "./src/autopilot.mjs";
import { makeTrivialResolver } from "./src/trivial.js";
import { crearCerebro } from "./src/ai/brain.js";

const N = Number(process.argv[2] ?? 12);
const NIVELES = (process.argv[3] ?? "experto,duro,normal").split(",");
const DETALLE = !!process.env.GOAT_FRONTERA_DETALLE;

const raw   = JSON.parse(readFileSync("./out/cards.subset.json","utf-8"));
const names = JSON.parse(readFileSync("./out/names.subset.json","utf-8"));
const db = new Map();
for(const k in raw){ const c=raw[k]; db.set(c.code,{...c, race:BigInt(c.race)}); }
const MAZOS = JSON.parse(readFileSync("../data/mazos.json","utf-8"))
  .filter(m=>!m.aviso && m.main.length>=40)
  .map(m=>({ nombre:m.nombre ?? m.name, main:m.main, extra:m.extra ?? [] }));
const CODIGOS = [...db.keys()].filter(c => names[c]?.name);
const trivial = makeTrivialResolver(X), generico = makeAutoPlayer(X);
const T = X.OcgMessageType;
const xorshift = s => { let x=(s>>>0)||1; return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return((x>>>0)%100000)/100000;}; };
const barajar=(a,r)=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=(r()*(i+1))|0;[b[i],b[j]]=[b[j],b[i]];}return b;};
const L = { DECK:1, HAND:2, MZONE:4, SZONE:8, GRAVE:16, REMOVED:32, EXTRA:64 };
const tapada = p => !!(p & 0x0a);

/* ¿Puede `yo` saber qué carta es esta? */
function oculta(c, loc, dueñoZona, yo){
  if(dueñoZona === yo) return loc === L.DECK;            // mi mazo: orden desconocido
  if(loc === L.HAND || loc === L.DECK || loc === L.EXTRA) return true;
  if(loc === L.MZONE || loc === L.SZONE) return tapada(c.position);
  return false;                                          // cementerio, destierro
}

/* Cartas de la MANO, el MAZO o el EXTRA del rival que el propio mensaje
   pone delante del jugador. Si el motor le pide elegir entre ellas es
   porque un efecto se las enseña (Confiscation, por ejemplo): son
   información legítima en ese momento y no se tocan. Mismo criterio que
   `mensajeLegal` en ai/view.js. */
function reveladas(q, duel, yo){
  const uids = new Set();
  const visitar = o => {
    if(Array.isArray(o)){ o.forEach(visitar); return; }
    if(!o || typeof o !== "object") return;
    if("code" in o && "controller" in o && o.controller !== yo && (o.location & (L.HAND|L.DECK|L.EXTRA))){
      const c = duel.at(o.controller, o.location, o.sequence ?? 0);
      if(c) uids.add(c.uid);
    }
    for(const v of Object.values(o)) if(v && typeof v === "object") visitar(v);
  };
  visitar(q);
  return uids;
}

/* Cambia lo oculto para `yo` en el espejo y devuelve cómo deshacerlo. */
function perturbar(duel, yo, r, respetar = new Set()){
  const deshacer = [];
  const nuevo = new Map();                               // uid → código falso
  for(const p of [0,1]) for(const loc of Object.values(L)){
    for(const c of (duel.zones[p][loc] ?? [])){
      if(!c || !oculta(c, loc, p, yo)) continue;
      if(p === yo) continue;                             // el orden propio va aparte
      if(respetar.has(c.uid)) continue;                  // revelada por un efecto
      deshacer.push([c, c.code, c.atkReal, c.defReal]);
      const falso = CODIGOS[(r()*CODIGOS.length)|0];
      c.code = falso; c.atkReal = (r()*30|0)*100; c.defReal = (r()*30|0)*100;
      nuevo.set(c.uid, falso);
    }
  }
  const mazoPropio = duel.zones[yo][L.DECK];
  const ordenPropio = [...mazoPropio];
  const barajado = barajar(mazoPropio, r);
  mazoPropio.splice(0, mazoPropio.length, ...barajado);
  const listaRival = duel.decklist[1-yo];
  duel.decklist[1-yo] = listaRival.map(()=>CODIGOS[(r()*CODIGOS.length)|0]);
  return {
    nuevo,
    deshacer(){
      for(const [c, code, a, d] of deshacer){ c.code=code; c.atkReal=a; c.defReal=d; }
      mazoPropio.splice(0, mazoPropio.length, ...ordenPropio);
      duel.decklist[1-yo] = listaRival;
    }
  };
}

/* Copia del mensaje con los códigos ocultos cambiados de forma coherente
   con el espejo perturbado. Una entrada de lista lleva controller,
   location y sequence; la carta del espejo que ocupa ese sitio dice si
   está tapada y qué código falso le ha tocado. */
function perturbarMensaje(q, duel, yo, cambio, r){
  const copia = structuredClone(q);
  let tocadas = 0;
  const visitar = o => {
    if(Array.isArray(o)){ o.forEach(visitar); return; }
    if(!o || typeof o !== "object") return;
    if("code" in o && "controller" in o && "location" in o){
      const c = duel.at(o.controller, o.location, o.sequence ?? 0);
      const posicion = c?.position ?? o.position ?? 0;
      const esOculta = o.controller !== yo &&
        (o.location & (L.MZONE|L.SZONE)) && tapada(posicion);
      if(esOculta && o.code){
        o.code = (c && cambio.nuevo.get(c.uid)) ?? CODIGOS[(r()*CODIGOS.length)|0];
        tocadas++;
      }
    }
    for(const v of Object.values(o)) if(v && typeof v === "object") visitar(v);
  };
  visitar(copia);
  return { copia, tocadas };
}

/* ── 0. PRESTADO SE SABE POR EL DUEÑO ──
   Antes se deducía de la decklist del rival: en un espejo (los dos llevan
   la carta) un monstruo robado nunca era prestado, y con una carta que
   solo lleva el rival se leía una lista que el bot no tiene por qué
   conocer. Tablero montado a mano, sin motor. */
{
  const { mesa, cod: codigo, P: POS } = await import("./banco-tablero.mjs");
  const { vistaDe } = await import("./src/ai/view.js");
  const breaker = "Breaker the Magical Warrior";
  const d = mesa({ mios:{ campo:[{carta:breaker, pos:POS.ATK, dueño:1}, {carta:breaker, pos:POS.ATK}] },
                   suyos:{ campo:[{carta:breaker, pos:POS.ATK}] } });
  d.decklist = { 0:[codigo(breaker)], 1:[codigo(breaker)] };
  const [robado, propio] = vistaDe(d, 0, db, names).monstruos;
  const bien = robado.prestado === true && propio.prestado === false;
  console.log(`${bien ? "✓" : "✗"} prestado por dueño en un espejo: robado=${robado.prestado} propio=${propio.prestado}`);
  if(!bien) process.exitCode = 1;
}

const nombreTipo = t => Object.entries(T).find(([,v])=>v===t)?.[0] ?? t;
let decisiones=0, comparadas=0, fugas=0, conCodigoOculto=0;
const porTipo = new Map();

for(let i=0;i<N;i++){
  const nivel = NIVELES[i % NIVELES.length];
  const mazoA = MAZOS[i % MAZOS.length], mazoB = MAZOS[(i*7+3) % MAZOS.length];
  const semilla = 5000 + i*7919;
  const lib = await X.default({ sync:true });
  const duel = new GoatDuel({ lib, X, cardDb:db, scriptReader, onEvent:()=>{} });
  const r = xorshift(semilla);
  await duel.create({ deck0:barajar(mazoA.main,r), deck1:barajar(mazoB.main,r),
    extra0:mazoA.extra, extra1:mazoB.extra, seed:[BigInt(semilla),7n,13n,29n] });
  let azarActual = xorshift(1);
  const rng = () => azarActual();
  const hacer = yo => crearCerebro({ X, duel, db, names, nivel, yo, rng });
  const real  = { 0:hacer(0), 1:hacer(1) };
  const gemelo = { 0:hacer(0), 1:hacer(1) };
  const vigilando = { 0:true, 1:true };
  const rPert = xorshift(semilla ^ 0x9e37);

  for(let paso=0; paso<7000 && !duel.finished; paso++){
    const q = await duel.run();
    if(!q || duel.finished) break;
    let intento=0, resp=null;
    while(intento<8 && !resp){
      resp = trivial(q);
      if(!resp){
        const yo = q.player, tirada = (paso*131 + intento) >>> 0;
        azarActual = xorshift(semilla + tirada);
        const a = real[yo](q, intento);
        if(vigilando[yo]){
          const cambio = perturbar(duel, yo, rPert, reveladas(q, duel, yo));
          const { copia, tocadas } = perturbarMensaje(q, duel, yo, cambio, rPert);
          if(tocadas) conCodigoOculto++;
          azarActual = xorshift(semilla + tirada);
          let b;
          try { b = gemelo[yo](copia, intento); }
          finally { cambio.deshacer(); }
          comparadas++;
          const iguales = JSON.stringify(a, (k,v)=>typeof v==="bigint"?String(v):v)
                       === JSON.stringify(b, (k,v)=>typeof v==="bigint"?String(v):v);
          if(!iguales){
            fugas++; vigilando[yo] = false;
            const tipo = nombreTipo(q.type);
            porTipo.set(tipo, (porTipo.get(tipo) ?? 0) + 1);
            if(DETALLE) console.log(`  FUGA partida ${i} T${duel.turnCount} ${tipo} ${nivel} ` +
              `real=${JSON.stringify(a)} gemelo=${JSON.stringify(b)} códigos ocultos en mensaje=${tocadas}`);
            if(DETALLE) for(const l of (q.selects ?? q.select_cards ?? []))
              console.log(`      c${l.controller} loc${l.location} seq${l.sequence} pos${l.position ?? duel.at(l.controller,l.location,l.sequence??0)?.position} ${names[l.code]?.name ?? l.code}`);
          }
        }
        resp = a ?? generico(q, intento);
        decisiones++;
      }
      intento++;
    }
    if(!resp) break;
    duel.respond(resp);
    if(duel.turnCount > 40) break;
  }
}

console.log(`═══ FRONTERA · ${N} partidas · niveles ${NIVELES.join("/")} ═══`);
console.log(`decisiones del cerebro: ${decisiones} · comparadas: ${comparadas}`);
console.log(`mensajes del motor que traían el código de una carta oculta: ${conCodigoOculto}`);
if(porTipo.size) console.log("fugas por tipo de pregunta:", Object.fromEntries(porTipo));
console.log(fugas ? `✗ ${fugas} decisiones cambiaron al cambiar SOLO información oculta`
                  : "✓ ninguna decisión depende de información oculta");
process.exit(fugas || process.exitCode ? 1 : 0);
