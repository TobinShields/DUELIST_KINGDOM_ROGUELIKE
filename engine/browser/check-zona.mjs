/* ══════════════════════════════════════════════════════════════════
   EL VISOR DE CEMENTERIO TIENE QUE DEJAR LEER LA CARTA

   E: «cuando miras cartas en el cementerio se abre un menú y se blurea
   el fondo; eso está bien, pero al lado debería seguir apareciendo la
   información de la carta, o alguna manera de leer lo que hace».

   La causa era doble y las dos partes se veían igual desde fuera:

     · el visor es `position:fixed; inset:0` con fondo borroso, así que
       el panel de carta de la izquierda queda DEBAJO. Llenarlo —que es
       lo que hacía— no servía de nada;
     · y lo único que lo llenaba era un `onmouseenter`. El dedo no tiene
       hover, así que en el móvil no había absolutamente nada.

   Y de paso, el visor también sirve para ELEGIR un objetivo del
   cementerio: ahí un toque elegía la carta de golpe, sin haber podido
   leerla. Mismo error que E encontró en la hoja de recompensa. Ahora
   tocar LEE y elegir es un botón.

   Uso:  node check-zona.mjs
   ══════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";

const html = readFileSync("./out/goat.html", "utf-8");
const css  = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/g) ?? []).join("\n");
const js   = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];

let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t,d="") => { fallos++; console.log("  ✗ " + t + (d ? "   " + d : "")); };
console.log("\n═══ EL VISOR DE CEMENTERIO ═══\n");

/* Se mira DENTRO de `openZoneView`, no en todo el bundle: un test que
   busca una expresión suelta la encuentra en cualquier parte y da verde
   con la función rota. Eso ya pasó con la cara del Duelista libre. */
const i = js.indexOf("function openZoneView(");
const cuerpo = i < 0 ? "" : js.slice(i, js.indexOf("\nfunction ", i + 20));
if(!cuerpo) { mal("existe openZoneView()"); process.exit(1); }

