/* ══════════════════════════════════════════════════════════════════
   QUE EL JUEGO EN INGLÉS ESTÉ EN INGLÉS

   `check-idioma.mjs` comprueba el MECANISMO: que el puente `__T` esté
   bien escrito, que nadie tape la función, que las claves existan. Esto
   es lo otro: poner el juego en inglés, RECORRER las pantallas del
   Reino y LEER lo que sale. Es la diferencia entre "la traducción
   funciona" y "no queda español en pantalla".

   Hacía falta porque los tres agujeros que reportó E no los veía
   ninguna comprobación estática:

     · `ev.quien` —quién te habla en un encuentro— se pintaba sin pasar
       por T(), así que "Cazador de Raras" salía en español aunque la
       clave existiera.
     · cuatro avisos (`aviso = "..."`) se escribían en crudo.
     · el mercader arma el motivo con el número dentro —"tienes 4 de las
       10 que pide"— y una tabla de frases exactas no puede cubrir eso:
       necesita una regla con expresión regular.

   Los dos primeros son "se me olvidó envolverlo" y el tercero es un
   fallo de concepto. Los tres se ven igual desde fuera: español dentro
   de una partida en inglés.

   Cómo funciona: se abre el HTML REAL con `idioma:"en"` guardado, se
   recorre una run entera pintando cada tipo de nodo, se abren las
   pantallas sueltas con `__REINO_PRUEBA__.irA` y se lee el texto de
   cada hoja del DOM buscando español.

   Uso:  node check-ingles.mjs          resume
         node check-ingles.mjs -v       enseña también dónde estaba
   ══════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { installDOM } from "./domstub.mjs";

globalThis.GOAT_SEED = 20050401;
installDOM();
globalThis.matchMedia = q => ({ matches:false, media:q, addListener(){}, removeListener(){} });
globalThis.innerWidth = 1280;

const mem = new Map();
global.localStorage = {
  getItem: k => k === "goatConfig" ? '{"idioma":"en"}' : (mem.get(k) ?? null),
  setItem: (k,v) => mem.set(k,v), removeItem: k => mem.delete(k),
};
const html = readFileSync("./out/goat.html","utf-8");
writeFileSync("./out/_ing.mjs", html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]);
console.warn = () => {};
await import("./out/_ing.mjs");
await new Promise(r => setTimeout(r, 400));

const verboso = process.argv.includes("-v");
let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t,d="") => { fallos++; console.log("  ✗ " + t + (d ? "   " + d : "")); };
console.log("\n═══ EL JUEGO EN INGLÉS ═══\n");

document.getElementById("irReino").onclick?.();
const R = globalThis.__REINO_PRUEBA__;
if(!R){ mal("el gancho de prueba del Reino existe"); process.exit(1); }
const H = R.H;

function todos(n, out=[]){ if(!n) return out; out.push(n);
  for(const h of (n.children ?? [])) todos(h, out); return out; }

/* ══ QUÉ CUENTA COMO ESPAÑOL ══
   Palabras que en inglés no existen o no aparecen sueltas. Se evitan a
   propósito las que son iguales en los dos idiomas ("no", "final",
   "total", "control"), porque un falso positivo hace que la
   comprobación se deje de mirar. Los nombres de carta van en inglés y
   no se tocan. */
