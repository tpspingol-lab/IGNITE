import { useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { dateLabel, plusDays, timeLabel } from './wellbeing';
import type { Settings } from './wellbeing';
import { defaultCupMl, durationText, movementMinutes, parseVolume, sleepBand, sleepBands, sleepMinutes, volumeNumber, volumeText } from './health-records';
import type { HealthGroup, HealthLog, SleepBand, WaterUnits } from './health-records';
import type { Extras } from './extras';
import catalog from './catalog.json';
import { Icon } from './icons';
import './health.css';

const healthTabs = [
  { section: 'Hydration', label: 'Water', icon: 'Water', group: 'water' },
  { section: 'Sleep', label: 'Sleep', icon: 'Sleep', group: 'sleep' },
  { section: 'Meals', label: 'Meals', icon: 'Meal', group: 'meals' },
  { section: 'Activity', label: 'Movement', icon: 'Movement', group: 'activity' },
] as const;
const entryNames = { water: 'water', sleep: 'sleep', meals: 'meal', activity: 'movement' };
const qualities = ['Poor', 'Fair', 'Good', 'Very good'];
const inputVolume = (ml: number, units: WaterUnits) => Number(volumeNumber(ml, units).toFixed(2));
const formatter = new Intl.NumberFormat();

export function mealDetails(label: string, grams?: number) {
  const food = label.toLowerCase();
  const match = grams && Object.hasOwn(catalog, food) ? catalog[food as keyof typeof catalog] : undefined;
  const factor = (grams ?? 0) / 100;
  return {
    text: label + (grams ? ` · ${grams} g` : '') + (match ? ` · approx. ${Math.round(match.kcal * factor)} kcal` : ''),
    estimate: match ? `Estimated per confirmed portion: ${Math.round(match.kcal * factor)} kcal · Protein ${(match.protein * factor).toFixed(1)} g · Carbs ${(match.carbs * factor).toFixed(1)} g · Fat ${(match.fat * factor).toFixed(1)} g` : 'No nutrition estimate for this dish.',
  };
}

export function Health({ data, update, date, zone, section, setSection, windDown, units, clockStyle, meals }: {
  data: Extras;
  update: (patch: Partial<Extras>, message: string) => boolean;
  date: string;
  zone: string;
  section: string;
  setSection: (section: string) => void;
  windDown: boolean;
  units: WaterUnits;
  clockStyle: Settings['clockStyle'];
  meals: (save: (label: string, day: string, grams?: number) => boolean) => ReactNode;
}) {
  const active = healthTabs.find(tab => tab.section === section) ?? healthTabs[0];
  const [day, setDay] = useState('');
  const [undo, setUndo] = useState<{group: HealthGroup; row: HealthLog; index: number}>();
  const [edit, setEdit] = useState<{group: HealthGroup; row: HealthLog}>();
  const editHeading = useRef<HTMLHeadingElement>(null);
  const previousFocus = useRef<HTMLButtonElement | null>(null);
  const historyHeading = useRef<HTMLHeadingElement>(null);
  const historyDay = day || date;
  const group = active.group;
  const rows = data[group].filter(row => row.day === historyDay);
  const volume = (ml: number) => volumeText(ml, units);
  const makeRow = (day: string, value: Omit<HealthLog, 'id' | 'day'>): HealthLog => ({
    ...value, id: crypto.randomUUID(), day, zone, enteredAt: new Date().toISOString(),
  });

  function save(entryGroup: HealthGroup, entryDay: string, value: Omit<HealthLog, 'id' | 'day'>) {
    if (!entryDay || entryDay > date) return false;
    const items = data[entryGroup];
    const existing = entryGroup === 'sleep' ? items.find(row => row.day === entryDay) : undefined;
    const row = existing
      ? {...existing, ...value, minutes: value.minutes, band: value.band, quality: value.quality}
      : makeRow(entryDay, value);
    const next = existing ? items.map(item => item.id === row.id ? row : item) : [...items, row];
    if (!update({ [entryGroup]: next }, 'Saved on this device.')) return false;
    setDay(entryDay);
    return true;
  }

  function remove(entryGroup: HealthGroup, row: HealthLog, offerUndo: boolean) {
    const entries = data[entryGroup];
    const index = entries.findIndex(item => item.id === row.id);
    if (index < 0) return;
    if (update({ [entryGroup]: entries.filter(item => item.id !== row.id) }, 'Entry removed on this device.')) {
      if (offerUndo) setUndo({group: entryGroup, row, index});
      if (edit?.row.id === row.id && edit.group === entryGroup) setEdit(undefined);
      requestAnimationFrame(() => historyHeading.current?.focus());
    }
  }

  function undoDeletion() {
    if (!undo) return;
    const next = [...data[undo.group]];
    if (!next.some(item => item.id === undo.row.id)) next.splice(undo.index, 0, undo.row);
    if (update({[undo.group]: next}, 'Entry restored on this device.')) {
      setUndo(undefined);
      requestAnimationFrame(() => historyHeading.current?.focus());
    }
  }

  function closeEditor() {
    setEdit(undefined);
    requestAnimationFrame(() => {
      if (previousFocus.current?.isConnected) previousFocus.current.focus();
      else historyHeading.current?.focus();
    });
  }

  function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!edit || !data[edit.group].some(row => row.id === edit.row.id)) return;
    const fields = new FormData(event.currentTarget);
    const assigned = String(fields.get('date'));
    const before = edit.row;
    let patch: Partial<HealthLog>;
    if (!assigned || assigned > date) return;
    if (edit.group === 'water') {
      const raw = fields.get('ml');
      const ml = parseVolume(raw, units);
      if (!raw && before.ml === undefined) patch = {};
      else {
        if (ml < 1 || ml > 5000) return;
        patch = { ml, text: volumeText(ml) };
      }
    } else if (edit.group === 'sleep') {
      patch = fields.get('durationType') === 'original' ? {} : sleepValue(fields);
      if (assigned !== before.day && data.sleep.some(row => row.day === assigned)) {
        event.currentTarget.querySelector<HTMLInputElement>('input[name=date]')?.setCustomValidity('There is already a sleep entry for this wake date.');
        event.currentTarget.reportValidity();
        return;
      }
    } else if (edit.group === 'activity') {
      const label = String(fields.get('label')).trim();
      const minutes = Number(fields.get('duration'));
      if (!label) return;
      patch = {label, minutes, text: `${label} · ${minutes} min`};
    } else {
      const label = String(fields.get('label')).trim();
      const grams = Number(fields.get('grams')) || undefined;
      if (!label) return;
      patch = {label, grams, text: mealDetails(label, grams).text};
    }
    const next = {...before, ...patch, day: assigned};
    if (update({[edit.group]: data[edit.group].map(row => row.id === next.id ? next : row)}, 'Changes saved on this device.')) {
      setDay(assigned);
      closeEditor();
    }
  }

  return <div className="health-sheet">
    <div className="subnav" aria-label="Health tools">
      {healthTabs.map(tab => <button key={tab.section} aria-pressed={group === tab.group} onClick={() => setSection(tab.section)}><Icon name={tab.icon}/>{tab.label}</button>)}
    </div>
    <section hidden={group !== 'water'}><Water data={data} date={date} units={units} update={update} save={(ml, stamped)=>save('water', stamped, {ml,text:volumeText(ml)})} undoAdd={row=>remove('water', row, false)}/></section>
    <section hidden={group !== 'sleep'}><h3>{windDown ? 'Time to wind down' : 'How did you sleep?'}</h3>
      <p className="hint">Save a rough range or enter the duration for your wake date. A new entry for the same wake date updates it.</p>
      <div className="actions" aria-label="Quick sleep ranges">{sleepBands.map(band=><button key={band} onClick={()=>save('sleep', date, {band, text:band+' · Approximate'})}>Log {band}</button>)}</div>
      {edit?.group !== 'sleep' && <form onSubmit={event=>{
        event.preventDefault();
        const fields = new FormData(event.currentTarget);
        save('sleep', String(fields.get('date')), sleepValue(fields));
      }}><div className="form-grid"><SleepDuration type="precise"/><EventDate label="Wake date" day={date} date={date}/><SleepQuality/></div><button className="primary">Save sleep</button></form>}
      <details className="health-schedule"><summary>Sleep schedule</summary>
        <p className="hint">Wind down at <time dateTime={data.win}>{timeLabel(data.win,clockStyle)}</time> · Target wake time <time dateTime={data.wake}>{timeLabel(data.wake,clockStyle)}</time></p>
        <form onSubmit={event=>{event.preventDefault();const fields=new FormData(event.currentTarget);update({win:String(fields.get('wind')),wake:String(fields.get('wake'))},'Sleep schedule saved on this device.');}}>
          <div className="form-grid"><label>Wind-down time<input name="wind" type="time" required defaultValue={data.win}/></label><label>Target wake time<input name="wake" type="time" required defaultValue={data.wake}/></label></div><button>Save schedule</button>
        </form>
      </details>
    </section>
    <section hidden={group !== 'activity'}><h3>Log movement</h3>
      <div className="actions"><button onClick={()=>save('activity', date, {label:'Walk',minutes:10,text:'Walk · 10 min'})}>Log 10-minute walk</button><button onClick={()=>save('activity', date, {label:'Stretch',minutes:5,text:'Stretch · 5 min'})}>Log 5-minute stretch</button></div>
      <form onSubmit={event=>{
        event.preventDefault();
        const fields=new FormData(event.currentTarget);
        const label=String(fields.get('label')).trim();
        const minutes=Number(fields.get('duration'));
        if (label && save('activity', String(fields.get('date')), {label,minutes,text:`${label} · ${minutes} min`})) event.currentTarget.reset();
      }}><div className="form-grid"><label>Movement<input name="label" maxLength={80} required placeholder="Easy walk"/></label><label>Minutes<input name="duration" type="number" min="1" max="1440" defaultValue="20" required/></label><EventDate label="Activity date" day={date} date={date}/></div><button className="primary">Log activity</button></form>
    </section>
    <section hidden={group !== 'meals'}>{meals((label, stamped, grams)=>save('meals', stamped, {label, grams, text:mealDetails(label,grams).text}))}</section>
    <Summary rows={data[group]} group={group} date={date} units={units}/>
    <section className="health-history" aria-labelledby="health-history">
      <div className="health-history-heading"><h3 id="health-history" ref={historyHeading} tabIndex={-1}>Daily history</h3><label>History date<input type="date" value={historyDay} max={date} onChange={event=>setDay(event.target.value)}/></label></div>
      {undo?.group === group && <button onClick={undoDeletion}>Undo deletion</button>}
      {!!rows.length ? <ul className="log-list">{rows.map(row=><li key={row.id}>
        <span>{group==='water' && row.ml !== undefined ? volume(row.ml) : row.text}</span>
        <div className="actions">
          <button aria-label={`Edit ${entryNames[group]} entry`} onClick={event=>{previousFocus.current=event.currentTarget;setEdit({group,row}); requestAnimationFrame(()=>editHeading.current?.focus());}}>Edit</button>
          <button aria-label={`Delete ${entryNames[group]} entry`} onClick={()=>remove(group,row,true)}>Delete</button>
        </div>
      </li>)}</ul> : <p className="hint">No entries for this date.</p>}
      {edit?.group === group && <form className="health-editor" key={edit.row.id} onSubmit={saveEdit}>
        <h4 ref={editHeading} tabIndex={-1}>Edit {entryNames[group]} entry</h4>
        <div className="form-grid">
          <EventDate label={group==='sleep' ? 'Wake date' : 'Entry date'} day={edit.row.day} date={date}/>
          <EditFields group={group} row={edit.row} units={units}/>
        </div>
        <div className="actions"><button className="primary">Save entry changes</button><button type="button" onClick={closeEditor}>Cancel</button></div>
      </form>}
    </section>
  </div>;
}

