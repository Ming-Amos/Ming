/** Export an explicit set of reviewed real run IDs, never the whole runtime. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root=fileURLToPath(new URL('..',import.meta.url));
const state=JSON.parse(fs.readFileSync(path.join(root,'runtime/demo-proof-state.json'),'utf8'));
const out=path.join(root,'docs/demo-evidence');
const runtime=path.join(out,'runtime');
const responses={};
async function get(route) { const r=await fetch('http://127.0.0.1:4001'+route); const j=await r.json();if(!r.ok||!j.ok)throw Error(j.error); responses[route]=j;return j; }
function copy(folder,name){const source=path.join(root,'runtime',folder,name);const dest=path.join(runtime,folder,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(source,dest);}
fs.mkdirSync(out,{recursive:true});
const task=(await get('/api/repair-tasks/'+state.taskId)).task;
const comparison=(await get('/api/repair-tasks/'+state.taskId+'/comparison')).comparison;
if(!comparison.verifiedRepair||task.status!=='passed')throw Error('Actual repair proof must pass before exporting');
const runIds=[...new Set([...Object.values(state.runs),task.rerunId])];
for(const id of runIds){
  const {run}=await get('/api/run/'+id); if(!run.finishedAt)throw Error('Incomplete run '+id);
  await get('/api/run/'+id+'/progress'); copy('runs',id+'.json');
  for(const criterion of run.criteria) for(const step of criterion.steps) if(step.screenshotPath) copy('screenshots',path.basename(step.screenshotPath));
}
copy('repair-tasks',task.taskId+'.json');
responses['/api/repair-tasks']={ok:true,tasks:[task]};
const history=await get('/api/history');
if(!Array.isArray(history.runs))throw Error('Unexpected history contract');
history.runs=history.runs.filter(r=>runIds.includes(r.runId));
const targets=await get('/api/targets');
await get('/api/plan');
for(const t of targets.targets) await get('/api/plan?variant='+encodeURIComponent(t.variant));
responses['/api/capabilities']={ok:true,readOnly:true,sourceBinding:'self-contained-html-snapshot'};
responses['/api/provider/status']={ok:true,status:{configured:false,providerLabel:'Public evidence viewer',baseUrl:'',modelId:'',missingFields:['Public view has no model connection']}};
fs.writeFileSync(path.join(out,'api-responses.json'),JSON.stringify({schemaVersion:1,responses},null,2));
fs.cpSync(path.join(root,'runtime/demo-proof'),path.join(out,'repair-process'),{recursive:true});
const hashes={};
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else hashes[path.relative(out,p).replaceAll('\\','/')]=createHash('sha256').update(fs.readFileSync(p)).digest('hex');}}
walk(runtime);
const manifest={schemaVersion:1,exportedAt:new Date().toISOString(),actor:'Codex via real stdio MCP',provenance:'Actual local browser executions with hand-authored fixture plans; no live model generation',featuredBaselineRunId:task.baselineRunId,featuredRerunId:task.rerunId,taskId:task.taskId,runIds,comparison,files:hashes};
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({out,runIds,verifiedRepair:comparison.verifiedRepair,evidenceFiles:Object.keys(hashes).length}));
