/* ══════════════════════════════════════════════════════════════════
   NÚMEROS DEL MODO HISTORIA — TODOS JUNTOS Y EN UN SITIO

   Regla del proyecto: los números que se van a tocar no viven repartidos
   por el código. Aquí está todo lo que se ajusta al probar: apuestas de
   Star Chips, forma del mapa, pesos de rareza por acto y contrato de los
   packs. Cambiar el equilibrio del juego no debería obligar a tocar
   ninguna función.
   ══════════════════════════════════════════════════════════════════ */

export const CHIPS = {
  inicio: 2,               // con los que empiezas la run
  meta: 10,                // los que hacen falta para entrar al castillo
  duelo:   { apuesta:1, gana:+1, pierde:-1 },
  elite:   { apuesta:1, gana:+2, pierde:-1 },
  jefe:    { apuesta:1, gana:+2, pierde:-1 },
  /* Apuesta doble: solo donde el nodo la ofrece, y nunca por encima de
     lo que tienes. */
  altaApuesta: { apuesta:2, gana:+2, pierde:-2 },
  /* ══ EN EL CASTILLO LAS ESTRELLAS PESAN MÁS ══
     E, 03-10: «cuando se llega al castillo las estrellas ya dan igual:
     no puedes salir aunque pierdas todas las partidas hasta quedarte con
     una». Los peldaños pagaban como un Elite (+2/−1): a partir del 40% de
     victorias la cuenta subía sola y la torre solo alargaba. Ahora ganar
     da una y perder quita dos, y a cero se acaba la run como en la isla.
     Elegido por E entre tres opciones (las otras: volver a la isla al
     bajar de diez, o muerte súbita). */
  torre: { apuesta:2, gana:+1, pierde:-2 },
};

/* Cuántas columnas tiene cada acto y qué puede salir en cada una.
   El mapa es de columnas como el de Slay the Spire: en cada columna hay
   una o dos opciones y eliges por dónde pasas. La lista de tipos ES la
   restricción: sin ella el mapa era ruido y podía salir una run de siete
   duelos seguidos o de ninguno. */
export const ACTOS = [
  {
    id: "orillas", nombre: "Las orillas",
    /* Los dos primeros nodos son suaves a propósito: el mazo inicial
       tiene que poder con ellos, y no hay Elites en las dos primeras
       columnas.
       LA FORMA IMPORTA MÁS DE LO QUE PARECE: la primera versión permitía
       cinco duelos en un acto y salían runs de doce peleas, o sea una
       hora larga. Las columnas se alternan a propósito para que como
       mucho haya CUATRO duelos por acto contando el jefe, y como poco
       dos: así la run se queda entre 6 y 12, con 9 de media. */
    /* ══ TRES TIPOS EN ALGUNAS COLUMNAS ══
       Con dos tipos por columna, el generador no podía sacar nunca una
       columna de tres nodos —salían 0 de 300 mapas— y todas las
       bifurcaciones eran iguales. Las columnas de en medio ofrecen tres
       para que la forma del mapa varíe de verdad; la primera y el jefe
       siguen siendo paso obligado. */
    columnas: [
      { tipos:["DUELO"], suave:true },
      /* SIN MERCADER AQUÍ: ver `mercaderDesdeColumna` en REGLAS_MAPA.
         Con un solo duelo jugado no tienes cartas que cambiar y el nodo
         se gasta sin darte nada. Lo reportó E. */
      { tipos:["EVENTO","PACK"] },
      { tipos:["DUELO","CAMPAMENTO","EVENTO"] },
      { tipos:["PACK","MERCADER","CAMPAMENTO"] },
      { tipos:["DUELO","ELITE"] },
      { tipos:["EVENTO","PACK","MERCADER"] },
      { tipos:["JEFE"] },
    ],
    tier: 1, nivelIA: ["normal","duro"],
  },
  {
    id: "interior", nombre: "El interior de la isla",
    columnas: [
      { tipos:["DUELO","EVENTO","PACK"] },
      { tipos:["PACK","MERCADER","CAMPAMENTO"] },
      { tipos:["ELITE","DUELO"] },
      { tipos:["EVENTO","PACK","MERCADER"] },
      { tipos:["DUELO","CAMPAMENTO","EVENTO"] },
      { tipos:["PACK","MERCADER","CAMPAMENTO"] },
      { tipos:["JEFE"] },
    ],
    tier: 2, nivelIA: ["duro","experto"],
  },
  /* ══ EL ACTO III YA NO ES UN MAPA: ES LA TORRE ══
     La isla es procedural. El castillo NO. Cuando juntas las diez fichas
     entras en un torneo con orden escrito, y esa es la mitad de la
     gracia: el mapa se acaba, la ruta se acaba, y lo que queda es subir
     peldaños contra los cuatro duelistas que quedan en pie y Pegasus.

     Una sola columna por nodo: aquí no se elige camino. Las dos casillas
     de utilidad están puestas donde sirven —después del segundo duelo y
     justo antes de Pegasus— para que te dé tiempo a rematar el motor.
     El rival concreto lo pone `torreDeLaRun()`, que quita al personaje
     que estás jugando. */
  {
    id: "castillo", nombre: "El castillo de Pegasus", torre: true,
    /* ══ LA TORRE SE ESTIRA PARA EL CUSTOM ══
       Con un protagonista son cuatro duelistas + Pegasus. Con el Custom
       son CINCO + Pegasus, así que hay un peldaño extra y una parada de
       preparación más para que la longitud de más no sea solo cansancio:
       `generarActo` recorta o alarga esta plantilla según los peldaños
       que toquen. */
    columnas: [
      { tipos:["TORRE"] },        // 1º duelista
      { tipos:["TORRE"] },        // 2º duelista
      { tipos:["PREPARACION"] },  // pack / mercader / campamento, eliges
      { tipos:["TORRE"] },        // 3º duelista
      { tipos:["TORRE"] },        // 4º duelista
      { tipos:["TORRE"] },        // 5º duelista (solo con el Custom)
      { tipos:["PACK"] },         // último sobre antes del jefe
      { tipos:["TORRE"] },        // Pegasus
    ],
    tier: 3, nivelIA: ["experto"],
  },
];

