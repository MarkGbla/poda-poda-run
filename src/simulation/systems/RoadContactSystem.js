(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;if(root)root.PODA_RoadContact=value;})(typeof window!=='undefined'?window:null,()=>({
  pothole(run,obstacle,reducedMotion=false) {
    if(obstacle.hit)return false;
    obstacle.hit=true;run.speed*=.86;run.bump=.45;run.shake=reducedMotion?.08:.42;run.x+=.12;
    // Never alter obstacle transforms, condition, passengers or the run lifecycle.
    return true;
  }
}));
