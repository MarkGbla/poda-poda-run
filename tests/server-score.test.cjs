const test=require('node:test');
const assert=require('node:assert/strict');
const {summary}=require('./helpers/account-db.cjs');
test('shared formula and vehicle/route bounds validate all ranked combinations',async()=>{
  const {validateRun,calculateOfficialScore}=await import('../server/services/ScoreValidator.mjs');
  for(const route of ['western','eastern','crosscity']) for(const vehicle of ['poda','kekeh','taxi','okada','waka']) {
    const run=summary({passengersOnboard:0});
    assert.equal(validateRun(run,60000,60000,route,vehicle),null,route+' '+vehicle);
    assert.equal(calculateOfficialScore(run),run.score);
    const config = require('../src/data/GameConfig.js');
    const stops = config.routes[route].stops.length - 1;
    const completed = summary({ completed:true, stopsServed:stops, distance:stops*560,
      passengersOnboard:0, passengersDelivered:1, perfectStops:stops, earnings:6+5*stops });
    assert.equal(validateRun(completed,600000,600000,route,vehicle),null,'completed '+route+' '+vehicle);
  }
  const run=summary();
  const check=(extra)=>validateRun({...run,...extra},60000,60000,'western','poda');
  assert.match(check({distance:99999}),/Distance/);
  assert.match(check({earnings:999999}),/earnings/);
  assert.match(check({passengersOnboard:15}),/passenger/);
  assert.match(check({perfectStops:2}),/stop grades/);
  assert.match(check({score:999999}),/Score/);
  assert.match(check({style:-1}),/style/);
  assert.match(check({completed:true}),/Incomplete/);
  assert.match(validateRun(run,60000,1000,'western','poda'),/Duration/);
});
test('unconfigured backend leaves guest identity and local play available',async()=>{
  const worker=(await import('../server/worker.mjs')).default;
  const me=await worker.fetch(new Request('https://example.test/api/me'),{});
  assert.equal((await me.json()).authAvailable,false);
  assert.equal((await worker.fetch(new Request('https://example.test/api/leaderboard'),{})).status,503);
});
