/* ════════════════════════════════════════════════════════════════
   CARTAS MUDAS

   El bug más caro de todos los reportados, porque no da ningún error:
   en esta base muchas cartas de Goat existen DOS VECES —Pyramid Turtle
   (77044671) y Pyramid Turtle (GOAT) (504700135)— y el script Lua, o
   sea el efecto, está solo en la del pool. Con el otro passcode la
   carta se reparte, se invoca y se queda ahí sin hacer nada.

   Y ese passcode "malo" es justo el que trae cualquier decklist copiada
   de internet. El mismo día, tres usuarios distintos reportaron que
   Pyramid Turtle no buscaba, que Sinister Serpent no volvía y que
   Nobleman of Crossout no se podía activar: era esto, no el motor.

   Aquí se comprueban las dos mitades del arreglo: que el motor SÍ hace
   bien las tres cosas cuando la carta lleva el código correcto, y que
   el simulador y el deck builder traducen cualquier código al del pool.
   ════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";
import { montar, nombre, X, P, T } from "./escenario.mjs";
const R=X.OcgResponseType, IA=X.SelectIdleCMDAction, BA=X.SelectBattleCMDAction;

const pruebas=[];
const comprobar=(t,v,d="")=>{ pruebas.push([t,!!v]); console.log(v?"  ✓":"  ✗", t, d?`— ${d}`:""); };
const pasa = m => {
  if(m.type===T.SELECT_IDLECMD) return { type:R.SELECT_IDLECMD, action:m.to_ep?IA.TO_EP:IA.TO_BP, index:null };
  if(m.type===T.SELECT_BATTLECMD) return { type:R.SELECT_BATTLECMD, action:m.to_ep?BA.TO_EP:BA.TO_M2, index:null };
  if(m.type===T.SELECT_CHAIN) return { type:R.SELECT_CHAIN, index:null };
  if(m.type===T.SELECT_EFFECTYN) return { type:R.SELECT_EFFECTYN, yes:true };
  if(m.type===T.SELECT_YESNO) return { type:R.SELECT_YESNO, yes:true };
  return null;
};

console.log("═══ CON EL CÓDIGO BUENO, EL MOTOR HACE SU TRABAJO ═══");

/* Pyramid Turtle muerto en combate busca un zombi */
{
  const e = await montar({ monstruos:[{carta:"Airknight Parshath", pos:P.FACEUP_ATTACK}] },
                         { monstruos:[{carta:"Pyramid Turtle", pos:P.FACEUP_ATTACK}],
                           deck:["Vampire Lord","Ryu Kokki"] });
  let atacado=false;
  await e.correr(m=>{
    if(m.type===T.SELECT_BATTLECMD){
      if(!atacado && (m.attacks||[]).length){ atacado=true;
        return { type:R.SELECT_BATTLECMD, action:BA.SELECT_BATTLE, index:0 }; }
      return { type:R.SELECT_BATTLECMD, action:m.to_ep?BA.TO_EP:BA.TO_M2, index:null };
    }
    if(m.type===T.SELECT_IDLECMD)
      return { type:R.SELECT_IDLECMD, action:m.to_bp?IA.TO_BP:IA.TO_EP, index:null };
    return pasa(m);
  }, 300);
  const campo = e.campo(1).map(c=>c.nombre);
  comprobar("Pyramid Turtle muerto en combate saca un zombi del mazo",
    campo.some(n=>/Vampire Lord|Ryu Kokki/.test(n)), campo.join(", ")||"(campo vacío)");
}

/* Sinister Serpent vuelve a la mano en tu Standby Phase */
{
  const e = await montar({ gy:["Sinister Serpent"] }, {});
  await e.correr(pasa, 400);
  comprobar("Sinister Serpent vuelve a la mano en la Standby",
    e.mano(0).some(c=>/Sinister Serpent/.test(c.nombre)));
}

/* Nobleman of Crossout solo se ofrece si hay una tapada */
{
  const mira = async lado1 => {
    const e = await montar({ mano:["Nobleman of Crossout","Pot of Greed"] }, lado1);
    let visto=null;
    await e.correr(m=>{
      if(m.type===T.SELECT_IDLECMD && m.player===0 && visto===null)
        visto = (m.activates||[]).map(a=>nombre(a.code));
      return pasa(m);
    }, 120);
    return visto ?? [];
  };
  const conTapada = await mira({ monstruos:[{carta:"Magician of Faith", pos:P.FACEDOWN_DEFENSE}] });
  const sinTapada = await mira({ monstruos:[{carta:"Magician of Faith", pos:P.FACEUP_ATTACK}] });
  comprobar("Nobleman of Crossout se ofrece con una tapada enfrente",
    conTapada.some(n=>/Nobleman/.test(n)), conTapada.join(", "));
  comprobar("…y no se ofrece si no hay ninguna",
    !sinTapada.some(n=>/Nobleman/.test(n)), sinTapada.join(", "));
}

console.log("\n═══ Y EL CÓDIGO MALO SE TRADUCE ANTES DE REPARTIR ═══");

const POOL = new Set(JSON.parse(readFileSync("../data/goat-pool.json","utf-8")).map(Number));
const NAMES = JSON.parse(readFileSync("./out/names.subset.json","utf-8"));
const html = readFileSync("./out/goat.html","utf-8");
const db   = readFileSync("../deckbuilder/deckbuilder.html","utf-8");

comprobar("el pool legal viaja dentro del HTML", /const POOL = new Set\(\[\d/.test(html));
comprobar("el simulador traduce el mazo antes de empezar",
  /function arreglarMazo/.test(html) && /arr = \[mio\.main, mio\.extra, rival\.main, rival\.extra\]\.map\(arreglarMazo\)/.test(html));
comprobar("y rechaza lo que no sea legal en Goat",
  /!CARDS\[c\] \|\| !POOL\.has\(c\)/.test(html));
comprobar("el deck builder traduce lo que importas", /function alPool\(code\)/.test(db)
  && /const legal = alPool\(code\)/.test(db));

/* La prueba de fondo: para cada carta del pool con nombre duplicado, el
   passcode "normal" tiene que resolver al del pool. */
{
  const base = n => String(n||"").replace(/\s*\((GOAT|Pre-errata|Pre-Errata|Anime|Action Field)\)\s*$/i,"").trim();
  const porNombre = new Map();
  for(const k in NAMES){
    const code=+k, nom=base(NAMES[k]?.name); if(!nom) continue;
    const previo=porNombre.get(nom);
    if(previo===undefined || (!POOL.has(previo) && POOL.has(code))) porNombre.set(nom, code);
  }
  const casos = ["Pyramid Turtle","Giant Rat","Nobleman of Crossout","Sinister Serpent",
                 "Mystic Tomato","Shining Angel","Scapegoat","Metamorphosis"];
  const fallan = casos.filter(n=>{ const c=porNombre.get(n); return c===undefined || !POOL.has(c); });
  comprobar(`las ${casos.length} cartas del reporte resuelven a un código legal`,
    !fallan.length, fallan.join(", "));
}

const ok = pruebas.filter(p=>p[1]).length;
console.log(`\n${ok}/${pruebas.length} comprobaciones pasan`);
process.exit(ok===pruebas.length ? 0 : 1);
