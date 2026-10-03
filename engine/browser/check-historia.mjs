/* ════════════════════════════════════════════════════════════════
   MODO HISTORIA — QUE NADA ENTRE ILEGAL NI MUDO

   Los 35 mazos del modo historia no se escriben a mano: los genera
   `engine/story-tools/importar-diseno.mjs` desde el brief. Esto comprueba
   el resultado, que es donde puede colarse el desastre silencioso:

     · una carta fuera del pool → entra MUDA al duelo, sin error y sin
       aviso (la trampa más cara del proyecto, ver CLAUDE.md);
     · más copias de las que permite la lista de abril de 2005;
     · un mazo de menos de 40 o más de 60;
     · un Extra de más de 15;
     · una carta sin script Lua empaquetado.

   Uso:  node check-historia.mjs
   ════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";
import { SCRIPTS } from "./out/scripts.bundle.js";

const D = "../data/";
const leer = f => JSON.parse(readFileSync(D+f, "utf-8"));
const POOL   = new Set(leer("goat-pool.json"));
const LIMITE = leer("goat-limites.json");
const TEXTOS = leer("pool_texts.json");
const DECKS  = leer("story/decks.json");
const POOLS  = leer("story/cards.json");
const CARDS  = leer("pool_cards.json");

let fallos = 0;
const nom = c => TEXTOS[c]?.[0] ?? ("#"+c);
const mal = t => { fallos++; console.log("  ✗ " + t); };
const ok  = t => console.log("  ✓ " + t);

console.log("\n═══ MODO HISTORIA · mazos y pools ═══\n");

/* ── 1. los mazos ── */
let mazosMal = 0;
for(const d of Object.values(DECKS)){
  const problemas = [];
  if(d.main.length < 40 || d.main.length > 60) problemas.push(`main de ${d.main.length}`);
  if(d.extra.length > 15) problemas.push(`extra de ${d.extra.length}`);
  const cuenta = new Map();
  for(const c of [...d.main, ...d.extra]){
    if(!POOL.has(c)) problemas.push(`${nom(c)} (${c}) NO está en el pool`);
    cuenta.set(c, (cuenta.get(c) ?? 0) + 1);
  }
  for(const [c, n] of cuenta){
    const max = LIMITE[String(c)] ?? 3;
    if(n > max) problemas.push(`${nom(c)}: ${n} copias, el límite es ${max}`);
  }
  if(problemas.length){ mazosMal++; mal(`${d.id}: ${problemas.join(" · ")}`); }
}
if(!mazosMal) ok(`los ${Object.keys(DECKS).length} mazos son legales (40-60, copias y pool)`);

/* ── 2. los pools de recompensa ── */
let poolsMal = 0;
for(const [k, lista] of Object.entries(POOLS)){
  /* Las claves `_algo` son notas escritas a mano dentro del JSON, no pools. */
  if(k.startsWith("_") || !Array.isArray(lista)) continue;
  if(!lista.length){ poolsMal++; mal(`el pool "${k}" está vacío`); continue; }
  const fuera = lista.filter(c=>!POOL.has(c));
  if(fuera.length){ poolsMal++; mal(`pool "${k}": ${fuera.map(nom).join(", ")} fuera del pool`); }
}
if(!poolsMal) ok(`los ${Object.keys(POOLS).length} pools de recompensa son legales`);

/* ── 3. LO QUE NO DA ERROR: cartas sin script ──
   Un passcode del pool sin Lua empaquetado se reparte, se invoca y no
   hace nada. Las vanillas no tienen script y eso es correcto: solo se
   exige script a las que tienen efecto. */
const conEfecto = c => { const d = CARDS[c]; return d && !((d.type & 0x11) === 0x11); };
const mudas = new Set();
for(const d of Object.values(DECKS))
  for(const c of [...d.main, ...d.extra])
    if(conEfecto(c) && !SCRIPTS[`c${c}.lua`]) mudas.add(c);
for(const lista of Object.values(POOLS))
  for(const c of (Array.isArray(lista) ? lista : []))
    if(conEfecto(c) && !SCRIPTS[`c${c}.lua`]) mudas.add(c);
if(mudas.size) mal(`${mudas.size} cartas con efecto y sin script: ${[...mudas].slice(0,6).map(nom).join(", ")}`);
else ok("ninguna carta del modo historia entra muda al duelo");

/* ── 4. NINGUNA CARTA MUERTA DE SALIDA ──
   Un mazo con Polymerization y el Extra vacío empieza la partida con una
   carta que no hace nada. Pasó en el mazo inicial de Yugi y lo reportó E
   la primera vez que jugó. Se comprueba que quien lleve Polymerization
   tenga al menos una fusión cuyos materiales estén EN SU MAZO. */
const canonN = t => String(t ?? "").replace(/\s*\((GOAT|Pre-errata|Pre-Errata|Anime|Manga)\)\s*$/i,"").trim();
const nombreCanon = c => canonN(TEXTOS[c]?.[0]);
const POLY = [...POOL].filter(c => nombreCanon(c) === "Polymerization");
const materiales = new Map();
for(const c of POOL){
  const d = CARDS[c];
  if(!d || !(d.type & 0x40)) continue;
  const linea = String(TEXTOS[c]?.[1] ?? "").split("\n")[0];
  if(linea.includes(" + "))
    materiales.set(c, linea.split(" + ").map(x => canonN(x.replace(/^\W+|\W+$/g,""))));
}
let muertas = 0;
for(const d of Object.values(DECKS)){
  if(!d.main.some(c => POLY.includes(c))) continue;
  const tengo = new Set(d.main.map(nombreCanon));
  const sirve = d.extra.some(f => (materiales.get(f) ?? []).every(m => tengo.has(m)));
  if(!sirve){ muertas++; mal(`${d.id}: lleva Polymerization y ninguna fusión que pueda hacer`); }
}
if(!muertas) ok("nadie empieza con Polymerization sin una fusión que pueda invocar");

/* ── 5. el informe existe y no tiene cartas sin resolver ── */
const inf = leer("story/validation.json");
if(inf.faltantes.length) mal(`el informe tiene ${inf.faltantes.length} cartas sin resolver`);
else ok("el informe de validación no deja ninguna carta sin resolver");

console.log(fallos ? `\n${fallos} fallo(s)\n` : "\nTodo correcto\n");
process.exit(fallos ? 1 : 0);
