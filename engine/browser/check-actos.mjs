/* ══════════════════════════════════════════════════════════════════
   UN ACTO «CERRADO» NO PUEDE TENER BOTONES QUE FUNCIONAN

   E ganó a Ghost Kaiba —el jefe del acto I— y el castillo seguía con la
   etiqueta CERRADO encima, pero sus peldaños ya se podían pulsar. La
   pantalla se contradecía a sí misma: la etiqueta decía una cosa y los
   botones hacían la contraria.

   La causa era de cálculo, no de estilo: el estado del acto salía de
   `run.pos.acto`, y `run.pos` sigue en el acto I hasta que PISAS un nodo
   del II. O sea que entre ganar al jefe y entrar al castillo había un
   hueco en el que el acto siguiente estaba disponible y rotulado como
   cerrado.

   Esta comprobación no mira el arreglo concreto: mira la CONTRADICCIÓN.
   Recorre una run entera y, en cada paso, exige que ningún acto marcado
   como cerrado tenga un botón pulsable. Cualquier forma futura de
   volver a desincronizar etiqueta y botones cae aquí.

   Uso:  node check-actos.mjs
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
writeFileSync("./out/_actos.mjs", html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]);
console.warn = () => {};
await import("./out/_actos.mjs");
await new Promise(r => setTimeout(r, 400));

let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t,d="") => { fallos++; console.log("  ✗ " + t + (d ? "   " + d : "")); };
console.log("\n═══ ETIQUETA DEL ACTO CONTRA SUS BOTONES ═══\n");

const $ = id => document.getElementById(id);
function todos(n, out=[]){ if(!n) return out; out.push(n);
  for(const h of (n.children ?? [])) todos(h, out); return out; }
const conClase = (r,c) => todos(r).filter(x => x.classList?.contains?.(c));
const botones  = r => todos(r).filter(x => x.tagName === "button");
const texto    = n => (n?.textContent ?? "").trim();

$("irReino").onclick?.();
const reino = $("reino");
botones(reino).find(b => texto(b).includes("Empezar"))?.onclick?.();

/* ── el examen que se repite en cada paso ── */
const ETIQUETAS = { ecompleto:"COMPLETO", eactual:"AQUÍ",
                    esiguiente:"TE ESPERA", ecerrado:"CERRADO" };
let pasos = 0, revisiones = 0, vistos = new Set(), incoherencias = [];
const niveles = [];

function revisarMapa(){
  const bloques = conClase(reino, "rActo");
  if(!bloques.length) return;
  revisiones++;
  for(const bloque of bloques){
    const estado = Object.keys(ETIQUETAS).find(c => bloque.classList.contains(c));
    if(!estado){ incoherencias.push("un acto sin estado ninguno"); continue; }
    vistos.add(estado);

    /* La etiqueta escrita tiene que ser la del estado. Si alguien añade
       un estado nuevo y se olvida del rótulo, sale aquí. */
    const rotulo = conClase(bloque, "rActoEstado").map(texto).find(Boolean) ?? "";
    if(rotulo && rotulo !== ETIQUETAS[estado])
      incoherencias.push(`el acto está en «${estado}» y el rótulo dice «${rotulo}»`);

    /* Y lo que motivó todo esto: cerrado quiere decir que no se puede ir. */
    if(estado === "ecerrado"){
      const vivos = botones(bloque).filter(b => b.disabled === false);
      if(vivos.length)
        incoherencias.push(`un acto CERRADO con ${vivos.length} botón(es) pulsables`
                           + ` — el primero: «${texto(vivos[0]).slice(0,40)}»`);
    }
  }
}

/* ── recorrer la run por su API, repintando el mapa en cada paso ──
   Se gana todo: es el camino que llega al castillo, que es donde estaba
   la contradicción. */
const R = globalThis.__REINO_PRUEBA__;
if(!R) { mal("el gancho de prueba del Reino existe"); }
else {
  const H = R.H;
  for(let i = 0; i < 80; i++){
    R.alMapa(); revisarMapa();
    const ops = H.opciones();
    if(!ops.length) break;
    const n = ops[0];
    const c = H.entrar(n.id);
    pasos++;
    if(["DUELO","ELITE","JEFE"].includes(c.tipo)){
      niveles.push([c.rival?.nombre ?? c.tipo, c.rival?.nivel ?? "(sin nivel)"]);
      const r = H.resolverDuelo({ ganado:true, rivalId:c.rival?.id, elite:c.tipo==="ELITE" });
      if(r.premio?.length) H.cogerPremio(r.premio[0].code);
      if(process.env.VER) console.log("PASO", i, c.tipo, c.rival?.nombre ?? "", "acto", n.acto);
    }
    else if(c.tipo === "PREPARACION"){ H.elegirPreparacion("PACK"); H.abrirPack("ARCANE"); }
    else if(c.tipo === "PACK") H.abrirPack("ARCANE");
    else if(c.tipo === "CAMPAMENTO"){ if(!H.acampar("lp")?.ok) H.saltarNodo(); }
    else if(c.tipo === "EVENTO") H.elegirEnEvento(c.evento.opciones[0]);
    else H.saltarNodo();
    if(H.estado().terminada) { R.alMapa(); revisarMapa(); break; }
  }
  R.alMapa();
}
revisarMapa();

