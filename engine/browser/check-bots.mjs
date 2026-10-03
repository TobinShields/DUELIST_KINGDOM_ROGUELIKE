/* Modo bots, modo sin cadenas e historial: que estén cableados de verdad
   en el HTML final, no solo en las fuentes. */
import { readFileSync } from "node:fs";
const html=readFileSync("./out/goat.html","utf-8");
const css=html.match(/<style>([\s\S]*?)<\/style>/)[1].replace(/\s*\n\s*/g,"");
const js =html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
const c=[
 ["pantalla de bots en el menú", /id="pBots"/.test(html) && /id="mBots"/.test(html) && /id="irBots"/.test(html)],
 /* Un solo nivel desde el 17-09: un reto por mazo, siempre en experto. */
 ["una fila por mazo, un reto en experto", /function pintarBots/.test(js) && /nivel:"experto", reto:\{ mazoRival:m\.id, nivel:"experto" \}/.test(js)],
 ["el progreso se lee de localStorage", /localStorage\.getItem\("goatProgreso"\)/.test(js)],
 ["y se apunta al ganar", /function apuntarVictoria/.test(js) && /localStorage\.setItem\("goatProgreso"/.test(js)],
 ["un solo camino para empezar duelo", /function lanzarDuelo/.test(js)
   && /getElementById\("mJugar"\)\.onclick = \(\) => lanzarDuelo\(\)/.test(js)],
 ["medallas por dificultad", /#mBots \.bpip\.n2\.hecho\{/.test(css)],

 ["modo sin cadenas respeta tus disparadores del cementerio",
   /chainMode==="nunca" && !disparadorDesdeGY/.test(js)],
 ["el botón cicla los tres modos", /const CICLO=\{auto:"always", always:"nunca", nunca:"auto"\}/.test(js)],

 ["historial visual con miniaturas", /function alHistorial/.test(js) && /id="historial"/.test(html)
   && /#historial \.hcarta\{/.test(css)],
 ["apunta invocaciones y cadenas", (js.match(/V\.alHistorial\(/g)||[]).length>=2],

 ["la IA no se encadena a su propia carta", /arriba\.controller === yo/.test(js)],
 ["el adaptador sabe de quién es cada eslabón", /this\.cadena\.push\(\{ code:m\.code, controller:m\.controller/.test(js)],
 ["Thousand-Eyes: objetivo boca arriba y el más gordo", /objetivo boca arriba/.test(js)],

 ["táctil: el gesto no se lo lleva el navegador", /touch-action:none/.test(css)],
 /* Un móvil en horizontal declara ~900px de ancho: si el disparador es
    solo el ancho, se queda con la disposición de escritorio. */
 ["la disposición de móvil también entra por altura",
   /@media \(max-width:900px\), \(max-height:560px\), \(pointer:coarse\) and \(max-width:1250px\)\{/.test(css)],
 /* ══ NO SE COMPRUEBAN PÍXELES, SE COMPRUEBA LA INTENCIÓN ══
    Esta línea decía `right:34px;top:38px` tal cual. La pasada de móvil
    cambió los números por `env(safe-area-inset-*)` —que es justo lo que
    había que hacer— y el test se puso rojo sin que nada estuviera roto.
    Un test que se rompe al mejorar el código enseña a ignorarlo. Lo que
    importa aquí es que el panel deje de estar CENTRADO. */
 ["en móvil el panel no tapa el centro del tablero", (()=>{
    const r = [...css.matchAll(/#prompt\{([^}]*)\}/g)].map(m=>m[1]);
    const movil = r.find(d=>/position:fixed/.test(d));
    return !!movil && /left:auto/.test(movil) && /right:/.test(movil)
        && /transform:none/.test(movil) && !/left:50%/.test(movil);
  })()],
 /* En cascada: gana la última que el navegador entienda. `svh` está en medio
    porque es la que salva a Safari de iOS, donde `dvh` va y viene al hacer
    scroll y el tablero da saltos. */
 ["la altura es la real del navegador, no la teórica",
   /html,body\{height:100%;height:100svh;height:100dvh\}/.test(css)],
 ["el viñeteado va en unidades relativas, no en píxeles fijos",
   /box-shadow:inset 0 0 \d+vmin/.test(css) && !/box-shadow:inset 0 0 260px/.test(css)],
 ["hay pantalla completa para quitar las barras del móvil",
   /id="btnPantalla"/.test(html) && /async function pantallaCompleta/.test(js)
   && /requestFullscreen\(\{ navigationUI:"hide" \}\)/.test(js)],
 ["y se pide al empezar el duelo, que es cuando hay gesto del usuario",
   /globalThis\.matchMedia\?\.\("\(pointer:coarse\)"\)\?\.matches/.test(js) && /pantallaCompleta\(\);/.test(js)],
 ["se respeta el hueco del notch", /env\(safe-area-inset-top\)/.test(css)],
 /* La tira lateral se mudó a la IZQUIERDA: a la derecha compartía borde
    con el panel de decisiones y con la pestaña de plegarlo. Se comprueba
    el lado, no el número: el margen exacto ya cambió una vez. */
 ["la tira de fases del centro no roba alto en móvil",
   /#fasesCentro\{display:none\}/.test(css)
   && /#phases\{display:flex;left:[^;]+;right:auto/.test(css)],
 /* Reservaba `CW*1.46*0.80*esc` con el 0,80 escrito a mano; ahora lee
    `--hueco-mano`, el MISMO número con el que `layoutAll` coloca la
    mano. Tenerlos separados es lo que hacía que con la mano abierta las
    cartas se salieran por abajo. */
 /* Y desde que se recupera la banda muerta de arriba hay un sumando
    más: lo que asoma la mano del RIVAL por encima del tablero, que se
    dibuja fuera de la caja y antes no se reservaba porque tampoco se
    subía nada. Se comprueba que estén LOS DOS. */
 ["el tablero reserva justo lo que cuelga la mano, no un número inventado",
   /const cuelga = CW\*1\.46\*esc \+ hueco;/.test(js)
   && /availH\/\(h \+ cuelga \+ asomaRival\)/.test(js)],
 ["hay un escalón extra para pantallas muy bajas", /@media \(max-height:470px\)\{/.test(css)],
 ["tu mano se dibuja más grande que la del rival",
   /--mano-mia:1\.35; --mano-rival:\.58/.test(css) && /sc = mine \? ESC_MIA : ESC_RIVAL;/.test(js)],
 /* Se comprueba la INTENCIÓN —que va apagada— y no CON QUÉ. Pedía
    `opacity:.62` literal, y `opacity` era justamente el problema: no
    oscurece, deja ver a TRAVÉS, y con el tablero debajo las cartas
    salían translúcidas. Lo reportó E. Regla ya escrita en CLAUDE.md a
    cuenta de `right:34px`: un test que aserta un valor se pone rojo
    cuando mejoras el código. */
 ["la mano del rival va apagada, y sin transparencia",
  /\.card\.mano-rival \.face\{[^}]*brightness\(\.\d+\)/.test(css)
  && !/\.card\.mano-rival \.face\{[^}]*opacity/.test(css)],
 ["el visor de carta no desaparece en móvil, flota a la izquierda",
   /#side\{display:block;position:absolute;left:0/.test(css)],
 ["los botones de turno siguen abajo a la derecha", (()=>{
    /* Igual que arriba: vale cualquier número mientras sigan pegados a la
       esquina de abajo a la derecha y respeten el recorte del iPhone. */
    const r = [...css.matchAll(/#controles\{([^}]*)\}/g)].map(m=>m[1]);
    return r.some(d => /right:max\(\d+px,env\(safe-area-inset-right\)\)/.test(d)
                    && /bottom:max\(\d+px,env\(safe-area-inset-bottom\)\)/.test(d));
  })()],
 ["el historial no pisa el visor de carta", /#historial\{flex-direction:row;width:auto;max-width:44vw;left:4px;top:auto;bottom:34px/.test(css)],
 ["en vertical se pide girar el móvil",
   /@media \(orientation:portrait\) and \(max-width:900px\)\{/.test(css) && /id="rotar"/.test(html)],
];
let ok=0; for(const [t,v] of c){ console.log(v?"  ✓":"  ✗",t); if(v) ok++; }
console.log(`\n${ok}/${c.length}`);
