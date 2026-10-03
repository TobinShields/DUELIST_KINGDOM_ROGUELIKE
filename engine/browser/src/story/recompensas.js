/* ══════════════════════════════════════════════════════════════════
   RECOMPENSAS Y PACKS

   Dos formas de conseguir cartas y una regla que las separa:

   · GANAR UN DUELO NORMAL → tres cartas, eliges UNA. Una que va con lo
     que ya juegas, una buena en general y una que te invita a cambiar de
     plan. Con SUELO DE CALIDAD: fuera de los eventos de morralla, no se
     te ofrecen tres cartas malas. Si las tres caen por debajo del suelo,
     se vuelve a tirar del mismo hilo de azar (o sea, sigue siendo
     reproducible con la semilla).

   · ABRIR UN PACK → diez cartas y te quedas las diez, con un contrato de
     casillas fijo (`PACK` en balance.js). La familia la eliges TÚ: el
     juego no la decide por ti mirando tu mazo, porque entonces sería
     imposible empezar con Yugi y acabar jugando dragones.

   Y una regla que atraviesa todo: no se ofrece una carta de la que ya
   tienes el máximo legal de copias. Un premio que no puedes usar no es
   un premio.
   ══════════════════════════════════════════════════════════════════ */
import { RAREZA, RAREZA_ELITE, PACK, RECOMPENSA } from "./balance.js";
import { copiasQueTengo } from "./coleccion.js";
import { razaDominante } from "./catalogo.js";

/* Filtro común: cartas que el jugador aún puede aprovechar. */
const util = (run, cat) => c => copiasQueTengo(run, c) < cat.tope(c);

/* Elegir una carta de una lista respetando el filtro. Si no queda
   ninguna aprovechable se cae a la lista entera antes que devolver
   nada: quedarse sin premio es peor que repetir. */
function sacar(rng, lista, filtro){
  const buenas = lista.filter(filtro);
  const de = buenas.length ? buenas : lista;
  return de.length ? rng.uno(de) : null;
}

/* ══════════ RECOMPENSA DE DUELO ══════════ */
export function recompensaDuelo(run, cat, rng, { acto=1, elite=false } = {}){
  const filtro = util(run, cat);
  const raza = razaDominante(cat, run.mazo.main);
  let pesos = (elite ? RAREZA_ELITE : RAREZA)[acto] ?? RAREZA[1];
  /* ══ MANO FIRME (maestría 3) ══
     Sube un escalón la rareza de las tres recompensas. No da cartas de
     más ni estadísticas: cambia la CALIDAD de lo que te ofrecen, que es
     la clase de ventaja que hace pensar en vez de ganar sola. La tabla
     de Elite ya es "un escalón arriba", así que se reutiliza en vez de
     inventar números nuevos. */
  if(run?.pasivo === "mano-firme" && !elite)
    pesos = RAREZA_ELITE[acto] ?? pesos;

  /* ══ EL BUFF DE UN ENCUENTRO QUE NADIE LEÍA ══
     «La próxima recompensa la verás con otros ojos» ponía
     `run.buffs.mejorarProxima = true` y AHÍ SE QUEDABA: ningún sitio del
     código lo consultaba, así que esa opción del evento del abuelo no
     hacía absolutamente nada. Es literalmente el "los eventos no hacen
     nada" que reportó E. Sube un escalón la rareza igual que mano
     firme, y se GASTA: es de un solo uso. */
  if(run?.buffs?.mejorarProxima){
    pesos = RAREZA_ELITE[acto] ?? pesos;
    run.buffs.mejorarProxima = false;
    run.buffs.mejoraGastada = true;   // para que la pantalla lo pueda contar
  }

  const deRareza = () => cat.porRareza(rng.pesado(pesos));

  const generar = () => {
    /* A) SINERGIA: algo del tipo que más juegas, o de la familia de tu
       plan si no llevas monstruos aún. */
    /* De las CURADAS, no de todo el pool: un monstruo cualquiera con tu
       misma raza no es una recompensa, es relleno. */
    const conSinergia = cat.curadas.filter(c =>
      cat.esMonstruo(c) && raza && cat.raza(c) === raza);
    const a = sacar(rng, conSinergia.length ? conSinergia : cat.porRareza("R"), filtro);
    /* B) CALIDAD: de las listas buenas, con los pesos del acto. */
    const b = sacar(rng, deRareza(), c => filtro(c) && c !== a);
    /* C) PIVOTE: otra estrategia. Sale de una familia distinta a la que
       más pesa en tu mazo, para que sea de verdad una alternativa. */
    const familias = Object.values(cat.familias);
    const pivote = familias[rng.entero(familias.length)] ?? [];
    const c = sacar(rng, pivote, x => filtro(x) && x !== a && x !== b);
    return [a, b, c].filter(x => x != null);
  };

  let trio = generar();
  /* Suelo de calidad: tres cartas por debajo del suelo es justo lo que
     hace que una recompensa se sienta a basura. Se vuelve a tirar unas
     cuantas veces; si el azar se empeña, se acepta lo que haya (mejor
     una recompensa floja que un bucle infinito). */
  for(let i=0; i<RECOMPENSA.reintentos; i++){
    if(trio.some(c => cat.valor(c) >= RECOMPENSA.suelo)) break;
    trio = generar();
  }
  return trio.map((code, i) => ({ code, papel: RECOMPENSA.papeles[i] ?? "CALIDAD",
                                  rareza: cat.rareza(code) }));
}

