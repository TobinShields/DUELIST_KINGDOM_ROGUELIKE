/* ══════════════════════════════════════════════════════════════════
   SALAS EN CHROMIUM: DOS PESTAÑAS, UN DUELO ENTERO

   El HTML construido, servido en local y abierto DOS veces en Chromium:
   la pestaña A crea la sala, la B entra con el enlace (#sala=CÓDIGO) y
   juegan un duelo completo. Las dos manos las juega el bot
   (`GOAT_AUTOJUGAR`), con las esperas aceleradas (`GOAT_VELOCIDAD`) y el
   transporte local (`GOAT_SALA_LOCAL`, BroadcastChannel) en vez de
   PeerJS, que necesita internet.

   Se comprueba que el duelo acaba en las DOS pestañas con el mismo
   ganador, que durante todo el duelo el navegador del invitado no tiene
   ni una carta de la mano del anfitrión, que los dos vuelven a la sala
   con el marcador 1-0 y que se puede jugar la revancha. Sin errores de
   JavaScript en ninguna de las dos.

   Uso: node check-sala-navegador.mjs [capturas=0]
   ══════════════════════════════════════════════════════════════════ */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
const PW = process.env.PLAYWRIGHT_MODULE ?? "/home/claude/.npm-global/lib/node_modules/playwright/index.mjs";
const { chromium } = await import(PW);
const CAPTURAS = process.argv[2] === "1";
if(CAPTURAS) mkdirSync("/tmp/shots", { recursive:true });

let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t, d = "") => { fallos++; console.log("  ✗ " + t + (d ? "   " + d : "")); };
const es = (c, t, d) => c ? ok(t) : mal(t, d);
console.log("\n═══ SALAS · dos pestañas de Chromium ═══\n");

const PUERTO = 8700 + Math.floor(Math.random() * 200);
const servidor = spawn("python3", ["-m", "http.server", String(PUERTO), "--bind", "127.0.0.1"], { cwd:"./out", stdio:"ignore" });
/* Con `PEERJS_LOCAL=<carpeta con node_modules/peer>` se prueba PeerJS DE
   VERDAD (WebRTC entre las dos pestañas) con un servidor de PeerJS local
   en vez del público. Sin él, el transporte local por BroadcastChannel. */
const PEER_LOCAL = process.env.PEERJS_LOCAL ?? null;
const PUERTO_PEER = PUERTO + 1000;
const servidorPeer = PEER_LOCAL ? spawn("node", [PEER_LOCAL + "/servidor-peer.mjs", String(PUERTO_PEER)], { cwd:PEER_LOCAL, stdio:"ignore" }) : null;
await new Promise(r => setTimeout(r, PEER_LOCAL ? 2500 : 900));
if(PEER_LOCAL) console.log("  · con PeerJS y WebRTC de verdad (servidor de PeerJS local)");
const URL_ = `http://127.0.0.1:${PUERTO}/goat.html`;

const nav = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
const ctx = await nav.newContext({ viewport:{ width:1280, height:800 } });
await ctx.addInitScript(peer => {
  try{ localStorage.setItem("goatConfig", JSON.stringify({ idioma:"es", cadenas:"always" })); }catch(e){}
  if(peer) globalThis.GOAT_PEER_OPCIONES = { host:"127.0.0.1", port:peer, path:"/", secure:false };
  else globalThis.GOAT_SALA_LOCAL = true;
  globalThis.GOAT_AUTOJUGAR = true;
  globalThis.GOAT_VELOCIDAD = 0.02; globalThis.GOAT_PENSAR = 0; globalThis.GOAT_CHAIN_TIMEOUT = 0;
}, PEER_LOCAL ? PUERTO_PEER : 0);
const errores = { A:[], B:[] };
const A = await ctx.newPage(), B = await ctx.newPage();
for(const [n, p] of [["A", A], ["B", B]]){
  p.on("pageerror", e => errores[n].push(String(e)));
  p.on("console", m => { if(m.type() === "error" && !/ygoprodeck|Failed to load resource|ERR_/.test(m.text())) errores[n].push(m.text()); });
}
const foto = async (p, n) => { if(CAPTURAS) await p.screenshot({ path:`/tmp/shots/sala-${n}.png` }); };
const texto = (p, sel) => p.evaluate(s => document.querySelector(s)?.innerText ?? "", sel);
const esperar = async (p, f, arg, ms = 15000) => { try{ await p.waitForFunction(f, arg, { timeout:ms }); return true; }catch(e){ return false; } };

