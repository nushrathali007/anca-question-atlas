export function questionFields(text:string){
 const marker=/^(?:([A-E])\. |PART B[^\n]*\n(?:\s*Correct Answer:[ \t]*)?|PART C[^\n]*\n)/gim
 const matches=[...text.matchAll(marker)]
 const labels=['Question','Option A','Option B','Option C','Option D','Option E','Correct answer','Explanation']
 if(matches.length!==7 || matches.slice(0,5).map(m=>m[1]).join('')!=='ABCDE')return []
 return labels.map((label,i)=>{
  const start=i?matches[i-1].index!+matches[i-1][0].length:0
  const end=i<matches.length?matches[i].index!:text.length
  const value=text.slice(start,end).replace(i<matches.length?/\n$/:/$^/,"")
  return {label,start,end:start+value.length,value}
 })
}

import swaps from './answer-migration.json'
export function migrateAnswerOrder(id:number,text:string){
 const pair=(swaps as Record<string,string[]>)[id]
 if(!pair||pair[0]===pair[1])return text
 const fields=questionFields(text)
 if(fields.length!==8||fields[6].value[0]!==pair[0])return text
 const [from,to]=pair
 const left='ABCDE'.indexOf(from)+1,right='ABCDE'.indexOf(to)+1
 const values=fields.map(f=>f.value)
 ;[values[left],values[right]]=[values[right],values[left]]
 values[6]=to+values[6].slice(1)
 values[7]=values[7].replace(/\b([A-E])(?= (?:is|was) (?:in)?correct\b)/g,letter=>letter===from?to:letter===to?from:letter)
 for(let i=fields.length-1;i>=0;i--)text=text.slice(0,fields[i].start)+values[i]+text.slice(fields[i].end)
 return text
}
