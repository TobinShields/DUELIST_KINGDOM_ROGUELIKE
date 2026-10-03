/* ════════════════════════════════════════════════════════════════
   SALAS: DOS PERSONAS, UN DUELO — la parte que no sabe de redes

   El ANFITRIÓN (quien crea la sala) ejecuta el motor de verdad, como en
   un duelo contra la IA. El INVITADO no tiene motor: tiene un ESPEJO
   (`DueloEspejo`) que se rellena con lo que el anfitrión le manda y que
   se comporta, para la vista y para el bucle del duelo, igual que un
   `GoatDuel` (las mismas `cards`, `zones`, `lp`, `at`, `resolve`, `run`,
   `respond`).

   Lo que viaja, y por qué así:
     · `lote`: después de cada paso del motor, los EVENTOS que ha generado
       (para que el invitado vea las mismas animaciones) y una FOTO del
       estado (para que su tablero sea exactamente el del motor). Con la
       foto no hay desincronización posible: el espejo no deduce nada,
       copia.
     · `pregunta` / `respuesta`: cuando el motor le pregunta algo al
       invitado, la pregunta viaja, se contesta en su pantalla con los
       mismos paneles de siempre y la respuesta vuelve.

   TODO lo que sale hacia el invitado pasa por los filtros de aquí abajo:
   el código de una carta que él no puede ver (tu mano, tus tapadas, los
   mazos) viaja como 0. No es «no enseñarlo en pantalla»: es que no llega
   a su navegador, así que tampoco se puede leer desde la consola.

   Sin DOM y sin red: se prueba en node con un duelo de verdad
   (`check-sala.mjs`). El transporte (PeerJS) está en `red.js`.
   ════════════════════════════════════════════════════════════════ */

export const SALA_VERSION = 2;   // 2: el invitado elige entre los mazos del anfitrión
const L = { DECK:1, HAND:2, MZONE:4, SZONE:8, GRAVE:16, REMOVED:32, EXTRA:64, FZONE:256 };
const SLOTTED = new Set([L.MZONE, L.SZONE, L.FZONE]);
const bocaAbajo = p => !!(p & 0x0a);

/* ── JSON que aguanta BigInt ──
   Las preguntas del motor llevan descripciones de 64 bits y alguna
   respuesta (declarar Tipo) también. JSON.stringify revienta con BigInt. */
export const codificar = obj => JSON.stringify(obj, (k, v) => typeof v === "bigint" ? { __b: v.toString() } : v);
export const decodificar = txt => JSON.parse(txt, (k, v) =>
  (v && typeof v === "object" && typeof v.__b === "string" && Object.keys(v).length === 1) ? BigInt(v.__b) : v);

/* ══ QUÉ PUEDE VER EL JUGADOR `p` ══
   La misma regla que usa la vista para no pintar la cara de una carta
   (`ocultaParaMi` en view.js), aplicada ANTES de que salga de casa:
     · los mazos, de nadie (tampoco el tuyo: no sabes el orden);
     · lo que controlas, todo;
     · del rival: ni su mano, ni su Extra, ni lo que tiene boca abajo;
     · lo que un efecto ha revelado, mientras dure (`reveladas`). */
export function visiblePara(card, p, reveladas = null){
  if(!card) return false;
  if(reveladas?.has?.(card.uid)) return true;
  if(card.location === L.DECK) return false;
  if(card.controller === p) return true;
  if(card.location === L.HAND || card.location === L.EXTRA) return false;
  if((card.location === L.MZONE || card.location === L.SZONE) && bocaAbajo(card.position)) return false;
  return true;
}
/* Lo mismo para un SITIO (de dónde sale o adónde va una carta). */
function sitioVisible(s, p){
  if(!s) return false;
  if(s.location === L.DECK) return false;
  if(s.controller === p) return true;
  if(s.location === L.HAND || s.location === L.EXTRA) return false;
  if((s.location === L.MZONE || s.location === L.SZONE) && bocaAbajo(s.position ?? 0)) return false;
  return true;
}

