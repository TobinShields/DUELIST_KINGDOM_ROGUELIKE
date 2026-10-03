/* ══════════════════════════════════════════════════════════════════
   LOS TRES QUE NO PUEDEN FALLAR NUNCA

   1. ENTRAR EN UN NODO NO ES RESOLVERLO. Asomarse a un duelo y volver
      al mapa no puede completarlo, ni tocar las Star Chips.
   2. PERDER NO COMPLETA NADA. Cuesta la ficha y el nodo sigue ahí; lo
      que acaba la run es quedarse a cero.
   3. LA PUERTA DEL CASTILLO ESTÁ CERRADA. No se entra al acto III sin
      las diez fichas, y ninguna run viva puede quedarse sin forma de
      conseguirlas.

   Los tres estaban rotos a la vez y los tres se ven jugando, no
   leyendo el código.
   ══════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";
import { crearCatalogo } from "./src/story/catalogo.js";
import { crearHistoria } from "./src/story/historia.js";
const D="../data/", leer=f=>JSON.parse(readFileSync(D+f,"utf-8"));
const cat=crearCatalogo({pools:leer("story/cards.json"),db:leer("pool_cards.json"),
  limites:leer("goat-limites.json"),pool:leer("goat-pool.json"),nombres:leer("pool_texts.json")});
const almacenDePrueba=()=>{const m=new Map();return{leer:k=>m.get(k)??null,escribir:(k,v)=>m.set(k,v),borrar:k=>m.delete(k)};};
const nueva=()=>crearHistoria({datos:leer("story/personajes.json"),decks:leer("story/decks.json"),
  eventos:leer("story/eventos.json"),cat,almacen:almacenDePrueba(),mazosDelSimulador:leer("mazos.json")});
let fallos=0; const ok=t=>console.log("  ✓ "+t); const mal=(t,d="")=>{fallos++;console.log("  ✗ "+t+(d?"   "+d:""));};
console.log("\n═══ P0 ═══\n");

/* 1 · asomarse a un nodo y volver NO lo resuelve, sea del tipo que sea */
{
  const tipos = new Set();
  for(let s=0;s<40;s++){
    const H=nueva(); H.empezar({semilla:"P0-"+s, personaje:"yugi"});
    for(let paso=0;paso<6;paso++){
      const ops=H.opciones(); if(!ops.length) break;
      const n=ops[0], antes=H.estado().chips;
      const c=H.entrar(n.id);                       // ASOMARSE
      tipos.add(c.tipo);
      const luego=H.opciones();                     // VOLVER AL MAPA
      if(!(luego.length===1 && luego[0].id===n.id))
        { mal("asomarse a un nodo y volver deja el nodo pendiente",
              `${c.tipo}: se ofrecieron ${luego.map(x=>x.tipo).join(",")}`); paso=99; break; }
      if(H.estado().chips !== antes)
        { mal("asomarse no toca las Star Chips", c.tipo); paso=99; break; }
      /* resolverlo de verdad para poder seguir */
      if(["DUELO","ELITE","JEFE"].includes(c.tipo)){
        const r=H.resolverDuelo({ganado:true,rivalId:c.rival?.id,elite:c.tipo==="ELITE"});
        if(r.premio?.length) H.cogerPremio(r.premio[0].code);
      }
      else if(c.tipo==="PREPARACION"){ H.elegirPreparacion("PACK"); H.abrirPack("ARCANE"); }
      else if(c.tipo==="PACK") H.abrirPack("ARCANE");
      else if(c.tipo==="CAMPAMENTO"){ const rr=H.acampar("lp"); if(!rr?.ok) H.saltarNodo(); }
      else if(c.tipo==="EVENTO") H.elegirEnEvento(c.evento.opciones[0]);
      else H.saltarNodo();
    }
  }
  if(!fallos) ok(`asomarse y volver deja el nodo pendiente en los ${tipos.size} tipos probados (${[...tipos].join(", ")})`);
}

