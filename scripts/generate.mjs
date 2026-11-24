import {writeFile,rename,unlink} from 'node:fs/promises';
import {concepts} from '../lib/concepts.mjs';
import {generate} from '../lib/generate.mjs';
const rows=[];
for(const concept of concepts) {
  const result=await generate(concept,process.env);
  if(!result.passed) throw Error(concept.title+' failed validation twice. Existing results.json was preserved.');
  rows.push(result);
}
const temp='results.'+crypto.randomUUID()+'.tmp';
try { await writeFile(temp,JSON.stringify(rows,null,2)+'\n'); await rename(temp,'results.json'); }
finally { await unlink(temp).catch(()=>{}); }
