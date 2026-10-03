/* Barrido de textos del DECK BUILDER (Fase 4), en inglés y en español.
   Uso: node barrer-builder.mjs [ruta al deckbuilder.html]   (solo contenedor) */
import { readFileSync } from "node:fs";
const { chromium } = await import("/home/claude/.npm-global/lib/node_modules/playwright/index.mjs");
const RUTA = process.argv[2] ?? "../deckbuilder/deckbuilder.html";
const src = readFileSync("./barrer-textos.mjs", "utf-8");
const ES = eval(src.match(/const ES = (\/.*\/i);/)[1]);
const EN = eval(src.match(/const EN = (\/.*\/i);/)[1]);
const EN_PERMITIDO = eval(src.match(/const EN_PERMITIDO = (\[.*\]);/)[1]);
const NOMBRES = Object.values(JSON.parse(readFileSync("./out/names.subset.json", "utf-8"))).map(n => n.name).filter(Boolean)
  .sort((a, b) => b.length - a.length);
const quitar = t => { let s = t; for(const n of NOMBRES) if(n.length > 3 && s.includes(n)) s = s.split(n).join(" "); return s; };
const leer = new Function("return (" + src.match(/function leer\(\)\{[\s\S]*?\n\}/)[0] + ")")();
const nav = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });
for(const [idioma, ancho] of [["en", 1280], ["es", 1280], ["en", 844]]){
  const ctx = await nav.newContext({ viewport:{ width:ancho, height: ancho < 900 ? 390 : 800 } });
  await ctx.addInitScript(l => { localStorage.setItem("goatConfig", JSON.stringify({ idioma:l })); globalThis.__T_FUGAS__ = new Set(); }, idioma);
  const p = await ctx.newPage();
  const errores = []; p.on("pageerror", e => errores.push(String(e)));
  await p.goto("file://" + new URL(RUTA, "file://" + process.cwd() + "/").pathname); await p.waitForTimeout(1200);
  const textos = new Map();
  const ap = async m => { for(const [t, d] of await p.evaluate(leer)) if(!textos.has(t)) textos.set(t, m + " · " + d); };
  await ap("inicio");
  await p.fill("#buscar", "dragon"); await p.waitForTimeout(400); await ap("buscar");
  for(const id of ["fTipo", "fAtr", "fNivel"]) await p.evaluate(i => { const s = document.getElementById(i); if(s && s.options.length > 1){ s.selectedIndex = 1; s.dispatchEvent(new Event("change")); } }, id);
  await p.waitForTimeout(300); await ap("filtros");
  await p.evaluate(() => { for(const id of ["fTipo", "fAtr", "fNivel"]){ const s = document.getElementById(id); if(s){ s.selectedIndex = 0; s.dispatchEvent(new Event("change")); } } });
  await p.fill("#buscar", ""); await p.waitForTimeout(300);
  /* Añadir unas cartas: al grid (clic) y ver avisos de límites y de 40. */
  await p.evaluate(() => { const c = [...document.querySelectorAll("#grid > *")].slice(0, 5); for(const x of c) for(let k = 0; k < 4; k++) x.click(); });
  await p.waitForTimeout(300); await ap("con cartas");
  await p.evaluate(() => document.getElementById("verMazo")?.click()); await p.waitForTimeout(200); await ap("ver mazo");
  /* Ficha de carta (como en el móvil). */
  await p.evaluate(() => { const c = document.querySelector("#grid > *"); c?.dispatchEvent(new MouseEvent("mouseover", { bubbles:true })); });
  await p.waitForTimeout(300); await ap("ficha");
  await p.evaluate(() => { document.getElementById("nombreMazo").value = "Prueba"; document.getElementById("btnGuardar").click(); });
  await p.waitForTimeout(300); await ap("guardado");
  const fugas = await p.evaluate(() => [...(globalThis.__T_FUGAS__ ?? [])]);
  const malos = [];
  for(const [t, d] of textos){
    if(/^[\d\s\-:./·()+%×✓✗→←▶▼★⛶…'"x]*$/.test(t)) continue;
    if(idioma === "en"){ if(ES.test(quitar(t))) malos.push([t, d]); }
    else { let s = quitar(t); for(const re of EN_PERMITIDO) s = s.replace(re, " "); if(EN.test(s)) malos.push([t, d]); }
  }
  console.log(`\n═══ DECK BUILDER · ${idioma} · ${ancho}px · ${textos.size} textos · ${malos.length} sospechosos ═══`);
  for(const [t, d] of malos) console.log(`  · ${t.slice(0, 140)}   [${d}]`);
  if(idioma === "en"){ const f = fugas.filter(t => ES.test(quitar(t))); if(f.length) console.log("  · por T() sin traducción: " + f.join(" | ")); }
  const ancho_ = await p.evaluate(() => ({ w: document.documentElement.scrollWidth, v: innerWidth }));
  if(ancho_.w > ancho_.v) console.log("  ✗ desborda en horizontal", JSON.stringify(ancho_));
  if(errores.length) console.log("  ERRORES JS: " + errores.join(" | "));
  await p.screenshot({ path:`/tmp/shots/builder-${idioma}-${ancho}.png` });
  await ctx.close();
}
await nav.close();
