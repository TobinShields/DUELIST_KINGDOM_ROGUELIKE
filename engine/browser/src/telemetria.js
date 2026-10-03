/* ══════════════════════════════════════════════════════════════════
   CUÁNTA GENTE JUEGA, Y HASTA DÓNDE LLEGA

   El juego no tiene servidor y no lo va a tener. Pero saber cuántas
   runs se empiezan, en qué acto se abandonan y cuántas llegan a Pegasus
   es la única forma de ajustar la dificultad con datos en vez de con
   intuición — que es exactamente el error que este proyecto lleva
   evitando desde el principio.

   Se usa GoatCounter: sin cookies, sin huella del navegador, sin datos
   personales, y de código abierto. Aquí NO se carga su script: se manda
   un píxel a su endpoint. Eso significa cero JavaScript de terceros
   dentro del HTML, que es lo coherente con un archivo que se abre con
   doble clic.

   ══ LAS TRES REGLAS QUE NO SE NEGOCIAN ══

   1 · SI EL ARCHIVO SE ABRE DESDE EL DISCO, NO SE MANDA NADA. Alguien
       que se descarga el HTML y lo abre offline no ha pedido participar
       en ninguna estadística, y además puede no tener red. Se exige
       `http(s)` y un host que no sea local.
   2 · NUNCA VIAJA NADA QUE IDENTIFIQUE A NADIE. Solo nombres de evento
       de una lista cerrada, con números redondeados a tramos. No hay
       identificadores, ni semillas, ni nombres de mazo escritos por el
       jugador.
   3 · SE PUEDE APAGAR, Y APAGADO ES APAGADO. La preferencia vive en
       Opciones y en `localStorage`; con ella en `0` esta función no
       llega ni a construir la URL.

   Y una cuarta, práctica: **esto nunca puede romper una partida**. Todo
   va dentro de un `try` que se traga cualquier fallo. Una estadística
   que tira el juego no vale nada.

   Cómo se enciende: se pone el código de sitio de GoatCounter en
   `SITIO` (el subdominio de `TUCODIGO.goatcounter.com`). Vacío = todo
   esto está muerto y no se manda un solo byte.
   ══════════════════════════════════════════════════════════════════ */

/* El subdominio de GoatCounter. Vacío hasta que se registre uno. */
const SITIO = "";

/* Dónde SÍ se cuenta. Cualquier otro sitio —incluido `file://` y
   `localhost`— se queda mudo. */
const PUBLICADO = /(^|\.)github\.io$/i;

const CLAVE = "goatTelemetria";     // "0" = apagada

let activa = null;                  // se decide una vez
let mandados = 0;                   // tope por sesión, por si acaso
const TOPE = 120;

function permitido(){
  if(activa != null) return activa;
  activa = false;
  try{
    if(!SITIO) return activa;
    const l = globalThis.location;
    if(!l || !/^https?:$/.test(l.protocol)) return activa;   // regla 1
    if(!PUBLICADO.test(l.hostname)) return activa;
    if(localStorage.getItem(CLAVE) === "0") return activa;    // regla 3
    /* Y si el navegador pide no ser seguido, se le hace caso. */
    if(globalThis.navigator?.doNotTrack === "1") return activa;
    activa = true;
  }catch(e){ activa = false; }
  return activa;
}

/* ══ LOS NÚMEROS VAN EN TRAMOS ══
   Un número exacto —los turnos de una partida, los minutos jugados— es
   un dato más identificable de lo que parece cuando se cruza con la
   hora. Y para decidir si la dificultad está bien, "entre 10 y 20
   turnos" dice lo mismo que "14". */
export function tramo(n, cortes = [1,3,5,10,20,40]){
  const x = Number(n) || 0;
  let ultimo = 0;
  for(const c of cortes){ if(x < c) return `${ultimo}-${c}`; ultimo = c; }
  return `${ultimo}+`;
}

/* Solo estas piezas pueden formar un nombre de evento. Cualquier cosa
   que venga de fuera se limpia: sin barras al principio (GoatCounter no
   las admite), sin acentos, sin espacios y con tope de largo. */
