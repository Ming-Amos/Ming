// Real browser executions; saves only references, never fabricates a run result.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const base = 'http://127.0.0.1:4001';
async function api(route, body) {
  const r = await fetch(base + route, body ? {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)} : {});
  const j=await r.json(); if(!r.ok||!j.ok) throw new Error(j.error ?? `HTTP ${r.status}`); return j;
}
const stateFile = path.join(root, 'runtime/demo-proof-state.json');
const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile,'utf8')) : {capturedBy:'Codex', provenance:'real-local-browser-runs', runs:{}};
for(const variant of process.argv.slice(2).length ? process.argv.slice(2) : ['repair-demo','normal','buggy','todo-normal','todo-buggy']) {
  const {plan}=await api('/api/plan?variant='+variant);
  const {runId}=await api('/api/run',{variant,confirmed:true,confirmedPlanId:plan.planId,confirmedPlanFingerprint:plan.fingerprint});
  const deadline=Date.now()+120_000;
  let run;
  while(Date.now()<deadline) {
    const {progress}=await api(`/api/run/${runId}/progress`);
    if(!['running','pending'].includes(progress.status)) {run=(await api(`/api/run/${runId}`)).run;break;}
    await new Promise(r=>setTimeout(r,600));
  }
  if(!run) throw new Error('Run timed out: '+runId);
  const expected=variant.endsWith('buggy')||variant==='repair-demo'?['passed','failed','passed']:['passed','passed','passed'];
  if(variant==='todo-buggy') expected.splice(0,3,'passed','passed','failed');
  if(JSON.stringify(run.criteria.map(c=>c.status))!==JSON.stringify(expected)) throw new Error('Unexpected actual result '+JSON.stringify(run));
  state.runs[variant]=runId;
  if(variant==='repair-demo') {
    const {task}=await api('/api/repair-tasks',{baselineRunId:runId}); state.taskId=task.taskId;
    fs.mkdirSync(path.join(root,'runtime/demo-proof'),{recursive:true});
    fs.copyFileSync(path.join(root,'examples/daily-report/repair/index.html'),path.join(root,'runtime/demo-proof/before.html'));
  }
  fs.writeFileSync(stateFile,JSON.stringify(state,null,2));
  console.log(JSON.stringify({variant,runId,status:run.status,criteria:run.criteria.map(c=>[c.criteriaId,c.status]),source:run.targetFingerprint,runner:run.runnerFingerprint,taskId:variant==='repair-demo'?state.taskId:undefined}));
}
