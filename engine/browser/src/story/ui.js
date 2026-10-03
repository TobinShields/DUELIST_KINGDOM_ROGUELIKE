/* ══════════════════════════════════════════════════════════════════
   LA PANTALLA DEL REINO DE LOS DUELISTAS

   Aquí NO hay reglas de juego. Todas las decisiones las toma
   `historia.js`; esto solo pregunta "¿qué puedo hacer?", lo pinta, y
   avisa de lo que el jugador ha tocado. Si alguna vez esta pantalla
   necesita saber cuántas fichas cuesta un Elite, es que algo se ha
   puesto en el sitio equivocado.

   Un solo contenedor (`#reino`) con varias vistas dentro. Se pinta
   entera cada vez que cambia algo: son veinte nodos y unas pocas
   cartas, no hace falta nada más listo que eso, y así no puede haber
   estado duplicado entre la pantalla y la run.
   ══════════════════════════════════════════════════════════════════ */

/* ══ UN GUION BAJO DE MÁS ══
   El puente global de la traducción se llama `__T`, y aquí se pedía
   `__T_`. O sea que TODAS las llamadas a T() del Reino han sido un
   no-op desde que se escribió la pantalla. No se notaba porque
   `traducirDOM` pasa después y arregla los nodos de texto sueltos —por
   eso "AT STAKE" salía en inglés—, pero no puede con nada compuesto:
   "Su mazo: de aficionado" y las frases de los duelistas se quedaban en
   español con el juego en inglés, y yo di por buenas las entradas de
   `i18n.js` porque estaban puestas. Lo vigila `check-idioma.mjs`. */
const T = t => (globalThis.__T ? globalThis.__T(t) : t);
const el = (tag, clase, texto) => {
  const n = document.createElement(tag);
  if(clase) n.className = clase;
  if(texto != null) n.textContent = texto;
  return n;
};
/* Atributos, para la ficha de carta: la base los da como número. */
const ATRIBUTO = { 1:"TIERRA", 2:"AGUA", 4:"FUEGO", 8:"VIENTO",
                   16:"LUZ", 32:"OSCURIDAD", 64:"DIVINO" };
/* Los tipos de monstruo, con las mismas palabras que la tabla de
   `main.js` (y por tanto con su traducción ya hecha en `i18n.js`). */
const RAZA = { 0x1:"Guerrero", 0x2:"Mago", 0x4:"Hada", 0x8:"Demonio", 0x10:"Zombi",
               0x20:"Máquina", 0x40:"Aqua", 0x80:"Piro", 0x100:"Roca",
               0x200:"Bestia Alada", 0x400:"Planta", 0x800:"Insecto", 0x1000:"Trueno",
               0x2000:"Dragón", 0x4000:"Bestia", 0x8000:"Bestia Guerrero",
               0x10000:"Dinosaurio", 0x20000:"Pez", 0x40000:"Serpiente Marina",
               0x80000:"Reptil" };
const ICONO = { DUELO:"⚔", ELITE:"☠", JEFE:"👑", PACK:"🎴", PREPARACION:"✦",
                MERCADER:"⇄", CAMPAMENTO:"🔥", EVENTO:"?" };
const NOMBRE_NODO = { DUELO:"Duelo", ELITE:"Duelista de élite", JEFE:"Jefe",
                      PREPARACION:"Preparación",
                      PACK:"Sobre de cartas", MERCADER:"Mercader",
                      CAMPAMENTO:"Campamento", EVENTO:"Encuentro" };

