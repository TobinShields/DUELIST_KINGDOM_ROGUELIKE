/* ════════════════════════════════════════════════════════════════
   TORNEO META · al mejor de tres contra la máquina

   Lo pidió E para entrenar Goat de verdad: cada ronda elige su mazo y el
   de la IA entre los mazos meta, se juega un match al mejor de tres
   (gana quien llegue a dos) y todo queda apuntado para tomar notas.

   Este módulo es SOLO la lógica: sin DOM, sin motor, sin localStorage.
   Así se prueba en node tal cual (`check-torneo.mjs`) y la pantalla de
   `template.html` no puede llevar reglas escondidas.

   Reglas del match:
     · Partida 1: moneda.
     · Partidas 2 y 3: empieza quien PERDIÓ la anterior. En Goat el que
       pierde elige, y elegir empezar es lo normal. Entre partidas se
       puede sidear (ver más abajo), como en un torneo de verdad.
     · La IA es siempre `experto`: el modo es para entrenar contra lo
       mejor que sabe jugar el bot, sin lastres.
   ════════════════════════════════════════════════════════════════ */

export const TORNEO_VERSION = 1;
export const GANA_MATCH = 2;

export function nuevoTorneo(ahora = Date.now()){
  return { version: TORNEO_VERSION, creado: ahora, rondas: [], actual: null, tanda: 1 };
}

/* ── EMPEZAR UN TORNEO DE CERO ──
   Lo pidió E: al perder un match quiere volver a empezar, no seguir
   sumando rondas a un marcador que ya no le dice nada. Pero tirar el
   historial a la basura sería perder las notas y los mazos registrados,
   así que no se borra nada: se abre una TANDA nueva. El marcador y la
   numeración de las rondas cuentan solo la tanda en juego; el historial
   las enseña todas, separadas.
   Si había una ronda a medias se da por abandonada, igual que al salir. */
export function nuevaTanda(t, ahora = Date.now()){
  if(t.actual) cerrarRonda(t, ahora);
  t.tanda = (Number(t.tanda) || 1) + 1;
  return t.tanda;
}
export const tandaDe = r => Number(r?.tanda) || 1;
/* La clave con la que se guarda lo que cuelga de una ronda (los logs de
   sus partidas): la numeración se reinicia en cada tanda, así que el
   número solo no distingue la ronda 1 de un torneo de la del siguiente. */
export const claveRonda = r => `${tandaDe(r)}-${r?.numero ?? 0}`;

/* Un estado leído de localStorage puede venir de otra versión o roto: se
   sanea en vez de fiarse. Lo que no se entiende se descarta. */
export function sanearTorneo(t){
  if(!t || typeof t !== "object" || !Array.isArray(t.rondas)) return nuevoTorneo();
  const partidaOk = p => p && typeof p.gane === "boolean";
  const mazoOk = m => !m || (Array.isArray(m.main) && Array.isArray(m.side));
  const rondaOk = r => r && typeof r.miMazo === "string" && typeof r.mazoIA === "string"
                       && Array.isArray(r.partidas) && r.partidas.every(partidaOk)
                       && mazoOk(r.mio) && mazoOk(r.ia) && mazoOk(r.registro?.mio) && mazoOk(r.registro?.ia);
  return {
    version: TORNEO_VERSION,
    creado: Number(t.creado) || Date.now(),
    rondas: t.rondas.filter(rondaOk),
    actual: rondaOk(t.actual) ? t.actual : null,
    /* Los torneos guardados antes de que existieran las tandas son la
       tanda 1, y sus rondas también (`tandaDe` lo resuelve). */
    tanda: Number(t.tanda) || 1,
  };
}

export function marcador(ronda){
  const yo = ronda.partidas.filter(p => p.gane).length;
  return { yo, ia: ronda.partidas.length - yo };
}

export function rondaDecidida(ronda){
  const m = marcador(ronda);
  return m.yo >= GANA_MATCH || m.ia >= GANA_MATCH;
}

/* ── SIDE DECK ──
   En un torneo de verdad registras un mazo y entre partidas mueves cartas
   entre el main y el side. Lo que NO puedes es meter cartas que no
   registraste: la unión main+extra+side tiene que seguir siendo la misma
   de la primera partida. Eso es lo que comprueba `sideValido`. */