function EventDate({label, day, date}:{label:string;day:string;date:string}) {
  return <label>{label}<input name="date" type="date" max={date} defaultValue={day} required onChange={event=>event.target.setCustomValidity('')}/></label>;
}

function SleepDuration({type, row}:{type:'precise'|'approximate';row?:HealthLog}) {
  if (type === 'approximate') return <label>Sleep range<select name="band" defaultValue={row ? sleepBand(row) ?? sleepBands[2] : sleepBands[2]}>{sleepBands.map(band=><option key={band}>{band}</option>)}</select></label>;
  const minutes = row ? sleepMinutes(row) : 420;
  return <><label>Hours slept<input type="number" name="hours" min="0" max="23" defaultValue={minutes === undefined ? undefined : Math.floor(minutes/60)} required/></label>
    <label>Extra minutes<input type="number" name="minutes" min="0" max="59" defaultValue={(minutes ?? 0)%60} required/></label></>;
}

function SleepQuality({value}:{value?:string}) {
  return <label>Sleep quality<select name="quality" defaultValue={value ?? ''}><option value="">Skip</option>{qualities.map(quality=><option key={quality}>{quality}</option>)}</select></label>;
}

function sleepValue(fields: FormData) {
  const band = (fields.get('band') ?? undefined) as SleepBand | undefined;
  const minutes = band ? undefined : Number(fields.get('hours'))*60 + Number(fields.get('minutes'));
  const quality = String(fields.get('quality') ?? '');
  const label = band ? band+' · Approximate' : durationText(minutes ?? 0);
  return {band, minutes, quality, text: label + (quality ? ' · '+quality : '')};
}

