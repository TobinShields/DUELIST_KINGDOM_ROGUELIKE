/* ══════════════════════════════════════════════════════════════════
   REPORTAR EN GITHUB, EN CHROMIUM

   Un duelo libre de verdad (el bot juega por los dos), se pulsa
   «Reportar» en la barra y en la pantalla final, y se mira que:
     · salen las dos opciones (fallo / jugada rara de la IA);
     · se descarga el log y se abre GitHub con la plantilla buena;
     · el enlace lleva versión, modo, mazos, turno y últimas jugadas, y
       cada campo existe en la plantilla (publicar/.github/ISSUE_TEMPLATE);
     · el enlace no pasa de 8 KB (GitHub corta los más largos);
     · y no lleva nada oculto: ninguna carta de la mano del rival.
   Uso: node check-reporte-navegador.mjs   (solo en el contenedor)
   ══════════════════════════════════════════════════════════════════ */
import { readFileSync, existsSync } from "node:fs";
const PW = process.env.PLAYWRIGHT_MODULE ?? "/home/claude/.npm-global/lib/node_modules/playwright/index.mjs";
const { chromium } = await import(PW);
let fallos = 0;
const ok = t => console.log("  ✓ " + t), mal = (t, d = "") => { fallos++; console.log("  ✗ " + t + (d ? "   " + d : "")); };
const es = (c, t, d) => c ? ok(t) : mal(t, d);
console.log("\n═══ REPORTAR EN GITHUB ═══\n");

const nav = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });
const ctx = await nav.newContext({ viewport:{ width:1280, height:800 }, acceptDownloads:true });
await ctx.addInitScript(() => {
  localStorage.setItem("goatConfig", JSON.stringify({ idioma:"es" }));
  globalThis.GOAT_AUTOJUGAR = true; globalThis.GOAT_VELOCIDAD = 0.05; globalThis.GOAT_PENSAR = 0;
  globalThis.__ABIERTOS__ = [];
  globalThis.open = (u) => { globalThis.__ABIERTOS__.push(u); return null; };
});
const p = await ctx.newPage();
const errores = [];
p.on("pageerror", e => errores.push(String(e)));
let descargas = 0;
p.on("download", () => descargas++);
await p.goto("file://" + process.cwd() + "/out/goat.html");
await p.waitForTimeout(1500);
await p.evaluate(() => { document.getElementById("irJugar").click(); });
await p.waitForTimeout(300);
await p.evaluate(() => { document.getElementById("mJugar").click(); });
await p.waitForTimeout(9000);

/* ── en mitad del duelo, desde la barra ── */
await p.evaluate(() => document.getElementById("btnReportar").click());
const opciones = await p.evaluate(() => [...document.querySelectorAll("#confirm button")].map(b => b.textContent));
es(opciones.some(t => /Fallo del juego/i.test(t)) && opciones.some(t => /Jugada rara de la IA/i.test(t)),
   "«Reportar» ofrece fallo del juego y jugada rara de la IA", opciones.join(" | "));
await p.evaluate(() => document.getElementById("repIA").click());
await p.waitForTimeout(800);
const url = await p.evaluate(() => globalThis.__ABIERTOS__.at(-1) ?? "");
es(descargas >= 1, "se descarga el log del duelo");
es(url.startsWith("https://github.com/circlenline/DUELIST_KINGDOM_ROGUELIKE/issues/new?"), "y se abre el formulario de issues del repo", url.slice(0, 90));
const q = new URL(url).searchParams;
es(q.get("template") === "jugada-ia.yml" && /^\[IA\]/.test(q.get("title") ?? ""), "con la plantilla de jugada de la IA");
es(/duelo libre/.test(q.get("modo") ?? "") && / vs /.test(q.get("mazos") ?? "") && /^\d+$/.test(q.get("turno") ?? "")
   && /\d{4}-\d\d-\d\d/.test(q.get("version") ?? "") && (q.get("ultimas") ?? "").length > 20,
   "rellenado: modo, mazos, turno, versión y últimas jugadas", JSON.stringify(Object.fromEntries(q)).slice(0, 300));
es(url.length < 8000, `el enlace mide ${url.length} caracteres (GitHub corta los muy largos)`);

/* Nada oculto: van del resumen PÚBLICO del log, donde lo que coloca el
   rival nunca se nombra («IA · coloca una carta»). Los nombres de las
   cartas de su mano pueden salir solo si se vieron (activada, invocada,
   al cementerio, desterrada: otra copia, o tu propio mazo si es el mismo). */
const ult = q.get("ultimas") ?? "";
const nombradas = ult.split("\n").filter(l => /IA · coloca (?!una carta)/.test(l));
es(ult.includes("coloca") ? !nombradas.length : true, "las últimas jugadas no nombran lo que el rival colocó boca abajo", nombradas.join(" | "));
es(!/AVISO · DE AQUÍ ABAJO/.test(ult) && !/semilla/.test(ult), "ni llevan nada del registro crudo");

/* Los campos del enlace existen en las plantillas. */
const dir = "../../publicar/.github/ISSUE_TEMPLATE/", dir2 = "../publicar/.github/ISSUE_TEMPLATE/";
const base = existsSync(dir) ? dir : existsSync(dir2) ? dir2 : null;
if(!base) console.log("  · sin la carpeta publicar/.github aquí: no se miran las plantillas");
else for(const pl of ["fallo.yml", "jugada-ia.yml"]){
  const y = readFileSync(base + pl, "utf-8");
  const ids = [...y.matchAll(/^\s*id:\s*(\S+)/gm)].map(m => m[1]);
  const faltan = [...q.keys()].filter(k => !["template", "title"].includes(k) && !ids.includes(k));
  es(!faltan.length, `cada campo del enlace existe en ${pl}`, faltan.join(", "));
}

/* ── al acabar, desde la pantalla final ── */
await p.waitForFunction(() => getComputedStyle(document.getElementById("fin")).display === "flex", null, { timeout:240000 }).catch(() => {});
const finBtns = await p.evaluate(() => [...document.querySelectorAll("#fin .finBtn")].map(b => b.textContent));
es(finBtns.some(t => /Reportar/.test(t)), "la pantalla final también tiene «Reportar»", finBtns.join(" | "));
await p.evaluate(() => [...document.querySelectorAll("#fin .finBtn")].find(b => /Reportar/.test(b.textContent)).click());
await p.evaluate(() => document.getElementById("repFallo").click());
await p.waitForTimeout(500);
const url2 = await p.evaluate(() => globalThis.__ABIERTOS__.at(-1) ?? "");
es(new URL(url2).searchParams.get("template") === "fallo.yml", "y desde ahí, el de fallo abre la plantilla de fallos");
es(!errores.length, "sin errores de JavaScript", errores.join(" | ").slice(0, 300));
await nav.close();
console.log(`\n${fallos ? "FALLA: " + fallos : "Todo correcto"}`);
process.exit(fallos ? 1 : 0);
