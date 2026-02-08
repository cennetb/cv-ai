"use strict";

const FIELDS = [
  "firstName",
  "lastName",
  "fullName",
  "email",
  "phone",
  "addressLine",
  "city",
  "state",
  "postalCode",
  "country",
  "linkedin",
  "github",
  "website",
  "dateOfBirth",
  "summary",
  "coverLetter",
  "graduationYear",
  "experienceYears",
  "salaryExpectation",
];

const $ = (id) => document.getElementById(id);

async function bgSend(msg) {
  return new Promise((resolve) =>
    chrome.runtime.sendMessage(msg, (res) => resolve(res || { ok: false })),
  );
}

function setText(id, text) {
  $(id).textContent = text;
  setTimeout(() => {
    if ($(id).textContent === text) $(id).textContent = "";
  }, 2500);
}

function renderRules(siteRules) {
  const box = $("rulesTable");
  box.innerHTML = "";

  const domains = siteRules?.domains || {};
  const keys = Object.keys(domains).sort();

  if (!keys.length) {
    box.textContent = "Henüz domain kuralı yok.";
    return;
  }

  for (const d of keys) {
    const rule = domains[d]?.rule || "neutral";
    const row = document.createElement("div");
    row.className = "ruleItem";
    row.innerHTML = `<div><code>${d}</code></div><div>${rule}</div>`;
    box.appendChild(row);
  }
}

async function loadAll() {
  const res = await bgSend({ action: "GET_PROFILE" });
  if (!res.ok) {
    setText("profileStatus", "Storage okunamadı.");
    return;
  }

  const profile = res.profile || {};
  const settings = res.settings || {};
  const siteRules = res.siteRules || { mode: "neutral", domains: {} };

  for (const k of FIELDS) {
    if ($(k)) $(k).value = profile[k] || "";
  }

  $("debug").checked = !!settings.debug;
  $("skipIfNotEmpty").checked = settings.fillPolicy?.skipIfNotEmpty !== false;
  $("dryRun").checked = !!settings.fillPolicy?.dryRun;

  $("nameLockEnabled").checked = settings.nameLock?.enabled !== false;
  $("nameLockMode").value = settings.nameLock?.mode || "IF_EMPTY";

  $("siteMode").value = siteRules.mode || "neutral";

  renderRules(siteRules);
}

async function saveProfile() {
  const profile = {};
  for (const k of FIELDS) profile[k] = ($(k)?.value || "").trim();

  const res = await bgSend({ action: "SET_PROFILE", profile });
  if (!res.ok) setText("profileStatus", "Kaydetme hatası.");
  else setText("profileStatus", "Profil kaydedildi.");
}

async function saveSettingsAndRules() {
  const get = await bgSend({ action: "GET_PROFILE" });
  if (!get.ok) {
    setText("settingsStatus", "Storage okunamadı.");
    return;
  }
  const settings = get.settings || {};
  const siteRules = get.siteRules || { mode: "neutral", domains: {} };

  const nextSettings = {
    ...settings,
    debug: $("debug").checked,
    fillPolicy: {
      skipIfNotEmpty: $("skipIfNotEmpty").checked,
      dryRun: $("dryRun").checked,
    },
    nameLock: {
      enabled: $("nameLockEnabled").checked,
      mode: $("nameLockMode").value,
    },
  };

  const nextSiteRules = {
    ...siteRules,
    mode: $("siteMode").value,
  };

  const s1 = await bgSend({ action: "SET_SETTINGS", settings: nextSettings });
  const s2 = await bgSend({
    action: "SITE_RULES_SET",
    siteRules: nextSiteRules,
  });

  if (s1.ok && s2.ok) setText("settingsStatus", "Ayarlar kaydedildi.");
  else setText("settingsStatus", "Kaydetme hatası.");
}

async function addOrUpdateDomainRule() {
  const domain = ($("domainInput").value || "").trim().replace(/^www\./i, "");
  if (!domain) return;

  const get = await bgSend({ action: "SITE_RULES_GET" });
  if (!get.ok) return;

  const siteRules = get.siteRules || { mode: "neutral", domains: {} };
  siteRules.domains = siteRules.domains || {};
  siteRules.domains[domain] = siteRules.domains[domain] || {};
  siteRules.domains[domain].rule = $("domainRule").value;

  const set = await bgSend({ action: "SITE_RULES_SET", siteRules });
  if (set.ok) {
    $("domainInput").value = "";
    renderRules(siteRules);
    setText("settingsStatus", `Domain kuralı güncellendi: ${domain}`);
  }
}

async function exportJson() {
  const res = await bgSend({ action: "GET_PROFILE" });
  if (!res.ok) return;

  const data = {
    profile: res.profile || {},
    settings: res.settings || {},
    siteRules: res.siteRules || {},
  };
  const json = JSON.stringify(data, null, 2);
  $("jsonBox").textContent = json;
}

async function importJsonFromFile(file) {
  const text = await file.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    setText("settingsStatus", "Geçersiz JSON.");
    return;
  }

  const profile = parsed.profile || {};
  const settings = parsed.settings || {};
  const siteRules = parsed.siteRules || {};

  const s1 = await bgSend({ action: "SET_PROFILE", profile });
  const s2 = await bgSend({ action: "SET_SETTINGS", settings });
  const s3 = await bgSend({ action: "SITE_RULES_SET", siteRules });

  if (s1.ok && s2.ok && s3.ok) {
    await loadAll();
    setText("settingsStatus", "Import başarılı.");
  } else {
    setText("settingsStatus", "Import hatası.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  $("saveProfile").addEventListener("click", saveProfile);
  $("saveSettings").addEventListener("click", saveSettingsAndRules);
  $("addDomain").addEventListener("click", addOrUpdateDomainRule);

  $("exportJson").addEventListener("click", exportJson);
  $("importJson").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    if (f) await importJsonFromFile(f);
    e.target.value = "";
  });

  loadAll().catch(() => setText("settingsStatus", "Başlatma hatası."));
});
