/* ══════════════════════════════════════════════════════════════════
   VALORAR EL TABLERO — una sola moneda para todo.

   EL PROBLEMA QUE RESUELVE.

   Hasta aquí, cada acción se puntuaba con una constante en una escala
   que me inventé: 3.2 la remoción, 5.5 la Snatch Steal, 4.6 robar dos.
   Funciona para casos que alguien ha pensado y falla en todo lo demás,
   porque los números no son comparables entre sí: nadie puede decir si
   robar dos cartas vale más que matarle un 1900, ya que salen de dos
   intuiciones distintas escritas en semanas distintas.

   Aquí hay UNA función que dice cuánto vale una posición, medida en
   CARTAS. Una carta es la unidad. Un monstruo de 1900 en el campo vale
   más o menos una carta de presencia; 4.000 puntos de vida de ventaja
   valen una carta. Con eso, cualquier jugada se puntúa igual:

       nota = valorar(tablero después) − valorar(tablero ahora) − coste

   y las constantes desaparecen.

   Lo que NO se puede hacer: pedirle al motor el tablero de después.
   ocgcore no deja clonar ni serializar un duelo. Así que el "después"
   se estima aplicando el efecto de la carta sobre una copia de nuestra
   propia vista. Es aproximado, y a propósito: es lo mismo que hacen las
   IAs de Tag Force y World Championship, que tampoco buscan en árbol.

   LOS PESOS NO SON SAGRADOS. Están puestos con criterio de formato, pero
   la vara para cambiarlos es `banco.mjs`, no la intuición.
   ══════════════════════════════════════════════════════════════════ */
import { atk, def, poder, valorCarta, infoDe, pegaMasFuerte } from "./evaluar.js";

/* ── la moneda ──
   1.0 = una carta. Todo lo demás se traduce a eso. */
export const PESOS = {
  /* Un monstruo de 2000 en ataque pesa una carta de presencia. Es lo que
     dice el formato: la ventaja de cartas manda, pero un cuerpo grande
     en la mesa vale tanto como una carta en la mano. */
  atkPorCarta:   2000,
  /* Defender vale menos que amenazar: no cierra partidas. */
  defPorCarta:   3200,
  /* 4.000 puntos de vida de diferencia = una carta. En Goat las partidas
     se deciden por cartas, no por daño, y este número lo refleja. */
  lpPorCarta:    4000,
  /* Lo que tiene puesto y no has visto: una tapada es una amenaza, pero
     también puede ser una carta muerta. Vale menos que una en la mano. */
  tapada:        0.75,
  /* Cuánto pesa tener en la mano las piezas con las que gana tu mazo. */
  piezaDelPlan:  0.30,
  /* Cuánto descuenta que puedan matarte algo en su turno. No es certeza:
     puede que no ataque, puede que tengas respuesta. */
  riesgo:        0.55,
};

/* Lo que aporta un monstruo estando en la mesa. */
function presencia(c){
  if(!c) return 0;
  if(c.bocaAbajo) return PESOS.tapada * 0.6;      // no amenaza, pero estorba
  return c.defensa ? def(c)/PESOS.defPorCarta
                   : atk(c)/PESOS.atkPorCarta;
}

/* ¿Qué me pueden quitar en su turno? Solo cuenta lo que YA está en la
   mesa: lo que pueda salirle de la mano es una posibilidad, no un hecho,
   y meterlo aquí volvía al bot tan miedoso que dejaba de jugar. */
function riesgo(v){
  const suyo = pegaMasFuerte(v, { conMano:false });
  if(!suyo) return 0;
  let r = 0;
  for(const c of v.monstruos){
    if(c.bocaAbajo || c.defensa) continue;         // tapado o agachado, aguanta
    if(atk(c) >= suyo) continue;                   // no se lo llevan
    r += valorCarta(c) + Math.max(0, suyo - atk(c))/PESOS.lpPorCarta;
  }
  return r * PESOS.riesgo;
}

/* ══════════════════════════════════════════════════════════════════
   VALORAR. Todo en cartas, desde mi lado.
   ══════════════════════════════════════════════════════════════════ */
export function valorar(v, plan){
  let n = 0;

  /* 1. Ventaja de cartas: la métrica que decide las partidas de Goat. */
  n += v.mano.length + v.monstruos.length + v.backrow.length;
  n -= v.manoRival.cuantas + v.monstruosRival.length + v.backrowRival.length;

  /* 2. Presencia: no es lo mismo tener tres fichas que un Black Luster. */
  for(const c of v.monstruos)      n += presencia(c);
  for(const c of v.monstruosRival) n -= presencia(c);

  /* 3. Puntos de vida. */
  n += (v.lp.mio - v.lp.rival) / PESOS.lpPorCarta;

  /* 4. Las piezas con las que gana este mazo, tenerlas a mano vale. */
  if(plan?.peso){
    for(const c of [...v.mano, ...v.monstruos, ...v.backrow])
      if(c?.nombre) n += plan.peso(c.nombre) * PESOS.piezaDelPlan;
    /* Y lo que SOSTIENE el plan, puesto en el campo, vale doble: sin esa
       carta el mazo no tiene plan (Necrovalley, Wave-Motion Cannon). */
    for(const c of v.backrow)
      if(c?.nombre && plan.sostiene?.(c.nombre) && !c.bocaAbajo) n += 0.8;
  }

  /* 5. Lo que me pueden quitar en su turno. */
  n -= riesgo(v);

  /* 6. Ganar es infinito y perder también. */
  if(v.lp.rival <= 0) return 999;
  if(v.lp.mio   <= 0) return -999;

  return n;
}

