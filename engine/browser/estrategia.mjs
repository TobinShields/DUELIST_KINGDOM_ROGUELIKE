/* ════════════════════════════════════════════════════════════════
   TESTS DE ESTRATEGIA — ¿la IA juega con INTENCIÓN?

   El banco (banco.mjs) fija misplays concretos. Esto fija DECISIONES
   ESTRATÉGICAS del formato, cada una sacada de un principio de los
   artículos de TCGplayer y YGOPRODeck (ver docs/ESTRATEGIA-GOAT.md):
   la misma carta puede ser correcta o no según el estado entero.

   Cada escenario se imprime como:
     STATE      el tablero
     EXPECTED   la decisión estratégica esperada y el principio
     ACTUAL     lo que hizo la IA
     REASONING  lo que pensó (traza) y la nota de cada jugada del plan

   Uso:  node estrategia.mjs            todos
         node estrategia.mjs --fallos   solo los que fallan
         node estrategia.mjs <ruta brain.js>  otra versión
   ════════════════════════════════════════════════════════════════ */
import { mesa, ref, cod, L, P, MT, R, IA, BA, X, DB, NOMBRES,
         preguntaIdle, preguntaBatalla, preguntaCadena, preguntaObjetivo,
         queHizo } from "./banco-tablero.mjs";

const ruta = process.argv.slice(2).find(a => !a.startsWith("--")) ?? "./src/ai/brain.js";
const { crearCerebro } = await import(ruta);
const soloFallos = process.argv.includes("--fallos");

const ESC = [];
const esc = (id, principio, fuente, montar) => ESC.push({ id, principio, fuente, montar });
const accion = (cb, a, i=0) => (cb.ultimoPlan?.() ?? []).find(x => x.action === a && x.index === i);
const nota = (cb, a, i=0) => accion(cb, a, i)?.puntos ?? null;
const DEF = P.DEF, ATK = P.ATK, TAP = P.TAPADA;
const tapadaM = c => ({ carta:c, pos:TAP|DEF });

/* ══ 1 · HEAVY STORM: AHORA O GUARDARLA ══ */
esc("1a Heavy Storm · una sola tapada suya, partida abierta → guardarla",
    "Una tormenta es un balance de cartas, no una carta por carta; su valor crece con el backrow rival (CA-VALUE-FLUX, BD-SIMPLIFY).",
    "YGOPRODeck «Why You Should Play Goat Control»", () => {
  const d = mesa({ mios:{ mano:["Heavy Storm","Sangan","Book of Moon"], campo:[{carta:"Airknight Parshath",pos:ATK}] },
                   suyos:{ mt:["Sakuretsu Armor"], mano:["Giant Rat","Nobleman of Crossout","Mirror Force","Scapegoat","Pot of Greed"] }, turno:3 });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]], bp:true }),
           esperado:"no activa Heavy Storm", bien: r => r?.action !== IA.SELECT_ACTIVATE };
});
esc("1b Heavy Storm · tres tapadas suyas, ninguna mía → ahora",
    "Tres cartas por una: el balance es claramente positivo.",
    "YGOPRODeck «Why You Should Play Goat Control»", () => {
  const d = mesa({ mios:{ mano:["Heavy Storm","Sangan"], campo:[] },
                   suyos:{ mt:["Sakuretsu Armor","Mirror Force","Book of Moon"], mano:["Giant Rat","Pot of Greed"] }, turno:5 });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]], bp:false }),
           esperado:"activa Heavy Storm", bien: r => r?.action === IA.SELECT_ACTIVATE };
});
esc("1c Heavy Storm · guerra de topdeck, una tapada suya y nada en su mano → ahora",
    "En una guerra de topdeck no hay un futuro con más objetivos: el 1-por-1 que despeja el ataque es lo correcto.",
    "YGOPRODeck «Who's the Beatdown?» (tempo = opciones disponibles)", () => {
  const d = mesa({ mios:{ mano:["Heavy Storm"], campo:[{carta:"Airknight Parshath",pos:ATK}] },
                   suyos:{ mt:["Mirror Force"] }, turno:18, lp:[3000,3000] });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]], bp:true }),
           esperado:"activa Heavy Storm", bien: r => r?.action === IA.SELECT_ACTIVATE };
});

/* ══ 2 · ATACAR ALREDEDOR DE LAS TRAMPAS DE BATALLA ══ */
esc("2a Orden de ataque · primero el cebo barato contra backrow desconocido",
    "Cebar las trampas con lo barato (Sangan) antes de arriesgar la pieza que gana (Airknight).",
    "YGOPRODeck «Goat Format: Lessons of the Game» (TR-BAIT-MF)", () => {
  const d = mesa({ mios:{ campo:[{carta:"Airknight Parshath",pos:ATK},{carta:"Sangan",pos:ATK}] },
                   suyos:{ mt:[{carta:"Sakuretsu Armor",pos:TAP}], mano:["Giant Rat","Pot of Greed","Scapegoat"] }, turno:6, fase:0x8 });
  const m = d.zones[0][L.MZONE];
  return { d, q: preguntaBatalla([m[0], m[1]]),
           esperado:"ataca primero con Sangan (#1)", bien: r => r?.action === BA.SELECT_BATTLE && r?.index === 1 };
});
esc("2b Letal · con letal visible y una tapada, se ataca con todo",
    "Si la batalla gana, no se renuncia a ella; una trampa es una posibilidad, no perder seguro.",
    "YGOPRODeck «Who's the Beatdown?» (BD-BURST)", () => {
  const d = mesa({ mios:{ campo:[{carta:"Airknight Parshath",pos:ATK},{carta:"Sangan",pos:ATK}] },
                   suyos:{ mt:[{carta:"Mirror Force",pos:TAP}] }, turno:10, lp:[4000,2500], fase:0x8 });
  const m = d.zones[0][L.MZONE];
  return { d, q: preguntaBatalla([m[0], m[1]]),
           esperado:"ataca", bien: r => r?.action === BA.SELECT_BATTLE };
});

