/* ════════════════════════════════════════════════════════════════
   M9 · RUNS COMPLETAS CON DUELOS DE VERDAD

   `check-run.mjs` recorre runs enteras pero decide los duelos con una
   moneda. `simular-historia.mjs` juega duelos de verdad pero entre mazos
   sueltos. Esto junta las dos cosas: una run del Reino de punta a punta
   en la que CADA duelo lo juega ocgcore, y en la que el mazo del jugador
   va mejorando con lo que gana, como lo haría alguien que sabe montar un
   mazo.

   EL JUGADOR SIMULADO
   - Juega sus duelos con la IA en experto. Un humano que sabe jugar lo
     hará mejor, así que los porcentajes son un SUELO.
   - Elige camino con un criterio sencillo y razonable: sobres y Elites
     le tiran más que los eventos, y si va justo de fichas busca duelos.
   - Se queda la mejor carta de cada recompensa, abre el sobre de su
     familia, comercia en el mercader y, en el campamento, recupera una
     ficha si ha perdido alguna o si no se fortifica.
   - Después de cada carta nueva REHACE el mazo: las 40 mejores de lo que
     tiene, con 16-24 monstruos y como mucho 5 de nivel 5 o más.
     La nota de cada carta mezcla tres cosas: en cuántos de los 20 mazos
     meta del simulador sale (eso ya dice si una carta es buena en Goat),
     el ATK para su nivel y la rareza del modo historia.

   Lo que sale: dónde mueren las runs, cuánto se gana por acto y por
   rival, cuánto cambia el mazo, qué rarezas llegan en cada acto y cómo
   le va a la run contra Pegasus.

   Uso:  node simular-run.mjs [runs=40] [semilla=M9]
         GOAT_RUN_JSON=salida.json guarda el detalle de cada run.
   ════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from "node:fs";
import * as X from "./out/ocgcore.bundle.js";
import { scriptReader } from "./out/scripts.bundle.js";
import { GoatDuel } from "./src/duel.mjs";
import { makeAutoPlayer } from "./src/autopilot.mjs";
import { makeTrivialResolver } from "./src/trivial.js";
import { crearCerebro } from "./src/ai/brain.js";
import { crearCatalogo } from "./src/story/catalogo.js";
import { crearHistoria } from "./src/story/historia.js";
import { crearAlmacen } from "./src/story/estado.js";
import { meterEnMazo, sacarDelMazo } from "./src/story/coleccion.js";
import { sembrarManoDeJefe } from "./src/story/personajes.js";
import { rngDeSemilla, semillaTexto } from "./src/story/rng.js";

const D = "../data/";
const leer = f => JSON.parse(readFileSync(D+f, "utf-8"));
const cat = crearCatalogo({
  pools: leer("story/cards.json"), db: leer("pool_cards.json"),
  limites: leer("goat-limites.json"), pool: leer("goat-pool.json"),
  nombres: leer("pool_texts.json"),
});
const DECKS = leer("story/decks.json");
const DATOS = leer("story/personajes.json");
const EVENTOS = leer("story/eventos.json");
const MAZOS = leer("mazos.json");

const raw = leer("cards.json");
const names = JSON.parse(readFileSync("./out/names.subset.json","utf-8"));
const db = new Map();
for(const k in raw){ const c = raw[k]; db.set(c.code, {...c, race:BigInt(c.race)}); }
const trivial = makeTrivialResolver(X), generico = makeAutoPlayer(X);
const nombreDe = c => names[c]?.name ?? cat.nombre(c);

const N = Number(process.argv[2] ?? 40);
const SEMILLA = process.argv[3] ?? "M9";

/* ══ LA NOTA DE UNA CARTA PARA UN MAZO ══ */
const META = new Map();
const metas = MAZOS.filter(m => !m.aviso && m.main.length >= 40);
for(const m of metas) for(const c of new Set(m.main)) META.set(c, (META.get(c) ?? 0) + 1);
const enMeta = c => (META.get(c) ?? 0) / metas.length;
const TIPO_RITUAL = 0x80;
function nota(c){
  let s = 3.5 * enMeta(c) + 0.25 * cat.valor(c);
  if(cat.esMonstruo(c)){
    const d = cat.datos(c) ?? {};
    const lvl = cat.nivel(c), a = Number(d.attack ?? 0);
    const cuerpo = lvl <= 4 ? a/1000 : lvl <= 6 ? a/1000 - 1.2 : a/1000 - 2.2;
    s += 0.8 * cuerpo;
    if(Number(d.type ?? 0) & TIPO_RITUAL) s -= 1;
  } else s += 0.6;
  return s;
}
const alto = c => cat.esMonstruo(c) && cat.nivel(c) >= 5;

