import { SaxesParser } from 'saxes';

export const checkNames = ['Valid SVG', 'Inside canvas', 'Title & labels', 'Animated', 'Safe elements'];
const geometry = {
  rect: ['x','y','width','height','rx'], circle: ['cx','cy','r'],
  line: ['x1','y1','x2','y2'], polygon: ['points'], text: ['x','y','font-size']
};
const paint = ['fill','stroke','stroke-width'];
const schema = {
  svg: ['xmlns','viewBox'], title: [], animate: ['attributeName','values','dur','repeatCount'],
  ...Object.fromEntries(Object.entries(geometry).map(([name,attrs]) => [name,[...attrs,...paint]]))
};
const numeric = /^-?(?:\d+\.?\d*|\.\d+)$/;
const colors = /^(?:#[\da-f]{3}|#[\da-f]{6}|none|[a-z]{1,18})$/i;
export const dialect = 'Use a flat SVG in the SVG namespace with viewBox="0 0 600 240", one title and 3+ distinct visible text labels. Draw using ONLY rect, circle, line, polygon and text at absolute numeric coordinates. Allowed paint: fill, stroke, stroke-width. Text uses x, y and font-size, left-aligned. No groups, styles, transforms, paths or references. Leave room around strokes and labels (allow one em per character). Nest at least one <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite"/> inside a visible shape. Use dark ink, green or blue on a light canvas.';

export function validate(svg) {
  const tests = [false,true,false,false,true];
  const stack = [], labels = new Set();
  let box, title = '', root, count = 0;
  try {
    if (typeof svg !== 'string' || svg.length > 100000) throw Error();
    const parser = new SaxesParser();
    parser.on('doctype', () => { throw Error(); });
    parser.on('processinginstruction', () => { tests[4] = false; });
    parser.on('opentag', ({name, attributes:a}) => {
      if (++count > 1500) throw Error();
      const parent = stack.at(-1)?.name;
      if (!parent) root = name === 'svg' && a.xmlns === 'http://www.w3.org/2000/svg';
      const structure = !parent ? name === 'svg' : name === 'animate' ? Object.hasOwn(geometry,parent) : parent === 'svg' && name !== 'svg';
      if (!structure || !Object.hasOwn(schema,name) || Object.keys(a).some(k => !schema[name].includes(k))) tests[4] = false;
      if (name === 'svg') {
        box = (a.viewBox || '').trim().split(/[ ,]+/).map(Number);
        if (box.length !== 4 || !box.every(Number.isFinite) || box[2]<=0 || box[3]<=0) tests[1]=false;
      }
      for (const [key,value] of Object.entries(a)) {
        if (['stroke','fill'].includes(key) && !colors.test(value)) tests[4]=false;
      }
      stack.push({name,a,text:''});
    });
    parser.on('text', value => { if(stack.length) stack.at(-1).text += value; });
    parser.on('closetag', () => {
      const {name,a,text} = stack.pop();
      if(name === 'title') title += text.trim();
      if(name === 'animate') {
        const values = (a.values || '').split(';');
        const valid = a.attributeName === 'opacity' && values.length >= 2 && new Set(values.map(Number)).size > 1 &&
          values.every(v => numeric.test(v) && +v >= 0 && +v <= 1) && /^\d+(?:\.\d+)?s$/.test(a.dur) && parseFloat(a.dur)>0 && a.repeatCount==='indefinite';
        if(valid) tests[3]=true; else tests[4]=false;
      }
      if (!Object.hasOwn(geometry,name)) return;
      function n(key,fallback=0) {
        if (a[key] === undefined) return fallback;
        if (!numeric.test(a[key])) { tests[1]=false; return 0; }
        return Number(a[key]);
      }
      let points;
      const x=n('x'), y=n('y');
      if(name==='rect') {
        const w=n('width'), h=n('height');
        if(w<=0||h<=0||n('rx')<0) tests[1]=false;
        points=[[x,y],[x+w,y+h]];
      } else if(name==='circle') {
        const r=n('r'); if(r<=0) tests[1]=false;
        points=[[n('cx')-r,n('cy')-r],[n('cx')+r,n('cy')+r]];
      } else if(name==='line') points=[[n('x1'),n('y1')],[n('x2'),n('y2')]];
      else if(name==='polygon') {
        const nums=(a.points||'').trim().split(/[\s,]+/);
        if(nums.length<6 || nums.length%2 || !nums.every(v=>numeric.test(v))) tests[1]=false;
        points=nums.filter((_,i)=>i%2===0).map((v,i)=>[+v,+nums[i*2+1]]);
      } else {
        const size=n('font-size',16);
        if(size<=0) tests[1]=false;
        if(text.trim() && a.fill!=='none' && size>0) labels.add(text.trim().toLowerCase());
        points=[[x,y-size],[x+Array.from(text).length*size,y+size*0.3]];
      }
      // Use the SVG default miter limit for polygon joins.
      const stroke=a.stroke && a.stroke!=='none' ? n('stroke-width',1) : 0;
      const pad=stroke*(name==='polygon'?2:0.5);
      if(!box || stroke<0 || points.some(([px,py])=>!(px-pad>=box[0] && py-pad>=box[1] && px+pad<=box[0]+box[2] && py+pad<=box[1]+box[3]))) tests[1]=false;
    });
    parser.write(svg).close();
    tests[0]=Boolean(root); tests[2]=Boolean(title && labels.size>=3);
    if(!tests[4]) tests[1]=false;
  } catch { tests.fill(false); }
  return Object.fromEntries(checkNames.map((name,i)=>[name,tests[i]]));
}
