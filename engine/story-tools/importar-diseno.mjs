/* ════════════════════════════════════════════════════════════════
   IMPORTAR EL DISEÑO DEL MODO HISTORIA  →  DATOS VALIDADOS

   Lee `engine/data/story/diseno-v1.txt` (el brief tal cual lo entregó E)
   y lo convierte en datos que el juego puede cargar, resolviendo CADA
   nombre de carta contra el pool real del simulador.

   POR QUÉ ESTO EXISTE Y NO SE ESCRIBEN LOS MAZOS A MANO:
   el brief trae 35 mazos y unas 300 cartas distintas en pools de
   recompensa. Escribirlos a mano garantiza erratas, y una errata aquí
   no da error: la carta entra MUDA al duelo (ver CLAUDE.md, "la trampa
   más cara"). Todo pasa por el pool y por los límites de copias.

   Salidas:
     engine/data/story/decks.json      mazos ya en passcodes
     engine/data/story/cards.json      pools de recompensa en passcodes
     docs/story-validation-report.md   informe legible
     engine/data/story/validation.json informe para máquinas

   Uso:  node engine/story-tools/importar-diseno.mjs
   ════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..", "..");          // carpeta del proyecto
const D    = join(RAIZ, "engine", "data");

const leer = f => JSON.parse(readFileSync(f, "utf-8"));
/* EL NOMBRE BUENO ESTÁ EN pool_texts.json, NO EN names.json.
   `names.json` es la base entera de Yu-Gi-Oh y ahí "Sinister Serpent" es
   el passcode moderno, que NO está en el pool: el que juega es
   "Sinister Serpent (Pre-Errata)". Buscar por names.json daba 31 cartas
   "inexistentes" que sí están: solo tenían el nombre con sufijo. */
const TEXTOS = leer(join(D, "pool_texts.json"));
const NAMES  = Object.fromEntries(Object.entries(TEXTOS).map(([k,v])=>[k,{name:v[0]}]));
const POOL   = new Set(leer(join(D, "goat-pool.json")));
const LIMITE = leer(join(D, "goat-limites.json"));
const CARDS  = leer(join(D, "pool_cards.json"));

/* ── índice de nombres → passcode, SOLO del pool ──
   Un nombre puede existir con dos passcodes (el normal y el "(GOAT)") y
   el script Lua está solo en el del pool: por eso el índice se construye
   filtrando por el pool y no al revés. */
const canon = s => String(s ?? "")
  .replace(/\s*\((GOAT|Pre-errata|Pre-Errata|Anime|Manga)\)\s*$/i, "")
  .replace(/[’‘]/g, "'").replace(/[–—]/g, "-")
  .replace(/\s+/g, " ").trim().toLowerCase();

const PORNOMBRE = new Map();
for(const k in NAMES){
  const code = Number(k);
  if(!POOL.has(code)) continue;
  const c = canon(NAMES[k].name);
  // si hay dos, gana el que tenga datos de carta en el pool
  if(!PORNOMBRE.has(c) || CARDS[code]) PORNOMBRE.set(c, code);
}

/* Sinónimos y erratas conocidas del brief. Cada uno es una decisión
   consciente, no un apaño: se listan en el informe. */
const ALIAS = {
  "harpie lady": "harpie lady 1",          // en la base el nombre es Harpie Lady 1
  "swarm of locusts": "swarm of locusts",
  "black luster ritual": "black luster ritual",
  "the winged dragon, guardian of the fortress #1": "winged dragon, guardian of the fortress #1",
  "winged dragon, guardian of the fortress #1": "winged dragon, guardian of the fortress #1",
};

/* Sustituciones aprobadas: carta del diseño que NO está en el pool →
   reemplazo legal del mismo papel. Se rellena abajo, tras el primer
   informe, y queda escrita para que la decisión sea auditable. */
const SUSTITUTAS = leer(join(D, "story", "sustituciones.json"));
delete SUSTITUTAS._lee_esto;

const avisos = [];
const faltan = new Map();          // nombre → [dónde salía]

function resolver(nombre, donde){
  let c = canon(nombre);
  if(ALIAS[c]) c = canon(ALIAS[c]);
  let code = PORNOMBRE.get(c);
  if(code) return { code, nombre: NAMES[code].name, sustituida:null };
  const sus = SUSTITUTAS[c];
  if(sus){
    const code2 = PORNOMBRE.get(canon(sus.por));
    if(code2) return { code:code2, nombre:NAMES[code2].name,
                       sustituida:{ pedida:nombre, por:sus.por, motivo:sus.motivo } };
  }
  const lista = faltan.get(nombre) ?? [];
  lista.push(donde); faltan.set(nombre, lista);
  return null;
}

const tope = code => LIMITE[String(code)] ?? 3;

/* ══════════ 1. PARTIR EL BRIEF ══════════ */
const TXT = readFileSync(join(D, "story", "diseno-v1.txt"), "utf-8").split(/\r?\n/);

