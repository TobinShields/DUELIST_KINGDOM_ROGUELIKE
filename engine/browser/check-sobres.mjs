/* ══════════════════════════════════════════════════════════════════
   LA GUÍA DE SOBRES DICE LA VERDAD

   "¿En qué sobre sale Polymerization?" no se podía contestar sin abrir
   el código. Ahora hay una pantalla que lo dice — y lo que importa de
   ella es que salga de las MISMAS listas que reparte `abrirPack`, no de
   una segunda lista escrita a mano que se desincroniza en dos cambios.

   Por eso esta comprobación no mira la pantalla contra un texto
   esperado: coge cartas al azar de las listas del generador y exige que
   la guía las coloque donde de verdad están. Si alguien mueve una carta
   de familia y la guía no se entera, esto falla.

   Uso:  node check-sobres.mjs
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
writeFileSync("./out/_sob.mjs", html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]);
console.warn = () => {};
await import("./out/_sob.mjs");
await new Promise(r => setTimeout(r, 400));

let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t,d="") => { fallos++; console.log("  ✗ " + t + (d ? "   " + d : "")); };
console.log("\n═══ LA GUÍA DE SOBRES ═══\n");

const $ = id => document.getElementById(id);
function todos(n, out=[]){ if(!n) return out; out.push(n);
  for(const h of (n.children ?? [])) todos(h, out); return out; }
const conClase = (r,c) => todos(r).filter(x => x.classList?.contains?.(c));
const botones = r => todos(r).filter(x => x.tagName === "button");
const texto = n => {
  if(!n) return "";
  const h = n.children ?? [];
  if(!h.length) return String(n.textContent ?? "").trim();
  return h.map(texto).filter(Boolean).join(" ").trim() || String(n.textContent ?? "").trim();
};

$("irReino").onclick?.();
const reino = $("reino");
const R = globalThis.__REINO_PRUEBA__;
if(!R){ mal("el gancho de prueba del Reino existe"); process.exit(1); }
const H = R.H;
H.empezar({ semilla:"SOBRES", personaje:"yugi" });
R.alMapa();

/* ── 1 · SE LLEGA A LA GUÍA DESDE LA BARRA ── */
const abrirGuia = () => {
  R.alMapa();
  /* Por lo que DICE, no por el texto exacto: la etiqueta pasó de
     «Sobres» a «Qué sale en cada sobre» porque nadie encontraba el
     botón, y un test que asertaba la cadena literal se puso rojo sin
     que nada estuviera roto. */
  /* Y entre los botones de la BARRA: la semilla de esta prueba se llama
     "SOBRES" y el primer `find` se llevaba el botón de copiar semilla. */
  const b = botones(reino).find(x => /\brBtn\b/.test(x.className ?? "")
    && /sobre/i.test(texto(x)) && !/mazo|binder/i.test(texto(x)));
  b?.onclick?.();
  return !!b;
};
if(!abrirGuia()) mal("hay un botón «Sobres» en la barra del Reino");
else if(!conClase(reino,"rSobres").length) mal("y abre la guía");
else ok("se llega a la guía desde la barra del Reino");

/* ── 2 · LOS CINCO SOBRES SE PUEDEN ABRIR ── */
{
  const fams = conClase(reino,"rFamilia");
  if(fams.length !== 5) mal("están los cinco sobres", `hay ${fams.length}`);
  else {
    let conContenido = 0;
    for(let i = 0; i < 5; i++){
      abrirGuia();
      conClase(reino,"rFamilia")[i]?.onclick?.();
      if(conClase(reino,"rCarta").length > 0) conContenido++;
    }
    if(conContenido !== 5)
      mal("los cinco enseñan sus cartas", `solo ${conContenido} de 5`);
    else ok("los cinco sobres se abren y enseñan sus cartas");
  }
}

/* ── 3 · LA BÚSQUEDA CONTESTA LA PREGUNTA DE E ──
   "Polymerization → pack(s) donde está → rareza/slot aproximado". */
{
  abrirGuia();
  const inp = todos(reino).find(x => x.tagName === "input");
  if(!inp) mal("hay un buscador");
  else {
    inp.value = "Polymerization";
    botones(reino).find(x => texto(x) === "Buscar")?.onclick?.();
    const filas = conClase(reino,"rResultado");
    if(!filas.length) mal("buscar «Polymerization» encuentra algo");
    else {
      const t = texto(filas[0]);
      if(!/Polymerization/i.test(t))
        mal("y el primer resultado es la carta buscada", t.slice(0,60));
      else if(!conClase(filas[0],"rDonde").length)
        mal("y dice en qué sobre sale");
      else ok(`buscar Polymerization dice dónde sale: «${texto(conClase(filas[0],"rDonde")[0]).slice(0,70)}»`);
    }
  }
}

