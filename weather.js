import {weatherConfig,weatherLocationKey,validateForecast,dailyForecast,dayKeys,describeWeather} from "./weather-model.js";
import {parisNow} from "./tide-model.js";

const CACHE="bd_weather_forecast_v1";
export class WeatherService {
  constructor(){this.config=weatherConfig();this.data=null;this.sun={};this.listeners=new Set();this.nextAt=0;this.failed=false;this.loading=false;this.generation=0;this.controller=null;this.timer=null;try{const saved=JSON.parse(localStorage.getItem(CACHE));if(saved?.location===weatherLocationKey(this.config)){this.data=validateForecast(saved.data);this.sun=saved.sun||{};this.nextAt=saved.nextAt||0;}}catch{}}
  emit(){this.listeners.forEach(fn=>fn());}
  configure(value){const next=weatherConfig(value);if(weatherLocationKey(next)!==weatherLocationKey(this.config)){this.generation++;this.controller?.abort();this.data=null;this.sun={};this.nextAt=0;this.loading=false;}this.config=next;this.emit();if(this.listeners.size)this.refresh();}
  subscribe(fn){this.listeners.add(fn);if(!this.timer){this.timer=setInterval(()=>{if(this.listeners.size&&!document.hidden){this.refresh();this.emit();}},60000);window.addEventListener("online",()=>{if(this.failed){this.nextAt=0;this.refresh();}});document.addEventListener("visibilitychange",()=>{if(!document.hidden)this.refresh();});}fn();this.refresh();return()=>this.listeners.delete(fn);}
  persist(){try{localStorage.setItem(CACHE,JSON.stringify({location:weatherLocationKey(this.config),data:this.data,sun:this.sun,nextAt:this.nextAt}));}catch{}}
  async refresh(){
    if(this.loading||!this.listeners.size)return;
    if(Date.now()<this.nextAt){if(this.config.showSun)this.loadSun();return;}
    const generation=this.generation,config=this.config;
    this.loading=true;const controller=new AbortController();this.controller=controller;const timer=setTimeout(()=>controller.abort(),10000);
    this.emit();
    try{
      const [lat,lon]=weatherLocationKey(config).split(",");
      // A simple CORS request: the browser supplies Origin/Referer identification.
      // Browser HTTP caching handles conditional requests without a CORS preflight.
      const response=await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${lat}&lon=${lon}`,{signal:controller.signal});
      if(!response.ok)throw new Error(`Météo HTTP ${response.status}`);
      const forecast=validateForecast(await response.json());
      if(generation!==this.generation)return;
      this.data=forecast;this.failed=false;
      this.nextAt=Math.max(Date.now()+3600000,Date.parse(response.headers.get("Expires"))||0);
      this.persist();
    }catch(error){if(generation===this.generation){this.failed=true;this.nextAt=Date.now()+900000;}}
    finally{clearTimeout(timer);if(generation===this.generation){this.loading=false;this.emit();if(this.config.showSun)this.loadSun();}}
  }
  async loadSun(){
    if(!this.config.showSun||this.sunLoading)return;
    this.sunLoading=true;const generation=this.generation,[lat,lon]=weatherLocationKey(this.config).split(",");
    try{for(const date of dayKeys()){
      if(this.sun[date]&&(this.sun[date].sunrise||Date.now()-this.sun[date].attemptedAt<3600000))continue;
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
      try{const response=await fetch(`https://api.met.no/weatherapi/sunrise/3.0/sun?lat=${lat}&lon=${lon}&date=${date}`,{signal:controller.signal});if(!response.ok)throw new Error("Soleil indisponible");const raw=await response.json();if(generation!==this.generation)return;this.sun[date]={sunrise:raw.properties?.sunrise?.time||null,sunset:raw.properties?.sunset?.time||null,attemptedAt:Date.now()};}
      catch{if(generation===this.generation)this.sun[date]={attemptedAt:Date.now()};}finally{clearTimeout(timer);}
    }}finally{this.sunLoading=false;this.persist();this.emit();}
  }
  currentText(){
    if(!this.data||dailyForecast(this.data)[0].missing)return "Météo indisponible";
    const p=[...this.data.properties.timeseries].sort((a,b)=>Math.abs(Date.parse(a.time)-Date.now())-Math.abs(Date.parse(b.time)-Date.now()))[0];
    const d=p.data,symbol=(d.next_1_hours||d.next_6_hours||d.next_12_hours)?.summary?.symbol_code;
    return `${Math.round(d.instant.details.air_temperature)} °C · ${describeWeather(symbol).text}`;
  }
}
export const weatherService=new WeatherService();
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const number=n=>typeof n==="number"?Math.round(n):"—";
const sunTime=t=>Number.isFinite(Date.parse(t))?parisNow(new Date(t)).time:"—";
function icon(kind){
  const sun='<circle cx="39" cy="37" r="17" fill="#ffd884"/><path d="M39 8v-6m0 70v-6M10 37H4m70 0h-6M18 16l-5-5m47 47 5 5M18 58l-5 5m47-47 5-5" stroke="#ffd884" stroke-width="4" stroke-linecap="round"/>';
  const cloud='<path d="M26 75c-20 0-23-28-3-32 1-27 43-31 48-6 23-2 28 38 4 38Z" fill="#e7f0fa"/>';
  const details=kind==="rain"?'<path d="m32 84-6 12m27-12-6 12m27-12-6 12" stroke="#76cbef" stroke-width="5" stroke-linecap="round"/>':kind==="storm"?'<path d="m53 70-15 21h13l-5 14 21-25H54l8-10Z" fill="#ffd884"/>':kind==="snow"?'<g fill="#e7f0fa"><circle cx="30" cy="89" r="4"/><circle cx="52" cy="96" r="4"/><circle cx="74" cy="89" r="4"/></g>':kind==="fog"?'<path d="M19 87h65M27 97h48" stroke="#a4c3dc" stroke-width="4" stroke-linecap="round"/>':"";
  const n=node("div","weather-icon");n.setAttribute("aria-hidden","true");n.innerHTML=`<svg viewBox="0 0 108 108" xmlns="http://www.w3.org/2000/svg">${["sun","partly"].includes(kind)?sun:""}${kind!=="sun"?cloud:""}${details}</svg>`;return n;
}
export function renderWeather(container,config=weatherService.config,service=weatherService){
  if(!container)return;
  const fragment=document.createDocumentFragment(),header=node("header","weather-heading"),title=node("div");
  title.append(node("p","weather-eyebrow","LE TEMPS D’ICI · PRÉVISIONS SUR 3 JOURS"),node("h2","",`Météo à ${config.city}`));
  header.append(title,node("p","weather-today",new Date().toLocaleDateString("fr-FR",{timeZone:"Europe/Paris",weekday:"long",day:"numeric",month:"long"})));
  fragment.append(header);
  const days=dailyForecast(service.data),grid=node("div","weather-days");
  days.forEach((d,i)=>{
    const card=node("article","weather-day"+(i===0?" weather-day-today":""));
    card.append(node("h3","",["Aujourd’hui","Demain","Après-demain"][i]),node("p","weather-day-date",new Date(d.date+"T12:00:00Z").toLocaleDateString("fr-FR",{timeZone:"Europe/Paris",weekday:"long",day:"numeric",month:"long"})));
    if(d.missing){card.append(node("p","weather-unavailable",service.loading?"Chargement…":"Prévision indisponible"));}
    else{
      if(config.showCondition)card.append(icon(d.condition.icon),node("p","weather-condition",d.condition.text));
      if(config.showTemperature){const temp=node("div","weather-temperature");temp.append(node("strong","",`${number(d.max)}°`),node("span","",`mini ${number(d.min)}°`));card.append(temp);}
      const infos=node("div","weather-details");
      if(config.showRain){const rain=d.rain===null?"Non fournie":`${d.rain.toLocaleString("fr-FR",{maximumFractionDigits:1})} mm`;infos.append(node("p","",`Pluie prévue · ${rain}`));if(d.probability!==null)infos.append(node("p","",`Risque maximal · ${number(d.probability)} %`));}
      if(config.showWind)infos.append(node("p","",`Vent maxi · ${d.wind===null?"Non fourni":number(d.wind)+" km/h"}`));
      if(config.showSun)infos.append(node("p","weather-sun",`Lever ${sunTime(service.sun[d.date]?.sunrise)} · Coucher ${sunTime(service.sun[d.date]?.sunset)}`));
      card.append(infos);
      if(d.partial)card.append(node("p","weather-partial",i===0?"Pour le reste de la journée":"Sur les créneaux disponibles"));
    }
    grid.append(card);
  });
  fragment.append(grid);
  const footer=node("footer","weather-footer"),source=node("p"),link=node("a","","MET Norway");link.href="https://www.met.no/";link.target="_blank";link.rel="noopener";
  source.append(document.createTextNode("Prévisions regroupées par jour · "),link,document.createTextNode(" · "));
  const license=node("a","","CC BY 4.0");license.href="https://creativecommons.org/licenses/by/4.0/";license.target="_blank";license.rel="noopener";source.append(license);
  const timestamp=service.data?.properties?.meta?.updated_at;
  if(timestamp)source.append(document.createTextNode(" · MAJ "+new Date(timestamp).toLocaleString("fr-FR",{timeZone:"Europe/Paris",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})));
  footer.append(source,node("p","",service.failed?"Prévisions enregistrées · nouvelle tentative automatique":timestamp&&Date.now()-Date.parse(timestamp)>6*3600000?"Prévisions anciennes":"Heure de Paris"));fragment.append(footer);
  container.replaceChildren(fragment);
}