/* ══ 3 · SCAPEGOAT ══ */
esc("3a Scapegoat · en su Main Phase sin ataque → se conserva",
    "Scapegoat lo más tarde posible: cortando un ataque o en la End Phase (C-GOAT; valor según el momento).",
    "YGOPRODeck «Why You Should Play Goat Control»", () => {
  const d = mesa({ mios:{ mt:[{carta:"Scapegoat",pos:TAP}] },
                   suyos:{ campo:[{carta:"Airknight Parshath",pos:ATK}] }, turnPlayer:1, fase:0x4 });
  d.cadena = [{ code:cod("Pot of Greed"), controller:1, uid:900 }];
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]),
           esperado:"no encadena Scapegoat", bien: r => r?.index == null };
});
esc("3b Scapegoat · su Airknight me ataca directo → ahora",
    "El momento de Scapegoat es cortar el golpe (y deja material para Metamorphosis).",
    "YGOPRODeck «Why You Should Play Goat Control»", () => {
  const d = mesa({ mios:{ mt:[{carta:"Scapegoat",pos:TAP}] },
                   suyos:{ campo:[{carta:"Airknight Parshath",pos:ATK}] }, turnPlayer:1, fase:0x10 });
  d.atacante = d.zones[1][L.MZONE][0];
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]),
           esperado:"encadena Scapegoat", bien: r => r?.index === 0 };
});

/* ══ 4 · NOBLEMAN ══ */
esc("4a Nobleman · su única tapada y mi atacante listo → sí",
    "Nobleman existe para los volteos tapados; quitarlo abre el ataque directo sin disparar el volteo.",
    "TCGplayer «Three Easy-To-Build Decks» (REM-1); YGOPRODeck «Cards in Goat Format Pt.1»", () => {
  const d = mesa({ mios:{ mano:["Nobleman of Crossout"], campo:[{carta:"Airknight Parshath",pos:ATK}] },
                   suyos:{ campo:[tapadaM("Magician of Faith")], mano:["Giant Rat","Pot of Greed"] }, turno:5 });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]], bp:true }),
           esperado:"activa Nobleman", bien: r => r?.action === IA.SELECT_ACTIVATE };
});
esc("4b Nobleman · la única tapada es mía → no",
    "Un removal sin objetivo rival no es una jugada.",
    "principio general (CA-EVAL)", () => {
  const d = mesa({ mios:{ mano:["Nobleman of Crossout"], campo:[tapadaM("Magician of Faith")] },
                   suyos:{ campo:[{carta:"Sangan",pos:ATK}] }, turno:5 });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]], bp:true }),
           esperado:"no activa Nobleman", bien: r => r?.action !== IA.SELECT_ACTIVATE };
});

/* ══ 5 · BLACK LUSTER SOLDIER: AHORA O ESPERAR ══ */
esc("5a BLS · rival a 2500 sin monstruos → ahora (cierra la partida)",
    "BLS temprano es correcto cuando puede cerrar antes de que respondan.",
    "YGOPRODeck «An Introduction to Goat Format» (BD-BLS-EARLY)", () => {
  const d = mesa({ mios:{ mano:["Black Luster Soldier - Envoy of the Beginning"], gy:["Sangan","Airknight Parshath"] },
                   suyos:{ mano:["Giant Rat"] }, turno:9, lp:[5000,2500] });
  return { d, q: preguntaIdle({ especial:[d.zones[0][L.HAND][0]], bp:true }),
           esperado:"invoca BLS", bien: r => r?.action === IA.SELECT_SPECIAL_SUMMON };
});
esc("5b BLS · voy ganando con Airknight y tiene 3 tapadas → esperar",
    "No sobreextender contra backrow sin leer; el BLS guardado es el finisher, no un cuerpo más.",
    "YGOPRODeck «Who's the Beatdown?» (BD-RISK); «Why You Should Play Goat Control» (BD-SIMPLIFY)", () => {
  const d = mesa({ mios:{ mano:["Black Luster Soldier - Envoy of the Beginning","Mystical Space Typhoon","Sangan","Pot of Greed","Scapegoat"],
                          gy:["Sangan","Airknight Parshath"], campo:[{carta:"Airknight Parshath",pos:ATK}] },
                   suyos:{ mt:[{carta:"Mirror Force",pos:TAP},{carta:"Torrential Tribute",pos:TAP},{carta:"Book of Moon",pos:TAP}],
                           mano:["Giant Rat","Sangan"] }, turno:7, lp:[8000,6100] });
  return { d, q: preguntaIdle({ especial:[d.zones[0][L.HAND][0]], activa:[d.zones[0][L.HAND][1]], bp:true }),
           esperado:"no invoca BLS todavía", bien: r => r?.action !== IA.SELECT_SPECIAL_SUMMON };
});

