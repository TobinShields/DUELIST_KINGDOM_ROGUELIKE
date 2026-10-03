/* ══════════════════════════════════════════════════════════════════
   CON FICHAS Y SIN CLASIFICAR, SIEMPRE HAY ALGO QUE PULSAR

   E: "he llegado con 9 Star Chips hasta Paradox Brothers y la run se ha
   quedado sin ninguna forma de conseguir la décima".

   Lo peor del bug es que la lógica estaba BIEN: `opciones()` devolvía
   los duelos de última oportunidad. Lo que fallaba era la pantalla —
   esos nodos no viven en `acto.columnas` y el mapa solo dibujaba
   columnas, así que la API ofrecía dos duelos y en pantalla no había ni
   un botón. Por eso esta comprobación mira LOS BOTONES, no la API:
   simular runs contra `opciones()` daba cero bloqueos con el juego roto.

   La regla es absoluta: mientras no estés clasificado y te quede al
   menos una ficha, tiene que existir una forma de seguir duelando.

   Uso:  node check-fichas.mjs
   ══════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from "node:fs";
import { installDOM } from "./domstub.mjs";
globalThis.GOAT_SEED = 20050401;
installDOM();
globalThis.matchMedia = q => ({ matches:false, media:q, addListener(){}, removeListener(){} });
globalThis.innerWidth = 1280;

const mem = new Map();
global.localStorage = {
  getItem: k => k === "goatConfig" ? '{"idioma":"es"}' : (mem.get(k) ?? null),
  setItem: (k,v) => mem.set(k,v), removeItem: k => mem.delete(k),
};
const html = readFileSync("./out/goat.html","utf-8");
writeFileSync("./out/_fic.mjs", html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]);
console.warn = () => {};
await import("./out/_fic.mjs");
await new Promise(r => setTimeout(r, 400));

let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t,d="") => { fallos++; console.log("  ✗ " + t + (d ? "   " + d : "")); };
console.log("\n═══ NUNCA BLOQUEADO ANTES DEL CASTILLO ═══\n");

const $ = id => document.getElementById(id);
function todos(n, out=[]){ if(!n) return out; out.push(n);
  for(const h of (n.children ?? [])) todos(h, out); return out; }
const conClase = (r,c) => todos(r).filter(x => x.classList?.contains?.(c));
const texto = n => {
  if(!n) return "";
  const h = n.children ?? [];
  if(!h.length) return String(n.textContent ?? "").trim();
  return h.map(texto).filter(Boolean).join(" ").trim() || String(n.textContent ?? "").trim();
};

$("irReino").onclick?.();
const reino = $("reino");
const R = globalThis.__REINO_PRUEBA__;
if(!R){ mal("el gancho de prueba del Reino existe"); process.exit(1); }
const H = R.H;
const DATOS = JSON.parse(readFileSync("../data/story/personajes.json","utf-8"));
const JUGABLES = new Set((DATOS.jugables ?? []).map(j => j.id));
const TORRE = new Set(["mai","keith","joey","kaiba","yugi"]);

/* Los nodos que el MAPA deja pulsar de verdad. */
const pulsablesDelMapa = () => {
  R.alMapa();
  return conClase(reino,"rNodo").concat(conClase(reino,"rPeldaño"))
         .filter(b => b.tagName === "button" && b.disabled === false);
};

/* ── 1 · EL CASO EXACTO DE E: nueve fichas y la isla acabada ── */
{
  let sinBotones = 0, casos = 0, quienes = new Set();
  for(let s = 0; s < 60; s++){
    mem.clear();
    H.empezar({ semilla:"NUEVE-"+s, personaje:"yugi" });
    /* Se le lleva hasta la puerta del castillo ganándolo todo, y luego
       se le dejan nueve fichas: justo lo que le pasó a E. */
    for(let i = 0; i < 60; i++){
      const ops = H.opciones();
      if(!ops.length) break;
      const n = ops[0];
      if(n.acto === 2) break;                    // puerta del castillo
      const c = H.entrar(n.id);
      if(["DUELO","ELITE","JEFE"].includes(c.tipo))
        H.resolverDuelo({ ganado:true, rivalId:c.rival?.id, elite:c.tipo==="ELITE" });
      else if(c.tipo === "PREPARACION"){ H.elegirPreparacion("PACK"); H.abrirPack("ARCANE"); }
      else if(c.tipo === "PACK") H.abrirPack("ARCANE");
      else if(c.tipo === "CAMPAMENTO"){ if(!H.acampar("lp")?.ok) H.saltarNodo(); }
      else if(c.tipo === "EVENTO") H.elegirEnEvento(c.evento.opciones[0]);
      else H.saltarNodo();
    }
    H.run.chips = 9; H.run.clasificado = false;
    casos++;
    const botones = pulsablesDelMapa();
    if(!botones.length) sinBotones++;
    for(const b of conClase(reino,"rUltimosFila").flatMap(f => f.children ?? []))
      quienes.add(texto(b));
  }
  if(sinBotones) mal(`con 9 fichas SIEMPRE hay algo que pulsar`,
                     `${sinBotones} de ${casos} runs sin un solo botón vivo`);
  else ok(`las ${casos} runs con 9 fichas tienen duelos disponibles en el mapa`);
  if(!quienes.size) mal("la zona de duelistas restantes sale en el mapa");
  else ok(`salen como duelistas de la isla: ${[...quienes].slice(0,4).join(", ")}`);

  /* Y quién puede salir: ni Pegasus, ni tú, ni gente de la torre. */
  const prohibidos = [...quienes].filter(q =>
    /pegasus/i.test(q) || /^yugi/i.test(q));
  if(prohibidos.length) mal("no salen ni Pegasus ni el personaje que juegas", prohibidos.join(", "));
  else ok("y no aparece ni Pegasus ni el duelista que estás jugando");
}