/* Los mazos vienen como:
     Titulo del mazo
     ---------------
     Main Deck: 40
     MONSTERS
       2x Carta
     ...
     EXTRA / FUSION
       1x Carta
   El separador de guiones es lo que distingue un título de una línea
   cualquiera; sin él, "Design note:" se colaba como mazo. */
function partirMazos(){
  const mazos = [];
  for(let i=0; i<TXT.length-2; i++){
    const titulo = TXT[i].trim();
    const raya   = TXT[i+1] ?? "";
    if(!titulo || !/^-{3,}$/.test(raya.trim())) continue;
    if(!/^Main Deck:/.test((TXT[i+2] ?? "").trim())) continue;
    const cartas = { main:[], extra:[] };
    let zona = "main";
    for(let j=i+3; j<TXT.length; j++){
      const l = TXT[j];
      if(/^-{3,}$/.test((TXT[j+1] ?? "").trim()) && l.trim()) break;   // empieza otro bloque
      if(/^\s*(MONSTERS|SPELLS|TRAPS)\s*$/.test(l)) { zona = "main"; continue; }
      if(/^\s*EXTRA\s*\/\s*FUSION\s*$/.test(l))     { zona = "extra"; continue; }
      const m = l.match(/^\s+(\d)x\s+(.+?)\s*$/);
      if(m) cartas[zona].push({ n:Number(m[1]), nombre:m[2] });
      if(/^\s*(Design note|\d+\.)\s/.test(l)) break;
    }
    mazos.push({ titulo, ...cartas });
  }
  return mazos;
}

/* Los pools de cartas del brief son listas de "- Nombre" bajo una
   cabecera conocida. Se cogen por rango de líneas entre dos marcas. */
function listaEntre(desde, hasta){
  const i = TXT.findIndex(l => l.trim().startsWith(desde));
  if(i < 0) return [];
  const salida = [];
  for(let j=i+1; j<TXT.length; j++){
    const l = TXT[j];
    if(hasta.some(h => l.trim().startsWith(h))) break;
    const m = l.match(/^-\s+(.+?)\s*$/);
    if(m) salida.push(m[1]);
  }
  return salida;
}
function listaNumerada(desde, hasta){
  const i = TXT.findIndex(l => l.trim().startsWith(desde));
  if(i < 0) return [];
  const salida = [];
  for(let j=i+1; j<TXT.length; j++){
    if(hasta.some(h => TXT[j].trim().startsWith(h))) break;
    const m = TXT[j].match(/^\s*\d+\.\s+(.+?)\s*$/);
    if(m) salida.push(m[1]);
  }
  return salida;
}

/* ══════════ 2. RESOLVER ══════════ */
const MAZOS_TXT = partirMazos();
const decks = {};
const idDe = t => t.split(/\s+[—-]\s+/)[0].trim()
                   .toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");

for(const m of MAZOS_TXT){
  const id = idDe(m.titulo);
  const main = [], extra = [], problemas = [];
  /* El tope se cuenta SOBRE EL MAZO ENTERO, no línea a línea. Sustituir
     una carta por otra que el mazo ya llevaba a tres copias metía cinco
     Two-Headed King Rex sin que nadie se quejara: la línea era legal, el
     mazo no. Lo cazó check-historia.mjs. */
  const puestas = new Map();
  for(const [zona, destino] of [["main",main],["extra",extra]]){
    for(const { n, nombre } of m[zona]){
      const r = resolver(nombre, m.titulo);
      if(!r){ problemas.push(`falta: ${n}x ${nombre}`); continue; }
      const max = tope(r.code);
      const ya  = puestas.get(r.code) ?? 0;
      const copias = Math.max(0, Math.min(n, max - ya));
      if(copias < n) problemas.push(`${NAMES[r.code].name}: caben ${copias} de las ${n} pedidas (límite ${max})`);
      puestas.set(r.code, ya + copias);
      for(let k=0;k<copias;k++) destino.push(r.code);
      if(r.sustituida) problemas.push(`sustituida ${r.sustituida.pedida} → ${r.sustituida.por} (${r.sustituida.motivo})`);
    }
  }
  decks[id] = { id, titulo:m.titulo, main, extra, problemas };
}

/* ══════════ PARCHES ══════════
   El brief tiene erratas de juego, no de datos: mazos con Polymerization y
   el Extra vacío, o con una fusión cuyos materiales no están en la lista.
   Se arreglan aquí y no a mano en decks.json, que es generado. */
const PARCHES = leer(join(D, "story", "parches-mazos.json"));
delete PARCHES._lee_esto;
for(const [id, parche] of Object.entries(PARCHES)){
  const d = decks[id];
  if(!d){ avisos.push(`parche para un mazo que no existe: ${id}`); continue; }
  const quitarDe = (lista, nombre) => {
    const r = resolver(nombre, `parche:${id}`);
    if(!r) return false;
    const i = lista.indexOf(r.code);
    if(i < 0) return false;
    lista.splice(i, 1); return true;
  };
  for(const n of parche.quitar ?? [])
    if(!quitarDe(d.main, n)) avisos.push(`${id}: no se pudo quitar ${n}`);
  for(const n of parche.extraQuitar ?? [])
    if(!quitarDe(d.extra, n)) avisos.push(`${id}: no se pudo quitar del extra ${n}`);
  for(const n of parche.añadir ?? []){
    const r = resolver(n, `parche:${id}`);
    if(r) d.main.push(r.code); else avisos.push(`${id}: no se pudo añadir ${n}`);
  }
  for(const n of parche.extra ?? []){
    const r = resolver(n, `parche:${id}`);
    if(r) d.extra.push(r.code); else avisos.push(`${id}: no se pudo añadir al extra ${n}`);
  }
  d.problemas.push(`parche: ${parche.motivo}`);
}

