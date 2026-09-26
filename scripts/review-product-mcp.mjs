/** Real stdio SDK + own local app + downloadable reports. No LLM or Bob requests. */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(new URL('../apps/mcp/package.json', import.meta.url));
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport, getDefaultEnvironment } = require('@modelcontextprotocol/sdk/client/stdio.js');
const runnerRequire = createRequire(new URL('../packages/runner/package.json', import.meta.url));
const { chromium } = runnerRequire('playwright');
const runtime = path.join(root, 'runtime', `product-mcp-${randomUUID()}`);
const port = 4442, base = `http://127.0.0.1:${port}`;
fs.mkdirSync(runtime, {recursive:true});
const report = {startedAt:new Date().toISOString(), checks:[], scope:'Actual SDK tool calls, local independent target, original browser screenshots and report rendering. No model/Bob.'};
const wait = ms=>new Promise(r=>setTimeout(r,ms));
function check(label, passed) { report.checks.push({label,passed:Boolean(passed)}); console.log(`${passed?'PASS':'FAIL'} ${label}`); if(!passed) throw Error(label); }
async function api(method,url,body,status=200) {const r=await fetch(base+url,{method,headers:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();if(r.status!==status)throw Error(`${url} ${r.status} ${JSON.stringify(data)}`);return data;}
let child,browser,client;
const target=http.createServer((_req,res)=>{res.setHeader('content-type','text/html');res.end('<!doctype html><title>Independent MCP Application</title><h1>Account settings</h1><p id="state">Draft</p><button>Save settings</button>');});
async function tool(name,args={}) {const result=await client.callTool({name,arguments:args});if(result.isError)throw Error(JSON.stringify(result));return JSON.parse(result.content[0].text);}
async function terminal(runId) {for(let i=0;i<200;i++){const {run}=await tool('ming_get_run',{runId});if(['passed','failed','error'].includes(run.status))return run;await wait(80);}throw Error('Run timeout');}
try {
  try {await fetch(base+'/api/capabilities',{signal:AbortSignal.timeout(300)});throw Error('Review port already occupied');} catch(e){if(e.message==='Review port already occupied')throw e;}
  await new Promise(r=>target.listen(0,'127.0.0.1',r));
  const log=fs.openSync(path.join(runtime,'server.log'),'a');
  child=spawn(process.execPath,['apps/server/dist/index.js'],{cwd:root,windowsHide:true,env:{...process.env,PORT:String(port),MING_RUNTIME_DIR:runtime,MING_PUBLIC_DEMO:'0',MING_TEST_MODE:'0',PROVIDER_API_KEY:'',PROVIDER_BASE_URL:'',PROVIDER_MODEL_ID:''},stdio:['ignore',log,log]});fs.closeSync(log);
  let ready=false;for(let i=0;i<100;i++){try {await api('GET','/api/capabilities');ready=true;break;}catch{await wait(100);}}if(!ready)throw Error('Server did not start');
  const targetUrl=`http://127.0.0.1:${target.address().port}/`;
  const {project}=await api('POST','/api/targets',{name:'Independent MCP Application',kind:'url',url:targetUrl});
  const rawRequirement='Save account settings. <script>window.injected=true</script><img src="https://external.invalid/trap">';
  const {requirement}=await api('POST',`/api/projects/${project.projectId}/requirements`,{text:rawRequirement});
  async function makeConfirmation(value='Published', previousDraftId) {const {draft}=await api('POST',previousDraftId ? '/api/drafts/' + previousDraftId + '/revise' : '/api/drafts/manual',{projectId:project.projectId,requirementId:requirement.requirementId,plan:{title:'Reviewed settings acceptance',description:'Real assertion',criteria:[{id:'SETTINGS',title:'Settings state',description:'Must expose its saved state',steps:[{id:'OPEN',type:'navigate',url:'{{TARGET_URL}}',description:'Open application'},{id:'STATE',type:'assertVisibleIn',locator:'#state',value,description:'Observe saved state'}]}]}});return(await api('POST','/api/confirm',{draftId:draft.draftId,displayedPlanFingerprint:draft.plan.fingerprint})).confirmation;}
  const confirmation=await makeConfirmation();
  client=new Client({name:'ming-product-review',version:'1.0.0'});
  await client.connect(new StdioClientTransport({command:process.execPath,args:[path.join(root,'apps/mcp/dist/index.js')],cwd:root,stderr:'pipe',env:{...getDefaultEnvironment(),MING_BASE_URL:base}}));
  const tools=(await client.listTools()).tools;
  check('SDK discovers all twelve actual MCP tools',tools.length===12);
  check('MCP lists registered own project',(await tool('ming_list_projects')).projects.some(p=>p.projectId===project.projectId));
  check('MCP discovers actual application target',(await tool('ming_get_targets')).targets.some(t=>t.projectId===project.projectId && t.url===targetUrl));
  const workspace=await tool('ming_get_project',{projectId:project.projectId});
  check('Agent reads saved requirements and human confirmation',workspace.requirements[0].text===rawRequirement && workspace.confirmations.some(c=>c.confirmationId===confirmation.confirmationId&&c.active));
  const start=await tool('ming_run_acceptance',{confirmationId:confirmation.confirmationId});
  const run=await terminal(start.runId);
  check('MCP starts and observes actual browser failure',run.status==='failed'&&run.criteria[0].steps.some(s=>s.status==='failed'&&s.screenshotPath));
  const evidence=await tool('ming_get_failed_run',{runId:run.runId});
  check('Existing bounded failure tool returns genuine run',JSON.stringify(evidence).includes(run.runId)&&JSON.stringify(evidence).includes('STATE'));
  const {task}=await tool('ming_create_repair_task',{runId:run.runId});
  const claimed=await tool('ming_claim_repair_task',{taskId:task.taskId,claimedBy:'Actual stdio review client'});
  check('AI creates and claims evidence-backed repair task',task.baselineRunId===run.runId && claimed.claimedBy==='Actual stdio review client');
  const bad=await client.callTool({name:'ming_get_project',arguments:{projectId:'../../escape'}});
  check('Malformed record identifiers return tool errors',bad.isError===true);
  const html=await(await fetch(`${base}/api/run/${run.runId}/report?format=html`)).text();
  check('HTML export contains actual embedded PNG evidence and escaped requirements',html.includes('data:image/png;base64,')&&html.includes('&lt;script&gt;')&&!html.includes('<script>window.injected'));
  fs.writeFileSync(path.join(runtime,'report.html'),html);
  const exported=await(await fetch(`${base}/api/run/${run.runId}/report?format=json`)).json();
  check('JSON export retains exact original run and requirement',JSON.stringify(exported.run)===JSON.stringify(run)&&exported.scope.includes('Live website observation'));
  const markdown=await(await fetch(`${base}/api/run/${run.runId}/report?format=markdown`)).text();
  check('Markdown export preserves actual results and escapes embedded HTML',markdown.includes('STATE')===false&&markdown.includes('Observe saved state')&&markdown.includes('&lt;script&gt;')&&!markdown.includes('<img'));
  await api('GET',`/api/run/${run.runId}/report?format=exe`,undefined,400);
  await api('GET',`/api/run/${randomUUID()}/report`,undefined,404);
  check('Report API rejects unknown formats and missing records',true);
  browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1280,height:900}});let external=0;
  page.on('request',r=>{if(r.url().startsWith('http'))external++;});await page.setContent(html);await page.screenshot({path:path.join(runtime,'report-render.png'),fullPage:true});
  check('Standalone report renders original images without external traffic or script execution',await page.locator('img').count()>0 && await page.evaluate(()=>Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0)&&!window.injected) && external===0);
  const second=await tool('ming_run_acceptance',{confirmationId:confirmation.confirmationId});
  await api('GET',`/api/run/${second.runId}/report`,undefined,409);
  await tool('ming_cancel_run',{runId:second.runId});const cancelled=await terminal(second.runId);
  check('MCP cancels real browser work and preserves terminal evidence',cancelled.status==='error'&&cancelled.terminationReason==='cancelled');
  const nextConfirmation=await makeConfirmation('Draft', confirmation.draftId);
  const passing=await terminal((await tool('ming_run_acceptance',{confirmationId:nextConfirmation.confirmationId})).runId);
  check('Same AI entry point observes genuine passing acceptance',passing.status==='passed');
  const stale=await client.callTool({name:'ming_run_acceptance',arguments:{confirmationId:confirmation.confirmationId}});
  check('Agent cannot execute superseded human standard',stale.isError===true);
  report.success=true;
}catch(e){report.error=e.stack;process.exitCode=1;console.error(e);}finally{await client?.close();await browser?.close();await new Promise(r=>target.close(r));if(child&&child.exitCode===null){const end=new Promise(r=>child.once('exit',r));child.kill();await end;}report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(runtime,'review-report.json'),JSON.stringify(report,null,2));console.log(path.join(runtime,'review-report.json'));}
