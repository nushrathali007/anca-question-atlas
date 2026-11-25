import {SearchToolbar} from './SearchToolbar'
import AtlasTrace from "./AtlasTrace"
import React,{useState} from 'react'
import {createRoot} from 'react-dom/client'
import {questionFields,migrateAnswerOrder} from './fields'
import {seed,sources,topics} from './seed'
type Q=typeof seed[number]
const targets=['Diagnostic reasoning','Disease assessment','Treatment selection','Dosing & timing','Safety & monitoring','Trial applicability','Endpoint definitions','Evidence interpretation']
const statuses=['Finalized','Draft','In review','Verified']
const colors=['#bb7560','#5a8069','#7c6a9a','#64859a']
function Reader({question}:{question:Q}){
 const [picked,setPicked]=useState('')
 const [open,setOpen]=useState(false)
 const fields=questionFields(question.full)
 if(!fields.length)return <article className="reader"><p>{question.full}</p></article>
 const answer=fields[6].value.trim()
 const key=answer.match(/^([A-E])(?:[.)\s]|$)/i)?.[1].toUpperCase()
 return <article className="reader">
  <div className="chips"><em>{question.source}</em>{question.tags.map(t=><em key={t}>{t}</em>)}</div>
  <p>{fields[0].value}</p>
  <ol className="quizChoices">{fields.slice(1,6).map((field,i)=>{
   const letter='ABCDE'[i]
   const result=key && (picked||open) && letter===key?'Correct':key && picked===letter?'Incorrect':''
   return <li key={letter}><button type="button" data-result={result} aria-pressed={picked===letter} onClick={()=>{setPicked(letter);setOpen(true)}}><strong>{letter}</strong><span>{field.value}</span>{result&&<b>{result}</b>}</button></li>
  })}</ol>
  <div aria-live="polite">{picked&&key&&(picked===key?'Correct.':('Incorrect. The correct answer is '+key+'.'))}</div>
  <button type="button" className="answerToggle" aria-expanded={open} onClick={()=>setOpen(!open)}>Answer and explanation {open?'▴':'▾'}</button>
  {open&&<section><h3>Correct answer</h3><p>{answer}</p><h3>Explanation</h3><p>{fields[7].value}</p></section>}
 </article>
}
function App(){
 const [mode,M]=useState('Read')
 function openQuestion(q:Q){M('Read');err('');E({...q})}
 const [rows,setRows]=useState<Q[]>(()=>{const changes:Q[]=JSON.parse(localStorage.getItem('atlas-edits-v4')||localStorage.getItem('atlas-edits-v3')||localStorage.getItem('atlas-edits-v2')||'[]').map((q:Q)=>localStorage.getItem('atlas-edits-v4')===null?{...q,full:migrateAnswerOrder(q.id,q.full)}:q).map((q:Q)=>localStorage.getItem('atlas-edits-v4')===null&&localStorage.getItem('atlas-edits-v3')===null?{...q,status:'In review'}:q);return [...seed.map(q=>(changes.some(c=>c.id===q.id)?{...q,...changes.find(c=>c.id===q.id),tags:changes.find(c=>c.id===q.id)?.tags?.length?changes.find(c=>c.id===q.id)!.tags:q.tags}:q)),...changes.filter(c=>!seed.some(q=>q.id===c.id))]})
 const [source,S]=useState(''),[topic,T]=useState(''),[status,V]=useState('In review'),[search,F]=useState(''),[edit,E]=useState<Q|null>(null),[error,err]=useState('')
 const labels=Array.from(new Set([...sources,...rows.map(q=>q.source)]))
 const topicList=Array.from(new Set([...topics,...rows.map(q=>q.topic)]))
 const [target,G]=useState('Diagnostic reasoning'),[tag,H]=useState('')
 const allTargets=Array.from(new Set([...targets,...rows.map(q=>q.target||'Unclassified')]))
 const allTags=Array.from(new Set(rows.flatMap(q=>q.tags||[]))).sort()
 const [recent,R]=useState(false)
 const visible=rows.filter(q=>!recent||q.id>212).filter(q=>(!target||(q.target||'Unclassified')===target)&&(!tag||q.tags?.includes(tag))&&(!source||q.source===source)&&(!topic||q.topic===topic)&&(!status||q.status===status)&&[q.title,q.body,q.full,q.source,q.topic,q.target,...(q.tags||[])].join(' ').toLowerCase().includes(search.toLowerCase()))
 const [page,P]=useState(0)
 const currentPage=Math.min(page,Math.max(0,Math.ceil(visible.length/10)-1))
 React.useEffect(()=>P(0),[source,target,tag,status,search,recent])
 function save(e:React.FormEvent){e.preventDefault();if(!edit)return;const q={...edit,title:edit.title.trim(),source:edit.source.trim(),topic:edit.topic.trim()};if(!q.tags?.length){err('Add at least one clinical tag before saving.');return}if(!q.title||!q.source||!q.topic){err('Enter a title, source and topic.');return}const next=rows.some(r=>r.id===q.id)?rows.map(r=>r.id===q.id?q:r):[...rows,q];try{localStorage.setItem('atlas-edits-v4',JSON.stringify(next.filter(q=>!seed.includes(q))));setRows(next);E(null)}catch{err('Browser storage is full or unavailable.')}}
 return <><header className="masthead"><a href="#library" className="atlasBrand"><img src="/atlas-mark.svg" alt="" width="38" height="38"/><span>Question Atlas</span></a><nav aria-label="Library shortcuts"><a href="#index">Browse</a><button onClick={()=>{const input=document.getElementById('question-search');input?.focus();input?.scrollIntoView({block:'center'})}}>Search</button></nav></header><main id="library"><AtlasTrace/><div className="hero"><div><h1>ANCA-associated vasculitis question library</h1></div></div><div className="indexLayout" id="index"><aside className="targetIndex" aria-label="Question targets"><h2>Question targets</h2><div className="targetLinks">{['',...allTargets].map(t=><button key={t} aria-pressed={target===t} onClick={()=>G(t)}><span>{t||'All questions'}</span></button>)}</div><select className="mobileTarget" aria-label="Question target" value={target} onChange={e=>G(e.target.value)}>{['',...allTargets].map(t=><option key={t} value={t}>{t||'All questions'}</option>)}</select></aside><section className="indexResults"><div className="heading"><h2>{target||'All questions'}</h2></div><SearchToolbar search={search} onSearch={F} recent={recent} onRecent={()=>{R(!recent);if(!recent){G('');H('');V('');S('');F('')}}} facets={[{name:'Source',value:source,options:labels,change:S},{name:'Clinical tag',value:tag,options:allTags,change:H},{name:'Status',value:status,options:statuses,change:V}]}/><div className="questionCards">{visible.slice(currentPage*10,currentPage*10+10).map(q=><article className="qcard" key={q.id}><div className="cardTop"><small>{q.title.split(' · ')[0]}</small><em>{q.status}</em></div><button className="readLink" onClick={()=>openQuestion(q)}>{q.title.split(' · ').slice(1).join(' · ')||q.title}</button><p>{q.body}</p><div className="chips"><button className="src" onClick={()=>S(q.source)}>{q.source}</button>{q.tags?.map(t=><button key={t} onClick={()=>H(t)}>{t}</button>)}</div></article>)}{!visible.length&&<p>No questions match these filters.</p>}</div>{visible.length>10&&<nav className="heading" aria-label="Question pages"><button className="sourceBtn" disabled={!currentPage} onClick={()=>{P(currentPage-1);document.getElementById('index')?.scrollIntoView()}}>Previous</button><span>Page {currentPage+1} of {Math.ceil(visible.length/10)}</span><button className="sourceBtn" disabled={(currentPage+1)*10>=visible.length} onClick={()=>{P(currentPage+1);document.getElementById('index')?.scrollIntoView()}}>Next</button></nav>}</section></div><footer>Edits are saved in this browser.</footer></main>{edit&&<dialog ref={n=>{if(n&&!n.open)n.showModal()}} onCancel={()=>E(null)}><form onSubmit={save}><div className="heading"><h2>{edit.title.split(' · ')[0]}</h2><button type="button" aria-label="Close" onClick={()=>E(null)}>×</button></div><div className="seg">{['Read','Edit record'].map(v=><button key={v} type="button" aria-pressed={v===mode} onClick={()=>M(v)}>{v}</button>)}</div>{mode==='Read'?<Reader question={edit}/>:<><div className="chips"><em>{/^KDIGO/i.test(edit.source)?'Guideline':sources.includes(edit.source)?'Clinical trial':'Evidence source'} · {edit.source}</em>{(edit.tags||[]).map(t=><em key={t}>{t}</em>)}</div>{questionFields(edit.full).map(field=><label key={field.label}>{field.label}<textarea required rows={field.label==='Question'||field.label==='Explanation'?8:2} value={field.value} onChange={e=>E({...edit,full:edit.full.slice(0,field.start)+e.target.value+edit.full.slice(field.end)})}/></label>)}<details><summary>Classification and review details</summary><label>Question target<select value={edit.target||'Unclassified'} onChange={e=>E({...edit,target:e.target.value})}>{Array.from(new Set([...allTargets,'Unclassified'])).map(x=><option key={x}>{x}</option>)}</select></label><label>Clinical tags (comma-separated)<input key={edit.id} defaultValue={(edit.tags||[]).join(', ')} onBlur={e=>E({...edit,tags:Array.from(new Set(e.target.value.split(',').map(t=>t.trim()).filter(Boolean)))})}/></label>{(['title','source','status','body','full'] as const).filter(key=>key!=='full'||!questionFields(edit.full).length).map((key,i)=><label key={key}>{['Question title','Evidence source','Review status','Index summary','Original question, choices and answer'][i]}{key==='status'?<select value={edit[key]} onChange={e=>E({...edit,[key]:e.target.value})}>{statuses.map(x=><option key={x}>{x}</option>)}</select>:i>=3?<textarea rows={i===4?16:2} value={edit[key]} onChange={e=>E({...edit,[key]:e.target.value})}/>:<input required list={key} value={edit[key]} onChange={e=>E({...edit,[key]:e.target.value})}/>}</label>)}<datalist id="source">{labels.map(x=><option key={x}>{x}</option>)}</datalist><datalist id="topic">{topicList.map(x=><option key={x}>{x}</option>)}</datalist></details>{error&&<p role="alert">{error}</p>}<button className="primary">Save question</button></>}</form></dialog>}</>
}
createRoot(document.getElementById('root')!).render(<App/>)