/* 2 · perder no resuelve el nodo, y a 0 fichas la run se acaba */
{
  const H=nueva(); H.empezar({semilla:"P0-PERDER", personaje:"yugi"});
  /* Hay que llegar a un DUELO: el primer nodo puede ser un pack. */
  let n=null, c=null;
  for(let i=0;i<10;i++){
    n=H.opciones()[0]; c=H.entrar(n.id);
    if(["DUELO","ELITE","JEFE"].includes(c.tipo)) break;
    if(c.tipo==="PACK") H.abrirPack("ARCANE");
    else if(c.tipo==="CAMPAMENTO"){ const rr=H.acampar("lp"); if(!rr?.ok) H.saltarNodo(); }
    else if(c.tipo==="EVENTO") H.elegirEnEvento(c.evento.opciones[0]);
    else { const nd=H.nodoActual(); if(nd) nd.resuelto=true; }
  }
  const antes=H.estado().chips;
  H.resolverDuelo({ganado:false, rivalId:c.rival?.id});
  const luego=H.opciones();
  if(H.estado().chips >= antes) mal("perder cuesta una ficha");
  else if(!(luego.length===1 && luego[0].id===n.id)) mal("perder deja el nodo pendiente para reintentarlo",
    luego.map(x=>x.tipo).join(","));
  else ok("perder cuesta una ficha y deja el nodo pendiente para reintentarlo");
  /* seguir perdiendo hasta cero */
  for(let i=0;i<10 && !H.estado().terminada;i++){
    const m=H.opciones()[0]; H.entrar(m.id);
    H.resolverDuelo({ganado:false, rivalId:c.rival?.id});
  }
  const e=H.estado();
  if(!e.terminada || e.ganada) mal("a cero fichas la run se acaba y no cuenta como ganada");
  else ok(`a ${e.chips} fichas la run se acaba y no cuenta como ganada`);
}

/* 3 · no se entra al castillo sin diez fichas */
{
  let entradasSinDiez=0, bloqueadas=0, N=300;
  for(let s=0;s<N;s++){
    const H=nueva(); H.empezar({semilla:"P0-CASTILLO-"+s, personaje:"yugi"});
    /* Se pierde el 60% de los duelos: así muchas runs llegan cortas. */
    const r=(()=>{let x=s*2654435761>>>0;return()=>((x^=x<<13,x^=x>>>17,x^=x<<5,x>>>0)%1000)/1000;})();
    let pasos=0, muerto=false;
    while(pasos++<400){
      const ops=H.opciones(); if(!ops.length) break;
      const n=ops[0], c=H.entrar(n.id);
      if(n.acto===2 && !H.estado().clasificado){ entradasSinDiez++; break; }
      if(["DUELO","ELITE","JEFE"].includes(c.tipo)){
        const gana = r()>0.6;
        const res=H.resolverDuelo({ganado:gana,rivalId:c.rival?.id,elite:c.tipo==="ELITE"});
        if(res.premio?.length) H.cogerPremio(res.premio[0].code);
        if(res.terminada){ muerto=true; break; }
      }
      else if(c.tipo==="PREPARACION"){ H.elegirPreparacion("PACK"); H.abrirPack("ARCANE"); }
      else if(c.tipo==="PACK") H.abrirPack("ARCANE");
      else if(c.tipo==="CAMPAMENTO"){ const rr=H.acampar("lp"); if(!rr?.ok) H.saltarNodo(); }
      else if(c.tipo==="EVENTO") H.elegirEnEvento(c.evento.opciones[0]);
      else H.saltarNodo();
    }
    const e=H.estado();
    if(pasos>=400 && !muerto && !e.terminada && !e.clasificado) bloqueadas++;
  }
  if(entradasSinDiez) mal("nadie entra al castillo con menos de 10 fichas", `${entradasSinDiez} de ${N}`);
  else ok(`ninguna de ${N} runs entra al castillo con menos de 10 Star Chips`);
  if(bloqueadas) mal("ninguna run viva se queda sin salida", `${bloqueadas} bloqueadas`);
  else ok("ninguna run viva se queda sin forma de llegar a las diez");
}

console.log(`\n${fallos ? "FALLA: "+fallos : "Todo correcto"}`);
process.exit(fallos?1:0);
