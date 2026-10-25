const test = require('node:test');
const assert = require('node:assert/strict');
const { database, seed, request } = require('./helpers/account-db.cjs');
const VERSION = require('../src/simulation/RunRules.js').GAME_VERSION;
const at = day => Date.parse(`2026-10-${day}T12:00:00Z`);
test('first, repeated, consecutive and missed days preserve longest and expire display only', async () => {
  const {qualifyStreak:q,streakStatus:s} = await import('../src/services/StreakRules.mjs');
  let value=q(null,'2026-10-24'); assert.equal(value.current,1);
  for(let i=0;i<20;i++) { value=q(value,'2026-10-24'); assert.equal(value.current,1); assert.equal(value.grew,false); }
  value=q(value,'2026-10-25'); assert.equal(value.current,2);
  value=q(value,'2026-10-26'); assert.equal(value.current,3);
  assert.equal(s(value,'2026-10-27').canContinue,true);
  assert.equal(s(value,'2026-10-28').active,0);
  assert.equal(s(value,'2026-10-28').expired,true);
  value=q(value,'2026-10-28'); assert.equal(value.current,1); assert.equal(value.longest,3);
});
test('Freetown midnight, leap days, configurable timezone and corrupt data', async () => {
  const {streakDate:d,qualifyStreak:q,normalizeStreak:n,dayNumber} = await import('../src/services/StreakRules.mjs');
  assert.equal(d(Date.parse('2026-10-24T23:59:59Z')),'2026-10-24');
  assert.equal(d(Date.parse('2026-10-25T00:00:01Z')),'2026-10-25');
  assert.equal(d(Date.parse('2026-10-24T23:30:00Z'),'Africa/Lagos'),'2026-10-25');
  assert.ok(Number.isNaN(dayNumber('2026-02-30')));
  assert.equal(q({current:2,longest:2,lastDate:'2028-02-28'},'2028-02-29').current,3);
  for(const bad of [null,{}, {current:-1,longest:3,lastDate:'2026-10-24'}, {current:3,longest:1,lastDate:'2026-10-24'}, {current:3,longest:3,lastDate:'2099-01-01'}]) assert.equal(n(bad,'2026-10-24').current,0);
});
test('guest storage survives recreation, serialized tabs and unavailable storage',async()=>{
  const {createGuestStreak}=await import('../src/services/GuestStreak.mjs');
  const data=new Map(),store={get:k=>data.get(k),set:(k,v)=>{data.set(k,v);return true;}};
  let queue=Promise.resolve(); const locks={request:(_,fn)=>queue=queue.then(fn)};
  const a=createGuestStreak(store,locks),b=createGuestStreak(store,locks);
  const result=await Promise.all([a.qualify('2026-10-24'),b.qualify('2026-10-24')]);
  assert.equal(result.filter(r=>r.grew).length,1);
  assert.equal(createGuestStreak(store).read('2026-10-24').current,1);
  const broken=createGuestStreak({get(){throw Error();},set(){throw Error();}},null);
  assert.equal((await broken.qualify('2026-10-24')).persisted,false);
  assert.equal((await broken.qualify('2026-10-24')).grew,false);
});
test('untrusted guest history never overwrites trusted account, including expired values',async()=>{
  const {reconcileStreak:r}=await import('../src/services/StreakRules.mjs');
  const account={current:2,longest:5,lastDate:'2026-10-24'},guest={current:99,longest:99,lastDate:'2026-10-24'};
  assert.deepEqual(r(account,guest,'2026-10-24'),account);
  assert.deepEqual(r(r(account,guest,'2026-10-24'),guest,'2026-10-24'),account);
  assert.equal(r(null,guest,'2026-10-24').current,0);
});
test('atomic database qualification, concurrent devices, retries across midnight, missed days',async()=>{
  const {qualify,getStreak}=await import('../server/services/Streaks.mjs');
  const DB=database(),p=await seed(DB),env={DB};
  const id=crypto.randomUUID();
  let results=await Promise.all([qualify(env,p.id,id,at(24)),qualify(env,p.id,crypto.randomUUID(),at(24))]);
  assert.equal(results.filter(x=>x.grew).length,1);
  assert.equal((await qualify(env,p.id,id,at(25))).grew,false);
  assert.equal((await qualify(env,p.id,crypto.randomUUID(),at(25))).current,2);
  assert.equal((await qualify(env,p.id,crypto.randomUUID(),at(26))).current,3);
  assert.equal((await getStreak(env,p.id,at(28))).active,0);
  const reset=await qualify(env,p.id,crypto.randomUUID(),at(28));
  assert.equal(reset.current,1);assert.equal(reset.longest,3);
  DB.sql.close();
});
test('streak batch failure rolls back receipts and counter; safe retry',async()=>{
  const {qualify}=await import('../server/services/Streaks.mjs');
  const DB=database(),p=await seed(DB),id=crypto.randomUUID(); DB.failAt=1;
  await assert.rejects(()=>qualify({DB},p.id,id,at(24)));
  assert.equal(DB.sql.prepare('SELECT count(*) n FROM player_streak_events').get().n,0);
  DB.failAt=-1;assert.equal((await qualify({DB},p.id,id,at(24))).current,1);DB.sql.close();
});
test('Worker enforces sessions/origin/settings; nameless and Central qualify; profile/logout isolate accounts',async()=>{
  const worker=(await import('../server/worker.mjs')).default,DB=database(),p=await seed(DB,null),other=await seed(DB,'Other');
  const env={DB,PUBLIC_ORIGIN:'https://podapodarun.com'};
  const body={requestId:crypto.randomUUID(),route:'central',vehicle:'poda',gameVersion:VERSION,current:999,playerId:other.id};
  const call=(path,user=p,data,headers)=>worker.fetch(request(path,user,data,headers),env);
  assert.equal((await call('/api/runs/activity',null,body)).status,401);
  assert.equal((await call('/api/runs/activity',p,body,{origin:'https://evil.test'})).status,403);
  assert.equal((await call('/api/runs/activity',p,{...body,route:'fake'})).status,400);
  assert.equal((await (await call('/api/runs/activity',p,body)).json()).streak.current,1);
  assert.equal((await (await call('/api/me',other)).json()).streak.current,0);
  assert.equal((await (await call('/api/me')).json()).streak.current,1);
  await call('/api/auth/logout',p,{});
  assert.equal((await (await call('/api/me')).json()).player,null);
  assert.equal(DB.sql.prepare('SELECT current_streak FROM player_streaks WHERE player_id=?').get(p.id).current_streak,1);
  DB.sql.close();
});

test('streak storage failure does not prevent an official score session',async()=>{
  const worker=(await import('../server/worker.mjs')).default,DB=database(),p=await seed(DB);
  DB.failAt=0;
  const response=await worker.fetch(request('/api/runs/start',p,{requestId:crypto.randomUUID(),route:'western',vehicle:'poda',gameVersion:VERSION}),{DB});
  assert.equal(response.status,200);const data=await response.json();assert.ok(data.runId);assert.equal(data.streak,null);
  DB.sql.close();
});
