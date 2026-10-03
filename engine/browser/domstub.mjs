/* DOM mínimo para poder ejecutar el HTML fuera del navegador y verificar
   que el cableado motor↔vista funciona sin abrir Chrome. */
export function installDOM(){
  /* Con `globalThis.GOAT_SEED` puesto, TODO el azar del proceso pasa a ser
     el mismo: el barajado, los desempates de la IA y el porcentaje de error
     de los niveles bajos. Sin esto, las comprobaciones que juegan una
     partida entera fallaban una de cada cinco veces sin que hubiera nada
     roto —el bot rival decide con Math.random— y un test que parpadea deja
     de mirarse. Solo afecta a las pruebas: en el navegador no hay
     GOAT_SEED y Math.random se queda como está. */
  const s = Number(globalThis.GOAT_SEED) || 0;
  if(s){
    let x = s >>> 0;
    Math.random = () => { x^=x<<13; x^=x>>>17; x^=x<<5; return ((x>>>0)%1000000)/1000000; };
  }
  const mk = (tag="div") => {
    const el = {
      tagName:tag, children:[], style:{}, dataset:{}, _cls:new Set(),
      _html:"", textContent:"", offsetLeft:0, offsetTop:0,
      offsetWidth:650, offsetHeight:680,
      classList:{ add:(...c)=>c.forEach(x=>el._cls.add(x)),
                  remove:(...c)=>c.forEach(x=>el._cls.delete(x)),
                  toggle:(c,v)=>{ v??!el._cls.has(c) ? el._cls.add(c) : el._cls.delete(c); },
                  contains:c=>el._cls.has(c) },
      appendChild:c=>{ el.children.push(c); c._parent=el; return c; },
      insertBefore:(c,ref)=>{ const i=ref?el.children.indexOf(ref):0;
        el.children.splice(i<0?0:i,0,c); c._parent=el; return c; },
      get firstChild(){ return el.children[0] ?? null; },
      remove(){ const p=el._parent; if(p){ const i=p.children.indexOf(el); if(i>=0) p.children.splice(i,1); } },
      addEventListener(){}, removeEventListener(){},
      /* `setAttribute` faltaba y el modo historia lo usa para las
         etiquetas de accesibilidad de los botones +/−: la pantalla del
         mazo reventaba entera con "setAttribute is not a function" y
         ninguna comprobación lo veía porque ninguna llegaba a pintarla.
         Los atributos van a `_attrs` y `className`/`id` se reflejan
         donde el resto del stub ya los busca. */
      _attrs:{},
      setAttribute(k,v){ el._attrs[k]=String(v);
        if(k==="class") el.className=v;
        if(k==="id") el.id=v; },
      getAttribute(k){ return el._attrs[k] ?? null; },
      removeAttribute(k){ delete el._attrs[k]; },
      hasAttribute(k){ return k in el._attrs; },
      /* `closest` lo usan el arrastre del binder y el cierre de la mano. */
      closest(sel){
        const quiere = sel.replace(/^[.#\[]/,"").replace(/\]$/,"");
        let n = el;
        while(n){
          if(n._cls?.has?.(quiere) || n.id === quiere || (quiere in (n._attrs ?? {}))) return n;
          n = n._parent;
        }
        return null;
      },
      querySelector:()=>mk(), querySelectorAll:()=>[], hidden:false, dataset:{},
      getBoundingClientRect:()=>({left:0,top:0,width:82,height:119}),
      get innerHTML(){ return el._html; },
      set innerHTML(v){ el._html=String(v); el.children.length=0; },  // como el navegador
      get className(){ return [...el._cls].join(" "); },
      set className(v){ el._cls=new Set(String(v).split(/\s+/).filter(Boolean)); },
      focus(){}, click(){}, clientWidth:1200, clientHeight:820,
      onmouseenter:null, onclick:null,
    };
    return el;
  };
  const byId = new Map();
  global.document = {
    createElement: mk,
    /* El SVG de los caminos del mapa se crea con createElementNS. El stub
       no lo tenía y la pantalla del Reino reventaba entera por una línea
       decorativa. */
    createElementNS: (_ns, tag) => mk(tag),
    getElementById: id => { if(!byId.has(id)) byId.set(id, mk()); return byId.get(id); },
    querySelector: s => { const id=s.startsWith("#")?s.slice(1):s;
      if(!byId.has(id)) byId.set(id, mk()); return byId.get(id); },
    querySelectorAll: (sel) => {
      // suficiente para los tests: busca por id entre los ya creados
      const out=[];
      for(const [id,el] of byId) if(sel.includes(id)) out.push(el);
      return out;
    },
    addEventListener(){},
    body: mk("body"),
  };
  global.window = { innerWidth:1400, innerHeight:800, addEventListener(){},
                    requestAnimationFrame:f=>setTimeout(()=>f(performance.now()),0) };
  global.requestAnimationFrame = global.window.requestAnimationFrame;
  global.innerWidth = 1920; global.innerHeight = 1080;
  global.getComputedStyle = () => ({ getPropertyValue: () => "118px" });
  global.document.documentElement = mk();
  global.performance = global.performance ?? { now:()=>Date.now() };
  global.location = { reload(){} };
  global.localStorage={ getItem:()=>null, setItem(){} };
  return byId;
}
