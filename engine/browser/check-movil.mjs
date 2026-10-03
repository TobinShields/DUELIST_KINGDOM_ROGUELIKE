/* ══════════════════════════════════════════════════════════════════
   ¿SE PUEDE JUGAR CON EL DEDO?

   E probó el juego en el teléfono y el resumen fue: "algunas partes de
   la interfaz son injugables en móvil... la info de las cartas es
   pequeña, no se puede scrollear ni nada. muchas funcionalidades
   también dicen hover para... pero en móvil no se puede."

   Aquí no hay navegador, así que esto NO mide píxeles: lee el HTML
   construido —el de verdad, el que se abre con doble clic— y comprueba
   las cosas que, cuando faltaron, salieron en un reporte:

   · que ninguna ayuda hable SOLO de ratón o de clic derecho,
   · que nada que se toque sea más pequeño que un dedo (44 px, que es
     el mínimo que dicen tanto Apple como Google),
   · que los recortes del iPhone (notch y barra de inicio) estén
     reservados en las cuatro zonas que llegan al borde,
   · que el panel de detalle del duelo pueda recibir el toque —tuvo
     `pointer-events:none` durante meses y con eso su propio `onclick`
     no servía para nada—,
   · y que las hojas de carta existan y se puedan cerrar.

   Se ejecuta contra `out/goat.html` y `deckbuilder.html`.
   ══════════════════════════════════════════════════════════════════ */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const aqui = dirname(fileURLToPath(import.meta.url));
const rutaJuego = join(aqui, "out", "goat.html");
const rutaDeck  = join(aqui, "..", "deckbuilder", "deckbuilder.html");

let fallos = 0, pasa = 0;
const ok  = (t, extra="") => { pasa++; console.log("  ✓ " + t + (extra ? " — " + extra : "")); };
const mal = (t, por="")   => { fallos++; console.log("  ✗ " + t + (por ? " — " + por : "")); };
const comprobar = (cond, t, por="") => cond ? ok(t) : mal(t, por);

console.log("═══ MÓVIL ═══");

if(!existsSync(rutaJuego)){
  console.log("  ✗ no está out/goat.html — ejecuta node build-html.mjs");
  process.exit(1);
}
const juego = readFileSync(rutaJuego, "utf8");
const deck  = existsSync(rutaDeck) ? readFileSync(rutaDeck, "utf8") : "";

/* Solo el CSS: el resto del archivo lleva 1.685 cartas y sus textos, y
   buscar ahí da falsos positivos a mansalva. */
const css = (html) => (html.match(/<style[^>]*>([\s\S]*?)<\/style>/g) ?? []).join("\n");
const cssJuego = css(juego), cssDeck = css(deck);

