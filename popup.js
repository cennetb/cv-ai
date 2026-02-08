"use strict";

const $ = (id) => document.getElementById(id);

function setStatus(text) {
  $("status").textContent = text;
}

async function bgSend(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (res) =>
      resolve(res || { ok: false, error: "no response" }),
    );
  });
}

async function getActiveDomain() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tabs?.[0]?.url || "";
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

async function loadInitial() {
  const res = await bgSend({ action: "GET_PROFILE" });
  if (!res.ok) {
    setStatus("Storage okunamadı.");
    return;
  }
  $("debugToggle").checked = !!res.settings?.debug;
  setStatus("Hazır.");
}

async function toggleDebug() {
  const debug = $("debugToggle").checked;
  const res = await bgSend({ action: "TOGGLE_DEBUG", debug });
  if (!res.ok) setStatus("Debug değiştirilemedi: " + (res.error || ""));
  else setStatus("Debug: " + (res.debug ? "Açık" : "Kapalı"));
}

async function pingFrames() {
  setStatus("PING atılıyor...");
  const res = await bgSend({ action: "PING" });
  if (!res.ok) {
    setStatus("PING hata: " + (res.error || ""));
    return;
  }
  const frames = res.frames || [];
  const okCount = frames.filter((f) => f.ok && f.res && f.res.ok).length;
  setStatus(`PING tamam.\nFrame cevap: ${okCount}/${frames.length}`);
}

async function fillForm() {
  setStatus("Form dolduruluyor...");
  const res = await bgSend({ action: "FILL_FORM" });

  if (!res.ok) {
    if (res.blocked) {
      setStatus(
        `Bu sitede engelli.\nDomain: ${res.domain}\nSebep: ${res.reason}`,
      );
      return;
    }
    setStatus("Hata: " + (res.error || "unknown"));
    return;
  }

  const s = res.summary;
  setStatus(
    `Domain: ${res.domain}\n` +
      `Frames: ${s.framesResponded}\n` +
      `Filled: ${s.filled}\n` +
      `Skipped: ${s.skipped}\n` +
      `Errors: ${s.errors}`,
  );
}

async function updateDomainRule(rule) {
  const domain = await getActiveDomain();
  if (!domain) {
    setStatus("Domain alınamadı.");
    return;
  }
  const get = await bgSend({ action: "SITE_RULES_GET" });
  if (!get.ok) {
    setStatus("Site kuralları okunamadı.");
    return;
  }
  const siteRules = get.siteRules || { mode: "neutral", domains: {} };
  siteRules.domains = siteRules.domains || {};
  siteRules.domains[domain] = siteRules.domains[domain] || {};
  siteRules.domains[domain].rule = rule;

  const set = await bgSend({ action: "SITE_RULES_SET", siteRules });
  if (!set.ok) {
    setStatus("Kural yazılamadı.");
    return;
  }
  setStatus(`Kural güncellendi:\n${domain} => ${rule}`);
}

document.addEventListener("DOMContentLoaded", () => {
  $("fillBtn").addEventListener("click", fillForm);
  $("debugToggle").addEventListener("change", toggleDebug);
  $("pingBtn").addEventListener("click", pingFrames);
  $("wlBtn").addEventListener("click", () => updateDomainRule("whitelist"));
  $("blBtn").addEventListener("click", () => updateDomainRule("blacklist"));
  $("openOptions").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  loadInitial().catch(() => setStatus("Başlatma hatası."));
});