await A.goto(URL_); await B.goto("about:blank");
await A.waitForTimeout(1200);
await A.evaluate(() => document.getElementById("irSala").click());
await A.fill("#sNombre", "Yugi");
await foto(A, "1-inicio");
await A.evaluate(() => document.getElementById("sCrear").click());
es(await esperar(A, () => /^[A-Z2-9]{5}$/.test(document.getElementById("sCodigoSala")?.textContent ?? "")), "A crea la sala y enseña el código");
const codigo = await texto(A, "#sCodigoSala");
await foto(A, "2-esperando");

await B.goto(URL_ + "#sala=" + codigo);
await B.waitForTimeout(1200);
es((await B.inputValue("#sCodigo").catch(() => "")) === codigo, "el enlace abre la sala con el código puesto");
await B.fill("#sNombre", "Kaiba");
await B.evaluate(() => document.getElementById("sUnirme").click());
es(await esperar(A, () => !!document.getElementById("sEmpezar")), "B entra y A ve a su amigo con el botón de empezar");
es(await esperar(B, () => /Esperando a que el anfitrión/.test(document.getElementById("sCaja")?.innerText ?? "")), "B espera a que A empiece");
es(/Kaiba/.test(await texto(A, "#sCaja")) && /Yugi/.test(await texto(B, "#sCaja")), "cada uno ve el nombre del otro");

/* ── EL INVITADO ELIGE MAZO ENTRE LOS DEL ANFITRIÓN ── */
es(/mazos del anfitrión/i.test(await texto(B, "#sCaja")), "el invitado ve que juega con los mazos del anfitrión");
const opciones = await B.evaluate(() => [...document.querySelectorAll("#sMiMazo option")].map(o => o.textContent));
es(opciones.length >= 20 && opciones.includes("Chaos Turbo · Worlds 2020"), "y puede elegir entre ellos", `${opciones.length} mazos`);
/* Uno de los suyos, guardado en su navegador: viajan las cartas y el
   anfitrión las valida. */
const suyo = await B.evaluate(() => { const g = [...document.querySelectorAll("#sMiMazo optgroup")].find(g => /Tus mazos/.test(g.label));
  const o = g?.querySelector("option"); if(!o) return null;
  const x = document.getElementById("sMiMazo"); x.value = o.value; x.dispatchEvent(new Event("change")); return o.textContent; });
es(!!suyo, "el invitado también tiene sus propios mazos en la lista", String(suyo));
es(await esperar(A, n => { const a = globalThis.__PRUEBA_SALA__.estado.amigo; return a?.nombreMazo === n && a.indice == null && a.mazo.main.length >= 40; }, suyo),
   "y si elige uno suyo, el anfitrión lo recibe y juega contra él");
/* Uno que no vale (a mano, por la consola): el anfitrión lo rechaza y el
   invitado vuelve a uno predefinido, con el motivo en pantalla. */
await B.evaluate(() => globalThis.__PRUEBA_SALA__.estado.sala.enviar({ t:"elijo", nombre:"Trampa", mazo:{ main:[1,2,3], extra:[], side:[] } }));
es(await esperar(B, () => /Main Deck tiene 3/.test(document.getElementById("sCaja")?.innerText ?? "")), "un mazo ilegal se rechaza con su motivo");
es(await A.evaluate(() => globalThis.__PRUEBA_SALA__.estado.amigo.nombreMazo !== "Trampa"), "y el anfitrión no lo acepta");
await B.evaluate(() => { const x = document.getElementById("sMiMazo");
  x.value = [...x.options].find(o => o.textContent === "Chaos Turbo · Worlds 2020").value; x.dispatchEvent(new Event("change")); });
es(await esperar(A, () => globalThis.__PRUEBA_SALA__.estado.amigo?.nombreMazo === "Chaos Turbo · Worlds 2020"),
   "el anfitrión ve el mazo que ha elegido su amigo");