if(!revisiones) mal("la pantalla del mapa llega a pintarse");
else if(incoherencias.length)
  mal(`etiqueta y botones concuerdan (${revisiones} revisiones)`,
      "\n      · " + [...new Set(incoherencias)].slice(0,4).join("\n      · "));
else ok(`ningún acto cerrado tiene botones vivos, y el rótulo cuadra con el estado`
        + ` (${revisiones} revisiones en ${pasos} pasos)`);

if(vistos.size < 2) mal("se llega a ver más de un estado de acto", [...vistos].join(", "));
else ok(`estados de acto vistos: ${[...vistos].map(v=>ETIQUETAS[v]).join(" · ")}`);

/* ══════════════════════════════════════════════════════════════════
   TODOS LOS RIVALES DEL REINO JUEGAN EN EXPERTO

   Los niveles bajos del simulador no son "juega un poco peor": llevan
   lastres puestos a propósito —`cadenaTonta` responde con lo primero que
   tenga, `combateTonto` ataca sin mirar, `malaSeleccion` descarta al
   azar—. En una aventura eso no se lee como un rival flojo, se lee como
   un juego roto: E lo reportó como monstruos suicidándose contra muros.
   La dificultad del Reino viene del MAZO del rival, no de apagarle el
   cerebro.

   `nivelDeIA()` ya devolvía siempre "experto", pero el nivel se perdía
   por el camino: la línea que lanza el duelo ponía
   `carga.rival?.nivel ?? "duro"`, así que a cualquier rival al que no le
   llegara el campo se le daba el cerebro lastrado en silencio.
   ══════════════════════════════════════════════════════════════════ */
{
  const flojos = niveles.filter(([,nv]) => nv !== "experto");
  if(!niveles.length) mal("se ha peleado con alguien durante el recorrido");
  else if(flojos.length)
    mal(`los ${niveles.length} rivales del recorrido juegan en experto`,
        flojos.map(([q,nv])=>`${q}: ${nv}`).join(" · "));
  else ok(`los ${niveles.length} rivales del recorrido juegan en experto`
          + ` (${niveles.slice(0,3).map(x=>x[0]).join(", ")}…)`);

  /* Y el respaldo de la línea que lanza el duelo, leído del HTML real:
     si vuelve a poner "duro", el bug vuelve entero. */
  const m = html.match(/nivel:\s*carga\.rival\?\.nivel\s*\?\?\s*"(\w+)"/);
  if(!m) mal("se encuentra el respaldo de nivel del lanzador de duelos");
  else if(m[1] !== "experto")
    mal("el respaldo de nivel es experto", `es «${m[1]}»`);
  else ok("y si a un rival no le llegara el nivel, cae en experto, no en duro");
}

/* ══════════════════════════════════════════════════════════════════
   «AL BINDER» TIENE QUE LLEVAR AL BINDER

   Ponía eso y llevaba al mapa. Es el botón que sale justo después de
   abrir un sobre, o sea el momento exacto en que quieres ver las diez
   cartas nuevas colocadas entre las que ya tenías.
   ══════════════════════════════════════════════════════════════════ */
if(R){
  const H = R.H;
  H.empezar({ semilla:"BINDER", personaje:"yugi" });
  R.abrirPack("ARCANE");
  /* OJO: `disabled` solo se pone a mano en los nodos del mapa; en el
     resto llega `undefined`, así que filtrar por `=== false` deja la
     lista vacía y el test daba un falso rojo. */
  const bs = botones(reino).filter(b => b.disabled !== true);
  const alBinder = bs.find(b => texto(b) === "Al binder");
  if(!alBinder) mal("tras abrir un sobre hay un botón «Al binder»",
                    bs.map(b=>texto(b).slice(0,18)).filter(Boolean).join(" | "));
  else {
    /* Se estrecha la ventana antes de pulsar: así la pantalla sale en
       modo pestañas y se puede comprobar CUÁL queda delante, que en
       escritorio (tres paneles a la vez) no se ve. */
    globalThis.innerWidth = 412;
    alBinder.onclick?.();
    if(R.vista !== "binder") mal("«Al binder» abre Mazo y binder", `abrió «${R.vista}»`);
    else {
      /* Y abierto POR el binder, no por el mazo. */
      const pestañaViva = conClase(reino,"rTab").find(b => b.classList.contains("on"));
      const titulo = conClase(reino,"rColTitulo").map(texto);
      const señal = texto(pestañaViva) || titulo.join(" ");
      if(pestañaViva && !/binder/i.test(texto(pestañaViva)))
        mal("«Al binder» deja el binder delante, no el mazo", `pestaña «${texto(pestañaViva)}»`);
      else ok(`«Al binder» abre Mazo y binder con el binder delante (${señal || "sin pestañas"})`);
    }
  }
}

console.log(`\n${fallos ? "FALLA: " + fallos : "Todo correcto"}`);
process.exit(fallos ? 1 : 0);