/* ══ 6 · BOOK OF MOON ══ */
esc("6a Book of Moon ofensivo · tumbar su Airknight deja matarlo con mi TIV",
    "Book of Moon protege, pero también convierte un combate perdido en una muerte (C-BOOK).",
    "YGOPRODeck «Lessons of the Game» / «Skilled Chaos»", () => {
  const d = mesa({ mios:{ mano:["Book of Moon"], campo:[{carta:"Tribe-Infecting Virus",pos:ATK}] },
                   suyos:{ campo:[{carta:"Airknight Parshath",pos:ATK}], mano:["Giant Rat"] }, turno:6 });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]], bp:true }),
           esperado:"activa Book of Moon (y luego ataca)", bien: r => r?.action === IA.SELECT_ACTIVATE };
});
esc("6b Book of Moon defensivo · sin atacante propio → se guarda",
    "Si no convierte nada este turno, su valor es cortar su ataque.",
    "YGOPRODeck «Lessons of the Game» (C-BOOK)", () => {
  const d = mesa({ mios:{ mano:["Book of Moon"] },
                   suyos:{ campo:[{carta:"Airknight Parshath",pos:ATK}] }, turno:6 });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]], bp:true }),
           esperado:"no activa Book of Moon", bien: r => r?.action !== IA.SELECT_ACTIVATE };
});

/* ══ 7 · EXTENDERSE O CONSERVAR ══ */
esc("7 Sobreextensión · ya presiono con Airknight y tiene 2 tapadas → no saco otro cuerpo",
    "Con ventaja en la mesa, el monstruo adicional vale poco y arriesga Torrential/Mirror Force.",
    "YGOPRODeck «Lessons of the Game» (TR-BAIT-MF, TR-TORR-SEQ); «Who's the Beatdown?» (BD-RISK)", () => {
  const d = mesa({ mios:{ mano:["D.D. Warrior Lady","Sakuretsu Armor","Pot of Greed","Scapegoat","Sangan"], campo:[{carta:"Airknight Parshath",pos:ATK}] },
                   suyos:{ mt:[{carta:"Torrential Tribute",pos:TAP},{carta:"Mirror Force",pos:TAP}], mano:["Giant Rat","Sangan","Pot of Greed","Scapegoat"] },
                   turno:5 });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ invoca:[h[0]], coloca:[h[0]], colocaMT:[h[1]], bp:true }),
           esperado:"no invoca D.D. Warrior Lady", bien: r => !(r?.action === IA.SELECT_SUMMON) };
});

/* ══ 8 · PROTEGER A MAGICIAN OF FAITH ══ */
esc("8 Magician of Faith · no se voltea delante de su Airknight",
    "Voltearla en tu turno recupera la mágica pero la deja en ataque con 300: se pierde la carta y 1600 LP. Tapada, el valor llega igual cuando ataquen.",
    "YGOPRODeck «Cards in Goat Format Pt.1» (CA-MOF-BAIT); TCGplayer «Three Easy-To-Build Decks» (GC-5)", () => {
  const d = mesa({ mios:{ campo:[tapadaM("Magician of Faith")], gy:["Pot of Greed"] },
                   suyos:{ campo:[{carta:"Airknight Parshath",pos:ATK}] }, turno:6 });
  return { d, q: preguntaIdle({ giros:[d.zones[0][L.MZONE][0]], bp:false }),
           esperado:"no voltea Magician of Faith", bien: r => r?.action !== IA.SELECT_POS_CHANGE };
});

/* ══ 9 · THOUSAND-EYES RESTRICT ══ */
esc("9a TER correcto · ficha → TER que absorbe su Jinzo",
    "La jugada del formato: material barato, amenaza grande que absorber (GC-1, GC-3).",
    "TCGplayer «What Is The Yu-Gi-Oh Goat Format?»; YGOPRODeck «History of the Meta: Goat Control»", () => {
  const d = mesa({ mios:{ mano:["Metamorphosis"], campo:[{carta:"Sheep Token",pos:DEF}], extra:["Thousand-Eyes Restrict"] },
                   suyos:{ campo:[{carta:"Jinzo",pos:ATK}] }, turno:6, fase:0x100 });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]], bp:false }),
           esperado:"activa Metamorphosis", bien: r => r?.action === IA.SELECT_ACTIVATE };
});
esc("9b TER perjudicial · nada suyo boca arriba y mis atacantes quedarían bloqueados",
    "El TER impide atacar a TODOS los demás monstruos; sin nada que absorber solo cierra mi campo.",
    "TCGplayer «What Fusions Do You Really Need» (GC-3); análisis de partidas", () => {
  const d = mesa({ mios:{ mano:["Metamorphosis"], campo:[{carta:"Sheep Token",pos:DEF},{carta:"Airknight Parshath",pos:ATK}], extra:["Thousand-Eyes Restrict"] },
                   suyos:{ campo:[tapadaM("Sangan")] }, turno:6 });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]], bp:true }),
           esperado:"no activa Metamorphosis", bien: r => r?.action !== IA.SELECT_ACTIVATE };
});

