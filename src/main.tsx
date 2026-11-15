import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { emptyDraft, recommend, rest, shrink, tags } from './steps';
import type { Draft, Step, Tag } from './steps';
import { suggestEmotion } from './emotion';
import { ExtraPage, blankExtras } from './extras';
import type { Extras } from './extras';
import { blank, calendarDate, clockAt, currentRatings, dateLabel, defaults, localDate, monday, outcomeDay, pillars, plusDays, scales, timeLabel, validRating, version, weekDays, weekly } from './wellbeing';
import type { Check, Ratings, Settings } from './wellbeing';
import { Progress } from './progress';
import { Preferences } from './settings';
import { Lantern, emptyLantern } from './lantern';
import type { LanternData } from './lantern';
import { Icon } from './icons';
import { PolicyCopy, TermsGate, termsVersion } from './privacy';
import type { LegalChoice } from './privacy';
import { createBackup, parseBackup } from './backup';
import { FieldNotes } from './field-notes';
import { eveningReminderTime } from './calendar-reminder';
import './style.css';
import './publication.css';

const key = 'ignite-veritas-v1';
const tabs = ['Today', 'Progress', 'Health', 'Plan', 'Resources', 'Settings'] as const;
const logGroups = { sleep:'Sleep', water:'Water', meals:'Meals', activity:'Movement' } as const;
type Tab = typeof tabs[number];
type Entry = { id: string; date: string; day?:string; zone?:string; step: Step; outcome: string; barrier: string };
type SetupDraft = { stage:number; preferences:Partial<Settings>; schedule:Partial<Extras> };
type RatingContext = {note:string; tag:string};
type StepRetry = {original:Step; smaller:Step; day:string; recordId?:string};
type Data = { draft: Draft; active: Step | null; history: Entry[]; smaller: Step | null; stepRetry?:StepRetry; scratch?:string; extras: Extras; settings: Settings; checks: Check[]; prompts: Record<string,string>; ratingDrafts: Record<string,Ratings>; ratingContext: Record<string,RatingContext>; lantern: LanternData; journalHistory: {date:string; note:string; tag:string}[]; legal?:LegalChoice; setupDraft?:SetupDraft };
const empty = (): Data => ({ draft: { ...emptyDraft }, active: null, history: [], smaller: null, extras: blankExtras, settings: defaults, checks: [], prompts: {}, ratingDrafts: {}, ratingContext: {}, lantern: emptyLantern, journalHistory: [] });
function normalize(saved:Partial<Data>):Data {
    const settings = {...defaults,...saved.settings};
    const history = Array.isArray(saved.history) ? saved.history.map(entry=>({...entry,day:outcomeDay(entry,entry.zone??settings.zone)})) : [];
    return { ...empty(), ...saved, settings, history, extras: { ...blankExtras, ...saved.extras } };
}
function read(): Data {
  try {return normalize(JSON.parse(localStorage.getItem(key)??'{}'));}
  catch { return empty(); }
}
function readRoute() {
  const params = new URLSearchParams(location.search);
  const week = params.get('week');
  const tab = tabs.find(item=>item.toLowerCase()===params.get('tab')) ?? (calendarDate(week)?'Progress':'Today');
  const m = calendarDate(week)?monday(week):'';
  const selected:unknown = history.state?.igniteDay;
  return {tab,day:typeof selected==='string' && calendarDate(selected) && monday(selected)===m?selected:m};
}
function Panel({ title, subtitle, children, className = '' }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return <div className={'spread ' + className}><div className="masthead"><h1>{title}</h1><div className="stroke" aria-hidden="true" />{subtitle && <p>{subtitle}</p>}</div><div className="sheet">{children}</div></div>;
}
function App() {
  const [data, setData] = useState(read);
  const latest = useRef(data);
  latest.current = data;
  const [tab, setTab] = useState<Tab>(()=>readRoute().tab);
  const [section, setSection] = useState('');
  const [mode, setMode] = useState<'home' | 'check' | 'step' | 'outcome' | 'ratings'>('home');
  const [initialRating,setInitialRating] = useState(false);
  const [instant, setInstant] = useState(() => new Date());
  const [checkDate, setCheckDate] = useState('');
  const [returnToProgress, setReturnToProgress] = useState(false);
  const [progressDate,setProgressDate] = useState(()=>readRoute().day);
  const [resetToken,setResetToken] = useState(0);
  const [manage,setManage] = useState(false);
  const [step, setStep] = useState<Step>(rest);
  const [swapped, setSwapped] = useState(false);
  const [outcome, setOutcome] = useState('Done');
  const [barrier, setBarrier] = useState('');
  const [status, setStatus] = useState('');
  const [policy, setPolicy] = useState('');
  const [tagStatus, setTagStatus] = useState('');
  const [moreOpen,setMoreOpen] = useState(false);
  const [undo,setUndo] = useState<{label:string; apply:(data:Data)=>Data}>();
  const [checkSaved,setCheckSaved] = useState(false);
  const [online,setOnline] = useState(navigator.onLine);
  const moreButton = useRef<HTMLButtonElement>(null);
  const checkTrigger = useRef<HTMLElement|null>(null);
  const inference = useRef(0);
  const main = useRef<HTMLElement>(null);
  const opening = useRef(true);
  const draft = data.draft;
  const agreed = data.legal?.version === termsVersion;
  const setup = data.setupDraft;
  useEffect(()=>{document.documentElement.dataset.theme=data.settings.theme;document.documentElement.dataset.textSize=data.settings.textSize;},[data.settings.theme,data.settings.textSize]);
  const zone = data.settings.zone;
  const today = localDate(zone, instant);
  const clock = clockAt(zone, instant);
  const eveningStart = eveningReminderTime(data.extras.win);
  const windowName = clock >= eveningStart && clock >= data.extras.wake ? 'evening' :
    clock >= data.extras.wake && clock < eveningStart ? 'morning' : null;
  const promptKey = today + ':' + (windowName ?? 'manual');
  const isDue = windowName && data.settings[windowName] && !data.prompts[promptKey];
  const date = checkDate || today;
  const oldRating = currentRatings(data.checks).get(date);
  const ratingDraft = data.ratingDrafts[date] ?? oldRating?.ratings ?? blank();
  const ratingContext = data.ratingContext[date] ?? {note:oldRating?.note ?? '', tag:oldRating?.tag ?? ''};
  const minutes = data.settings.barriers.includes('Low energy') ? Math.min(data.settings.stepSize,2) : data.settings.stepSize;
  const number = minutes === 5 ? 'five' : minutes === 2 ? 'two' : 'ten';
  const gentle: Step = { title: data.settings.goals[2] ? 'Check in with someone you trust.' : data.settings.goals[0] ? 'Take a '+number+'-minute stretch break.' : 'Take a '+number+'-minute break.', minutes, reason: 'Give yourself a little room between tasks.', smaller: { title: 'Pause for one minute.', minutes: 1 } };
  const lastStep = data.history.find(record=>outcomeDay(record,zone)===today);
  const retry = data.stepRetry && data.stepRetry.day<=today?data.stepRetry:undefined;
  const todayStep = data.active ?? retry?.smaller ?? data.smaller ?? lastStep?.step ?? gentle;
  const stepLogged = !!(lastStep && !data.active && !retry && !data.smaller);
  const pendingRetry = stepLogged && data.stepRetry?.recordId===lastStep?.id ? data.stepRetry : undefined;
  const participation = weekly(data.checks,weekDays(plusDays(today,-6))).participation;
  const waterToday = data.extras.water.filter(row=>row.day===today).reduce((total,row)=>total+(row.ml ?? 0),0);
  const dirty = !!(draft.note || draft.tag || draft.time !== 10 || draft.energy !== 'Steady');
  useEffect(() => { const id = window.setInterval(() => setInstant(new Date()), 15000); return () => clearInterval(id); }, []);
  useEffect(()=>{
    const pop = ()=>{const route=readRoute();setTab(route.tab);setProgressDate(route.day);setMode('home');setMoreOpen(false);setManage(false);};
    window.addEventListener('popstate',pop);
    return ()=>window.removeEventListener('popstate',pop);
  },[]);
  useEffect(()=>{
    const connection = ()=>setOnline(navigator.onLine);
    window.addEventListener('online',connection);window.addEventListener('offline',connection);
    return ()=>{window.removeEventListener('online',connection);window.removeEventListener('offline',connection);};
  },[]);
  useEffect(()=>{
    if (!checkSaved) return;
    const expiry = window.setTimeout(()=>setCheckSaved(false),10000);
    return ()=>window.clearTimeout(expiry);
  },[checkSaved]);

  useEffect(() => {
    if (opening.current) { opening.current = false; return; }
    main.current?.focus();
    window.scrollTo(0, 0);
  }, [tab, mode]);

  function persist(next: Data, message = '') {
    try {
      localStorage.setItem(key, JSON.stringify(next));
      latest.current = next;
      setData(next);
      setStatus(message);
      return true;
    } catch {
      setStatus('Couldn’t save on this device. Check that browser storage is available and try again.');
      return false;
    }
  }
  function edit(patch: Partial<Draft>) {
    const next = { ...data, draft: { ...draft, ...patch } };
    if (!persist(next)) setData(next);
  }
  async function modelTag() {
    const request = ++inference.current;
    setTagStatus('Finding a suggestion…');
    try {
      const tag = await suggestEmotion(draft.note);
      if (request !== inference.current) return;
      edit({ tag });
      setTagStatus('Suggested emotion · you can change the tag below.');
    } catch {
      if (request === inference.current) setTagStatus('Suggestion unavailable. Choose your own emotion tag below.');
    }
  }
  function cancelInference() { inference.current++; setTagStatus(''); }
  function review() {
    setStep(retry?.smaller ?? data.smaller ?? recommend(draft));
    setSwapped(false);
    setMode('step');
    if (windowName === 'morning') persist({ ...data, prompts: { ...data.prompts, [promptKey]:'completed' } });
  }
  function saveStep() {
    const journalHistory = draft.note || draft.tag ? [{date:today,note:draft.note,tag:draft.tag},...data.journalHistory] : data.journalHistory;
    if (persist({ ...data, active: step, smaller: null, stepRetry:undefined, draft: { ...emptyDraft }, journalHistory }, 'Step saved on this device.')) setMode('home');
  }
  function followUp(result=outcome, difficulty=barrier, current=data.active??todayStep, previous?:Entry) {
    const stamp = new Date();
    const entry = previous ? {...previous,barrier:difficulty} : {id:crypto.randomUUID(),date:stamp.toISOString(),day:localDate(zone,stamp),zone,step:current,outcome:result,barrier:difficulty};
    const smaller = current.smaller ? shrink(current,'You said this step felt too big, so this version asks less of you.') : {...rest,reason:'You said this step felt too big. A pause is a smaller option.'};
    const stepRetry = difficulty==='Too big' ? {original:current,smaller,day:plusDays(today,1),recordId:entry.id} : undefined;
    const records = previous ? data.history.map(row=>row.id===previous.id?entry:row) : [entry,...data.history];
    if (persist({...data,active:null,smaller:null,stepRetry,history:records},difficulty==='Too big'?'Feedback saved on this device.':'Outcome saved on this device.')) {
      setOutcome('Done'); setBarrier('');
      setMode('home');
    }
  }
  function routeTo(next:Tab,day=today) {
    const url = new URL(location.href);
    const oldWeek = url.searchParams.get('week');
    if(next==='Today' || next==='Progress') url.searchParams.delete('tab'); else url.searchParams.set('tab',next.toLowerCase());
    if(next==='Progress') url.searchParams.set('week',monday(day)); else url.searchParams.delete('week');
    if(url.href!==location.href) history.pushState({igniteDay:next==='Progress'?day:undefined},'',url);
    else if(next==='Progress' && oldWeek===monday(day)) history.replaceState({igniteDay:day},'',url);
    if(next==='Progress')setProgressDate(day);
    setTab(next);setMode('home');setMoreOpen(false);
  }
  function navigate(next:Tab) {cancelInference();setManage(false);setStatus('');routeTo(next);}
  function applyUndo() {if(undo && persist(undo.apply(data),'Restored on this device.'))setUndo(undefined);}
  function clear() {
    if (!window.confirm('Delete your IGNITE draft, saved step, and all logs on this device?')) return;
    const {wake,win,stop,...health} = data.extras;
    if (persist({ ...empty(), legal:data.legal, settings: data.settings, extras:{...health,...blankExtras,wake,win,stop} }, 'Your history was deleted.')) {
      cancelInference(); routeTo('Today');setUndo(undefined);setCheckSaved(false); setPolicy(''); setResetToken(n=>n+1);
      setCheckDate(''); setStep(rest); setInitialRating(false); setProgressDate(''); setBarrier(''); setOutcome('Done'); setSection('');
    }
  }
  function openRating(day:string,fromProgress=false) {
    checkTrigger.current = document.activeElement instanceof HTMLElement?document.activeElement:null;
    if(fromProgress)routeTo('Progress',day);
    setCheckDate(day);setReturnToProgress(fromProgress);setTab('Today');setMode('ratings');
  }
  function closeRating() {
    setMode('home');setInitialRating(false);if(returnToProgress)setTab('Progress');
    requestAnimationFrame(()=>{if(checkTrigger.current?.isConnected)checkTrigger.current.focus();});
  }
  function finishRating() {
    if (date > today) {setStatus('Choose today or an earlier day.');return;}
    const ratings = pillars.map((_,i)=>validRating(ratingDraft[i]) ? ratingDraft[i] : null) as Ratings;
    const updated: Check = { date, zone: oldRating?.zone ?? zone, version, updated: new Date().toISOString(), ratings, ...ratingContext };
    const ratingDrafts = { ...data.ratingDrafts }; delete ratingDrafts[date];
    const contexts = {...data.ratingContext}; delete contexts[date];
    const prompts = date === today && !initialRating ? { ...data.prompts, [today + ':evening']: 'completed' } : data.prompts;
    if (persist({ ...data, checks: [...data.checks.filter(c => c.date !== date || c.version !== version), updated], prompts, ratingDrafts, ratingContext:contexts }, 'Ratings saved on this device.')) {
      if (!returnToProgress)setCheckSaved(true);
      closeRating();
    }
  }
  function saveRatingEdit(day:string,ratings:Ratings) {
    const entry = currentRatings(data.checks).get(day);
    if (!entry || day>today || !ratings.every(value=>value===null||validRating(value))) return false;
    const drafts = {...data.ratingDrafts};delete drafts[day];
    return persist({...data,ratingDrafts:drafts,checks:[...data.checks.filter(row=>row.date!==day || row.version!==version),{...entry,ratings,updated:new Date().toISOString()}]},'Ratings saved on this device.');
  }
  function removeRating(day: string) {
    if (!window.confirm('Delete the pillar ratings for this day?')) return;
    const ratingDrafts = { ...data.ratingDrafts }; delete ratingDrafts[day];
    const contexts = {...data.ratingContext}; delete contexts[day];
    const deleted=data.checks.filter(c=>c.date===day && c.version===version);
    if (persist({ ...data, checks: data.checks.filter(c=>c.date !== day || c.version !== version), ratingDrafts, ratingContext:contexts }, 'Check-in deleted.')) {
      setUndo({label:'Undo check-in deletion',apply:latest=>latest.checks.some(c=>c.date===day&&c.version===version)?latest:{...latest,checks:[...latest.checks,...deleted]}});
    }
  }
  function editOutcome(id:string,nextOutcome:string,difficulty:string) {
    const history = data.history.map(row=>row.id===id?{...row,outcome:nextOutcome,barrier:difficulty}:row);
    const stepRetry = data.stepRetry?.recordId===id && difficulty!=='Too big'?undefined:data.stepRetry;
    return persist({...data,history,stepRetry},'Outcome updated on this device.');
  }
  function deleteOutcome(id:string) {
    const entry = data.history.find(row=>row.id===id);
    if (!entry) return;
    const retry = data.stepRetry?.recordId===id?data.stepRetry:undefined;
    if (persist({...data,history:data.history.filter(row=>row.id!==id),stepRetry:retry?undefined:data.stepRetry},'Step entry deleted.')) {
      setUndo({label:'Undo step deletion',apply:latest=>latest.history.some(row=>row.id===id)?latest:{...latest,history:[entry,...latest.history],stepRetry:latest.stepRetry??retry}});
    }
  }
  function exportData() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(createBackup(data), null, 2)], {type:'application/json'}));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'ignite-backup.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function restoreBackup(file:ReturnType<typeof parseBackup>) {
    const next = normalize(file.data as Partial<Data>);
    if (!persist({...next,legal:data.legal},'Backup restored on this device.')) return false;
    setUndo(undefined);setCheckSaved(false);setResetToken(n=>n+1);
    return true;
  }
  function startSetup() { if(persist({...data,setupDraft:{stage:0,preferences:{},schedule:{}}})) navigate('Today'); }
  function saveSetup(useDraft:boolean, checkIn=false) {
    const settings = {...data.settings,...(useDraft ? setup?.preferences : {}),setup:true};
    const extras = {...data.extras,...(useDraft ? setup?.schedule : {})};
    if (!persist({...data,settings,extras,setupDraft:undefined},'Setup saved.')) return;
    if (checkIn) {
      setInitialRating(true);openRating(localDate(settings.zone));
    } else {
      main.current?.focus();
    }
  }
  const preferences = {settings:data.settings, extras:data.extras, update:(patch:Partial<Settings>)=> { persist({...data,settings:{...data.settings,...patch}}, 'Preferences saved.'); },
    schedule:(patch:Partial<Extras>)=>{persist({...data,extras:{...data.extras,...patch}},'Schedule saved.');}, retake:startSetup,
    exportData, restoreBackup, clear, manage:()=>setManage(true), legal:data.legal };
  const context = (day: string) => [
    ...data.extras.sleep.filter(item=>item.day === day).map(item=>'Sleep: '+item.text),
    ...data.extras.activity.filter(item=>item.day === day).map(item=>'Movement: '+item.text),
    ...data.extras.meals.filter(item=>item.day === day).map(item=>'Meal: '+item.text),
    ...(() => {
      const rows=data.extras.water.filter(item=>item.day===day);
      const known=rows.filter(row=>row.ml!==undefined);
      return rows.length?['Water: '+(known.length?known.reduce((sum,row)=>sum+(row.ml??0),0).toLocaleString()+' mL · ':'')+rows.length+' logs'+(known.length<rows.length?' · some volumes unknown':'')]:[];
    })()
  ];

  return <div className={'app-shell' + (data.settings.reduce ? ' static-motion' : '')}>
    {!agreed && <TermsGate accept={()=>persist({...data,legal:{version:termsVersion,acceptedAt:new Date().toISOString()}},'Terms accepted.')}/>}
    <a className="skip" href="#main">Skip to content</a>
    <header><div className="header-inner">
      <button className="brand" aria-label="IGNITE home" onClick={() => navigate('Today')}><img src={import.meta.env.BASE_URL + 'ignite-logo.png'} alt="IGNITE" /></button>
      <nav aria-label="Main navigation" className="main-nav" onKeyDown={e=>{if(e.key==='Escape' && moreOpen){setMoreOpen(false);moreButton.current?.focus();}}}>
        {tabs.map(item=><button className={item==='Resources'||item==='Settings'?'desktop-nav':''} key={item} aria-current={tab===item?'page':undefined} onClick={()=>navigate(item)}><Icon name={item}/>{item}</button>)}
        <button className="mobile-nav" ref={moreButton} aria-expanded={moreOpen} aria-controls="mobile-more" onClick={()=>setMoreOpen(!moreOpen)}><Icon name="More"/>More</button>
        <div className="mobile-more" id="mobile-more" hidden={!moreOpen}>{(['Resources','Settings'] as const).map(item=><button key={item} aria-current={tab===item?'page':undefined} onClick={()=>navigate(item)}><Icon name={item}/>{item}</button>)}</div>
      </nav>
    </div></header>
    <main id="main" ref={main} tabIndex={-1}>
      <div className="status" role="status">{status}</div>
      {!online && <p className="hint" role="status">Offline · Saved on this device. Online model downloads are unavailable.</p>}
      {undo && <div className="undo-notice"><button onClick={applyUndo}>{undo.label}</button><button className="text-button" onClick={()=>setUndo(undefined)}>Dismiss Undo</button></div>}
      <div className="page-heading"><h1>{tab === 'Progress' ? 'Well-Being Progress' : tab}</h1>
      {tab === 'Today' && <><time dateTime={today}>{dateLabel(today,{weekday:'short',month:'short',day:'numeric'})}</time><button className="progress-shortcut" aria-label="View well-being progress" onClick={() => navigate('Progress')}><Icon name="Progress"/><span className="progress-tooltip" aria-hidden="true">View progress</span></button></>}</div>
      {tab === 'Today' && mode === 'home' && setup && <Preferences {...preferences}
        settings={{...data.settings,...setup.preferences}} extras={{...data.extras,...setup.schedule}}
        update={patch=>{persist({...data,setupDraft:{...setup,preferences:{...setup.preferences,...patch}}});}}
        schedule={patch=>{persist({...data,setupDraft:{...setup,schedule:{...setup.schedule,...patch}}});}}
        setup={{stage:setup.stage, jump:stage=>{persist({...data,setupDraft:{...setup,stage}});}, finish:saveSetup}}/>}
      {tab === 'Today' && mode === 'home' && agreed && !setup && !data.settings.setup && <section className="card setup-studio">
        <h2>Make IGNITE yours</h2><p>Choose what you’d like help with and what makes a next step feel doable. You can update your answers anytime.</p>
        <div className="actions"><button className="primary" onClick={startSetup}>Set up IGNITE</button><button className="text-button" onClick={() => saveSetup(false)}>Skip setup</button></div>
      </section>}
      {tab === 'Today' && mode === 'home' && !setup && <div hidden={!agreed || !data.settings.setup}>
        <p className="hint participation"><Icon name="Progress"/> {participation} {participation===1?'check-in':'check-ins'} in the last 7 days</p>
        {checkSaved && <div className="check-banner check-saved"><Icon name="Check"/><div>Check-in saved on this device.</div><button onClick={()=>navigate('Progress')}>See Progress</button></div>}
        <div className="check-options">{(isDue || dirty || data.ratingDrafts[today] || data.ratingContext[today]) && <section className="check-banner"><Icon name={windowName === 'evening' ? 'Sleep' : 'Morning'}/><div><strong>{dirty ? 'Check-in draft' : windowName === 'evening' ? 'Evening check-in' : 'Morning check-in'}</strong><span>{dirty || data.ratingDrafts[today] || data.ratingContext[today] ? 'Pick up where you left off' : 'Due today'}</span></div>
          <button onClick={() => data.ratingDrafts[today] || data.ratingContext[today] || (windowName === 'evening' && !dirty) ? openRating(today) : setMode('check')}>{dirty || data.ratingDrafts[today] || data.ratingContext[today] ? 'Resume check-in' : 'Check in'}</button>
          {isDue && <button className="text-button" onClick={() => persist({...data,prompts:{...data.prompts,[promptKey]:'skipped'}}, 'Check-in skipped for this window.')}>Skip</button>}</section>}
          <div className="actions check-links" aria-label="Check-in options"><button className="text-button" onClick={() => setMode('check')}>{dirty ? 'Open journal draft' : 'Start check-in'}</button><button className="text-button" onClick={() => {setInitialRating(false);openRating(today);}}>Evening ratings</button></div>
        </div>
        <section className="today-card"><div key={todayStep.title} className="enter"><h2>{todayStep.title}</h2><p>{todayStep.reason}</p></div>
          {pendingRetry && <p>A smaller step will appear tomorrow. You can also try it now.</p>}
          {stepLogged ? <div className="actions"><span className={lastStep?.outcome==='Done'?'pill done-badge':'pill'}>{lastStep?.outcome ? lastStep.outcome+' saved' : 'Feedback saved'}</span>
            {pendingRetry && <button className="primary" onClick={()=>persist({...data,active:pendingRetry.smaller,stepRetry:undefined},'Smaller step saved on this device.')}>Try a smaller step now</button>}
            {lastStep && lastStep.barrier!=='Too big' && <button onClick={()=>followUp(lastStep.outcome,'Too big',lastStep.step,lastStep)}>Too big</button>}
            <button className="text-button" onClick={()=>setMode('check')}>Find another step</button>
          </div> : <div className="actions" aria-label="Record your next step">
            <button className="primary" onClick={()=>followUp('Done','')}>Done</button>
            <button onClick={()=>followUp('Partly done','')}>Partly done</button>
            <button onClick={()=>followUp('','Too big')}>Too big</button>
            <button onClick={()=>followUp('Skipped','')}>Skip<span className="sr-only"> step</span></button>
            {retry && !data.active ? <button className="text-button" onClick={()=>persist({...data,active:retry.original,stepRetry:undefined,smaller:null},'Original step kept.')}>Keep original step</button>
              : <button className="text-button" onClick={()=>persist({...data,active:shrink(todayStep),smaller:null,stepRetry:undefined},'Step adjusted.')}>Make it smaller</button>}
            {data.active && <button className="text-button" onClick={()=>setMode('outcome')}>How did it go?</button>}
          </div>}
        </section>
        <div className="quick-strip">{[['Sleep','Sleep'],['Water','Hydration'],['Meal','Meals'],['Movement','Activity']].map(([label,target]) => <button key={label} aria-label={label+' Log'} onClick={() => { navigate('Health');setSection(target); }}><Icon name={label}/><strong>{label}</strong><small>{label==='Water' && waterToday ? waterToday+' mL' : 'Log'}</small></button>)}
          <button onClick={() => navigate('Plan')}><Icon name="Plan"/><strong>Tonight</strong><small>Stopping time {timeLabel(data.extras.stop,data.settings.clockStyle)} · Cut &amp; Keep</small></button></div>
      </div>}
      {tab === 'Today' && mode === 'ratings' && <section className="card"><button className="text-button" onClick={closeRating}>← Back</button><h2>{initialRating ? 'Initial check-in' : 'Evening check-in'}</h2><p>{dateLabel(date)} · {oldRating ? 'Review your saved answers before making changes.' : 'Answer as many as you like.'}</p>
        <form onSubmit={e=>{e.preventDefault();finishRating();}}>{pillars.map(([name,question],i)=><label className="rating-field" key={name}>{question}<select aria-label={question} value={ratingDraft[i] ?? ''} onChange={e => { const next = [...ratingDraft] as Ratings; next[i] = e.target.value ? Number(e.target.value) : null; persist({...data,ratingDrafts:{...data.ratingDrafts,[date]:next}}); }}><option value="">Skip this question</option>{scales.map((label,n)=><option key={label} value={n+1}>{n+1} {label}</option>)}</select></label>)}
        <label className="rating-field">Optional reflection<textarea rows={2} maxLength={1200} value={ratingContext.note} onChange={e=>persist({...data,ratingContext:{...data.ratingContext,[date]:{...ratingContext,note:e.target.value}}})}/></label>
        <label className="rating-field">Optional emotion tag<select value={ratingContext.tag} onChange={e=>persist({...data,ratingContext:{...data.ratingContext,[date]:{...ratingContext,tag:e.target.value}}})}><option value="">Skip tag</option>{tags.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
        <button className="primary">Save ratings</button></form></section>}
      {tab === 'Today' && mode === 'check' && <section className="journal surface enter">
        <button className="text-button" onClick={() => navigate('Today')}>← Back to Today</button>
        <form onSubmit={event => { event.preventDefault(); cancelInference(); review(); }}>
          <h1><label htmlFor="journal">What’s on your mind?</label></h1>
          <textarea id="journal" rows={5} placeholder="Write a few words about how today went." maxLength={1200} value={draft.note} onChange={e => { cancelInference(); edit({ note: e.target.value }); }} aria-describedby="local-note" />
          <p id="local-note" className="hint">Optional. Your draft saves in this browser as you write.</p>
          <button type="button" disabled={!online || !draft.note.trim() || tagStatus === 'Finding a suggestion…'} onClick={modelTag}>Suggest an emotion</button>
          <p className="hint" role="status">{!online?'Emotion suggestion is unavailable offline. You can choose a tag.':tagStatus === 'Suggested emotion · you can change the tag below.' ? <>Suggested emotion: {tags.find(([id])=>id===draft.tag)?.[1]}<br/>GoEmotions-trained classifier</> : tagStatus || 'Ask for a suggestion or choose your own tag.'}</p>
          <div className="form-grid">
            <label>Emotion tag<select value={draft.tag} onChange={e => { cancelInference(); edit({ tag: e.target.value as Tag }); }}><option value="">Choose my own</option>{tags.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
            <label>Available time<select value={draft.time} onChange={e => { cancelInference(); edit({ time: Number(e.target.value) }); }}>{[1, 2, 5, 10, 20].map(n => <option key={n} value={n}>About {n} min</option>)}</select></label>
            <label>Energy<select value={draft.energy} onChange={e => { cancelInference(); edit({ energy: e.target.value }); }}>{['Low', 'Steady', 'High'].map(item => <option key={item}>{item}</option>)}</select></label>
          </div>
          <button className="primary">Review my step <span aria-hidden="true">→</span></button>
        </form>
      </section>}
      {tab === 'Today' && mode === 'step' &&
        <Panel title="Next step" subtitle="Start with what feels doable.">
          <button className="text-button" onClick={() => setMode(data.active ? 'home' : 'check')}>← Back</button>
          <p className="eyebrow">About {step.minutes} min</p>
          <div className="note" aria-live="polite"><div key={step.title} className="enter"><h2>{step.title}</h2><p>{step.reason}</p></div></div>
          <div className="actions"><button className="primary" onClick={saveStep}>Save my step</button>
            <button onClick={() => setStep(shrink(step))}>Make it smaller</button>
            <button onClick={() => { setStep(recommend(draft, !swapped)); setSwapped(!swapped); }}>Swap</button>
            <button onClick={() => setStep(rest)}>Rest</button></div>
        </Panel>}
      {tab === 'Today' && mode === 'outcome' && <section className="journal surface enter">
        <button className="text-button" onClick={() => setMode('home')}>← Back to Today</button>
        <h1>How did it go?</h1><p>{data.active?.title}</p>
        <form onSubmit={e => { e.preventDefault(); followUp(); }}>
          <div className="form-grid"><label>Outcome<select value={outcome} onChange={e => setOutcome(e.target.value)}>{['Done', 'Partly done', 'Skipped'].map(v => <option key={v}>{v}</option>)}</select></label>
          <label>What got in the way?<select value={barrier} onChange={e => setBarrier(e.target.value)}><option value="">Optional</option>{['Too big', 'No time', 'Low energy', 'Something else'].map(v => <option key={v}>{v}</option>)}</select></label></div>
          <button className="primary">Save outcome</button>
        </form>
      </section>}
      {tab === 'Progress' && <><Progress today={today} selected={!progressDate || progressDate>today?today:progressDate} select={day=>routeTo('Progress',day)} checks={data.checks} drafts={data.ratingDrafts} writeDraft={(day,ratings)=>{const drafts={...data.ratingDrafts};if(ratings)drafts[day]=ratings;else delete drafts[day];persist({...data,ratingDrafts:drafts});}} outcomes={data.history} zone={zone} edit={day=>{setInitialRating(false);openRating(day,true);}} save={saveRatingEdit} remove={removeRating} context={context} editOutcome={editOutcome} deleteOutcome={deleteOutcome}/>
        {!!data.journalHistory.length && <details className="card"><summary>Journal history</summary>{data.journalHistory.map((item,i)=><p key={i}>{item.date} · {item.note} {item.tag && '('+item.tag+')'}</p>)}</details>}</>}
      {tab === 'Settings' && (manage ? <section className="card">
        <button className="text-button" onClick={()=>setManage(false)}>← Back to Settings</button><h2>Saved entries</h2>
        <button onClick={()=>navigate('Progress')}>Review check-ins in Progress</button>
        {(Object.keys(logGroups) as (keyof typeof logGroups)[]).map(group=><details key={group}><summary>{logGroups[group]} ({data.extras[group].length})</summary>
          {data.extras[group].map(item=><div className="paired" key={item.id}><span>{item.day} · {item.text}</span><button aria-label={`Delete ${logGroups[group]} entry from ${item.day}: ${item.text}`} onClick={()=> {
            if (window.confirm('Delete this saved entry?') && persist({...data,extras:{...data.extras,[group]:data.extras[group].filter(log=>log.id!==item.id)}},'Entry deleted.')) {
              setUndo({label:'Undo health entry deletion',apply:latest=>latest.extras[group].some(row=>row.id===item.id)?latest:{...latest,extras:{...latest.extras,[group]:[item,...latest.extras[group]]}}});
            }
          }}>Delete</button></div>)}
        </details>)}
      </section> : <Preferences {...preferences} />)}
      {tab === 'Plan' && <section className="card"><h2>Goals &amp; habits</h2><p>{pillars.filter((_,i)=>data.settings.goals[i]).map(p=>p[0]).join(' · ') || 'Choose goals in Personalization.'}</p>{data.settings.habits && <p>{data.settings.habits}</p>}<button onClick={()=>navigate('Settings')}>Edit goals and habits</button></section>}
      {(['Health','Plan'] as const).map(view=><div key={view+resetToken} hidden={tab!==view}><ExtraPage tab={view} data={data.extras} section={section} setSection={setSection} date={today} zone={zone} units={data.settings.units} clockStyle={data.settings.clockStyle} update={(patch,message)=>persist({...data,extras:{...data.extras,...patch}},message)}/></div>)}
      <div hidden={tab!=='Resources'}><FieldNotes key={resetToken} scratch={data.scratch??''} editScratch={scratch=>persist({...data,scratch})} saveNote={note=>persist({...data,scratch:'',draft:{...draft,note:draft.note?[draft.note,note].join('\n').slice(0,1200):note}},'Added to Today’s note on this device.')} addStep={title=>{const saved=persist({...data,active:{title,minutes:2,reason:'You chose this micro-step from Field Notes.'},smaller:null,stepRetry:undefined},'Micro-step added to Today.');if(saved)routeTo('Today');return saved;}} openToday={()=>routeTo('Today')} openJournal={()=>{navigate('Today');setMode('check');}} openMeals={()=>{navigate('Health');setSection('Meals');}} smaller={data.stepRetry?.smaller.title} savedGuides={data.extras.savedGuides} toggleGuide={name=>persist({...data,extras:{...data.extras,savedGuides:data.extras.savedGuides?.includes(name)?data.extras.savedGuides.filter(item=>item!==name):[...(data.extras.savedGuides??[]),name]}},'Saved guides updated.')}/></div>
    </main>
    <footer><div>This project is a prototype and is not medical advice.</div><div className="footer-actions">
      {['Privacy', 'Terms', 'Storage'].map(item => <button className="text-button" key={item} aria-expanded={policy === item} onClick={() => setPolicy(policy === item ? '' : item)}>{item}</button>)}
      <button className="text-button" onClick={clear}>Delete my history</button>
    </div>
    {policy && <div className="policy"><PolicyCopy notice={policy === 'Terms' ? 'terms' : 'privacy'}/></div>}
    </footer>
    <Lantern key={data.settings.logAccess+resetToken} today={today} introReady={agreed&&data.settings.setup} nudge={retry?'Want a smaller step?':undefined} visible={data.settings.mascotVisible} data={data.lantern} save={lantern=>persist({...latest.current,lantern},status)} allow={data.settings.logAccess === 'ask'} active={data.active??retry?.original??null} apply={next=>persist({...data,active:next,smaller:null,stepRetry:undefined},'Step updated.')}
      summary={question=>{
        const q = question.toLowerCase();
        const period = /last week/.test(q) ? 'last week' : /this week/.test(q) ? 'this week' : /yesterday/.test(q) ? 'yesterday' : 'today';
        const start = period === 'last week' ? plusDays(monday(today),-7) : period === 'this week' ? monday(today) : period === 'yesterday' ? plusDays(today,-1) : today;
        const end = period === 'last week' ? plusDays(start,6) : period === 'yesterday' ? start : today;
        const inPeriod = (row:{day:string})=>row.day>=start && row.day<=end;
        if (/water|hydrat/.test(q)) {
          const water = data.extras.water.filter(inPeriod);
          const missing = water.filter(row=>row.ml===undefined).length;
          if (!water.length) return 'No water entries recorded '+period+'.';
          if (missing === water.length) return 'Water was logged '+period+', but the entries have no recorded volumes.';
          return 'Water: ' + water.reduce((total,row)=>total+(row.ml ?? 0),0) + ' mL recorded '+period+'.' + (missing ? ' Some entries have unknown volumes.' : '');
        }
        const topic = /sleep|slept/.test(q) ? 'sleep' : /movement|activit|walk/.test(q) ? 'activity' : /meal|ate/.test(q) ? 'meals' : null;
        if (topic) {
          const rows = data.extras[topic].filter(inPeriod);
          return rows.length ? rows.map(row=>dateLabel(row.day)+': '+row.text).join('; ') : 'No '+(topic==='meals'?'meal':topic)+' entries recorded '+period+'.';
        }
        if (/score|rating|progress|pillar/.test(q)) {
          const dates = Array.from({length:7},(_,index)=>plusDays(start,index)).filter(day=>day<=end);
          const result = weekly(data.checks,dates);
          return result.score===null ? 'There aren’t enough ratings for an overall score '+period+'. Coverage: '+result.coverage.join(', ')+' rated days in pillar order.' : 'Your overall score '+period+' is '+result.score.toFixed(1)+' / 5 · '+result.stage+'.';
        }
        const counts = (Object.keys(logGroups) as (keyof typeof logGroups)[]).map(group=>logGroups[group]+': '+data.extras[group].filter(inPeriod).length);
        return 'Entries '+period+' · '+counts.join(' · ')+'.';
      }} />
  </div>;
}

createRoot(document.getElementById('root')!).render(<App />);
