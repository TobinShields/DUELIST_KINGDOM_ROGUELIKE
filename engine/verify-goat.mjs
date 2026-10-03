import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import createCore, { OcgDuelMode, OcgLocation, OcgPosition, OcgProcessResult,
  OcgMessageType, OcgResponseType, ocgDuelModeString } from "./vendor/dist/index.js";

console.log("═══ 1. FLAGS QUE ACTIVA MODE_GOAT ═══");
{ const names=[]; for(const k in OcgDuelMode){ const v=OcgDuelMode[k]; if(k.startsWith("MODE_")) continue; if(typeof v==="bigint" && v!==0n && (OcgDuelMode.MODE_GOAT & v)===v) names.push(k); } names.forEach(f=>console.log("  ·",f)); }

const SCRIPTS="../CardScripts-master/CardScripts-master";
const cardsRaw=JSON.parse(readFileSync("./data/cards.json","utf-8"));
const names=JSON.parse(readFileSync("./data/names.json","utf-8"));
const cards=new Map(); for(const k in cardsRaw){const c=cardsRaw[k];cards.set(c.code,{...c,race:BigInt(c.race)});}
function scriptReader(name){ const b=path.basename(name);
  for(const f of ["","official","goat","pre-errata","pre-release"].map(d=>path.join(SCRIPTS,d,b)))
    if(existsSync(f)) return readFileSync(f,"utf-8");
  return null; }

console.log("\n═══ 2. ¿ROBA EL JUGADOR QUE EMPIEZA EN EL TURNO 1? ═══");
const lib=await createCore({sync:true});
const h=await lib.createDuel({flags:OcgDuelMode.MODE_GOAT,seed:[5n,6n,7n,8n],
  team1:{startingLP:8000,startingDrawCount:5,drawCountPerTurn:1},
  team2:{startingLP:8000,startingDrawCount:5,drawCountPerTurn:1},
  cardReader:c=>cards.get(c)??null,scriptReader,errorHandler:()=>{}});
for(const n of ["constant.lua","utility.lua"]) await lib.loadScript(h,n,scriptReader(n));
for(const team of [0,1]) for(let i=0;i<40;i++)
  await lib.duelNewCard(h,{team,duelist:0,code:55144522,controller:team,
    location:OcgLocation.DECK,sequence:0,position:OcgPosition.FACEDOWN_DEFENSE});
await lib.startDuel(h);
let turn=0, drawsInTurn1=0, done=false;
for(let s=0;s<50 && !done;s++){
  const st=await lib.duelProcess(h);
  for(const m of lib.duelGetMessage(h)){
    if(m.type===OcgMessageType.NEW_TURN) turn++;
    if(m.type===OcgMessageType.DRAW && turn===1) drawsInTurn1++;
    if(turn>=2) done=true;
  }
  if(st===OcgProcessResult.WAITING) break;
}
console.log(`  robos durante el turno 1: ${drawsInTurn1}`);
console.log(`  → ${drawsInTurn1>0 ? "SÍ roba (FIRST_TURN_DRAW activo en Goat)"
                                   : "NO roba"}`);

console.log("\n═══ 3. CARTAS CON VERSIÓN GOAT DEDICADA ═══");
let n=0; const ejemplos=[];
for(const id in names) if(names[id].name.endsWith("(GOAT)")){ n++; if(ejemplos.length<10) ejemplos.push(names[id].name); }
console.log(`  ${n} entradas específicas de Goat. Ejemplos:`);
ejemplos.forEach(e=>console.log("   ·",e));
