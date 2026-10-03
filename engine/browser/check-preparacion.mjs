/* ══════════════════════════════════════════════════════════════════
   ELEGIR LA VENTAJA CON EL RATÓN, COMO LO HACE E

   `check-maestria` daba verde porque llamaba a `H.empezar({pasivo,
   cartaDeMaestro})` directamente. El bug no estaba ahí: estaba en la
   PANTALLA. Las tres variables de la preparación —ventaja, carta,
   familia— se declaraban DENTRO de la función que dibuja la pantalla, y
   elegir la carta llamaba a `pintar()` para enseñar el aviso «Empezarás
   con...». `pintar()` vuelve a montar la pantalla entera, o sea que
   volvía a ejecutar la declaración y las dejaba las tres a null: con el
   mismo clic con el que elegías la carta perdías la carta Y la ventaja.
   E lo contó como "cogí una carta con la maestría 1 de Yugi y no me la
   ha dado ni al deck ni al binder".

   Por eso esta comprobación no llama a la API: PULSA los botones.

   Uso:  node check-preparacion.mjs
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
writeFileSync("./out/_prep.mjs", html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]);
console.warn = () => {};
await import("./out/_prep.mjs");
await new Promise(r => setTimeout(r, 400));

let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t,d="") => { fallos++; console.log("  ✗ " + t + (d ? "   " + d : "")); };
console.log("\n═══ LA PREPARACIÓN, PULSANDO BOTONES ═══\n");

const $ = id => document.getElementById(id);
function todos(n, out=[]){ if(!n) return out; out.push(n);
  for(const h of (n.children ?? [])) todos(h, out); return out; }
const conClase = (r,c) => todos(r).filter(x => x.classList?.contains?.(c));
const botones  = r => todos(r).filter(x => x.tagName === "button");
/* El DOM simulado no compone `textContent` con el de sus hijos, y estos
   botones se montan con un <b> y un <span> dentro: preguntar por el
   texto del botón devolvía "" y el test no encontraba nada. */
const texto = n => {
  if(!n) return "";
  const hijos = n.children ?? [];
  if(!hijos.length) return String(n.textContent ?? "").trim();
  return hijos.map(texto).filter(Boolean).join(" ").trim()
      || String(n.textContent ?? "").trim();
};

$("irReino").onclick?.();
const reino = $("reino");
const R = globalThis.__REINO_PRUEBA__;
if(!R){ mal("el gancho de prueba del Reino existe"); process.exit(1); }
const H = R.H;

/* Se le regala maestría 3 a Yugi, que es lo que abre las tres ventajas. */
const conMaestria = quien => {
  H.importar(JSON.stringify({ esquema:1, meta:{ maestria:{ [quien]:3 } } }));
  R.alInicio ? R.alInicio() : null;
  $("irReino").onclick?.();     // repinta la pantalla de inicio
};
const pulsar = (raiz, txt) => {
  const b = botones(raiz).find(x => texto(x) === txt || texto(x).startsWith(txt));
  b?.onclick?.(); return !!b;
};

/* ── 1 · LA CARTA DEL MAESTRO ── */
conMaestria("yugi");
const ventajas = conClase(reino, "rVentaja");
if(!ventajas.length) mal("con maestría se ven las ventajas para elegir");
else {
  const bCarta = ventajas.find(b => /maestro/i.test(texto(b)));
  if(!bCarta) mal("está la ventaja de la carta del maestro",
                  ventajas.map(texto).join(" | "));
  else {
    bCarta.onclick?.();
    /* Las diez cartas del maestro. Se pulsa una: ESE es el clic que lo
       rompía todo. */
    const cartas = conClase(reino, "rCarta");
    if(cartas.length < 10) mal("salen las diez cartas de maestro", `salen ${cartas.length}`);
    else {
      cartas[3].onclick?.();

      /* Después del repintado, la pantalla tiene que seguir diciendo lo
         mismo que el estado: ventaja marcada y carta marcada. */
      const marcada = conClase(reino,"rVentaja").find(b => b.classList.contains("on"));
      if(!marcada) mal("tras elegir la carta, la ventaja sigue marcada en pantalla");
      else if(!conClase(reino,"rCarta").some(x => x.classList.contains("on")))
        mal("tras el repintado, la carta elegida sigue marcada");
      else ok("elegir la carta no borra la ventaja ni la marca de la pantalla");

      if(!pulsar(reino, "Empezar")) mal("está el botón de empezar");
      else {
        const run = H.run;
        if(!run) mal("la aventura empieza");
        else if(run.pasivo !== "carta-de-maestro")
          mal("la run arranca con la ventaja elegida", `arrancó con «${run.pasivo}»`);
        else if(run.mazo.main.length !== 41)
          mal("la carta del maestro entra al mazo", `el mazo tiene ${run.mazo.main.length}`);
        else if(!run.mazo.main.includes(run.pasivoDatos?.carta))
          mal("y la carta que está en el mazo es la que elegiste");
        else ok(`empezando con el ratón, el mazo sale con 41 y la carta elegida dentro`);
      }
    }
  }
}

