/* ══════════════════════════════════════════════════════════════════
   LA MANO NO PUEDE ENTRAR EN EL TABLERO

   E lo ha reportado TRES veces y las tres lo "arreglé" mirando el número
   del CSS en vez de dónde acaban las cartas. La última vez, además, con
   el signo cambiado:

       y = grid.offsetHeight - CH * asoma        (asoma = 1)

   `y` es el borde de ARRIBA de la carta, así que con asoma=1 la carta no
   quedaba debajo del tablero: quedaba ENTERA DENTRO, justo encima de la
   fila de mágicas y trampas. Y el test daba verde porque comprobaba que
   `--asoma-mia` valiera 1.

   Ahora se calcula la geometría: se leen las variables reales del HTML
   construido para cada viewport, se reproduce el alto del tablero y la
   escala que aplica `fitBoard`, y se mira dónde cae el borde superior de
   la mano. La regla es una y no se negocia:

       manoTop  >=  tableroBottom + HUECO

   ══ HASTA DÓNDE LLEGA ESTO, DICHO CLARO ══
   Esto NO es un navegador: no hay motor de layout en el sandbox (sin red
   al CDN de Chrome y sin permisos de apt). Lo que hace es evaluar las
   MISMAS fórmulas que ejecuta el juego, con los MISMOS números, y por
   eso exige que esas fórmulas estén en el HTML construido tal cual: si
   alguien las cambia, esta comprobación se cae y hay que revisarla en
   vez de que mienta en silencio.

   Para la verificación definitiva con píxeles de verdad, el juego lleva
   dentro `__MEDIR_TABLERO__()`: se abre la consola durante un duelo y
   devuelve los rectángulos reales y el solape en píxeles.

   Uso:  node check-tablero.mjs
   ══════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";

const html = readFileSync("./out/goat.html", "utf-8");
const css  = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/g) ?? []).join("\n");
const js   = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];

let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t,d="") => { fallos++; console.log("  ✗ " + t + (d ? "   " + d : "")); };
console.log("\n═══ LA MANO CONTRA EL TABLERO ═══\n");

/* ── 1 · LAS FÓRMULAS SON LAS QUE CREO QUE SON ──
   Si esto falla, el resto de la comprobación está midiendo un juego que
   ya no existe. */
const FORMULA_MANO = /y = mine \? grid\.offsetHeight \+ hueco \+ CH\*\(sc-1\)\/2 \+ arc/;
const FORMULA_HUECO = /const cuelga = CW\*1\.46\*esc \+ hueco;/;
if(!FORMULA_MANO.test(js))
  mal("la mano se coloca POR DEBAJO del tablero",
      "la fórmula de `y` no es la esperada: revisa este test antes de tocar nada");
else ok("la mano se coloca por debajo del borde del tablero, no restando sobre él");
if(!FORMULA_HUECO.test(js))
  mal("el tablero reserva la mano ENTERA más el hueco");
else ok("y el tablero reserva la mano entera más el hueco");
if(/--asoma-mia/.test(css))
  mal("ya no queda rastro de `--asoma-mia`", "era el número con el signo cambiado");
else ok("ya no queda rastro de `--asoma-mia`");

