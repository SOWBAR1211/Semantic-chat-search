import re, sys
import numpy as np
from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer
from parse import load

sys.stdout.reconfigure(encoding="utf-8")

MODEL = "all-MiniLM-L6-v2"

msgs = [m for m in load("chat.txt")
        if "<Media omitted>" not in m[2] and len(m[2].split()) >= 2]
texts = [m[2] for m in msgs]
print("Messages used:", len(texts))

tok = lambda s: re.findall(r"\w+", s.lower())
bm25 = BM25Okapi([tok(t) for t in texts])

model = SentenceTransformer(MODEL)
emb = model.encode(texts, normalize_embeddings=True, show_progress_bar=True)

def ranks(scores):
    order = np.argsort(-scores)
    r = np.empty(len(scores), dtype=int)
    r[order] = np.arange(len(scores))
    return r

while True:
    q = input("\nsearch> ").strip()
    if not q:
        break
    sem = emb @ model.encode([q], normalize_embeddings=True)[0]
    kw = bm25.get_scores(tok(q))

    fused = 1 / (60 + ranks(sem))
    fused = fused + np.where(kw > 0, 1 / (60 + ranks(kw)), 0)

    print("\nTOP 3 (hybrid):")
    for i in np.argsort(-fused)[:3]:
        tag = "meaning+keyword" if kw[i] > 0 else "meaning only"
        print(f"  [{tag}] {msgs[i][0]} | {msgs[i][1]}: {texts[i][:80]}")
