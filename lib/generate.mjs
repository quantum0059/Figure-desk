import {dialect,validate} from './validate.mjs';

export class GenerationError extends Error {
  constructor(message,status=502){ super(message); this.status=status; }
}
const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
export async function generate(concept,env,{request=fetch,wait=pause,log=console.info}={}) {
  if (!env.GEMINI_API_KEY) throw new GenerationError('Live generation needs a Gemini API key. Set GEMINI_API_KEY on the server and try again.',503);
  const model=env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const rates=[Number(env.INPUT_USD_PER_MILLION||0),Number(env.OUTPUT_USD_PER_MILLION||0)];
  if(!rates.every(x=>Number.isFinite(x)&&x>=0)) throw new GenerationError('Invalid server pricing configuration.',500);
  const run={id:concept.id, revision:crypto.randomUUID(),source:'Gemini',model,inputTokens:0,outputTokens:0,cost:0,retries:0,attempts:[],checks:null};
  const prompt='Draw one accurate UK GCSE teaching diagram. Return only raw SVG. '+dialect+' Lesson: '+concept.brief;
  let instruction=prompt, transient=0;
  try {
    for(let pass=0;pass<2;pass++){
      let response;
      while(true){
        response=await request('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{
          method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},
          body:JSON.stringify({contents:[{parts:[{text:instruction}]}],generationConfig:{maxOutputTokens:8192}}),
          signal:AbortSignal.timeout(20000)
        });
        if(![429,503].includes(response.status) || transient>=3) break;
        const retryAfter=response.headers.get('Retry-After');
        const delay=retryAfter===null ? 0 : /^\d+$/.test(retryAfter) ? Number(retryAfter)*1000 : Date.parse(retryAfter)-Date.now();
        if(delay>30000) throw new GenerationError('Gemini requested a longer cooldown. Please try again later.',429);
        await wait(Math.max(1000*2**transient,delay||0)); transient++; run.retries++;
      }
      if(!response.ok) throw new GenerationError('Gemini returned HTTP '+response.status+'. '+([401,403,404].includes(response.status)?'Check the server key and model.':'Please try again later.'),response.status===429?429:502);
      const data=await response.json(), usage=data.usageMetadata;
      if(!usage || !Number.isFinite(usage.promptTokenCount) || !Number.isFinite(usage.totalTokenCount)) throw new GenerationError('Gemini omitted usage information. Please retry.');
      run.inputTokens+=usage.promptTokenCount;
      run.outputTokens+=Math.max(0,usage.totalTokenCount-usage.promptTokenCount);
      run.cost=(rates[0]*run.inputTokens+rates[1]*run.outputTokens)/1e6;
      const svg=(data.candidates?.[0]?.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||'').join('').trim().replace(/^\x60\x60\x60(?:svg|xml)?\s*([\s\S]*?)\s*\x60\x60\x60$/i,'$1');
      run.checks=validate(svg);
      run.attempts.push({checks:run.checks});
      const failed=Object.keys(run.checks).filter(k=>!run.checks[k]);
      if(!failed.length) return {...run,svg,passed:true};
      if(pass===0) {
        run.retries++;
        instruction=prompt+' Previous attempt failed: '+failed.join(', ')+'. Redraw it and fix these failures. Previous SVG: '+svg.slice(0,12000);
      }
    }
    return {...run,svg:null,passed:false};
  } catch(error) {
    if(error instanceof GenerationError) throw error;
    throw new GenerationError(error.name==='TimeoutError'?'Gemini timed out. Please retry.':'Could not read a response from Gemini. Please retry.');
  } finally { log(JSON.stringify(run)); }
}
