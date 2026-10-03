/* comparar-replays.mjs · ¿juega la IA como juegan los jugadores de torneo?

   Pone lado a lado las MISMAS medidas sacadas de dos sitios:
     · los replays de torneo importados (../replays/out/*.jsonl, ver
       ../replays/importar-replays.mjs), filtrados a los arquetipos que
       tenemos en el simulador (Chaos Control, Chaos Turbo, Warrior);
     · autojuego del experto HEURÍSTICO con esos tres mazos, todos los
       cruces y espejos.

   Uso:  node comparar-replays.mjs [partidas]      (por defecto 90)
   Sale por pantalla y en ../replays/out/comparacion.md.

   CUIDADO AL LEERLO. Un jugador de torneo no es la verdad: juega en un
   simulador manual, contra humanos, con otras listas. Esto sirve para ver
   DIFERENCIAS GRANDES de hábito (dónde se usa una carta, cuánto se coloca),
   y cada diferencia hay que mirarla en los replays antes de tocar nada.
   Y el autojuego no usa ai/pensar.js (sería lento): mide la heurística. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import * as X from "./out/ocgcore.bundle.js";
import { scriptReader } from "./out/scripts.bundle.js";
import { GoatDuel } from "./src/duel.mjs";
import { makeAutoPlayer } from "./src/autopilot.mjs";
import { makeTrivialResolver } from "./src/trivial.js";
import { crearCerebro } from "./src/ai/brain.js";

const OUT = "../replays/out";
const N = Number(process.argv[2] ?? 90);
const ARQ = ["Chaos Control", "Chaos Turbo", "Warrior"];
const MAZO_SIM = { "Chaos Control": "Chaos Control", "Chaos Turbo": "Chaos Turbo · Worlds 2020", "Warrior": "Warrior Goat Control" };
const CLAVE = ["Mystical Space Typhoon", "Dust Tornado", "Heavy Storm", "Scapegoat", "Book of Moon", "Mirror Force",
  "Sakuretsu Armor", "Torrential Tribute", "Ring of Destruction", "Solemn Judgment", "Call of the Haunted",
  "Premature Burial", "Snatch Steal", "Nobleman of Crossout", "Delinquent Duo", "Graceful Charity", "Trap Dustshoot",
  "Raigeki Break", "Metamorphosis", "Creature Swap", "Tsukuyomi", "Mind Control", "Smashing Ground", "Card Destruction"];
const MONSTRUOS = ["Sangan", "Magician of Faith", "Tsukuyomi", "Spirit Reaper", "Breaker the Magical Warrior", "Blade Knight",
  "Kycoo the Ghost Destroyer", "Dekoichi the Battlechanted Locomotive", "Gravekeeper's Spy", "D.D. Warrior Lady", "Exiled Force",
  "Sinister Serpent", "Night Assailant", "Zombyra the Dark", "Tribe-Infecting Virus", "Mystic Swordsman LV2", "Don Zaloog",
  "Ninja Grandmaster Sasuke", "Asura Priest", "Thunder Dragon", "Cyber Jar", "Morphing Jar", "Airknight Parshath", "Jinzo"];
const canon = n => String(n || "").replace(/\s*\((GOAT|Pre-errata|Pre-Errata|Anime)\)\s*$/i, "").trim();
const RESP = t => !t ? "—" : /^atacar/.test(t) ? "atacar" : /^colocar/.test(t) ? "colocar"
  : /^(invocar|especial|voltear)$/.test(t) ? "invocar" : /^(activar|efecto)$/.test(t) ? "activar" : "—";

/* ── lo que se mide, igual para los dos lados ── */
function nuevaMedida() {
  return { partidas: 0, t1: [], turnos: [], usos: new Map(), barridos: [], ataques: [], monstruos: new Map(), prioridad: new Map() };
}
/* Tras invocar un monstruo con efecto de ignición: ¿lo usa con prioridad
   (antes de que el rival haga nada), le responde el rival antes, o no lo
   usa enseguida? Ver check-prioridad.mjs. */
