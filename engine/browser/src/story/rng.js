/* ══════════════════════════════════════════════════════════════════
   AZAR SEMBRADO Y SERIALIZABLE

   Todo lo que genera el modo historia —el mapa, los rivales, los packs,
   las recompensas, los eventos— sale de aquí. `Math.random` no vale para
   nada de esto por dos motivos:

     · la partida se guarda a media run y hay que poder seguir EXACTAMENTE
       donde estaba, así que el estado del generador tiene que caber en el
       JSON del guardado;
     · una semilla compartida ("DK-7HF82A") tiene que dar el mismo mapa en
       el ordenador de otro.

   Es sfc32: cuatro enteros de 32 bits, rápido, de calidad de sobra para
   esto y trivial de serializar (son cuatro números).

   Y una cosa más, aprendida en el simulador: `domstub.mjs` fija el azar
   del proceso entero para que las pruebas no parpadeen. Aquí no hace
   falta ese truco porque el azar YA es explícito: se pasa el generador.
   ══════════════════════════════════════════════════════════════════ */

/* Semilla legible: DK-7HF82A. Se enseña, se copia y se pega. */
const LETRAS = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";   // sin I ni O: se confunden

export function semillaTexto(rnd = Math.random){
  let s = "";
  for(let i=0;i<6;i++) s += LETRAS[Math.floor(rnd()*LETRAS.length)];
  return "DK-" + s;
}

/* Texto → cuatro enteros. Es el hash FNV-1a, mezclado cuatro veces para
   que dos semillas parecidas ("DK-AAAAAA" y "DK-AAAAAB") no empiecen en
   estados parecidos. */
export function estadoDeSemilla(texto){
  let h = 2166136261 >>> 0;
  const s = String(texto).toUpperCase();
  const paso = () => {
    for(let i=0;i<s.length;i++){
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0;
    h ^= h >>> 13; h = Math.imul(h, 3266489909) >>> 0;
    h ^= h >>> 16;
    return h >>> 0;
  };
  const estado = [paso(), paso(), paso(), paso()];
  /* CALENTAR AQUÍ Y NO EN `crearRng`. sfc32 necesita unas cuantas
     tiradas para separarse de su estado inicial, pero si ese calentado
     está en `crearRng`, restaurar un estado guardado lo vuelve a hacer
     y se salta doce tiradas: la run seguía por otro sitio después de
     cerrar el navegador. Calentando aquí, `crearRng` es puro. */
  const r = crearRng(estado);
  for(let i=0;i<12;i++) r();
  return r.estado();
}

/* El generador. `estado` es un array de 4 enteros que se puede guardar y
   volver a cargar tal cual. */
export function crearRng(estado){
  let [a,b,c,d] = estado.map(x => x >>> 0);
  const rng = () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) >>> 0;
    a = (b ^ (b >>> 9)) >>> 0;
    b = (c + (c << 3)) >>> 0;
    c = ((c << 21) | (c >>> 11)) >>> 0;
    d = (d + 1) >>> 0;
    t = (t + d) >>> 0;
    c = (c + t) >>> 0;
    return (t >>> 0) / 4294967296;
  };
  rng.estado  = () => [a,b,c,d];
  rng.entero  = n => Math.floor(rng() * n);                  // 0..n-1
  rng.entre   = (min,max) => min + Math.floor(rng()*(max-min+1));
  rng.uno     = arr => arr[Math.floor(rng()*arr.length)];
  /* Barajar in situ (Fisher-Yates). Devuelve una copia: mutar la lista
     que te pasan es la clase de sorpresa que se paga cara. */
  rng.barajar = arr => {
    const b2 = [...arr];
    for(let i=b2.length-1;i>0;i--){ const j = Math.floor(rng()*(i+1)); [b2[i],b2[j]]=[b2[j],b2[i]]; }
    return b2;
  };
  /* Elegir con pesos: `pesos` es un objeto {clave: peso} o una lista de
     [cosa, peso]. Devuelve la clave/cosa. */
  rng.pesado = pesos => {
    const pares = Array.isArray(pesos) ? pesos : Object.entries(pesos);
    let total = 0;
    for(const [,p] of pares) total += p;
    let t = rng() * total;
    for(const [k,p] of pares){ t -= p; if(t <= 0) return k; }
    return pares[pares.length-1][0];
  };
  /* Coger n elementos distintos de una lista. */
  rng.coger = (arr, n) => rng.barajar(arr).slice(0, n);
  return rng;
}

/* Atajo: de semilla legible a generador listo. */
export const rngDeSemilla = texto => crearRng(estadoDeSemilla(texto));
