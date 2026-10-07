import { createBuildingFactory } from '../assets/buildings/buildingFactory.js';
/** Condensed corridor scenery; these are visual archetypes, not surveyed replicas. */
export function registerEasternDistricts(PLUG) {
 const profiles={
  'Cline Town':{warehouse:true,label:'CLINE TOWN · PORT ROAD',colour:0x928a77},
  'Kissy':{warehouse:false,label:'KISSY · BAI BUREH ROAD',colour:0xc5b391},
  'Wellington':{warehouse:true,label:'WELLINGTON · EASTERN CORRIDOR',colour:0xb29c80},
  'Calaba Town':{warehouse:false,label:'CALABA TOWN · MARKET',colour:0xb7aa8d},
 };
 for(const [name,profile] of Object.entries(profiles)) PLUG.districts[name]={fill(g,K,{index}){
  const {G,add,ROAD_HALF}=K;
  const buildings=createBuildingFactory(K,K.streetAssets);
  for(const side of [-1,1]){
   K.streetAssets.drain(g,side,index);
   for(let i=0;i<3;i++){
    const x=side*(ROAD_HALF+5+i%2),z=-4-i*10;
    const building=buildings.create({type:profile.warehouse?(i%2?'unfinished':'commercial'):'shopHouse',side,floors:profile.warehouse?1:2+i%2,colour:profile.colour});building.position.set(x,0,z);g.add(building);
    if(!profile.warehouse)K.addVendor(g,side*(ROAD_HALF+1.6),z,side);
    if(profile.warehouse&&i===1){add(g,G.box,0x844c36,2.5,2.6,6,x-side*1.5,1.3,z+4);for(let j=0;j<9;j++)add(g,G.box,0xa26746,.04,2.45,.08,x-side*2.77,1.3,z+1.3+j*.6);}
   }
   add(g,G.cyl6,0x695747,.2,8,.2,side*(ROAD_HALF+1),4,-12);
   add(g,G.box,0x292d29,.035,.035,30,side*(ROAD_HALF+1),7.7,-15);
   K.addTree(g,side*22,-18,0,false);
  }
  if(!this.signTexture)this.signTexture=K.canvasTex(512,64,(ctx,w,h)=>{ctx.fillStyle='#ece0c5';ctx.fillRect(0,0,w,h);ctx.fillStyle='#294436';ctx.font='bold 24px sans-serif';ctx.fillText(profile.label,12,42);});
  // Share one district sign texture across recycled chunks.

  this.signGeometry??=new K.THREE.PlaneGeometry(5,.65);this.signMaterial??=new K.THREE.MeshLambertMaterial({map:this.signTexture});
  const sign=new K.THREE.Mesh(this.signGeometry,this.signMaterial);sign.position.set(ROAD_HALF+4,3.5,-10);g.add(sign);
 }};
}
