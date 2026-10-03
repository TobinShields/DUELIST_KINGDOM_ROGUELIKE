/* ════════════════════════════════════════════════════════════════
   EL PANEL CON UNA CARTA TAPADA DEL RIVAL EN LA LISTA

   Reportado el 11 de agosto: al activar Thousand-Eyes Restrict, con un
   monstruo tapado del rival entre los objetivos, el juego se quedaba
   muerto con "T is not a function". La causa era de manual: dentro de
   `ask()` había un `const T = OcgMessageType` que tapaba la función de
   traducción del módulo, y la línea que oculta el nombre de las cartas
   boca abajo llamaba a `T("Carta boca abajo")`. Solo pasaba cuando en la
   lista había una tapada del rival, o sea casi nunca — hasta que le tocó
   a alguien jugando.

   Esta comprobación mete al HTML REAL en esa situación exacta: monta un
   duelo y le inyecta al bucle un SELECT_CARD con una tapada del rival,
   comprobando que el panel sale, que enseña "Carta boca abajo" en vez del
   nombre, y que no aparece la pantalla de "Se ha roto algo".
   ════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from "node:fs";
import { installDOM } from "./domstub.mjs";
globalThis.GOAT_SEED = 20050401;      // duelo reproducible
installDOM();
global.localStorage = { getItem:k=>k==="goatConfig"?'{"idioma":"es"}':null, setItem(){} };

const html = readFileSync("./out/goat.html","utf-8");
const js   = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
writeFileSync("./out/_tapadas.mjs", js);
console.warn = ()=>{};
await import("./out/_tapadas.mjs");
await new Promise(r=>setTimeout(r,300));
document.getElementById("mJugar").onclick?.();
await new Promise(r=>setTimeout(r,2500));

const pruebas = [];
const comprobar = (t,v,d="") => { pruebas.push([t,!!v]); console.log(v?"  ✓":"  ✗", t, d?`— ${d}`:""); };

console.log("═══ TAPADAS DEL RIVAL EN UNA LISTA ═══\n");

/* 1. LA COMPROBACIÓN ESTÁTICA que habría evitado el fallo: nadie puede
      volver a tapar la función de traducción con el enum de mensajes. */
/* Solo se mira `main.js`, que es el módulo donde vive la traducción: ahí
   `OCG` es el espacio de nombres del motor. Otros módulos (trivial.js) sí
   pueden llamar `T` a los tipos de mensaje, porque no traducen nada. */
comprobar("main.js no vuelve a tapar la traducción con el enum de mensajes",
  !/\bconst\s+T\s*=\s*OCG\.Ocg/.test(js),
  "un `const T = OCG.OcgMessageType` local tapa la función T()");
comprobar("la traducción se define como función",
  /const T *= *s *=>/.test(js));

/* 2. LA DE VERDAD: el panel real, con la lista real. */
const texto = el => String(el?.innerHTML ?? "").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
const prompt = document.getElementById("prompt");

// Un SELECT_CARD como el del reporte: una tapada del rival y una boca arriba.
const MT_SELECT_CARD = 15;
const msg = { type:MT_SELECT_CARD, player:0, can_cancel:false, min:1, max:1,
  selects:[ { code:39507162, controller:1, location:4, sequence:0, position:8 },   // tapada
            { code:70074904, controller:1, location:4, sequence:1, position:1 } ]};// boca arriba

let error = null;
const antes = console.error;
console.error = e => { error = e; };
globalThis.__PREGUNTA_DE_PRUEBA__?.(msg);
await new Promise(r=>setTimeout(r,400));
console.error = antes;

/* El texto del panel no está solo en innerHTML: los botones son hijos, y es
   ahí donde salen los nombres de las cartas. Leer solo el innerHTML daba
   una prueba que pasaba siempre sin mirar nada. */
const etiquetasBotones = el =>
  (el?.children ?? []).flatMap(h => [String(h.textContent ?? ""), ...etiquetasBotones(h)]);
const salida = [texto(prompt), ...etiquetasBotones(prompt)].join(" · ");
comprobar("el panel sale sin reventar", prompt.style.display==="block" && !error,
  error ? String(error.message ?? error) : salida.slice(0,60));
comprobar("no aparece la pantalla de 'Se ha roto algo'", !/roto/i.test(salida), salida.slice(0,60));
comprobar("la tapada del rival NO enseña su nombre",
  !/Blade Knight/i.test(salida), salida.slice(0,90));
comprobar("sale como carta boca abajo", /boca abajo|face-?down/i.test(salida), salida.slice(0,90));
comprobar("la que está boca arriba sí se lee", /D\.D\. Assailant/i.test(salida), salida.slice(0,90));

const ok = pruebas.filter(p=>p[1]).length;
console.log(`\n${ok}/${pruebas.length} comprobaciones pasan`);
process.exit(ok===pruebas.length ? 0 : 1);
