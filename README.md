\# Semantic Chat Search (local)



Search a WhatsApp Web chat by meaning, not just keywords. Searching "trip plan" finds "Let's go to ooty next month", even though they share no words.



Everything runs on your own PC. Nothing is sent to any cloud service.



\## How it works



1\. Click \*\*Activate\*\* in the search box on WhatsApp Web.

2\. The extension exports the open chat using WhatsApp's own Export chat feature.

3\. A local Python server unzips the export in memory and indexes the messages.

4\. Search combines meaning-based search (all-MiniLM-L6-v2) with keyword search (BM25). Each result shows who sent it and when.

5\. Click \*\*Deactivate\*\*: the exported zip is deleted from Downloads and the index is cleared.



When the extension is not activated, it reads nothing.



\## Privacy



\- The search server listens only on `127.0.0.1` (your own computer).

\- The extension can contact only `127.0.0.1:8000` and `web.whatsapp.com`.

\- Permissions: `downloads` (to notice the export and delete it later), `storage` (to remember the active state for the browser session).

\- No analytics, no tracking.

\- The AI model is downloaded once from Hugging Face on first run.

\- Exported chats are never saved by this project. `.gitignore` blocks them from the repository.



\## Setup (Windows)



```

python -m venv venv

venv\\Scripts\\activate

pip install sentence-transformers numpy rank-bm25 fastapi uvicorn

uvicorn server:app --host 127.0.0.1 --port 8000

```



Then in Chrome: open `chrome://extensions`, turn on Developer mode, click \*\*Load unpacked\*\*, and choose the `extension` folder. Open WhatsApp Web, open a chat, and click \*\*Activate\*\*.



\## Known limits



\- Works on one chat at a time (the chat that is open when you click Activate).

\- Needs WhatsApp Web in English, because the extension finds buttons by their labels.

\- WhatsApp can change its page layout and break the automatic export. If so, use the chat menu (⋮) → Export chat → Export yourself, and the rest still works.

\- Needs the local Python server running.

\- Tested on a single small chat. There is no accuracy benchmark yet.

\- The English model is weak on romanized Tamil ("Tanglish").

\- The server only reads zips from a folder named Downloads.



\## Roadmap



\- A browser-only version with no Python server.

\- A benchmark of search quality against plain keyword search.

\- A multilingual model for Tamil and Tanglish.

