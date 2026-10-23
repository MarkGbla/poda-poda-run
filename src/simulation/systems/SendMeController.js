(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PODA_SendMe=api;})(typeof window!=='undefined'?window:null,()=>{
  const config={enabled:true,motorcycleShare:.08,acceleration:2.5,braking:9,gap:2.5,headway:1.3};
  function step(o,all,run,dt,cap=Infinity,lanes=null){
    if(lanes&&Number.isInteger(o.lane)){
      const width=run.vehicle?.width||2.1;
      const gapToPlayer=o.z-(o.len+(run.vehicle?.length||5.2))/2;
      const approaching=o.z>0&&Math.abs(o.x-run.x)<(o.wid+width)/2+.25&&o.speed-run.speed>2;
      if(approaching&&gapToPlayer<Math.max(32,(o.speed-run.speed)*(o.passLead||3))&&o.lane===run.lane){
        const side=o.passSide||-1;
        const available=[o.lane+side,o.lane-side].filter(l=>l>=0&&l<lanes.length&&
          !all.some(v=>v!==o&&!v.flat&&!v.cross&&Math.abs(v.z-o.z)<18&&Math.abs(v.x-lanes[l])<(v.wid+o.wid)/2+.25)&&
          !(Math.abs(o.z)<22&&Math.abs(run.x-lanes[l])<(width+o.wid)/2+1));
        if(available.length)o.lane=available[0];
      }
      o.x+=(lanes[o.lane]-o.x)*Math.min(1,dt*2.5);
    }
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
    o.npcState=o.speed<.08?'STOPPED':o.braking?'BRAKING':lanes&&o.lane!==run.lane&&o.z>0?'PASSING':gap<config.gap+o.speed*config.headway+3?'FOLLOWING_TRAFFIC':'CRUISING';
    o.leaderGap=gap;
  }
  return {config,step};
});
