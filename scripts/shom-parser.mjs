import {validateTides} from "../tide-model.js";

// Decode only the string literals emitted by the official embeddable widget.
// Never eval, import or run downloaded JavaScript.
export function parseShomWidget(script, fetchedAt = new Date().toISOString()) {
  const html = [...script.matchAll(/^ifrm\.document\.write\('((?:[^'\\]|\\.)*)'\);\s*$/gm)]
    .map(m => m[1].replace(/\\([\\'"nrt])/g, (_, c) => ({n:"\n",r:"\r",t:"\t"}[c] ?? c))).join("\n");
  if (!html.includes("Saint-Malo")) throw new Error("Le port SHOM ne correspond pas à Saint-Malo");
  const tables = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/g)];
  if (tables.length < 2 || tables.length > 10) throw new Error("Format des tables SHOM modifié");
  const events = [];
  for (const [,table] of tables) {
    // The first date is present in a commented table header, the others in thead.
    const date = table.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!date) throw new Error("Date SHOM absente");
    for (const [, row] of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)) {
      const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1].trim());
      if (!cells.length || cells.every(c => /^[-:]+$/.test(c))) continue;
      if (cells.length !== 4 || !["PM", "BM"].includes(cells[0])) throw new Error("Ligne SHOM inconnue");
      const optional = s => /^-+$/.test(s) ? null : Number(s.replace(",", "."));
      events.push({date: `${date[3]}-${date[2]}-${date[1]}`, time: cells[1], type: cells[0] === "PM" ? "high" : "low", height: optional(cells[2]), coefficient: optional(cells[3])});
    }
  }
  if (events.length < 6) throw new Error("Prévisions SHOM incomplètes");
  return validateTides({port:"SAINT-MALO", fetchedAt, events});
}
