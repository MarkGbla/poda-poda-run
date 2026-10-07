export function createLumleyDetails(K, street, buildings) {
  const {THREE:T,G,add}=K;
  const wireMat=new T.LineBasicMaterial({color:0x3a3930});
  const wireGeo=new T.BufferGeometry();const pts=[];
  for(let i=0;i<=12;i++)pts.push(new T.Vector3(0,-Math.sin(i/12*Math.PI)*.7,-i*2.5));
  wireGeo.setFromPoints(pts);
  function market(g,side,z,variant){
    const x=side*7.4;
    add(g,G.cyl6,0x655b47,.065,2.5,.065,x,1.45,z);
    const umbrella=add(g,G.cone,[0xaf4e38,0x346c82,0xcda841][variant%3],2.9,.6,2.9,x,2.8,z,true);
    umbrella.rotation.y=variant;
    street.worn(g,14,1.5,.1,.8,x,.96,z);
    for(const dx of [-.55,.55])add(g,G.box,0x62543d,.08,.9,.65,x+dx,.5,z);
    for(let i=0;i<6;i++)add(g,G.sph,[0xce8c34,0xa94429,0x91a44b][i%3],.2,.18,.2,x+(i%3)*.32-.32,1.1,z+Math.floor(i/3)*.26-.13);
    add(g,G.box,0x377996,.5,.45,.42,x+side*.9,.42,z);
    add(g,G.box,0xd4caae,.53,.06,.45,x+side*.9,.68,z);
    add(g,G.cyl,0xb8a77e,.4,.6,.4,x-side*.8,.5,z+.6);
    if(variant%2===0){const p=K.makePerson({role:'vendor',lappa:true,lod:'low'});p.position.set(x+side*.9,.2,z+.8);p.rotation.y=-side*Math.PI/2;g.add(p);}
  }
  function fill(g,index){
    for(const side of [-1,1]) {
      for(let i=0;i<3;i++){
        const x=side*(19+i*7+(index%3));const base=K.hy(Math.abs(x));
        const type=['house','shopHouse','unfinished','commercial','residential'][(index+i+(side>0?2:0))%5];
        const b=buildings.create({type,side,floors:type==='house'?1:2+(i%2),colour:[0xa99170,0x738b7c,0xbda474,0x789395,0xc0b89d][(index+i)%5]});
        b.position.set(x,base,-5-i*9);g.add(b);
      }
      market(g,side,-8,index);market(g,side,-23,index+1);
      for(let i=0;i<3;i++){const p=K.makePerson({role:['student','office','hawker','elderly','mechanic','officer'][(index+i)%6],lod:'low'});p.position.set(side*(6.3+i*.3),.2,-3-i*9);p.rotation.y=side*.5;g.add(p);}
      for(const dx of [-.18,.18]){const wire=new T.Line(wireGeo,wireMat);wire.position.set(side*8.05+dx,6.4,0);g.add(wire);}
      if(index%3===0){street.worn(g,13,.65,.7,.55,side*8,5.9,-12);add(g,G.cyl,0x777b73,.3,.55,.3,side*8,6.55,-12);}
    }
  }
  return {fill,market};
}
