/* ══════════════════════════════════════════════════════════════════
   EL ESTADO DE LA RUN — Y SU GUARDADO

   Una run dura entre media hora y tres cuartos, así que se guarda
   después de CADA acción que cambie algo. No hay servidor ni cuenta:
   todo cabe en localStorage, y se puede exportar e importar como JSON
   para llevárselo a otro navegador.

   Star Chips: son a la vez el progreso del torneo (juntar 10 para entrar
   al castillo) y las vidas de la run (a cero, se acabó). Esa doble
   función es lo que hace que perder duela sin borrar media hora de
   trabajo de un golpe.

   OJO CON UNA COSA: una vez que has TOCADO los diez, la clasificación no
   se pierde aunque luego bajes. Si no, perder un duelo dentro del
   castillo te echaba del castillo, que no tiene ningún sentido.
   ══════════════════════════════════════════════════════════════════ */
import { CHIPS } from "./balance.js";
import { crearRng, estadoDeSemilla, semillaTexto } from "./rng.js";
import { generarMapa } from "./mapa.js";

export const ESQUEMA = 1;
export const CLAVES = {
  meta:      "goat.story.meta.v1",
  run:       "goat.story.run.v1",
  ajustes:   "goat.story.settings.v1",
};

/* El almacén se inyecta: en el navegador es localStorage y en las
   pruebas un objeto de mentira. Así el guardado se puede probar sin
   navegador, que es como se prueba todo lo demás en este proyecto. */
export function crearAlmacen(store){
  const s = store ?? (typeof localStorage!=="undefined" ? localStorage : null);
  return {
    leer(clave){
      try{ const t = s?.getItem(clave); return t ? JSON.parse(t) : null; }
      catch(e){ return null; }
    },
    escribir(clave, valor){
      try{ s?.setItem(clave, JSON.stringify(valor)); return true; }
      catch(e){ return false; }      // cuota llena o navegador en privado
    },
    borrar(clave){ try{ s?.removeItem(clave); }catch(e){} },
  };
}

/* ── empezar ── */
export function nuevaRun({ semilla, personaje="yugi", starter, maestria=0, pasivo=null } = {}){
  const texto = semilla ?? semillaTexto();
  const rng = crearRng(estadoDeSemilla(texto));
  /* El personaje entra en la generación porque decide la TORRE: el orden
     del castillo es fijo menos tú, así que el mapa no se puede montar
     sin saber a quién estás jugando. */
  const mapa = generarMapa(rng, personaje);
  return {
    esquema: ESQUEMA,
    semilla: texto,
    azar: rng.estado(),          // se guarda el estado, no la semilla: la run continúa donde iba
    personaje, starter, maestria, pasivo,
    mapa,
    pos: { acto:0, col:-1, id:null },   // col -1 = aún no has pisado nada
    resueltos: [],               // ids de nodos ya jugados
    chips: CHIPS.inicio,
    clasificado: false,          // ¿has tocado los 10 alguna vez?
    chipsPerdidos: 0,            // los que el campamento puede devolverte
    binder: [],                  // cartas sueltas de la run (passcodes)
    binderExtra: [],             // fusiones
    mazo: { main:[], extra:[] },
    buffs: { lpExtra:0, duelosBuff:0 },
    derrotados: [],              // personajes ya vencidos, para no repetirlos sin sentido
    historial: [],               // {nodo, tipo, resultado} — hace falta para el determinismo
    terminada: false,
    empezada: Date.now(),
  };
}

/* ── el generador de la run, con su estado dentro ──
   Cada vez que se pide azar se guarda el estado nuevo en la run: si el
   jugador cierra el navegador entre dos nodos, al volver el hilo sigue
   exactamente donde estaba y el mapa/packs no cambian. */
export function azarDe(run){
  const rng = crearRng(run.azar);
  const envuelto = (...args) => { const v = rng(...args); run.azar = rng.estado(); return v; };
  for(const k of ["entero","entre","uno","barajar","pesado","coger"])
    envuelto[k] = (...args) => { const v = rng[k](...args); run.azar = rng.estado(); return v; };
  envuelto.estado = () => rng.estado();
  return envuelto;
}

/* ══════════ STAR CHIPS ══════════ */
export function apuestaDe(tipo, altaApuesta=false){
  if(altaApuesta) return CHIPS.altaApuesta;
  if(tipo==="ELITE") return CHIPS.elite;
  if(tipo==="JEFE")  return CHIPS.jefe;
  return CHIPS.duelo;
}

/* Resolver un duelo. Devuelve qué ha pasado para que la interfaz lo
   cuente; NO decide si la run sigue: eso lo dice `terminada`. */
