import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {PlaybackClock} from '../playback-clock.js';
import {tideConfig,tidesOnScreen} from '../tide-model.js';
import {weatherConfig,weatherOnScreen,WeatherSchedule} from '../weather-model.js';

function player(search=''){
 const wakeEvents=[];
 let time=0,id=0;const timers=new Map(),snapshots=new Map(),nodes=new Map();
 const element=()=>({className:'',textContent:'',innerHTML:'',style:{setProperty(){}},children:[],paused:true,src:'',classList:{items:new Set(['hidden']),add(k){this.items.add(k)},remove(k){this.items.delete(k)},contains(k){return this.items.has(k)},toggle(k,b){if(b===undefined)b=!this.items.has(k);b?this.items.add(k):this.items.delete(k)}},appendChild(n){this.children.push(n)},replaceChildren(...n){this.children=n},addEventListener(){},removeAttribute(k){this[k]=''},load(){},pause(){this.paused=true},play(){this.paused=false;return Promise.resolve()}});
 const node=s=>{if(!nodes.has(s))nodes.set(s,element());return nodes.get(s)};
 const set=(fn,ms,repeat=0)=>{timers.set(++id,{fn,at:time+ms,repeat});return id;};
 const advance=ms=>{const end=time+ms;let steps=0;while(true){const next=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;if(++steps>10000)throw Error('timer loop');time=next[1].at;timers.delete(next[0]);if(next[1].repeat)timers.set(next[0],{...next[1],at:time+next[1].repeat});next[1].fn();}time=end;};
 class FakeDate extends Date{constructor(...args){super(...(args.length?args:[time]));}static now(){return time;}}
 class Clock extends PlaybackClock{constructor(){super({now:()=>time,set:(f,m)=>set(f,m),clear:i=>timers.delete(i)});}}
 class Schedule extends WeatherSchedule{constructor(){super(time)}configure(c,s){super.configure(c,s,time)}due(c,s,o){return super.due(c,s,{...o,now:time})}shown(c){super.shown(c,time)}}
 const ctx={mountKeepAwakeTrial:()=>({setContentVideo:value=>wakeEvents.push(value)}),console,Date:FakeDate,URLSearchParams,location:{search},localStorage:{getItem(){return null},setItem(){}},document:{querySelector:node,createElement:element,documentElement:{style:{setProperty(){}}}},window:{addEventListener(){}},setTimeout:(f,m)=>set(f,m),clearTimeout:i=>timers.delete(i),setInterval:(f,m)=>set(f,m,m),PlaybackClock:Clock,WeatherSchedule:Schedule,tideConfig,tidesOnScreen,weatherConfig,weatherOnScreen,weatherService:{configure(){},subscribe(){},currentText(){return '20 °C'}},startTides(){},renderTides(){},renderWeather(){},firebaseConfig:{},initializeApp(){},getFirestore(){},collection:(db,p)=>p,doc:(db,c,i)=>c+'/'+i,query:x=>x,orderBy(){},onSnapshot:(path,fn)=>snapshots.set(path,fn)};
 vm.runInNewContext(readFileSync(new URL('../screen.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,''),ctx);
 const update=(path,value)=>snapshots.get(path)(path.includes('/')?{exists:()=>value!=null,data:()=>value}:{docs:value.map(x=>({id:x.id,data:()=>x}))});
 return{node,advance,update,wakeEvents};
}
test('Lecteur intégré: météo à 60 s, retour à 80 s, nouveau passage à 120 s',()=>{
 const p=player();p.update('config/tides',{enabled:false});p.update('categories',[{id:'bread',name:'Pains',duration:300}]);p.update('media',[{id:'one',categoryId:'bread',type:'message',title:'Premier',duration:100},{id:'two',categoryId:'bread',type:'message',title:'Deuxième',duration:100}]);
 p.advance(59999);assert.equal(p.node('#weatherSlide').classList.contains('hidden'),true);p.advance(1);assert.equal(p.node('#weatherSlide').classList.contains('hidden'),false);
 p.advance(20000);assert.equal(p.node('#weatherSlide').classList.contains('hidden'),true);assert.equal(p.node('#title').textContent,'Premier');
 p.advance(39999);assert.equal(p.node('#title').textContent,'Premier');p.advance(1);assert.equal(p.node('#weatherSlide').classList.contains('hidden'),false);assert.equal(p.node('#title').textContent,'Deuxième');
});
test('Lecteur intégré: une vidéo reprend et une annonce urgente interrompt la météo',()=>{
 const p=player();p.update('config/tides',{enabled:false});p.update('categories',[{id:'bread',name:'Pains',duration:300}]);p.update('media',[{id:'film',categoryId:'bread',type:'video',mediaUrl:'https://example.test/film.mp4',duration:300}]);
 assert.equal(p.node('#videoMedia').paused,false);p.advance(60000);assert.equal(p.node('#videoMedia').paused,true);p.advance(20000);assert.equal(p.node('#videoMedia').paused,false);
 p.advance(40000);p.update('config/urgent',{enabled:true,title:'Urgent'});assert.equal(p.node('#weatherSlide').classList.contains('hidden'),true);assert.equal(p.node('#title').textContent,'Urgent');p.advance(180000);assert.equal(p.node('#weatherSlide').classList.contains('hidden'),true);
 p.update('config/urgent',null);p.advance(500);assert.equal(p.node('#weatherSlide').classList.contains('hidden'),false);
});
test('Lecteur intégré: désactivation immédiate, filtrage écran et aperçu des marées',()=>{
 const p=player();p.advance(60000);p.update('config/weather',{enabled:false});assert.equal(p.node('#weatherSlide').classList.contains('hidden'),true);p.advance(120000);assert.equal(p.node('#weatherSlide').classList.contains('hidden'),true);
 const v=player('?screen=vitrine');v.advance(120000);assert.equal(v.node('#weatherSlide').classList.contains('hidden'),true);
 const t=player('?view=tides');assert.equal(t.node('#tideSlide').classList.contains('hidden'),false);t.advance(120000);assert.equal(t.node('#weatherSlide').classList.contains('hidden'),true);
});
test('Lecteur intégré: programmation et médias désactivés conservés',()=>{
 const p=player();p.update('config/tides',{enabled:false});p.update('config/weather',{enabled:false});p.update('categories',[{id:'bread',name:'Pains',duration:300}]);p.update('media',[{id:'disabled',categoryId:'bread',enabled:false,title:'Inactif'}, {id:'future',categoryId:'bread',startDate:'2099-01-01',title:'Futur'}, {id:'active',categoryId:'bread',type:'image',mediaUrl:'https://example.test/photo.jpg',title:'Nom interne',duration:100}]);
 assert.equal(p.node('#imageMedia').src,'https://example.test/photo.jpg');assert.equal(p.node('#imageMedia').style.objectFit,'contain');assert.equal(p.node('#title').textContent,'');
});


test('Essai facultatif : aucun appel sur le lecteur habituel',()=>{
 const p=player();p.advance(180000);assert.deepEqual(p.wakeEvents,[]);
});
test('Essai : transfert vidéo, météo sans second décodeur, retour aux images',()=>{
 const p=player('?keepawake=test');
 p.update('config/tides',{enabled:false});p.update('categories',[{id:'bread',name:'Pains',duration:300}]);
 p.update('media',[{id:'film',categoryId:'bread',type:'video',mediaUrl:'https://example.test/film.mp4',duration:300}]);
 assert.equal(p.wakeEvents.at(-1),true);
 const count=p.wakeEvents.length;p.advance(60000);
 assert.equal(p.node('#videoMedia').paused,true);assert.equal(p.wakeEvents.length,count);
 p.advance(20000);assert.equal(p.node('#videoMedia').paused,false);assert.equal(p.wakeEvents.length,count);
 p.update('media',[{id:'image',categoryId:'bread',type:'image',mediaUrl:'https://example.test/photo.jpg'}]);
 assert.equal(p.wakeEvents.at(-1),false);
});
test('Essai : marées et urgence restent des pages sans vidéo',()=>{
 const p=player('?keepawake=test&view=tides');assert.equal(p.wakeEvents.at(-1),false);
 p.update('config/urgent',{enabled:true,title:'Urgent'});assert.equal(p.wakeEvents.at(-1),false);
 assert.equal(p.node('#title').textContent,'Urgent');
});
