// Five modular silhouettes. Detail stays in shared primitive geometry and atlas panels.
export function createBuildingFactory(K, street) {
  const {THREE:T,G,add}=K;
  function create({type='house',side=1,floors=2,colour=0xc5b795}={}) {
    const g=new T.Group(), h=floors*2.8,w=4.8,d=5.1,face=-side*(d/2+.02);
    if(type==='unfinished') {
      for(let floor=0;floor<=floors;floor++){
        street.worn(g,13,d,.22,w,0,floor*2.8+.12,0);
        if(floor<floors)for(const x of [-2,2])for(const z of [-2,2]){
          street.worn(g,13,.25,2.8,.25,x,floor*2.8+1.5,z);
          if(floor===floors-1)for(const dx of [-.06,.06])add(g,G.box,0x594739,.025,.85,.025,x+dx,h+.4,z);
        }
      }
      street.worn(g,13,.22,1.5,w,face, .75,0);
      add(g,G.cone,0xb59a6f,2.5,.8,2,face-side*.4,.4,1);
    }else{
      add(g,G.box,colour,d,h,w,0,h/2,0,true);
      street.worn(g,13,.028,.5,w,face,.27,0);
      for(let floor=0;floor<floors;floor++){
        const y=floor*2.8+1.6;
        for(const z of [-1.35,1.35]){
          add(g,G.box,0x34464a,.05,1.2,1.02,face,y,z);
          for(const dz of [-.34,0,.34])add(g,G.box,0x8b9388,.06,1.18,.035,face-side*.045,y,z+dz);
        }
        if(floor>0){
          street.worn(g,13,1,.16,w,face-side*.4,y-.95,0);
          add(g,G.box,0x68685b,.05,.05,w,face-side*.9,y-.18,0);
          for(let z=-2.2;z<2.3;z+=.4)add(g,G.box,0x68685b,.035,.8,.035,face-side*.9,y-.58,z);
          for(let i=0;i<3;i++)add(g,G.box,[0x427995,0xbc5545,0xcebb7c][i],.04,.6,.44,face-side*.93,y-.5,i*.68-.7);
        }
      }
      if(type==='house'){
        const roof=add(g,G.pyr,0x8c6250,7.4,1.35,7.1,0,h+.55,0);roof.rotation.y=.04;
        for(let i=0;i<4;i++)street.worn(g,13,1.1,.2+i*.2,1.1,face-side*(1.7-i*.3),.1+i*.1,1.6);
      }else {street.worn(g,14,d+.6,.22,w+.5,0,h+.11,0);}
      if(type==='shopHouse'||type==='commercial'){
        add(g,G.box,0x28332e,.06,1.65,2.4,face,.83,0);
        street.panel(g,type==='commercial'?5:4,4.2,.65,face-side*.08,2.1,0,-side*Math.PI/2);
        const awning=street.worn(g,14,1.3,.09,4.4,face-side*.5,1.85,0);awning.rotation.z=side*.12;
      }
      if(type==='residential'||type==='commercial'){
        add(g,G.box,0xc2bbaa,.5,.45,.7,face-side*.2,h-1.1,1.1);
        add(g,G.cyl,0x497486,.65,.85,.65,1,h+.5,1.2);
        const dish=add(g,G.sph,0xcbc9b7,.09,.7,.7,face-side*.3,h-.35,-1.4);dish.rotation.z=side*.4;
      }
    }
    return g;
  }
  return {create};
}
