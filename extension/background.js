const SERVER = "http://127.0.0.1:8000";
const DELETE_AFTER_IMPORT = false;

function post(path, body) {
  return fetch(SERVER + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  }).then((r) => r.json());
}

function call(url, options, sendResponse) {
  fetch(url, options)
    .then((r) => r.json())
    .then((data) => sendResponse({ ok: true, data: data }))
    .catch(() => sendResponse({ ok: false }));
}

async function notify(text) {
  const tabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
  tabs.forEach((t) =>
    chrome.tabs.sendMessage(t.id, { type: "status", text: text }).catch(() => {})
  );
}

async function removeDownloads(ids) {
  for (const id of ids) {
    try { await chrome.downloads.removeFile(id); } catch (e) {}
    try { await chrome.downloads.erase({ id: id }); } catch (e) {}
  }
}

chrome.downloads.onChanged.addListener(async (delta) => {
  if (!delta.state || delta.state.current !== "complete") return;
  const { active, ids = [] } = await chrome.storage.session.get(["active", "ids"]);
  if (!active) return;

  const [item] = await chrome.downloads.search({ id: delta.id });
  if (!item || !item.filename.toLowerCase().endsWith(".zip")) return;

  await notify("Export found. Importing...");
  try {
    const res = await post("/import", { path: item.filename });
    if (res.added === undefined) {
      await notify("That zip is not a WhatsApp export.");
      return;
    }
    if (DELETE_AFTER_IMPORT) {
      await removeDownloads([item.id]);
    } else {
      await chrome.storage.session.set({ ids: [...ids, item.id] });
    }
    await notify("Imported " + res.total + " messages. Ready to search.");
  } catch (e) {
    await notify("Search server is not running.");
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;

  if (msg.type === "search") {
    call(SERVER + "/search?q=" + encodeURIComponent(msg.q), {}, sendResponse);
    return true;
  }

  if (msg.type === "index") {
    call(
      SERVER + "/index",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(msg.items),
      },
      sendResponse
    );
    return true;
  }

  if (msg.type === "activate") {
    chrome.storage.session
      .set({ active: true, ids: [] })
      .then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.type === "deactivate") {
    (async () => {
      const { ids = [] } = await chrome.storage.session.get("ids");
      await removeDownloads(ids);
      await chrome.storage.session.set({ active: false, ids: [] });
      try { await post("/clear"); } catch (e) {}
      sendResponse({ ok: true, removed: ids.length });
    })();
    return true;
  }
});