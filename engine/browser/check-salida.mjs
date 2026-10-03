/* ══════════════════════════════════════════════════════════════════
   MIRAR EL TABLERO NO PUEDE DEJARTE ENCERRADO

   Al acabar un duelo sale la pantalla final, y en el Reino su botón
   principal es lo ÚNICO que resuelve el nodo y te devuelve al mapa con
   la ficha ganada. El tercer botón, «Ver el tablero», solo escondía esa
   pantalla — así que mirar el campo después de ganar te dejaba sin
   salida y sin el progreso del duelo. Lo reportó E.

   Esto se prueba PULSANDO los botones de verdad, no leyendo el código:
   el fallo estaba en que un botón hacía menos de lo que hacía falta, y
   eso desde el código se lee perfectamente bien.

   Uso:  node check-salida.mjs
   ══════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from "node:fs";
import { installDOM } from "./domstub.mjs";
globalThis.GOAT_SEED = 20050401; installDOM();
globalThis.matchMedia = q => ({ matches:false, media:q, addListener(){}, removeListener(){} });
globalThis.innerWidth = 1280;
const mem = new Map();
global.localStorage = {
  getItem: k => k === "goatConfig" ? '{"idioma":"es"}' : (mem.get(k) ?? null),
  setItem: (k,v) => mem.set(k,v), removeItem: k => mem.delete(k),
};
const html = readFileSync("./out/goat.html","utf-8");
writeFileSync("./out/_sal.mjs", html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]);
console.warn = () => {};
await import("./out/_sal.mjs");
await new Promise(r => setTimeout(r, 400));

let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t,d="") => { fallos++; console.log("  ✗ " + t + (d ? "   " + d : "")); };
console.log("\n═══ LA SALIDA DE LA PANTALLA FINAL ═══\n");

const final = globalThis.__FINAL_DE_PRUEBA__;
if(typeof final !== "function"){ mal("hay gancho para la pantalla final"); process.exit(1); }

function todos(n, o=[]){ if(!n) return o; o.push(n);
  for(const h of (n.children ?? [])) todos(h, o); return o; }
const texto = n => String(n?.textContent ?? "").trim();

/* Se monta la pantalla tal y como la monta el Reino: con `onNuevo`, que
   es lo que resuelve el nodo, y el botón principal diciendo «Continuar». */
let volvio = 0;
final({ ganaste:true, motivo:"", lpMio:8000, lpRival:0, turnos:12,
        nombreRival:"Weevil Underwood", textoNuevo:"Continuar",
        onNuevo: () => { volvio++; } });

const c = document.getElementById("fin");
const botones = todos(c).filter(x => x.tagName === "button");
if(botones.length < 3) mal("la pantalla final tiene sus tres botones", `hay ${botones.length}`);
else ok(`la pantalla final sale con sus ${botones.length} botones`);

/* ── 1 · EL CAMINO NORMAL SIGUE FUNCIONANDO ── */
{
  botones[0].onclick?.();
  if(volvio !== 1) mal("el botón principal vuelve al mapa");
  else ok("el botón principal vuelve al mapa y resuelve el nodo");
}

/* ── 2 · Y MIRAR EL TABLERO DEJA SALIDA ── */
{
  volvio = 0;
  final({ ganaste:true, motivo:"", lpMio:8000, lpRival:0, turnos:12,
          nombreRival:"Weevil Underwood", textoNuevo:"Continuar",
          onNuevo: () => { volvio++; } });
  const bs = todos(document.getElementById("fin")).filter(x => x.tagName === "button");
  const verTablero = bs.find(b => /tablero|board/i.test(texto(b)));
  if(!verTablero) mal("existe el botón de ver el tablero");
  else {
    verTablero.onclick?.();

    /* Lo que tiene que quedar: el rincón de fin de turno, vivo y
       diciendo «Continuar». */
    const z  = document.getElementById("controles");
    const bt = document.getElementById("btnFin");
    if(z?.style?.display !== "flex")
      mal("al mirar el tablero queda un botón para volver",
          "sin él, ganar y mirar el campo te deja encerrado y sin la ficha");
    else ok("al mirar el tablero queda el rincón de controles a la vista");

    const txt = texto(document.getElementById("btnFinTxt"));
    if(!/continuar|continue/i.test(txt))
      mal("y ese botón dice «Continuar», no «Terminar turno»", `dice «${txt}»`);
    else ok(`y ese botón dice «${txt}», no «Terminar turno»`);

    bt?.onclick?.();
    if(volvio !== 1) mal("y al pulsarlo se vuelve al mapa con el progreso");
    else ok("y al pulsarlo se vuelve al mapa con el progreso del duelo");
  }
}

/* ══════════════════════════════════════════════════════════════════
   3 · Y NO PUEDE SOBREVIVIR AL DUELO SIGUIENTE

   El mismo bug, un paso más allá y mucho peor: la pantalla de victoria
   seguía en pantalla mientras CARGABA el duelo siguiente, con sus
   botones vivos. Y `onNuevo` es el que resuelve el nodo y cobra la
   recompensa, así que pulsar «Continuar» en esa franja daba por ganado
   el duelo que acababa de empezar: te lo saltabas y te llevabas la
   ficha y la carta sin jugar una mano. Lo reportó E.

   Se comprueba lo único que importa: después de `cerrarFinal()` no
   puede quedar NINGÚN botón pulsable que resuelva el nodo anterior.
   ══════════════════════════════════════════════════════════════════ */
{
  volvio = 0;
  final({ ganaste:true, motivo:"", lpMio:8000, lpRival:0, turnos:12,
          nombreRival:"Weevil Underwood", textoNuevo:"Continuar",
          onNuevo: () => { volvio++; } });
  const antes = todos(document.getElementById("fin")).filter(x => x.tagName === "button");

  /* Lo que hace `boot()` nada más arrancar el duelo siguiente. */
  globalThis.__VIEW_DE_PRUEBA__?.cerrarFinal?.();

  const c2 = document.getElementById("fin");
  if(c2?.style?.display !== "none" || c2?.classList?.contains?.("visible"))
    mal("la pantalla final se esconde al empezar el duelo siguiente");
  else ok("la pantalla final se esconde al empezar el duelo siguiente");

  const quedan = todos(c2).filter(x => x.tagName === "button");
  if(quedan.length)
    mal("y no queda ni un botón del duelo anterior", `quedan ${quedan.length}`);
  else ok("y no queda ni un botón del duelo anterior");

  /* Aunque alguien conserve una referencia al botón viejo —que es justo
     lo que pasa con el dedo ya encima— pulsarlo no puede resolver nada. */
  for(const b of antes) b.onclick?.();
  if(volvio !== 0)
    mal("pulsar el botón viejo ya no resuelve el nodo",
        "esto es saltarse un duelo y cobrar la recompensa sin jugarlo");
  else ok("pulsar el botón viejo ya no resuelve el nodo");

  /* Y el rincón de «Continuar» tampoco puede quedarse puesto. */
  if(document.getElementById("controles")?.style?.display !== "none")
    mal("y el rincón de controles queda limpio para el duelo nuevo");
  else ok("y el rincón de controles queda limpio para el duelo nuevo");
}

console.log(`\n${fallos ? "FALLA: " + fallos : "Todo correcto"}`);
process.exit(fallos ? 1 : 0);
