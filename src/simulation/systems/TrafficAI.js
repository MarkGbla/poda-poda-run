(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;if(root)root.PODA_TrafficAI=value;})(typeof window!=='undefined'?window:null,()=>({
  step(o,all,run,dt,lanes,random=Math.random) {
    if(o.flat||o.static)return;
    if(o.cross){
      if(!o.flee){const danger=Math.abs(o.z)<35&&run.speed>3; o.pedestrianState=danger?'WAIT':'CROSS'; o.vx=danger?0:(o.crossVelocity||o.vx);}
      else o.pedestrianState='STEP_BACK';
      return;
    }
    o.cruise??=o.speed; o.decision=(o.decision??2)-dt;o.stopTimer=Math.max(0,(o.stopTimer||0)-dt);
    const clear=lane=>!all.some(v=>v!==o&&Math.abs(v.z-o.z)<18&&Math.abs(v.x-lanes[lane])<(v.wid+o.wid)/2+.5) && !(Math.abs(o.z)<22&&Math.abs(run.x-lanes[lane])<3);
    const ahead=all.filter(v=>v!==o&&!v.cross&&v.z<o.z&&Math.abs(v.x-o.x)<(v.wid+o.wid)/2+.4).sort((a,b)=>b.z-a.z)[0];
    let target=o.cruise;
    if(ahead){const gap=o.z-ahead.z-(o.len+ahead.len)/2;target=Math.min(target,Math.max(0,(gap-5)*.7));}
    if(o.decision<=0){
      o.decision=o.poolKey==='okada'?2.5:5+random()*3;
      const adjacent=[o.lane-1,o.lane+1].filter(l=>l>=0&&l<lanes.length&&clear(l));
      if(adjacent.length&&(ahead||o.honked||random()<.35)){o.lane=adjacent[0];o.honked=false;}
      else if(['taxi','kekeh','poda','waka'].includes(o.poolKey)&&o.lane===2&&random()<.22)o.stopTimer=o.poolKey==='waka'?4:1.5;
    }
    if(o.stopTimer>0)target=0;
    o.speed+=Math.max(-10*dt,Math.min(3*dt,target-o.speed));
    o.x+=(lanes[o.lane]-o.x)*Math.min(1,dt*(o.poolKey==='okada'?2.5:1.2));
    // Preserve separation even when the leader brakes suddenly.
    if(ahead)o.z=Math.max(o.z,ahead.z+(o.len+ahead.len)/2+2);
  }
}));
