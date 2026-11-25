import React,{useEffect,useRef,useState} from 'react'

type Facet={name:string,value:string,options:string[],change:(v:string)=>void}
function FacetPicker({name,value,options,change}:Facet){
 const [open,setOpen]=useState(false)
 const [query,setQuery]=useState('')
 const root=useRef<HTMLDivElement>(null)
 const trigger=useRef<HTMLButtonElement>(null)
 const searchable=options.length>6
 useEffect(()=>{
  if(!open)return
  const close=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false)}
  document.addEventListener('pointerdown',close)
  return ()=>document.removeEventListener('pointerdown',close)
 },[open])
 function select(item:string){change(item);setOpen(false);trigger.current?.focus()}
 const matches=options.filter(o=>o.toLowerCase().includes(query.toLowerCase()))
 return <div className="facet" ref={root} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false)}} onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);trigger.current?.focus()}}}>
  <button className="facetButton" ref={trigger} type="button" aria-expanded={open} data-selected={!!value} onClick={()=>{setQuery('');setOpen(!open)}}><span>{name}</span>{value&&<strong>{value}</strong>}<span aria-hidden="true">⌄</span></button>
  {open&&<div className="facetPanel" aria-label={name}>{searchable&&<input autoFocus aria-label={'Find '+name.toLowerCase()} placeholder={'Find '+name.toLowerCase()+'…'} value={query} onChange={e=>setQuery(e.target.value)}/>}<div className="facetList">{['',...matches].map(item=><button key={item} type="button" aria-pressed={value===item} onClick={()=>select(item)}>{item||'Any '+name.toLowerCase()}<span aria-hidden="true">{value===item?'✓':''}</span></button>)}{!matches.length&&<small>No matches</small>}</div></div>}
 </div>
}
export function SearchToolbar({search,onSearch,facets,recent,onRecent}:{search:string,onSearch:(v:string)=>void,facets:Facet[],recent:boolean,onRecent:()=>void}){
 return <div className="libraryTools"><div className="librarySearch"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input id="question-search" aria-label="Search questions" placeholder="Search question text, topics, or trials" value={search} onChange={e=>onSearch(e.target.value)}/>{search&&<button aria-label="Clear search" onClick={()=>{onSearch('');document.getElementById('question-search')?.focus()}}>×</button>}</div><div className="facetRow">{facets.map(f=><FacetPicker key={f.name} {...f}/>)}<button className="recentSwitch" aria-pressed={recent} onClick={onRecent}>New additions</button></div></div>
}
