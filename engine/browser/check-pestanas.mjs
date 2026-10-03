/* ══════════════════════════════════════════════════════════════════
   MAZO · BINDER · EXTRA — LAS TRES SON NAVEGABLES

   Esta comprobación existe porque la anterior no servía: miraba que el
   CSS y los botones ESTUVIERAN, y estaban. Lo que fallaba era otra cosa
   —los tres paneles se pintaban y dos se ocultaban con una clase que
   vivía dentro de `@media (pointer:coarse)`; si esa condición no casaba,
   no se ocultaba nada y tampoco salían las pestañas—. El resultado era
   "solo puedo ver el Deck", con el binder a cuarenta cartas de scroll.

   Así que aquí NO se lee CSS. Se monta la pantalla de verdad, se PULSAN
   las pestañas y se mira QUÉ CARTAS hay pintadas después de cada
   pulsación. Si una carta que solo está en el binder no aparece al
   entrar en el binder, falla.

   Uso:  node check-pestanas.mjs
   ══════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";
import { installDOM } from "./domstub.mjs";
globalThis.GOAT_SEED = 20050401;
installDOM();
/* Con el dedo: es donde vive el modo pestañas. */
globalThis.matchMedia = q => ({ matches: /coarse/.test(q), media:q,
                                addListener(){}, removeListener(){} });
globalThis.innerWidth = 412;          // Android en vertical

const mem = new Map();
global.localStorage = {
  getItem: k => k==="goatConfig" ? '{"idioma":"es"}' : (mem.get(k) ?? null),
  setItem: (k,v) => mem.set(k,v), removeItem: k => mem.delete(k),
};
const html = readFileSync("./out/goat.html","utf-8");
const { writeFileSync } = await import("node:fs");
writeFileSync("./out/_pest.mjs", html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]);
console.warn = () => {};
await import("./out/_pest.mjs");
await new Promise(r=>setTimeout(r,400));

let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t,d="") => { fallos++; console.log("  ✗ " + t + (d?"   "+d:"")); };
console.log("\n═══ MAZO · BINDER · EXTRA ═══\n");

const $ = id => document.getElementById(id);
function todos(n, out=[]){ if(!n) return out; out.push(n);
  for(const h of (n.children ?? [])) todos(h, out); return out; }
const conClase = (r,c) => todos(r).filter(x => x.classList?.contains?.(c));
const botones  = r => todos(r).filter(x => x.tagName === "button");

/* ── montar una run con cartas en las tres colecciones ── */
$("irReino").onclick?.();
const reino = $("reino");
botones(reino).find(b => (b.textContent||"").includes("Empezar"))?.onclick?.();

const H = globalThis.__REINO_PRUEBA__ ?? null;   // no expuesto: se usa la UI
/* Se abre el editor desde la barra. */
botones(reino).find(b => (b.textContent||"").includes("Mazo y binder"))?.onclick?.();

/* Los nombres que hay en cada colección, leídos de la propia pantalla. */
const nombresPintados = () =>
  conClase(reino, "rNom").map(x => (x.textContent||"").trim()).filter(Boolean);
const pestaña = cual =>
  botones(reino).find(b => b.dataset?.coleccion === cual);

/* ── 1 · las tres pestañas existen y son pulsables ── */
const tabs = ["mazo","binder","extra"].map(pestaña);
if(tabs.some(t => !t)) mal("las tres pestañas están en la pantalla",
  ["mazo","binder","extra"].filter((c,i)=>!tabs[i]).join(", "));
else ok("las tres pestañas están: mazo, binder y extra");

/* ── 2 · SOLO se pinta una colección a la vez ── */
{
  const paneles = conClase(reino, "rMitad");
  if(paneles.length !== 1) mal("con el dedo se pinta UNA sola colección",
    `hay ${paneles.length} paneles en el DOM`);
  else ok("con el dedo solo existe en el DOM el panel de la colección activa");
}

