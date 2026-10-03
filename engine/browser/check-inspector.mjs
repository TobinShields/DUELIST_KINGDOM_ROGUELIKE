/* ══════════════════════════════════════════════════════════════════
   LA FICHA DE CARTA, LOS ENGANCHES Y EL ROBO

   Tres cosas que E pidió y que comparten síntoma: la pantalla no contaba
   lo que estaba pasando.

   1 · EL INSPECTOR CAMBIABA CON CADA MOVIMIENTO DEL RATÓN. Pasar el
       cursor por el tablero, o hacer scroll con el ratón encima de las
       cartas, hacía parpadear el panel y era imposible leer nada. Ahora
       el clic FIJA una carta, el hover tiene retardo y ESC suelta.
   2 · NO SE VEÍA QUÉ ESTABA ENGANCHADO A QUÉ. Snatch Steal, Premature
       Burial y Spellbinding Circle apuntan a un monstruo concreto, y el
       adaptador ya lo sabía (`equipadoA`, del mensaje EQUIP) pero nadie
       lo dibujaba.
   3 · LA CARTA ROBADA SALÍA DE LA ESQUINA. El elemento se creaba en
       0,0 y la primera transición la llevaba a la mano, así que parecía
       venir de fuera de la pantalla en vez de del mazo.

   Aquí se comprueban leyendo el HTML construido, porque son mecanismos
   —no valores— y lo que hay que impedir es que desaparezcan.

   Uso:  node check-inspector.mjs
   ══════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";

const html = readFileSync("./out/goat.html", "utf-8");
const css  = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/g) ?? []).join("\n");
const js   = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];

let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t,d="") => { fallos++; console.log("  ✗ " + t + (d ? "   " + d : "")); };
console.log("\n═══ FICHA DE CARTA, ENGANCHES Y ROBO ═══\n");

/* ── 1 · EL INSPECTOR ── */
{
  if(!/function fijarCarta\(/.test(js) || !/let cartaFijada/.test(js))
    mal("el clic fija una carta en la ficha");
  else ok("el clic fija una carta en la ficha");

  if(!/function proponerDetalle\(/.test(js) || !/if\(cartaFijada != null\) return;/.test(js))
    mal("y con una fijada, pasar el ratón no la cambia");
  else ok("y con una fijada, pasar el ratón no la cambia");

  const retardo = js.match(/temporizadorHover = setTimeout\([\s\S]{0,200}?\}, (\d+)\);/);
  const ms = retardo ? Number(retardo[1]) : 0;
  if(!(ms >= 50 && ms <= 200))
    mal("el hover tiene un retardo corto (50-200 ms)", `es ${ms || "ninguno"}`);
  else ok(`el hover espera ${ms} ms: rozar una carta de camino ya no la muestra`);

  if(!/t\?\.closest\?\.\(["']\.card["']\)/.test(js))
    mal("y un clic fuera la suelta");
  else ok("y un clic fuera la suelta");

  if(!/hayCartaFijada\?\.\(\) \? \(\) => V\.soltarCarta\(\)/.test(js))
    mal("ESC suelta la carta fijada");
  else ok("ESC suelta la carta fijada");

  /* Y que se NOTE que está fijada: si no, el panel parece roto. */
  if(!/#detail\.fijada\{/.test(css)) mal("y se ve que está fijada");
  else ok("y se ve que está fijada");

  /* Arrastrar no puede fijar: el `pointerup` de soltar una carta en el
     tablero no es un clic. */
  if(!/if\(arrastrando\) return;/.test(js))
    mal("arrastrar una carta no la fija sin querer");
  else ok("arrastrar una carta no la fija sin querer");
}

/* ── 2 · LOS ENGANCHES ── */
{
  if(!/function dibujarUniones\(/.test(js))
    mal("se dibuja qué está enganchado a qué");
  else if(!/c\?\.equipadoA/.test(js))
    mal("y sale del dato del adaptador, no de una lista aparte");
  else ok("se dibuja la unión entre el equipo y su monstruo, leyendo `equipadoA`");

  if(!/#uniones \.union\{/.test(css)) mal("y tiene estilo propio");
  else ok("y tiene estilo propio (línea discontinua dorada)");

  if(!/requestAnimationFrame\(dibujarUniones\)/.test(js))
    mal("y se redibuja con el tablero");
  else ok("y se redibuja con el tablero: sigue a las cartas al moverse");
}

/* ── 3 · EL ROBO SALE DEL MAZO ── */
{
  if(!/const cuna = zonePos\(card\.controller,/.test(js))
    mal("una carta nueva nace en su zona de origen, no en la esquina");
  else if(!/card\.location === L\.HAND \? "deck"/.test(js))
    mal("y lo que se roba nace en el mazo");
  else ok("una carta robada sale del mazo, no de la esquina de la pantalla");
}

console.log(`\n${fallos ? "FALLA: " + fallos : "Todo correcto"}`);
process.exit(fallos ? 1 : 0);