const PRIORIDAD = ["Black Luster Soldier - Envoy of the Beginning", "Chaos Sorcerer", "Tribe-Infecting Virus",
  "Breaker the Magical Warrior", "Exiled Force", "Thousand-Eyes Restrict"];
function prio(M, carta, cls) { const k = canon(carta); if (!M.prioridad.has(k)) M.prioridad.set(k, {}); const o = M.prioridad.get(k); o[cls] = (o[cls] || 0) + 1; }
function uso(M, carta, u) { const k = canon(carta); if (!CLAVE.includes(k)) return; if (!M.usos.has(k)) M.usos.set(k, []); M.usos.get(k).push(u); }
function mons(M, carta, arriba, sit) {
  const k = canon(carta); if (!M.monstruos.has(k)) M.monstruos.set(k, [0, 0]); M.monstruos.get(k)[arriba ? 0 : 1]++;
  if (sit) { const kk = k + "|" + sit; M.sit = M.sit || new Map(); if (!M.sit.has(kk)) M.sit.set(kk, [0, 0]); M.sit.get(kk)[arriba ? 0 : 1]++; }
}
/* Cómo está el campo rival al bajar un monstruo: vacío, solo tapadas, o
   con algo boca arriba más débil / igual o más fuerte que él. */
function situacion(atkMio, rivales) {
  if (!rivales.length) return "vacío";
  const arriba = rivales.filter(r => !r.abajo && !r.ficha);
  if (!arriba.length) return rivales.some(r => r.ficha) && !rivales.some(r => r.abajo) ? "fichas" : "tapadas";
  return Math.max(...arriba.map(r => r.atk ?? 0)) < (atkMio ?? 0) ? "más débil" : "más fuerte";
}