const limpiar = s => String(s ?? "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "").slice(0, 40);

/* ══ EL ENVÍO ══
   Un píxel, sin script de terceros. `sendBeacon` cuando existe (sigue
   funcionando aunque la pestaña se esté cerrando, que es justo cuando
   se manda el evento de "hasta dónde llegó"); si no, una imagen. */
export function evento(nombre, titulo){
  try{
    if(!permitido() || mandados >= TOPE) return;
    const p = limpiar(nombre);
    if(!p) return;
    mandados++;
    const url = `https://${SITIO}.goatcounter.com/count`
      + `?p=${encodeURIComponent(p)}&e=1`
      + (titulo ? `&t=${encodeURIComponent(String(titulo).slice(0,60))}` : "")
      + `&r=`;                       // sin referrer: no hace falta
    if(navigator.sendBeacon?.(url)) return;
    const img = new Image(); img.src = url;
  }catch(e){ /* una estadística jamás puede tirar una partida */ }
}

/* ══════════════════════════════════════════════════════════════════
   LO QUE SE MIDE, Y POR QUÉ CADA COSA

   Nada de esto es curiosidad: cada evento contesta una pregunta que
   ahora mismo solo se puede contestar preguntándole a la gente.
   ══════════════════════════════════════════════════════════════════ */
export const Tele = {
  /* ── EL DUELO SUELTO ──
     ¿hay algún mazo o alguna dificultad que nadie termina? */
  dueloEmpieza(modo, nivel, mazo){
    evento(`duel/start/${limpiar(modo)}/${limpiar(nivel)}`);
    if(mazo) evento(`deck/${limpiar(mazo)}`);
  },
  dueloTermina(ganado, turnos){
    evento(`duel/end/${ganado ? "win" : "lose"}`);
    evento(`duel/turns/${tramo(turnos, [5,10,20,30,45,60])}`);
  },

  /* ── EL REINO ──
     La pregunta gorda: ¿en qué punto se abandona una run? Con esto se
     ve la curva entera, de la primera columna a Pegasus. */
  runEmpieza(personaje){ evento(`kingdom/run/start/${limpiar(personaje)}`); },
  nodo(tipo){ evento(`kingdom/node/${limpiar(tipo)}`); },
  acto(n){ evento(`kingdom/act/${Number(n) + 1}`); },
  castillo(){ evento("kingdom/castle"); },
  runTermina(ganada, acto, chips){
    evento(`kingdom/run/end/${ganada ? "won" : "lost"}/act${Number(acto) + 1}`);
    evento(`kingdom/run/chips/${tramo(chips, [1,3,5,7,10])}`);
  },
  maestria(personaje, nivel){
    evento(`kingdom/mastery/${limpiar(personaje)}/${Number(nivel) || 0}`);
  },

  /* ── LO QUE SE ROMPE ──
     Un error que nadie reporta no existe. El mensaje se recorta y se
     limpia: viaja el TIPO de fallo, no el contenido. */
  error(mensaje){ evento(`error/${limpiar(mensaje)}`); },
  atascada(turnos){ evento(`stuck/turn-limit/${tramo(turnos, [40,60,80])}`); },

  /* ── CUÁNTO SE JUEGA ──
     Se manda una sola vez, al cerrar la pestaña. */
  sesion(minutos){ evento(`play/minutes/${tramo(minutos, [1,5,15,30,60])}`); },

  /* Para la casilla de Opciones. */
  encendida(){ try{ return localStorage.getItem(CLAVE) !== "0"; }catch(e){ return true; } },
  poner(v){ try{ localStorage.setItem(CLAVE, v ? "1" : "0"); activa = null; }catch(e){} },
  /* Si no hay código de sitio, la casilla ni se enseña: prometer que se
     puede apagar algo que no existe solo confunde. */
  disponible(){ return !!SITIO; },
};

/* El reloj de la sesión, montado una vez. */
try{
  if(typeof document !== "undefined"){
    const t0 = Date.now();
    let contado = false;
    const cerrar = () => {
      if(contado) return; contado = true;
      Tele.sesion(Math.round((Date.now() - t0) / 60000));
    };
    /* `pagehide` y no `unload`: es el único que dispara de verdad en
       Safari de iOS, que es donde más se juega en móvil. */
    addEventListener("pagehide", cerrar);
    addEventListener("visibilitychange", () => {
      if(document.visibilityState === "hidden") cerrar();
    });
  }
}catch(e){}