/* Las 40 mejores de lo que tengo, con forma de mazo. */
function rehacerMazo(run){
  const tengo = [...run.mazo.main, ...run.binder];
  const ord = [...tengo].sort((a,b) => nota(b) - nota(a));
  const elegido = [], cuenta = new Map();
  let monstruos = 0, altos = 0;
  const cabe = c => (cuenta.get(c) ?? 0) < cat.tope(c);
  const meter = c => { elegido.push(c); cuenta.set(c, (cuenta.get(c) ?? 0)+1);
                       if(cat.esMonstruo(c)) monstruos++; if(alto(c)) altos++; };
  const usados = new Array(ord.length).fill(false);
  // primero 16 monstruos
  ord.forEach((c,i) => { if(monstruos < 16 && cat.esMonstruo(c) && cabe(c) && !(alto(c) && altos >= 5)){ meter(c); usados[i]=true; } });
  ord.forEach((c,i) => {
    if(usados[i] || elegido.length >= 40 || !cabe(c)) return;
    if(cat.esMonstruo(c) && (monstruos >= 24 || (alto(c) && altos >= 5))) return;
    meter(c); usados[i] = true;
  });
  // si aun así no llega a 40 (no debería), relleno con lo que quede
  ord.forEach((c,i) => { if(!usados[i] && elegido.length < 40 && cabe(c)){ meter(c); usados[i]=true; } });

  // aplicar la diferencia con las funciones del juego
  const quiero = new Map(); for(const c of elegido) quiero.set(c, (quiero.get(c) ?? 0)+1);
  const tengoEn = new Map(); for(const c of run.mazo.main) tengoEn.set(c, (tengoEn.get(c) ?? 0)+1);
  for(const [c, n] of tengoEn) for(let k=(quiero.get(c) ?? 0); k<n; k++) sacarDelMazo(run, c, cat);
  for(const [c, n] of quiero) for(let k=(tengoEn.get(c) ?? 0); k<n; k++) meterEnMazo(run, c, cat);
  for(const c of [...run.binderExtra]) if(run.mazo.extra.length < 15) meterEnMazo(run, c, cat);
}
const fuerzaMazo = run => run.mazo.main.reduce((s,c)=>s+nota(c),0) / Math.max(1, run.mazo.main.length);

/* ══ UN DUELO DE VERDAD ══ */
const xr = s => { let x=s>>>0||1; return ()=>{ x^=x<<13; x^=x>>>17; x^=x<<5; return ((x>>>0)%100000)/100000; }; };
const barajar = (a,r)=>{ const b=[...a]; for(let i=b.length-1;i>0;i--){ const j=(r()*(i+1))|0; [b[i],b[j]]=[b[j],b[i]]; } return b; };
async function duelo(carga, semilla){
  const lib = await X.default({ sync:true });
  const duel = new GoatDuel({ lib, X, cardDb:db, scriptReader, onEvent:()=>{} });
  const r = xr(semilla);
  const ME = r() < 0.5 ? 0 : 1;           // quién empieza no lo decide el script
  const mio = barajar(carga.mazoMio.deck, r);
  let suyo = barajar(carga.mazoRival.main, r);
  if(carga.manoRival) suyo = sembrarManoDeJefe(suyo, carga.manoRival, rngDeSemilla("J"+semilla), nombreDe);
  const lpMio = carga.lpIniciales ?? 8000, lpSuyo = carga.lpRival ?? 8000;
  const manoSuya = carga.manoRivalCuantas ?? 5;
  await duel.create({
    deck0: ME===0 ? mio : suyo, deck1: ME===0 ? suyo : mio,
    extra0: ME===0 ? carga.mazoMio.extra : (carga.mazoRival.extra ?? []),
    extra1: ME===0 ? (carga.mazoRival.extra ?? []) : carga.mazoMio.extra,
    seed:[BigInt(semilla),7n,13n,29n],
    lp0: ME===0 ? lpMio : lpSuyo, lp1: ME===0 ? lpSuyo : lpMio,
    mano0: ME===0 ? 5 : manoSuya, mano1: ME===0 ? manoSuya : 5 });
  const cerebros = { 0:crearCerebro({X,duel,db,names,nivel:"experto",yo:0}),
                     1:crearCerebro({X,duel,db,names,nivel:"experto",yo:1}) };
  let ganador = null;
  const orig = duel.emit.bind(duel);
  duel.emit = (t,d) => { if(t==="win") ganador = d.player; orig(t,d); };
  for(let paso=0; paso<9000 && !duel.finished; paso++){
    const q = await duel.run();
    if(!q || duel.finished) break;
    let intento=0, resp=null;
    while(intento<8 && !resp){ resp = trivial(q) ?? cerebros[q.player]?.(q,intento) ?? generico(q,intento); intento++; }
    if(!resp) break;
    duel.respond(resp);
    if(duel.turnCount > 60) break;
  }
  /* Un duelo que llega al tope de turnos cuenta como perdido: en el
     juego, el humano tendría que rendirse o seguir, y ninguna de las dos
     da la ficha. */
  return { gana: ganador === ME, turnos: duel.turnCount, atascado: ganador == null };
}

