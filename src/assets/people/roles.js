export function createRoleDecorator(K) {
  const {THREE:T,G,add}=K;
  function options(opt) {
    const roles={market:{role:'vendor',lappa:true,tray:true},student:{shirt:0xebe9dd,lappa:false},office:{shirt:0x83a8bb,lappa:false},mechanic:{shirt:0x344a56,lappa:false},officer:{shirt:0xc5d84d,lappa:false},elderly:{lappa:false}};
    return {...(roles[opt.role]||{}),...opt};
  }
  function decorate(g,opt) {
    const role=opt.role;
    g.userData.archetype=role||'passenger';
    if(role==='student'){
      add(g,G.box,0x24394b,.3,.4,.15,0,1.08,-.18);
      for(const x of [-.13,.13])add(g,G.box,0x26394a,.04,.42,.03,x,1.12,.16);
      g.scale.multiplyScalar(.91);
    }
    if(role==='office') {add(g,G.box,0x4f4338,.22,.27,.11,.27,.72,0);add(g,G.box,0x1c292d,.08,.14,.025,.3,1.05,.11);}
    if(role==='mechanic'){add(g,G.box,0xa99c7e,.14,.28,.03,-.2,.72,.15);add(g,G.box,0x9a9f96,.05,.23,.04,.29,.86,.08);}
    if(role==='officer'){
      for(const y of [1.03,1.27])add(g,G.box,0xebeed7,.37,.065,.32,0,y,0);
      add(g,G.cyl,0xe6e6d8,.34,.12,.34,0,1.79,0);
      if(g.userData.armR)g.userData.armR.rotation.z=-2.2;
    }
    if(role==='elderly'){add(g,G.cyl6,0x70513a,.045,.88,.045,.32,.44,.12);add(g,G.cyl,0xc6b487,.3,.13,.3,0,1.8,0);g.userData.stride=.16;}
    return g;
  }
  return {options,decorate};
}
