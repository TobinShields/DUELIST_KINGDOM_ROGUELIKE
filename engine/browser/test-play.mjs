import { readFileSync, writeFileSync } from "node:fs";
import { installDOM } from "./domstub.mjs";
installDOM();
const html = readFileSync("./out/goat.html","utf-8");
writeFileSync("./out/_extracted.mjs", html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]);
let coreErrors=0;
const w=console.warn; const errs=new Set(); console.warn=(...a)=>{ if(String(a[0]).includes("[core]")){ coreErrors++; errs.add(String(a[1]).slice(0,80)); } else w(...a); }; global.__errs=errs;
await import("./out/_extracted.mjs");
await new Promise(r=>setTimeout(r,3000));

const p=document.getElementById("prompt"), turn=document.getElementById("turnInfo");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const seen=[]; let clicks=0, stuck=0;
for(let i=0;i<380;i++){
  await sleep(90);
  if(p.style.display!=="block"){ stuck++; if(stuck>260) break; continue; }
  stuck=0;
  const title=String(p.innerHTML).replace(/<[^>]+>/g," ").trim().slice(0,50);
  const btns=p.children[0]?.children ?? [];
  if(!btns.length) break;
  // jugamos "de verdad": preferimos actuar, y si no, pasar de fase
  const labels=[...btns].map(b=>b.textContent);
  let pick;
  if(/Main Phase|Battle Phase/.test(title) && labels.some(l=>/Ver todas/.test(l)) && Math.random()<0.7){
    pick = labels.findIndex(l=>/Ver todas/.test(l));
  } else if(/Selecciona/.test(title)){
    pick = labels.findIndex(l=>l.startsWith("Confirmar"));
    if(pick<0) pick = labels.findIndex(l=>!l.startsWith("✓") && !/Cancelar|Terminar/.test(l));
    if(pick<0) pick = 0;
  } else if(/Todas las acciones/.test(title)){
    pick = labels.findIndex(l=>/^Invocar |^Activar |^Colocar /.test(l));
    if(pick<0 || Math.random()<0.4) pick = labels.findIndex(l=>/Terminar turno|Battle Phase/.test(l));
    if(pick<0) pick = 0;
  } else {
    pick = labels.findIndex(l=>/^Invocar|^Atacar|^Activar/.test(l));
    if(pick<0 || Math.random()<0.35) pick = labels.findIndex(l=>/Terminar turno|Battle Phase|No responder|^S\u00ed$/.test(l));
    if(pick<0) pick = labels.length-1;
  }
  seen.push(`${title} → ${labels[pick]}`);
  p.style.display="none";
  btns[pick].onclick?.(); clicks++;
  if(/HAS GANADO|HAS PERDIDO|Fin del duelo/i.test(title)) break;
}
console.log("═══ PARTIDA SIMULADA EN EL HTML ═══");
console.log("decisiones tomadas:", clicks);
console.log("estado final:", String(turn.innerHTML).replace(/<[^>]+>/g,"").trim());
console.log("errores de script del core:", coreErrors);
[...global.__errs].forEach(e=>console.log("   ERR:",e));
console.log("\nprimeras 14 decisiones:");
seen.slice(0,14).forEach((s,i)=>console.log(`  ${String(i+1).padStart(2)}. ${s}`));
console.log("\núltimas 5:");
seen.slice(-5).forEach(s=>console.log("   ", s));
