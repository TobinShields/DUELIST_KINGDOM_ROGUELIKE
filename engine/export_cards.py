import sqlite3, json, os
BASE=os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","BabelCDB-master","BabelCDB-master")

def split_setcodes(sc):
    out=[]
    for i in range(4):
        v=(sc >> (16*i)) & 0xffff
        if v: out.append(v)
    return out

cards={}
# el orden importa: goat-entries se carga DESPUES para que sobrescriba
for f in ["cards.cdb","goat-entries.cdb"]:
    con=sqlite3.connect(os.path.join(BASE,f))
    for (cid,ot,alias,setcode,ctype,atk,dfn,level,race,attr,cat) in con.execute(
            "select id,ot,alias,setcode,type,atk,def,level,race,attribute,category from datas"):
        cards[cid]={
            "code":cid,"alias":alias or 0,
            "setcodes":split_setcodes(setcode or 0),
            "type":ctype or 0,
            "level":(level or 0) & 0xff,
            "attribute":attr or 0,
            "race":str(race or 0),          # bigint -> string, node lo pasa a BigInt
            "attack":atk if atk is not None else 0,
            "defense":dfn if dfn is not None else 0,
            "lscale":((level or 0) >> 24) & 0xff,
            "rscale":((level or 0) >> 16) & 0xff,
            "link_marker":0,
        }
    con.close()
    print(f, "->", len(cards), "cartas acumuladas")

names={}
for f in ["cards.cdb","goat-entries.cdb"]:
    con=sqlite3.connect(os.path.join(BASE,f))
    for (cid,name,desc) in con.execute("select id,name,desc from texts"):
        names[cid]={"name":name,"desc":desc}
    con.close()

json.dump(cards, open("cards.json","w"), separators=(",",":"))
json.dump(names, open("names.json","w"), separators=(",",":"))
print("cards.json:", os.path.getsize("cards.json")//1024, "KB")
print("names.json:", os.path.getsize("names.json")//1024, "KB")