/* ── 1 · ninguna ayuda depende del ratón ── */
console.log("\n— las ayudas hablan también de dedo —");
for(const [nombre, html, hoja] of [["el simulador", juego, cssJuego],
                                   ["el deck builder", deck, cssDeck]]){
  if(!html){ console.log("  · " + nombre + " no construido, se salta"); continue; }
  /* Cada frase de ayuda que mencione el ratón tiene que venir con su
     gemela de dedo, y el CSS tiene que saber cuál enseñar. */
  const conRaton = (html.match(/class="soloRaton"/g) ?? []).length;
  const conTacto = (html.match(/class="soloTacto"/g) ?? []).length;
  comprobar(conRaton > 0 && conRaton === conTacto,
    `${nombre}: cada ayuda de ratón tiene su versión táctil`,
    `${conRaton} de ratón contra ${conTacto} de dedo`);
  comprobar(/\(pointer:\s*coarse\)[^{]*\{[^}]*\.soloRaton\s*\{\s*display:\s*none/.test(hoja)
         || /@media\s*\(pointer:\s*coarse\)\s*\{\s*\.soloRaton\{display:none\}/.test(hoja),
    `${nombre}: con el dedo se esconde la ayuda de ratón`);
  /* Y que no quede ninguna frase suelta de ratón fuera de ese par.
     Se quitan antes los `soloRaton` (que ya tienen su gemela) y todo el
     JavaScript: la tabla de traducción contiene esas mismas frases en
     español por definición, y contarlas era un falso positivo. */
  const soloMarcado = html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<span class="soloRaton">[\s\S]*?<\/span>/g, "");
  const sueltas = [...soloMarcado.matchAll(/>[^<>]{0,160}(?:Pasa el ratón|[Cc]lic derecho)[^<>]{0,160}</g)]
    .map(m => m[0].trim());
  comprobar(sueltas.length === 0,
    `${nombre}: no queda ninguna instrucción solo-ratón suelta`,
    sueltas.slice(0,2).join(" | "));
}

/* ── 2 · el panel de detalle del duelo recibe el toque ── */
console.log("\n— el panel de carta del duelo —");
/* La caja sigue sin capturar toques (para no estorbar al arrastre) pero
   el contenido SÍ: si esto se rompe, tocar el panel no abre la lupa y
   volvemos a "no se puede leer una carta en el móvil". */
comprobar(/#side\s*#detail\{[^}]*pointer-events:\s*auto/.test(cssJuego),
  "el contenido del panel recibe el toque",
  "#side #detail necesita pointer-events:auto");
comprobar(/#detail[^{]*\{[^}]*cursor:\s*zoom-in/.test(cssJuego),
  "y lo dice con el cursor");
comprobar(/dataset\.toque\s*=\s*T\(/.test(juego),
  "el aviso de 'toca para leerla' se escribe YA traducido",
  "va en un data-* y content:attr() no pasa por traducirDOM");
comprobar(/data-toque/.test(cssJuego),
  "y el CSS lo pinta");

/* ── 3 · las hojas de carta ── */
console.log("\n— hojas de carta con el dedo —");
comprobar(/@media\s*\(pointer:\s*coarse\)/.test(cssJuego),
  "el simulador distingue el puntero grueso, no solo el ancho",
  "un iPad declara 1024 px y se maneja con el dedo");
comprobar(/\.rPanel[^{]*\{[^}]*position:\s*fixed/.test(cssJuego),
  "el panel del Reino sube desde abajo");
comprobar(/\.rPanelCerrar/.test(cssJuego) && /rPanelCerrar/.test(juego),
  "y se puede cerrar",
  "sin ratón no hay 'quitar el puntero'");
comprobar(/\.rPanelElegir/.test(cssJuego) && /rPanelElegir/.test(juego),
  "elegir una carta se confirma desde el panel",
  "el primer toque LEE, el segundo ELIGE: sin esto se elige a ciegas");
/* ══ Y COGER NO PUEDE TAPAR CERRAR ══
   «Coger» era `sticky` a lo ancho y «cerrar» `absolute` en la misma
   esquina: el primero se pintaba encima. E: «a veces le doy a coger
   cuando quería cerrar». Y había un segundo fallo debajo — un
   `absolute` dentro de un panel con scroll se va con el contenido, así
   que al bajar a leer el efecto la ✕ desaparecía. Los dos van ahora en
   la MISMA barra, que es lo que impide las dos cosas a la vez. */
comprobar(/\.rPanelBarra\{[^}]*display:flex/.test(cssJuego)
  && /rPanelBarra/.test(juego),
  "coger y cerrar comparten barra: no se pueden pisar",
  "si vuelven a estar sueltos, uno tapa al otro");
comprobar(!/\.rPanelCerrar\{[^}]*position:absolute/.test(cssJuego),
  "y cerrar no es `absolute` dentro de un panel con scroll",
  "se iría con el contenido y la ✕ desaparecería al bajar");
/* ══ PLEGAR EL PANEL DE DECISIONES NO EXISTE CON EL DEDO ══
   La pestaña para volver a abrirlo (`#pestana`) está en `right:0;
   top:50%` con z-index 151, y en móvil ahí mismo vive la tira de fases
   (`#phases`, `right:3px; top:50%`) con z-index 300, o sea ENCIMA.
   Plegabas el panel y la pestaña quedaba debajo de DRAW/STANDBY/MAIN:
   sin forma de recuperarlo. E lo reportó como «el menú no se puede
   cerrar». Con el dedo no hay flecha, y una preferencia guardada de
   antes se deshace al arrancar para no dejar a nadie encerrado. */
comprobar(/if\(V\?\.esTactil\?\.\(\)\) return;/.test(juego),
  "con el dedo, el panel de decisiones no ofrece plegarse",
  "la pestaña de volver queda debajo de la tira de fases");
comprobar(/if\(V\?\.esTactil\?\.\(\) && plegado\(\)\) setPlegado\(false\);/.test(juego),
  "y si venía plegado de antes, se despliega al arrancar",
  "si no, quien lo plegó una vez se queda sin panel para siempre");
/* ══ LAS FASES Y EL PANEL, CADA UNO EN SU BORDE ══
   Los dos vivían pegados a la derecha y a media altura, así que se
   solapaban pase lo que pase con los márgenes. Ahora las fases se van a
   la IZQUIERDA, entre la ficha de carta (arriba) y el historial
   (abajo), que es el hueco que quedaba libre. Se comprueba que estén en
   lados OPUESTOS, no los números: los márgenes ya han cambiado dos
   veces y asertarlos solo enseña a ignorar el test. */
comprobar((() => {
  /* El bloque de MÓVIL es el que declara `left`: el de escritorio
     también tiene `display:flex`, así que buscar por eso se llevaba la
     regla equivocada. */
  const bloques = [...cssJuego.matchAll(/#phases\{([^}]*)\}/g)].map(m => m[1]);
  const fases = bloques.find(d => /left:/.test(d)) ?? "";
  const paneles = [...cssJuego.matchAll(/#prompt\{([^}]*)\}/g)].map(m => m[1]);
  const panel = paneles.find(d => /position:fixed/.test(d)) ?? "";
  return /left:/.test(fases) && /right:auto/.test(fases)
      && /right:/.test(panel) && /left:auto/.test(panel);
})(),
  "en móvil las fases van a la izquierda y el panel a la derecha",
  "compartiendo borde se tapan, y la tira de fases no puede taparse");
/* ══ PERO A LA IZQUIERDA YA VIVÍA EL HISTORIAL ══
   Al mudar las fases se metieron en el carril del historial de jugadas,
   que está abajo a la izquierda. En el Android de E se solapan; en una
   pantalla más alta no, porque la tira va centrada a media altura.
   Un margen escrito a mano acierta en un teléfono y falla en el
   siguiente —el alto de cada uno depende de cuántas cartas y cuántas
   fases haya—, así que además del hueco fijo se MIDEN los dos y la tira
   se aparta solo cuando de verdad se pisan. Es la tercera vez en este
   proyecto que un número fijo para apartar algo no llega. */
comprobar(/function apartarDelHistorial\(/.test(juego)
  && /getBoundingClientRect/.test(juego.slice(juego.indexOf("function apartarDelHistorial("),
                                              juego.indexOf("function apartarDelHistorial(") + 900)),
  "y si aun así se pisan, la tira se aparta MIDIENDO",
  "un margen fijo acierta en un móvil y falla en el siguiente");
comprobar(/colocarFases\(\)\{[\s\S]{0,300}apartarDelHistorial\(\);/.test(juego),
  "y se recalcula al recolocar el tablero",
  "el historial crece con cada jugada: hay que volver a mirar");
comprobar(/pointer:\s*coarse/.test(juego) && /TACTIL/.test(juego),
  "y el JS pregunta por el puntero antes de decidir el gesto");
/* ══ LA HOJA DE CARTA SUBE A LO ANCHO, NO ES UNA VENTANITA ══
   `.rPanel.suelto.abierto` —la ventana flotante de 280 px del mapa—
   está declarada con TRES clases (0,0,3,0) y le ganaba a la regla de
   móvil `.rPanel` (0,0,1,0). Resultado: en Mazo y binder la ficha salía
   como un recuadro estrecho a un lado, con el texto partido cada dos
   palabras, en vez de subir desde abajo como en el duelo. Lo reportó E
   con captura. Se comprueba que la regla que gana sea la de la hoja. */
comprobar((() => {
  const espec = sel => [(sel.match(/#/g) ?? []).length,
                        (sel.match(/\.[a-zA-Z]/g) ?? []).length];
  const gana = (a,b) => a[0] !== b[0] ? a[0] > b[0] : a[1] >= b[1];
  let hoja = null, ventana = null;
  for(const m of cssJuego.matchAll(/([^{}]*\.rPanel[^{}]*)\{([^}]*position:fixed[^}]*)\}/g)){
    const esHoja = /left:0;right:0/.test(m[2]);
    for(const parte of m[1].split(",")){
      const sel = parte.replace(/\/\*[\s\S]*?\*\//g, "").trim().replace(/\s+/g, " ");
      if(!/^[#.][\w.#\- ]*\.rPanel/.test(sel)) continue;
      const e = espec(sel);
      if(esHoja){ if(!hoja || gana(e, hoja)) hoja = e; }
      else      { if(!ventana || gana(e, ventana)) ventana = e; }
    }
  }
  return !!hoja && (!ventana || gana(hoja, ventana));
})(),
  "con el dedo, la ficha de carta sube a lo ancho y no como ventanita",
  "la ventana flotante del mapa lleva tres clases y gana por especificidad");
/* ══ Y EL BOTÓN DE MOVER NO SE PONE ENCIMA DE LA CARTA ══
   Flotando en la esquina medía 34 px sobre una carta de 50 y se comía
   media ilustración. Quitarlo no era la respuesta —hace falta un botón
   directo, sin abrir nada—: baja a una BARRA debajo de la carta, a todo
   el ancho de la celda. No tapa un píxel de arte y el área de toque
   queda MÁS grande que antes (unos 69×34 en vez de 34×34). */
comprobar((() => {
  const m = cssJuego.match(/#reino \.rCartas\.mini \.rMover\{([^}]*)\}/);
  return !!m && /position:static/.test(m[1]) && /width:100%/.test(m[1]);
})(),
  "en el binder el botón de mover va debajo de la carta, no encima",
  "flotando en la esquina se come la ilustración");
comprobar(/enlazarCarta\(b, code, TACTIL\(\) \? alPulsar : null/.test(juego),
  "y la ficha de carta lleva la misma acción, para decidir habiendo leído",
  "en un binder de ciento y pico cartas hacen falta los dos caminos");
if(deck){
  comprobar(/@media\s*\(pointer:\s*coarse\)/.test(cssDeck),
    "el deck builder también");
  /* Media pantalla el buscador y media el mazo: las dos cosas a la vez.
     Antes el mazo era un panel que se abría encima y nunca veías lo que
     llevabas mientras buscabas. */
  comprobar(/#wrap\{[^}]*flex-direction:\s*column/.test(cssDeck)
         && /#centro\{[^}]*flex:\s*1 1 5\d%/.test(cssDeck)
         && /#der\{[^}]*flex:\s*1 1 4\d%/.test(cssDeck),
    "el deck builder parte la pantalla en dos mitades",
    "arriba el buscador, abajo el mazo, cada uno con su scroll");
  comprobar(/function arrastrable\(/.test(deck) && /#fantasma/.test(cssDeck),
    "las cartas se pasan de una mitad a otra arrastrándolas");
  comprobar(/fAcciones/.test(deck),
    "y añadir o quitar tiene botón escrito, no clic derecho");
}

/* ── 3b · el duelo con el dedo ── */
console.log("\n— el duelo con el dedo —");
/* La mano tapaba tu propia fila de mágicas y trampas. Recogida por
   defecto, se abre al tocarla; el primer toque NO juega. */
comprobar(/--hueco-mano/.test(cssJuego) && /--hueco-mano/.test(juego),
  "la separación entre mano y tablero sale del CSS, no de un número en el código");
/* ══ Y AHORA NO SE RECOGE ══
   Se recogía porque tapaba tus mágicas y trampas. Eso ya está arreglado
   por geometría —la carta va ENTERA por debajo del tablero—, así que el
   gesto sobra y E lo pidió fuera: "prefiero mano siempre visible". Lo
   que hay que vigilar es que no vuelva: un modo recogido significa que
   el primer toque se lo traga la interfaz en vez de jugar la carta. */
comprobar(!/body\.tactil\.manoAbierta\{/.test(cssJuego),
  "la mano NO se recoge: siempre visible",
  "un modo recogido se traga el primer toque");
comprobar(/function manoEstaAbierta\(\)\{ return true; \}/.test(juego)
       || /manoEstaAbierta\(\)\{\s*return true;\s*\}/.test(juego),
  "y nada pregunta si está recogida para tragarse el toque");
/* La pestaña con la flecha se quitó: no se entendía para qué era y
   tapaba las cartas. La mano recogida ya ES el botón. */
comprobar(!/#asaMano/.test(cssJuego) && !/id="asaMano"/.test(juego),
  "no hay pestaña ni flecha encima de la mano",
  "la mano recogida se toca directamente");
/* La lupa es donde se lee una carta en el móvil: tiene que scrollear. */
comprobar(/#lupa \.luTxt\{[^}]*overflow-y:\s*auto/.test(cssJuego),
  "el texto de la lupa se puede desplazar",
  "sin esto, una carta larga se lee a medias y no hay forma de ver el resto");
/* El panelito de detalle tapaba el historial: ahora son dos líneas. */
const ladoMovil = (cssJuego.match(/#side\{display:block;position:absolute[^}]*\}/) ?? [""])[0];
comprobar(/max-height:\s*\d\dpx/.test(ladoMovil),
  "el panel de detalle del duelo es una chapa, no una columna",
  "con 104 px de alto tapaba el historial y aun así no se leía nada");
/* Entrar a pantalla completa necesita un gesto: tiene que haber botón. */
comprobar(/id="pedirFull"/.test(juego) && /#pedirFull\.ver\{/.test(cssJuego),
  "hay una pantalla que ofrece el modo a pantalla completa");
comprobar(/pointer:coarse/.test(juego) && /sessionStorage/.test(juego),
  "solo con el dedo y una vez por sesión");
/* Y volver a medir el tablero cuando el móvil mueve el viewport: era el
   "no veía los botones hasta poner y quitar la pantalla completa". */
comprobar(/visualViewport/.test(juego) && /fullscreenchange/.test(juego),
  "el tablero se recoloca al cambiar el viewport",
  "la barra del navegador y la pantalla completa mueven el alto disponible");

/* ── 4 · lo que se toca, del tamaño de un dedo ── */
console.log("\n— tamaño de lo que se toca —");
/* Se emparejan selector y `min-height`, y solo se juzgan los selectores
   que son CONTROLES. Sin emparejar, el `min-height:30px` de una zona de
   suelta vacía cuenta como si fuera un botón diminuto: la primera
   versión de esta comprobación falló justo por eso. */
function altosDeControles(hoja){
  const salida = [];
  for(const m of hoja.matchAll(/([^{}@]+)\{([^{}]*min-height:\s*(\d+(?:\.\d+)?)px[^{}]*)\}/g)){
    const sel = m[1].trim().split("\n").pop().trim();
    /* Solo los controles del REINO. `#prompt .popts .btn` es del panel
       de decisiones del duelo, que vive en un carril estrecho al borde
       de la pantalla y tiene sus propias medidas. */
    if(/#prompt|#controles|#topbar/.test(sel)) continue;
    if(!/(btn|button|\.r(Btn|Opcion|Nodo|TrackFila)|#ver|#buscar|select|input)/i.test(sel)) continue;
    salida.push([sel, +m[3]]);
  }
  return salida;
}
const altosJuego = altosDeControles(cssJuego);
const pequenos = altosJuego.filter(([,v]) => v < 44);
comprobar(altosJuego.length >= 4 && !pequenos.length,
  "los controles del Reino declaran 44 px o más",
  pequenos.length ? pequenos.map(([s,v])=>`${s} → ${v}px`).join(", ")
                  : `solo ${altosJuego.length} controles con altura declarada`);
if(cssDeck){
  const altosDeck = altosDeControles(cssDeck);
  const chicos = altosDeck.filter(([,v]) => v < 44);
  comprobar(altosDeck.length >= 3 && !chicos.length,
    "y los del deck builder",
    chicos.length ? chicos.map(([s,v])=>`${s} → ${v}px`).join(", ")
                  : `solo ${altosDeck.length} controles con altura declarada`);
  /* iOS hace zoom al enfocar un campo con letra menor de 16 px, y de ahí
     no vuelve: la página se queda desplazada y torcida. */
  comprobar(/#buscar\{[^}]*font-size:\s*16px/.test(cssDeck),
    "el buscador usa 16 px",
    "por debajo de 16, iOS hace zoom al enfocar y ya no vuelve");
}

/* ── 5 · los recortes del iPhone ── */
console.log("\n— notch y barra de inicio —");
for(const [nombre, hoja, minimo] of [["el simulador", cssJuego, 8],
                                     ["el deck builder", cssDeck, 4]]){
  if(!hoja) continue;
  const n = (hoja.match(/env\(safe-area-inset-/g) ?? []).length;
  comprobar(n >= minimo, `${nombre} reserva los recortes del sistema`,
    `${n} usos de safe-area-inset, hacen falta ${minimo}`);
  const lados = ["top","bottom","left","right"].filter(l =>
    new RegExp("safe-area-inset-" + l).test(hoja));
  comprobar(lados.length === 4, `${nombre}: los cuatro lados`,
    "solo " + lados.join(", "));
}

/* ── 6 · nada que cubra la pantalla en unidades fijas ── */
console.log("\n— unidades —");
/* La trampa ya conocida: un viñeteado de `inset 0 0 260px 70px` era
   perfecto en un monitor de 1080 y media pantalla en un móvil de 400.
   Todo lo que cubra pantalla va en vmin/vh. */
const sombrasGordas = [...cssJuego.matchAll(/box-shadow:\s*inset[^;]*?(\d{3,})px/g)]
  .map(m => m[0]).filter(s => !/vmin|vh|vw/.test(s));
comprobar(sombrasGordas.length === 0,
  "ningún viñeteado de pantalla en píxeles fijos",
  sombrasGordas.slice(0,2).join(" | "));

/* ── 7 · el Reino no se queda sin salida en vertical ── */
console.log("\n— vertical —");
comprobar(/#rotar\{[\s\S]{0,400}?position:fixed/.test(cssJuego)
       && /orientation:portrait/.test(cssJuego),
  "el tablero pide girar el teléfono",
  "nueve columnas no caben en vertical");
/* Pero el Reino SÍ se juega en vertical: si el aviso de girar tapara
   también el mapa, no se podría ni empezar una aventura. */
/* OJO: hay MÁS de un bloque `orientation:portrait` —el aviso de girar y
   el apilado de la ficha de carta—, así que coger el primero que
   aparezca es una lotería. Se busca el que habla de `#rotar`, que es el
   único que tapa la pantalla. */
const bloqueRotar = ([...cssJuego.matchAll(/@media\s*\(orientation:portrait\)[^{]*\{([\s\S]*?)\n\}/g)]
  .map(m => m[1]).find(b => /#rotar/.test(b))) ?? "";
comprobar(!/#reino/.test(bloqueRotar),
  "y el Reino se sigue jugando en vertical");


/* ══════════════════════════════════════════════════════════════════
   LA MANO NO PUEDE TAPAR TUS MÁGICAS Y TRAMPAS

   E lo reportó tres veces. La primera solución fue plegar la mano y
   abrirla al tocarla; seguía tapando al abrirse, y encima el estado
   "mano abierta" oscurecía el tablero entero —eso es lo que él veía
   como "a veces todo el field se oscurece sin que quede claro por qué"—.

   Y luego tardé DOS intentos más en arreglarlo de verdad, porque el
   número tenía el signo cambiado: `y = gridH - CH*asoma` con asoma=1 no
   deja la carta debajo del tablero, la deja ENTERA DENTRO. Ahora la
   mano se coloca SUMANDO por debajo del borde de abajo del campo.
   La geometría fina —ocho viewports y manos de 5 a 12— está en
   `check-tablero.mjs`; aquí solo se vigila que no vuelva el signo.
   ══════════════════════════════════════════════════════════════════ */
{
  const cssT = cssJuego, jsT = juego;
  const reglaTactil = cssT.match(/body\.tactil\{([^}]*)\}/)?.[1] ?? "";
  const hueco = parseFloat(reglaTactil.match(/--hueco-mano:\s*([\d.]+)/)?.[1] ?? "0");
  if(/--asoma-mia/.test(cssT))
    mal("no vuelve `--asoma-mia`", "restaba sobre el tablero en vez de sumar por debajo");
  else if(!(hueco >= 8))
    mal("hay un hueco visible entre tu mano y el tablero", `son ${hueco}px`);
  else ok(`con el dedo, tu mano va por debajo del tablero con ${hueco}px de separación`);

  /* Y que fitBoard reserve la mano ENTERA, no "lo que asoma": si
     discrepan, la mano se sale por abajo de la pantalla. */
  if(!/const cuelga = CW\*1\.46\*esc \+ hueco;/.test(jsT))
    mal("el tablero reserva la mano entera más el hueco",
        "sigue habiendo un número fijo en `cuelga`");
  else ok("y el tablero reserva la mano entera más el hueco");

  /* NINGÚN VELO SOBRE EL TABLERO POR ELEGIR UNA CARTA. */
  if(/manoAbierta\s+#plane::after/.test(cssT))
    mal("elegir carta no oscurece el tablero", "sigue el velo de `manoAbierta`");
  else ok("elegir una carta ya no oscurece el tablero");

  /* El aire de arriba, recuperado. */
  /* Se comprueba la INTENCIÓN, no el número exacto: cuánto asoma la mano
     del rival se ha ajustado dos veces y asertar la constante ponía el
     test rojo cada vez que mejoraba. Lo que importa es que asome MENOS
     de un tercio de carta y que su abanico sea más apretado que el mío. */
  const asomaRival = jsT.match(/: -CH\*\(([\d.]+)\+([\d.]+)\*sc\) - arc/);
  const total = asomaRival ? Number(asomaRival[1]) + Number(asomaRival[2]) : 9;
  if(!/y = mine \? grid\.offsetHeight \+ hueco/.test(jsT) || total > 0.33)
    mal("la mano del rival se compacta para dar alto al tablero",
        `asoma ${(total*100).toFixed(0)}% de carta`);
  else ok(`la mano del rival asoma solo un ${(total*100).toFixed(0)}% y ese alto se lo queda el tablero`);
  /* Apretado, pero en FILA: la versión con 0.26 las apilaba casi encima
     unas de otras y quedaba una torre vertical rara. El detalle fino
     está más abajo, en el bloque de sitios de la pantalla. */
  const ab = jsT.match(/const abanico = mine \? ([\d.]+) : ([\d.]+);/);
  if(!ab || !(Number(ab[2]) < Number(ab[1])))
    mal("su abanico va más apretado que el tuyo", ab ? ab[0] : "no encuentro el reparto");
  else ok(`su abanico va más apretado que el tuyo (${ab[2]} contra ${ab[1]})`);

  /* La zona de controles no la puede tapar nada. */
  if(!/#controles\{[^}]*z-index:300/.test(cssT) || !/#phases\{z-index:300\}/.test(cssT))
    mal("los controles de fase están por encima de todo lo demás");
  else ok("los controles de fase están por encima de todo: nada los tapa");
}

console.log(`\n${pasa}/${pasa + fallos}`);
if(fallos){ /* ══ EL SITIO DE CADA COSA EN LA PANTALLA DEL DUELO ══
   E marcó tres zonas: arriba sobra aire, los laterales están vacíos y
   abajo a la derecha viven los controles. Lo que hay que garantizar es
   que nada se pise: la ficha de carta manda arriba a la izquierda, el
   marcador del rival se fue a la derecha para no quedar debajo de ella,
   y los botones de fase tienen su rincón reservado. */
{
  const cssT = cssJuego;
  const lpOpp = (cssT.match(/#lpOpp\{[^}]*\}/g) ?? []).join(" ");
  /* El del rival ya no comparte esquina con la ficha de carta. */
  if(/#lpOpp\{top:2px;left:2px\}/.test(cssT))
    mal("el marcador del rival no comparte esquina con la ficha de carta",
        "sigue arriba a la izquierda, debajo del panel");
  else if(!/#lpOpp\{top:2px;right:100px;left:auto\}/.test(cssT))
    mal("el marcador del rival tiene un sitio propio arriba");
  else ok("el marcador del rival va arriba a la derecha: no lo tapa la ficha de carta");

  /* La mano del rival, en fila y no apilada. Se mira la INTENCIÓN: el
     número exacto ya subió de 0.42 a 0.62 cuando E pidió verlas más
     separadas, y el test se puso rojo sin que nada estuviera roto. Lo
     que importa es que estén en fila (un abanico de verdad) y más
     juntas que las tuyas. */
  const ab = juego.match(/const abanico = mine \? ([\d.]+) : ([\d.]+);/);
  if(!ab || !(Number(ab[2]) >= 0.3 && Number(ab[2]) < Number(ab[1])))
    mal("la mano del rival va en fila horizontal, no apilada",
        ab ? ab[0] : "no encuentro el reparto");
  else ok("la mano del rival va en fila horizontal, pequeña");

  /* Y la tuya, lo bastante grande para cogerla con el dedo. */
  const tac = (cssT.match(/body\.tactil\{([^}]*)\}/) ?? [])[1] ?? "";
  const escala = parseFloat((tac.match(/--mano-mia:\s*([\d.]+)/) ?? [])[1] ?? "0");
  if(!(escala >= 1.15))
    mal("tu mano es lo bastante grande para el dedo", `escala ${escala}`);
  else ok(`tu mano va a escala ${escala}: se puede coger una carta con el dedo`);
}

console.log("\nFALLA: " + fallos); process.exit(1); }
