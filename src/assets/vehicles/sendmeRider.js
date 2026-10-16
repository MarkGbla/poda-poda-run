import * as THREE from 'three';

// Shared immutable geometry/materials live for the application lifetime.
export function createSendMeFactory(bake) {
  let template;
  const blue = 0x1453b9, orange = 0xff9318, black = 0x24272c, silver = 0xb7c0c8;
  const box = new THREE.BoxGeometry(1, 1, 1);
  const sphere = new THREE.SphereGeometry(1, 10, 8);
  const tire = new THREE.CylinderGeometry(.31, .31, .13, 12).rotateZ(Math.PI / 2);
  const materials = new Map();
  const mat = color => {
    if (!materials.has(color)) materials.set(color, new THREE.MeshLambertMaterial({color:new THREE.Color(color).convertSRGBToLinear()}));
    return materials.get(color);
  };
  const logo = new THREE.TextureLoader().load('/assets/sendme/logo.png');
  logo.encoding = THREE.sRGBEncoding;
  const branding = new THREE.MeshLambertMaterial({map:logo});
  function part(parent, name, color, size, position, geo = box) {
    const m = new THREE.Mesh(geo, mat(color)); m.name=name;
    m.scale.set(...size); m.position.set(...position); parent.add(m); return m;
  }
  function group(parent, name, position=[0,0,0]) {
    const g = new THREE.Group(); g.name=name; g.position.set(...position); parent.add(g); return g;
  }
  function limb(parent, name, a, b, radius, color) {
    const p = new THREE.Vector3(...a), q = new THREE.Vector3(...b);
    const m=part(parent,name,color,[radius,p.distanceTo(q),radius],p.add(q).multiplyScalar(.5).toArray());
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),q.set(...b).sub(new THREE.Vector3(...a)).normalize());
  }
  function decal(parent, w, h, position, yaw=0) {
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),branding); m.position.set(...position); m.rotation.y=yaw; parent.add(m);
  }
  function build() {
    const root = new THREE.Group(); root.name='SendMeNPC'; root.userData.sendme=true;
    const lean=group(root,'lean'), body=group(lean,'motorcycleRoot'), rider=group(lean,'riderRoot');
    const wheel=(parent,name,pos)=>{
      const g=group(parent,name,pos);part(g,'tire',black,[1,1,1],[0,0,0],tire);
      part(g,'hub',silver,[1.15,.62,.62],[0,0,0],tire);
      for(const x of [-.081,.081]) for(let i=0;i<3;i++) part(g,'spoke',black,[.012,.035,.36],[x,0,0]).rotation.x=i*Math.PI/3;
      return g;
    };
    const rear=wheel(lean,'rearWheel',[0,.31,.66]);
    const fork=group(lean,'frontFork',[0,.31,-.72]);
    const front=wheel(fork,'frontWheel',[0,0,0]);
    for(const x of [-.1,.1]) limb(fork,'fork',[x,0,0],[x,.7,.15],.045,silver);
    part(fork,'handlebars',black,[.76,.045,.05],[0,.8,.15]);
    part(fork,'mudguard',blue,[.2,.055,.45],[0,.33,0]);
    part(fork,'headlight',0xffefbf,[.22,.18,.06],[0,.63,-.12]);
    part(body,'frame',black,[.22,.22,1.15],[0,.53,0]);
    part(body,'engine',silver,[.28,.29,.37],[0,.45,-.08]);
    part(body,'fuelTank',blue,[.23,.18,.32],[0,.85,-.29],sphere);
    part(body,'seat',black,[.34,.1,.6],[0,.89,.12]);
    part(body,'exhaust',silver,[.09,.1,.65],[.23,.37,.4]);
    part(body,'cargoRack',silver,[.65,.06,.58],[0,.96,.67]);
    part(body,'deliveryBox',blue,[.72,.62,.62],[0,1.29,.67]);
    part(body,'boxLid',black,[.75,.035,.65],[0,1.6,.67]);
    decal(body,.55,.15,[0,1.3,.986]);
    for(const s of [-1,1]) {decal(body,.55,.15,[s*.366,1.3,.67],s*Math.PI/2);part(body,'stripe',orange,[.012,.045,.55],[s*.368,1.08,.67]);}
    part(rider,'torso',blue,[.44,.48,.27],[0,1.24,-.08]).rotation.x=-.15;
    part(rider,'neck',0x70452d,[.13,.13,.13],[0,1.52,-.14]);
    part(rider,'face',0x70452d,[.16,.18,.15],[0,1.68,-.17],sphere);
    part(rider,'helmet',blue,[.21,.16,.21],[0,1.8,-.13],sphere);
    part(rider,'helmetBand',orange,[.38,.035,.23],[0,1.77,-.14]);
    decal(rider,.32,.087,[0,1.3,.062]);
    for(const s of [-1,1]) {
      part(rider,'reflector',0xf0f0ed,[.045,.39,.015],[s*.15,1.24,.065]);
      limb(rider,'upperArm',[s*.25,1.43,-.12],[s*.3,1.18,-.33],.13,black);
      limb(rider,'forearm',[s*.3,1.18,-.33],[s*.33,1.12,-.57],.11,black);
      part(rider,'glove',black,[.13,.1,.13],[s*.33,1.12,-.57]);
      limb(rider,'thigh',[s*.17,.99,.08],[s*.3,.71,-.22],.18,black);
      limb(rider,'shin',[s*.3,.71,-.22],[s*.28,.4,.12],.14,black);
      part(rider,'boot',black,[.18,.13,.29],[s*.28,.34,.03]);
    }
    const brake=part(lean,'brakeLight',0xa51c15,[.18,.07,.035],[0,.86,.99]);
    brake.material=new THREE.MeshBasicMaterial({color:0xaa2018});
    // Bake each moving assembly independently, never flatten their pivots.
    for(const g of [body,rider,rear,front]) bake(g);
    fork.remove(front); bake(fork); fork.add(front);
    // These baked buffers are shared by clones, so generic destruction must not dispose them.
    root.traverse(m=>{if(m.isMesh)m.userData.baked=false;});
    return root;
  }
  return () => {
    template ||= build();
    const g=template.clone(true);
    return {g,wid:.85,len:2.05};
  };
}

export function animateSendMe(o, distance, dt, curvature=0) {
  const parts=o.animationParts ||= Object.fromEntries(['lean','frontFork','frontWheel','rearWheel','brakeLight'].map(name=>[name,o.g.getObjectByName(name)]));
  const lean=parts.lean, fork=parts.frontFork;
  const angle=distance/.31;
  parts.frontWheel.rotation.x-=angle;
  parts.rearWheel.rotation.x-=angle;
  const blend=1-Math.exp(-6*dt);
  lean.rotation.z+=(Math.max(-.16,Math.min(.16,curvature*o.speed*o.speed/9.81))-lean.rotation.z)*blend;
  fork.rotation.y+=(Math.max(-.15,Math.min(.15,curvature*1.38))-fork.rotation.y)*blend;
  parts.brakeLight.scale.y=(o.braking?.12:.07);
}