/* ── 2 · UNA VENTAJA A MEDIAS NO EMPIEZA LA AVENTURA ──
   Elegir «carta del maestro» y no elegir carta gastaba la ventaja en
   nada, en silencio. */
{
  mem.clear();
  conMaestria("joey");
  const antes = H.run;
  const v = conClase(reino,"rVentaja").find(b => /maestro/i.test(texto(b)));
  v?.onclick?.();                       // ventaja sí, carta no
  pulsar(reino, "Empezar");
  if(H.run && H.run !== antes && H.run.pasivo === "carta-de-maestro"
     && H.run.mazo.main.length === 40)
    mal("no se empieza con la ventaja a medias", "empezó y se gastó la ventaja en nada");
  else if(H.run && H.run !== antes && H.run.mazo.main.length === 40 && H.run.pasivo)
    mal("no se empieza con la ventaja a medias", `empezó con «${H.run.pasivo}»`);
  else ok("elegir la ventaja sin elegir carta no empieza la aventura");
}

/* ── 3 · CAMBIAR DE DUELISTA SÍ OLVIDA LO ELEGIDO ──
   Las cartas de maestro son de cada uno: arrastrar la de Yugi al empezar
   con Mai sería regalarle una carta que no le toca. */
{
  mem.clear();
  H.importar(JSON.stringify({ esquema:1, meta:{ maestria:{ yugi:3, mai:3 } } }));
  $("irReino").onclick?.();
  conClase(reino,"rVentaja").find(b => /maestro/i.test(texto(b)))?.onclick?.();
  const cartasYugi = conClase(reino,"rCarta").map(b => b.dataset?.code ?? null);
  conClase(reino,"rCarta")[2]?.onclick?.();
  /* Ahora se cambia a Mai. */
  const otro = conClase(reino,"rDuelista").find(b => /mai/i.test(texto(b)));
  if(!otro) mal("se puede cambiar de duelista",
                conClase(reino,"rDuelista").map(texto).join(" | "));
  else {
    otro.onclick?.();
    const sigueMarcada = conClase(reino,"rVentaja").some(b => b.classList.contains("on"));
    if(sigueMarcada) mal("cambiar de duelista olvida la ventaja elegida");
    else ok("cambiar de duelista olvida la ventaja y la carta del anterior");
  }
}

