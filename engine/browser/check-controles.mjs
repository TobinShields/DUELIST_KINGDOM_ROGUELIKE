/* Los controles de turno tienen que APARECER cuando te toca decidir. */
import { readFileSync, writeFileSync } from "node:fs";
import { installDOM } from "./domstub.mjs";
/* ══ SEMILLA FIJA ══
   Sin ella la partida es distinta cada vez: a veces el rival tenía un
   primer turno largo, los controles tardaban más de lo que esperaba el
   test y fallaba sin que nada estuviera roto. Es la misma solución que
   ya se usó en `check-chain`: `GOAT_SEED` fija TODO el azar del proceso
   —barajado, desempates de la IA, porcentaje de error— y el duelo es
   reproducible. En el navegador la variable no existe y todo sigue
   siendo aleatorio. */
globalThis.GOAT_SEED = 20050401;
installDOM();
/* Las comprobaciones buscan los textos en español, así que se fuerza
   ese idioma: el juego arranca en inglés por defecto. */
global.localStorage={getItem:k=>k==="goatConfig"?'{"idioma":"es"}':null,setItem(){}};
let primera=true; const real=Math.random;
Math.random=()=>{ if(primera){primera=false; return 0.1;} return real(); };  // empiezas tú
const html=readFileSync("./out/goat.html","utf-8");
writeFileSync("./out/_ctl.mjs", html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]);
console.warn=()=>{};
await import("./out/_ctl.mjs");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await sleep(300);
const coin=document.getElementById("coin");
document.getElementById("mJugar").onclick?.();
await sleep(900);
console.log("═══ SORTEO Y CONTROLES ═══");
console.log("carga oculta durante el sorteo:", document.getElementById("boot").style.display==="none" ? "✓":"✗");
console.log("moneda visible:", coin.style.display==="flex" ? "✓":"✗",
            "· texto:", String(coin.innerHTML).replace(/<[^>]+>/g," ").trim().slice(0,30));
/* ══ ESPERAR A QUE PASE, NO ESPERAR UN RATO ══
   Esto era `sleep(11000)` y por tanto una apuesta: si el arranque tarda
   un poco más —y basta con que el HTML engorde 20 KB— la foto se toma
   antes de que te toque decidir y el test falla sin que nada esté roto.
   Falló cuatro de cada cinco veces en cuanto crecieron los estilos del
   móvil. Ahora se espera A LA CONDICIÓN, con un tope generoso. */
const ctl=document.getElementById("controles");
const bf=document.getElementById("btnFase"), bt=document.getElementById("btnFin");
const esperarA = async (cond, tope=25000) => {
  const t0 = Date.now();
  while(Date.now() - t0 < tope){ if(cond()) return true; await sleep(200); }
  return false;
};
const llegaron = await esperarA(() => ctl.style.display === "flex"
                                   && typeof bt.onclick === "function");
if(!llegaron) console.log("  (los controles no aparecieron en 25 s)");
console.log("controles visibles en tu Main Phase:", ctl.style.display==="flex" ? "✓":"✗");
console.log("  botón de fase:", bf.style.display, "· texto:",
            document.getElementById("btnFaseTxt").textContent);
console.log("  botón de fin:", bt.style.display, "· con manejador:", typeof bt.onclick==="function"?"✓":"✗");
// pasar a Battle Phase con el botón verde
// pasamos turno con el botón y esperamos a un turno con Battle Phase
for(let i=0;i<6;i++){
  if(typeof bt.onclick==="function" && bt.style.display==="flex"){ bt.onclick(); }
  /* Igual que arriba: se espera a que vuelva a tocarte, no un número. */
  await esperarA(() => bf.style.display==="flex" || bt.style.display==="flex", 8000);
  if(bf.style.display==="flex"){
    console.log("\nen un turno con Battle Phase disponible:");
    console.log("  botón de fase visible ✓ · texto:", document.getElementById("btnFaseTxt").textContent);
    bf.onclick();
    await sleep(3000);
    console.log("  tras pulsarlo →", String(document.getElementById("turnInfo").innerHTML).replace(/<[^>]+>/g,"").trim());
    console.log("  ahora el botón dice:", document.getElementById("btnFaseTxt").textContent,
                "· fin visible:", document.getElementById("btnFin").style.display);
    break;
  }
}
