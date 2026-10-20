export const ROUTE_RHUM_MAP_URL = "https://trimaransvrlazartigue.geovoile.com/routedurhum/2026/viewer/?version=pedagogic";

export const DEFAULT_ROUTE_RHUM = Object.freeze({
  enabled: true,
  screenId: "boutique",
  duration: 60,
  intervalMinutes: 30
});

const clamp = (n,min,max,fallback) => Math.round(Math.max(min,Math.min(max,Number.isFinite(Number(n))?Number(n):fallback)));

export function routeRhumConfig(value={}) {
  const c={...DEFAULT_ROUTE_RHUM,...value};
  return {
    ...c,
    enabled:c.enabled!==false,
    screenId:String(c.screenId||"boutique").trim().toLowerCase(),
    duration:clamp(c.duration,10,300,60),
    intervalMinutes:clamp(c.intervalMinutes,5,1440,30)
  };
}

export const routeRhumOnScreen=(config,screen)=>config.enabled&&(config.screenId==="all"||config.screenId===screen);

export class RouteRhumSchedule {
  constructor(now=Date.now()){this.nextAt=now+30*60000;this.signature="";}
  configure(config,screen,now=Date.now()){
    const signature=JSON.stringify([config.enabled,config.screenId,config.intervalMinutes,screen]);
    if(signature!==this.signature){this.signature=signature;this.nextAt=now+config.intervalMinutes*60000;}
  }
  due(config,screen,{now=Date.now(),urgent=false,showing=false,preview=false}={}){
    return !urgent&&!showing&&!preview&&routeRhumOnScreen(config,screen)&&now>=this.nextAt;
  }
  shown(config,now=Date.now()){this.nextAt=now+config.intervalMinutes*60000;}
}
