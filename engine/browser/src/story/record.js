/* ══════════════════════════════════════════════════════════════════
   EL HISTORIAL DEL DUELISTA

   Todo lo que sobrevive a las runs y no es maestría: cuántas has
   empezado, cuántas has terminado, con quién, cuántos duelos, cuántos
   sobres, cuántas cartas has jugado. Vive dentro del MISMO objeto `meta`
   que la maestría por una razón concreta: `exportarProgreso` guarda
   `meta` entero y `importarProgreso` lo valida entero, así que las
   estadísticas viajan con el archivo sin tocar nada de eso.

   ══ DOS COSAS QUE HAY QUE HACER BIEN ══

   1 · CONTAR UNA VEZ. La maestría ya tuvo este bug: recargar la página
   en la pantalla de victoria volvía a sumarla. Aquí pasa igual con las
   runs ganadas, así que cada apunte que se pueda repetir lleva su marca
   en la RUN (`run.contada`, `run.contadaEmpezada`), no en el meta.

   2 · NO INVENTAR TOTALES. El porcentaje de completado solo cuenta
   objetivos FINITOS —hay 6 personajes, 3 ventajas cada uno, 5 starters
   del Custom— porque un porcentaje sobre algo infinito no significa
   nada y nunca llega al 100%.
   ══════════════════════════════════════════════════════════════════ */

export const RECORD_VACIO = () => ({
  runs: 0, completadas: 0, rendidas: 0, perdidas: 0,
  duelos: 0, victorias: 0, derrotas: 0,
  chips: 0, sobres: 0, encuentros: 0,
  cartas: { total:0, monstruo:0, magica:0, trampa:0 },
  porPersonaje: {},          // id → { runs, victorias, duelos, ganados }
  clearsPorPasivo: {},       // id del pasivo → cuántas veces has ganado con él
  logros: {},                // id → true
});

/* El hueco del personaje, creado a demanda. */
function deQuien(rec, quien){
  const q = quien ?? "yugi";
  rec.porPersonaje[q] = rec.porPersonaje[q] ?? { runs:0, victorias:0, duelos:0, ganados:0 };
  return rec.porPersonaje[q];
}
export function recordDe(meta){
  meta.record = { ...RECORD_VACIO(), ...(meta.record ?? {}) };
  meta.record.cartas = { ...RECORD_VACIO().cartas, ...(meta.record.cartas ?? {}) };
  meta.record.porPersonaje = meta.record.porPersonaje ?? {};
  meta.record.clearsPorPasivo = meta.record.clearsPorPasivo ?? {};
  meta.record.logros = meta.record.logros ?? {};
  return meta.record;
}

/* ── los apuntes ── */
export function apuntarRunEmpezada(meta, run){
  if(run.contadaEmpezada) return;              // recargar no cuenta otra vez
  run.contadaEmpezada = true;
  const r = recordDe(meta);
  r.runs++;
  deQuien(r, run.personaje).runs++;
}
export function apuntarDuelo(meta, run, { ganado }){
  const r = recordDe(meta);
  r.duelos++;
  if(ganado) r.victorias++; else r.derrotas++;
  const p = deQuien(r, run?.personaje);
  p.duelos++; if(ganado) p.ganados++;
}
export function apuntarRunTerminada(meta, run, { ganada, rendida }){
  if(run.contadaFinal) return;
  run.contadaFinal = true;
  const r = recordDe(meta);
  if(ganada){
    r.completadas++;
    deQuien(r, run.personaje).victorias++;
    if(run.pasivo) r.clearsPorPasivo[run.pasivo] = (r.clearsPorPasivo[run.pasivo] ?? 0) + 1;
  }
  else if(rendida) r.rendidas++;
  else r.perdidas++;
}
export function apuntarChips(meta, n){ if(n > 0) recordDe(meta).chips += n; }
export function apuntarSobre(meta){ recordDe(meta).sobres++; }
export function apuntarEncuentro(meta){ recordDe(meta).encuentros++; }
/* Qué se ha jugado, por categoría. Lo llama la interfaz del duelo cuando
   el adaptador dice que alguien ha activado o invocado algo TUYO. */
