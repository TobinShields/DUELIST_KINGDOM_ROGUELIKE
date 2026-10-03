/* ══════════════════════════════════════════════════════════════════
   EL MAZO DE PEGASUS

   Medido antes de tocarlo, con 60 partidas por cruce:

     mazo inicial SIN mejorar  vs Pegasus M0 ......  45% para el starter
     un mazo de tier 3         vs Pegasus M0 ......  67% para el tier 3
     Pegasus M0                vs Goat Control W20 .  25%
     Pegasus M1 (Relinquished) vs Goat Control W20 .  12%

   O sea que el jefe final perdía dos de cada tres contra un rival
   NORMAL del castillo, y el mazo inicial le hacía cara a cara. Eso no es
   un jefe, es un peldaño más.

   Lo que pidió E: la primera vez que llega un personaje al final,
   Pegasus juega **Toon metido dentro de un mazo goat meta** —no un mazo
   Toon aparte—; con maestrías desbloqueadas, directamente los mejores
   mazos del meta.

   Así que el M0 no se escribe a mano: se PARTE del "Goat Control ·
   Worlds 2020" que ya está en `data/mazos.json` y se le cambian ocho
   cartas por el paquete Toon. El esqueleto —Metamorphosis + Scapegoat +
   Thousand-Eyes, Book of Moon a 3, los Nobleman, Duo/Pot/Graceful,
   Mirror Force, Ring, Torrential— se queda entero. La identidad la
   ponen los Toon; la dificultad, el esqueleto.

   Uso:  node pegasus.mjs          escribe el mazo y saca el informe
         node pegasus.mjs --ver    solo enseña qué haría
   ══════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from "node:fs";

const D = "../data/";
const leer = f => JSON.parse(readFileSync(D + f, "utf-8"));
const pool   = new Set(leer("goat-pool.json"));
const limites = leer("goat-limites.json");
const textos = leer("pool_texts.json");
const mazos  = leer("mazos.json");
const decks  = leer("story/decks.json");

/* El nombre bueno está en pool_texts.json, no en names.json: ahí
   "Sinister Serpent" es el passcode moderno, que NO está en el pool. */
const porNombre = new Map();
for(const [code, v] of Object.entries(textos)){
  const n = Array.isArray(v) ? v[0] : v;
  if(!porNombre.has(n)) porNombre.set(n, Number(code));
}
const nombreDe = c => { const v = textos[String(c)];
                        return (Array.isArray(v) ? v[0] : v) ?? String(c); };
const code = n => {
  const c = porNombre.get(n);
  if(c == null) throw new Error(`No existe la carta "${n}" en el pool`);
  if(!pool.has(c)) throw new Error(`"${n}" (${c}) no es legal en Goat`);
  return c;
};

/* ── el esqueleto: el meta de verdad, sin tocar ── */
const base = mazos.find(m => m.nombre === "Goat Control · Worlds 2020");
if(!base) throw new Error("No encuentro «Goat Control · Worlds 2020» en mazos.json");

/* ── los ocho que se van ──
   Se quitan los que menos sostienen el esqueleto y peor le pegan a
   Pegasus: los tres Asura Priest (una carta de combate agresiva, y él
   no gana atacando en tropel), los dos Dekoichi y el Dark Mimic —robo
   lento que el paquete Toon ya cubre con Toon Table of Contents— y los
   dos Trap Dustshoot, que son información y él ya "ve" tu mano por
   personaje sin necesitar la carta. */
const QUITAR = [
  ["Asura Priest", 2],
  ["Dark Mimic LV1 (GOAT)", 1],
];

