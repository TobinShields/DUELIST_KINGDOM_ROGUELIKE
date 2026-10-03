"""LEER UNA PARTIDA COMO UN JUGADOR: turno a turno, la mano de la IA, lo que
pensó (PIENSA), lo que simuló (SIMULA: cada opción con su media y quién
decidió, heurística o simulación) y lo que hizo.

Uso:  python3 leer-partida.py goat-match-1-3-....txt 2          (partida 2)
      python3 leer-partida.py goat-match-1-3-....txt 2 5,6,7    (solo esos turnos)

Es la herramienta del análisis de cada torneo de E: no basta con corregir sus
notas, hay que leer la línea de juego de la IA y buscar los fallos que nadie
apuntó. Ver CLAUDE.md, «Cómo se analiza un torneo»."""
import json,re,sys
import os
N=json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'out','names.subset.json')))
nm=lambda c: (N.get(str(c)) or {}).get('name',str(c))
# Un log suelto (duelo libre o del Reino) no lleva cabeceras de partida:
# entonces la partida es el archivo entero y el número se puede omitir.
f=sys.argv[1]; game=int(sys.argv[2]) if len(sys.argv)>2 else 1
turns=set(map(int,sys.argv[3].split(','))) if len(sys.argv)>3 else None
txt=open(f).read()
parts=re.split(r'═+\nGame (\d+) — log\n═+\n',txt)
# parts: [pre, num, body, num, body...]
bodies={int(parts[i]):parts[i+1] for i in range(1,len(parts),2)}
if not bodies: bodies={1:txt}
body=bodies[game]
ME=None
hand={0:{},1:{}}
for line in body.split('\n'):
    m=re.match(r'\[\s*(\d+)ms\] T(\d+) (\S+)\s+(.*?)\s{2,}(\S+) · (.*)$',line)
    if not m:
        m=re.match(r'\[\s*(\d+)ms\] T(\d+) (\S+)\s+(\S+) · (.*)$',line)
        if not m: continue
        ms,t,quien,kind,data=m.groups(); fase=''
    else:
        ms,t,quien,fase,kind,data=m.groups()
    t=int(t)
    try: d=json.loads(data)
    except: d=data
    if kind=='sorteo' and isinstance(d,dict): ME=0 if d.get('empiezasTu') else 1
    if kind=='evento' and isinstance(d,dict):
        if d.get('t')=='draw':
            for c in d['cards']: hand[d['player']][c['uid']]=c['code']
        if d.get('t')=='move':
            fr=d['from']; to=d['to']
            if fr.get('location')==2:
                for p in (0,1): hand[p].pop(d['uid'],None)
            if to.get('location')==2: hand[to['controller']][d['uid']]=d['code']
    if turns and t not in turns: continue
    if kind=='evento' and isinstance(d,dict):
        if d.get('t')=='turn': IA=1-(ME or 0); print(f"\n===== T{t} turno de {'IA' if d['player']==IA else 'TÚ'} · mano IA: {[nm(c) for c in hand[IA].values()]} · mano tú: {[nm(c) for c in hand[1-IA].values()]}")
        elif d.get('t') in ('move','summon','chain','chaining','pos','set','lp','damage','attack','chainSolved','phase'):
            s=json.dumps(d)[:200]
            if d.get('t')=='move': s=f"move {nm(d['code'])} {d['from'].get('controller')}:{d['from'].get('location')}→{d['to'].get('controller')}:{d['to'].get('location')} pos{d['to'].get('position')}"
            if d.get('t')=='phase': s=f"--fase {d['phase']}"
            print(f"  [{fase}] {s}")
    elif kind in ('ia_piensa',):
        print(f"  [{fase}] PIENSA {d.get('msg') if isinstance(d,dict) else d}  {json.dumps(d.get('valor')) if isinstance(d,dict) and d.get('valor') is not None else ''}"[:260])
    elif kind=='ia_simula':
        ops=d.get('opciones',[]) if isinstance(d,dict) else []
        print(f"  [{fase}] SIMULA ms={d.get('ms')} elige={d.get('elige')} :: "+" | ".join(f"{o['jugada']} {o['media']}" for o in ops)[:600])
    elif kind in ('ia','tú_eliges','auto'):
        print(f"  [{fase}] {kind.upper()} {json.dumps(d)[:180]}")
    elif kind=='te_pregunta':
        print(f"  [{fase}] PREGUNTA-A-TI {json.dumps(d)[:200]}")