export function apuntarCarta(meta, categoria){
  const r = recordDe(meta);
  r.cartas.total++;
  const k = String(categoria ?? "").toLowerCase();
  if(k.startsWith("mon")) r.cartas.monstruo++;
  else if(k.startsWith("tra")) r.cartas.trampa++;
  else r.cartas.magica++;
}

/* ══════════════════════════════════════════════════════════════════
   LOS LOGROS

   Pocos y concretos. Cada uno se comprueba contra el estado, no se
   "otorga" desde ningún sitio: así no hay forma de que se pierdan al
   recargar ni de que se den dos veces.
   ══════════════════════════════════════════════════════════════════ */
export const LOGROS = [
  { id:"primer-torneo", nombre:"Campeón del Reino",
    desc:"Gana el torneo por primera vez.",
    cumple: (r) => r.completadas >= 1 },
  { id:"los-cinco", nombre:"Los cinco duelistas",
    desc:"Gana el torneo con los cinco protagonistas.",
    cumple: (r) => ["yugi","joey","mai","keith","kaiba"]
      .every(q => (r.porPersonaje[q]?.victorias ?? 0) >= 1) },
  { id:"libre", nombre:"Nadie sabe quién eres",
    desc:"Gana el torneo con el Duelista libre.",
    cumple: (r) => (r.porPersonaje.custom?.victorias ?? 0) >= 1 },
  { id:"maestria-total", nombre:"Maestría completa",
    desc:"Desbloquea las tres ventajas de un duelista.",
    cumple: (r, meta) => Object.values(meta.maestria ?? {}).some(v => v >= 3) },
  { id:"con-las-tres", nombre:"De las tres maneras",
    desc:"Gana el torneo una vez con cada una de las tres ventajas.",
    cumple: (r) => ["carta-de-maestro","primer-sobre","mano-firme"]
      .every(p => (r.clearsPorPasivo[p] ?? 0) >= 1) },
  { id:"cien-duelos", nombre:"Veterano de la isla",
    desc:"Juega cien duelos en el modo historia.",
    cumple: (r) => r.duelos >= 100 },
  { id:"coleccionista", nombre:"Coleccionista",
    desc:"Abre cincuenta sobres.",
    cumple: (r) => r.sobres >= 50 },
  { id:"sin-perder", nombre:"Sin una sola derrota",
    desc:"Gana el torneo sin perder ni un duelo.",
    cumple: (r) => !!r.logros.sinPerder },
];
export function revisarLogros(meta){
  const r = recordDe(meta);
  const nuevos = [];
  for(const l of LOGROS){
    if(r.logros[l.id]) continue;
    let ok = false;
    try{ ok = !!l.cumple(r, meta); }catch(e){ ok = false; }
    if(ok){ r.logros[l.id] = true; nuevos.push(l); }
  }
  return nuevos;
}

/* ══ EL PORCENTAJE, SOBRE OBJETIVOS FINITOS ══
   6 duelistas × (ganarlo una vez) + 3 ventajas × 6 + los logros. Nada
   de "cartas coleccionadas sobre 1.685", que nunca se completa y no
   dice nada. */
export function completado(meta, datos){
  const r = recordDe(meta);
  const jugables = (datos?.jugables ?? []).map(j => j.id);
  const metas = [];
  for(const q of jugables)
    metas.push({ que:`Gana el torneo con ${q}`, hecho:(r.porPersonaje[q]?.victorias ?? 0) >= 1 });
  for(const q of jugables)
    metas.push({ que:`Maestría 3 con ${q}`, hecho:(meta.maestria?.[q] ?? 0) >= 3 });
  for(const l of LOGROS)
    metas.push({ que:l.nombre, hecho:!!r.logros[l.id] });
  const hechos = metas.filter(m => m.hecho).length;
  return { hechos, total:metas.length,
           pct: metas.length ? Math.round(hechos * 100 / metas.length) : 0,
           metas };
}
