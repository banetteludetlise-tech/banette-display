import test from 'node:test';
import assert from 'node:assert/strict';
import {parisNow,validateTides,tideSummary,tideConfig,tidesOnScreen} from '../tide-model.js';
import {parseShomWidget} from '../scripts/shom-parser.mjs';
import {dailyForecast,dayKeys,weatherConfig,WeatherSchedule} from '../weather-model.js';
import {PlaybackClock} from '../playback-clock.js';

const now=new Date('2026-09-27T10:00:00Z');
const tide={port:'SAINT-MALO',fetchedAt:now.toISOString(),events:[
 {date:'2026-09-27',time:'08:00',type:'high',height:12,coefficient:87},
 {date:'2026-09-27',time:'14:00',type:'low',height:1,coefficient:null},
 {date:'2026-09-27',time:'20:00',type:'high',height:12.5,coefficient:89},
 {date:'2026-09-28',time:'02:00',type:'low',height:0.8,coefficient:null},
 {date:'2026-09-28',time:'08:00',type:'high',height:12.7,coefficient:90}]};
test('Paris: date, minuit et changement heure été/hiver',()=>{
 assert.deepEqual(parisNow(new Date('2026-09-27T22:30Z')),{date:'2026-09-28',time:'00:30'});
 assert.equal(parisNow(new Date('2026-10-25T00:30Z')).time,'02:30');
 assert.equal(parisNow(new Date('2026-10-25T01:30Z')).time,'02:30');
 assert.deepEqual(dayKeys(new Date('2026-10-24T23:00Z')),['2026-10-25','2026-10-26','2026-10-27']);
});
test('Marées: prochaines haute/basse, tendance et passage au lendemain',()=>{
 const s=tideSummary(tide,now);assert.equal(s.trend,'Descendante');assert.equal(s.low.time,'14:00');assert.equal(s.high.time,'20:00');assert.equal(s.today.length,3);
 const later=tideSummary(tide,new Date('2026-09-27T21:00Z'));assert.equal(later.low.date,'2026-09-28');assert.equal(later.trend,'Descendante');
 assert.equal(tideSummary(tide,new Date('2026-09-27T18:00Z')).trend,'Pleine mer');
});
test('Marées: données périmées, erronées et absentes ne paraissent pas actuelles',()=>{
 assert.equal(tideSummary(tide,new Date('2026-10-10')).expired,true);
 assert.equal(tideSummary({...tide,fetchedAt:'2026-09-25T00:00Z'},now).stale,true);
 for(const replacement of [{time:'28:00'},{height:NaN},{coefficient:140},{date:'2026-02-30'}])assert.throws(()=>validateTides({...tide,events:[{...tide.events[0],...replacement}]}));
 assert.throws(()=>validateTides({...tide,events:[tide.events[0],tide.events[0]]}));
 assert.equal(tideSummary(null,now).expired,true);
});
test('Marées: activation par écran et modes indépendants',()=>{
 assert.equal(tidesOnScreen(tideConfig(), 'boutique','fullscreen'),true);
 assert.equal(tidesOnScreen(tideConfig(), 'vitrine','compact'),false);
 assert.equal(tidesOnScreen({screenId:'all',displayMode:'compact'},'vitrine','fullscreen'),false);
 assert.equal(tidesOnScreen({enabled:false},'boutique'),false);
});
test('SHOM: parse uniquement les tables et rejette un format ou port modifié',()=>{
 const table=day=>`<table><thead>${day}/09/2026</thead><tbody>`+['PM','BM','PM','BM'].map((kind,i)=>`<tr><td>${kind}</td><td>${String(2+i*6).padStart(2,'0')}:10</td><td>${i%2?'1,25':'12,50'}</td><td>${i%2?'--':'89'}</td></tr>`).join('')+'</tbody></table>';
 const script="ifrm.document.write('Saint-Malo');\n"+[27,28].map(d=>`ifrm.document.write('${table(d)}');`).join('\n');
 const parsed=parseShomWidget(script,now.toISOString());assert.equal(parsed.events.length,8);assert.equal(parsed.events[1].height,1.25);assert.equal(parsed.events[1].coefficient,null);
 assert.throws(()=>parseShomWidget(script.replace('Saint-Malo','Brest')));
 assert.throws(()=>parseShomWidget(script.replace('<td>PM</td>','<td>???</td>')));
});
const point=(time,temp,rain=0,extra={})=>({time,data:{instant:{details:{air_temperature:temp,wind_speed:5}},next_1_hours:{details:{precipitation_amount:rain},summary:{symbol_code:'partlycloudy_day'}},...extra}});
const forecast=points=>({properties:{meta:{updated_at:now.toISOString()},timeseries:points}});
test('Météo: trois dates, unités, zéro pluie distinct de valeur absente',()=>{
 const result=dailyForecast(forecast([point('2026-09-27T12:00Z',20,0),point('2026-09-27T13:00Z',22,1.5),point('2026-09-28T12:00Z',19,0),point('2026-09-29T12:00Z',18,0)]),now);
 assert.equal(result.length,3);assert.equal(result[0].min,20);assert.equal(result[0].max,22);assert.equal(result[0].wind,18);assert.equal(result[0].rain,1.5);assert.equal(result[0].probability,null);assert.equal(result[1].rain,0);assert.equal(result[0].condition.text,'Éclaircies');
 const missing=dailyForecast(forecast([point('2026-09-27T12:00Z',20,0,{next_1_hours:{summary:{symbol_code:'clearsky_day'}}})]),now);assert.equal(missing[0].rain,null);assert.equal(missing[1].missing,true);
});
test('Météo: pas de double cumul entre périodes de 1 h et 6 h ou périodes chevauchantes',()=>{
 const six={details:{precipitation_amount:6},summary:{symbol_code:'rain'}};
 const result=dailyForecast(forecast([point('2026-09-27T08:00Z',15,1,{next_6_hours:six}),point('2026-09-27T09:00Z',16,0,{next_1_hours:null,next_6_hours:six}),point('2026-09-27T12:00Z',20,0,{next_1_hours:null,next_6_hours:six})]),now);
 assert.equal(result[0].rain,7);assert.equal(result[0].rainHours,7);
});
test('Météo: prévisions périmées et données invalides masquées',()=>{
 assert.equal(dailyForecast(forecast([point('2026-09-27T12:00Z',20)]),new Date('2026-09-29')).every(x=>x.missing),true);
 assert.equal(dailyForecast({properties:{}},now).every(x=>x.missing),true);
});
test('Rythme: 20 s toutes les 60 s, écran, urgence et changement de fréquence',()=>{
 const config=weatherConfig(),s=new WeatherSchedule(0);s.configure(config,'boutique',0);
 assert.equal(config.duration,20);assert.equal(config.interval,60);
 assert.equal(s.due(config,'boutique',{now:59999}),false);assert.equal(s.due(config,'boutique',{now:60000}),true);
 s.shown(config,60000);assert.equal(s.due(config,'boutique',{now:80000}),false);assert.equal(s.due(config,'boutique',{now:120000}),true);
 assert.equal(s.due(config,'vitrine',{now:120000}),false);assert.equal(s.due(config,'boutique',{now:120000,urgent:true}),false);
 s.shown(config,180000);assert.equal(s.nextAt,240000);
 s.configure({...config,interval:90},'boutique',180000);assert.equal(s.nextAt,270000);
 assert.equal(weatherConfig({duration:20,interval:10}).interval,25);
});
test('Diaporama: pause exacte des médias et catégories, nouveaux délais pendant la météo',()=>{
 let time=0,id=0;const jobs=new Map(),events=[];
 const clock=new PlaybackClock({now:()=>time,set:(fn,ms)=>{jobs.set(++id,{fn,at:time+ms});return id;},clear:id=>jobs.delete(id)});
 const advance=ms=>{const end=time+ms;while(true){const next=[...jobs].filter(([,j])=>j.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;time=next[1].at;jobs.delete(next[0]);next[1].fn();}time=end;};
 clock.schedule('slide',()=>events.push('slide'),10000);clock.schedule('category',()=>events.push('category'),60000);advance(5000);clock.pause();advance(20000);assert.deepEqual(events,[]);clock.resume();advance(4999);assert.deepEqual(events,[]);advance(1);assert.deepEqual(events,['slide']);advance(50000);assert.deepEqual(events,['slide','category']);
 clock.pause();clock.schedule('new',()=>events.push('new'),3000);advance(20000);clock.resume();advance(3000);assert.equal(events.at(-1),'new');
});