/* ── 3 · cambiar de pestaña cambia las CARTAS, no solo el resaltado ── */
{
  const delMazo = nombresPintados();
  if(!delMazo.length) mal("el mazo enseña sus cartas");
  else ok(`el mazo enseña sus cartas (${delMazo.length}: ${delMazo.slice(0,3).join(", ")}…)`);

  pestaña("binder")?.onclick?.();
  const delBinder = nombresPintados();
  /* El binder de una run recién empezada está vacío: lo que tiene que
     salir es el estado vacío, no las cartas del mazo. */
  const textoAhora = todos(reino).map(x=>x.textContent??"").join(" ");
  if(delBinder.some(n => delMazo.includes(n)) && delBinder.length)
    mal("al entrar en el binder ya no se ven las cartas del mazo",
        delBinder.filter(n=>delMazo.includes(n)).slice(0,3).join(", "));
  else if(!delBinder.length && !/Todavía no has ganado|haven't won/.test(textoAhora))
    mal("el binder vacío lo dice", textoAhora.slice(0,80));
  else ok(delBinder.length
    ? `el binder enseña SUS cartas (${delBinder.length})`
    : "el binder vacío lo dice en vez de enseñar el mazo");

  pestaña("extra")?.onclick?.();
  const t2 = todos(reino).map(x=>x.textContent??"").join(" ");
  const delExtra = nombresPintados();
  if(!delExtra.length && !/Extra Deck|Todavía no tienes/.test(t2))
    mal("el extra enseña sus cartas o dice que está vacío", t2.slice(0,80));
  else ok(delExtra.length ? `el extra enseña sus cartas (${delExtra.length})`
                          : "el extra vacío lo dice en vez de esconderse");

  pestaña("mazo")?.onclick?.();
  const vuelta = nombresPintados();
  if(vuelta.join() !== delMazo.join())
    mal("volver al mazo enseña otra vez el mazo",
        `${vuelta.length} cartas en vez de ${delMazo.length}`);
  else ok("volver al mazo enseña otra vez el mazo, con las mismas cartas");
}

/* ── 4 · el botón − saca una carta y el contador cambia ── */
{
  const antes = nombresPintados().length;
  const menos = conClase(reino, "rMover")[0];
  if(!menos) mal("cada carta tiene su botón de mover");
  else {
    menos.onclick?.({ stopPropagation(){} });
    const ahora = nombresPintados().length;
    if(ahora !== antes - 1) mal("el botón − saca una carta del mazo",
      `${antes} → ${ahora}`);
    else ok(`el botón − saca una carta del mazo (${antes} → ${ahora})`);

    /* La cuenta va en un <span> hijo, no en el texto del botón: el DOM
       simulado no compone `textContent` a partir de los hijos, así que
       se lee el hijo directamente. */
    const spanN = (pestaña("mazo")?.children ?? []).find(x => x._cls?.has?.("rTabN"));
    if(String(spanN?.textContent) !== String(ahora))
      mal("el contador de la pestaña se actualiza", `dice ${spanN?.textContent}, debería ${ahora}`);
    else ok(`el contador de la pestaña se actualiza al momento (${ahora})`);

    /* ── 5 · y desde el binder se puede volver a meter ── */
    pestaña("binder")?.onclick?.();
    const enBinder = nombresPintados();
    if(!enBinder.length) mal("la carta que sacaste aparece en el binder");
    else {
      ok(`la carta que sacaste aparece en el binder (${enBinder[0]})`);
      const mas = conClase(reino, "rMover")[0];
      mas?.onclick?.({ stopPropagation(){} });
      pestaña("mazo")?.onclick?.();
      const final = nombresPintados().length;
      if(final !== antes) mal("volver a meterla deja el mazo como estaba",
        `${final} en vez de ${antes}`);
      else ok(`bajar a ${ahora}, ir al binder, añadir y volver a ${final}: el ciclo entero funciona`);
    }
  }
}

/* ── 6 · con ratón y pantalla ancha se ven las tres a la vez ── */
{
  globalThis.matchMedia = q => ({ matches:false, media:q, addListener(){}, removeListener(){} });
  globalThis.innerWidth = 1400;
  pestaña("mazo")?.onclick?.();          // repinta
  const paneles = conClase(reino, "rMitad");
  const tabsAhora = ["mazo","binder","extra"].map(pestaña).filter(Boolean);
  if(paneles.length !== 3) mal("en pantalla ancha se ven las tres colecciones",
    `hay ${paneles.length}`);
  else if(tabsAhora.length) mal("en pantalla ancha no hacen falta pestañas");
  else ok("en pantalla ancha se ven las tres colecciones a la vez, sin pestañas");
}

/* ══════════════════════════════════════════════════════════════════
   MOVER UNA CARTA NO PUEDE PERDER DÓNDE ESTABAS

   Cada `+`/`−` repinta la pantalla entera. Con el binder lleno eso
   significaba volver arriba del todo y, si había un filtro puesto,
   perderlo. E lo pidió explícito: pestaña activa, scroll y filtros
   sobreviven a mover una carta.
   ══════════════════════════════════════════════════════════════════ */
{
  /* Un binder con cartas de sobra para que haya scroll y filtros. */
  const R2 = globalThis.__REINO_PRUEBA__, H2 = R2?.H;
  if(!H2){ mal("el gancho de prueba del Reino existe"); }
  else {
  for(let i = 0; i < 6; i++) H2.abrirPack("FORBID");
  R2.alMapa();
  botones(reino).find(b => (b.textContent||"").includes("Mazo y binder"))?.onclick?.();

  /* 1 · el filtro se queda puesto al mover una carta */
  const filtroMonstruos = conClase(reino,"rFiltro").find(b => b.dataset?.filtro === "MONSTRUO");
  if(!filtroMonstruos) mal("hay filtros por tipo en Mazo y binder");
  else {
    filtroMonstruos.onclick?.();
    const activoAntes = conClase(reino,"rFiltro").find(b => b.classList.contains("on"))?.dataset?.filtro;
    /* Se mueve una carta: eso repinta. */
    const carta = conClase(reino,"rCarta")[0];
    const accion = todos(reino).filter(x => x.tagName === "button")
      .find(b => /^[+−-]$/.test((b.textContent||"").trim()));
    /* Los manejadores hacen `e.stopPropagation()`: hay que pasarles
       un evento, aunque sea de mentira. */
    const ev = { stopPropagation(){}, preventDefault(){} };
    (accion ?? carta)?.onclick?.(ev);
    const activoDespues = conClase(reino,"rFiltro").find(b => b.classList.contains("on"))?.dataset?.filtro;
    if(activoAntes !== activoDespues)
      mal("el filtro sobrevive a mover una carta", `${activoAntes} → ${activoDespues}`);
    else ok(`el filtro sobrevive a mover una carta (${activoDespues})`);
  }

  /* 2 · la pestaña activa también */
  const irBinder = conClase(reino,"rTab").find(b => /binder/i.test(b.textContent||""));
  if(irBinder){
    irBinder.onclick?.();
    const antes = conClase(reino,"rTab").find(b => b.classList.contains("on"))?.dataset?.coleccion;
    conClase(reino,"rCarta")[0]?.onclick?.({ stopPropagation(){}, preventDefault(){} });
    const despues = conClase(reino,"rTab").find(b => b.classList.contains("on"))?.dataset?.coleccion;
    if(antes !== despues) mal("la pestaña activa sobrevive", `${antes} → ${despues}`);
    else ok(`la pestaña activa sobrevive a mover una carta (${despues})`);
  }

  /* 3 · y el scroll se guarda por pestaña, no en una sola variable */
  const js2 = readFileSync("./out/goat.html","utf-8");
  if(!/scrollPorTab/.test(js2)) mal("el scroll se recuerda");
  else if(!/scrollPorTab\[recordarScroll\] = /.test(js2))
    mal("y se guarda POR pestaña, no en una variable única");
  else ok("el scroll se recuerda por pestaña");
  }
}

/* ══════════════════════════════════════════════════════════════════
   EL BUSCADOR, LOS FILTROS DE TIPO Y ATRIBUTO, Y VACIAR EL MAZO
   E, 03-10: «el buscador del binder no funciona» (solo filtraba al
   pulsar «Filtrar»: escribir y Enter no hacían nada), «filtrar por tipo
   de monstruo o por atributo» y «un botón de borrar todo el mazo con un
   ¿estás seguro?».
   ══════════════════════════════════════════════════════════════════ */
{
  const nombresVisibles = () => conClase(reino,"rNom").map(n => n.textContent || "");
  const cuentaTab = cual => Number(conClase(reino,"rTab")
    .find(b => b.dataset?.coleccion === cual)?.children?.find?.(x => x.classList?.contains("rTabN"))?.textContent
    ?? conClase(reino,"rTabN")[["mazo","binder","extra"].indexOf(cual)]?.textContent ?? NaN);
  conClase(reino,"rTab").find(b => b.dataset?.coleccion === "mazo")?.onclick?.();
  conClase(reino,"rFiltro").find(b => b.dataset?.filtro === "todo")?.onclick?.();
  const antes = nombresVisibles();
  const objetivo = antes.find(n => n.length > 6) ?? "";
  const q = objetivo.slice(0, 5);
  const inp = conClase(reino,"rBuscaCarta")[0];
  if(!inp) mal("hay buscador en Mazo y binder");
  else {
    inp.value = q;
    inp.oninput?.({ target:{ value:q } });
    await new Promise(r => setTimeout(r, 250));
    const despues = nombresVisibles();
    if(!despues.length || despues.length >= antes.length || despues.some(n => !n.toLowerCase().includes(q.toLowerCase())))
      mal("escribir en el buscador filtra sin pulsar nada", `"${q}": ${antes.length} → ${despues.length}`);
    else ok(`escribir filtra al momento ("${q}": ${antes.length} → ${despues.length} cartas)`);
    /* …y sin repintar la pantalla: el campo tiene que ser el mismo. */
    if(conClase(reino,"rBuscaCarta")[0] !== inp) mal("filtrar no destruye el campo de texto (se perdería el teclado)");
    else ok("filtrar mientras escribes no destruye el campo de texto");
    inp.value = ""; inp.oninput?.({ target:{ value:"" } });
    await new Promise(r => setTimeout(r, 250));
  }

  const raza = conClase(reino,"rFiltroRaza")[0], atr = conClase(reino,"rFiltroAtributo")[0];
  if(!raza || !atr) mal("hay filtro de tipo de monstruo y de atributo");
  else {
    const total = nombresVisibles().length;
    raza.onchange?.({ target:{ value:String(0x2) } });          // Mago
    const magos = nombresVisibles().length;
    conClase(reino,"rFiltroAtributo")[0].onchange?.({ target:{ value:String(0x10) } });   // LUZ
    const magosLuz = nombresVisibles().length;
    if(!(magos > 0 && magos < total && magosLuz <= magos))
      mal("los filtros de tipo y atributo reducen la lista", `${total} → ${magos} → ${magosLuz}`);
    else ok(`tipo y atributo filtran (${total} → Mago ${magos} → Mago LUZ ${magosLuz})`);
    todos(reino).filter(x => x.tagName === "button")
      .find(b => (b.textContent||"").includes("Quitar filtros"))?.onclick?.();
  }

  const vaciar = conClase(reino,"rVaciarMazo")[0];
  const enMazo = () => globalThis.__REINO_PRUEBA__?.H?.run?.mazo?.main?.length ?? cuentaTab("mazo");
  if(!vaciar) mal("hay botón de vaciar el mazo");
  else {
    const n0 = enMazo();
    vaciar.onclick?.();
    const sigue = enMazo();
    const si = conClase(reino,"rVaciarSi")[0];
    if(sigue !== n0 || !si) mal("vaciar el mazo pide confirmación antes", `${n0} → ${sigue}`);
    else {
      conClase(reino,"rVaciarNo")[0]?.onclick?.();
      if(enMazo() !== n0) mal("cancelar no toca el mazo");
      conClase(reino,"rVaciarMazo")[0]?.onclick?.();
      conClase(reino,"rVaciarSi")[0]?.onclick?.();
      if(enMazo() !== 0) mal("confirmar vacía el mazo", `quedan ${enMazo()}`);
      else ok(`vaciar el mazo pide confirmación y devuelve las ${n0} cartas al binder`);
    }
  }
}

console.log(`\n${fallos ? "FALLA: "+fallos : "Todo correcto"}`);
process.exit(fallos ? 1 : 0);