function EditFields({group,row,units}:{group:HealthGroup;row:HealthLog;units:WaterUnits}) {
  const unknownSleep = !sleepBand(row) && sleepMinutes(row) === undefined;
  const [durationType, setDurationType] = useState<'precise'|'approximate'|'original'>(sleepBand(row) ? 'approximate' : unknownSleep ? 'original' : 'precise');
  if (group === 'water') return <label>Amount ({units==='metric' ? 'mL' : 'fl oz'})<input name="ml" type="number" required={row.ml!==undefined} min={units==='metric' ? 1 : 0.04} max={inputVolume(5000,units)} step={units==='metric' ? 1 : 'any'} defaultValue={row.ml===undefined ? '' : inputVolume(row.ml,units)}/></label>;
  if (group === 'sleep') return <>
    <label>Sleep duration type<select name="durationType" value={durationType} onChange={event=>setDurationType(event.target.value as typeof durationType)}>{unknownSleep && <option value="original">Keep original duration</option>}<option value="precise">Precise duration</option><option value="approximate">Approximate range</option></select></label>
    {durationType !== 'original' && <><SleepDuration key={durationType} type={durationType} row={row}/><SleepQuality value={row.quality ?? row.text.split(' · ').find(quality=>qualities.includes(quality))}/></>}
  </>;
  if (group === 'activity') return <>
    <label>Activity name<input name="label" required maxLength={80} defaultValue={row.label ?? row.text.replace(/ · \d+ min$/, '')}/></label>
    <label>Activity duration (minutes)<input name="duration" type="number" min="1" max="1440" required defaultValue={movementMinutes(row)}/></label>
  </>;
  const legacy = /^(.*?)(?: · (\d+) g)?(?: · approx\. \d+ kcal)?$/.exec(row.text);
  return <><label>Food name<input name="label" required maxLength={80} defaultValue={row.label ?? legacy?.[1] ?? row.text}/></label><label>Serving (grams)<input name="grams" type="number" min="1" max="5000" defaultValue={row.grams ?? legacy?.[2]}/></label></>;
}