/* ── 4 · Y NO ES UNA LISTA APARTE: SALE DEL GENERADOR ──
   Se cogen cartas de las listas REALES y se comprueba que la guía las
   coloque en su sitio. Si alguien mueve una carta de familia, esto se
   entera; una lista duplicada a mano, no. */
{
  const POOLS = JSON.parse(readFileSync("../data/story/cards.json","utf-8"));
  const FAM = { ARCANE:"arcane", WARRIOR:"warrior", DRAGON:"dragon",
                RECRUIT:"recruit", FORBID:"forbid" };
  const cat = globalThis.__CAT_PRUEBA__ ?? null;
  let comprobadas = 0, malas = [];
  for(const [id, clave] of Object.entries(FAM)){
    const lista = POOLS[clave] ?? [];
    /* Tres al azar pero deterministas: la primera, la de en medio y la
       última, que además pilla los bordes. */
    for(const c of [lista[0], lista[(lista.length/2)|0], lista[lista.length-1]]){
      if(c == null) continue;
      comprobadas++;
      const donde = H.dondeSale?.(c) ?? [];
      if(!donde.some(d => d.pack === id))
        malas.push(`${c} debería salir en ${id}`);
    }
  }
  if(!comprobadas) mal("se han podido comprobar cartas contra las listas del generador");
  else if(malas.length)
    mal(`las ${comprobadas} cartas de muestra salen donde dicen las listas`,
        malas.slice(0,3).join(" · "));
  else ok(`las ${comprobadas} cartas de muestra salen exactamente donde dicen las listas del generador`);
}

/* ══════════════════════════════════════════════════════════════════
   ASOMARSE AL SOBRE ANTES DE ABRIRLO

   Elegir un sobre es irreversible y se estaba eligiendo a ciegas: la
   guía existía, pero en otra pantalla. E lo pidió así: hover en PC y un
   botón o una pantalla en móvil, antes de la selección final.

   Aquí se comprueba con BOTONES, no con la API: el bug de los duelos de
   última oportunidad fue exactamente eso —la API los ofrecía y la
   pantalla no los dibujaba, y simular contra la API daba cero
   problemas—. Y se exige el gesto táctil, porque el dedo no tiene
   hover: si el panel solo se abre con `onmouseenter`, en un móvil no
   existe.
   ══════════════════════════════════════════════════════════════════ */
{
  /* Se lleva la run a un nodo de sobre de verdad. */
  R.alMapa();
  let nodo = null;
  for(let i = 0; i < 40 && !nodo; i++){
    const ops = H.opciones(); if(!ops.length) break;
    const pack = ops.find(o => o.tipo === "PACK");
    const c = R.entrar((pack ?? ops[0]).id);
    if(c.tipo === "PACK"){ nodo = c; break; }
    if(["DUELO","ELITE","JEFE"].includes(c.tipo))
      H.resolverDuelo({ ganado:true, rivalId:c.rival?.id, elite:c.tipo==="ELITE" });
    else if(c.tipo === "EVENTO") H.elegirEnEvento(c.evento.opciones[0]);
    else if(c.tipo === "CAMPAMENTO"){ if(!H.acampar("lp")?.ok) H.saltarNodo(); }
    else H.saltarNodo();
    R.alMapa();
  }
  if(!nodo) mal("se llega a un nodo de sobre");
  else {
    const ojos = conClase(reino,"rVerPool");
    if(ojos.length !== 5)
      mal("cada sobre tiene su botón para mirarlo", `hay ${ojos.length}`);
    else ok(`los cinco sobres tienen botón para mirarlos sin abrirlos`);

    /* El botón, con el dedo: pulsarlo NO puede gastar el sobre. */
    const antesBinder = H.estado().binder;
    ojos[1]?.onclick?.();
    const espia = conClase(reino,"rEspia");
    if(!espia.length) mal("y al pulsarlo se ve el contenido del sobre");
    else if(H.estado().binder !== antesBinder)
      mal("y mirarlo NO abre el sobre", `el binder pasó de ${antesBinder} a ${H.estado().binder}`);
    else {
      const cartas = conClase(espia[0],"rCartaMini").length
                  || todos(espia[0]).filter(x => x.tagName === "img").length;
      if(!cartas) mal("y el panel enseña cartas de verdad");
      else ok(`el panel enseña ${cartas} cartas del sobre y no lo gasta`);
    }

    /* Y en PC, el mismo panel al pasar el ratón. */
    const packs = conClase(reino,"rFamilia");
    if(!packs.some(p => typeof p.onmouseenter === "function"))
      mal("en PC el sobre se abre también al pasar el ratón");
    else ok("en PC el sobre se abre también al pasar el ratón");

    /* La puerta a la guía completa desde aquí. */
    if(!botones(reino).some(b => /guía completa/i.test(texto(b))))
      mal("y hay puerta a la guía completa desde el nodo de sobre");
    else ok("y hay puerta a la guía completa desde el nodo de sobre");

    /* ══ EL BOTÓN DE SALIR TIENE QUE DECIR LO QUE HACE ══
       Ponía «Seguir sin usarlo» en la pantalla de elegir sobre, que no
       quiere decir nada: lo que decides es no abrir ninguno. */
    if(botones(reino).some(b => /sin usarlo|without using/i.test(texto(b))))
      mal("el botón de salir del sobre no dice «seguir sin usarlo»");
    else ok("el botón de salir del sobre dice a dónde va");
  }
}

