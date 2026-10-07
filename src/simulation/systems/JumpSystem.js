(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;if(root)root.PODA_JumpSystem=value;})(typeof window!=='undefined'?window:null,()=>({
  start(run) { if ((run.jumpY||0)>0 || run.dwell>0 || run.speed<2 || run.jumpCooldown>0) return false; run.jumpY=.001;run.jumpVelocity=6;run.jumpCooldown=1;return true; },
  step(run,dt) {run.jumpCooldown=Math.max(0,(run.jumpCooldown||0)-dt);if(!(run.jumpY>0))return false;run.jumpVelocity-=18*dt;run.jumpY=Math.max(0,run.jumpY+run.jumpVelocity*dt);if(run.jumpY===0){run.jumpVelocity=0;return true;}return false;},
  swipe(dx,dy,elapsed) {return elapsed<=450&&elapsed>=0&&dy<=-55&&Math.abs(dy)>Math.abs(dx)*1.6;}
}));