/* ── 2 · LOS NÚMEROS REALES DEL BUILD ── */
const bloqueMovil = (css.match(
  /@media \(max-width:900px\), \(max-height:560px\), \(pointer:coarse\) and \(max-width:1250px\)\{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
const bloqueBajo = (css.match(/@media \(max-height:470px\)\{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
const varDe = (bloque, nombre, porDefecto) => {
  const m = bloque.match(new RegExp(`${nombre}:\\s*([\\d.]+)(px)?`));
  return m ? Number(m[1]) : porDefecto;
};
const tactil = (css.match(/body\.tactil\{([^}]*)\}/) ?? [])[1] ?? "";
const HUECO = varDe(tactil, "--hueco-mano", 0);
if(!(HUECO >= 8))
  mal("el hueco entre mano y tablero es visible (>= 8 px)", `es ${HUECO}px`);
else ok(`el hueco declarado entre mano y tablero es de ${HUECO}px`);

/* ── 3 · LA GEOMETRÍA, VIEWPORT A VIEWPORT ──
   Se reproduce lo que hace el navegador: el tablero son 9 columnas y 4
   filas de casillas más el divisor y el relleno; `fitBoard` lo escala
   para que quepa el alto disponible MENOS lo que hay que reservar para
   la mano. */
const VIEWPORTS = [
  [800,360,"Android pequeño"], [812,375,"iPhone SE"],
  [844,390,"iPhone 14"],       [873,393,"Pixel"],
  [915,412,"Android grande"],  [932,430,"iPhone Pro Max"],
  [852,393,"iPhone 15"],       [896,414,"iPhone XR"],
];
const MANOS = [5, 7, 10, 12];
const filas = [];
let peorSeparacion = Infinity, casosMalos = [];

for(const [ancho, alto, nombre] of VIEWPORTS){
  const bajo = alto <= 470;
  const CW    = varDe(bajo ? bloqueBajo : bloqueMovil, "--cw", 66);
  const COLW  = varDe(bajo ? bloqueBajo : bloqueMovil, "--colw", 100);
  const GAP   = varDe(bajo ? bloqueBajo : bloqueMovil, "--gap", 4);
  const ESC   = varDe(tactil, "--mano-mia", 1);
  const CH    = CW * 1.46;
  /* Relleno del tablero y margen del divisor, del bloque de móvil. */
  const PAD = Number((bloqueMovil.match(/#grid\{padding:(\d+)px\}/) ?? [])[1] ?? 18);
  const DIV = Number((bloqueMovil.match(/#grid \.divider\{margin:(\d+)px 0\}/) ?? [])[1] ?? 7);

  /* Alto del tablero sin escalar: 4 filas de casillas + el divisor. */
  const filaH = COLW * 1.46;
  const gridH = PAD*2 + filaH*4 + GAP*3 + (2 + DIV*2);
  const gridW = PAD*2 + COLW*9 + GAP*8;

  /* Lo que `fitBoard` tiene disponible y cuánto reserva. */
  const carril = 0;                       // el panel solo aparece al decidir
  const availW = ancho - 24 - carril;
  const availH = alto - 16 - 8;           // safe-area de abajo, aproximada
  const cuelga = CW * 1.46 * ESC + HUECO; // ← la fórmula del build
  /* Lo que asoma la mano del RIVAL por encima del tablero: se dibuja en
     `y` negativa, fuera de la caja, y hay que reservarlo o al subir el
     tablero se corta. */
  const ESCR = varDe(tactil, "--mano-rival", 1);
  const asomaRival = CW * 1.46 * (0.06 + 0.10 * ESCR) + 16;
  const k = Math.min(1, availW / gridW, availH / (gridH + cuelga + asomaRival));
  /* ══ LA BANDA MUERTA ══
     `scale()` encoge desde el centro, así que sin compensar, el borde de
     arriba del tablero baja `(1-k)·gridH/2`. Esa franja vacía entre la
     barra y el tablero es lo que E marcó en la captura, con su mano
     saliéndose por abajo a la vez. */
  const bandaSinArreglo = (1 - k) * gridH / 2;
  const subir = bandaSinArreglo - asomaRival * k;   // ← lo que hace `fitBoard`
  const aire  = bandaSinArreglo - subir;            // lo que queda arriba

  for(const n of MANOS){
    /* Las cartas se reparten por el ancho; el arco sube las de los
       extremos, así que la más ALTA es la del borde. */
    const spread = Math.min(CW*0.80*ESC, (gridW*0.62)/Math.max(n,1));
    const off = (n-1)/2;
    const arc = off*off*2.2;              // ← el arco del build, en el extremo
    /* `y` del build, con la compensación de escalar desde el centro. */
    const y = gridH + HUECO + CH*(ESC-1)/2 + arc;
    /* Y el borde de ARRIBA de la carta ya escalada. */
    const manoTop = y + CH/2 - CH*ESC/2;
    const separacion = manoTop - gridH;   // >0 = hay hueco de verdad
    peorSeparacion = Math.min(peorSeparacion, separacion);
    if(separacion < 8)
      casosMalos.push(`${ancho}×${alto} con ${n} cartas: ${separacion.toFixed(1)}px`);
    /* Y que el tablero + la mano quepan en la pantalla, contando ya la
       banda que se recupera arriba. */
    const usado = (gridH + cuelga + asomaRival) * k;
    if(usado > availH + 1)
      casosMalos.push(`${ancho}×${alto} con ${n}: se sale ${(usado-availH).toFixed(0)}px por abajo`);
    if(n === 5) filas.push([`${ancho}×${alto}`, nombre, k.toFixed(2),
                            separacion.toFixed(0), bandaSinArreglo.toFixed(0),
                            aire.toFixed(0)]);
  }
}

if(casosMalos.length)
  mal(`separación real entre mano y tablero en los ${VIEWPORTS.length} viewports`,
      "\n      · " + casosMalos.slice(0,6).join("\n      · "));
else ok(`0 solape en ${VIEWPORTS.length} viewports × ${MANOS.length} tamaños de mano`
        + ` (${VIEWPORTS.length*MANOS.length} casos); la separación más ajustada es`
        + ` ${peorSeparacion.toFixed(0)}px`);

/* ══ Y QUE LA BANDA MUERTA DE ARRIBA ESTÉ COMPENSADA ══
   Sin el `translateY`, cada viewport regalaba entre 80 y 200 px de nada
   arriba mientras la mano se salía por abajo. Se comprueba en el código
   real, no en el número: lo que hay que impedir es que alguien vuelva a
   dejar el `scale()` suelto. */
{
  const cuerpo = js.slice(js.indexOf("export function fitBoard") >= 0
    ? js.indexOf("export function fitBoard") : js.indexOf("function fitBoard"));
  const tramo = cuerpo.slice(0, cuerpo.indexOf("\nfunction ", 10));
  if(!/translateY\(\$\{\(-subir\)/.test(tramo) || !/const subir =/.test(tramo))
    mal("el tablero compensa la banda muerta de `scale()`",
        "sin el translateY, `scale` encoge desde el centro y baja el tablero"
        + " (1-k)·alto/2 píxeles");
  else ok("el tablero compensa la banda muerta que deja `scale()` desde el centro");
  if(!/asomaRival/.test(tramo))
    mal("y reserva lo que asoma la mano del rival por arriba");
  else ok("y reserva lo que asoma la mano del rival, para no cortarla");

  const media = filas.reduce((s,f)=>s+Number(f[4]),0) / Math.max(filas.length,1);
  console.log(`\n   banda muerta que se recupera: ${media.toFixed(0)}px de media`
            + ` en ${filas.length} viewports`);
}

/* ══ LA MANO DEL RIVAL, MÁS PEQUEÑA QUE LA TUYA EN LOS DOS SITIOS ══
   En móvil ya lo estaba (.58 contra 1.35). En escritorio iba a 1, igual
   de grande que la tuya, y E lo señaló: son cartas boca abajo, o sea
   información que no puedes usar, y pesaban lo mismo que tu mano. */
{
  const raiz = (css.match(/:root\{([\s\S]*?)\}/) ?? [])[1] ?? "";
  const mia   = Number((raiz.match(/--mano-mia:\s*([\d.]+)/) ?? [])[1] ?? 1);
  const rival = Number((raiz.match(/--mano-rival:\s*([\d.]+)/) ?? [])[1] ?? 1);
  if(!(rival < mia))
    mal("en escritorio la mano del rival es más pequeña que la tuya",
        `mía ${mia}, suya ${rival}`);
  else ok(`en escritorio su mano va al ${Math.round(rival*100)}% de la tuya`);
}

/* ══ Y EL PANEL DE DECISIONES NO TAPA LOS PUNTOS DE VIDA ══
   E lo reportó dos veces con captura. Lo intenté antes con un `top`
   fijo en el CSS del móvil y se quedó corto: el alto del marcador
   depende de la cara y del nombre del duelista, así que un número
   escrito a mano es una apuesta. Ahora se miden los dos rectángulos y
   el panel baja lo justo — y esto vigila que se siga midiendo. */
{
  /* Sin el `export`: `build-html` lo quita al empaquetar. */
  if(!/function apartarPanel\(/.test(js))
    mal("existe la corrección que aparta el panel del marcador");
  else if(!/getBoundingClientRect/.test(js.slice(js.indexOf("function apartarPanel("),
                                                 js.indexOf("function apartarPanel(") + 900)))
    mal("y lo hace midiendo, no con un número escrito a mano");
  else ok("el panel de decisiones se aparta del marcador del rival midiendo los dos");

  if((js.match(/V\.apartarPanel\?\.\(\)/g) ?? []).length < 2)
    mal("y se llama cada vez que el panel se enseña",
        "el nombre del rival cambia de alto entre duelos");
  else ok("y se recalcula cada vez que el panel se enseña");
}

console.log("\n── el tablero, viewport a viewport (mano de 5) ──");
console.log("   viewport   dispositivo         escala  separación  banda  aire");
for(const [v,n,k,sep,banda,aire] of filas)
  console.log(`   ${v.padEnd(10)} ${n.padEnd(19)} ${k.padStart(5)}  ${sep.padStart(6)}px`
            + `  ${banda.padStart(5)}px ${aire.padStart(5)}px`);

/* ── 4 · Y LOS CONTROLES DE FASE, SIEMPRE ENCIMA ── */
{
  const ctrl = (css.match(/#controles\{[^}]*z-index:(\d+)/g) ?? []).join(" ");
  const zCtrl = Math.max(0, ...[...ctrl.matchAll(/z-index:(\d+)/g)].map(m => Number(m[1])));
  const zCarta = Number((css.match(/\.card\{[^}]*z-index:(\d+)/) ?? [])[1] ?? 0);
  if(!(zCtrl >= 300))
    mal("los controles de fase van por encima de las cartas", `z-index ${zCtrl}`);
  else ok(`los controles de fase van a z-index ${zCtrl}: ninguna carta los tapa`);
  if(!/#phases\{z-index:300\}/.test(css))
    mal("y la tira de fases también");
  else ok("y la tira de fases también");
}

/* ── 5 · EL MEDIDOR DE VERDAD, DENTRO DEL JUEGO ──
   Esto es lo que cierra el asunto de una vez: en un navegador real,
   `__MEDIR_TABLERO__()` devuelve los rectángulos y el solape en píxeles.
   Si no viaja dentro del HTML, no hay forma de comprobarlo de verdad. */
if(!/__MEDIR_TABLERO__/.test(js))
  mal("el juego lleva dentro el medidor `__MEDIR_TABLERO__()`");
else if(!/getBoundingClientRect/.test(js.slice(js.indexOf("function medirTablero"),
                                               js.indexOf("function medirTablero")+1400)))
  mal("y mide con getBoundingClientRect, no con los números del CSS");
else ok("el juego lleva `__MEDIR_TABLERO__()`: mide con getBoundingClientRect en el navegador");

/* ══════════════════════════════════════════════════════════════════
   LA ESCALA DE ESCRITORIO Y LOS ATAJOS

   E: "a 2560×1440 con Chrome al 100% quiero el tamaño que veía con el
   navegador al 125%". Eso es la escala BASE del escritorio, no el zoom
   del navegador —que además rompe el `dvh` del móvil—. Y los atajos
   solo pueden disparar lo que ya es legal.
   ══════════════════════════════════════════════════════════════════ */
{
  const raiz = (css.match(/:root\{([^}]*)\}/) ?? [])[1] ?? "";
  const cw = Number((raiz.match(/--cw:\s*(\d+)px/) ?? [])[1] ?? 0);
  /* El valor anterior era 112. Se pidió entre +20% y +25%. */
  if(!(cw >= 112*1.19 && cw <= 112*1.28))
    mal("el escritorio va un 20-25% más grande que antes", `--cw es ${cw}px (era 112)`);
  else ok(`el escritorio va a ${cw}px de carta: ×${(cw/112).toFixed(2)} respecto a antes`);

  /* Y el móvil NO se entera: sus valores están en su propio bloque. */
  const movil = (css.match(/@media \(max-width:900px\), \(max-height:560px\), \(pointer:coarse\) and \(max-width:1250px\)\{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
  const cwMovil = Number((movil.match(/--cw:\s*(\d+)px/) ?? [])[1] ?? 0);
  if(cwMovil !== 66)
    mal("el móvil no se entera del cambio de escala", `--cw móvil es ${cwMovil}px`);
  else ok("y el móvil se queda exactamente igual (66px)");

  /* Los atajos: existen, respetan los campos de texto y siguen a los
     botones en vez de tener su propia lista de teclas. */
  if(!/function atajos\(/.test(js)) mal("hay atajos de teclado");
  else if(!/function escribiendo\(/.test(js) || !/isContentEditable/.test(js))
    mal("y no se disparan mientras escribes en un campo");
  else if(!/atajos\(\{ espacio: cfg\?\.fase \?\? cfg\?\.fin \?\? null/.test(js))
    mal("y SPACE dispara la acción legal que haya, no una tecla fija");
  else ok("SPACE y ESC disparan solo lo que ya es legal, y no mientras escribes");
}

console.log(`\n${fallos ? "FALLA: " + fallos : "Todo correcto"}`);
process.exit(fallos ? 1 : 0);
