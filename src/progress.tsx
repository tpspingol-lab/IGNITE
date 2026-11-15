import { useEffect, useState } from 'react';
import { currentRatings, dateLabel, monday, outcomeDay, pillars, plusDays, scales, stages, validRating, version, weekDays, weekly } from './wellbeing';
import type { Check, Ratings, StepOutcome } from './wellbeing';

type Props = {
  today:string; selected:string; checks:Check[]; outcomes:StepOutcome[]; zone:string;
  drafts:Record<string,Ratings>; writeDraft:(day:string,ratings?:Ratings)=>void;
  select:(date:string)=>void; edit:(date:string)=>void; save:(date:string, ratings:Ratings)=>boolean;
  remove:(date:string)=>void; context:(date:string)=>string[];
  editOutcome:(id:string,outcome:string,barrier:string)=>boolean; deleteOutcome:(id:string)=>void;
};
const display = (score:number|null)=>score===null?'Gathering data':score.toFixed(1)+' / 5';
const range = (start:string,end:string)=>dateLabel(start)+' – '+dateLabel(end);

export function Progress({today,selected,checks,drafts,writeDraft,outcomes,zone,select,edit,save,remove,context,editOutcome,deleteOutcome}:Props) {
  const week = monday(selected);
  const current = monday(today);
  const firstDate = checks.map(check=>check.date).filter(date=>date<=today).sort()[0];
  const days = weekDays(week);
  const elapsed = days.filter(date=>date<=today);
  const priorWeek = plusDays(week,-7);
  const now = weekly(checks,elapsed);
  const prior = weekly(checks,weekDays(priorWeek).slice(0,elapsed.length));
  const steps = outcomes.map(record=>({record,day:outcomeDay(record,zone)})).filter(({day})=>elapsed.includes(day));
  const byDay = currentRatings(checks);
  const entry = byDay.get(selected);
  const history = checks.filter(row=>row.version!==version && row.date===selected);
  const details = context(selected);
  const [editing,setEditing] = useState<string>();
  useEffect(()=>setEditing(undefined),[selected]);
  const draft = entry && editing===selected ? drafts[selected]??entry.ratings : undefined;
  const [stepEdit,setStepEdit] = useState<{id:string; outcome:string; barrier:string}>();
  const compared = now.comparisonScore!==null && prior.comparisonScore!==null;
  const comparison = [
    { label:'Previous week', dates:range(priorWeek,plusDays(priorWeek,elapsed.length-1)), stats:prior },
    { label:'Selected week', dates:range(week,elapsed.at(-1)??week), stats:now }
  ];
  const mostRated = [...byDay.values()].filter(row=>elapsed.includes(row.date)).sort((a,b)=>b.ratings.filter(validRating).length-a.ratings.filter(validRating).length || b.date.localeCompare(a.date))[0];
  const incomplete = mostRated?.date ?? (week===current?today:selected);
  const missing = pillars.filter((_,index)=>!validRating(mostRated?.ratings[index])).map(([name])=>name);
  return <>
    <div className="week-controls">
      <button aria-label="Previous week" onClick={()=>select(priorWeek)}>‹</button>
      <strong className="enter" key={week}>{dateLabel(week)} – {dateLabel(plusDays(week,6),{month:'short',day:'numeric',year:'numeric'})}</strong>
      <button aria-label="Next week" disabled={week>=current} onClick={()=>select(plusDays(week,7)===current?today:plusDays(week,7))}>›</button>
      <button onClick={()=>select(today)}>This week</button>
      {firstDate && <button onClick={()=>select(firstDate)}>First check-in</button>}
    </div>
    {firstDate && <p className="hint">First check-in {dateLabel(firstDate,{month:'long',day:'numeric',year:'numeric'})}</p>}
    <div className="atlas">
      <section className="card monitor">
        <div className="ring" style={{ '--ring-fill':String((now.score??0)/5*100)+'%' } as React.CSSProperties}><div><strong>{now.stage}</strong>{now.score!==null && <span>{display(now.score)}</span>}</div></div>
        {now.score!==null ? <p className="hint monitor-copy">Based on {now.ratedDays} rated {now.ratedDays===1?'day':'days'} · {now.completed} complete {now.completed===1?'check-in':'check-ins'} this week.</p>
          : <div className="monitor-copy"><p className="hint">A complete check-in unlocks the stage. {mostRated?'Missing on '+dateLabel(incomplete)+': ': 'Missing: '}{missing.join(', ')}.</p>
            <button onClick={()=>edit(incomplete)}>{mostRated?.ratings.some(validRating)?'Finish check-in':incomplete===today?'Rate today':'Rate '+dateLabel(incomplete)}</button></div>}
        <div className="stage-list">{stages.map(stage=><span key={stage} className={stage===now.stage?'chosen':''}>{stage}</span>)}</div>
      </section>
      <div className="card table-wrap" tabIndex={0} aria-label="Scrollable weekly ratings">
        <table><thead><tr><th scope="col">Pillar</th>{days.map(date=><th key={date} scope="col"><button aria-label={dateLabel(date,{weekday:'long',month:'long',day:'numeric'})} aria-pressed={selected===date} disabled={date>today} onClick={()=>select(date)}>{dateLabel(date,{weekday:'short'})}<small>{dateLabel(date,{month:'numeric',day:'numeric'})}</small></button></th>)}<th scope="col">Coverage</th></tr></thead>
        <tbody>{pillars.map(([name],i)=><tr key={name}><th scope="row">{name}</th>{days.map(date=>{
          const record=date<=today?byDay.get(date):undefined;
          const value=record?.ratings[i];
          return <td key={dateLabel(date,{weekday:'short'})} className={selected===date?'selected-day':''} data-rating={validRating(value)?value:undefined}><span className="enter" key={date} aria-label={validRating(value)?undefined:record?'Skipped':'No entry'}>{validRating(value)?value:record?'···':'—'}</span></td>;
        })}<td>{now.coverage[i]} / {elapsed.length}</td></tr>)}</tbody></table>
        <p className="hint grid-legend">··· Skipped · — No entry</p>
      </div>
    </div>
    <div className="atlas-details">
      <section className="card"><h2>Compared with last week</h2>
        {comparison.map(({label,dates,stats})=><div className="comparison" key={label}>
          <div className="paired"><span>{label} · {dates}</span><strong>{display(stats.comparisonScore)}</strong></div>
          {compared ? <><meter min={1} max={5} value={stats.comparisonScore!} aria-label={label+' rating on a scale of 1 to 5'}/><p className="hint">{stats.ratedDays} rated days · pillar coverage {stats.coverage.join(', ')} in grid order</p></>
            : <p className="hint">{stats.comparisonScore!==null?'Coverage met.':pillars.flatMap(([name],i)=>stats.coverage[i]<3?[name+' '+stats.coverage[i]+' / 3']:[]).join(' · ')}</p>}
        </div>)}
        <p className="hint">{week===current?'Compares the same elapsed weekdays. ':''}{compared?'Both bars use the same 1–5 scale. Difference: '+((now.comparisonScore??0)-(prior.comparisonScore??0)).toFixed(1)+' rating points.':'Both periods need three rated days for each pillar.'}</p>
      </section>
      <section className="card"><h2>{dateLabel(selected,{weekday:'long',month:'long',day:'numeric'})}</h2>
        {entry ? <><p className="hint">{!entry.ratings.some(validRating)?'Submitted · all pillars skipped':entry.ratings.every(validRating)?'Complete check-in':'Partial check-in'}</p>
          {draft ? <form onSubmit={event=>{event.preventDefault();if(save(selected,draft))setEditing(undefined);}}>
            {pillars.map(([name,question],i)=><label className="rating-field" key={name}>{question}<select aria-label={question} value={draft[i]??''} onChange={event=>{const next=[...draft] as Ratings;next[i]=event.target.value?Number(event.target.value):null;writeDraft(selected,next);}}><option value="">Skip this question</option>{scales.map((scale,n)=><option key={scale} value={n+1}>{n+1} {scale}</option>)}</select></label>)}
            <div className="actions"><button className="primary">Save ratings</button><button type="button" onClick={()=>{writeDraft(selected);setEditing(undefined);}}>Cancel</button></div>
          </form> : pillars.map(([name],i)=><div className="paired" key={name}><span>{name}</span><strong>{validRating(entry.ratings[i])?entry.ratings[i]+' / 5':'Skipped'}</strong></div>)}
        </> : <p>No pillar ratings for this day.</p>}
        {(entry || history.length>0 || details.length>0) && <details><summary>Details</summary>
          {entry?.note && <p>{entry.note}</p>}{entry?.tag && <p>Emotion tag: {entry.tag}</p>}{entry && <p className="hint">{entry.zone}</p>}
          {history.map((check,i)=><p key={i}>Historical check-in ({check.version}): {check.ratings.map(value=>value??'Skipped').join(' · ')} {check.note}</p>)}
          {!!details.length && <><h3>Health context</h3><ul>{details.map((item,i)=><li key={i}>{item}</li>)}</ul></>}
        </details>}
        <div className="actions">{!draft && <button onClick={()=>entry?setEditing(selected):edit(selected)}>{entry?(drafts[selected]?'Resume editing ratings':'Edit ratings'):'Add ratings'}</button>}{entry && <button onClick={()=>{setEditing(undefined);remove(selected);}}>Delete check-in</button>}</div>
      </section>
    </div>
    <section className="card"><h2>Steps this week</h2>
      {steps.length ? <ul className="history step-history">{steps.map(({record,day})=><li key={record.id}>
        <time dateTime={day}>{dateLabel(day)}</time><span>{record.step.title}</span><span className="pill">{record.outcome}{record.barrier && ' · '+record.barrier}</span>
        {stepEdit?.id===record.id ? <form onSubmit={event=>{event.preventDefault();if(editOutcome(record.id,stepEdit.outcome,stepEdit.barrier))setStepEdit(undefined);}}>
          <label>Outcome<select value={stepEdit.outcome} onChange={event=>setStepEdit({...stepEdit,outcome:event.target.value})}>{['','Done','Partly done','Skipped'].map(value=><option key={value} value={value}>{value||'No outcome recorded'}</option>)}</select></label>
          <label className="toggle"><input type="checkbox" checked={stepEdit.barrier==='Too big'} onChange={event=>setStepEdit({...stepEdit,barrier:event.target.checked?'Too big':''})}/>Felt too big</label>
          <div className="actions"><button className="primary">Save outcome</button><button type="button" onClick={()=>setStepEdit(undefined)}>Cancel</button></div>
        </form>:<div className="actions"><button onClick={()=>setStepEdit({id:record.id,outcome:record.outcome,barrier:record.barrier})}>Edit outcome</button><button onClick={()=>deleteOutcome(record.id)}>Delete entry</button></div>}
      </li>)}</ul> : <p>No completed step entries in this week.</p>}
    </section>
  </>;
}
