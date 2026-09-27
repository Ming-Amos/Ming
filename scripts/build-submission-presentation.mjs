/** Create the editable English submission deck from existing, unaltered project evidence.
 * Uses the installed Codex artifact runtime. Set RUNTIME_NODE_MODULES and PRESENTATION_SKILL_DIR.
 * Private build/validation products stay under runtime/submission-deck-20260927.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const skill = process.env.PRESENTATION_SKILL_DIR;
const modules = process.env.RUNTIME_NODE_MODULES;
if (!skill || !modules) throw new Error('Set PRESENTATION_SKILL_DIR and RUNTIME_NODE_MODULES to the installed presentation runtime.');
const requireRuntime = createRequire(path.join(modules, '__deck__.cjs'));
const { Presentation, PresentationFile } = await import(pathToFileURL(requireRuntime.resolve('@oai/artifact-tool')).href);
const tmp = path.join(root, 'runtime/submission-deck-20260927');
await fs.mkdir(path.join(tmp, 'renders'), { recursive: true });
const p = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const C = { bg:'#080b16', text:'#edf1fb', muted:'#a7b5d1', blue:'#94b8ff', violet:'#c0a6ff', green:'#78e3b7', red:'#ffabb2' };
const FONT = 'Arial';
let serial = 0;
function text(slide, value, x, y, w, h, size=28, color=C.text, bold=false, font=FONT) {
  const box = slide.shapes.add({geometry:'textbox', name:'text-'+(++serial), position:{left:x,top:y,width:w,height:h}, fill:'none', line:{fill:'none',width:0}});
  box.text = value;
  box.text.style = {typeface:font, fontSize:size, color, bold, autoFit:'none', verticalAlignment:'top', alignment:'left', insets:{top:0,right:0,bottom:0,left:0}};
  return box;
}
async function image(slide, relative, x, y, w, h, fit='contain') {
  slide.images.add({blob:new Uint8Array(await fs.readFile(path.join(root,relative))), contentType:'image/png', alt:relative, fit, position:{left:x,top:y,width:w,height:h}});
}
function page(title, n, notes) {
  const s=p.slides.add(); s.background.fill=C.bg;
  text(s,title,64,44,1152,66,44,C.text,true);
  text(s,'Ming',64,669,400,24,18,C.muted,false,'Georgia');
  text(s,String(n).padStart(2,'0')+' / 08',1130,670,86,24,16,C.muted);
  s.speakerNotes.textFrame.setText(notes);
  return s;
}
const repo='https://github.com/Ming-Amos/Ming';
const app='https://ming-acceptance-proof.amosming.chatgpt.site';
const qa='docs/evidence/simple-workflow/2026-09-27T04-03-10-108Z-after-4187825e';
const proof='docs/evidence/shipboard-doubao/2026-09-26T17-49-25-055Z-0db01f40';

// 1: The existing welcome artwork supplies the atmosphere; title text remains editable.
{
 const s=p.slides.add();s.background.fill=C.bg;
 await image(s,'apps/web/public/welcome/inspection-room.png',0,0,1280,720,'cover');
 text(s,'Ming',64,108,670,130,110,C.text,false,'Georgia');
 text(s,'Every “done” comes with proof',70,260,700,66,38,C.text,true);
 text(s,'Automatic acceptance for\nfeatures built with AI',72,362,635,112,34,C.blue);
 text(s,'IBM Bob 2.0 Hackathon',74,633,650,34,23,C.muted);
 s.speakerNotes.textFrame.setText('Ming helps developers check the features that coding AI says are complete. The welcome illustration is concept artwork, not execution evidence. Source artwork: apps/web/public/welcome/inspection-room.png; provenance: docs/WELCOME_ART_ASSETS.md. Product sources: README.md and docs/UPLOADED_PROJECTS.md.');
}
// 2: A flat typography composition states the concrete repeated work.
{
 const s=page('The work left after “done”',2,'Problem supplied by the project owner: after AI announces completion, the developer manually opens the page, clicks through requirements, captures failures, explains them to AI, and repeats after each edit. No measured percentage or time saving is claimed. Source: docs/submission/problem-solution.md.');
 text(s,'AI says the feature\nis finished.',64,172,560,170,51,C.text,true);
 text(s,'The developer still has\na second job: checking it.',66,392,525,116,31,C.blue);
 const rows=[['01','Open the app and repeat the steps'],['02','Find the failure and capture it'],['03','Explain the problem to the AI'],['04','Check everything again after the edit']];
 rows.forEach(([n,v],i)=>{text(s,n,682,176+i*104,64,42,25,C.violet,true);text(s,v,752,176+i*104,452,72,28,C.text);});
}
// 3: Current product screenshot, kept whole, with a readable native explanation.
{
 const s=page('A checklist you approve once per run',3,'Current Add app / Describe / Review / Results workflow. Screenshot: '+qa+'/03-draft-review-desktop.png, latest redesigned interface. Its planner response was a local test fixture; it illustrates the UI, not live generation proof. The separate actual provider evidence is on slide 4. Supported HTML/static ZIP/public static GitHub folders; human reviews draft before explicit approval and execution. Source: docs/SIMPLE_WORKFLOW_REVIEW.md and docs/DOUBAO_PLANNING.md.');
 const blocks=[['Add app','Open your HTML, static ZIP\nor public GitHub website.'],['Describe','Say what should work.\nAsk AI for a checklist.'],['Review','Read the actions and outcomes.\nChoose Approve and check.'],['Results','See the observed failure\nand its recorded evidence.']];
 blocks.forEach(([h,b],i)=>{text(s,h,64,155+i*117,360,37,29,C.blue,true);text(s,b,64,197+i*117,357,65,23,C.text);});
 await image(s,qa+'/03-draft-review-desktop.png',458,142,758,502);
}
// 4: Genuine DOM captures are unaltered and their source/result relationship is explicit.
{
 const s=page('A real failure, then a passing revision',4,'Source: '+proof+'/production-report.json, buggy-evidence.json and corrected-evidence.json. One actual Doubao Seed 2.0 Pro call proposed nine steps covering blank-name validation, task creation and persistence. The browser executed the buggy upload and failed after reload. A prepared corrected source then passed all nine unchanged steps. These images are original DOM-rendered captures, not native screenshots. This hosted case uses a prepared correction and does not demonstrate autonomous AI repair. The separate local Codex MCP repair is documented in docs/judge-evidence/manifest.json.');
 text(s,'After reload: task lost',64,134,455,38,26,C.red,true);
 text(s,'After correction: task remains',485,134,460,38,26,C.green,true);
 await image(s,proof+'/buggy-evidence-step-9.png',64,185,367,409);
 await image(s,proof+'/corrected-evidence-step-9.png',485,185,367,409);
 text(s,'9',919,180,295,125,104,C.blue,true);
 text(s,'unchanged steps',922,303,282,42,29,C.text,true);
 text(s,'One real AI draft.\nTwo source versions.\nOriginal failure preserved.',922,378,292,152,25,C.text);
 text(s,'Actual DOM captures. The corrected sample was prepared in advance.',64,614,1120,37,22,C.muted);
}
// 5: Explain exactly how observed evidence reaches a coding agent.
{
 const s=page('Evidence your coding AI can act on',5,'Sources: docs/UPLOADED_PROJECTS.md, docs/GITHUB_IMPORT.md, '+proof+'/repair-brief.txt, apps/web/src/upload/runtime.ts, README.md section Connect a coding agent, docs/judge-evidence/manifest.json. The hosted path copies a brief for the user to paste into their coding AI; it does not wake an editor or modify a repository. The local 12-tool MCP adapter supports authorized coding agents reading evidence and rerunning the confirmed standard. The actual local source repair was performed by Codex, not Bob.');
 text(s,'The handoff keeps the context',64,153,655,54,33,C.blue,true);
 text(s,'What the user expected\nWhat actually happened\nWhich actions led to the failure\nWhich source and checks produced it',64,236,625,245,30,C.text);
 text(s,'Online workflow',776,154,434,45,30,C.violet,true);
 text(s,'Copy the repair instructions.\nPaste them into your coding AI.\nBring back the updated app.',776,218,436,141,27,C.text);
 text(s,'Local MCP workflow',776,408,436,45,30,C.violet,true);
 text(s,'An authorized coding agent reads\nthe evidence, edits the source\nand reruns the original checks.',776,471,436,141,27,C.text);
}
// 6: The unmodified Bob screen is shown as a consumption record, never a synthetic proof.
{
 const s=page('IBM Bob built the initial foundation',6,'Original image: bob_sessions/ming_task03_stage_b_final_summary.png. Task ID bfa75e6b4e53cc8425e6754a8b69c8f3. The screenshot is a real task-consumption summary; it is not independent proof that every listed check passed. Bob contribution details and independent verification: docs/STAGE_B_RESULTS.md, docs/STAGE_C_STATUS.md, bob_sessions/README.md, bob_sessions/manifest.json. Bob implemented initial Stage A runner/service/UI, Stage B provider draft validation/confirmation, and partial Stage C repair/MCP foundations. Codex completed and extended the product after the trial quota ended. No watsonx.ai or watsonx Orchestrate was used.');
 text(s,'Browser execution\nand evidence',64,154,370,80,31,C.blue,true);
 text(s,'Model drafts\nand confirmation',64,276,370,80,31,C.blue,true);
 text(s,'Repair and MCP\nfoundations',64,398,370,80,31,C.blue,true);
 text(s,'Codex completed the product\nand later refinements.',64,534,373,80,25,C.muted);
 await image(s,'bob_sessions/ming_task03_stage_b_final_summary.png',455,156,761,475);
}
// 7: Supported inputs and what the prototype actually changes in the workflow.
{
 const s=page('Reusable checks replace repeated manual work',7,'Sources: docs/UPLOADED_PROJECTS.md, docs/DOUBAO_PLANNING.md, docs/SIMPLE_WORKFLOW_REVIEW.md and README.md supported targets. Impact is described as operations performed and reusable evidence, not an unmeasured speedup. Hosted flow supports built static websites; it does not install packages, start backends or allow external-network calls in the preview. Local execution supports same-origin development applications with browser evidence. Every result covers only the approved checks.');
 text(s,'Ming repeats the browser actions,\nrecords the failure and keeps\nthe same standard for the next run.',64,162,1152,165,42,C.text,true);
 text(s,'Online',64,400,550,45,31,C.blue,true);
 text(s,'HTML, built static ZIPs and public\nGitHub website folders.\nAI drafts require an explicit request.',64,465,546,132,26,C.text);
 text(s,'Local',704,400,508,45,31,C.violet,true);
 text(s,'Running development apps with\nthe local runner and MCP connection.\nThe app handles its own dependencies.',704,465,512,132,26,C.text);
 text(s,'Passing means the approved checks passed. It does not certify every possible behavior.',64,621,1152,33,22,C.muted);
}
// 8: Actual project links remain editable/clickable, with access readiness tracked separately.
{
 const s=p.slides.add();s.background.fill=C.bg;
 await image(s,'apps/web/public/welcome/inspection-room.png',0,0,1280,720,'cover');
 text(s,'Ming',64,85,760,112,92,C.text,false,'Georgia');
 text(s,'Every “done” comes with proof',70,226,850,65,40,C.text,true);
 text(s,'Project links',72,365,980,42,30,C.blue,true);
 const a=text(s,'',72,432,1130,45,26,C.text);
 a.text=[[{run:'ming-acceptance-proof.amosming.chatgpt.site',link:{uri:app,isExternal:true},textStyle:{color:C.text,underline:'sng'}}]];
 const b=text(s,'',72,512,1125,45,26,C.text);
 b.text=[[{run:'github.com/Ming-Amos/Ming',link:{uri:repo,isExternal:true},textStyle:{color:C.text,underline:'sng'}}]];
 text(s,'Application, source code and original Bob session records',72,622,1100,35,24,C.muted);
 s.speakerNotes.textFrame.setText('Project links: '+app+' and '+repo+'. Bob task screenshots: '+repo+'/tree/main/bob_sessions. Access remains owner-private at deck preparation; the owner must enable and verify judge access before submitting. No formal competition submission is claimed.');
}

const candidate=path.join(tmp,'candidate.pptx');
await (await PresentationFile.exportPptx(p)).save(candidate);
await fs.writeFile(path.join(tmp,'presentation.json'),JSON.stringify(p.toProto()));
const layout=[];
for(let i=0;i<p.slides.items.length;i++){
 const s=p.slides.items[i];
 const png=await p.export({slide:s,format:'png',scale:1.5});
 await fs.writeFile(path.join(tmp,'renders',`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await png.arrayBuffer()));
 const l=await s.export({format:'layout'});layout.push(JSON.parse(await l.text()));
 console.log('Rendered slide '+(i+1));
}
await fs.writeFile(path.join(tmp,'layout.json'),JSON.stringify(layout,null,2));
console.log(JSON.stringify({candidate,slideCount:p.slides.items.length,fonts:['Arial','Georgia']}));