/* Lo que una carta enseña además de su sitio. El ATK real de un monstruo
   boca abajo, por ejemplo, NO: diría qué es. Los turnos en que entró o se
   colocó sí: eso se ve caer en la mesa. */
const PUBLICOS_SIEMPRE = ["entroTurno", "puestaTurno", "volteoTurno", "atacoTurno"];
const PUBLICOS_SI_SE_VE = ["atkReal", "defReal", "equipado", "equipadoA", "vinculadoA", "contadores", "cuenta"];

/* ══ LA FOTO DEL ESTADO, PARA `p` ══ */
export function estadoPara(duel, p, reveladas = null){
  const cartas = [];
  for(const c of duel.cards.values()){
    const ve = visiblePara(c, p, reveladas);
    const x = { uid:c.uid, code: ve ? c.code : 0, controller:c.controller, owner:c.owner ?? c.controller,
                location:c.location, sequence:c.sequence, position:c.position };
    for(const k of PUBLICOS_SIEMPRE) if(c[k] != null) x[k] = c[k];
    if(ve) for(const k of PUBLICOS_SI_SE_VE) if(c[k] != null) x[k] = c[k];
    cartas.push(x);
  }
  const zonas = {};
  for(const q of [0, 1]){
    zonas[q] = {};
    for(const loc in duel.zones[q]) zonas[q][loc] = duel.zones[q][loc].map(c => c ? c.uid : null);
  }
  const uidPublico = a => a ? { uid:a.uid, controller:a.controller,
    code: visiblePara(duel.cards.get(a.uid), p, reveladas) ? a.code : 0 } : null;
  return {
    cartas, zonas,
    lp: { 0:duel.lp[0], 1:duel.lp[1] },
    turnPlayer: duel.turnPlayer, turnCount: duel.turnCount, phase: duel.phase,
    finished: !!duel.finished,
    /* Lo que está en la cadena se ha activado boca arriba: es público. */
    cadena: (duel.cadena ?? []).map(e => ({ code:e.code, controller:e.controller, uid:e.uid ?? null })),
    objetivosCadena: [...(duel.objetivosCadena ?? [])],
    atacante: uidPublico(duel.atacante), objetivoAtaque: uidPublico(duel.objetivoAtaque),
    ultimaInvocada: duel.ultimaInvocada ?? null,
    /* La cima del mazo solo se guarda cuando es pública (Convulsion of
       Nature, Feather of the Phoenix). */
    cimaMazo: { 0:duel.cimaMazo?.[0] ?? null, 1:duel.cimaMazo?.[1] ?? null },
  };
}

/* ══ LOS EVENTOS, PARA `p` ══
   Los que llevan código de carta se filtran con la misma regla. Los que
   no le sirven al invitado (las preguntas en crudo, los errores internos
   del motor) no viajan. */
const NO_VIAJAN = new Set(["prompt", "coreError", "retry"]);
export function eventosPara(eventos, duel, p, reveladas = null){
  const out = [];
  for(const e of eventos){
    if(!e || NO_VIAJAN.has(e.t)) continue;
    switch(e.t){
      case "draw":
        out.push({ t:"draw", player:e.player,
                   cards:(e.cards ?? []).map(c => ({ uid:c.uid, code: e.player === p ? c.code : 0 })) });
        break;
      case "move": {
        const ve = sitioVisible(e.from, p) || sitioVisible(e.to, p) || !!reveladas?.has?.(e.uid);
        out.push({ ...e, code: ve ? e.code : 0 });
        break;
      }
      case "set":
        out.push({ ...e, code: e.controller === p ? e.code : 0 });
        break;
      case "contador": {
        const c = duel.cards.get(e.uid);
        out.push({ ...e, code: (!c || visiblePara(c, p, reveladas) || e.clase !== "contador") ? e.code : 0 });
        break;
      }
      /* Invocar, encadenar y revelar son públicos por definición. El resto
         no lleva códigos. */
      default:
        out.push({ ...e });
    }
  }
  return out;
}

