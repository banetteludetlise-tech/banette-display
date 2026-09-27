import {mkdir, writeFile, rename} from "node:fs/promises";
import {resolve, dirname} from "node:path";
import {parseShomWidget} from "./shom-parser.mjs";
import {parisNow} from "../tide-model.js";

const url = "https://services.data.shom.fr/hdm/vignette/grande/SAINT-MALO?locale=fr";
const response = await fetch(url, {signal: AbortSignal.timeout(20000)});
if (!response.ok) throw new Error(`SHOM HTTP ${response.status}`);
const script = await response.text();
if (script.length > 500000) throw new Error("Réponse SHOM trop volumineuse");
const data = parseShomWidget(script);
if (!data.events.some(e => e.date === parisNow().date)) throw new Error("La source SHOM ne contient pas la date du jour");
const output = resolve(process.argv[2] || "data/tides.json");
await mkdir(dirname(output), {recursive:true});
await writeFile(output + ".tmp", JSON.stringify(data, null, 2) + "\n");
await rename(output + ".tmp", output);
console.log(`${data.events.length} marées vérifiées pour Saint-Malo, du ${data.events[0].date} au ${data.events.at(-1).date}.`);
