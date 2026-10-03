/* ══════════════════════════════════════════════════════════════════
   MAESTRÍA Y ORDEN DEL MAZO

   El meta-progreso es la única parte del modo historia que sobrevive a
   la run, así que un fallo aquí no se ve hasta la segunda vuelta y para
   entonces ya has perdido lo desbloqueado. Se comprueba el ciclo entero
   —incluido lo que NO debe pasar: que recargar suba el nivel otra vez y
   que la pantalla pueda colar un pasivo sin desbloquear—.

   Uso:  node check-maestria.mjs
   ══════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";
import { crearCatalogo } from "./src/story/catalogo.js";
import { crearHistoria } from "./src/story/historia.js";
import { crearAlmacen } from "./src/story/estado.js";
const D="../data/", leer=f=>JSON.parse(readFileSync(D+f,"utf-8"));
const cat=crearCatalogo({pools:leer("story/cards.json"),db:leer("pool_cards.json"),
  limites:leer("goat-limites.json"),pool:leer("goat-pool.json"),nombres:leer("pool_texts.json")});
const DATOS=leer("story/personajes.json"), DECKS=leer("story/decks.json");
/* Un localStorage de mentira que SOBREVIVE entre "recargas". */
const disco = new Map();
const store = { getItem:k=>disco.get(k)??null, setItem:(k,v)=>disco.set(k,v), removeItem:k=>disco.delete(k) };
const nuevaSesion = () => crearHistoria({ datos:DATOS, decks:DECKS, eventos:leer("story/eventos.json"),
  cat, almacen:crearAlmacen(store), mazosDelSimulador:leer("mazos.json") });

let fallos=0; const ok=t=>console.log("  ✓ "+t); const mal=(t,d="")=>{fallos++;console.log("  ✗ "+t+(d?"   "+d:""));};
console.log("\n═══ MAESTRÍA ═══\n");

const ganarRun = (H, quien, opts={}) => {
  H.empezar({ semilla:"M-"+quien+Math.random(), personaje:quien, ...opts });
  for(let i=0;i<60;i++){
    const ops=H.opciones(); if(!ops.length) break;
    const n=ops[0], c=H.entrar(n.id);
    if(["DUELO","ELITE","JEFE"].includes(c.tipo)){
      const r=H.resolverDuelo({ganado:true,rivalId:c.rival?.id,elite:c.tipo==="ELITE"});
      if(r.premio?.length) H.cogerPremio(r.premio[0].code);
      if(r.terminada) break;
    }
    else if(c.tipo==="PREPARACION"){ H.elegirPreparacion("PACK"); H.abrirPack("ARCANE"); }
    else if(c.tipo==="PACK") H.abrirPack("ARCANE");
    else if(c.tipo==="CAMPAMENTO"){ if(!H.acampar("lp")?.ok) H.saltarNodo(); }
    else if(c.tipo==="EVENTO") H.elegirEnEvento(c.evento.opciones[0]);
    else H.saltarNodo();
  }
  return H.estado();
};

/* 1 · empieza a 0 */
let H = nuevaSesion();
if(H.maestriaDe("yugi").nivel !== 0) mal("todo personaje empieza a maestría 0");
else ok("todo personaje empieza a maestría 0");

/* 2 · ganar sube a 1 */
const est = ganarRun(H, "yugi");
if(!est.ganada) mal("la run de prueba se gana");
else if(H.maestriaDe("yugi").nivel !== 1) mal("ganar sube la maestría a 1", `es ${H.maestriaDe("yugi").nivel}`);
else ok("ganarle a Pegasus sube la maestría a 1");

/* 3 · persiste tras "recargar" */
H = nuevaSesion();
if(H.maestriaDe("yugi").nivel !== 1) mal("la maestría sobrevive a recargar");
else ok("la maestría sobrevive a recargar el navegador");

/* 4 · NO sube dos veces por la misma run */
const antes = H.maestriaDe("yugi").nivel;
H.continuar();                       // vuelve a cargar la run ya ganada
const nodo = H.nodoActual();
if(H.maestriaDe("yugi").nivel !== antes) mal("recargar una run ya contada NO vuelve a subir la maestría");
else ok("recargar una run ya contada no vuelve a subir la maestría");

/* 5 · cada personaje va por su cuenta */
if(H.maestriaDe("joey").nivel !== 0) mal("la maestría es independiente por personaje");
else ok("la maestría de cada personaje es independiente");

/* 6 · con maestría 1 hay pasivo, y la carta elegida entra al mazo */
const m = H.maestriaDe("yugi");
if(!m.pasivos.length) mal("con maestría 1 hay un pasivo desbloqueado");
else if(m.cartas.length !== 10) mal("hay diez cartas de maestro", `${m.cartas.length}`);
else {
  H.empezar({ semilla:"M-CARTA", personaje:"yugi",
              pasivo:"carta-de-maestro", cartaDeMaestro:m.cartas[3] });
  const dentro = H.run.mazo.main.filter(x=>x===m.cartas[3]).length;
  if(!dentro) mal("la carta elegida entra al mazo");
  else ok(`la carta del maestro entra al mazo (${cat.nombre(m.cartas[3])}, mazo de ${H.run.mazo.main.length})`);
}

