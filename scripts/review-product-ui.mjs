/** Browser proof of Ming's own-project workflow. All services are local and isolated.
 * No Bob usage, no model calls, no modification of existing samples or user projects.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(root, 'packages/runner/package.json'))('playwright');
const port = 4450, targetPort = 4451, base = `http://127.0.0.1:${port}`;
const targetUrl = `http://127.0.0.1:${targetPort}`;
const id = randomUUID(), runtime = path.join(root, 'runtime', `product-ui-${id}`);
const shots = path.join(runtime, 'screenshots'); fs.mkdirSync(shots, { recursive: true });
const report = { reviewId: id, startedAt: new Date().toISOString(), checks: [], ids: {}, pageErrors: [], screenshots: [] };
const delay = ms => new Promise(r => setTimeout(r, ms));
const rows = []; let broken = false, slow = false, postCount = 0, child, browser, page;
const appHtml = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>Clear Tasks · 工作清单</title><link rel="stylesheet" href="/style.css"></head><body><main><small>CLEAR TASKS</small><h1>留出空间，专心做事。</h1><p>把今天重要的事放在这里。</p><form><label for="task">任务名称</label><div><input id="task" placeholder="接下来要完成什么？"><button>添加任务</button></div></form><p id="notice" aria-live="polite"></p><ul id="tasks"></ul></main><script src="/app.js"></script></body></html>`;
const appJs = `const list=document.querySelector('#tasks');const render=rows=>{list.replaceChildren(...rows.map(text=>{const li=document.createElement('li');li.textContent=text;return li}))};fetch('/api/tasks').then(r=>r.json()).then(render);document.querySelector('form').onsubmit=async e=>{e.preventDefault();const input=document.querySelector('#task');if(!input.value.trim())return;const response=await fetch('/api/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:input.value})});render(await response.json());input.value='';document.querySelector('#notice').textContent='任务已保存'};`;
const target = http.createServer(async (req, res) => {
  if (slow && req.url === '/') await delay(12000);
  if (req.url === '/style.css') { res.setHeader('Content-Type','text/css'); res.end('body{font-family:system-ui,sans-serif;background:#f3f4f8;color:#27304b;margin:0}main{margin:90px auto;max-width:690px;padding:38px;background:white;border:1px solid #e4e6ef;border-radius:18px}small{color:#6553d9;letter-spacing:3px}h1{font-size:32px;margin-bottom:10px}p{color:#748097}label{display:block;margin:36px 0 10px;font-weight:600}form div{display:flex;gap:10px}input{padding:13px;flex:1;border:1px solid #dcdfea;border-radius:8px;font-size:16px}button{background:#6553d9;color:white;border:0;border-radius:8px;padding:12px 20px;font-size:15px}ul{list-style:none;padding:0}li{padding:15px 0;border-top:1px solid #e4e6ef}'); return; }
  if (req.url === '/app.js') { res.setHeader('Content-Type','text/javascript'); res.end(appJs); return; }
  if (req.url === '/api/tasks') {
    res.setHeader('Content-Type','application/json');
    if (req.method === 'POST') { let body='';for await (const chunk of req) body+=chunk;rows.push(JSON.parse(body).text);postCount++;res.end(JSON.stringify(rows)); }
    else res.end(JSON.stringify(broken ? [] : rows));
    return;
  }
  res.setHeader('Content-Type','text/html; charset=utf-8'); res.end(appHtml);
});
function check(label, condition) { report.checks.push({label,passed:Boolean(condition)}); console.log(`${condition?'PASS':'FAIL'} ${label}`);if(!condition)throw Error(label); }
async function api(route, body, method='GET') { const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});const data=await response.json();if(!response.ok)throw Error(`${response.status} ${route}: ${JSON.stringify(data)}`);return data; }
async function postClick(route, button) { const pending=page.waitForResponse(r=>r.url()===base+route&&r.request().method()==='POST');await button.click();const response=await pending;return {status:response.status(),data:await response.json()}; }
async function waitRun(runId) { for(let i=0;i<240;i++){const {progress}=await api(`/api/run/${runId}/progress`);if(['passed','failed','error'].includes(progress.status))return(await api(`/api/run/${runId}`)).run;await delay(150);}throw Error('Run timeout '+runId); }
async function displayed(run) { await page.locator('.evidence-footer code').filter({hasText:run.runId.slice(0,10)}).waitFor({timeout:20000}); }
async function shot(name) { const file=path.join(shots,name+'.png');await page.screenshot({path:file,fullPage:true});report.screenshots.push(file); }
async function overflow() { return page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1); }
async function fillStep(index,type,fields={}) { const step=page.locator('.editable-step').nth(index);await step.getByLabel('操作类型',{exact:true}).selectOption(type);for(const [label,value] of Object.entries(fields))await step.getByLabel(label,{exact:true}).fill(value); }
async function addStep(type,fields={}) { await page.getByRole('button',{name:'添加步骤',exact:true}).click();await fillStep((await page.locator('.editable-step').count())-1,type,fields); }
async function closeSheet() { await page.getByRole('button',{name:'关闭面板',exact:true}).click(); }
try {
  let occupied=false;try{await fetch(base+'/api/capabilities',{signal:AbortSignal.timeout(400)});occupied=true;}catch{}if(occupied)throw Error('Port4450 occupied; refusing to attach');
  await new Promise((resolve,reject)=>{target.once('error',reject);target.listen(targetPort,'127.0.0.1',resolve)});
  const log=fs.openSync(path.join(runtime,'server.log'),'w');
  child=spawn(process.execPath,['apps/server/dist/index.js'],{cwd:root,windowsHide:true,env:{...process.env,PORT:String(port),HOST:'127.0.0.1',MING_RUNTIME_DIR:runtime,MING_TEST_MODE:'1',MING_PUBLIC_DEMO:'0',PROVIDER_API_KEY:'',PROVIDER_BASE_URL:'',PROVIDER_MODEL_ID:''},stdio:['ignore',log,log]});fs.closeSync(log);
  for(let i=0;i<80;i++){try{await api('/api/capabilities');break;}catch{await delay(100)}}
  browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1484,height:1060}});page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>report.pageErrors.push(String(e)));
  await page.goto(base,{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:'把你的项目，交给真实验收。'}).waitFor();check('New user enters project hub rather than an unexplained fixture',true);await shot('01-project-hub');
  await page.getByRole('button',{name:'模型未配置',exact:true}).click();
  check('Settings opens without exposing a saved key',await page.locator('input[type="password"]').inputValue()==='');
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'接入项目',exact:true}).first().click();
  await page.getByLabel('项目名称',{exact:true}).fill('Clear Tasks · 我的真实项目');
  await page.getByLabel('测试页面地址',{exact:true}).fill(base);
  await page.getByRole('button',{name:'接入项目并编写需求',exact:true}).click();
  await page.getByRole('alert').waitFor();check('Ming itself is rejected as an acceptance target',await page.getByRole('dialog').isVisible());
  await page.getByLabel('测试页面地址',{exact:true}).fill(targetUrl);
  const connected=await postClick('/api/targets',page.getByRole('button',{name:'接入项目并编写需求',exact:true}));
  check('User registers their own running multi-file application',connected.status===200&&connected.data.target.kind==='url');
  const {target:registered,project}=connected.data;report.ids.projectId=project.projectId;report.ids.variant=registered.variant;
  await page.getByRole('dialog',{name:'编写项目需求'}).waitFor();
  const prd='用户输入任务名称后点击添加任务，列表显示新任务。刷新页面后，同一个任务仍然存在。空白任务不能被添加。';
  await page.locator('input[type="file"]').setInputFiles({name:'acceptance.md',mimeType:'text/markdown',buffer:Buffer.from(prd)});
  check('PRD upload reads the actual Markdown contents',await page.getByLabel('需求与验收边界',{exact:true}).inputValue()===prd);
  const saved=await postClick(`/api/projects/${project.projectId}/requirements`,page.getByRole('button',{name:'保存需求',exact:true}));
  check('Project requirement is persisted with a version',saved.data.requirement.version===1);report.ids.requirementId=saved.data.requirement.requirementId;
  const generated=await postClick('/api/generate',page.getByRole('button',{name:'AI 生成验收草稿',exact:true}));
  check('Unconfigured AI generation returns a real error rather than fabricated plan',generated.status===503&&!generated.data.draft);
  await page.getByRole('button',{name:/自己编写验收标准/}).click();
  await page.getByRole('dialog',{name:'编写验收标准',exact:true}).waitFor();
  await page.getByLabel('条件名称',{exact:true}).fill('添加任务后立即显示');
  await page.getByLabel('预期行为',{exact:true}).fill('输入新任务并提交后，列表显示本次唯一任务。');
  await page.getByLabel('对应的需求原文',{exact:true}).fill('列表显示新任务');
  await fillStep(1,'fill',{'控件或区域':'任务名称','输入内容':'{{UNIQUE_CONTENT}}'});
  await addStep('click',{'控件或区域':'添加任务'});
  await addStep('assertVisible',{'预期内容':'{{UNIQUE_CONTENT}}'});
  await page.getByRole('button',{name:'添加验收条件',exact:true}).click();
  await page.getByLabel('条件名称',{exact:true}).fill('刷新后任务仍然存在');
  await page.getByLabel('预期行为',{exact:true}).fill('刷新页面后，本次添加的任务仍存在。');
  await page.getByLabel('对应的需求原文',{exact:true}).fill('刷新页面后，同一个任务仍然存在');
  await page.getByLabel('页面上下文',{exact:true}).selectOption('inherit');
  await fillStep(0,'reload');await fillStep(1,'assertVisible',{'预期内容':'{{UNIQUE_CONTENT}}'});
  await shot('02-manual-plan-editor');
  const saveBounds=await page.getByRole('button',{name:'保存验收草稿',exact:true}).boundingBox();
  check('Plan save action remains fully visible while editing long plans',saveBounds&&saveBounds.y+saveBounds.height<1060);
  const drafted=await postClick('/api/drafts/manual',page.getByRole('button',{name:'保存验收草稿',exact:true}));
  check('Visual editor persists two real criteria without a model call',drafted.status===200&&drafted.data.draft.plan.source==='manual'&&drafted.data.draft.plan.criteria.length===2);
  report.ids.draftId=drafted.data.draft.draftId;
  check('Execution waits for explicit standard confirmation',await page.getByRole('button',{name:'开始验收',exact:true}).isDisabled());
  check('Manual origin is visible in the workspace',await page.getByText('手动编写 · 无模型调用',{exact:true}).isVisible());
  const confirmation=await postClick('/api/confirm',page.getByRole('button',{name:'确认验收标准',exact:true}));report.ids.confirmationId=confirmation.data.confirmation.confirmationId;
  const started=await postClick('/api/run-confirmed',page.getByRole('button',{name:'开始验收',exact:true}));const good=await waitRun(started.data.runId);await displayed(good);report.ids.passedRunId=good.runId;
  check('Real custom project passes add and refresh operations',good.status==='passed'&&good.criteria.every(c=>c.status==='passed'));
  check('Live URL evidence accurately declares observation, not frozen application source',good.sourceBinding==='live-url-observed');
  check('Mutation reached the application exactly once',postCount===1);
  await page.waitForFunction(()=>[...document.querySelectorAll('.evidence-column img')].length>0&&[...document.querySelectorAll('.evidence-column img')].every(i=>i.complete&&i.naturalWidth>0));
  check('Displayed screenshots belong to this actual run',await page.locator('.evidence-column img').evaluateAll((imgs,id)=>imgs.every(i=>i.src.includes(id)),good.runId));
  await shot('03-live-project-passed');check('Desktop workspace has no horizontal overflow',await overflow());
  await page.reload({waitUntil:'networkidle'});await displayed(good);
  check('Reload restores project, confirmed standards and real evidence',await page.getByLabel('验收项目',{exact:true}).inputValue()===registered.variant);
  await page.getByRole('button',{name:'需求与标准',exact:true}).click();check('Saved PRD survives reload',await page.getByLabel('需求与验收边界',{exact:true}).inputValue()===prd);await closeSheet();
  await page.getByRole('button',{name:'我的项目',exact:true}).click();await page.locator('.project-card').getByRole('button',{name:/检查连接/}).click();await page.getByText(/页面可访问/).waitFor();check('Project hub probes the real application',true);
  await page.locator('.project-card').getByRole('button',{name:/打开项目/}).click();
  await page.getByText('标准已确认，修复后沿用同一版本',{exact:true}).waitFor();
  check('Opening a project restores its saved active confirmation',await page.getByRole('button',{name:'开始验收',exact:true}).isEnabled());
  await page.getByRole('button',{name:'编辑标准',exact:true}).click();
  await page.getByLabel('验收计划名称',{exact:true}).fill('Clear Tasks · 用户确认的刷新验收');
  const revised=await postClick(`/api/drafts/${drafted.data.draft.draftId}/revise`,page.getByRole('button',{name:'保存为新版本',exact:true}));
  check('Editing saves a new immutable draft and requires confirmation',revised.data.draft.draftId!==drafted.data.draft.draftId&&await page.getByRole('button',{name:'开始验收',exact:true}).isDisabled());
  const old=await api(`/api/confirmations/${confirmation.data.confirmation.confirmationId}`);check('Previous confirmation is invalidated for new execution',old.confirmation.active===false);
  await postClick('/api/confirm',page.getByRole('button',{name:'确认验收标准',exact:true}));
  broken=true;
  const failedLaunch=await postClick('/api/run-confirmed',page.getByRole('button',{name:'开始验收',exact:true}));const failed=await waitRun(failedLaunch.data.runId);await displayed(failed);report.ids.failedRunId=failed.runId;
  check('Real persistence defect fails only the refresh criterion',failed.status==='failed'&&failed.criteria[0].status==='passed'&&failed.criteria[1].status==='failed');
  await shot('04-live-project-failed');
  const repair=await postClick('/api/repair-tasks',page.getByRole('button',{name:'创建 AI 修复任务',exact:true}));
  check('Repair handoff is queued and never claims an agent has started',repair.data.task.status==='waiting');report.ids.repairTaskId=repair.data.task.taskId;
  await closeSheet();
  await page.getByRole('button',{name:'验收记录',exact:true}).click();await page.getByLabel('搜索验收记录').fill('Clear Tasks');await page.getByLabel('按结果筛选').selectOption('failed');
  check('History supports project search and status filtering',await page.locator('.history-item').count()===1);
  await page.getByLabel('按结果筛选').selectOption('passed');await page.locator('.history-item').click();await displayed(good);
  check('Historical original evidence remains accessible after revision',await page.getByText(/这份历史标准已被新版本替代/).isVisible());
  check('Inactive historical confirmation cannot launch an unseen standard',await page.getByRole('button',{name:'再次验收',exact:true}).isDisabled());
  await page.getByRole('button',{name:'审查当前版本',exact:true}).click();
  slow=true;
  const cancelLaunch=await postClick('/api/run-confirmed',page.getByRole('button',{name:'开始验收',exact:true}));
  await page.reload({waitUntil:'networkidle'});
  await page.getByRole('button',{name:'停止本次检查',exact:true}).waitFor({timeout:6000});
  check('Reload during an active run restores progress and cancellation',await page.getByRole('button',{name:'正在检查',exact:true}).isDisabled());
  await page.getByRole('button',{name:'停止本次检查',exact:true}).click();const cancelled=await waitRun(cancelLaunch.data.runId);await displayed(cancelled);report.ids.cancelledRunId=cancelled.runId;
  check('Cancellation records an incomplete execution, never a pass',cancelled.status==='error'&&cancelled.terminationReason==='cancelled');slow=false;
  await page.getByRole('button',{name:'验收记录',exact:true}).click();await page.getByLabel('按结果筛选').selectOption('failed');await page.locator('.history-item').click();await displayed(failed);
  await page.setViewportSize({width:390,height:844});await shot('05-live-project-mobile');check('390px workspace has no horizontal overflow',await overflow());
  await page.getByRole('button',{name:'我的项目',exact:true}).click();await shot('06-project-hub-mobile');check('390px project hub has no horizontal overflow',await overflow());
  check('No uncaught browser errors across the full workflow',report.pageErrors.length===0);
  report.passed=true;
} catch(error) {
  report.passed=false;report.error=String(error.stack||error);console.error(report.error);try{await shot('failure')}catch{}process.exitCode=1;
} finally {
  report.finishedAt=new Date().toISOString();report.postCount=postCount;
  fs.writeFileSync(path.join(runtime,'report.json'),JSON.stringify(report,null,2));
  fs.writeFileSync(path.join(root,'runtime','product-ui-latest.json'),JSON.stringify({runtime,report:path.join(runtime,'report.json')},null,2));
  await browser?.close();child?.kill();target.closeAllConnections();await new Promise(r=>target.close(r));
  console.log('REPORT '+path.join(runtime,'report.json'));
}
