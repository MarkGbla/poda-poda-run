// Pooled baked groups own their merged geometry until the application is closed.
// Reset simulation metadata at checkout; retain only the visual and collision dimensions.
export class TrafficPool {
  constructor(bake, maximumPerKind=5) { this.bake=bake;this.maximum=maximumPerKind;this.free=new Map();this.created=0; }
  acquire(key,factory) {
    const bin=this.free.get(key);let visual=bin?.pop();
    if(!visual){const o=factory();this.bake(o.g,true);visual={g:o.g,wid:o.wid,len:o.len,flat:o.flat,weave:o.weave};this.created++;}
    visual.g.visible=true;visual.g.rotation.set(0,0,0);visual.g.scale.set(1,1,1);
    return {...visual,poolKey:key};
  }
  release(o) {
    if(o.g.parent)o.g.parent.remove(o.g);
    let bin=this.free.get(o.poolKey);if(!bin)this.free.set(o.poolKey,bin=[]);
    if(bin.length<this.maximum)bin.push({g:o.g,wid:o.wid,len:o.len,flat:o.flat,weave:o.weave});
    else o.g.traverse(m=>{if(m.userData.baked)m.geometry.dispose();});
  }
}
