/* ══════════════════════════════════════════════════════════════════
   DECK BUILDER — Goat Format
   El pool se carga desde POOL (lista de passcodes). Si está vacío,
   se usa toda la base de datos y se avisa de que es provisional.
   ══════════════════════════════════════════════════════════════════ */
const IMG = "https://images.ygoprodeck.com/images/cards/";
const T_MON=0x1, T_SPELL=0x2, T_TRAP=0x4, T_FUSION=0x40;
const ATTR={1:"FUEGO",2:"AGUA",4:"TIERRA",8:"VIENTO",16:"LUZ",32:"OSCURIDAD",64:"DIVINO"};
const RACE={1:"Guerrero",2:"Mago",4:"Hada",8:"Demonio",16:"Zombi",32:"Máquina",
  64:"Aqua",128:"Piro",256:"Roca",512:"Bestia Alada",1024:"Planta",2048:"Insecto",
  4096:"Trueno",8192:"Dragón",16384:"Bestia",32768:"Bestia Guerrero",65536:"Dinosaurio",
  131072:"Pez",262144:"Serpiente Marina",524288:"Reptil",1048576:"Psíquico"};

const D = { main:[], extra:[], side:[] };
let filtro = { texto:"", tipo:"todos", atributo:0, nivel:0, soloPool:true };

const $ = s=>document.querySelector(s);
const base = c => (CARDS[c]?.alias || c);          // las variantes cuentan como la original
/* ══ PERO EL ARTE NO ES `alias` ══
   `alias` es una regla de NOMBRE: dice qué cartas comparten el límite de
   tres copias. Se estaba usando también para pedir la ilustración, y hay
   cartas que cuentan como otra sin parecerse en nada:

     A Legendary Ocean   salía con el arte de Umi
     Harpie Lady 1, 2, 3 y Cyber Harpie Lady, las cuatro con el de Harpie Lady

   —o sea que el starter de arpías enseñaba la misma imagen cinco veces—.
   Un passcode de Konami (ocho dígitos o menos) SIEMPRE tiene su propia
   ilustración en el servidor, así que se pide tal cual; el alias solo
   hace falta para los passcodes inventados del pool ("(GOAT)",
   "(Pre-Errata)"), que son los 206 que no existen fuera de aquí.
   Y manda `IMG_ALIAS` por delante de todo, porque el tamaño del
   passcode NO basta: Night Assailant (Pre-Errata) y Big Shield Gardna
   (Pre-Errata) llevan códigos inventados de OCHO dígitos, así que
   parecen de Konami y no lo son. Esas dos salían SIN imagen, que es
   seguramente lo que E llevaba viendo.
   El simulador tiene la misma corrección en `view.js`. */
const arte = c => (IMG_ALIAS[c]
                   || (String(c).length <= 8 ? c : CARDS[c]?.alias)
                   || c);
const nom  = c => (TEXTS[c]?.[0] ?? "#"+c);
const txt  = c => (TEXTS[c]?.[1] ?? "");
const dat  = c => CARDS[c] ?? null;

const poolSet = new Set(POOL.length ? POOL : Object.keys(CARDS).map(Number));
const hayPool = POOL.length > 0;

/* ── CARTAS MUDAS ──
   Muchas cartas de Goat existen dos veces en la base: con su passcode
   normal (Pyramid Turtle, 77044671) y con el de la revisión del formato
   (Pyramid Turtle (GOAT), 504700135). El efecto —el script Lua— está SOLO
   en el del pool. Con el otro código la carta se reparte, se invoca y no
   hace nada, sin error y sin aviso.
   Y el código "malo" es justo el que trae cualquier decklist copiada de
   internet, que es por donde entraban: tres usuarios reportaron el mismo
   día que Pyramid Turtle, Sinister Serpent y Nobleman of Crossout no
   funcionaban. Todo lo que se importa se traduce aquí. */
const baseNom = n => String(n||"")
  .replace(/\s*\((GOAT|Pre-errata|Pre-Errata|Anime|Action Field)\)\s*$/i,"").trim().toLowerCase();
