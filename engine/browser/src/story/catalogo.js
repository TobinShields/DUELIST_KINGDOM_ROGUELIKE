/* ══════════════════════════════════════════════════════════════════
   EL CATÁLOGO — QUÉ ES CADA CARTA PARA EL MODO HISTORIA

   Los datos entran por parámetro, no se leen de disco: en el navegador
   vienen del HTML (que ya lleva el pool dentro) y en las pruebas de los
   JSON de `engine/data`. Es lo que permite probar todo el sistema de
   recompensas sin abrir un navegador.

   RAREZA DE HISTORIA ≠ RAREZA IMPRESA. Aquí "UR" quiere decir "esta
   carta cambia la run", no que Konami la imprimiera en holográfica.
   Swords of Revealing Light está limitada y NO es un premio gordo;
   Pot of Greed sí. Las tres listas salen del brief (ultra/super/rare) y
   TODO LO DEMÁS del pool es C: morralla, que es justo lo que hace que
   abrir un pack signifique algo.
   ══════════════════════════════════════════════════════════════════ */

export const RAREZAS = ["C", "R", "SR", "UR"];
export const VALOR_RAREZA = { C:1, R:2, SR:3, UR:4 };

const TIPO = { MONSTRUO:0x1, MAGICA:0x2, TRAMPA:0x4, FUSION:0x40, FICHA:0x4000 };

