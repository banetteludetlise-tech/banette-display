export const TIDE_SOURCE = "https://maree.shom.fr/harbor/SAINT-MALO";
export const DEFAULT_TIDE_SETTINGS = Object.freeze({enabled: true, screenId: "boutique", displayMode: "both", duration: 20});

export function parisNow(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(now).map(p => [p.type, p.value]));
  return {date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`};
}

export function validDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
}

export function validateTides(data) {
  if (!data || data.port !== "SAINT-MALO" || !Number.isFinite(Date.parse(data.fetchedAt)) || !Array.isArray(data.events) || !data.events.length || data.events.length > 80) throw new Error("Prévisions de marée invalides");
  const seen = new Set();
  const events = data.events.map(e => {
    if (!e || !validDate(e.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(e.time) || !["high", "low"].includes(e.type) || (e.height !== null && (typeof e.height !== "number" || !Number.isFinite(e.height) || e.height < -5 || e.height > 20)) || (e.coefficient !== null && (!Number.isInteger(e.coefficient) || e.coefficient < 20 || e.coefficient > 120))) throw new Error("Horaire de marée invalide");
    const key = `${e.date}T${e.time}`;
    if (seen.has(key)) throw new Error("Horaire de marée en double");
    seen.add(key);
    return {date: e.date, time: e.time, type: e.type, height: e.height, coefficient: e.coefficient};
  }).sort((a,b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  return {port: "SAINT-MALO", fetchedAt: data.fetchedAt, events};
}

export function tideSummary(data, now = new Date()) {
  const local = parisNow(now), key = `${local.date}T${local.time}`;
  const empty = {date: local.date, today: [], high: null, low: null, trend: "Indisponible", stale: true, expired: true};
  if (!data) return empty;
  try { data = validateTides(data); } catch { return empty; }
  const age = now.getTime() - Date.parse(data.fetchedAt);
  // A stopped updater must never leave old predictions looking current.
  if (age > 8 * 86400000 || age < -300000) return empty;
  const today = data.events.filter(e => e.date === local.date);
  const future = data.events.filter(e => `${e.date}T${e.time}` >= key);
  const next = future[0];
  if (!today.length || !next) return empty;
  const atTurn = `${next.date}T${next.time}` === key;
  return {
    date: local.date, today,
    high: future.find(e => e.type === "high") || null,
    low: future.find(e => e.type === "low") || null,
    trend: atTurn ? (next.type === "high" ? "Pleine mer" : "Basse mer") : (next.type === "high" ? "Montante" : "Descendante"),
    stale: age > 36 * 3600000, expired: false
  };
}

export function tideConfig(value = {}) {
  const cfg = {...DEFAULT_TIDE_SETTINGS, ...value};
  return {
    enabled: cfg.enabled !== false,
    screenId: typeof cfg.screenId === "string" && cfg.screenId.trim() ? cfg.screenId.trim().toLowerCase() : "boutique",
    displayMode: ["compact", "fullscreen", "both"].includes(cfg.displayMode) ? cfg.displayMode : "both",
    duration: Math.max(10, Math.min(120, Number(cfg.duration) || 20))
  };
}

export function tidesOnScreen(settings, screen = "boutique", mode = "compact") {
  const cfg = tideConfig(settings);
  return cfg.enabled && (cfg.screenId === "all" || cfg.screenId === screen.toLowerCase()) && (cfg.displayMode === "both" || cfg.displayMode === mode);
}
