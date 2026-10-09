import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { onRequestPost as reportDeposit } from '../functions/api/hud/mining-report.js';
import { onRequestPost as saveCenter } from '../functions/api/hud/mining-center.js';
import { onRequestGet as getDeposits } from '../functions/api/mining.js';
import { onRequestGet as getCenters } from '../functions/api/mining-centers.js';
import { onRequestGet as getSystemDirectory } from '../functions/api/mining-systems.js';
import { normalizedMultiScope } from '../lib/mining-multisystem.js';
import { createSession } from '../lib/auth.js';
import { onRequestGet as listReviews, onRequestPost as review } from '../functions/api/admin/mining-multi-reports.js';

// Disposable SQLite only. Never touches production D1 or user reports.
function database() {
  const db=new DatabaseSync(':memory:');
  db.exec("CREATE TABLE legacy_guard(id INTEGER PRIMARY KEY, data TEXT); INSERT INTO legacy_guard VALUES(1,'untouched');");
  return {db,env:{DB:{
    prepare(sql) {
      const row={args:[],bind(...args){this.args=args;return this;},
        async run(){const res=db.prepare(sql).run(...this.args);return{meta:{changes:res.changes,last_row_id:res.lastInsertRowid}};},
        async first(){return db.prepare(sql).get(...this.args)||null;},
        async all(){return{results:db.prepare(sql).all(...this.args)};}};
      return row;
    },
    async batch(statements) {
      db.exec('BEGIN');
      try {const out=[];for(const stmt of statements)out.push(await stmt.run());db.exec('COMMIT');return out;}
      catch(e){db.exec('ROLLBACK');throw e;}
    },
  }}};
}
function payload(system='Icy Test',address='12345678901234567',body='Icy Test A 2 a') {
  return {system,systemAddress:address,body,bodyType:'moon',
    signal:1,latitude:12.0,longitude:-45.0,planetRadius:1000000,
    commodity:'Low Temperature Diamonds',rigs:6,notes:'near ridge'};
}
function post(route,body) {
  return new Request('https://archive.example/api/hud/'+route,{
    method:'POST',
    headers:{Authorization:'Bearer test-token','Content-Type':'application/json'},
    body:JSON.stringify(body),
  });
}
function get(route,address){
  return new Request('https://archive.example/api/'+route+'?systemAddress='+address);
}
async function send(fn,route,body,env){
  const response=await fn({request:post(route,body),env});
  return {code:response.status,data:await response.json()};
}
test('strict ID64 + full-body identity rejects short body and stale system names',()=>{
  assert.equal(normalizedMultiScope(payload('Icy Test','12345678901234567','2 a')),null);
  assert.equal(normalizedMultiScope(payload('Icy Test','12345678901234567','Other A 2 a')),null);
  assert.equal(normalizedMultiScope(payload('Icy Test','','Icy Test A 2 a')),null);
  assert.equal(normalizedMultiScope(payload('Icy Test','560820275507','Icy Test A 2 a')),null);
  assert.equal(normalizedMultiScope(payload('NGC 2546 Sector UZ-G d10-16','12345678901234567','NGC 2546 Sector UZ-G d10-16 3')),null);
  assert.equal(normalizedMultiScope(payload('Icy Test','18446744073709551616','Icy Test A 2 a')),null);
  assert.equal(normalizedMultiScope(payload('Icy Test','18446744073709551615','Icy Test A 2 a')).systemAddress,'18446744073709551615');
});