export const MAIN_MIN = 40, MAIN_MAX = 60, SIDE_MAX = 15;

export function multiset(cartas){
  const m = new Map();
  for(const c of cartas ?? []) m.set(c, (m.get(c) ?? 0) + 1);
  return m;
}
export function mismasCartas(a, b){
  const x = multiset(a), y = multiset(b);
  if(x.size !== y.size) return false;
  for(const [k, n] of x) if(y.get(k) !== n) return false;
  return true;
}
export function sideValido(registro, prop){
  if(!registro || !prop) return { ok:false, motivo:"faltan los mazos" };
  const n = prop.main?.length ?? 0, s = prop.side?.length ?? 0;
  if(n < MAIN_MIN) return { ok:false, motivo:`el Main tiene ${n}: hacen falta ${MAIN_MIN}` };
  if(n > MAIN_MAX) return { ok:false, motivo:`el Main tiene ${n}: el tope son ${MAIN_MAX}` };
  if(s > SIDE_MAX) return { ok:false, motivo:`el Side tiene ${s}: el tope son ${SIDE_MAX}` };
  const antes = [...(registro.main ?? []), ...(registro.extra ?? []), ...(registro.side ?? [])];
  const ahora = [...(prop.main ?? []), ...(prop.extra ?? registro.extra ?? []), ...(prop.side ?? [])];
  if(!mismasCartas(antes, ahora))
    return { ok:false, motivo:"no son las cartas que registraste al empezar la ronda" };
  return { ok:true };
}

/* Cambia el reparto main/side de la ronda en juego. Solo entre partidas:
   a mitad de un duelo no se toca nada. */
export function aplicarSide(t, lado, prop){
  const r = t.actual;
  if(!r) throw new Error("no hay ronda en juego");
  const reg = r.registro?.[lado];
  const v = sideValido(reg, prop);
  if(!v.ok) throw new Error(v.motivo);
  r[lado] = { main:[...prop.main], extra:[...(prop.extra ?? reg.extra ?? [])], side:[...prop.side] };
  return r[lado];
}

export function empezarRonda(t, { miMazo, mazoIA, nombreMio, nombreIA, nivel = "experto",
                                  mazos = null, ahora = Date.now() }){
  if(t.actual) throw new Error("ya hay una ronda en juego");
  if(!miMazo || !mazoIA) throw new Error("faltan los mazos");
  const copia = m => m ? { main:[...(m.main ?? [])], extra:[...(m.extra ?? [])], side:[...(m.side ?? [])] } : null;
  const tanda = Number(t.tanda) || 1;
  const yaJugadas = t.rondas.filter(r => tandaDe(r) === tanda).length;
  t.actual = { numero: yaJugadas + 1, tanda, miMazo, mazoIA,
               nombreMio: nombreMio ?? miMazo, nombreIA: nombreIA ?? mazoIA,
               nivel, empezada: ahora, partidas: [], notas: "",
               /* El mazo REGISTRADO (no cambia en toda la ronda) y el
                  reparto con el que se juega ahora mismo. */
               registro: { mio: copia(mazos?.mio), ia: copia(mazos?.ia) },
               mio: copia(mazos?.mio), ia: copia(mazos?.ia) };
  return t.actual;
}

/* ¿Empiezo yo la partida que toca? null = moneda (la primera). */
export function empiezoYo(t){
  const r = t.actual;
  if(!r || !r.partidas.length) return null;
  return !r.partidas[r.partidas.length - 1].gane;     // empieza quien perdió
}

export function apuntarPartida(t, { gane, empece = null, turnos = null, lpMio = null,
                                    lpRival = null, motivo = "", ahora = Date.now() }){
  const r = t.actual;
  if(!r) throw new Error("no hay ronda en juego");
  if(rondaDecidida(r)) throw new Error("la ronda ya está decidida");
  r.partidas.push({ gane: !!gane, empece, turnos, lpMio, lpRival, motivo, fecha: ahora });
  if(rondaDecidida(r)) cerrarRonda(t, ahora);
  return r;
}

export function cerrarRonda(t, ahora = Date.now()){
  const r = t.actual;
  if(!r) return null;
  const m = marcador(r);
  r.terminada = ahora;
  r.resultado = m.yo >= GANA_MATCH ? "victoria" : m.ia >= GANA_MATCH ? "derrota" : "abandonada";
  t.rondas.push(r);
  t.actual = null;
  return r;
}