es(/Chaos Turbo/.test(await texto(A, "#sCaja")), "y lo pinta en la sala");
await foto(A, "3-juntos-A"); await foto(B, "3-juntos-B");

/* Una carta oculta del anfitrión (su mano, su mazo, su Extra, sus
   tapadas) no puede tener su código en el navegador del invitado. Se mira
   cada segundo durante todo el duelo, en el espejo del invitado, con sus
   propios ojos: lo que ÉL tiene por oculto. Lo único que puede llevar
   código es lo que el último lote reveló (Trap Dustshoot, una búsqueda…). */
const fugas = [];
let vigilando = true, miradas = 0;
const vigilar = async () => {
  while(vigilando){
    try{
      const r = await B.evaluate(() => {
        const d = globalThis.__DUELO_DE_PRUEBA__?.(); if(!d?.duel?.esEspejo) return null;
        const yo = d.me, out = [];
        for(const c of d.duel.cards.values()){
          if(c.controller === yo || !c.code || d.duel.reveladas?.has(c.uid)) continue;
          if(c.location === 1 || c.location === 2 || c.location === 64 ||
             ((c.location === 4 || c.location === 8) && (c.position & 0x0a))) out.push(`uid ${c.uid} en ${c.location}: ${c.code}`);
        }
        /* Y su propio mazo tampoco: el orden no lo sabe nadie. */
        for(const c of d.duel.cards.values()) if(c.controller === yo && c.location === 1 && c.code) out.push(`mazo propio uid ${c.uid}`);
        return out;
      });
      if(r){ miradas++; fugas.push(...r); }
    }catch(e){}
    await new Promise(r => setTimeout(r, 1000));
  }
};
const vigilancia = vigilar();

const duelo = async (n) => {
  await A.evaluate(() => document.getElementById("sEmpezar").click());
  const t0 = Date.now();
  const finA = await esperar(A, () => getComputedStyle(document.getElementById("fin")).display === "flex", null, 300000);
  const finB = await esperar(B, () => getComputedStyle(document.getElementById("fin")).display === "flex", null, 30000);
  const tA = await texto(A, "#fin"), tB = await texto(B, "#fin");
  console.log(`  · duelo ${n}: ${((Date.now() - t0) / 1000).toFixed(0)} s · A: ${tA.split("\n")[0]} · B: ${tB.split("\n")[0]}`);
  return { finA, finB, ganaA: /VICTORIA/.test(tA), ganaB: /VICTORIA/.test(tB), tA, tB };
};
const d1 = await duelo(1);
es(d1.finA && d1.finB, "el duelo acaba en las dos pestañas");
es(d1.ganaA !== d1.ganaB, "con un solo ganador: una dice VICTORIA y la otra DERROTA", `${d1.tA.slice(0, 40)} | ${d1.tB.slice(0, 40)}`);
const lpA = d1.tA.match(/(\d+) LP/g)?.join(), lpB = d1.tB.match(/(\d+) LP/g)?.reverse().join();
es(lpA && lpA === lpB, "y los mismos puntos de vida en las dos (cada una desde su lado)", `${lpA} | ${lpB}`);
await foto(A, "4-final-A"); await foto(B, "4-final-B");

for(const p of [A, B]) await p.evaluate(() => [...document.querySelectorAll("#fin .finBtn")][0]?.click());
es(await esperar(A, () => !!document.getElementById("sEmpezar")), "«Continuar» devuelve a A a la sala");
await esperar(B, () => /Estoy listo|Esperando/.test(document.getElementById("sCaja")?.innerText ?? ""));
const marcA = await texto(A, ".sVs b"), marcB = await texto(B, ".sVs b");
es((d1.ganaA ? marcA === "1 - 0" && marcB === "0 - 1" : marcA === "0 - 1" && marcB === "1 - 0"), "con el marcador del match (Bo3)", `${marcA} | ${marcB}`);

/* ── EL BO3: ENTRE PARTIDAS, SIDE DECK ──
   El anfitrión no puede empezar la partida 2 hasta que el invitado está
   listo. El invitado sidea (una carta del main al side y otra de vuelta)
   y esa es la lista con la que juega. */