/* ── 2 · SE PUEDE SEGUIR INDEFINIDAMENTE HASTA LAS DIEZ ── */
{
  mem.clear();
  H.empezar({ semilla:"HASTA-DIEZ", personaje:"mai" });
  H.run.chips = 1; H.run.clasificado = false;
  /* Se le fuerza a la puerta del castillo. */
  for(let i = 0; i < 60; i++){
    const ops = H.opciones();
    if(!ops.length || ops[0].acto === 2) break;
    const c = H.entrar(ops[0].id);
    if(["DUELO","ELITE","JEFE"].includes(c.tipo))
      H.resolverDuelo({ ganado:true, rivalId:c.rival?.id, elite:c.tipo==="ELITE" });
    else H.saltarNodo();
  }
  H.run.chips = 1; H.run.clasificado = false;

  let duelos = 0, atasco = false;
  /* Pierde una, gana una, pierde una… y aun así tiene que poder llegar. */
  for(let i = 0; i < 120 && !H.run.clasificado; i++){
    const botones = pulsablesDelMapa();
    if(!botones.length){ atasco = true; break; }
    const id = botones[0].dataset?.id;
    const c = H.entrar(id);
    if(!["DUELO","ELITE","JEFE"].includes(c.tipo)){ H.saltarNodo(); continue; }
    duelos++;
    /* Se pierde una de cada tres: la run tiene que aguantar. */
    const gana = (i % 3) !== 0 || H.run.chips <= 1;
    H.resolverDuelo({ ganado:gana, rivalId:c.rival?.id, elite:c.tipo === "ELITE" });
    if(H.estado().terminada) break;
  }
  if(atasco) mal("se puede seguir duelando hasta juntar las diez",
                 `atascado con ${H.run.chips} fichas tras ${duelos} duelos`);
  else if(!H.run.clasificado && !H.estado().terminada)
    mal("o se llega a diez o se acaba la run", `ni una cosa ni la otra tras ${duelos} duelos`);
  else if(H.run.clasificado)
    ok(`desde 1 ficha y perdiendo una de cada tres se llega a las diez (${duelos} duelos)`);
  else ok(`la run se acaba a cero fichas, que es lo correcto (${duelos} duelos)`);
}

/* ── 3 · Y AL LLEGAR A DIEZ, LA ZONA DESAPARECE Y SE ABRE EL CASTILLO ── */
{
  mem.clear();
  H.empezar({ semilla:"DIEZ-YA", personaje:"keith" });
  for(let i = 0; i < 60; i++){
    const ops = H.opciones();
    if(!ops.length || ops[0].acto === 2) break;
    const c = H.entrar(ops[0].id);
    if(["DUELO","ELITE","JEFE"].includes(c.tipo))
      H.resolverDuelo({ ganado:true, rivalId:c.rival?.id, elite:c.tipo==="ELITE" });
    else H.saltarNodo();
  }
  H.run.chips = 10; H.run.clasificado = true;
  R.alMapa();
  if(conClase(reino,"rUltimos").length)
    mal("con diez fichas la zona de última oportunidad desaparece");
  else ok("con las diez fichas la zona desaparece");
  const alCastillo = conClase(reino,"rPeldaño").filter(b => b.disabled === false);
  if(!alCastillo.length) mal("y el castillo se abre");
  else ok(`y el castillo se abre (${alCastillo.length} peldaño(s) pulsables)`);
}

/* ── 4 · A CERO FICHAS SE ACABA, NO SE OFRECEN MÁS DUELOS ── */
{
  mem.clear();
  H.empezar({ semilla:"CERO", personaje:"kaiba" });
  H.run.chips = 0; H.run.terminada = true;
  R.alMapa();
  if(conClase(reino,"rUltimos").length)
    mal("a cero fichas no se ofrecen más duelos");
  else ok("a cero fichas no se ofrece nada más: la run se ha acabado");
}

console.log(`\n${fallos ? "FALLA: " + fallos : "Todo correcto"}`);
process.exit(fallos ? 1 : 0);
