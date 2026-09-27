// Pause the slideshow (including the category deadline) during a weather page.
export class PlaybackClock {
  constructor({now=()=>Date.now(),set=(fn,ms)=>setTimeout(fn,ms),clear=id=>clearTimeout(id)}={}) {this.now=now;this.set=set;this.cancel=clear;this.jobs=new Map();this.paused=false;}
  schedule(name,fn,ms){this.clear(name);const job={fn,remaining:Math.max(0,ms),deadline:this.now()+Math.max(0,ms),id:null};this.jobs.set(name,job);if(!this.paused)this.arm(name,job);}
  arm(name,job){job.deadline=this.now()+job.remaining;job.id=this.set(()=>{this.jobs.delete(name);job.fn();},job.remaining);}
  clear(name){const job=this.jobs.get(name);if(job)this.cancel(job.id);this.jobs.delete(name);}
  pause(){if(this.paused)return;this.paused=true;for(const job of this.jobs.values()){this.cancel(job.id);job.remaining=Math.max(0,job.deadline-this.now());}}
  resume(){if(!this.paused)return;this.paused=false;for(const [name,job] of this.jobs)this.arm(name,job);}
}
