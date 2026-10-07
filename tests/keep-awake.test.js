import test from 'node:test';
import assert from 'node:assert/strict';
import {KeepAwakeTrial} from '../keep-awake.js';

const flush=async()=>{await Promise.resolve();await Promise.resolve();};
function fixture({play=()=>Promise.resolve(),wakeLock}={}){
  const document=new EventTarget();document.hidden=false;
  const video=new EventTarget();
  Object.assign(video,{src:'',paused:true,loads:0,currentTime:0,
    getAttribute(){return this.src;},removeAttribute(){this.src='';},
    load(){this.loads++;},pause(){this.paused=true;},
    play(){this.paused=false;return play();}});
  const states=[];
  const trial=new KeepAwakeTrial({video,document,navigator:{wakeLock},report:state=>states.push(state)});
  return {video,document,states,trial};
}
test('Essai inactif avant une action explicite, arrêt libérant la vidéo',async()=>{
  const f=fixture();assert.equal(f.video.src,'');
  f.trial.start();await flush();assert.equal(f.states.at(-1),'playing');
  assert.equal(f.video.src,'assets/keep-awake.mp4');
  f.trial.stop();assert.equal(f.video.src,'');assert.equal(f.video.paused,true);
  assert.equal(f.video.loads,1);assert.equal(f.states.at(-1),'off');
});
test('Une vidéo du diaporama libère le décodeur d’essai avant le transfert',async()=>{
  const f=fixture();f.trial.start();await flush();
  f.trial.setContentVideo(true);
  assert.equal(f.video.src,'');assert.equal(f.video.loads,1);assert.equal(f.states.at(-1),'content');
  f.document.dispatchEvent(new Event('visibilitychange'));assert.equal(f.video.src,'');
  f.trial.setContentVideo(false);await flush();assert.equal(f.states.at(-1),'playing');
});
test('Onglet masqué : arrêt ; retour visible : reprise seulement si essai activé',async()=>{
  const f=fixture();f.trial.start();await flush();
  f.document.hidden=true;f.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(f.video.src,'');assert.equal(f.states.at(-1),'paused');
  f.document.hidden=false;f.document.dispatchEvent(new Event('visibilitychange'));await flush();
  assert.equal(f.states.at(-1),'playing');
  f.trial.stop();f.document.dispatchEvent(new Event('visibilitychange'));assert.equal(f.video.src,'');
});
test('Un refus de lecture est signalé et ne produit pas de rejet non traité',async()=>{
  const f=fixture({play:()=>Promise.reject(new Error('NotAllowedError'))});
  f.trial.start();await flush();assert.equal(f.states.at(-1),'blocked');
  f.video.dispatchEvent(new Event('error'));assert.equal(f.states.at(-1),'failed');
});
test('Une promesse de lecture tardive ne réactive pas un essai arrêté',async()=>{
  let resolve;const f=fixture({play:()=>new Promise(r=>resolve=r)});
  f.trial.start();f.trial.stop();resolve();await flush();
  assert.equal(f.states.at(-1),'off');assert.equal(f.video.src,'');
});
test('Un verrou obtenu après l’arrêt est immédiatement libéré',async()=>{
  let resolve,released=0;
  const f=fixture({wakeLock:{request:()=>new Promise(r=>resolve=r)}});
  f.trial.start();f.trial.stop();resolve({release(){released++;return Promise.resolve();}});await flush();
  assert.equal(released,1);assert.equal(f.trial.lock,null);
});
test('Un refus du verrou natif laisse la vidéo d’essai fonctionner',async()=>{
  const f=fixture({wakeLock:{request:()=>Promise.reject(new Error('unsupported'))}});
  f.trial.start();await flush();assert.equal(f.states.at(-1),'playing');assert.equal(f.trial.lock,null);
});
test('La boucle reprend au début et le démontage retire les écouteurs',async()=>{
  const f=fixture();f.trial.start();await flush();
  f.video.currentTime=0.7;f.video.dispatchEvent(new Event('timeupdate'));assert.equal(f.video.currentTime,0);
  f.trial.destroy();const count=f.states.length;
  f.document.dispatchEvent(new Event('visibilitychange'));f.video.dispatchEvent(new Event('error'));
  assert.equal(f.states.length,count);assert.equal(f.video.src,'');
});