/* ══ 10 · SIMPLIFICAR CUANDO VAS GANANDO ══ */
esc("10 Simplificar · voy +3 y tiene una sola tapada: MST antes de atacar",
    "Por delante, cambiar 1-por-1 amplía la ventaja relativa y quita la respuesta a mi ataque.",
    "YGOPRODeck «Why You Should Play Goat Control» (BD-SIMPLIFY)", () => {
  const d = mesa({ mios:{ mano:["Mystical Space Typhoon","Sangan","Giant Rat","Pot of Greed"], campo:[{carta:"Airknight Parshath",pos:ATK}] },
                   suyos:{ mt:[{carta:"Sakuretsu Armor",pos:TAP}], mano:["Giant Rat"] }, turno:9, lp:[7000,4000] });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]], bp:true }),
           esperado:"activa MST", bien: r => r?.action === IA.SELECT_ACTIVATE };
});

/* ══ 11 · ARRIESGAR CUANDO VAS PERDIENDO ══ */
esc("11 Por detrás · voy -3, su TER me cierra: BLS lo destierra ya",
    "Si pierdes a la larga, eres el beatdown: hay que forzar aunque haya riesgo.",
    "YGOPRODeck «Who's the Beatdown?» (BD-ROLE, BD-RULE)", () => {
  const d = mesa({ mios:{ mano:["Black Luster Soldier - Envoy of the Beginning"], gy:["Sangan","Airknight Parshath"] },
                   suyos:{ campo:[{carta:"Thousand-Eyes Restrict",pos:ATK,atkReal:1900,defReal:1400}],
                           mt:[{carta:"Mirror Force",pos:TAP}], mano:["Giant Rat","Sangan","Scapegoat","Pot of Greed"] },
                   turno:10, lp:[3000,7000] });
  return { d, q: preguntaIdle({ especial:[d.zones[0][L.HAND][0]], bp:true }),
           esperado:"invoca BLS", bien: r => r?.action === IA.SELECT_SPECIAL_SUMMON };
});

/* ══ 12 · GUERRA DE TOPDECK ══ */
esc("12 Topdeck · manos vacías, robo Sangan y su 1900 está en mesa → colocarlo, no invocarlo",
    "En topdeck cada carta cuenta: Sangan colocado se cambia por un monstruo buscado; de cara solo regala 900 LP.",
    "YGOPRODeck «Lessons of the Game» (BL-GY: contar outs); «Why You Should Play Goat Control» (CA-CORE)", () => {
  const d = mesa({ mios:{ mano:["Sangan"] },
                   suyos:{ campo:[{carta:"Airknight Parshath",pos:ATK}] }, turno:20, lp:[2500,2500] });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ invoca:[h[0]], coloca:[h[0]], bp:true }),
           esperado:"coloca Sangan", bien: r => r?.action === IA.SELECT_MONSTER_SET };
});

/* ══ 13 · LETAL CONTANDO SUS RESPUESTAS ══ */
esc("13 Letal con respuesta · 2900 contra 2500 y una tapada: primero MST, luego atacar",
    "La secuencia: quitar la respuesta ANTES de declarar el ataque que gana.",
    "YGOPRODeck «Lessons of the Game» (TR-GORILLA: forzar/leer la tapada); «Who's the Beatdown?» (BD-BURST)", () => {
  const d = mesa({ mios:{ mano:["Mystical Space Typhoon"], campo:[{carta:"Airknight Parshath",pos:ATK},{carta:"Sangan",pos:ATK}] },
                   suyos:{ mt:[{carta:"Mirror Force",pos:TAP}] }, turno:11, lp:[4000,2500] });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]], bp:true }),
           esperado:"activa MST antes de la batalla", bien: r => r?.action === IA.SELECT_ACTIVATE };
});


/* ══ 14 · PROTEGER / PREPARAR EL CEMENTERIO PARA CHAOS ══ */
esc("14 Descarte con BLS en mano · el descarte llena el atributo que falta",
    "Mandar LIGHT y DARK al cementerio habilita BLS y Chaos Sorcerer; Graceful Charity con Thunder Dragon es casi gratis por eso.",
    "TCGplayer «Three Easy-To-Build Decks» (CH-1); YGOPRODeck «Chaos Turbo» (C-THUNDER)", () => {
  const d = mesa({ mios:{ mano:["Black Luster Soldier - Envoy of the Beginning","Scapegoat","Skilled Dark Magician","Book of Moon"],
                          gy:["Airknight Parshath"] }, suyos:{}, turno:4 });
  d.cadena = [{ code:cod("Graceful Charity"), controller:0 }];
  const h = d.zones[0][L.HAND];
  const q = { type:MT.SELECT_CARD, player:0, can_cancel:false, min:2, max:2, selects:h.map(ref) };
  return { d, q, esperado:"descarta Skilled Dark Magician (DARK) y no el BLS",
           bien: r => (r?.indicies ?? []).includes(2) && !(r?.indicies ?? []).includes(0) };
});


