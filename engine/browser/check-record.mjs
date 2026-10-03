/* ══════════════════════════════════════════════════════════════════
   EL HISTORIAL DEL DUELISTA

   Tres cosas que en este proyecto ya han salido mal y por eso se
   comprueban desde el primer día:

   1 · CONTAR UNA VEZ. La maestría tuvo exactamente este bug: recargar
       la pantalla de victoria la subía otra vez. Cada apunte repetible
       lleva su marca en la RUN, y aquí se recarga a propósito.
   2 · VIAJAR EN EL ARCHIVO. Las estadísticas viven dentro de `meta`,
       que es lo que exporta e importa el guardado. Si se hubieran
       puesto aparte, se perderían al cambiar de navegador.
   3 · UN PORCENTAJE QUE PUEDE LLEGAR A 100. Solo cuenta objetivos
       finitos; uno sobre "cartas coleccionadas" nunca se completa.

   Uso:  node check-record.mjs
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
writeFileSync("./out/_rec.mjs", html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]);
console.warn = () => {};
await import("./out/_rec.mjs");
await new Promise(r => setTimeout(r, 400));

let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t,d="") => { fallos++; console.log("  ✗ " + t + (d ? "   " + d : "")); };
console.log("\n═══ EL HISTORIAL DEL DUELISTA ═══\n");

const $ = id => document.getElementById(id);
function todos(n, out=[]){ if(!n) return out; out.push(n);
  for(const h of (n.children ?? [])) todos(h, out); return out; }
const conClase = (r,c) => todos(r).filter(x => x.classList?.contains?.(c));
const botones = r => todos(r).filter(x => x.tagName === "button");
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

/* ── 1 · SE APUNTA LO QUE PASA ── */
{
  mem.clear();
  const antes = H.record?.() ?? null;
  if(!antes) { mal("hay historial desde el principio"); }
  else {
    H.empezar({ semilla:"REC-1", personaje:"joey" });
    const r1 = H.record();
    if(r1.runs !== 1) mal("empezar una aventura se apunta", `runs = ${r1.runs}`);
    else if((r1.porPersonaje?.joey?.runs ?? 0) !== 1)
      mal("y se apunta con QUIÉN", JSON.stringify(r1.porPersonaje));
    else ok("empezar una aventura se apunta, y con quién");

    /* Un duelo ganado y otro perdido. */
    let duelos = 0;
    for(const gana of [true, false]){
      const ops = H.opciones();
      const n = ops.find(x => ["DUELO","ELITE","JEFE"].includes(x.tipo)) ?? ops[0];
      const c = H.entrar(n.id);
      if(["DUELO","ELITE","JEFE"].includes(c.tipo)){
        H.resolverDuelo({ ganado:gana, rivalId:c.rival?.id, elite:c.tipo==="ELITE" });
        duelos++;
      } else H.saltarNodo();
    }
    const r2 = H.record();
    if(r2.duelos < duelos) mal("los duelos se apuntan", `${r2.duelos} de ${duelos}`);
    else ok(`los duelos se apuntan (${r2.duelos} jugados, ${r2.victorias} ganados)`);
    if(!(r2.chips > 0)) mal("y las Star Chips ganadas también", `${r2.chips}`);
    else ok(`y las Star Chips ganadas también (${r2.chips})`);
  }
}

/* ── 2 · RECARGAR NO VUELVE A CONTAR ──
   El bug que ya tuvo la maestría, aquí desde el primer día. */
{
  const antes = H.record().runs;
  H.continuar?.();
  H.continuar?.();
  const después = H.record().runs;
  if(después !== antes) mal("recargar no vuelve a contar la aventura", `${antes} → ${después}`);
  else ok(`recargar no vuelve a contar la aventura (${después})`);
}

/* ── 3 · SOBRES Y ENCUENTROS ── */
{
  const antesS = H.record().sobres, antesE = H.record().encuentros;
  H.abrirPack("ARCANE");
  const EV = JSON.parse(readFileSync("../data/story/eventos.json","utf-8"));
  H.elegirEnEvento(EV[0].opciones[0]);
  const r = H.record();
  if(r.sobres <= antesS) mal("abrir un sobre se apunta");
  else if(r.encuentros <= antesE) mal("y resolver un encuentro también");
  else ok(`sobres y encuentros se apuntan (${r.sobres} sobres, ${r.encuentros} encuentros)`);
}

