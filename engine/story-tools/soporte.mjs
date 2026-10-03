/* ══════════════════════════════════════════════════════════════════
   ¿TIENE SOPORTE ESTE MAZO INICIAL?

   E lo preguntó así: «tiene que haber soporte para todos los mazos
   iniciales. Por ejemplo para Mago Oscuro hay ya soporte, pero para
   efectos de volteo igual no tanto».

   Tenía razón y el número lo dice: los sobres solo reparten unas 180
   cartas distintas de las 1.685 del pool, y esas 180 están escritas a
   mano en `engine/data/story/cards.json`. Si el tema de un mazo inicial
   no está entre ellas, ese jugador abre sobres durante toda la aventura
   y no mejora nunca: le salen cartas buenas, pero de OTRO mazo.

   Esto no lo decide a ojo. Para cada mazo inicial saca sus señales DEL
   PROPIO MAZO —las razas que juega, los archetipos por nombre, y las
   palabras que sus cartas repiten en el texto— y luego cuenta cuántas
   de las cartas que un sobre puede darte encajan con esas señales.

   Uso:  node soporte.mjs              la tabla
         node soporte.mjs --detalle    y qué cartas cuentan
         node soporte.mjs --huecos     solo los mazos por debajo del mínimo
   ══════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";

const D = new URL("../data/", import.meta.url);
const leer = f => JSON.parse(readFileSync(new URL(f, D), "utf-8"));

const textos = leer("pool_texts.json");     // code → [nombre, texto]
const cards  = leer("pool_cards.json");     // code → {type, race, level, attack…}
const decks  = leer("story/decks.json");
const pers   = leer("story/personajes.json");
const pools  = leer("story/cards.json");

const nom  = c => textos[String(c)]?.[0] ?? ("#" + c);
const txt  = c => textos[String(c)]?.[1] ?? "";
const dato = c => cards[String(c)] ?? {};
const TIPO = { MONSTRUO:0x1, MAGIA:0x2, TRAMPA:0x4, FUSION:0x40 };
const esMonstruo = c => !!((dato(c).type ?? 0) & TIPO.MONSTRUO);

/* ══ LO QUE UN SOBRE PUEDE DARTE ══
   Las listas de familia (el tema del sobre) más las de rareza (las
   casillas STAPLE, que salen en cualquier sobre) más las premium. Es la
   misma unión que usa `catalogo.js`: si mañana se mueve una carta de
   lista, esto se entera solo. */
const FAMILIAS = ["arcane","warrior","dragon","recruit","forbid"];
const STAPLES  = ["ultra","super","rare"];
const PREMIUM  = ["fusion","fusionTematica"];
const obtenibles = new Map();               // code → de qué listas sale
for(const k of [...FAMILIAS, ...STAPLES, ...PREMIUM, "maestria"])
  for(const c of (pools[k] ?? [])){
    if(!obtenibles.has(c)) obtenibles.set(c, []);
    obtenibles.get(c).push(k);
  }

/* ══ LAS SEÑALES DE UN MAZO SALEN DEL MAZO ══
   Nada escrito a mano: se leen las razas que juega, los prefijos de
   archetipo que repite en los nombres y las palabras que sus cartas
   repiten en el TEXTO. Un mazo de volteo repite "FLIP:"; uno de
   Gravekeepers repite "Necrovalley"; uno de fusión repite "Fusion". */
/* ══ UNA PALABRA COMÚN NO ES UNA SEÑAL ══
   La primera versión contaba "battle", "spell" y "position" como tema
   del mazo, y con eso TODOS los mazos sacaban entre 39 y 114: un número
   que no distingue nada no sirve para decidir. Lo que identifica a un
   mazo es lo que NO dicen las demás cartas. Así que se mide cuántas
   cartas del pool usan cada palabra y se descarta la que salga en más
   del 4%: "Necrovalley" pasa el filtro, "battle" no. Nada escrito a
   mano — la lista de palabras vetadas la saca el propio pool. */
