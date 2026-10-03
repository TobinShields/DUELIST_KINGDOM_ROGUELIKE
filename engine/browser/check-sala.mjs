/* ══════════════════════════════════════════════════════════════════
   SALAS: EL ANFITRIÓN JUEGA CON EL MOTOR, EL INVITADO CON UN ESPEJO

   Duelos completos en node, sin red ni navegador. El jugador 0 es el
   anfitrión (motor de verdad) y el 1 el invitado: no tiene motor, solo
   el `DueloEspejo` de src/sala.js, alimentado con lo que el anfitrión le
   mandaría por la red (pasado por JSON, como viaja de verdad). Los dos
   lados los juega la IA en experto.

   Se comprueba:
     1. Que el invitado NO recibe nada oculto: ni una carta de la mano,
        del mazo, del Extra o boca abajo del anfitrión llega con su código
        (salvo mientras un efecto la revela), ni en la foto del estado, ni
        en los eventos, ni en las preguntas.
     2. Que su espejo es el tablero del motor: mismas cartas en los mismos
        sitios, mismos LP, turno y fase.
     3. Que el duelo por la red acaba IGUAL que el mismo duelo sin red
        (misma semilla): el invitado decide con la información que tendría
        sentado a la mesa, ni más ni menos.

   Uso: node check-sala.mjs [duelos=6]
   ══════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";
import * as X from "./out/ocgcore.bundle.js";
import { scriptReader } from "./out/scripts.bundle.js";
import { GoatDuel } from "./src/duel.mjs";
import { makeAutoPlayer } from "./src/autopilot.mjs";
import { makeTrivialResolver } from "./src/trivial.js";
import { crearCerebro } from "./src/ai/brain.js";
import * as S from "./src/sala.js";

const N = Number(process.argv[2] ?? 6);
let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t, d = "") => { fallos++; console.log("  ✗ " + t + (d ? "   " + d : "")); };
const es = (c, t, d) => c ? ok(t) : mal(t, d);
console.log("\n═══ SALAS · anfitrión con motor, invitado con espejo ═══\n");

const raw = JSON.parse(readFileSync("./out/cards.subset.json","utf-8"));
const names = JSON.parse(readFileSync("./out/names.subset.json","utf-8"));
const db = new Map(); for(const k in raw){ const c = raw[k]; db.set(c.code, { ...c, race:BigInt(c.race) }); }
const trivial = makeTrivialResolver(X), generico = makeAutoPlayer(X);
const MAZOS = JSON.parse(readFileSync("../data/mazos.json","utf-8")).filter(m => !m.aviso && m.main.length >= 40);
const rng = s => { let x = s>>>0 || 1; return () => { x^=x<<13; x^=x>>>17; x^=x<<5; return ((x>>>0)%100000)/100000; }; };
const barajar = (a,r) => { const b=[...a]; for(let i=b.length-1;i>0;i--){ const j=(r()*(i+1))|0; [b[i],b[j]]=[b[j],b[i]]; } return b; };
const porRed = m => S.decodificar(S.codificar(m));          // como viaja de verdad

/* ── la codificación aguanta BigInt ── */
{
  const m = { a: 5n, b: [1n << 40n, { c: "x" }], d: null };
  const v = porRed(m);
  es(v.a === 5n && v.b[0] === (1n << 40n) && v.b[1].c === "x" && v.d === null, "el JSON de la sala lleva BigInt de ida y vuelta");
}

/* ── el mazo del invitado se valida ── */
{
  const info = { legal: c => c > 0 && c < 1e9, limite: c => c === 7 ? 1 : 3, nombre: c => "C" + c };
  const main = Array.from({ length: 40 }, (_, i) => 100 + (i % 14));
  es(S.validarMazo({ main, extra: [] }, info).ok, "un mazo de 40 legal vale");
  es(!S.validarMazo({ main: main.slice(0, 39), extra: [] }, info).ok, "uno de 39 no");
  es(!S.validarMazo({ main: [...main.slice(0, 39), 7, 7].slice(0, 41), extra: [] }, info).ok
     || !S.validarMazo({ main: [...main, 7, 7], extra: [] }, info).ok, "dos copias de una limitada no");
  es(!S.validarMazo({ main: [...main.slice(0, 39), -5], extra: [] }, info).ok, "una carta ilegal no");
  es(!S.validarMazo({ main: [...main, 100, 100, 100], extra: [] }, info).ok, "cuatro copias no");
  /* El side deck del Bo3 cuenta: hasta 15 y con las copias juntas. */
  es(S.validarMazo({ main, extra: [], side: [113, 200, 201] }, info).ok, "con un side de 3 legal vale");
  es(!S.validarMazo({ main, extra: [], side: [100] }, info).ok, "una cuarta copia en el side no");
  es(!S.validarMazo({ main, extra: [], side: Array.from({ length: 16 }, (_, i) => 300 + i) }, info).ok, "un side de 16 no");
}

