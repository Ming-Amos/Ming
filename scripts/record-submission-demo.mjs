/** Record the real Ming UI; no source edits, model calls or synthetic result states. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const work = path.join(root, 'runtime/submission-video'); fs.mkdirSync(work, { recursive: true });
const story = [
  { start: 0, end: 15, title: 'The work left after AI says done', text: 'The AI says done. But I still open the app, click through each requirement, capture failures, and explain them back. After every edit, I repeat the work. Ming keeps acceptance checks and their evidence together.' },
  { start: 15, end: 32, title: 'Live UI: review and confirm the acceptance plan', text: 'The requirement here is simple: submitted reports must survive a refresh. I review the conditions and their dependencies before confirming. This demonstration uses a clearly labeled, hand authored plan. Browser execution is real.' },
  { start: 32, end: 48, title: 'Live browser run: deliberately seeded persistence bug', text: 'This sample contains a deliberately seeded bug. I start acceptance, and Ming operates a real browser. Submission works, but persistence fails: the report disappears after refresh. The other two checks still pass.' },
  { start: 48, end: 64, title: 'Real evidence: expected result, observed failure, original screenshot', text: 'The interface connects the requirement to the actual steps, expected result, and observed failure. I can inspect the screenshot and the failed assertion. Each run retains its own evidence, so a later result cannot replace it.' },
  { start: 64, end: 80, title: 'Live handoff: creating a task does not wake the agent', text: 'I create a repair task from this failure. It is waiting for an agent, not already repaired. The English handoff contains the task, baseline and unchanged plan. A connected coding agent retrieves the evidence through Ming MCP.' },
  { start: 80, end: 96, title: 'Recorded repair review: an earlier real Codex MCP session', text: 'Now I open a repair recorded earlier, using the same logical target before and after. Codex retrieved this evidence through the real MCP tools, claimed the task, and changed the application source. This is a review of that saved repair.' },
  { start: 96, end: 112, title: 'Recorded comparison: same plan and runner, changed source', text: 'The comparison checks that the plan and runner match, while the source fingerprint changes. The original persistence failure now passes. All three criteria pass, and the original failed run remains available beside the new result.' },
  { start: 112, end: 126, title: 'Original evidence remains inspectable', text: 'These are the original before and after browser images. I can open the repaired run and inspect each criterion. Ming verifies this repair against the registered scope. It does not claim that every possible behavior is correct.' },
  { start: 126, end: 141, title: 'Live second project: create, complete and persist a task', text: 'A separate task manager uses different markup and its own acceptance plan. The same runner checks task creation, completion, and persistence after refresh. This second project demonstrates reuse beyond the daily report sample.' },
  { start: 141, end: 150, title: 'Model configuration: no live model invocation in this demo', text: 'The model provider is configurable. No live model call or API charge is used in this demonstration.' },
  { start: 150, end: 164, title: 'Authentic Bob task summary and contribution', text: 'Bob implemented the core runner, evidence history, model adapter and repair foundations. Codex completed the interface and integrity checks, and performed the recorded repair. The original Bob task summaries are included in the repository.' },
];
fs.writeFileSync(path.join(work, 'story.json'), JSON.stringify(story, null, 2));
if (process.argv.includes('--prepare')) { console.log('Prepared story.json'); process.exit(0); }
const { chromium } = createRequire(path.join(root, 'packages/runner/package.json'))('playwright');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/demo-evidence/manifest.json'), 'utf8'));
const metadata = { startedAt: new Date().toISOString(), durationTarget: 164, liveUiSeconds: 150,
  phases: [{ start: 0, end: 80, kind: 'live-ui' }, { start: 80, end: 126, kind: 'interactive-review-of-earlier-real-repair' }, { start: 126, end: 150, kind: 'live-ui' }, { start: 150, end: 164, kind: 'original-bob-summary-still' }],
  earlierRepair: { baseline: manifest.featuredBaselineRunId, rerun: manifest.featuredRerunId, taskId: manifest.taskId, actor: manifest.actor }, actions: [], pageErrors: [] };
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 810 }, deviceScaleFactor: 1, recordVideo: { dir: path.join(work, 'raw'), size: { width: 1600, height: 810 } } });
const recordCreated = Date.now(); const page = await context.newPage(); page.setDefaultTimeout(15000);
page.on('pageerror', e => metadata.pageErrors.push(String(e)));
let start;
async function at(seconds, name, action) {
  while (Date.now() < start + seconds * 1000) await page.waitForTimeout(Math.min(1000, start + seconds * 1000 - Date.now()));
  console.log(`${seconds}s ${name}`); metadata.actions.push({ scheduled: seconds, actual: (Date.now()-start)/1000, name }); await action();
}
async function click(locator) { await locator.scrollIntoViewIfNeeded(); const box=await locator.boundingBox(); if(box)await page.mouse.move(box.x+box.width/2,box.y+box.height/2,{steps:10}); await locator.click(); }
async function top() { await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' })); }
async function api(route) { const res=await fetch('http://127.0.0.1:4001'+route); const data=await res.json(); if(!res.ok||!data.ok)throw Error(JSON.stringify(data)); return data; }
try {
  await page.goto('http://127.0.0.1:4000', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { level: 1, name: /看见功能背后的每一步/ }).waitFor();
  start=Date.now(); metadata.trimStartSeconds=(start-recordCreated)/1000;
  await at(7,'Show first acceptance condition',()=>click(page.locator('.criterion-button').filter({hasText:'AC-01'})));
  await at(15,'Review persistence criterion',()=>click(page.locator('.criterion-button').filter({hasText:'AC-02'})));
  await at(23,'Review blank-input boundary',()=>click(page.locator('.criterion-button').filter({hasText:'AC-03'})));
  await at(28,'Return to persistence requirement',async()=>{await click(page.locator('.criterion-button').filter({hasText:'AC-02'}));await top();});
  await at(32,'Explicitly confirm plan',()=>click(page.getByRole('button',{name:'确认验收标准',exact:true})));
  await at(35,'Execute real buggy acceptance',async()=>{
    const pending=page.waitForResponse(r=>r.url().endsWith('/api/run')&&r.request().method()==='POST');
    await click(page.getByRole('button',{name:'开始验收',exact:true})); metadata.newBuggyRunId=(await(await pending).json()).runId;
    await page.locator('.evidence-footer code').filter({hasText:metadata.newBuggyRunId.slice(0,10)}).waitFor();
    const {run}=await api('/api/run/'+metadata.newBuggyRunId); if(run.status!=='failed'||run.criteria[1]?.status!=='failed')throw Error('Unexpected demo outcome');
    await top();
  });
  await at(45,'Inspect original failure',async()=>{await page.locator('.observation-panel').scrollIntoViewIfNeeded();});
  await at(49,'Expand actual assertion',()=>click(page.locator('.error-detail summary')));
  await at(54,'Close assertion detail',()=>click(page.locator('.error-detail summary')));
  await at(56,'Magnify original failed screenshot',()=>click(page.getByRole('button',{name:'放大证据',exact:true}).last()));
  await at(61,'Fit screenshot and inspect task handoff',()=>click(page.getByRole('button',{name:'适应宽度',exact:true}).last()));
  await at(65,'Create real waiting repair task',async()=>{
    const pending=page.waitForResponse(r=>r.url().endsWith('/api/repair-tasks')&&r.request().method()==='POST');
    await click(page.getByRole('button',{name:'创建 AI 修复任务',exact:true})); const data=await(await pending).json(); metadata.newWaitingTaskId=data.task.taskId;
    if(data.task.status!=='waiting')throw Error('New task is not waiting');
    await page.getByLabel('AI 修复交接指令').waitFor();
  });
  await at(73,'Inspect English handoff text',async()=>{await click(page.getByLabel('AI 修复交接指令'));await page.getByLabel('AI 修复交接指令').press('Control+Home');});
  await at(79,'Close waiting handoff',()=>click(page.getByRole('button',{name:'关闭面板',exact:true})));
  await at(81,'Open earlier recorded repair history',async()=>{
    await top(); await click(page.getByRole('button',{name:'验收记录',exact:true}));
    await click(page.locator('dialog .history-item').filter({hasText:manifest.featuredBaselineRunId.slice(0,10)}));
    await page.getByRole('button',{name:'查看修复前后对照',exact:true}).waitFor();
  });
  await at(88,'Open verified earlier repair comparison',()=>click(page.getByRole('button',{name:'查看修复前后对照',exact:true})));
  await at(98,'Read same-standard checks and source versions',async()=>{await page.locator('dialog .compare-versions').scrollIntoViewIfNeeded();});
  await at(105,'Inspect original before-after evidence',async()=>{await page.locator('dialog .compare-evidence').scrollIntoViewIfNeeded();});
  await at(113,'Magnify repaired screenshot',()=>click(page.locator('dialog').getByRole('button',{name:'放大证据',exact:true}).last()));
  await at(119,'Open full saved repaired run',async()=>{await click(page.getByRole('button',{name:'查看修改后的完整运行与截图',exact:true}));await click(page.locator('.criterion-button').filter({hasText:'AC-02'}));await top();});
  await at(127,'Switch to independent task-manager sample',async()=>{await page.getByLabel('验收项目',{exact:true}).selectOption('todo-normal');await page.locator('.criterion-button').filter({hasText:'TODO-03'}).waitFor();await click(page.locator('.criterion-button').filter({hasText:'TODO-03'}));});
  await at(130,'Confirm and run task-manager acceptance',async()=>{
    await click(page.getByRole('button',{name:'确认验收标准',exact:true}));
    const pending=page.waitForResponse(r=>r.url().endsWith('/api/run')&&r.request().method()==='POST');
    await click(page.getByRole('button',{name:'开始验收',exact:true}));metadata.newTodoRunId=(await(await pending).json()).runId;
    await page.locator('.evidence-footer code').filter({hasText:metadata.newTodoRunId.slice(0,10)}).waitFor();
    const {run}=await api('/api/run/'+metadata.newTodoRunId);if(run.status!=='passed')throw Error('Todo demo did not pass');
    await click(page.locator('.criterion-button').filter({hasText:'TODO-03'}));await top();
  });
  await at(142,'Show honest model configuration status',async()=>{await click(page.getByRole('button',{name:'模型未配置',exact:true}));});
  await at(150,'Show genuine full Bob task-summary image',async()=>{await page.goto(pathToFileURL(path.join(root,'bob_sessions/ming_task03_stage_b_final_summary.png')).href);});
  await at(164,'End recording',async()=>{});
  metadata.success=true;
} catch(error) { metadata.success=false;metadata.error=String(error);console.error(error);process.exitCode=1; }
finally {
  const video=page.video();await context.close();metadata.rawVideo=await video.path();await browser.close();metadata.finishedAt=new Date().toISOString();
  fs.writeFileSync(path.join(work,'recording.json'),JSON.stringify(metadata,null,2));console.log(JSON.stringify({success:metadata.success,rawVideo:metadata.rawVideo,trimStartSeconds:metadata.trimStartSeconds}));
}
