import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const RAIZ = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
// el dist del paquete compilado de ocgcore vive en engine/vendor
const D = path.join(RAIZ, "engine", "vendor", "dist") + "/";
const read=f=>readFileSync(D+f,"utf-8").replace(/\/\/# sourceMappingURL=.*\n?/g,"");
const exportsOf=s=>{const m=s.match(/export\{([^}]*)\}/);
  return m? m[1].split(",").map(p=>{const t=p.trim().split(/\s+/);
    return {local:t[0], ext:t[2]??t[0]};}) : [];};
const strip=s=>s.replace(/export\{[^}]*\}\s*;?\s*/g,"");

// Cada módulo va dentro de su propio ámbito (IIFE) para que no choquen
// los identificadores minificados, y devuelve sus exports como objeto.
function mod(file, imports={}){
  const src=read(file), ex=exportsOf(src);
  let body=strip(src).replace(/import"[^"]*";?/g,"");   // imports de solo efecto
  // resolver "import{x as y}from './chunk-*.js'"
  body=body.replace(/import\{([^}]*)\}from"([^"]*)";?/g,(_,spec,from)=>
    spec.split(",").map(p=>{const t=p.trim().split(/\s+/);
      const ext=t[0], local=t[2]??t[0];
      return `var ${local}=${imports[from]}.${ext};`;}).join(""));
  return `(()=>{${body}\nreturn {${ex.map(e=>`${e.ext}:${e.local}`).join(",")}};})()`;
}

const parts=[];
parts.push(`const __cL=${mod("chunk-L5TW24SS.js")};`);
parts.push(`const __c6=${mod("chunk-6GYI7QPM.js")};`);
const imp={"./chunk-L5TW24SS.js":"__cL","./chunk-6GYI7QPM.js":"__c6"};
parts.push(`const __wasm=${mod("ocgcore.sync-ORIXRHXI.js",imp)}.default;`);
parts.push(`const __glue=${mod("ocgcore.sync-MMMSWPBB.js",imp)}.default;`);