/* ══════════ PACKS ══════════ */
export const FAMILIAS = [
  { id:"ARCANE",  nombre:"Artes arcanas",     desc:"Lanzadores de conjuros, control por volteo y rituales" },
  { id:"WARRIOR", nombre:"Arsenal del guerrero", desc:"Guerreros, buscadores y presión de TIERRA" },
  { id:"DRAGON",  nombre:"El rugido del dragón", desc:"Ojos Azules, Ojos Rojos y dragones grandes" },
  { id:"RECRUIT", nombre:"Frente de reclutas",  desc:"Agua, viento e insectos: cadenas de reclutadores" },
  { id:"FORBID",  nombre:"Tácticas prohibidas", desc:"Cabras, Metamorphosis, Caos y cementerio" },
];

export function abrirPack(run, cat, rng, { familia, acto=1, elite=false } = {}){
  const filtro = util(run, cat);
  const pesos = (elite ? RAREZA_ELITE : RAREZA)[acto] ?? RAREZA[1];
  const dePack = cat.familias[familia] ?? cat.familias.FORBID ?? [];
  const raza = razaDominante(cat, run.mazo.main);

  const otras = Object.entries(cat.familias).filter(([k]) => k !== familia).map(([,v]) => v);
  const cartas = [];

  for(const casilla of PACK){
    let elegida = null;
    switch(casilla){
      case "STAPLE":
        elegida = sacar(rng, cat.porRareza(rng.pesado(pesos)), filtro);
        break;
      case "TIPO": {
        /* La casilla 3 SIEMPRE es un monstruo del tipo que más juegas.
           Es lo que hace que un pack no te llegue lleno de cartas que no
           encajan con nada de lo tuyo. */
        const dela = cat.curadas.filter(c => cat.esMonstruo(c) && raza && cat.raza(c) === raza);
        elegida = sacar(rng, dela.length ? dela : dePack.filter(c=>cat.esMonstruo(c)), filtro);
        break;
      }
      case "FAMILIA":
        elegida = sacar(rng, dePack, filtro);
        break;
      case "JUGABLE":
        /* "Jugable" no es "cualquier cosa del pool": eso llenaría el
           pack de morralla. Es R o mejor, o de la familia elegida. */
        elegida = sacar(rng, [...cat.porRareza("R"), ...dePack], filtro);
        break;
      case "PIVOTE":
        elegida = sacar(rng, otras[rng.entero(otras.length)] ?? dePack, filtro);
        break;
      case "PREMIUM": {
        /* La décima es la que se recuerda: fusión de progresión o carta
           gorda, con los pesos del acto (y mejorados si el pack venía de
           un Elite). */
        const premium = rng() < 0.25 ? cat.fusiones : cat.porRareza(rng.pesado(pesos));
        elegida = sacar(rng, premium.length ? premium : cat.porRareza("SR"), filtro);
        break;
      }
    }
    if(elegida != null) cartas.push({ code:elegida, casilla, rareza:cat.rareza(elegida) });
  }
  return cartas;
}

/* ══════════ MORRALLA ══════════
   El evento del baúl: cuarenta cartas de relleno de golpe. Es la única
   excepción al suelo de calidad, y existe para dos cosas: montar mazos
   raros y darle de comer al mercader. */
export function morralla(cat, rng, cuantas = 40){
  /* SIN FUSIONES. El pool tiene fusiones de relleno y colarlas aquí
     hacía dos cosas mal: regalaba Extra Deck que el brief quiere como
     progresión, y las cartas se iban al binder de fusiones, así que el
     mercader —que cobra del binder normal— se quedaba corto de
     morralla sin que se viera por qué. */
  const bulk = cat.porRareza("C").filter(c => !cat.vaAlExtra(c));
  const salida = [];
  for(let i=0;i<cuantas;i++) salida.push(rng.uno(bulk));
  return salida;
}