/* 7 · no se puede colar un pasivo sin desbloquear ni una carta de fuera */
H.empezar({ semilla:"M-TRAMPA", personaje:"joey", pasivo:"mano-firme", cartaDeMaestro:46986414 });
if(H.run.pasivo) mal("un pasivo sin desbloquear no se aplica", H.run.pasivo);
else ok("un pasivo sin desbloquear no se aplica aunque la pantalla lo pida");

/* 8 · el orden del mazo */
H.empezar({ semilla:"M-ORDEN", personaje:"mai" });
const main = H.run.mazo.main;
const catg = c => cat.categoria(c);
const idx = { MONSTRUO:0, MAGICA:1, TRAMPA:2 };
let ordenado = true;
for(let i=1;i<main.length;i++){
  const a=idx[catg(main[i-1])], b=idx[catg(main[i])];
  if(a>b || (a===b && cat.nombre(main[i-1]).localeCompare(cat.nombre(main[i]))>0)) ordenado=false;
}
if(!ordenado) mal("el mazo sale ordenado por tipo y nombre");
else ok(`el mazo sale ordenado: monstruos, mágicas, trampas y alfabético (${main.length} cartas)`);

/* ══════════════════════════════════════════════════════════════════
   LOS CINCO PERSONAJES Y SUS TRES VENTAJAS

   Probar solo a Yugi no vale: cada personaje tiene sus propias diez
   cartas y su propia maestría, y un fallo de datos en uno de los cinco
   no se ve hasta que alguien lo juega.
   ══════════════════════════════════════════════════════════════════ */
{
  const QUIENES = ["yugi","joey","mai","keith","kaiba"];
  const DATOS = leer("story/personajes.json");
  for(const quien of QUIENES){
    disco.clear();
    const H = nuevaSesion();
    /* Se le da maestría 3 a mano en el meta, que es lo que pasaría
       después de tres vueltas. */
    H.importar(JSON.stringify({ esquema:1, meta:{ maestria:{ [quien]:3 } } }));
    const m = H.maestriaDe(quien);
    if(m.nivel !== 3){ mal(`${quien}: la maestría importada se aplica`, `es ${m.nivel}`); continue; }
    if(m.pasivos.length !== 3){ mal(`${quien}: con maestría 3 hay tres ventajas`, `hay ${m.pasivos.length}`); continue; }
    if(m.cartas.length !== 10){ mal(`${quien}: diez cartas de maestro`, `hay ${m.cartas.length}`); continue; }

    /* 1 · LA CARTA DEL MAESTRO entra al mazo y sobrevive a recargar. */
    H.empezar({ semilla:"MX-"+quien, personaje:quien,
                pasivo:"carta-de-maestro", cartaDeMaestro:m.cartas[2] });
    const dentro = H.run.mazo.main.filter(x=>x===m.cartas[2]).length;
    const total  = H.run.mazo.main.length;
    if(!dentro){ mal(`${quien}: la carta del maestro entra al mazo`); continue; }
    const H2 = nuevaSesion(); H2.continuar();
    if(H2.run.mazo.main.filter(x=>x===m.cartas[2]).length !== dentro){
      mal(`${quien}: la carta del maestro sobrevive a recargar`); continue; }

    /* 2 · CONTACTOS: el sobre se abre de verdad y llena el binder. */
    H.empezar({ semilla:"MX2-"+quien, personaje:quien,
                pasivo:"primer-sobre", familiaDeSobre:"ARCANE" });
    const enBinder = H.run.binder.length + (H.run.binderExtra?.length ?? 0);
    if(enBinder < 10){ mal(`${quien}: el sobre de contactos se abre al empezar`,
      `${enBinder} cartas en el binder`); continue; }

    /* 3 · MANO FIRME: las recompensas suben de rareza. Se compara CON y
       SIN el pasivo usando la MISMA semilla; si no cambia nada, el
       pasivo no está haciendo su trabajo. */
    const rarezasDe = (pasivo, k) => {
      const G = nuevaSesion();
      G.empezar({ semilla:`MX3-${quien}-${k}`, personaje:quien, pasivo });
      const out = [];
      for(let i=0;i<25;i++){
        const ops = G.opciones(); if(!ops.length) break;
        const n = ops[0], c = G.entrar(n.id);
        if(["DUELO","ELITE","JEFE"].includes(c.tipo)){
          const r = G.resolverDuelo({ ganado:true, rivalId:c.rival?.id, elite:c.tipo==="ELITE" });
          for(const p of (r.premio ?? [])) out.push(p.rareza);
          if(r.premio?.length) G.cogerPremio(r.premio[0].code);
        }
        else if(c.tipo==="PREPARACION"){ G.elegirPreparacion("PACK"); G.abrirPack("ARCANE"); }
        else if(c.tipo==="PACK") G.abrirPack("ARCANE");
        else if(c.tipo==="CAMPAMENTO"){ if(!G.acampar("lp")?.ok) G.saltarNodo(); }
        else if(c.tipo==="EVENTO") G.elegirEnEvento(c.evento.opciones[0]);
        else G.saltarNodo();
      }
      const VAL = { C:0, R:1, SR:2, UR:3 };
      return out.reduce((s,r)=>s+(VAL[r]??0), 0);
    };
    /* Sobre TRES semillas: mano firme sube pesos de rareza, no garantiza
       cartas, así que una sola tirada puede empatar por azar. */
    let sinPasivo = 0, conFirme = 0;
    for(const k of [1,2,3]){
      sinPasivo += rarezasDe(null, k);
      conFirme  += rarezasDe("mano-firme", k);
    }
    if(!(conFirme > sinPasivo)){
      mal(`${quien}: «mano firme» sube la rareza de las recompensas`,
          `sin ${sinPasivo}, con ${conFirme} (tres semillas)`); continue; }

    ok(`${quien}: las tres ventajas funcionan (mazo ${total}, binder ${enBinder}, rareza ${sinPasivo}→${conFirme})`);
  }

  /* Solo UNA ventaja por run, aunque tengas las tres. */
  disco.clear();
  const H = nuevaSesion();
  H.importar(JSON.stringify({ esquema:1, meta:{ maestria:{ yugi:3 } } }));
  H.empezar({ semilla:"MX-UNA", personaje:"yugi", pasivo:"primer-sobre",
              cartaDeMaestro: H.maestriaDe("yugi").cartas[0], familiaDeSobre:"ARCANE" });
  const mazo = H.run.mazo.main.length;
  if(mazo !== 40) mal("solo se aplica UNA ventaja por run",
    `el mazo tiene ${mazo}: se aplicaron dos`);
  else ok("solo se aplica una ventaja por run, aunque tengas las tres");
}