/* ── el reloj: una pregunta caducada se cierra en el espejo del invitado ── */
{
  let cerrada = 0;
  const e = new S.DueloEspejo({ yo: 1, enviar: () => {} });
  e.alCaducar = () => cerrada++;
  e.recibir({ t: "pregunta", id: 1, q: { type: 1, player: 1 } });
  const q = await e.run();
  es(q && e._idPregunta === 1, "el invitado tiene la pregunta 1 en pantalla");
  e.recibir({ t: "caducada", id: 1 });
  es(cerrada === 1 && e.pending === null && e._idPregunta === null, "«caducada» la cierra y avisa a la pantalla");
  e.recibir({ t: "caducada", id: 2 });
  e.recibir({ t: "pregunta", id: 2, q: { type: 1, player: 1 } });
  e.recibir({ t: "lote", eventos: [], estado: null });
  const q2 = await e.run();
  es(q2 === null && cerrada === 1, "y una que caducó antes de verse se salta sin abrirla");
  let enviado = null;
  const e2 = new S.DueloEspejo({ yo: 1, enviar: m => { enviado = m; } });
  e2.recibir({ t: "pregunta", id: 5, q: { type: 1, player: 1 } }); await e2.run();
  e2.porTiempo = true; e2.respond({ type: 1 });
  es(enviado?.porTiempo === true && enviado.id === 5, "la respuesta que da el reloj va marcada para que el anfitrión la cuente");
}

async function duelo(A, B, semilla, { porLaRed }){
  const lib = await X.default({ sync:true });
  const eventos = [];
  const duel = new GoatDuel({ lib, X, cardDb:db, scriptReader, onEvent: e => eventos.push(e) });
  const r = rng(semilla);
  const d0 = barajar(A.main, r), d1 = barajar(B.main, r);
  await duel.create({ deck0:d0, deck1:d1, extra0:A.extra ?? [], extra1:B.extra ?? [], seed:[BigInt(semilla),7n,13n,29n] });
  const recibidos = [];
  const espejo = porLaRed ? new S.DueloEspejo({ yo:1, onEvent: e => recibidos.push(e),
                                                enviar: m => salida.push(porRed(m)), decklist: d1 }) : null;
  const salida = [];
  /* Con azar sembrado: el bot coloca sus M/T en una zona al azar y, sin
     semilla, dos duelos idénticos se separaban por ahí. */
  const c0 = crearCerebro({ X, duel, db, names, nivel:"experto", yo:0, rng: rng(semilla * 3 + 1) });
  const c1 = crearCerebro({ X, duel: espejo ?? duel, db, names, nivel:"experto", yo:1, rng: rng(semilla * 5 + 2) });
  const reveladas = new Set();
  const fugas = [], desajustes = [];
  let ganador = null, preguntas = 0, id = 0;
  const traza = [];
  const comprobar = (revEnLote) => {
    /* 1 · nada oculto en el espejo (salvo lo que se acaba de revelar) */
    for(const c of duel.cards.values()){
      const e = espejo.cards.get(c.uid);
      if(!e) { if(c.location) desajustes.push(`falta la carta ${c.uid}`); continue; }
      if(e.code && !S.visiblePara(c, 1, reveladas) && !revEnLote.has(c.uid) && c.controller === 0)
        fugas.push(`T${duel.turnCount} ${c.code} en ${c.location}/${c.position}`);
      /* 2 · mismo sitio */
      if(e.location !== c.location || e.sequence !== c.sequence || e.controller !== c.controller || e.position !== c.position)
        desajustes.push(`uid ${c.uid}: ${[e.controller,e.location,e.sequence,e.position]} ≠ ${[c.controller,c.location,c.sequence,c.position]}`);
      if(S.visiblePara(c, 1, reveladas) && e.code !== c.code) desajustes.push(`uid ${c.uid}: código ${e.code} ≠ ${c.code}`);
    }
    if(espejo.lp[0] !== duel.lp[0] || espejo.lp[1] !== duel.lp[1] || espejo.turnCount !== duel.turnCount || espejo.phase !== duel.phase)
      desajustes.push(`LP/turno/fase ${JSON.stringify([espejo.lp, espejo.turnCount, espejo.phase])}`);
  };
  for(let paso = 0; paso < 9000 && !duel.finished; paso++){
    const q = await duel.run();
    const evs = eventos.splice(0);
    for(const e of evs) if(e.t === "win") ganador = e.player;
    if(porLaRed){
      S.seguirReveladas(reveladas, evs);
      const lote = porRed({ t:"lote", eventos:S.eventosPara(evs, duel, 1, reveladas), estado:S.estadoPara(duel, 1, reveladas) });
      /* las cartas del anfitrión que llegan con código en los eventos */
      for(const e of lote.eventos){
        const codigos = e.t === "draw" ? e.cards.map(x => [x.uid, x.code]) : e.code && e.uid ? [[e.uid, e.code]] : [];
        for(const [u, code] of codigos){
          const c = duel.cards.get(u);
          if(code && c && c.owner === 0 && e.t !== "chain" && e.t !== "summon" && e.t !== "revelar" && e.t !== "contador"){
            const desde = e.from, hasta = e.to;
            const publico = s => s && s.location !== 1 && !(s.location === 2 || s.location === 64)
                                 && !((s.location === 4 || s.location === 8) && (s.position & 0x0a));
            if(!(publico(desde) || publico(hasta) || reveladas.has(u))) fugas.push(`evento ${e.t} T${duel.turnCount}: ${code}`);
          }
        }
      }
      espejo.recibir(lote);
      const revEnLote = new Set(lote.eventos.filter(e => e.t === "revelar").flatMap(e => e.uids ?? []));
      while(espejo._entrada.length){ const v = await espejo.run(); if(v) throw new Error("pregunta inesperada"); }
      comprobar(revEnLote);
    }
    if(!q || duel.finished) break;
    let i = 0, resp = null;
    if(q.player === 1 && porLaRed){
      preguntas++;
      const qq = porRed({ t:"pregunta", id:++id, q:S.preguntaPara(q, duel, 1, reveladas) });
      /* 1b · la pregunta tampoco lleva lo oculto */
      const mirar = o => { if(!o || typeof o !== "object") return;
        if(Array.isArray(o)) return o.forEach(mirar);
        if(o.code && typeof o.location === "number" && typeof o.controller === "number"){
          const c = duel.at(o.controller, o.location, o.sequence ?? 0);
          if(c && !S.visiblePara(c, 1, reveladas) && !(o.location === 1 && o.controller === 1)) fugas.push(`pregunta T${duel.turnCount}: ${o.code}`);
        }
        for(const k in o) mirar(o[k]); };
      mirar(qq.q);
      espejo.recibir(qq);
      const qg = await espejo.run();
      while(i < 8 && !resp){ resp = trivial(qg) ?? c1(qg, i) ?? generico(qg, i); i++; }
      if(resp) espejo.respond(resp);
      const m = salida.shift();
      resp = m?.r ?? null;
    } else {
      const cer = q.player === 0 ? c0 : c1;
      while(i < 8 && !resp){ resp = trivial(q) ?? cer(q, i) ?? generico(q, i); i++; }
    }
    if(!resp) break;
    if(q.player === 1) traza.push({ t: duel.turnCount, ph: duel.phase, q: S.codificar(S.preguntaPara(q, duel, 1, reveladas)).slice(0, 400), r: S.codificar(resp) });
    duel.respond(resp);
    if(duel.turnCount > 60) break;
  }
  return { ganador, turnos: duel.turnCount, lp: [duel.lp[0], duel.lp[1]], fugas, desajustes, preguntas,
           lotes: espejo?.lotes ?? 0, traza };
}

