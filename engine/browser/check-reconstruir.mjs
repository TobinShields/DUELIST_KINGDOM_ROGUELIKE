/* ════════════════════════════════════════════════════════════════
   ¿SE PUEDE RECONSTRUIR EL ESTADO REAL DEL MOTOR?

   Antes de pensar en buscar varios turnos hacia delante hace falta saber
   si el estado de ocgcore —cadenas, efectos persistentes, scripts Lua y
   azar incluidos— se puede volver a obtener. ocgcore NO se puede clonar
   ni serializar (ver CLAUDE.md), así que la única vía honesta es rehacer:
   crear el duelo con la misma semilla y los mismos mazos y darle las
   mismas respuestas.

   Esto comprueba, en varias partidas bot contra bot con mazos distintos:
     1. DETERMINISMO: rehacer da la MISMA secuencia de eventos (hash de
        todos los eventos del adaptador), el mismo ganador y los mismos LP.
     2. RAMA: parar a mitad de partida, rehacer hasta ahí en un duelo
        nuevo, y comprobar que el espejo coincide y que el motor acepta
        una respuesta legal DISTINTA y sigue jugando.
     3. COSTE: cuánto tarda rehacer hasta la mitad. Es el precio de cada
        rama si algún día hay búsqueda.
   Y el replay se guarda con el registro estructurado (`registro.mjs`)
   pasando por JSON, así que también prueba que el formato basta.

   Uso: node check-reconstruir.mjs [partidas=6]
   ════════════════════════════════════════════════════════════════ */
import { jugarYRegistrar, rehacer, aJSON, deJSON, RULESET, MAZOS } from "./registro.mjs";
import { makeAutoPlayer } from "./src/autopilot.mjs";
import * as X from "./out/ocgcore.bundle.js";

const N = Number(process.argv[2] ?? 6);
const generico = makeAutoPlayer(X);
const firma = duel => aJSON([0,1].map(p => Object.entries(duel.zones[p])
  .map(([loc, z]) => [loc, z.map(c => c ? [c.code, c.position, c.controller, c.owner] : null)])));
let fallos = 0, costes = [];

for(let i=0;i<N;i++){
  const semilla = 700 + i*104729;
  const { replay } = await jugarYRegistrar({ semilla, niveles:["experto", i%2 ? "duro" : "experto"],
                                             mazos:[MAZOS[i % MAZOS.length], MAZOS[(i*5+2) % MAZOS.length]],
                                             conDecisiones:false, huella:true });
  const copia = deJSON(aJSON(replay));                  // que el formato baste
  const re = await rehacer(copia, { huella:true });
  const igual = re.huella === replay.huella
             && re.resultado.ganador === replay.resultado.ganador
             && re.resultado.lp.join() === replay.resultado.lp.join();
  if(!igual){ fallos++; console.log(`  ✗ partida ${i}: rehacer NO da lo mismo`, re.resultado, replay.resultado); continue; }

  /* Rama a mitad: dos duelos rehechos hasta el mismo punto deben tener el
     mismo espejo; luego a uno se le da otra respuesta legal. */
  const mitad = Math.floor(replay.respuestas.length / 2);
  const t0 = performance.now();
  const A = await rehacer(copia, { hasta:mitad });
  costes.push({ respuestas: mitad, ms: performance.now() - t0 });
  const B = await rehacer(copia, { hasta:mitad });
  const mismoPunto = firma(A.duel) === firma(B.duel) && A.pregunta?.type === B.pregunta?.type;
  let ramaViva = false, desfaseRama = 0;
  if(mismoPunto && A.pregunta){
    const original = copia.respuestas[mitad];
    let alternativa = null;
    for(let k=0;k<8;k++){
      const r = generico(A.pregunta, k);
      if(r && aJSON(r) !== aJSON(original)){ alternativa = r; break; }
    }
    alternativa ??= original;
    const desyncAntes = A.duel.desyncs;
    A.duel.respond(alternativa);
    let pasos = 0;
    for(; pasos<200 && !A.duel.finished; pasos++){
      const q = await A.duel.run();
      if(!q || A.duel.finished) break;
      let resp = null;
      for(let k=0; k<8 && !resp; k++) resp = generico(q, k);
      if(!resp) break;
      A.duel.respond(resp);
    }
    /* Viva = el motor aceptó la respuesta distinta y siguió preguntando
       (o terminó la partida). Los desfases del espejo se informan aparte:
       el espejo es de la interfaz, el estado de verdad es el del motor. */
    ramaViva = pasos > 0 || A.duel.finished;
    desfaseRama = A.duel.desyncs - desyncAntes;
  }
  const ok = mismoPunto && ramaViva;
  if(!ok) fallos++;
  console.log(`  ${ok ? "✓" : "✗"} partida ${i} · ${replay.mazos[0].nombre} vs ${replay.mazos[1].nombre} · ` +
              `${replay.respuestas.length} respuestas, T${replay.resultado.turnos} · idéntica al rehacer · ` +
              `rama en la respuesta ${mitad}: ${mismoPunto ? "mismo estado" : "ESTADO DISTINTO"}, ${ramaViva ? "sigue jugando" : "NO SIGUE"}` +
              (desfaseRama ? ` (espejo: ${desfaseRama} desfases en la rama)` : ""));
}
const media = costes.length ? costes.reduce((s,c)=>s+c.ms,0)/costes.length : 0;
const porResp = costes.length ? costes.reduce((s,c)=>s+c.ms/c.respuestas,0)/costes.length : 0;
console.log(`\nruleset ${RULESET.id} · coste de rehacer hasta la mitad: ${media.toFixed(0)} ms de media (${porResp.toFixed(2)} ms por respuesta)`);
console.log(fallos ? `✗ ${fallos} partidas no se reconstruyen` : `✓ ${N} partidas se reconstruyen y ramifican en el motor real`);
process.exit(fallos ? 1 : 0);
