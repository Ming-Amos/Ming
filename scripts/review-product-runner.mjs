import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const { PlanRunner, computeFingerprint } = require('../packages/runner/dist/index.js');
const out = path.join(root, 'runtime', 'product-runner-' + randomUUID()); fs.mkdirSync(out, {recursive:true});
const checks=[];const records=[];
function check(name, value) {checks.push({name,passed:!!value});if(!value)throw Error(name);console.log('PASS '+name);}
let trapRequests=0, mutations=0;
const trap=http.createServer((req,res)=>{trapRequests++;res.end('Unauthorized destination');});
await new Promise(r=>trap.listen(0,'127.0.0.1',r));const trapUrl=`http://127.0.0.1:${trap.address().port}`;
const html=`<!doctype html><link rel="stylesheet" href="/style.css"><h1>Independent onboarding test</h1><label>Name<input id="name"></label><label>Color<select id="color"><option value="red">Red</option><option value="blue">Blue</option></select></label><label>Subscribe<input id="sub" type="checkbox"></label><button id="save">Save</button><div id="result"></div><a href="/detail">Next</a><script src="/app.js"></script><img src="${trapUrl}/outside">`;
const app=http.createServer(async(req,res)=>{
  if(req.url==='/redirect'){res.writeHead(302,{location:trapUrl+'/secret?token=hidden'});res.end();return;}
  if(req.url==='/slow'){res.setHeader('Content-Type','text/html');res.end('<h1>Slow test</h1><button disabled>Never enabled</button>');return;}
  if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end('body{font:18px sans-serif;padding:32px}label{display:block;margin:12px}');return;}
  if(req.url==='/app.js'){res.setHeader('Content-Type','application/javascript');res.end(`document.querySelector('#save').onclick=async()=>{const value=document.querySelector('#name').value+' '+document.querySelector('#color').value+' '+(document.querySelector('#sub').checked?'yes':'no');const r=await fetch('/api/save',{method:'POST',body:value});document.querySelector('#result').textContent=await r.text();console.error('token=private-test-token');};`);return;}
  if(req.url==='/api/save'){let body='';for await(const chunk of req)body+=chunk;mutations++;setTimeout(()=>res.end(body),180);return;}
  res.setHeader('Content-Type','text/html');res.end(req.url==='/detail'?'<h1>Details</h1>':html);
});
await new Promise(r=>app.listen(0,'127.0.0.1',r));const appUrl=`http://127.0.0.1:${app.address().port}`;
function plan(steps){const p={planId:randomUUID(),version:'1',source:'manual',title:'Independent real app acceptance',description:'Test-only plan',createdAt:new Date().toISOString(),criteria:[{id:'AC-01',title:'Real form',description:'User-owned app flow',steps:steps.map((s,i)=>({id:`S-${i+1}`,description:s.type,...s}))}],fingerprint:''};p.fingerprint=computeFingerprint(p);return p;}
async function run(p,url=appUrl,options={},snapshot){const id=randomUUID();const r=await new PlanRunner({screenshotDir:out,runId:id,...options}).run(p,{variant:'own-project',url,fingerprint:snapshot===undefined?'unknown':computeFingerprint(snapshot),htmlSnapshot:snapshot},'Alice');records.push(r);return r;}
try{
 const p=plan([{type:'navigate',url:'{{TARGET_URL}}'},{type:'fill',locator:'Name',value:'Alice'},{type:'selectOption',locator:'Color',value:'blue'},{type:'check',locator:'Subscribe'},{type:'click',locator:'css=#save'},{type:'assertVisibleIn',locator:'css=#result',value:'Alice blue yes'},{type:'assertValue',locator:'Name',value:'Alice'},{type:'uncheck',locator:'Subscribe'},{type:'assertCount',locator:'input:checked',expected:0},{type:'click',locator:'Next'},{type:'assertUrl',value:'/detail'}]);
 const r=await run(p);
 check('Multi-file app, asynchronous backend, forms and same-origin navigation pass',r.status==='passed');
 check('Real backend POST executed exactly once',mutations===1);
 check('Live URL is explicitly observed, not an HTML snapshot',r.sourceBinding==='live-url-observed');
 check('Console diagnostic is real and sensitive token is redacted',r.diagnostics.some(x=>x.kind==='console'&&x.message.includes('[REDACTED]'))&&!JSON.stringify(r.diagnostics).includes('private-test-token'));
 check('Outside-origin subresource never reaches destination',trapRequests===0);
 const before=trapRequests;const redirect=await run(plan([{type:'navigate',url:'{{TARGET_URL}}'},{type:'assertVisible',value:'Unauthorized destination'}]),appUrl+'/redirect');
 check('HTTP redirect to another origin is blocked before destination request',redirect.status==='error'&&trapRequests===before);
 check('Blocked redirect has actionable real diagnostic',redirect.diagnostics.some(x=>x.status===302&&x.message.includes('跳转')));
 const slow=plan([{type:'navigate',url:'{{TARGET_URL}}'},{type:'click',locator:'Never enabled'},{type:'assertVisible',value:'Impossible'}]);
 const controller=new AbortController();const started=Date.now();setTimeout(()=>controller.abort(),350);
 const cancelled=await run(slow,appUrl+'/slow',{signal:controller.signal});
 check('Cancellation terminates browser promptly without a pass',cancelled.status==='error'&&cancelled.terminationReason==='cancelled'&&Date.now()-started<4000);
 const timed=await run(slow,appUrl+'/slow',{deadlineMs:1000});
 check('Whole-run deadline has a distinct terminal reason',timed.status==='error'&&timed.terminationReason==='deadline');
 const pre=new AbortController();pre.abort();const already=await run(slow,appUrl+'/slow',{signal:pre.signal});
 check('Already-cancelled run performs no acceptance steps',already.terminationReason==='cancelled'&&already.criteria.every(c=>c.status==='not_run'));
 const snap='<h1>Frozen HTML</h1><img src="'+trapUrl+'/outside-snapshot">';const frozen=await run(plan([{type:'navigate',url:'{{TARGET_URL}}'},{type:'assertVisible',value:'Frozen HTML'}]),appUrl,{},snap);
 check('Self-contained snapshot binding still works',frozen.status==='passed'&&frozen.sourceBinding==='self-contained-html-snapshot');
 check('Frozen document cannot load an external asset',trapRequests===0);
 let rejected=false;try{await run(plan([{id:'../../bad',type:'assertVisible',value:'x'}]));}catch{rejected=true;}
 check('Unsafe screenshot step IDs are rejected before execution',rejected);
}finally{
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,records},null,2));
 app.closeAllConnections();trap.closeAllConnections();await Promise.all([new Promise(r=>app.close(r)),new Promise(r=>trap.close(r))]);
 console.log(JSON.stringify({checks:checks.length,passed:checks.filter(x=>x.passed).length,report:path.join(out,'report.json')}));
}