let iguales = 0, totalFugas = 0, totalDesajustes = 0, preguntas = 0;
for(let k = 0; k < N; k++){
  const A = MAZOS[(k * 3) % MAZOS.length], B = MAZOS[(k * 7 + 5) % MAZOS.length];
  const semilla = 4242 + k * 101;
  const sin = await duelo(A, B, semilla, { porLaRed:false });
  if(process.env.DOBLE){ const sin2 = await duelo(A, B, semilla, { porLaRed:false });
    console.log("    sin red dos veces:", sin.ganador, sin.turnos, sin.lp.join(), "|", sin2.ganador, sin2.turnos, sin2.lp.join()); }
  const con = await duelo(A, B, semilla, { porLaRed:true });
  if(process.env.DIFF){ const k2 = sin.traza.findIndex((x, i) => x.r !== con.traza[i]?.r);
    if(k2 >= 0) console.log("    primera diferencia en la decisión", k2, "\n     sin:", JSON.stringify(sin.traza[k2]), "\n     con:", JSON.stringify(con.traza[k2])); }
  const igual = sin.ganador === con.ganador && sin.turnos === con.turnos && sin.lp.join() === con.lp.join();
  if(igual) iguales++;
  totalFugas += con.fugas.length; totalDesajustes += con.desajustes.length; preguntas += con.preguntas;
  console.log(`  · ${A.nombre} vs ${B.nombre}: ${igual ? "igual" : "DISTINTO"} (gana ${con.ganador}, T${con.turnos}, ${con.lotes} lotes, ${con.preguntas} preguntas al invitado)` +
              (con.fugas.length ? `  fugas: ${con.fugas.slice(0, 3).join(" | ")}` : "") +
              (con.desajustes.length ? `  desajustes: ${con.desajustes.slice(0, 3).join(" | ")}` : "") +
              (igual ? "" : `  sin red: gana ${sin.ganador} T${sin.turnos} LP ${sin.lp} · con red: LP ${con.lp}`));
}
es(totalFugas === 0, "el invitado no recibe nada oculto del anfitrión", `${totalFugas} fugas`);
es(totalDesajustes === 0, "su espejo es el tablero del motor, carta a carta", `${totalDesajustes} desajustes`);
es(iguales === N, `los ${N} duelos por la red acaban igual que sin red`, `${iguales}/${N}`);
es(preguntas > 50, "y el invitado ha contestado de verdad", `${preguntas} preguntas`);

console.log(`\n${fallos ? "FALLA: " + fallos : "Todo correcto"}`);
process.exit(fallos ? 1 : 0);