export function crearCatalogo({ pools, db, limites, pool, nombres }){
  /* db: {code → {type, race, level, attack, defense}} — el mismo objeto
     que usa el simulador. `race` puede venir como texto (viene así en el
     JSON del repo) o como BigInt: se normaliza a número. */
  const dato = c => db[c] ?? db[String(c)] ?? null;
  const tipoDe = c => Number(dato(c)?.type ?? 0);
  const razaDe = c => Number(dato(c)?.race ?? 0);

  const rareza = new Map();
  for(const c of pools.ultra ?? []) rareza.set(c, "UR");
  for(const c of pools.super ?? []) if(!rareza.has(c)) rareza.set(c, "SR");
  for(const c of pools.rare  ?? []) if(!rareza.has(c)) rareza.set(c, "R");

  const legales = [...(pool ?? [])];
  /* Las fichas no son cartas que nadie pueda tener en un mazo. */
  const jugables = legales.filter(c => !(tipoDe(c) & TIPO.FICHA));

  const familias = {
    ARCANE:   pools.arcane  ?? [],
    WARRIOR:  pools.warrior ?? [],
    DRAGON:   pools.dragon  ?? [],
    RECRUIT:  pools.recruit ?? [],
    FORBID:   pools.forbid  ?? [],
  };

  /* ── LAS CARTAS QUE VALEN LA PENA ──
     No todo lo que no es UR/SR/R es basura: las cinco familias del brief
     son listas CURADAS (Dark Magician, los reclutadores, los Toon…) y
     una carta temática de ahí es un premio legítimo aunque en la escala
     de rareza sea C. El universo "curadas" es la unión de las tres
     listas de rareza y las cinco familias, y es de donde salen las
     recompensas. Sin esto, la casilla de sinergia cogía un monstruo
     cualquiera del pool con tu misma raza y la mitad de lo ofrecido era
     morralla de verdad. */
  const curadas = [...new Set([
    ...(pools.ultra ?? []), ...(pools.super ?? []), ...(pools.rare ?? []),
    ...Object.values(familias).flat(),
    ...(pools.fusion ?? []), ...(pools.fusionTematica ?? []),
  ])].filter(c => jugables.includes(c));

  const cat = {
    /* Lo que no está en ninguna de las tres listas es morralla. */
    rareza: c => rareza.get(c) ?? "C",
    valor:  c => VALOR_RAREZA[cat.rareza(c)],
    tope:   c => limites[String(c)] ?? 3,
    nombre: c => nombres?.[c]?.name ?? nombres?.[String(c)]?.[0] ?? ("#"+c),
    /* El texto de la carta. `pool_texts.json` es [nombre, texto] y en el
       navegador llega el mismo objeto, así que sirve para las dos. */
    texto: c => nombres?.[c]?.desc ?? nombres?.[String(c)]?.desc
             ?? nombres?.[c]?.[1] ?? nombres?.[String(c)]?.[1] ?? "",
    datos: c => dato(c),
    esMonstruo: c => !!(tipoDe(c) & TIPO.MONSTRUO),
    esFusion:   c => !!(tipoDe(c) & TIPO.FUSION),
    raza: razaDe,
    nivel: c => Number(dato(c)?.level ?? 0),
    categoria: c => (tipoDe(c) & TIPO.MONSTRUO) ? "MONSTRUO"
                  : (tipoDe(c) & TIPO.TRAMPA)   ? "TRAMPA" : "MAGICA",
    /* El Extra Deck del modo historia va aparte del principal. */
    vaAlExtra: c => !!(tipoDe(c) & TIPO.FUSION),
    familias,
    jugables,
    porRareza: r => jugables.filter(c => cat.rareza(c) === r),
    /* Las fusiones que el brief marca como objetivo de progresión. */
    fusiones: [...(pools.fusion ?? []), ...(pools.fusionTematica ?? [])],
    curadas,
    maestriaYugi: pools.maestria ?? [],
    /* ══ LA GUÍA DE SOBRES SALE DE AQUÍ, NO DE UNA LISTA APARTE ══
       "Debe derivar directamente de los datos reales del generador, no
       de una lista duplicada mantenida a mano". Estas dos funciones leen
       las MISMAS listas que reparte `abrirPack`, así que si mañana se
       mueve una carta de familia la guía lo dice sola. */
    dondeSale: c => {
      const dentro = [];
      for(const [id, lista] of Object.entries(familias))
        if(lista.includes(c)) dentro.push({ pack:id, casilla:"FAMILIA" });
      /* Las casillas STAPLE de TODOS los sobres tiran de las listas de
         rareza: una carta ultra/super/rara puede salir en cualquiera. */
      const r = cat.rareza(c);
      if(r !== "C") dentro.push({ pack:"cualquiera", casilla:"STAPLE", rareza:r });
      if((pools.fusion ?? []).includes(c) || (pools.fusionTematica ?? []).includes(c))
        dentro.push({ pack:"cualquiera", casilla:"PREMIUM" });
      return dentro;
    },
    /* Lo que puede salir de un sobre concreto, ya ordenado como se
       enseña: primero lo temático, luego lo que puede caer por rareza. */
    contenidoDe: fam => ({
      familia: [...(familias[fam] ?? [])],
      staples: RAREZAS.flatMap(r => cat.porRareza(r)),
      premium: [...(pools.fusion ?? []), ...(pools.fusionTematica ?? [])],
    }),
  };

  /* Índices que se piden mucho: se calculan una vez. */
  cat.porRarezaCache = Object.fromEntries(RAREZAS.map(r => [r, cat.porRareza(r)]));
  cat.porRareza = r => cat.porRarezaCache[r] ?? [];

  return cat;
}

/* El tipo de monstruo que más juegas: hace falta para la casilla 3 de
   cada pack ("un monstruo del tipo que llevas"). Se mira el mazo
   principal; si no hay monstruos todavía —mazo a medio montar— se cae
   al tipo del starter, y si tampoco, a null y la casilla se rellena con
   un monstruo cualquiera del pool. */
export function razaDominante(cat, mazoMain, respaldo = []){
  const cuenta = new Map();
  for(const lista of [mazoMain, respaldo]){
    for(const c of lista ?? []){
      if(!cat.esMonstruo(c)) continue;
      const r = cat.raza(c);
      if(!r) continue;
      cuenta.set(r, (cuenta.get(r) ?? 0) + 1);
    }
    if(cuenta.size) break;      // el mazo manda; el respaldo solo si el mazo no dice nada
  }
  if(!cuenta.size) return null;
  return [...cuenta.entries()].sort((a,b)=>b[1]-a[1])[0][0];
}
