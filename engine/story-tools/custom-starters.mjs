/* ══════════════════════════════════════════════════════════════════
   LOS TRES MAZOS INICIALES DEL DUELISTA LIBRE

   MEDIDO ANTES DE TOCARLOS. Puntuando cada carta por lo que cambia una
   partida de Goat (UR=3, SR=2, R=1):

     custom-starter-a .... 89        yugi-starter-c ..... 64
     custom-starter-c .... 89        yugi-starter-a ..... 51
     custom-starter-b .... 81        keith-starter ...... 46
                                     joey-starter ....... 45
     media custom: 86,3              mai / kaiba ........ 44
                                     media normales: 46,7

   O sea que el Duelista libre empezaba con casi el DOBLE de potencia que
   los cinco protagonistas, y con once cartas UR de salida: Pot of Greed,
   Graceful Charity, Heavy Storm, Snatch Steal, Premature Burial, Mirror
   Force, Torrential Tribute, Metamorphosis, Scapegoat… El paquete de
   staples entero. Eso no es un mazo inicial, es un mazo de torneo, y se
   carga la progresión: no queda nada que ganar durante la run.

   La filosofía de los starters de verdad, leída de los de Yugi, Joey y
   Mai, es esta:

     · monstruos NORMALES reconocibles como esqueleto;
     · dos o tres monstruos de efecto que de verdad valgan;
     · una sinergia temática simple y legible;
     · mágicas básicas: Fissure, De-Spell, Stop Defense, un equipo;
     · trampas básicas: Trap Hole, Waboku, Reinforcements,
       Spellbinding Circle, Just Desserts;
     · UNA sola carta gorda (Mystical Space Typhoon) y punto.

   Las cartas que ganan partidas se consiguen JUGANDO: recompensas,
   sobres, mercader, encuentros y maestría. Aquí no.

   Uso:  node custom-starters.mjs         escribe y saca el informe
         node custom-starters.mjs --ver   solo enseña qué haría
   ══════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from "node:fs";

const D = "../data/";
const leer = f => JSON.parse(readFileSync(D + f, "utf-8"));
const pool    = new Set(leer("goat-pool.json"));
const limites = leer("goat-limites.json");
const textos  = leer("pool_texts.json");
const decks   = leer("story/decks.json");

const porNombre = new Map();
for(const [code, v] of Object.entries(textos)){
  const n = Array.isArray(v) ? v[0] : v;
  if(pool.has(Number(code)) && !porNombre.has(n)) porNombre.set(n, Number(code));
}
const nombreDe = c => { const v = textos[String(c)];
                        return (Array.isArray(v) ? v[0] : v) ?? String(c); };
const tope = c => limites[String(c)] ?? 3;
const code = n => {
  const c = porNombre.get(n);
  if(c == null) throw new Error(`"${n}" no existe en el pool legal`);
  return c;
};

/* ══ EL KIT BÁSICO ══
   Es literalmente el que comparten los starters de Joey y Mai. Que los
   tres del Custom lo lleven igual es lo que hace que se lean como
   "mazos de estructura" y no como listas sueltas. */
const KIT = [
  [2, "Fissure"],                 // quita el monstruo más flojo: el removal de la época
  [1, "De-Spell"],
  [1, "Stop Defense"],
  [1, "Mystical Space Typhoon"],  // la ÚNICA carta gorda, igual que en los demás
  [2, "Trap Hole"],
  [2, "Waboku"],
  [2, "Reinforcements (GOAT)"],
  [2, "Spellbinding Circle"],
  [2, "Just Desserts"],
];

/* ══ LAS TRES IDENTIDADES ══
   Cada una con su esqueleto de normales, dos o tres efectos buenos y una
   sinergia que se entiende sin leer nada. */
