const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = () => import('../src/services/GuestProfile.mjs');
function storage() { const data = new Map(); return {get:k=>data.get(k)??null,set:(k,v)=>{data.set(k,v);return true;}}; }
test('guest ID and Unicode nickname persist, including migration from existing names',async()=>{
 const {createGuestProfile}=await load(), store=storage();store.set('poda-driver-name','  Mariama 🌍  ');
 const guest=createGuestProfile(store,()=> 'local-id');assert.equal(guest.name(), 'Mariama 🌍');
 guest.save('  马克 from Freetown  ');
 const reloaded=createGuestProfile(store,()=>{throw Error('ID must be reused');});
 assert.deepEqual(reloaded.profile,{guestId:'local-id',displayName:'马克 from Freetown'});
});
test('empty saves rejected; Unicode limit does not split surrogate pairs',async()=>{
 const {createGuestProfile,normalizeNickname}=await load(), guest=createGuestProfile(storage(),()=> 'id');
 assert.equal(guest.name(),'Guest Driver');assert.throws(()=>guest.save('   '),/Enter a nickname/);
 assert.equal(normalizeNickname('🌍'.repeat(25)), '🌍'.repeat(24));
});
test('unavailable or corrupt storage retains a functional session',async()=>{
 const {createGuestProfile}=await load();
 const guest=createGuestProfile({get:()=>'{broken',set:()=>false},()=> 'id');
 assert.equal(guest.save('Kadiatu'),false);assert.equal(guest.name(),'Kadiatu');assert.equal(guest.profile.guestId,'id');
});
test('account name takes precedence and private details are never used',async()=>{
 const {createGuestProfile}=await load(), guest=createGuestProfile(storage(),()=> 'id');guest.save('Guest nickname');
 const player={driver_name:'PublicDriver',name:'Private Name',email:'private@example.com'};
 assert.equal(guest.name(player),'PublicDriver');assert.equal(guest.name({...player,driver_name:null}),'Guest Driver');
 assert.equal(guest.name(),'Guest nickname');assert.equal(player.driver_name,'PublicDriver');
});
