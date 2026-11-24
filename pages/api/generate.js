import {handleGenerate} from '../../lib/api.mjs';
export const config={maxDuration:180,api:{bodyParser:{sizeLimit:'2kb'}}};
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST') res.setHeader('Allow','POST');
  const result=await handleGenerate(req.method,req.body,process.env);
  res.status(result.status).json(result.body);
}
