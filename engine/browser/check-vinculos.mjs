/* ══════════════════════════════════════════════════════════════════
   A QUÉ CARTA SE AGARRA CADA CARTA DEL BACKROW

   E: «las cartas de equipo y las trampas como Spellbinding Circle no
   tienen indicador ninguno de a qué carta están equipadas o conectadas».

   Los EQUIPOS sí lo tenían: el motor manda `EQUIP`, el espejo guarda
   `equipadoA` y la vista dibuja la línea (lo cubre `check-inspector`).
   Spellbinding Circle no: para el motor NO es un equipo — apunta a un
   monstruo y se queda—, así que no manda `EQUIP` y no había nada que
   dibujar. Confirmado en el log de E del 17-08: su cadena se resuelve
   sin un solo evento `equip`.

   Y el dato no había que inventarlo: el motor lo sabe y lo dice en la
   consulta (`TARGET_CARD`). Lo que pasaba es que solo se preguntaba por
   la zona de MONSTRUOS, así que el backrow no se miraba nunca. Misma
   regla que SHUFFLE_SET_CARD: no adivinar, preguntar.

   Son DOS hechos y se prueban por separado, cada uno donde se puede
   probar de verdad:
     1. que el MOTOR lo dice — con un tablero montado y una partida real;
     2. que NUESTRO adaptador lo recoge — dándole a `refrescarVinculos`
        exactamente la fila que el motor devolvió en el paso 1.
   La primera versión de esto intentaba conducir un duelo entero a mano
   para juntar las dos, y lo que medía era su propio guion: la cadena no
   llegaba a resolver y la consulta salía vacía.

   Uso:  node check-vinculos.mjs
   ══════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";
import { montar, X, L, P, nombre } from "./escenario.mjs";
import { GoatDuel } from "./src/duel.mjs";

let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t,d="") => { fallos++; console.log("  ✗ " + t + (d ? "   " + d : "")); };
console.log("\n═══ LOS VÍNCULOS DEL BACKROW ═══\n");

const MT = X.OcgMessageType, R = X.OcgResponseType, IA = X.SelectIdleCMDAction;
const ARCHFIEND = 49881766, CIRCULO = 18807108;

/* ── 1 · EL MOTOR SÍ SABE A QUIÉN APUNTA ── */
let filaObservada = null;
{
  const e = await montar(
    { mt:[{carta:"Spellbinding Circle", pos:P.FACEDOWN_DEFENSE}] },
    { monstruos:[{carta:"Archfiend Soldier", pos:P.FACEUP_ATTACK}] },
    { roboInicial:0, tamañoDeck:20, seed:[5n,7n,13n,29n] });

  let activada = false;
  await e.correr((m) => {
    if(m.type === MT.SELECT_IDLECMD && m.player === 0 && !activada && (m.activates ?? []).length){
      activada = true;
      return { type:R.SELECT_IDLECMD, action:IA.ACTIVATE, index:0 };
    }
    if(m.type === MT.SELECT_CARD) return { type:R.SELECT_CARD, indicies:[0] };
    return null;
  }, 900);

  activada ? ok("Spellbinding Circle se activa sobre el monstruo del rival")
           : mal("Spellbinding Circle se pudo activar");

  const F = X.OcgQueryFlags;
  const flags = F.CODE | F.EQUIP_CARD | F.TARGET_CARD;
  const filas = e.lib.duelQueryLocation(e.handle,
                  { flags, controller:0, location:L.SZONE }) ?? [];
  filaObservada = filas.find(q => q?.code === CIRCULO) ?? null;

  if(!filaObservada) mal("el motor devuelve la carta en la consulta del backrow");
  else if(filaObservada.equipCard)
    mal("Spellbinding Circle NO es un equipo para el motor",
        "si esto cambia, media nota de arriba deja de ser cierta");
  else if(!(filaObservada.targetCards ?? []).length)
    mal("el motor dice a qué monstruo apunta (`targetCards`)",
        "sin esto no hay nada que dibujar y el arreglo no puede existir");
  else {
    const t = filaObservada.targetCards[0];
    ok(`el motor dice que apunta a j${t.controller} zona ${t.location}[${t.sequence}]`);
  }
}