function Water({data,date,units,update,save,undoAdd}:{data:Extras;date:string;units:WaterUnits;update: (patch:Partial<Extras>,message:string)=>boolean;save:(ml:number,date:string)=>boolean;undoAdd:(row:HealthLog)=>void}) {
  const [entered,setEntered] = useState('');
  const [preferences,setPreferences] = useState(false);
  const [showAmount,setShowAmount] = useState(false);
  const now = data.water.filter(row=>row.day===date);
  const total = now.reduce((sum,row)=>sum+(row.ml ?? 0),0);
  const totalUnknown = now.filter(row=>row.ml===undefined).length;
  const cup = data.waterCupMl ?? defaultCupMl;
  const goal = data.waterGoalMl;
  const unit = units==='us' ? 'fl oz' : 'mL';
  const format = (ml:number) => volumeText(ml,units);
  const progress = goal ? Math.round(total/goal*100) : 0;
  const amount = showAmount && entered ? parseVolume(entered,units) : cup;
  return <>
    <section className="health-total" aria-label="Today's water" aria-live="polite" aria-atomic="true"><p className="water-total">{format(total)}</p><span className="water"><strong>{now.length}</strong> {now.length===1 ? 'log' : 'logs'}</span></section>
    {totalUnknown > 0 && <p className="hint">{totalUnknown} earlier {totalUnknown===1 ? 'entry has' : 'entries have'} unknown volume.</p>}
    {goal && <div className="water-goal">
      <p>{total < goal ? format(goal-total)+' to your '+format(goal)+' goal' : 'You reached your '+format(goal)+' goal.'}</p>
      <div className="water-meter"><progress aria-label="Progress toward your water goal" aria-valuetext={progress+'%'} max={100} value={Math.min(100,progress)}/><span>{progress}%</span></div>
    </div>}
    <form onSubmit={event=>{
      event.preventDefault();
      if (amount>=1 && amount<=5000 && save(amount,date)) setEntered('');
    }}>
      <div className="actions"><button className="primary">Add a glass · {format(amount)}</button>
      <button type="button" disabled={!now.length} onClick={()=>{const last=now.at(-1);if(last)undoAdd(last);}}>Undo</button>
      <button type="button" onClick={()=>setShowAmount(!showAmount)} aria-expanded={showAmount}>Precise amount</button>
      <button type="button" onClick={()=>setPreferences(!preferences)} aria-expanded={preferences}>{goal ? 'Edit goal and cup' : 'Set a goal'}</button>
      {!goal && <button type="button" className="text-button" onClick={()=>setPreferences(true)}>Edit cup size</button>}</div>
      <div className="form-grid" hidden={!showAmount}><label>Volume ({unit})<input type="number" value={entered} placeholder={String(inputVolume(cup,units))} min={units==='metric' ? 1 : 0.04} max={inputVolume(5000,units)} step={units==='metric' ? 1 : 'any'} onChange={event=>setEntered(event.target.value)}/></label></div>
    </form>
    {preferences && <form className="health-editor" onSubmit={event=>{
      event.preventDefault();
      const fields=new FormData(event.currentTarget);
      const waterCupMl=parseVolume(fields.get('cup'),units);
      const waterGoalMl=parseVolume(fields.get('goal'),units) || undefined;
      if (waterCupMl>=1 && waterCupMl<=5000 && (waterGoalMl ?? 0)<=10000 && update({waterCupMl,waterGoalMl},'Water preferences saved on this device.')) setPreferences(false);
    }}><div className="form-grid">
      <label>Quick-add cup size ({unit})<input name="cup" type="number" required min={units==='metric' ? 1 : 0.04} max={inputVolume(5000,units)} step={units==='metric' ? 1 : 'any'} defaultValue={inputVolume(cup,units)}/></label>
      <label>Daily goal ({unit})<input name="goal" type="number" min={units==='metric' ? 1 : 0.04} max={inputVolume(10000,units)} step={units==='metric' ? 1 : 'any'} defaultValue={goal ? inputVolume(goal,units) : ''}/></label>
    </div><div className="actions"><button className="primary">Save water preferences</button><button type="button" onClick={()=>setPreferences(false)}>Cancel</button></div></form>}
  </>;
}