/* ══════════════════════════════════════════════════════════════════
   LAS TRES VENTAJAS, EN LOS CINCO DUELISTAS, PULSANDO BOTONES

   E: "las perks de personajes distintos de Yugi siguen fallando".
   `check-maestria` las prueba llamando a `H.empezar({pasivo,...})`, que
   es justo lo que NO falla. Aquí se hace lo que hace él: elegir
   duelista, elegir ventaja, elegir lo que la ventaja pida, pulsar
   empezar, y comprobar el resultado en la run.
   ══════════════════════════════════════════════════════════════════ */
{
  const QUIENES = ["yugi","joey","mai","keith","kaiba"];
  const VAL = { C:0, R:1, SR:2, UR:3 };

  /* Elegir duelista en la pantalla de inicio, con maestría 3 puesta. */
  const abrirCon = quien => {
    mem.clear();
    H.importar(JSON.stringify({ esquema:1, meta:{ maestria:{ [quien]:3 } } }));
    $("irReino").onclick?.();
    const b = conClase(reino,"rDuelista").find(x => new RegExp(quien,"i").test(texto(x))
      || new RegExp(quien,"i").test(x.dataset?.id ?? ""));
    b?.onclick?.();
    return !!b;
  };
  const ventaja = re => {
    const b = conClase(reino,"rVentaja").find(x => re.test(texto(x)));
    b?.onclick?.(); return !!b;
  };

  for(const quien of QUIENES){
    if(!abrirCon(quien)){ mal(`${quien}: se puede elegir en la pantalla de inicio`); continue; }
    const suyas = conClase(reino,"rVentaja").length;
    if(suyas !== 3){ mal(`${quien}: con maestría 3 salen las tres ventajas`, `salen ${suyas}`); continue; }

    /* ── 1 · LA CARTA DEL MAESTRO ── */
    if(!ventaja(/maestro/i)){ mal(`${quien}: está la ventaja de la carta`); continue; }
    const cartas = conClase(reino,"rCarta");
    if(cartas.length < 10){ mal(`${quien}: sus diez cartas de maestro`, `salen ${cartas.length}`); continue; }
    cartas[4].onclick?.();
    pulsar(reino, "Empezar");
    const r1 = H.run;
    if(!r1 || r1.personaje !== quien){
      mal(`${quien}: la run arranca con ESE duelista`, `arrancó con «${r1?.personaje}»`); continue; }
    if(r1.pasivo !== "carta-de-maestro" || r1.mazo.main.length !== 41
       || !r1.mazo.main.includes(r1.pasivoDatos?.carta)){
      mal(`${quien}: la carta del maestro entra al mazo`,
          `pasivo=${r1.pasivo} mazo=${r1.mazo.main.length}`); continue; }

    /* ── 2 · CONTACTOS EN LA ISLA ── */
    if(!abrirCon(quien)){ mal(`${quien}: se vuelve a poder elegir`); continue; }
    if(!ventaja(/contactos|sobre/i)){ mal(`${quien}: está la ventaja del sobre`); continue; }
    const fams = conClase(reino, "rFamilia");
    if(!fams.length){ mal(`${quien}: salen las familias del sobre`); continue; }
    fams[0].onclick?.();
    pulsar(reino, "Empezar");
    const r2 = H.run;
    const enBinder = (r2?.binder?.length ?? 0) + (r2?.binderExtra?.length ?? 0);
    if(r2?.pasivo !== "primer-sobre" || enBinder < 10){
      mal(`${quien}: el sobre se abre de verdad`,
          `pasivo=${r2?.pasivo} binder=${enBinder}`); continue; }

    /* ── 3 · MANO FIRME: se compara con y sin, misma semilla ── */
    /* ══ MANO FIRME SUBE PESOS, NO GARANTIZA CARTAS ══
       Sube un escalón la TABLA de rareza, así que con una sola semilla
       puede empatar por azar —le pasó a Mai, 23 contra 23— sin que nada
       esté roto. Se miden tres semillas y se compara el total: si el
       pasivo no hiciera nada, el total sería idéntico, no parecido. */
    const rarezasDe = (usarPasivo, semilla) => {
      abrirCon(quien);
      if(usarPasivo && !ventaja(/firme/i)) return null;
      /* La semilla se escribe a mano para que las dos medidas sean la
         misma partida: si no, se está comparando azar contra azar. */
      const inp = todos(reino).find(x => x.tagName === "input");
      if(inp) inp.value = semilla;
      pulsar(reino, "Empezar");
      const out = [];
      for(let i = 0; i < 22; i++){
        const ops = H.opciones(); if(!ops.length) break;
        const c = H.entrar(ops[0].id);
        if(["DUELO","ELITE","JEFE"].includes(c.tipo)){
          const r = H.resolverDuelo({ ganado:true, rivalId:c.rival?.id,
                                      elite:c.tipo === "ELITE" });
          for(const p of (r.premio ?? [])) out.push(VAL[p.rareza] ?? 0);
          if(r.premio?.length) H.cogerPremio(r.premio[0].code);
        }
        else if(c.tipo === "PREPARACION"){ H.elegirPreparacion("PACK"); H.abrirPack("ARCANE"); }
        else if(c.tipo === "PACK") H.abrirPack("ARCANE");
        else if(c.tipo === "CAMPAMENTO"){ if(!H.acampar("lp")?.ok) H.saltarNodo(); }
        else if(c.tipo === "EVENTO") H.elegirEnEvento(c.evento.opciones[0]);
        else H.saltarNodo();
      }
      return out.reduce((a,b) => a + b, 0);
    };
    let sin = 0, con = 0, falta = false;
    for(const k of [1,2,3]){
      const sem = `MF-${quien}-${k}`;
      const a = rarezasDe(false, sem), b = rarezasDe(true, sem);
      if(b == null){ falta = true; break; }
      sin += a; con += b;
    }
    if(falta){ mal(`${quien}: está la ventaja de mano firme`); continue; }
    if(!(con > sin)){
      mal(`${quien}: «mano firme» sube la rareza de las recompensas`,
          `sin ${sin}, con ${con} (tres semillas)`); continue; }

    ok(`${quien}: las tres ventajas funcionan pulsando botones (mazo 41 · binder ${enBinder} · rareza ${sin}→${con})`);
  }
}

console.log(`\n${fallos ? "FALLA: " + fallos : "Todo correcto"}`);
process.exit(fallos ? 1 : 0);