const POR_NOMBRE_POOL = (()=>{
  const m = new Map();
  for(const k in TEXTS){
    const code = +k, n2 = baseNom(TEXTS[k][0]);
    if(!n2) continue;
    const previo = m.get(n2);
    if(previo===undefined || (!poolSet.has(previo) && poolSet.has(code))) m.set(n2, code);
  }
  return m;
})();
/* passcode legal equivalente, o null si esa carta no existe en Goat */
function alPool(code){
  if(poolSet.has(code)) return code;
  const eq = POR_NOMBRE_POOL.get(baseNom(TEXTS[code]?.[0]));
  return (eq!==undefined && poolSet.has(eq)) ? eq : null;
}

/* ── copias: el límite es por carta "real", contando alias ── */
function copias(code){
  const b = base(code);
  const cuenta = a => a.filter(c=>base(c)===b).length;
  return cuenta(D.main)+cuenta(D.extra)+cuenta(D.side);
}
const limite = code => (LIMITES[base(code)] ?? 3);

function puedeAñadir(code, zona){
  const d=dat(code); if(!d) return "carta desconocida";
  if(copias(code) >= limite(code))
    return limite(code)===0 ? "prohibida en Goat" : `máximo ${limite(code)} copia(s)`;
  const esExtra = !!(d.type & T_FUSION);
  if(zona==="main" && esExtra) return "va al Extra Deck";
  if(zona==="extra" && !esExtra) return "solo monstruos de Fusión";
  if(zona==="main" && D.main.length>=60) return "el Main Deck está lleno (60)";
  if(zona==="extra" && D.extra.length>=15) return "el Extra está lleno (15)";
  if(zona==="side" && D.side.length>=15) return "el Side está lleno (15)";
  return null;
}
function añadir(code, zona){
  const d=dat(code);
  if(!zona) zona = (d && (d.type & T_FUSION)) ? "extra" : "main";
  const err = puedeAñadir(code, zona);
  if(err){ aviso(err); return; }
  D[zona].push(code); pintarDeck();
}
function quitar(zona, i){ D[zona].splice(i,1); pintarDeck(); }

/* ── buscador ── */
function filtrar(){
  const q = filtro.texto.trim().toLowerCase();
  const res=[];
  for(const k in CARDS){
    const code=+k, d=CARDS[k];
    if(filtro.soloPool && hayPool && !poolSet.has(code)) continue;
    if(d.ot===8 && !hayPool) continue;              // variantes internas del motor
    if(filtro.tipo==="monstruo" && !(d.type & T_MON)) continue;
    if(filtro.tipo==="magica"   && !(d.type & T_SPELL)) continue;
    if(filtro.tipo==="trampa"   && !(d.type & T_TRAP)) continue;
    if(filtro.tipo==="fusion"   && !(d.type & T_FUSION)) continue;
    if(filtro.atributo && d.attribute!==filtro.atributo) continue;
    if(filtro.nivel && d.level!==filtro.nivel) continue;
    if(q){
      const n=(TEXTS[k]?.[0]??"").toLowerCase();
      if(!n.includes(q) && !(TEXTS[k]?.[1]??"").toLowerCase().includes(q)) continue;
    }
    res.push(code);
    if(res.length>=400) break;
  }
  res.sort((a,b)=>nom(a).localeCompare(nom(b)));
  return res;
}
function pintarResultados(){
  const res=filtrar();
  $("#conteo").textContent = T(`${res.length}${res.length>=400?"+":""} cartas`);
  const g=$("#grid"); g.innerHTML="";
  for(const code of res){
    const d=dat(code), el=document.createElement("div");
    el.className="cc"+(copias(code)>=limite(code)?" tope":"");
    el.title = nom(code);
    el.innerHTML=`<img loading="lazy" src="${IMG}${arte(code)}.jpg" alt="">
      <span class="nm">${nom(code)}</span>
      ${limite(code)<3?`<span class="lim l${limite(code)}">${limite(code)}</span>`:""}`;
    /* Con el dedo, el toque ABRE la ficha; añadir se hace desde ahí. Antes
       el toque metía la carta en el mazo sin haberla podido leer nunca:
       en el móvil no existe ni el hover ni el clic derecho. */
    el.onclick=()=>{ if(TACTIL()) verFicha(code); else añadir(code); };
    el.oncontextmenu=e=>{ e.preventDefault(); añadir(code,"side"); };
    el.onmouseenter=()=>detalle(code);
    arrastrable(el, code, false);
    g.appendChild(el);
  }
}
/* ── ¿estamos en un teléfono? ──
   Por PUNTERO, no por ancho: un iPad en horizontal declara 1024 px y
   también se maneja con el dedo. */