/* ══ 15 · CHAOS SORCERER: GUARDARLO PARA LA AMENAZA REAL ══ */
esc("15a Chaos Sorcerer · su único monstruo es un Sangan que mato en combate → no gastarlo",
    "No soltar el Chaos Sorcerer de inmediato: que gasten sus cartas fuertes en lo demás y guardarlo para Airknight/TER.",
    "YGOPRODeck «Skilled Chaos» (CH-HOLD); «Chaos Recruiter» (passive aggression)", () => {
  const d = mesa({ mios:{ mano:["Chaos Sorcerer","Pot of Greed","Book of Moon"], gy:["Sangan","Airknight Parshath"], campo:[{carta:"Airknight Parshath",pos:ATK}] },
                   suyos:{ campo:[{carta:"Sangan",pos:ATK}], mano:["Giant Rat","Pot of Greed","Scapegoat"] }, turno:6 });
  return { d, q: preguntaIdle({ especial:[d.zones[0][L.HAND][0]], bp:true }),
           esperado:"no invoca Chaos Sorcerer", bien: r => r?.action !== IA.SELECT_SPECIAL_SUMMON };
});
esc("15b Chaos Sorcerer · su TER tiene absorbido mi monstruo → ahora",
    "La amenaza que no se mata en combate es exactamente para lo que se guarda.",
    "YGOPRODeck «Skilled Chaos» (CH-HOLD: vs Goat Control, para Airknight o TER)", () => {
  const d = mesa({ mios:{ mano:["Chaos Sorcerer"], gy:["Sangan","Airknight Parshath"] },
                   suyos:{ campo:[{carta:"Thousand-Eyes Restrict",pos:ATK,atkReal:1900,defReal:1400}], mano:["Giant Rat"] }, turno:6 });
  return { d, q: preguntaIdle({ especial:[d.zones[0][L.HAND][0]], bp:true }),
           esperado:"invoca Chaos Sorcerer", bien: r => r?.action === IA.SELECT_SPECIAL_SUMMON };
});

/* ══ 16 · DELINQUENT DUO ══ */
esc("16a Delinquent Duo · le queda UNA carta → guardarlo",
    "Duo le quita dos cartas si tiene dos o más (una al azar y otra a su elección): con una sola es 1-por-1 pagando 1000 LP.",
    "YGOPRODeck «Cards in Goat Format Pt.1» (CA-DUO2)", () => {
  const d = mesa({ mios:{ mano:["Delinquent Duo","Sangan","Book of Moon"] },
                   suyos:{ mano:["Pot of Greed"], campo:[{carta:"Airknight Parshath",pos:ATK}] }, turno:8 });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]], bp:false }),
           esperado:"no activa Delinquent Duo", bien: r => r?.action !== IA.SELECT_ACTIVATE };
});
esc("16b Delinquent Duo · le quedan dos → ahora",
    "Con dos cartas en su mano, Duo se las lleva las dos: +1.",
    "YGOPRODeck «Cards in Goat Format Pt.1» (CA-DUO2)", () => {
  const d = mesa({ mios:{ mano:["Delinquent Duo","Sangan","Book of Moon"] },
                   suyos:{ mano:["Pot of Greed","Mirror Force"] }, turno:8 });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]], bp:false }),
           esperado:"activa Delinquent Duo", bien: r => r?.action === IA.SELECT_ACTIVATE };
});