/* ── 2 · Y NUESTRO ADAPTADOR LO RECOGE ──
   Se le da a `refrescarVinculos` la fila EXACTA que devolvió el motor
   arriba, no una inventada por mí: si el formato cambia, este test se
   entera por el paso 1 y no por una copia a mano que ya no vale. */
{
  if(!filaObservada) mal("hay fila del motor con la que probar el adaptador");
  else {
    const duel = Object.create(GoatDuel.prototype);
    duel.X = X;
    /* OJO CON LA FIRMA: `duelQueryLocation(handle, {flags, controller,
       location})`. La primera versión del stub cogía el PRIMER argumento
       como si fueran las opciones, así que nunca casaba y devolvía []:
       la comprobación de "deja de apuntar" pasaba sola y la otra fallaba
       acusando al código. Un stub con la firma mal es un test que mide
       el stub. */
    duel.lib = { duelQueryLocation: (_handle, { controller, location }) =>
      (controller === 0 && location === L.SZONE) ? [filaObservada] : [] };
    duel.handle = {};
    const carta   = { uid:1, code:CIRCULO, controller:0, location:L.SZONE,  sequence:0 };
    const objetivo= { uid:2, code:ARCHFIEND, controller:1, location:L.MZONE, sequence:0 };
    duel.zones = { 0:{ [L.SZONE]:[carta], [L.MZONE]:[] },
                   1:{ [L.SZONE]:[],      [L.MZONE]:[objetivo] } };
    duel.cards = new Map([[1,carta],[2,objetivo]]);
    duel.at = (c,l,s) => duel.zones[c]?.[l]?.[s] ?? null;

    duel.refrescarVinculos();

    if(carta.vinculadoA == null)
      mal("el espejo guarda a qué monstruo apunta (`vinculadoA`)");
    else if(carta.vinculadoA !== 2)
      mal("y apunta al monstruo correcto", `apunta al uid ${carta.vinculadoA}`);
    else ok(`el espejo guarda que apunta a ${nombre(ARCHFIEND)}`);

    /* Y al soltarlo, se suelta: sin esto vuelve el bug de la línea que
       se quedaba dibujada desde el cementerio. */
    duel.lib.duelQueryLocation = (_h, { controller, location }) =>
      (controller === 0 && location === L.SZONE) ? [{ code:CIRCULO }] : [];
    duel.refrescarVinculos();
    if(carta.vinculadoA != null)
      mal("y deja de apuntar cuando el motor ya no lo dice",
          "una línea que no se borra es el bug del cementerio otra vez");
    else ok("y deja de apuntar en cuanto el motor deja de decirlo");
  }
}

/* ── 3 · la vista dibuja desde las DOS fuentes, y se ve ── */
{
  const html = readFileSync("./out/goat.html","utf-8");
  if(!/equipadoA\s*\?\?\s*c\?\.vinculadoA/.test(html))
    mal("la vista dibuja la unión desde `equipadoA` Y desde `vinculadoA`",
        "con una sola fuente, Spellbinding Circle se queda sin línea");
  else ok("la vista dibuja la unión desde las dos fuentes");

  /* Que EXISTA no basta: era un hilo de 2 px translúcido sobre arte
     dorado, y eso E lo describió como "ningún indicador". */
  const m = html.match(/#uniones \.union\{([^}]*)\}/);
  const grosor = Number((m?.[1].match(/stroke-width:([\d.]+)/) ?? [])[1] ?? 0);
  if(grosor < 3) mal("la línea tiene grosor suficiente", `stroke-width:${grosor}`);
  else ok(`la línea se ve (stroke-width:${grosor})`);

  if(!/\.card\[data-atado\]/.test(html))
    mal("y las dos cartas llevan marca propia, no solo la línea");
  else ok("y las dos cartas llevan marca propia además de la línea");
}

console.log(`\n${fallos ? "FALLA: " + fallos : "Todo correcto"}`);
process.exit(fallos ? 1 : 0);