/* ══ EL JUGADOR ══ */
function almacen(){ const m = new Map();
  return crearAlmacen({ getItem:k=>m.get(k)??null, setItem:(k,v)=>m.set(k,v), removeItem:k=>m.delete(k) }); }

const PESO = { PACK:3, ELITE:2.2, DUELO:2, JEFE:5, MERCADER:1.4, CAMPAMENTO:1.2, EVENTO:1 };
function elegirNodo(ops, est, r){
  const faltan = Math.max(0, 10 - est.chips);
  const peso = o => {
    let p = PESO[o.tipo] ?? 1;
    if(o.revancha) p += 10;
    if(faltan >= 4 && (o.tipo==="DUELO" || o.tipo==="ELITE")) p += 1.5;
    if(est.chips <= 1 && o.tipo==="ELITE") p -= 1;
    return Math.max(0.1, p);
  };
  const total = ops.reduce((s,o)=>s+peso(o),0);
  let x = r()*total;
  for(const o of ops){ x -= peso(o); if(x <= 0) return o; }
  return ops[ops.length-1];
}
function familiaPara(run){
  let mejor = "FORBID", max = -1;
  for(const [id, lista] of Object.entries(cat.familias)){
    const set = new Set(lista);
    const n = run.mazo.main.filter(c=>set.has(c)).length;
    if(n > max){ max = n; mejor = id; }
  }
  return mejor;
}
function notaEvento(op){
  const ef = op.efecto ?? {};
  let s = 0;
  if(typeof ef.chips === "number") s += ef.chips * 3;
  if(ef.apuesta) s += -0.5;
  if(ef.cartas) s += ({ C:0.3, R:1, SR:2, UR:3 }[ef.cartas.rareza ?? "R"] ?? 1) * (ef.cartas.n ?? 1);
  if(ef.morralla) s += 0.5;
  if(ef.mejorarProxima) s += 1;
  return s;
}