/* ── 4 · GANAR EL TORNEO CUENTA UNA VEZ, Y DA LOGRO ── */
{
  mem.clear();
  H.empezar({ semilla:"REC-GANA", personaje:"mai" });
  /* Se le lleva hasta Pegasus ganándolo todo. */
  for(let i = 0; i < 80 && !H.estado().terminada; i++){
    const ops = H.opciones(); if(!ops.length) break;
    const c = H.entrar(ops[0].id);
    if(["DUELO","ELITE","JEFE"].includes(c.tipo))
      H.resolverDuelo({ ganado:true, rivalId:c.rival?.id, elite:c.tipo==="ELITE" });
    else if(c.tipo === "PREPARACION"){ H.elegirPreparacion("PACK"); H.abrirPack("ARCANE"); }
    else if(c.tipo === "PACK") H.abrirPack("ARCANE");
    else if(c.tipo === "CAMPAMENTO"){ if(!H.acampar("lp")?.ok) H.saltarNodo(); }
    else if(c.tipo === "EVENTO") H.elegirEnEvento(c.evento.opciones[0]);
    else H.saltarNodo();
  }
  const r = H.record();
  if(!H.estado().ganada) mal("se llega a ganar el torneo en la simulación");
  else if(r.completadas !== 1) mal("ganar el torneo cuenta UNA vez", `${r.completadas}`);
  else if((r.porPersonaje?.mai?.victorias ?? 0) !== 1)
    mal("y se apunta a nombre del duelista");
  else if(!r.logros?.["primer-torneo"])
    mal("y da el logro de campeón", JSON.stringify(r.logros));
  else ok(`ganar el torneo cuenta una vez y da el logro (completadas ${r.completadas})`);

  /* Y recargar la pantalla de victoria no vuelve a sumar. */
  const c1 = r.completadas;
  H.continuar?.();
  if(H.record().completadas !== c1)
    mal("recargar en la victoria no vuelve a sumar", `${c1} → ${H.record().completadas}`);
  else ok("recargar en la victoria no vuelve a sumar");

  /* "Sin una sola derrota": la run se ganó sin perder nada. */
  if(!r.logros?.sinPerder) mal("y el logro de ganar sin perder ni un duelo");
  else ok("y el logro de ganar sin perder ni un duelo");
}

/* ── 5 · VIAJA EN EL ARCHIVO DE PROGRESO ── */
{
  const antes = JSON.stringify(H.record());
  const archivo = H.exportar();
  if(!archivo) mal("se puede exportar");
  else {
    mem.clear();
    if((H.record()?.completadas ?? 0) !== 0) mal("el navegador nuevo empieza sin historial");
    const r = H.importar(archivo);
    if(!r?.ok) mal("el archivo se importa", r?.error);
    else if(JSON.stringify(H.record()) !== antes)
      mal("y el historial vuelve entero", "algo se ha perdido por el camino");
    else ok("el historial viaja en el archivo de Exportar progreso y vuelve entero");
  }
}

/* ── 6 · EL PORCENTAJE PUEDE LLEGAR A 100 ── */
{
  const comp = H.completado?.();
  if(!comp) mal("hay porcentaje de completado");
  else if(!(comp.total > 0)) mal("y cuenta objetivos", JSON.stringify(comp));
  else if(comp.pct < 0 || comp.pct > 100) mal("y está entre 0 y 100", `${comp.pct}`);
  else if(comp.metas.some(m => typeof m.hecho !== "boolean"))
    mal("y todos los objetivos son sí o no (finitos)");
  else ok(`${comp.pct}% de completado sobre ${comp.total} objetivos finitos`);
}

/* ── 7 · Y LA PANTALLA SE ABRE Y ENSEÑA LOS NÚMEROS ── */
{
  mem.clear();
  $("irReino").onclick?.();
  const b = botones(reino).find(x => texto(x) === "Historial del duelista");
  if(!b) mal("hay un botón para abrirlo en la pantalla de inicio");
  else {
    b.onclick?.();
    if(!conClase(reino,"rRecord").length) mal("y abre la pantalla");
    else if(!conClase(reino,"rTablaFila").length) mal("con sus tablas");
    else if(!conClase(reino,"rLogro").length) mal("y sus logros");
    else ok(`la pantalla se abre con ${conClase(reino,"rTablaFila").length} filas`
            + ` y ${conClase(reino,"rLogro").length} logros`);
    const salida = botones(reino).some(x => /volver/i.test(texto(x)));
    if(!salida) mal("y tiene salida");
    else ok("y tiene salida");
  }
}

console.log(`\n${fallos ? "FALLA: " + fallos : "Todo correcto"}`);
process.exit(fallos ? 1 : 0);
