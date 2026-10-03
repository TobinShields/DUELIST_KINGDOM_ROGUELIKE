/* ════════════════════════════════════════════════════════════════
   SIDE DECKS PARA LOS 20 MAZOS META

   En un torneo de verdad el rival también cambia cartas entre partidas.
   Los 20 mazos incluidos venían sin side, así que la IA no podía sidear.
   Esto le construye uno a cada uno con las cartas que se sidean de verdad
   en Goat, respetando el límite de copias contando main + extra + side.

   No es una lista copiada de un torneo: es una selección razonada por
   familias (anti-trampas, anti-cementerio, anti-monstruo, anti-quema…),
   y cada carta lleva escrito PARA QUÉ está, que es lo que luego usa la
   IA para decidir qué mete (`ai/side.js`).

   Uso:  node story-tools/sides-meta.mjs [--escribir]
   ════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from "node:fs";

const NAMES = JSON.parse(readFileSync(new URL("../browser/out/names.subset.json", import.meta.url)));
const CARDS = JSON.parse(readFileSync(new URL("../browser/out/cards.subset.json", import.meta.url)));
const POOL  = new Set(JSON.parse(readFileSync(new URL("../data/goat-pool.json", import.meta.url))).map(Number));
const LIM   = JSON.parse(readFileSync(new URL("../data/goat-limites.json", import.meta.url)));
const rutaMazos = new URL("../data/mazos.json", import.meta.url);
const MAZOS = JSON.parse(readFileSync(rutaMazos));

const base = n => String(n||"").replace(/\s*\((GOAT|Pre-Errata|Anime)\)\s*$/i,"").trim();
const codigo = nombre => {
  for(const k of Object.keys(NAMES)){
    const c = +k;
    if(POOL.has(c) && base(NAMES[k].name) === nombre) return c;
  }
  return null;
};
const limite = c => LIM[c] ?? LIM[String(c)] ?? 3;
const tipo = c => CARDS[c]?.type ?? 0;
const esTrampa = c => !!(tipo(c) & 0x4);
const esMonstruo = c => !!(tipo(c) & 0x1);

/* Las candidatas, por orden de importancia. `para` es la etiqueta que usa
   la IA: qué problema resuelve esta carta. */
const CANDIDATAS = [
  { nombre:"Sakuretsu Armor",      copias:2, para:"monstruos" },
  { nombre:"Bottomless Trap Hole", copias:2, para:"monstruos" },
  { nombre:"Dust Tornado",         copias:2, para:"backrow" },
  { nombre:"Soul Release",         copias:2, para:"cementerio" },
  { nombre:"Kycoo the Ghost Destroyer", copias:2, para:"cementerio" },
  { nombre:"Des Wombat",           copias:2, para:"quema" },
  { nombre:"Mystik Wok",           copias:1, para:"quema" },
  { nombre:"Royal Decree",         copias:3, para:"trampas", soloSiPocasTrampas:true },
  { nombre:"Mystic Swordsman LV2", copias:2, para:"volteos" },
  { nombre:"Smashing Ground",      copias:2, para:"monstruos" },
  { nombre:"Legendary Jujitsu Master", copias:2, para:"monstruos" },
  { nombre:"Spirit Reaper",        copias:1, para:"monstruos" },
  { nombre:"Trap Dustshoot",       copias:1, para:"mano" },
  { nombre:"Ceasefire",            copias:1, para:"volteos" },
  { nombre:"Enemy Controller",     copias:2, para:"monstruos" },
  { nombre:"Skull Lair",           copias:1, para:"cementerio" },
];

const informe = [];
for(const mz of MAZOS){
  const usadas = new Map();
  for(const c of [...(mz.main ?? []), ...(mz.extra ?? [])]) usadas.set(c, (usadas.get(c) ?? 0) + 1);
  const trampasMain = (mz.main ?? []).filter(esTrampa).length;
  const side = [], porque = [];
  for(const cand of CANDIDATAS){
    if(side.length >= 15) break;
    const c = codigo(cand.nombre);
    if(!c){ continue; }
    if(cand.soloSiPocasTrampas && trampasMain > 4) continue;   // Decree también apaga las tuyas
    const hueco = Math.min(cand.copias, limite(c) - (usadas.get(c) ?? 0), 15 - side.length);
    if(hueco <= 0) continue;
    for(let i=0;i<hueco;i++) side.push(c);
    usadas.set(c, (usadas.get(c) ?? 0) + hueco);
    porque.push(`${hueco}x ${cand.nombre} (${cand.para})`);
  }
  mz.side = side;
  informe.push(`${mz.nombre.padEnd(34)} ${String(side.length).padStart(2)} · ${porque.join(", ")}`);
}

console.log(informe.join("\n"));
const malos = MAZOS.filter(m => (m.side ?? []).length !== 15);
if(malos.length) console.log("\n⚠ sin 15 cartas:", malos.map(m=>`${m.nombre} (${m.side.length})`).join(", "));
if(process.argv.includes("--escribir")){
  writeFileSync(rutaMazos, JSON.stringify(MAZOS, null, 0));
  console.log("\nescrito data/mazos.json con los side decks");
}