async function jugarRun(semilla, quien, starter){
  const H = crearHistoria({ datos:DATOS, decks:DECKS, eventos:EVENTOS, cat, almacen:almacen(), mazosDelSimulador:MAZOS });
  H.empezar({ semilla, personaje:quien, starter });
  const r = rngDeSemilla("P-"+semilla);
  const starterSet = new Set(H.run.mazo.main);
  const t = { semilla, quien, starter, duelos:[], cartas:[], packs:0, fuerza:[fuerzaMazo(H.run)],
              chipsPorActo:[], muerte:null,
              mazos:{ 0:{ main:[...H.run.mazo.main], extra:[...H.run.mazo.extra] } } };
  let actoVisto = 0, n = 0;
  for(let paso=0; paso<90; paso++){
    const est = H.estado();
    if(est.terminada) break;
    if(est.acto !== actoVisto){ t.chipsPorActo[actoVisto] = est.chips; t.fuerza[est.acto] = fuerzaMazo(H.run); actoVisto = est.acto;
      t.mazos[est.acto] = { main:[...H.run.mazo.main], extra:[...H.run.mazo.extra] }; }
    const ops = H.opciones();
    if(!ops.length) break;
    const nodo = elegirNodo(ops, est, r);
    let carga = H.entrar(nodo.id);
    if(carga.tipo === "PREPARACION"){
      const cual = H.run.chipsPerdidos > 0 ? "CAMPAMENTO" : "PACK";
      carga = H.elegirPreparacion(cual);
    }
    const acto = nodo.acto ?? H.estado().acto;
    if(acto === 0 && (nodo.col ?? 0) >= 4 && !t.mazoMitad) t.mazoMitad = { main:[...H.run.mazo.main], extra:[...H.run.mazo.extra] };
    switch(carga.tipo){
      case "DUELO": case "ELITE": case "JEFE": {
        const d = process.env.GOAT_GANA_SIEMPRE ? { gana:true, turnos:0, atascado:false }
                : await duelo(carga, (n++)*7919 + 17 + hash(semilla));
        const res = H.resolverDuelo({ ganado:d.gana, rivalId:carga.rival.id, elite:carga.tipo==="ELITE" });
        t.duelos.push({ acto, tipo:carga.tipo, torre:nodo.torre ?? null, rival:carga.rival.id,
                        tier:carga.rival.tier, gana:d.gana, turnos:d.turnos, atascado:d.atascado,
                        fuerza:+fuerzaMazo(H.run).toFixed(2), chips:H.estado().chips });
        if(res.premio?.length){
          const mejor = [...res.premio].sort((a,b)=>nota(b.code)-nota(a.code))[0];
          H.cogerPremio(mejor.code);
          t.cartas.push({ acto, de:"premio", code:mejor.code, rareza:cat.rareza(mejor.code) });
        }
        if(H.estado().terminada && !H.estado().ganada)
          t.muerte = { acto, tipo:carga.tipo, rival:carga.rival.id, torre:nodo.torre ?? null };
        break;
      }
      case "PACK": {
        const cartas = H.abrirPack(familiaPara(H.run));
        t.packs++;
        for(const c of cartas) t.cartas.push({ acto, de:"pack", code:c.code, rareza:cat.rareza(c.code) });
        break;
      }
      case "MERCADER": {
        const orden = ["prestigio","premium","enfocado","morralla","cambio"];
        const puede = (carga.recetas ?? []).filter(x=>x.puede).sort((a,b)=>orden.indexOf(a.id)-orden.indexOf(b.id));
        let hecho = false;
        for(const rec of puede){
          const oferta = H.ofertaDe(rec.id).map(x => x?.code ?? x);
          if(!oferta.length) continue;
          const mejor = oferta.sort((a,b)=>nota(b)-nota(a))[0];
          if(H.comerciar(rec.id, mejor)?.ok !== false){ hecho = true;
            t.cartas.push({ acto, de:"mercader", code:mejor, rareza:cat.rareza(mejor) }); break; }
        }
        if(!hecho) H.saltarNodo();
        break;
      }
      case "CAMPAMENTO": {
        const op = H.run.chipsPerdidos > 0 ? "ficha" : "fortificar";
        if(!H.acampar(op)?.ok) H.saltarNodo();
        break;
      }
      case "EVENTO": {
        const ops2 = carga.evento.opciones;
        const op = [...ops2].sort((a,b)=>notaEvento(b)-notaEvento(a))[0];
        H.elegirEnEvento(op);
        break;
      }
    }
    if(!process.env.GOAT_SIN_MAZO) rehacerMazo(H.run);
  }
  const est = H.estado();
  t.ganada = est.ganada; t.chips = est.chips; t.terminada = est.terminada;
  t.cambiadas = H.run.mazo.main.filter(c=>!starterSet.has(c)).length;
  t.mazoFinal = H.run.mazo.main;
  t.fuerza[3] = fuerzaMazo(H.run);
  return t;
}
function hash(s){ let h=2166136261; for(const ch of String(s)){ h^=ch.charCodeAt(0); h=Math.imul(h,16777619); } return (h>>>0)%100000; }

/* ══ LAS RUNS ══ */
const r0 = rngDeSemilla(SEMILLA);
const JUGABLES = (DATOS.jugables ?? []).filter(j => j.id !== "custom");
const runs = [];
const t0 = Date.now();
for(let i=0;i<N;i++){
  const j = JUGABLES[i % JUGABLES.length];
  const st = j.starters[Math.floor(i / JUGABLES.length) % j.starters.length];
  const t = await jugarRun(semillaTexto(r0), j.id, st);
  runs.push(t);
  process.stderr.write(`  run ${i+1}/${N} ${j.id}/${st}: ${t.ganada?"GANADA":t.muerte?`muere en acto ${t.muerte.acto+1} (${t.muerte.torre ?? t.muerte.rival})`:"sin acabar"} · ${t.duelos.length} duelos · ${((Date.now()-t0)/1000).toFixed(0)}s\n`);
}
if(process.env.GOAT_RUN_JSON) writeFileSync(process.env.GOAT_RUN_JSON, JSON.stringify(runs));