/* ══ EL ORDEN DE LA TORRE ══
   Fijo y de menos a más duro. La dificultad es intrínseca: si juegas con
   Yugi, Kaiba NO baja a cuarto puesto de dificultad por ser el último
   antes de Pegasus — sigue siendo Kaiba. Elegir personaje cambia de
   verdad el final de la partida. */
export const TORRE = ["mai", "keith", "joey", "kaiba", "yugi"];

/* Quita al personaje que juegas y deja los cuatro duelistas + Pegasus.
   NO se sustituye al excluido por nadie de la isla: la torre tiene cinco
   peldaños, no seis. */
/* ══ EL CUSTOM NO SE QUITA A NADIE ══
   Los cinco protagonistas se eliminan a sí mismos de la torre: no te
   duelas contigo. El duelista Custom no ES ninguno de los cinco, así que
   su torre lleva los CINCO más Pegasus. Seis combates en vez de cinco: la
   run Custom es a propósito un poco más larga y más dura, que es lo que
   la hace un modo aparte y no un reskin. */
export function torreDeLaRun(personaje){
  return [...TORRE.filter(id => id !== personaje), "pegasus"];
}
/* Cuántos peldaños de duelista tiene la torre de esta run. */
export function peldañosDeLaRun(personaje){
  return TORRE.filter(id => id !== personaje).length;
}

/* Lo que el mapa TIENE que cumplir. Si una generación no lo cumple, se
   repara; si no se puede reparar, se descarta y se vuelve a generar.
   El generador comprueba esto contra TODOS los caminos posibles, no
   contra el camino que se le ocurra al jugador. */
export const REGLAS_MAPA = {
  packAntesDelJefe: true,      // ningún camino llega al jefe sin un pack
  utilidadPorActo: true,       // en actos I y II, campamento o mercader
  duelosMinimos: 2,            // por acto, contando el jefe
  duelosMaximos: 4,
  /* ══ EL MERCADER NECESITA QUE TENGAS ALGO QUE DARLE ══
     Se paga con cartas del binder, y al empezar la run el binder está
     casi vacío: con un solo duelo jugado ninguna receta se puede pagar,
     así que salía un nodo que solo servía para gastarse. Lo reportó E.
     Va como REGLA y no solo quitándolo de la plantilla porque `reparar`
     puede volver a poner cualquier tipo que la columna permita: la
     plantilla dice qué se siembra y la regla dice qué no se acepta. */
  mercaderDesdeColumna: 2,     // solo en el acto I; después ya tienes cartas
  /* Con esto y las apuestas de arriba tiene que existir SIEMPRE un camino
     que llegue a 10 fichas. Es la comprobación que no puede fallar nunca:
     una semilla sin ese camino es una run imposible. */
  chipsAlcanzables: 10,
};

/* Rareza interna (no es la rareza impresa de la carta): cuánto pesa
   cada tramo en la casilla de staple de un pack, por acto. */
export const RAREZA = {
  1: { R:70, SR:27, UR:3 },
  2: { R:55, SR:37, UR:8 },
  3: { R:40, SR:45, UR:15 },
};
/* La casilla premium de un pack de Elite sube un escalón. */
export const RAREZA_ELITE = {
  1: { R:45, SR:45, UR:10 },
  2: { R:30, SR:50, UR:20 },
  3: { R:20, SR:50, UR:30 },
};

/* Las diez casillas de un pack. El jugador se queda las diez. */
export const PACK = [
  "STAPLE", "STAPLE",     // 1-2  poder genérico
  "TIPO",                 // 3    monstruo del tipo que más juegas
  "FAMILIA", "FAMILIA",   // 4-5  la familia que has elegido
  "JUGABLE", "JUGABLE", "JUGABLE",  // 6-8
  "PIVOTE",               // 9    otra estrategia
  "PREMIUM",              // 10
];

/* Recompensa normal de un duelo: tres cartas, eliges una. */
export const RECOMPENSA = {
  cuantas: 3,
  papeles: ["SINERGIA", "CALIDAD", "PIVOTE"],
  /* Suelo de calidad: fuera de los eventos de morralla, no se ofrecen
     tres cartas malas. Si las tres caen por debajo, se vuelve a tirar
     (de forma determinista, del mismo hilo de azar). */
  suelo: 2,               // en la escala C=1, R=2, SR=3, UR=4
  reintentos: 4,
};

export const CAMPAMENTO = {
  fortificar: { lpExtra:1000, duelos:3, topeLP:10000 },
};

export const MERCADER = {
  recetas: [
    { id:"morralla",  pide:{ rareza:"C", n:10 }, da:{ rareza:"R",  elegir:3 } },
    { id:"enfocado",  pide:{ rareza:"C", n:15, mismaCategoria:true },
                      da:{ rareza:"R+SR", elegir:3, mismaCategoria:true } },
    { id:"premium",   pide:{ rareza:"C", n:20 }, da:{ rareza:"SR", elegir:3 } },
    { id:"prestigio", pide:{ mezcla:[["SR",2],["R",2]] }, da:{ rareza:"UR", elegir:3 }, porVisita:1 },
    { id:"cambio",    pide:{ mismaRarezaN:2 },  da:{ mismaRareza:true, elegir:3 }, porVisita:1 },
  ],
};

export const EVENTOS = { morralla: { cuantas:40 } };