const POOLS = {
  ultra:  listaEntre("ULTRA / JACKPOT", ["SUPER —"]),
  super:  listaEntre("SUPER — premium", ["RARE —"]),
  rare:   listaEntre("RARE — strong role", ["10. FIVE"]),
  arcane: listaEntre("Identity: Spellcaster", ["WARRIOR ARSENAL"]),
  warrior:listaEntre("Identity: Warrior toolbox", ["DRAGON'S ROAR"]),
  dragon: listaEntre("Identity: Blue-Eyes", ["RECRUITER FRONT"]),
  recruit:listaEntre("Identity: WATER / WIND", ["FORBIDDEN TACTICS"]),
  forbid: listaEntre("Identity: Goat/Metamorphosis", ["11. BULK EVENT"]),
  fusion: listaEntre("High-value GOAT progression targets", ["Thematic early Fusions"])
            .map(s=>s.split(" — ")[0]),
  fusionTematica: listaEntre("Thematic early Fusions can also be", ["Synergy protection"]),
  maestria: listaNumerada("Passive example: GRANDPA'S WISDOM", ["This is a curated"]),
};

const pools = {};
for(const [k, lista] of Object.entries(POOLS)){
  pools[k] = [];
  for(const nombre of lista){
    const r = resolver(nombre, `pool:${k}`);
    if(r) pools[k].push(r.code);
  }
}

/* ══════════ 3. INFORME ══════════ */
const conProblemas = Object.values(decks).filter(d=>d.problemas.length);
const informe = {
  generado: new Date().toISOString().slice(0,10),
  mazos: Object.keys(decks).length,
  cartasDistintasResueltas: new Set(Object.values(decks).flatMap(d=>[...d.main,...d.extra])).size,
  faltantes: [...faltan.entries()].map(([nombre, donde])=>({ nombre, donde:[...new Set(donde)] })),
  mazosConProblemas: conProblemas.map(d=>({ id:d.id, problemas:d.problemas })),
  tamaños: Object.values(decks).map(d=>({ id:d.id, main:d.main.length, extra:d.extra.length })),
  pools: Object.fromEntries(Object.entries(pools).map(([k,v])=>[k, v.length])),
  avisos,
};

mkdirSync(join(D, "story"), { recursive:true });
mkdirSync(join(RAIZ, "docs"), { recursive:true });
writeFileSync(join(D,"story","decks.json"), JSON.stringify(decks, null, 1));
writeFileSync(join(D,"story","cards.json"), JSON.stringify(pools, null, 1));
writeFileSync(join(D,"story","validation.json"), JSON.stringify(informe, null, 1));

const md = [];
md.push("# Informe de validación del modo historia\n");
md.push(`Generado el ${informe.generado} por \`engine/story-tools/importar-diseno.mjs\`.\n`);
md.push(`El pool legal tiene **${POOL.size}** passcodes. El diseño usa **${informe.cartasDistintasResueltas}** cartas distintas repartidas en **${informe.mazos}** mazos.\n`);
md.push("## Cartas del diseño que NO existen en el pool\n");
if(!informe.faltantes.length) md.push("Ninguna.\n");
else {
  md.push("| Carta pedida | Dónde salía |\n|---|---|");
  for(const f of informe.faltantes)
    md.push(`| ${f.nombre} | ${f.donde.join("<br>")} |`);
  md.push("");
}
md.push("## Mazos con avisos\n");
if(!conProblemas.length) md.push("Ninguno.\n");
else for(const d of conProblemas){
  md.push(`**${d.id}**`);
  for(const p of d.problemas) md.push(`- ${p}`);
  md.push("");
}
md.push("## Tamaño de cada mazo\n");
md.push("| Mazo | Main | Extra |\n|---|---|---|");
for(const t of informe.tamaños) md.push(`| ${t.id} | ${t.main} | ${t.extra} |`);
md.push("\n## Pools de recompensa\n");
md.push("| Pool | Cartas |\n|---|---|");
for(const [k,v] of Object.entries(informe.pools)) md.push(`| ${k} | ${v} |`);
writeFileSync(join(RAIZ,"docs","story-validation-report.md"), md.join("\n")+"\n");

console.log(`mazos: ${informe.mazos} · cartas distintas: ${informe.cartasDistintasResueltas}`);
console.log(`faltantes: ${informe.faltantes.length} · mazos con avisos: ${conProblemas.length}`);
for(const f of informe.faltantes.slice(0,40)) console.log("  falta:", f.nombre);