/* ══ LA PREGUNTA, PARA `p` ══
   El motor pone el código real en cada carta de la lista, también en las
   tapadas del rival (lo necesita para resolver). Se recorre la pregunta
   entera y toda carta que `p` no pueda ver se queda en 0. El orden y los
   índices no cambian: la respuesta del invitado sigue valiendo tal cual. */
export function preguntaPara(q, duel, p, reveladas = null){
  const copia = structuredClone(q);
  const recorrer = o => {
    if(!o || typeof o !== "object") return;
    if(Array.isArray(o)){ o.forEach(recorrer); return; }
    if("code" in o && typeof o.location === "number" && typeof o.controller === "number"){
      const c = duel.at?.(o.controller, o.location, o.sequence ?? 0);
      /* Buscar en TU mazo (Sangan, Witch, Reinforcement…) es mirarlo: el
         motor te enseña las cartas para que elijas, como en la mesa. */
      const ve = (o.location === L.DECK && o.controller === p) ? true
               : c ? visiblePara(c, p, reveladas)
                   : sitioVisible({ controller:o.controller, location:o.location, position:o.position ?? 0 }, p);
      if(!ve) o.code = 0;
    }
    for(const k in o) if(o[k] && typeof o[k] === "object") recorrer(o[k]);
  };
  recorrer(copia);
  return copia;
}

/* ══ LAS CARTAS REVELADAS, MIENTRAS DUREN ══
   Trap Dustshoot, Confiscation o una búsqueda enseñan cartas que de otro
   modo estarían ocultas. El anfitrión las apunta al pasar el evento
   `revelar` y las olvida al acabar la cadena o al cambiar de fase, como
   la vista. */
export function seguirReveladas(reveladas, eventos){
  for(const e of eventos){
    if(e?.t === "revelar") for(const u of (e.uids ?? [])) reveladas.add(u);
    else if(e?.t === "chainEnd" || e?.t === "phase" || e?.t === "turn") reveladas.clear();
  }
  return reveladas;
}

/* ══ EL DUELO DEL INVITADO ══
   Tiene la forma de `GoatDuel` que usan la vista y el bucle de main.js.
   `run()` espera a que llegue algo del anfitrión: si son lotes, los
   aplica, pasa sus eventos por `onEvent` y devuelve null (el bucle anima
   y vuelve a llamar); si es una pregunta, la devuelve. `respond()` manda
   la respuesta de vuelta. */
export class DueloEspejo {
  constructor({ yo, onEvent, enviar, decklist = null }){
    this.esEspejo = true;
    this.yo = yo;
    this.onEvent = onEvent ?? (() => {});
    this.enviar = enviar ?? (() => {});
    this.cards = new Map();
    this.zones = { 0:this.emptySide(), 1:this.emptySide() };
    this.lp = { 0:8000, 1:8000 };
    this.turnPlayer = 0; this.turnCount = 0; this.phase = 0;
    this.pending = null; this.finished = false; this.desyncs = 0;
    this.cadena = []; this.objetivosCadena = new Set();
    this.atacante = null; this.objetivoAtaque = null; this.ultimaInvocada = null;
    this.cimaMazo = { 0:null, 1:null };
    /* Tu propio mazo sí lo conoces (es tuyo): lo usa la vista del bot en
       las pruebas, igual que en un duelo normal. El del rival, vacío. */
    this.decklist = { 0:[], 1:[] };
    if(decklist) this.decklist[yo] = [...decklist];
    this._entrada = []; this._despertar = null; this._idPregunta = null; this._ultimaRespondida = 0;
    this.lotes = 0;
    /* Lo que el último lote enseñó con un `revelar`: hasta la foto
       siguiente, esas cartas llevan su código aunque estén ocultas. */
    this.reveladas = new Set();
  }
  emptySide(){
    return { [L.DECK]:[], [L.HAND]:[], [L.GRAVE]:[], [L.REMOVED]:[], [L.EXTRA]:[],
             [L.MZONE]:new Array(5).fill(null), [L.SZONE]:new Array(6).fill(null), [L.FZONE]:new Array(1).fill(null) };
  }
  at(controller, location, sequence){ return this.zones[controller]?.[location]?.[sequence] ?? null; }
  resolve(loc, code){
    const z = this.zones[loc.controller]?.[loc.location];
    if(!z) return null;
    const direct = z[loc.sequence] ?? null;
    const want = code ?? loc.code;
    if(!want || (direct && direct.code === want)) return direct;
    return z.find(c => c && c.code === want) ?? direct;
  }