/* ── los ocho que entran: la identidad ──
   ══ DOS CARTAS TOON, Y ESTÁ MEDIDO ══
   Aquí hubo que tragarse una hipótesis. Se probaron paquetes de 8, 7 y 6
   cartas Toon y todos rondaban el 30% contra el meta, así que parecía
   que seis era el punto óptimo. Pero al medir a Pegasus SIN Toon contra
   el mazo inicial salió la cifra que lo cambia todo:

     Pegasus sin Toon  vs mazo inicial ....  71% para Pegasus
     Pegasus con 6 Toon vs mazo inicial ...  51% para Pegasus

   Veinte puntos. Las cartas Toon no son "un poco peores": Toon Summoned
   Skull no ataca el turno que sale, paga 500 por atacar, se muere con
   Toon World y Toon World cuesta 1000 de entrada. Contra un mazo lleno
   de trampas eso es regalar la partida.

   Y hay una salida que no estaba usada: la mano de salida ya le
   GARANTIZA Toon World y Toon Summoned Skull. Si las dos piezas están
   aseguradas, tener copias de repuesto en el mazo es peso muerto — la
   misma lección de la versión anterior, llevada hasta el final. Con UNA
   de cada, la identidad se mantiene (abre siempre con su Toon World y su
   Toon Summoned Skull, que es como se le recuerda) y el esqueleto meta
   se queda casi entero.

   Toon Table of Contents se cae con ellas: buscaba las copias que ya no
   existen. Y entra Premature Burial, que faltaba en la lista de Worlds y
   es de las cinco cartas más fuertes del formato. */
const METER = [
  ["Toon World", 1],
  ["Toon Summoned Skull (GOAT)", 1],
  ["Premature Burial", 1],
];

const main = [...base.main];
const quitarUna = c => { const i = main.indexOf(c);
  if(i < 0) throw new Error(`No queda ninguna copia de ${nombreDe(c)} que quitar`);
  main.splice(i, 1); };

for(const [n, cuantas] of QUITAR){ const c = code(n);
  for(let i = 0; i < cuantas; i++) quitarUna(c); }
for(const [n, cuantas] of METER){ const c = code(n);
  for(let i = 0; i < cuantas; i++) main.push(c); }

/* ══ VALIDACIÓN: la legalidad del repositorio manda sobre cualquier idea ══ */
const problemas = [];
if(main.length !== 40) problemas.push(`el main tiene ${main.length} cartas, no 40`);
const cuenta = new Map();
for(const c of main) cuenta.set(c, (cuenta.get(c) ?? 0) + 1);
for(const [c, n] of cuenta){
  if(!pool.has(c)) problemas.push(`${nombreDe(c)} (${c}) no está en el pool legal`);
  const tope = limites[String(c)] ?? 3;
  if(n > tope) problemas.push(`${nombreDe(c)}: ${n} copias y el tope es ${tope}`);
}
const extra = [...(base.extra ?? [])];
for(const c of new Set(extra)) if(!pool.has(c))
  problemas.push(`extra: ${nombreDe(c)} (${c}) no está en el pool`);

/* ── informe ── */
const ORDEN = c => { const t = textos[String(c)]; return Array.isArray(t) ? t[0] : String(c); };
const agrupado = [...cuenta.entries()].sort((a,b) => ORDEN(a[0]).localeCompare(ORDEN(b[0])));
console.log(`\n═══ PEGASUS M0 · Toon dentro del esqueleto meta ═══\n`);
console.log(`  base: ${base.nombre}  (${base.main.length} cartas)`);
console.log(`  fuera: ${QUITAR.map(([n,c])=>`${c}x ${n}`).join(" · ")}`);
console.log(`  dentro: ${METER.map(([n,c])=>`${c}x ${n}`).join(" · ")}\n`);
for(const [c, n] of agrupado) console.log(`   ${n}x ${nombreDe(c)}`);
console.log(`\n  main ${main.length} · extra ${extra.length}`);
if(problemas.length){
  console.log("\n  ✗ PROBLEMAS:");
  for(const p of problemas) console.log("     · " + p);
  process.exit(1);
}
console.log("  ✓ todas en el pool y dentro del límite de copias\n");

if(process.argv.includes("--ver")) process.exit(0);

decks["pegasus-m0-boss"] = {
  id: "pegasus-m0-boss",
  titulo: "Pegasus M0 Boss — Toon Goat Control",
  _lp: "Juega con 14000 LP: ver el bloque _lp_nota de personajes.json.",
  _origen: `${base.nombre} con el paquete Toon (${METER.map(([n,c])=>c+"x "+n).join(", ")})`,
  main, extra,
};
writeFileSync(D + "story/decks.json", JSON.stringify(decks, null, 1), "utf-8");
console.log("  escrito en data/story/decks.json\n");