let index=read("index.js")
 .replace(/import"[^"]*";?/g,"")
 .replace(/async function (\w+)\(\)\{return\(await import\("\.\/ocgcore\.sync-MMMSWPBB\.js"\)\)\.default\}/,"async function $1(){return __glue}")
 .replace(/async function (\w+)\(\)\{return\(await import\("\.\/ocgcore\.sync-ORIXRHXI\.js"\)\)\.default\.buffer\}/,"async function $1(){return __wasm.buffer}")
 .replace(/async function (\w+)\(\)\{return\(await import\("\.\/ocgcore\.jspi-[^"]*"\)\)\.default(\.buffer)?\}/g,
          "async function $1(){throw new Error('bundle sync: JSPI no incluido')}");

/* ── PARCHE AL LECTOR DE MENSAJES DEL PAQUETE (SELECT_SUM) ──
   ocgcore-wasm 0.1.2 lee mal el mensaje 23, que es el de "sacrifica cartas
   cuyos valores sumen N" —los tributos de una invocación ritual—. Cada
   entrada del motor lleva code, controlador, zona, índice, POSICIÓN y
   valor, y el paquete se salta la posición: a partir de la primera carta
   el flujo va cuatro bytes desfasado y salen entradas de basura (códigos
   de carta que son niveles, zonas imposibles…).
   Se veía así: un jugador reportó que su mazo de ritual no podía invocar
   nada y salía "Decisión no soportada".
   Todos los demás mensajes usan el lector de posición del propio paquete
   (la función `p`), así que aquí se hace lo mismo. Es un parche sobre el
   texto del dist: si algún día se actualiza ocgcore-wasm y esto deja de
   encajar, el `if` de abajo avisa en vez de fallar en silencio. */
const SUM_MALO = /case 23:return\{type:t,player:e\.u8\(\),select_max:e\.u8\(\),amount:e\.u32\(\),min:e\.u32\(\),max:e\.u32\(\),selects:Array\.from\(\{length:e\.u32\(\)\},\(\)=>\(\{code:e\.u32\(\),controller:e\.u8\(\),location:e\.u8\(\),sequence:e\.u32\(\),amount:e\.u32\(\)\}\)\),selects_must:Array\.from\(\{length:e\.u32\(\)\},\(\)=>\(\{code:e\.u32\(\),controller:e\.u8\(\),location:e\.u8\(\),sequence:e\.u32\(\),amount:e\.u32\(\)\}\)\)\};/;
if(!SUM_MALO.test(index))
  console.warn("AVISO: el lector de SELECT_SUM del paquete ya no es el esperado; "
             + "comprueba si sigue haciendo falta el parche (rituales).");
index = index.replace(SUM_MALO,
  "case 23:return{type:t,player:e.u8(),select_max:e.u8(),amount:e.u32(),min:e.u32(),max:e.u32(),"
  + "selects_must:Array.from({length:e.u32()},()=>({code:e.u32(),...p(e),amount:e.u32()})),"
  + "selects:Array.from({length:e.u32()},()=>({code:e.u32(),...p(e),amount:e.u32()}))};");

/* ── SEGUNDO PARCHE AL MISMO LECTOR (SHUFFLE_SET_CARD) ──
   El mensaje 36 es el que baraja las cartas COLOCADAS de una zona, para
   que no puedas seguirle la pista a una tapada concreta. Lo manda el
   motor constantemente: cada vez que colocas boca abajo teniendo ya algo
   tapado. Y el paquete lo lee mal de dos formas a la vez:

     · la cuenta es un u8 y él lee un u32,
     · y las posiciones NO vienen en parejas (desde, hacia): vienen
       primero TODAS las de origen y después TODAS las de destino.

   El resultado es que el lector se sale del buffer y lanza "eof", que en
   el navegador mata el bucle del duelo entero. Apareció midiendo el
   equilibrio del modo historia: el mazo de Bonz, lleno de tapadas, lo
   reventaba en la semilla 1037.

   Los bytes reales de un caso, ya comprobados a mano:
     36 · 04 · 01 · [01 04 02000000 08000000] · [00 00 00000000 00000000]
     tipo  zona  n     desde (loc_info, 10B)      hacia (loc_info, 10B)

   Mismo criterio que el parche de SELECT_SUM: se usa el lector de
   posición del propio paquete (`p`) y se avisa si el texto deja de
   encajar en vez de fallar en silencio. */
const BARAJA_MALO = /case 36:return\{type:t,location:e\.u8\(\),cards:Array\.from\(\{length:e\.u32\(\)\},\(\)=>\(\{from:p\(e\),to:p\(e\)\}\)\)\};/;
if(!BARAJA_MALO.test(index))
  console.warn("AVISO: el lector de SHUFFLE_SET_CARD del paquete ya no es el esperado; "
             + "comprueba si sigue haciendo falta el parche (tapadas).");
index = index.replace(BARAJA_MALO,
  "case 36:{const loc=e.u8(),n=e.u8(),de=Array.from({length:n},()=>p(e)),"
  + "a=Array.from({length:n},()=>p(e));"
  + "return{type:t,location:loc,cards:de.map((f,i)=>({from:f,to:a[i]}))};}");

const out=`// ocgcore-wasm 0.1.2 — bundle autocontenido, wasm incrustado en base64.
// Núcleo de ProjectIgnis / EDOPro (AGPL-3.0). Empaquetado por n1xx1 (MIT).
${parts.join("\n")}
${index}
`;
/* Se escriben LAS DOS COPIAS. Había una en la raíz y otra en out/, y todo
   —el HTML, escenario.mjs, los torneos— lee la de out/: al regenerar solo
   la de la raíz, el arreglo del parser de SELECT_SUM no llegaba a ningún
   sitio y parecía que no había funcionado. */
for(const destino of ["./ocgcore.bundle.js","./out/ocgcore.bundle.js"])
  writeFileSync(destino, out);
console.log("ocgcore.bundle.js (raíz y out/):",(out.length/1024/1024).toFixed(2),"MB");
