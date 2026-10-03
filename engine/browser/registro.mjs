/* ════════════════════════════════════════════════════════════════
   REGISTRO ESTRUCTURADO DE PARTIDAS — dos productos que NO se mezclan

   1. REPLAY (`*.replay.json`): lo necesario para rehacer la partida EN EL
      MOTOR: versión de reglas, semilla del motor, mazos en el orden en que
      entraron y TODAS las respuestas en orden. Contiene información oculta
      (manos, orden de mazos): es para reproducir, nunca para el agente.

   2. DECISIONES (`*.decisiones.jsonl`): una línea por decisión que tomó el
      cerebro, con SOLO lo que ese jugador podía saber: la vista legal
      (`vistaDe`), las acciones legales tal como las ve (`mensajeLegal`), la
      respuesta y la semilla del azar que usó. Es la materia prima de un
      banco de posiciones o de un entrenamiento.

   El `ruleset` identifica motor, scripts, base de cartas y pool por hash:
   dos registros con distinto ruleset no son comparables sin más.

   Uso como herramienta:
     node registro.mjs [semilla=1234] [nivel0=experto] [nivel1=experto] [carpeta=/tmp]
   ════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import * as X from "./out/ocgcore.bundle.js";
import { scriptReader } from "./out/scripts.bundle.js";
import { GoatDuel } from "./src/duel.mjs";
import { makeAutoPlayer } from "./src/autopilot.mjs";
import { makeTrivialResolver } from "./src/trivial.js";
import { crearCerebro } from "./src/ai/brain.js";
import { vistaDe, mensajeLegal } from "./src/ai/view.js";

export const ESQUEMA_REPLAY = "goat-replay/1";
export const ESQUEMA_DECISION = "goat-decision/1";

const aqui = new URL(".", import.meta.url);
const leer = p => readFileSync(new URL(p, aqui));
const sha = buf => createHash("sha256").update(buf).digest("hex").slice(0, 16);

export const RULESET = {
  modo: "MODE_GOAT",
  motor:   sha(leer("./out/ocgcore.bundle.js")),
  scripts: sha(leer("./out/scripts.bundle.js")),
  cartas:  sha(leer("./out/cards.subset.json")),
  pool:    sha(leer("../data/goat-pool.json")),
};
RULESET.id = sha(Buffer.from(JSON.stringify(RULESET)));

const raw   = JSON.parse(leer("./out/cards.subset.json"));
export const names = JSON.parse(leer("./out/names.subset.json"));
export const db = new Map();
for(const k in raw){ const c=raw[k]; db.set(c.code,{...c, race:BigInt(c.race)}); }
export const MAZOS = JSON.parse(leer("../data/mazos.json"))
  .filter(m=>!m.aviso && m.main.length>=40)
  .map(m=>({ nombre:m.nombre ?? m.name, main:m.main, extra:m.extra ?? [] }));

export const xorshift = s => { let x=(s>>>0)||1; return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return((x>>>0)%100000)/100000;}; };
export const barajar=(a,r)=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=(r()*(i+1))|0;[b[i],b[j]]=[b[j],b[i]];}return b;};

/* JSON sin sustos: BigInt → texto, Map → objeto. */
export const aJSON = (v, quitar = []) => JSON.stringify(v, (k, x) =>
  quitar.includes(k) ? undefined :
  typeof x === "bigint" ? { $big: String(x) }
  : x instanceof Map ? Object.fromEntries(x)
  : x instanceof Set ? [...x] : x);
export const deJSON = s => JSON.parse(s, (k, x) =>
  x && typeof x === "object" && "$big" in x && Object.keys(x).length === 1 ? BigInt(x.$big) : x);

/* Crea un duelo desde la cabecera de un replay. */
export async function duelDesde(cab, onEvent = ()=>{}){
  const lib = await X.default({ sync:true });
  const duel = new GoatDuel({ lib, X, cardDb:db, scriptReader, onEvent });
  await duel.create({ deck0:cab.mazos[0].main, deck1:cab.mazos[1].main,
    extra0:cab.mazos[0].extra, extra1:cab.mazos[1].extra,
    seed: cab.semilla_motor.map(BigInt) });
  return duel;
}

