/* ══════════════════════════════════════════════════════════════════
   CAMPAMENTO Y MERCADER: UNA SOLA ACCIÓN

   El mercader NO marcaba el nodo como resuelto al comerciar. Podías
   hacer un trueque, volver al mapa, entrar otra vez y seguir cambiando
   cartas hasta vaciar el binder. Barra libre en un nodo que está
   pensado como decisión de una sola vez.

   El campamento tenía media versión del mismo agujero: marcaba resuelto
   salvo al refinar, y refinar tiene dos pasos —qué sacrificas, qué te
   llevas—. Volver atrás entre los dos dejaba el nodo sin gastar con la
   carta ya perdida.

   La regla, para los dos: entrar no consume nada; cancelar tampoco; una
   acción VÁLIDA consume el nodo y ya no se puede repetir ni volviendo,
   ni recargando, ni con Continuar.

   Uso:  node check-utilidades.mjs
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
writeFileSync("./out/_uti.mjs", html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]);
console.warn = () => {};
await import("./out/_uti.mjs");
await new Promise(r => setTimeout(r, 400));

let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t,d="") => { fallos++; console.log("  ✗ " + t + (d ? "   " + d : "")); };
console.log("\n═══ CAMPAMENTO Y MERCADER: UNA SOLA ACCIÓN ═══\n");

const $ = id => document.getElementById(id);
$("irReino").onclick?.();
const R = globalThis.__REINO_PRUEBA__;
if(!R){ mal("el gancho de prueba del Reino existe"); process.exit(1); }
const H = R.H;

/* Lleva la run hasta el primer nodo del tipo pedido y entra en él. */
function llegarA(tipo, semilla){
  mem.clear();
  H.empezar({ semilla, personaje:"yugi" });
  for(let i = 0; i < 60; i++){
    const ops = H.opciones();
    if(!ops.length) return null;
    const objetivo = ops.find(n => n.tipo === tipo);
    if(objetivo) return H.entrar(objetivo.id);
    const c = H.entrar(ops[0].id);
    if(["DUELO","ELITE","JEFE"].includes(c.tipo))
      H.resolverDuelo({ ganado:true, rivalId:c.rival?.id, elite:c.tipo === "ELITE" });
    else if(c.tipo === "PREPARACION"){ H.elegirPreparacion("PACK"); H.abrirPack("ARCANE"); }
    else if(c.tipo === "PACK") H.abrirPack("ARCANE");
    else if(c.tipo === "EVENTO") H.elegirEnEvento(c.evento.opciones[0]);
    else H.saltarNodo();
  }
  return null;
}
const nodoAhora = () => H.nodoActual();

/* ══ 1 · EL CAMPAMENTO ══ */
{
  let probado = false;
  for(const s of ["CAMP-1","CAMP-2","CAMP-3","CAMP-4","CAMP-5","CAMP-6"]){
    const c = llegarA("CAMPAMENTO", s);
    if(!c) continue;
    /* Entrar NO consume. */
    if(nodoAhora()?.resuelto){ mal("entrar en el campamento no lo consume"); break; }

    /* Volver al mapa sin elegir tampoco. */
    R.alMapa();
    if(nodoAhora()?.resuelto){ mal("volver al mapa sin acampar no consume el nodo"); break; }

    /* Una acción válida sí. Se coge la que el propio nodo ofrece: dar
       por hecho que existe "lp" es cómo el test se quedaba sin probar
       nada y aun así parecía que funcionaba. */
    const posibles = (c.opciones ?? []).filter(o => o.puede !== false);
    if(!posibles.length) continue;
    const cual = posibles.find(o => o.id !== "refinar") ?? posibles[0];
    const r = H.acampar(cual.id, cual.id === "refinar" ? { carta:H.run.binder[0] } : undefined);
    if(!r?.ok) continue;                       // ese buff ya lo tenía: se prueba otra semilla
    probado = true;
    if(!nodoAhora()?.resuelto){ mal("acampar consume el nodo"); break; }
    ok(`entrar y volver no consume el campamento; «${cual.id}» sí`);

    /* Y ya no se puede repetir, ni volviendo ni recargando. */
    const lp1 = H.run.buffs.lpExtra, turnos1 = H.run.buffs.duelosBuff;
    const otra = H.acampar(cual.id);
    if(otra?.ok) mal("no se puede acampar dos veces en el mismo nodo");
    else ok(`repetir se rechaza: «${otra?.motivo}»`);

    /* Recargar: otra sesión leyendo el mismo guardado. */
    H.continuar?.();
    const tras = H.acampar(cual.id);
    if(tras?.ok) mal("recargar no reabre el campamento");
    else if(H.run.buffs.lpExtra !== lp1 || H.run.buffs.duelosBuff !== turnos1)
      mal("y el buff sigue siendo el mismo tras recargar");
    else ok("tras recargar sigue consumido y el buff no se ha duplicado");
    break;
  }
  if(!probado) mal("se ha llegado a un campamento utilizable en seis semillas");
}

/* ══ 2 · EL MERCADER ══ */
{
  let probado = false;
  for(const s of ["MERC-1","MERC-2","MERC-3","MERC-4","MERC-5","MERC-6","MERC-7","MERC-8"]){
    const c = llegarA("MERCADER", s);
    if(!c) continue;
    if(nodoAhora()?.resuelto){ mal("entrar en el mercader no lo consume"); break; }
    R.alMapa();
    if(nodoAhora()?.resuelto){ mal("volver al mapa sin comerciar no consume el nodo"); break; }

    const recetas = (c.recetas ?? []).filter(r => r.puede);
    if(!recetas.length){
      /* Sin materiales no se consume: eso también hay que comprobarlo. */
      const nada = H.comerciar(c.recetas?.[0]?.id ?? "x");
      if(nada?.ok) { mal("sin materiales no se puede comerciar"); break; }
      if(nodoAhora()?.resuelto){ mal("un trueque imposible no consume el nodo"); break; }
      continue;
    }
    const oferta = H.ofertaDe(recetas[0].id);
    const r = H.comerciar(recetas[0].id, oferta?.[0]);
    if(r?.ok === false) continue;
    probado = true;
    if(!nodoAhora()?.resuelto){ mal("un trueque válido consume el nodo"); break; }
    ok("entrar y volver no consume el mercader; un trueque sí");

    const binder1 = H.run.binder.length;
    const otra = H.comerciar(recetas[0].id, oferta?.[0]);
    if(otra?.ok) mal("no se puede comerciar dos veces en el mismo nodo");
    else ok(`repetir se rechaza: «${otra?.motivo}»`);

    H.continuar?.();
    const tras = H.comerciar(recetas[0].id, oferta?.[0]);
    if(tras?.ok) mal("recargar no reabre el mercader");
    else if(H.run.binder.length !== binder1)
      mal("y el binder no cambia tras recargar", `${binder1} → ${H.run.binder.length}`);
    else ok("tras recargar sigue consumido y el binder no ha cambiado");
    break;
  }
  if(!probado) mal("se ha llegado a un mercader con materiales en ocho semillas");
}

console.log(`\n${fallos ? "FALLA: " + fallos : "Todo correcto"}`);
process.exit(fallos ? 1 : 0);
