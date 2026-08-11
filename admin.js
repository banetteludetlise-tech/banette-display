import { firebaseConfig } from "./firebase-config.js";
import { cloudinaryConfig } from "./cloudinary-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, setDoc, deleteDoc, getDoc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseApp=initializeApp(firebaseConfig),auth=getAuth(firebaseApp),db=getFirestore(firebaseApp);
const $=s=>document.querySelector(s);
let categories=[],media=[],widgets=[],unsubs=[];

function status(el,msg,ok=true){el.textContent=msg;el.className=`status ${ok?"ok":"error"}`}
function esc(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
async function uploadCloudinary(file,progressEl){
  if(!file)return null;
  const form=new FormData();
  form.append("file",file);
  form.append("upload_preset",cloudinaryConfig.uploadPreset);
  if(cloudinaryConfig.folder)form.append("folder",cloudinaryConfig.folder);
  progressEl?.classList.remove("hidden");
  progressEl && (progressEl.value=20);
  const endpoint=`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/auto/upload`;
  const res=await fetch(endpoint,{method:"POST",body:form});
  progressEl && (progressEl.value=90);
  if(!res.ok){const t=await res.text();throw new Error(t||"Échec Cloudinary")}
  const data=await res.json();
  progressEl && (progressEl.value=100);
  setTimeout(()=>progressEl?.classList.add("hidden"),500);
  return {url:data.secure_url,deleteToken:data.delete_token||"",publicId:data.public_id||"",resourceType:data.resource_type||"image",uploadedAt:Date.now()};
}


async function deleteCloudinaryWithToken(item){
  if(!item?.cloudinaryDeleteToken)return false;
  try{
    const form=new FormData(); form.append("token",item.cloudinaryDeleteToken);
    const res=await fetch("https://api.cloudinary.com/v1_1/delete_by_token",{method:"POST",body:form});
    if(!res.ok)return false;
    const data=await res.json(); return data.result==="ok";
  }catch(e){console.warn("Suppression Cloudinary impossible",e);return false;}
}

$("#loginForm").addEventListener("submit",async e=>{e.preventDefault();try{await signInWithEmailAndPassword(auth,$("#loginEmail").value.trim(),$("#loginPassword").value);status($("#loginStatus"),"Connexion réussie.")}catch(err){status($("#loginStatus"),"Connexion impossible. Vérifiez vos identifiants.",false);console.error(err)}});
$("#logoutButton").addEventListener("click",()=>signOut(auth));
onAuthStateChanged(auth,user=>{$("#loginPanel").classList.toggle("hidden",!!user);$("#appPanel").classList.toggle("hidden",!user);$("#logoutButton").classList.toggle("hidden",!user);unsubs.forEach(f=>f());unsubs=[];if(user)startListeners()});
document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));document.querySelectorAll(".tab-panel").forEach(x=>x.classList.remove("active"));btn.classList.add("active");$(`#tab-${btn.dataset.tab}`).classList.add("active")}));

$("#categoryForm").addEventListener("submit",async e=>{e.preventDefault();try{const id=$("#categoryId").value,data={name:$("#categoryName").value.trim(),icon:$("#categoryIcon").value.trim(),color:$("#categoryColor").value,duration:Number($("#categoryDuration").value||60),enabled:$("#categoryEnabled").checked,updatedAt:serverTimestamp(),cloudinaryDeleteToken:window.__lastCloudUpload?.deleteToken||"",cloudinaryPublicId:window.__lastCloudUpload?.publicId||"",cloudinaryResourceType:window.__lastCloudUpload?.resourceType||""};window.__lastCloudUpload=null;if(id)await setDoc(doc(db,"categories",id),data,{merge:true});else await addDoc(collection(db,"categories"),{...data,order:categories.length+1,createdAt:serverTimestamp()});status($("#categoryStatus"),"Onglet enregistré.");resetCategory()}catch(err){status($("#categoryStatus"),"Erreur d’enregistrement.",false);console.error(err)}});
$("#newCategoryButton").addEventListener("click",resetCategory);
function resetCategory(){$("#categoryForm").reset();$("#categoryId").value="";$("#categoryColor").value="#5f0014";$("#categoryDuration").value=60;$("#categoryEnabled").checked=true}
function editCategory(id){const c=categories.find(x=>x.id===id);if(!c)return;$("#categoryId").value=c.id;$("#categoryName").value=c.name||"";$("#categoryIcon").value=c.icon||"";$("#categoryColor").value=c.color||"#5f0014";$("#categoryDuration").value=c.duration||60;$("#categoryEnabled").checked=c.enabled!==false;window.scrollTo({top:0,behavior:"smooth"})}
async function removeCategory(id){if(confirm("Supprimer cet onglet ?"))await deleteDoc(doc(db,"categories",id))}

