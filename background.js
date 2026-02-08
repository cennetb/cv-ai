/* background.js (Service Worker)
 * Message hub:
 * - GET_PROFILE, SET_PROFILE
 * - TOGGLE_DEBUG
 * - SITE_RULES (get/set)
 * - PING, FILL_FORM (broadcast to all frames)
 */

"use strict";

const DEFAULTS = {
  profile: {
    firstName: "",
    lastName: "",
    fullName: "",
    email: "",
    phone: "",
    addressLine: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    linkedin: "",
    github: "",
    website: "",
    dateOfBirth: "",
    summary: "",
    coverLetter: "",
    graduationYear: "",
    experienceYears: "",
    salaryExpectation: "",
  },
  settings: {
    debug: false,
    nameLock: {
      enabled: true,
      mode: "IF_EMPTY", // IF_EMPTY | NEVER | PROTECT
    },
    fillPolicy: {
      skipIfNotEmpty: true,
      dryRun: false,
    },
  },
  siteRules: {
    mode: "neutral", // neutral | whitelist | blacklist
    domains: {
      // "example.com": { rule: "whitelist"|"blacklist", enabledTypes: [...], disabledTypes: [...], customMap: {...} }
    },
  },
};

function withLastError(label) {
  const err = chrome.runtime.lastError;
  if (err) console.warn("[CV Asistan]", label, err.message);
  return err;
}

async function storageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (res) => {
      withLastError("storage.get");
      resolve(res || {});
    });
  });
}

async function storageSet(obj) {
  return new Promise((resolve) => {
    chrome.storage.local.set(obj, () => {
      withLastError("storage.set");
      resolve(true);
    });
  });
}

async function ensureDefaults() {
  const cur = await storageGet(["profile", "settings", "siteRules"]);
  const next = {
    profile: { ...DEFAULTS.profile, ...(cur.profile || {}) },
    settings: { ...DEFAULTS.settings, ...(cur.settings || {}) },
    siteRules: { ...DEFAULTS.siteRules, ...(cur.siteRules || {}) },
  };
  await storageSet(next);
  return next;
}

chrome.runtime.onInstalled.addListener(() => {
  ensureDefaults().catch((e) => console.warn("[CV Asistan] init error", e));
});

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs && tabs[0] ? tabs[0] : null;
}

function getDomainFromUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

function isAllowedByRules(domain, siteRules) {
  const mode = siteRules?.mode || "neutral";
  const entry = siteRules?.domains?.[domain];

  if (mode === "neutral") {
    if (entry?.rule === "blacklist")
      return { allowed: false, reason: "domain blacklisted" };
    return { allowed: true, reason: "neutral" };
  }

  if (mode === "whitelist") {
    if (entry?.rule === "whitelist")
      return { allowed: true, reason: "domain whitelisted" };
    return { allowed: false, reason: "not in whitelist mode list" };
  }

  if (mode === "blacklist") {
    if (entry?.rule === "blacklist")
      return { allowed: false, reason: "domain blacklisted (mode)" };
    return { allowed: true, reason: "blacklist mode allow" };
  }

  return { allowed: true, reason: "default allow" };
}

async function getAllFrameIds(tabId) {
  // Needs "webNavigation" permission
  return new Promise((resolve) => {
    chrome.webNavigation.getAllFrames({ tabId }, (frames) => {
      withLastError("webNavigation.getAllFrames");
      const ids = (frames || [])
        .map((f) => f.frameId)
        .filter((v) => typeof v === "number");
      // Ensure top frame 0 exists
      if (!ids.includes(0)) ids.unshift(0);
      resolve(Array.from(new Set(ids)));
    });
  });
}

async function sendToFrame(tabId, frameId, msg) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, msg, { frameId }, (res) => {
      const err = withLastError("tabs.sendMessage");
      if (err) return resolve({ ok: false, frameId, error: err.message });
      resolve({ ok: true, frameId, res });
    });
  });
}

async function broadcastToAllFrames(tabId, msg) {
  let frameIds = [];
  try {
    frameIds = await getAllFrameIds(tabId);
  } catch {
    frameIds = [0];
  }

  const results = await Promise.allSettled(
    frameIds.map((fid) => sendToFrame(tabId, fid, msg)),
  );

  const normalized = results.map((r, idx) => {
    if (r.status === "fulfilled") return r.value;
    return { ok: false, frameId: frameIds[idx], error: String(r.reason) };
  });

  return normalized;
}

