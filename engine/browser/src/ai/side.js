/* ════════════════════════════════════════════════════════════════
   EL SIDE DECK DE LA IA

   E: «quiero poder hacer side decking entre partidas, como si fuese un
   torneo real». Un torneo real es también que el RIVAL sidee. Esto decide
   qué cambia la IA entre partida y partida.

   Con lo que vio la partida anterior —solo lo que un jugador ve: lo que
   se jugó boca arriba, lo que hay en su cementerio y lo que recordaba de
   sus tapadas— clasifica a qué se enfrenta:

     trampas · backrow · monstruos · cementerio · quema · volteos · mano

   y mete las cartas de su side que sirven para eso, quitando del main lo
   que menos aporta. Tope de cambios para que no se rehaga el mazo entero
   por una lectura floja.

   Es una función pura: los datos de las cartas entran por `info`, así se
   prueba en node y no sabe nada del DOM ni del motor.
   ════════════════════════════════════════════════════════════════ */

/* Para qué sirve cada carta de side. Por NOMBRE canónico, que es lo que
   sobrevive a las variantes "(GOAT)" y "(Pre-Errata)". */
export const PARA_QUE = {
  "Sakuretsu Armor":"monstruos", "Bottomless Trap Hole":"monstruos",
  "Smashing Ground":"monstruos", "Legendary Jujitsu Master":"monstruos",
  "Spirit Reaper":"monstruos", "Enemy Controller":"monstruos",
  "Mirror Force":"monstruos", "Torrential Tribute":"monstruos",
  "Lightning Vortex":"monstruos", "Deck Devastation Virus":"monstruos",
  "Dust Tornado":"backrow", "Mystical Space Typhoon":"backrow",
  "Royal Decree":"trampas", "Solemn Judgment":"trampas",
  "Soul Release":"cementerio", "Kycoo the Ghost Destroyer":"cementerio",
  "Skull Lair":"cementerio", "Des Wombat":"quema", "Mystik Wok":"quema",
  "Mystic Swordsman LV2":"volteos", "Ceasefire":"volteos",
  "Nobleman of Crossout":"volteos", "Trap Dustshoot":"mano",
  "Jinzo":"trampas", "King Tiger Wanghu":"monstruos", "Cipher Soldier":"monstruos",
  "Zombyra the Dark":"monstruos", "Mind Control":["monstruos","volteos"],
  /* The Science of Sideboarding Pt.1 (Puy, goatformat): contra Goat
     Control, lo que limpia las fichas del Scapegoat y lo que responde al
     TER; las cartas «crossover» valen para varios cruces a la vez. */
  "Tribe-Infecting Virus":"fichas", "Asura Priest":"fichas",
  "Book of Moon":["ter","monstruos"], "Tsukuyomi":["ter","volteos"],
};
/* Sobrescrituras crossover: una carta, varios problemas. */
Object.assign(PARA_QUE, {
  "King Tiger Wanghu":["monstruos","fichas"], "Lightning Vortex":["monstruos","fichas"],
  "Torrential Tribute":["monstruos","fichas"], "Dust Tornado":["backrow","quema"],
  "Trap Dustshoot":["mano","cementerio"],
});
/* Stun: rinden mal en un formato con tanta remoción de backrow (Pt.1).
   Royal Decree es la excepción y sí está arriba. */
const STUN = new Set(["Skill Drain","Royal Command","Royal Oppression","Bad Reaction to Simochi"]);

/* Lo que de verdad vive del cementerio. Aquí estaban también Premature,
   Call of the Haunted y Magician of Faith, y con eso TODOS los mazos del
   formato pedían Soul Release: la señal dejaba de ser señal. */
const CHAOS = new Set(["Black Luster Soldier - Envoy of the Beginning","Chaos Sorcerer",
                       "Chaos Emperor Dragon - Envoy of the End","Sinister Serpent"]);
const QUEMA = new Set(["Just Desserts","Wave-Motion Cannon","Ceasefire","Secret Barrel",
                       "Ookazi","Tremendous Fire","Final Countdown","Des Koala","Stealth Bird"]);
const VOLTEO = new Set(["Magician of Faith","Dekoichi the Battlechanted Locomotive","Des Lacooda",
                        "Morphing Jar","Night Assailant","Old Vindictive Magician","Gravekeeper's Spy",
                        "Magical Merchant","Gravekeeper's Assailant"]);

/* Qué problema tiene delante, mirando SOLO lo que vio. */
export function diagnosticar(vistas, info){
  const n = { trampas:0, backrow:0, monstruos:0, cementerio:0, quema:0, volteos:0, mano:0, fichas:0, ter:0 };
  /* `mano` (Trap Dustshoot) no se deduce de lo visto: entra cuando no hay
     nada más claro, así que se queda en cero a propósito. */
  for(const code of vistas ?? []){
    const c = info(code);
    if(!c) continue;
    /* Los pesos no son todos iguales: una carta de quema vista es una
       señal fortísima (o juega quema o no), y un monstruo de volteo es
       corriente en todos los mazos del formato. */
    if(c.trampa) n.trampas += 1.2;
    if(c.magia)  n.backrow += 0.4;
    if(c.monstruo && c.atk >= 1700) n.monstruos += 1;
    if(CHAOS.has(c.nombre)) n.cementerio += 1.5;
    if(QUEMA.has(c.nombre)) n.quema += 2.5;
    if(VOLTEO.has(c.nombre)) n.volteos += 0.6;
    if(c.nombre === "Scapegoat") n.fichas += 3;
    if(c.nombre === "Thousand-Eyes Restrict" || c.nombre === "Metamorphosis") n.ter += 1.5;
  }
  return n;
}

