import { readFileSync, writeFileSync } from "node:fs";
import { installDOM } from "./domstub.mjs";
/* Semilla fija y cazador de fugas encendido ANTES de cargar el juego:
   cada frase que pase por la traducción y no encuentre equivalente se
   apunta aquí. Es la única forma honesta de encontrar el español que se
   cuela —un usuario lo reportó dos veces— porque a ojo siempre queda
   alguna frase que solo aparece en una situación concreta. */
globalThis.GOAT_SEED = 20050401;
globalThis.__T_FUGAS__ = new Set();
installDOM();
/* Esta comprobación es la excepción: aquí SÍ queremos el idioma por
   defecto, que es el inglés con el que lo va a abrir la gente. */
global.localStorage={getItem:()=>null,setItem(){}};
const html=readFileSync("./out/goat.html","utf-8");
writeFileSync("./out/_i18n.mjs", html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]);
console.warn=()=>{};
await import("./out/_i18n.mjs");
await new Promise(r=>setTimeout(r,400));
const T = globalThis.__T;
const casos=["Rendirse","¿Quieres responder?","Damage Step","Cementerio","Invocar Sangan",
  "Cadena 2: Book of Moon","Turno 3 — Tú","Selecciona 1 carta(s)","¿Seguro que quieres rendirte?",
  "Se revela la mano del rival","VICTORIA","Novato","Terminar turno","TU TURNO",
  "12 de 80 retos superados","Cementerio tu — 4 carta(s)","Declaración de ataque"];
const pruebas=[];
const ok=(t,v,d)=>{ pruebas.push(!!v); console.log(v?"  ✓":"  ✗", t, d?`— ${d}`:""); };
console.log("═══ IDIOMAS ═══");
ok("arranca en inglés", (globalThis.__idioma?.())==="en");
let sinTraducir=[];
for(const c of casos){ const tr=T(c); if(tr===c && !/^(Damage Step)$/.test(c)) sinTraducir.push(c); }
ok("todas las frases de muestra se traducen", sinTraducir.length===0,
   sinTraducir.length?sinTraducir.join(" · "):`${casos.length} frases, incluidas las que llevan datos dentro`);