function TACTIL(){ try{ return !!matchMedia("(pointer:coarse)").matches; }catch(e){ return false; } }

/* ══════════════════════════════════════════════════════════════════
   ARRASTRAR CARTAS ENTRE LAS DOS MITADES

   E: "las cartas se mueven arrastrándose de un bloque a otro, y si
   mantienes el dedo en una carta te muestra su info". Las dos cosas a
   la vez necesitan decidir qué gesto es cuál: si el dedo SE MUEVE, es
   un arrastre; si se queda quieto y levanta, es un toque y se abre la
   ficha. Sin ese umbral, cualquier temblor al leer movía la carta.
   ══════════════════════════════════════════════════════════════════ */
let arrastre = null;
function fantasma(){
  let f = $("#fantasma");
  if(!f){ f=document.createElement("div"); f.id="fantasma";
    f.innerHTML='<img alt="">'; document.body.appendChild(f); }
  return f;
}
function arrastrable(el, code, desdeMazo, zona, indice){
  el.addEventListener("pointerdown", e => {
    arrastre = { code, desdeMazo, zona, indice, movido:false,
                 x0:e.clientX ?? 0, y0:e.clientY ?? 0 };
  });
}
function zonaBajo(x,y){
  const n = document.elementFromPoint?.(x,y);
  return n?.closest?.("#der") ? "der" : n?.closest?.("#centro") ? "centro" : null;
}
window.addEventListener("pointermove", e => {
  if(!arrastre) return;
  const x=e.clientX ?? 0, y=e.clientY ?? 0;
  if(!arrastre.movido && Math.hypot(x-arrastre.x0, y-arrastre.y0) < 12) return;
  if(!arrastre.movido){
    arrastre.movido = true;
    cerrarFicha();
    const f = fantasma();
    f.querySelector("img").src = IMG + arte(arrastre.code) + ".jpg";
    f.style.display = "block";
  }
  const f = fantasma();
  f.style.left = x+"px"; f.style.top = y+"px";
  const z = zonaBajo(x,y);
  $("#der").classList.toggle("recibe", z==="der" && arrastre.desdeMazo===false);
  $("#centro").classList.toggle("recibe", z==="centro" && arrastre.desdeMazo===true);
});
window.addEventListener("pointerup", e => {
  const a = arrastre; arrastre = null;
  $("#der")?.classList.remove("recibe");
  $("#centro")?.classList.remove("recibe");
  const f = $("#fantasma"); if(f) f.style.display="none";
  if(!a || !a.movido) return;                  // fue un toque, no un arrastre
  const z = zonaBajo(e.clientX ?? 0, e.clientY ?? 0);
  if(!a.desdeMazo && z === "der") añadir(a.code);
  else if(a.desdeMazo && z === "centro") quitar(a.zona, a.indice);
});
window.addEventListener("pointercancel", () => {
  arrastre = null;
  const f = $("#fantasma"); if(f) f.style.display="none";
});

function detalle(code, acciones){
  const d=dat(code); if(!d) return;
  const mon=!!(d.type&T_MON);
  const p=$("#detalle");
  p.innerHTML=`
    <img src="${IMG}${arte(code)}.jpg" alt="">
    <h3>${nom(code)}</h3>
    <div class="meta">${mon ? `${ATTR[d.attribute]??""} · Nivel ${d.level} · ${RACE[+d.race]??""}`
                            : (d.type&T_SPELL?"Carta Mágica":"Carta de Trampa")}</div>
    ${mon?`<div class="stats"><span>ATK ${d.attack}</span><span>DEF ${d.defense}</span></div>`:""}
    <p>${txt(code).replace(/\r?\n/g,"<br>")}</p>`;
  if(acciones) p.appendChild(acciones);
}
/* La ficha como hoja inferior: la única forma de leer una carta en un
   teléfono, y de donde salen las acciones que en escritorio son clic
   izquierdo y clic derecho. */