export function resolverDuelo(run, { tipo="DUELO", ganado, altaApuesta=false, torre=false }){
  const reglas = torre ? CHIPS.torre : apuestaDe(tipo, altaApuesta);
  /* Nunca se apuesta más de lo que tienes. Con 1 chip no puedes entrar
     en una apuesta doble: quedarte a deber fichas no significa nada. */
  const puedeAlta = run.chips >= CHIPS.altaApuesta.apuesta;
  const r = (!torre && altaApuesta && !puedeAlta) ? apuestaDe(tipo, false) : reglas;

  const antes = run.chips;
  run.chips = Math.max(0, run.chips + (ganado ? r.gana : r.pierde));
  if(!ganado) run.chipsPerdidos += Math.max(0, antes - run.chips);

  /* La clasificación se toca una vez y ya no se pierde. */
  if(!run.clasificado && run.chips >= CHIPS.meta){
    run.clasificado = true;
    /* Llegar a las diez fichas es el hito de mitad de partida: cuántos
       lo alcanzan contra cuántos empiezan es la cifra que dice si la
       isla está bien calibrada. */
    globalThis.__TELE__?.castillo();
  }
  if(run.chips <= 0){
    run.terminada = true;
    /* Quedarse a cero fichas es la forma NORMAL de acabar una run: si
       solo se contara la victoria y el abandono, la estadística diría
       que casi nadie termina. Aquí se apunta en qué acto se cayó. */
    globalThis.__TELE__?.runTermina(false, run.pos?.acto ?? 0, 0);
  }
  return { antes, ahora:run.chips, ganado, clasificado:run.clasificado,
           eliminado:run.terminada, apuesta:r };
}

/* El campamento solo devuelve una ficha que hayas perdido de verdad. */
export function recuperarChip(run){
  if(run.chipsPerdidos <= 0) return false;
  run.chipsPerdidos -= 1;
  run.chips += 1;
  if(!run.clasificado && run.chips >= CHIPS.meta){
    run.clasificado = true;
    /* Llegar a las diez fichas es el hito de mitad de partida: cuántos
       lo alcanzan contra cuántos empiezan es la cifra que dice si la
       isla está bien calibrada. */
    globalThis.__TELE__?.castillo();
  }
  return true;
}

/* ¿Puedo entrar al castillo? Y si no, ¿me queda alguna forma de
   conseguirlo? La segunda pregunta es la que evita el atasco: si llegas
   vivo a la puerta sin diez fichas, el mapa tiene que darte duelos de
   última oportunidad hasta que sea matemáticamente posible. */
export function puertaDelCastillo(run, chipsAlcanzablesDesdeAqui){
  if(run.clasificado) return { pasa:true };
  if(run.chips <= 0)  return { pasa:false, motivo:"eliminado" };
  const alcanzable = run.chips + chipsAlcanzablesDesdeAqui;
  return { pasa:false, motivo:"faltan fichas",
           ultimaOportunidad: alcanzable < CHIPS.meta,
           faltan: CHIPS.meta - run.chips };
}

/* ══════════ GUARDADO ══════════ */
export function guardar(almacen, run){
  return almacen.escribir(CLAVES.run, run);
}
export function cargar(almacen){
  const run = almacen.leer(CLAVES.run);
  if(!run) return null;
  return migrar(run);
}
export function borrarRun(almacen){ almacen.borrar(CLAVES.run); }

/* Migraciones. Hoy solo hay un esquema, pero el hueco existe desde el
   principio: la alternativa es que un guardado viejo reviente sin
   avisar en cuanto se toque la forma del estado. */
export function migrar(run){
  if(!run || typeof run !== "object") return null;
  let v = run.esquema ?? 0;
  if(v === 0){ run.esquema = 1; v = 1; }        // primera versión guardada sin número
  if(v > ESQUEMA) return null;                  // guardado de una versión MÁS nueva: no se toca
  return run;
}

/* Meta-progreso: lo que sobrevive a la run (maestrías desbloqueadas). */
export function cargarMeta(almacen){
  const m = almacen.leer(CLAVES.meta) ?? { esquema:ESQUEMA, maestria:{}, runsGanadas:0 };
  m.maestria = m.maestria ?? {};
  return m;
}
export function guardarMeta(almacen, meta){ almacen.escribir(CLAVES.meta, meta); }

/* ══ LA MAESTRÍA SUBE UNA VEZ POR RUN ══
   El tope es alto pero el guardarraíl importa: `run.contada` marca que
   ESTA run ya sumó. Sin él, recargar la página en la pantalla de
   victoria —o volver a entrar en el nodo de Pegasus— subía el nivel
   otra vez, y en tres recargas tenías todos los pasivos.
   Cada victoria suma UNO, no salta al tope: la progresión es la gracia. */
export const MAESTRIA_MAX = 3;
export function apuntarVictoriaFinal(almacen, run){
  const meta = cargarMeta(almacen);
  if(run.contada) return meta;                 // esta run ya sumó
  run.contada = true;
  meta.runsGanadas = (meta.runsGanadas ?? 0) + 1;
  const p = run.personaje ?? "yugi";
  meta.maestria = meta.maestria ?? {};
  meta.maestria[p] = Math.min(MAESTRIA_MAX, (meta.maestria[p] ?? 0) + 1);
  guardarMeta(almacen, meta);
  return meta;
}

