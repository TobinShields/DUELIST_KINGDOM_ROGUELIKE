/* Junta los trozos de `medir-cruces.mjs` (../data/cruces-<n>.json) en
   ../data/cruces.json, que es lo que mete build-html en el HTML.
   Uso: node unir-cruces.mjs      → avisa si falta algún cruce. */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
const trozos = readdirSync("../data").filter(f => /^cruces-\d+\.json$/.test(f)).sort();
if(!trozos.length){ console.error("no hay trozos ../data/cruces-<n>.json"); process.exit(1); }
let salida = null;
for(const f of trozos){
  const d = JSON.parse(readFileSync("../data/" + f, "utf-8"));
  if(!salida) salida = { n: d.n, mazos: d.mazos, cruces: {} };
  if(JSON.stringify(d.mazos) !== JSON.stringify(salida.mazos)){ console.error(`${f}: otros mazos`); process.exit(1); }
  Object.assign(salida.cruces, d.cruces);
}
const M = salida.mazos.length, esperados = M * (M - 1) / 2, hay = Object.keys(salida.cruces).length;
salida.medido = new Date().toISOString().slice(0, 10);
writeFileSync("../data/cruces.json", JSON.stringify(salida));
console.log(`${trozos.length} trozos · ${hay}/${esperados} cruces · ${salida.n} partidas cada uno`);
/* Lo que cada mazo gana de media contra los otros 19, para ver de un
   vistazo si la tabla tiene sentido. */
const media = salida.mazos.map((nombre, i) => {
  let t = 0, n = 0;
  for(let j = 0; j < M; j++){ if(i === j) continue;
    const c = salida.cruces[i < j ? `${i}-${j}` : `${j}-${i}`]; if(!c) continue;
    const p = (c.gana + 0.5 * (c.tablas ?? 0)) / c.n; t += i < j ? p : 1 - p; n++; }
  return [nombre, n ? t / n : null];
}).sort((a, b) => b[1] - a[1]);
for(const [m, p] of media) console.log(`  ${m.padEnd(30)} ${p == null ? "—" : Math.round(p * 100) + "%"}`);
if(hay < esperados){ console.error(`FALTAN ${esperados - hay} cruces`); process.exit(1); }
