import { useEffect, useRef, useState } from 'react';
import catalog from './catalog.json';
import { Health, mealDetails } from './health';
import type { HealthLog, WaterUnits } from './health-records';
import { clockAt, timeLabel } from './wellbeing';
import type { Settings } from './wellbeing';

type Task = { id: string; label: string; minutes: number; original: number; later: boolean; done?:boolean };
export type Extras = { water: HealthLog[]; activity: HealthLog[]; sleep: HealthLog[]; meals: HealthLog[]; waterCupMl?: number; waterGoalMl?: number; win: string; wake: string; stop: string; tasks: Task[]; savedGuides?: string[] };
export const blankExtras: Extras = { water: [], activity: [], sleep: [], meals: [], win: '22:30', wake: '07:00', stop: '22:00', tasks: [] };
const minutesAt = (time: string) => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
export function ExtraPage({ tab, data, update, section, setSection, date, zone, units = 'metric', clockStyle = 'system' }: {
  tab: 'Health' | 'Plan'; data: Extras; update: (next: Partial<Extras>, status: string) => boolean;
  section: string; setSection: (section: string) => void;
  date:string; zone:string; units?:WaterUnits; clockStyle?:Settings['clockStyle'];
}) {
  const [taskUndo, setTaskUndo] = useState<Task[] | null>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 30000); return () => clearInterval(timer); }, []);
  const clock = minutesAt(clockAt(zone,now));
  const evening = minutesAt(data.win), morning = minutesAt(data.wake);
  const windDown = evening > morning ? clock >= evening || clock < morning : clock >= evening && clock < morning;
  const planned = data.tasks.filter(task => !task.later && !task.done).reduce((total, task) => total + task.minutes, 0);
  const available = Math.max(0, minutesAt(data.stop) - clock);
  function changeTask(task: Task, patch: Partial<Task>, message: string) {
    if (update({ tasks: data.tasks.map(t => t.id === task.id ? { ...t, ...patch } : t) }, message)) setTaskUndo(data.tasks);
  }
  return <div className="card extra">{tab === 'Plan' && <h2>Cut &amp; Keep</h2>}
    <section>
    {tab === 'Health' && <Health data={data} update={update} date={date} zone={zone} section={section} setSection={setSection}
      windDown={windDown} units={units} clockStyle={clockStyle} meals={save=><Meals date={date} onSave={save}/>}/>}
    {tab === 'Plan' && <>
      <h2>Tonight &amp; Tomorrow</h2><label>Stopping time<input type="time" value={data.stop} onChange={e => e.target.value && update({ stop: e.target.value }, 'Stopping time saved.')} /></label>
      <p className="hint">Stopping at <time dateTime={data.stop}>{timeLabel(data.stop,clockStyle)}</time>.</p>
      <p role="status">{planned} min planned · {available} min until stopping time. {planned > available && 'This plan exceeds your stopping time. Shorten or move a task.'}</p>
      <form onSubmit={event => {
        event.preventDefault(); const form = event.currentTarget; const f = new FormData(form);
        const label = String(f.get('task')).trim(), minutes = Number(f.get('minutes'));
        if (label && update({ tasks: [...data.tasks, { id: crypto.randomUUID(), label, minutes, original: minutes, later: false }] }, 'Task added.')) { setTaskUndo(null); form.reset(); }
      }}><div className="form-grid"><label>Task<input name="task" required maxLength={80} /></label><label>Task minutes<input name="minutes" type="number" min="1" max="600" defaultValue="20" required /></label></div><button className="primary">Add task</button></form>
      <div className="plan-columns">{[false, true].map(later => <div key={String(later)}><h3>{later ? 'Tomorrow' : 'Tonight'}</h3>
      {data.tasks.filter(task => task.later === later).map(task => <div className="task enter" key={task.id}><p>{task.label} · {task.minutes} min</p><div className="actions">
        <button onClick={() => changeTask(task, { later: false, minutes: task.original }, 'Kept for tonight.')}>Keep</button>
        <button disabled={task.minutes <= 1} onClick={() => changeTask(task, { minutes: Math.ceil(task.minutes / 2) }, 'Task shortened.')}>Shorten</button>
        <button onClick={() => changeTask(task, { later: !later }, later ? 'Moved to tonight.' : 'Moved to tomorrow.')}>Move</button>
        <button onClick={() => changeTask(task,{done:!task.done},task.done?'Task reopened.':'Task completed.')}>{task.done ? 'Reopen' : 'Complete'}</button>
      </div></div>)}</div>)}</div>
      {taskUndo && <button onClick={() => { if (update({ tasks: taskUndo }, 'Change undone.')) setTaskUndo(null); }}>Undo</button>}
      <button className="primary" onClick={() => update({}, 'Plan saved on this device.')}>Save plan</button>
    </>}
    </section></div>;
}

