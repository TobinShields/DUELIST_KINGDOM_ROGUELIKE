/* ════════════════════════════════════════════════════════════════
   CONTEXTO ESTRATÉGICO — qué clase de partida es ESTA

   E, 20-09: «quiero que la IA entienda conceptos y posiciones, no una
   colección de excepciones». Este módulo es la capa que faltaba entre la
   lectura numérica del tablero (`posicion.js`: relojes, ventaja, amenaza)
   y la nota de cada jugada (`brain.js`). Se calcula UNA vez por decisión
   y lo consultan todas las reglas, así que un mismo principio del formato
   vale para cualquier carta que encaje en él.

   Cada señal sale de un principio de los artículos de TCGplayer y
   YGOPRODeck sobre Goat (ver docs/ESTRATEGIA-GOAT.md, con la cadena
   PRINCIPIO → REGLA → SEÑAL → EFECTO de cada una):

     rol           «Who's the Beatdown?»: con menos recursos útiles que el
                   rival, o sin poder aguantarle, eres tú quien ataca;
                   con ventaja, controlas y simplificas.
     fase          apertura / medio / final / topdeck: la misma carta vale
                   distinto según lo que quede por delante («el valor de
                   una carta cambia de turno en turno»).
     valorFuturo   cuánto pesa guardar una carta: alto en apertura, casi
                   nada en una guerra de topdeck.
     riesgoTrampa  probabilidad de que su backrow tapado tenga una trampa
                   de batalla, descontando lo que ya ha gastado.
     riesgoBarrido lo mismo para lo que castiga EXTENDERSE (Torrential,
                   Mirror Force).
     dominio       ya tengo en mesa un atacante que nada suyo boca arriba
                   para: un monstruo más aporta poco y arriesga mucho.
     simplificar   voy por delante: los cambios 1-por-1 me favorecen.
     chaos         LIGHT/DARK en mi cementerio (BLS y Chaos Sorcerer).

   Solo usa información legal: la vista (`vistaDe`) ya no deja pasar lo
   oculto, y aquí no se mira nada que no esté en ella.
   ════════════════════════════════════════════════════════════════ */
import { atk, poder, valorCarta } from "./evaluar.js";
import { canon } from "./knowledge.js";

const ATR_LUZ = 16, ATR_OSCURO = 32;
const TRAMPAS_BATALLA = ["Mirror Force", "Sakuretsu Armor", "Torrential Tribute", "Ring of Destruction",
                         "Waboku", "Negate Attack", "Magic Cylinder", "Dimension Wall", "Book of Moon"];
const BARRIDOS = ["Torrential Tribute", "Mirror Force"];

/* Cuántas de una carta ha gastado ya (cementerio o desterradas): es
   información pública, y lo que ya salió no puede volver a salir sin
   reciclaje (el formato juega casi todo a 1). */
const gastadasRival = (v, nombres) => [...(v.cementerioRival ?? []), ...(v.desterradasRival ?? [])]
  .filter(c => nombres.includes(canon(c?.nombre ?? ""))).length;

