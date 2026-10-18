const test=require('node:test');
const assert=require('node:assert/strict');
const {database,seed,request,summary}=require('./helpers/account-db.cjs');
const VERSION=require('../src/simulation/RunRules.js').GAME_VERSION;
async function setup() {
  const worker=(await import('../server/worker.mjs')).default, DB=database(), player=await seed(DB);
  const env={DB,PUBLIC_ORIGIN:'https://podapodarun.com'};
  const call=(path,body,user=player,headers)=>worker.fetch(request(path,user,body,headers),env);
  async function start(route='western',vehicle='poda') {
    const response=await call('/api/runs/start',{requestId:crypto.randomUUID(),route,vehicle,gameVersion:VERSION});
    const result=await response.json(); assert.equal(response.status,200,JSON.stringify(result));
    DB.sql.prepare('UPDATE account_run_sessions SET started_at=started_at-60000 WHERE run_id=?').run(result.runId);
    return result;
  }
  return {worker,DB,player,env,call,start};
}
test('accepted run credits once across concurrent retries and returns stable receipt',async()=>{
  const {DB,call,start}=await setup(), run=await start();
  const body={runId:run.runId,gameVersion:VERSION,summary:summary(),durationMs:60000};
  const responses=await Promise.all([call('/api/runs/finish',body),call('/api/runs/finish',body)]);
  assert.deepEqual(responses.map(r=>r.status),[200,200]);
  assert.deepEqual(await responses[0].json(),await responses[1].json());
  assert.equal(DB.sql.prepare('SELECT COUNT(*) n FROM accepted_runs').get().n,1);
  assert.equal(DB.sql.prepare('SELECT lifetime_earnings FROM player_stats').get().lifetime_earnings,11);
  assert.equal(DB.sql.prepare('SELECT COUNT(*) n FROM period_bests').get().n,2);
  assert.equal((await call('/api/runs/finish',{...body,summary:summary({coins:3})})).status,409);
});
test('failure in stats batch rolls back run, session and all rewards; retry succeeds',async()=>{
  const {DB,call,start}=await setup(), run=await start();
  const body={runId:run.runId,gameVersion:VERSION,summary:summary(),durationMs:60000};
  DB.failAt=2; assert.equal((await call('/api/runs/finish',body)).status,503);
  assert.equal(DB.sql.prepare('SELECT COUNT(*) n FROM accepted_runs').get().n,0);
  assert.equal(DB.sql.prepare('SELECT finished_at FROM account_run_sessions').get().finished_at,null);
  DB.failAt=-1; assert.equal((await call('/api/runs/finish',body)).status,200);
});
test('ownership, expiry, unsupported modes, CSRF, expired sessions and logout are enforced',async()=>{
  const {DB,call,start,player}=await setup(), other=await seed(DB,'OtherDriver'), run=await start();
  const body={runId:run.runId,gameVersion:VERSION,summary:summary(),durationMs:60000};
  assert.equal((await call('/api/runs/finish',body,other)).status,403);
  assert.equal((await call('/api/runs/finish',body,null)).status,401);
  assert.equal((await call('/api/runs/finish',body,player,{origin:'https://evil.test'})).status,403);
  assert.equal((await call('/api/runs/start',{route:'central',vehicle:'poda',requestId:crypto.randomUUID(),gameVersion:VERSION})).status,400);
  DB.sql.prepare('UPDATE account_run_sessions SET expires_at=0').run();
  assert.equal((await call('/api/runs/finish',body)).status,410);
  assert.equal((await call('/api/auth/logout',{})).status,200);
  assert.equal((await call('/api/me')).status,200);
  assert.equal((await (await call('/api/me')).json()).player,null);
  DB.sql.prepare('UPDATE app_sessions SET expires_at=0').run();
  assert.equal((await (await call('/api/me',undefined,other)).json()).player,null);
});
test('one row per player, earliest-achievement ties, own rank and lifetime fares',async()=>{
  const {DB,call,start,player}=await setup();
  for (const [distance,earnings,perfect] of [[300,11,1],[500,6,0]]) {
    const run=await start();
    assert.equal((await call('/api/runs/finish',{runId:run.runId,gameVersion:VERSION,summary:summary({distance,earnings,perfectStops:perfect}),durationMs:60000})).status,200);
  }
  let board=await (await call('/api/leaderboard?period=all')).json();
  assert.equal(board.entries.length,1); assert.equal(board.me.rank,1); assert.equal(board.me.value,185);
  board=await (await call('/api/leaderboard?period=earners')).json(); assert.equal(board.me.value,17);
  const first=DB.sql.prepare('SELECT best_at FROM player_stats WHERE player_id=?').get(player.id).best_at;
  // 55 earlier tied players push the current player beyond the visible top 50.
  for(let i=0;i<55;i++) {
    const p=await seed(DB,'Driver'+i);
    DB.sql.prepare('INSERT INTO player_stats(player_id,best_score,best_at,earnings_at,total_runs) VALUES (?,?,?,?,?)').run(p.id,185,first-1,first-1,1);
  }
  board=await (await call('/api/leaderboard?period=all')).json();
  assert.equal(board.entries.length,50); assert.equal(board.me.rank,56);
  const guest=await (await call('/api/leaderboard?period=all',undefined,null)).json();
  assert.equal(guest.me,null); assert.ok(!JSON.stringify(guest).includes('google_sub'));
});
test('name uniqueness/cooldown and optimistic progress keep stale devices from overwriting',async()=>{
  const {call,DB}=await setup(); await seed(DB,'KingPoda');
  assert.equal((await call('/api/me/name',{name:'kingpoda'})).status,409);
  assert.equal((await call('/api/me/name',{name:'NewDriver'})).status,200);
  assert.equal((await call('/api/me/name',{name:'AgainDriver'})).status,409);
  assert.equal((await call('/api/me/name',{name:'<script>'})).status,400);
  assert.equal((await call('/api/me/progress',{version:0,preferences:{'poda-paint':'green'}})).status,200);
  assert.equal((await call('/api/me/progress',{version:0,preferences:{'poda-paint':'blue'}})).status,409);
  assert.equal((await call('/api/me/progress',{version:1,preferences:{'poda-best-score':'999999'}})).status,400);
  assert.equal((await (await call('/api/me')).json()).progress.preferences['poda-paint'],'green');
});
test('UTC day and Monday boundaries are independent of local timezone',async()=>{
  const {startOfPeriod}=await import('../server/services/Leaderboard.mjs');
  assert.equal(startOfPeriod('today',Date.parse('2026-10-18T23:59:59Z')),Date.parse('2026-10-18T00:00:00Z'));
  assert.equal(startOfPeriod('week',Date.parse('2026-10-18T23:59:59Z')),Date.parse('2026-10-12T00:00:00Z'));
  assert.equal(startOfPeriod('week',Date.parse('2026-10-19T00:00:00Z')),Date.parse('2026-10-19T00:00:00Z'));
});
