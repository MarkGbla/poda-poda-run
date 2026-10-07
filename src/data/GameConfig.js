(function(root, factory) {
  const config = factory();
  if (typeof module === 'object' && module.exports) module.exports = config;
  if (root) root.PODA_CONFIG = config;
})(typeof window !== 'undefined' ? window : null, () => {
  const vehicles = {
    poda: {name:'Poda-Poda',capacity:14,acceleration:6,braking:24,maxSpeed:34,handling:11,width:2.1,length:5.4,camera:{height:4.5,distance:13.5},pitch:1},
    kekeh: {name:'Kekeh',capacity:3,acceleration:7,braking:26,maxSpeed:25,handling:15,width:1.45,length:2.8,camera:{height:3.5,distance:10},pitch:1.45},
    taxi: {name:'Taxi',capacity:4,acceleration:9,braking:28,maxSpeed:42,handling:13,width:1.95,length:4.2,camera:{height:3.8,distance:12},pitch:1.2},
    okada: {name:'Okada',capacity:1,acceleration:11,braking:30,maxSpeed:38,handling:18,width:.85,length:1.9,camera:{height:3.3,distance:9},pitch:1.8},
    waka: {name:'Waka Fine',capacity:30,acceleration:3.5,braking:16,maxSpeed:28,handling:6,width:2.5,length:9,camera:{height:5.8,distance:18},pitch:.7},
  };
  const routes = {
    western: {name:'Western Run',difficulty:'Easy',description:'Coast, creek and hillside neighbourhoods',stops:['Goderich','Lumley','Lumley Beach Road','Aberdeen','Congo Cross']},
    central: {name:'Central Run',difficulty:'Medium',description:'Commercial streets and the heart of town',stops:['Congo Cross','Cotton Tree','PZ','Abacha Street','Eastern Police']},
    eastern: {name:'Eastern Run',difficulty:'Hard',description:'Markets, port traffic and the eastern corridor',stops:['Eastern Police','Cline Town','Kissy','Wellington','Calaba Town']},
    crosscity: {name:'Cross-City Run',difficulty:'Long',description:'From the western coast to the east end',stops:['Goderich','Lumley','Lumley Beach Road','Aberdeen','Congo Cross','Cotton Tree','PZ','Abacha Street','Eastern Police','Cline Town','Kissy','Wellington','Calaba Town']},
  };
  for (const [id,v] of Object.entries(vehicles)) {v.id=id;Object.freeze(v.camera);Object.freeze(v);}
  for (const [id,r] of Object.entries(routes)) {r.id=id;Object.freeze(r.stops);Object.freeze(r);}
  return Object.freeze({vehicles:Object.freeze(vehicles),routes:Object.freeze(routes)});
});
