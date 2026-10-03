/* ══════════════════════════════════════════════════════════════════
   LA COLECCIÓN DE LA RUN — BINDER Y MAZO

   Dos montones: el BINDER, donde cae todo lo que ganas, y el MAZO, que
   es lo que llevas al duelo. Las recompensas NUNCA entran solas en el
   mazo: eso es decisión del jugador y se toma en el editor, que está
   disponible desde el mapa en todo momento.

   La regla dura es la misma que en el deck builder del simulador:
   40-60 cartas, 15 de Extra y el tope de copias de abril de 2005. Si el
   modo historia se saltara eso, el duelo arrancaría con un mazo ilegal
   y el motor se quejaría en medio de la partida.
   ══════════════════════════════════════════════════════════════════ */

export const LIMITES_MAZO = { min:40, max:60, extra:15 };

const cuenta = lista => {
  const m = new Map();
  for(const c of lista) m.set(c, (m.get(c) ?? 0) + 1);
  return m;
};

/* ── binder ── */
/* ══════════════════════════════════════════════════════════════════
   EL ORDEN DE UNA LISTA DE CARTAS

   Monstruos, mágicas y trampas; dentro de cada grupo, alfabético. Es el
   orden en el que se lee una decklist de verdad y el único que permite
   encontrar una carta sin repasar las cuarenta.

   Antes las listas iban en ORDEN DE ENTRADA: metías una carta y
   aparecía al final, la sacabas y la de al lado cambiaba de sitio. Con
   sesenta cartas eso no es una lista, es un montón.

   Se ordena en `coleccion.js` y no en la pantalla a propósito: así el
   orden es el mismo en el binder, en el rastreador y en lo que se le
   pasa al motor, y no hay dos verdades. */
const ORDEN_TIPO = { MONSTRUO:0, MAGICA:1, TRAMPA:2 };
export function ordenar(lista, cat){
  return [...lista].sort((a,b) =>
    (ORDEN_TIPO[cat.categoria(a)] ?? 9) - (ORDEN_TIPO[cat.categoria(b)] ?? 9) ||
    String(cat.nombre(a)).localeCompare(String(cat.nombre(b))) ||
    a - b);
}
/* Reordena TODAS las listas de la run de una vez. Se llama después de
   cualquier movimiento: es más barato que acordarse de cuál tocar. */
export function reordenarTodo(run, cat){
  if(!run || !cat) return run;
  run.mazo.main   = ordenar(run.mazo.main, cat);
  run.mazo.extra  = ordenar(run.mazo.extra, cat);
  run.binder      = ordenar(run.binder, cat);
  run.binderExtra = ordenar(run.binderExtra ?? [], cat);
  return run;
}

export function alBinder(run, cartas, cat){
  const nuevas = [];
  for(const c of [].concat(cartas)){
    if(cat.vaAlExtra(c)) run.binderExtra.push(c);
    else                 run.binder.push(c);
    nuevas.push(c);
  }
  reordenarTodo(run, cat);
  return nuevas;
}

/* Cuántas copias tienes EN TOTAL (binder + mazo). Es lo que decide si
   una carta puede volver a salir de premio: ofrecerte la cuarta copia de
   algo es ofrecerte nada. */
export function copiasQueTengo(run, code){
  const en = l => l.filter(x => x === code).length;
  return en(run.binder) + en(run.binderExtra) + en(run.mazo.main) + en(run.mazo.extra);
}
export function puedoTenerMas(run, code, cat){
  return copiasQueTengo(run, code) < cat.tope(code);
}

/* ── mazo ── */
export function meterEnMazo(run, code, cat){
  const zona = cat.vaAlExtra(code) ? "extra" : "main";
  const origen = cat.vaAlExtra(code) ? run.binderExtra : run.binder;
  const i = origen.indexOf(code);
  if(i < 0) return { ok:false, motivo:"no la tienes en el binder" };
  const enMazo = run.mazo[zona].filter(x=>x===code).length;
  if(enMazo >= cat.tope(code))
    return { ok:false, motivo:`ya llevas el máximo de copias (${cat.tope(code)})` };
  if(zona === "extra" && run.mazo.extra.length >= LIMITES_MAZO.extra)
    return { ok:false, motivo:"el Extra Deck está lleno" };
  if(zona === "main" && run.mazo.main.length >= LIMITES_MAZO.max)
    return { ok:false, motivo:`el mazo no puede pasar de ${LIMITES_MAZO.max}` };
  origen.splice(i, 1);
  run.mazo[zona].push(code);
  reordenarTodo(run, cat);       // el orden se mantiene siempre
  return { ok:true };
}

export function sacarDelMazo(run, code, cat){
  const zona = cat.vaAlExtra(code) ? "extra" : "main";
  const i = run.mazo[zona].indexOf(code);
  if(i < 0) return { ok:false, motivo:"no está en el mazo" };
  run.mazo[zona].splice(i, 1);
  (cat.vaAlExtra(code) ? run.binderExtra : run.binder).push(code);
  reordenarTodo(run, cat);
  return { ok:true };
}

/* ¿Se puede jugar con esto? Devuelve la lista de motivos, vacía si sí.
   Se llama antes de lanzar cualquier duelo del modo historia: es la
   frontera con el motor. */
export function revisarMazo(run, cat){
  const problemas = [];
  const { main, extra } = run.mazo;
  if(main.length < LIMITES_MAZO.min) problemas.push(`Te faltan ${LIMITES_MAZO.min - main.length} cartas para las ${LIMITES_MAZO.min}`);
  if(main.length > LIMITES_MAZO.max) problemas.push(`Te sobran ${main.length - LIMITES_MAZO.max} cartas`);
  if(extra.length > LIMITES_MAZO.extra) problemas.push(`El Extra Deck pasa de ${LIMITES_MAZO.extra}`);
  for(const [c, n] of cuenta([...main, ...extra])){
    const max = cat.tope(c);
    if(n > max) problemas.push(`${cat.nombre(c)}: llevas ${n} y el límite es ${max}`);
  }
  return problemas;
}

/* Montar el mazo inicial: el starter entra ENTERO al mazo, no al binder.
   Es la única vez que las cartas se colocan solas, y tiene sentido:
   empezar con 40 cartas sueltas y montarlas a mano no es una decisión
   interesante, es una tarea. */
export function ponerStarter(run, deck, cat){
  run.mazo = { main:[...deck.main], extra:[...deck.extra] };
  if(cat) reordenarTodo(run, cat);
  return run.mazo;
}

/* Lo que el modo historia le pasa al motor. Aquí se acaba la historia y
   empieza el simulador de siempre. */
export function mazoParaDuelo(run){
  return { deck:[...run.mazo.main], extra:[...run.mazo.extra] };
}
