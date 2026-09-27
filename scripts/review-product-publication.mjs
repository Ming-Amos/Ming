/** Review Git candidates and preserved proof; never print potential secret values. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const git=(args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'});
const files=[...new Set(git(['ls-files','--cached','--others','--exclude-standard','-z']).split('\0').filter(Boolean))];
const findings=[];
for(const file of files){
  const absolute=path.join(root,file);if(!fs.existsSync(absolute))continue;
  if(/^runtime\/|(^|\/)\.env$|(^|\/)provider-config\.json$/.test(file))findings.push({file,issue:'private runtime/config candidate'});
  if(!/\.(?:mjs|js|ts|tsx|json|md|txt|ps1|ya?ml|html|css)$/.test(file))continue;
  const text=fs.readFileSync(absolute,'utf8');
  const checks=[['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],['github-token',/\b(?:ghp_|github_pat_)[A-Za-z0-9_]{30,}/],['common-api-key',/\bsk-[A-Za-z0-9_-]{28,}/],['personal-email',/[A-Za-z0-9._%+-]+@(?:gmail|outlook|hotmail|qq)\.com/i]];
  for(const [issue,regex]of checks){const match=regex.exec(text);if(!match)continue;const testFixture=/(?:test|review|fixture)/i.test(file)&&/fake|test|boundary/.test(match[0]);if(!testFixture)findings.push({file,issue});}
}
let verified=0;
for(const directory of ['docs/demo-evidence','docs/judge-evidence']){
  const manifest=JSON.parse(fs.readFileSync(path.join(root,directory,'manifest.json'),'utf8'));
  for(const [file,expected]of Object.entries(manifest.files)){
    const actual=createHash('sha256').update(fs.readFileSync(path.join(root,directory,file))).digest('hex');
    if(actual!==expected)findings.push({file:`${directory}/${file}`,issue:'preserved evidence hash changed'});else verified++;
  }
}
// Protect original screenshot bytes, while allowing their README/index to improve.
// HEAD is an independent baseline: editing a PNG and its manifest hash together
// must not make a changed original pass this review.
const bobOriginalImages=git(['ls-tree','-r','--name-only','-z','HEAD','--','bob_sessions'])
  .split('\0').filter(file=>/^bob_sessions\/.*\.(?:png|jpe?g|gif|webp|avif|bmp|tiff?)$/i.test(file));
const bobFindings=[];
let verifiedBobEvidenceFiles=0;
let bobManifest;
try { bobManifest=JSON.parse(fs.readFileSync(path.join(root,'bob_sessions/manifest.json'),'utf8')); }
catch { bobFindings.push({file:'bob_sessions/manifest.json',issue:'Bob screenshot manifest missing or unreadable'}); }
const bobHashes=new Map();
if(bobManifest){
  if(!Array.isArray(bobManifest.files)||bobManifest.screenshotCount!==bobOriginalImages.length||bobManifest.files.length!==bobOriginalImages.length){
    bobFindings.push({file:'bob_sessions/manifest.json',issue:'Bob screenshot manifest inventory does not match original images'});
  }
  for(const record of Array.isArray(bobManifest.files)?bobManifest.files:[]){
    if(!record||typeof record.file!=='string'||record.file.includes('/')||record.file.includes('\\')||typeof record.sha256!=='string'||!/^[a-f0-9]{64}$/i.test(record.sha256)){
      bobFindings.push({file:'bob_sessions/manifest.json',issue:'Invalid Bob screenshot manifest entry'});continue;
    }
    const file=`bob_sessions/${record.file}`;
    if(bobHashes.has(file)||!bobOriginalImages.includes(file)){
      bobFindings.push({file,issue:'Duplicate or unknown original Bob screenshot in manifest'});continue;
    }
    bobHashes.set(file,record.sha256.toLowerCase());
  }
}
for(const file of bobOriginalImages){
  const absolute=path.join(root,file);
  if(!fs.existsSync(absolute)){bobFindings.push({file,issue:'original Bob screenshot deleted'});continue;}
  const actual=createHash('sha256').update(fs.readFileSync(absolute)).digest('hex');
  const committed=createHash('sha256').update(execFileSync('git',['show',`HEAD:${file}`],{cwd:root})).digest('hex');
  const expected=bobHashes.get(file);
  if(actual!==committed)bobFindings.push({file,issue:'original Bob screenshot differs from Git HEAD'});
  if(!expected)bobFindings.push({file,issue:'original Bob screenshot missing from manifest'});
  else if(actual!==expected)bobFindings.push({file,issue:'original Bob screenshot hash differs from manifest'});
  if(actual===committed&&actual===expected)verifiedBobEvidenceFiles++;
}
findings.push(...bobFindings);
const outcome={checkedAt:new Date().toISOString(),candidateFiles:files.length,verifiedEvidenceFiles:verified,verifiedBobEvidenceFiles,bobEvidenceUnchanged:bobFindings.length===0,findings,scope:'Bounded current-source candidate and preserved-evidence review; not a full history secret audit.'};
fs.mkdirSync(path.join(root,'runtime'),{recursive:true});fs.writeFileSync(path.join(root,'runtime/product-publication-review.json'),JSON.stringify(outcome,null,2));
console.log(JSON.stringify(outcome,null,2));if(findings.length)process.exitCode=1;