/* ── llevárselo a otro navegador ──
   OJO CON EL NOMBRE: se llamaban `exportar` e `importar` y historia.js
   los traía con alias (`exportar as exportarEstado`). `build-html.mjs`
   BORRA los imports y concatena todo en un mismo ámbito, así que el
   alias desaparecía y en el navegador salía "importarEstado is not
   defined" al pulsar Importar progreso — mientras el test en node daba
   verde, porque ahí sí son módulos de verdad. Nombres únicos y sin
   alias: es la única forma de que el empaquetado no mienta. */
export function exportarProgreso(almacen){
  return JSON.stringify({
    exportado: new Date().toISOString(),
    esquema: ESQUEMA,
    meta: cargarMeta(almacen),
    run: almacen.leer(CLAVES.run),
    ajustes: almacen.leer(CLAVES.ajustes),
  }, null, 1);
}
/* ══════════════════════════════════════════════════════════════════
   IMPORTAR SIN ROMPER LO QUE YA TIENES

   El juego vive en GitHub Pages: no hay cuenta ni servidor, así que un
   archivo es la única forma de llevarse el progreso a otro navegador. Y
   por eso mismo importar tiene que ser SEGURO: si el archivo está roto,
   lo que no puede pasar es quedarse sin lo que ya había.

   Se valida TODO antes de escribir nada. Si algo no cuadra se devuelve
   el motivo y no se toca el almacén. */
export function importarProgreso(almacen, texto){
  let d;
  try{ d = JSON.parse(texto); }catch(e){ return { ok:false, error:"El archivo no es JSON válido" }; }
  if(!d || typeof d !== "object") return { ok:false, error:"El archivo no tiene lo que hace falta" };
  if((d.esquema ?? 0) > ESQUEMA)
    return { ok:false, error:"Ese guardado es de una versión más nueva del juego" };
  if(!d.meta && !d.run)
    return { ok:false, error:"El archivo no lleva ni progreso ni partida" };

  /* La maestría: un objeto de números entre 0 y el tope. Un archivo
     manipulado no puede regalar niveles imposibles. */
  let meta = null;
  if(d.meta){
    if(typeof d.meta !== "object") return { ok:false, error:"El progreso del archivo está corrupto" };
    const m = {};
    for(const [k,v] of Object.entries(d.meta.maestria ?? {})){
      const n = Number(v);
      if(!Number.isInteger(n) || n < 0)
        return { ok:false, error:`El progreso de "${k}" no es un número válido` };
      m[k] = Math.min(MAESTRIA_MAX, n);
    }
    meta = { esquema:ESQUEMA, maestria:m,
             runsGanadas: Math.max(0, Number(d.meta.runsGanadas ?? 0) || 0) };
    /* ══ Y EL HISTORIAL, QUE TAMBIÉN ES PROGRESO ══
       Esto reconstruía el meta desde cero con solo la maestría, así que
       al importar en otro navegador se perdían todas las estadísticas y
       los logros. Se copia entero pero SANEADO: los números tienen que
       ser números, o un archivo manipulado mete cualquier cosa en la
       pantalla del historial. */
    if(d.meta.record && typeof d.meta.record === "object"){
      const num = v2 => { const n2 = Number(v2); return Number.isFinite(n2) && n2 >= 0 ? n2 : 0; };
      const src = d.meta.record;
      const objDeNumeros = o => Object.fromEntries(
        Object.entries(o ?? {}).filter(([k]) => typeof k === "string")
              .map(([k, v2]) => [k, num(v2)]));
      meta.record = {
        runs:num(src.runs), completadas:num(src.completadas),
        rendidas:num(src.rendidas), perdidas:num(src.perdidas),
        duelos:num(src.duelos), victorias:num(src.victorias), derrotas:num(src.derrotas),
        chips:num(src.chips), sobres:num(src.sobres), encuentros:num(src.encuentros),
        cartas: { total:num(src.cartas?.total), monstruo:num(src.cartas?.monstruo),
                  magica:num(src.cartas?.magica), trampa:num(src.cartas?.trampa) },
        porPersonaje: Object.fromEntries(Object.entries(src.porPersonaje ?? {})
          .map(([k, v2]) => [k, { runs:num(v2?.runs), victorias:num(v2?.victorias),
                                  duelos:num(v2?.duelos), ganados:num(v2?.ganados) }])),
        clearsPorPasivo: objDeNumeros(src.clearsPorPasivo),
        /* Los logros son banderas: solo `true`, nada más. */
        logros: Object.fromEntries(Object.entries(src.logros ?? {})
          .filter(([,v2]) => v2 === true)),
      };
    }
  }

  /* La run: tiene que traer mapa y semilla o no se puede continuar. */
  let run = null;
  if(d.run){
    run = migrar(d.run);
    if(!run || !run.mapa?.actos?.length || !run.semilla)
      return { ok:false, error:"La partida guardada del archivo no se puede leer" };
  }

  /* Todo validado: ahora sí se escribe. */
  if(meta) guardarMeta(almacen, meta);
  if(run)  almacen.escribir(CLAVES.run, run);
  if(d.ajustes && typeof d.ajustes === "object") almacen.escribir(CLAVES.ajustes, d.ajustes);
  return { ok:true, conRun: !!run,
           maestrias: meta ? Object.entries(meta.maestria).filter(([,v])=>v>0).length : 0 };
}
