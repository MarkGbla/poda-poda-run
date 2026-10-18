const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
function database() {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys=ON');
  for (const file of ['0001_initial.sql','0002_accounts.sql']) sql.exec(fs.readFileSync(path.join(__dirname,'../../server/db/migrations',file),'utf8'));
  const db = { sql, failAt: -1,
    prepare(query) {
      function statement(args = []) {
        return {
          bind(...values) { return statement(values); },
          async first() { return sql.prepare(query).get(...args) || null; },
          async all() { return { results: sql.prepare(query).all(...args) }; },
          async run() { const result=sql.prepare(query).run(...args); return { meta: { changes: result.changes } }; },
          execute() { const stmt=sql.prepare(query); return stmt.columns().length ? { results:stmt.all(...args) } : { results:[],meta:{changes:stmt.run(...args).changes} }; },
        };
      }
      return statement();
    },
    async batch(statements) {
      sql.exec('BEGIN');
      try { const result=statements.map((stmt,i)=>{ if(i===db.failAt) throw new Error('Injected write failure'); return stmt.execute(); }); sql.exec('COMMIT'); return result; }
      catch(error) { sql.exec('ROLLBACK'); throw error; }
    },
  };
  return db;
}
async function seed(db, name='SaloneDriver', id=crypto.randomUUID()) {
  const { hash } = await import('../../server/auth/session.mjs');
  const token=crypto.randomUUID().replaceAll('-','').repeat(2);
  db.sql.prepare('INSERT INTO players VALUES (?,?,?,?,?,?,?)').run(id, 'google-'+id, name, name?.toLowerCase() || null, null, Date.now(),Date.now());
  db.sql.prepare('INSERT INTO player_progress(player_id,updated_at) VALUES (?,?)').run(id,Date.now());
  db.sql.prepare('INSERT INTO app_sessions VALUES (?,?,?,?)').run(await hash(token),id,Date.now(),Date.now()+3600000);
  return { id, token, cookie:'__Host-poda-session='+token };
}
function request(path, player, body, overrides={}) {
  return new Request('https://podapodarun.com'+path, { method:body === undefined?'GET':'POST',
    headers:{cookie:player?.cookie || '', ...(body === undefined?{}:{'content-type':'application/json',origin:'https://podapodarun.com','x-poda-request':'1'}),...overrides},
    ...(body === undefined?{}:{body:JSON.stringify(body)}) });
}
function summary(extra={}) {
  const rules=require('../../src/simulation/RunRules.js');
  const run={completed:false,distance:300,earnings:11,coins:2,style:0,passengersDelivered:1,passengersOnboard:6,passengersLost:0,
    stopsServed:1,stopsMissed:0,perfectStops:1,collisions:0,...extra};
  run.score=rules.calculateScore({completed:run.completed,dist:run.distance,dropped:run.passengersDelivered,stops:run.stopsServed,perfectStops:run.perfectStops,style:run.style,missedStops:run.stopsMissed,collisions:run.collisions});
  return run;
}
module.exports={database,seed,request,summary};
