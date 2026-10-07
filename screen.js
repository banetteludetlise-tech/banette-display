import {startTides,renderTides} from "./tides.js";
import {tideConfig,tidesOnScreen} from "./tide-model.js";
import {weatherService,renderWeather} from "./weather.js";
import {weatherConfig,weatherOnScreen,WeatherSchedule} from "./weather-model.js";
import {PlaybackClock} from "./playback-clock.js";
import {mountKeepAwakeTrial} from "./keep-awake.js";
import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, collection, doc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
const app=initializeApp(firebaseConfig),db=getFirestore(app),$=s=>document.querySelector(s);
const D={shopName:"Votre Artisan Boulanger",shopSubtitle:"Banette Combourg",logoUrl:"assets/logo-placeholder.svg",primaryColor:"#5f0014",secondaryColor:"#f0c36b",tickerText:"Bienvenue dans votre boulangerie artisanale.",tickerSpeed:35,weatherCity:"Combourg",weatherLat:48.4089,weatherLon:-1.7517,defaultDuration:10};
let settings=cache("settings",D),categories=cache("categories",[]),media=cache("media",[]),widgets=cache("widgets",[]),urgent=cache("urgent",{enabled:false}),ci=0,mi=0;
const clock=new PlaybackClock(),params=new URLSearchParams(location.search),screenId=(params.get("screen")||"boutique").toLowerCase(),view=params.get("view");
const keepAwake=params.get("keepawake")==="test"?mountKeepAwakeTrial():null;
let tideSettings=tideConfig(cache("tides",{})),weatherSettings=weatherConfig(cache("weather_settings",{})),weatherShowing=false,weatherEndTimer,widgetGeneration=0;
const weatherSchedule=new WeatherSchedule();
weatherSchedule.configure(weatherSettings,screenId);
function cache(k,f){try{return JSON.parse(localStorage.getItem("bd_"+k))??f}catch{return f}}function save(k,v){try{localStorage.setItem("bd_"+k,JSON.stringify(v))}catch{}}
function shade(hex,p){const n=parseInt(hex.replace("#",""),16),a=Math.round(2.55*p),r=Math.max(0,Math.min(255,(n>>16)+a)),g=Math.max(0,Math.min(255,((n>>8)&255)+a)),b=Math.max(0,Math.min(255,(n&255)+a));return"#"+(0x1000000+r*0x10000+g*0x100+b).toString(16).slice(1)}
function apply(){document.documentElement.style.setProperty("--primary",settings.primaryColor||D.primaryColor);document.documentElement.style.setProperty("--primary-dark",shade(settings.primaryColor||D.primaryColor,-35));document.documentElement.style.setProperty("--secondary",settings.secondaryColor||D.secondaryColor);$("#brandName").textContent=settings.shopName||D.shopName;$("#brandSubtitle").textContent=settings.shopSubtitle||D.shopSubtitle;$("#brandLogo").src=settings.logoUrl||D.logoUrl;$("#ticker").textContent=settings.tickerText||"";$("#ticker").style.animationDuration=`${Number(settings.tickerSpeed||35)}s`;renderWidgets()}
function cats(){
 const list=categories.filter(c=>c.enabled!==false).sort((a,b)=>(a.order??999)-(b.order??999));
 const tide={id:"__tides",name:"Marées Saint-Malo",icon:"🌊",duration:tideSettings.duration,tides:true};
 if(view==="tides")return[tide];
 if(tidesOnScreen(tideSettings,screenId,"fullscreen"))list.push(tide);
 return list;
}
function active(m){if(m.enabled===false)return false;const n=Date.now(),s=m.startDate?new Date(m.startDate).getTime():null,e=m.endDate?new Date(m.endDate).getTime():null;return(!s||n>=s)&&(!e||n<=e)}
function listFor(id){return media.filter(m=>m.categoryId===id&&active(m)).sort((a,b)=>(a.order??999)-(b.order??999))}
function renderCats(){const bar=$("#categoryBar"),list=cats();bar.innerHTML="";list.forEach((c,i)=>{const b=document.createElement("button");b.className="category-chip"+(i===ci?" active":"");b.textContent=`${c.icon||""} ${c.name||"Onglet"}`.trim();b.addEventListener("click",()=>{ci=i;mi=0;startCategory()});bar.appendChild(b)})}
function startCategory(){clock.clear("slide");clock.clear("category");const list=cats();if(!list.length){next();return}if(ci>=list.length)ci=0;renderCats();const c=list[ci];mi=0;next();clock.schedule("category",()=>{ci=(ci+1)%list.length;startCategory()},Math.max(10,Number(c.duration||60))*1000)}
function hide(){$("#tideSlide").classList.add("hidden");$("#imageMedia").classList.add("hidden");const v=$("#videoMedia");v.classList.add("hidden");v.pause();v.removeAttribute("src");if(keepAwake)v.load()}
function show(x){clock.clear("slide");hide();keepAwake?.setContentVideo(x.type==="video"&&!!x.mediaUrl);$("#slideBackground").style.backgroundColor=x.backgroundColor||settings.primaryColor||D.primaryColor;$("#slideBackground").style.backgroundImage=(x.type==="message"&&x.mediaUrl)?`url("${x.mediaUrl}")`:"none";$("#slideCard").style.color=x.textColor||"#fff";const hideTitleForMedia=(x.type==="image"||x.type==="video");$("#title").textContent=hideTitleForMedia?"":(x.title||"");$("#text").textContent=x.text||"";$("#badge").textContent=x.badge||"";$("#badge").classList.toggle("hidden",!x.badge);$("#price").textContent=x.price||"";$("#price").classList.toggle("hidden",!x.price);$("#slideCard").classList.toggle("hidden",!((!hideTitleForMedia&&x.title)||x.text||x.badge||x.price));if(x.type==="image"&&x.mediaUrl){const im=$("#imageMedia");im.src=x.mediaUrl;im.style.objectFit=x.fit||"contain";im.classList.remove("hidden")}if(x.type==="video"&&x.mediaUrl){const v=$("#videoMedia");v.src=x.mediaUrl;v.style.objectFit=x.fit||"contain";v.classList.remove("hidden");if(!weatherShowing)v.play().catch(()=>{})}clock.schedule("slide",next,Math.max(3,Number(x.duration||settings.defaultDuration||10))*1000)}
function next(){if(urgent?.enabled){show({type:"message",title:urgent.title||"Information",text:urgent.text||"",mediaUrl:urgent.mediaUrl||"",backgroundColor:urgent.backgroundColor||settings.primaryColor,textColor:urgent.textColor||"#fff",duration:10});return}const cs=cats();if(!cs.length){fallback();return}if(ci>=cs.length)ci=0;if(cs[ci].tides){showTidePage();return}const list=listFor(cs[ci].id);if(!list.length){show({type:"message",title:cs[ci].name,text:"",duration:8,backgroundColor:cs[ci].color||settings.primaryColor});return}if(mi>=list.length)mi=0;show(list[mi]);mi=(mi+1)%list.length}
function fallback(){show({type:"message",title:"Bienvenue",text:"Votre écran boutique est prêt.",duration:10,backgroundColor:settings.primaryColor})}
async function weatherText(){return weatherService.currentText()}
async function value(w){const n=new Date();if(w.type==="clock")return n.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});if(w.type==="date")return n.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});if(w.type==="weather")return await weatherText();if(w.type==="ephemeris")return w.text||n.toLocaleDateString("fr-FR",{day:"numeric",month:"long"});return w.text||""}
function esc(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
async function renderWidgets(){
 const generation=++widgetGeneration,bar=$("#widgetsBar"),list=widgets.filter(w=>w.enabled!==false).sort((a,b)=>(a.order??999)-(b.order??999));
 const results=await Promise.all(list.map(async w=>{const el=document.createElement("article");el.className="widget";el.innerHTML=`<div>${esc(w.icon||"")}</div><div class="widget-title">${esc(w.title||w.type)}</div><div class="widget-value">${esc(await value(w))}</div>`;return el;}));
 if(generation!==widgetGeneration)return;
 if(tidesOnScreen(tideSettings,screenId,"compact")){const card=document.createElement("article");card.className="widget tide-header";renderTides(card,{compact:true});results.push(card);}
 bar.replaceChildren(...results);
}
function showTidePage(){clock.clear("slide");hide();keepAwake?.setContentVideo(false);$("#slideCard").classList.add("hidden");$("#tideSlide").classList.remove("hidden");renderTides($("#tideSlide"));}
function beginWeather(){
 if(urgent?.enabled||weatherShowing)return;
 weatherShowing=true;clock.pause();$("#videoMedia").pause();
 $("#weatherSlide").classList.remove("hidden");renderWeather($("#weatherSlide"),weatherSettings);
 weatherSchedule.shown(weatherSettings);
 if(view!=="weather")weatherEndTimer=setTimeout(endWeather,weatherSettings.duration*1000);
}
function endWeather(){
 clearTimeout(weatherEndTimer);weatherShowing=false;$("#weatherSlide").classList.add("hidden");clock.resume();
 const v=$("#videoMedia");if(!v.classList.contains("hidden")&&!urgent?.enabled)v.play().catch(()=>{});
}
weatherService.configure(weatherSettings);
weatherService.subscribe(()=>{renderWidgets();if(weatherShowing)renderWeather($("#weatherSlide"),weatherSettings);});
startTides(()=>{renderWidgets();if(!$("#tideSlide").classList.contains("hidden"))renderTides($("#tideSlide"));});
setInterval(()=>{
 if(view==="weather"&&!urgent?.enabled){beginWeather();return;}
 if(weatherSchedule.due(weatherSettings,screenId,{urgent:!!urgent?.enabled,showing:weatherShowing,preview:!!view}))beginWeather();
},500);
setInterval(renderWidgets,60000);apply();renderCats();startCategory();
onSnapshot(doc(db,"config","settings"),s=>{if(s.exists()){settings={...D,...s.data()};save("settings",settings);apply();$("#offline").classList.add("hidden")}},()=>$("#offline").classList.remove("hidden"));
onSnapshot(doc(db,"config","urgent"),s=>{urgent=s.exists()?s.data():{enabled:false};save("urgent",urgent);if(urgent.enabled)endWeather();next()});
onSnapshot(query(collection(db,"categories"),orderBy("order","asc")),s=>{categories=s.docs.map(d=>({id:d.id,...d.data()}));save("categories",categories);ci=0;startCategory()});
onSnapshot(query(collection(db,"media"),orderBy("order","asc")),s=>{media=s.docs.map(d=>({id:d.id,...d.data()}));save("media",media);mi=0;next()});
onSnapshot(query(collection(db,"widgets"),orderBy("order","asc")),s=>{widgets=s.docs.map(d=>({id:d.id,...d.data()}));save("widgets",widgets);renderWidgets()});

onSnapshot(doc(db,"config","tides"),s=>{tideSettings=tideConfig(s.exists()?s.data():{});save("tides",tideSettings);renderWidgets();ci=0;startCategory();});
onSnapshot(doc(db,"config","weather"),s=>{
 weatherSettings=weatherConfig(s.exists()?s.data():{});save("weather_settings",weatherSettings);weatherService.configure(weatherSettings);weatherSchedule.configure(weatherSettings,screenId);
 if(weatherShowing){if(view!=="weather"&&!weatherOnScreen(weatherSettings,screenId))endWeather();else{renderWeather($("#weatherSlide"),weatherSettings);if(view!=="weather"){clearTimeout(weatherEndTimer);weatherEndTimer=setTimeout(endWeather,weatherSettings.duration*1000);}}}
});
window.addEventListener("offline",()=>$("#offline").classList.remove("hidden"));
window.addEventListener("online",()=>$("#offline").classList.add("hidden"));
