import io, re, zipfile
from pathlib import Path
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer
from parse_md import parse_lines

tok = lambda s: re.findall(r"\w+", s.lower())

model = SentenceTransformer("all-MiniLM-L6-v2")
DIM = model.encode(["x"]).shape[1]

msgs, texts, seen = [], [], set()
emb = np.zeros((0, DIM), dtype=np.float32)
bm25 = None


def add(items):
    global emb, bm25
    new = []
    for date, sender, text in items:
        if ("<Media omitted>" not in text and len(text.split()) >= 2
                and tok(text) and text not in seen):
            seen.add(text)
            new.append([date, sender, text])
    if not new:
        return 0
    vecs = model.encode([n[2] for n in new], normalize_embeddings=True)
    emb = np.vstack([emb, vecs])
    msgs.extend(new)
    texts.extend(n[2] for n in new)
    bm25 = BM25Okapi([tok(t) for t in texts])
    return len(new)


def ranks(scores):
    order = np.argsort(-scores)
    r = np.empty(len(scores), dtype=int)
    r[order] = np.arange(len(scores))
    return r


class Msg(BaseModel):
    date: str
    sender: str
    text: str


class ImportReq(BaseModel):
    path: str


app = FastAPI()


@app.get("/search")
def search(q: str):
    if not texts:
        return []
    sem = emb @ model.encode([q], normalize_embeddings=True)[0]
    kw = bm25.get_scores(tok(q))
    fused = 1 / (60 + ranks(sem)) + np.where(kw > 0, 1 / (60 + ranks(kw)), 0)
    return [{"date": msgs[i][0], "sender": msgs[i][1], "text": texts[i][:200],
             "why": "meaning+keyword" if kw[i] > 0 else "meaning only"}
            for i in np.argsort(-fused)[:3]]


@app.post("/index")
def index(items: list[Msg]):
    added = add([[i.date, i.sender, i.text] for i in items])
    return {"added": added, "total": len(texts)}


@app.post("/import")
def import_zip(req: ImportReq):
    p = Path(req.path).resolve()
    in_downloads = "downloads" in [part.lower() for part in p.parts]
    if not (in_downloads and p.suffix.lower() == ".zip" and p.is_file()):
        raise HTTPException(400, "Not an allowed file")
    with zipfile.ZipFile(p) as z:
        name = next((n for n in z.namelist() if n.lower().endswith(".md")), None)
        if not name:
            raise HTTPException(400, "No .md file in the zip")
        with z.open(name) as raw:
            lines = io.TextIOWrapper(raw, encoding="utf-8-sig").read().splitlines()
    if not lines or not lines[0].startswith("# WhatsApp Chat Export"):
        raise HTTPException(400, "Not a WhatsApp export")
    return {"added": add(parse_lines(lines)), "total": len(texts)}


@app.post("/clear")
def clear():
    global emb, bm25
    msgs.clear()
    texts.clear()
    seen.clear()
    emb = np.zeros((0, DIM), dtype=np.float32)
    bm25 = None
    return {"total": 0}