/* ══ EL INFORME ══ */
const pct = (a,b) => b ? Math.round(a*100/b) + "%" : "—";
const media = a => a.length ? (a.reduce((s,x)=>s+x,0)/a.length) : 0;
console.log(`\n═══ M9 · ${N} runs completas con duelos reales (experto contra experto) ═══\n`);
const ganadas = runs.filter(t=>t.ganada).length;
const muertas = runs.filter(t=>t.muerte).length;
console.log(`desenlace: ${pct(ganadas,N)} ganadas · ${pct(muertas,N)} sin fichas · ${pct(N-ganadas-muertas,N)} sin acabar`);
console.log(`duelos por run: ${media(runs.map(t=>t.duelos.length)).toFixed(1)} · sobres: ${media(runs.map(t=>t.packs)).toFixed(1)} · cartas del starter cambiadas al final: ${media(runs.map(t=>t.cambiadas)).toFixed(1)} de 40`);

console.log(`\n── dónde se acaban las runs perdidas ──`);
const donde = new Map();
for(const t of runs.filter(t=>t.muerte)){
  const k = t.muerte.torre ? `castillo · ${t.muerte.torre}` : `acto ${t.muerte.acto+1} · ${t.muerte.tipo} · ${t.muerte.rival}`;
  donde.set(k, (donde.get(k) ?? 0) + 1);
}
[...donde].sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(`  ${String(v).padStart(3)}  ${k}`));

console.log(`\n── por acto ──`);
for(const a of [0,1,2]){
  const ds = runs.flatMap(t=>t.duelos.filter(d=>d.acto===a));
  const llegan = runs.filter(t=>t.duelos.some(d=>d.acto===a)).length;
  const cartas = runs.flatMap(t=>t.cartas.filter(c=>c.acto===a));
  const rz = r => pct(cartas.filter(c=>c.rareza===r).length, cartas.length);
  console.log(`  acto ${a+1}: llegan ${pct(llegan,N)} · duelos ${ds.length} · gana ${pct(ds.filter(d=>d.gana).length, ds.length)}`+
              ` · fuerza del mazo ${media(runs.filter(t=>t.fuerza[a]!=null).map(t=>t.fuerza[a])).toFixed(2)}`+
              ` · cartas ${cartas.length} (C ${rz("C")} R ${rz("R")} SR ${rz("SR")} UR ${rz("UR")})`);
  for(const tipo of ["DUELO","ELITE","JEFE"]){
    const x = ds.filter(d=>d.tipo===tipo); if(!x.length) continue;
    console.log(`      ${tipo.padEnd(6)} ${String(x.length).padStart(4)} · gana ${pct(x.filter(d=>d.gana).length, x.length)}`+
                `${x.some(d=>d.atascado)?` · ${x.filter(d=>d.atascado).length} al tope de turnos`:""}`);
  }
}

console.log(`\n── por rival (isla) ──`);
const porRival = new Map();
for(const d of runs.flatMap(t=>t.duelos).filter(d=>!d.torre)){
  const k = `${d.rival} T${d.tier}`; const v = porRival.get(k) ?? [0,0]; v[0]++; if(d.gana) v[1]++; porRival.set(k, v);
}
[...porRival].sort((a,b)=>a[0].localeCompare(b[0])).forEach(([k,[n,g]])=>console.log(`  ${k.padEnd(18)} ${String(n).padStart(3)} · gana ${pct(g,n)}`));

console.log(`\n── la torre ──`);
const porPeldaño = new Map();
for(const d of runs.flatMap(t=>t.duelos).filter(d=>d.torre)){
  const v = porPeldaño.get(d.torre) ?? [0,0]; v[0]++; if(d.gana) v[1]++; porPeldaño.set(d.torre, v);
}
for(const [k,[n,g]] of porPeldaño) console.log(`  ${k.padEnd(10)} ${String(n).padStart(3)} intentos · gana ${pct(g,n)}`);
console.log(`\n(${((Date.now()-t0)/1000).toFixed(0)} s)`);
