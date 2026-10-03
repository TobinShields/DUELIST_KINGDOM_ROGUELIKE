/* ══════════════════════════════════════════════════════════════════
   EL MAPA RAMIFICA DE VERDAD

   Antes cada columna conectaba con TODA la siguiente: elegir ruta no
   costaba nada, porque desde cualquier nodo llegabas a cualquier otro.
   Ahora cada nodo lleva sus `salidas` escritas, y de ahí sale el coste
   de oportunidad: si vas al Elite, el Camp de al lado deja de estar a tu
   alcance porque no hay camino, no porque el juego te lo prohíba.

   Esto comprueba las dos mitades del asunto:
     · que el mapa TENGA forma (columnas de 1, 2 y 3, ramas que se
       separan y vuelven a juntarse, rutas de verdad);
     · y que siga siendo jugable SIEMPRE (diez fichas alcanzables por
       CUALQUIER ruta elegible, cronología, sin bloqueos).

   Lo segundo es lo que hace que lo primero se pueda tocar sin miedo: un
   generador "interesante" que produce una run muerta cada mil semillas
   es peor que uno aburrido.

   Uso:  node check-mapa.mjs [semillas]     (por defecto 3000)
   ══════════════════════════════════════════════════════════════════ */
import { generarMapa, siguientes, nodoPorId, chipsMaximos,
         chipsPeorRuta, formaDelActo, revisarActo } from "./src/story/mapa.js";
import { crearRng, estadoDeSemilla } from "./src/story/rng.js";
import { CHIPS, REGLAS_MAPA } from "./src/story/balance.js";

const N = Number(process.argv[2] ?? 3000);
let fallos = 0;
const ok  = t => console.log("  ✓ " + t);
const mal = (t,d="") => { fallos++; console.log("  ✗ " + t + (d ? "   " + d : "")); };
console.log(`\n═══ RAMIFICACIÓN DEL MAPA · ${N} semillas ═══\n`);

const acc = { c1:0, c2:0, c3:0, cols:0, rutas:0, actos:0, aristas:0,
              convergencias:0, salidas:0, nodos:0, ramaMax:0 };
const tipos = new Map();
let conQuejas = 0, peorGlobal = 99, sinSalida = [], aristasRotas = 0,
    inalcanzables = 0, cronoMalas = 0, unicos = 0;

for(let s = 0; s < N; s++){
  const semilla = "MAPA-" + s;
  const mapa = generarMapa(crearRng(estadoDeSemilla(semilla)), "yugi");
  if(mapa.fallos) conQuejas++;
  peorGlobal = Math.min(peorGlobal, chipsPeorRuta(mapa));

  /* ── determinismo: la misma semilla, el mismo mapa ── */
  if(s < 40){
    const otra = generarMapa(crearRng(estadoDeSemilla(semilla)), "yugi");
    if(JSON.stringify(otra.actos) !== JSON.stringify(mapa.actos))
      mal(`la semilla ${semilla} da dos mapas distintos`);
  }

  for(const acto of mapa.actos){
    if(acto.torre) continue;
    acc.actos++;
    const f = formaDelActo(acto);
    acc.c1 += f.columnasDe1; acc.c2 += f.columnasDe2; acc.c3 += f.columnasDe3;
    acc.cols += acto.columnas.length;
    acc.rutas += f.rutas;
    acc.aristas += f.aristas;
    acc.convergencias += f.convergencias;
    for(const r of f.tiposPorRuta) for(const t of r) tipos.set(t, (tipos.get(t) ?? 0) + 1);

    const porId = new Map();
    for(const col of acto.columnas) for(const n of col) porId.set(n.id, n);

    /* ── 1 · TODA ARISTA APUNTA A LA COLUMNA SIGUIENTE ── */
    for(const col of acto.columnas) for(const n of col){
      acc.nodos++; acc.salidas += (n.salidas ?? []).length;
      for(const id of (n.salidas ?? [])){
        const d = porId.get(id);
        if(!d || d.col !== n.col + 1) aristasRotas++;
      }
      /* Ningún nodo sin salida salvo la última columna. */
      if(n.col < acto.columnas.length - 1 && !(n.salidas ?? []).length)
        sinSalida.push(`${semilla} ${n.id}`);
    }
    /* ── 2 · NINGÚN NODO INALCANZABLE ── */
    for(let c = 1; c < acto.columnas.length; c++)
      for(const n of acto.columnas[c])
        if(!acto.columnas[c-1].some(p => (p.salidas ?? []).includes(n.id))) inalcanzables++;

    /* ── 3 · `siguientes()` DEVUELVE SOLO LO CONECTADO ── */
    for(const col of acto.columnas.slice(0, -1)) for(const n of col){
      const sig = siguientes(mapa, { acto:acto.indice, col:n.col, id:n.id });
      const esperados = new Set(n.salidas ?? []);
      if(sig.length !== esperados.size || !sig.every(x => esperados.has(x.id)))
        aristasRotas++;
    }

    /* ── 4 · HAY DECISIONES QUE CIERRAN PUERTAS ──
       Un nodo con una sola salida en una columna de dos o tres es
       exactamente el coste de oportunidad que se buscaba. */
    for(const col of acto.columnas.slice(0, -1))
      if(col.length > 1 && col.some(n => (n.salidas ?? []).length === 1)) unicos++;

    if(revisarActo(acto).length) cronoMalas++;
  }
}