const botonA = () => A.evaluate(() => { const b = document.getElementById("sEmpezar"); return { t:b?.textContent ?? "", off:!!b?.disabled }; });
let bA = await botonA();
es(/partida 2/i.test(bA.t) && bA.off, "la partida 2 espera a que el invitado esté listo", JSON.stringify(bA));
es(await B.evaluate(() => !!document.getElementById("sListo") && !!document.getElementById("sSide")), "el invitado tiene «Side deck» y «Estoy listo»");
await B.evaluate(() => document.getElementById("sSide").click());
const rejB = await B.evaluate(() => document.querySelectorAll("#sSideCaja .sdRej").length);
es(rejB === 2, "el side deck del invitado enseña Main y Side");
await foto(B, "5-side-B");
const movida = await B.evaluate(() => {
  const S = globalThis.__PRUEBA_SALA__.estado;
  const sale = S.editandoSide.main.find(c => !S.editandoSide.side.includes(c));
  const entra = S.editandoSide.side.find(c => !S.editandoSide.main.includes(c));
  /* Se mueven por el estado del editor y se repinta: lo que se prueba es
     que la lista llega al anfitrión, no el clic exacto en la miniatura. */
  S.editandoSide.main.splice(S.editandoSide.main.indexOf(sale), 1); S.editandoSide.side.push(sale);
  S.editandoSide.side.splice(S.editandoSide.side.indexOf(entra), 1); S.editandoSide.main.push(entra);
  document.getElementById("sSideListo").click();
  return { sale, entra };
});
es(await esperar(A, () => !document.getElementById("sEmpezar")?.disabled), "al terminar su side, el invitado queda listo y el anfitrión puede empezar");
es(await A.evaluate(m => { const am = globalThis.__PRUEBA_SALA__.estado.amigo.mazo; return am.main.includes(m.entra) && am.side.includes(m.sale); }, movida),
   "y el anfitrión jugará contra la lista sideada");
await foto(A, "5-partida2-A"); await foto(B, "5-partida2-B");

/* La partida 2: empieza quien perdió la 1. Y a mitad, al invitado se le
   corta la conexión: vuelve solo y el duelo sigue donde estaba. */
setTimeout(async () => {
  try{
    await B.evaluate(() => globalThis.__PRUEBA_SALA__.estado.sala._transporte.cerrar());
    cortes++;
    if(CAPTURAS) setTimeout(() => foto(B, "6-en-duelo-B").catch(() => {}), 6000);
  }catch(e){}
}, 9000);
let cortes = 0;
const d2 = await duelo(2);
es(cortes === 1, "a mitad de la partida 2 se le corta la conexión al invitado");
es(d2.finA && d2.finB && d2.ganaA !== d2.ganaB, "y aun así se juega entera, en las dos pestañas");
es(await B.evaluate(() => globalThis.__PRUEBA_SALA__.estado.sala.estado === "conectado"), "el invitado ha vuelto solo a la sala");

/* Hasta que alguien llegue a dos. */
let ganadasA = (d1.ganaA ? 1 : 0) + (d2.ganaA ? 1 : 0), n = 2;
for(const p of [A, B]) await p.evaluate(() => [...document.querySelectorAll("#fin .finBtn")][0]?.click());
while(ganadasA < 2 && n - ganadasA < 2){
  await esperar(B, () => !!document.getElementById("sListo"));
  await B.evaluate(() => document.getElementById("sListo").click());
  await esperar(A, () => !document.getElementById("sEmpezar")?.disabled);
  const d = await duelo(++n);
  if(d.ganaA) ganadasA++;
  for(const p of [A, B]) await p.evaluate(() => [...document.querySelectorAll("#fin .finBtn")][0]?.click());
}
await esperar(A, () => /match/i.test(document.getElementById("sCaja")?.innerText ?? ""));
await esperar(B, () => /match/i.test(document.getElementById("sCaja")?.innerText ?? ""));
const finA = await texto(A, "#sCaja"), finB = await texto(B, "#sCaja");
es(ganadasA >= 2 ? /Has ganado el match/.test(finA) && /Tu amigo ha ganado el match/.test(finB)
                 : /Has ganado el match/.test(finB) && /Tu amigo ha ganado el match/.test(finA),
   `el match acaba ${ganadasA >= 2 ? 2 : ganadasA}-${n - ganadasA >= 2 ? 2 : n - ganadasA} y las dos pestañas dicen quién lo ha ganado`);