const STARTERS = {
  "custom-starter-a": {
    titulo: "Control por volteo",
    /* ══ LA CARTA DE LA PORTADA SE ELIGE, NO SALE SOLA ══
       Era `main[0]`, o sea la primera carta de la lista: el mazo de
       Fusión enseñaba un Baby Dragon y el de volteo un Old Vindictive
       Magician. Un mazo se elige por la carta que te imaginas jugando,
       así que la insignia va escrita a mano. Lo pidió E. */
    insignia: "Penguin Soldier (GOAT)",
    desc: "Bichos boca abajo que hacen algo al voltearse. Aguanta y desgasta.",
    /* Sinergia: todo entra tapado, así que Stealth Bird y Des Lacooda
       trabajan cada turno y Old Vindictive castiga al que ataque.
       Evoluciona natural hacia el Flip Control de verdad: Magician of
       Faith, Tsukuyomi y Book of Moon salen en ARCANE. */
    monstruos: [
      [3, "Old Vindictive Magician"],  // al voltearse, se lleva un monstruo
      [3, "Stealth Bird"],             // 1700 de defensa y pega 1000 cada turno
      [3, "Des Lacooda"],              // roba una carta por volteo: el motor
      [2, "Mask of Darkness"],         // recupera una trampa
      [2, "Penguin Soldier (GOAT)"],   // devuelve dos monstruos a la mano
      [2, "Swarm of Scarabs"],         // 1000 de defensa, mata una tapada
      [2, "Nightmare Penguin"],
      [2, "Gravekeeper's Guard"],      // 1900 de defensa: el muro
    ],
    magicas: [
      [2, "Book of Moon"],             // tapa para volver a voltear: la sinergia
      [2, "The Shallow Grave"],        // devuelve un flip al campo, tapado
      [1, "Malevolent Nuzzler (GOAT)"],
      [1, "Castle Walls (GOAT)"],
    ],
  },
  "custom-starter-b": {
    titulo: "Ritual de Relinquished",
    insignia: "Relinquished (GOAT)",
    desc: "Busca la mágica ritual, invoca a Relinquished y róbale su monstruo.",
    /* Tres buscadores distintos para las dos piezas: es lo que hace que
       un mazo ritual funcione de salida en vez de depender del robo. */
    monstruos: [
      [2, "Relinquished (GOAT)"],      // la carta que da nombre al mazo
      [3, "Manju of the Ten Thousand Hands (GOAT)"],  // busca monstruo O mágica
      [2, "Senju of the Thousand Hands (GOAT)"],      // busca el monstruo
      [2, "Sonic Bird (GOAT)"],        // busca la mágica
      [2, "Mystical Elf"],             // 2000 de defensa mientras montas
      [2, "Wall of Illusion"],
      [2, "Gravekeeper's Guard"],
      [2, "Magical Merchant"],         // cava hasta la mágica ritual
    ],
    magicas: [
      [3, "Black Illusion Ritual"],    // sin ella no hay mazo: van las tres
      [2, "Malevolent Nuzzler (GOAT)"],
      [2, "The Shallow Grave"],
      [1, "Book of Moon"],
    ],
  },
  "custom-starter-c": {
    titulo: "Fusión",
    insignia: "Polymerization",
    desc: "Junta las piezas y saca monstruos grandes del Extra Deck.",
    /* Las dos fusiones clásicas de la serie, sus materiales, y DOS
       formas de llegar: Polymerization y los sustitutos de material.
       Fusion Sage busca la Polymerization, que es lo que hace que el
       mazo no dependa de robarla. */
    monstruos: [
      [2, "Baby Dragon"],              // material de Thousand Dragon
      [2, "Time Wizard"],              // el otro material
      /* ══ UNA FUSIÓN EN EL MAIN DECK ES UNA CARTA MUERTA ══
         Flame Swordsman estaba aquí, en el mazo principal. No se puede
         robar ni jugar: el motor no la deja salir de ahí, así que eran
         dos huecos perdidos de cuarenta. Lo vio E leyendo la lista.
         Ahora va al Extra y sus DOS materiales ocupan su sitio, que
         además es lo que el mazo quiere: piezas que juntar. */
      [1, "Flame Manipulator"],        // material de Flame Swordsman
      [1, "Masaki the Legendary Swordsman"],  // el otro
      [2, "King of the Swamp (GOAT)"], // sustituye a cualquier material
      [2, "Beastking of the Swamps"],  // el otro sustituto
      [2, "Gravekeeper's Guard"],
      [2, "Mystical Elf"],
      [3, "Neo the Magic Swordsman"],
    ],
    magicas: [
      [3, "Polymerization"],           // el mazo entero gira sobre ella
      [2, "Fusion Sage (GOAT)"],       // y la busca
      [2, "Malevolent Nuzzler (GOAT)"],
      [1, "Book of Moon"],
    ],
    /* OJO: Thousand Dragon está en la lista `fusionTematica` del
       generador, o sea que es una de las que se GANAN jugando. Darla de
       salida sería regalar el premio del mazo. Se queda fuera y en su
       sitio van fusiones pequeñas que no reparte ningún sobre. */
    extra: [
      [1, "Flame Swordsman"],          // sus dos materiales van en el main
      [1, "Fusionist"],
      [1, "Darkfire Dragon"],
      [1, "Karbonala Warrior"],
      [1, "Flame Ghost"],
    ],
  },
  "custom-starter-d": {
    titulo: "Necrovalley",
    insignia: "Necrovalley (Pre-Errata)",
    desc: "Cierra los cementerios y pega con los guardianes de la tumba.",
    monstruos: [
      [3, "Gravekeeper's Spy (GOAT)"], // saca otro Gravekeeper al voltearse
      [3, "Gravekeeper's Guard"],      // 1900 de defensa y devuelve un bicho
      [2, "Gravekeeper's Assailant"],
      [2, "Gravekeeper's Cannonholder"],
      [1, "Gravekeeper's Chief"],      // el jefe: 1900 y libera el cementerio
      [2, "Gravekeeper's Curse"],
      [2, "Mystical Elf"],
      [2, "Wall of Illusion"],
    ],
    magicas: [
      [3, "Necrovalley (Pre-Errata)"], // el campo: la identidad del mazo
      [2, "Rite of Spirit"],           // revive un Gravekeeper aun con Necrovalley
      [2, "Malevolent Nuzzler (GOAT)"],
      [1, "Book of Moon"],
    ],
  },
  "custom-starter-e": {
    titulo: "Zombis",
    insignia: "Vampire Lord (GOAT)",
    desc: "Pyramid Turtle saca lo grande y el cementerio nunca se vacía.",
    monstruos: [
      [3, "Pyramid Turtle (GOAT)"],    // al morir saca un zombi de hasta 2000
      [2, "Vampire Lord (GOAT)"],      // 2000, vuelve solo al morir: el premio
      [2, "Regenerating Mummy"],
      [2, "Master Kyonshee"],
      [2, "Double Coston"],            // vale por dos tributos
      [2, "Spirit Reaper (GOAT)"],     // no muere en combate
      [2, "Armored Zombie"],
      [3, "Dragon Zombie"],
    ],
    magicas: [
      [2, "Book of Life"],             // revive zombi y destierra del suyo
      [2, "The Shallow Grave"],
      [2, "Malevolent Nuzzler (GOAT)"],
      [1, "Book of Moon"],
    ],
  },
};