console.log("  ejemplos: "+casos.slice(0,4).map(c=>`${c} → ${T(c)}`).join(" · "));
globalThis.__setIdioma("es");
ok("en español el texto pasa tal cual", T("Rendirse")==="Rendirse" && T("Cadena 2: Book of Moon")==="Cadena 2: Book of Moon");
globalThis.__setIdioma("en");
const c2=[
 ["el módulo de idiomas va antes que el resto", /const I18N = \(\(\)=>\{/.test(html)],
 ["la vista y el orquestador lo usan", (html.match(/globalThis\.__T \? globalThis\.__T\(s\) : s/g)||[]).length>=2],
 ["se traduce lo que ya está escrito en el HTML", /__traducirDOM\?\.\(document\.getElementById\(id\)\)/.test(html)],
 ["hay selector de idioma en Opciones", /id="mIdioma"/.test(html) && /grupo\("mIdioma"/.test(html)],
 ["y se recuerda entre partidas", /idioma:"en"/.test(html)],
];
for(const [t,v] of c2) ok(t,v);
/* Los sitios donde se coló español pese a la traducción: se generan por
   JS DESPUÉS de traducir el HTML, así que tienen que pasar por T(). */
const db=readFileSync("../deckbuilder/deckbuilder.html","utf-8");
const c3=[
 ["el botón de cadenas se traduce", /bc\.textContent = T\(ETIQ_CAD/.test(html)],
 /* Ya no hay nivel que enseñar (siempre experto): el botón del reto sí se traduce. */
 ["el botón de cada reto sale del texto traducido", /b\.textContent=__T_\("Jugar"\)/.test(html)],
 ["los botones de turno se traducen al arrancar", /"controles","phases"/.test(html)],
 ["el deck builder usa la misma tabla", /const EN = \{/.test(db) && /__traducirDOM\?\.\(document\.body\)/.test(db)],
 ["y sus avisos pasan por la traducción", /function aviso\(t\)\{\s*t = T\(t\);/.test(db)],
];
for(const [t,v] of c3) ok(t,v);

/* ── LA BARRIDA: jugar de verdad y ver qué se cuela ──
   Se juega una partida completa en inglés respondiendo lo primero que
   ofrezca cada panel. Todo lo que pase por T() sin traducción queda
   apuntado. Se ignoran los nombres de carta (vienen en inglés de la base)
   y las frases sin una sola letra acentuada ni palabra española. */
{
  globalThis.__T_FUGAS__.clear();
  document.getElementById("mJugar")?.onclick?.();
  await new Promise(r=>setTimeout(r,2200));
  const p=document.getElementById("prompt");
  for(let i=0;i<220;i++){
    await new Promise(r=>setTimeout(r,45));
    if(p.style.display!=="block") continue;
    const caja=p.children[p.children.length-1];
    const btns=caja?.children ?? [];
    if(!btns.length) break;
    p.style.display="none";
    btns[0].onclick?.();
  }
  const ESPANOL = /[áéíóúñ¿¡]|\b(el|la|los|las|una|uno|del|que|para|con|sin|por|tu|tus|carta|cartas|mazo|turno|fase|mano|campo|rival|elige|elegir|activar|colocar|invocar|responder|ataque|defensa)\b/i;
  const fugas=[...globalThis.__T_FUGAS__].filter(s=>ESPANOL.test(s));
  ok("nada se queda en español jugando una partida entera",
     fugas.length===0,
     fugas.length ? fugas.slice(0,12).join(" · ")
                  : "de "+globalThis.__T_FUGAS__.size+" frases sin entrada en la tabla");

  /* Y el texto FIJO de los dos HTML: lo que está escrito en la plantilla y
     nadie pasó por la tabla. Así se encontraron los dos avisos del deck
     builder que llevaban desde el principio en español. */
  const claves = new Set();
  for(const k of readFileSync("./src/i18n.js","utf-8")
        .match(/const EN = \{([\s\S]*?)\n\};/)[1]
        .matchAll(/"((?:[^"\\]|\\.)+)"\s*:/g)) claves.add(k[1].replace(/\\"/g,'"'));
  const estatico = f => {
    const h = readFileSync(f,"utf-8"), v = new Set();
    for(const m of h.matchAll(/>([^<>{}]{3,80})</g)){
      const t = m[1].replace(/\s+/g," ").trim();
      if(!t || !ESPANOL.test(t) || claves.has(t)) continue;
      /* Trozos de código, no texto. Se añadieron `&&`, `||` y `.algo`
         porque una comparación como `a > b && c.left < d` cae justo entre
         un `>` y un `<` y se leía como una cadena en español sin
         traducir: un falso rojo que costó un rato entender. */
      if(/[=;{}()\[\]`$]/.test(t)) continue;
      if(/&&|\|\||\.\w+\s*[<>]|=>/.test(t)) continue;
      v.add(t);
    }
    return [...v];
  };
  for(const [f,quien] of [["./out/goat.html","el simulador"],
                          ["../deckbuilder/deckbuilder.html","el deck builder"]]){
    const v = estatico(f);
    ok(`el texto fijo de ${quien} está traducido`, v.length===0, v.slice(0,6).join(" · "));
  }

  /* EL QUE SE ESCAPÓ A TODO LO ANTERIOR. La etiqueta sobre la tira de
     fases ("DECLARACIÓN DE ATAQUE") se pinta con content:attr(data-sub)
     desde el CSS: no es un nodo de texto, así que ni la traducción del
     DOM ni la barrida de arriba la veían. Se traduce al escribir el
     atributo, y aquí se comprueba que sigue siendo así. */
  const js = readFileSync("./out/goat.html","utf-8")
               .match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  ok("el momento de la cadena se traduce antes de escribirlo en el data-*",
     /const txt = momentoActual \? T\(MOMENTOS\[momentoActual\]\)/.test(js));

  /* ══ EL PUENTE GLOBAL SE LLAMA `__T`, CON UN SOLO GUION BAJO ══
     El Reino pedía `__T_` y por eso TODAS sus llamadas a T() eran un
     no-op. No saltó ninguna alarma porque `traducirDOM` pasa después y
     arregla los nodos de texto sueltos; lo que no puede arreglar es
     nada compuesto, así que "Su mazo: de aficionado" y las frases de
     los duelistas se quedaban en español con el juego en inglés.
     Un puente mal escrito no da error: devuelve el texto tal cual. */
  const puentesMalos = [...js.matchAll(/globalThis\.__T[A-Za-z_]+/g)]
    .map(m => m[0])
    /* `__TELE__` es el contador de uso, no un puente de traducción: se
       parece por el prefijo y por nada más. */
    .filter(n => !["globalThis.__TFUGAS", "globalThis.__T_FUGAS__",
                   "globalThis.__TELE__"].includes(n))
    .filter(n => n !== "globalThis.__T");
  ok("nadie llama al puente de traducción por un nombre que no existe",
     puentesMalos.length === 0, [...new Set(puentesMalos)].join(" · "));
  ok("y el Reino lo usa bien", /const T = t => \(globalThis\.__T \?/.test(js));

  /* ══ UNA CLAVE REPETIDA CON DOS TRADUCCIONES GANA LA ÚLTIMA ══
     Y en silencio: JavaScript no se queja de una clave duplicada en un
     objeto literal. Traduciendo los mazos de salida metí por segunda vez
     los veinte starters, con la redacción ligeramente cambiada, y la
     tabla se quedó con veintiuna claves que decían dos cosas distintas
     según dónde mirases. Repetida y con el MISMO valor es solo ruido;
     repetida con otro valor es una traducción que alguien escribió y que
     nunca se usa. */
  const fuente = readFileSync("./src/i18n.js", "utf-8");
  const tabla = fuente.slice(fuente.indexOf("const EN = {"), fuente.indexOf("\n};"));
  const vistas = new Map(), chocan = [];
  for(const m of tabla.matchAll(/^\s{2}"((?:[^"\\]|\\.)+)":\s*\n?\s*"((?:[^"\\]|\\.)*)"/gm)){
    if(vistas.has(m[1]) && vistas.get(m[1]) !== m[2]) chocan.push(m[1]);
    vistas.set(m[1], m[2]);
  }
  ok(`ninguna clave de la tabla dice dos cosas distintas (${vistas.size} claves)`,
     chocan.length === 0, chocan.slice(0,4).map(k=>JSON.stringify(k)).join(" · "));
}

console.log(`\n${pruebas.filter(Boolean).length}/${pruebas.length}`);
process.exit(pruebas.every(Boolean) ? 0 : 1);
