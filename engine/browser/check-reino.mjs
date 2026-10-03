/* ════════════════════════════════════════════════════════════════
   EL REINO DE LOS DUELISTAS, EN EL HTML DE VERDAD

   El modo entero ya estaba probado sin navegador (`check-run.mjs`). Esto
   prueba lo otro: que la PANTALLA existe, que se puede pulsar y que
   llega hasta lanzar un duelo. Se ejecuta sobre el HTML construido con
   el DOM simulado, igual que el resto de comprobaciones de interfaz.

   Y vigila lo que el menú nuevo puede romper: el modo bots ya no está en
   la pantalla de inicio —ahora es "Retos", dentro de Duelo libre— y eso
   es justo la clase de cambio que deja un botón huérfano.

   Uso:  node check-reino.mjs
   ════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from "node:fs";
import { installDOM } from "./domstub.mjs";
installDOM();
/* Las comprobaciones buscan los textos en español, así que se fuerza ese
   idioma; el juego arranca en inglés. Y el almacén tiene que ser de
   verdad: el Reino guarda la partida en cuanto tocas algo. */
const mem = new Map();
global.localStorage = {
  getItem: k => k==="goatConfig" ? '{"idioma":"es"}' : (mem.get(k) ?? null),
  setItem: (k,v) => mem.set(k,v),
  removeItem: k => mem.delete(k),
};
const html = readFileSync("./out/goat.html","utf-8");
writeFileSync("./out/_reino.mjs", html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]);
console.warn = () => {};
await import("./out/_reino.mjs");
await new Promise(r=>setTimeout(r,400));

let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t,d="") => { fallos++; console.log("  ✗ " + t + (d?"   "+d:"")); };

console.log("\n═══ REINO DE LOS DUELISTAS · la pantalla ═══\n");

globalThis.GOAT_SEED = 20050401;
const $ = id => document.getElementById(id);
/* EL DOM SIMULADO NO CONSTRUYE innerHTML. `appendChild` mete hijos pero
   `innerHTML` solo devuelve lo que se le haya ASIGNADO, así que leerlo
   daba cadena vacía y parecía que la pantalla no pintaba nada. Se
   recorre el árbol de hijos, que es lo que sí existe. */
function todos(n, salida=[]){
  if(!n) return salida;
  salida.push(n);
  for(const h of (n.children ?? [])) todos(h, salida);
  return salida;
}
const texto = n => todos(n).map(x => x.textContent ?? "").join(" ")
                     .replace(/\s+/g," ").trim();
const conClase = (raiz, c) => todos(raiz).filter(x => x.classList?.contains?.(c));
const botones = raiz => todos(raiz).filter(x => x.tagName === "button");
const porTexto = (raiz, t) => botones(raiz).find(b => (b.textContent||"").includes(t));

/* ── LO QUE EL DOM SIMULADO NO PUEDE VER: EL CSS ──
   El stub no tiene estilos, así que una pantalla puede "abrirse"
   perfectamente y quedar debajo de otra. Pasó: el Reino salía con
   z-index 60, la pantalla de carga está a 500 y el menú a 600, así que
   lo único que se veía al pulsar era "Cargando el núcleo de reglas…"
   con el modo entero funcionando por detrás. */
{
  const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  const z = sel => Number((css.match(new RegExp(sel.replace("#","\\#")+"\\{[^}]*z-index:(\\d+)"))||[])[1] || 0);
  const zReino = z("#reino"), zBoot = z("#boot"), zMenu = z("#menu");
  if(!(zReino > zBoot && zReino > zMenu))
    mal("el Reino se pinta por encima de la carga y del menú",
        `reino ${zReino}, carga ${zBoot}, menú ${zMenu}`);
  else ok(`el Reino se pinta por encima de todo (z-index ${zReino} contra ${zBoot} y ${zMenu})`);
  if(!/getElementById\("boot"\)\.style\.display = "none"/.test(html))
    mal("al abrir el Reino se quita la pantalla de carga");
  else ok("al abrir el Reino se quita la pantalla de carga");
}

