/* ════════════════════════════════════════════════════════════════
   MONTAR UN TABLERO Y PREGUNTARLE AL CEREBRO

   El andamiaje que comparten `banco.mjs` y las comprobaciones: pone las
   cartas donde le digas y le hace al cerebro UNA pregunta concreta, sin
   jugar un duelo entero. Un duelo real tardaría cientos de partidas en
   reproducir una situación, y aun así no sabrías si la jugada salió por
   criterio o por azar.

   No usa el motor a propósito: el motor decide qué es LEGAL, y eso ya
   está comprobado en otro sitio (`check-cartas`, `check-reglas`). Aquí
   se comprueba qué ELIGE el bot entre lo legal, que es otra cosa.
   ════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";
import * as X from "./out/ocgcore.bundle.js";

const raw   = JSON.parse(readFileSync("./out/cards.subset.json","utf-8"));
export const NOMBRES = JSON.parse(readFileSync("./out/names.subset.json","utf-8"));
const POOL  = new Set(JSON.parse(readFileSync("../data/goat-pool.json","utf-8")).map(Number));
export const DB = new Map();
for(const k in raw){ const c=raw[k]; DB.set(c.code, {...c, race:BigInt(c.race)}); }

/* Muchas cartas existen dos veces en la base (normal y "(GOAT)") y solo
   la del pool lleva script. Coger la otra da una carta muda y la prueba
   miente sin avisar. */
const base = n => String(n).replace(/\s*\((GOAT|Pre-Errata|Anime|Action Field)\)\s*$/i,"").trim();
const PORNOMBRE = new Map();
for(const code in NOMBRES){
  const n = NOMBRES[code]?.name; if(!n) continue;
  for(const clave of new Set([n, base(n)])){
    const previo = PORNOMBRE.get(clave);
    if(previo===undefined || (!POOL.has(previo) && POOL.has(+code))) PORNOMBRE.set(clave, +code);
  }
}
export const cod = n => {
  const c = PORNOMBRE.get(n) ?? PORNOMBRE.get(base(n));
  if(!c) throw new Error(`no existe la carta "${n}"`);
  return c;
};
export const nombreDe = c => NOMBRES[c]?.name ?? ("#"+c);

export const L = { DECK:1, HAND:2, MZONE:4, SZONE:8, GRAVE:16, REMOVED:32, EXTRA:64 };
export const P = { ATK:1, DEF:4, TAPADA:8 };
export const MT = X.OcgMessageType, R = X.OcgResponseType;
export const IA = X.SelectIdleCMDAction, BA = X.SelectBattleCMDAction;
export { X };

let uid = 0;
/* Cada entrada puede ser "Nombre" o {carta, pos, atkReal, defReal}. */
/* `owner` como en el espejo real: por defecto, quien la controla. Con
   {dueño:1} en el lado propio se monta un monstruo robado. */
function ponerCarta(nombre, controller, location, sequence, position, extra){
  return { uid:++uid, code:cod(nombre), controller, owner:controller, location, sequence, position, ...extra };
}

/* mesa({ mios:{campo, mt, mano, gy, extra, mazo}, suyos:{…}, lp, turno… }) */
export function mesa({ mios={}, suyos={}, lp=[8000,8000], turno=5,
                       turnPlayer=0, fase=0x4, mazoMio=null } = {}){
  const lado = () => ({ [L.DECK]:[], [L.HAND]:[], [L.GRAVE]:[], [L.REMOVED]:[],
    [L.EXTRA]:[], [L.MZONE]:new Array(5).fill(null), [L.SZONE]:new Array(6).fill(null) });
  const zones = { 0:lado(), 1:lado() };
  const cards = new Map();
  const meter = (p, spec) => {
    for(const [clave, loc] of [["campo",L.MZONE],["mt",L.SZONE],["mano",L.HAND],
                               ["gy",L.GRAVE],["extra",L.EXTRA]]){
      (spec[clave] ?? []).forEach((e,i)=>{
        const o = typeof e==="string" ? {carta:e} : e;
        const extra = o.atkReal!=null ? {atkReal:o.atkReal, defReal:o.defReal ?? 0} : {};
        if(o.dueño!=null) extra.owner = o.dueño;
        /* {puesta:N}: turno en que se colocó una M/T (duel.puestaTurno) */
        if(o.puesta!=null) extra.puestaTurno = o.puesta;
        const c = ponerCarta(o.carta, p, loc, i,
                             o.pos ?? (loc===L.MZONE ? P.ATK : P.TAPADA), extra);
        if(loc===L.MZONE || loc===L.SZONE) zones[p][loc][i] = c;
        else zones[p][loc].push(c);
        cards.set(c.uid, c);
      });
    }
  };
  meter(0, mios); meter(1, suyos);
  return {
    zones, cards, lp:{0:lp[0],1:lp[1]}, turnPlayer, turnCount:turno, phase:fase,
    cadena:[], atacante:null, finished:false,
    decklist: { 0: (mazoMio ?? []).map(cod), 1: [] },
    at:(c,l,s)=>zones[c]?.[l]?.[s] ?? null,
    resolve:(l)=>zones[l.controller]?.[l.location]?.[l.sequence] ?? null,
  };
}

