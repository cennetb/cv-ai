/* utils.js
 * Global helper namespace: window.CVAUtils
 * - Normalize profile values
 * - Field detection and scoring
 * - Visibility checks
 * - Value setting for controlled inputs (React/Vue)
 */

(() => {
  "use strict";

  const STOP_WORDS = new Set(["*", ":", "-", "—", "(", ")", "[", "]"]);

  // TR + EN synonyms / signals
  const FIELD_SYNONYMS = {
    firstName: [
      "first name",
      "given name",
      "forename",
      "ad",
      "isim",
      "adı",
      "adınız",
      "adiniz",
    ],
    lastName: [
      "last name",
      "surname",
      "family name",
      "soyad",
      "soyadı",
      "soyadınız",
      "soyadiniz",
    ],
    fullName: [
      "full name",
      "name",
      "your name",
      "ad soyad",
      "isim soyisim",
      "adınız soyadınız",
      "adiniz soyadiniz",
    ],
    email: ["email", "e-mail", "mail", "eposta", "e posta", "e-posta"],
    phone: [
      "phone",
      "mobile",
      "telephone",
      "tel",
      "cell",
      "telefon",
      "cep",
      "gsm",
      "mobil",
    ],
    addressLine: [
      "address",
      "address line",
      "street",
      "street address",
      "adres",
      "adres satırı",
      "sokak",
      "cadde",
      "mahalle",
    ],
    city: ["city", "town", "şehir", "sehir", "ilçe", "ilce", "il"],
    state: ["state", "province", "region", "eyalet", "bölge", "bolge", "il"],
    postalCode: [
      "zip",
      "zipcode",
      "postal",
      "postal code",
      "posta kodu",
      "pk",
      "zip code",
    ],
    country: ["country", "nation", "ülke", "ulke"],
    linkedin: ["linkedin", "linked in", "linkedin url", "linkedin profili"],
    github: ["github", "github url", "git hub"],
    website: [
      "website",
      "web site",
      "portfolio",
      "site",
      "kişisel site",
      "kisisel site",
      "portföy",
      "portfoy",
    ],
    dateOfBirth: [
      "date of birth",
      "birth date",
      "dob",
      "birthday",
      "doğum tarihi",
      "dogum tarihi",
    ],
    summary: [
      "summary",
      "about",
      "about me",
      "bio",
      "profil",
      "hakkımda",
      "hakkimda",
      "özet",
      "ozet",
    ],
    coverLetter: [
      "cover letter",
      "motivation letter",
      "additional information",
      "additional info",
      "anything else",
      "message",
      "notes",
      "comment",
      "ön yazı",
      "on yazı",
      "niyet mektubu",
      "ek bilgi",
      "ek bilgiler",
      "mesaj",
      "not",
      "açıklama",
      "aciklama",
    ],
    graduationYear: [
      "graduation year",
      "graduation date",
      "graduated",
      "degree date",
      "mezuniyet",
      "mezuniyet yılı",
      "mezuniyet yili",
      "mezun olma",
      "mezun oldum",
    ],
    experienceYears: [
      "years of experience",
      "experience",
      "work experience",
      "yoe",
      "tecrübe",
      "tecrube",
      "deneyim",
      "kaç yıl",
      "kac yil",
      "yıl deneyim",
    ],
    salaryExpectation: [
      "salary expectation",
      "expected salary",
      "salary",
      "compensation",
      "pay",
      "maaş beklentisi",
      "maas beklentisi",
      "beklenen maaş",
      "ucret",
      "ücret",
      "maaş",
      "maas",
    ],
  };

  const AUTOCOMPLETE_MAP = {
    "given-name": "firstName",
    "additional-name": "firstName",
    "family-name": "lastName",
    name: "fullName",
    email: "email",
    tel: "phone",
    "tel-national": "phone",
    "tel-country-code": "phone",
    "street-address": "addressLine",
    "address-line1": "addressLine",
    "address-line2": "addressLine",
    "address-level2": "city",
    "address-level1": "state",
    "postal-code": "postalCode",
    country: "country",
    bday: "dateOfBirth",
  };

  function safeStr(v) {
    if (v === null || v === undefined) return "";
    return String(v).trim();
  }

  function normalizePhone(phone) {
    let p = safeStr(phone);
    if (!p) return "";
    // Keep leading +, remove other non-digits
    const plus = p.trim().startsWith("+");
    p = p.replace(/[^\d]/g, "");
    if (plus) p = "+" + p;
    return p;
  }

  function normalizeUrl(url) {
    let u = safeStr(url);
    if (!u) return "";
    // Basic normalize: add https if looks like domain and missing scheme
    if (!/^https?:\/\//i.test(u) && /^[a-z0-9.-]+\.[a-z]{2,}/i.test(u)) {
      u = "https://" + u;
    }
    return u;
  }

  function normalizeProfile(raw = {}) {
    const profile = {
      firstName: safeStr(raw.firstName),
      lastName: safeStr(raw.lastName),
      fullName: safeStr(raw.fullName),
      email: safeStr(raw.email).toLowerCase(),
      phone: normalizePhone(raw.phone),
      addressLine: safeStr(raw.addressLine),
      city: safeStr(raw.city),
      state: safeStr(raw.state),
      postalCode: safeStr(raw.postalCode),
      country: safeStr(raw.country),
      linkedin: normalizeUrl(raw.linkedin),
      github: normalizeUrl(raw.github),
      website: normalizeUrl(raw.website),
      dateOfBirth: safeStr(raw.dateOfBirth),
      summary: safeStr(raw.summary),
      coverLetter: safeStr(raw.coverLetter),
      graduationYear: safeStr(raw.graduationYear),
      experienceYears: safeStr(raw.experienceYears),
      salaryExpectation: safeStr(raw.salaryExpectation),
    };

    // Derive fullName if missing
    if (!profile.fullName) {
      const fn = profile.firstName;
      const ln = profile.lastName;
      profile.fullName = [fn, ln].filter(Boolean).join(" ").trim();
    }

    // Derive first/last if missing but fullName exists
    if ((!profile.firstName || !profile.lastName) && profile.fullName) {
      const parts = profile.fullName.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        if (!profile.firstName) profile.firstName = parts[0];
        if (!profile.lastName) profile.lastName = parts.slice(1).join(" ");
      }
    }

    return profile;
  }

  function isVisible(el) {
    try {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      if (!style) return false;
      if (style.visibility === "hidden" || style.display === "none")
        return false;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return false;
      // Hidden via attribute
      if (el.hasAttribute("hidden")) return false;
      return true;
    } catch {
      return false;
    }
  }

  function isFillableElement(el) {
    if (!el) return false;
    const tag = (el.tagName || "").toLowerCase();
    if (tag === "textarea" || tag === "select") return true;
    if (tag !== "input") return false;
    const type = (el.getAttribute("type") || "text").toLowerCase();

    // Disallow sensitive/hazardous types
    if (type === "password") return false;
    if (type === "hidden") return false;
    if (type === "file") return false;
    if (type === "submit" || type === "button" || type === "reset")
      return false;
    if (type === "checkbox" || type === "radio") return false;
    // allow: text, email, tel, url, search, number, date
    return true;
  }

  function getElementTextSignals(el) {
    // Collect signals from label, placeholder, aria-label, name, id, autocomplete, data-testid
    const signals = [];

    const add = (s, weight, source) => {
      const t = safeStr(s);
      if (!t) return;
      signals.push({ text: t, weight, source });
    };

    // placeholder
    add(el.getAttribute?.("placeholder"), 4, "placeholder");
    // aria-label
    add(el.getAttribute?.("aria-label"), 5, "aria-label");
    // name/id
    add(el.getAttribute?.("name"), 3, "name");
    add(el.getAttribute?.("id"), 3, "id");
    // autocomplete
    add(el.getAttribute?.("autocomplete"), 7, "autocomplete");
    // data-testid or similar
    add(el.getAttribute?.("data-testid"), 2, "data-testid");
    add(el.getAttribute?.("data-test"), 2, "data-test");
    add(el.getAttribute?.("data-qa"), 2, "data-qa");

    // label: <label for="...">
    const id = el.getAttribute?.("id");
    if (id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (lbl) add(lbl.innerText, 9, "label-for");
    }

    // label wrapping input: <label> Text <input /></label>
    const parentLabel = el.closest?.("label");
    if (parentLabel) add(parentLabel.innerText, 9, "label-wrap");

    // nearest preceding label-like element
    // (common on modern UIs)
    const near = findNearestLabelText(el);
    if (near) add(near, 6, "near-label");

    return signals;
  }

  function findNearestLabelText(el) {
    try {
      // Look within the same container for label-ish elements
      const container =
        el.closest("div, section, form, fieldset") || el.parentElement;
      if (!container) return "";
      const labelCandidates = [];
      const labels = container.querySelectorAll(
        "label, [role='label'], .label, .field-label, .form-label",
      );
      labels.forEach((l) => {
        if (!l) return;
        const text = safeStr(l.innerText);
        if (!text) return;
        const r = l.getBoundingClientRect();
        const er = el.getBoundingClientRect();
        // label above or left, near the input
        const verticalDist = Math.abs(er.top - r.bottom);
        const horizontalDist = Math.abs(er.left - r.right);
        const isAbove = r.bottom <= er.top + 8;
        const isLeft = r.right <= er.left + 8;
        const dist = Math.min(verticalDist, horizontalDist);
        if ((isAbove || isLeft) && dist < 80) {
          labelCandidates.push({ text, dist });
        }
      });
      labelCandidates.sort((a, b) => a.dist - b.dist);
      return labelCandidates[0]?.text || "";
    } catch {
      return "";
    }
  }

  function tokenize(text) {
    const t = safeStr(text).toLowerCase();
    if (!t) return [];
    // Replace separators with spaces
    const cleaned = t
      .replace(/[_/\\|]+/g, " ")
      .replace(/[^\p{L}\p{N}\s+-]/gu, " ");
    const parts = cleaned.split(/\s+/).filter(Boolean);
    return parts.filter((p) => !STOP_WORDS.has(p));
  }

  function scoreFieldType(el, fieldType) {
    const signals = getElementTextSignals(el);
    const tokensBySignal = signals.map((s) => ({
      ...s,
      tokens: tokenize(s.text),
    }));

    let score = 0;
    const reasons = [];

    // Autocomplete exact mapping
    const ac = safeStr(el.getAttribute?.("autocomplete")).toLowerCase();
    if (ac) {
      const mapped = AUTOCOMPLETE_MAP[ac];
      if (mapped === fieldType) {
        score += 30;
        reasons.push(`autocomplete:${ac} (+30)`);
      } else if (mapped) {
        score -= 8;
        reasons.push(`autocomplete:${ac} mismatch (-8)`);
      }
    }

    // Input type help
    const tag = (el.tagName || "").toLowerCase();
    if (tag === "input") {
      const t = safeStr(el.getAttribute("type")).toLowerCase() || "text";
      if (fieldType === "email" && t === "email") {
        score += 18;
        reasons.push("type=email (+18)");
      }
      if (fieldType === "phone" && t === "tel") {
        score += 16;
        reasons.push("type=tel (+16)");
      }
      if (
        (fieldType === "website" ||
          fieldType === "linkedin" ||
          fieldType === "github") &&
        t === "url"
      ) {
        score += 10;
        reasons.push("type=url (+10)");
      }
      if (fieldType === "dateOfBirth" && t === "date") {
        score += 18;
        reasons.push("type=date (+18)");
      }
      if (fieldType === "salaryExpectation" && t === "number") {
        score += 10;
        reasons.push("type=number (+10)");
      }
    }

    // Keyword matching in signals
    const synonyms = FIELD_SYNONYMS[fieldType] || [];
    const synonymTokens = synonyms.flatMap((s) => tokenize(s));

    // Special disambiguation: "name" alone is ambiguous
    const ambiguousNameToken = (tok) => tok === "name" || tok === "isim";

    for (const s of tokensBySignal) {
      let local = 0;

      for (const tok of s.tokens) {
        if (synonymTokens.includes(tok)) {
          local += 3;
        }
      }

      // If fieldType is fullName, allow "name" token
      if (fieldType === "fullName") {
        if (s.tokens.some(ambiguousNameToken)) local += 3;
      } else {
        // Penalize ambiguous "name" tokens for non-name fields
        if (
          s.tokens.some(ambiguousNameToken) &&
          fieldType !== "firstName" &&
          fieldType !== "lastName"
        ) {
          local -= 2;
        }
      }

      if (local !== 0) {
        score += local * s.weight;
        reasons.push(`${s.source} match (${local}*w${s.weight})`);
      }
    }

    // Extra: known IDs/names patterns
    const nm = (
      safeStr(el.getAttribute("name")) +
      " " +
      safeStr(el.getAttribute("id"))
    ).toLowerCase();
    if (nm) {
      if (
        fieldType === "firstName" &&
        /(first|given)[-_ ]?name|^fname$|ad/i.test(nm)
      ) {
        score += 20;
        reasons.push("name/id pattern (+20)");
      }
      if (
        fieldType === "lastName" &&
        /(last|family|sur)[-_ ]?name|^lname$|soyad/i.test(nm)
      ) {
        score += 20;
        reasons.push("name/id pattern (+20)");
      }
      if (fieldType === "email" && /(e[-_ ]?mail|email)/i.test(nm)) {
        score += 16;
        reasons.push("name/id pattern (+16)");
      }
      if (
        fieldType === "phone" &&
        /(phone|mobile|tel|gsm|cep|telefon)/i.test(nm)
      ) {
        score += 14;
        reasons.push("name/id pattern (+14)");
      }
      if (fieldType === "postalCode" && /(zip|postal|posta)/i.test(nm)) {
        score += 12;
        reasons.push("name/id pattern (+12)");
      }
      if (fieldType === "linkedin" && /linkedin/i.test(nm)) {
        score += 14;
        reasons.push("name/id pattern (+14)");
      }
      if (fieldType === "github" && /github/i.test(nm)) {
        score += 14;
        reasons.push("name/id pattern (+14)");
      }
    }

    // Penalize if element seems like search
    const ph = safeStr(el.getAttribute("placeholder")).toLowerCase();
    if (ph.includes("search") || ph.includes("ara")) {
      score -= 10;
      reasons.push("search-like (-10)");
    }

    return { score, reasons };
  }

  function setNativeValue(el, value) {
    try {
      const tag = (el.tagName || "").toLowerCase();
      if (tag === "select") {
        return setSelectValue(el, value);
      }

      const val = safeStr(value);
      const last = el.value;

      // native setter (React controlled inputs)
      const proto = Object.getPrototypeOf(el);
      const desc = Object.getOwnPropertyDescriptor(proto, "value");
      if (desc && typeof desc.set === "function") {
        desc.set.call(el, val);
      } else {
        el.value = val;
      }

      // Dispatch events
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));

      return { ok: true, from: last, to: val };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  function normalizeForCompare(s) {
    return safeStr(s).toLowerCase().replace(/\s+/g, " ").trim();
  }

  function setSelectValue(selectEl, desired) {
    const desiredRaw = safeStr(desired);
    if (!desiredRaw) return { ok: false, error: "empty desired value" };

    const desiredNorm = normalizeForCompare(desiredRaw);

    // Try direct value match
    for (const opt of Array.from(selectEl.options || [])) {
      if (normalizeForCompare(opt.value) === desiredNorm) {
        selectEl.value = opt.value;
        selectEl.dispatchEvent(new Event("change", { bubbles: true }));
        return { ok: true, matched: "value", to: opt.value };
      }
    }

    // Try text match
    for (const opt of Array.from(selectEl.options || [])) {
      if (normalizeForCompare(opt.textContent) === desiredNorm) {
        selectEl.value = opt.value;
        selectEl.dispatchEvent(new Event("change", { bubbles: true }));
        return { ok: true, matched: "text", to: opt.value };
      }
    }

    // Fuzzy includes (for country names etc.)
    for (const opt of Array.from(selectEl.options || [])) {
      const t = normalizeForCompare(opt.textContent);
      if (t.includes(desiredNorm) || desiredNorm.includes(t)) {
        selectEl.value = opt.value;
        selectEl.dispatchEvent(new Event("change", { bubbles: true }));
        return { ok: true, matched: "fuzzy", to: opt.value };
      }
    }

    return { ok: false, error: "no option match" };
  }

  function withinTopForm(el) {
    // Tie-breaker: prefer elements higher on page
    try {
      const r = el.getBoundingClientRect();
      return r.top;
    } catch {
      return 999999;
    }
  }

  function scanOpenShadowRoots(root = document) {
    // Best-effort open shadowRoot scan
    const results = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = walker.currentNode;

    while (node) {
      if (node.shadowRoot && node.shadowRoot.mode === "open") {
        results.push(node.shadowRoot);
      }
      node = walker.nextNode();
    }
    return results;
  }

  function buildCandidateList({ includeShadow = true } = {}) {
    const elements = [];

    const collect = (root) => {
      try {
        const found = root.querySelectorAll("input, textarea, select");
        found.forEach((el) => elements.push(el));
      } catch {}
    };

    collect(document);

    if (includeShadow) {
      const roots = scanOpenShadowRoots(document);
      for (const sr of roots) collect(sr);
    }

    return elements;
  }

  window.CVAUtils = {
    normalizeProfile,
    normalizePhone,
    normalizeUrl,
    isVisible,
    isFillableElement,
    getElementTextSignals,
    scoreFieldType,
    setNativeValue,
    withinTopForm,
    buildCandidateList,
  };
})();