export function abandonarRonda(t, ahora = Date.now()){
  return t.actual ? cerrarRonda(t, ahora) : null;
}

/* Números del torneo entero y por mazo: lo que sirve para entrenar. */
/* El marcador es el de la tanda EN JUEGO: un torneo nuevo empieza a
   cero. Lo de antes sigue guardado y sale en el historial. */
export function estadisticas(t){
  const tanda = Number(t.tanda) || 1;
  const suyas = t.rondas.filter(r => tandaDe(r) === tanda);
  const rondas = [...suyas, ...(t.actual ? [t.actual] : [])];
  const s = { matches:{ ganados:0, perdidos:0, abandonados:0 },
              partidas:{ ganadas:0, perdidas:0 },
              empezando:{ ganadas:0, jugadas:0 }, robando:{ ganadas:0, jugadas:0 },
              cruces: {} };
  for(const r of suyas){
    if(r.resultado === "victoria") s.matches.ganados++;
    else if(r.resultado === "derrota") s.matches.perdidos++;
    else s.matches.abandonados++;
  }
  for(const r of rondas){
    const clave = `${r.nombreMio} vs ${r.nombreIA}`;
    const c = s.cruces[clave] ??= { ganadas:0, perdidas:0 };
    for(const p of r.partidas){
      p.gane ? (s.partidas.ganadas++, c.ganadas++) : (s.partidas.perdidas++, c.perdidas++);
      const lado = p.empece === true ? s.empezando : p.empece === false ? s.robando : null;
      if(lado){ lado.jugadas++; if(p.gane) lado.ganadas++; }
    }
  }
  return s;
}

/* Resumen en texto para pegar en las notas o mandárselo a Claude. */
export function resumenTexto(t, T = x => x){
  const s = estadisticas(t);
  const pct = (a, b) => b ? `${Math.round(a / b * 100)}%` : "—";
  const fecha = ms => ms ? new Date(ms).toISOString().slice(0, 16).replace("T", " ") : "";
  const l = [];
  l.push(`GOAT FORMAT — ${T("Torneo meta")} (Bo3)`);
  l.push(`${T("Matches")}: ${s.matches.ganados}-${s.matches.perdidos}` +
         (s.matches.abandonados ? ` (${s.matches.abandonados} ${T("abandonados")})` : ""));
  l.push(`${T("Partidas")}: ${s.partidas.ganadas}-${s.partidas.perdidas} · ` +
         `${T("empezando")} ${pct(s.empezando.ganadas, s.empezando.jugadas)} · ` +
         `${T("robando")} ${pct(s.robando.ganadas, s.robando.jugadas)}`);
  l.push("");
  const todas = [...t.rondas, ...(t.actual ? [t.actual] : [])];
  let tandaEscrita = null;
  for(const r of todas){
    /* El resumen lleva TODO lo jugado, tanda a tanda: el marcador de
       arriba es solo el del torneo en juego. */
    if(tandaDe(r) !== tandaEscrita){
      tandaEscrita = tandaDe(r);
      if(todas.some(x => tandaDe(x) !== 1)) l.push(`── ${T("Torneo")} ${tandaEscrita} ──`);
    }
    const m = marcador(r);
    const estado = r.resultado ? T(r.resultado) : T("en juego");
    l.push(`${T("Ronda")} ${r.numero} · ${r.nombreMio} vs ${r.nombreIA} · ${m.yo}-${m.ia} · ${estado} · ${fecha(r.empezada)}`);
    r.partidas.forEach((p, i) => {
      const quien = p.empece === true ? T("empiezo yo") : p.empece === false ? T("empieza la IA") : "";
      l.push(`   ${i + 1}. ${p.gane ? T("gano") : T("pierdo")}` +
             (quien ? ` · ${quien}` : "") +
             (p.turnos != null ? ` · ${p.turnos} ${T("turnos")}` : "") +
             (p.lpMio != null ? ` · LP ${p.lpMio}/${p.lpRival}` : "") +
             (p.motivo ? ` · ${p.motivo}` : ""));
    });
    if(r.notas?.trim()) l.push(`   ${T("Notas")}: ${r.notas.trim().replace(/\n/g, "\n          ")}`);
    l.push("");
  }
  return l.join("\n");
}
