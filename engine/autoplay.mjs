import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import createCore, { OcgDuelMode, OcgLocation, OcgPosition, OcgProcessResult,
  OcgMessageType, OcgResponseType, SelectIdleCMDAction, SelectBattleCMDAction }
  from "./vendor/dist/index.js";

const SCRIPTS="../CardScripts-master/CardScripts-master";
const cardsRaw=JSON.parse(readFileSync("./data/cards.json","utf-8"));
const names=JSON.parse(readFileSync("./data/names.json","utf-8"));
const cards=new Map(); for(const k in cardsRaw){const c=cardsRaw[k];cards.set(c.code,{...c,race:BigInt(c.race)});}
const nameOf=id=>names[id]?.name??`#${id}`;
const byName={}; for(const id in names){(byName[names[id].name]||=[]).push(Number(id));}
const pick=n=>{const g=byName[`${n} (GOAT)`];if(g)return g[0];const l=byName[n];
  if(!l)throw new Error("no encontrada: "+n);return l.find(i=>cardsRaw[i]?.alias)??l[0];};

const DECK=["Chaos Sorcerer","Chaos Sorcerer","Black Luster Soldier - Envoy of the Beginning",
 "Tsukuyomi","Tsukuyomi","Magician of Faith","Magician of Faith","D.D. Warrior Lady",
 "D.D. Warrior Lady","Breaker the Magical Warrior","Dekoichi the Battlechanted Locomotive",
 "Dekoichi the Battlechanted Locomotive","Asura Priest","Exiled Force","Sinister Serpent",
 "Airknight Parshath","Sangan","Tribe-Infecting Virus","Night Assailant","Mystic Tomato",
 "Pot of Greed","Graceful Charity","Delinquent Duo","Snatch Steal","Scapegoat","Scapegoat",
 "Book of Moon","Book of Moon","Metamorphosis","Premature Burial","Heavy Storm",
 "Mystical Space Typhoon","Nobleman of Crossout","Smashing Ground","Ring of Destruction",
 "Torrential Tribute","Mirror Force","Sakuretsu Armor","Sakuretsu Armor","Dust Tornado"].map(pick);
const EXTRA=["Thousand-Eyes Restrict","Thousand-Eyes Restrict","Thousand-Eyes Restrict"].map(pick);

function scriptReader(name){
  const b=path.basename(name);
  for(const f of ["","official","goat","pre-errata","pre-release"].map(d=>path.join(SCRIPTS,d,b)))
    if(existsSync(f)) return readFileSync(f,"utf-8");
  return null;
}
const lib=await createCore({sync:true});
const h=await lib.createDuel({flags:OcgDuelMode.MODE_GOAT,seed:[7n,13n,29n,91n],
  team1:{startingLP:8000,startingDrawCount:5,drawCountPerTurn:1},
  team2:{startingLP:8000,startingDrawCount:5,drawCountPerTurn:1},
  cardReader:c=>cards.get(c)??null, scriptReader, errorHandler:()=>{}});
