/* ══════════════════════════════════════════════════════════════════
   BARRIDO DE TEXTOS EN CHROMIUM (Fase 4)

   Abre el HTML construido en un Chromium de verdad, en inglés y en
   español, y recorre: el menú y sus pantallas, un duelo libre entero con
   los paneles a la vista (`GOAT_AUTOJUGAR = "ver"`), la pantalla final,
   las cajas de rendirse y de reportar, el torneo suizo de la inscripción
   a la final (con el modo depuración para ir rápido) y una sala entre dos
   pestañas (con el side deck). De cada momento lee TODO el texto visible
   y los atributos que se leen sin verse (title, aria-label, placeholder,
   alt) y busca:
     · en inglés, palabras en español;
     · en español, palabras en inglés que no sean nombres de carta, de
       mazo o términos del juego que se dicen en inglés (Main Phase…).

   Uso: node barrer-textos.mjs [en|es|ambos=ambos] [-v]   (solo contenedor)
   ══════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "/home/claude/.npm-global/lib/node_modules/playwright/index.mjs");
const QUE = process.argv[2] && !process.argv[2].startsWith("-") ? process.argv[2] : "ambos";
const VERBOSO = process.argv.includes("-v");

/* Lo que se queda en inglés a propósito en las dos versiones. */
const NOMBRES = Object.values(JSON.parse(readFileSync("./out/names.subset.json", "utf-8"))).map(n => n.name).filter(Boolean);
const MAZOS = JSON.parse(readFileSync("../data/mazos.json", "utf-8")).map(m => m.nombre);
const NICKS = (readFileSync("./src/suizo.js", "utf-8").match(/NICKS = \[([\s\S]*?)\]/)?.[1] ?? "").match(/"([^"]+)"/g)?.map(x => x.slice(1, -1)) ?? [];
const FIJOS = [...new Set([...NOMBRES, ...MAZOS, ...NICKS, "Téa Gardner"])].sort((a, b) => b.length - a.length);
/* Palabras que SOLO salen en español: las de las claves de la tabla de
   traducciones que no aparecen en ninguna traducción. Con ellas se filtran
   las frases que pasaron por T() sin entrada (y no las que ya estaban en
   inglés, que también pasan por ahí al repintar). */
