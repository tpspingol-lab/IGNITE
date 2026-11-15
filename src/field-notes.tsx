import { useEffect, useRef, useState } from 'react';
import { pillars } from './wellbeing';

const guides = [
  {group:0,name:'Sleep',title:'Leave room to wind down',action:'Take two minutes to wind down.',text:'Set aside a few quiet minutes before your target bedtime. Try reading one page or putting away tomorrow’s things.',source:'NHS · Sleep',url:'https://www.nhs.uk/every-mind-matters/mental-wellbeing-tips/how-to-fall-asleep-faster-and-sleep-better/'},
  {group:0,name:'Meals & energy',title:'Plan one easy meal',action:'Write down one meal you can make with what you have.',text:'Look for an ingredient you already have and build one meal around it. Beans, rice, and frozen vegetables are one option. Write down missing ingredients and choose a time that fits your day.',source:'USDA SNAP-Ed · Eating better on a budget',url:'https://snaped.fns.usda.gov/snap/resourcefinder/EatingBetterBudget_EnglishVietnamese.pdf'},
  {group:1,name:'Stress',title:'A calmer response to overwhelm',action:'Pause and choose one thing you can do now.',text:'Put the pressing things on paper. Circle one part you can start in two minutes, such as opening the document or writing the first heading.',source:'NHS · Stress',url:'https://www.nhs.uk/mental-health/feelings-symptoms-behaviours/feelings-and-symptoms/stress/'},
  {group:2,name:'Confidence',title:'Practice noticing what went well',action:'Name one thing you handled well.',text:'Think of one thing you handled today. If you have a conversation coming up, rehearse one sentence you could use with someone you trust.',source:'NHS · Raising low self-esteem',url:'https://www.nhs.uk/mental-health/self-help/tips-and-support/raise-low-self-esteem/'},
  {group:3,name:'Habits',title:'Make the next action easy to repeat',action:'Decide when you will try one small action.',text:'Attach one action to something you already do, such as putting your bag by the door after dinner. If you miss a day, see what would make the next try easier.',source:'NIDDK · Changing your habits',url:'https://www.niddk.nih.gov/health-information/diet-nutrition/changing-habits-better-health'}
];
type Props = {scratch:string; editScratch:(note:string)=>void; saveNote:(note:string)=>boolean; addStep:(title:string)=>boolean; openToday:()=>void; openJournal:()=>void; openMeals:()=>void; smaller?:string; savedGuides?:string[]; toggleGuide?:(name:string)=>boolean};
export function FieldNotes({scratch,editScratch,saveNote,addStep,openToday,openJournal,openMeals,smaller,savedGuides,toggleGuide}:Props) {
  const [guide,setGuide] = useState<typeof guides[number]>();
  const [ends,setEnds] = useState<number>();
  const [seconds,setSeconds] = useState(0);
  const [feedback,setFeedback] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const triggers = useRef<Record<string,HTMLButtonElement|null>>({});
  useEffect(()=>{if(guide)heading.current?.focus();},[guide]);
  useEffect(()=>{
    if (!ends) return;
    const timer = window.setInterval(()=>{
      const remaining=Math.max(0,Math.ceil((ends-Date.now())/1000));
      setSeconds(remaining);
      if(remaining===0){setEnds(undefined);setFeedback('Your 60-second pause is complete.');}
    },250);
    return ()=>window.clearInterval(timer);
  },[ends]);
  function useAction(text:string) {
    if (window.confirm('Use this action as your next step on Today?') && addStep(text)) openToday();
  }
  function start() {setFeedback('Silent timer started.');setSeconds(60);setEnds(Date.now()+60000);}
  return <>
    <section className="card"><h2>Field Notes</h2><div className="guide-spread">
      <div className="guide-index">{pillars.map(([name],i)=><section key={name}><h3>{name}</h3><ul className="guide-list">{guides.filter(item=>item.group===i).map(item=><li key={item.name}>
        <button ref={node=>{triggers.current[item.name]=node;}} aria-pressed={guide?.name===item.name} onClick={()=>setGuide(item)}>{item.name}<span aria-hidden="true">→</span></button>
      </li>)}</ul></section>)}</div>
      {guide ? <article className="enter"><button className="text-button" onClick={()=>{setGuide(undefined);triggers.current[guide.name]?.focus();}}>← Back to resources</button>
        <h2 ref={heading} tabIndex={-1}>{guide.title}</h2><p>{guide.text}</p><p><a href={guide.url} target="_blank" rel="noreferrer">{guide.source} ↗</a></p>
        {guide.name==='Meals & energy' && <button className="text-button" onClick={openMeals}>Open Health → Meals</button>}
        <div className="actions"><button className="primary" onClick={()=>useAction(guide.action)} aria-label="Add action to Today">Add as a micro-step</button>
          {toggleGuide && <button onClick={()=>toggleGuide(guide.name)}>{savedGuides?.includes(guide.name)?'Unsave guide':'Save guide'}</button>}</div>
      </article> : <p className="hint">Choose a guide for a small action you can try today.</p>}
    </div></section>
    <section className="card"><h2>Quick Resets</h2>
      <div className="reset-grid"><article><h3>60-second breathing pause</h3><p>Breathe at a comfortable pace while the silent timer runs. You can stop whenever you like.</p>
        <div className="actions"><button className="primary" onClick={ends?()=>{setEnds(undefined);setSeconds(0);setFeedback('Timer stopped.');}:start}>{ends?'Stop timer':'Start 60-second timer'}</button>
        <span aria-hidden="true" className="reset-clock">{ends?Math.floor(seconds/60)+':' + String(seconds % 60).padStart(2,'0'):'1:00'}</span></div>
        <button className="text-button" onClick={()=>useAction('Pause and breathe comfortably for one minute.')}>Add breathing pause as a micro-step</button></article>
      {smaller && <article><h3>When a step feels too big</h3><p>{smaller}</p><p className="hint">Suggested because you marked a step Too big.</p><button className="text-button" onClick={()=>useAction(smaller)}>Add smaller action as a micro-step</button></article>}</div>
      <form onSubmit={e=>{e.preventDefault();const note=scratch.trim();if(note && saveNote(note))setFeedback('Scratchpad saved to Today’s note.');}}>
        <label>Scratchpad<input value={scratch} maxLength={180} onChange={e=>editScratch(e.target.value)} placeholder="A thought, intention, or next step"/></label><div className="actions"><button disabled={!scratch.trim()}>Save to Today’s note</button></div>
      </form>
      <button className="text-button" onClick={openJournal}>Open Today’s journal for an emotion suggestion</button>
      {feedback && <p className="hint" role="status">{feedback}</p>}
    </section>
  </>;
}
