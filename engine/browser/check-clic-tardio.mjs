/* ════════════════════════════════════════════════════════════════
   UN CLIC QUE LLEGA TARDE NO CONTESTA A OTRA PREGUNTA

   Probando el HTML en un navegador de verdad con un jugador automático
   (19-09), la partida se quedaba atascada para siempre: el jugador pulsó
   «Terminar turno» mientras el motor ya preguntaba otra cosa (la ventana
   de cadena que sigue a una invocación). El botón conservaba el
   `onclick` de la pregunta anterior, mandó TO_EP a una pregunta de
   cadena, el motor dijo «retry», y cada `send` arrancaba OTRO bucle:
   dos bucles contestando a la vez y el duelo muerto.

   Aquí se monta exactamente eso en el HTML real: se arma una Main Phase,
   se guarda el `onclick` del botón de fin, se arma otra pregunta distinta
   y se pulsa el botón viejo. No puede llegarle nada al motor.
   ════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from "node:fs";
import { installDOM } from "./domstub.mjs";
globalThis.GOAT_SEED = 20050401;
installDOM();
global.localStorage = { getItem:k=>k==="goatConfig"?'{"idioma":"es"}':null, setItem(){} };

const html = readFileSync(process.env.HTML ?? "./out/goat.html","utf-8");
const js   = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
writeFileSync("./out/_clic.mjs", js);
console.warn = ()=>{};
await import("./out/_clic.mjs");
await new Promise(r=>setTimeout(r,300));
document.getElementById("mJugar").onclick?.();
/* Se espera a que el duelo esté parado esperándote a TI: si el bot
   estuviera jugando, sus respuestas caerían en el espía de abajo. */
for(let i=0;i<400;i++){
  await new Promise(r=>setTimeout(r,50));
  const hay = typeof globalThis.__DUELO_DE_PRUEBA__ === "function";
  const tuyo = document.getElementById("controles")?.style.display==="flex"
            || document.getElementById("prompt")?.style.display==="block";
  if(hay && tuyo) break;
}
await new Promise(r=>setTimeout(r,300));

const pruebas = [];
const comprobar = (t,v,d="") => { pruebas.push([t,!!v]); console.log(v?"  ✓":"  ✗", t, d?`— ${d}`:""); };
console.log("═══ CLIC TARDÍO ═══\n");

const { duel } = globalThis.__DUELO_DE_PRUEBA__();
const enviadas = [];
duel.respond = r => { enviadas.push(r); };        // espía: nada llega al motor de verdad

const IDLE = { type:11, player:0, summons:[], special_summons:[], pos_changes:[],
               monster_sets:[], spell_sets:[], activates:[], to_bp:false, to_ep:true };
globalThis.__PREGUNTA_DE_PRUEBA__(IDLE);
await new Promise(r=>setTimeout(r,200));
const finViejo = document.getElementById("btnFin").onclick;
comprobar("la Main Phase arma el botón de terminar turno", typeof finViejo === "function");

const CARTA = { type:15, player:0, can_cancel:false, min:1, max:1,
  selects:[ { code:70074904, controller:1, location:4, sequence:1, position:1 } ]};
globalThis.__PREGUNTA_DE_PRUEBA__(CARTA);
await new Promise(r=>setTimeout(r,200));
finViejo?.();
await new Promise(r=>setTimeout(r,200));
comprobar("el botón viejo no le contesta nada al motor", enviadas.length === 0,
  JSON.stringify(enviadas).slice(0,120));
const log = globalThis.__REGISTRO_DE_PRUEBA__?.() ?? [];
comprobar("queda apuntado como clic tardío", log.some(e => e.kind === "clic_tardio"), log.slice(-4).map(e=>e.kind).join(","));

/* Y la pregunta vigente sigue contestándose con normalidad. */
globalThis.__PREGUNTA_DE_PRUEBA__(IDLE);
await new Promise(r=>setTimeout(r,200));
const finVigente = document.getElementById("btnFin").onclick;
finVigente?.(); finVigente?.();       // doble clic sobre el MISMO botón
comprobar("la pregunta vigente sí se contesta", enviadas.length === 1 && enviadas[0].action === 7,
  JSON.stringify(enviadas).slice(0,120));
comprobar("un doble clic no contesta dos veces", enviadas.length === 1);

const ok = pruebas.filter(p=>p[1]).length;
console.log(`\n${ok}/${pruebas.length} · ${ok===pruebas.length ? "Todo correcto" : "HAY FALLOS"}`);
process.exit(ok===pruebas.length ? 0 : 1);
