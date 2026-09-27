/** Validate the candidate deck and render the final PPTX for PDF export.
 * Requires RUNTIME_NODE_MODULES, PRESENTATION_SKILL_DIR and PYTHON_EXECUTABLE.
 * Review the final renders before copying the output files into submission/.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const skill=process.env.PRESENTATION_SKILL_DIR;
const modules=process.env.RUNTIME_NODE_MODULES;
const python=process.env.PYTHON_EXECUTABLE;
if(!skill||!modules||!python)throw new Error('Set PRESENTATION_SKILL_DIR, RUNTIME_NODE_MODULES and PYTHON_EXECUTABLE.');
const tmp=path.join(root,'runtime/submission-deck-20260927');
const {finalizePresentation}=await import(pathToFileURL(path.join(skill,'container_tools/artifact_tool_utils.mjs')).href);
await finalizePresentation({
 workspaceDir:root,
 candidatePath:path.join(tmp,'candidate.pptx'),
 finalPath:path.join(tmp,'output/ming-slides.pptx'),
 pythonExecutable:python,
 integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),
 layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),
 layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit'],
 explicitTotalSlideCount:8,
 requiredNativeTableOwnerSlides:[],requiredNativeChartOwnerSlides:[],
 fontPolicy:{basis:'design',families:['Arial','Georgia']},
 verifyArtifactToolImport:true,
 receiptPath:path.join(tmp,'validation.json'),
});
const runtimeRequire=createRequire(path.join(modules,'__deck__.cjs'));
const {PresentationFile,FileBlob}=await import(pathToFileURL(runtimeRequire.resolve('@oai/artifact-tool')).href);
const deck=await PresentationFile.importPptx(await FileBlob.load(path.join(tmp,'output/ming-slides.pptx')));
await fs.mkdir(path.join(tmp,'final-renders'),{recursive:true});
for(let i=0;i<deck.slides.items.length;i++){
 const blob=await deck.export({slide:deck.slides.items[i],format:'png',scale:1.5});
 await fs.writeFile(path.join(tmp,'final-renders',`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await blob.arrayBuffer()));
}
console.log('Validated and rendered 8 slides; review before delivery.');