function Summary({ rows, group, date, units }: {rows:HealthLog[];group:HealthGroup;date:string;units:WaterUnits}) {
  const days = Array.from({length:7},(_,i)=>plusDays(date,i-6));
  const aggregate = days.map(day=>{
    const daily = rows.filter(row=>row.day===day);
    const values = daily.map(row=>group==='water' ? row.ml : group==='sleep' ? sleepMinutes(row) : group==='activity' ? movementMinutes(row) : 1).filter(n=>n!==undefined);
    return {day, count:daily.length, known:values.length, sum:values.reduce((n,value)=>n+value,0), bands:daily.map(sleepBand).filter(Boolean)};
  });
  const daysLogged = aggregate.filter(day=>day.count).length;
  const knownDays = aggregate.filter(day=>day.known).length;
  const approximate = aggregate.filter(day=>day.bands.length && !day.known).length;
  const total = aggregate.reduce((n,day)=>n+day.sum,0);
  const peak = Math.max(1,...aggregate.map(day=>day.sum));
  const format = (value:number) => group==='water' ? volumeText(value,units) : group==='sleep' ? durationText(value) : group==='activity' ? formatter.format(value)+' min' : formatter.format(value);
  return <section className="health-summary" aria-label="Seven-day summary">
    <h3>Last 7 days</h3><p className="hint">{daysLogged} of 7 days with {daysLogged===1 ? 'an entry' : 'entries'}{group==='sleep' && approximate>0 ? ` · ${approximate} approximate-only ${approximate===1 ? 'day' : 'days'}` : ''}.</p>
    {knownDays > 0 && <p className="hint">{group==='water' || group==='sleep' ? 'Average over '+knownDays+' '+(group==='sleep' ? 'precisely measured' : 'measured')+' '+(knownDays===1?'day':'days')+': '+format(Math.round(total/knownDays)) : `Total recorded: ${format(total)}`}.</p>}
    <ul className="health-days">{aggregate.map(item=><li key={item.day}>
      <div className="health-bar" aria-hidden="true">{item.known>0 && <span style={{height:`${Math.max(8,item.sum/peak*100)}%`}}/>}</div>
      <time dateTime={item.day}>{dateLabel(item.day,{weekday:'short'})}</time>
      <span>{item.known>0 ? format(item.sum) : item.bands.length ? item.bands[0] : item.count>0 ? 'Unknown' : '—'}</span>
    </li>)}</ul>
  </section>;
}
