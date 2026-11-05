const graphemes=new Intl.Segmenter(undefined,{granularity:'grapheme'});
export function wrapName(name:string,measure:(s:string)=>number,width:number,maxLines=3){
 const lines:string[]=[];let line='';
 for(const {segment} of graphemes.segment(name)){
  if(line&&measure(line+segment)>width){const space=line.lastIndexOf(' ');if(space>0){lines.push(line.slice(0,space).trimEnd());line=line.slice(space+1)+segment;}else{lines.push(line);line=segment;}}
  else line+=segment;
 }
 if(line.trim())lines.push(line.trim());
 const visible=lines.slice(0,maxLines);if(lines.length>maxLines){let last=visible[maxLines-1];while(last&&measure(last+'…')>width)last=Array.from(graphemes.segment(last),s=>s.segment).slice(0,-1).join('');visible[maxLines-1]=last.trimEnd()+'…';}return visible;
}
