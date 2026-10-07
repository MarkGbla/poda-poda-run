// One chassis family, shared primitives, a single sign/wear atlas. No external brands or models.
export function createFreightFactory(K, street) {
  const {THREE:T, G, add}=K;
  const wheelGeo=new T.CylinderGeometry(.51,.51,.32,12).rotateZ(Math.PI/2);
  const hubGeo=new T.CylinderGeometry(.26,.26,.34,10).rotateZ(Math.PI/2);
  const tankGeo=new T.CylinderGeometry(1.08,1.08,5.9,16).rotateX(Math.PI/2);
  function make({type='box',variant=0}={}) {
    const g=new T.Group();
    const long=type==='container'&&variant>0;
    const len=long?12.8:type==='coach'?10.6:8;
    const front=-len/2, rear=len/2;
    const paint=[0xe5dfcb,0xb94836,0xbcb59e][variant%3];
    add(g,G.box,0x353631,2.05,.3,len-.4,0,.8,0);
    if(type==='coach') {
      street.worn(g,13,2.5,2.6,len,0,1.9,0);
      add(g,G.box,0x194758,2.52,1.0,len-.9,0,2.52,0);
      for(const side of [-1,1]) {
        for(let z=front+.7;z<rear;z+=1.05)add(g,G.box,0xc5c5b4,.06,1.04,.06,side*1.27,2.52,z);
        add(g,G.box,0x267c65,.035,.3,len,side*1.26,1.18,0);
        street.panel(g,11,len-.6,.42,side*1.27,1.65,0,side*Math.PI/2);
        for(let z=front+2;z<rear-1;z+=1.5)add(g,G.box,0x77796d,.03,.45,.025,side*1.27,.75,z);
      }
    } else {
      add(g,G.box,paint,2.3,2.35,2.15,0,1.92,front+1.08,true);
      add(g,G.box,0x243c43,2.07,.8,.035,0,2.5,front-.007);
      add(g,G.box,0x185a8a,2.32,.35,2.18,0,1.3,front+1.08);
      add(g,G.box,0x2f322e,1.65,.4,.06,0,1.01,front-.04);
      street.panel(g,2,1.95,.3,0,2.99,front-.028,Math.PI);
      for(const side of [-1,1]) {
        add(g,G.box,0x243c43,.02,.78,1.5,side*1.16,2.5,front+1.03);
        add(g,G.box,0x303b3a,.2,.48,.12,side*1.32,2.35,front+.1);
        add(g,G.box,0xb1a48c,.32,.35,1.25,side*.95,.75,front+2.8);
      }
      const cargoZ=front+2.3+(len-2.5)/2, cargoLen=len-2.5;
      if(type==='tanker'){
        const tank=new T.Mesh(tankGeo,K.M(paint));tank.scale.z=cargoLen/5.9;tank.position.set(0,2.08,cargoZ);g.add(tank);
        for(const side of [-1,1]){
          street.panel(g,8+variant%3,cargoLen-.3,.65,side*1.085,2.25,cargoZ,side*Math.PI/2);
          add(g,G.box,0x726550,.08,.08,cargoLen,side*1.05,1.18,cargoZ);
          for(let y=1;y<3.25;y+=.3)add(g,G.box,0x64675e,.07,.05,.45,side*1.13,y,rear-.55);
        }
        for(const z of [cargoZ-1.6,cargoZ,cargoZ+1.6])add(g,G.cyl,0x6b6559,.45,.1,.45,0,3.2,z);
        street.panel(g,1,1.4,.45,0,1.9,rear-.1);
      } else if(type==='flatbed'){
        street.worn(g,14,2.35,.22,cargoLen,0,1.1,cargoZ);
        for(const side of [-1,1])for(let y=1.3;y<2.1;y+=.3)add(g,G.box,0x276b91,.08,.12,cargoLen,side*1.13,y,cargoZ);
        for(let z=front+3;z<rear-.5;z+=1.1){
          for(const x of [-.56,.56]) add(g,G.box,z%2>1?0x6b7961:0xbbac85,.9,.65,.9,x,1.55,z);
          add(g,G.box,0xcebd91,2.3,.035,.04,0,1.91,z);
          for(const side of [-1,1])add(g,G.box,0xcebd91,.04,.85,.04,side*1.14,1.5,z);
        }
      }else{
        const height=type==='tipper'?1.65:2.55, col=type==='tipper'?0xc9952b:type==='container'?(variant===0?0x295e7c:0x934d3f):0xc1c5b4;
        add(g,G.box,col,2.4,height,cargoLen,0,1.23+height/2,cargoZ,true);
        for(const side of [-1,1]) {
          for(let z=front+2.5;z<rear;z+=.35)add(g,G.box,col,.05,height-.16,.055,side*1.23,1.23+height/2,z);
          street.panel(g,type==='container'?11:3,cargoLen-.6,.7,side*1.27,2.5,cargoZ,side*Math.PI/2);
          street.worn(g,14,.035,.16,cargoLen,side*1.25,1.38,cargoZ);
        }
        for(const x of [-.75,.75])add(g,G.box,0xc4b89b,.06,height-.1,.07,x,1.23+height/2,rear+.02);
      }
    }
    const axles=long?[front+1.1,front+4,rear-2.3,rear-1.05]:[front+1.1,rear-2,rear-.8];
    for(const z of axles)for(const x of [-1.13,1.13]){
      const wheel=new T.Mesh(wheelGeo,K.M(0x302e28));wheel.position.set(x,.51,z);g.add(wheel);
      const hub=new T.Mesh(hubGeo,K.M(0x8b806a));hub.position.copy(wheel.position);g.add(hub);
    }
    street.worn(g,12,2.35,.22,.12,0,.8,rear+.05);
    street.panel(g,7,.55,.24,0,.63,rear+.13);
    for(const x of [-.88,.88]){add(g,G.box,0xb92e22,.3,.2,.08,x,.95,rear+.1);add(g,G.box,0xefdaa2,.32,.2,.08,x,1.45,front-.09);}
    return {g,wid:2.5,len,speed:4};
  }
  return {make};
}
