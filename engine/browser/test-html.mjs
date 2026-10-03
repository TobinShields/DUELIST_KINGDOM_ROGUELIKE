import { readFileSync, writeFileSync } from "node:fs";
import { installDOM } from "./domstub.mjs";
installDOM();

// extraemos el módulo del HTML tal y como lo ejecutaría el navegador
const html = readFileSync("./out/goat.html","utf-8");
const src  = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
writeFileSync("./out/_extracted.mjs", src);

const events = [];
const origLog = console.warn;
console.warn = (...a)=>{ if(String(a[0]).includes("[core]")) events.push("coreError"); else origLog(...a); };

let firstPrompt=null;
// interceptamos el panel para capturar la primera decisión que se te pide
const t0=Date.now();
await import("./out/_extracted.mjs").catch(e=>{ console.log("✗ FALLO AL EJECUTAR:\n", e.stack); process.exit(1); });
await new Promise(r=>setTimeout(r,8000));
const bootEl=document.getElementById("boot");
if(String(bootEl.innerHTML).includes("Error")) console.log("── ERROR EN BOOT ──\n", bootEl.innerHTML.replace(/<[^>]+>/g,""));

const p = document.getElementById("prompt");
const turn = document.getElementById("turnInfo");
console.log("✓ el módulo del HTML se ejecuta sin errores");
console.log("  arranque:", Date.now()-t0, "ms");
console.log("  HUD de turno:", (turn.innerHTML||"(vacío)").replace(/<[^>]+>/g,"").trim());
console.log("  panel de decisión:", p.style.display==="block" ? "visible" : "oculto");
console.log("  título del panel:", (p.innerHTML||"").replace(/<[^>]+>/g," ").trim().slice(0,80));
console.log("  botones ofrecidos:", p.children[0]?.children?.length ?? 0);
console.log("  errores de script del core:", events.length);
