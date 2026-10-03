/* ════════════════════════════════════════════════════════════════
   LA DEPURACIÓN NO CANTA LO QUE LA IA TIENE TAPADO

   E, 19-09: con la depuración encendida salía el aviso «IA simula →
   heurística: monster_sets Kuriboh -2.76» justo antes de que la IA
   colocara la carta. Todo aviso de la IA pasa ahora por `sinSecretos`:
   las colocaciones van sin nombre y cualquier carta suya que no ves
   (mano, mazo, Extra, boca abajo) se cambia por «una carta».
   ════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from "node:fs";
import { installDOM } from "./domstub.mjs";
globalThis.GOAT_SEED = 20050401;
installDOM();
global.localStorage = { getItem:k=>k==="goatConfig"?'{"idioma":"es"}':null, setItem(){}, removeItem(){} };
const html = readFileSync(process.env.HTML ?? "./out/goat.html","utf-8");
writeFileSync("./out/_secretos.mjs", html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]);
console.warn = ()=>{};
await import("./out/_secretos.mjs");
await new Promise(r=>setTimeout(r,300));
document.getElementById("mJugar").onclick?.();
for(let i=0;i<400 && typeof globalThis.__DUELO_DE_PRUEBA__ !== "function";i++)
  await new Promise(r=>setTimeout(r,50));
await new Promise(r=>setTimeout(r,500));

const pruebas = [];
const comprobar = (t,v,d="") => { pruebas.push([t,!!v]); console.log(v?"  ✓":"  ✗", t, d?`— ${d}`:""); };
console.log("═══ LA DEPURACIÓN NO CANTA LO TAPADO ═══\n");

const filtro = globalThis.__SIN_SECRETOS__;
comprobar("existe el filtro de avisos", typeof filtro === "function");
const { duel, me } = globalThis.__DUELO_DE_PRUEBA__();
const nombres = globalThis.__NOMBRES_DE_PRUEBA__();
const ia = 1 - me;
const mano = (duel.zones[ia][2] ?? []).filter(Boolean);
const vistos = new Set();
for(const p of [0,1]) for(const loc of [4,8,16,32]) for(const c of (duel.zones[p][loc] ?? []))
  if(c && !((loc===4||loc===8) && (c.position & 0x0a))) vistos.add(c.code);
const ocultas = mano.filter(c => !vistos.has(c.code)).map(c => nombres[c.code]?.name).filter(Boolean);
comprobar("la IA tiene cartas en la mano que no ves", ocultas.length > 0, ocultas.length+" cartas");
const n = ocultas[0] ?? "Kuriboh";
const a = filtro?.(`IA simula (7) → heurística: monster_sets ${n} -2.76`) ?? "";
comprobar("una colocación sale sin nombre", !a.includes(n) && /coloca/.test(a), a);
const b = filtro?.(`IA simula (3) → heurística: spell_sets Spellbinding Circle -3.16`) ?? "";
comprobar("una mágica/trampa colocada tampoco", !/Spellbinding/.test(b), b);
const c = filtro?.(`IA · postura: guardo ${n} para su turno`) ?? "";
comprobar("un nombre de su mano en otro aviso se tapa", !c.includes(n), c);
/* Una carta tuya que la IA no tiene escondida en ningún sitio (ni mano,
   ni mazo, ni Extra): esa no es secreto y el aviso tiene que nombrarla. */
const suyas = new Set([1,2,64].flatMap(loc => (duel.zones[ia][loc] ?? []).filter(Boolean).map(x=>x.code)));
const tuya = (duel.zones[me][2] ?? []).filter(x => x && !suyas.has(x.code)).map(x=>nombres[x.code]?.name).find(Boolean);
if(tuya){
  const d = filtro?.(`IA · lectura: tu ${tuya} me preocupa`) ?? "";
  comprobar("lo que no es secreto para ti se sigue leyendo", d.includes(tuya), d);
}
/* Y lo que E pidió después (19-09, noche): los avisos de lo que la IA
   piensa NO salen en pantalla, ni con la depuración encendida. */
const js = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
comprobar("ningún aviso en pantalla dice «IA simula»", !/toast\([^;]*IA simula/.test(js));
comprobar("ni la lectura/postura de la IA", !/toast\(\s*"IA · "/.test(js));
const ok = pruebas.filter(p=>p[1]).length;
console.log(`\n${ok}/${pruebas.length} · ${ok===pruebas.length ? "Todo correcto" : "HAY FALLOS"}`);
process.exit(ok===pruebas.length ? 0 : 1);
