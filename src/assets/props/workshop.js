export function createWorkshop(K, street, bake) {
  const {THREE:T,G,add}=K,g=new T.Group();
  street.worn(g,13,16,.18,18,0,-.12,0);
  for(const x of [-6.5,6.5]) {
    // Open-sided workshop keeps every vehicle and orbit angle visible.
    for(const z of [-7,0,7]){add(g,G.box,0x326075,.28,6,.32,x,2.9,z);add(g,G.box,0x958873,13.4,.2,.16,0,5.9,z);}
  }
  // Rear wall; the front is open to the live Freetown scene.
  street.worn(g,13,20,6,.22,0,2.8,15);
  street.panel(g,2,6,1.2,0,4.1,14.85,Math.PI);
  for(const x of [-2,2])add(g,G.box,0xb99439,.12,.018,8,x,.005,0);
  add(g,G.box,0x343b38,1.4,.02,5.5,0,.005,0);
  const tyre=new T.TorusGeometry(.46,.17,6,14);
  for(let i=0;i<6;i++){const m=new T.Mesh(tyre,K.M(0x30332f));m.rotation.x=Math.PI/2;m.position.set(-4.8,.25+i*.28,3);g.add(m);}
  street.worn(g,14,1.9,1.0,.7,4.9,.5,2.8);
  for(let y=.2;y<1;y+=.18)add(g,G.box,0xbeb49d,1.65,.03,.025,4.9,y,2.42);
  for(let i=0;i<6;i++)add(g,G.box,0xadb0a3,.05,.3+i*.015,.07,4.4+i*.17,1.6,2.9);
  add(g,G.box,0x45533e,.8,.15,.5,2.4,.1,.7);
  const jack=add(g,G.box,0x636954,.055,1.0,.055,2.5,.55,.8);jack.rotation.z=.35;
  for(const x of [-3,3]){add(g,G.box,0xf1deb1,.22,.06,3.1,x,5.6,0);}
  for(let i=0;i<5;i++)add(g,G.disc,0x555244,.8+i*.2,1,.6,3-i*1.7,.01,4-i*.6);
  bake(g,true);g.visible=false;
  return g;
}