function verFicha(code, deZona, indice){
  const caja=document.createElement("div");
  caja.className="fAcciones";
  const bot=(txt,cls,fn)=>{ const b=document.createElement("button");
    b.className="btn "+(cls||""); b.textContent=txt;
    b.onclick=()=>{ fn(); cerrarFicha(); }; caja.appendChild(b); };
  if(deZona){
    bot(T("Quitar del mazo"),"", ()=>quitar(deZona, indice));
  } else {
    const tope = copias(code)>=limite(code);
    if(tope){ const s=document.createElement("span"); s.className="fTope";
      s.textContent=T("Ya llevas el máximo de copias"); caja.appendChild(s); }
    else {
      bot(T("Añadir al mazo"),"oro", ()=>añadir(code));
      bot(T("Añadir al Side"),"", ()=>añadir(code,"side"));
    }
  }
  bot(T("Cerrar"),"sec", ()=>{});
  detalle(code, caja);
  $("#izq").classList.add("abierto");
  document.body.classList.add("hojaAbierta");
}
function cerrarFicha(){
  $("#izq").classList.remove("abierto");
  document.body.classList.remove("hojaAbierta");
}

/* ── mazo ── */
function pintarDeck(){
  for(const z of ["main","extra","side"]){
    const cont=$("#"+z); cont.innerHTML="";
    const orden=[...D[z]].sort((a,b)=>{
      const A=dat(a),B=dat(b);
      const cat=x=> (x.type&T_MON)?0:(x.type&T_SPELL)?1:2;
      return cat(A)-cat(B) || (B.attack??0)-(A.attack??0) || nom(a).localeCompare(nom(b));
    });
    D[z]=orden;
    orden.forEach((code,i)=>{
      const el=document.createElement("div");
      el.className="dc"; el.title=nom(code);
      el.innerHTML=`<img loading="lazy" src="${IMG}${arte(code)}.jpg" alt="">`;
      el.onclick=()=>{ if(TACTIL()) verFicha(code, z, i); else quitar(z,i); };
      el.onmouseenter=()=>detalle(code);
      arrastrable(el, code, true, z, i);
      cont.appendChild(el);
    });
    $("#n"+z).textContent = D[z].length;
  }
  const m=D.main.length;
  const ok = m>=40 && m<=60 && D.extra.length<=15 && D.side.length<=15;
  $("#estado").textContent = T(ok ? "Mazo válido" : (m<40?`Faltan ${40-m} cartas`:`Sobran ${m-60}`));
  $("#estado").className = ok ? "ok" : "mal";
  const mon=D.main.filter(c=>dat(c).type&T_MON).length;
  const mag=D.main.filter(c=>dat(c).type&T_SPELL).length;
  const tra=D.main.filter(c=>dat(c).type&T_TRAP).length;
  $("#reparto").textContent = T(`${mon} monstruos · ${mag} mágicas · ${tra} trampas`);
  const cuenta=$("#verMazoN"); if(cuenta) cuenta.textContent = String(m);
  guardar(); pintarResultados();
}
function aviso(t){
  t = T(t);
  const a=$("#aviso"); a.textContent=t; a.classList.add("ver");
  clearTimeout(aviso._t); aviso._t=setTimeout(()=>a.classList.remove("ver"),1900);
}