const TOPE_COMUN = 0.04;
const frecuencia = new Map();
for(const c of Object.keys(textos)){
  for(const p of new Set((txt(c) + " " + nom(c)).toLowerCase().match(/[a-z'#]{4,}/g) ?? []))
    frecuencia.set(p, (frecuencia.get(p) ?? 0) + 1);
}
const TOTAL_POOL = Object.keys(textos).length;
const comun = p => (frecuencia.get(p) ?? 0) / TOTAL_POOL > TOPE_COMUN;
const PALABROTAS = { has: p => comun(p) };

function señalesDe(mazo){
  const main = mazo.main ?? [];
  const razas = new Map(), tokens = new Map(), palabras = new Map();
  for(const c of new Set(main)){
    const copias = main.filter(x => x === c).length;
    if(esMonstruo(c)){
      const r = String(dato(c).race ?? "");
      if(r) razas.set(r, (razas.get(r) ?? 0) + copias);
    }
    /* Archetipo por nombre: "Gravekeeper's Spy" → "gravekeeper's".
       Se pide que la palabra aparezca en DOS cartas distintas del mazo,
       porque una sola es una carta suelta, no un tema. */
    for(const p of nom(c).toLowerCase().replace(/\(.*?\)/g,"").split(/[\s\-,]+/)){
      if(p.length < 4 || PALABROTAS.has(p)) continue;
      tokens.set(p, (tokens.get(p) ?? 0) + 1);
    }
    for(const p of txt(c).toLowerCase().match(/[a-z'#]{4,}/g) ?? []){
      if(PALABROTAS.has(p)) continue;
      palabras.set(p, (palabras.get(p) ?? 0) + 1);
    }
  }
  const top = (m, min, n) => [...m.entries()].filter(([,v]) => v >= min)
                              .sort((a,b) => b[1]-a[1]).slice(0, n).map(([k])=>k);
  const r = {
    razas:    top(razas, 6, 3),          // una raza con menos de 6 copias no es el mazo
    tokens:   top(tokens, 2, 6),         // un archetipo aparece en dos cartas o más
    palabras: top(palabras, 4, 8),       // una mecánica se repite en cuatro cartas
  };
  /* ══ NO TODOS LOS MAZOS TIENEN TEMA, Y ESO NO ES UN FALLO ══
     "La guardia de KaibaCorp" son Battle Ox y La Jinn: se mejora con
     cuerpos más grandes, no con cartas de su archetipo, porque no tiene
     archetipo. Exigirle soporte temático sería inventarse un problema.
     Tiene tema el que repite un nombre en TRES cartas o juega una raza
     de verdad. */
  r.temaFuerte = top(tokens, 3, 6).length > 0 || r.razas.length > 0;
  r.tema = top(tokens, 3, 3);
  return r;
}

/* ══ UN MAZO SIN TEMA TAMBIÉN SE MEJORA ══
   "La guardia de KaibaCorp" son Battle Ox y La Jinn: no tiene archetipo
   ni una raza dominante, así que por señales sacaba un 7 y parecía
   abandonado. No lo está — un mazo de pegar se mejora con cuerpos más
   grandes y con quitamonstruos, y de eso los sobres van llenos. Se
   cuentan aparte y vale el MAYOR de los dos números: un mazo está bien
   servido si tiene soporte temático O camino genérico. */
const REMOCION = /destroy (?:1|one|all|that) |return (?:it|1|that) |send (?:it|1|that) .{0,20}to the (?:graveyard|gy)|banish|remove (?:it|1|that) from play/i;
function apoyaGenerico(c){
  const d = dato(c);
  if(esMonstruo(c)) return (d.attack ?? 0) >= 1700 && (d.level ?? 9) <= 4;
  return REMOCION.test(txt(c)) || /equip/i.test(txt(c));
}

/* ¿Esta carta del sobre le sirve a ese mazo? */
function apoya(c, s){
  const razones = [];
  const n = nom(c).toLowerCase(), t = txt(c).toLowerCase();
  if(esMonstruo(c) && s.razas.includes(String(dato(c).race ?? "")))
    razones.push("misma raza");
  for(const k of s.tokens) if(n.includes(k)) razones.push("archetipo «"+k+"»");
  for(const p of s.palabras) if(n.includes(p) || t.includes(p)) razones.push("«"+p+"»");
  return razones;
}

/* ── LA TABLA ── */
const DETALLE = process.argv.includes("--detalle");
const SOLOHUECOS = process.argv.includes("--huecos");
/* El mínimo. Por debajo de esto, ese jugador abre sobres toda la
   aventura sin mejorar su mazo: es exactamente lo que reportó E. */
const MINIMO = 10;

const filas = [];
for(const st of (pers.starters ?? [])){
  const mazo = decks[st.id];
  if(!mazo) continue;
  const s = señalesDe(mazo);
  const apoyos = [];
  for(const c of obtenibles.keys()){
    const r = apoya(c, s);
    if(r.length) apoyos.push({ c, r, listas: obtenibles.get(c) });
  }
  /* Lo que sale de una FAMILIA es soporte de verdad: puedes ir a por
     ello. Lo que solo cae por rareza es lotería y cuenta a medias. */
  const enFamilia = apoyos.filter(a => a.listas.some(l => FAMILIAS.includes(l)));
  const tematica = enFamilia.length + Math.round((apoyos.length - enFamilia.length) / 2);
  /* El camino genérico cuenta a la mitad: sirve, pero no es tu mazo. */
  const generica = Math.round([...obtenibles.keys()].filter(apoyaGenerico).length / 2);
  filas.push({ st, s, apoyos, enFamilia, tematica, generica,
               nota: Math.max(tematica, generica),
               via: s.temaFuerte ? "tema: " + (s.tema[0] ?? "raza") : "genérico",
               /* Solo se le exige soporte temático al que tiene tema. */
               corto: s.temaFuerte && tematica < MINIMO });
}
filas.sort((a,b) => a.tematica - b.tematica);

console.log(`\n═══ SOPORTE DE LOS ${filas.length} MAZOS INICIALES ═══`);
console.log(`\n  Un sobre puede darte ${obtenibles.size} cartas distintas`
          + ` (de ${Object.keys(cards).length} del pool).\n`);
console.log("  mazo                      nota   tema  genérico   vía        señales");
for(const f of filas){
  if(SOLOHUECOS && !f.corto) continue;
  const marca = f.corto ? "✗" : "·";
  console.log(`  ${marca} ${f.st.id.padEnd(22)} ${String(f.nota).padStart(4)}`
    + `  ${String(f.tematica).padStart(5)}  ${String(f.generica).padStart(8)}`
    + `   ${f.via.padEnd(9)}`
    + `  ${[...f.s.tokens.slice(0,2), ...f.s.palabras.slice(0,2)].join(", ")}`);
  if(DETALLE){
    const porFam = {};
    for(const a of f.enFamilia)
      for(const l of a.listas.filter(l => FAMILIAS.includes(l)))
        (porFam[l] ??= []).push(nom(a.c));
    for(const [l, cs] of Object.entries(porFam))
      console.log(`       ${l}: ${cs.join(" · ")}`);
  }
}

const cortos = filas.filter(f => f.corto);
console.log("");
if(!cortos.length) console.log(`  ✓ los ${filas.filter(f=>f.s.temaFuerte).length} mazos con tema llegan al mínimo de ${MINIMO},\n    y los ${filas.filter(f=>!f.s.temaFuerte).length} sin tema tienen camino genérico`);
else {
  console.log(`  ✗ ${cortos.length} mazo(s) por debajo de ${MINIMO}:`);
  for(const f of cortos)
    console.log(`     · ${f.st.id} (${f.st.nombre}) — tema «${f.s.tema[0] ?? f.s.razas[0]}», solo ${f.tematica} cartas`);
  console.log("\n    Se arregla metiendo sus cartas en la lista de familia que le");
  console.log("    toque, en engine/data/story/cards.json. No hace falta un sobre");
  console.log("    nuevo: hace falta que ese tema tenga CASA en uno de los cinco.");
}
process.exit(cortos.length ? 1 : 0);