test('multi system D1 stores separate centers, approved deposits, pending reports, duplicate reviews and precise retrieval', async t=>{
  const {db,env}=database();
  t.after(()=>db.close());
  let role='site_admin';
  t.mock.method(globalThis,'fetch',async()=>Response.json({ok:true,access:role,commander:'Test CMDR'}));
  const one=payload();
  const first=await send(saveCenter,'mining-center',one,env);
  assert.equal(first.code,201,JSON.stringify(first));
  assert.equal(first.data.center.systemAddress,one.systemAddress);
  assert.equal(first.data.center.body,one.body);
  assert.equal(first.data.center.id>=2000000000,true);

  const a=await send(reportDeposit,'mining-report',one,env);
  assert.equal(a.code,201,JSON.stringify(a));
  assert.equal(a.data.status,'approved');
  const same=await send(reportDeposit,'mining-report',one,env);
  assert.equal(same.data.status,'existing');
  assert.equal(same.data.site.id,a.data.site.id);

  const nowOther=payload('Second Test','777777777777777','Second Test A 2 a');
  const c2=await send(saveCenter,'mining-center',nowOther,env);
  assert.notEqual(c2.data.center.id,first.data.center.id);
  const d2=await send(reportDeposit,'mining-report',nowOther,env);
  assert.equal(d2.data.status,'approved');
  const diffBody={...one,body:'Icy Test B 2 a'};
  const d3=await send(reportDeposit,'mining-report',diffBody,env);
  assert.equal(d3.data.status,'approved');

  // A member-only pending system must not leak into the public autocomplete.
  role='member';
  const notPublic=payload('Unapproved Only','555555555555555','Unapproved Only A 2 a');
  assert.equal((await send(reportDeposit,'mining-report',notPublic,env)).data.status,'pending');
  role='site_admin';
    const directory=await (await getSystemDirectory({env})).json();
  assert.equal(directory.ok,true);
  assert.deepEqual(new Set(directory.systems.map(s=>s.systemAddress)),
    new Set(['560820275507',one.systemAddress,nowOther.systemAddress]));
  assert.equal(directory.systems.some(s=>s.systemName==='Icy Test'),true);
  assert.equal(directory.systems.some(s=>s.systemAddress==='555555555555555'),false);
    const centers=await (await getCenters({request:get('mining-centers',one.systemAddress),env})).json();
  assert.equal(centers.length,1);
  assert.equal(centers[0].id,first.data.center.id);
  let deposits=await (await getDeposits({request:get('mining',one.systemAddress),env})).json();
  assert.equal(deposits.length,2);
  assert.deepEqual(new Set(deposits.map(x=>x.body)),new Set([one.body,diffBody.body]));
  const otherDeposits=await (await getDeposits({request:get('mining',nowOther.systemAddress),env})).json();
  assert.equal(otherDeposits.length,1);
  assert.equal(otherDeposits[0].systemAddress,nowOther.systemAddress);

  role='member';
  const pending=await send(reportDeposit,'mining-report',{...one,latitude:40,longitude:40,commodity:'Bromellite'},env);
  assert.equal(pending.data.status,'pending');
  const near=await send(reportDeposit,'mining-report',{...one,latitude:12.00005,longitude:-45},env);
  assert.equal(near.data.status,'duplicate_review');
  assert.equal(near.data.duplicate.siteId,a.data.site.id);
  deposits=await (await getDeposits({request:get('mining',one.systemAddress),env})).json();
  assert.equal(deposits.length,2,'pending and duplicate rows must not be visible as approved');
  const exactRepeat=await send(reportDeposit,'mining-report',{...one,latitude:12.00005,longitude:-45},env);
  assert.equal(exactRepeat.data.status,'duplicate_review');
  assert.equal(exactRepeat.data.reportId,near.data.reportId);
  const unauthorizedCenter=await send(saveCenter,'mining-center',one,env);
  assert.equal(unauthorizedCenter.code,403);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM mining_multi_sites').get().total,5);
  assert.equal(db.prepare('SELECT data FROM legacy_guard WHERE id=1').get().data,'untouched');
});


test('Discord site admin review lists pending records and authorizes approval/rejection',async t=>{
  const {db,env}=database();
  t.after(()=>db.close());
  let role='site_admin';
  t.mock.method(globalThis,'fetch',async()=>Response.json({ok:true,access:role,commander:'Test CMDR'}));
  const sample=payload(),second={...sample,longitude:-45.2};
  const approved=await send(reportDeposit,'mining-report',sample,env);
  assert.equal(approved.data.status,'approved');
  role='member';
  const pending=await send(reportDeposit,'mining-report',second,env);
  assert.equal(pending.data.status,'pending');
  const near=await send(reportDeposit,'mining-report',{...sample,latitude:12.00009},env);
  assert.equal(near.data.status,'duplicate_review');
  env.SESSION_SECRET='test-local-only-session-secret';
  const session=await createSession(env,{id:'test-user',username:'dev'}, {access:'site_admin'});
  const url='https://archive.example/api/admin/mining-multi-reports';
  const authHeaders={Cookie:'ten16_session='+session,'Content-Type':'application/json'};
  const unauth=await listReviews({request:new Request(url),env});
  assert.equal(unauth.status,401);
  const listed=await listReviews({request:new Request(url,{headers:authHeaders}),env});
  assert.equal(listed.status,200);
  assert.equal((await listed.json()).reports.length,2);
  const sendReview=async (reportId,action)=>{
    const result=await review({request:new Request(url,{method:'POST',headers:authHeaders,
      body:JSON.stringify({reportId,action})}),env});
    return{code:result.status,data:await result.json()};
  };
  const noBlindApprove=await sendReview(near.data.reportId,'approve');
  assert.equal(noBlindApprove.code,409,'nearby duplicate needs explicit resolution');
  const discard=await sendReview(near.data.reportId,'keep-existing');
  assert.equal(discard.data.status,'rejected');
  const accept=await sendReview(pending.data.reportId,'approve');
  assert.equal(accept.data.status,'approved');
  assert.equal((await (await getDeposits({request:get('mining',sample.systemAddress),env})).json()).length,2);
  const again=await sendReview(pending.data.reportId,'approve');
  assert.equal(again.code,409,'review cannot be processed twice');
  const replacing=await send(reportDeposit,'mining-report',{...sample,longitude:-44.99995},env);
  assert.equal(replacing.data.status,'duplicate_review');
  const keepNew=await sendReview(replacing.data.reportId,'keep-new');
  assert.equal(keepNew.data.status,'approved');
  assert.equal(db.prepare("SELECT status FROM mining_multi_sites WHERE id=?").get(approved.data.site.id-2000000000).status,'rejected');
  assert.equal((await (await getDeposits({request:get('mining',sample.systemAddress),env})).json()).length,2);
  const noMore=await listReviews({request:new Request(url,{headers:authHeaders}),env});
  assert.equal((await noMore.json()).reports.length,0);
});