/* ══════════════════════════════════════════════════════════════════
   EXPORTAR E IMPORTAR

   Sin servidor ni cuenta, un archivo es la ÚNICA forma de llevarse el
   progreso a otro navegador. Y por eso importar tiene que ser seguro:
   si el archivo está roto, lo que no puede pasar es quedarse sin lo que
   ya había.
   ══════════════════════════════════════════════════════════════════ */
{
  disco.clear();
  const H = nuevaSesion();
  ganarRun(H, "kaiba");                       // maestría 1 con Kaiba
  H.empezar({ semilla:"EXP", personaje:"joey" });   // y una run a medias
  const texto = H.exportar();
  if(!texto){ mal("exportar devuelve algo"); }
  else {
    const d = JSON.parse(texto);
    if(d.meta?.maestria?.kaiba !== 1) mal("el archivo lleva la maestría", JSON.stringify(d.meta));
    else if(!d.run?.semilla) mal("el archivo lleva la partida a medias");
    else ok(`el archivo lleva la maestría (kaiba ${d.meta.maestria.kaiba}) y la partida (${d.run.semilla})`);

    /* Se borra TODO, como si fuera otro navegador. */
    disco.clear();
    const H2 = nuevaSesion();
    if(H2.maestriaDe("kaiba").nivel !== 0) mal("el navegador nuevo empieza vacío");
    const r = H2.importar(texto);
    if(!r.ok) mal("importar el archivo funciona", r.error);
    else if(H2.maestriaDe("kaiba").nivel !== 1) mal("la maestría vuelve tras importar");
    else if(!H2.continuar()) mal("la partida a medias vuelve tras importar");
    else ok("borrar todo e importar devuelve la maestría Y la partida a medias");

    /* Un archivo roto NO puede destruir lo que ya tienes. */
    const antes = H2.maestriaDe("kaiba").nivel;
    for(const basura of ["{no es json", "{}", '{"esquema":99}',
                         '{"esquema":1,"meta":{"maestria":{"yugi":"muchos"}}}',
                         '{"esquema":1,"run":{"esquema":1}}']){
      const rr = H2.importar(basura);
      if(rr.ok) { mal("un archivo inválido se rechaza", basura.slice(0,30)); break; }
    }
    if(H2.maestriaDe("kaiba").nivel !== antes)
      mal("un archivo inválido NO toca lo que ya tenías", `era ${antes}, ahora ${H2.maestriaDe("kaiba").nivel}`);
    else ok("cinco archivos inválidos rechazados sin tocar el progreso que ya había");
  }
}

console.log(`\n${fallos ? "FALLA: "+fallos : "Todo correcto"}`);
process.exit(fallos?1:0);