export function montarReino({ raiz, H, datos, cat, avatares, imagenCarta, arte = {},
                              alDuelo, alSaltarDuelo, alSalir }){
  let vista = "inicio";
  let carga = null;          // lo que devolvió H.entrar()
  let aviso = "";
  /* La colección que se está viendo: mazo | binder | extra. Es la
     ÚNICA fuente de verdad de esa pantalla. */
  let coleccionActiva = "mazo";
  /* ══ LO QUE ELIGES ANTES DE EMPEZAR NO PUEDE VIVIR DENTRO DEL RENDER ══
     Estaban declaradas dentro de `vistaInicio`, y elegir la carta del
     maestro llamaba a `pintar()` para enseñar el aviso. `pintar()` monta
     la pantalla ENTERA otra vez, así que volvía a ejecutar la
     declaración y las dejaba las tres a null: elegías la carta y con ese
     mismo clic perdías la carta Y la ventaja. E lo vio como "cogí una
     carta con la maestría 1 y no me la ha dado". Aquí arriba sobreviven
     a cualquier repintado. */
  let pasivoElegido = null, cartaElegida = null, familiaElegida = null;
  /* ══ Y EL DUELISTA TAMBIÉN ══
     `quien` y `elegido` (el starter) estaban DENTRO de `vistaInicio`
     igual que las tres de arriba. Elegías Joey, elegías su carta de
     maestro —y ese clic llama a `pintar()` para enseñar el aviso—, la
     pantalla se montaba entera otra vez y `quien` volvía a
     `jugables[0]`, que es Yugi. Resultado: empezabas la aventura con
     Yugi y con la carta de Joey descartada. Eso es exactamente "las
     perks de personajes distintos de Yugi siguen fallando".
     `null` = "aún no ha elegido", y entonces se coge el primero. */
  let quienElegido = null, starterElegido = null;
  /* La guía de sobres: qué familia se está mirando y qué se ha buscado.
     Fuera del render, como todo lo demás de este archivo. */
  let sobreAbierto = null, busquedaSobres = "";
  /* ══ LO QUE NO PUEDE PERDERSE AL MOVER UNA CARTA ══
     Cada `+`/`−` repinta la pantalla entera, y con eso se perdía el
     scroll, la pestaña y cualquier filtro: movías una carta del binder y
     volvías arriba del todo. Todo esto vive FUERA del render —como el
     resto de este archivo desde que aprendimos la lección con la carta
     de maestro— y el scroll se guarda por pestaña, porque cada una tiene
     su propia lista. */
  let filtroTexto = "", filtroTipo = "todo", filtroSub = "todo";
  /* E, 03-10: «filtrar también por tipo de monstruo, por si buscas
     sinergia de dragones o de warriors, o por atributo». 0 = todos. */
  let filtroRaza = 0, filtroAtributo = 0;
  let confirmandoVaciar = false;
  const scrollPorTab = { mazo:0, binder:0, extra:0 };
  /* El avatar del Duelista libre. Fuera del render por la misma razón
     que todo lo demás de esta pantalla: `pintar()` la monta entera otra
     vez y cualquier cosa declarada dentro se pierde. */
  let avatarCustom = null;
  let confirmando = null;    // acciones que piden pulsar dos veces

  const pintar = () => {
    raiz.innerHTML = "";
    const est = H.estado();
    /* ══ LA RUN SE ACABABA Y LA PANTALLA NO SE ENTERABA ══
       Perder la última ficha en la apuesta de un evento marca
       `terminada`, y `opciones()` devuelve [] con la run terminada: el
       mapa se quedaba SIN un solo nodo pulsable y sin salida. Eso es
       exactamente el "me quedé atascado y tuve que recargar" que
       reportó E. Cualquier vista de juego con la run terminada va al
       final; la del resultado del duelo se respeta para que dé tiempo
       a descargar el log. */
    if(est?.terminada && (vista === "mapa" || vista === "binder")) vista = "fin";
    /* ══ Y SIN RUN, NINGUNA PANTALLA DE JUEGO ══
       Importar un archivo que solo lleva progreso (sin partida a medias)
       deja `H.run` en null. Si la vista se había quedado en "mapa", la
       pantalla reventaba con "Cannot read properties of null" y el Reino
       se quedaba en blanco. Sin run solo hay una pantalla posible. */
    /* Las pantallas que NO necesitan una run en marcha: el historial es
       de todas las partidas y la guía de sobres es del pool. Sin esta
       lista, entrar al historial desde el menú te devolvía al inicio. */
    const SIN_RUN = ["inicio", "record", "sobres"];
    if(!H.run && !SIN_RUN.includes(vista)) vista = "inicio";
    if(vista !== "inicio" && est) raiz.appendChild(barra(est));
    if(aviso){ raiz.appendChild(el("div","rAviso", T(aviso))); aviso = ""; }
    const cuerpo = { inicio:vistaInicio, mapa:vistaMapa, nodo:vistaNodo,
                     binder:vistaBinder, fin:vistaFin, sobres:vistaSobres,
                     record:vistaRecord }[vista] ?? vistaInicio;
    raiz.appendChild(cuerpo(est));
    /* El mazo, siempre a la vista mientras andas por el mapa: es lo que
       estás construyendo y hasta ahora había que abrir otra pantalla para
       mirarlo. Estilo deck tracker de Hearthstone. */
    if(vista === "mapa" && est){
      raiz.appendChild(rastreador(est));
      /* ══ VOLVER AL MAPA NO ES VOLVER ARRIBA ══
         Se repinta la vista entera, así que el scroll se iba al
         principio del documento y había que buscar dónde estabas —en un
         teléfono, con tres actos, eso son dos pantallas de scroll cada
         vez—. Se centra el nodo al que puedes ir. */
      centrarEnElMapa = true;
      /* El mapa no tiene rejilla de cartas, pero SÍ tiene el rastreador:
         tocar una línea del mazo tiene que poder leerse. */
      raiz.appendChild(panelCarta("suelto"));
    }
    globalThis.__traducirDOM?.(raiz);
    /* Los caminos del mapa necesitan medidas reales: se dibujan en el
       siguiente fotograma, cuando el navegador ya ha colocado todo. */
    if(pendientes.length) (globalThis.requestAnimationFrame ?? (f=>setTimeout(f,0)))(dibujarCaminos);
    if(centrarEnElMapa){
      centrarEnElMapa = false;
      (globalThis.requestAnimationFrame ?? (f=>setTimeout(f,0)))(() => {
        try{
          const foco = raiz.querySelector(".rNodo.puedo, .rPeldaño.puedo, .rNodo.estoy");
          foco?.scrollIntoView?.({ block:"center", inline:"center" });
        }catch(e){}
      });
    }
  };
  let centrarEnElMapa = false;

  /* ── la barra de siempre: fichas, semilla, mazo ── */
  /* ══ PANTALLA COMPLETA EN TODO EL REINO, NO SOLO EN EL DUELO ══
     El botón vivía únicamente en la barra del tablero, así que todo el
     modo historia —menú, personaje, mapa, binder, encuentros, torre,
     final— se jugaba con la barra del navegador comiéndose el alto.
     Es el MISMO `pantallaCompleta` del duelo (no se duplica la API),
     pero sin forzar la orientación: el Reino se maneja en vertical. */
  /* Una imagen del material visual del Reino, o nada si no está: el
     juego tiene que seguir funcionando aunque falte un asset. */
  function ilustracion(clave, clase){
    const a = arte?.[clave]; if(!a?.d) return null;
    const caja = el("div", "rArte " + (clase ?? ""));
    const img = document.createElement("img");
    img.src = a.d; img.alt = ""; img.loading = "lazy";
    caja.appendChild(img);
    return caja;
  }

  function botonPantalla(){
    const b = el("button","rBtn btnFull soloMovil", "⛶");
    b.title = T("Pantalla completa");
    b.onclick = () => globalThis.__PANTALLA_COMPLETA__?.({ girar:false });
    return b;
  }

  function barra(est){
    const b = el("div","rBarra");
    const chips = el("div","rChips");
    chips.appendChild(el("span","rGuante","★"));
    chips.appendChild(el("b",null, `${est.chips}`));
    chips.appendChild(el("span","rDe", `/ ${est.meta}`));
    if(est.clasificado) chips.appendChild(el("span","rClasi", T("clasificado")));
    b.appendChild(chips);

    const info = el("div","rInfo");
    info.appendChild(el("span",null, `${T("Mazo")}: ${est.mazo.main}`));
    info.appendChild(el("span",null, `${T("Binder")}: ${est.binder}`));
    if(est.buff) info.appendChild(el("span","rBuff",
      `+${est.buff.lp} LP ×${est.buff.duelos}`));
    b.appendChild(info);

    const der = el("div","rDer");
    const semilla = el("button","rSemilla", est.semilla);
    semilla.title = T("Copiar la semilla");
    semilla.onclick = () => { navigator.clipboard?.writeText(est.semilla);
                              aviso = T("Semilla copiada"); pintar(); };
    der.appendChild(semilla);
    der.appendChild(botonPantalla());
    /* ══ UN INDICADOR PARA QUE SE SEPA DÓNDE MIRAR ══
       La guía estaba aquí desde el principio y E no la encontró: un
       botón que pone «Sobres» entre otros cuatro no dice que dentro
       están TODAS las listas. Con la lupa delante y resaltado, sí. */
    /* ══ VOLVER AL MAPA TIENE QUE ESTAR DONDE ESTÁ TODO LO DEMÁS ══
       El botón de volver vivía al FONDO de cada pantalla, y en la guía
       de sobres eso son tres rejillas de scroll más abajo: E lo contó
       como «está muy abajo, es un poco confuso». Aquí arriba, al lado
       del de sobres y el de mazo, es donde se busca. En el mapa no hace
       falta —ya estás— así que ahí no se pinta. */
    if(vista !== "mapa"){
      const mapaBtn = el("button","rBtn", "🗺 " + T("Volver al mapa"));
      mapaBtn.onclick = () => { vista = "mapa"; carga = null; pintar(); };
      der.appendChild(mapaBtn);
    }
    const guiaBtn = el("button","rBtn destacado", "🔍 " + T("Qué sale en cada sobre"));
    guiaBtn.title = T("Qué cartas puede dar cada sobre");
    guiaBtn.onclick = () => { vista = "sobres"; pintar(); };
    der.appendChild(guiaBtn);
    const mazoBtn = el("button","rBtn", T("Mazo y binder"));
    mazoBtn.onclick = () => { vista = "binder"; pintar(); };
    der.appendChild(mazoBtn);
    const salir = el("button","rBtn sec", T("Guardar y salir"));
    salir.onclick = () => { H.guardarYa?.(); alSalir?.(); };
    der.appendChild(salir);
    /* Rendirse: acaba la aventura a propósito, borra ESTA run y deja
       intacta la maestría. No cuenta como victoria. */
    const rendir = el("button","rBtn peligro", T("Abandonar"));
    rendir.onclick = () => {
      if(confirmando !== "rendir"){ confirmando = "rendir";
        aviso = T("¿Seguro? Se pierde esta aventura. Pulsa otra vez para confirmar."); pintar(); return; }
      confirmando = null;
      H.rendirRun?.();
      vista = "inicio"; carga = null; pintar();
    };
    der.appendChild(rendir);
    b.appendChild(der);
    return b;
  }

  /* ══ INICIO ══
     E lo dijo dos veces: "esta parte sigue sin arte", "se sigue viendo
     pobre visualmente". Y tenía razón — era un h2, un párrafo y tres
     cajas de texto. Es la PRIMERA pantalla del modo: si aquí no parece
     Duelist Kingdom, ya no lo parece en ningún sitio.

     Todo el arte sale de lo que ya viaja dentro del HTML: los 28
     retratos y las imágenes de carta por passcode. Cero archivos nuevos. */
  function vistaInicio(){
    const c = el("div","rInicio");

    /* ══ EL BANNER MANDA ══
       Esto era una cabecera de texto con una foto de Pegasus al lado:
       una landing page. El banner que hizo E ya dice qué es esto —
       castillo, título, Pegasus— así que se pone él solo, a todo lo
       ancho y arriba del todo, y el texto pasa a ser un pie. Sin dos
       logos compitiendo: el de Scapegoat se queda para el simulador. */
    const banner = ilustracion("banner", "rBanner");
    if(banner){
      const marco = el("div","rBannerMarco");
      marco.appendChild(banner);
      marco.appendChild(el("p","rBannerPie", T(
        "Llega al castillo con diez Star Chips y gana a Pegasus. Cada duelo que ganas te da una carta; cada uno que pierdes te cuesta una ficha. A cero fichas, se acabó.")));
      c.appendChild(marco);
    } else {
      /* Sin el asset, la cabecera de siempre: el juego no puede depender
         de que una imagen esté. */
      const cabecera = el("div","rHero");
      const rot = el("div","rHeroRot");
      rot.appendChild(el("span","rHeroSup", T("Torneo de")));
      rot.appendChild(el("h2",null, T("Reino de los Duelistas")));
      rot.appendChild(el("p","rSub", T(
        "Llega al castillo con diez Star Chips y gana a Pegasus. Cada duelo que ganas te da una carta; cada uno que pierdes te cuesta una ficha. A cero fichas, se acabó.")));
      cabecera.appendChild(rot);
      c.appendChild(cabecera);
    }
    /* El botón de pantalla completa también aquí: en el menú de inicio no
       había barra, así que era la única pantalla del Reino sin él. */
    const barraSup = el("div","rInicioSup");
    const rec = el("button","rBtn", T("Historial del duelista"));
    rec.onclick = () => { vista = "record"; pintar(); };
    barraSup.appendChild(rec);
    barraSup.appendChild(botonPantalla());
    c.appendChild(barraSup);

    if(H.continuar && H.hayGuardado?.()){
      const seguir = el("button","mbig", T("Continuar la partida"));
      seguir.onclick = () => { H.continuar(); vista = "mapa"; pintar(); };
      c.appendChild(seguir);
    }

    /* ══ CON QUIÉN JUEGAS ══
       Cinco duelistas, y la elección no es cosmética: decide tu mazo de
       salida Y a quién te encuentras en la torre, porque a ti mismo no.
       Jugando con Kaiba, el último antes de Pegasus es Yugi; jugando con
       Yugi, es Kaiba. El final de la partida cambia de verdad. */
    c.appendChild(el("label","mlab", T("Elige duelista")));
    const quienes = el("div","rDuelistas");
    /* El elenco lo decide la API: el Duelista libre solo aparece cuando
       ya has ganado el torneo una vez. */
    const jugables = H.jugables?.() ?? datos.jugables ?? [];
    const porDefecto = jugables[0]?.id ?? "yugi";
    if(!jugables.some(j => j.id === quienElegido)) quienElegido = porDefecto;
    let quien = quienElegido;
    const pintarStarters = () => {};   // se rellena abajo
    for(const j of jugables){
      const b = el("button","rDuelista"+(j.id===quien?" on":""));
      /* El Custom no trae avatar: lleva el que hayas elegido tú, y si
         aún no has elegido, una silueta. */
      const avId = j.esCustom ? avatarCustom : j.avatar;
      const av = avId ? avatares?.[avId]?.d : null;
      if(av){ const img = document.createElement("img");
        img.src = av; img.alt = j.nombre; b.appendChild(img); }
      else if(j.esCustom) b.appendChild(el("div","rSilueta","?"));
      b.appendChild(el("b",null, j.nombre));
      /* ══ MAESTRÍA, NO "DUREZA EN LA TORRE" ══
         Enseñar un número de dificultad artificial no ayudaba a elegir:
         lo que decide es con quién quieres jugar y qué tienes
         desbloqueado con él. Aquí va lo segundo. */
      const m = H.maestriaDe?.(j.id) ?? { nivel:0, pasivos:[] };
      b.appendChild(el("span","rMaestria",
        m.nivel ? `${T("Maestría")} ${m.nivel}` : T("Sin maestría")));
      b.onclick = () => {
        quien = j.id; quienElegido = j.id; starterElegido = null;
        /* Cambiar de duelista SÍ borra lo elegido: las ventajas y las
           cartas de maestro son de ese personaje. */
        pasivoElegido = null; cartaElegida = null; familiaElegida = null;
        if(!j.esCustom) avatarCustom = null;
        /* ══ Y SE REPINTA ══
           El selector de cara del Duelista libre se monta DENTRO de esta
           pantalla, así que sin repintar no aparecía nunca: elegías
           Custom y no había caras que pulsar. Repintar es seguro desde
           que las elecciones viven fuera del render — antes era justo lo
           que las borraba. */
        pintar(); };
      quienes.appendChild(b);
    }
    c.appendChild(quienes);

    /* ══ EL SELECTOR DE CARA DEL DUELISTA LIBRE ══
       Mismo elenco que el Duelo libre, quitando a los cinco
       protagonistas (para no tener dos Yugis en la torre) y a Pegasus
       (que es el final, no un competidor). */
    const jugado = jugables.find(j => j.id === quien);
    if(jugado?.esCustom){
      c.appendChild(el("label","mlab", T("Elige tu cara")));
      const EXCLUIDOS = new Set(["yugimuto","yamiyugi","joeywheeler","maikujaku",
                                 "banditkeith","setokaiba","pegasus"]);
      const rejAv = el("div","rAvatares");
      for(const [id, a] of Object.entries(avatares ?? {})){
        if(EXCLUIDOS.has(id) || !a?.d) continue;
        const b = el("button","rAvatarPick" + (id === avatarCustom ? " on" : ""));
        b.dataset.id = id;
        const img = document.createElement("img");
        img.src = a.d; img.alt = a.n ?? id; img.loading = "lazy";
        b.appendChild(img);
        b.appendChild(el("span",null, a.n ?? id));
        b.title = a.n ?? id;
        b.onclick = () => { avatarCustom = id;
          [...rejAv.children].forEach(x => x.classList.remove("on"));
          b.classList.add("on"); };
        rejAv.appendChild(b);
      }
      c.appendChild(conPanel(rejAv));
    }

    c.appendChild(el("label","mlab", T("Elige con qué empiezas")));
    const rej = el("div","rStarters");
    /* Los mazos de salida del duelista elegido. Yugi tiene tres; los
       demás uno de momento, y la arquitectura aguanta los que se
       escriban sin tocar una línea de lógica. */
    const startersDe = id => {
      const j = (datos.jugables ?? []).find(x => x.id === id);
      const ids = j?.starters ?? [];
      return ids.map(sid => (datos.starters ?? []).find(s => s.id === sid)
                         ?? { id:sid, nombre:j?.nombre ?? sid, desc:"" });
    };
    /* El starter también sobrevive al repintado: elegir la carta del
       maestro no puede devolverte al primer mazo de la lista. */
    if(!startersDe(quien).some(s => s.id === starterElegido)) starterElegido = null;
    let elegido = starterElegido ?? startersDe(quien)[0]?.id;
    function refrescarStarters(){
      rej.innerHTML = "";
      const lista = startersDe(quien);
      if(!lista.some(s => s.id === starterElegido)) starterElegido = null;
      elegido = starterElegido ?? lista[0]?.id;
      for(const s of lista) rej.appendChild(fichaStarter(s));
    }
    function fichaStarter(s){
      const b = el("button","rStarter"+(s.id===elegido?" on":""));
      /* La carta que representa al mazo, en grande. Un mazo se elige por
         la carta que te imaginas jugando, no por su descripción. */
      if(s.carta){
        const marco = el("div","rStarterCarta");
        const img = document.createElement("img");
        img.loading = "lazy";
        img.src = imagenCarta(s.carta, "cards");
        img.alt = cat.nombre(s.carta);
        marco.appendChild(img);
        b.appendChild(marco);
      }
      b.appendChild(el("b",null, T(s.nombre)));
      if(s.desc) b.appendChild(el("span",null, T(s.desc)));
      b.onclick = () => { elegido = s.id; starterElegido = s.id;
        [...rej.children].forEach(x=>x.classList.remove("on"));
        b.classList.add("on"); };
      return b;
    }
    refrescarStarters();
    c.appendChild(rej);

    /* ══ LO QUE HAS DESBLOQUEADO ══
       Progresión HORIZONTAL: nada de +ATK ni puntos de vida. Cada nivel
       de maestría abre una DECISIÓN nueva que se toma aquí, antes de
       empezar. Y solo se usa UNA por run aunque tengas tres: apilarlas
       convertiría la quinta vuelta en un mazo regalado. */
    const zonaPasivos = el("div","rPasivos");
    c.appendChild(zonaPasivos);
    function refrescarPasivos({ olvidar = false } = {}){
      zonaPasivos.innerHTML = "";
      /* Solo se olvida lo elegido cuando CAMBIAS DE DUELISTA: las
         ventajas y las cartas de maestro son suyas y no valen para otro.
         Un repintado cualquiera no puede borrar la elección. */
      if(olvidar){ pasivoElegido = null; cartaElegida = null; familiaElegida = null; }
      const m = H.maestriaDe?.(quien) ?? { nivel:0, pasivos:[], siguiente:null, cartas:[] };
      const cab = el("div","rMaestriaCab");
      cab.appendChild(el("span","rMaestriaN",
        `${T("Maestría")} ${m.nivel}`));
      if(m.siguiente) cab.appendChild(el("span","rMaestriaSig",
        `${T("Al ganar a Pegasus")}: ${T(m.siguiente.nombre)}`));
      zonaPasivos.appendChild(cab);
      if(!m.pasivos.length){
        zonaPasivos.appendChild(el("p","rSub",
          T("Gana el torneo con este duelista para desbloquear su primera ventaja.")));
        return;
      }
      zonaPasivos.appendChild(el("label","mlab", T("Elige una ventaja")));
      const fila = el("div","rVentajas");
      const detalle = el("div","rVentajaDet");
      let elegida = null;
      for(const pa of m.pasivos){
        const b = el("button","rVentaja");
        b.appendChild(el("b",null, T(pa.nombre)));
        b.appendChild(el("span",null, T(pa.desc)));
        b.onclick = () => {
          /* Cambiar DE ventaja sí limpia lo que pedía la anterior. */
          pasivoElegido = pa.id; cartaElegida = null; familiaElegida = null;
          [...fila.children].forEach(x=>x.classList.remove("on"));
          b.classList.add("on");
          pintarDetallePasivo(pa, m, detalle);
        };
        /* Y si ya había una elegida antes del repintado, se vuelve a
           marcar: si no, la pantalla dice que no has elegido nada
           mientras el estado dice lo contrario. */
        if(pa.id === pasivoElegido){ b.classList.add("on"); elegida = { pa, b }; }
        fila.appendChild(b);
      }
      zonaPasivos.appendChild(fila);
      zonaPasivos.appendChild(detalle);
      if(elegida) pintarDetallePasivo(elegida.pa, m, detalle);
    }
    /* Cada ventaja pide lo suyo: la carta del maestro, una de diez; el
       sobre de contactos, una familia. "Mano firme" no pide nada. */
    function pintarDetallePasivo(pa, m, caja){
      caja.innerHTML = "";
      if(pa.id === "carta-de-maestro"){
        caja.appendChild(el("label","mlab", T("Elige tu carta")));
        caja.appendChild(conPanel(rejillaCartas(m.cartas, null, code => {
          cartaElegida = code;
          aviso = `${T("Empezarás con")} ${cat.nombre(code)}`; pintar();
        }, true, cartaElegida)));
      } else if(pa.id === "primer-sobre"){
        caja.appendChild(el("label","mlab", T("Elige la familia del sobre")));
        const f = el("div","rFamiliasMini");
        for(const fam of (H.familias ?? [])){
          const b = el("button","rBtn rFamilia", T(fam.nombre));
          b.dataset.id = fam.id;
          b.onclick = () => { familiaElegida = fam.id;
            [...f.children].forEach(x=>x.classList.remove("on"));
            b.classList.add("on"); };
          if(fam.id === familiaElegida) b.classList.add("on");
          f.appendChild(b);
        }
        caja.appendChild(f);
      }
    }
    refrescarPasivos();

    /* A quién te vas a encontrar. Las caras en fila cuentan de qué va
       esto mejor que cualquier párrafo, y ORDENADAS POR CRONOLOGÍA se
       lee además el viaje: Weevil primero, el laberinto al final. */
    const elenco = (datos.personajes ?? [])
      .filter(p => avatares?.[p.avatar]?.d)
      .sort((a,b) => (a.cronologia ?? 50) - (b.cronologia ?? 50));
    if(elenco.length){
      c.appendChild(el("label","mlab", T("Te esperan en la isla")));
      const fila = el("div","rElenco");
      for(const p of elenco){
        const cara = el("div","rElencoCara");
        const img = document.createElement("img");
        img.src = avatares[p.avatar].d; img.alt = p.nombre;
        cara.appendChild(img);
        cara.appendChild(el("span",null, p.nombre));
        cara.title = p.nombre;
        fila.appendChild(cara);
      }
      c.appendChild(fila);
    }

    c.appendChild(el("label","mlab", T("Semilla (opcional)")));
    const inp = el("input","rInput");
    inp.placeholder = "DK-7HF82A";
    c.appendChild(inp);

    const jugar = el("button","mbig", T("Empezar la aventura"));
    jugar.onclick = () => {
      /* ══ NO SE EMPIEZA CON UNA VENTAJA A MEDIAS ══
         Elegir «la carta del maestro» y no elegir carta gastaba la única
         ventaja de la run en nada, en silencio. Se avisa y no se
         empieza; es un clic más y evita una aventura entera lastrada. */
      if(jugado?.esCustom && !avatarCustom){
        aviso = "Elige la cara de tu duelista antes de empezar"; pintar(); return; }
      if(pasivoElegido === "carta-de-maestro" && cartaElegida == null){
        aviso = "Elige tu carta de maestro antes de empezar"; pintar(); return; }
      if(pasivoElegido === "primer-sobre" && familiaElegida == null){
        aviso = "Elige la familia del sobre antes de empezar"; pintar(); return; }
      /* `value` puede no existir (el DOM simulado no crea inputs de
         verdad), así que nada de asumir que hay cadena. */
      const sem = String(inp.value ?? "").trim();
      H.empezar({ semilla: sem || undefined, personaje: quien, starter: elegido,
                  pasivo: pasivoElegido, cartaDeMaestro: cartaElegida,
                  familiaDeSobre: familiaElegida,
                  avatar: jugado?.esCustom ? avatarCustom : null });
      vista = "mapa"; pintar();
    };
    c.appendChild(jugar);
    /* ══ LLEVARSE EL PROGRESO A OTRO SITIO ══
       El juego vive en GitHub Pages: no hay cuenta ni servidor, así que
       la maestría y la partida a medias solo existen en el localStorage
       de ESTE navegador. Cambiar de móvil, limpiar los datos del sitio o
       abrir en incógnito lo borra todo. Un archivo es la única forma de
       no perderlo, y por eso importar valida antes de escribir nada. */
    const guardado = el("div","rGuardado");
    guardado.appendChild(el("label","mlab", T("Tu progreso")));
    const fila = el("div","rGuardadoFila");

    const exportar = el("button","rBtn", T("Exportar progreso"));
    exportar.onclick = () => {
      const texto = H.exportar?.();
      if(!texto){ aviso = T("No hay nada que exportar todavía"); pintar(); return; }
      try{
        const a = document.createElement("a");
        a.href = "data:application/json;charset=utf-8," + encodeURIComponent(texto);
        const hoy = new Date().toISOString().slice(0,10);
        a.download = `duelist-kingdom-${hoy}.json`;
        a.click();
        aviso = "Progreso descargado";
      }catch(e){ aviso = T("No se pudo descargar") + ": " + (e?.message ?? e); }
      pintar();
    };
    fila.appendChild(exportar);

    const importar = el("button","rBtn", T("Importar progreso"));
    const fichero = el("input","rFichero");
    fichero.type = "file"; fichero.accept = ".json,application/json";
    fichero.onchange = () => {
      const f = fichero.files?.[0];
      if(!f) return;
      const lector = new FileReader();
      lector.onload = () => {
        const r = H.importar?.(String(lector.result));
        /* Si el archivo está roto NO se ha tocado nada: se dice el
           motivo y se sigue con lo que había. */
        aviso = r?.ok
          ? `${T("Progreso importado")}${r.conRun ? " · " + T("con partida a medias") : ""}`
          : (r?.error ?? T("No se pudo leer el archivo"));
        vista = "inicio"; pintar();
      };
      lector.onerror = () => { aviso = T("No se pudo leer el archivo"); pintar(); };
      lector.readAsText(f);
    };
    importar.onclick = () => fichero.click?.();
    fila.appendChild(importar);
    fila.appendChild(fichero);
    guardado.appendChild(fila);
    guardado.appendChild(el("p","rSub",
      T("Un archivo con tu maestría, lo desbloqueado y la partida a medias. Sirve para llevarlo a otro navegador o a otro móvil.")));
    c.appendChild(guardado);

    const volver = el("button","mvolver", T("← Volver"));
    volver.onclick = () => alSalir?.();
    c.appendChild(volver);
    return c;
  }

  /* ══ EL MAPA DE LA ISLA ══
     La primera versión eran botones en columnas: funcionaba, pero no
     parecía un mapa y no se entendía qué venía después de qué. E lo dijo
     claro: "quiero líneas de un sitio a otro, como en Slay the Spire".

     Los caminos se dibujan en un <svg> DETRÁS de los nodos, midiendo las
     posiciones reales después de pintar. Es la única forma de que las
     líneas cuadren con lo que ve el jugador en cualquier pantalla; hacer
     el cálculo a mano con porcentajes se rompe en cuanto cambia el
     tamaño de un icono. */
  /* ══════════════════════════════════════════════════════════════════
     LA TORRE DE PEGASUS

     De abajo arriba, como una escalera: pisas el primer peldaño y subes.
     Los duelistas caídos se quedan a la vista tachados —el recorrido es
     parte del premio— y Pegasus preside desde arriba con su propio
     marco. La preparación y el último sobre son escalones más estrechos:
     se ve de un vistazo que no son duelos.
     ══════════════════════════════════════════════════════════════════ */
  function torreDelCastillo(acto, est, puedeIr, aqui){
    const caja = el("div","rTorre");
    const peldaños = acto.columnas.map(col => col[0]).filter(Boolean);
    /* Arriba Pegasus: se recorre al revés. */
    for(const n of [...peldaños].reverse()){
      const esDuelo = !!n.torre;
      const b = el("button","rPeldaño t"+n.tipo+(esDuelo?" duelista":" utilidad")
                            + (n.torre==="pegasus" ? " pegasus" : ""));
      if(n.resuelto) b.classList.add("hecho");
      if(puedeIr.has(n.id)) b.classList.add("puedo");
      if(n.id === aqui) b.classList.add("estoy");

      const marco = el("span","rPeldañoCara");
      const av = n.rival?.avatar ? avatares?.[n.rival.avatar]?.d : null;
      if(av){
        const img = document.createElement("img");
        img.src = av; img.alt = n.rival.nombre ?? ""; img.className = "rCara";
        marco.appendChild(img);
      } else marco.appendChild(el("span","rIcono", ICONO[n.tipo] ?? "?"));
      b.appendChild(marco);

      const txt = el("span","rPeldañoTxt");
      txt.appendChild(el("b",null, n.rival?.nombre ?? T(NOMBRE_NODO[n.tipo] ?? n.tipo)));
      txt.appendChild(el("span","rPeldañoSub",
        n.torre === "pegasus" ? T("El dueño de la isla")
        : esDuelo             ? `${T("Peldaño")} ${n.peldaño}`
        : n.tipo === "PREPARACION" ? T("Prepárate: sobre, mercader o campamento")
        : T("Un último sobre antes del jefe")));
      if(n.resuelto) txt.appendChild(el("span","rPeldañoHecho", T("DERROTADO")));
      b.appendChild(txt);

      b.disabled = !puedeIr.has(n.id);
      b.onclick = () => { carga = H.entrar(n.id); vista = "nodo"; pintar(); };
      caja.appendChild(b);
    }
    return caja;
  }

  /* La última parte del torneo: no se presenta como un parche sino como
     lo que es, duelistas que siguen en la isla. */
  function zonaUltimaOportunidad(nodos, est){
    const caja = el("div","rUltimos");
    const cab = el("div","rUltimosCab");
    cab.appendChild(el("h4",null, T("Duelistas que quedan en la isla")));
    cab.appendChild(el("span","rUltimosSub",
      `${T("Última oportunidad para las Star Chips")} · ${est.chips}/10`));
    caja.appendChild(cab);
    caja.appendChild(el("p","rSub",
      T("El torneo no ha terminado. Puedes retarlos las veces que haga falta: cada victoria te acerca a las diez, cada derrota te cuesta una ficha.")));
    const fila = el("div","rUltimosFila");
    for(const n of nodos){
      const b = el("button","rNodo tDUELO puedo ultimo");
      const disco = el("span","rDisco");
      const av = n.rival?.avatar ? avatares?.[n.rival.avatar]?.d : null;
      if(av){ const img = document.createElement("img");
              img.src = av; img.alt = n.rival.nombre ?? ""; img.className = "rCara";
              disco.appendChild(img); }
      else disco.appendChild(el("span","rIcono", "!"));
      b.appendChild(disco);
      b.appendChild(el("span","rNom", n.rival?.nombre ?? T("Duelista")));
      b.disabled = false;
      b.dataset.id = n.id;
      b.onclick = () => { carga = H.entrar(n.id); vista = "nodo"; pintar(); };
      fila.appendChild(b);
    }
    caja.appendChild(fila);
    return caja;
  }

  function vistaMapa(est){
    const c = el("div","rMapa");
    const run = H.run;
    const opciones = H.opciones();
    const puedeIr = new Set(opciones.map(n=>n.id));
    const aqui = run.pos?.id ?? null;
    /* A qué actos puedo ir con las opciones que tengo delante. */
    const actosAlcanzables = new Set(opciones.map(n => n.acto)
                                             .filter(a => a != null));

    /* DE ARRIBA A ABAJO. Lo probamos al revés —playa abajo, castillo
       arriba, estilo Slay the Spire— y E lo dijo claro tras verlo: se
       entiende mejor con los primeros duelos ya visibles al entrar, sin
       tener que bajar la vista para saber por dónde empiezas. */
    for(const acto of run.mapa.actos){
      /* ══ ESTADOS SEMÁNTICOS, NO UN VELO ENCIMA ══
         El acto I se veía "apagado con un overlay roto" al pasar al II
         porque se le bajaba la opacidad al CONTENEDOR entero, y eso
         apaga también los textos, las líneas y las caras. Un acto
         terminado tiene que seguir leyéndose y decir COMPLETO; lo que
         cambia es el color, no la visibilidad. */
      /* ══ «CERRADO» TIENE QUE SIGNIFICAR CERRADO ══
         E ganó a Ghost Kaiba y el castillo seguía diciendo CERRADO. No
         era mentira del todo —`run.pos` sigue en el acto I hasta que
         PISAS un nodo del II— pero para el jugador sí lo era: los
         botones del acto II estaban activos y la etiqueta decía lo
         contrario. Un acto al que puedes ir AHORA MISMO no está
         cerrado, está esperándote. */
      const estadoActo = acto.indice < est.acto ? "completo"
                       : acto.indice === est.acto ? "actual"
                       : actosAlcanzables.has(acto.indice) ? "siguiente"
                       : "cerrado";
      const bloque = el("div","rActo a"+acto.indice+" e"+estadoActo
                          + (acto.torre ? " torre" : ""));
      const cab = el("div","rActoCab");
      cab.appendChild(el("span","rActoNum", ["I","II","III"][acto.indice] ?? ""));
      cab.appendChild(el("h3",null, T(acto.nombre)));
      cab.appendChild(el("span","rActoEstado",
        T(estadoActo === "completo"  ? "COMPLETO"
        : estadoActo === "actual"    ? "AQUÍ"
        : estadoActo === "siguiente" ? "TE ESPERA" : "CERRADO")));
      bloque.appendChild(cab);

      /* ══ EL CASTILLO NO ES UN MAPA ══
         Al llegar a los diez Star Chips la isla se acaba. El acto III es
         un torneo con orden escrito y se pinta como lo que es: una
         escalera de peldaños con Pegasus arriba. Usar aquí las columnas
         de la isla era mentir sobre lo que está pasando. */
      if(acto.torre){
        bloque.appendChild(torreDelCastillo(acto, est, puedeIr, aqui));
        c.appendChild(bloque);
        continue;
      }

      /* ══ LOS DUELISTAS QUE QUEDAN EN LA ISLA ══
         Estos nodos NO viven en `acto.columnas` —se generan sobre la
         marcha— y este bucle solo dibujaba columnas: `opciones()` los
         devolvía y en pantalla no aparecía ningún botón. Ese es el
         callejón sin salida que reportó E, con nueve fichas y sin forma
         de conseguir la décima. */
      const ultimos = (acto.ultimaOportunidad ?? []).filter(n => puedeIr.has(n.id));
      if(ultimos.length) bloque.appendChild(zonaUltimaOportunidad(ultimos, est));

      const lienzo = el("div","rLienzo");
      let svg = null;
      try{
        svg = document.createElementNS("http://www.w3.org/2000/svg","svg");
        svg.setAttribute("class","rCaminos");
        lienzo.appendChild(svg);
      }catch(e){ svg = null; }

      const fila = el("div","rColumnas");
      for(const col of acto.columnas){
        const cel = el("div","rCol");
        for(const n of col){
          const b = el("button","rNodo t"+n.tipo);
          if(n.resuelto) b.classList.add("hecho");
          /* ══ UN ELITE TIENE QUE VERSE ══
             La diferencia con un duelo normal era el color del borde y
             no se notaba. Ahora lleva corona: un SVG, no un emoji, para
             que combine con el resto y no dependa de la fuente del
             sistema. */
          /* ══ UN ELITE TIENE QUE CANTAR ══
             La corona sola no bastaba: E lo dijo dos veces. Ahora lleva
             corona, marco propio, etiqueta ELITE y es un poco más grande.
             Cuatro señales a la vez, porque una sola se pierde entre
             veinte nodos. */
          if(n.tipo === "ELITE"){
            b.appendChild(corona());
            b.appendChild(el("span","rEtiqueta", "ELITE"));
          }
          if(n.tipo === "JEFE") b.appendChild(el("span","rEtiqueta jefe", T("JEFE")));
          if(puedeIr.has(n.id)) b.classList.add("puedo");
          if(n.id === aqui) b.classList.add("estoy");
          const disco = el("span","rDisco");
          /* LA CARA DEL RIVAL. Es lo que hace que el mapa sea un viaje y
             no una lista: ver que arriba te espera Pegasus. */
          const av = n.rival?.avatar ? avatares?.[n.rival.avatar]?.d : null;
          /* ══ EL NODO SE RECONOCE POR LA IMAGEN, NO POR EL SÍMBOLO ══
             Un "?" y un "🔥" dentro del mismo disco gris hacían que todos
             los nodos parecieran el mismo botón. El sobre y la hoguera
             van AQUÍ, en el mapa, no solo al entrar. */
          const arteNodo = n.tipo === "PACK" ? arte?.sobre?.d
                         : n.tipo === "CAMPAMENTO" ? arte?.hoguera?.d
                         : n.tipo === "MERCADER" ? arte?.mercader?.d : null;
          if(av){
            const img = document.createElement("img");
            img.src = av; img.alt = n.rival.nombre ?? "";
            img.className = "rCara";
            disco.appendChild(img);
          } else if(arteNodo){
            const img = document.createElement("img");
            img.src = arteNodo; img.alt = ""; img.loading = "lazy";
            img.className = "rCara rCaraArte";
            disco.appendChild(img);
          } else {
            disco.appendChild(el("span","rIcono", ICONO[n.tipo] ?? "?"));
          }
          b.appendChild(disco);
          b.appendChild(el("span","rNom",
            n.rival?.nombre ?? T(NOMBRE_NODO[n.tipo] ?? n.tipo)));
          b.disabled = !puedeIr.has(n.id);
          b.dataset.id = n.id;
          b.title = n.rival?.nombre
            ? `${n.rival.nombre} — ${T(NOMBRE_NODO[n.tipo] ?? n.tipo)}`
            : T(NOMBRE_NODO[n.tipo] ?? n.tipo);
          b.onclick = () => { carga = H.entrar(n.id); vista = "nodo"; pintar(); };
          cel.appendChild(b);
        }
        fila.appendChild(cel);
      }
      lienzo.appendChild(fila);
      bloque.appendChild(lienzo);
      /* El castillo cierra el acto III, o sea abajo del todo. */
      if(acto.indice === 2) bloque.appendChild(el("div","rCastillo"));
      c.appendChild(bloque);
      if(svg) pendientes.push({ acto, lienzo, svg });
    }
    /* Si perdiste al jefe, el mapa enseña un solo nodo: él otra vez. Sin
       decirlo parece que el mapa se ha roto. */
    if(opciones.some(n=>n.revancha))
      c.appendChild(el("div","rAviso", T("Al jefe hay que ganarle para pasar de acto. Vuelve a entrar.")));
    if(!opciones.length){
      c.appendChild(el("p","rSub", T("Se acabó el camino.")));
      const b = el("button","mbig", T("Ver el resultado"));
      b.onclick = () => { vista = "fin"; pintar(); };
      c.appendChild(b);
    }
    return c;
  }

  /* Los caminos se dibujan cuando el navegador ya ha colocado los nodos:
     antes de eso todas las medidas son cero. */
  let pendientes = [];
  function dibujarCaminos(){
    for(const { acto, lienzo, svg } of pendientes){
      const caja = lienzo.getBoundingClientRect?.();
      if(!caja || !caja.width) continue;
      svg.setAttribute("viewBox", `0 0 ${caja.width} ${caja.height}`);
      let d = "", vivo = "";
      const aquiAhora = H.run?.pos?.id ?? null;
      /* ══ SOLO ENTRE NODOS CONECTADOS ══
         Esto dibujaba TODAS las combinaciones de una columna con la
         siguiente, así que el mapa parecía una malla en la que da igual
         por dónde vayas — y ahora además sería mentira, porque las
         aristas existen. Se leen las `salidas` del nodo. */
      for(let i=0; i<acto.columnas.length-1; i++){
        for(const a of acto.columnas[i]){
          const destinos = (a.salidas ?? []).length
            ? acto.columnas[i+1].filter(x => a.salidas.includes(x.id))
            : acto.columnas[i+1];
          for(const b of destinos){
            const na = lienzo.querySelector?.(`[data-id="${a.id}"] .rDisco`);
            const nb = lienzo.querySelector?.(`[data-id="${b.id}"] .rDisco`);
            if(!na || !nb) continue;
            const ra = na.getBoundingClientRect(), rb = nb.getBoundingClientRect();
            const x1 = ra.left - caja.left + ra.width/2,  y1 = ra.top - caja.top + ra.height/2;
            const x2 = rb.left - caja.left + rb.width/2,  y2 = rb.top - caja.top + rb.height/2;
            const mx = (x1+x2)/2;
            const trazo = `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2} `;
            /* El camino que SALE de donde estás va resaltado: es la
               forma de ver de un vistazo qué se abre y qué se cierra. */
            if(a.id === aquiAhora) vivo += trazo; else d += trazo;
          }
        }
      }
      svg.innerHTML = `<path d="${d}" class="rCamino"/>`
                    + (vivo ? `<path d="${vivo}" class="rCamino vivo"/>` : "");
    }
    pendientes = [];
  }

  /* ══ EL RASTREADOR DE MAZO ══
     Tu avatar y tu carta estrella arriba, y debajo el mazo agrupado por
     cartas repetidas, como una decklist de verdad. Se puede plegar,
     porque en el móvil ocupa la mitad de la pantalla. */
  /* Con el dedo el rastreador arranca PLEGADO: desplegado tapaba justo la
   zona del mapa donde están los nodos. */
let rastreadorPlegado = (()=>{ try{ return !!globalThis.matchMedia?.("(pointer:coarse)")?.matches; }
                               catch(e){ return false; } })();
  function rastreador(est){
    const caja = el("aside","rTracker"+(rastreadorPlegado?" plegado":""));
    const cab = el("button","rTrackCab");
    const mio = H.run.mazo.main;
    /* La carta estrella: la más valiosa que llevas. Es la que te
       identifica de un vistazo. */
    const estrella = [...mio].sort((a,b)=>cat.valor(b)-cat.valor(a))[0];
    if(estrella){
      const img = document.createElement("img");
      img.className = "rTrackEstrella"; img.src = imagenCarta(estrella);
      img.alt = cat.nombre(estrella);
      cab.appendChild(img);
    }
    const quien = el("div","rTrackQuien");
    quien.appendChild(el("b",null, T("Tu mazo")));
    quien.appendChild(el("span",null, `${mio.length} ${T("cartas")}`));
    cab.appendChild(quien);
    cab.appendChild(el("span","rTrackFlecha", rastreadorPlegado ? "▸" : "▾"));
    cab.onclick = () => { rastreadorPlegado = !rastreadorPlegado; pintar(); };
    caja.appendChild(cab);

    if(!rastreadorPlegado){
      /* Agrupado y ordenado: monstruos, mágicas y trampas, y dentro por
         nombre. Una decklist, no un montón. */
      const cuenta = new Map();
      for(const c of mio) cuenta.set(c, (cuenta.get(c) ?? 0) + 1);
      const orden = { MONSTRUO:0, MAGICA:1, TRAMPA:2 };
      const lista = [...cuenta.entries()].sort((a,b) =>
        (orden[cat.categoria(a[0])] - orden[cat.categoria(b[0])]) ||
        cat.nombre(a[0]).localeCompare(cat.nombre(b[0])));
      const cuerpo = el("div","rTrackLista");
      let ultima = null;
      for(const [code, n] of lista){
        const grupo = cat.categoria(code);
        if(grupo !== ultima){
          cuerpo.appendChild(el("div","rTrackGrupo",
            T({MONSTRUO:"Monstruos", MAGICA:"Mágicas", TRAMPA:"Trampas"}[grupo] ?? grupo)));
          ultima = grupo;
        }
        const fila = el("button","rTrackFila r"+cat.rareza(code));
        fila.appendChild(el("span","rTrackN", "×"+n));
        fila.appendChild(el("span","rTrackNom", cat.nombre(code)));
        fila.title = cat.nombre(code);
        /* Era un <div> con `title`: en el móvil, donde no hay puntero que
           dejar quieto, no había forma de saber qué hace una carta de tu
           propio mazo. Ahora se toca y se abre la hoja de lectura. */
        fila.onclick = () => mostrarCarta(code, null);
        cuerpo.appendChild(fila);
      }
      caja.appendChild(cuerpo);
      const b = el("button","rBtn", T("Editar el mazo"));
      b.onclick = () => { vista = "binder"; pintar(); };
      caja.appendChild(b);
    }
    return caja;
  }

  /* ── un nodo ── */
  function vistaNodo(est){
    const c = el("div","rNodoVista");
    if(!carga) { vista = "mapa"; return c; }
    switch(carga.tipo){
      case "DUELO": case "ELITE": case "JEFE": return nodoDuelo(c, est);
      case "PACK":        return nodoPack(c);
      case "MERCADER":    return nodoMercader(c);
      case "CAMPAMENTO":  return nodoCampamento(c);
      case "EVENTO":      return nodoEvento(c);
      case "PREPARACION": return nodoPreparacion(c);
      default: vista = "mapa"; return c;
    }
  }

  /* La corona del Elite: cinco puntas y tres gemas, en SVG para que
     escale y no dependa de emojis. */
  function corona(){
    const cont = el("span","rCorona");
    try{
      const svg = document.createElementNS("http://www.w3.org/2000/svg","svg");
      svg.setAttribute("viewBox","0 0 24 16");
      svg.innerHTML = '<path d="M2 14 L1 3 L6.5 7 L12 1 L17.5 7 L23 3 L22 14 Z" '
        + 'fill="currentColor" stroke="rgba(0,0,0,.6)" stroke-width="1"/>'
        + '<circle cx="6.5" cy="10.5" r="1.2" fill="rgba(0,0,0,.35)"/>'
        + '<circle cx="12"  cy="10"   r="1.4" fill="rgba(0,0,0,.35)"/>'
        + '<circle cx="17.5" cy="10.5" r="1.2" fill="rgba(0,0,0,.35)"/>';
      cont.appendChild(svg);
    }catch(e){ cont.textContent = "▲"; }   // DOM simulado
    return cont;
  }

  function retrato(rival){
    const caja = el("div","rRetrato");
    const src = rival?.avatar ? avatares?.[rival.avatar]?.d : null;
    if(src){ const img = document.createElement("img"); img.src = src; caja.appendChild(img); }
    else caja.appendChild(el("div","rSilueta", (rival?.nombre ?? "?").slice(0,1)));
    return caja;
  }

  /* Las fichas apostadas, DIBUJADAS. "En juego: 2 ★" es un dato; dos
     estrellas doradas al lado de las tuyas es una apuesta. */
  function fichas(n, clase){
    const caja = el("span","rFichas "+(clase||""));
    for(let i=0;i<Math.min(n,10);i++) caja.appendChild(el("span","rFicha","★"));
    if(n > 10) caja.appendChild(el("span","rFichaMas","×"+n));
    return caja;
  }

  function nodoDuelo(c, est){
    const r = carga.rival;
    const esJefe = carga.tipo === "JEFE";
    /* ══ EL CAREO ══
       Era un retrato de 90 px con tres líneas de texto al lado. Ahora es
       lo que se espera antes de un duelo del anime: la cara grande, su
       frase, y lo que te juegas en estrellas de verdad. */
    const careo = el("div","rCareo"+(esJefe?" jefe":"")+(carga.tipo==="ELITE"?" elite":""));
    careo.appendChild(el("div","rCareoTipo",
      carga.tituloJefe ? T(carga.tituloJefe) : T(NOMBRE_NODO[carga.tipo])));
    const cara = el("div","rCareoCara");
    cara.appendChild(retrato(r));
    careo.appendChild(cara);
    careo.appendChild(el("h2","rCareoNom", r?.nombre ?? "?"));
    if(r?.frase) careo.appendChild(el("p","rCareoFrase", `«${T(r.frase)}»`));

    /* Lo que te juegas, con las estrellas a la vista. */
    const apuesta = el("div","rApuesta");
    const enJuego = el("div","rApuestaLin");
    enJuego.appendChild(el("span","rApuestaEt", T("En juego")));
    enJuego.appendChild(fichas(carga.apuesta.apuesta, "juego"));
    apuesta.appendChild(enJuego);
    const gana = el("div","rApuestaLin bien");
    gana.appendChild(el("span","rApuestaEt", T("Si ganas")));
    gana.appendChild(fichas(carga.apuesta.gana, "gana"));
    apuesta.appendChild(gana);
    const pierde = el("div","rApuestaLin mal");
    pierde.appendChild(el("span","rApuestaEt", T("Si pierdes")));
    pierde.appendChild(fichas(Math.abs(carga.apuesta.pierde), "pierde"));
    apuesta.appendChild(pierde);
    careo.appendChild(apuesta);

    /* El tier del mazo, que es de dónde sale toda la dificultad ahora que
       el bot siempre juega en experto. Merece decirse con palabras. */
    const t = r?.tier ?? 1;
    careo.appendChild(el("div","rCareoMazo",
      `${T("Su mazo")}: ${T(["", "de aficionado", "de torneo", "afilado"][t] ?? "")}`));
    if(carga.lpIniciales !== 8000)
      careo.appendChild(el("div","rBuff", `${T("Empiezas con")} ${carga.lpIniciales} LP`));
    c.appendChild(careo);

    if(carga.problemas?.length){
      c.appendChild(el("div","rAviso", carga.problemas[0]));
      const ir = el("button","mbig", T("Arreglar el mazo"));
      ir.onclick = () => { vista = "binder"; pintar(); };
      c.appendChild(ir);
    } else {
      const b = el("button","mbig", T("¡Duelo!"));
      b.onclick = () => alDuelo?.(carga);
      c.appendChild(b);
      /* ══ ATAJO DE PRUEBAS · BAJO LLAVE ══
         Recorrer el modo historia jugando cada duelo son 20 minutos por
         vuelta, y la mitad de lo que hay que probar está DESPUÉS del
         duelo: recompensas, sobres, mercader, campamento, el jefe. Estos
         dos botones saltan el duelo dándolo por ganado o por perdido.

         ESTABAN SUELTOS EN LA VERSIÓN FINAL, y eso no es un atajo de
         pruebas: es que cualquiera que abra el juego puede saltarse la
         aventura entera y cobrar todas las recompensas sin jugar una
         mano — la misma familia que la pantalla de victoria que resolvía
         el nodo del duelo siguiente. Lo reportó E.

         Ahora solo existen con el modo depuración encendido, que se
         enciende escribiendo la contraseña en Opciones. Se comprueba en
         el momento de PINTAR, no al arrancar, para que apagarlo desde
         Opciones se note sin recargar. */
      if(globalThis.__DEPURACION__){
        const trampa = el("button","rBtn sec rTrampa", "▶ " + T("Ganar sin jugar (pruebas)"));
        trampa.onclick = () => alSaltarDuelo?.(carga, true);
        c.appendChild(trampa);
        const perder = el("button","rBtn sec rTrampa", "▼ " + T("Perder sin jugar (pruebas)"));
        perder.onclick = () => alSaltarDuelo?.(carga, false);
        c.appendChild(perder);
      }
    }
    c.appendChild(volverAlMapa());
    return c;
  }

  /* La carta que representa a cada familia de sobres: se pinta como si
     fuera el sobre. Son cartas del propio pool, así que no hace falta
     dibujar nada. */
  const CARA_FAMILIA = { ARCANE:"Dark Magician", WARRIOR:"Blade Knight",
                         DRAGON:"Blue-Eyes White Dragon", RECRUIT:"Mother Grizzly",
                         FORBID:"Scapegoat" };

  /* ══ VER QUÉ HAY DENTRO ANTES DE ABRIRLO ══
     E: «la info de qué cartas hay en cada pack aún no se ve claramente.
     Quiero que salga al hacer hover en el sobre en PC, en móvil un botón
     o una pantalla que muestre el pool antes de la selección final».

     Un sobre es una decisión irreversible y se estaba tomando a ciegas:
     la guía existía, pero en OTRA pantalla y sin nada que dijera que
     estaba ahí. Ahora cada sobre lleva su propio botón —que funciona con
     el dedo— y en PC además se abre solo al pasar el ratón, con el mismo
     retardo que la ficha de carta del duelo para que rozarlo de camino
     no dispare nada.

     Vive FUERA de la función que pinta: `pintar()` monta la pantalla
     entera otra vez y una variable declarada dentro se borraría con el
     mismo clic que la pone. Es la trampa que ya se llevó por delante la
     ventaja de maestría y la carta de maestro. */
  let sobreEspiado = null;
  let relojEspiar = null;

  function nodoPack(c){
    { const a = ilustracion("sobre", "rArteSobre"); if(a) c.appendChild(a); }
    c.appendChild(el("h2",null, T("Elige un sobre")));
    c.appendChild(el("p","rSub", T("Pasa el ratón por un sobre para ver qué lleva dentro.")));
    c.appendChild(el("p","rSub soloTacto", T("Toca «Ver qué sale» para leer el sobre antes de abrirlo.")));

    /* ══ EL PARPADEO ══
       La primera versión hacía `pintar()` dentro del `onmouseenter`.
       `pintar()` monta la pantalla ENTERA otra vez, así que destruye el
       botón que hay debajo del ratón y crea uno nuevo en su sitio; el
       navegador dispara `mouseenter` sobre el nuevo, que vuelve a
       repintar, y así en bucle. Desde fuera es el panel abriéndose y
       cerrándose sin parar que reportó E.

       La regla que lo evita: **una respuesta al ratón no puede repintar
       la pantalla que contiene al elemento que la disparó.** Aquí el
       panel se RELLENA en su sitio y nadie toca la fila de sobres.
       (Y por si acaso, entrar en el sobre que ya estás mirando no hace
       nada: dos cinturones, porque este bucle es difícil de ver en un
       DOM simulado.) */
    const zona = el("div","rEspiaZona");
    const panelEspia = el("div","rEspia");
    const marcarBotones = () => {
      for(const b of zona.__ojos ?? [])
        b.classList.toggle("on", b.dataset.fam === sobreEspiado);
    };
    function refrescarEspia(){
      panelEspia.innerHTML = "";
      marcarBotones();
      if(!sobreEspiado){ panelEspia.classList.remove("abierto"); return; }
      panelEspia.classList.add("abierto");
      const fam = carga.familias.find(f => f.id === sobreEspiado);
      const cont = cat.contenidoDe?.(sobreEspiado) ?? { familia:[], premium:[] };
      panelEspia.appendChild(el("b",null, T(fam?.nombre ?? sobreEspiado)));
      panelEspia.appendChild(el("span","rSub", T(fam?.desc ?? "")));
      panelEspia.appendChild(el("label","mlab",
        `${T("Cartas de la familia")} · ${cont.familia.length}`));
      panelEspia.appendChild(rejillaCartas(cont.familia.slice(0, 24), null, null, false));
      if(cont.familia.length > 24)
        panelEspia.appendChild(el("p","rSub",
          `${T("y")} ${cont.familia.length-24} ${T("más")}`));
      const todo = el("button","rBtn", T("Ver la guía completa de sobres"));
      todo.onclick = () => { sobreAbierto = sobreEspiado; vista = "sobres"; pintar(); };
      panelEspia.appendChild(todo);
      const cerrar = el("button","rBtn sec", T("Cerrar"));
      cerrar.onclick = () => { sobreEspiado = null; refrescarEspia(); };
      panelEspia.appendChild(cerrar);
    }
    const espiar = id => {
      if(sobreEspiado === id) return;      // ya está abierto: no se toca nada
      sobreEspiado = id;
      refrescarEspia();
    };

    const rej = el("div","rFamilias");
    zona.__ojos = [];
    for(const f of carga.familias){
      const caja = el("div","rFamiliaCaja");
      const b = el("button","rFamilia");
      /* El "sobre": tres cartas apiladas con la insignia de la familia
         delante. Da mucho más que una caja de texto. */
      const sobre = el("div","rSobre");
      const nombre = CARA_FAMILIA[f.id];
      const code = (cat.familias[f.id] ?? []).find(x =>
        cat.nombre(x).replace(/\s*\(.*\)$/,"") === nombre) ?? (cat.familias[f.id] ?? [])[0];
      for(let i=0;i<3;i++){
        const capa = el("div","rSobreCapa c"+i);
        if(code && i===2){
          const img = document.createElement("img");
          img.src = imagenCarta(code); img.alt = "";
          capa.appendChild(img);
        }
        sobre.appendChild(capa);
      }
      b.appendChild(sobre);
      b.appendChild(el("b",null, T(f.nombre)));
      b.appendChild(el("span",null, T(f.desc)));
      b.onclick = () => {
        const cartas = H.abrirPack(f.id, { elite: carga.tipo==="ELITE" });
        carga = { ...carga, tipo:"PACK_ABIERTO", cartas };
        pintar();
      };
      /* En PC, asomarse con el ratón. El retardo es el mismo que el de
         la ficha de carta del duelo: pasar por encima de camino a otro
         sobre no puede abrir un panel. */
      b.onmouseenter = () => {
        clearTimeout(relojEspiar);
        relojEspiar = setTimeout(() => espiar(f.id), 140);
      };
      b.onmouseleave = () => clearTimeout(relojEspiar);
      caja.appendChild(b);

      /* Y el gesto táctil equivalente, que además es el que dice que
         esto se puede mirar: sin él, en un móvil no hay forma de saber
         qué lleva el sobre. */
      const cuantas = (cat.familias?.[f.id] ?? []).length;
      const ojo = el("button","rVerPool", "🔍 " + T("Ver qué sale")
                     + (cuantas ? ` (${cuantas})` : ""));
      ojo.dataset.fam = f.id;
      ojo.onclick = () => {
        if(sobreEspiado === f.id){ sobreEspiado = null; refrescarEspia(); }
        else espiar(f.id);
      };
      zona.__ojos.push(ojo);
      caja.appendChild(ojo);
      rej.appendChild(caja);
    }

    /* ══ EL PANEL, FIJO AL LADO EN PC Y DEBAJO EN MÓVIL ══
       Los dos van en la misma fila y el CSS decide: en pantalla ancha
       el panel se queda pegado a la izquierda mientras miras los cinco
       sobres; con el dedo se apila debajo, que es donde cae la vista
       después de pulsar «Ver qué sale». */
    zona.appendChild(panelEspia);
    zona.appendChild(rej);
    c.appendChild(zona);
    refrescarEspia();

    /* «Seguir sin usarlo» aquí no quería decir nada: lo que decides es
       no abrir ningún sobre. Lo reportó E. */
    c.appendChild(volverAlMapa(false, "← Volver al mapa"));
    return c;
  }

  function nodoPackAbierto(c){
    c.appendChild(el("h2",null, T("Diez cartas, todas tuyas")));
    /* ══ EL BOTÓN TIENE QUE IR DONDE DICE ══
       Ponía «Al binder» y llevaba al MAPA. Justo después de abrir un
       sobre es cuando quieres ver las diez cartas nuevas junto a las que
       ya tenías, y en su sitio: por eso además deja el binder abierto,
       no el mazo. */
    const b = el("button","mbig", T("Al binder"));
    b.onclick = () => { coleccionActiva = "binder"; vista = "binder"; carga = null; pintar(); };
    c.appendChild(conPanel([
      rejillaCartas(carga.cartas.map(x=>x.code), carga.cartas, null, true), b ]));
    return c;
  }

  function nodoMercader(c){
    { const a = ilustracion("mercader", "rArteAncho"); if(a) c.appendChild(a); }
    c.appendChild(el("h2",null, T("El mercader")));
    c.appendChild(el("p","rSub", T("Aquí no hay dinero: se paga con cartas del binder.")));
    for(const r of carga.recetas){
      const caja = el("div","rReceta"+(r.puede?"":" no"));
      caja.appendChild(el("b",null, T(textoReceta(r))));
      if(!r.puede) caja.appendChild(el("span","rMeta", T(r.motivo)));
      else {
        const b = el("button","rBtn", T("Ver el cambio"));
        b.onclick = () => {
          /* PRIMERO SE ENSEÑA EL PRECIO. La versión anterior cobraba en
             cuanto elegías la carta y sin decir qué se llevaba: E lo vio
             como "no me ha dejado elegir las cartas para darle". */
          const oferta = H.ofertaDe(r.id);
          carga = { ...carga, tipo:"MERCADER_OFERTA", receta:r, oferta,
                    precio: H.precioDe?.(r.id) ?? [] };
          pintar();
        };
        caja.appendChild(b);
      }
      c.appendChild(caja);
    }
    c.appendChild(volverAlMapa(true));
    return c;
  }
  const textoReceta = r => ({
    morralla:"10 cartas de relleno → una carta buena",
    enfocado:"15 de la misma clase → una buena de esa clase",
    premium:"20 cartas de relleno → una carta muy buena",
    prestigio:"2 muy buenas + 2 buenas → una carta de las gordas",
    cambio:"2 de la misma rareza → otra de esa rareza",
  })[r.id] ?? r.id;

  function nodoCampamento(c){
    { const a = ilustracion("hoguera", "rArteHoguera"); if(a) c.appendChild(a); }
    c.appendChild(el("h2",null, T("Campamento")));
    c.appendChild(el("p","rSub", T("Elige una sola cosa.")));
    for(const o of carga.opciones){
      const b = el("button","rOpcion"+(o.puede?"":" no"));
      b.textContent = T(o.texto);
      b.disabled = !o.puede;
      b.onclick = () => {
        /* REFINAR ES DE DOS PASOS y la primera versión se comía el
           segundo: elegías "sacrificar una carta" y el juego te devolvía
           al mapa sin pedirte la carta ni darte nada. Lo reportó E. */
        if(o.id === "refinar"){
          carga = { ...carga, tipo:"CAMPAMENTO_SACRIFICIO" };
          pintar(); return;
        }
        const res = H.acampar(o.id);
        aviso = res.ok ? (res.texto ?? "Hecho") : res.motivo;
        vista = "mapa"; carga = null; pintar();
      };
      c.appendChild(b);
    }
    c.appendChild(volverAlMapa(true));
    return c;
  }

  /* La parada de preparación del castillo: eliges UNA de las tres. */
  function nodoPreparacion(c){
    c.appendChild(el("h2",null, T("Preparación del castillo")));
    c.appendChild(el("p","rSub",
      T("Antes de subir el siguiente peldaño puedes hacer una cosa. Solo una.")));
    const QUE = { PACK:["Abrir un sobre","Diez cartas de la familia que elijas"],
                  MERCADER:["Ir al mercader","Cambiar cartas que no usas por una que sí"],
                  CAMPAMENTO:["Acampar","Puntos de vida extra, recuperar una ficha o refinar"] };
    for(const tipo of (carga.opciones ?? [])){
      const [tit, sub] = QUE[tipo] ?? [tipo, ""];
      const b = el("button","rOpcion");
      b.appendChild(el("b",null, T(tit)));
      b.appendChild(el("span",null, T(sub)));
      b.onclick = () => { carga = H.elegirPreparacion(tipo); pintar(); };
      c.appendChild(b);
    }
    c.appendChild(volverAlMapa(true));
    return c;
  }

  function nodoEvento(c){
    const ev = carga.evento;
    c.appendChild(el("h2",null, T(ev.titulo)));
    const ficha = el("div","rDuelista");
    ficha.appendChild(retrato({ avatar:ev.avatar, nombre:T(ev.quien) }));
    const txt = el("div","rTexto");
    txt.appendChild(el("b",null, T(ev.quien)));
    txt.appendChild(el("p",null, T(ev.texto)));
    ficha.appendChild(txt);
    c.appendChild(ficha);
    for(const op of ev.opciones){
      const b = el("button","rOpcion", T(op.texto));
      b.onclick = () => {
        /* ══ UNA PANTALLA SIN SALIDA ES UNA TRAMPA ══
           Si algo revienta al resolver el encuentro te quedabas aquí
           para siempre: esta pantalla no tenía ningún botón de volver.
           E lo reportó dos veces como "los encounters te atascan". Ahora
           el fallo se dice y se sale igual — un error de interfaz no
           puede costarte la run. */
        /* ══ UN ENCUENTRO TENÍA QUE VERSE ══
           Antes esto volvía DIRECTO al mapa con un aviso de una línea,
           que además se borra en el siguiente repintado. Los efectos sí
           se aplicaban —las cartas entraban al binder, las fichas
           cambiaban— pero no se veía nada: eso es lo que E contó como
           "los eventos no hacen nada". Ahora hay pantalla de resultado
           con las cartas que te llevas y lo que ha cambiado. */
        const antes = { chips: H.estado()?.chips ?? 0 };
        try{
          const res = H.elegirEnEvento(op);
          carga = { tipo:"EVENTO_RESULTADO", evento:ev, opcion:op,
                    ...res, chipsAntes:antes.chips,
                    chipsAhora: H.estado()?.chips ?? antes.chips };
          vista = H.estado()?.terminada ? "fin" : "nodo";
        }catch(e){
          aviso = T("Algo falló al resolver el encuentro") + ": " + (e?.message ?? e);
          vista = "mapa"; carga = null;
        }
        pintar();
      };
      c.appendChild(b);
    }
    /* Y una salida siempre visible, pase lo que pase. */
    c.appendChild(volverAlMapa(true));
    return c;
  }

  /* ══ LO QUE HA PASADO EN EL ENCUENTRO ══
     Con nombre, con las cartas a la vista y con el saldo de fichas. Si
     no se ve, para el jugador no ha ocurrido. */
  function nodoEventoResultado(c){
    const ev = carga.evento, op = carga.opcion;
    c.appendChild(el("h2",null, T(ev.titulo)));
    const ficha = el("div","rDuelista");
    ficha.appendChild(retrato({ avatar:ev.avatar, nombre:T(ev.quien) }));
    const txt = el("div","rTexto");
    txt.appendChild(el("b",null, T(ev.quien)));
    txt.appendChild(el("p","rElegiste", `«${T(op.texto)}»`));
    txt.appendChild(el("p",null, T(carga.texto || op.resultado || "")));
    ficha.appendChild(txt);
    c.appendChild(ficha);

    /* El saldo de fichas, con signo. */
    const d = (carga.chipsAhora ?? 0) - (carga.chipsAntes ?? 0);
    const lineas = el("div","rSaldo");
    if(d !== 0)
      lineas.appendChild(el("div","rSaldoFila" + (d > 0 ? " bien" : " mal"),
        `${d > 0 ? "+" : ""}${d} Star ${Math.abs(d) === 1 ? "Chip" : "Chips"}`
        + `  ·  ${T("ahora tienes")} ${carga.chipsAhora}`));
    if(carga.apuesta)
      lineas.appendChild(el("div","rSaldoFila" + (carga.apuesta.ganas ? " bien" : " mal"),
        T(carga.apuesta.ganas ? "Has ganado la apuesta" : "Has perdido la apuesta")));
    if(H.run?.buffs?.mejorarProxima)
      lineas.appendChild(el("div","rSaldoFila bien",
        T("Tu próxima recompensa será de mejor calidad")));
    if(lineas.children.length) c.appendChild(lineas);

    /* Y las cartas, con su arte: es la parte que se siente. */
    if(carga.cartas?.length){
      c.appendChild(el("label","mlab",
        `${carga.cartas.length} ${T(carga.cartas.length === 1 ? "carta al binder" : "cartas al binder")}`));
      /* Cuarenta cartas de morralla no caben de una en una a tamaño
         grande: por encima de doce se pintan pequeñas. */
      c.appendChild(conPanel(rejillaCartas(carga.cartas.slice(0, 24), null,
                                           null, carga.cartas.length <= 12)));
      if(carga.cartas.length > 24)
        c.appendChild(el("p","rSub", `${T("y")} ${carga.cartas.length - 24} ${T("más en el binder")}`));
      const ir = el("button","mbig", T("Al binder"));
      ir.onclick = () => { coleccionActiva = "binder"; vista = "binder"; carga = null; pintar(); };
      c.appendChild(ir);
    }
    c.appendChild(volverAlMapa(true));
    return c;
  }

  /* ── recompensa tras un duelo ── */
  function mostrarResultado(res){
    vista = "nodo";
    carga = { tipo:"RESULTADO", ...res };
    pintar();
  }
  function nodoResultado(c){
    c.appendChild(el("h2",null, T(carga.ganado ? "Victoria" : "Derrota")));
    c.appendChild(el("p","rSub",
      `${T("Star Chips")}: ${carga.antes} → ${carga.ahora}`));
    if(carga.premio?.length){
      c.appendChild(el("p","rSub", T("Elige una carta")));
      const rej = el("div","rCartas grandes");
      for(const p of carga.premio){
        const b = el("button","rCarta r"+p.rareza);
        b.appendChild(imagen(p.code));
        b.appendChild(el("span","rNom", cat.nombre(p.code)));
        b.appendChild(el("span","rPapel", T(p.papel)));
        enlazarCarta(b, p.code, code => { H.cogerPremio(code);
          vista = carga.terminada ? "fin" : "mapa"; carga = null; pintar(); });
        rej.appendChild(b);
      }
      c.appendChild(conPanel(rej));
    } else {
      const b = el("button","mbig", T("Seguir"));
      b.onclick = () => { vista = carga.terminada ? "fin" : "mapa"; carga = null; pintar(); };
      c.appendChild(b);
    }
    /* EL LOG, AQUÍ. En el Reino el duelo acaba y te devuelve al mapa: E se
       quedó sin poder descargarlo justo cuando quería reportar algo. */
    if(globalThis.descargarLog){
      const log = el("button","rBtn", T("Descargar log"));
      log.onclick = () => globalThis.descargarLog();
      c.appendChild(log);
    }
    return c;
  }

  /* ── binder y mazo ── */
  /* ══════════════════════════════════════════════════════════════════
     MAZO Y BINDER — DOS MITADES, NO UNA TIRA INFINITA

     E lo llamó "la parte más injugable": era una sola columna con las
     cartas enormes, el mazo arriba y el binder a cuarenta cartas de
     scroll de distancia. Para mover una carta había que recordar dónde
     estaba la otra mitad.

     Ahora son dos paneles con su propio scroll —arriba el mazo, abajo el
     binder—, cada uno con su cuenta, y las cartas se pasan de uno a otro
     ARRASTRÁNDOLAS. Con el dedo: mantener quieto = leer la carta, mover
     = arrastrar. Con ratón, además, un clic la manda al otro lado, que
     es más rápido y es como funcionaba antes.
     ══════════════════════════════════════════════════════════════════ */
  function panelDeCartas({ titulo, subtitulo, codes, vacio, alSoltar, alPulsar,
                           clase, signo, recordarScroll }){
    const caja = el("section","rMitad "+(clase||""));
    const cab = el("header","rMitadCab");
    cab.appendChild(el("b",null, T(titulo)));
    cab.appendChild(el("span","rMitadN", String(codes.length)));
    if(subtitulo) cab.appendChild(el("span","rMitadSub", subtitulo));
    caja.appendChild(cab);
    const cuerpo = el("div","rMitadCuerpo");
    /* ══ MOVER UNA CARTA NO PUEDE MANDARTE ARRIBA DEL TODO ══
       Cada `+`/`−` repinta la pantalla entera y el scroll se perdía: con
       el binder lleno, mover una carta te sacaba de donde estabas.
       Se guarda al desplazar y se restaura al montar. Por pestaña,
       porque cada lista tiene su propia altura. */
    if(recordarScroll){
      cuerpo.onscroll = e => {
        const v3 = e?.target?.scrollTop ?? cuerpo.scrollTop ?? 0;
        scrollPorTab[recordarScroll] = v3;
      };
      const guardado = scrollPorTab[recordarScroll] ?? 0;
      if(guardado) requestAnimationFrame?.(() => { try{ cuerpo.scrollTop = guardado; }catch(e){} });
    }
    if(!codes.length){
      cuerpo.appendChild(el("p","rSub", T(vacio)));
    } else {
      const rej = el("div","rCartas mini");
      codes.forEach(code => {
        /* Una carta = dos cosas distintas, así que dos objetivos
           distintos. Tocar la carta ABRE la ficha; el botón +/− la MUEVE
           sin abrir nada. Con el dedo, meterlo todo en el mismo toque
           obligaba a arrastrar, y arrastrar entre dos listas con scroll
           propio en un teléfono es una pelea perdida: E lo reportó como
           "drag & drop no funciona bien en touch". */
        const cel = el("div","rCartaCel");
        const b = el("button","rCarta r"+cat.rareza(code));
        b.appendChild(imagen(code));
        b.appendChild(el("span","rNom", cat.nombre(code)));
        /* ══ DOS CAMINOS PARA LO MISMO, Y LOS DOS HACEN FALTA ══
           El botón de la celda mueve la carta de un tirón; tocar la
           carta abre la ficha, y la ficha lleva TAMBIÉN el botón. Uno es
           para ir rápido y el otro para decidir habiendo leído la carta,
           que en un binder de ciento y pico es justo lo que hace falta.
           (El botón estuvo un rato flotando encima de la ilustración y
           tapaba media carta: ahora es una barra debajo.) */
        enlazarCarta(b, code, TACTIL() ? alPulsar : null,
                     signo === "+" ? "Añadir al mazo" : "Quitar del mazo");
        arrastrable(b, code);                   // arrastrar sigue estando, para ratón
        cel.appendChild(b);
        if(alPulsar){
          const mover = el("button","rMover"+(signo==="+"?" mas":" menos"), signo ?? "+");
          mover.setAttribute("aria-label",
            T(signo === "+" ? "Añadir al mazo" : "Quitar del mazo") + ": " + cat.nombre(code));
          mover.title = mover.getAttribute("aria-label");
          mover.onclick = e => { e.stopPropagation?.(); alPulsar(code); };
          cel.appendChild(mover);
        }
        rej.appendChild(cel);
      });
      cuerpo.appendChild(rej);
    }
    caja.appendChild(cuerpo);
    caja.dataset.suelta = "1";
    caja._alSoltar = alSoltar;
    return caja;
  }

  /* El arrastre. Deliberadamente tonto: no hay reordenación ni casillas,
     solo "de qué panel sale y en cuál se suelta". */
  let arrastre = null;
  function arrastrable(btn, code){
    btn.addEventListener("pointerdown", e => {
      const origen = btn.closest?.("[data-suelta]");
      if(!origen) return;
      arrastre = { code, origen, x0:e.clientX ?? 0, y0:e.clientY ?? 0,
                   movido:false, fantasma:null };
    });
  }
  function moverArrastre(e){
    if(!arrastre) return;
    const dx = (e.clientX ?? 0) - arrastre.x0, dy = (e.clientY ?? 0) - arrastre.y0;
    if(!arrastre.movido && Math.hypot(dx,dy) < 12) return;
    if(!arrastre.movido){
      arrastre.movido = true;
      /* Al empezar a arrastrar, fuera la ficha de lectura: si no, tapa
         justo el panel al que vas. */
      cerrarPanel();
      const f = el("div","rFantasma");
      const img = document.createElement("img");
      img.src = imagenCarta(arrastre.code, "cards_small");
      f.appendChild(img);
      document.body.appendChild(f);
      arrastre.fantasma = f;
    }
    arrastre.fantasma.style.left = (e.clientX ?? 0) + "px";
    arrastre.fantasma.style.top  = (e.clientY ?? 0) + "px";
    const bajo = document.elementFromPoint?.(e.clientX ?? 0, e.clientY ?? 0);
    const destino = bajo?.closest?.("[data-suelta]");
    for(const z of document.querySelectorAll("[data-suelta]"))
      z.classList.toggle("recibe", z === destino && z !== arrastre.origen);
  }
  function soltarArrastre(e){
    if(!arrastre) return;
    const a = arrastre; arrastre = null;
    a.fantasma?.remove();
    for(const z of document.querySelectorAll("[data-suelta]")) z.classList.remove("recibe");
    if(!a.movido) return;                       // fue un toque, no un arrastre
    const bajo = document.elementFromPoint?.(e.clientX ?? 0, e.clientY ?? 0);
    const destino = bajo?.closest?.("[data-suelta]");
    if(!destino || destino === a.origen) return;
    destino._alSoltar?.(a.code);
  }
  if(!globalThis.__rArrastreListo__){
    globalThis.__rArrastreListo__ = true;
    window.addEventListener("pointermove", moverArrastre);
    window.addEventListener("pointerup", soltarArrastre);
    window.addEventListener("pointercancel", () => {
      arrastre?.fantasma?.remove(); arrastre = null;
      for(const z of document.querySelectorAll("[data-suelta]")) z.classList.remove("recibe");
    });
  }

  function vistaBinder(est){
    const c = el("div","rBinder");
    c.appendChild(el("h2",null, T("Mazo y binder")));
    const problemas = est.problemas;
    if(problemas.length) c.appendChild(el("div","rAviso", problemas[0]));

    const alMazo   = code => { H.meterEnMazo?.(code); pintar(); };
    const alBinder = code => { H.sacarDelMazo?.(code); pintar(); };

    /* ══ UNA SOLA FUENTE DE VERDAD PARA LA CUENTA ══
       La barra decía "Deck: 40" y el panel "YOUR DECK 42": la barra
       contaba el Main y el panel sumaba Main + Extra bajo el mismo
       rótulo. Ahora el número grande es SIEMPRE el Main —que es el que
       tiene que valer 40— y el Extra es su propia colección. */
    const main  = H.run.mazo.main, extra = H.run.mazo.extra ?? [];
    const binder = H.run.binder, binderExtra = H.run.binderExtra ?? [];

    /* ══════════════════════════════════════════════════════════════
       LAS TRES COLECCIONES, Y SOLO SE PINTA LA ACTIVA

       LA VERSIÓN ANTERIOR ESTABA MAL Y ASÍ ES COMO FALLABA: se pintaban
       los tres paneles y se ocultaban dos con una clase que vivía dentro
       de `@media (pointer:coarse)`. Si esa condición no casaba —el modo
       responsive de Chrome sin emulación táctil, un Android con ratón o
       lápiz, una tablet que se declara `fine`— no se ocultaba nada Y
       TAMPOCO salían las pestañas: los tres paneles quedaban apilados,
       el mazo llenaba la pantalla y el binder quedaba a cuarenta cartas
       de scroll. Que es exactamente "solo puedo ver el Deck".

       Ahora `coleccionActiva` es la única fuente de verdad y el panel
       que no toca NO EXISTE en el DOM. Ninguna condición de CSS puede
       hacer aparecer el equivocado porque no está. Y el modo pestañas lo
       decide el ANCHO además del puntero, medido en JS.
       ══════════════════════════════════════════════════════════════ */
    /* ══════════════════════════════════════════════════════════════
       EL ORDEN DE UNA LISTA DE CARTAS

       E: «ordenar monstruos en el binder por número de estrellas
       ascendente». Las listas salían en el orden en que las cartas
       fueron entrando, que con 200 cartas no es un orden: es el
       historial de la run.

       Se ordena como una carpeta de cartas de verdad y como cualquier
       deck builder: primero los monstruos por NIVEL de menos a más
       —que es lo que pidió E, y además es el orden en que se piensa un
       mazo de Goat: qué invoco sin tributo, qué con uno, qué con dos—,
       luego mágicas y luego trampas. A igualdad, por nombre, para que
       las copias de la misma carta queden juntas y el orden no baile
       entre repintados.

       Se aplica a las TRES listas, no solo al binder: el orden de un
       mazo guardado no significa nada —se baraja igual— y tener el
       binder ordenado y el mazo no habría parecido un arreglo a medias.
       ══════════════════════════════════════════════════════════════ */
    const RANGO_TIPO = { MONSTRUO:0, MAGICA:1, TRAMPA:2 };
    const ordenarCartas = codes => [...codes].sort((a,b) => {
      const ta = RANGO_TIPO[cat.categoria(a)] ?? 3;
      const tb = RANGO_TIPO[cat.categoria(b)] ?? 3;
      if(ta !== tb) return ta - tb;
      if(ta === 0){
        const na = cat.nivel(a) ?? 0, nb = cat.nivel(b) ?? 0;
        if(na !== nb) return na - nb;
      }
      return String(cat.nombre(a)).localeCompare(String(cat.nombre(b)));
    });

    const COLECCIONES = {
      mazo:   { titulo:"Mazo",   signo:"−", codes:ordenarCartas(main),
                vacio:"Tu mazo está vacío.", alPulsar:alBinder, alSoltar:alMazo },
      binder: { titulo:"Binder", signo:"+", codes:ordenarCartas([...binder, ...binderExtra]),
                vacio:"Todavía no has ganado ninguna carta.", alPulsar:alMazo, alSoltar:alBinder },
      extra:  { titulo:"Extra",  signo:"−", codes:ordenarCartas(extra),
                vacio:"Todavía no tienes cartas de Extra Deck.", alPulsar:alBinder, alSoltar:alMazo },
    };
    if(!COLECCIONES[coleccionActiva]) coleccionActiva = "mazo";

    /* ══════════════════════════════════════════════════════════════
       BUSCADOR Y FILTROS

       Con 200 cartas en el binder, encontrar "esa trampa de contador que
       gané hace tres nodos" era imposible. Los filtros son los que se
       usan de verdad al montar un mazo de Goat, ni uno más: qué es
       (monstruo, mágica, trampa) y qué CLASE es dentro de eso. Nada de
       un constructor de consultas.
       ══════════════════════════════════════════════════════════════ */
    const SUBFILTROS = {
      todo: [],
      MONSTRUO: [["n14","Nivel 1-4"],["n5","Tributo 5+"],["normal","Normal"],
                 ["efecto","Efecto"],["flip","Volteo"],["ritual","Ritual"],
                 ["fusion","Fusión"],["especial","Invocación especial"]],
      MAGICA:   [["normal","Normal"],["rapida","Rápida"],["continua","Continua"],
                 ["equipo","Equipo"],["campo","Campo"],["ritual","Ritual"]],
      TRAMPA:   [["normal","Normal"],["continua","Continua"],["contador","Contador"]],
    };
    const T_ = { MONSTRUO:0x1, MAGICA:0x2, TRAMPA:0x4, FUSION:0x40, RITUAL:0x80,
                 FLIP:0x200000, EFECTO:0x20, RAPIDA:0x10000, CONTINUA:0x20000,
                 EQUIPO:0x40000, CAMPO:0x80000, CONTADOR:0x100000, ESPECIAL:0x2000000 };
    const pasaFiltro = code => {
      /* Tipo y atributo solo existen en los monstruos: con uno puesto,
         las mágicas y las trampas no pasan. */
      if(filtroRaza || filtroAtributo){
        if(!cat.esMonstruo(code)) return false;
        const d = cat.datos?.(code) ?? {};
        if(filtroRaza && !(Number(d.race ?? 0) & filtroRaza)) return false;
        if(filtroAtributo && !(Number(d.attribute ?? 0) & filtroAtributo)) return false;
      }
      if(filtroTexto){
        const q = filtroTexto.toLowerCase();
        if(!String(cat.nombre(code)).toLowerCase().includes(q)) return false;
      }
      if(filtroTipo === "todo") return true;
      const cate = cat.categoria(code);
      if(cate !== filtroTipo) return false;
      if(filtroSub === "todo") return true;
      const t = cat.datos?.(code)?.type ?? 0;
      const nivel = cat.nivel(code);
      switch(filtroSub){
        case "n14":      return nivel >= 1 && nivel <= 4;
        case "n5":       return nivel >= 5;
        case "normal":   return cate === "MONSTRUO"
          ? !(t & T_.EFECTO) && !(t & T_.FUSION) && !(t & T_.RITUAL)
          : !(t & (T_.RAPIDA|T_.CONTINUA|T_.EQUIPO|T_.CAMPO|T_.RITUAL|T_.CONTADOR));
        case "efecto":   return !!(t & T_.EFECTO);
        case "flip":     return !!(t & T_.FLIP);
        case "ritual":   return !!(t & T_.RITUAL);
        case "fusion":   return !!(t & T_.FUSION);
        case "especial": return !!(t & T_.ESPECIAL);
        case "rapida":   return !!(t & T_.RAPIDA);
        case "continua": return !!(t & T_.CONTINUA);
        case "equipo":   return !!(t & T_.EQUIPO);
        case "campo":    return !!(t & T_.CAMPO);
        case "contador": return !!(t & T_.CONTADOR);
        default:         return true;
      }
    };
    const hayFiltro = () => !!filtroTexto || filtroTipo !== "todo" || !!filtroRaza || !!filtroAtributo;

    /* ══ EL BUSCADOR FILTRA MIENTRAS ESCRIBES ══
       E, 03-10: «el buscador del binder no funciona». Funcionaba, pero
       solo al pulsar «Filtrar»: escribir no hacía nada y Enter tampoco,
       que es lo que hace cualquiera. Ahora cada tecla vuelve a llenar las
       listas —SOLO las listas: repintar la pantalla entera destruiría el
       campo de texto que tienes debajo del dedo, y con él el teclado del
       móvil y el cursor—. */
    const barraF = el("div","rFiltros");
    const inpF = el("input","rInput rBuscaCarta");
    inpF.placeholder = T("buscar por nombre…");
    inpF.value = filtroTexto;
    let espera = null;
    const alEscribir = e => {
      filtroTexto = String(e?.target?.value ?? inpF.value ?? "");
      clearTimeout(espera);
      espera = setTimeout(llenar, 120);
    };
    inpF.oninput = alEscribir;
    inpF.onkeydown = e => { if(e?.key === "Enter"){ filtroTexto = String(inpF.value ?? ""); llenar(); inpF.blur?.(); } };
    const aplicar = el("button","rBtn", T("Filtrar"));
    aplicar.onclick = () => { filtroTexto = String(inpF.value ?? ""); llenar(); };
    barraF.appendChild(inpF); barraF.appendChild(aplicar);
    for(const [id, nom] of [["todo","Todo"],["MONSTRUO","Monstruos"],
                            ["MAGICA","Mágicas"],["TRAMPA","Trampas"]]){
      const b = el("button","rBtn rFiltro"+(filtroTipo===id?" on":""), T(nom));
      b.dataset.filtro = id;
      b.onclick = () => { filtroTipo = id; filtroSub = "todo"; pintar(); };
      barraF.appendChild(b);
    }
    /* Tipo de monstruo y atributo: dos desplegables, porque son veinte y
       seis opciones y como botones llenarían media pantalla del móvil. */
    const desplegable = (clase, rotulo, tabla, actual, alCambiar) => {
      const sel = el("select","rInput rSelect "+clase);
      const op0 = el("option", null, T(rotulo)); op0.value = "0"; sel.appendChild(op0);
      for(const [v, nom] of Object.entries(tabla)
            .sort((a,b) => T(a[1]).localeCompare(T(b[1])))){
        const op = el("option", null, T(nom)); op.value = String(v);
        if(Number(v) === actual) op.selected = true;
        sel.appendChild(op);
      }
      sel.value = String(actual);
      sel.onchange = e => { alCambiar(Number(e?.target?.value ?? sel.value ?? 0)); pintar(); };
      return sel;
    };
    barraF.appendChild(desplegable("rFiltroRaza", "Tipo de monstruo", RAZA, filtroRaza,
                                   v => { filtroRaza = v; }));
    barraF.appendChild(desplegable("rFiltroAtributo", "Atributo", ATRIBUTO, filtroAtributo,
                                   v => { filtroAtributo = v; }));
    if(hayFiltro()){
      const limpiar = el("button","rBtn sec", T("Quitar filtros"));
      limpiar.onclick = () => { filtroTexto = ""; filtroTipo = "todo";
                                filtroSub = "todo"; filtroRaza = 0; filtroAtributo = 0; pintar(); };
      barraF.appendChild(limpiar);
    }
    /* ══ VACIAR EL MAZO ══
       E, 03-10: «un botón de borrar todo el mazo con un "¿estás
       seguro?", por si quieres armarlo desde cero». No se borra nada:
       todas las cartas del Main y del Extra vuelven al binder. Va en la
       misma fila que los filtros —una fila más se come la lista en un
       móvil apaisado— y la confirmación sale justo debajo, no en un aviso
       arriba de la pantalla que con el binder lleno queda fuera de vista. */
    if(!confirmandoVaciar){
      const vaciar = el("button","rBtn peligro rVaciarMazo", T("Vaciar mazo"));
      vaciar.onclick = () => { confirmandoVaciar = true; pintar(); };
      if(!main.length && !extra.length) vaciar.disabled = true;
      barraF.appendChild(vaciar);
    }
    c.appendChild(barraF);
    if(confirmandoVaciar){
      const accion = el("div","rFiltros rVaciar");
      accion.appendChild(el("span","rConfirma",
        `${T("¿Seguro?")} ${main.length + extra.length} ${T("cartas vuelven al binder y el mazo se queda vacío.")}`));
      const si = el("button","rBtn peligro rVaciarSi", T("Sí, vaciar el mazo"));
      si.onclick = () => {
        const n = H.vaciarMazo?.() ?? 0;
        confirmandoVaciar = false;
        coleccionActiva = "binder";
        aviso = `${n} ${T("cartas vuelven al binder")}`;
        pintar();
      };
      const no = el("button","rBtn sec rVaciarNo", T("Cancelar"));
      no.onclick = () => { confirmandoVaciar = false; pintar(); };
      accion.appendChild(si); accion.appendChild(no);
      c.appendChild(accion);
    }
    if(SUBFILTROS[filtroTipo]?.length){
      const sub = el("div","rFiltros rSub");
      for(const [id, nom] of [["todo","Todos"], ...SUBFILTROS[filtroTipo]]){
        const b = el("button","rBtn rFiltro"+(filtroSub===id?" on":""), T(nom));
        b.dataset.sub = id;
        b.onclick = () => { filtroSub = id; pintar(); };
        sub.appendChild(b);
      }
      c.appendChild(sub);
    }

    const conPestañas = modoPestañas();
    const mitades = el("div","rMitades"+(conPestañas ? " unaSola" : ""));

    if(conPestañas){
      /* Las pestañas, con su cuenta y pegadas arriba. */
      const tabs = el("div","rTabs");
      const cuentas = { mazo:main.length,
                        binder:binder.length + binderExtra.length,
                        extra:extra.length };
      for(const cual of ["mazo","binder","extra"]){
        const b = el("button","rTab"+(coleccionActiva===cual?" on":""),
                     T(COLECCIONES[cual].titulo));
        b.appendChild(el("span","rTabN", String(cuentas[cual])));
        b.dataset.coleccion = cual;
        b.onclick = () => { coleccionActiva = cual; pintar(); };
        tabs.appendChild(b);
      }
      c.appendChild(tabs);
    } else {
      /* En pantalla ancha caben las tres a la vez y no hacen falta
         pestañas: eso sí es una ventaja del escritorio. */
      c.appendChild(el("p","rPista",
        T("Arrastra una carta de un lado al otro. Mantén el ratón encima para leerla.")));
    }
    /* Lo único que se vuelve a montar al escribir en el buscador. */
    function llenar(){
      if(mitades.replaceChildren) mitades.replaceChildren(); else mitades.innerHTML = "";
      const cuales = conPestañas ? [coleccionActiva] : ["mazo","binder","extra"];
      const filtradas = Object.fromEntries(cuales.map(k => [k, COLECCIONES[k].codes.filter(pasaFiltro)]));
      if(hayFiltro() && cuales.every(k => !filtradas[k].length))
        mitades.appendChild(el("p","rSub rSinFiltro", T("Ninguna carta pasa el filtro.")));
      for(const cual of cuales)
        mitades.appendChild(panelDeCartas({ ...COLECCIONES[cual], codes:filtradas[cual],
                                            clase:cual, recordarScroll:cual }));
    }
    llenar();
    c.appendChild(mitades);
    c.appendChild(panelCarta("suelto"));

    const b = el("button","mbig", T("Volver al mapa"));
    b.onclick = () => { vista = "mapa"; pintar(); };
    c.appendChild(b);
    return c;
  }

  /* ¿Se enseña una colección a la vez? Con el dedo siempre, y con ratón
     cuando la ventana es estrecha: el modo responsive de Chrome no
     emula el puntero salvo que se le pida, y ahí es donde se veía el
     bug. La medida se hace AQUÍ y no en el CSS para que la decisión y
     el render no puedan discrepar. */
  function modoPestañas(){
    if(TACTIL()) return true;
    try{ return (globalThis.innerWidth ?? 1200) < 900; }catch(e){ return false; }
  }


  /* ══════════════════════════════════════════════════════════════════
     LA GUÍA DE SOBRES

     "¿En qué sobre sale Polymerization?" era imposible de contestar sin
     abrir el código. Esta pantalla lo dice, y lo saca de las MISMAS
     listas que reparte `abrirPack` —`cat.contenidoDe` y `cat.dondeSale`—
     así que no hay una segunda lista que se pueda quedar desfasada.
     ══════════════════════════════════════════════════════════════════ */
  function vistaSobres(){
    const c = el("div","rSobres");
    c.appendChild(el("h2",null, T("Qué hay en cada sobre")));
    c.appendChild(el("p","rSub", T(
      "Cada sobre da diez cartas: dos de poder genérico, una de tu tipo de monstruo, dos de la familia elegida, tres jugables, una de otra estrategia y una premium.")));

    /* ── el buscador ── */
    c.appendChild(el("label","mlab", T("Buscar una carta")));
    const caja = el("div","rBuscador");
    const inp = el("input","rInput");
    inp.placeholder = T("nombre de la carta…");
    inp.value = busquedaSobres;
    inp.oninput = e => { busquedaSobres = String(e?.target?.value ?? inp.value ?? ""); };
    /* En el DOM simulado no hay eventos de teclado: el botón hace de
       disparador y sirve igual con el dedo. */
    const buscar = el("button","rBtn", T("Buscar"));
    const lanzar = () => { busquedaSobres = String(inp.value ?? ""); pintar(); };
    buscar.onclick = lanzar;
    /* ══ ENTER TAMBIÉN BUSCA ══
       Había que escribir y luego ir al botón con el ratón: E lo pidió.
       El botón se queda porque con el dedo el teclado del móvil no
       siempre trae una tecla de intro visible. `keydown` y no `keyup`
       para que no se cuele el intro que cierra el teclado. */
    inp.onkeydown = e => {
      if(e?.key === "Enter" || e?.keyCode === 13){ e.preventDefault?.(); lanzar(); }
    };
    caja.appendChild(inp); caja.appendChild(buscar);
    c.appendChild(caja);

    if(busquedaSobres.trim()){
      const q = busquedaSobres.trim().toLowerCase();
      const hallados = (cat.jugables ?? []).filter(x =>
        String(cat.nombre(x)).toLowerCase().includes(q)).slice(0, 24);
      const res = el("div","rResultados");
      if(!hallados.length)
        res.appendChild(el("p","rSub", `${T("Nada que se parezca a")} «${busquedaSobres}»`));
      for(const x of hallados){
        const fila = el("div","rResultado");
        const b = el("button","rCartaMini");
        const img = document.createElement("img");
        img.src = imagenCarta(x, "cards_small"); img.alt = cat.nombre(x); img.loading = "lazy";
        b.appendChild(img);
        enlazarCarta(b, x, null);
        fila.appendChild(b);
        const txt = el("div","rResultadoTxt");
        txt.appendChild(el("b",null, cat.nombre(x)));
        txt.appendChild(el("span","rPanelRareza r"+cat.rareza(x), cat.rareza(x)));
        const sitios = cat.dondeSale?.(x) ?? [];
        txt.appendChild(el("span","rDonde", sitios.length
          ? sitios.map(s => s.pack === "cualquiera"
              ? `${T("cualquier sobre")} (${T("casilla")} ${s.casilla}${s.rareza?" "+s.rareza:""})`
              : `${nombreFamilia(s.pack)} (${T("casilla")} ${s.casilla})`).join(" · ")
          : T("no sale en ningún sobre: solo en recompensas de duelo o en el mercader")));
        fila.appendChild(txt);
        res.appendChild(fila);
      }
      c.appendChild(res);
    }

    /* ── los cinco sobres ── */
    c.appendChild(el("label","mlab", T("Los cinco sobres")));
    const fila = el("div","rFamiliasMini");
    for(const fam of (H.familias ?? [])){
      const b = el("button","rBtn rFamilia" + (sobreAbierto===fam.id ? " on" : ""),
                   T(fam.nombre));
      b.dataset.id = fam.id;
      b.onclick = () => { sobreAbierto = sobreAbierto===fam.id ? null : fam.id; pintar(); };
      fila.appendChild(b);
    }
    c.appendChild(fila);

    if(sobreAbierto){
      const cont = cat.contenidoDe?.(sobreAbierto) ?? { familia:[], staples:[], premium:[] };
      const fam = (H.familias ?? []).find(f => f.id === sobreAbierto);
      c.appendChild(el("p","rSub", T(fam?.desc ?? "")));
      /* ══ UN SOLO VISOR, Y SIEMPRE VISIBLE ══
         Esto llamaba a `conPanel` una vez POR SECCIÓN, o sea que creaba
         tres paneles de carta. Y `panel` es una sola variable del módulo:
         se quedaba apuntando al ÚLTIMO, así que de los tres visores solo
         funcionaba el de abajo del todo, el de Premium. E lo describió
         exactamente así. Ahora se monta UNA columna con el visor y las
         tres listas van dentro de la otra, sea cual sea el número de
         listas; y el visor va pegado arriba (`sticky`) para que siga a
         la vista mientras bajas por la rejilla, igual que el del duelo. */
      const listas = el("div","rListas");
      const seccion = (titulo, lista, nota, tope = 60) => {
        if(!lista.length) return;
        listas.appendChild(el("label","mlab", `${T(titulo)} · ${lista.length}`));
        if(nota) listas.appendChild(el("p","rSub", T(nota)));
        listas.appendChild(rejillaCartas(lista.slice(0, tope), null, null, false));
        if(lista.length > tope)
          listas.appendChild(el("p","rSub", `${T("y")} ${lista.length-tope} ${T("más")}`));
      };
      seccion("Cartas de la familia", cont.familia,
              "Las dos casillas temáticas del sobre salen de aquí.");
      seccion("Puede caer por rareza", cont.staples,
              "Las dos primeras casillas de CUALQUIER sobre tiran de las listas de rareza.");
      seccion("Premium", cont.premium,
              "La décima casilla: fusiones y cartas de remate.");
      c.appendChild(conPanel(listas));
    }
    /* OJO: aquí NO va `volverAlMapa(true)`. Ese respaldo llama a
       `saltarNodo()`, y esta pantalla se abre desde la barra de arriba
       estando dentro de un nodo: mirar la guía te habría resuelto el
       nodo sin jugarlo. */
    c.appendChild(volverAlMapa(false));
    return c;
  }
  const nombreFamilia = id =>
    T((H.familias ?? []).find(f => f.id === id)?.nombre ?? id);

  /* ══════════════════════════════════════════════════════════════════
     EL HISTORIAL DEL DUELISTA

     Lo que llevas hecho en todas las partidas, no en esta. Sale del
     mismo `meta` que la maestría, así que viaja en el archivo de
     Exportar progreso sin tocar nada de eso.
     ══════════════════════════════════════════════════════════════════ */
  function vistaRecord(){
    const c = el("div","rRecord");
    c.appendChild(el("h2",null, T("Historial del duelista")));
    const r = H.record?.() ?? null;
    if(!r){
      c.appendChild(el("p","rSub", T("Todavía no hay nada que contar.")));
      c.appendChild(volverAlInicio());
      return c;
    }
    const comp = H.completado?.() ?? { pct:0, hechos:0, total:0, metas:[] };

    /* La barra de completado, arriba: es el número que la gente mira. */
    const barra = el("div","rComplet");
    const relleno = el("div","rCompletBarra");
    relleno.appendChild(el("div","rCompletLleno"));
    relleno.children[0].style.width = comp.pct + "%";
    barra.appendChild(el("div","rCompletTxt",
      `${comp.pct}% · ${comp.hechos} ${T("de")} ${comp.total}`));
    barra.appendChild(relleno);
    c.appendChild(barra);

    const tabla = (titulo, filas) => {
      c.appendChild(el("label","mlab", T(titulo)));
      const t = el("div","rTabla");
      for(const [k, v2] of filas){
        const f = el("div","rTablaFila");
        f.appendChild(el("span","rTablaK", T(k)));
        f.appendChild(el("span","rTablaV", String(v2)));
        t.appendChild(f);
      }
      c.appendChild(t);
    };
    const pct = (a, b) => b ? Math.round(a*100/b) + "%" : "—";

    tabla("Aventuras", [
      ["Empezadas", r.runs], ["Completadas", r.completadas],
      ["Perdidas", r.perdidas], ["Abandonadas", r.rendidas],
      ["Porcentaje de torneos ganados", pct(r.completadas, r.runs)],
    ]);
    tabla("Duelos", [
      ["Jugados", r.duelos], ["Ganados", r.victorias], ["Perdidos", r.derrotas],
      ["Porcentaje de victorias", pct(r.victorias, r.duelos)],
      ["Star Chips ganadas", r.chips],
      ["Sobres abiertos", r.sobres], ["Encuentros resueltos", r.encuentros],
    ]);
    tabla("Cartas jugadas", [
      ["Total", r.cartas.total], ["Monstruos", r.cartas.monstruo],
      ["Mágicas", r.cartas.magica], ["Trampas", r.cartas.trampa],
    ]);

    /* Por personaje: la tabla que de verdad cuenta una historia. */
    c.appendChild(el("label","mlab", T("Por duelista")));
    const porQ = el("div","rTabla");
    for(const j of (datos.jugables ?? [])){
      const p = r.porPersonaje?.[j.id] ?? { runs:0, victorias:0, duelos:0, ganados:0 };
      const m = H.maestriaDe?.(j.id)?.nivel ?? 0;
      const f = el("div","rTablaFila");
      f.appendChild(el("span","rTablaK", j.nombre));
      f.appendChild(el("span","rTablaV",
        `${p.victorias}/${p.runs} ${T("torneos")} · ${pct(p.ganados, p.duelos)} ${T("en duelos")}`
        + ` · ${T("maestría")} ${m}`));
      porQ.appendChild(f);
    }
    c.appendChild(porQ);

    /* Los clears por ventaja: dice si has probado las tres formas. */
    const pasivos = Object.entries(r.clearsPorPasivo ?? {});
    if(pasivos.length){
      c.appendChild(el("label","mlab", T("Torneos ganados con cada ventaja")));
      const t = el("div","rTabla");
      for(const [id, n2] of pasivos){
        const f = el("div","rTablaFila");
        f.appendChild(el("span","rTablaK", T(id)));
        f.appendChild(el("span","rTablaV", String(n2)));
        t.appendChild(f);
      }
      c.appendChild(t);
    }

    /* Los logros. */
    c.appendChild(el("label","mlab", T("Logros")));
    const rejL = el("div","rLogros");
    for(const l of (H.logros ?? [])){
      const hecho = !!r.logros?.[l.id];
      const b = el("div","rLogro" + (hecho ? " hecho" : ""));
      b.appendChild(el("b",null, T(l.nombre)));
      b.appendChild(el("span",null, T(l.desc)));
      rejL.appendChild(b);
    }
    c.appendChild(rejL);

    c.appendChild(volverAlInicio());
    return c;
  }
  function volverAlInicio(){
    const b = el("button","rBtn", T("Volver"));
    b.onclick = () => { vista = H.run ? "mapa" : "inicio"; pintar(); };
    return b;
  }

  function vistaFin(est){
    const c = el("div","rFin");
    c.appendChild(botonPantalla());
    /* Ganar el torneo es EL momento del modo: el banner otra vez, y la
       ilustración de Pegasus si la hay. */
    const art = est.ganada ? (ilustracion("banner","rBanner") ) : null;
    if(art){ const m = el("div","rBannerMarco fin"); m.appendChild(art); c.appendChild(m); }
    else { const p = ilustracion("pegasus","rArtePegasus"); if(p && !est.ganada) c.appendChild(p); }
    c.appendChild(el("h2",null, T(est.ganada ? "¡Has ganado el torneo!" : "Se acabó la aventura")));
    c.appendChild(el("p","rSub",
      `${T("Duelos jugados")}: ${est.duelosJugados} · ${T("Star Chips")}: ${est.chips}`));
    const b = el("button","mbig", T("Otra partida"));
    b.onclick = () => { H.abandonar(); vista = "inicio"; pintar(); };
    c.appendChild(b);
    return c;
  }

  /* ── piezas ── */
  /* ══ EL PANEL DE LA CARTA ══
     En el duelo, pasar el ratón por una carta enseña su texto a la
     izquierda. Fuera del duelo no había nada: elegías recompensas sin
     saber qué hacían. Ahora todas las pantallas de cartas del Reino
     tienen el mismo panel. */
  /* ══ CON EL DEDO NO SE PUEDE "PASAR EL RATÓN" ══
     E lo probó en el móvil: "la info de las cartas es pequeña, no se
     puede scrollear ni nada" y "muchas funcionalidades dicen hover
     para... pero en móvil no se puede". Era literal — el panel solo se
     llenaba con `onmouseenter`, así que al tocar una recompensa la
     elegías A CIEGAS, sin haber podido leerla nunca.

     Con puntero grueso el panel deja de ser una columna y pasa a ser una
     hoja que sube desde abajo, con su texto a tamaño legible, scroll, y
     un botón grande de confirmar. El primer toque LEE, el segundo (en el
     botón) ELIGE. Con ratón no cambia nada: sigue enseñándose al pasar y
     el clic elige a la primera. */
  const TACTIL = () => {
    try{ return !!globalThis.matchMedia?.("(pointer:coarse)")?.matches; }
    catch(e){ return false; }
  };

  let panel = null;
  /* `suelto` = no ocupa sitio hasta que se abre. Es el que usa el mapa
     para que el rastreador de mazo también se pueda leer con el dedo:
     ahí no hay rejilla de cartas donde colgar una columna fija. */
  function panelCarta(extra){
    panel = el("aside","rPanel"+(extra ? " "+extra : ""));
    panel.appendChild(el("div","rPanelVacio",
      T(TACTIL() ? "Toca una carta para leerla"
                 : "Pasa el ratón por una carta para ver su texto")));
    return panel;
  }
  function cerrarPanel(){
    if(!panel) return;
    panel.classList.remove("abierto");
    panel.innerHTML = "";
    panel.appendChild(el("div","rPanelVacio",
      T(TACTIL() ? "Toca una carta para leerla"
                 : "Pasa el ratón por una carta para ver su texto")));
  }
  function mostrarCarta(code, alElegir, etiquetaAccion){
    if(!panel) return;
    panel.innerHTML = "";
    panel.classList.add("abierto");
    /* ══ COGER Y CERRAR NO PUEDEN COMPARTIR ESQUINA ══
       El botón de acción era `sticky` a lo ancho con z-index, y el de
       cerrar `absolute` en la esquina de arriba a la derecha: el primero
       se pintaba ENCIMA del segundo. E lo contó exacto: «si quieres leer
       una carta pero no cogerla, es confuso dónde está cerrar, y a veces
       le doy a coger sin querer».

       Y había un segundo problema escondido detrás: un elemento
       `absolute` dentro de un panel con scroll se va con el contenido,
       así que al bajar a leer el efecto la ✕ desaparecía y no quedaba
       salida. Ahora los dos van en la MISMA barra, pegada arriba: se
       reparten el ancho, no se pisan, y ninguno se pierde al bajar.

       La acción va arriba a propósito: debajo del texto del efecto queda
       fuera de la pantalla en un teléfono. */
    const barra = el("div","rPanelBarra");
    if(alElegir){
      const b = el("button","rPanelElegir", T(etiquetaAccion ?? "Elegir esta carta"));
      b.onclick = e => { e.stopPropagation?.(); alElegir(code); };
      barra.appendChild(b);
    }
    const cerrar = el("button","rPanelCerrar","✕");
    cerrar.setAttribute("aria-label", T("Cerrar"));
    cerrar.title = T("Cerrar");
    cerrar.onclick = e => { e.stopPropagation?.(); cerrarPanel(); };
    barra.appendChild(cerrar);
    panel.appendChild(barra);
    const cuerpo = el("div","rPanelCuerpo");
    const img = document.createElement("img");
    img.className = "rPanelImg"; img.src = imagenCarta(code, "cards");
    img.alt = cat.nombre(code);
    cuerpo.appendChild(img);
    const ficha = el("div","rPanelFicha");
    ficha.appendChild(el("div","rPanelNom", cat.nombre(code)));
    /* ══ LA FICHA COMPLETA, NO SOLO EL NOMBRE ══
       Antes salían el arte y el nombre y poco más: para decidir si una
       carta entra al mazo hace falta saber el tipo, el atributo, el
       nivel, el ATK/DEF y el efecto ENTERO. Todo eso lo tiene la base;
       solo había que pedirlo. */
    const d = cat.datos?.(code) ?? {};
    const meta = el("div","rPanelMeta");
    if(cat.esMonstruo(code)){
      const attr = ATRIBUTO[Number(d.attribute)] ?? "";
      meta.textContent = [T(cat.categoria(code)), attr && T(attr),
                          `${T("Nivel")} ${cat.nivel(code)}`].filter(Boolean).join(" · ");
    } else meta.textContent = T(cat.categoria(code));
    ficha.appendChild(meta);
    if(cat.esMonstruo(code)){
      const st = el("div","rPanelStats");
      st.appendChild(el("span",null, `ATK ${d.attack ?? "?"}`));
      st.appendChild(el("span",null, `DEF ${d.defense ?? "?"}`));
      ficha.appendChild(st);
    }
    ficha.appendChild(el("div","rPanelRareza r"+cat.rareza(code), cat.rareza(code)));
    /* Cuántas llevas y cuántas te dejan: es la mitad de la decisión. */
    const enMazo = (H.run?.mazo?.main ?? []).filter(x => x === code).length
                 + (H.run?.mazo?.extra ?? []).filter(x => x === code).length;
    const enBinder = (H.run?.binder ?? []).filter(x => x === code).length
                   + (H.run?.binderExtra ?? []).filter(x => x === code).length;
    if(enMazo || enBinder)
      ficha.appendChild(el("div","rPanelCuenta",
        `${T("En el mazo")}: ${enMazo}  ·  ${T("En el binder")}: ${enBinder}  ·  ${T("Máximo")} ${cat.tope(code)}`));
    /* ══ EL EFECTO VA DENTRO DE LA COLUMNA DE INFORMACIÓN ══
       Estaba colgado del `.rPanelCuerpo`, que es un flex de fila: o sea
       que el texto se convertía en una TERCERA COLUMNA estrechísima y
       caía en tiras de dos palabras, encima solapando el nombre. Es lo
       que se ve en la captura de E. Dentro de la ficha ocupa todo el
       ancho que sobra a la derecha del arte, que en horizontal es
       muchísimo. */
    const texto = cat.texto?.(code);
    if(texto) ficha.appendChild(el("p","rPanelTexto", texto));
    cuerpo.appendChild(ficha);
    panel.appendChild(cuerpo);
  }

  /* Un botón de carta, con el mismo comportamiento en las seis pantallas:
     ratón → lee al pasar y elige al clicar; dedo → lee al tocar y elige
     desde el panel. Sin esto había que repetir la regla en cada sitio y
     ya se olvidó una vez. */
  function enlazarCarta(b, code, alPulsar, etiqueta){
    b.onmouseenter = () => { if(!TACTIL()) mostrarCarta(code, null); };
    b.onfocus      = () => { if(!TACTIL()) mostrarCarta(code, null); };
    if(!alPulsar){ b.onclick = () => mostrarCarta(code, null); return; }
    b.onclick = () => {
      if(TACTIL()){ mostrarCarta(code, alPulsar, etiqueta); return; }
      alPulsar(code);
    };
  }

  function imagen(code){
    const i = document.createElement("img");
    i.className = "rImg";
    i.loading = "lazy";
    i.src = imagenCarta ? imagenCarta(code) : "";
    i.alt = cat.nombre(code);
    return i;
  }
  function rejillaCartas(codes, metas, alPulsar, grande, marcada){
    const rej = el("div","rCartas"+(grande?" grandes":""));
    (codes ?? []).forEach((code,i) => {
      /* La marca se pone AL CREAR el botón, no buscándolo después con
         querySelectorAll: tras un repintado la elección tiene que verse
         sola, sin depender de que alguien vuelva a recorrer el DOM. */
      const b = el("button","rCarta"+(metas?.[i] ? " r"+metas[i].rareza : "")
                            + (marcada != null && code === marcada ? " on" : ""));
      b.appendChild(imagen(code));
      b.appendChild(el("span","rNom", cat.nombre(code)));
      /* Leer la carta NUNCA está deshabilitado, ni siquiera en la lista de
         lo que te cobra el mercader: antes esas cartas iban con
         `disabled` y en móvil no había forma de saber qué se llevaba. */
      enlazarCarta(b, code, alPulsar);
      rej.appendChild(b);
    });
    return rej;
  }
  /* Una pantalla de cartas = panel a la izquierda + rejilla a la derecha. */
  function conPanel(contenido){
    const fila = el("div","rConPanel");
    fila.appendChild(panelCarta());
    const der = el("div","rConPanelDer");
    for(const n of [].concat(contenido)) der.appendChild(n);
    fila.appendChild(der);
    return fila;
  }
  /* ══ DOS BOTONES DISTINTOS QUE PARECÍAN UNO ══
     "Volver al mapa" es echarse atrás: el nodo sigue pendiente y puedes
     entrar otra vez. "Seguir sin usarlo" es DECIDIR no usar la utilidad:
     eso sí resuelve el nodo y te deja avanzar. Antes los dos hacían lo
     mismo —cambiar de vista— y por eso un campamento que ya no servía te
     dejaba encerrado dando vueltas. */
  /* La etiqueta se puede afinar por pantalla: «Seguir sin usarlo» en un
     nodo de sobres no quiere decir nada —lo que decides es no abrir
     ninguno— y E lo señaló como un botón sin sentido. */
  function volverAlMapa(sinResolver, etiqueta){
    const b = el("button","mvolver",
      T(etiqueta ?? (sinResolver ? "Seguir sin usarlo" : "← Volver al mapa")));
    b.onclick = () => {
      if(sinResolver){
        const r = H.saltarNodo?.();
        if(r && !r.ok) aviso = r.motivo;
      }
      vista = "mapa"; carga = null; pintar();
    };
    return b;
  }

  /* Las vistas que se montan sobre `carga` con un tipo inventado. */
  const original = vistaNodo;
  vistaNodo = function(est){
    const c = el("div","rNodoVista");
    if(carga?.tipo === "EVENTO_RESULTADO") return nodoEventoResultado(c);
    if(carga?.tipo === "PACK_ABIERTO")     return nodoPackAbierto(c);
    if(carga?.tipo === "RESULTADO")        return nodoResultado(c);
    if(carga?.tipo === "MERCADER_OFERTA")  return nodoOferta(c);
    if(carga?.tipo === "CAMPAMENTO_SACRIFICIO") return nodoSacrificio(c);
    if(carga?.tipo === "CAMPAMENTO_OFERTA")     return nodoRefinado(c);
    return original(est);
  };
  /* Refinar, paso 1: qué carta sacrificas. */
  function nodoSacrificio(c){
    c.appendChild(el("h2",null, T("Elige qué sacrificas")));
    c.appendChild(conPanel(rejillaCartas(H.run.binder, null, code => {
      const res = H.acampar("refinar", { carta:code });
      if(!res.ok){ aviso = res.motivo; vista = "mapa"; carga = null; pintar(); return; }
      carga = { ...carga, tipo:"CAMPAMENTO_OFERTA", opciones:res.opciones };
      pintar();
    }, true)));
    c.appendChild(volverAlMapa(true));
    return c;
  }
  /* Refinar, paso 2: cuál de las tres te llevas. */
  function nodoRefinado(c){
    c.appendChild(el("h2",null, T("Elige tu recompensa")));
    c.appendChild(conPanel(rejillaCartas(carga.opciones, null, code => {
      H.cogerPremio(code);
      vista = "mapa"; carga = null; pintar();
    }, true)));
    return c;
  }

  function nodoOferta(c){
    c.appendChild(el("h2",null, T("El cambio")));
    /* Lo que PAGAS, con las cartas a la vista y su nombre. */
    c.appendChild(el("p","rSub",
      `${T("Le das")} ${carga.precio.length} ${T("cartas")}:`));
    const pago = rejillaCartas(carga.precio, null, null);
    pago.classList.add("rPrecio");
    c.appendChild(pago);
    c.appendChild(el("p","rSub", T("Y eliges una de estas:")));
    c.appendChild(conPanel(rejillaCartas(carga.oferta, null, code => {
      const res = H.comerciar(carga.receta.id, code);
      /* Decir CUÁNTAS cartas se ha llevado: se cobran solas, las más
         baratas primero, y sin decirlo parece que te ha robado. */
      aviso = res.ok ? `${T("Cambio hecho")} · ${T("Se te ha cobrado")} ${res.pagadas} ${T("cartas")}`
                     : res.motivo;
      vista = "mapa"; carga = null; pintar();
    }, true)));
    /* ══ VER EL CAMBIO NO PUEDE SER UN COMPROMISO ══
       Se enseña el precio ANTES de cobrar, que era el arreglo anterior,
       pero desde aquí solo se podía aceptar o irse del mercader: si la
       oferta no convencía no había forma de mirar otra receta. Y el
       mercader es de un solo uso, así que salir al mapa y volver a
       entrar tampoco vale. Lo reportó E. */
    c.appendChild(botonVolverAlMercader());
    c.appendChild(volverAlMapa(true));
    return c;
  }

  /* Vuelve a la lista de recetas sin gastar el nodo: `carga` conserva
     `recetas` desde que se entró, así que basta con quitarle la oferta. */
  function botonVolverAlMercader(){
    const b = el("button","rBtn", "← " + T("Ver otro cambio"));
    b.onclick = () => {
      carga = { ...carga, tipo:"MERCADER", receta:null, oferta:null, precio:null };
      pintar();
    };
    return b;
  }

  /* ══ GANCHO DE PRUEBA ══
     Sin navegador, la única forma de comprobar la PANTALLA del Reino es
     montarla y leerla. Recorrerla a base de pulsar botones no vale: en
     cuanto un nodo es un duelo, la pantalla se va al tablero y el
     recorrido se queda mudo (así se me quedó en 1 paso el primer intento
     de `check-actos`). Con esto se mueve la run por su API y se vuelve a
     pintar el mapa, que es lo que se quiere mirar.
     Mismo patrón que `__PREGUNTA_DE_PRUEBA__` en el duelo. */
  globalThis.__REINO_PRUEBA__ = {
    H, pintar,
    alMapa(){ vista = "mapa"; carga = null; pintar(); },
    /* Lo mismo que hace el botón de un nodo del mapa: hace falta para
       llegar a las pantallas de sobre/mercader/evento sin adivinar qué
       nodo toca pulsar. */
    entrar(id){ carga = H.entrar(id); vista = "nodo"; pintar(); return carga; },
    /* Monta la pantalla de un encuentro concreto sin tener que dar con
       el nodo que lo lleva: es la única forma de probar las dieciséis
       opciones de los ocho eventos sin jugar ocho runs. */
    mostrarEvento(ev){ carga = { tipo:"EVENTO", evento:ev }; vista = "nodo"; pintar(); },
    abrirPack(fam){ carga = { tipo:"PACK_ABIERTO", cartas:H.abrirPack(fam) };
                    vista = "nodo"; pintar(); return carga; },
    /* Abre una pantalla suelta por su nombre. Sin esto no había forma de
       mirar la guía de sobres, el historial ni Mazo y binder desde una
       comprobación, y son justo las pantallas más nuevas: las tres
       llegaron con textos sin traducir que nadie vio. */
    irA(v){ vista = v; carga = null; pintar(); return vista; },
    get vista(){ return vista; },
  };

  return { pintar, mostrarResultado,
           irAlMapa(){ vista = "mapa"; carga = null; pintar(); },
           get vista(){ return vista; } };
}