es(/Matches 1-0|Matches 0-1/.test(finA) && /Matches 1-0|Matches 0-1/.test(finB), "con el marcador de matches en las dos");
es(/Nuevo match/.test(await A.evaluate(() => document.getElementById("sEmpezar")?.textContent ?? "")), "y el botón de «Nuevo match»");
await foto(A, "7-match-A");

vigilando = false; await vigilancia;
es(miradas > 5 && fugas.length === 0, "en ningún momento el invitado tiene una carta oculta del anfitrión", `${miradas} miradas · ${fugas.slice(0, 3).join(" | ")}`);

/* ── EL RELOJ ──
   Duelos sueltos con 3 s por decisión y el invitado sin contestar nada:
   su propio reloj contesta por él tres veces y pierde el duelo. Después,
   con su reloj apagado (un navegador colgado), contesta el anfitrión por
   él pasado el margen, y también lo pierde. */
await A.evaluate(() => { document.getElementById("sFormato").value = "suelto"; document.getElementById("sFormato").dispatchEvent(new Event("change")); });
es(await esperar(B, () => /Duelos sueltos/.test(document.getElementById("sCaja")?.innerText ?? "")), "el anfitrión cambia a duelos sueltos y el invitado lo ve");
await A.evaluate(() => { globalThis.GOAT_TIEMPO_SALA = 3; globalThis.GOAT_MARGEN_RELOJ_MS = 1500; });
await B.evaluate(() => { globalThis.GOAT_AUTOJUGAR = false; });
/* Con capturas, el invitado en tamaño de móvil apaisado: el reloj tiene
   que caber en la barra de arriba. */
if(CAPTURAS) await B.setViewportSize({ width:844, height:390 });
if(CAPTURAS) setTimeout(() => { foto(B, "8-reloj-B").catch(() => {}); foto(A, "8-reloj-A").catch(() => {}); }, 4500);
const d4 = await duelo("reloj");
es(d4.finA && d4.finB && d4.ganaA && !d4.ganaB, "sin contestar, el invitado pierde el duelo por tiempo");
es(/tiempo tres veces/i.test(d4.tA) && /tiempo tres veces/i.test(d4.tB), "y las dos pantallas dicen por qué", `${d4.tA.slice(0, 120)} | ${d4.tB.slice(0, 120)}`);
for(const p of [A, B]) await p.evaluate(() => [...document.querySelectorAll("#fin .finBtn")][0]?.click());
await esperar(A, () => !!document.getElementById("sEmpezar"));
const marcSuelto = await texto(A, ".sVs b");
es(/^1 - 0$/.test(marcSuelto), "y el duelo perdido por tiempo cuenta en el marcador (que empezó de cero al cambiar de formato)", marcSuelto);
await B.evaluate(() => { globalThis.GOAT_SIN_RELOJ = true; });
const d5 = await duelo("margen");
es(d5.finA && d5.finB && d5.ganaA && !d5.ganaB, "con su reloj colgado, contesta el anfitrión por él y también lo pierde");
for(const p of [A, B]) await p.evaluate(() => [...document.querySelectorAll("#fin .finBtn")][0]?.click());
await esperar(A, () => !!document.getElementById("sSalir"));

/* Salir: el anfitrión cierra la sala y el invitado se entera. */
for(const p of [A, B]) await p.evaluate(() => [...document.querySelectorAll("#fin .finBtn")][0]?.click());
await esperar(A, () => !!document.getElementById("sSalir"));
await A.evaluate(() => { globalThis.confirm = () => true; document.getElementById("sSalir").click(); });
es(await esperar(B, () => /cerrado la sala/.test(document.getElementById("sCaja")?.innerText ?? ""), null, 8000), "si el anfitrión cierra la sala, el invitado lo ve");

es(!errores.A.length && !errores.B.length, "sin errores de JavaScript en ninguna pestaña", JSON.stringify(errores).slice(0, 400));

await nav.close(); servidor.kill(); servidorPeer?.kill();
console.log(`\n${fallos ? "FALLA: " + fallos : "Todo correcto"}`);
process.exit(fallos ? 1 : 0);
