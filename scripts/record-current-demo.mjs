/** Record real current-product interactions. --preflight uses a labelled historical
 * provider response only for unrecorded locator rehearsal. --record permits one
 * real draft on the localhost product server; it never rewrites app results.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('..',import.meta.url));
const preflight=process.argv.includes('--preflight');
assert.ok(preflight||process.argv.includes('--record'),'Choose --preflight or --record.');
const work=path.join(root,'runtime/current-submission-video',preflight?'preflight':'take');
assert.ok(preflight||!fs.existsSync(path.join(work,'recording.json')),'A recorded take already exists. Preserve it and deliberately choose a new recording workspace before recording again.');
fs.mkdirSync(work,{recursive:true});
const base=process.env.MING_RECORDING_URL||'http://127.0.0.1:4386';
assert.equal(new URL(base).hostname,'127.0.0.1');
const story=JSON.parse(fs.readFileSync(path.join(root,'scripts/demo-video-narration.json'),'utf8'));
const requirement=[
 '1. Submit an empty task name. Show “Add a task name before continuing.” and keep the count at “0 tasks”.',
 '2. Add a task named “Ming acceptance test”. It must appear in the task list.',
 '3. Reload the application. “Ming acceptance test” must still appear in the task list.',
].join('\n');
const {chromium}=createRequire(path.join(root,'packages/runner/package.json'))('playwright');
const report={startedAt:new Date().toISOString(),preflight,actualProvider:!preflight,base,sourceCommit:'21b5235b599d649eaaa78ec4a594641c5d809f2c',requirements:requirement,scenes:[],actions:[],errors:[],blockedRequests:[],draftRequests:0,success:false};
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1600,height:810},acceptDownloads:true,permissions:['clipboard-read','clipboard-write'],...(preflight?{reducedMotion:'reduce'}:{recordVideo:{dir:path.join(work,'raw'),size:{width:1600,height:810}}})});
let permitDraft=false,globalStart,sceneStart,page,recordCreated=Date.now();
const b=name=>page.getByRole('button',{name,exact:true});
const rootNode=()=>page.getByTestId('upload-studio');
async function pause(sec){await page.waitForTimeout(preflight?Math.min(160,sec*30):sec*1000)}
async function click(locator){await locator.scrollIntoViewIfNeeded();const box=await locator.boundingBox();if(box)await page.mouse.move(box.x+box.width/2,box.y+box.height/2,{steps:12});await pause(.2);await locator.click()}
async function show(locator){await locator.evaluate(el=>window.scrollTo({top:window.scrollY+el.getBoundingClientRect().top-42,behavior:'smooth'}));await pause(.6)}
async function at(sec,name,fn){if(!preflight){const remain=sceneStart+sec*1000-Date.now();if(remain>0)await page.waitForTimeout(remain)}report.actions.push({scene:report.scenes.length,time:(Date.now()-globalStart)/1000,name});await fn()}
async function stage(value){await page.waitForFunction(value=>document.querySelector('[data-testid="upload-studio"]')?.dataset.workflowStage===value,value)}
async function ready(){await page.waitForFunction(()=>{const n=document.querySelector('[data-testid="upload-studio"]');return n?.dataset.previewReady==='true'&&n.dataset.phase==='idle'})}
async function settled(){await stage('results');await page.waitForFunction(()=>document.querySelector('[data-testid="upload-studio"]')?.dataset.phase==='idle',null,{timeout:60000})}
async function upload(fixed){await page.getByLabel(fixed?'Upload revised HTML or ZIP':'Upload HTML or ZIP',{exact:true}).setInputFiles(path.join(root,'examples/shipboard',fixed?'normal':'buggy','index.html'));await ready()}
async function exportRun(name){const event=page.waitForEvent('download');await click(b('Download report'));await(await event).saveAs(path.join(work,name+'.json'));return JSON.parse(fs.readFileSync(path.join(work,name+'.json'),'utf8'))}
async function shot(name){await page.screenshot({path:path.join(work,name+'.png')})}
async function scene(index,fn){
 sceneStart=Date.now();const meta={index,title:story[index].title,kind:story[index].kind,start:(sceneStart-globalStart)/1000,targetDuration:story[index].end-story[index].start};
 console.log('Scene '+(index+1)+': '+meta.title);await fn();await shot('scene-'+String(index+1).padStart(2,'0'));
 const remaining=meta.targetDuration*1000-(Date.now()-sceneStart);if(!preflight&&remaining>0)await page.waitForTimeout(remaining);
 meta.end=(Date.now()-globalStart)/1000;meta.duration=meta.end-meta.start;report.scenes.push(meta);
}
let draft,first,second;
try{
 await context.route('**/*',async route=>{
  const req=route.request(),href=req.url();if(/^(blob|data|about|file):/.test(href))return route.continue();
  const url=new URL(href);if(url.origin!==new URL(base).origin){report.blockedRequests.push({path:url.pathname,origin:url.origin});return route.abort()}
  if(url.pathname==='/api/upload/planner/draft'){
   report.draftRequests++;assert.ok(permitDraft&&report.draftRequests===1,'One explicit draft maximum');permitDraft=false;
   const body=req.postDataJSON();assert.equal(body.requirement,requirement);assert.equal(body.confirmedUserAction,true);
   if(preflight){const saved=JSON.parse(fs.readFileSync(path.join(root,'docs/evidence/shipboard-doubao/2026-09-26T17-49-25-055Z-0db01f40/production-report.json'),'utf8'));return route.fulfill({json:saved.planner})}
  }
  if(req.method()!=='GET'&&req.method()!=='HEAD'&&url.pathname!=='/api/upload/planner/draft'){report.blockedRequests.push({path:url.pathname,method:req.method()});return route.abort()}
  return route.continue();
 });
 // A recording cursor is only an annotation; it never changes application data.
 await context.addInitScript(()=>{
  if(window.top!==window)return;
  addEventListener('DOMContentLoaded',()=>{const cursor=document.createElement('div');cursor.setAttribute('aria-hidden','true');cursor.style.cssText='position:fixed;left:-50px;top:-50px;width:19px;height:19px;border:2px solid #a9c6ff;border-radius:50%;background:#5e84ff40;pointer-events:none;z-index:2147483647;transform:translate(-50%,-50%);box-shadow:0 0 0 2px #07102188';document.body.append(cursor);addEventListener('mousemove',e=>{cursor.style.left=e.clientX+'px';cursor.style.top=e.clientY+'px'});addEventListener('mousedown',()=>{cursor.style.background='#a9c6ffbb'});addEventListener('mouseup',()=>{cursor.style.background='#5e84ff40'})});
 });
 page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(e.message));
 const response=await page.goto(base,{waitUntil:'networkidle'});assert.ok(response.ok());
 report.bundle=(await response.text()).match(/\/assets\/[^"']+\.js/)?.[0];
 const built=fs.readFileSync(path.join(root,'apps/web/dist/index.html'),'utf8').match(/\/assets\/[^"']+\.js/)?.[0];assert.equal(report.bundle,built);
 await page.getByRole('link',{name:/^Start/}).waitFor();globalStart=Date.now();report.trimStartSeconds=(globalStart-recordCreated)/1000;
 await scene(0,async()=>{await at(11,'Open the workspace',()=>click(page.getByRole('link',{name:/^Start/})));await rootNode().waitFor()});
 await scene(1,async()=>{await at(2,'Open the actual buggy HTML',()=>upload(false));await stage('requirements');await at(8,'Inspect the live app preview',()=>show(page.locator('iframe[sandbox]')))});
 await scene(2,async()=>{await at(1,'Write three acceptance requirements',async()=>{const input=page.getByRole('textbox',{name:'Requirements',exact:true});await show(input);await click(input);await input.pressSequentially(requirement,{delay:preflight?0:12})});await at(12,'Locate checklist creation',()=>show(b('Create my checklist')))});
 await scene(3,async()=>{
  await at(1,'Request one genuine provider checklist',async()=>{
   const response=page.waitForResponse(r=>r.url().endsWith('/api/upload/planner/draft')&&r.request().method()==='POST',{timeout:75000});permitDraft=true;
   report.modelWaitStart=(Date.now()-globalStart)/1000;await click(b('Create my checklist'));const r=await response;draft=await r.json();report.modelWaitEnd=(Date.now()-globalStart)/1000;
   assert.ok(r.ok()&&draft.ok,'Actual draft generation must succeed');assert.ok(/^doubao-seed-2-0-pro-/.test(draft.modelId));assert.equal(draft.draft.openQuestions.length,0);
   fs.writeFileSync(path.join(work,'provider-draft.json'),JSON.stringify(draft,null,2));report.provider={modelId:draft.modelId,usage:draft.usage,steps:draft.draft.steps.length};await stage('review');
  });await at(11,'Read proposed actions and passing conditions',()=>show(page.getByRole('list',{name:'Acceptance checklist',exact:true})));
 });
 await scene(4,async()=>{
  await at(2,'Read the persistence condition',async()=>{const items=page.getByRole('list',{name:'Acceptance checklist',exact:true}).locator('li');await show(items.last())});
  await at(7,'Approve the reviewed checklist and run',()=>click(b('Approve and check')));await settled();
 });
 await scene(5,async()=>{
  await at(0,'View the real failed observation',()=>show(page.locator('.upload-observation')));
  await at(2,'Read the exact failed observation',()=>click(page.locator('.upload-observation summary')));
  await at(5,'Open the original captured image',()=>click(b('Expand')));
  await at(11,'Return from the full captured image',()=>click(b('Close DOM snapshot')));
  await at(12,'Preserve the original execution report',async()=>{first=await exportRun('failed-run');assert.equal(first.currentRun.status,'failed');const fail=first.currentRun.steps.findIndex(s=>s.status==='failed');assert.ok(fail>0);assert.ok(first.currentRun.steps.slice(0,fail).every(s=>s.status==='passed'));assert.equal(first.currentRun.steps[fail].action,'assertText');assert.equal(first.currentRun.steps[fail].value,'Ming acceptance test');assert.ok(first.currentRun.steps[fail].capture?.startsWith('data:image/png;base64,'));await show(page.locator('.upload-observation'))});
 });
 await scene(6,async()=>{await at(1,'Copy actual repair instructions',()=>click(b('Copy instructions for my AI')));const brief=page.getByRole('textbox',{name:'Repair brief',exact:true});await show(brief);const text=await brief.inputValue();assert.ok(text.includes(requirement)&&text.includes(first.currentRun.id));fs.writeFileSync(path.join(work,'repair-brief.txt'),text);await at(9,'Inspect failure details in the repair brief',async()=>{await click(brief);await brief.press('Control+End')});await at(15,'Return to the requirement context',async()=>{await brief.press('Control+Home')})});
 await scene(7,async()=>{
  await at(0,'Choose to check an updated app',()=>click(b('Check an updated app')));await stage('source');await at(2,'Open the prepared corrected revision',()=>upload(true));await stage('review');
  await at(5,'Approve the exact original checklist',()=>click(b('Approve and check')));await settled();
  await at(11,'Preserve the passing revision report',async()=>{second=await exportRun('passing-run');assert.equal(second.currentRun.status,'passed');assert.ok(second.currentRun.steps.every(s=>s.status==='passed'));assert.equal(second.currentRun.planFingerprint,first.currentRun.planFingerprint);assert.notEqual(second.currentRun.projectFingerprint,first.currentRun.projectFingerprint);assert.deepEqual(second.baseline,first.currentRun);assert.ok(second.comparison.revisedSourcePassed&&second.comparison.sourceChanged&&second.comparison.samePlan)});
  await show(page.locator('.upload-comparison'));await at(16,'Compare preserved failure with the passing revision',async()=>{await click(page.locator('.upload-comparison summary'));await show(page.locator('.upload-comparison'))});
 });
 await scene(8,async()=>{
  // View the complete unchanged original screenshot, not an imitation of Bob.
  const image=path.join(root,'bob_sessions/ming_task03_stage_b_final_summary.png');report.bobImage={file:path.relative(root,image),sha256:createHash('sha256').update(fs.readFileSync(image)).digest('hex')};
  await page.goto(pathToFileURL(image).href);await page.locator('img').evaluate(el=>el.decode());
 });
 await scene(9,async()=>{await page.goto(base,{waitUntil:'networkidle'});await page.getByRole('link',{name:/^Start/}).waitFor()});
 assert.equal(report.draftRequests,1);assert.equal(report.errors.length,0);assert.equal(report.blockedRequests.length,0);report.success=true;
 report.runs={baseline:{id:first.currentRun.id,status:first.currentRun.status,planFingerprint:first.currentRun.planFingerprint,projectFingerprint:first.currentRun.projectFingerprint},revision:{id:second.currentRun.id,status:second.currentRun.status,planFingerprint:second.currentRun.planFingerprint,projectFingerprint:second.currentRun.projectFingerprint},samePlan:second.comparison.samePlan,sourceChanged:second.comparison.sourceChanged,originalFailurePreserved:true};
}catch(error){report.error=String(error.stack||error);process.exitCode=1;console.error(report.error);if(page&&!page.isClosed()){await shot('stopped').catch(()=>{});fs.writeFileSync(path.join(work,'stopped-dom.txt'),await page.locator('body').innerText().catch(()=>''))}}
finally{const video=page?.video();await context.close();if(video)report.rawVideo=await video.path();await browser.close();report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(work,'recording.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,preflight,scenes:report.scenes.length,provider:report.provider,report:path.join(work,'recording.json')}))}