/* ══ 17 · TSUKUYOMI: EL OBJETIVO PUEDE SER SUYO O MÍO (22-09) ══ */
const FICHA_T = 73915052;
esc("17a Tsukuyomi · su TER con un monstruo absorbido → invocarla y tumbar el TER",
    "Tsukuyomi es «an easy out to TER»: boca abajo pierde su efecto y queda 0/0.",
    "r/Goat_Format «How to best use Tsukuyomi in chaos turbo?» (captura de E); goatformat Sideboarding Pt.1", () => {
  const d = mesa({ mios:{ mano:["Tsukuyomi","Sangan"] },
                   suyos:{ campo:[{carta:"Thousand-Eyes Restrict",pos:P.ATK,atkReal:1900,defReal:1000}], mano:["Pot of Greed","Mirror Force"] }, turno:9 });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ invoca:[h[0],h[1]], coloca:[h[0],h[1]], bp:true }),
           esperado:"invoca Tsukuyomi", bien: r => r?.action === IA.SELECT_SUMMON && r?.index === 0 };
});
esc("17b Tsukuyomi · solo hay un Magician of Faith suyo boca arriba → no invocarla",
    "Su efecto es obligatorio: sin objetivo que valga, tumba a su propio volteo rival (se lo regala) o a sí misma.",
    "Rulings S–T (Tsukuyomi); guía P03", () => {
  const d = mesa({ mios:{ mano:["Tsukuyomi","Sangan"] },
                   suyos:{ campo:[{carta:"Magician of Faith",pos:P.ATK}], mano:["Pot of Greed","Scapegoat"] }, turno:7 });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ invoca:[h[0],h[1]], coloca:[h[0],h[1]], bp:true }),
           esperado:"no invoca Tsukuyomi", bien: r => !(r?.action === IA.SELECT_SUMMON && r?.index === 0) };
});
esc("17c Tsukuyomi · lo que le robé con Snatch Steal y él tiene backrow → tumbarlo: pasa a ser mío",
    "Boca abajo, Snatch Steal va al cementerio y el monstruo se queda con quien lo controla («makes the monster permanently yours»).",
    "goatrulings.com y goatformat.com Rulings S–T (Snatch Steal); r/Goat_Format (captura de E)", () => {
  const d = mesa({ mios:{ campo:[{carta:"Airknight Parshath",pos:P.ATK,dueño:1}], mt:[{carta:"Snatch Steal",pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Sangan",pos:P.ATK}], mt:[{carta:"Mystical Space Typhoon",pos:P.TAPADA}], mano:["Pot of Greed"] }, turno:8, fase:0x4 });
  const air = d.zones[0][L.MZONE][0];
  d.zones[0][L.SZONE][0].equipadoA = air.uid;
  const ts = { uid:950, code:cod("Tsukuyomi"), controller:0, owner:0, location:L.MZONE, sequence:1, position:P.ATK };
  d.zones[0][L.MZONE][1] = ts; d.cards.set(950, ts);
  d.cadena = [{ code:ts.code, controller:0, uid:950 }];
  const sg = d.zones[1][L.MZONE][0];
  return { d, q: preguntaObjetivo([air, ts, sg]),
           esperado:"tumba su propio Airknight robado", bien: r => (r?.indicies ?? [])[0] === 0 };
});
esc("17d Chaos Sorcerer · ya desterró este turno y queda otro objetivo → Tsukuyomi lo tumba",
    "Boca abajo y otra vez boca arriba es una carta nueva: el destierro vuelve (Rulings A–C, BLS). Solo si la invocación por volteo es legal.",
    "r/Goat_Format (captura de E: «reuse Sorcerer/BLS banish»); goatformat Rulings A–C", () => {
  const d = mesa({ mios:{ campo:[{carta:"Chaos Sorcerer",pos:P.ATK}] },
                   suyos:{ campo:[{carta:"Airknight Parshath",pos:P.ATK}], mano:["Pot of Greed"] }, turno:9, fase:0x4 });
  const cs = d.zones[0][L.MZONE][0]; cs.entroTurno = 7;
  const ts = { uid:951, code:cod("Tsukuyomi"), controller:0, owner:0, location:L.MZONE, sequence:1, position:P.ATK, entroTurno:9 };
  d.zones[0][L.MZONE][1] = ts; d.cards.set(951, ts);
  const qa = preguntaIdle({ activa:[cs], bp:true });
  d.cadena = [{ code:ts.code, controller:0, uid:951 }];
  const air = d.zones[1][L.MZONE][0];
  return { d, previo: cb => cb.anotar(qa, { type:R.SELECT_IDLECMD, action:IA.SELECT_ACTIVATE, index:0 }),
           q: preguntaObjetivo([cs, ts, air]),
           esperado:"tumba a su Chaos Sorcerer", bien: r => (r?.indicies ?? [])[0] === 0 };
});
esc("17e Chaos Sorcerer tapado con algo suyo que desterrar → voltearlo",
    "La invocación por volteo devuelve el efecto: voltearlo es otro destierro.",
    "r/Goat_Format (captura de E); goatformat Rulings A–C", () => {
  const d = mesa({ mios:{ campo:[{carta:"Chaos Sorcerer",pos:P.TAPADA|P.DEF}] },
                   suyos:{ campo:[{carta:"Airknight Parshath",pos:P.ATK}], mano:["Pot of Greed"] }, turno:9 });
  const cs = d.zones[0][L.MZONE][0]; cs.entroTurno = 7;
  return { d, q: preguntaIdle({ giros:[cs], bp:true }),
           esperado:"voltea el Chaos Sorcerer", bien: r => r?.action === IA.SELECT_POS_CHANGE };
});

esc("17f Chaos Sorcerer ya desterró y le queda un Airknight → invocar Tsukuyomi para repetir (jugada segura)",
    "Tsukuyomi sobre mi propio Chaos: tumbarlo y voltearlo es un segundo destierro, +1 por reglas.",
    "r/Goat_Format (captura de E); goatformat Rulings A–C", () => {
  const d = mesa({ mios:{ campo:[{carta:"Chaos Sorcerer",pos:P.ATK}], mano:["Tsukuyomi","Sangan"] },
                   suyos:{ campo:[{carta:"Airknight Parshath",pos:P.ATK}], mano:["Pot of Greed"] }, turno:9 });
  const cs = d.zones[0][L.MZONE][0]; cs.entroTurno = 7;
  const qa = preguntaIdle({ activa:[cs], bp:true });
  const h = d.zones[0][L.HAND];
  return { d, previo: cb => cb.anotar(qa, { type:R.SELECT_IDLECMD, action:IA.SELECT_ACTIVATE, index:0 }),
           q: preguntaIdle({ invoca:[h[0],h[1]], coloca:[h[0],h[1]], bp:true }),
           esperado:"invoca Tsukuyomi (seguro)", bien: (r, cb) => r?.action === IA.SELECT_SUMMON && r?.index === 0
                     && !!(cb.ultimoPlan?.() ?? [])[0]?.seguro };
});

/* ══ 21 · ROBAR PARA REMATAR ══ */
esc("21 Snatch Steal a su Mystic Tomato (1400) + Sangan con él a 2400 → letal",
    "El robo cuenta dos veces: quita su monstruo y ataca con él. Robar lo pequeño vale si remata.",
    "goatformat «I Tested Giant Orc so That You Don't Have To!»", () => {
  const d = mesa({ mios:{ mano:["Snatch Steal","Airknight Parshath","Sangan"] },
                   suyos:{ campo:[{carta:"Mystic Tomato",pos:P.ATK}], mano:["Pot of Greed"] }, turno:12, lp:[5000,2400] });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ activa:[h[0]], invoca:[h[2]], coloca:[h[2]], bp:true }),
           esperado:"activa Snatch Steal", bien: r => r?.action === IA.SELECT_ACTIVATE };
});

/* ══ 22 · PHOENIX WING WIND BLAST ══ */
esc("22a Phoenix Wing · su Airknight ataca, tengo un Thunder Dragon para descartar → devolverlo",
    "Devolver al mazo no destruye: sin floater, sin combustible para su Chaos, y el atacante se va.",
    "goatformat «Phoenix Wing: An Often Overlooked Gem»", () => {
  const d = mesa({ mios:{ mt:[{carta:"Phoenix Wing Wind Blast",pos:P.TAPADA}], mano:["Thunder Dragon"] },
                   suyos:{ campo:[{carta:"Airknight Parshath",pos:P.ATK}], mano:["Pot of Greed"] }, turnPlayer:1, fase:0x8, lp:[3000,6000] });
  const a = d.zones[1][L.MZONE][0];
  d.atacante = { uid:a.uid, code:a.code, controller:1 };
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), esperado:"activa Phoenix Wing", bien: r => r?.index === 0 };
});
esc("22b Phoenix Wing · su tapada en su End Phase → devolverla (su próximo robo)",
    "En su End Phase sobre una tapada funciona como un Time Seal: vuelve a robar esa carta.",
    "goatformat «Phoenix Wing: An Often Overlooked Gem»", () => {
  const d = mesa({ mios:{ mt:[{carta:"Phoenix Wing Wind Blast",pos:P.TAPADA}], mano:["Sinister Serpent"] },
                   suyos:{ campo:[{carta:"Sangan",pos:P.TAPADA|P.DEF}], mano:["Pot of Greed","Scapegoat"] }, turnPlayer:1, fase:0x200 });
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), esperado:"activa Phoenix Wing", bien: r => r?.index === 0 };
});