  /* Lo que llega del anfitrión entra aquí (lo llama la capa de red). */
  recibir(msg){
    if(!msg) return;
    /* ── SE ACABÓ EL TIEMPO DE UNA PREGUNTA ──
       El anfitrión ha contestado por el invitado (ver el reloj de la sala
       en main.js). Si la pregunta ya estaba en pantalla, se cierra
       (`alCaducar`); si aún esperaba en la cola, `run` se la saltará. */
    if(msg.t === "caducada"){
      this._ultimaRespondida = Math.max(this._ultimaRespondida, msg.id ?? 0);
      if(msg.id === this._idPregunta){ this._idPregunta = null; this.pending = null; this.alCaducar?.(); }
      return;
    }
    this._entrada.push(msg);
    const d = this._despertar; this._despertar = null; d?.();
  }
  /* Para salir del duelo sin esperar más (rendición, desconexión). */
  cerrar(){ this.finished = true; const d = this._despertar; this._despertar = null; d?.(); }

  aplicarEstado(e){
    if(!e) return;
    this.reveladas.clear();
    const vistas = new Set();
    for(const x of e.cartas ?? []){
      let c = this.cards.get(x.uid);
      if(!c){ c = { uid:x.uid }; this.cards.set(x.uid, c); }
      for(const k of [...PUBLICOS_SIEMPRE, ...PUBLICOS_SI_SE_VE]) delete c[k];
      Object.assign(c, x);
      vistas.add(x.uid);
    }
    for(const q of [0, 1]){
      for(const loc in (e.zonas?.[q] ?? {})){
        const z = this.zones[q][loc] ?? (this.zones[q][loc] = []);
        const nuevo = e.zonas[q][loc].map(u => u == null ? null : (this.cards.get(u) ?? null));
        z.length = 0; z.push(...nuevo);
      }
    }
    this.lp = { 0:e.lp?.[0] ?? this.lp[0], 1:e.lp?.[1] ?? this.lp[1] };
    this.turnPlayer = e.turnPlayer; this.turnCount = e.turnCount; this.phase = e.phase;
    this.cadena = e.cadena ?? [];
    this.objetivosCadena = new Set(e.objetivosCadena ?? []);
    this.atacante = e.atacante ?? null; this.objetivoAtaque = e.objetivoAtaque ?? null;
    this.ultimaInvocada = e.ultimaInvocada ?? null;
    this.cimaMazo = e.cimaMazo ?? { 0:null, 1:null };
    if(e.finished) this.finished = true;
  }
  /* Los eventos se pasan como los pasaría el adaptador. Dos retoques:
     `draw` lleva las CARTAS del espejo (la vista y el log las esperan
     así) y `revelar` pone en el espejo el código de lo que se enseña,
     para que la vista pueda pintar su cara mientras dure. */
  emitirEventos(eventos){
    for(const e of eventos ?? []){
      if(e.t === "draw") e.cards = (e.cards ?? []).map(x => this.cards.get(x.uid) ?? x);
      if(e.t === "revelar") (e.uids ?? []).forEach((u, i) => {
        const c = this.cards.get(u); if(c && e.codes?.[i]){ c.code = e.codes[i]; this.reveladas.add(u); } });
      if(e.t === "win"){ this.finished = true; this.ganador = e.player; }
      this.onEvent(e);
    }
  }
  async run(){
    while(true){
      if(this.finished && !this._entrada.length) return null;
      let lotes = 0;
      while(this._entrada.length){
        const m = this._entrada[0];
        if(m.t === "lote" || m.t === "estado"){
          this._entrada.shift();
          this.aplicarEstado(m.estado);
          this.emitirEventos(m.eventos);
          lotes++; this.lotes++;
          continue;
        }
        if(m.t === "pregunta"){
          if(lotes) return null;              // primero se anima lo que ha pasado
          this._entrada.shift();
          /* Tras una reconexión el anfitrión reenvía la pregunta abierta;
             si ya se había contestado (la respuesta iba de camino), sobra. */
          if(m.id <= this._ultimaRespondida) continue;
          this.pending = m.q; this._idPregunta = m.id;
          return m.q;
        }
        this._entrada.shift();                // lo demás lo trata la capa de sala
      }
      if(lotes || this.finished) return null;
      await new Promise(res => { this._despertar = res; });
    }
  }
  respond(r){
    if(this._idPregunta == null) return;
    /* `porTiempo`: la contestó el reloj, no el jugador. El anfitrión lo
       cuenta (tres seguidas pierden el duelo). */
    /* `jugador`: la contestó la persona en su pantalla (no una respuesta
       automática sin elección). Solo esas reinician la cuenta del reloj. */
    this.enviar({ t:"respuesta", id:this._idPregunta, r, ...(this.porTiempo ? { porTiempo:true } : {}),
                  ...(this.deJugador ? { jugador:true } : {}) });
    this.porTiempo = false; this.deJugador = false;
    this._ultimaRespondida = Math.max(this._ultimaRespondida, this._idPregunta);
    this._idPregunta = null; this.pending = null;
  }
}

