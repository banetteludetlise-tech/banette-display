import {parisNow} from "./tide-model.js";

export const DEFAULT_WEATHER = Object.freeze({enabled:true,screenId:"boutique",city:"Combourg",latitude:48.4089,longitude:-1.7517,duration:20,interval:60,showTemperature:true,showCondition:true,showRain:true,showWind:true,showSun:false});
const clamp=(n,min,max,fallback)=>Math.max(min,Math.min(max,Number.isFinite(Number(n))?Number(n):fallback));
export function weatherConfig(value={}) {
  const c={...DEFAULT_WEATHER,...value},duration=Math.round(clamp(c.duration,5,120,20));
  return {...c,enabled:c.enabled!==false,screenId:String(c.screenId||"boutique").trim().toLowerCase(),city:String(c.city||"Combourg").trim().slice(0,60),latitude:clamp(c.latitude,-90,90,48.4089),longitude:clamp(c.longitude,-180,180,-1.7517),duration,interval:Math.round(clamp(c.interval,duration+5,3600,60)),showTemperature:c.showTemperature!==false,showCondition:c.showCondition!==false,showRain:c.showRain!==false,showWind:c.showWind!==false,showSun:c.showSun===true};
}
export const weatherOnScreen=(config,screen)=>config.enabled&&(config.screenId==="all"||config.screenId===screen);
export const weatherLocationKey=c=>`${Number(c.latitude).toFixed(4)},${Number(c.longitude).toFixed(4)}`;
export function dayKeys(now=new Date()) {
  const start=Date.parse(parisNow(now).date+"T12:00:00Z");
  return [0,1,2].map(i=>new Date(start+i*86400000).toISOString().slice(0,10));
}
export function describeWeather(symbol="") {
  const s=symbol.replace(/_(day|night|polartwilight)$/,""),storm=s.includes("thunder");
  if(storm)return {text:"Orages",icon:"storm"};
  if(s.includes("snow")||s.includes("sleet"))return {text:s.includes("sleet")?"Pluie et neige":"Neige",icon:"snow"};
  if(s.includes("rain"))return {text:s.includes("heavy")?"Pluie forte":s.includes("shower")?"Averses":"Pluie",icon:"rain"};
  return ({clearsky:{text:"Ensoleillé",icon:"sun"},fair:{text:"Belles éclaircies",icon:"partly"},partlycloudy:{text:"Éclaircies",icon:"partly"},cloudy:{text:"Couvert",icon:"cloud"},fog:{text:"Brouillard",icon:"fog"}})[s]||{text:"Prévision indisponible",icon:"cloud"};
}
const finite=n=>typeof n==="number"&&Number.isFinite(n);
export function validateForecast(data) {
  if(!data?.properties?.timeseries?.length||!Number.isFinite(Date.parse(data.properties.meta?.updated_at)))throw new Error("Prévisions météo invalides");
  if(data.properties.timeseries.some(p=>!Number.isFinite(Date.parse(p.time))||!finite(p.data?.instant?.details?.air_temperature)))throw new Error("Prévisions météo incomplètes");
  return data;
}
export function dailyForecast(raw,now=new Date()) {
  const dates=dayKeys(now);
  if(!raw)return dates.map(date=>({date,missing:true}));
  try{validateForecast(raw)}catch{return dates.map(date=>({date,missing:true}))}
  const age=now-Date.parse(raw.properties.meta.updated_at);
  if(age>36*3600000||age < -300000)return dates.map(date=>({date,missing:true}));
  const points=raw.properties.timeseries;
  return dates.map(date=>{
    const rows=points.filter(p=>parisNow(new Date(p.time)).date===date);
    if(!rows.length)return{date,missing:true};
    const temperatures=[],winds=[],probabilities=[];
    let rain=0,rainHours=0,coveredUntil=0;
    for(const p of rows){
      const d=p.data,instant=d.instant.details;
      temperatures.push(instant.air_temperature);
      if(finite(instant.wind_speed))winds.push(instant.wind_speed*3.6);
      // Select non-overlapping forecast periods. Never add 1h and 6h totals together.
      const hours=d.next_1_hours?1:d.next_6_hours?6:0,period=d[`next_${hours}_hours`];
      const end=Date.parse(p.time)+hours*3600000-1;
      if(period&&Date.parse(p.time)>=coveredUntil&&parisNow(new Date(end)).date===date){
        const detail=period.details||{};
        coveredUntil=end+1;
        if(finite(detail.precipitation_amount)){rain+=detail.precipitation_amount;rainHours+=hours;}
        if(finite(detail.probability_of_precipitation))probabilities.push(detail.probability_of_precipitation);
        if(finite(detail.air_temperature_min))temperatures.push(detail.air_temperature_min);
        if(finite(detail.air_temperature_max))temperatures.push(detail.air_temperature_max);
      }
    }
    const representative=[...rows].sort((a,b)=>Math.abs(Number(parisNow(new Date(a.time)).time.slice(0,2))-14)-Math.abs(Number(parisNow(new Date(b.time)).time.slice(0,2))-14))[0];
    const d=representative.data;
    const symbol=(d.next_1_hours||d.next_6_hours||d.next_12_hours)?.summary?.symbol_code;
    return {date,missing:false,min:Math.min(...temperatures),max:Math.max(...temperatures),wind:winds.length?Math.max(...winds):null,rain:rainHours?rain:null,probability:probabilities.length?Math.max(...probabilities):null,rainHours,partial:rainHours<23,condition:describeWeather(symbol)};
  });
}

// Weather starts are separated by interval seconds, even when the page lasts 20s.
// After an urgent message, one delayed showing is allowed; never a backlog.
export class WeatherSchedule {
  constructor(now=Date.now()){this.nextAt=now+60000;this.signature="";}
  configure(config,screen,now=Date.now()){
    const signature=JSON.stringify([config.enabled,config.screenId,config.interval,screen]);
    if(signature!==this.signature){this.signature=signature;this.nextAt=now+config.interval*1000;}
  }
  due(config,screen,{now=Date.now(),urgent=false,showing=false,preview=false}={}){
    return !urgent&&!showing&&!preview&&weatherOnScreen(config,screen)&&now>=this.nextAt;
  }
  shown(config,now=Date.now()){this.nextAt=now+config.interval*1000;}
}