/* ── los replays ── */
function medirReplays() {
  const leer = f => existsSync(`${OUT}/${f}`) ? readFileSync(`${OUT}/${f}`, "utf-8").trim().split("\n").filter(Boolean).map(JSON.parse) : [];
  const P = leer("partidas.jsonl"), T = leer("turnos.jsonl"), D = leer("decisiones.jsonl");
  if (!P.length) { console.log("No hay replays importados: node ../replays/importar-replays.mjs"); process.exit(1); }
  const mazoDe = (rep, n, lado) => P.find(p => p.replay === rep && p.partida === n)?.mazos[lado];
  const vale = m => ARQ.includes(m);
  const M = nuevaMedida();
  M.partidas = P.filter(p => vale(p.mazos[0]) && vale(p.mazos[1])).length;
  for (const t of T) {
    if (!vale(mazoDe(t.replay, t.partida, t.jugador))) continue;
    const mias = t.acciones.filter(a => a.quien === t.jugador);
    const rec = { colocaMT: mias.filter(a => a.tipo === "colocar_mt").length, colocaMon: mias.filter(a => a.tipo === "colocar_monstruo").length,
      invoca: mias.filter(a => a.tipo === "invocar").length, mano: t.mano_al_acabar.length,
      nombresInv: mias.filter(a => a.tipo === "invocar").map(a => canon(a.carta)), nombresCol: mias.filter(a => a.tipo === "colocar_monstruo").map(a => canon(a.carta)) };
    M.turnos.push(rec); if (t.turno === 1) M.t1.push(rec);
  }
  for (const t of T) {
    if (!vale(mazoDe(t.replay, t.partida, t.jugador))) continue;
    const A = t.acciones;
    A.forEach((a, i) => {
      const k = canon(a.carta);
      if (!PRIORIDAD.includes(k) || !/^(invocar|especial|voltear)$/.test(a.tipo) || a.quien !== t.jugador) return;
      let suyo = -1, propio = -1;
      for (let j = i + 1; j < Math.min(A.length, i + 10); j++) {
        const b = A[j];
        if (b.quien !== a.quien && (b.tipo === "activar" || b.tipo === "efecto" || b.posible_activacion) && suyo < 0) suyo = j;
        if (b.quien === a.quien && ((b.tipo === "efecto" && canon(b.carta) === k) || (k !== "Breaker the Magical Warrior" && b.tipo === "desterrar" && b.lado === 1 - a.quien)) && propio < 0) propio = j;
        if (b.quien === a.quien && /^(atacar|atacar_directo|invocar|colocar_monstruo|colocar_mt)$/.test(b.tipo) && propio < 0) break;
      }
      prio(M, k, propio >= 0 && (suyo < 0 || propio < suyo) ? "con prioridad" : suyo >= 0 ? "el rival responde antes" : "no lo usa enseguida");
    });
  }
  for (const d of D) {
    if (!vale(d.mazo)) continue;
    const a = d.accion;
    if (a.tipo === "activar" || a.tipo === "efecto" || a.posible_activacion) {
      uso(M, a.carta, { suTurno: d.su_turno, fase: d.fase, resp: RESP(d.responde_a?.tipo), puesta: a.puesta_turnos ?? null,
        objTapada: a.objetivo ? !!a.objetivo.tapada : null });
      if (/^(Heavy Storm|Harpie's Feather Duster)$/.test(canon(a.carta))) {
        const mt = cs => cs.filter(c => c.zona.startsWith("S")).length;
        M.barridos.push({ mias: mt(d.estado.vista.campo), suyas: mt(d.estado.vista.campo_rival) });
      }
    }
    if (a.tipo === "atacar" || a.tipo === "atacar_directo") {
      M.ataques.push({ directo: a.tipo === "atacar_directo", tapada: !!a.objetivo?.tapada, atk: a.atk,
        backrow: d.estado.vista.campo_rival.filter(c => c.zona.startsWith("S") && c.abajo).length });
    }
    if (a.tipo === "invocar" || a.tipo === "colocar_monstruo") {
      const riv = d.estado.vista.campo_rival.filter(c => c.zona.startsWith("M")).map(c => ({ abajo: c.abajo, ficha: !!c.ficha, atk: c.carta ? CARTAS.atk(c.carta) : null }));
      mons(M, a.carta, a.tipo === "invocar", situacion(CARTAS.atk(a.carta), riv));
    }
  }
  return M;
}

import { cargarCartas } from "../replays/importar-replays.mjs";
const CARTAS = cargarCartas();
/* ── el autojuego ── */
const raw = JSON.parse(readFileSync("./out/cards.subset.json", "utf-8"));
const names = JSON.parse(readFileSync("./out/names.subset.json", "utf-8"));
const MAZOS = JSON.parse(readFileSync("../data/mazos.json", "utf-8"));
const db = new Map(); for (const k in raw) { const c = raw[k]; db.set(c.code, { ...c, race: BigInt(c.race) }); }
const trivial = makeTrivialResolver(X), generico = makeAutoPlayer(X);
const nm = c => canon(names[c]?.name ?? ("#" + c));
const barajar = (a, r) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [b[i], b[j]] = [b[j], b[i]]; } return b; };
const rng = s => { let x = s >>> 0; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; }; };
const LOC = { HAND: 2, MZONE: 4, SZONE: 8 };
const FASE = p => p === 1 ? "DP" : p === 2 ? "SP" : p === 4 ? "M1" : p === 0x100 ? "M2" : p === 0x200 ? "EP" : (p >= 8 && p <= 0x80) ? "BP" : "?";

