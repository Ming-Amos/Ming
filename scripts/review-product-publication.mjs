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
const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/demo-evidence/manifest.json'),'utf8'));
let verified=0;
for(const [file,expected]of Object.entries(manifest.files)){
  const actual=createHash('sha256').update(fs.readFileSync(path.join(root,'docs/demo-evidence',file))).digest('hex');
  if(actual!==expected)findings.push({file,issue:'preserved evidence hash changed'});else verified++;
}
const bobChanged=git(['diff','HEAD','--name-only','--','bob_sessions']).trim();if(bobChanged)findings.push({issue:'original Bob evidence changed'});
const outcome={checkedAt:new Date().toISOString(),candidateFiles:files.length,verifiedEvidenceFiles:verified,bobEvidenceUnchanged:!bobChanged,findings,scope:'Bounded current-source candidate and preserved-evidence review; not a full history secret audit.'};
fs.mkdirSync(path.join(root,'runtime'),{recursive:true});fs.writeFileSync(path.join(root,'runtime/product-publication-review.json'),JSON.stringify(outcome,null,2));
console.log(JSON.stringify(outcome,null,2));if(findings.length)process.exitCode=1;
