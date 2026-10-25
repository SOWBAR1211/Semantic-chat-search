function readMessages() {
  const out = [];
  document.querySelectorAll("[data-pre-plain-text]").forEach((el) => {
    const label = el.getAttribute("data-pre-plain-text") || "";
    const m = /^\[([^,]+), ([^\]]+)\] (.*?): ?$/.exec(label);
    const text = el.innerText.trim();
    if (m && text) out.push({ date: m[2], sender: m[3], text: text });
  });
  return out;
}

let active = false;
const sentKeys = new Set();
const keyOf = (m) => m.sender + "|" + m.date + "|" + m.text;

const box = document.createElement("div");
box.style.cssText =
  "position:fixed;bottom:20px;right:20px;width:320px;z-index:99999;" +
  "background:#fff;color:#111;border:1px solid #ccc;border-radius:10px;" +
  "padding:10px;font:14px sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.3)";

const input = document.createElement("input");
input.placeholder = "Semantic search (press Enter)";
input.style.cssText = "width:100%;box-sizing:border-box;padding:6px";

const results = document.createElement("div");
results.style.marginTop = "8px";

const status = document.createElement("div");
status.style.cssText = "font-size:12px;color:#666;margin-top:6px";
status.textContent = "Inactive. Click Activate to begin.";

const btn = document.createElement("button");
btn.textContent = "Activate";
btn.style.cssText = "margin-top:6px;padding:4px 10px";

box.append(input, results, status, btn);
document.body.appendChild(box);

function showResults(items) {
  results.textContent = "";
  if (!items.length) {
    results.textContent = "No results yet.";
    return;
  }
  items.forEach((item) => {
    const row = document.createElement("div");
    row.style.cssText = "padding:6px 0;border-top:1px solid #eee";

    const meta = document.createElement("div");
    meta.style.cssText = "font-size:11px;color:#666";
    meta.textContent = item.sender + " · " + item.date + " · " + item.why;

    const text = document.createElement("div");
    text.textContent = item.text;

    row.append(meta, text);
    results.appendChild(row);
  });
}

function autoIndex() {
  if (!active) return;
  const fresh = readMessages().filter((m) => !sentKeys.has(keyOf(m)));
  if (!fresh.length) return;
  chrome.runtime.sendMessage({ type: "index", items: fresh }, (res) => {
    if (res && res.ok) fresh.forEach((m) => sentKeys.add(keyOf(m)));
  });
}

let timer = null;
new MutationObserver(() => {
  clearTimeout(timer);
  timer = setTimeout(autoIndex, 800);
}).observe(document.body, { childList: true, subtree: true });

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (sender.id !== chrome.runtime.id) return;
  if (msg.type === "status") status.textContent = msg.text;
});

btn.addEventListener("click", () => {
  if (!active) {
    active = true;
    btn.textContent = "Deactivate";
       status.textContent = "Active. Exporting this chat...";
    chrome.runtime.sendMessage({ type: "activate" }, () => {
      autoExport().then((ok) => {
        if (!ok) status.textContent =
          "Couldn't click Export automatically. Use the chat menu (⋮) → Export chat → Export.";
      });
    });
    autoIndex();  } else {
    active = false;
    btn.textContent = "Activate";
    sentKeys.clear();
    results.textContent = "";
    input.value = "";
    chrome.runtime.sendMessage({ type: "deactivate" }, (res) => {
      status.textContent = res && res.ok
        ? "Deactivated. Deleted " + res.removed + " file(s) and cleared the index."
        : "Deactivated.";
    });
  }
});

input.addEventListener("keydown", (e) => {
  e.stopPropagation();
  if (e.key !== "Enter") return;
  if (!active) {
    status.textContent = "Click Activate first.";
    return;
  }
  const q = input.value.trim();
  if (!q) return;
  results.textContent = "Searching...";
  chrome.runtime.sendMessage({ type: "search", q: q }, (res) => {
    if (!res || !res.ok) {
      results.textContent = "Search server is not running.";
      return;
    }
    showResults(res.data);
  });
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(finder, tries = 20) {
  for (let i = 0; i < tries; i++) {
    const el = finder();
    if (el) return el;
    await wait(250);
  }
  return null;
}

async function autoExport() {
  const menu = document.querySelector('#main header button[aria-label="Menu"]');
  if (!menu) return false;
  menu.click();

  const item = await waitFor(() =>
    [...document.querySelectorAll("span")].find(
      (e) => e.children.length === 0 && /export chat/i.test(e.textContent) && e.textContent.length < 20
    )
  );
  if (!item) return false;
  item.click();

  const exportBtn = await waitFor(() => {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg) return null;
    return [...dlg.querySelectorAll("button")].find((b) => /^export$/i.test(b.textContent.trim()));
  });
  if (!exportBtn) return false;
  exportBtn.click();
  return true;
}