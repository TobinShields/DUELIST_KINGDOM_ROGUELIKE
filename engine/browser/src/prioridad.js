/* ══ LA VENTANA DE PRIORIDAD DEL JUGADOR HUMANO ══
   Tras invocar, el motor ofrece primero al jugador del turno el efecto de
   ignición del monstruo recién invocado (MODE_GOAT, OBSOLETE_IGNITION; ver
   check-prioridad.mjs). Esta función dice si una pregunta es ESA ventana,
   para que el modo de cadenas «auto» no se la salte.

   Pura a propósito (no lee el duelo): main.js le pasa lo que hace falta y
   check-prioridad.mjs la prueba sin montar la interfaz. */
export function esVentanaDePrioridad(q, { tipoCadena, yo, turnPlayer, turnCount, ultimaInvocada, cadenaActiva, uidEn }){
  if(!q || q.type !== tipoCadena || q.forced || cadenaActiva) return false;
  const ui = ultimaInvocada;
  if(!ui || ui.turno !== turnCount || turnPlayer !== yo) return false;
  return (q.selects || []).some(s => s.location === 4 && s.controller === yo && uidEn(s) === ui.uid);
}

/* ══ DOS DISPARADORES A LA VEZ LLEGAN COMO UNA VENTANA DE CADENA ══
   E, 03-10 (Reino, T45-46): «no me ha dado la opción de tapear el
   Little-Winguard». Tenía DOS en la mesa. Con un solo disparador opcional
   el motor pregunta sí/no (SELECT_EFFECTYN); con dos a la vez los ofrece
   en un SELECT_CHAIN con `spe_count` > 0 para que elijas cuál y en qué
   orden. El modo «auto» lo tomaba por una ventana propia sin cadena y la
   saltaba. Esas ventanas no son responder a nada: son tus efectos. */
export function hayDisparadoresPendientes(q){
  return (Number(q?.spe_count) || 0) > 0;
}