/* ── veredicto ── */
if(conQuejas) mal(`los ${N} mapas cumplen las reglas`, `${conQuejas} con quejas`);
else ok(`los ${N} mapas cumplen las reglas del generador`);

if(peorGlobal < CHIPS.meta)
  mal(`toda ruta elegible puede llegar a ${CHIPS.meta} fichas`,
      `la peor da ${peorGlobal}`);
else ok(`incluso la ruta más pobre de los ${N} mapas llega a ${peorGlobal} fichas`);

if(aristasRotas) mal("`siguientes()` devuelve exactamente lo conectado", `${aristasRotas} discrepancias`);
else ok("`siguientes()` devuelve exactamente los nodos conectados, ni uno más");

if(sinSalida.length) mal("ningún nodo se queda sin salida", sinSalida.slice(0,3).join(" · "));
else ok("ningún nodo se queda sin salida");

if(inalcanzables) mal("ningún nodo es inalcanzable", `${inalcanzables}`);
else ok("ningún nodo dibujado es inalcanzable");

if(cronoMalas) mal("todos los actos pasan sus propias reglas", `${cronoMalas}`);
else ok("todos los actos pasan sus reglas de ruta (duelos, pack, utilidad)");

const pctUnicos = unicos * 100 / Math.max(1, acc.cols - acc.actos);
if(pctUnicos < 20)
  mal("hay decisiones que cierran puertas de verdad",
      `solo el ${pctUnicos.toFixed(0)}% de columnas tiene un nodo sin retorno`);
else ok(`el ${pctUnicos.toFixed(0)}% de las columnas tiene algún nodo con una sola salida: elegir cierra`);

const tot = acc.c1 + acc.c2 + acc.c3;
if(!acc.c3 || !acc.c2 || !acc.c1)
  mal("salen columnas de 1, 2 y 3 nodos",
      `1:${acc.c1} 2:${acc.c2} 3:${acc.c3}`);
else ok("salen columnas de uno, dos y tres nodos");

console.log("\n── forma de los mapas ──");
console.log(`  columnas: 1 nodo ${(acc.c1*100/tot).toFixed(0)}% · `
          + `2 nodos ${(acc.c2*100/tot).toFixed(0)}% · 3 nodos ${(acc.c3*100/tot).toFixed(0)}%`);
console.log(`  ramificación media: ${(acc.salidas/acc.nodos).toFixed(2)} salidas por nodo`);
console.log(`  rutas por acto: ${(acc.rutas/acc.actos).toFixed(1)}`);
console.log(`  convergencias por acto: ${(acc.convergencias/acc.actos).toFixed(1)}`);
console.log(`  aristas por acto: ${(acc.aristas/acc.actos).toFixed(1)}`);
const totalTipos = [...tipos.values()].reduce((a,b)=>a+b,0);
console.log("  tipos de nodo por ruta: " + [...tipos.entries()]
  .sort((a,b)=>b[1]-a[1])
  .map(([t,n]) => `${t} ${(n*100/totalTipos).toFixed(0)}%`).join(" · "));

/* ══ Y EL MERCADER NO PUEDE SER EL SEGUNDO NODO ══
   Se paga con cartas del binder: con un solo duelo jugado no hay nada
   que darle y el nodo se gasta a cambio de nada. Lo reportó E. Se mira
   sobre mapas GENERADOS, no sobre la plantilla, porque `reparar` puede
   cambiar el tipo de un nodo después de sembrarlo. */
{
  let pronto = 0, mercaderes = 0;
  for(let i=0;i<400;i++){
    const m = generarMapa(crearRng(estadoDeSemilla("mercader-"+i)), "yugi");
    for(const col of m.actos[0].columnas)
      for(const n of col){
        if(n.tipo !== "MERCADER") continue;
        mercaderes++;
        if(n.col < REGLAS_MAPA.mercaderDesdeColumna) pronto++;
      }
  }
  if(pronto) mal(`ningún mercader antes de la columna ${REGLAS_MAPA.mercaderDesdeColumna}`,
                 `${pronto} de ${mercaderes} en 400 mapas`);
  else ok(`ninguno de los ${mercaderes} mercaderes del acto I sale antes de la columna ${REGLAS_MAPA.mercaderDesdeColumna}`);
}

console.log(`\n${fallos ? "FALLA: " + fallos : "Todo correcto"}`);
process.exit(fallos ? 1 : 0);