/* Referencia a una carta tal y como la manda el motor en una lista. */
export const ref = c => ({ code:c.code, controller:c.controller,
  location:c.location, sequence:c.sequence, position:c.position });

/* Atajos para las preguntas más habituales. */
export const preguntaIdle = ({ activa=[], invoca=[], coloca=[], colocaMT=[],
                               giros=[], especial=[], bp=true } = {}) => ({
  type: MT.SELECT_IDLECMD, player:0,
  summons: invoca.map(ref), special_summons: especial.map(ref),
  monster_sets: coloca.map(ref), spell_sets: colocaMT.map(ref),
  pos_changes: giros.map(ref), activates: activa.map(ref),
  to_bp: bp, to_ep: true,
});
export const preguntaBatalla = (ataques=[]) => ({
  type: MT.SELECT_BATTLECMD, player:0,
  attacks: ataques.map(ref), activates: [], to_m2:true, to_ep:true,
});
export const preguntaCadena = (opciones=[], forced=false) => ({
  type: MT.SELECT_CHAIN, player:0, forced, spe_count:0,
  hint_timing:0, hint_timing_other:0, selects: opciones.map(ref),
});
export const preguntaObjetivo = (cartas=[], min=1, max=1) => ({
  type: MT.SELECT_CARD, player:0, can_cancel:false, min, max,
  selects: cartas.map(ref),
});
export const preguntaPosicion = (nombre, positions=0x1|0x4) => ({
  type: MT.SELECT_POSITION, player:0, code: cod(nombre), positions,
});
export const preguntaSiNo = (code) => ({
  type: MT.SELECT_EFFECTYN, player:0, code, description:0n,
});

/* Cómo se lee una respuesta, en lenguaje de "qué ha hecho". */
export function queHizo(r){
  if(!r) return "nada";
  if(r.type===R.SELECT_IDLECMD){
    const q = { [IA.SELECT_SUMMON]:"invoca", [IA.SELECT_SPECIAL_SUMMON]:"invoca especial",
      [IA.SELECT_POS_CHANGE]:"gira", [IA.SELECT_MONSTER_SET]:"coloca",
      [IA.SELECT_SPELL_SET]:"coloca M/T", [IA.SELECT_ACTIVATE]:"activa",
      [IA.TO_BP]:"pasa a batalla", [IA.TO_EP]:"termina el turno" };
    return (q[r.action] ?? "?") + (r.index!=null ? " #"+r.index : "");
  }
  if(r.type===R.SELECT_BATTLECMD)
    return r.action===BA.SELECT_BATTLE ? "ataca #"+r.index : "no ataca";
  if(r.type===R.SELECT_CHAIN) return r.index==null ? "no encadena" : "encadena #"+r.index;
  if(r.type===R.SELECT_POSITION) return r.position===0x1 ? "en ataque" : r.position===0x4 ? "en defensa" : "pos "+r.position;
  if(r.type===R.SELECT_CARD)  return "elige #"+(r.indicies??[]).join(",");
  if(r.type===R.SELECT_EFFECTYN || r.type===R.SELECT_YESNO) return r.yes ? "sí" : "no";
  if(r.type===R.ANNOUNCE_RACE) return "declara el tipo " + (r.races ?? []).map(x => "0x" + Number(x).toString(16)).join(",");
  return JSON.stringify(r);
}
