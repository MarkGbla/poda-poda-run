(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;if(root)root.PODA_TrafficAI=value;})(typeof window!=='undefined'?window:null,()=>{
  const MIN_GAP=2.5, HEADWAY=1.25, BRAKING=13, ACCELERATION=3.5;
  function step(o,all,run,dt,lanes,random=Math.random,roadDistance=run.speed*dt) {
    if(o.flat||o.static)return;
    if(o.cross){
      if(!o.flee){const danger=Math.abs(o.z)<35&&run.speed>3; o.pedestrianState=danger?'WAIT':'CROSS'; o.vx=danger?0:(o.crossVelocity||o.vx);}
      else o.pedestrianState='STEP_BACK';
      return;
    }
    o.cruise??=o.speed;
    o.decision=(o.decision??2)-dt;
    o.stopTimer=Math.max(0,(o.stopTimer||0)-dt);
    const occupies=(v,x)=>Math.abs(v.x-x)<(v.wid+o.wid)/2+.25;
    const clear=lane=>!all.some(v=>v!==o&&!v.flat&&!v.cross&&Math.abs(v.z-o.z)<Math.max(18,(v.len+o.len)/2+8)&&occupies(v,lanes[lane])) &&
      !(Math.abs(o.z)<22&&Math.abs(run.x-lanes[lane])<(run.vehicle?.width||2.1)/2+o.wid/2+1);
    const playerWidth=run.vehicle?.width||2.1;
    const playerGap=o.z-(o.len+(run.vehicle?.length||5.4))/2;
    const playerAhead=o.z>0&&Math.abs(o.x-run.x)<(o.wid+playerWidth)/2+.25;
    const closingOnPlayer=o.speed-Math.max(0,run.speed);
    // A vehicle the player has passed should seek a safe open lane before it
    // catches a braking or boarding poda. It still follows until laterally clear.
    const passPlayer=playerAhead&&closingOnPlayer>2&&playerGap<Math.max(32,closingOnPlayer*(o.passLead||3));
    if(passPlayer&&o.lane===run.lane){
      o.passSide??=random()<.5?-1:1;
      const adjacent=[o.lane+o.passSide,o.lane-o.passSide].filter(l=>l>=0&&l<lanes.length&&clear(l));
      if(adjacent.length){o.lane=adjacent[0];o.decision=2;o.npcState='PASSING';}
    } else if(!passPlayer&&o.decision<=0){
      o.decision=o.poolKey==='okada'?2.5:5+random()*3;
      const adjacent=[o.lane-1,o.lane+1].filter(l=>l>=0&&l<lanes.length&&clear(l));
      if(adjacent.length&&(o.honked||random()<.35)){o.lane=adjacent[Math.floor(random()*adjacent.length)];o.honked=false;}
      else if(['taxi','kekeh','poda','waka'].includes(o.poolKey)&&o.lane===2&&random()<.22)o.stopTimer=o.poolKey==='waka'?4:1.5;
    }
    o.x+=(lanes[o.lane]-o.x)*Math.min(1,dt*(o.poolKey==='okada'?2.5:1.2));
    let leader=null, gap=Infinity, leaderSpeed=0;
    function consider(v){
      if(v===o||v.flat||v.cross||v.z>=o.z||!occupies(v,o.x))return;
      const distance=o.z-v.z-(o.len+v.len)/2;
      if(distance<gap){leader=v;gap=distance;leaderSpeed=Math.max(0,v.speed||0);}
    }
    for(const v of all)consider(v);
    consider({z:0,x:run.x,len:run.vehicle?.length||5.4,wid:run.vehicle?.width||2.1,speed:run.speed});
    const closing=Math.max(0,o.speed-leaderSpeed);
    const desired=MIN_GAP+o.speed*HEADWAY+closing*closing/(2*BRAKING);
    const target=o.stopTimer>0||(leader&&leaderSpeed<.5&&gap<MIN_GAP+4)?0:
      leader?Math.min(o.cruise,Math.max(0,leaderSpeed+(gap-desired)/HEADWAY)):o.cruise;
    const previous=o.speed;
    o.speed+=Math.max(-BRAKING*dt,Math.min(ACCELERATION*dt,target-o.speed));
    // The nearest leader has already moved this frame. Never cross its rear.
    if(leader&&dt>0){
      const maximum=(o.z+roadDistance-leader.z-(o.len+leader.len)/2-MIN_GAP)/dt;
      o.speed=Math.min(o.speed,Math.max(0,maximum));
    }
    o.braking=o.speed<previous-.01;
    o.npcState=o.speed<.08?'STOPPED':o.braking?'BRAKING':passPlayer&&o.lane!==run.lane?'PASSING':leader&&gap<desired+4?'FOLLOWING':'CRUISING';
    o.leaderGap=gap;
  }
  return {step,MIN_GAP,HEADWAY};
});
