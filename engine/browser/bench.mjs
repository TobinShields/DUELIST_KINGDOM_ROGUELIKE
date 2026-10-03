/* ══════════════════════════════════════════════════════════════════
   DÓNDE SE VA EL TIEMPO

   Un usuario reportó parones de 5 a 10 segundos. Antes de tocar nada
   hay que saber DÓNDE, porque optimizar a ojo en un proyecto con un
   motor WASM dentro es tirar el tiempo: lo lento puede ser el motor, la
   IA, el repintado o una búsqueda tonta repetida diez mil veces.

   Esto mide las cuatro cosas que pueden bloquear el hilo:

     · una decisión de la IA (lo que pasa entre que te toca y responde);
     · generar una recompensa (tres cartas de 1.685, con filtros);
     · abrir un sobre (diez casillas, cada una con su búsqueda);
     · montar la pantalla de Mazo y binder con el binder lleno.

   Y da el PEOR caso además de la media, porque un parón no es la media:
   es el peor.

   Uso:  node bench.mjs           mide
         node bench.mjs --json    para compararlo entre versiones
   ══════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from "node:fs";
import { installDOM } from "./domstub.mjs";
globalThis.GOAT_SEED = 20050401;
installDOM();
globalThis.matchMedia = q => ({ matches:false, media:q, addListener(){}, removeListener(){} });
globalThis.innerWidth = 1280;
const mem = new Map();
global.localStorage = {
  getItem: k => k === "goatConfig" ? '{"idioma":"es"}' : (mem.get(k) ?? null),
  setItem: (k,v) => mem.set(k,v), removeItem: k => mem.delete(k),
};
const html = readFileSync("./out/goat.html","utf-8");
writeFileSync("./out/_bench.mjs", html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]);
console.warn = () => {};
await import("./out/_bench.mjs");
await new Promise(r => setTimeout(r, 400));
document.getElementById("irReino").onclick?.();
const R = globalThis.__REINO_PRUEBA__;
const H = R.H;

const medidas = [];
function medir(nombre, veces, fn){
  const t = [];
  for(let i = 0; i < veces; i++){
    const a = performance.now();
    fn(i);
    t.push(performance.now() - a);
  }
  t.sort((x,y) => x-y);
  const media = t.reduce((s,x)=>s+x,0) / t.length;
  const p95 = t[Math.min(t.length-1, Math.floor(t.length*0.95))];
  const peor = t[t.length-1];
  medidas.push({ nombre, veces, media, p95, peor });
  return { media, p95, peor };
}

/* ── 1 · generar recompensas ── */
H.empezar({ semilla:"BENCH", personaje:"yugi" });
medir("recompensa de duelo (3 cartas)", 300, () => {
  const ops = H.opciones();
  const n = ops.find(x => ["DUELO","ELITE","JEFE"].includes(x.tipo));
  if(!n) return;
  /* Se pide la recompensa sin resolver el nodo: es la parte cara. */
  H.entrar(n.id);
});

/* ── 2 · abrir un sobre ── */
medir("abrir un sobre (10 cartas)", 200, () => { H.abrirPack("ARCANE"); });

/* ── 3 · montar Mazo y binder con el binder lleno ── */
{
  /* 120 cartas en el binder es lo que tiene una run avanzada. */
  for(let i = 0; i < 12; i++) H.abrirPack("FORBID");
  const cuantas = (H.run.binder?.length ?? 0);
  medir(`pintar Mazo y binder (${cuantas} en el binder)`, 60, () => {
    R.alMapa();
    globalThis.__REINO_PRUEBA__.pintar();
  });
}

/* ── 4 · pintar el mapa ── */
medir("pintar el mapa", 200, () => { R.alMapa(); });

/* ── 5 · generar un mapa entero ── */
{
  const { generarMapa } = await import("./src/story/mapa.js");
  const { crearRng, estadoDeSemilla } = await import("./src/story/rng.js");
  medir("generar un mapa", 300, i => {
    generarMapa(crearRng(estadoDeSemilla("B"+i)), "yugi");
  });
}

/* ── 6 · una decisión de la IA ──
   La cara de verdad: se monta un tablero lleno y se le pide que piense. */
{
  const { mesa, preguntaIdle, L, P, X, DB, NOMBRES } =
    await import("./banco-tablero.mjs");
  const { crearCerebro } = await import("./src/ai/brain.js");
  const d = mesa({
    mios:{ campo:[{carta:"Airknight Parshath",pos:P.ATK},{carta:"Breaker the Magical Warrior",pos:P.ATK}],
           mano:["Heavy Storm","Book of Moon","Scapegoat (GOAT)","Metamorphosis","Pot of Greed"],
           mt:[{carta:"Sakuretsu Armor",pos:P.TAPADA},{carta:"Solemn Judgment",pos:P.TAPADA}] },
    suyos:{ campo:[{carta:"Luster Dragon",pos:P.ATK},{carta:"Gravekeeper's Spy (GOAT)",pos:P.DEF}],
            mt:[{carta:"Mirror Force",pos:P.TAPADA}] } });
  const cerebro = crearCerebro({ X, duel:d, db:DB, names:NOMBRES, nivel:"experto", yo:0 });
  const q = preguntaIdle({ activa:[d.zones[0][L.HAND][0], d.zones[0][L.HAND][4]],
                           invoca:[], colocaMT:[d.zones[0][L.HAND][1]] });
  medir("una decisión de la IA (tablero lleno)", 400, () => { cerebro(q, 0); });
}

