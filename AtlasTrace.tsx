import React,{useEffect,useRef} from 'react'

// An illustrative nephron motif, traced with page scroll progress.
const curve='M8 82 C31 82 31 49 60 49 C93 49 98 96 64 102 C33 107 29 65 56 59 C78 53 88 80 68 88 C54 94 44 77 56 69 C71 59 86 75 99 69 C112 62 101 42 119 40 C141 38 126 72 146 73 C165 74 158 45 175 48 C194 51 180 78 182 116 C184 170 206 176 212 132 L219 79 C222 52 240 48 247 67 C256 89 266 93 275 71 C282 51 295 54 300 68 C308 90 318 89 330 77 L355 62'
export default function AtlasTrace(){
 const trace=useRef<SVGPathElement>(null)
 useEffect(()=>{
  const path=trace.current
  if(!path)return
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)')
  let frame=0
  function draw(){
   frame=0
   const range=document.documentElement.scrollHeight-window.innerHeight
   const progress=Math.min(1,Math.max(0,(window.scrollY)/(Math.max(1,range))))
   path!.style.strokeDashoffset=String(reduced.matches?0:0.5*(1-progress))
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(draw)}
  draw()
  window.addEventListener('scroll',schedule,{passive:true})
  window.addEventListener('resize',schedule)
  reduced.addEventListener('change',schedule)
  return ()=>{cancelAnimationFrame(frame);window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);reduced.removeEventListener('change',schedule)}
 },[])
 return <svg className="atlasTrace" viewBox="0 0 365 175" aria-hidden="true" focusable="false">
  <g fill="none" strokeLinecap="round" strokeLinejoin="round">
   <path d={curve} stroke="#a2c4af" strokeWidth="11" opacity=".10"/>
   <path d={curve} stroke="#99bea8" strokeWidth="2" opacity=".56"/>
   <path ref={trace} d={curve} pathLength="1" stroke="#38654e" strokeWidth="3" strokeDasharray="1 1" strokeDashoffset=".5"/>
  </g>
 </svg>
}