/* ══════════════════════════════════════════════════════════════════
   EL TABLERO DESPUÉS — estimado, no simulado.

   `aplicar` devuelve una COPIA de la vista con el efecto aplicado por
   encima. No pretende ser exacto: pretende que "destruir su monstruo
   grande" y "robar dos cartas" se puedan comparar con la misma vara.
   ══════════════════════════════════════════════════════════════════ */
const copia = v => ({
  ...v,
  mano: [...v.mano], monstruos: [...v.monstruos], backrow: [...v.backrow],
  monstruosRival: [...v.monstruosRival], backrowRival: [...v.backrowRival],
  cementerio: [...v.cementerio],
  manoRival: { ...v.manoRival },
  lp: { ...v.lp },
});

/* El mejor monstruo del rival que merezca la pena quitar de en medio. */
const suMejor = v => v.monstruosRival
  .filter(c=>!c.bocaAbajo).sort((a,b)=>poder(b)-poder(a))[0] ?? null;

/* efecto = { destruyeMonstruoRival, destruyeBackrowRival, barreMonstruos,
              roba, invoca, robaControl, dano, pierdoMano, pierdoCampo,
              gastaCarta } */
export function aplicar(v, efecto = {}){
  const n = copia(v);
  const quitar = (arr, c) => { const i = arr.indexOf(c); if(i>=0) arr.splice(i,1); };

  if(efecto.gastaCarta){
    // la carta que se juega deja de estar en la mano
    if(n.mano.length) n.mano = n.mano.slice(1);
  }
  if(efecto.destruyeMonstruoRival){
    const obj = suMejor(n); if(obj) quitar(n.monstruosRival, obj);
  }
  if(efecto.barreMonstruos){
    n.monstruosRival = []; n.monstruos = [];
  }
  if(efecto.destruyeBackrowRival && n.backrowRival.length) n.backrowRival.pop();
  if(efecto.roba)      n.mano = [...n.mano, ...Array(efecto.roba).fill({nombre:null})];
  if(efecto.pierdoMano) n.mano = n.mano.slice(0, Math.max(0, n.mano.length - efecto.pierdoMano));
  if(efecto.leQuitoMano) n.manoRival.cuantas = Math.max(0, n.manoRival.cuantas - efecto.leQuitoMano);
  if(efecto.invoca)    n.monstruos = [...n.monstruos, efecto.invoca];
  if(efecto.pierdoCampo){
    for(const c of efecto.pierdoCampo) quitar(n.monstruos, c);
  }
  if(efecto.robaControl){
    const obj = suMejor(n);
    if(obj){ quitar(n.monstruosRival, obj); n.monstruos = [...n.monstruos, obj]; }
  }
  if(efecto.dano)      n.lp = { ...n.lp, rival: n.lp.rival - efecto.dano };
  if(efecto.mePega)    n.lp = { ...n.lp, mio:   n.lp.mio   - efecto.mePega };
  return n;
}

/* La nota de una jugada: lo que mejora el tablero, en cartas. */
export function delta(v, efecto, plan){
  return valorar(aplicar(v, efecto), plan) - valorar(v, plan);
}

/* ── traducir lo que sabemos de una carta a un efecto ──
   Une las dos fuentes que ya existen: la tabla escrita a mano
   (`knowledge.js`, 109 cartas) y el lector de textos (`lectura.js`, el
   resto). Devuelve null cuando no se sabe qué hace, y entonces el
   cerebro se queda con su criterio de siempre en vez de inventarse un
   número: el defecto correcto es "no sé", no "vale 1.2". */
export function efectoDe(carta, lee){
  const inf = infoDe(carta);
  const e = { gastaCarta:true };
  switch(inf.rol){
    case "draw":         e.roba = 2; break;
    case "handRip":      e.leQuitoMano = 2; e.mePega = 1000; break;
    case "removal":      e.destruyeMonstruoRival = true; break;
    case "spellRemoval": e.destruyeBackrowRival = true; break;
    case "massRemoval":  e.destruyeBackrowRival = true; break;
    case "trapMass":     e.barreMonstruos = true; break;
    case "equipSteal":   e.robaControl = true; break;
    case "buscador":     e.roba = 2; e.pierdoMano = 1; break;
    default:
      /* Lo que diga el texto, si es que dice algo. */
      if(!lee?.hace) return null;
      switch(lee.hace){
        case "monstruoRivalUtil": e.destruyeMonstruoRival = true; break;
        case "backrowRival":      e.destruyeBackrowRival = true; break;
        case "algoDelRival":      e.destruyeMonstruoRival = true; break;
        case "mazoPropio":        e.roba = 1; break;
        case "manoRival":         e.leQuitoMano = 1; break;
        default: return null;
      }
  }
  return e;
}