/* ══ QUÉ MAZO TIENE DELANTE Y CUÁNTO CAMBIAR ══
   Science of Sideboarding Pt.1: contra Chaos Turbo se cambia lo MÍNIMO
   (Nobleman, Mind Control, Dustshoot y Kycoo del main suelen bastar);
   contra Warriors y Burn, cambios grandes; contra Goat Control, barrer
   fichas y responder al TER. Pt.2: una o dos cartas contra Turbo. */
const WARRIOR = new Set(["Blade Knight","D.D. Warrior Lady","Exiled Force","Mystic Swordsman LV2",
  "Marauding Captain","Reinforcement of the Army","Ninja Grandmaster Sasuke","Command Knight",
  "Obnoxious Celtic Guardian","Don Zaloog","Dark Blade","Giant Orc","Zombyra the Dark"]);
export function arquetipo(vistas, info){
  let chaos = 0, warrior = 0, quema = 0, goat = 0;
  for(const code of vistas ?? []){
    const c = info(code); if(!c) continue;
    if(CHAOS.has(c.nombre) || c.nombre === "Thunder Dragon") chaos++;
    if(WARRIOR.has(c.nombre)) warrior++;
    if(QUEMA.has(c.nombre)) quema++;
    if(["Scapegoat","Metamorphosis","Thousand-Eyes Restrict","Airknight Parshath"].includes(c.nombre)) goat++;
  }
  if(quema >= 2) return "quema";
  if(warrior >= 2 && warrior >= chaos) return "warrior";
  if(chaos >= 2 && chaos > goat) return "turbo";
  if(goat >= 2) return "goat";
  return null;
}
export const CAMBIOS_POR_ARQUETIPO = { turbo:2, goat:4, warrior:6, quema:6 };

/* Lo que no se quita ni harto de vino: las cartas que hacen que un mazo
   de Goat sea un mazo de Goat. Sin esta lista el bot sacaba el Book of
   Moon o el Mystical Space Typhoon para meter un Soul Release. */
export const INTOCABLES = new Set([
  "Pot of Greed","Graceful Charity","Delinquent Duo","Heavy Storm","Snatch Steal",
  "Premature Burial","Scapegoat","Metamorphosis","Thousand-Eyes Restrict","Torrential Tribute",
  "Mirror Force","Ring of Destruction","Black Luster Soldier - Envoy of the Beginning",
  "Book of Moon","Mystical Space Typhoon","Sangan","Magician of Faith","Tsukuyomi",
  "Airknight Parshath","Breaker the Magical Warrior","Dark Hole","Nobleman of Crossout",
]);

/* El plan de side: qué entra y qué sale. Devuelve el reparto nuevo. */
export function planDeSide({ registro, actual, vistas, info, valor, maxCambios = null }){
  const necesidad = diagnosticar(vistas, info);
  const tipo = arquetipo(vistas, info);
  if(maxCambios == null) maxCambios = CAMBIOS_POR_ARQUETIPO[tipo] ?? 5;
  const main = [...(actual?.main ?? registro?.main ?? [])];
  const side = [...(actual?.side ?? registro?.side ?? [])];
  if(!side.length) return { main, side, cambios:[], necesidad, arquetipo:tipo };

  /* Lo que entra: cartas del side cuya etiqueta pesa más ahora. */
  const puntua = code => {
    const nombre = info(code)?.nombre ?? "";
    if(STUN.has(nombre)) return 0;
    const para = PARA_QUE[nombre] ?? null;
    if(!para) return 0;
    /* Crossover: suma lo que resuelve, con un pellizco por cada problema
       extra que también cubre (Pt.2: priorizar las que valen para varios). */
    const lista = Array.isArray(para) ? para : [para];
    const vals = lista.map(k => necesidad[k] ?? 0).sort((a,b)=>b-a);
    return vals[0] + vals.slice(1).reduce((t,x)=>t + x*0.5, 0);
  };
  const entran = side.map((code, i) => ({ code, i, p:puntua(code) }))
                     .filter(x => x.p >= 2.5)
                     .sort((a,b) => b.p - a.p)
                     .slice(0, maxCambios);
  if(!entran.length) return { main, side, cambios:[], necesidad, arquetipo:tipo };

  /* Lo que sale: lo que menos aporta del main, sin tocar lo que también
     sirve para lo que viene. */
  /* Lo que sobra en este cruce aunque sea «intocable»: Nobleman contra
     un mazo que no coloca monstruos (quema), Pt.2 («useless most of the
     time» contra lo que no coloca). */
  const sobra = nombre => nombre === "Nobleman of Crossout" && tipo === "quema" && (necesidad.volteos ?? 0) === 0;
  const fuera = main.map((code, i) => ({ code, i,
                          v: valor(code) + (puntua(code) ? 2 : 0)
                             + (INTOCABLES.has(info(code)?.nombre ?? "") && !sobra(info(code)?.nombre ?? "") ? 100 : 0)
                             - (sobra(info(code)?.nombre ?? "") ? 5 : 0) }))
                    .sort((a,b) => a.v - b.v)
                    .slice(0, entran.length);

  const cambios = [];
  const iFuera = new Set(fuera.map(x => x.i)), iEntran = new Set(entran.map(x => x.i));
  const mainNuevo = main.filter((_, i) => !iFuera.has(i));
  const sideNuevo = side.filter((_, i) => !iEntran.has(i));
  for(let k = 0; k < entran.length; k++){
    mainNuevo.push(entran[k].code);
    sideNuevo.push(fuera[k].code);
    cambios.push({ entra: entran[k].code, sale: fuera[k].code });
  }
  return { main:mainNuevo, side:sideNuevo, cambios, necesidad, arquetipo:tipo };
}
