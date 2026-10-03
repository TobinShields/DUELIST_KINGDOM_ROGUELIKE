import path from "node:path";
import { fileURLToPath } from "node:url";
const RAIZ = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
import { readFileSync } from "node:fs";
import * as X from "./out/ocgcore.bundle.js";
import { scriptReader } from "./out/scripts.bundle.js";
import { GoatDuel, LOC } from "./src/duel.mjs";
import { makeAutoPlayer } from "./src/autopilot.mjs";

const raw=JSON.parse(readFileSync(path.join(RAIZ,"engine","data")+"/cards.json","utf-8"));
const names=JSON.parse(readFileSync(path.join(RAIZ,"engine","data")+"/names.json","utf-8"));
const cardDb=new Map(); for(const k in raw){const c=raw[k];cardDb.set(c.code,{...c,race:BigInt(c.race)});}
const DECK=JSON.parse(readFileSync("./deck-codes.json","utf-8"));
const nm=c=>names[c]?.name ?? "#"+c;

// mazo de 40 repartiendo copias
const main=[]; for(let i=0;main.length<40;i++) main.push(DECK[i%(DECK.length-4)]);
const extra=[504700102,504700102,504700102];  // Thousand-Eyes Restrict (GOAT)

const lib=await X.default({sync:true});
const counts={};
const duel=new GoatDuel({ lib, X, cardDb, scriptReader,
  onEvent: e => { counts[e.t]=(counts[e.t]||0)+1;
                  if(e.t==="coreError") console.log("  [core]", e.text.slice(0,90)); }});
await duel.create({ deck0:main, deck1:[...main].reverse(), extra0:extra, extra1:extra,
                    seed:[99n,17n,3n,41n] });

const decide=makeAutoPlayer(X);
let attempt=0, last=null, retries=0, guard=0;
while(guard++ < 40000){
  const q = await duel.run();
  if(duel.finished) break;
  if(!q) break;
  if(q!==last){ last=q; attempt=0; }
  const r = decide(q, attempt);
  if(!r){ console.log("sin respuesta para", q.type); break; }
  const before = counts.retry||0;
  duel.respond(r);
  attempt++;
  if((counts.retry||0)>before) retries++;
  if(attempt>25){ console.log("atascado en tipo", q.type); break; }
}

// ── verificación de integridad del espejo de estado ──
let total=0, dup=new Set(), bad=[];
for(const p of [0,1]) for(const loc of [LOC.DECK,LOC.HAND,LOC.GRAVE,LOC.REMOVED,
                                        LOC.EXTRA,LOC.MZONE,LOC.SZONE]){
  for(const c of duel.zones[p][loc]) if(c){
    total++;
    if(dup.has(c.uid)) bad.push("uid duplicado "+c.uid);
    dup.add(c.uid);
    if(c.controller!==p || c.location!==loc) bad.push(`uid ${c.uid} descolocado`);
  }
}
console.log("\n═══ RESULTADO ═══");
console.log("turnos jugados:", counts.turn ?? 0);
console.log("eventos:", Object.entries(counts).filter(([k])=>k!=="coreError")
  .sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}=${v}`).join("  "));
console.log("\nintegridad del espejo de estado:");
console.log("  cartas rastreadas:", total, "de", (main.length+extra.length)*2, "repartidas");
console.log("  uids duplicados o descolocados:", bad.length ? bad.slice(0,5) : "ninguno");
console.log("  respuestas rechazadas por el core:", counts.retry ?? 0);
