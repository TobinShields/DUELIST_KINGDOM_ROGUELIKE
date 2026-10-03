/* ════════════════════════════════════════════════════════════════
   LAS CUENTAS QUE LLEVA UNA CARTA

   E lo pidió dos veces: "Final Countdown debería tener algún tipo de
   contador visible", "las Wall of Revealing Light y las espadas de luz
   reveladora necesitan un indicador de cuántos turnos han pasado o
   cuántos LP han pagado".

   No hacía falta inventar la cuenta: los scripts Lua ya la mandan.
   Final Countdown y las Espadas llaman a `SetTurnCounter`, y Wall of
   Revealing Light a `SetHint(CHINT_NUMBER, pagado)`. Las dos cosas
   llegan como CARD_HINT, uno de los mensajes que el adaptador tiraba.
   El bug era invisible: ninguna carta fallaba, simplemente el número no
   se veía en ninguna parte.

   Esto comprueba las tres cosas que se pueden romper por separado:
     1. que el adaptador traduzca CARD_HINT a un evento `contador`
     2. que el HTML de verdad tenga los estilos de la chapa
     3. que main.js le pase a la vista la clase y el nombre (sin eso,
        Final Countdown —que cuenta desde el cementerio— no tiene dónde
        pintarse y el número se pierde)

   OJO AL MONTAR ESTOS MENSAJES: CARD_HINT **no lleva el código de la
   carta**, solo dónde está. La primera versión de esta comprobación se lo
   ponía a mano y pasaba en verde mientras el juego real pintaba
   "undefined 7" junto a los puntos de vida.
   ════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";
import * as X from "./out/ocgcore.bundle.js";
import { GoatDuel } from "./src/duel.mjs";

let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t, d="") => { fallos++; console.log("  ✗ " + t + (d?"   "+d:"")); };
const T = X.OcgMessageType, H = X.OcgCardHintType, LOC = { MZONE:4, SZONE:8, GRAVE:16 };

console.log("\n═══ CUENTAS VISIBLES (Final Countdown, Espadas, Wall) ═══\n");

/* ── 1. el adaptador ── */
function duelDePrueba(){
  const eventos = [];
  const d = new GoatDuel({ lib:null, X, cardDb:new Map(), scriptReader:()=>"",
                           onEvent:e=>eventos.push(e) });
  return { d, eventos };
}
/* Una carta en la zona de magias, como las Espadas ya activadas. */
function ponerCarta(d, { controller=0, location=LOC.SZONE, sequence=0, code=72302403 }={}){
  const c = { uid:++d.uid, code, position:1, controller, location, sequence };
  d.cards.set(c.uid, c);
  if(location===LOC.SZONE || location===LOC.MZONE) d.zones[controller][location][sequence] = c;
  else d.zones[controller][location].push(c);
  return c;
}

{
  const { d, eventos } = duelDePrueba();
  const c = ponerCarta(d, { code:72302403 });          // Swords of Revealing Light
  d.handle_({ type:T.CARD_HINT, controller:0, location:LOC.SZONE, sequence:0,
              position:1, card_hint:H.TURN, description:2n });
  const e = eventos.find(x=>x.t==="contador");
  if(!e)                      mal("CARD_HINT de turnos llega como evento contador");
  else if(e.clase!=="turnos") mal("la clase del evento es 'turnos'", `es '${e.clase}'`);
  else if(e.cuantos!==2)      mal("el número es el que manda el motor", `es ${e.cuantos}`);
  else if(e.uid!==c.uid)      mal("el evento apunta a la carta correcta");
  else ok("Espadas de Luz Reveladora: 2 turnos contados, sobre la carta");
}

{
  const { d, eventos } = duelDePrueba();
  ponerCarta(d, { code:17078030 });                     // Wall of Revealing Light
  d.handle_({ type:T.CARD_HINT, controller:0, location:LOC.SZONE, sequence:0,
              position:1, card_hint:H.NUMBER, description:3000n });
  const e = eventos.find(x=>x.t==="contador");
  if(!e)                      mal("CARD_HINT de número llega como evento contador");
  else if(e.clase!=="numero") mal("la clase del evento es 'numero'", `es '${e.clase}'`);
  else if(e.cuantos!==3000)   mal("Wall of Revealing Light dice los LP pagados", `dice ${e.cuantos}`);
  else ok("Wall of Revealing Light: 3000 pagados (nada con 3000 o menos puede atacar)");
}

{
  /* EL CASO INCÓMODO. Final Countdown es una mágica NORMAL: cuando empieza
     a contar ya está en el cementerio, así que no hay carta en la mesa
     donde colgar el número y el evento tiene que decir de quién es para
     que la vista lo pinte junto a sus puntos de vida. */
  const { d, eventos } = duelDePrueba();
  ponerCarta(d, { code:95308449, location:LOC.GRAVE, controller:1 });
  d.handle_({ type:T.CARD_HINT, controller:1, location:LOC.GRAVE, sequence:0,
              position:1, card_hint:H.TURN, description:7n });
  const e = eventos.find(x=>x.t==="contador");
  if(!e)                    mal("Final Countdown cuenta desde el cementerio");
  else if(e.cuantos!==7)    mal("Final Countdown lleva 7 turnos", `dice ${e.cuantos}`);
  else if(e.code!==95308449) mal("el evento lleva el código para poder nombrarla");
  else if(e.jugador!==1)    mal("el evento dice de quién es la cuenta", `dice ${e.jugador}`);
  else if(e.enMesa)         mal("una carta del cementerio no está en la mesa");
  else ok("Final Countdown desde el cementerio: 7, del jugador 1, con nombre");
}

{
  /* Los CARD_HINT que no son cuentas (descripciones, razas, atributos)
     traen valores enormes de 64 bits. Pintarlos sería ruido. */
  const { d, eventos } = duelDePrueba();
  ponerCarta(d, { code:72302403 });
  d.handle_({ type:T.CARD_HINT, controller:0, location:LOC.SZONE, sequence:0,
              position:1, card_hint:H.DESC_ADD, description:1234567890123n });
  if(eventos.some(x=>x.t==="contador")) mal("un CARD_HINT descriptivo no pinta nada");
  else ok("los CARD_HINT que no son cuentas se ignoran");
}

/* ── 2. y 3. el HTML de verdad ── */
const html = readFileSync("./out/goat.html","utf-8");
const debe = [
  [".cont.turnos",  "el estilo de la chapa de turnos"],
  [".cont.numero",  "el estilo de la chapa de número"],
  [".lp .cuenta",   "el estilo de la cuenta pegada a los puntos de vida"],
  ["chapaCuenta",   "la función que pinta la cuenta sin carta en la mesa"],
  ["limpiarCuentas","el borrado de cuentas al empezar otra partida"],
];
for(const [aguja, que] of debe)
  html.includes(aguja) ? ok(`${que} está en el HTML`) : mal(`falta ${que} en el HTML`);

/* main.js tiene que pasarle la clase y el nombre a la vista: con la
   llamada antigua (`V.contador(e.uid, e.cuantos)`) el número de Final
   Countdown se perdía sin dar ningún error. */
if(/contador\(e\.uid,\s*e\.cuantos,\s*e\.clase/.test(html))
  ok("main.js le pasa a la vista la clase y el nombre");
else
  mal("main.js sigue llamando a contador() sin clase ni nombre");

console.log(fallos ? `\n${fallos} fallo(s)\n` : "\nTodo correcto\n");
process.exit(fallos ? 1 : 0);
