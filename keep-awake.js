// Optional experiment: media playback does not prove that Vega OS will stay awake.
export class KeepAwakeTrial {
  constructor({video, document, navigator, report=()=>{}}) {
    Object.assign(this,{video,document,navigator,report});
    this.enabled=false;
    this.contentVideo=false;
    this.generation=0;
    this.lock=null;
    this.lockPending=false;
    this.playPending=false;
    this.onVisibility=()=>this.sync();
    this.onTime=()=>{if(video.currentTime>0.5)video.currentTime=0;};
    this.onError=()=>{if(this.enabled&&!this.contentVideo&&!document.hidden){this.releaseVideo();this.report('failed');}};
    document.addEventListener('visibilitychange',this.onVisibility);
    video.addEventListener('timeupdate',this.onTime);
    video.addEventListener('error',this.onError);
  }
  start(){this.enabled=true;this.sync();}
  stop(){this.enabled=false;this.sync();}
  setContentVideo(value){
    if(this.contentVideo===value)return;
    this.contentVideo=value;
    this.sync();
  }
  releaseVideo(){
    this.generation++;
    this.playPending=false;
    if(this.video.getAttribute('src')){
      this.video.pause();
      this.video.removeAttribute('src');
      this.video.load();
    }
  }
  releaseLock(){
    const lock=this.lock;this.lock=null;
    if(lock)Promise.resolve(lock.release()).catch(()=>{});
  }
  async requestLock(){
    if(!this.navigator.wakeLock||this.lock||this.lockPending)return;
    this.lockPending=true;
    try{
      const lock=await this.navigator.wakeLock.request('screen');
      if(!this.enabled||this.document.hidden)await lock.release();
      else{
        this.lock=lock;
        lock.addEventListener('release',()=>{if(this.lock===lock)this.lock=null;});
      }
    }catch{/* This trial also attempts video playback when Screen Wake Lock is unavailable. */}
    finally{this.lockPending=false;}
  }
  sync(){
    if(!this.enabled||this.document.hidden){
      this.releaseVideo();this.releaseLock();
      this.report(this.enabled?'paused':'off');return;
    }
    this.requestLock();
    // Release the trial decoder before the player assigns its own video source.
    // A paused playlist video retains its decoder during the 20-second weather page.
    if(this.contentVideo){this.releaseVideo();this.report('content');return;}
    if(this.playPending)return;
    if(this.video.getAttribute('src')&&!this.video.paused){this.report('playing');return;}
    if(!this.video.getAttribute('src'))this.video.src='assets/keep-awake.mp4';
    const generation=++this.generation;
    this.playPending=true;
    this.report('starting');
    try{
      Promise.resolve(this.video.play()).then(()=>{
        if(generation===this.generation){this.playPending=false;this.report('playing');}
      },()=>{
        if(generation===this.generation){this.releaseVideo();this.report('blocked');}
      });
    }catch{
      this.releaseVideo();this.report('blocked');
    }
  }
  destroy(){
    this.stop();
    this.document.removeEventListener('visibilitychange',this.onVisibility);
    this.video.removeEventListener('timeupdate',this.onTime);
    this.video.removeEventListener('error',this.onError);
  }
}

export function mountKeepAwakeTrial(){
  const panel=document.createElement('section');
  panel.className='awake-trial';
  panel.setAttribute('aria-label','Essai anti-veille');
  const title=document.createElement('strong');title.textContent='Essai anti-veille';
  const status=document.createElement('span');status.textContent='À vérifier sur votre téléviseur';
  status.setAttribute('role','status');
  const button=document.createElement('button');button.textContent='Démarrer l’essai';
  const exit=document.createElement('a');exit.textContent='Quitter l’essai';
  const url=new URL(location.href);url.searchParams.delete('keepawake');exit.href=url.href;
  const video=document.createElement('video');
  video.muted=true;video.defaultMuted=true;video.loop=true;video.playsInline=true;
  video.setAttribute('muted','');video.setAttribute('playsinline','');
  video.setAttribute('aria-hidden','true');video.tabIndex=-1;video.preload='none';
  video.className='awake-trial-video';
  panel.append(title,status,button,exit,video);document.body.append(panel);
  let startedAt=0,currentState='off';
  const refresh=()=>{
    const elapsed=startedAt?Math.floor((Date.now()-startedAt)/1000):0;
    const time=`${Math.floor(elapsed/60)} min ${String(elapsed%60).padStart(2,'0')} s`;
    const messages={off:'À vérifier sur votre téléviseur',starting:'Démarrage…',playing:`Essai en cours · ${time}`,content:`Essai en cours · ${time}`,paused:'Essai suspendu : page masquée',blocked:'Lecture bloquée : appuyez sur Réessayer',failed:'Vidéo d’essai indisponible : réessayez'};
    status.textContent=messages[currentState];
    button.textContent=['blocked','failed'].includes(currentState)?'Réessayer':trial.enabled?'Arrêter l’essai':'Démarrer l’essai';
  };
  const trial=new KeepAwakeTrial({video,document,navigator,report:state=>{currentState=state;refresh();}});
  button.addEventListener('click',()=>{
    if(!trial.enabled||['blocked','failed'].includes(currentState)){
      startedAt=Date.now();trial.start();
    }else{trial.stop();startedAt=0;}
  });
  const timer=setInterval(refresh,1000);
  window.addEventListener('pagehide',event=>{
    if(event.persisted){trial.stop();startedAt=0;}
    else{trial.destroy();clearInterval(timer);}
  });
  button.focus();
  return trial;
}