function summarizeFillResults(frameResults) {
  const summary = {
    framesResponded: 0,
    filled: 0,
    skipped: 0,
    errors: 0,
    reports: [],
  };

  for (const fr of frameResults) {
    if (!fr.ok) {
      summary.errors++;
      continue;
    }
    const payload = fr.res;
    if (!payload || !payload.ok) {
      summary.errors++;
      continue;
    }
    summary.framesResponded++;
    const rep = payload.report;
    if (rep?.stats) {
      summary.filled += rep.stats.filled || 0;
      summary.skipped += rep.stats.skipped || 0;
      summary.errors += rep.stats.errors || 0;
      summary.reports.push(rep);
    }
  }
  return summary;
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  (async () => {
    try {
      await ensureDefaults();

      if (!request || !request.action) return;

      if (request.action === "GET_PROFILE") {
        const { profile, settings, siteRules } = await storageGet([
          "profile",
          "settings",
          "siteRules",
        ]);
        sendResponse({ ok: true, profile, settings, siteRules });
        return;
      }

      if (request.action === "SET_PROFILE") {
        const nextProfile = request.profile || {};
        await storageSet({ profile: nextProfile });
        sendResponse({ ok: true });
        return;
      }

      if (request.action === "SET_SETTINGS") {
        const nextSettings = request.settings || {};
        await storageSet({ settings: nextSettings });
        sendResponse({ ok: true });
        return;
      }

      if (request.action === "SITE_RULES_GET") {
        const { siteRules } = await storageGet(["siteRules"]);
        sendResponse({ ok: true, siteRules });
        return;
      }

      if (request.action === "SITE_RULES_SET") {
        const siteRules = request.siteRules || DEFAULTS.siteRules;
        await storageSet({ siteRules });
        sendResponse({ ok: true });
        return;
      }

      if (request.action === "TOGGLE_DEBUG") {
        const { settings } = await storageGet(["settings"]);
        const next = {
          ...(settings || DEFAULTS.settings),
          debug: !!request.debug,
        };
        await storageSet({ settings: next });

        const tab = await getActiveTab();
        if (tab?.id) {
          await broadcastToAllFrames(tab.id, {
            action: "TOGGLE_DEBUG",
            debug: next.debug,
          });
        }
        sendResponse({ ok: true, debug: next.debug });
        return;
      }

      if (request.action === "PING") {
        const tab = await getActiveTab();
        if (!tab?.id) {
          sendResponse({ ok: false, error: "No active tab" });
          return;
        }
        const frameResults = await broadcastToAllFrames(tab.id, {
          action: "PING",
        });
        sendResponse({ ok: true, frames: frameResults });
        return;
      }

      if (request.action === "FILL_FORM") {
        const tab = await getActiveTab();
        if (!tab?.id) {
          sendResponse({ ok: false, error: "No active tab" });
          return;
        }

        const { profile, settings, siteRules } = await storageGet([
          "profile",
          "settings",
          "siteRules",
        ]);
        const domain = getDomainFromUrl(tab.url || "");
        const allow = isAllowedByRules(domain, siteRules || DEFAULTS.siteRules);
        if (!allow.allowed) {
          sendResponse({
            ok: false,
            blocked: true,
            reason: allow.reason,
            domain,
          });
          return;
        }

        // Determine enabledTypes based on site rule (optional)
        const domainRule = siteRules?.domains?.[domain] || null;
        let enabledTypes = null;

        if (domainRule?.enabledTypes?.length)
          enabledTypes = domainRule.enabledTypes.slice();
        if (domainRule?.disabledTypes?.length) {
          // If both exist, remove disabled from enabled or from defaults on content side
          // Here we pass disabledTypes as hint too.
        }

        const msg = {
          action: "FILL_FORM",
          profile: profile || DEFAULTS.profile,
          settings: settings || DEFAULTS.settings,
          options: {
            enabledTypes,
            disabledTypes: domainRule?.disabledTypes || [],
            customMap: domainRule?.customMap || null,
          },
        };

        const frameResults = await broadcastToAllFrames(tab.id, msg);
        const summary = summarizeFillResults(frameResults);

        sendResponse({ ok: true, domain, allow: allow.reason, summary });
        return;
      }

      sendResponse({ ok: false, error: "Unknown action" });
    } catch (e) {
      console.warn("[CV Asistan] background error:", e);
      sendResponse({ ok: false, error: String(e) });
    }
  })();

  return true;
});
