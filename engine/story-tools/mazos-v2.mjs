/* ══════════════════════════════════════════════════════════════════
   LOS MAZOS DEL MODO HISTORIA, VERSIÓN 2

   La filosofía cambió y merece escribirse aquí porque es lo que decide
   cada carta de cada lista:

     LOS MONSTRUOS DAN IDENTIDAD. EL SOPORTE DA DIFICULTAD.

   Un Weevil de tier 1 puede sacar un insecto de 1900 de ataque: eso no
   es lo que lo hace fácil. Lo que lo hace fácil es que sus mágicas y
   trampas son de anime —Forest, Insect Imitation, un Trap Hole suelto—,
   que no roba cartas de más y que no tiene forma de recuperar nada. La
   progresión de tier no sube los ataques: sube la CALIDAD DEL SOPORTE.

     T1  monstruos decentes + soporte primitivo
     T2  motor de reclutadores + interacción real (rogue de GOAT)
     T3  ratios optimizados + staples premium, pero se le sigue
         reconociendo el personaje a la primera

   La regla dura de tier 1: NADA de Pot of Greed, Graceful Charity,
   Delinquent Duo, Snatch Steal, Premature Burial, Mirror Force, Ring of
   Destruction, Torrential Tribute, Heavy Storm, Call of the Haunted ni
   Black Luster Soldier. Tampoco tres Sakuretsu ni Scapegoat +
   Metamorphosis optimizado.

   ── CÓMO SE ESCRIBE UNA LISTA ──
   Por NOMBRE, no por passcode: los passcodes no se leen y encima hay
   cartas con dos (la trampa más cara del proyecto). Aquí se resuelven
   contra `pool_texts.json`, se comprueba la pertenencia al pool legal y
   el tope de copias de `goat-limites.json`, y lo que no encaje sale en
   el informe en vez de colarse en silencio.

   Uso:  node mazos-v2.mjs            (escribe decks.json e informe)
         node mazos-v2.mjs --seco     (solo valida y enseña el informe)
   ══════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const D    = join(AQUI, "..", "data");
const leer = f => JSON.parse(readFileSync(f, "utf-8"));

const TEXTOS   = leer(join(D, "pool_texts.json"));
const POOL     = new Set(leer(join(D, "goat-pool.json")).map(Number));
const LIMITES  = leer(join(D, "goat-limites.json"));
const CARDS    = leer(join(D, "cards.json"));

/* El sufijo "(GOAT)" y compañía: en el pool la carta se llama
   "Scapegoat (GOAT)" y cualquier lista escrita a mano dice "Scapegoat". */