/* ── 1 · LA FICHA VIVE DENTRO DEL VISOR ── */
{
  if(!/class="zvficha"/.test(cuerpo))
    mal("el visor lleva su propia ficha de carta",
        "el panel de fuera queda debajo del fondo borroso");
  else ok("el visor lleva su propia ficha de carta, dentro del overlay");

  if(!/#zoneview \.zvficha\{/.test(css)) mal("y tiene estilo propio");
  else ok("y tiene estilo propio");

  /* Que enseñe lo que hay que leer: nombre, tipo y TEXTO. */
  const trozos = ["nameOf(c.code)", "zvtexto", "textOf(c.code)"];
  const faltan = trozos.filter(t => !cuerpo.includes(t));
  if(faltan.length) mal("y enseña nombre, stats y texto de la carta", faltan.join(", "));
  else ok("y enseña nombre, atributo, ATK/DEF y el texto entero");
}

/* ── 2 · Y SE LLENA CON EL DEDO, NO SOLO CON EL RATÓN ──
   La regla de todo el proyecto: toda función que solo se alcance
   pasando el ratón necesita su gesto táctil equivalente. */
{
  if(!/d\.onmouseenter=/.test(cuerpo))
    mal("con ratón, pasar por encima llena la ficha");
  else ok("con ratón, pasar por encima llena la ficha");

  /* Que el `onclick` de la carta LLAME a verFicha. Se busca dentro del
     manejador, no la línea literal: la primera versión de esto asertaba
     la línea exacta y se puso roja en cuanto el manejador creció. */
  /* Sin comentarios: dentro del manejador hay un párrafo explicando el
     bug de la identidad, y una ventana de N caracteres contada sobre el
     código comentado es una apuesta — la misma trampa que ya se comió
     `check-reino` con su ventana de 6.000. */
  const sinComentarios = cuerpo.replace(/\/\*[\s\S]*?\*\//g, "");
  const clic = sinComentarios.slice(sinComentarios.indexOf("d.onclick="));
  if(!/d\.onclick=/.test(cuerpo) || !/verFicha\(c\)/.test(clic.slice(0, 300)))
    mal("y con el dedo, tocarla también",
        "sin esto, en un móvil el cementerio es una fila de miniaturas mudas");
  else ok("y con el dedo, tocarla también");
}

/* ── 3 · ELEGIR NO PUEDE SER UN ROCE ── */
{
  if(!/["']zvelegir["']/.test(cuerpo) || !/onPick\(c\)/.test(cuerpo))
    mal("elegir un objetivo del cementerio es un botón aparte");
  else ok("elegir un objetivo del cementerio es un botón aparte, no el propio toque");

  /* Y con el dedo, el toque NUNCA elige directamente. */
  if(!/!esTactil\(\)/.test(cuerpo))
    mal("y con el dedo el toque solo lee: nunca elige",
        "el atajo de dos clics es solo para ratón");
  else ok("y con el dedo el toque solo lee: el atajo de clic es solo para ratón");

  /* El botón, a 44 px o más: es el mínimo táctil de todo el proyecto. */
  const alto = css.match(/#zoneview \.zvelegir\{[^}]*min-height:(\d+)px/);
  if(!alto || Number(alto[1]) < 44)
    mal("y el botón mide 44 px o más", alto ? alto[1]+"px" : "sin altura declarada");
  else ok(`y el botón mide ${alto[1]}px: se puede pulsar con el dedo`);
}

/* ── 4 · EN MÓVIL LA FICHA NO SE COME LA REJILLA ── */
{
  const movil = (css.match(/@media[^{]*pointer:coarse[\s\S]*?#zoneview \.zvcuerpo\{([^}]*)\}/) ?? [])[1] ?? "";
  if(!/flex-direction:column/.test(movil))
    mal("con el dedo, la ficha se apila debajo de la rejilla",
        "al lado se comería el ancho y las miniaturas dejarían de verse");
  else ok("con el dedo, la ficha se apila debajo y cada una tiene su scroll");
}

/* ══════════════════════════════════════════════════════════════════
   Y LO MISMO AL BUSCAR EN EL MAZO

   E: «el menú con la info de las cartas que están en el cementerio,
   impleméntalo también para búsquedas de cartas como el efecto de
   Magician of Faith».

   El visor ya se abría solo para esas búsquedas —el mazo, el cementerio
   y las desterradas están en la lista de zonas que no se ven en el
   tablero—, así que la ficha llega gratis. Lo que NO llegaba eran los
   datos de la carta: se le pasaba `{code, _i}` y con eso pasaban dos
   cosas malas a la vez.
   ══════════════════════════════════════════════════════════════════ */
{
  /* Se quitan los comentarios ANTES de cortar la ventana: dentro de
     esta función hay un párrafo de veinte líneas explicando el bug, y
     una ventana contada sobre el código comentado se queda corta sin
     avisar. Es la misma trampa por tercera vez. */
  const jsLimpio = js.replace(/\/\*[\s\S]*?\*\//g, "");
  const i2 = jsLimpio.indexOf("const abrirVisor=");
  const abrir = i2 < 0 ? "" : jsLimpio.slice(i2, i2 + 700);
  if(!abrir) mal("existe el visor de las listas de selección");
  else {
    /* 1 · Sin `position` ni `controller`, una carta boca abajo del rival
       se pintaba de cara: con Nobleman of Crossout se leía el monstruo
       colocado. El panel de texto sí la tapaba; el visor no. */
    if(!/position:c\.position/.test(abrir) || !/controller:c\.controller/.test(abrir))
      mal("una tapada del rival sigue tapada dentro del visor",
          "sin `position` y `controller` el visor la pinta de cara");
    else ok("una tapada del rival sigue tapada dentro del visor");

    /* 2 · Sin identidad, todas las cartas eran «undefined» y el segundo
       clic sobre CUALQUIERA la elegía sin haberla leído. */
    if(!/uid:/.test(abrir))
      mal("cada carta de la lista lleva identidad propia",
          "si no, el atajo de doble clic elige la carta equivocada");
    else ok("cada carta de la lista lleva identidad propia");

    /* 3 · Y de dónde sale: en una búsqueda la lista mezcla mazo,
       cementerio y desterradas. */
    if(!/location:c\.location/.test(abrir) || !/ZONA/.test(cuerpo))
      mal("la ficha dice de qué zona sale la carta");
    else ok("la ficha dice de qué zona sale la carta");
  }

  /* Y que la búsqueda abra el visor sola, sin tener que buscar un botón. */
  if(!/if\(necesitaVisor\) abrirVisor\(\);/.test(js))
    mal("una búsqueda fuera del tablero abre el visor sola");
  else ok("una búsqueda fuera del tablero abre el visor sola");
}

/* ══════════════════════════════════════════════════════════════════
   Y NADA DE LO QUE RESPONDE AL RATÓN PUEDE MOVERSE BAJO EL RATÓN

   E: "el panel hace glitches al pasar el ratón, el contenedor se
   redimensiona al texto de la carta en vez de ser fijo". Eran tres cosas
   a la vez, todas de la misma familia que el parpadeo de los sobres:

     · el realce iba en `.zvcard`, la caja que recibe el ratón, así que
       al subir 8 px se escapaba del cursor y entraba en un bucle
       mouseenter/mouseleave;
     · la ficha tenía `max-height`, o sea que su alto lo ponía el texto
       de cada carta y el recuadro saltaba al cambiar de una a otra;
     · y cada `mouseenter` reescribía el `innerHTML` de la ficha aunque
       fuera la misma carta, recargando la imagen.
   ══════════════════════════════════════════════════════════════════ */
{
  /* La regla BASE es la primera del archivo; la de móvil viene después,
     dentro de `pointer:coarse`, y ahí no hay hover que valga.
     OJO: partir por "@media" no vale — hay bloques de móvil ANTES de
     estos estilos, así que el corte se llevaba por delante las reglas
     que se quieren mirar y el test daba rojo con el CSS bien. Es la
     misma trampa que la ventana de texto fija de `check-reino`. */
  const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const primera = re => (sinComentarios.match(re) ?? [])[0] ?? "";

  if(/\.zvcard:hover\{[^}]*transform/.test(sinComentarios))
    mal("el realce no va en la caja que recibe el ratón",
        "moverla bajo el cursor es un bucle mouseenter/mouseleave");
  else ok("el realce no mueve la caja que recibe el ratón");

  if(!/\.zvcard:hover\s*>\s*\.card\{[^}]*transform/.test(sinComentarios))
    mal("pero la carta de dentro sí se realza", "si no, no hay respuesta al ratón");
  else ok("y la carta de dentro sí se realza");

  const f = primera(/#zoneview \.zvficha\{[^}]*\}/);
  if(!/(^|;)\s*height:\s*\d/.test(f))
    mal("la ficha tiene alto FIJO, no `max-height`",
        "con max-height el alto lo pone el texto y el panel salta de carta a carta");
  else ok("la ficha tiene alto fijo: no salta al cambiar de carta");

  if(!/if\(ficha\.dataset\.uid === quien\) return;/.test(js))
    mal("y pasar el ratón por la MISMA carta no la repinta",
        "repintarla recarga la imagen y da un fogonazo");
  else ok("y pasar el ratón por la misma carta no la repinta");
}

console.log(`\n${fallos ? "FALLA: " + fallos : "Todo correcto"}`);
process.exit(fallos ? 1 : 0);