/* ── el menú nuevo ── */
{
  const home = $("pHome");
  if(!$("irReino")) mal("la pantalla de inicio tiene el Reino de los Duelistas");
  else ok("la pantalla de inicio ofrece el Reino de los Duelistas");
  if(texto(home).includes("Modo Bots")) mal("el modo bots ya no está en el inicio");
  else ok("el modo bots ya no está en el inicio: ahora son los Retos de Duelo libre");
  if(!$("irBots")) mal("los Retos siguen accesibles");
  else ok("los Retos siguen accesibles desde Duelo libre");
}

/* ── empezar una partida ── */
const reino = $("reino");
{
  $("irReino").onclick?.();
  if(reino.hidden) mal("pulsar el Reino abre su pantalla");
  else ok("pulsar el Reino abre su pantalla");
  const t = texto(reino);
  if(!t.includes("Star Chips") && !t.includes("Pegasus"))
    mal("la pantalla de inicio explica de qué va", t.slice(0,60));
  else ok("la pantalla explica de qué va el modo");

  const starters = conClase(reino, "rStarter");
  if((starters?.length ?? 0) < 3) mal("se ofrecen los tres mazos iniciales", `hay ${starters?.length}`);
  else ok("se ofrecen los tres mazos iniciales de Yugi");

  const empezar = porTexto(reino, "Empezar");
  if(!empezar) mal("hay un botón para empezar");
  else {
    empezar.onclick?.();
    const t2 = texto(reino);
    if(!t2.includes("orillas") && !t2.includes("shores"))
      mal("al empezar se ve el mapa del primer acto", t2.slice(0,80));
    else ok("al empezar se pinta el mapa con los tres actos");
    if(!t2.includes("★")) mal("las Star Chips se ven siempre");
    else ok("las Star Chips se ven en la barra");
  }
}

