import {concepts} from './concepts.mjs';
import {generate,GenerationError} from './generate.mjs';
export async function handleGenerate(method,body,env,execute=generate){
  if(method!=='POST') return {status:405,body:{error:'Use POST to generate a diagram.'}};
  const concept=concepts.find(x=>x.id===body?.id);
  if(!concept) return {status:400,body:{error:'Choose one of the five lesson concepts.'}};
  try {return {status:200,body:await execute(concept,env)};}
  catch(e){return {status:e instanceof GenerationError?e.status:500,body:{error:e instanceof GenerationError?e.message:'Generation failed. Try again.'}};}
}
