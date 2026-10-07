/** Compose original game key art around an actual vehicle render. No external images. */
export async function createScorePoster({THREE,renderer,player,name,score,vehicle,route,url}) {
  const shotScene=new THREE.Scene();shotScene.background=null;
  shotScene.add(new THREE.HemisphereLight(0xffedcd,0x344535,2));
  const light=new THREE.DirectionalLight(0xffe1ac,2);light.position.set(-5,12,8);shotScene.add(light);
  const model=player.clone(true);model.position.set(0,0,0);model.rotation.set(0,0,0);model.visible=true;shotScene.add(model);
  const camera=new THREE.PerspectiveCamera(40,1.5,.1,100);const box=new THREE.Box3().setFromObject(model);const size=box.getSize(new THREE.Vector3());
  const radius=Math.max(size.x,size.y,size.z)*1.65;camera.position.set(radius*.7,radius*.48,radius*.8);camera.lookAt(0,size.y*.4,0);
  const target=new THREE.WebGLRenderTarget(1536,1024);const prior=renderer.getRenderTarget(),clear=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha();
  const pixels=new Uint8Array(1536*1024*4);
  try {renderer.setClearColor(0x000000,0);renderer.setRenderTarget(target);renderer.render(shotScene,camera);renderer.readRenderTargetPixels(target,0,0,1536,1024,pixels);}finally{renderer.setRenderTarget(prior);renderer.setClearColor(clear,alpha);target.dispose();}
  const vehicleCanvas=document.createElement('canvas');vehicleCanvas.width=1536;vehicleCanvas.height=1024;
  const vx=vehicleCanvas.getContext('2d');const data=vx.createImageData(1536,1024);
  for(let row=0;row<1024;row++)data.data.set(pixels.subarray((1023-row)*1536*4,(1024-row)*1536*4),row*1536*4);vx.putImageData(data,0,0);
  const canvas=document.createElement('canvas');canvas.width=3840;canvas.height=2160;const g=canvas.getContext('2d');
  const sky=g.createLinearGradient(0,0,0,2160);sky.addColorStop(0,'#e1c69a');sky.addColorStop(.65,'#eab879');sky.addColorStop(1,'#243e35');g.fillStyle=sky;g.fillRect(0,0,3840,2160);
  for(let layer=0;layer<3;layer++){g.fillStyle=['#78917a','#57735f','#3b5c4d'][layer];g.beginPath();g.moveTo(0,1500);for(let x=0;x<=3840;x+=80)g.lineTo(x,900+layer*140+Math.sin(x/340+layer)*170+Math.cos(x/170)*55);g.lineTo(3840,2160);g.lineTo(0,2160);g.fill();}
  for(let i=0;i<55;i++){const x=1750+(i*137)%2050,y=980+(i*79)%450;g.fillStyle=['#d3c2a0','#bdad93','#d4c8b1'][i%3];g.fillRect(x,y,45,35);g.fillStyle='#775c49';g.fillRect(x-3,y-7,51,8);}
  g.fillStyle='#243d34';g.fillRect(0,0,1650,2160);
  g.fillStyle='#38b87c';g.fillRect(150,150,150,20);g.fillStyle='#fff';g.fillRect(300,150,150,20);g.fillStyle='#389ee7';g.fillRect(450,150,150,20);
  g.fillStyle='#f5e8ca';g.font='bold 115px sans-serif';g.fillText('PODA-PODA',150,360);g.fillText('RUN',150,485);
  g.font='45px sans-serif';g.fillText('FREETOWN • SALONE',155,585);
  g.font='bold 76px sans-serif';g.fillText((name||'Salone driver').slice(0,24).toUpperCase(),150,820,1330);
  g.fillStyle='#ffce69';g.font='bold 220px sans-serif';g.fillText(score.toLocaleString('en-US'),140,1080,1370);
  g.fillStyle='#f5e8ca';g.font='42px sans-serif';g.fillText('DRIVING SCORE',155,1160);g.font='52px sans-serif';g.fillText(vehicle,150,1390);g.fillText(route,150,1470,1350);
  g.font='43px sans-serif';g.fillText('I survived the Freetown run.',150,1730);g.fillText('Can you beat my score?',150,1800);
  g.font='32px sans-serif';g.fillText(url,150,1990,1350);
  // Road and roadside scale cues anchor the vehicle in the city illustration.
  g.fillStyle='#42483f';g.beginPath();g.moveTo(2550,1320);g.lineTo(2830,1320);g.lineTo(3840,2160);g.lineTo(1650,2160);g.closePath();g.fill();
  g.strokeStyle='#d9c99b';g.lineWidth=12;g.setLineDash([50,70]);g.beginPath();g.moveTo(2700,1430);g.lineTo(3050,2160);g.stroke();g.setLineDash([]);
  g.fillStyle='rgba(13,29,24,.3)';g.beginPath();g.ellipse(2810,1930,660,110,-.15,0,Math.PI*2);g.fill();
  g.drawImage(vehicleCanvas,1600,800,2200,1467);
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Poster export failed')),'image/png'));
}