const canon = s => String(s ?? "")
  .replace(/\s*\((GOAT|Pre-errata|Pre-Errata|Anime|Manga)\)\s*$/i, "")
  .replace(/[’']/g, "'").trim().toLowerCase();

const PORNOMBRE = new Map();
for(const [code, v] of Object.entries(TEXTOS)){
  const n = Number(code);
  if(!POOL.has(n)) continue;                    // solo lo legal en Goat
  const k = canon(v[0]);
  /* Si hay dos passcodes con el mismo nombre canónico, gana el que
     tiene script: es EXACTAMENTE la trampa de las cartas mudas. */
  if(!PORNOMBRE.has(k)) PORNOMBRE.set(k, n);
}

const T_MON = 0x1, T_SPELL = 0x2, T_FUSION = 0x40;
const tipoDe = c => Number(CARDS[c]?.type ?? CARDS[String(c)]?.type ?? 0);
const categoria = c => (tipoDe(c) & T_MON) ? "M" : (tipoDe(c) & T_SPELL) ? "S" : "T";
const tope = c => LIMITES[String(c)] ?? 3;
const nombreDe = c => TEXTOS[c]?.[0] ?? TEXTOS[String(c)]?.[0] ?? ("#"+c);

/* ── EL PRESUPUESTO DE PODER ──
   La rareza de historia NO es la rareza impresa: aquí "UR" quiere decir
   "esta carta cambia la partida". Sale de las mismas listas que usa el
   catálogo del juego (`cards.json` del modo historia), así que un cambio
   ahí se refleja en el informe sin tocar nada. */
const POOLS = leer(join(D, "story", "cards.json"));
const RAREZA = new Map();
for(const c of POOLS.ultra ?? []) RAREZA.set(Number(c), "UR");
for(const c of POOLS.super ?? []) if(!RAREZA.has(Number(c))) RAREZA.set(Number(c), "SR");
for(const c of POOLS.rare  ?? []) if(!RAREZA.has(Number(c))) RAREZA.set(Number(c), "R");
const VALOR = { C:0, R:1, SR:2, UR:3 };
const rarezaDe = c => RAREZA.get(Number(c)) ?? "C";

/* Las cartas que un tier 1 NO puede llevar. No es una opinión: es la
   diferencia entre "el rival tiene monstruos buenos" y "el rival juega
   mejor que tú". */
const PROHIBIDAS_T1 = new Set([
  "pot of greed","graceful charity","delinquent duo","snatch steal",
  "premature burial","mirror force","ring of destruction","torrential tribute",
  "heavy storm","call of the haunted","black luster soldier - envoy of the beginning",
  "metamorphosis","tribe-infecting virus","sinister serpent","breaker the magical warrior",
  "thousand-eyes restrict","chaos sorcerer","exchange of the spirit",
]);

/* ══════════════════════════════════════════════════════════════════
   LAS LISTAS
   Formato: [cantidad, "Nombre"]. `extra` es el Extra Deck.
   `identidad` son las cartas que hacen reconocible al personaje: se
   cuentan en el informe para que un tier 3 no acabe siendo Chaos Turbo
   anónimo con el retrato cambiado.
   ══════════════════════════════════════════════════════════════════ */
export const MAZOS = {};

/* ── WEEVIL ── insectos. T1: bichos de anime + un par de insectos que sí
   pegan. Su debilidad es el soporte, no los monstruos. */
MAZOS["weevil-t1"] = { identidad:["Great Moth","Petit Moth","Cocoon of Evolution","Killer Needle","Basic Insect","Gokibore","Forest"], main:[
  [2,"Petit Moth"],[2,"Cocoon of Evolution"],[1,"Great Moth"],
  [2,"Killer Needle"],[2,"Basic Insect"],[2,"Girochin Kuwagata"],
  [2,"Insect Knight"],[2,"Howling Insect"],[1,"Man-Eater Bug"],
  [2,"Hercules Beetle"],[1,"Kuriboh"],
  [2,"Forest"],[1,"Insect Imitation"],[2,"Fissure"],[1,"De-Spell"],[1,"Stop Defense"],
  [2,"Trap Hole"],[2,"Waboku"],[2,"Reinforcements"],[2,"Spellbinding Circle"],
  [2,"Insect Barrier"],
  [1,"Girochin Kuwagata"],[3,"Neo Bug"],
]};
MAZOS["weevil-t2"] = { identidad:["Great Moth","Insect Knight","Howling Insect","Forest","Insect Barrier"], main:[
  [3,"Howling Insect"],[2,"Flying Kamakiri #1"],[3,"Insect Knight"],
  [2,"Ultimate Insect LV3"],[1,"Ultimate Insect LV5"],[1,"Great Moth"],
  [1,"Man-Eater Bug"],[2,"Hercules Beetle"],[1,"Sangan"],
  [1,"Book of Moon"],[2,"Smashing Ground"],[1,"Mystical Space Typhoon"],
  [1,"Creature Swap"],[1,"Nobleman of Crossout"],[2,"Forest"],
  [2,"Sakuretsu Armor"],[2,"Dust Tornado"],[2,"Waboku"],[2,"Trap Hole"],
  [1,"Neo Bug"],[1,"Girochin Kuwagata"],[2,"Widespread Ruin"],[2,"Reinforcements"],
  [2,"Insect Barrier"],
]};
MAZOS["weevil-t3"] = { identidad:["Ultimate Insect LV3","Ultimate Insect LV5","Insect Knight","Howling Insect","Insect Barrier","Great Moth"], main:[
  [3,"Howling Insect"],[2,"Flying Kamakiri #1"],[2,"Insect Knight"],
  [3,"Ultimate Insect LV3"],[2,"Ultimate Insect LV5"],[1,"Ultimate Insect LV7"],
  [1,"Sangan"],[1,"Man-Eater Bug"],[1,"Tribe-Infecting Virus"],[1,"Breaker the Magical Warrior"],
  [1,"Pot of Greed"],[1,"Graceful Charity"],[1,"Heavy Storm"],[1,"Mystical Space Typhoon"],
  [2,"Book of Moon"],[1,"Snatch Steal"],[1,"Creature Swap"],[1,"Nobleman of Crossout"],
  [1,"Mirror Force"],[1,"Torrential Tribute"],[2,"Sakuretsu Armor"],[2,"Dust Tornado"],
  [2,"Insect Barrier"],[2,"Widespread Ruin"],[2,"Solemn Judgment"],[1,"Call of the Haunted"],
  [1,"Delinquent Duo"],
]};

/* ── REX ── dinosaurios y presión. Red-Eyes está aquí a propósito: es el
   hilo narrativo con Joey. */
MAZOS["rex-t1"] = { identidad:["Two-Headed King Rex","Crawling Dragon #2","Uraby","Sword Arm of Dragon","Serpent Night Dragon","Red-Eyes Black Dragon","Wasteland"], main:[
  [3,"Two-Headed King Rex"],[2,"Crawling Dragon #2"],[3,"Uraby"],
  [1,"Kabazauls"],[1,"Element Saurus"],[1,"Serpent Night Dragon"],[1,"Red-Eyes Black Dragon"],
  [2,"Element Saurus"],[2,"Mad Sword Beast"],[1,"Man-Eater Bug"],[2,"Giant Soldier of Stone"],
  [2,"Wasteland"],[1,"Raise Body Heat"],[2,"Fissure"],[1,"De-Spell"],[1,"Stop Defense"],
  [2,"Trap Hole"],[2,"Waboku"],[3,"Reinforcements"],[2,"Spellbinding Circle"],
  [2,"Just Desserts"],[1,"Ultimate Offering"],
  [2,"Kabazauls"],
]};
MAZOS["rex-t2"] = { identidad:["Two-Headed King Rex","Red-Eyes Black Dragon","Hyper Hammerhead","Wasteland","Mad Sword Beast"], main:[
  [3,"Giant Rat"],[3,"Hyper Hammerhead"],[2,"Gilasaurus"],[2,"Berserk Gorilla"],
  [2,"Two-Headed King Rex"],[2,"Mad Sword Beast"],[1,"Red-Eyes Black Dragon"],
  [1,"Exiled Force"],[1,"Sangan"],[1,"Man-Eater Bug"],
  [1,"Book of Moon"],[2,"Smashing Ground"],[1,"Mystical Space Typhoon"],
  [1,"Creature Swap"],[1,"Nobleman of Crossout"],[2,"Wasteland"],[1,"Fissure"],
  [2,"Sakuretsu Armor"],[2,"Dust Tornado"],[2,"Widespread Ruin"],[2,"Waboku"],
  [2,"Reinforcements"],[1,"Trap Hole"],
  [2,"Kabazauls"],
]};
MAZOS["rex-t3"] = { identidad:["Two-Headed King Rex","Red-Eyes Black Dragon","Hyper Hammerhead","Berserk Gorilla","Gilasaurus"], main:[
  [3,"Giant Rat"],[3,"Hyper Hammerhead"],[2,"Berserk Gorilla"],[2,"Gilasaurus"],
  [1,"Two-Headed King Rex"],[1,"Red-Eyes Black Dragon"],[1,"Exiled Force"],
  [1,"Sangan"],[1,"Tribe-Infecting Virus"],[1,"Breaker the Magical Warrior"],
  [1,"Pot of Greed"],[1,"Graceful Charity"],[1,"Delinquent Duo"],[1,"Heavy Storm"],
  [1,"Mystical Space Typhoon"],[2,"Book of Moon"],[1,"Snatch Steal"],[1,"Premature Burial"],
  [1,"Creature Swap"],[1,"Nobleman of Crossout"],[2,"Smashing Ground"],
  [1,"Mirror Force"],[1,"Torrential Tribute"],[1,"Ring of Destruction"],
  [2,"Sakuretsu Armor"],[2,"Dust Tornado"],[2,"Solemn Judgment"],[1,"Call of the Haunted"],
  [1,"Sinister Serpent"],
]};

/* ── MAKO ── EL CASO QUE MEJOR ENSEÑA LA IDEA. Sus monstruos de tier 1
   son buenos: 1800-1900 de AGUA. Lo que no tiene es economía de cartas. */
MAZOS["mako-t1"] = { identidad:["Kairyu-Shin","Jellyfish","Great White","Fiend Kraken","Giant Red Seasnake","Umi"], main:[
  [1,"High Tide Gyojin"],[1,"Space Mambo"],[2,"Jellyfish"],[2,"Great White"],[2,"Fire Kraken"],
  [2,"Giant Red Seasnake"],[2,"7 Colored Fish"],[2,"Amphibian Beast"],
  [2,"Aqua Madoor"],[1,"Man-Eater Bug"],[2,"The Legendary Fisherman"],
  [2,"Umi"],[2,"Power of Kaishin"],[2,"Fissure"],[1,"De-Spell"],[1,"Stop Defense"],
  [2,"Trap Hole"],[2,"Waboku"],[2,"Reinforcements"],[2,"Spellbinding Circle"],
  [2,"Tribute to the Doomed"],[1,"Ultimate Offering"],
  [2,"High Tide Gyojin"],
]};
MAZOS["mako-t2"] = { identidad:["The Legendary Fisherman","A Legendary Ocean","Mother Grizzly","Abyss Soldier","Umi"], main:[
  [3,"Mother Grizzly"],[2,"Abyss Soldier"],[2,"Mermaid Knight"],[2,"Yomi Ship"],
  [2,"7 Colored Fish"],[2,"Amphibian Beast"],[2,"The Legendary Fisherman"],
  [1,"Sangan"],[1,"Man-Eater Bug"],
  [3,"A Legendary Ocean"],[1,"Salvage"],[1,"Book of Moon"],[2,"Smashing Ground"],
  [1,"Mystical Space Typhoon"],[1,"Creature Swap"],[1,"Nobleman of Crossout"],
  [2,"Sakuretsu Armor"],[2,"Dust Tornado"],[2,"Widespread Ruin"],[2,"Waboku"],
  [2,"Reinforcements"],[1,"Trap Hole"],
  [2,"Great White"],
]};
MAZOS["mako-t3"] = { identidad:["The Legendary Fisherman","A Legendary Ocean","Mother Grizzly","Abyss Soldier"], main:[
  [3,"Mother Grizzly"],[2,"Abyss Soldier"],[2,"Mermaid Knight"],[2,"Yomi Ship"],
  [1,"The Legendary Fisherman"],[1,"Sangan"],[1,"Tribe-Infecting Virus"],
  [1,"Sinister Serpent"],[1,"Breaker the Magical Warrior"],[1,"Exiled Force"],
  [3,"A Legendary Ocean"],[1,"Salvage"],[1,"Pot of Greed"],[1,"Graceful Charity"],
  [1,"Delinquent Duo"],[1,"Heavy Storm"],[1,"Mystical Space Typhoon"],[2,"Book of Moon"],
  [1,"Snatch Steal"],[1,"Premature Burial"],[1,"Nobleman of Crossout"],[1,"Smashing Ground"],
  [1,"Mirror Force"],[1,"Torrential Tribute"],[1,"Ring of Destruction"],
  [2,"Sakuretsu Armor"],[2,"Dust Tornado"],[2,"Solemn Judgment"],[1,"Call of the Haunted"],
]};

/* ── GHOST KAIBA ── el impostor de la isla. Cuerpos buenos y soporte
   flojo: es el jefe del acto I y no vuelve a aparecer. */
MAZOS["ghost-kaiba-t1"] = { identidad:["Blue-Eyes White Dragon","Battle Ox","La Jinn the Mystical Genie of the Lamp","Judge Man","Lord of D.","The Flute of Summoning Dragon"], main:[
  [2,"Blue-Eyes White Dragon"],[2,"Lord of D."],[2,"The Flute of Summoning Dragon"],
  [3,"La Jinn the Mystical Genie of the Lamp"],[3,"Battle Ox"],[2,"Judge Man"],
  [2,"Rude Kaiser"],[2,"Ryu-Kishin Powered"],[2,"Mystic Horseman"],
  [1,"Man-Eater Bug"],[2,"Giant Soldier of Stone"],
  [1,"Mystical Space Typhoon"],[2,"Fissure"],[1,"De-Spell"],[1,"Stop Defense"],
  [2,"Trap Hole"],[2,"Waboku"],[2,"Reinforcements"],[2,"Spellbinding Circle"],
  [2,"Just Desserts"],[2,"Ultimate Offering"],
]};

/* ── PANIK ── miedo y oscuridad. */
MAZOS["panik-t1"] = { identidad:["Castle of Dark Illusions","King of Yamimakai","Reaper of the Cards","Dark Chimera","Yami"], main:[
  [2,"Castle of Dark Illusions"],[3,"King of Yamimakai"],[2,"Reaper of the Cards"],
  [2,"The Bistro Butcher"],[2,"Archfiend Soldier"],[2,"Opticlops"],[2,"Dark Elf"],
  [2,"Giant Soldier of Stone"],[1,"Man-Eater Bug"],[2,"Wall of Illusion"],
  [2,"Yami"],[2,"Dark Energy"],[2,"Fissure"],[1,"De-Spell"],[1,"Tribute to the Doomed"],
  [2,"Trap Hole"],[2,"Waboku"],[2,"Spellbinding Circle"],[2,"Just Desserts"],
  [2,"Reinforcements"],
  [1,"Opticlops"],[1,"Whiptail Crow"],
]};
MAZOS["panik-t2"] = { identidad:["Castle of Dark Illusions","Dark Necrofear","Dark Ruler Ha Des","Yami","Newdoria"], main:[
  [3,"Giant Germ"],[2,"Slate Warrior"],[2,"Newdoria"],[2,"Archfiend Soldier"],
  [2,"Opticlops"],[1,"Dark Ruler Ha Des"],[1,"Dark Necrofear"],[1,"Castle of Dark Illusions"],
  [1,"Sangan"],[1,"Man-Eater Bug"],[2,"Spirit Reaper"],
  [2,"Yami"],[1,"Book of Moon"],[2,"Smashing Ground"],[1,"Mystical Space Typhoon"],
  [1,"Creature Swap"],[1,"Nobleman of Crossout"],
  [2,"Sakuretsu Armor"],[2,"Dust Tornado"],[2,"Widespread Ruin"],[2,"Waboku"],
  [2,"Trap Hole"],[2,"Reinforcements"],
  [2,"The Bistro Butcher"],
]};
MAZOS["panik-t3"] = { identidad:["Dark Necrofear","Dark Ruler Ha Des","Castle of Dark Illusions","Newdoria","Giant Germ"], main:[
  [3,"Giant Germ"],[2,"Slate Warrior"],[2,"Newdoria"],[1,"Dark Ruler Ha Des"],
  [1,"Dark Necrofear"],[2,"Spirit Reaper"],[1,"Don Zaloog"],[1,"Sangan"],
  [1,"Tribe-Infecting Virus"],[1,"Sinister Serpent"],[1,"Breaker the Magical Warrior"],
  [1,"Pot of Greed"],[1,"Graceful Charity"],[1,"Delinquent Duo"],[1,"Heavy Storm"],
  [1,"Mystical Space Typhoon"],[2,"Book of Moon"],[1,"Snatch Steal"],[1,"Premature Burial"],
  [1,"Nobleman of Crossout"],[1,"Smashing Ground"],[1,"Creature Swap"],
  [1,"Mirror Force"],[1,"Torrential Tribute"],[1,"Ring of Destruction"],
  [2,"Sakuretsu Armor"],[2,"Dust Tornado"],[2,"Solemn Judgment"],[1,"Call of the Haunted"],
  [2,"Archfiend Soldier"],
]};

/* ── BONZ ── zombis. T1 de anime con un adelanto pequeño de lo que viene. */
MAZOS["bonz-t1"] = { identidad:["Pumpking the King of Ghosts","Dragon Zombie","Armored Zombie","Clown Zombie","The Snake Hair"], main:[
  [2,"Pumpking the King of Ghosts"],[3,"Dragon Zombie"],[3,"Armored Zombie"],
  [2,"Clown Zombie"],[2,"Master Kyonshee"],[2,"Wandering Mummy"],
  [2,"Pyramid Turtle"],[2,"Souls of the Forgotten"],[1,"Man-Eater Bug"],
  [2,"Giant Soldier of Stone"],
  [1,"Book of Life"],[2,"Fissure"],[1,"De-Spell"],[1,"Tribute to the Doomed"],
  [2,"Trap Hole"],[2,"Waboku"],[2,"Spellbinding Circle"],[2,"Reinforcements"],
  [2,"Just Desserts"],[2,"Ultimate Offering"],
  [1,"Master Kyonshee"],[1,"Fear from the Dark"],
]};
MAZOS["bonz-t2"] = { identidad:["Pumpking the King of Ghosts","Pyramid Turtle","Vampire Lord","Book of Life","Ryu Kokki"], main:[
  [3,"Pyramid Turtle"],[2,"Vampire Lord"],[2,"Ryu Kokki"],[2,"Spirit Reaper"],
  [2,"Wandering Mummy"],[1,"Pumpking the King of Ghosts"],[2,"Giant Rat"],
  [1,"Sangan"],[1,"Man-Eater Bug"],[2,"Double Coston"],
  [2,"Book of Life"],[1,"Book of Moon"],[2,"Smashing Ground"],[1,"Mystical Space Typhoon"],
  [1,"Creature Swap"],[1,"Nobleman of Crossout"],
  [2,"Sakuretsu Armor"],[2,"Dust Tornado"],[2,"Widespread Ruin"],[2,"Waboku"],
  [2,"Trap Hole"],[2,"Reinforcements"],
  [2,"Regenerating Mummy"],
]};
MAZOS["bonz-t3"] = { identidad:["Pyramid Turtle","Vampire Lord","Ryu Kokki","Book of Life","Pumpking the King of Ghosts"], main:[
  [3,"Pyramid Turtle"],[2,"Vampire Lord"],[2,"Ryu Kokki"],[2,"Spirit Reaper"],
  [1,"Pumpking the King of Ghosts"],[1,"Double Coston"],[1,"Sangan"],
  [1,"Tribe-Infecting Virus"],[1,"Sinister Serpent"],[1,"Breaker the Magical Warrior"],
  [2,"Book of Life"],[1,"Pot of Greed"],[1,"Graceful Charity"],[1,"Delinquent Duo"],
  [1,"Heavy Storm"],[1,"Mystical Space Typhoon"],[2,"Book of Moon"],[1,"Snatch Steal"],
  [1,"Premature Burial"],[1,"Nobleman of Crossout"],[1,"Smashing Ground"],
  [1,"Mirror Force"],[1,"Torrential Tribute"],[1,"Ring of Destruction"],
  [2,"Sakuretsu Armor"],[2,"Dust Tornado"],[2,"Solemn Judgment"],[1,"Call of the Haunted"],
  [2,"Regenerating Mummy"],
]};

/* ── HERMANOS PARADOJA ── muros y control. Jefe del acto II. */
MAZOS["labyrinth-brothers-t1"] = { identidad:["Sanga of the Thunder","Kazejin","Suijin","Labyrinth Wall","Wall Shadow","Shadow Ghoul","Jirai Gumo"], main:[
  [1,"Sanga of the Thunder"],[1,"Kazejin"],[1,"Suijin"],
  [3,"Labyrinth Wall"],[2,"Wall Shadow"],[2,"Shadow Ghoul"],[2,"Jirai Gumo"],
  [2,"Giant Soldier of Stone"],[2,"Aqua Madoor"],[2,"Wall of Illusion"],
  [1,"Man-Eater Bug"],[2,"Dark Elf"],
  [2,"Fissure"],[1,"De-Spell"],[1,"Stop Defense"],[1,"Tribute to the Doomed"],
  [2,"Trap Hole"],[3,"Waboku"],[2,"Spellbinding Circle"],[2,"Reinforcements"],
  [2,"Just Desserts"],[1,"Ultimate Offering"],
  [2,"Mystical Elf"],
]};
MAZOS["labyrinth-brothers-t2"] = { identidad:["Sanga of the Thunder","Kazejin","Suijin","Labyrinth Wall","Wall Shadow"], main:[
  [3,"Gravekeeper's Spy"],[2,"Giant Soldier of Stone"],[1,"Sanga of the Thunder"],
  [1,"Kazejin"],[1,"Suijin"],[2,"Labyrinth Wall"],[2,"Fusilier Dragon, the Dual-Mode Beast"],
  [1,"Sangan"],[1,"Man-Eater Bug"],[2,"Spirit Reaper"],[2,"Wall of Illusion"],
  [1,"Scapegoat"],[1,"Book of Moon"],[2,"Smashing Ground"],[1,"Mystical Space Typhoon"],
  [1,"Creature Swap"],[1,"Nobleman of Crossout"],
  [2,"Sakuretsu Armor"],[2,"Dust Tornado"],[2,"Widespread Ruin"],[3,"Waboku"],
  [2,"Trap Hole"],[2,"Reinforcements"],
  [2,"Mystical Elf"],
]};
MAZOS["labyrinth-brothers-t3"] = { identidad:["Sanga of the Thunder","Kazejin","Suijin","Labyrinth Wall","Gravekeeper's Spy"], main:[
  [3,"Gravekeeper's Spy"],[1,"Sanga of the Thunder"],[1,"Kazejin"],[1,"Suijin"],
  [1,"Labyrinth Wall"],[2,"Fusilier Dragon, the Dual-Mode Beast"],[2,"Spirit Reaper"],
  [1,"Sangan"],[1,"Tribe-Infecting Virus"],[1,"Sinister Serpent"],
  [1,"Breaker the Magical Warrior"],[1,"Magician of Faith"],
  [1,"Scapegoat"],[1,"Metamorphosis"],[1,"Pot of Greed"],[1,"Graceful Charity"],
  [1,"Delinquent Duo"],[1,"Heavy Storm"],[1,"Mystical Space Typhoon"],[2,"Book of Moon"],
  [1,"Snatch Steal"],[1,"Premature Burial"],[1,"Nobleman of Crossout"],[1,"Smashing Ground"],
  [1,"Mirror Force"],[1,"Torrential Tribute"],[1,"Ring of Destruction"],
  [2,"Sakuretsu Armor"],[2,"Dust Tornado"],[2,"Solemn Judgment"],[1,"Call of the Haunted"],
  [1,"Solemn Judgment"],
], extra:[[1,"Thousand-Eyes Restrict"]] };

export const IDENTIDAD_MIN = { 1:6, 2:4, 3:3 };

/* ══════════════════════════════════════════════════════════════════
   LOS CINCO PERSONAJES JUGABLES

   Mazo de salida = mazo de anime + unas pocas cartas temáticas buenas +
   soporte básico. NO empiezan siendo su versión de torre: eso es lo que
   te vas a construir durante la run.
   ══════════════════════════════════════════════════════════════════ */

MAZOS["joey-starter"] = { identidad:["Red-Eyes Black Dragon","Gearfried the Iron Knight","Time Wizard","Baby Dragon","Flame Swordsman"], main:[
  [1,"Red-Eyes Black Dragon"],[2,"Gearfried the Iron Knight"],[1,"Time Wizard"],
  [2,"Baby Dragon"],[1,"Flame Manipulator"],[1,"Masaki the Legendary Swordsman"],[2,"Goblin Attack Force"],
  [1,"Skull Mariner"],[1,"Beautiful Headhuntress"],[2,"Kojikocy"],[2,"Little-Winguard"],
  [2,"Blade Knight"],[1,"Marauding Captain"],[1,"Man-Eater Bug"],
  [1,"Polymerization"],[1,"Reinforcement of the Army"],[2,"Fissure"],
  [1,"Mystical Space Typhoon"],[1,"De-Spell"],[1,"Stop Defense"],
  [2,"Trap Hole"],[2,"Waboku"],[2,"Reinforcements"],[2,"Spellbinding Circle"],
  [1,"Graverobber"],[2,"Just Desserts"],
  [2,"Skull Mariner"],
], extra:[[1,"Flame Swordsman"]] };

MAZOS["mai-starter"] = { identidad:["Harpie Lady","Harpie Lady Sisters","Harpies' Hunting Ground","Cyber Harpie Lady","Elegant Egotist"], main:[
  [3,"Harpie Lady"],[1,"Harpie Lady Sisters"],[2,"Cyber Harpie Lady"],
  [1,"Harpie's Pet Dragon"],[2,"Birdface"],[2,"Silpheed"],
  [2,"Flying Kamakiri #1"],[2,"Amazoness Swords Woman"],[2,"Luster Dragon"],
  [1,"Man-Eater Bug"],[2,"Sonic Duck"],
  [2,"Harpies' Hunting Ground"],[1,"Elegant Egotist"],[2,"Fissure"],
  [1,"Mystical Space Typhoon"],[1,"De-Spell"],[1,"Stop Defense"],
  [2,"Trap Hole"],[2,"Waboku"],[2,"Reinforcements"],[2,"Spellbinding Circle"],
  [2,"Just Desserts"],
  [1,"Sonic Duck"],[1,"Harpie Lady 2"],
]};

MAZOS["keith-starter"] = { identidad:["Barrel Dragon","Mechanicalchaser","Limiter Removal","Slot Machine"], main:[
  [1,"Barrel Dragon"],[3,"Mechanicalchaser"],[1,"Slot Machine"],
  [2,"X-Head Cannon"],[2,"UFO Turtle"],[2,"Dekoichi the Battlechanted Locomotive"],
  [1,"Cannon Soldier"],[2,"Giga Gagagigo"],[2,"Cannon Soldier"],
  [1,"Man-Eater Bug"],[2,"7 Colored Fish"],
  [1,"Limiter Removal"],[2,"Fissure"],[1,"Mystical Space Typhoon"],
  [1,"De-Spell"],[1,"Stop Defense"],
  [2,"Trap Hole"],[2,"Waboku"],[2,"Reinforcements"],[2,"Spellbinding Circle"],
  [2,"Just Desserts"],[1,"Ultimate Offering"],
  [1,"Giga Gagagigo"],[2,"Slot Machine"],[1,"Mechanical Snail"],
]};

MAZOS["kaiba-starter"] = { identidad:["Blue-Eyes White Dragon","Lord of D.","The Flute of Summoning Dragon","Battle Ox","Kaibaman"], main:[
  [2,"Blue-Eyes White Dragon"],[2,"Lord of D."],[2,"The Flute of Summoning Dragon"],
  [1,"Kaibaman"],[2,"Luster Dragon"],[3,"La Jinn the Mystical Genie of the Lamp"],
  [2,"Battle Ox"],[2,"Mirage Dragon"],[2,"Shining Angel"],
  [1,"Man-Eater Bug"],[2,"Giant Soldier of Stone"],
  [2,"Fissure"],[1,"Mystical Space Typhoon"],[1,"De-Spell"],[1,"Stop Defense"],
  [2,"Trap Hole"],[2,"Waboku"],[2,"Reinforcements"],[2,"Spellbinding Circle"],
  [2,"Just Desserts"],[2,"Ultimate Offering"],
  [2,"Ryu-Kishin Powered"],
]};

/* ══════════════════════════════════════════════════════════════════
   LA TORRE DEL CASTILLO

   Cinco peldaños de dureza creciente. Todos llevan staples premium —son
   el final de la run— pero cada uno los lleva DISTINTOS, y todos
   conservan de ocho a doce cartas de identidad. Un Kaiba de torre no
   puede ser Chaos Turbo con el retrato cambiado.
   ══════════════════════════════════════════════════════════════════ */

/* 1 · MAI — tempo de VIENTO. La más asequible de la torre, pero coherente. */
MAZOS["mai-torre"] = { identidad:["Harpie Lady 1","Cyber Harpie Lady","Harpie Lady Sisters","Harpies' Hunting Ground","Elegant Egotist","Birdface","Silpheed","Harpie's Pet Dragon"], main:[
  [3,"Harpie Lady 1"],[2,"Cyber Harpie Lady"],[1,"Harpie Lady Sisters"],
  [2,"Birdface"],[2,"Silpheed"],[2,"Flying Kamakiri #1"],
  [1,"Harpie's Pet Dragon"],[2,"Blade Knight"],[1,"Sangan"],[1,"Breaker the Magical Warrior"],
  [1,"Tribe-Infecting Virus"],[1,"Magician of Faith"],
  [3,"Harpies' Hunting Ground"],[1,"Elegant Egotist"],[1,"Pot of Greed"],
  [1,"Heavy Storm"],[1,"Mystical Space Typhoon"],[2,"Book of Moon"],
  [1,"Nobleman of Crossout"],[1,"Snatch Steal"],[1,"Smashing Ground"],
  [2,"Sakuretsu Armor"],[2,"Dust Tornado"],[2,"Widespread Ruin"],
  [1,"Mirror Force"],[1,"Torrential Tribute"],[1,"Call of the Haunted"],
]};

/* 2 · KEITH — máquinas explosivas. Limiter Removal tiene que doler. */
MAZOS["keith-torre"] = { identidad:["Barrel Dragon","Mechanicalchaser","Limiter Removal","X-Head Cannon","UFO Turtle","Reflect Bounder","Dekoichi the Battlechanted Locomotive","Jinzo"], main:[
  [2,"Barrel Dragon"],[3,"Mechanicalchaser"],[2,"X-Head Cannon"],
  [3,"UFO Turtle"],[2,"Dekoichi the Battlechanted Locomotive"],[1,"Reflect Bounder"],
  [1,"Jinzo"],[1,"Sangan"],[1,"Breaker the Magical Warrior"],
  [1,"Tribe-Infecting Virus"],[1,"Magician of Faith"],
  [2,"Limiter Removal"],[1,"Pot of Greed"],[1,"Graceful Charity"],[1,"Delinquent Duo"],
  [1,"Heavy Storm"],[1,"Mystical Space Typhoon"],[2,"Book of Moon"],
  [1,"Snatch Steal"],[1,"Premature Burial"],[1,"Nobleman of Crossout"],
  [1,"Smashing Ground"],[1,"Mirror Force"],[1,"Torrential Tribute"],
  [1,"Ring of Destruction"],[2,"Sakuretsu Armor"],[1,"Dust Tornado"],[1,"Call of the Haunted"],
  [2,"Cannon Soldier"],
]};

/* 3 · JOEY — guerreros con capa de Red-Eyes. Que se le vea el personaje
   sin obligar al mazo a ser un combo malo de Red-Eyes. */
MAZOS["joey-torre"] = { identidad:["Red-Eyes Black Dragon","Gearfried the Iron Knight","Goblin Attack Force","Time Wizard","Marauding Captain","Reinforcement of the Army"], main:[
  [2,"Gearfried the Iron Knight"],[2,"Goblin Attack Force"],[1,"Red-Eyes Black Dragon"],
  [1,"Time Wizard"],[2,"D.D. Assailant"],[2,"Blade Knight"],[2,"Marauding Captain"],
  [1,"Exiled Force"],[1,"Sangan"],[1,"Breaker the Magical Warrior"],
  [1,"Tribe-Infecting Virus"],[1,"Magician of Faith"],[1,"Sinister Serpent"],
  [2,"Reinforcement of the Army"],[1,"Scapegoat"],[1,"Metamorphosis"],
  [1,"Pot of Greed"],[1,"Graceful Charity"],[1,"Delinquent Duo"],[1,"Heavy Storm"],
  [1,"Mystical Space Typhoon"],[2,"Book of Moon"],[1,"Snatch Steal"],
  [1,"Premature Burial"],[1,"Nobleman of Crossout"],[1,"Smashing Ground"],
  [1,"Mirror Force"],[1,"Torrential Tribute"],[1,"Ring of Destruction"],
  [1,"Sakuretsu Armor"],[1,"Call of the Haunted"],
  [1,"D.D. Warrior Lady"],[1,"Getsu Fuhma"],
], extra:[[1,"Thousand-Eyes Restrict"]] };

/* 4 · KAIBA — Ojos Azules de verdad, con motor. No se le quitan los
   dragones para que gane más: se construye alrededor de ellos. */
MAZOS["kaiba-torre"] = { identidad:["Blue-Eyes White Dragon","Kaibaman","Lord of D.","The Flute of Summoning Dragon","Luster Dragon","Mirage Dragon","Shining Angel","Burst Stream of Destruction"], main:[
  [2,"Blue-Eyes White Dragon"],[2,"Kaibaman"],[3,"Shining Angel"],
  [2,"Luster Dragon"],[2,"Mirage Dragon"],[1,"Lord of D."],[1,"The Flute of Summoning Dragon"],
  [1,"Sangan"],[1,"Breaker the Magical Warrior"],[1,"Tribe-Infecting Virus"],
  [1,"Magician of Faith"],[1,"Sinister Serpent"],[1,"Chaos Sorcerer"],
  [1,"Burst Stream of Destruction"],[1,"Enemy Controller"],[1,"Pot of Greed"],
  [1,"Graceful Charity"],[1,"Delinquent Duo"],[1,"Heavy Storm"],
  [1,"Mystical Space Typhoon"],[2,"Book of Moon"],[1,"Snatch Steal"],
  [1,"Premature Burial"],[1,"Nobleman of Crossout"],[1,"Smashing Ground"],
  [1,"Mirror Force"],[1,"Torrential Tribute"],[1,"Ring of Destruction"],
  [1,"Sakuretsu Armor"],[1,"Call of the Haunted"],
  [2,"Enemy Controller"],[1,"Element Dragon"],
]};

/* 5 · YUGI — el rival no jefe más duro. Spellcaster/Chaos Control que
   sigue siendo inconfundiblemente Yugi: el Mago Oscuro es un impuesto de
   identidad DENTRO de un mazo fuerte, no la excusa para un mazo malo. */
MAZOS["yugi-torre"] = { identidad:["Dark Magician","Dark Magician Girl","Skilled Dark Magician","Magician of Faith","Apprentice Magician","Old Vindictive Magician","Kycoo the Ghost Destroyer","Tsukuyomi"], main:[
  [1,"Dark Magician"],[1,"Dark Magician Girl"],[2,"Skilled Dark Magician"],
  [2,"Apprentice Magician"],[1,"Old Vindictive Magician"],[1,"Magician of Faith"],
  [2,"Kycoo the Ghost Destroyer"],[1,"Tsukuyomi"],[3,"Gravekeeper's Spy"],
  [1,"Breaker the Magical Warrior"],[1,"Tribe-Infecting Virus"],[1,"Sinister Serpent"],
  [1,"Chaos Sorcerer"],[1,"Sangan"],
  [1,"Scapegoat"],[1,"Metamorphosis"],[1,"Pot of Greed"],[1,"Graceful Charity"],
  [1,"Delinquent Duo"],[1,"Heavy Storm"],[1,"Mystical Space Typhoon"],[2,"Book of Moon"],
  [1,"Snatch Steal"],[1,"Premature Burial"],[1,"Nobleman of Crossout"],
  [1,"Smashing Ground"],[1,"Mirror Force"],[1,"Torrential Tribute"],
  [1,"Ring of Destruction"],[1,"Sakuretsu Armor"],[1,"Call of the Haunted"],
  [1,"Asura Priest"],[2,"Nimble Momonga"],
], extra:[[1,"Thousand-Eyes Restrict"],[1,"Dark Balter the Terrible"]] };

/* ══════════════════════════════════════════════════════════════════
   VALIDACIÓN, PUNTUACIÓN E INFORME

   Nada se escribe en `decks.json` sin pasar por aquí. Lo que no se
   resuelve NO se sustituye en silencio: sale en el informe. Esa es la
   regla que evitó cuatro reportes distintos con lo de las cartas mudas.
   ══════════════════════════════════════════════════════════════════ */
function resolver(nombre){
  const k = canon(nombre);
  const code = PORNOMBRE.get(k);
  return code ?? null;
}

export function compilar(id, receta){
  const problemas = [], main = [], extra = [];
  const cuenta = new Map();
  const meter = (lista, destino) => {
    for(const [n, nombre] of lista ?? []){
      const code = resolver(nombre);
      if(!code){ problemas.push(`no existe en el pool legal: "${nombre}"`); continue; }
      const ya = cuenta.get(code) ?? 0;
      const t = tope(code);
      /* EL TOPE SE CUENTA SOBRE EL MAZO ENTERO, no línea a línea: es
         como se colaron cinco Two-Headed King Rex la primera vez. */
      const puedo = Math.max(0, t - ya);
      if(n > puedo)
        problemas.push(`"${nombreDe(code)}" x${n} pero el límite es ${t} (ya hay ${ya})`);
      const meten = Math.min(n, puedo);
      cuenta.set(code, ya + meten);
      for(let i=0;i<meten;i++) destino.push(code);
    }
  };
  meter(receta.main, main);
  meter(receta.extra, extra);

  if(main.length !== 40) problemas.push(`main de ${main.length} cartas, deberían ser 40`);
  if(extra.length > 15)  problemas.push(`extra de ${extra.length}, máximo 15`);

  /* El tier sale del identificador, que es donde vive de verdad. */
  const tier = /-t1$|starter$/.test(id) ? 1 : /-t2$/.test(id) ? 2
             : /-torre$/.test(id) ? 3 : /-t3$/.test(id) ? 3 : 2;
  if(tier === 1){
    for(const c of new Set(main)){
      if(PROHIBIDAS_T1.has(canon(nombreDe(c))))
        problemas.push(`tier 1 con carta de tier 3: "${nombreDe(c)}"`);
    }
  }

  /* Puntuación por categoría. La progresión que importa es la de
     mágicas + trampas: los monstruos pueden quedarse casi igual. */
  const punt = { M:0, S:0, T:0 };
  const rar  = { C:0, R:0, SR:0, UR:0 };
  for(const c of main){
    const r = rarezaDe(c);
    rar[r]++; punt[categoria(c)] += VALOR[r];
  }
  const nombresIdent = new Set((receta.identidad ?? []).map(canon));
  const identidad = main.filter(c => nombresIdent.has(canon(nombreDe(c)))).length;
  const premium = main.filter(c => rarezaDe(c) === "UR").length;
  const conteo = { M:0, S:0, T:0 };
  for(const c of main) conteo[categoria(c)]++;

  return { id, tier, main, extra, problemas,
    metricas: { total:main.length, monstruos:conteo.M, magicas:conteo.S, trampas:conteo.T,
                identidad, premium, rarezas:rar,
                poderMonstruo:punt.M, poderMagica:punt.S, poderTrampa:punt.T,
                poderSoporte:punt.S+punt.T, poderTotal:punt.M+punt.S+punt.T } };
}



/* ══════════════════════════════════════════════════════════════════
   TRES MAZOS DE SALIDA POR DUELISTA

   Yugi tenía tres y el resto uno. Tres importan: son tres formas de
   empezar la MISMA run, y con ellas la elección de personaje deja de
   ser un retrato distinto para ser una decisión de mazo.

   El patrón de los tres es siempre el mismo, y sale de los de Yugi:
     A · la carta icónica y su entorno directo (el mazo del anime)
     B · el arquetipo lateral del personaje (lo que también le pega)
     C · el que ya mira a lo que puede llegar a ser (semilla de motor)
   Todos siguen siendo TIER 1: monstruos decentes, soporte primitivo.
   ══════════════════════════════════════════════════════════════════ */

/* ── JOEY ── */
MAZOS["joey-starter-b"] = { identidad:["Gearfried the Iron Knight","Goblin Attack Force","Marauding Captain","Little-Winguard"], main:[
  [2,"Gearfried the Iron Knight"],[2,"Goblin Attack Force"],[2,"Marauding Captain"],
  [2,"Blade Knight"],[2,"Little-Winguard"],[2,"Kojikocy"],[2,"Skull Mariner"],
  [2,"Beautiful Headhuntress"],[1,"Man-Eater Bug"],[2,"Giant Soldier of Stone"],
  [1,"Mystic Horseman"],[1,"White Ninja"],
  [1,"Reinforcement of the Army"],[2,"Fissure"],[1,"Mystical Space Typhoon"],
  [1,"De-Spell"],[1,"Stop Defense"],
  [2,"Trap Hole"],[2,"Waboku"],[2,"Reinforcements"],[2,"Spellbinding Circle"],
  [2,"Just Desserts"],[1,"Ultimate Offering"],
  [2,"Mystic Horseman"],
]};
MAZOS["joey-starter-c"] = { identidad:["Red-Eyes Black Dragon","Baby Dragon","Time Wizard","Gearfried the Iron Knight"], main:[
  [2,"Red-Eyes Black Dragon"],[3,"Baby Dragon"],[1,"Time Wizard"],
  [2,"Luster Dragon"],[2,"Mirage Dragon"],[2,"Gearfried the Iron Knight"],
  [2,"Blade Knight"],[2,"Kojikocy"],[1,"Man-Eater Bug"],[2,"Giant Soldier of Stone"],
  [1,"Sonic Duck"],[1,"Spirit Ryu"],
  [2,"Fissure"],[1,"Mystical Space Typhoon"],[1,"De-Spell"],[1,"Stop Defense"],
  [2,"Trap Hole"],[2,"Waboku"],[2,"Reinforcements"],[2,"Spellbinding Circle"],
  [2,"Just Desserts"],[2,"Ultimate Offering"],
  [2,"Sonic Duck"],
]};

/* ── MAI ── */
MAZOS["mai-starter-b"] = { identidad:["Cyber Harpie Lady","Harpie's Pet Dragon","Harpies' Hunting Ground","Elegant Egotist"], main:[
  [3,"Cyber Harpie Lady"],[2,"Harpie Lady"],[2,"Harpie's Pet Dragon"],
  [2,"Luster Dragon"],[2,"Mirage Dragon"],[2,"Birdface"],[2,"Silpheed"],
  [1,"Man-Eater Bug"],[2,"Giant Soldier of Stone"],[2,"Sonic Duck"],
  [2,"Harpies' Hunting Ground"],[1,"Elegant Egotist"],[2,"Fissure"],
  [1,"Mystical Space Typhoon"],[1,"De-Spell"],[1,"Stop Defense"],
  [2,"Trap Hole"],[2,"Waboku"],[2,"Reinforcements"],[2,"Spellbinding Circle"],
  [2,"Just Desserts"],
  [1,"Sonic Duck"],[1,"Harpie Lady 2"],
]};
MAZOS["mai-starter-c"] = { identidad:["Harpie Lady","Amazoness Swords Woman","Flying Kamakiri #1","Harpies' Hunting Ground"], main:[
  [3,"Harpie Lady"],[2,"Amazoness Swords Woman"],[2,"Amazoness Paladin"],
  [3,"Flying Kamakiri #1"],[2,"Silpheed"],[2,"Birdface"],[2,"Sonic Duck"],
  [1,"Man-Eater Bug"],[2,"Insect Knight"],[2,"Giant Soldier of Stone"],
  [2,"Harpies' Hunting Ground"],[2,"Fissure"],[1,"Mystical Space Typhoon"],
  [1,"De-Spell"],[1,"Stop Defense"],
  [2,"Trap Hole"],[2,"Waboku"],[2,"Reinforcements"],[2,"Spellbinding Circle"],
  [2,"Just Desserts"],
  [1,"Insect Knight"],[1,"Harpie Lady 2"],
]};

/* ── KEITH ── */
MAZOS["keith-starter-b"] = { identidad:["Mechanicalchaser","X-Head Cannon","Limiter Removal","Cannon Soldier"], main:[
  [3,"Mechanicalchaser"],[3,"X-Head Cannon"],[2,"Cannon Soldier"],
  [2,"Robotic Knight"],[2,"Cyber Falcon"],[2,"Machine King"],
  [2,"Dekoichi the Battlechanted Locomotive"],[1,"Man-Eater Bug"],
  [2,"Giant Soldier of Stone"],[2,"Giga Gagagigo"],
  [2,"Limiter Removal"],[2,"Fissure"],[1,"Mystical Space Typhoon"],
  [1,"De-Spell"],[1,"Stop Defense"],
  [2,"Trap Hole"],[2,"Waboku"],[2,"Reinforcements"],[2,"Spellbinding Circle"],
  [2,"Just Desserts"],
  [1,"Giga Gagagigo"],[1,"Cyber Raider"],
]};
MAZOS["keith-starter-c"] = { identidad:["Barrel Dragon","Slot Machine","Mechanicalchaser","Limiter Removal"], main:[
  [2,"Barrel Dragon"],[2,"Slot Machine"],[3,"Mechanicalchaser"],
  [3,"UFO Turtle"],[2,"Dekoichi the Battlechanted Locomotive"],
  [2,"Cyber Falcon"],[2,"Cyber Raider"],[1,"Man-Eater Bug"],
  [2,"Giga Gagagigo"],[2,"Giant Soldier of Stone"],
  [1,"Limiter Removal"],[2,"Fissure"],[1,"Mystical Space Typhoon"],
  [1,"De-Spell"],[1,"Stop Defense"],
  [2,"Trap Hole"],[2,"Waboku"],[2,"Reinforcements"],[2,"Spellbinding Circle"],
  [2,"Just Desserts"],[1,"Ultimate Offering"],
  [1,"Cyber Raider"],[1,"Giga Gagagigo"],
]};

/* ── KAIBA ── */
MAZOS["kaiba-starter-b"] = { identidad:["Blue-Eyes White Dragon","Kaibaman","Luster Dragon","Mirage Dragon"], main:[
  [3,"Blue-Eyes White Dragon"],[2,"Kaibaman"],[3,"Luster Dragon"],
  [2,"Mirage Dragon"],[2,"Element Dragon"],[2,"Shining Angel"],
  [1,"Spirit Ryu"],[1,"Element Dragon"],[1,"Man-Eater Bug"],[2,"Giant Soldier of Stone"],
  [2,"La Jinn the Mystical Genie of the Lamp"],
  [2,"Fissure"],[1,"Mystical Space Typhoon"],[1,"De-Spell"],[1,"Stop Defense"],
  [2,"Trap Hole"],[2,"Waboku"],[2,"Reinforcements"],[2,"Spellbinding Circle"],
  [2,"Just Desserts"],[2,"Ultimate Offering"],
  [2,"Spirit Ryu"],
]};
MAZOS["kaiba-starter-c"] = { identidad:["Battle Ox","Judge Man","Rude Kaiser","La Jinn the Mystical Genie of the Lamp"], main:[
  [3,"Battle Ox"],[3,"La Jinn the Mystical Genie of the Lamp"],[2,"Judge Man"],
  [2,"Rude Kaiser"],[2,"Ryu-Kishin Powered"],[2,"Mystic Horseman"],
  [2,"Opticlops"],[2,"Archfiend Soldier"],[1,"Man-Eater Bug"],
  [2,"Giant Soldier of Stone"],[1,"Blue-Eyes White Dragon"],
  [2,"Fissure"],[1,"Mystical Space Typhoon"],[1,"De-Spell"],[1,"Stop Defense"],
  [2,"Trap Hole"],[2,"Waboku"],[2,"Reinforcements"],[2,"Spellbinding Circle"],
  [2,"Just Desserts"],[2,"Ultimate Offering"],
  [1,"Opticlops"],
]};

/* ── ejecución ── */
/* ESTO VA AL FINAL DEL ARCHIVO A PROPÓSITO. `MAZOS` se rellena a medida
   que el módulo se ejecuta, así que un bucle colocado a media altura
   solo ve las listas escritas ANTES: los ocho mazos de salida nuevos se
   quedaron fuera de decks.json sin una sola queja, porque los 28 que sí
   entraron eran todos válidos y el informe daba verde. */
/* ══════════════════════════════════════════════════════════════════
   AJUSTES DEL M9 (02-10) — LA CURVA MEDIDA EN RUNS COMPLETAS

   `simular-run.mjs` juega runs enteras con duelos reales y el mazo del
   jugador mejorándose; `medir-escalera.mjs` enfrenta cada rival a
   mazos REALES de jugador en el punto de la run donde aparece. Lo que
   salió (bot contra bot, el suelo de un humano):

     acto I    Elite: Joey T2 22%, Mako T2 30%; jefe (Ghost Kaiba) 74%
     acto II   PaniK T2 14%, Bonz T2 19%  — Rex T2 37%, Laberinto T2 41%
     castillo  Mai 25 · Keith 23 · Joey 23 · KAIBA 46 · Yugi 21 · Pegasus 21

   PaniK y Bonz de tier 2 eran el muro de la run (el 40% de las runs
   perdidas morían ahí) porque sus MONSTRUOS ya eran los de Goat meta
   —Spirit Reaper, Giant Germ, Pyramid Turtle, Vampire Lord—. Y la torre
   iba al revés de lo que promete: Kaiba, cuarto peldaño, era el más
   fácil. Objetivo del suelo: Elite del acto I ~45%, duelos del acto II
   ~45%, y la torre bajando de ~50% (Mai) a ~30% (Yugi), Pegasus el
   último y el más duro.

   Se sobreescriben aquí y no en su sitio para que el cambio se vea de
   un vistazo y se pueda deshacer de una vez.
   ══════════════════════════════════════════════════════════════════ */

/* PaniK T2: los monstruos vuelven a ser los suyos (Yamimakai, Reaper of
   the Cards) en vez de Spirit Reaper y Archfiend Soldier. */
MAZOS["panik-t2"] = { identidad:["Castle of Dark Illusions","Dark Necrofear","Dark Ruler Ha Des","Yami","Newdoria","King of Yamimakai","Reaper of the Cards"], main:[
  [3,"Giant Germ"],[2,"Slate Warrior"],[2,"Newdoria"],[2,"King of Yamimakai"],
  [2,"Opticlops"],[1,"Dark Ruler Ha Des"],[1,"Dark Necrofear"],[1,"Castle of Dark Illusions"],
  [2,"Reaper of the Cards"],[1,"Man-Eater Bug"],[1,"Dark Elf"],
  [2,"Yami"],[1,"Book of Moon"],[2,"Smashing Ground"],[1,"Mystical Space Typhoon"],
  [1,"Creature Swap"],[1,"Nobleman of Crossout"],
  [2,"Sakuretsu Armor"],[2,"Dust Tornado"],[2,"Just Desserts"],[2,"Waboku"],
  [2,"Trap Hole"],[2,"Reinforcements"],
  [2,"The Bistro Butcher"],
]};
/* Bonz T2: zombis de anime con UN paquete de Pyramid Turtle, no el
   motor entero de Zombie Goat Control. */
MAZOS["bonz-t2"] = { identidad:["Pumpking the King of Ghosts","Pyramid Turtle","Vampire Lord","Book of Life","Ryu Kokki","Dragon Zombie","Armored Zombie"], main:[
  [2,"Pyramid Turtle"],[1,"Master Kyonshee"],[1,"Ryu Kokki"],[3,"Dragon Zombie"],
  [2,"Wandering Mummy"],[1,"Pumpking the King of Ghosts"],[2,"Armored Zombie"],
  [2,"Clown Zombie"],[1,"Master Kyonshee"],[1,"Man-Eater Bug"],[2,"Double Coston"],
  [2,"Book of Life"],[1,"Book of Moon"],[2,"Smashing Ground"],[1,"Mystical Space Typhoon"],
  [1,"Creature Swap"],[1,"Nobleman of Crossout"],
  [2,"Sakuretsu Armor"],[2,"Dust Tornado"],[2,"Just Desserts"],[2,"Waboku"],
  [2,"Trap Hole"],[2,"Reinforcements"],
  [2,"Regenerating Mummy"],
]};
/* PaniK y Bonz T3 (Elite del acto II, 18% y 24%). Lo primero que se
   probó fue quitarles las tres trampas que limpian mesa, y antes Solemn
   Judgment y salieron MÁS duros (3% y 16%): a la IA, Solemn le cuesta
   media vida y el rival se la come a daño. Para la IA, Solemn es una
   carta mala y Widespread Ruin una muy buena. */
/* Y tampoco eso los movió (18% y 21%): lo que pesa son los monstruos.
   Fuera los dos Spirit Reaper, que no son ni de PaniK ni de Bonz. */
MAZOS["panik-t3"] = { ...MAZOS["panik-t3"], main: MAZOS["panik-t3"].main
  .map(([n,c]) => c==="Spirit Reaper" ? [n,"King of Yamimakai"] : [n,c]) };
MAZOS["bonz-t3"]  = { ...MAZOS["bonz-t3"],  main: MAZOS["bonz-t3"].main
  .map(([n,c]) => c==="Spirit Reaper" ? [n,"Dragon Zombie"] : [n,c]) };
/* Tampoco (21% los dos, y Rex T3 29%). Y un Elite del acto II a ese
   porcentaje es una trampa, no un riesgo: un nodo solo se completa
   ganando, así que cada derrota es una ficha y hay que volver a
   jugarlo. Los T3 de los duelistas del acto II se quedan sin el paquete
   de ventaja que es propio del castillo: Delinquent Duo, Snatch Steal,
   Premature Burial y Call of the Haunted. */
const sinPaqueteDeCastillo = ([n,c]) => c==="Delinquent Duo" ? [n,"Waboku"]
  : c==="Snatch Steal" ? [n,"Trap Hole"] : c==="Premature Burial" ? [n,"Reinforcements"]
  : c==="Call of the Haunted" ? [n,"Waboku"] : [n,c];
for(const id of ["panik-t3","bonz-t3","rex-t3"])
  MAZOS[id] = { ...MAZOS[id], main: MAZOS[id].main.map(sinPaqueteDeCastillo) };
/* Mako T2 (Elite del acto I, 30%): Spellbinding Circle en vez de
   Widespread Ruin. */
MAZOS["mako-t2"] = { ...MAZOS["mako-t2"], main: MAZOS["mako-t2"].main
  .map(([n,c]) => c==="Widespread Ruin" ? [n,"Spellbinding Circle"] : c==="Sakuretsu Armor" ? [n,"Just Desserts"] : [n,c]) };
/* Joey T2 (Elite del acto I, 22%) venía de la versión 1 con soporte de
   castillo: Premature Burial, Call of the Haunted, Torrential Tribute,
   Scapegoat + Metamorphosis y tres Sakuretsu. Se queda con el soporte de
   tier 2 de todos los demás. */
MAZOS["joey-t2"] = { identidad:["Red-Eyes Black Dragon","Gearfried the Iron Knight","Goblin Attack Force","Time Wizard","Marauding Captain","Black Dragon's Chick"], main:[
  [2,"Red-Eyes Black Dragon"],[2,"Black Dragon's Chick"],[2,"Mystic Tomato"],
  [2,"Gearfried the Iron Knight"],[2,"Blade Knight"],[2,"D.D. Assailant"],
  [2,"Marauding Captain"],[1,"Exiled Force"],[1,"Sangan"],[1,"Kycoo the Ghost Destroyer"],
  [2,"Goblin Attack Force"],[1,"Time Wizard"],
  [1,"Reinforcement of the Army"],[2,"Book of Moon"],[2,"Smashing Ground"],
  [1,"Nobleman of Crossout"],[1,"Mystical Space Typhoon"],[1,"Creature Swap"],
  [1,"The Warrior Returning Alive"],
  [2,"Spellbinding Circle"],[2,"Dust Tornado"],[2,"Waboku"],[2,"Trap Hole"],
  [1,"Bottomless Trap Hole"],[2,"Reinforcements"],
], extra:[[1,"Dark Balter the Terrible"],[1,"Ryu Senshi"]] };
/* El jefe del acto I (74%): el mismo Ghost Kaiba con soporte de tier 2.
   `personajes.json` lo apunta en sus tiers 2 y 3. */
MAZOS["ghost-kaiba-t2"] = { identidad:["Blue-Eyes White Dragon","Battle Ox","La Jinn the Mystical Genie of the Lamp","Judge Man","Lord of D.","The Flute of Summoning Dragon"], main:[
  [2,"Blue-Eyes White Dragon"],[2,"Lord of D."],[2,"The Flute of Summoning Dragon"],
  [3,"La Jinn the Mystical Genie of the Lamp"],[3,"Battle Ox"],[2,"Judge Man"],
  [2,"Rude Kaiser"],[2,"Ryu-Kishin Powered"],[2,"Mystic Horseman"],
  [1,"Man-Eater Bug"],[2,"Giant Soldier of Stone"],
  [1,"Mystical Space Typhoon"],[2,"Smashing Ground"],[1,"Book of Moon"],[1,"Nobleman of Crossout"],
  [2,"Trap Hole"],[2,"Waboku"],[2,"Reinforcements"],[2,"Sakuretsu Armor"],
  [2,"Dust Tornado"],[2,"Just Desserts"],
]};
/* ── LA TORRE, EN ORDEN ── */
/* Mai, primer peldaño (25%): fuera el paquete de castillo más duro. */
MAZOS["mai-torre"] = { ...MAZOS["mai-torre"], main: MAZOS["mai-torre"].main
  .filter(([n,c]) => !["Tribe-Infecting Virus","Magician of Faith","Snatch Steal",
                       "Torrential Tribute","Call of the Haunted","Mirror Force"].includes(c))
  .concat([[1,"Harpie Lady Sisters"],[1,"Harpie's Pet Dragon"],[1,"Elegant Egotist"],
           [2,"Waboku"],[1,"Trap Hole"]]) };
/* Keith, segundo (23%). */
MAZOS["keith-torre"] = { ...MAZOS["keith-torre"], main: MAZOS["keith-torre"].main
  .filter(([n,c]) => !["Graceful Charity","Delinquent Duo","Premature Burial",
                       "Ring of Destruction","Snatch Steal","Torrential Tribute","Heavy Storm"].includes(c))
  .concat([[2,"Spellbinding Circle"],[1,"X-Head Cannon"],[2,"Waboku"],[1,"Trap Hole"],[1,"Dust Tornado"]]) };
/* Joey, tercero (23%). Quitando también Snatch Steal y Ring se iba al
   49%, por encima de Mai; quitando solo Snatch, al 32%. Se queda el
   Snatch y se va el Ring. */
MAZOS["joey-torre"] = { ...MAZOS["joey-torre"], main: MAZOS["joey-torre"].main
  .filter(([n,c]) => !["Graceful Charity","Delinquent Duo","Metamorphosis","Ring of Destruction"].includes(c))
  .concat([[1,"Gearfried the Iron Knight"],[1,"Blade Knight"],[1,"Dust Tornado"],[1,"Waboku"]]),
  extra: [] };
/* Kaiba, cuarto (46%, el más fácil): menos ladrillos y más interacción.
   Con dos Solemn Judgment salía MÁS fácil (51%): ver la nota de PaniK. */
MAZOS["kaiba-torre"] = { ...MAZOS["kaiba-torre"], main: MAZOS["kaiba-torre"].main
  .map(([n,c]) => c==="Kaibaman" ? [1,c] : [n,c])
  .filter(([n,c]) => !["Lord of D.","The Flute of Summoning Dragon","Element Dragon","Enemy Controller"].includes(c))
  .concat([[3,"Widespread Ruin"],[1,"Sakuretsu Armor"],[1,"Dust Tornado"],[1,"Bottomless Trap Hole"],[1,"Enemy Controller"]]) };
/* Yugi, quinto (21%): un poco menos que Pegasus. */
MAZOS["yugi-torre"] = { ...MAZOS["yugi-torre"], main: MAZOS["yugi-torre"].main
  .filter(([n,c]) => !["Delinquent Duo","Ring of Destruction"].includes(c))
  .concat([[1,"Dark Magician"],[1,"Dark Magician Girl"]]) };

const seco = process.argv.includes("--seco");
const salida = {}, informe = [], fallos = [];
for(const [id, receta] of Object.entries(MAZOS)){
  const r = compilar(id, receta);
  salida[id] = { main: r.main, extra: r.extra };
  informe.push({ id: r.id, tier: r.tier, ...r.metricas, problemas: r.problemas });
  if(r.problemas.length) fallos.push([id, r.problemas]);
}

/* La tabla, en el orden en que se juega. */
const col = (s,n) => String(s).padEnd(n);
const num = (s,n) => String(s).padStart(n);
console.log("\n═══ MAZOS DEL MODO HISTORIA · presupuesto de poder ═══\n");
console.log(col("Mazo",26)+num("T",2)+num("M",4)+num("S",4)+num("T",4)
          + num("Id",4)+num("UR",4)+num("pM",5)+num("pS",5)+num("pT",5)+num("pSop",6)+"  estado");
console.log("─".repeat(94));
for(const f of informe){
  console.log(col(f.id,26)+num(f.tier,2)+num(f.monstruos,4)+num(f.magicas,4)+num(f.trampas,4)
    + num(f.identidad,4)+num(f.premium,4)+num(f.poderMonstruo,5)+num(f.poderMagica,5)
    + num(f.poderTrampa,5)+num(f.poderSoporte,6)
    + "  " + (f.problemas.length ? "✗ "+f.problemas.length : "✓"));
}

/* LA COMPROBACIÓN QUE DA SENTIDO A TODO: el soporte tiene que subir
   claramente de tier en tier. El poder de monstruo NO tiene por qué. */
console.log("\n── la curva, por personaje ──");
const porPersonaje = new Map();
for(const f of informe){
  const m = /^(.*)-t([123])$/.exec(f.id);
  if(!m) continue;
  if(!porPersonaje.has(m[1])) porPersonaje.set(m[1], {});
  porPersonaje.get(m[1])[m[2]] = f;
}
let avisos = 0;
for(const [quien, t] of porPersonaje){
  if(!(t[1] && t[2] && t[3])) continue;
  const sop = [t[1].poderSoporte, t[2].poderSoporte, t[3].poderSoporte];
  const mon = [t[1].poderMonstruo, t[2].poderMonstruo, t[3].poderMonstruo];
  const sube = sop[0] < sop[1] && sop[1] < sop[2];
  if(!sube) avisos++;
  console.log(`  ${col(quien,22)} soporte ${sop.join(" → ")}   monstruo ${mon.join(" → ")}` +
              (sube ? "   ✓" : "   ⚠ el soporte no sube en los dos saltos"));
}

if(fallos.length){
  console.log("\n── problemas ──");
  for(const [id, ps] of fallos) for(const p of ps) console.log(`  ${col(id,24)} ${p}`);
}

if(!seco){
  const destino = join(D, "story", "decks.json");
  const anterior = leer(destino);
  /* Se conserva lo que ya existía y no se ha regenerado: los starters de
     Yugi y los mazos de Pegasus siguen validados de la versión 1. */
  writeFileSync(destino, JSON.stringify({ ...anterior, ...salida }, null, 1));
  writeFileSync(join(D, "story", "informe-mazos.json"),
                JSON.stringify({ generado: new Date().toISOString().slice(0,10),
                                 mazos: informe }, null, 1));
  console.log(`\nescritos ${Object.keys(salida).length} mazos en decks.json`);
  console.log("informe en engine/data/story/informe-mazos.json");
}
console.log(fallos.length ? `\nFALLA: ${fallos.length} mazos con problemas` : "\nTodos los mazos válidos");
if(avisos) console.log(`${avisos} personaje(s) con la curva de soporte plana`);
process.exit(fallos.length ? 1 : 0);