/* ══ LA VARA DE MEDIR ══
   La misma con la que se detectó el problema: rareza DE HISTORIA, o sea
   "cuánto cambia esta carta la partida", no la rareza de imprenta. */
const UR = new Set(["Pot of Greed","Graceful Charity","Delinquent Duo","Snatch Steal",
  "Premature Burial","Heavy Storm","Mirror Force","Ring of Destruction (Pre-Errata)",
  "Torrential Tribute","Call of the Haunted","Metamorphosis","Scapegoat (GOAT)",
  "Black Luster Soldier - Envoy of the Beginning (GOAT)","Chaos Sorcerer",
  "Thousand-Eyes Restrict (GOAT)","Tribe-Infecting Virus","Sinister Serpent (Pre-Errata)",
  "Confiscation","Mystical Space Typhoon","Painful Choice","Dark Hole","Raigeki",
  "Change of Heart","Monster Reborn","Harpie's Feather Duster","Exchange of the Spirit"]);
const SR = new Set(["Breaker the Magical Warrior","D.D. Warrior Lady","Magician of Faith",
  "Sangan (GOAT)","Book of Moon","Nobleman of Crossout (GOAT)","Sakuretsu Armor",
  "Trap Dustshoot","Dust Tornado","Solemn Judgment","Tsukuyomi","Airknight Parshath",
  "Asura Priest","Dekoichi the Battlechanted Locomotive","Spirit Reaper (GOAT)",
  "Exiled Force","Mystic Tomato (GOAT)","Gravekeeper's Spy (GOAT)",
  "Reinforcement of the Army (GOAT)","Enemy Controller","Compulsory Evacuation Device",
  "Nobleman of Extermination","Mother Grizzly (GOAT)","Wall of Revealing Light",
  "Smashing Ground","Creature Swap","Emergency Provisions","Dark Mimic LV1 (GOAT)",
  "Night Assailant","Magic Cylinder","Waboku","Mirage of Nightmare",
  "Skilled Dark Magician (GOAT)"]);