/* ══ 23 · POSICIÓN DEL CHAOS SEGÚN SU MAZO ══ */
esc("23 Chaos Sorcerer contra un mazo con D.D. Warrior Lady → en ataque",
    "En defensa, D.D. Warrior Lady lo destierra gratis; en ataque, le cuesta el daño. Sasuke destruye lo que está en defensa.",
    "goatformat «Chaos Monsters: Attack or Defense?»", () => {
  const d = mesa({ mios:{ campo:[] },
                   suyos:{ campo:[{carta:"Airknight Parshath",pos:P.ATK},{carta:"Sangan",pos:P.ATK}], gy:["D.D. Warrior Lady"], mano:["Pot of Greed","Scapegoat"] }, turno:8 });
  return { d, q: { type:MT.SELECT_POSITION, player:0, code:cod("Chaos Sorcerer"), positions:0x1|0x4 },
           esperado:"ataque", bien: r => r?.position === 0x1 };
});

/* ══ 24 · PRESIÓN CON JINZO ══ */
esc("24 Jinzo boca arriba y tres tapadas suyas → extenderse con otro atacante (sus trampas no existen)",
    "Jinzo apaga sus trampas: Torrential y Mirror Force no pueden castigar la extensión.",
    "texto de Jinzo; YGOPRODeck «Who's the Beatdown?» (presión)", () => {
  const d = mesa({ mios:{ campo:[{carta:"Jinzo",pos:P.ATK},{carta:"Mystic Swordsman LV2",pos:P.ATK}], mano:["Kycoo the Ghost Destroyer","Heavy Storm","Book of Moon","Scapegoat"] },
                   suyos:{ mt:[{carta:"Torrential Tribute",pos:P.TAPADA},{carta:"Mirror Force",pos:P.TAPADA},{carta:"Sakuretsu Armor",pos:P.TAPADA}],
                           campo:[{carta:"Sangan",pos:P.TAPADA|P.DEF}], mano:["Pot of Greed"] }, turno:9, lp:[8000,5000] });
  const h = d.zones[0][L.HAND];
  return { d, q: preguntaIdle({ invoca:[h[0]], bp:true }), esperado:"invoca Kycoo", bien: r => r?.action === IA.SELECT_SUMMON };
});

/* ══ 18 · DELINQUENT DUO Y LA VIDA ══ */
esc("18 Delinquent Duo · a 2500, campo vacío, su beater enfrente y sin Ring visto → guardarlo",
    "Pagar 1000 con el campo abierto invita a que Ring of Destruction más su monstruo me maten.",
    "goatformat «C.G.'s Goat Thoughts: How 2 Duo 2 (The ReDuo)»", () => {
  const d = mesa({ mios:{ mano:["Delinquent Duo","Sangan"] },
                   suyos:{ campo:[{carta:"Airknight Parshath",pos:P.ATK}], mt:[{carta:"Mirror Force",pos:P.TAPADA}], mano:["Pot of Greed","Scapegoat","Ring of Destruction"] },
                   turno:10, lp:[2500,6000] });
  return { d, q: preguntaIdle({ activa:[d.zones[0][L.HAND][0]], bp:false }),
           esperado:"no activa Delinquent Duo", bien: r => r?.action !== IA.SELECT_ACTIVATE };
});

/* ══ 19 · MIRROR FORCE CONTRA UN SOLO ATACANTE ══ */
esc("19 Mirror Force · un solo Airknight atacando directo → activarla",
    "Mirror Force se usa también contra un atacante: la ventana importa más que la cantidad.",
    "goatformat «Don't Look Good, Be Good»", () => {
  const d = mesa({ mios:{ mt:[{carta:"Mirror Force",pos:P.TAPADA}] },
                   suyos:{ campo:[{carta:"Airknight Parshath",pos:P.ATK}], mano:["Pot of Greed","Sangan"] }, turnPlayer:1, fase:0x8, lp:[4000,6000] });
  const a = d.zones[1][L.MZONE][0];
  d.atacante = { uid:a.uid, code:a.code, controller:1 };
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), esperado:"activa Mirror Force", bien: r => r?.index === 0 };
});

