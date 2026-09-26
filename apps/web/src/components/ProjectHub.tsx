import { useState } from "react";
import { ArrowRight, Archive, CheckCircle, CircleNotch, FileHtml, FolderOpen, Globe, Plus, Pulse, WarningCircle, CursorClick, ListChecks, PaperPlaneTilt, Play } from "@phosphor-icons/react";
import type { ProjectRecord, RunRecord, TargetInfo } from "../types";
import { api } from "../lib/api";
type HistoryItem = Pick<RunRecord, "runId" | "status" | "startedAt" | "targetVariant">;
const chapters = [
  {title:"Define the promise",subtitle:"YOUR REQUIREMENTS",icon:ListChecks,body:"Start with what the feature should do. Turn your PRD into a plan you can inspect, edit and approve.",foot:"Your standard stays yours."},
  {title:"Watch what happens",subtitle:"REAL BROWSER EVIDENCE",icon:CursorClick,body:"Ming clicks, types and checks your actual app. Follow the recorded steps to the exact moment a requirement fails.",foot:"A screenshot, not another claim."},
  {title:"Close the loop",subtitle:"A REPAIR THAT HOLDS UP",icon:PaperPlaneTilt,body:"Send the requirement, actions and failure evidence to your coding AI. Check the repair against the same approved plan.",foot:"The standard never moves to fit the result."},
];
export default function ProjectHub({ targets, projects, history, readOnly, onConnect, onOpen, onArchived }: {
  targets:TargetInfo[];projects:ProjectRecord[];history:HistoryItem[];readOnly:boolean;
  onConnect:()=>void;onOpen:(target:TargetInfo,project?:ProjectRecord)=>void;onArchived:()=>void;
}) {
  const [chapter,setChapter]=useState(0),[probing,setProbing]=useState("");
  const [probe,setProbe]=useState<Record<string,{reachable:boolean;message:string}>>({});
  const [archiveId,setArchiveId]=useState(""),[error,setError]=useState("");
  const own=targets.filter(t=>t.isSample===false&&!t.archived);
  const samples=targets.filter(t=>t.isSample!==false&&!t.archived);
  const english=samples.filter(t=>t.variant.startsWith("shipboard-"));
  const featured=english.find(t=>t.variant==="shipboard-buggy")||samples[0];
  const explanation=chapters[chapter], ChapterIcon=explanation.icon;
  async function check(target:TargetInfo){setProbing(target.variant);setError("");try{const response=await api<{reachable:boolean;context?:{title?:string};error?:string}>(`/api/targets/${encodeURIComponent(target.variant)}/probe`,{});setProbe(old=>({...old,[target.variant]:{reachable:response.reachable,message:response.reachable?`Connected${response.context?.title?` · ${response.context.title}`:""}`:response.error||"Start your development app, then try again."}}));}catch(e){setProbe(old=>({...old,[target.variant]:{reachable:false,message:(e as Error).message}}));}finally{setProbing("");}}
  async function archive(target:TargetInfo){setProbing(target.variant);setError("");try{await api(`/api/targets/${encodeURIComponent(target.variant)}`,undefined,"DELETE");setArchiveId("");onArchived();}catch(e){setError((e as Error).message);}finally{setProbing("");}}
  return <section className="project-hub studio-hub" aria-label="Your projects">
    <div className="studio-hero">
      <div className="studio-hero-copy"><span className="studio-edition"><span>MING / ACCEPTANCE STUDIO</span><span>01—03</span></span>
        <h1>“Done” is a claim.<br/><em>Make it a fact.</em></h1>
        <p>Your AI built the feature. Ming checks the promise.<br/>A clear path from requirements to browser evidence to a repair you can verify.</p>
        <div className="studio-hero-actions">{!readOnly&&<button className="primary-button" onClick={onConnect}><Plus size={18}/>Connect your project</button>}{featured&&<button className="secondary-button" onClick={()=>onOpen(featured)}><Play size={16} weight="fill"/>{readOnly?"Explore recorded evidence":"Try a real browser check"}</button>}</div>
        <div className="studio-hero-foot"><CheckCircle size={16}/>Local-first. Human-approved. Evidence attached.</div>
      </div>
      <div className="studio-method" aria-label="How Ming works">
        <div className="method-top"><span>FROM CLAIM TO PROOF</span><span>HOW IT WORKS</span></div>
        <div className="method-tabs" role="tablist" aria-label="Explore the acceptance workflow">{["Define","Inspect","Resolve"].map((name,i)=><button key={name} id={`method-tab-${i}`} role="tab" aria-controls="method-explanation" aria-selected={chapter===i} className={chapter===i?"selected":""} onClick={()=>setChapter(i)} onKeyDown={e=>{if(e.key==="ArrowRight"||e.key==="ArrowLeft"){e.preventDefault();const next=(chapter+(e.key==="ArrowRight"?1:2))%3;setChapter(next);document.getElementById(`method-tab-${next}`)?.focus();}}}><span>0{i+1}</span>{name}</button>)}</div>
        <div id="method-explanation" className="method-explanation" role="tabpanel" aria-labelledby={`method-tab-${chapter}`} key={chapter}><ChapterIcon size={36} weight="duotone"/><span className="eyebrow">{explanation.subtitle}</span><h2>{explanation.title}</h2><p>{explanation.body}</p><div className="method-principle"><ArrowRight size={16}/>{explanation.foot}</div></div>
      </div>
    </div>
    <div className="collection-heading"><div><span className="eyebrow">WORK IN PROGRESS, WITH PROOF</span><h2>Your projects <span>{own.length.toString().padStart(2,"0")}</span></h2></div>{!readOnly&&own.length>0&&<button className="subtle-button" onClick={onConnect}><Plus size={17}/>Connect another</button>}</div>
    {error&&<div className="message error-message" role="alert"><WarningCircle size={20}/><span>{error}</span></div>}
    {own.length?<div className="project-grid">{own.map(target=>{const project=projects.find(p=>p.projectId===target.projectId)||projects.find(p=>p.targetVariant===target.variant);const last=history.find(r=>r.targetVariant===target.variant),outcome=probe[target.variant];return <article className="project-card" key={target.variant}>
      <div className="project-card-top"><span className="project-kind">{target.kind==="url"?<Globe size={22}/>:<FileHtml size={22}/>} {target.kind==="url"?"Connected website":"Local HTML"}</span>{last&&<span className={`status status-${last.status}`}>{last.status==="passed"?"Last check passed":last.status==="failed"?"Needs attention":last.status==="running"||last.status==="pending"?"Checking":"Execution incomplete"}</span>}</div>
      <h3>{project?.name||target.label}</h3><p className="project-url" title={target.url}>{target.url}</p>
      {outcome&&<p className={`connection-result ${outcome.reachable?"reachable":"unreachable"}`}>{outcome.reachable?<CheckCircle size={16}/>:<WarningCircle size={16}/>} {outcome.message}</p>}
      <div className="project-card-actions"><button className="primary-button" onClick={()=>onOpen(target,project)}>Open workspace<ArrowRight size={16}/></button>{!readOnly&&<button className="secondary-button" disabled={!!probing} onClick={()=>void check(target)}>{probing===target.variant?<CircleNotch className="spin" size={16}/>:<Pulse size={16}/>}Check connection</button>}</div>
      {!readOnly&&<div className="archive-row">{archiveId===target.variant?<><span>History and evidence will be kept.</span><button onClick={()=>void archive(target)} disabled={!!probing}>Archive</button><button onClick={()=>setArchiveId("")}>Cancel</button></>:<button onClick={()=>setArchiveId(target.variant)}><Archive size={14}/>Archive project</button>}</div>}
    </article>})}</div>:<div className="studio-empty"><FolderOpen size={32} weight="light"/><div><h3>Your next project belongs here.</h3><p>Connect a local app, add your requirements and approve its first check. No model key is needed for a manual plan.</p></div>{!readOnly&&<button className="secondary-button" onClick={onConnect}>Connect project<ArrowRight size={16}/></button>}</div>}
    <section className="sample-section"><div className="collection-heading"><div><span className="eyebrow">A SMALL APP. A REAL FAILURE.</span><h2>Explore the proof lab</h2></div><span className="lab-meta">Seeded defects / real browser execution</span></div><p className="sample-intro">Start with Shipboard. Add a task, refresh the page, and see whether “saved” actually means saved.</p>
      <div className="sample-grid">{(english.length?english:samples).map((target,i)=><button className="sample-card studio-sample" key={target.variant} onClick={()=>onOpen(target)}><span className="sample-index">0{i+1}</span><span><strong>{target.label}</strong><small>{target.variant.endsWith("buggy")?"Find the persistence defect":target.variant.endsWith("repair")?"Follow a repair against the same plan":"Inspect a passing implementation"}</small></span><ArrowRight size={20}/></button>)}</div>
      {english.length>0&&samples.length>english.length&&<details className="legacy-samples"><summary>Earlier sample projects · original-language evidence</summary><div className="sample-grid">{samples.filter(t=>!t.variant.startsWith("shipboard-")).map(t=><button className="sample-card" key={t.variant} onClick={()=>onOpen(t)}><FileHtml size={20}/><span><strong>{t.label}</strong><small>Historical sample</small></span><ArrowRight size={16}/></button>)}</div></details>}
    </section>
  </section>;
}