/* Juega una partida bot contra bot y la registra. */
export async function jugarYRegistrar({ semilla=1234, niveles=["experto","experto"],
    mazos=null, topeTurnos=60, conDecisiones=true, huella=false } = {}){
  const r = xorshift(semilla);
  const [a, b] = mazos ?? [MAZOS[semilla % MAZOS.length], MAZOS[(semilla*7+3) % MAZOS.length]];
  const cab = {
    esquema: ESQUEMA_REPLAY, ruleset: RULESET, creado: new Date().toISOString(),
    semilla_motor: [String(semilla), "7", "13", "29"],
    niveles,
    mazos: [ { nombre:a.nombre, main:barajar(a.main, r), extra:a.extra },
             { nombre:b.nombre, main:barajar(b.main, r), extra:b.extra } ],
  };
  const hash = createHash("sha256");
  const duel = await duelDesde(cab, huella ? (e => hash.update(aJSON(e))) : undefined);
  let azar = xorshift(1);
  const cerebros = [0,1].map(yo => crearCerebro({ X, duel, db, names, nivel:niveles[yo], yo, rng:()=>azar() }));
  const trivial = makeTrivialResolver(X), generico = makeAutoPlayer(X);
  const respuestas = [], decisiones = [];
  let ganador = null;
  const emitir = duel.emit.bind(duel);
  duel.emit = (t, d) => { if(t==="win") ganador = d.player; emitir(t, d); };
  for(let paso=0; paso<9000 && !duel.finished; paso++){
    const q = await duel.run();
    if(!q || duel.finished) break;
    let intento=0, resp=null, fuente=null, semillaAzar=null;
    while(intento<8 && !resp){
      resp = trivial(q); fuente = "trivial";
      if(!resp){
        semillaAzar = (semilla*1000003 + paso*131 + intento) >>> 0;
        azar = xorshift(semillaAzar);
        resp = cerebros[q.player](q, intento); fuente = "cerebro";
      }
      if(!resp){ resp = generico(q, intento); fuente = "generico"; }
      intento++;
    }
    if(!resp) break;
    respuestas.push(resp);
    if(conDecisiones && fuente !== "trivial"){
      const yo = q.player;
      decisiones.push({
        esquema: ESQUEMA_DECISION, ruleset: RULESET.id, n: respuestas.length - 1,
        turno: duel.turnCount, fase: duel.phase, jugador: yo, nivel: niveles[yo],
        tipo: q.type, fuente, intento: intento - 1, semilla_azar: semillaAzar,
        /* `datos` es la ficha de la base de cartas: se deduce del código y
           del ruleset, así que no se guarda (pesaba 6 MB por partida). */
        observacion: JSON.parse(aJSON(vistaDe(duel, yo, db, names), ["datos"])),
        acciones_legales: mensajeLegal(q, duel, yo),
        respuesta: resp,
      });
    }
    duel.respond(resp);
    if(duel.turnCount > topeTurnos) break;
  }
  const replay = { ...cab, respuestas,
    resultado: { ganador, turnos: duel.turnCount, lp:[duel.lp[0], duel.lp[1]],
                 terminada: duel.finished, desincronizaciones: duel.desyncs },
    huella: huella ? hash.digest("hex") : null };
  return { replay, decisiones, duel };
}

/* Rehace una partida en el motor dando las respuestas grabadas. Con
   `hasta` se para antes de la respuesta número `hasta` y devuelve el
   duelo vivo en ese punto: es la forma de RAMIFICAR, porque ocgcore no
   se puede clonar. */
export async function rehacer(replay, { hasta = Infinity, huella = false } = {}){
  const hash = createHash("sha256");
  let ganador = null;
  const duel = await duelDesde(replay, huella ? (e => hash.update(aJSON(e))) : undefined);
  const emitir = duel.emit.bind(duel);
  duel.emit = (t, d) => { if(t==="win") ganador = d.player; emitir(t, d); };
  let i = 0, pregunta = null;
  while(!duel.finished){
    pregunta = await duel.run();
    if(!pregunta || duel.finished) break;
    if(i >= Math.min(hasta, replay.respuestas.length)) break;
    duel.respond(replay.respuestas[i++]);
  }
  return { duel, pregunta, aplicadas: i, ganador,
           huella: huella ? hash.digest("hex") : null,
           resultado: { ganador, turnos: duel.turnCount, lp:[duel.lp[0], duel.lp[1]] } };
}

if(process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]){
  const semilla = Number(process.argv[2] ?? 1234);
  const niveles = [process.argv[3] ?? "experto", process.argv[4] ?? "experto"];
  const carpeta = process.argv[5] ?? "/tmp";
  const { replay, decisiones } = await jugarYRegistrar({ semilla, niveles });
  const base = `${carpeta}/goat-${semilla}`;
  writeFileSync(`${base}.replay.json`, aJSON(replay));
  writeFileSync(`${base}.decisiones.jsonl`, decisiones.map(d => aJSON(d)).join("\n") + "\n");
  console.log(`ruleset ${RULESET.id} · ${replay.respuestas.length} respuestas · ${decisiones.length} decisiones del cerebro`);
  console.log(`→ ${base}.replay.json\n→ ${base}.decisiones.jsonl`);
}