$("#mediaForm").addEventListener("submit",async e=>{e.preventDefault();try{const id=$("#mediaId").value,file=$("#mediaFile").files[0];let url=$("#mediaUrl").value.trim();if(file){status($("#mediaStatus"),"Envoi du fichier vers Cloudinary…");const up=await uploadCloudinary(file,$("#uploadProgress"));url=up?.url||url;window.__lastCloudUpload=up}const data={categoryId:$("#mediaCategory").value,type:$("#mediaType").value,title:$("#mediaTitle").value.trim(),text:$("#mediaText").value.trim(),badge:$("#mediaBadge").value.trim(),price:$("#mediaPrice").value.trim(),duration:Number($("#mediaDuration").value||10),fit:$("#mediaFit").value,mediaUrl:url,startDate:$("#mediaStart").value||"",endDate:$("#mediaEnd").value||"",backgroundColor:$("#mediaBackground").value,textColor:$("#mediaTextColor").value,enabled:$("#mediaEnabled").checked,updatedAt:serverTimestamp(),cloudinaryDeleteToken:window.__lastCloudUpload?.deleteToken||"",cloudinaryPublicId:window.__lastCloudUpload?.publicId||"",cloudinaryResourceType:window.__lastCloudUpload?.resourceType||""};window.__lastCloudUpload=null;if(id)await setDoc(doc(db,"media",id),data,{merge:true});else await addDoc(collection(db,"media"),{...data,order:media.length+1,createdAt:serverTimestamp()});status($("#mediaStatus"),"Contenu enregistré.");resetMedia()}catch(err){status($("#mediaStatus"),"Échec de l’envoi ou de l’enregistrement.",false);console.error(err)}});
$("#newMediaButton").addEventListener("click",resetMedia);
function resetMedia(){$("#mediaForm").reset();$("#mediaId").value="";$("#mediaDuration").value=10;$("#mediaFit").value="contain";$("#mediaBackground").value="#5f0014";$("#mediaTextColor").value="#ffffff";$("#mediaEnabled").checked=true;fillCategorySelects()}
function editMedia(id){const m=media.find(x=>x.id===id);if(!m)return;$("#mediaId").value=m.id;$("#mediaCategory").value=m.categoryId||"";$("#mediaType").value=m.type||"image";$("#mediaTitle").value=m.title||"";$("#mediaText").value=m.text||"";$("#mediaBadge").value=m.badge||"";$("#mediaPrice").value=m.price||"";$("#mediaDuration").value=m.duration||10;$("#mediaFit").value=m.fit||"contain";$("#mediaUrl").value=m.mediaUrl||"";$("#mediaStart").value=m.startDate||"";$("#mediaEnd").value=m.endDate||"";$("#mediaBackground").value=m.backgroundColor||"#5f0014";$("#mediaTextColor").value=m.textColor||"#ffffff";$("#mediaEnabled").checked=m.enabled!==false;window.scrollTo({top:0,behavior:"smooth"})}
async function removeMedia(id){const item=media.find(x=>x.id===id);if(!confirm("Supprimer définitivement ce contenu ?"))return;await deleteDoc(doc(db,"media",id));const erased=await deleteCloudinaryWithToken(item);if(erased)alert("Contenu et fichier Cloudinary supprimés.");else alert("Contenu supprimé définitivement de Banette Display. Le fichier Cloudinary ancien ne peut pas toujours être effacé automatiquement depuis GitHub Pages.");}
$("#mediaFilter").addEventListener("change",renderMedia);