const VAL = { UR:3, SR:2, R:1 };
const rarezaDe = n => UR.has(n) ? "UR" : SR.has(n) ? "SR" : "R";
const puntuar = main => {
  const det = { UR:0, SR:0, R:0 };
  let s = 0;
  for(const c of main){ const r = rarezaDe(nombreDe(c)); det[r]++; s += VAL[r]; }
  return { s, det };
};

/* ── montar ── */
const problemas = [], hechos = [];
for(const [id, def] of Object.entries(STARTERS)){
  const main = [];
  const meter = lista => { for(const [n, nombre] of lista){
    const c = code(nombre); for(let i = 0; i < n; i++) main.push(c); } };
  try{ meter(def.monstruos); meter(def.magicas); meter(KIT); }
  catch(e){ problemas.push(`${id}: ${e.message}`); continue; }

  /* ══ NADA DE RELLENO AUTOMÁTICO ══
     La primera versión completaba hasta 40 repitiendo la primera carta,
     y salían tres Command Knight y tres Curse of Dragon —una de nivel 5
     que pide tributo—. Eso no es un mazo, es una lista cuadrada. Las
     tres listas suman 40 por diseño y si no, se para. */
  if(main.length !== 40)
    problemas.push(`${id}: la lista suma ${main.length} cartas, no 40`);

  /* ══ LEGALIDAD: manda el repositorio, no la idea ══ */
  const cuenta = new Map();
  for(const c of main) cuenta.set(c, (cuenta.get(c) ?? 0) + 1);
  for(const [c, n] of cuenta){
    if(!pool.has(c)) problemas.push(`${id}: ${nombreDe(c)} fuera del pool`);
    if(n > tope(c)) problemas.push(`${id}: ${nombreDe(c)} x${n}, tope ${tope(c)}`);
  }
  /* Y la comprobación que motivó todo esto: NADA del paquete de staples
     salvo el Mystical Space Typhoon que llevan también los otros. */
  const gordas = [...cuenta.keys()].map(nombreDe)
    .filter(n => UR.has(n) && n !== "Mystical Space Typhoon");
  if(gordas.length) problemas.push(`${id}: lleva staples de salida — ${gordas.join(", ")}`);

  const { s, det } = puntuar(main);
  hechos.push({ id, def, main, cuenta, s, det });
}

