const test=require('node:test');
const assert=require('node:assert/strict');
const ApiClient=require('../src/services/ApiClient.js');
function storage() { const values=new Map();return { get:key=>values.get(key)||null,set:(k,v)=>{values.set(k,v);return true;},remove:k=>values.delete(k),keys:()=>[...values.keys()] }; }
function signed(api,id='player1') { api.account={player:{id,driver_name:'Salone'},rankedRoutes:['western']}; }
test('guest, practice and unsupported routes never start official runs',()=>{
  const api=new ApiClient(storage(),()=>{throw new Error('Unexpected network')},crypto.randomUUID);
  assert.equal(api.start({route:'western'}),null);signed(api);
  assert.equal(api.start({route:'central'}),null);assert.equal(api.start({route:'western',practice:true}),null);
});
test('each run captures its own asynchronous start even across restarts',async()=>{
  const calls=[],pending=[];
  const api=new ApiClient(storage(),async(path,options)=>{
    const body=JSON.parse(options.body);calls.push(body);
    if(path.endsWith('/start'))return new Promise(resolve=>pending.push(()=>resolve({ok:true,json:async()=>({runId:body.requestId,playerId:'player1',gameVersion:'v'})})));
    return {ok:true,json:async()=>({status:'accepted',runId:body.runId})};
  },(()=>{let n=0;return ()=>String(++n)})());signed(api);
  const first=api.start({route:'western'}),second=api.start({route:'western'});
  const finish=api.finish(first,{score:4},1000);pending[1]();pending[0]();
  assert.equal((await finish).runId,'1');assert.equal((await second.promise).runId,'2');
  assert.equal('playerId' in calls[0],false);
});
test('unknown save outcome persists; reload retries same run, never another account queue',async()=>{
  const store=storage();let offline=true,count=0;
  const fetch=async(path,options)=>{
    if(path.endsWith('/start'))return {ok:true,json:async()=>({runId:'run1',playerId:'player1',gameVersion:'v',expiresAt:Date.now()+10000})};
    count++;if(offline)throw new Error('offline');return {ok:true,json:async()=>({status:'accepted'})};
  };
  const api=new ApiClient(store,fetch,()=> 'request1');signed(api);
  assert.equal((await api.finish(api.start({route:'western'}),{},1000)).status,'pending');
  const restored=new ApiClient(store,fetch,()=> 'other');signed(restored,'player2');
  await restored.retryPending();assert.equal(count,1);
  signed(restored);offline=false;await restored.retryPending();assert.equal(count,2);assert.equal(store.keys().length,0);
});
