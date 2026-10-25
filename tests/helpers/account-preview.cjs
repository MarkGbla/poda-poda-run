// Local browser fixture only. Never imported by the app or Worker bundle.
// node tests/helpers/account-preview.cjs; /?fixture=driver or /?fixture=guest
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {database,seed}=require('./account-db.cjs');
(async()=>{
  const worker=(await import('../../server/worker.mjs')).default;
  const DB=database(),player=await seed(DB,'SaloneDriver');
  const root=path.resolve(__dirname,'../../dist'),origin='http://127.0.0.1:'+(process.env.PORT || 5190);
  const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg'};
  const env={DB,PUBLIC_ORIGIN:origin};
  env.ASSETS={async fetch(req){const url=new URL(req.url);const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return new Response('Not found',{status:404});
    return new Response(fs.readFileSync(file),{headers:{'content-type':types[path.extname(file)]||'application/octet-stream'}});
  }};
  http.createServer(async(req,res)=>{
    try {
      const url=new URL(req.url,origin);let body='';for await(const chunk of req)body+=chunk;
      const request=new Request(url,{method:req.method,headers:req.headers,...(body?{body}: {})});
      const response=await worker.fetch(request,env);
      res.statusCode=response.status;for(const [key,value] of response.headers)res.setHeader(key,value);
      if(url.searchParams.get('fixture')==='driver')res.setHeader('Set-Cookie',`poda-session=${player.token}; Path=/; HttpOnly; SameSite=Lax`);
      if(url.searchParams.get('fixture')==='guest')res.setHeader('Set-Cookie','poda-session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch(error) {res.statusCode=500;res.end(error.message);}
  }).listen(Number(process.env.PORT || 5190),'127.0.0.1',()=>console.log('Account preview fixture: '+origin+'/?fixture=driver'));
})();
