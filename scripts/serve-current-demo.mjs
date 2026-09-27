/** Local preview of the exact packaged application used for video recording.
 * Secrets stay in the existing ignored runtime config. One real draft maximum
 * per recording workspace; no automatic retries. A successful recording leaves
 * the request lock intact, preventing accidental repeated provider charges.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const client=path.join(root,'dist/sites/client');
const {default:worker}=await import(pathToFileURL(path.join(root,'dist/sites/server/index.js')));
const config=JSON.parse(await fs.readFile(path.join(root,'runtime/provider-config.json'),'utf8'));
const port=4386;
const work=path.join(root,'runtime/current-submission-video');
await fs.mkdir(work,{recursive:true});
const env={MING_DOUBAO_API_KEY:config.apiKey,MING_DOUBAO_MODEL:config.modelId,ASSETS:{async fetch(request){
 const rel=decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, '')||'index.html';
 const filename=path.resolve(client,rel);
 if(!filename.startsWith(path.resolve(client)+path.sep))return new Response('Not found',{status:404});
 const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2'};
 try{return new Response(await fs.readFile(filename),{headers:{'content-type':types[path.extname(filename)]||'application/octet-stream'}})}catch{return new Response('Not found',{status:404})}
}}};
const server=http.createServer(async(req,res)=>{
 try{
  if(req.method==='POST'&&req.url==='/api/upload/planner/draft'){
   try{await fs.writeFile(path.join(work,'provider-call-lock.json'),JSON.stringify({startedAt:new Date().toISOString(),purpose:'One authorized recording draft',retry:false}),{flag:'wx'})}
   catch{res.writeHead(429);res.end(JSON.stringify({ok:false,error:'Recording budget allows one draft only.'}));return}
   console.log('Forwarding the single requested model draft.');
  }
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const body=Buffer.concat(chunks);
  const request=new Request(`http://127.0.0.1:${port}${req.url}`,{method:req.method,headers:req.headers,...(body.length?{body}:{})});
  const response=await worker.fetch(request,env);
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end('Local packaged preview error');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Packaged current product at http://127.0.0.1:${port}; one draft maximum.`));