/* ══════════════════════════════════════════════════════════════════
   EL TURNO LARGO: LO QUE EL USUARIO LLAMABA "FREEZE"

   No es tiempo de CPU: es tiempo de espera. Cada evento del motor lleva
   su animación, y un turno con Scapegoat (cuatro fichas = cuatro
   `move`), una Metamorphosis y una cadena de tres puede traer treinta
   eventos. Con las esperas fijas eso son más de ocho segundos sin poder
   tocar nada, que desde fuera es un cuelgue.

   Esto no ejecuta el juego —haría falta el motor— sino que suma las
   esperas del código REAL para un turno de N eventos, con y sin el
   ritmo adaptativo. Si alguien quita el ritmo, el número se dispara y
   esto se entera.
   ══════════════════════════════════════════════════════════════════ */
{
  const src = readFileSync("./src/main.js", "utf-8");
  const drain = src.slice(src.indexOf("async function drain(){"),
                          src.indexOf("async function handle("));
  const esperas = [...drain.matchAll(/await pausa\((\d+)/g)].map(m => Number(m[1]));
  const fijas   = [...drain.matchAll(/await V\.sleep\((\d+)/g)].map(m => Number(m[1]));
  if(fijas.length)
    console.log(`\n  ⚠ quedan ${fijas.length} esperas fijas en la cola`
              + ` (${fijas.join(", ")}ms): deberían pasar por \`pausa\``);
  /* Un turno cargado de verdad, contado por tipo de evento. */
  const TURNO = { draw:1, phase:4, move:8, summon:2, chain:3, pos:2 };
  const MS = { draw:240, phase:90, move:290, summon:580, chain:500, pos:290 };
  const eventos = Object.values(TURNO).reduce((a,b)=>a+b, 0);
  const bruto = Object.entries(TURNO).reduce((t,[k,n]) => t + n*MS[k], 0);
  /* El factor que aplicaría el código con esa cola. */
  const factor = eventos >= 14 ? 0.2 : eventos >= 6 ? 0.45 : 1;
  console.log(`\n── un turno cargado (${eventos} eventos: `
    + Object.entries(TURNO).map(([k,n])=>`${n} ${k}`).join(", ") + ") ──");
  console.log(`   con esperas fijas:      ${(bruto/1000).toFixed(1)}s`);
  console.log(`   con el ritmo adaptativo: ${(bruto*factor/1000).toFixed(1)}s`
            + `   (×${factor})`);
  if(!esperas.length)
    console.log("   ✗ el ritmo adaptativo NO está puesto: las esperas son fijas");
  else if(bruto*factor > 3000)
    console.log("   ~ sigue pasando de 3s: mirar si hay que apretar más el ritmo");
  else
    console.log("   ✓ un turno cargado se resuelve en menos de 3 segundos");
}

/* ── informe ── */
console.log(`\n═══ DÓNDE SE VA EL TIEMPO ═══\n`);
console.log("  qué                                    veces    media     p95     peor");
for(const m of medidas)
  console.log(`  ${m.nombre.padEnd(38)} ${String(m.veces).padStart(5)}`
    + ` ${m.media.toFixed(2).padStart(7)}ms ${m.p95.toFixed(2).padStart(6)}ms`
    + ` ${m.peor.toFixed(2).padStart(6)}ms`);

/* ══ EL UMBRAL ══
   16 ms es un fotograma a 60 Hz. Una decisión de IA que pase de ahí ya
   se nota como tirón; una que pase de 200 ms es el parón que reportó el
   usuario. Se marca lo que hay que mirar. */
const LIMITES = { tiron:16, paron:200 };
const malos = medidas.filter(m => m.peor >= LIMITES.paron);
const regulares = medidas.filter(m => m.peor >= LIMITES.tiron && m.peor < LIMITES.paron);
console.log("");
if(malos.length){
  console.log(`  ✗ ${malos.length} operación(es) por encima de ${LIMITES.paron}ms en el peor caso:`);
  for(const m of malos) console.log(`     · ${m.nombre}: ${m.peor.toFixed(0)}ms`);
} else console.log(`  ✓ nada pasa de ${LIMITES.paron}ms ni en el peor caso`);
if(regulares.length)
  console.log(`  ~ ${regulares.length} por encima de un fotograma (${LIMITES.tiron}ms): `
    + regulares.map(m => `${m.nombre} ${m.peor.toFixed(0)}ms`).join(" · "));

if(process.argv.includes("--json"))
  console.log("\n" + JSON.stringify(medidas.map(m =>
    ({ n:m.nombre, media:+m.media.toFixed(2), peor:+m.peor.toFixed(2) })), null, 1));

process.exit(malos.length ? 1 : 0);
