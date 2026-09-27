import {TIDE_SOURCE, parisNow, validateTides, tideSummary} from "./tide-model.js";

const DATA_URL = "https://raw.githubusercontent.com/banetteludetlise-tech/banette-display/tides-data/tides.json";
const CACHE_KEY = "bd_tides_saint_malo_v1";
let data = null, loading = false, saved = true, started = false, lastAttempt = 0, lastDate = "";
const listeners = new Set();
try { data = validateTides(JSON.parse(localStorage.getItem(CACHE_KEY))); } catch {}

function emit() { listeners.forEach(fn => fn()); }
function accept(candidate) {
  const valid = validateTides(candidate);
  if (!data || Date.parse(valid.fetchedAt) >= Date.parse(data.fetchedAt)) {
    data = valid;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
    emit();
  }
}
async function read(url) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {cache:"no-cache", signal:controller.signal});
    if (!response.ok) throw new Error("Prévisions indisponibles");
    return validateTides(await response.json());
  } finally { clearTimeout(timer); }
}
async function refresh() {
  if (loading) return;
  loading = true; lastAttempt = Date.now(); lastDate = parisNow().date; emit();
  // The bundled snapshot can render immediately while the independent data feed loads.
  const local = read(new URL("./data/tides.json", import.meta.url)).then(accept).catch(() => {});
  try { accept(await read(DATA_URL)); saved = false; }
  catch { saved = true; }
  await local;
  loading = false; emit();
}
export function startTides(listener) {
  listeners.add(listener);
  if (!started) {
    started = true;
    refresh();
    setInterval(() => {
      const interval = saved ? 5 * 60000 : 60 * 60000;
      if (parisNow().date !== lastDate || Date.now() - lastAttempt >= interval) refresh();
      emit();
    }, 60000);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
  }
  listener();
  return () => listeners.delete(listener);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function dateText(date, long = false) {
  return new Date(date + "T12:00:00Z").toLocaleDateString("fr-FR", {timeZone:"Europe/Paris", ...(long ? {weekday:"long", day:"numeric", month:"long"} : {day:"2-digit", month:"2-digit"})});
}
function eventTime(event, date) {
  return event ? `${event.time}${event.date !== date ? " · " + dateText(event.date) : ""}` : "Non disponible";
}
function height(value) { return value === null ? "—" : `${value.toLocaleString("fr-FR", {minimumFractionDigits:2, maximumFractionDigits:2})} m`; }
function sourceLine() {
  const p = el("p", "tide-source"), link = el("a", "", "Source : SHOM");
  link.href = TIDE_SOURCE; link.target = "_blank"; link.rel = "noopener noreferrer";
  p.append(link);
  if (data) p.append(document.createTextNode(" · Relevé le " + new Date(data.fetchedAt).toLocaleString("fr-FR", {timeZone:"Europe/Paris",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})));
  return p;
}

export function renderTides(container, {compact = false} = {}) {
  if (!container) return;
  const s = tideSummary(data), fragment = document.createDocumentFragment();
  container.classList.toggle("tide-compact", compact);
  if (compact) {
    fragment.append(el("div", "widget-title", "🌊 Saint-Malo"));
    if (s.expired) fragment.append(el("div", "widget-value", loading ? "Marées : chargement…" : "Marées indisponibles"));
    else {
      fragment.append(el("div", "widget-value", `↑ ${eventTime(s.high,s.date)} · ↓ ${eventTime(s.low,s.date)}`));
      fragment.append(el("div", "tide-meta", `${s.trend} · SHOM${s.stale ? " · données anciennes" : saved ? " · mémoire" : ""}`));
    }
    container.title = "Marées de Saint-Malo — heure de Paris. " + (data ? "Source SHOM, relevé " + data.fetchedAt : "");
  } else {
    const header = el("div", "tide-heading");
    header.append(el("div", "tide-eyebrow", "LA CÔTE, AU FIL DU JOUR"), el("h2", "", "Marées · Saint-Malo"), el("p", "tide-date", dateText(s.date,true) + " · Heure de Paris"));
    fragment.append(header);
    if (s.expired) {
      fragment.append(el("p", "tide-unavailable", loading ? "Chargement des prévisions officielles…" : "Les prévisions du jour sont indisponibles. Nouvelle tentative automatique."));
    } else {
      fragment.append(el("div", "tide-trend", (s.trend === "Montante" ? "↗ " : s.trend === "Descendante" ? "↘ " : "≈ ") + s.trend));
      const next = el("div", "tide-next");
      for (const [label,event] of [["Prochaine marée haute",s.high],["Prochaine marée basse",s.low]]) {
        const card = el("div", "tide-next-card");
        card.append(el("span", "", label), el("strong", "", eventTime(event,s.date)));
        if (event) card.append(el("span", "", `${height(event.height)}${event.coefficient !== null ? " · Coeff. " + event.coefficient : ""}`));
        next.append(card);
      }
      fragment.append(next);
      const table = el("table", "tide-table"), caption = el("caption", "", "Horaires de la journée");
      const head = el("thead"), row = el("tr");
      ["Marée", "Heure", "Hauteur", "Coefficient"].forEach(label => {const th = el("th", "", label); th.scope = "col"; row.append(th);});
      head.append(row); table.append(caption,head);
      const body = el("tbody");
      const now = parisNow();
      s.today.forEach(event => {
        const tr = el("tr", event.time < now.time ? "tide-past" : "");
        [event.type === "high" ? "↑ Haute" : "↓ Basse",event.time,height(event.height),event.coefficient ?? "—"].forEach(text => tr.append(el("td", "", text)));
        body.append(tr);
      });
      table.append(body); fragment.append(table);
      if (s.stale || saved) fragment.append(el("p", "tide-cache-note", s.stale ? "Prévisions conservées : la source n’a pas été actualisée récemment." : "Prévisions enregistrées · connexion à la source indisponible."));
    }
    fragment.append(sourceLine(), el("p", "tide-disclaimer", "Prédictions de marée · Ne remplace pas les documents nautiques officiels."));
  }
  container.replaceChildren(fragment);
}