$("#widgetForm").addEventListener("submit",async e=>{e.preventDefault();try{const id=$("#widgetId").value,data={type:$("#widgetType").value,title:$("#widgetTitle").value.trim(),text:$("#widgetText").value.trim(),icon:$("#widgetIcon").value.trim(),enabled:$("#widgetEnabled").checked,updatedAt:serverTimestamp(),cloudinaryDeleteToken:window.__lastCloudUpload?.deleteToken||"",cloudinaryPublicId:window.__lastCloudUpload?.publicId||"",cloudinaryResourceType:window.__lastCloudUpload?.resourceType||""};window.__lastCloudUpload=null;if(id)await setDoc(doc(db,"widgets",id),data,{merge:true});else await addDoc(collection(db,"widgets"),{...data,order:widgets.length+1,createdAt:serverTimestamp()});status($("#widgetStatus"),"Widget enregistré.");resetWidget()}catch(err){status($("#widgetStatus"),"Erreur d’enregistrement.",false);console.error(err)}});
$("#newWidgetButton").addEventListener("click",resetWidget);
function resetWidget(){$("#widgetForm").reset();$("#widgetId").value="";$("#widgetEnabled").checked=true}
function editWidget(id){const w=widgets.find(x=>x.id===id);if(!w)return;$("#widgetId").value=w.id;$("#widgetType").value=w.type||"info";$("#widgetTitle").value=w.title||"";$("#widgetText").value=w.text||"";$("#widgetIcon").value=w.icon||"";$("#widgetEnabled").checked=w.enabled!==false;window.scrollTo({top:0,behavior:"smooth"})}
async function removeWidget(id){if(confirm("Supprimer ce widget ?"))await deleteDoc(doc(db,"widgets",id))}

$("#urgentForm").addEventListener("submit",async e=>{e.preventDefault();try{let url=$("#urgentUrl").value.trim();const f=$("#urgentFile").files[0];if(f){status($("#urgentStatus"),"Envoi de l’image…");const up=await uploadCloudinary(f,null);url=up?.url||url}await setDoc(doc(db,"config","urgent"),{title:$("#urgentTitle").value.trim(),text:$("#urgentText").value.trim(),mediaUrl:url,backgroundColor:$("#urgentBackground").value,textColor:$("#urgentColor").value,enabled:$("#urgentEnabled").checked,updatedAt:serverTimestamp()});status($("#urgentStatus"),"Information enregistrée.")}catch(err){status($("#urgentStatus"),"Erreur pendant l’enregistrement.",false);console.error(err)}});

$("#settingsForm").addEventListener("submit",async e=>{e.preventDefault();try{let logo=$("#logoUrl").value.trim();const f=$("#logoFile").files[0];if(f){status($("#settingsStatus"),"Envoi du logo…");const up=await uploadCloudinary(f,null);logo=up?.url||logo}await setDoc(doc(db,"config","settings"),{shopName:$("#shopName").value.trim(),shopSubtitle:$("#shopSubtitle").value.trim(),logoUrl:logo||"assets/logo-placeholder.svg",primaryColor:$("#primaryColor").value,secondaryColor:$("#secondaryColor").value,tickerText:$("#tickerText").value.trim(),tickerSpeed:Number($("#tickerSpeed").value||35),weatherCity:$("#weatherCity").value.trim(),weatherLat:Number($("#weatherLat").value),weatherLon:Number($("#weatherLon").value),defaultDuration:Number($("#defaultDuration").value||10),updatedAt:serverTimestamp()});status($("#settingsStatus"),"Réglages enregistrés.")}catch(err){status($("#settingsStatus"),"Erreur pendant l’enregistrement.",false);console.error(err)}});

$("#passwordForm").addEventListener("submit",async e=>{e.preventDefault();const p=$("#newPassword").value,c=$("#confirmPassword").value;if(p!==c){status($("#passwordStatus"),"Les mots de passe sont différents.",false);return}try{await updatePassword(auth.currentUser,p);status($("#passwordStatus"),"Mot de passe modifié.");$("#passwordForm").reset()}catch(err){status($("#passwordStatus"),"Reconnectez-vous puis réessayez.",false);console.error(err)}});