/* ══ 20 · DUST TORNADO CONTRA SNATCH STEAL ══ */
esc("20a Dust Tornado · Snatch Steal a mi Airknight (Goat Control, pocos tributos) → esperar",
    "Encadenar al Snatch Steal es un error común: mejor destruirlo cuando ataque o cuando gaste su invocación normal.",
    "goatformat «Dust Tornado vs Snatch Steal»", () => {
  const d = mesa({ mios:{ campo:[{carta:"Airknight Parshath",pos:P.ATK}], mt:[{carta:"Dust Tornado",pos:P.TAPADA}] },
                   suyos:{ mt:[{carta:"Snatch Steal",pos:P.ATK}], mano:["Pot of Greed","Sangan","Scapegoat"], gy:["Book of Moon","Book of Moon"] }, turnPlayer:1, fase:0x4, turno:6 });
  const sn = d.zones[1][L.SZONE][0];
  d.cadena = [{ code:sn.code, controller:1, uid:sn.uid }];
  d.objetivosCadena = new Set([d.zones[0][L.MZONE][0].uid]);
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), esperado:"no encadena todavía", bien: r => r?.index == null };
});
esc("20b Dust Tornado · me roba el Chaos Sorcerer (efecto inmediato) → encadenar ya",
    "Si el monstruo robado tiene un efecto que usarán en el acto, se destruye el Snatch Steal de inmediato.",
    "goatformat «Dust Tornado vs Snatch Steal»", () => {
  const d = mesa({ mios:{ campo:[{carta:"Chaos Sorcerer",pos:P.ATK},{carta:"Sangan",pos:P.DEF}], mt:[{carta:"Dust Tornado",pos:P.TAPADA}] },
                   suyos:{ campo:[{carta:"Airknight Parshath",pos:P.ATK}], mt:[{carta:"Snatch Steal",pos:P.ATK}], mano:["Pot of Greed"] }, turnPlayer:1, fase:0x4, turno:6 });
  const sn = d.zones[1][L.SZONE][0];
  d.cadena = [{ code:sn.code, controller:1, uid:sn.uid }];
  d.objetivosCadena = new Set([d.zones[0][L.MZONE][0].uid]);
  return { d, q: preguntaCadena([d.zones[0][L.SZONE][0]]), esperado:"encadena Dust Tornado", bien: r => r?.index === 0 };
});

/* ══════════════ ejecutar ══════════════ */
const nombreDe = c => NOMBRES[c?.code]?.name ?? "?";
const lado = z => [
  z[L.MZONE].filter(Boolean).map(c => `${nombreDe(c)}${c.position & 0x0a ? "(tapada)" : c.position & 0x04 ? "(DEF)" : ""}`).join(", ") || "—",
  z[L.SZONE].filter(Boolean).map(c => `${nombreDe(c)}${c.position & 0x0a ? "(tapada)" : ""}`).join(", ") || "—",
  z[L.HAND].map(nombreDe).join(", ") || "—",
];
let ok = 0;
for(const E of ESC){
  const trazas = [];
  let r = null, cb = null, hizo = "(reventó)", bien = false;
  let d = null, esperado = "";
  try{
    const m = E.montar(); d = m.d; esperado = m.esperado;
    cb = crearCerebro({ X, duel:d, db:DB, names:NOMBRES, nivel:"experto", yo:0,
                        log: o => trazas.push(o.msg + (o.valor != null ? ` ${JSON.stringify(o.valor)}` : "")) });
    m.previo?.(cb);
    r = cb(m.q, 0);
    hizo = queHizo(r);
    bien = !!m.bien(r, cb);
  }catch(e){ hizo = "error: " + e.message; }
  if(bien) ok++;
  if(soloFallos && bien) continue;
  const [mM, mT, mH] = d ? lado(d.zones[0]) : [];
  const [sM, sT] = d ? lado(d.zones[1]) : [];
  console.log(`\n${bien ? "✓" : "✗"} ${E.id}`);
  if(d){
    console.log(`   STATE      yo  ${d.lp[0]} LP · mesa: ${mM} · M/T: ${mT} · mano: ${mH}`);
    console.log(`              él  ${d.lp[1]} LP · mesa: ${sM} · M/T: ${sT} · mano: ${d.zones[1][L.HAND].length} cartas · turno ${d.turnCount}${d.turnPlayer ? " (suyo)" : ""}`);
  }
  console.log(`   EXPECTED   ${esperado} — ${E.principio}`);
  console.log(`   SOURCE     ${E.fuente}`);
  console.log(`   ACTUAL     ${hizo}`);
  const plan = cb?.ultimoPlan?.() ?? [];
  const pc = cb?.puntosCadena?.() ?? [];
  const razon = trazas.filter(t => !/^plan:|^  paso/.test(t)).slice(-4);
  console.log(`   REASONING  ${razon.join(" | ") || "—"}`);
  if(plan.length && d?.turnPlayer === 0 && !pc.length)
    console.log(`              plan: ${plan.slice(0,5).map(x => `${x.por} = ${x.puntos.toFixed(2)}`).join(" · ")}`);
  if(pc.length) console.log(`              cadena: ${pc.map(x => `#${x.index}=${x.p.toFixed(2)}`).join(" ")}`);
}
console.log(`\n${ok}/${ESC.length} decisiones estratégicas correctas`);
process.exit(ok === ESC.length ? 0 : 1);
