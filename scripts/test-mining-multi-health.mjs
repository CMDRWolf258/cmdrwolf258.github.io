import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet} from '../functions/api/hud/mining-multi-health.js';

test('owner mining health is read-only and never creates tables',async t=>{
  let role='site_admin',sqls=[];
  t.mock.method(globalThis,'fetch',async()=>Response.json({ok:true,access:role}));
  const env={DB:{prepare(sql){sqls.push(sql);return{async all(){return{results:[
    {name:'mining_sites'},{name:'mining_location_centers'},
    {name:'mining_multi_sites'},{name:'mining_multi_centers'},
  ]}}}}}};
  const request=new Request('https://archive.example/api/hud/mining-multi-health',{
    headers:{Authorization:'Bearer test'},
  });
  let response=await onRequestGet({request,env}),body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.sharedOffSystemReady,true);
  assert.equal(body.backupVerified,null,'Cannot claim Cloudflare backup verified');
  assert.equal(sqls.length,1);
  assert.match(sqls[0],/^SELECT /);
  assert.doesNotMatch(sqls.join(' '),/CREATE|INSERT|UPDATE|DELETE/i);
  role='member';
  response=await onRequestGet({request,env});
  assert.equal(response.status,403);
  const missing=await onRequestGet({request:new Request(request.url),env});
  assert.equal(missing.status,401);
});
test('unbound or partially migrated archive cannot claim shared ready',async t=>{
  t.mock.method(globalThis,'fetch',async()=>Response.json({ok:true,access:'site_admin'}));
  const req=new Request('https://archive.example/api/hud/mining-multi-health',{
    headers:{Authorization:'Bearer test'},
  });
  const unbound=await onRequestGet({request:req,env:{}});
  assert.equal(unbound.status,503);
  assert.equal((await unbound.json()).error,'archive_db_not_bound');
  const partial=await onRequestGet({request:req,env:{DB:{prepare(){return{async all(){return{results:[
    {name:'mining_sites'},{name:'mining_location_centers'},
  ]}}}}}}});
  assert.equal((await partial.json()).sharedOffSystemReady,false);
});