async function move(col,list,id,d){const ordered=[...list].sort((a,b)=>(a.order??999)-(b.order??999)),i=ordered.findIndex(x=>x.id===id),j=i+d;if(i<0||j<0||j>=ordered.length)return;await Promise.all([setDoc(doc(db,col,ordered[i].id),{order:ordered[j].order},{merge:true}),setDoc(doc(db,col,ordered[j].id),{order:ordered[i].order},{merge:true})])}
function row(item,subtitle,editFn,deleteFn,moveFn){const el=document.createElement("article");el.className="item-row";const info=document.createElement("div");info.innerHTML=`<h3>${esc(item.icon||"")} ${esc(item.name||item.title||"Sans titre")}</h3><p>${esc(subtitle)} · <span class="state ${item.enabled!==false?"on":"off"}">${item.enabled!==false?"Actif":"Inactif"}</span></p>`;const actions=document.createElement("div");actions.className="item-actions";[["↑",()=>moveFn(-1),"secondary"],["↓",()=>moveFn(1),"secondary"],["Modifier",editFn,"secondary"],["Supprimer",deleteFn,"danger"]].forEach(([t,fn,c])=>{const b=document.createElement("button");b.type="button";b.className=`btn small ${c}`;b.textContent=t;b.addEventListener("click",fn);actions.appendChild(b)});el.append(info,actions);return el}
function fillCategorySelects(){const opts=categories.map(c=>`<option value="${c.id}">${esc(c.name||"Onglet")}</option>`).join("");const cur=$("#mediaCategory").value;$("#mediaCategory").innerHTML=opts;if(cur&&categories.some(c=>c.id===cur))$("#mediaCategory").value=cur;const fcur=$("#mediaFilter").value;$("#mediaFilter").innerHTML='<option value="">Tous</option>'+opts;if(fcur)$("#mediaFilter").value=fcur}
function renderCategories(){$("#metricCategories").textContent=categories.length;fillCategorySelects();const w=$("#categoryList");w.innerHTML="";if(!categories.length)w.innerHTML="<p>Aucun onglet.</p>";categories.forEach(c=>w.appendChild(row(c,`${c.duration||60} s`,()=>editCategory(c.id),()=>removeCategory(c.id),d=>move("categories",categories,c.id,d))))}
function renderMedia(){$("#metricMedia").textContent=media.length;const f=$("#mediaFilter").value,list=f?media.filter(m=>m.categoryId===f):media,w=$("#mediaList");w.innerHTML="";if(!list.length)w.innerHTML="<p>Aucun contenu.</p>";list.forEach(m=>{const c=categories.find(x=>x.id===m.categoryId);w.appendChild(row(m,`${c?.name||"Sans onglet"} · ${m.type||"message"} · ${m.duration||10} s`,()=>editMedia(m.id),()=>removeMedia(m.id),d=>move("media",media,m.id,d)))})}
function renderWidgets(){$("#metricWidgets").textContent=widgets.length;const w=$("#widgetList");w.innerHTML="";if(!widgets.length)w.innerHTML="<p>Aucun widget.</p>";widgets.forEach(x=>w.appendChild(row({...x,name:x.title||x.type},x.type||"info",()=>editWidget(x.id),()=>removeWidget(x.id),d=>move("widgets",widgets,x.id,d))))}
async function loadConfig(){const s=await getDoc(doc(db,"config","settings"));if(s.exists()){const x=s.data();["shopName","shopSubtitle","logoUrl","tickerText","weatherCity"].forEach(k=>$("#"+k).value=x[k]||"");$("#primaryColor").value=x.primaryColor||"#5f0014";$("#secondaryColor").value=x.secondaryColor||"#f0c36b";$("#tickerSpeed").value=x.tickerSpeed||35;$("#weatherLat").value=x.weatherLat??48.4089;$("#weatherLon").value=x.weatherLon??-1.7517;$("#defaultDuration").value=x.defaultDuration||10}const u=await getDoc(doc(db,"config","urgent"));if(u.exists()){const x=u.data();$("#urgentTitle").value=x.title||"";$("#urgentText").value=x.text||"";$("#urgentUrl").value=x.mediaUrl||"";$("#urgentBackground").value=x.backgroundColor||"#5f0014";$("#urgentColor").value=x.textColor||"#fff";$("#urgentEnabled").checked=!!x.enabled}}
function startListeners(){unsubs.push(onSnapshot(query(collection(db,"categories"),orderBy("order","asc")),s=>{categories=s.docs.map(d=>({id:d.id,...d.data()}));renderCategories();renderMedia()}));unsubs.push(onSnapshot(query(collection(db,"media"),orderBy("order","asc")),s=>{media=s.docs.map(d=>({id:d.id,...d.data()}));renderMedia()}));unsubs.push(onSnapshot(query(collection(db,"widgets"),orderBy("order","asc")),s=>{widgets=s.docs.map(d=>({id:d.id,...d.data()}));renderWidgets()}));loadConfig()}