const PISTAS = /[áéíóúñ¿¡]|(^|[\s(«"'])(el|la|los|las|una|unos|unas|que|con|para|sin|tu|tus|de|del|por|te|le|les|un|hay|al|es|son|está|están|esta|este|estas|estos|todo|toda|todos|todas|cada|pulsa|elige|elegir|volver|ver|carta|cartas|mazo|mazos|sobre|sobres|duelo|duelos|ficha|fichas|puedes|tienes|faltan|necesitas|ya|aún|todavía|antes|después|nada|algo|otra|otro|más|menos|mismo|misma|jugar|ganar|perder|empezar)([\s).,:;!?»"']|$)/i;

/* Lo que sí puede salir en español aunque el juego esté en inglés. */
const PERDONADAS = [
  /^[A-Z][a-z]+(?:'s)? /,               // nombres de carta que empiezan igual
];

function sospechosas(){
  const vistas = new Map();          // texto → dónde
  const raiz = document.getElementById("reino");
  for(const n of todos(raiz)){
    const hijos = n.children ?? [];
    if(!hijos.length){
      const t = String(n.textContent ?? "").trim();
      if(t.length > 2 && t.length < 240 && PISTAS.test(t)
         && !PERDONADAS.some(r => r.test(t)) && !vistas.has(t))
        vistas.set(t, n.className || n.tagName);
    }
    for(const a of ["title","placeholder","aria-label","data-fase","data-etiqueta"]){
      const v = n.getAttribute?.(a);
      if(v && v.length > 2 && PISTAS.test(v) && !vistas.has(`[${a}] ${v}`))
        vistas.set(`[${a}] ${v}`, n.className || n.tagName);
    }
  }
  return vistas;
}

const encontradas = new Map();
let pantallas = 0;
function mirar(donde){
  pantallas++;
  for(const [t, cl] of sospechosas())
    if(!encontradas.has(t)) encontradas.set(t, `${donde} · .${cl}`);
}

/* ══ 0 · TODA LLAMADA A T() TIENE QUE TENER SU ENTRADA ══
   El recorrido de abajo lee lo que sale en pantalla y busca español, y
   eso deja un hueco: una palabra corta, en mayúsculas, sin acentos y
   sin artículos no la ve ningún detector de idioma. La chapa «JEFE» del
   mapa estuvo así hasta que la vio E — con `check-idioma` en 21/21 y
   este recorrido en verde.

   Esto es lo contrario: no mira el resultado, mira el código. Coge cada
   `T("…")` literal del bundle y exige que la tabla le dé algo distinto.
   Entre las dos no queda hueco. */
{
  /* Se leen las FUENTES, no el bundle: dentro del HTML va el pegamento
     de emscripten, que tiene sus propias funciones de una letra y
     colaba "stdin", "stdout" y "urandom" como si fueran texto de la
     interfaz sin traducir. */
  const FUENTES = ["src/main.js", "src/view.js", "src/trivial.js",
    ...["ui","historia","record","estado","recompensas","utilidad","coleccion"]
        .map(f => `src/story/${f}.js`)];
  const codigo = FUENTES.filter(f => existsSync(f))
    .map(f => readFileSync(f, "utf-8")).join("\n");
  const traducir = globalThis.__T;
  const sueltas = new Set(); let miradas = 0;
  /* Y la plantilla (el menú, el torneo, la sala: `__T_("…")` y los
     botones que se traducen solos) y el deck builder, si está al lado.
     Fase 4: el deck builder tenía «Importar .ydk» y «Vaciar» sin entrada
     y ninguna comprobación miraba su código. */
  const plantilla = existsSync("src/template.html") ? readFileSync("src/template.html", "utf-8") : "";
  const builder = existsSync("../deckbuilder/app.js") ? readFileSync("../deckbuilder/app.js", "utf-8") : "";
  const literales = [
    ...codigo.matchAll(/\bT\(\s*"((?:[^"\\]|\\.)+)"/g),
    ...plantilla.matchAll(/\b(?:__T_|botonTorneo|boton|nota)\(\s*"((?:[^"\\]|\\.)+)"/g),
    ...builder.matchAll(/\bT\(\s*"((?:[^"\\]|\\.)+)"/g),
    /* Lo que se traduce DENTRO de la función que lo pinta: el título, la
       nota y cada `label` de un panel, los avisos, los carteles y las
       cajas de confirmar / elegir. */
    ...codigo.matchAll(/\b(?:V\.toast|V\.banner|V\.confirmar|V\.elegir|panel|toast|banner|confirmar)\(\s*"((?:[^"\\]|\\.)+)"/g),
    ...codigo.matchAll(/\blabel\s*:\s*"((?:[^"\\]|\\.)+)"/g),
  ];
  for(const m of literales){
    const clave = m[1].replace(/\\"/g, '"').replace(/\\n/g, "\n");
    /* Lo que ya está en inglés, un número o un símbolo no necesita
       entrada: se descarta lo que no lleve ni una letra minúscula
       española ni una palabra que solo exista en español. */
    if(!/[a-záéíóúñA-ZÁÉÍÓÚÑ]/.test(clave)) continue;
    /* Un trozo que se completa con `+` (la frase entera la cubre una regla). */
    if(/[(:]\s*$/.test(clave)) continue;
    miradas++;
    if(traducir?.(clave) !== clave) continue;          // tiene traducción
    sueltas.add(clave);
  }
  /* Nombres propios y cosas que se escriben igual en los dos idiomas. */
  const IGUALES = /^(Goat Format|Deck Builder|Extra|Main Phase|Battle Phase|Pegasus|Yugi|Joey|Mai|Kaiba|Bandit Keith|Binder|Star Chips|ELITE|OK|VS|LP|ATK|DEF|Final|Side deck|Main deck|Pts|Matches|Top 16|No|→ Battle Phase|→ Main Phase 2)$/i;
  const malas = [...sueltas].filter(k => !IGUALES.test(k));
  if(malas.length){
    mal(`${malas.length} llamada(s) a T() sin entrada en la tabla`);
    for(const k of malas.slice(0, 12)) console.log("      · " + JSON.stringify(k));
    if(malas.length > 12) console.log(`      … y ${malas.length-12} más`);
  } else ok(`las ${miradas} llamadas a T() del código tienen traducción`);
}

/* ── 1 · LA PANTALLA DE INICIO ── */
mirar("inicio");

/* ── 2 · UNA RUN ENTERA, PINTANDO CADA TIPO DE NODO ── */
H.empezar({ semilla:"ING", personaje:"yugi" });
R.alMapa(); mirar("mapa");

const vistos = new Set();
for(let i = 0; i < 70 && !H.estado().terminada; i++){
  const ops = H.opciones(); if(!ops.length) break;
  const c = R.entrar(ops[0].id);
  if(!vistos.has(c.tipo)){ vistos.add(c.tipo); mirar("nodo " + c.tipo); }

  if(["DUELO","ELITE","JEFE"].includes(c.tipo))
    H.resolverDuelo({ ganado:true, rivalId:c.rival?.id, elite:c.tipo === "ELITE" });
  else if(c.tipo === "PREPARACION"){ H.elegirPreparacion("PACK"); R.abrirPack("ARCANE"); mirar("sobre abierto"); }
  else if(c.tipo === "PACK"){ R.abrirPack("ARCANE"); mirar("sobre abierto"); }
  else if(c.tipo === "CAMPAMENTO"){ if(!H.acampar("lp")?.ok) H.saltarNodo(); }
  else if(c.tipo === "EVENTO"){
    mirar("encuentro " + (c.evento?.id ?? ""));
    H.elegirEnEvento(c.evento.opciones[0]);
    R.pintar(); mirar("resultado del encuentro");
  }
  else H.saltarNodo();

  /* A mitad de run: las pantallas que solo tienen sentido con cartas
     dentro. Con la run terminada, el binder sale vacío y no se mira
     nada — que fue justo lo que pasó la primera vez. */
  if(i === 8){
    for(const v of ["binder","sobres","record"]){ R.irA(v); mirar("pantalla " + v); }
    R.alMapa();
  }
}

/* ── 3 · LAS PANTALLAS DE FINAL ── */
{ R.irA("fin"); mirar("final de la aventura"); }

/* ── 4 · Y LAS QUE NO SALEN SOLAS ──
   El mercader con TODAS sus recetas bloqueadas: sus motivos llevan
   números dentro y son los que no cubre una tabla de frases exactas. */
{
  mem.clear();
  H.empezar({ semilla:"ING-2", personaje:"joey" });
  for(let i = 0; i < 40; i++){
    const ops = H.opciones(); if(!ops.length) break;
    const c = R.entrar(ops[0].id);
    if(c.tipo === "MERCADER"){ mirar("el mercader"); break; }
    if(["DUELO","ELITE","JEFE"].includes(c.tipo))
      H.resolverDuelo({ ganado:true, rivalId:c.rival?.id, elite:c.tipo === "ELITE" });
    else if(c.tipo === "PACK") H.abrirPack("ARCANE");
    else if(c.tipo === "EVENTO") H.elegirEnEvento(c.evento.opciones[0]);
    else if(c.tipo === "CAMPAMENTO"){ mirar("el campamento"); if(!H.acampar("lp")?.ok) H.saltarNodo(); }
    else H.saltarNodo();
  }
}

/* ── 5 · LOS OCHO ENCUENTROS, CON SUS DIECISÉIS OPCIONES ──
   Los textos viven en eventos.json y están escritos en español: si a
   uno le falta su entrada, se ve entero en español. */
{
  const EV = JSON.parse(readFileSync("../data/story/eventos.json","utf-8"));
  for(const ev of EV){ R.mostrarEvento(ev); mirar("encuentro " + ev.id); }
}

/* ── INFORME ── */
console.log(`  ${pantallas} pantallas recorridas con el juego en inglés`);
if(!encontradas.size)
  ok("no queda una sola línea en español en las pantallas del Reino");
else {
  mal(`${encontradas.size} texto(s) siguen en español`);
  for(const [t, donde] of encontradas)
    console.log(`      · ${JSON.stringify(t)}${verboso ? "   (" + donde + ")" : ""}`);
  console.log("\n    Las tres causas posibles, por orden de frecuencia:");
  console.log("      1 · se pinta sin envolver en T()");
  console.log("      2 · lleva un número dentro → necesita una regla en REGLAS, no una clave");
  console.log("      3 · la clave no está en la tabla EN de i18n.js");
}

console.log(`\n${fallos ? "FALLA: " + fallos : "Todo correcto"}`);
process.exit(fallos ? 1 : 0);
