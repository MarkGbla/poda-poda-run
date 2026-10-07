// Shared geometry and a single atlas. All opaque pieces remain compatible with the chunk baker.
export function createStreetAssets(K) {
  const { THREE:T, G, add } = K;
  const labels = ['SALONE ROAD WORKS', 'SLOW • MEN AT WORK', 'FREETOWN • OUR HOME', 'KAMARA ENTERPRISE', 'MAMA B COOKERY', 'SALONE MOBILE', 'SMALL SMALL • BIG JOURNEY', 'SLE 7264', 'SALONE PETROLEUM', 'AFRICA FUEL', 'SIERRA ENERGY', 'SALONE PORT LOGISTICS'];
  let seed = 71;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const tex = K.canvasTex(1024, 1024, (c,w,h) => {
    labels.forEach((label,i) => {
      const y = i * 64;
      c.fillStyle = ['#225b52','#d7a539','#ece5cc','#215378'][i%4]; c.fillRect(0,y,w,64);
      c.fillStyle = i%4 === 1 || i%4 === 2 ? '#182b30' : '#f5eddb';
      K.fitText(c,label,960,40,'Impact, sans-serif'); c.textAlign='center'; c.fillText(label,w/2,y+46);
      for(let j=0;j<150;j++){ c.fillStyle = random()>.5?'rgba(61,42,28,.18)':'rgba(244,233,209,.24)'; c.fillRect(random()*w,y+random()*64,random()*12+1,random()*3+1); }
    });
    // Lower atlas cells: warning stripes, stained cement, rusty metal, blue body wear.
    for(let row=12;row<16;row++){
      const y=row*64; c.save();c.beginPath();c.rect(0,y,w,64);c.clip();
      c.fillStyle=['#eee7d5','#918977','#8d6850','#185891'][row-12];c.fillRect(0,y,w,64);
      if(row===12) for(let x=-64;x<w;x+=128){c.fillStyle='#bd4a32';c.beginPath();c.moveTo(x,y);c.lineTo(x+64,y);c.lineTo(x+128,y+64);c.lineTo(x+64,y+64);c.fill();}
      for(let j=0;j<1300;j++){c.fillStyle=random()>.6?'rgba(49,37,28,.32)':'rgba(212,183,130,.34)';c.fillRect(random()*w,y+random()*64,random()*9+1,random()*4+1);}c.restore();
    }
  });
  const mat = new T.MeshLambertMaterial({map:tex});
  const geos = new Map();
  function geo(row, box=false) {
    const key=row+':'+box;
    if(!geos.has(key)) {const g=box?new T.BoxGeometry(1,1,1):new T.PlaneGeometry(1,1);const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setY(i,1-(row+1)/16+.002+uv.getY(i)*(.0625-.004));geos.set(key,g);}
    return geos.get(key);
  }
  function panel(parent,row,w,h,x,y,z,rotation=0) {const m=new T.Mesh(geo(row),mat);m.scale.set(w,h,1);m.position.set(x,y,z);m.rotation.y=rotation;parent.add(m);return m;}
  function worn(parent,row,w,h,d,x,y,z) {return add(parent,geo(row,true),mat,w,h,d,x,y,z);}
  const shapes = Array.from({length:5},(_,variant)=>{
    const shape=new T.Shape();
    for(let i=0;i<=14;i++){const a=i/14*Math.PI*2,r=.82+random()*.22;const x=Math.cos(a)*r,z=Math.sin(a)*r*.72;i?shape.lineTo(x,z):shape.moveTo(x,z);}
    return new T.ShapeGeometry(shape).rotateX(-Math.PI/2);
  });
  function pothole(variant=0) {
    const g=new T.Group(), size=[.65,.95,1.3,1.05,.9][variant%5];
    const rim=add(g,shapes[variant%5],0x6e6150,size,1,size,0,.028,0);
    add(g,shapes[variant%5],variant===4?0x343737:0x27251f,size*.81,1,size*.81,0,.031,0);
    if(variant===3)add(g,shapes[variant],0x637675,size*.55,1,size*.55,.06,.035,0);
    if(variant!==4)for(let i=0;i<12;i++){const a=i/12*Math.PI*2;add(g,G.ico,i%2?0x514a3d:0x8b7c60,.13,.055,.1,Math.cos(a)*size*.83,.04,Math.sin(a)*size*.62);}
    rim.rotation.y=.13*variant;
    return {g,wid:size*1.65,len:size*1.3,flat:true};
  }
  function cone(g,x,z){add(g,G.box,0x292b29,.48,.08,.48,x,.04,z);add(g,G.cone,0xdd632c,.36,.65,.36,x,.4,z);add(g,G.cone,0xe9dec1,.23,.22,.23,x,.47,z);}
  function barrier(g,x,z){for(const dx of [-.65,.65]){const leg=add(g,G.box,0x8b693b,.12,1.25,.18,x+dx,.6,z);leg.rotation.z=dx*.22;add(g,G.box,0x4b4334,.4,.08,.65,x+dx,.04,z);}worn(g,12,1.8,.32,.13,x,.93,z);worn(g,14,1.7,.12,.12,x,.36,z);add(g,G.sph,0xe9a227,.22,.25,.22,x+.65,1.25,z);}
  function roadworks(g,x,z){
    worn(g,13,.65,.65,3,x+.9,.32,z-1);
    barrier(g,x,z+1.8);cone(g,x-.65,z+3);cone(g,x-.7,z-3);
    add(g,G.box,0x383127,.7,.016,3.5,x,.035,z-1);
    for(let i=0;i<5;i++)add(g,G.ico,0x9b7852,.45,.16,.5,x+.35,.08,z+i*.6-2.3);
    add(g,G.box,0x6f5237,.09,1.65,.09,x+1.5,.8,z-2);
    panel(g,1,1.5,.58,x+1.5,1.6,z-2);
    worn(g,12,.5,.7,.5,x+1.1,.35,z+3);
    add(g,G.sph,0xf4b327,.18,.2,.18,x+1.1,.8,z+3);
  }
  function drain(g,side,index){const x=side*(K.ROAD_HALF+.2);
    for(let i=0;i<6;i++){
      const z=-i*5-2;
      worn(g,13,.15,.28,4.7,x+side*.21,.13,z);
      if((i+index)%3===0){worn(g,13,.55,.09,1.5,x,.25,z);}
      else {add(g,G.box,0x43544a,.27,.012,2.8,x,.03,z);if(i%2===0)add(g,G.box,0xb09d73,.11,.022,.15,x,.045,z);}
    }
  }
  return {panel,worn,pothole,cone,barrier,roadworks,drain,mat,geo};
}