/* ══ EL MAZO DEL INVITADO, ANTES DE EMPEZAR ══
   El anfitrión no se fía: comprueba que es un mazo legal de Goat con las
   cartas que este HTML sabe jugar. `info.legal(code)` dice si la carta
   está en el pool, `info.limite(code)` cuántas copias se permiten y
   `info.nombre(code)` cómo se llama (las copias se cuentan por nombre).
   Devuelve { ok } o { ok:false, motivo } en una frase. */
export function validarMazo(mazo, info){
  const main = mazo?.main ?? [], extra = mazo?.extra ?? [], side = mazo?.side ?? [];
  if(!Array.isArray(main) || !Array.isArray(extra) || !Array.isArray(side)) return { ok:false, motivo:"El mazo no se ha podido leer." };
  if(main.length < 40) return { ok:false, motivo:`El Main Deck tiene ${main.length} cartas: hacen falta 40.` };
  if(main.length > 60) return { ok:false, motivo:`El Main Deck tiene ${main.length} cartas: el máximo son 60.` };
  if(extra.length > 15) return { ok:false, motivo:`El Extra Deck tiene ${extra.length} cartas: el máximo son 15.` };
  if(side.length > 15) return { ok:false, motivo:`El Side Deck tiene ${side.length} cartas: el máximo son 15.` };
  /* Las copias se cuentan entre main, extra y side juntos, como en un
     torneo: con el side deck del Bo3 no se pueden meter más. */
  const todas = [...main, ...extra, ...side];
  const malas = todas.filter(c => !Number.isInteger(c) || !info.legal(c));
  if(malas.length) return { ok:false, motivo:`Hay ${malas.length} carta(s) que no son legales en Goat.` };
  const cuenta = new Map();
  for(const c of todas){ const n = info.nombre(c); cuenta.set(n, { n:(cuenta.get(n)?.n ?? 0) + 1, code:c }); }
  for(const [nombre, { n, code }] of cuenta){
    const lim = Math.min(3, info.limite(code));
    if(n > lim) return { ok:false, motivo:`${nombre}: lleva ${n} y el límite es ${lim}.` };
  }
  return { ok:true };
}

/* Un código de sala que se dicta bien: sin 0/O ni 1/I/L. */
const LETRAS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function nuevoCodigo(azar = Math.random, largo = 5){
  let s = ""; for(let i = 0; i < largo; i++) s += LETRAS[Math.floor(azar() * LETRAS.length)];
  return s;
}
export const limpiarCodigo = txt => String(txt ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