/* ── informe ── */
console.log("\n═══ STARTERS DEL DUELISTA LIBRE ═══\n");
for(const h of hechos){
  console.log(`── ${h.id} · ${h.def.titulo} — ${h.def.desc}`);
  console.log("   " + [...h.cuenta.entries()].map(([c,n]) => `${n}x ${nombreDe(c)}`).join(" · "));
  console.log(`   40 cartas · potencia ${h.s}  (UR ${h.det.UR} / SR ${h.det.SR} / R ${h.det.R})\n`);
}

/* Comparación con los starters de los cinco protagonistas. */
const normales = Object.entries(decks)
  .filter(([id, d]) => /^(yugi|joey|mai|keith|kaiba)-starter/.test(id) && d.main?.length === 40)
  .map(([id, d]) => ({ id, ...puntuar(d.main) }));
if(normales.length){
  const media = normales.reduce((a,b) => a + b.s, 0) / normales.length;
  const min = Math.min(...normales.map(n => n.s)), max = Math.max(...normales.map(n => n.s));
  const mediaC = hechos.reduce((a,b) => a + b.s, 0) / Math.max(1, hechos.length);
  console.log(`  starters de los cinco: media ${media.toFixed(1)}  (de ${min} a ${max})`);
  console.log(`  starters del Custom  : media ${mediaC.toFixed(1)}  → ${(mediaC-media>=0?"+":"")}${(mediaC-media).toFixed(1)}`);
  /* Se acepta estar dentro del rango de los normales. Que el Custom sea
     el más flojo tampoco vale: sería castigar por elegirlo. */
  if(mediaC > max) problemas.push(
    `los starters del Custom (${mediaC.toFixed(1)}) superan al más fuerte de los cinco (${max})`);
  if(mediaC < min - 4) problemas.push(
    `los starters del Custom (${mediaC.toFixed(1)}) se quedan muy por debajo del más flojo (${min})`);
}

if(problemas.length){
  console.log("\n  ✗ PROBLEMAS:");
  for(const p of problemas) console.log("     · " + p);
  process.exit(1);
}
console.log("\n  ✓ 40 cartas, dentro del pool y de los límites, sin staples de salida");
console.log("  ✓ y al nivel de los starters de los cinco protagonistas\n");

if(process.argv.includes("--ver")) process.exit(0);

for(const h of hechos){
  decks[h.id] = {
    id: h.id, titulo: h.def.titulo, _desc: h.def.desc,
    _potencia: `${h.s} (UR ${h.det.UR}/SR ${h.det.SR}/R ${h.det.R}) — lo genera story-tools/custom-starters.mjs`,
    main: h.main,
    /* Extra deck SOLO donde el mazo va de eso: el de Fusión lleva sus
       cuatro fusiones pequeñas, los demás ninguna. Un Thousand-Eyes
       Restrict de salida era medio motor de Goat regalado. */
    extra: (h.def.extra ?? []).flatMap(([n, nom]) => Array(n).fill(code(nom))),
  };
}
writeFileSync(D + "story/decks.json", JSON.stringify(decks, null, 1), "utf-8");

/* Y los nombres que ve el jugador al elegir. */
const pj = D + "story/personajes.json";
const datos = JSON.parse(readFileSync(pj, "utf-8"));
datos.starters = datos.starters ?? [];
for(const h of hechos){
  const ficha = datos.starters.find(s => s.id === h.id);
  const nuevo = { id:h.id, nombre:h.def.titulo, desc:h.def.desc,
                  carta: h.def.insignia ? code(h.def.insignia) : h.main[0] };
  if(ficha) Object.assign(ficha, nuevo); else datos.starters.push(nuevo);
}
writeFileSync(pj, JSON.stringify(datos, null, 1), "utf-8");
console.log("  escrito en data/story/decks.json y personajes.json\n");