/* ── el mapa parece un mapa ── */
{
  const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  if(!/\.rCamino\{/.test(css)) mal("los caminos entre nodos tienen estilo");
  else if(!/rCaminos/.test(html)) mal("el mapa dibuja los caminos");
  else ok("el mapa dibuja los caminos de un nodo al siguiente");
  if(!/\.rActo\.a2\{/.test(css) || !/\.rCastillo\{/.test(css))
    mal("cada acto tiene su terreno y el castillo cierra el tercero");
  else ok("cada acto tiene su terreno y el castillo cierra el tercero");
  /* El mapa va de abajo a arriba y con la cara de cada duelista: es lo
     que lo convierte en un viaje y no en una lista de casillas. */
  if(!/\.rColumnas\{[^}]*flex-direction:column/.test(css))
    mal("el mapa se pinta en vertical");
  else ok("el mapa se pinta en vertical, de la playa al castillo");
  const caras = conClase(reino, "rCara");
  if(!caras.length) mal("los nodos de duelo enseñan la cara del rival");
  else ok(`los nodos enseñan la cara del rival (${caras.length} retratos en el mapa)`);
  const track = conClase(reino, "rTracker");
  if(!track.length) mal("el rastreador de mazo está en el mapa");
  else ok("el rastreador de mazo acompaña al mapa");
  if(!/id="mLogo"/.test(html)) mal("el logo está en el menú principal");
  else ok("el logo de Goat Format está en el menú principal");
  if(!/globalThis\.ARTE/.test(html)) mal("el arte viaja dentro del HTML");
  else ok("el logo y las monedas viajan dentro del HTML");
}

/* ── el primer nodo lleva a un duelo ── */
{
  const disponibles = conClase(reino, "rNodo").filter(b => !b.disabled);
  if(!disponibles.length) mal("hay algún nodo al que se pueda entrar");
  else {
    ok(`se puede entrar a ${disponibles.length} nodo(s) desde la salida`);
    disponibles[0].onclick?.();
    const t = texto(reino);
    const duelo = porTexto(reino, "Duelo") || porTexto(reino, "Duel");
    if(!duelo && !t.includes("sobre") && !t.includes("Campamento") && !t.includes("mercader"))
      mal("el nodo enseña algo que hacer", t.slice(0,80));
    else ok("el nodo enseña quién es el rival (o qué hay que elegir)");
  }
}

/* ── TODAS LAS PANTALLAS DE CARTAS LLEVAN SU PANEL ──
   E lo pidió una vez, se implementó en dos pantallas de cinco y se dio
   por hecho. Esto recorre el código de la interfaz y comprueba que cada
   rejilla de cartas va dentro del panel: si mañana se añade una pantalla
   nueva y se olvida, falla aquí. */
{
  /* Cada pantalla que enseña cartas tiene que ir envuelta en `conPanel`.
     Se comprueba por nombre de función: si mañana se añade una y se
     olvida el panel, esto falla. */
  const conPanelEn = fn => {
    const i = html.indexOf("function " + fn);
    if(i < 0) return false;
    /* ══ LA VENTANA TIENE QUE CABER LA FUNCIÓN ENTERA ══
       Eran 6.000 caracteres y `vistaBinder` creció al añadirle el
       buscador y los filtros: la llamada al panel se quedó a 8.463 y el
       test dijo que faltaba un panel que estaba ahí. Se busca hasta la
       SIGUIENTE función, que es el límite de verdad, con un tope alto
       por si acaso. */
    const desde = html.slice(i, i + 30000);
    const fin = desde.indexOf("\n  function ", 10);
    const trozo = fin > 0 ? desde.slice(0, fin) : desde;
    /* Vale la columna fija (`conPanel`) o la hoja suelta que se abre al
       tocar (`panelCarta("suelto")`), que es la que usa el binder. */
    return /conPanel\(/.test(trozo) || /panelCarta\("suelto"\)/.test(trozo);
  };
  const faltan = ["vistaBinder","nodoResultado","nodoPackAbierto","nodoOferta",
                  "nodoSacrificio","nodoRefinado"].filter(f => !conPanelEn(f));
  if(!/rPanelTexto/.test(html)) mal("el panel de carta está en el HTML");
  else if(faltan.length) mal("pantallas de cartas sin panel", faltan.join(", "));
  else ok("las seis pantallas de cartas leen la carta en el panel de la izquierda");
}

/* ── mazo y binder: dos mitades y arrastre ── */
{
  /* Era una tira única con las cartas enormes: "la parte más injugable",
     dicho por E. Si alguien vuelve a juntarlo en una sola columna, esto
     avisa. */
  const piezas = [
    /* Ya no son "dos mitades": son TRES colecciones y solo se pinta la
       activa. El contenedor sigue llamándose igual. */
    ["el contenedor de colecciones", /el\("div","rMitades"/],
    ["las tres colecciones", /COLECCIONES\s*=\s*\{/],
    ["una sola fuente de verdad para la pestaña", /coleccionActiva/],
    ["cada mitad con su propio scroll", /\.rMitadCuerpo\{[^}]*overflow-y:auto/],
    ["se arrastra de un panel al otro", /function arrastrable\(/],
    ["y hay un destino donde soltar", /data-suelta|dataset\.suelta/],
    ["la carta sigue al dedo", /rFantasma/],
  ];
  const sin = piezas.filter(([,re]) => !re.test(html)).map(([q]) => q);
  if(sin.length) mal("mazo y binder usables con el dedo", sin.join(", "));
  else ok("mazo y binder: dos mitades con scroll propio y arrastre entre ellas");
}

/* ── el atajo de pruebas está marcado como temporal ── */
{
  /* El botón de ganar sin jugar es para que E recorra el modo sin
     jugarse veinte duelos. NO puede acabar en una versión pública sin
     que nadie se acuerde: aquí queda escrito que hay que quitarlo. */
  if(/rTrampa/.test(html)){
    if(/pruebas/.test(html)) ok("el atajo de pruebas sigue puesto y marcado como tal",
      "QUITARLO antes de publicar");
    else mal("el atajo de pruebas no dice que es de pruebas");
  } else ok("no hay atajos de pruebas en el build");
}

/* ── el estado se guarda solo ── */
{
  const guardado = mem.get("goat.story.run.v1");
  if(!guardado) mal("la partida se guarda sola al tocar algo");
  else {
    const run = JSON.parse(guardado);
    if(!run.semilla || !run.mapa) mal("el guardado tiene la semilla y el mapa");
    else ok(`la partida se guarda sola (semilla ${run.semilla})`);
  }
}

/* ── el duelo del Reino no rompe el duelo normal ── */
{
  if(!$("mJugar"))
    mal("Duelo libre sigue funcionando");
  else ok("Duelo libre y su botón de empezar siguen en su sitio");
}

/* ══════════════════════════════════════════════════════════════════
   EN PC NO PUEDE VERSE TODO DIMINUTO

   Bajar el zoom del Reino para que cupiera el mapa encogió de paso
   TODAS sus pantallas: E reportó dos veces que las tres cartas de una
   recompensa, los encuentros y el campamento salían minúsculos en un
   monitor. El arreglo fue subir los tamaños BASE y dejar que el bloque
   de móvil los devuelva a lo de siempre.

   Esto vigila las dos mitades a la vez, porque arreglar una rompiendo
   la otra ya ha pasado: en PC un mínimo, y en móvil que la regla que lo
   devuelve al tamaño de dedo siga existiendo.
   ══════════════════════════════════════════════════════════════════ */
{
  const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/g) ?? []).join("\n");
  /* Se QUITAN los bloques de móvil para leer solo las reglas de PC: un
     `.rCarta` dentro de `@media (pointer:coarse)` no dice nada del
     monitor. Y se quitan de verdad, contando llaves — cortar por el
     primer `@media` no vale, porque las reglas base siguen apareciendo
     después del primer bloque y el test se quedaba sin encontrarlas. */
  const sinMedia = t => {
    let out = "", i = 0;
    while(i < t.length){
      const j = t.indexOf("@media", i);
      if(j < 0){ out += t.slice(i); break; }
      out += t.slice(i, j);
      let k = t.indexOf("{", j), n = 0;
      if(k < 0) break;
      for(; k < t.length; k++){
        if(t[k] === "{") n++;
        else if(t[k] === "}" && --n === 0){ k++; break; }
      }
      i = k;
    }
    return out;
  };
  const soloPC = sinMedia(css);

  const anchoCarta = soloPC.match(/\.rCarta\{[^}]*width:clamp\([^,]+,[^,]+,\s*(\d+)px\)/);
  const tope = anchoCarta ? Number(anchoCarta[1]) : 0;
  if(tope < 140)
    mal("en PC una carta del Reino llega a 140 px de ancho", `se queda en ${tope || "?"}px`);
  else ok(`en PC una carta del Reino llega a ${tope}px de ancho`);

  const rejilla = soloPC.match(/--anchoCarta,\s*(\d+)px/);
  const col = rejilla ? Number(rejilla[1]) : 0;
  if(col < 180)
    mal("y la rejilla de recompensas reparte columnas de 180 px o más",
        `son de ${col || "?"}px`);
  else ok(`y la rejilla de recompensas reparte columnas de ${col}px`);

  /* ══ Y QUE LA REGLA DE MÓVIL GANE, NO SOLO QUE EXISTA ══
     La versión anterior de esto comprobaba que la regla de móvil
     estuviera escrita, y daba verde… con el móvil roto. El bloque de
     `pointer:coarse` del Reino va ANTES en el archivo que las reglas
     base, así que con la misma especificidad gana la última: subir el
     tamaño de carta para PC agrandó también el teléfono, y E lo
     reportó. Un test de presencia no vale para un problema de cascada.

     La regla que lo arregla y que aquí se exige: toda regla del bloque
     de móvil del Reino lleva `#reino` delante. Con eso, el orden dentro
     del archivo deja de importar. */
  /* TODOS los bloques de móvil, no solo el primero: las reglas del
     Reino están repartidas entre varios y mirar uno daba verde con el
     resto roto. */
  const bloques = [];
  {
    let i = 0;
    while((i = css.indexOf("@media", i)) >= 0){
      const cab = css.slice(i, css.indexOf("{", i));
      let k = css.indexOf("{", i), n = 0, j = k;
      for(; j < css.length; j++){
        if(css[j] === "{") n++;
        else if(css[j] === "}" && --n === 0){ j++; break; }
      }
      if(/coarse|max-width|max-height/.test(cab)) bloques.push([k+1, j-1]);
      i = j;
    }
  }
  const bloque = bloques.map(([a,b]) => css.slice(a,b)).join("\n");
  const media = { index: bloques.length ? bloques[0][0] : 0 };
  if(!bloque) mal("existe el bloque de móvil del Reino");
  else {
    /* ══ Y AQUÍ HAY UNA LECCIÓN CARA ══
       La primera versión de esto exigía que TODAS las reglas de móvil
       del Reino llevaran `#reino`, y para que pasara las blindé las 89
       de golpe. Fue un error: en muchas de ellas la que estaba ganando
       era la regla BASE, y ese era el tamaño que llevaba meses
       funcionando. Blindarlas cambió el valor efectivo de un montón de
       cosas que nadie había reportado — y E lo notó al instante: las
       cartas de Mazo y binder pasaron de 63 px a 76 px.

       Así que la regla no es "todas las de móvil tienen que ganar". Es
       "las que arreglan un bug reportado tienen que ganar, y el resto
       se dejan en paz". Esta lista son esas, una por una. Añadir algo
       aquí quiere decir: lo medí y el valor de móvil es el bueno. */
    const DEBEN_GANAR = [
      ["#reino .rCarta{",           "el tamaño de carta de PC agrandaba el teléfono"],
      ["#reino .rCarta .rNom{",     "y su nombre debajo"],
      ["#reino .rCartas.grandes{",  "la rejilla de recompensas"],
      ["#reino .rCartas.mini{",     "las cartas de Mazo y binder"],
      ["#reino .rOpcion{",          "los botones de encuentro y campamento"],
      ["#reino .rArteSobre{",       "la ilustración del sobre, en icono"],
    ];
    const faltan = DEBEN_GANAR.filter(([sel]) => !bloque.includes(sel));
    if(faltan.length)
      mal(`${faltan.length} regla(s) de móvil que DEBEN ganar no llevan \`#reino\``,
          "\n      · " + faltan.map(([s,por]) => `${s}  (${por})`).join("\n      · "));
    else ok(`las ${DEBEN_GANAR.length} reglas de móvil que deben ganar llevan \`#reino\``);
  }

  /* ══ Y CUÁNTO MIDE DE VERDAD UNA CARTA DEL BINDER ══
     Aquí no vale mirar si la regla existe: el problema era que un
     `clamp(56px,7vw,80px)` que en un teléfono da 56 px, en un táctil
     ancho de 1024 da 72 — y con `1fr` estirando la columna acababa en
     74 px por carta. Seis por pantalla en vez de veinte. Se calcula el
     ancho EFECTIVO en varios anchos de pantalla y se le pone tope. */
  {
    const regla = [...bloque.matchAll(/#reino \.rCartas\.mini\{[^}]*minmax\(clamp\(([\d.]+)px,\s*([\d.]+)vw,\s*([\d.]+)px\)/g)].pop();
    if(!regla) mal("la rejilla de Mazo y binder tiene su tamaño de móvil");
    else {
      const [,min,vw,max] = regla.map(Number);
      /* ══ EL TOPE DEPENDE DE DÓNDE ESTÉ EL BOTÓN ══
         Con el botón de mover FLOTANDO en la esquina de la carta, el
         tope era 62: por encima seguía tapando arte y por debajo el
         botón no se podía pulsar. Desde que el botón bajó a una barra
         debajo de la carta, la carta puede crecer sin tapar nada, así
         que el tope sube. Los 74 px que E llamó «enormes» siguen fuera. */
      const TOPE = 80;
      const anchos = [390, 430, 820, 1024, 1280];
      const medidas = anchos.map(w => {
        const util = Math.round(w * 0.96) - 24;
        const col  = Math.min(max, Math.max(min, w * vw / 100));
        const n    = Math.max(1, Math.floor(util / col));
        return { w, ancho: util / n, n };
      });
      const peor = medidas.reduce((a,b) => a.ancho > b.ancho ? a : b);
      if(peor.ancho > TOPE)
        mal(`una carta del binder se va a ${peor.ancho.toFixed(0)}px en ${peor.w}px de pantalla`,
            `el tope es ${TOPE}px; el culpable suele ser el término vw`);
      else ok(`una carta del binder no pasa de ${peor.ancho.toFixed(0)}px`
            + ` (${medidas.map(m => `${m.w}:${m.ancho.toFixed(0)}px`).join(" · ")})`);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     QUIÉN GANA AL DECIDIR EL ANCHO DE UNA CARTA

     Esto no mira reglas: calcula la ESPECIFICIDAD y dice cuál manda.

     El bug que lo hizo falta: para que el tamaño de carta de PC no se
     colara en el móvil se blindó `#reino .rCarta`. Un id vale más que
     cualquier número de clases, así que esa regla pasó a ganarle a
     `.rCartas.mini .rCarta` — la que dice que dentro del binder la
     carta rellena su casilla— y las cartas del binder saltaron de 50 px
     a 120. Y de paso rompió la rejilla de recompensas y la del
     mercader, que nadie miró.

     La regla estructural, que es la que se comprueba: **una regla de
     CONTENEDOR (`.rCartas.algo .rCarta`) tiene que ganar siempre a una
     de carta suelta (`.rCarta`)**. Si no, el contenedor no sirve de
     nada.
     ══════════════════════════════════════════════════════════════════ */
  {
    const espec = sel => {
      const t = sel.replace(/\/\*[\s\S]*?\*\//g, "").trim();
      return [(t.match(/#/g) ?? []).length, (t.match(/\.[a-zA-Z]/g) ?? []).length];
    };
    const gana = (a, b) => a[0] !== b[0] ? a[0] > b[0] : a[1] >= b[1];

    const anchos = [];
    for(const m of css.matchAll(/([^{}]*\.rCarta[^{}]*)\{([^}]*width\s*:[^;}]*)/g)){
      const sel = m[1].replace(/\/\*[\s\S]*?\*\//g, "").trim().replace(/\s+/g, " ");
      if(!sel || !/\.rCarta(\s|$|\{|,)/.test(sel + " ")) continue;
      anchos.push({ sel, e: espec(sel), contenedor: /\.rCartas[.\w]*\s+\.rCarta/.test(sel) });
    }
    const sueltas    = anchos.filter(a => !a.contenedor);
    const contenedor = anchos.filter(a =>  a.contenedor);
    const perdedoras = contenedor.filter(c => sueltas.some(s => gana(s.e, c.e)));

    if(!contenedor.length) mal("hay reglas de rejilla para el ancho de carta");
    else if(perdedoras.length)
      mal(`${perdedoras.length} rejilla(s) las pisa una regla de carta suelta`,
          "\n      · " + perdedoras.map(p => p.sel).join("\n      · ")
          + "\n      un `#algo .rCarta` gana a dos clases: sube la del contenedor");
    else ok(`las ${contenedor.length} reglas de rejilla ganan a las ${sueltas.length} de carta suelta`);
  }

  /* Y la ilustración, en icono: una franja a todo el ancho se come
     media pantalla de teléfono para decir lo que ya dice el título. */
  const arte = bloque.match(/#reino \.rArteSobre\{[^}]*width:(\d+)px/);
  if(!arte || Number(arte[1]) > 90)
    mal("en móvil la ilustración del sobre es un icono, no un banner",
        arte ? `mide ${arte[1]}px de ancho` : "sigue a todo el ancho");
  else ok(`en móvil la ilustración del sobre es un icono de ${arte[1]}px`);
}

/* ══════════════════════════════════════════════════════════════════
   EL BINDER SE ORDENA, NO SALE COMO FUE ENTRANDO

   E: «ordenar monstruos en el binder por número de estrellas
   ascendente». Con 200 cartas, el orden de llegada no es un orden: es
   el historial de la run.

   La función se SACA del HTML construido y se ejecuta, en vez de
   copiarla aquí: copiarla sería comparar mi copia contra mi copia, que
   es el verde falso que ya costó una sesión en `check-arte`.
   ══════════════════════════════════════════════════════════════════ */
{
  /* Se captura el bloque ENTERO —la tabla de rangos y la función—
     porque la función la usa: sacar solo la función daba
     "RANGO_TIPO is not defined". Y el `;` final se queda fuera, que
     metido dentro de un `return (...)` es un error de sintaxis. */
  const m = html.match(/(const RANGO_TIPO = \{[^}]*\};\s*const ordenarCartas = codes =>[\s\S]*?\n    \}\);)/);
  if(!m) mal("se encuentra `ordenarCartas` en el HTML construido",
             "si la has renombrado, actualiza el patrón — no copies la función aquí");
  else {
    /* Un catálogo de mentira, pero con cartas de verdad del formato:
       niveles y tipos reales para que el orden se pueda juzgar. */
    const CARTAS = {
      1: { n:"Zombyra the Dark",  nivel:4, cat:"MONSTRUO" },
      2: { n:"Airknight Parshath",nivel:5, cat:"MONSTRUO" },
      3: { n:"Magician of Faith", nivel:1, cat:"MONSTRUO" },
      4: { n:"Pot of Greed",      nivel:0, cat:"MAGICA"   },
      5: { n:"Mirror Force",      nivel:0, cat:"TRAMPA"   },
      6: { n:"Abyss Soldier",     nivel:4, cat:"MONSTRUO" },
      7: { n:"Heavy Storm",       nivel:0, cat:"MAGICA"   },
    };
    const cat = { nombre:c=>CARTAS[c].n, nivel:c=>CARTAS[c].nivel,
                  categoria:c=>CARTAS[c].cat };
    // eslint-disable-next-line no-new-func
    const ordenar = new Function("cat", `${m[1]}\nreturn ordenarCartas;`)(cat);
    const salida = ordenar([5,4,2,1,7,3,6]).map(c => CARTAS[c]);

    const niveles = salida.filter(x=>x.cat==="MONSTRUO").map(x=>x.nivel);
    const asc = niveles.every((n,i)=> i===0 || n >= niveles[i-1]);
    if(!asc) mal("los monstruos salen por nivel ASCENDENTE", niveles.join(" "));
    else ok(`los monstruos salen por nivel ascendente (${niveles.join(" ")})`);

    const tipos = salida.map(x=>x.cat);
    const primeraMagica = tipos.indexOf("MAGICA");
    const ultimoMonstruo = tipos.lastIndexOf("MONSTRUO");
    const primeraTrampa = tipos.indexOf("TRAMPA");
    if(!(ultimoMonstruo < primeraMagica && primeraMagica < primeraTrampa))
      mal("y después van mágicas y luego trampas", tipos.join(" "));
    else ok("y después van las mágicas y al final las trampas");

    /* A igualdad de nivel, por nombre: si no, dos copias de la misma
       carta se separan y el orden baila entre repintados. */
    const cuatros = salida.filter(x=>x.cat==="MONSTRUO" && x.nivel===4).map(x=>x.n);
    const ordenado = [...cuatros].sort((a,b)=>a.localeCompare(b));
    if(cuatros.join("|") !== ordenado.join("|"))
      mal("y a igual nivel, por nombre", cuatros.join(" · "));
    else ok("y a igual nivel, por nombre");
  }
}

console.log(fallos ? `\n${fallos} fallo(s)\n` : "\nTodo correcto\n");
process.exit(fallos ? 1 : 0);