/* ══════════════════════════════════════════════════════════════════
   UN SOLO VISOR, Y QUE EL RATÓN NO REPINTE

   Dos fallos que E vio a la vez y que tienen la misma forma: la
   pantalla se monta con funciones que se llaman más de una vez.

   1 · `conPanel()` se llamaba una vez POR SECCIÓN, así que la guía
       creaba TRES visores de carta. `panel` es una sola variable del
       módulo y se quedaba con el último: de los tres, solo funcionaba
       el de abajo. Da igual cuántas listas haya — visor hay uno.
   2 · el `onmouseenter` del sobre llamaba a `pintar()`, que rehace la
       pantalla entera, destruye el botón bajo el ratón y crea otro en
       su sitio; el navegador dispara `mouseenter` sobre el nuevo y
       vuelta a empezar. Eso es el parpadeo. Regla: una respuesta al
       ratón no repinta la pantalla que contiene al elemento que la
       disparó.
   ══════════════════════════════════════════════════════════════════ */
{
  abrirGuia();
  const fam = conClase(reino,"rFamilia").find(b => b.dataset?.id);
  fam?.onclick?.();
  const visores = conClase(reino,"rPanel");
  if(visores.length !== 1)
    mal("la guía tiene UN solo visor de carta", `hay ${visores.length}`);
  else ok("la guía tiene un solo visor de carta, compartido por las tres listas");

  /* Y las tres listas siguen ahí: un visor no puede costar contenido. */
  const etiquetas = conClase(reino,"mlab").map(texto);
  const tiene = t => etiquetas.some(x => new RegExp(t,"i").test(x));
  if(!(tiene("family|familia") && tiene("rarity|rareza") && tiene("premium")))
    mal("y siguen las tres listas", etiquetas.join(" · "));
  else ok("y siguen las tres listas: familia, rareza y premium");

  /* Hovering una carta de la PRIMERA lista tiene que llenar ese visor:
     es justo lo que no pasaba, porque el visor bueno era el de abajo. */
  const cartas = conClase(reino,"rCarta");
  if(!cartas.length) mal("hay cartas en la guía");
  else {
    cartas[0].onmouseenter?.();
    const v = conClase(reino,"rPanel")[0];
    if(!v?.classList?.contains?.("abierto"))
      mal("y pasar el ratón por una carta de la primera lista lo llena");
    else ok("y pasar el ratón por una carta de la primera lista lo llena");
  }

  /* ── ENTER BUSCA ── */
  const caja = conClase(reino,"rInput")[0];
  if(!caja) mal("hay caja de búsqueda");
  else if(typeof caja.onkeydown !== "function")
    mal("y se busca con Enter, no solo con el botón");
  else {
    caja.value = "Polymerization";
    caja.onkeydown({ key:"Enter", preventDefault(){} });
    const salio = conClase(reino,"rResultado").length;
    if(!salio) mal("y Enter dispara la búsqueda de verdad");
    else ok(`Enter dispara la búsqueda (${salio} resultado(s))`);
  }

  /* ── EL HOVER NO PUEDE REPINTAR ── */
  const js = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  const i = js.indexOf("function nodoPack(");
  const cuerpo = js.slice(i, js.indexOf("\n  function ", i + 20));
  if(/onmouseenter\s*=\s*\(\)\s*=>\s*\{[\s\S]{0,200}?pintar\(\)/.test(cuerpo))
    mal("el hover del sobre no repinta la pantalla",
        "repintar destruye el botón de debajo del ratón y el evento se dispara en bucle");
  else ok("el hover del sobre rellena el panel sin repintar: no parpadea");
}

console.log(`\n${fallos ? "FALLA: " + fallos : "Todo correcto"}`);
process.exit(fallos ? 1 : 0);