function Meals({ onSave, date }: { onSave: (label: string, day: string, grams?: number) => boolean; date: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [dish, setDish] = useState('');
  const [grams, setGrams] = useState('');
  const [mealDate, setMealDate] = useState(date);
  const [estimate, setEstimate] = useState('');
  const [status, setStatus] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const request = useRef(0);
  useEffect(() => {
    const refresh = () => setOnline(navigator.onLine);
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    return () => {
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', refresh);
    };
  }, []);
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function identify() {
    if (!file) return;
    const attempt = ++request.current;
    setStatus('Identifying dish… The first model download can take a moment.');
    try {
      const { identifyPhoto } = await import('./food');
      const matches = await identifyPhoto(file);
      if (attempt !== request.current) return;
      setOptions(matches); setDish(matches[0] ?? ''); setEstimate(''); setStatus('Review the suggestion or enter your own dish.');
    } catch {
      if (attempt === request.current) setStatus('Photo identification is unavailable. You can enter the meal manually.');
    }
  }
  return <><h2>Log a meal</h2>
    <div className="form-grid"><label>Upload a meal photo<input type="file" accept="image/*" onChange={e => { request.current++; setFile(e.currentTarget.files?.[0] ?? null); setOptions([]); setStatus(''); }} /></label>
    <label>Take a meal photo<input type="file" accept="image/*" capture="environment" onChange={e => { request.current++; setFile(e.currentTarget.files?.[0] ?? null); setOptions([]); setStatus(''); }} /></label></div>
    {preview && <img className="meal-photo" src={preview} alt="Selected meal" />}
    {file && <button disabled={!online || status.startsWith('Identifying')} onClick={identify}>Identify meal</button>}
    <p className="hint" role="status">{!online ? 'Photo identification is unavailable offline. You can enter the meal manually.' : status || 'You can also enter a dish manually. The photo is used in this browser and discarded when you leave.'}</p>
    {!!options.length && preview && <div><strong>Suggested dish: {options[0]}</strong><div className="hint">Swin Food-101 ONNX</div></div>}
    {!!options.length && <div className="actions" aria-label="Suggested dishes">{options.map(option => <button type="button" key={option} aria-pressed={dish === option} onClick={() => { setDish(option); setEstimate(''); }}>{option}</button>)}</div>}
    <form onSubmit={event => {
      event.preventDefault();
      const label = dish.trim();
      if (!label) return;
      const portion = Number(grams) || undefined;
      if (onSave(label, mealDate, portion)) {
        request.current++;
        setStatus('');
        setEstimate(mealDetails(label, portion).estimate);
        setFile(null);
        setOptions([]);
        setDish('');
        setGrams('');
      }
    }}><div className="form-grid"><label>Dish name<input value={dish} onChange={e => { setDish(e.target.value); setEstimate(''); }} list="dishes" required maxLength={80} /></label>
      <datalist id="dishes">{[...new Set([...options, ...Object.keys(catalog)])].map(item => <option key={item} value={item} />)}</datalist>
      <label>Portion (grams)<input type="number" min="1" max="5000" value={grams} onChange={e => { setGrams(e.target.value); setEstimate(''); }} /></label><label>Meal date<input type="date" max={date} value={mealDate} onChange={e=>setMealDate(e.target.value)} required /></label></div>
      <button className="primary">Confirm meal</button></form>
    {estimate && <p role="status">{estimate} {estimate.startsWith('Estimated per confirmed portion:') && <a href="https://fdc.nal.usda.gov/download-datasets/">USDA FoodData Central</a>}</p>}</>;
}