for(const n of ["constant.lua","utility.lua"]) await lib.loadScript(h,n,scriptReader(n));
function rng(seed){ let s=seed; return ()=> (s=(s*1103515245+12345)&0x7fffffff)/0x7fffffff; }
function shuffled(arr,seed){ const a=[...arr], r=rng(seed);
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(r()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
for(const team of [0,1]){
  for(const code of shuffled(DECK, team===0?12345:98765)) await lib.duelNewCard(h,{team,duelist:0,code,controller:team,
    location:OcgLocation.DECK,sequence:0,position:OcgPosition.FACEDOWN_DEFENSE});
  for(const code of EXTRA) await lib.duelNewCard(h,{team,duelist:0,code,controller:team,
    location:OcgLocation.EXTRA,sequence:0,position:OcgPosition.FACEDOWN_DEFENSE});
}
await lib.startDuel(h);

const MT={}; for(const k in OcgMessageType) MT[OcgMessageType[k]]=k;
const PH={0x1:"Draw",0x2:"Standby",0x4:"Main1",0x8:"Battle Start",0x10:"Battle Step",
  0x20:"Damage",0x40:"Damage Cal",0x80:"Battle",0x100:"Main2",0x200:"End"};
let retries=0, dbg=0;
const log=[]; let turns=0, lastMsg=null, question=null, attempt=0;
const QUESTIONS=new Set([OcgMessageType.SELECT_IDLECMD,OcgMessageType.SELECT_BATTLECMD,
  OcgMessageType.SELECT_CHAIN,OcgMessageType.SELECT_EFFECTYN,OcgMessageType.SELECT_YESNO,
  OcgMessageType.SELECT_OPTION,OcgMessageType.SELECT_CARD,OcgMessageType.SELECT_UNSELECT_CARD,
  OcgMessageType.SELECT_PLACE,OcgMessageType.SELECT_DISFIELD,OcgMessageType.SELECT_POSITION,
  OcgMessageType.SELECT_TRIBUTE,OcgMessageType.SORT_CARD,OcgMessageType.SELECT_SUM,
  OcgMessageType.SELECT_COUNTER,OcgMessageType.ANNOUNCE_RACE,OcgMessageType.ANNOUNCE_ATTRIB,
  OcgMessageType.ANNOUNCE_NUMBER,OcgMessageType.ANNOUNCE_CARD]);

// jugador automático deliberadamente tonto: invoca si puede, ataca si puede, pasa
function respond(m, attempt=0){
  switch(m.type){
    case OcgMessageType.SELECT_IDLECMD: {
      const A=SelectIdleCMDAction, R=OcgResponseType.SELECT_IDLECMD;
      const plan=[];
      if(m.summons?.length)      plan.push({action:A.SELECT_SUMMON,    index:0});
      if(m.activates?.length)    plan.push({action:A.SELECT_ACTIVATE,  index:0});
      if(m.spell_sets?.length)   plan.push({action:A.SELECT_SPELL_SET, index:0});
      if(m.monster_sets?.length) plan.push({action:A.SELECT_MONSTER_SET,index:0});
      plan.push({action: m.to_bp ? A.TO_BP : A.TO_EP, index:null});
      const p = plan[Math.min(attempt, plan.length-1)];
      return {type:R, ...p};
    }
    case OcgMessageType.SELECT_BATTLECMD: {
      if(m.attacks?.length) return {type:OcgResponseType.SELECT_BATTLECMD,
        action:SelectBattleCMDAction.SELECT_BATTLE,index:0};
      return {type:OcgResponseType.SELECT_BATTLECMD,
        action: m.to_m2 ? SelectBattleCMDAction.TO_M2 : SelectBattleCMDAction.TO_EP, index:null};
    }
    case OcgMessageType.SELECT_CHAIN: {
      // forced = efecto obligatorio: rechazar no es una opción legal
      const N=m.selects?.length??0;
      if(m.forced && N>0) return {type:OcgResponseType.SELECT_CHAIN,index:attempt%N};
      if(attempt>0 && N>0) return {type:OcgResponseType.SELECT_CHAIN,index:(attempt-1)%N};
      return {type:OcgResponseType.SELECT_CHAIN,index:null};
    }
    case OcgMessageType.SELECT_EFFECTYN:return {type:OcgResponseType.SELECT_EFFECTYN,yes:false};
    case OcgMessageType.SELECT_YESNO:   return {type:OcgResponseType.SELECT_YESNO,yes:false};
    case OcgMessageType.SELECT_OPTION:  return {type:OcgResponseType.SELECT_OPTION,index:0};
    case OcgMessageType.SELECT_POSITION:return {type:OcgResponseType.SELECT_POSITION,
        position:OcgPosition.FACEUP_ATTACK};
    case OcgMessageType.SELECT_PLACE:
    case OcgMessageType.SELECT_DISFIELD:{
      // field_mask: bit a 1 = zona NO disponible.
      // bytes: [j0 monstruos][j0 magia/trampa][j1 monstruos][j1 magia/trampa]
      // El mask es RELATIVO al jugador preguntado: bytes 0-1 son sus propias
      // zonas, bytes 2-3 las del rival. Hay que traducir a jugador absoluto.
      const self=m.player, foe=1-m.player;
      const mask=m.field_mask>>>0, places=[];
      const groups=[[0,self,OcgLocation.MZONE],[1,self,OcgLocation.SZONE],
                    [2,foe, OcgLocation.MZONE],[3,foe, OcgLocation.SZONE]];
      for(const [byteIdx,player,location] of groups){
        const b=(mask>>>(byteIdx*8))&0xff;
        for(let seq=0; seq<5; seq++)
          if(!((b>>>seq)&1)) places.push({player,location,sequence:seq});
      }
      const chosen=places.slice(0, Math.max(1,m.count??1));
      return {type:m.type===OcgMessageType.SELECT_PLACE?OcgResponseType.SELECT_PLACE
                :OcgResponseType.SELECT_DISFIELD, places:chosen};
    }
    case OcgMessageType.SELECT_UNSELECT_CARD: {
      // protocolo distinto: se elige de una en una hasta poder finalizar
      const N=m.select_cards?.length??0;
      if(m.can_finish && attempt>=N) return {type:OcgResponseType.SELECT_UNSELECT_CARD,index:null};
      if(N===0) return {type:OcgResponseType.SELECT_UNSELECT_CARD,index:null};
      return {type:OcgResponseType.SELECT_UNSELECT_CARD,index:attempt%N};
    }
    case OcgMessageType.SELECT_CARD:
    case OcgMessageType.SELECT_TRIBUTE: {
      const N=m.selects?.length??0;
      const min=Math.max(1,m.min??1), max=Math.min(m.max??min,N);
      const count=Math.min(Math.max(min,1),Math.max(max,1));
      if(N===0) return {type:OcgResponseType.SELECT_CARD,indicies:null};
      const window=Math.max(1,N-count+1);
      if(attempt>=window && m.can_cancel)
        return {type:OcgResponseType.SELECT_CARD,indicies:null};
      const start=attempt%window;
      const rt = m.type===OcgMessageType.SELECT_TRIBUTE
        ? OcgResponseType.SELECT_TRIBUTE : OcgResponseType.SELECT_CARD;
      return {type:rt,indicies:Array.from({length:count},(_,i)=>start+i)};
    }
    case OcgMessageType.ANNOUNCE_RACE: {
      const bits=[]; let a=BigInt(m.available);
      for(let i=0n;i<64n;i++) if((a>>i)&1n) bits.push(1n<<i);
      return {type:OcgResponseType.ANNOUNCE_RACE,
        races:bits.slice(attempt, attempt+(m.count??1))};
    }
    case OcgMessageType.ANNOUNCE_ATTRIB: {
      const bits=[]; const a=m.available;
      for(let i=0;i<32;i++) if((a>>i)&1) bits.push(1<<i);
      return {type:OcgResponseType.ANNOUNCE_ATTRIB,
        attributes:bits.slice(attempt, attempt+(m.count??1))};
    }
    case OcgMessageType.ANNOUNCE_NUMBER:
      return {type:OcgResponseType.ANNOUNCE_NUMBER,value:attempt};
    case OcgMessageType.ANNOUNCE_CARD:
      return {type:OcgResponseType.ANNOUNCE_CARD,card:55144522};
    case OcgMessageType.SORT_CARD: return {type:OcgResponseType.SORT_CARD,order:null};
    default: return null;
  }
}

for(let step=0; step<60000; step++){
  const status=await lib.duelProcess(h);
  for(const m of lib.duelGetMessage(h)){
    lastMsg=m;
    if(QUESTIONS.has(m.type)){ question=m; attempt=0;
      if(m.type===OcgMessageType.SELECT_PLACE && dbg<0){ dbg++;
        log.push(`      [SELECT_PLACE] jugador=${m.player} count=${m.count} mask=0x${(m.field_mask>>>0).toString(16).padStart(8,"0")}`); } }
    if(m.type===OcgMessageType.RETRY){ attempt++; retries++; }
    if(m.type===OcgMessageType.NEW_TURN){ turns++; log.push(`\n══ TURNO ${turns} — jugador ${m.player} ══`); }
    else if(m.type===OcgMessageType.NEW_PHASE) log.push(`  · ${PH[m.phase]??"fase "+m.phase}`);
    else if(m.type===OcgMessageType.DRAW) log.push(`    roba: ${(m.drawn??[]).map(d=>nameOf(d.code??d)).join(", ")}`);
    else if(m.type===OcgMessageType.SUMMONING) log.push(`    INVOCA ${nameOf(m.code)}`);
    else if(m.type===OcgMessageType.SPSUMMONING) log.push(`    INV. ESPECIAL ${nameOf(m.code)}`);
    else if(m.type===OcgMessageType.SET) log.push(`    coloca una carta boca abajo`);
    else if(m.type===OcgMessageType.CHAINING) log.push(`    ⛓ activa ${nameOf(m.code)}`);
    else if(m.type===OcgMessageType.ATTACK) log.push(`    ⚔ ataque`);
    else if(m.type===OcgMessageType.DAMAGE) log.push(`    💥 jugador ${m.player} recibe ${m.amount}`);
    else if(m.type===OcgMessageType.WIN) log.push(`\n🏆 GANA el jugador ${m.player} (razón ${m.reason})`);
  }
  if(status===OcgProcessResult.END){ log.push("\n(duelo terminado)"); break; }
  if(status===OcgProcessResult.WAITING){
    if(!question){ log.push("\n⚠ WAITING sin pregunta previa"); break; }
    const r=respond(question, attempt);
    if(!r){ log.push(`\n⚠ sin respuesta para ${MT[question.type]}`); break; }
    if(attempt>12){ log.push(`\n⚠ atascado en ${MT[question.type]}`); break; }
    lib.duelSetResponse(h,r);
  }
  if(turns>60) { log.push("\n(cortamos a los 12 turnos)"); break; }
}
console.log(log.join("\n"));
console.log(`\n─── respuestas rechazadas por el core (RETRY): ${retries} ───`);
