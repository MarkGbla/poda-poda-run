(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PODA_SendMe=api;})(typeof window!=='undefined'?window:null,()=>{
  const config={enabled:true,motorcycleShare:.08,acceleration:2.5,braking:9,gap:2.5,headway:1.3};
  function step(o,all,run,dt,cap=Infinity){
    let gap=Infinity, leaderSpeed=0;
    function consider(z,x,len,wid,speed){
      if(z>=o.z||Math.abs(x-o.x)>(wid+o.wid)/2+.35)return;
      const d=o.z-z-(o.len+len)/2;
      if(d<gap){gap=d;leaderSpeed=Math.max(0,speed||0);}
    }
    for(const v of all)if(v!==o&&!v.dead&&!v.flat)consider(v.z,v.x,v.len,v.wid,v.speed);
    consider(0,run.x,run.vehicle?.length||5.2,run.vehicle?.width||2.1,run.speed);
    const cruise=Math.min(o.cruise,cap);
    const target=Math.min(cruise,Math.max(0,leaderSpeed+(gap-config.gap)/config.headway));
    const previous=o.speed;
    o.speed+=Math.max(-config.braking*dt,Math.min(config.acceleration*dt,target-o.speed));
    // Conservative emergency bound prevents tunnelling through a stopped leader,
    // even if it is updated later in the existing reverse iteration.
    if(dt>0)o.speed=Math.min(o.speed,Math.max(0,(gap-config.gap)/dt));
    o.braking=o.speed<previous-.01;
    o.npcState=o.speed<.08?'STOPPED':o.braking?'BRAKING':gap<config.gap+o.speed*config.headway+3?'FOLLOWING_TRAFFIC':'CRUISING';
    o.leaderGap=gap;
  }
  return {config,step};
});