const I18N = readFileSync("./src/i18n.js", "utf-8");
const pares = [...I18N.matchAll(/"((?:[^"\\]|\\.)+)"\s*:\s*\n?\s*"((?:[^"\\]|\\.)+)"/g)];
const palabras = t => (t.toLowerCase().match(/[a-záéíóúñü]+/g) ?? []);
const enIngles = new Set(pares.flatMap(m => palabras(m[2])));
const SOLO_ES = new Set(pares.flatMap(m => palabras(m[1])).filter(w => w.length > 2 && !enIngles.has(w)));
const quitarFijos = t => { let s = t; for(const n of FIJOS) if(n.length > 3 && s.includes(n)) s = s.split(n).join(" "); return s; };

const ES = /[áéíóúñ¿¡]|(^|[\s(«"'·:])(el|la|los|las|una|unos|unas|que|con|para|sin|tu|tus|de|del|por|te|le|les|un|hay|al|es|son|está|están|esta|este|estas|estos|todo|toda|todos|todas|cada|pulsa|elige|elegir|volver|ver|carta|cartas|mazo|mazos|sobre|sobres|duelo|duelos|ficha|fichas|puedes|tienes|faltan|necesitas|ya|aún|todavía|antes|después|nada|algo|otra|otro|más|menos|mismo|misma|jugar|ganar|perder|empezar|turno|partida|partidas|ronda|rival|jugador|mesa|sala|amigo|pruebas|cadena|cadenas|efecto|activar|invoca|coloca|ataque|defensa|boca|abajo|arriba|campo|mano|cementerio|desterrada|robar|roba|fase|salir|menú|opciones|idioma|tiempo|sí|y|o|en|lo|se|si|su|sus|mi|mis|me|nos)([\s).,:;!?»"'…·]|$)/i;
const EN = /(^|[\s(«"'·:])(the|and|you|your|you're|turn|turns|draw|attack|attacks|card|cards|deck|decks|play|playing|win|won|lose|lost|choose|select|back|next|start|new|game|games|round|player|opponent|choose|chain|response|respond|activate|summon|summons|set|graveyard|banished|hand|field|life|points|loading|settings|language|time|yes|ok|cancel|continue|close|open|copy|join|create|room|friend|waiting|ready|record|place|tournament|standings|rematch|surrender|download|report|bug|of|to|in|on|with|for|is|are|it|this|that|from|by|at|be|have|not|or|if|all|any|more|less|than|then|when|which|who|what|how|why)([\s).,:;!?»"'…·]|$)/i;
/* Términos del juego que en español se dicen en inglés (como en la
   comunidad de Goat), y abreviaturas que no son de ningún idioma. */
const EN_PERMITIDO = [/\b(Main Phase(?: 1| 2)?|Battle Phase|Draw Phase|Standby Phase|End Phase|Main deck|Main Deck|Extra Deck|deck builder|matches|match|Side deck|Side Deck|Deck Builder|Goat Format|Goat|Bo3|LP|ATK|DEF|OMW|GW|Top 16|log|Chaos|Warrior|Burn|Reino|Duel|Star Chips?|Draw|Standby|Battle|Main|End|Fusion|Ritual|Token|Flip)\b/g];

const PUERTO = 9600 + Math.floor(Math.random() * 300);
const srv = spawn("python3", ["-m", "http.server", String(PUERTO), "--bind", "127.0.0.1"], { cwd:"./out", stdio:"ignore" });
await new Promise(r => setTimeout(r, 900));
const URL_ = `http://127.0.0.1:${PUERTO}/goat.html`;
const nav = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });

function leer(){
  const out = [];
  const vis = el => { if(!el) return false; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.05; };
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while(w.nextNode()){
    const n = w.currentNode, t = n.textContent.replace(/\s+/g, " ").trim(), el = n.parentElement;
    if(!t || !el || el.closest("script,style,option") || !vis(el)) continue;
    out.push([t, el.id || el.className || el.tagName]);
  }
  for(const s of document.querySelectorAll("select")) if(vis(s))
    for(const o of s.querySelectorAll("option,optgroup")) out.push([(o.label || o.textContent || "").trim(), "select#" + s.id]);
  for(const el of document.querySelectorAll("[title],[aria-label],[placeholder],img[alt]")){
    if(!vis(el)) continue;
    for(const a of ["title", "aria-label", "placeholder", "alt"]){ const v = el.getAttribute(a); if(v && v.trim()) out.push([v.trim(), "@" + a + " " + (el.id || el.className || el.tagName)]); }
  }
  return out;
}

async function barrer(idioma){
  const textos = new Map();          // texto → momento donde salió
  const apuntar = async (p, momento) => {
    try{ for(const [t, d] of await p.evaluate(leer)) if(!textos.has(t)) textos.set(t, `${momento} · ${d}`); }catch(e){}
  };
  const ctx = await nav.newContext({ viewport:{ width:1280, height:800 }, acceptDownloads:true });
  await ctx.addInitScript(l => {
    localStorage.setItem("goatConfig", JSON.stringify({ idioma:l, cadenas:"always" }));
    localStorage.setItem("goatDebug", "1");
    globalThis.GOAT_SALA_LOCAL = true; globalThis.GOAT_PENSAR = 0; globalThis.GOAT_VELOCIDAD = 0.15;
    globalThis.open = () => null;
    globalThis.__T_FUGAS__ = new Set();
  }, idioma);
  const errores = [];
  const A = await ctx.newPage();
  A.on("pageerror", e => errores.push(String(e)));
  await A.goto(URL_); await A.waitForTimeout(1500);
  await apuntar(A, "portada");
  const ir = async (id, momento) => { await A.evaluate(i => document.getElementById(i)?.click(), id); await A.waitForTimeout(250); await apuntar(A, momento); };
  await ir("irJugar", "duelo libre"); await A.evaluate(() => document.getElementById("volver1")?.click());
  await ir("irBots", "retos"); await A.evaluate(() => document.getElementById("volver3")?.click());
  await ir("irOpciones", "opciones"); await A.evaluate(() => document.querySelector("#pOpciones .mvolver")?.click());

  /* ── el torneo suizo, de la inscripción a la final ── */
  await ir("irTorneo", "torneo · inscripción");
  await A.evaluate(() => globalThis.__PRUEBA_TORNEO__.inscribir(document.getElementById("tMiMazo").value, "Edu"));
  await apuntar(A, "torneo · ronda 1");
  for(let k = 0; k < 40; k++){
    const fase = await A.evaluate(() => globalThis.__PRUEBA_TORNEO__.suizo?.fase);
    if(fase === "fin" || !fase) break;
    const hay = await A.evaluate(() => {
      const g = document.getElementById("tGanarPrueba"), s = document.getElementById("tSiguiente"), h = document.getElementById("tHastaFinal");
      if(g){ g.click(); return "g"; } if(h && Math.random() < .3){ h.click(); return "h"; } if(s){ s.click(); return "s"; } return null; });
    await A.waitForTimeout(80);
    await apuntar(A, "torneo");
    if(!hay) break;
  }
  await A.evaluate(() => document.querySelectorAll("#pTorneo details").forEach(d => d.open = true));
  await apuntar(A, "torneo · final");
  await A.evaluate(() => document.getElementById("volver4")?.click());

  /* ── duelos libres con los paneles a la vista ──
     Varios cruces, para que salgan paneles distintos: declarar carta
     (Library, Gravekeeper), monedas y dados, rituales, quema, contadores… */
  const CRUCES = [["i0", "i7"], ["i19", "i16"], ["i15", "i13"], ["i1", "i17"], ["i18", "i12"]].slice(0, Number(process.env.DUELOS ?? 5));
  let log = "", fugasA = [];
  for(const [k, [mio, ia]] of CRUCES.entries()){
    await A.evaluate(([l, mio, ia]) => { localStorage.setItem("goatConfig", JSON.stringify({ idioma:l, cadenas:"always", mazo:mio, mazoIA:ia })); }, [idioma, mio, ia]);
    await A.goto(URL_); await A.waitForTimeout(1200);
    await A.evaluate(() => { globalThis.GOAT_AUTOJUGAR = "ver"; globalThis.GOAT_VER_MS = 120; });
    await ir("irJugar", "duelo libre");
    await A.evaluate(() => document.getElementById("mJugar").click());
    const t0 = Date.now();
    let vueltas = 0;
    while(Date.now() - t0 < 200000){
      await A.waitForTimeout(110);
      await apuntar(A, `duelo ${k + 1}`);
      vueltas++;
      if(k === 0 && vueltas === 60){
        await A.evaluate(() => document.getElementById("btnReportar")?.click()); await A.waitForTimeout(150);
        await apuntar(A, "duelo · reportar"); await A.evaluate(() => document.getElementById("confirm").click());
      }
      if(k === 0 && vueltas === 80){
        await A.evaluate(() => document.getElementById("btnRendirse")?.click()); await A.waitForTimeout(150);
        await apuntar(A, "duelo · rendirse"); await A.evaluate(() => document.querySelector("#confirm .cfno")?.click());
      }
      if(await A.evaluate(() => getComputedStyle(document.getElementById("fin")).display === "flex")) break;
    }
    await A.waitForTimeout(800);
    await apuntar(A, `duelo ${k + 1} · final`);
    log += await A.evaluate(() => globalThis.__RESUMEN_DE_PRUEBA__?.() ?? "");
    fugasA.push(...await A.evaluate(() => [...(globalThis.__T_FUGAS__ ?? [])]));
  }

  /* ── una sala entre dos pestañas ── */
  const B = await ctx.newPage();
  B.on("pageerror", e => errores.push("B: " + String(e)));
  await A.goto(URL_); await A.waitForTimeout(1200);
  await ir("irSala", "sala · inicio");
  await A.evaluate(() => document.getElementById("sCrear").click());
  await A.waitForFunction(() => /^[A-Z2-9]{5}$/.test(document.getElementById("sCodigoSala")?.textContent ?? ""));
  await apuntar(A, "sala · esperando");
  const cod = await A.evaluate(() => document.getElementById("sCodigoSala").textContent);
  await B.goto(URL_ + "#sala=" + cod); await B.waitForTimeout(1200);
  await B.evaluate(() => document.getElementById("sUnirme").click());
  await A.waitForFunction(() => !!document.getElementById("sEmpezar"));
  await B.waitForTimeout(400);
  await apuntar(A, "sala · juntos (anfitrión)"); await apuntar(B, "sala · juntos (invitado)");
  await B.evaluate(() => globalThis.__PRUEBA_SALA__ && (globalThis.__PRUEBA_SALA__.estado.editandoSide = { main:[...globalThis.__PRUEBA_SALA__.estado.miMazo.main], side:[...globalThis.__PRUEBA_SALA__.estado.miMazo.side] }, globalThis.__PRUEBA_SALA__.pintar()));
  await apuntar(B, "sala · side deck");
  const fugas = new Set([...fugasA, ...await A.evaluate(() => [...(globalThis.__T_FUGAS__ ?? [])]),
                                    ...await B.evaluate(() => [...(globalThis.__T_FUGAS__ ?? [])])]);
  await ctx.close();
  return { textos, errores, log, fugas };
}

const informe = [];
for(const idioma of QUE === "ambos" ? ["en", "es"] : [QUE]){
  const { textos, errores, log, fugas } = await barrer(idioma);
  const malos = [];
  for(const [t, donde] of textos){
    if(/^[\d\s\-:./·()+%×✓✗→←▶▼★⛶…'"x]*$/.test(t)) continue;      // números y símbolos
    if(idioma === "en"){
      if(ES.test(quitarFijos(t))) malos.push([t, donde]);
    } else {
      let s = quitarFijos(t); for(const re of EN_PERMITIDO) s = s.replace(re, " ");
      if(EN.test(s)) malos.push([t, donde]);
    }
  }
  console.log(`\n═══ ${idioma === "en" ? "EN INGLÉS: español que se cuela" : "EN ESPAÑOL: inglés que se cuela"} · ${textos.size} textos vistos · ${malos.length} sospechosos ═══`);
  for(const [t, d] of malos) console.log(`  · ${t.slice(0, 160)}${VERBOSO ? `   [${d}]` : ""}`);
  if(errores.length) console.log("  ERRORES JS: " + errores.slice(0, 5).join(" | "));
  if(idioma === "en"){
    /* Lo que pasó por la traducción sin encontrar equivalente (`__T_FUGAS__`),
       aunque no llegara a verse: quitando nombres de carta y números. */
    /* TODAS, no solo las que «parecen» español: «Importar .ydk» no lleva
       ninguna palabra de la lista y se coló así en el deck builder. Fuera
       solo los números, los nombres (carta, mazo, jugador) y lo que ya
       está en inglés a propósito. */
    const f = [...fugas].map(String).filter(t => { const q = quitarFijos(t);
      return ES.test(q) || palabras(q).some(w => SOLO_ES.has(w)); });
    console.log(`\n  · pasaron por T() sin traducción: ${f.length}`);
    for(const t of f) console.log("    - " + String(t).slice(0, 160));
  }
  informe.push({ idioma, textos:[...textos], malos, errores });
  writeFileSync(`/tmp/barrido-${idioma}.json`, JSON.stringify({ textos:[...textos], malos, log, fugas:[...fugas] }, null, 1));
}
await nav.close(); srv.kill();
