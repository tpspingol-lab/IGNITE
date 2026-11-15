import { useState } from 'react';
import { pillars } from './wellbeing';
import type { Settings } from './wellbeing';
import type { Extras } from './extras';
import { PolicyCopy } from './privacy';
import type { LegalChoice } from './privacy';
import { ChatSetup } from './local-chat';
import { parseBackup } from './backup';
import { downloadReminders } from './calendar-reminder';

const sections = ['Personalization', 'Schedule', 'Reminders', 'Privacy & data'] as const;
const zones = Intl.supportedValuesOf('timeZone');
export function Preferences({ settings, extras, update, schedule, retake, exportData, restoreBackup, clear, manage, legal, setup }: {
  settings: Settings; extras: Extras; update: (patch: Partial<Settings>) => void; schedule: (patch: Partial<Extras>) => void;
  retake: () => void; exportData: () => void; clear: () => void; manage: () => void; legal?:LegalChoice;
  restoreBackup:(backup:ReturnType<typeof parseBackup>)=>boolean;
  setup?: {stage:number; jump:(stage:number)=>void; finish:(useDraft:boolean,checkIn?:boolean)=>void};
}) {
  const [section, setSection] = useState<typeof sections[number]>('Personalization');
  const [backup,setBackup] = useState<ReturnType<typeof parseBackup>>();
  const [backupError,setBackupError] = useState('');
  const [readingBackup,setReadingBackup] = useState(false);
  async function inspectBackup(file:File|undefined) {
    setBackup(undefined);setBackupError('');
    if (!file) return;
    if (file.size>10_000_000) {setBackupError('This backup exceeds the supported file size.');return;}
    setReadingBackup(true);
    try {setBackup(parseBackup(await file.text()));}
    catch (error) {setBackupError(error instanceof Error?error.message:'Could not read this backup.');}
    finally {setReadingBackup(false);}
  }
  const goalFields = <fieldset><legend>My goals</legend>{pillars.map(([name], index) => <label className="toggle" key={name}><input type="checkbox" checked={!!settings.goals[index]} onChange={e => update({goals: pillars.map((_, i) => i === index ? e.target.checked : settings.goals[i])})} />{name}</label>)}<label>Habits to practice<textarea rows={2} value={settings.habits} onChange={e => update({habits:e.target.value})} /></label></fieldset>;
  const timing = <div className="form-grid">
    <label>Wake time<input type="time" value={extras.wake} onChange={e => e.target.value && schedule({wake:e.target.value})} /></label>
    <label>Bedtime<input type="time" value={extras.win} onChange={e => e.target.value && schedule({win:e.target.value})} /></label>
    <label>Stopping time<input type="time" value={extras.stop} onChange={e => e.target.value && schedule({stop:e.target.value})} /></label>
    <label>Time zone<select value={settings.zone} onChange={e => update({zone:e.target.value})}>{[...new Set(['UTC', settings.zone, ...zones])].map(z => <option key={z}>{z}</option>)}</select></label>
  </div>;
  const reminders = <>{(['morning','evening'] as const).map(window => <label className="toggle" key={window}><input type="checkbox" checked={settings[window]} onChange={e => update({[window]: e.target.checked})} />{window === 'morning' ? 'Morning check-in' : 'Evening check-in'}</label>)}</>;
  const barriers = <fieldset><legend>What gets in the way?</legend>{['Low energy','Short on time','Hard to start','Self-doubt'].map(item=><label className="toggle" key={item}><input type="checkbox" checked={settings.barriers.includes(item)} onChange={e=>update({barriers:e.target.checked ? [...settings.barriers,item] : settings.barriers.filter(value=>value!==item)})}/>{item}</label>)}</fieldset>;
  const size = <label>What size of step feels doable?<select value={settings.stepSize} onChange={e=>update({stepSize:Number(e.target.value) as Settings['stepSize']})}>{[2,5,10].map(minutes=><option key={minutes} value={minutes}>{minutes} minutes</option>)}</select></label>;
  const titles = ['What would you like help with?', 'What gets in the way?', 'What feels doable?', 'Set a simple schedule', 'Choose your check-in preferences', 'Review your answers'];
  if (setup) return <section className="card setup-studio"><p className="eyebrow">Personalization · {setup.stage+1} of {titles.length}</p><div className="enter" key={setup.stage}><h2>{titles[setup.stage]}</h2>
    {[goalFields,barriers,size,timing,reminders,<dl key="review"><dt>Goals</dt><dd>{pillars.filter((_,i)=>settings.goals[i]).map(p=>p[0]).join(', ') || 'None selected'}</dd><dt>Barriers</dt><dd>{settings.barriers.join(', ') || 'None selected'}</dd><dt>Step size</dt><dd>{settings.stepSize} minutes</dd><dt>Schedule</dt><dd>{extras.wake} wake · {extras.win} bedtime · {extras.stop} stop</dd><dt>Check-ins</dt><dd>{[settings.morning && 'Morning',settings.evening && 'Evening'].filter(Boolean).join(', ') || 'Off'}</dd></dl>][setup.stage]}</div>
    <div className="actions">{setup.stage>0 && <button onClick={()=>setup.jump(setup.stage-1)}>← Back</button>}
      <button className="text-button" onClick={()=>setup.finish(false)}>Skip for now</button>
      {setup.stage<titles.length-1 ? <button className="primary" onClick={()=>setup.jump(setup.stage+1)}>Continue</button> : <><button onClick={()=>setup.finish(true)}>Continue to Today</button><button className="primary" onClick={()=>setup.finish(true,true)}>Optional initial check-in</button></>}
    </div></section>;
  return <section className="card">
    <div className="subnav" aria-label="Settings sections">{sections.map(item => <button key={item} aria-pressed={section === item} onClick={() => setSection(item)}>{item}</button>)}</div>
    <h2>{section}</h2>
    {section === 'Personalization' && <><div className="form-grid">
      <label>Appearance<select value={settings.theme} onChange={e=>update({theme:e.target.value as Settings['theme']})}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
      <label>Text size<select value={settings.textSize} onChange={e=>update({textSize:e.target.value as Settings['textSize']})}><option value="standard">Standard</option><option value="large">Large</option></select></label>
      <label>Units<select value={settings.units} onChange={e=>update({units:e.target.value as Settings['units']})}><option value="metric">Metric</option><option value="us">US customary</option></select></label>
    </div>
    <form onSubmit={e=>{e.preventDefault();const cup=Number(new FormData(e.currentTarget).get('cup'));if(Number.isInteger(cup)&&cup>=1&&cup<=5000)schedule({waterCupMl:cup});}}>
      <label>Quick-add cup size (mL)<input key={extras.waterCupMl??250} name="cup" type="number" min="1" max="5000" defaultValue={extras.waterCupMl??250} required/></label><button>Save cup size</button>
    </form>
    <label className="toggle"><input type="checkbox" checked={settings.reduce} onChange={e=>update({reduce:e.target.checked})}/>Reduced motion</label>
    <label className="toggle"><input type="checkbox" checked={settings.mascotVisible} onChange={e=>update({mascotVisible:e.target.checked})}/>Show Lantern mascot</label>
    {goalFields}{barriers}{size}<div className="actions"><button onClick={retake}>Retake setup</button></div></>}
    {section === 'Schedule' && <>{timing}<label>Clock format<select value={settings.clockStyle} onChange={e=>update({clockStyle:e.target.value as Settings['clockStyle']})}><option value="system">System</option><option value="12">12-hour</option><option value="24">24-hour</option></select></label><p className="hint">Previous check-ins keep the date and time zone saved with them.</p></>}
    {section === 'Reminders' && <>{reminders}<p className="hint">Prompts appear in Today while IGNITE is open. Import the calendar file to receive alerts from your calendar. Check the event times in your calendar’s local time zone.</p>
      <button disabled={!settings.morning&&!settings.evening} onClick={()=>downloadReminders(settings,extras.wake,extras.win)}>Download calendar reminders</button></>}
    {section === 'Privacy & data' && <><p>Entries and chat are stored in this browser. Model files download from Hugging Face. Inference runs on this device.</p>
      <p className="hint">{legal ? 'Terms accepted · version '+legal.version : 'Terms acceptance is pending.'}</p>
      <details><summary>Privacy Notice</summary><PolicyCopy notice="privacy"/></details><details><summary>Terms of Use</summary><PolicyCopy notice="terms"/></details>
      <label>Chat access to logs<select value={settings.logAccess} onChange={e => update({logAccess: e.target.value as Settings['logAccess']})}><option value="ask">Ask each time</option><option value="never">Never include logs</option></select></label>
      <details><summary>AI Models &amp; Data</summary><ul>
        <li>Lantern chat — SmolLM2</li><li>Meal recognition — Swin Food-101 ONNX</li>
        <li>Emotion suggestions — IGNITE’s TF-IDF + logistic regression</li><li>Training datasets — Food-101 and GoEmotions</li>
        <li>Nutrition data — USDA FoodData Central</li><li>Well-being stages — calculated from four confirmed self-ratings</li>
      </ul></details>
      <h3>Local chat model</h3><ChatSetup manage/>
      <div className="actions"><button onClick={manage}>Manage saved entries</button><button onClick={exportData}>Export backup</button><button onClick={clear}>Delete my history</button></div>
      <label>Import backup<input disabled={readingBackup} type="file" accept=".json,application/json" onChange={e=>{const file=e.target.files?.[0];e.target.value='';void inspectBackup(file);}}/></label>
      {readingBackup && <p role="status">Checking backup…</p>}{backupError && <p role="alert">{backupError}</p>}
      {backup && <section className="card"><h3>Backup preview</h3><p>{backup.summary.checkIns} check-ins · {backup.summary.steps} steps · {backup.summary.healthLogs} health logs · {backup.summary.chatMessages} chat messages · {backup.summary.tasks} plan tasks</p>
        <p>This replaces the entries and preferences on this device. Export a backup first if you want a copy of your current entries.</p>
        <div className="actions"><button className="primary" onClick={()=>{if(restoreBackup(backup))setBackup(undefined);}}>Replace saved data</button><button onClick={()=>setBackup(undefined)}>Cancel import</button></div></section>}
    </>}
  </section>;
}