/* ── YDK: el formato universal de Yu-Gi-Oh ── */
function exportarYDK(){
  const L=["#created by Goat Deck Builder","#main",...D.main,"#extra",...D.extra,"!side",...D.side];
  return L.join("\n")+"\n";
}
function importarYDK(texto){
  const nuevo={main:[],extra:[],side:[]};
  let z="main", desconocidas=[], porNombre=0, traducidas=0;
  /* Índice por nombre para las listas escritas a mano. Gana el código del
     pool: si no, "Book of Moon" podía resolverse al passcode sin script. */
  const porNom = {};
  for(const k in TEXTS){
    const n2=(TEXTS[k][0]||"").toLowerCase(), code=+k;
    if(porNom[n2]===undefined || (!poolSet.has(porNom[n2]) && poolSet.has(code)))
      porNom[n2]=code;
    const b=baseNom(TEXTS[k][0]);
    if(porNom[b]===undefined || (!poolSet.has(porNom[b]) && poolSet.has(code)))
      porNom[b]=code;
  }
  const mete = (code, zona) => {
    const legal = alPool(code);
    if(legal===null) return false;
    if(legal!==code) traducidas++;
    nuevo[(CARDS[legal].type & T_FUSION) && zona==="main" ? "extra" : zona].push(legal);
    return true;
  };
  for(let linea of texto.split(/\r?\n/)){
    linea=linea.trim(); if(!linea) continue;
    if(/^#main/i.test(linea)){ z="main"; continue; }
    if(/^#extra/i.test(linea)){ z="extra"; continue; }
    if(/^!side/i.test(linea)){ z="side"; continue; }
    if(linea.startsWith("#")) continue;
    if(/^\d{5,9}$/.test(linea)){                       // passcode
      if(!mete(+linea, z)) desconocidas.push(linea);
      continue;
    }
    // lista escrita a mano: "3x Book of Moon" o "Book of Moon"
    const m=/^(\d+)\s*[x×]?\s+(.*)$/i.exec(linea);
    const veces = m ? +m[1] : 1;
    const nombre = (m ? m[2] : linea).trim().toLowerCase();
    const code = porNom[nombre] ?? porNom[baseNom(nombre)];
    if(code!==undefined && alPool(code)!==null){
      for(let i=0;i<veces;i++) mete(code, z);
      porNombre+=veces;
    } else desconocidas.push(linea);
  }
  D.main=nuevo.main; D.extra=nuevo.extra; D.side=nuevo.side;
  pintarDeck();
  aviso(`${T("Importado")}: ${D.main.length}+${D.extra.length}`+
        (porNombre?` · ${porNombre} ${T("por nombre")}`:"")+
        (traducidas?` · ${traducidas} ${T("adaptadas a Goat")}`:"")+
        (desconocidas.length?` · ${desconocidas.length} ${T("sin identificar")}`:""));
  if(desconocidas.length) console.warn("no identificadas:", desconocidas);
}
/* Fichero para el simulador: lleva los datos de carta que necesita,
   así el simulador no tiene que llevar toda la base dentro. */
function exportarParaSimulador(){
  const usados=[...new Set([...D.main,...D.extra,...D.side])];
  const cards={}, names={};
  for(const c of usados){
    cards[c]=CARDS[c]; names[c]={name:TEXTS[c][0],desc:TEXTS[c][1]};
    const a=CARDS[c]?.alias;
    if(a && CARDS[a]){ cards[a]=CARDS[a]; names[a]={name:TEXTS[a][0],desc:TEXTS[a][1]}; }
  }
  return JSON.stringify({ formato:"goat-deck-v1", nombre:$("#nombreMazo").value||"Mazo sin nombre",
    main:D.main, extra:D.extra, side:D.side, cards, names }, null, 0);
}
function bajar(nombre, contenido, tipo="text/plain"){
  const b=new Blob([contenido],{type:tipo+";charset=utf-8"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download=nombre;
  document.body.appendChild(a); a.click(); a.remove();
}
/* ══ Slots de mazos ═════════════════════════════════════════════
   Se guardan en localStorage con la misma clave que lee el simulador,
   así los mazos que montes aquí aparecen allí para elegirlos. */
const CLAVE="goatDecks";
let slots=[], slotActivo=null;
function leerSlots(){
  try{ slots=JSON.parse(localStorage.getItem(CLAVE)||"[]"); }catch(e){ slots=[]; }
  if(!Array.isArray(slots)) slots=[];
}
function escribirSlots(){
  try{ localStorage.setItem(CLAVE, JSON.stringify(slots)); }
  catch(e){ aviso("No se pudo guardar (almacenamiento del navegador)"); }
}
function guardar(){   // autoguardado del borrador en curso
  try{ localStorage.setItem("goatBorrador",
    JSON.stringify({...D, nombre:$("#nombreMazo").value, slot:slotActivo})); }catch(e){}
}
function cargarGuardado(){
  leerSlots();
  try{
    const j=JSON.parse(localStorage.getItem("goatBorrador")||"null");
    if(j){ D.main=j.main||[]; D.extra=j.extra||[]; D.side=j.side||[];
           if(j.nombre) $("#nombreMazo").value=j.nombre;
           slotActivo=j.slot ?? null; }
  }catch(e){}
  pintarSlots();
}
function valido(){ return D.main.length>=40 && D.main.length<=60; }
function guardarSlot(comoNuevo){
  const nombre=($("#nombreMazo").value||"").trim() || "Mazo sin nombre";
  if(!D.main.length){ aviso("El mazo está vacío"); return; }
  const datos={ nombre, main:[...D.main], extra:[...D.extra], side:[...D.side],
                valido:valido(), fecha:Date.now() };
  if(!comoNuevo && slotActivo!=null && slots[slotActivo]){
    slots[slotActivo]=datos; aviso(`${T("Guardado")}: ${nombre}`);
  } else {
    slots.push(datos); slotActivo=slots.length-1; aviso(`${T("Nuevo mazo")}: ${nombre}`);
  }
  escribirSlots(); pintarSlots(); guardar();
}
function cargarSlot(i){
  const s=slots[i]; if(!s) return;
  D.main=[...s.main]; D.extra=[...s.extra]; D.side=[...(s.side||[])];
  $("#nombreMazo").value=s.nombre; slotActivo=i;
  pintarDeck(); pintarSlots(); aviso(`Cargado: ${s.nombre}`);
}
function borrarSlot(i){
  const s=slots[i]; if(!s) return;
  if(!confirm(`¿Borrar "${s.nombre}"?`)) return;
  slots.splice(i,1);
  if(slotActivo===i) slotActivo=null; else if(slotActivo>i) slotActivo--;
  escribirSlots(); pintarSlots(); aviso("Mazo borrado");
}
function pintarSlots(){
  const c=$("#slots"); if(!c) return;
  c.innerHTML="";
  if(!slots.length){
    c.innerHTML=`<div class="vacio">${T("Aún no has guardado ningún mazo")}</div>`;
  }
  slots.forEach((s,i)=>{
    const el=document.createElement("div");
    el.className="slot"+(i===slotActivo?" act":"")+(s.valido?"":" inval");
    el.innerHTML=`<span class="sn">${s.nombre}</span>
      <span class="sc">${s.main.length}${s.extra.length?"+"+s.extra.length:""}</span>
      <button class="sx" title="Borrar">✕</button>`;
    el.onclick=e=>{ if(e.target.classList.contains("sx")) return; cargarSlot(i); };
    el.querySelector(".sx").onclick=e=>{ e.stopPropagation(); borrarSlot(i); };
    c.appendChild(el);
  });
  $("#nSlots").textContent = slots.length;
}

/* ── arranque ── */
function init(){
  $("#buscar").oninput=e=>{ filtro.texto=e.target.value; pintarResultados(); };
  $("#fTipo").onchange=e=>{ filtro.tipo=e.target.value; pintarResultados(); };
  $("#fAtr").onchange=e=>{ filtro.atributo=+e.target.value; pintarResultados(); };
  $("#fNivel").onchange=e=>{ filtro.nivel=+e.target.value; pintarResultados(); };
  $("#btnYdk").onclick=()=>bajar(($("#nombreMazo").value||"mazo")+".ydk", exportarYDK());
  $("#btnSim").onclick=()=>bajar(($("#nombreMazo").value||"mazo")+".goatdeck.json",
                                 exportarParaSimulador(), "application/json");
  $("#btnVaciar").onclick=()=>{ D.main=[];D.extra=[];D.side=[]; pintarDeck(); };
  /* El mazo, abierto y cerrado con el pulgar. El botón solo se ve en
     pantallas donde las tres columnas no caben (lo decide el CSS). */
  const vm=$("#verMazo");
  if(vm) vm.onclick=()=>{ $("#der").classList.toggle("abierto"); cerrarFicha(); };
  /* Tocar fuera de la hoja la cierra: es el gesto que espera cualquiera. */
  const izq=$("#izq");
  if(izq) izq.addEventListener("click", e=>{ if(e.target===izq) cerrarFicha(); });
  $("#btnImportar").onclick=()=>$("#ficheroYdk").click();
  $("#ficheroYdk").onchange=e=>{
    const f=e.target.files[0]; if(!f) return;
    const r=new FileReader(); r.onload=()=>importarYDK(String(r.result)); r.readAsText(f);
  };
  $("#pegar").onclick=()=>{
    const t=prompt("Pega aquí la lista (YDK o nombres, uno por línea):");
    if(t) importarYDK(t);
  };
  $("#nombreMazo").oninput=guardar;
  $("#btnGuardar").onclick=()=>guardarSlot(false);
  $("#btnGuardarComo").onclick=()=>guardarSlot(true);
  $("#btnNuevo").onclick=()=>{ D.main=[];D.extra=[];D.side=[];
    slotActivo=null; $("#nombreMazo").value=""; pintarDeck(); pintarSlots(); };
  const av=$("#avisoPool");
  if(!hayPool) av.style.display="block";
  cargarGuardado(); pintarDeck();
}
document.addEventListener("DOMContentLoaded", init);