export function contextoEstrategico(v, pos){
  const miMano = v.mano?.length ?? 0, suMano = v.manoRival?.cuantas ?? 0;
  const turno = v.turno ?? 1;
  const dif = pos?.ventaja ?? 0;

  /* FASE. Topdeck: las dos manos casi vacías, cada robo decide. Final:
     partida larga o mazos cortos. Apertura: los primeros turnos, con las
     manos llenas. */
  const fase = (miMano <= 1 && suMano <= 1) ? "topdeck"
             : (turno >= 14 || (v.deckRestante > 0 && v.deckRestante <= 10)) ? "final"
             : (turno <= 3 && miMano + suMano >= 8) ? "apertura" : "medio";
  const valorFuturo = { apertura:1.0, medio:0.8, final:0.5, topdeck:0.2 }[fase];

  /* TRAMPAS. Cada tapada suya puede ser cualquier cosa; en Goat una buena
     parte del backrow son trampas de batalla. Se descuenta lo que ya ha
     gastado: cada una vista reduce lo que queda por salir. */
  const tapadas = v.tapadasRival ?? 0;
  const vistasBatalla = gastadasRival(v, TRAMPAS_BATALLA);
  const porTapada = Math.max(0.12, 0.4 - 0.06 * vistasBatalla);
  /* ══ CON MI JINZO BOCA ARRIBA, SUS TRAMPAS NO EXISTEN ══
     Jinzo impide activar trampas y anula sus efectos en el campo: Mirror
     Force, Torrential, Sakuretsu y compañía quedan muertas mientras siga.
     Lo único que queda en su backrow son mágicas rápidas (Book of Moon,
     Scapegoat). La presión con Jinzo es justo eso: atacar sin miedo. */
  const miJinzo = (v.monstruos ?? []).some(c => !c.bocaAbajo && canon(c.nombre ?? "") === "Jinzo");
  const porTapadaReal = miJinzo ? 0.08 : porTapada;
  const riesgoTrampa = tapadas ? 1 - Math.pow(1 - porTapadaReal, tapadas) : 0;
  const barridosFuera = gastadasRival(v, BARRIDOS);
  const porTapadaBarrido = miJinzo ? 0 : barridosFuera >= 2 ? 0.05 : barridosFuera === 1 ? 0.15 : 0.25;
  const riesgoBarrido = tapadas ? 1 - Math.pow(1 - porTapadaBarrido, tapadas) : 0;

  /* DOMINIO: mi mejor atacante boca arriba no lo para nada suyo que se
     vea. Las tapadas suyas cuentan como 1500 de defensa (lo típico). */
  const misAtacantes = (v.monstruos ?? []).filter(c => !c.bocaAbajo && !c.defensa && atk(c) > 0);
  const miMejor = misAtacantes.reduce((mx, c) => Math.max(mx, atk(c)), 0);
  const suMejor = (v.monstruosRival ?? []).reduce((mx, c) => Math.max(mx, c.bocaAbajo ? 1500 : poder(c)), 0);
  const dominio = miMejor > 0 && miMejor > suMejor;

  /* ROL. Menos recursos útiles o un reloj que pierdo → beatdown (forzar,
     asumir riesgo). Ventaja clara → control (simplificar, no arriesgar
     lo ganado). En medio, lo decide quién pega más. */
  const relojMio = pos?.relojMio ?? 99, relojSuyo = pos?.relojSuyo ?? 99;
  const rol = (dif <= -2 || relojMio < relojSuyo && relojMio <= 3) ? "beatdown"
            : dif >= 2 ? "control"
            : ((pos?.dañoQueHago ?? 0) > (pos?.dañoPorTurno ?? 0) ? "beatdown" : "control");
  const simplificar = dif >= 2 && (pos?.relojMio ?? 99) > 1;
  const detras = dif <= -2 || relojMio <= 2;

  /* CHAOS: combustible propio. */
  let luz = 0, oscuro = 0;
  for(const c of (v.cementerio ?? [])){
    if(!((Number(c.datos?.type) || 0) & 0x1)) continue;
    const a = Number(c.datos?.attribute) || 0;
    if(a & ATR_LUZ) luz++;
    if(a & ATR_OSCURO) oscuro++;
  }
  const chaos = { luz, oscuro, usos: Math.min(luz, oscuro) };

  const texto = `contexto: ${rol}${simplificar ? " (simplificar)" : ""}${detras ? " (por detrás)" : ""} · fase ${fase}`
    + ` · trampa ${Math.round(riesgoTrampa*100)}% · barrido ${Math.round(riesgoBarrido*100)}%`
    + `${dominio ? " · domino la mesa" : ""} · chaos ${luz}L/${oscuro}D`;

  return { fase, valorFuturo, riesgoTrampa, riesgoBarrido, dominio, miMejor, suMejor,
           rol, simplificar, detras, chaos, tapadas, texto };
}

/* ¿Cuánto cuesta EXTENDERSE con esta carta? Principio: con ventaja en la
   mesa, el monstruo adicional aporta poco y se expone a Torrential/Mirror
   Force (Lessons of the Game; Who's the Beatdown?). Devuelve la
   penalización (0 = no aplica). No aplica si el monstruo hace algo al
   entrar, si hay letal, o si voy por detrás (entonces hay que forzar). */
export function riesgoSobreextension(ctx, carta, { haceAlgo = false, letal = false } = {}){
  if(!ctx || haceAlgo || letal || ctx.detras || ctx.rol === "beatdown" && !ctx.dominio) return 0;
  if(!ctx.dominio || ctx.riesgoBarrido < 0.25) return 0;
  const enJuego = valorCarta(carta) + atk(carta) / 1500;
  /* Lo que se pierde si cae el barrido (la carta y lo que vale en mesa)
     más el valor marginal que NO aporta un cuerpo extra cuando ya domino. */
  return 1.5 + ctx.riesgoBarrido * (2.0 + 3.0 * enJuego) * ctx.valorFuturo;
}

/* Valor de guardar una carta reactiva/versátil frente a gastarla ya:
   se escala con el valor futuro de la fase. */
export const pesoGuardar = (ctx, base) => base * (ctx?.valorFuturo ?? 1);

export const esBatalla = nombre => TRAMPAS_BATALLA.includes(canon(nombre ?? ""));
