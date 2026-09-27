/** Current deployed workflow smoke. Uses the existing private review credential.
 * No model generation, source repair, account changes, or automatic retries.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const {chromium}=createRequire(path.join(root,'packages/runner/package.json'))('playwright');
const {zipSync}=createRequire(path.join(root,'apps/web/package.json'))('fflate');
const token=process.env.MING_SITE_REVIEW_TOKEN;delete process.env.MING_SITE_REVIEW_TOKEN;
assert.ok(token,'Existing private review access is required.');
const origin='https://ming-acceptance-proof.amosming.chatgpt.site';
const out=path.join(root,'runtime','submission-production-'+new Date().toISOString().replace(/[:.]/g,'-'));
fs.mkdirSync(out,{recursive:true});
const report={startedAt:new Date().toISOString(),origin,checks:[],pageErrors:[],failedRequests:[],responses:[],platformRequests:[],blockedMutations:[],screenshots:[],passed:false};
const check=(name,passed,detail)=>{report.checks.push({name,passed:!!passed,...(detail?{detail}:{})});console.log((passed?'PASS ':'FAIL ')+name);assert.ok(passed,name)};
const bundle=fs.readFileSync(path.join(root,'apps/web/dist/index.html'),'utf8').match(/\/assets\/[^"']+\.js/)[0];
const redact=value=>String(value).split(token).join('[REDACTED]');
const browser=await chromium.launch({headless:true});let page;
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true,reducedMotion:'reduce'});
 await context.route('**/*',route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin===origin){
   if(!['GET','HEAD'].includes(request.method())){
    if(url.pathname.startsWith('/cdn-cgi/challenge-platform/'))report.platformRequests.push({method:request.method(),path:'/cdn-cgi/challenge-platform/…'});
    else{report.blockedMutations.push({method:request.method(),path:url.pathname});return route.abort();}
   }
   return route.continue({headers:{...request.headers(),'OAI-Sites-Authorization':'Bearer '+token}});
  }
  return route.continue();
 });
 page=await context.newPage();page.setDefaultTimeout(20000);
 page.on('pageerror',error=>report.pageErrors.push(redact(error.message)));
 page.on('requestfailed',request=>report.failedRequests.push({url:request.url().split('?')[0],error:request.failure()?.errorText}));
 page.on('response',response=>{if(response.status()>=400)report.responses.push({url:response.url().split('?')[0],status:response.status()})});
 const shot=async name=>{await page.screenshot({path:path.join(out,name+'.png')});report.screenshots.push(name+'.png')};
 const exported=async(name,label)=>{const pending=page.waitForEvent('download');await page.getByRole('button',{name:label,exact:true}).click();const file=path.join(out,name+'.json');await(await pending).saveAs(file);return JSON.parse(fs.readFileSync(file,'utf8'))};
 const response=await page.goto(origin,{waitUntil:'networkidle'});
 check('Production serves the exact final build',(await response.text()).includes(bundle),{bundle});
 await page.getByRole('link',{name:'Start',exact:true}).click();
 check('Start opens the current guided upload workflow',page.url().endsWith('#upload'));
 const html='<!doctype html><html><head><meta charset="utf-8"><title>Release module check</title></head><body><h1 id="ready"></h1><script type="module">export const a="A";document.querySelector("#ready").textContent+=a;</script><script type="module">export const b="B";document.querySelector("#ready").textContent+=b;</script><script type="module">document.querySelector("#ready").textContent+="C";</script></body></html>';
 const started=Date.now();await page.getByLabel('Upload HTML or ZIP',{exact:true}).setInputFiles({name:'module-release.html',mimeType:'text/html',buffer:Buffer.from(html)});
 await page.waitForFunction(()=>document.querySelector('[data-testid="upload-studio"]')?.dataset.previewReady==='true');
 check('A real three-module HTML import initializes without timeout',Date.now()-started<3500&&await page.frameLocator('iframe[sandbox]').locator('h1').innerText()==='ABC',{elapsedMs:Date.now()-started});
 await shot('01-modules-ready');
 await page.getByRole('textbox',{name:'Requirements',exact:true}).fill('The heading is ABC.');
 await page.getByText('Advanced options',{exact:true}).click();await page.getByRole('button',{name:'Write checks myself',exact:true}).click();
 await page.getByTestId('upload-step').first().getByLabel('CSS selector',{exact:true}).fill('h1');
 await page.getByTestId('upload-step').first().getByLabel('Expected text',{exact:true}).fill('ABC');
 await page.getByTestId('plan-technical-editor').locator('summary').click();await page.getByRole('button',{name:'Approve and check',exact:true}).click();
 await page.waitForFunction(()=>{const n=document.querySelector('[data-testid="upload-studio"]');return n?.dataset.workflowStage==='results'&&n.dataset.phase==='idle'});
 const moduleRun=await exported('module-report','Download report');
 check('The deployed runner checks module output and exports real evidence',moduleRun.currentRun.status==='passed'&&moduleRun.currentRun.steps[0].capture?.startsWith('data:image/png;base64,'));
 await page.evaluate(()=>scrollTo(0,0));await shot('02-modules-passed');
 await page.goto(origin+'/#upload',{waitUntil:'networkidle'});await page.reload({waitUntil:'networkidle'});
 const zip=zipSync({'index.html':Buffer.from('<!doctype html><h1 id="ready"></h1><script type="module" src="./main.js"></script>'),'main.js':Buffer.from('import label from "./label.js";document.querySelector("#ready").textContent=label;'),'label.js':Buffer.from('export default "ZIP dependency ready";')});
 await page.getByLabel('Upload HTML or ZIP',{exact:true}).setInputFiles({name:'module-release.zip',mimeType:'application/zip',buffer:Buffer.from(zip)});
 await page.waitForFunction(()=>document.querySelector('[data-testid="upload-studio"]')?.dataset.previewReady==='true');
 check('A real static ZIP resolves its local module dependency',await page.frameLocator('iframe[sandbox]').locator('h1').innerText()==='ZIP dependency ready');await shot('03-zip-ready');
 await page.getByRole('link',{name:'Try a sample',exact:true}).click();
 await page.locator('#trial-task-name').fill('Final guided review');await page.getByRole('button',{name:'Run live checks',exact:true}).click();
 await page.getByText('2 passed · 1 failed',{exact:true}).waitFor({timeout:30000});
 const before=await exported('guided-before','Export evidence report');
 check('Guided sample produces its real expected failure',before.currentRun.criteria.map(x=>x.status).join(',')==='passed,failed,passed');
 await shot('04-guided-failure');await page.getByRole('button',{name:'Apply prepared fix & rerun',exact:true}).click();
 await page.getByText('3 passed · 0 failed',{exact:true}).waitFor({timeout:30000});const after=await exported('guided-after','Export evidence report');
 check('Guided prepared fix passes the same plan',after.comparison.samePlan&&after.comparison.allRerunCriteriaPassed);assert.deepEqual(after.baseline,before.currentRun);
 await page.locator('.trial-comparison').scrollIntoViewIfNeeded();await shot('05-guided-comparison');
  await page.getByRole('link',{name:'Evidence Studio',exact:true}).click();await page.getByRole('region',{name:'Recorded acceptance timeline'}).waitFor();
  check('Recorded evidence remains accessible and labelled',page.url().endsWith('#studio')&&(await page.locator('body').innerText()).includes('Recorded'));
  await page.waitForFunction(()=>{const images=[...document.querySelectorAll('img')];return images.length>0&&images.every(image=>image.complete&&image.naturalWidth>0)});
 await page.evaluate(()=>scrollTo(0,0));await shot('06-evidence-studio');
 check('No application JavaScript exception or model request occurred',report.pageErrors.length===0&&report.blockedMutations.length===0);
 report.passed=true;
}catch(error){report.error=redact(error.stack||error);process.exitCode=1;if(page){await page.screenshot({path:path.join(out,'stopped-state.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'stopped-dom.txt'),redact(await page.locator('body').innerText().catch(()=>'')));}}
finally{await browser.close();report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'report.json'),redact(JSON.stringify(report,null,2)));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,report:path.join(out,'report.json')}));}