async function partida(semilla, mazoA, mazoB, M) {
  const lib = await X.default({ sync: true });
  const duel = new GoatDuel({ lib, X, cardDb: db, scriptReader, onEvent: () => {} });
  const r = rng(semilla);
  await duel.create({ deck0: barajar(mazoA.main, r), deck1: barajar(mazoB.main, r), extra0: mazoA.extra, extra1: mazoB.extra,
    seed: [BigInt(semilla), 7n, 13n, 29n] });
  const cerebros = { 0: crearCerebro({ X, duel, db, names, nivel: "experto", yo: 0 }), 1: crearCerebro({ X, duel, db, names, nivel: "experto", yo: 1 }) };
  let jt = null, turno = 0, rec = null, ultimo = null, faseAct = "DP";
  const puesta = new Map();
  let ultimoUso = null;
  let pendiente = null;          // {uid, code, quien}: invocado, a ver qué pasa
  const cierraPendiente = cls => { if (pendiente) { prio(M, nm(pendiente.code), cls); pendiente = null; } };
  const sitIA = (quien, code, uid) => situacion(db.get(code)?.attack ?? 0, (duel.zones[1 - quien]?.[LOC.MZONE] ?? []).filter(c => c && c.uid !== uid)
    .map(c => ({ abajo: !!(c.position & 0x0a), ficha: !!(db.get(c.code)?.type & 0x4000), atk: c.atkReal ?? db.get(c.code)?.attack ?? 0 })));
  const cerrar = () => {
    if (!rec) return;
    rec.mano = (duel.zones[jt]?.[LOC.HAND] ?? []).filter(Boolean).length;
    M.turnos.push(rec); if (turno === 1) M.t1.push(rec);
  };
  const orig = duel.emit.bind(duel);
  duel.emit = (t, d) => {
    if (t === "turn" || t === "phase" || t === "attack") cierraPendiente("no lo usa enseguida");
    if (t === "turn") { cerrar(); jt = d.player; turno = d.turn; rec = { colocaMT: 0, colocaMon: 0, invoca: 0, mano: 0, nombresInv: [], nombresCol: [] }; ultimo = null; }
    if (t === "phase") { faseAct = FASE(d.phase); ultimo = null; }
    if (t === "move" && d.from.location === LOC.HAND && d.to.faceDown) {
      const quien = d.to.controller;
      if (d.to.location === LOC.SZONE) { puesta.set(d.uid, turno); if (quien === jt && rec) rec.colocaMT++; ultimo = { tipo: "colocar", p: quien }; }
      if (d.to.location === LOC.MZONE) { if (quien === jt && rec) { rec.colocaMon++; rec.nombresCol.push(nm(d.code)); } mons(M, nm(d.code), false, sitIA(quien, d.code, d.uid)); ultimo = { tipo: "colocar", p: quien }; }
    }
    if (t === "summon") {
      const c = duel.cards.get(d.uid);
      if (pendiente) cierraPendiente("no lo usa enseguida");
      if (PRIORIDAD.includes(nm(d.code)) && (c?.controller ?? jt) === jt) pendiente = { uid: d.uid, code: d.code, quien: jt };
      if (d.kind === "normal") { if (rec && c?.controller === jt) { rec.invoca++; rec.nombresInv.push(nm(d.code)); } mons(M, nm(d.code), true, sitIA(c?.controller ?? jt, d.code, d.uid)); }
      ultimo = { tipo: "invocar", p: c?.controller ?? jt };
    }
    if (t === "attack") {
      const a = duel.cards.get(d.uid), o = d.targetUid != null ? duel.cards.get(d.targetUid) : null;
      const quien = a?.controller ?? jt;
      M.ataques.push({ directo: !o, tapada: !!(o && (o.position & 0x0a)), atk: a?.atkReal ?? db.get(a?.code)?.attack ?? null,
        backrow: (duel.zones[1 - quien]?.[LOC.SZONE] ?? []).filter(c => c && (c.position & 0x0a)).length });
      ultimo = { tipo: "atacar", p: quien };
    }
    if (t === "chain" && d.code) {
      const quien = d.controller, carta = nm(d.code);
      if (pendiente) {
        if (quien === pendiente.quien && d.uid === pendiente.uid) cierraPendiente("con prioridad");
        else if (quien !== pendiente.quien) cierraPendiente("el rival responde antes");
      }
      /* los mantenimientos de la Standby (Snatch Steal, Premature) llegan como eslabón: no son usos */
      const mantenimiento = faseAct === "SP" && /^(Snatch Steal|Premature Burial|Messenger of Peace)$/.test(carta) && !puesta.has(d.uid);
      if (!mantenimiento) {
        const resp = d.link > 1 ? "activar" : (ultimo && ultimo.p !== quien ? ultimo.tipo : "—");
        const u = { suTurno: quien === jt, fase: faseAct, resp, puesta: puesta.has(d.uid) ? turno - puesta.get(d.uid) : null, objTapada: null };
        uso(M, carta, u); ultimoUso = { carta, u };
        if (/^(Heavy Storm|Harpie's Feather Duster)$/.test(carta)) {
          const mt = lado => (duel.zones[lado]?.[LOC.SZONE] ?? []).filter(c => c && c.uid !== d.uid && c.code !== d.code || c && c.uid !== d.uid && c.position & 0x0a).length;
          M.barridos.push({ mias: mt(quien), suyas: mt(1 - quien) });
        }
      }
      puesta.delete(d.uid);
      ultimo = { tipo: "activar", p: quien };
    }
    if (t === "target" && ultimoUso && /^(Mystical Space Typhoon|Dust Tornado)$/.test(ultimoUso.carta) && ultimoUso.u.objTapada === null) {
      const o = duel.cards.get(d.uids.at(-1));
      if (o) ultimoUso.u.objTapada = !!(o.position & 0x0a);
    }
    orig(t, d);
  };
  for (let paso = 0; paso < 7000 && !duel.finished; paso++) {
    const q = await duel.run();
    if (!q || duel.finished) break;
    let intento = 0, resp = null;
    while (intento < 8 && !resp) { resp = trivial(q) ?? cerebros[q.player]?.(q, intento) ?? generico(q, intento); intento++; }
    if (!resp) break;
    duel.respond(resp);
  }
  cerrar();
  M.partidas++;
}

/* ── resumen ── */
const media = xs => xs.length ? (xs.reduce((s, v) => s + v, 0) / xs.length) : null;
const f1 = v => v === null ? "—" : v.toFixed(2);
const pct = (a, b) => b ? `${Math.round(100 * a / b)} %` : "—";
function filas(J, I) {
  const L = [];
  const fila = (nombre, fj, fi) => L.push(`| ${nombre} | ${fj} | ${fi} |`);
  L.push(`| Medida | Jugadores (${J.partidas} duelos) | IA experta (${I.partidas} duelos) |`, `|---|---|---|`);
  for (const [nom, M] of [["", null]]) void nom;
  const t1 = M => ({ mt: media(M.t1.map(r => r.colocaMT)), mon: pct(M.t1.filter(r => r.colocaMon).length, M.t1.length),
    inv: pct(M.t1.filter(r => r.invoca).length, M.t1.length), mano: media(M.t1.map(r => r.mano)) });
  const a = t1(J), b = t1(I);
  fila("T1 · M/T colocadas", f1(a.mt), f1(b.mt));
  fila("T1 · coloca monstruo", a.mon, b.mon);
  fila("T1 · invoca boca arriba", a.inv, b.inv);
  fila("T1 · mano al acabar", f1(a.mano), f1(b.mano));
  const tt = M => ({ mt: media(M.turnos.map(r => r.colocaMT)), dos: pct(M.turnos.filter(r => r.colocaMT >= 2).length, M.turnos.length),
    tres: pct(M.turnos.filter(r => r.colocaMT >= 3).length, M.turnos.length), mano: media(M.turnos.map(r => r.mano)),
    vacia: pct(M.turnos.filter(r => r.mano === 0).length, M.turnos.length) });
  const c = tt(J), e = tt(I);
  fila("Turno propio · M/T colocadas", f1(c.mt), f1(e.mt));
  fila("Turno propio · coloca 2+", c.dos, e.dos);
  fila("Turno propio · coloca 3+", c.tres, e.tres);
  fila("Mano al acabar el turno", f1(c.mano), f1(e.mano));
  fila("Acaba con la mano vacía", c.vacia, e.vacia);
  const at = M => { const m = M.ataques.filter(x => !x.directo);
    return { tap: pct(m.filter(x => x.tapada).length, m.length), atkTap: media(m.filter(x => x.tapada && x.atk != null).map(x => x.atk)),
      conBR: pct(M.ataques.filter(x => x.backrow > 0).length, M.ataques.length), porP: M.ataques.length / Math.max(1, M.partidas) }; };
  const g = at(J), h = at(I);
  fila("Ataques por duelo", f1(g.porP), f1(h.porP));
  fila("Ataques a monstruo que van a una tapada", g.tap, h.tap);
  fila("ATK medio al atacar una tapada", f1(g.atkTap), f1(h.atkTap));
  fila("Ataques con M/T tapadas enfrente", g.conBR, h.conBR);
  const bar = M => ({ n: M.barridos.length, mias: media(M.barridos.map(x => x.mias)), suyas: media(M.barridos.map(x => x.suyas)),
    malo: pct(M.barridos.filter(x => x.mias >= x.suyas).length, M.barridos.length) });
  const k = bar(J), l = bar(I);
  fila("Heavy Storm · M/T propias / del rival", `${f1(k.mias)} / ${f1(k.suyas)}`, `${f1(l.mias)} / ${f1(l.suyas)}`);
  fila("Heavy Storm con tantas propias como suyas o más", k.malo, l.malo);
  return L;
}
function tablaUsos(J, I) {
  const L = [`| Carta | Usos/duelo J · IA | En su turno J · IA | Dónde (J) | Dónde (IA) | Responde a (J) | Responde a (IA) | Puesta J · IA |`, `|---|---|---|---|---|---|---|---|`];
  const top = (us, f) => { const c = {}; for (const u of us) { const k = f(u); c[k] = (c[k] || 0) + 1; }
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${Math.round(100 * v / us.length)}%`).join(", "); };
  const donde = u => (u.suTurno ? "" : "rival·") + u.fase;
  for (const k of CLAVE) {
    const uj = J.usos.get(k) || [], ui = I.usos.get(k) || [];
    if (uj.length < 3 && ui.length < 3) continue;
    const pj = media(uj.map(u => u.puesta).filter(v => v !== null)), pi = media(ui.map(u => u.puesta).filter(v => v !== null));
    L.push(`| ${k} | ${(uj.length / J.partidas).toFixed(2)} · ${(ui.length / I.partidas).toFixed(2)} | ${pct(uj.filter(u => u.suTurno).length, uj.length)} · ${pct(ui.filter(u => u.suTurno).length, ui.length)} | ${top(uj, donde)} | ${top(ui, donde)} | ${top(uj, u => u.resp)} | ${top(ui, u => u.resp)} | ${f1(pj)} · ${f1(pi)} |`);
  }
  return L;
}
function tablaMonstruos(J, I) {
  const L = [`| Monstruo | Boca arriba J | Boca arriba IA | (n J · n IA) | Por campo rival: boca arriba J · IA (n J · n IA) |`, `|---|---|---|---|---|`];
  for (const k of MONSTRUOS) {
    const a = J.monstruos.get(k) || [0, 0], b = I.monstruos.get(k) || [0, 0];
    if (a[0] + a[1] < 3 && b[0] + b[1] < 3) continue;
    const sits = ["vacío", "tapadas", "más débil", "más fuerte", "fichas"].map(s => {
      const x = J.sit?.get(k + "|" + s) || [0, 0], y = I.sit?.get(k + "|" + s) || [0, 0];
      if (x[0] + x[1] + y[0] + y[1] === 0) return null;
      return `${s}: ${pct(x[0], x[0] + x[1])} · ${pct(y[0], y[0] + y[1])} (${x[0] + x[1]} · ${y[0] + y[1]})`;
    }).filter(Boolean).join("; ");
    L.push(`| ${k} | ${pct(a[0], a[0] + a[1])} | ${pct(b[0], b[0] + b[1])} | ${a[0] + a[1]} · ${b[0] + b[1]} | ${sits} |`);
  }
  return L;
}

function tablaT1(J, I) {
  const cuenta = (M, k) => { const c = {}; for (const r of M.t1) for (const n of r[k]) c[n] = (c[n] || 0) + 1; return c; };
  const L = [`| Turno 1 | Jugadores (${J.t1.length}) | IA (${I.t1.length}) |`, `|---|---|---|`];
  for (const [k, nom] of [["nombresInv", "Invoca boca arriba"], ["nombresCol", "Coloca"]]) {
    const fmt = (M) => Object.entries(cuenta(M, k)).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n, v]) => `${n} ${Math.round(100 * v / M.t1.length)}%`).join(", ");
    L.push(`| ${nom} | ${fmt(J)} | ${fmt(I)} |`);
  }
  L.push(`| Sin monstruo | ${pct(J.t1.filter(r => !r.invoca && !r.colocaMon).length, J.t1.length)} | ${pct(I.t1.filter(r => !r.invoca && !r.colocaMon).length, I.t1.length)} |`);
  return L;
}
function tablaPrioridad(J, I) {
  const L = [`| Monstruo | Jugadores: con prioridad · rival antes · no enseguida | IA: con prioridad · rival antes · no enseguida |`, `|---|---|---|`];
  const f = o => { const n = Object.values(o || {}).reduce((a, b) => a + b, 0); if (!n) return "—";
    return ["con prioridad", "el rival responde antes", "no lo usa enseguida"].map(k => pct(o[k] || 0, n)).join(" · ") + ` (${n})`; };
  for (const k of PRIORIDAD) L.push(`| ${k} | ${f(J.prioridad.get(k))} | ${f(I.prioridad.get(k))} |`);
  return L;
}
const J = medirReplays();
const I = nuevaMedida();
const mazos = ARQ.map(a => MAZOS.find(m => (m.nombre ?? m.name) === MAZO_SIM[a]));
if (mazos.some(m => !m)) { console.log("falta algún mazo:", ARQ.map((a, i) => a + "→" + !!mazos[i]).join(", ")); process.exit(1); }
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const a = mazos[i % 3], b = mazos[Math.floor(i / 3) % 3];
  await partida(3000 + i * 7919, a, b, I);
}
const md = [`# Jugadores de torneo contra la IA`, ``,
  `Replays: arquetipos ${ARQ.join(", ")}. IA: experto heurístico (sin ai/pensar.js), mazos ${Object.values(MAZO_SIM).join(", ")}, todos los cruces. ${((Date.now() - t0) / 1000).toFixed(0)} s.`, ``,
  `## Hábitos generales`, ``, ...filas(J, I), ``, ...tablaT1(J, I), ``,
  `## Prioridad: tras invocar, ¿se usa el efecto antes de que el rival responda?`, ``, ...tablaPrioridad(J, I), ``,
  `## Cartas: cuándo se usan`, ``,
  `«rival·EP» = en la End Phase del rival. «Responde a» = lo último que hizo el rival antes (en la IA: eslabón 2+ = «activar»). «Puesta» = turnos que llevaba colocada.`, ``,
  ...tablaUsos(J, I), ``, `## Monstruos: invocados boca arriba o colocados`, ``, ...tablaMonstruos(J, I), ``].join("\n");
writeFileSync(`${OUT}/comparacion.md`, md);
console.log(md);
