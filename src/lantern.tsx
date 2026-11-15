import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type { Step } from './steps';
import { shrink } from './steps';
import { asksAboutRecords, confidenceReply, guidedReply, usableReply } from './lantern-replies';
import { ChatSetup, useLocalChat } from './local-chat';
import './lantern.css';

export type Message = { role: 'user' | 'assistant'; text: string };
export type LanternData = { messages: Message[]; dock: 'left' | 'right'; x?: number; y?: number; introSeen?:boolean; cueDay?:string };
export const emptyLantern: LanternData = { messages: [], dock: 'right' };
type Props = { data: LanternData; save: (data: LanternData) => void; summary: (question:string)=>string; allow: boolean; active: Step | null; apply: (step: Step) => void; today?:string; nudge?:string; visible?:boolean; introReady?:boolean };
export function Lantern({ data, save, summary, allow, active, apply, today, nudge, visible=true, introReady=true }: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState('');
  const [proposal, setProposal] = useState<Step | null>(null);
  const localChat = useLocalChat();
  const [modelStatus,setModelStatus] = useState('');
  const [busy,setBusy] = useState(false);
  const [sending,setSending] = useState('');
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const snapshot = useRef({data,save});
  snapshot.current = {data,save};
  useEffect(()=>()=>{alive.current=false;controller.current?.abort();},[]);
  const [point, setPoint] = useState<{x:number;y:number}>();
  const pointRef = useRef<{x:number;y:number} | undefined>(undefined);
  const drag = useRef<{x:number;y:number;left:number;top:number;moved:boolean} | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const [intro,setIntro] = useState(false);
  const [shownCue,setShownCue] = useState<{date:string;text:string}>();
  const introOffered = useRef(false);
  const lastCue = useRef<string | undefined>(undefined);
  useEffect(() => { if (open) field.current?.focus(); }, [open]);
  useEffect(() => { if (log.current) log.current.scrollTop=log.current.scrollHeight; }, [open,data.messages,sending]);
  useEffect(()=>{
    if (!visible || !introReady || data.introSeen || introOffered.current) return;
    introOffered.current=true;
    setIntro(true);
    const current=snapshot.current;
    current.save({...current.data,introSeen:true});
  },[data.introSeen,introReady,visible]);
  useEffect(()=>{
    if (!intro) return;
    const timeout=window.setTimeout(()=>setIntro(false),5200);
    return ()=>window.clearTimeout(timeout);
  },[intro]);
  useEffect(()=>{
    if (!visible || !introReady || !data.introSeen || open || intro || !today || !nudge || data.cueDay===today || lastCue.current===today) return;
    lastCue.current=today;
    setShownCue({date:today,text:nudge});
    const current=snapshot.current;
    current.save({...current.data,cueDay:today});
  },[data.cueDay,data.introSeen,intro,introReady,nudge,open,today,visible]);

  function answer(question: string, context?: string) {
    const q = question.toLowerCase();
    const wantsStep = asksAboutStep(question);
    const wantsLogs = asksAboutRecords(question);
    let response = confidenceReply(question, data.messages) ?? guidedReply(question);
    if (wantsLogs) response = context ?? 'I can only answer from a summary you choose to share. You can review your recorded entries in Health or Progress.';
    else if (wantsStep && active) {
      response = 'Your current step is “' + active.title + '” ' + active.reason;
      if (active.smaller && /small|adjust|easier/.test(q)) {
        const next = shrink(active);
        setProposal(next);
        response = 'A smaller option is “' + next.title + '” It takes about ' + next.minutes + (next.minutes===1?' minute.':' minutes.') + ' You can apply it below.';
      }
    } else if (wantsStep) response = 'There is no saved step yet. You can start with the gentle default on Today.';
    const messages: Message[] = [...data.messages, {role:'user', text:question}, {role:'assistant', text:response}];
    save({ ...data, messages: messages.slice(-60) });
    setModelStatus(context ? 'Answer from the summary you shared.' : 'Quick guidance');
    setPending('');
    setInput('');
  }
  async function submit() {
    const question = input.trim();
    if (!question || controller.current) return;
    setProposal(null);
    const asksRecords = asksAboutRecords(question);
    if (allow && asksRecords) { setPending(question); return; }
    if (asksRecords || localChat.phase !== 'ready' || confidenceReply(question, data.messages) || asksAboutStep(question)) {
      answer(question);
      return;
    }
    const request = new AbortController();
    controller.current=request;
    setBusy(true);setSending(question);setInput('');setModelStatus('Thinking…');
    try {
      const {askLocal} = await import('./chat-client');
      // Personal summaries and saved conversation never enter the experimental model.
      const reply = await askLocal(question, request.signal);
      if (request.signal.aborted) return;
      if (!usableReply(reply,question)) throw new Error('Unusable model response');
      if (alive.current) {
        const current = snapshot.current;
        const messages: Message[] = [...current.data.messages,{role:'user',text:question},{role:'assistant',text:reply}];
        current.save({...current.data,messages:messages.slice(-60)});
        setInput('');setModelStatus('Reply generated on this device.');
      }
    } catch {
      if (alive.current && !request.signal.aborted) {
        const current=snapshot.current;
        const messages:Message[]=[...current.data.messages,{role:'user',text:question},{role:'assistant',text:guidedReply(question)}];
        current.save({...current.data,messages:messages.slice(-60)});
        setModelStatus('Quick guidance · the local model couldn’t provide a usable reply.');
      }
    } finally {
      controller.current=null;
      if (alive.current) {setBusy(false);setSending('');if(request.signal.aborted)requestAnimationFrame(()=>field.current?.focus());}
    }
  }
  function close() { setOpen(false); trigger.current?.focus(); }
  function move(event: PointerEvent<HTMLButtonElement>) {
    if (!drag.current) return;
    const initial = drag.current;
    const dx = event.clientX - initial.x, dy = event.clientY - initial.y;
    if (Math.hypot(dx,dy) < 6 && !initial.moved) return;
    initial.moved = true;
    pointRef.current = {
      x:Math.max(6,Math.min(window.innerWidth-100,initial.left+dx)),
      y:Math.max(6,Math.min(window.innerHeight-90,initial.top+dy)),
    };
    setPoint(pointRef.current);
  }
  const x = point?.x ?? data.x, y = point?.y ?? data.y;
  const cue = !open && visible ? intro ? 'Click me' : shownCue?.date===today && shownCue?.text===nudge ? shownCue?.text : undefined : undefined;
  return <>
    {open && <section className="lantern-chat card" data-dock={data.dock} aria-label="Ask IGNITE chat" onKeyDown={e => { if (e.key === 'Escape') close(); }}>
      <div className="paired"><h2>Ask IGNITE</h2><button aria-label="Close Ask IGNITE" onClick={close}>×</button></div>
      {localChat.phase !== 'ready' && <p className="hint">Quick guidance · built-in replies for everyday support</p>}
      <ChatSetup/>
      {modelStatus && <p className="hint" role="status">{modelStatus}</p>}
      <div ref={log} className="chat-log" role="log" aria-label="Conversation">{data.messages.map((m, i) => <p className={m.role} key={i}><strong>{m.role === 'user' ? 'You' : 'Lantern'}</strong>{m.text}</p>)}{sending && <p className="user"><strong>You</strong>{sending}</p>}</div>
      {busy && <button onClick={()=>{controller.current?.abort();setInput(sending);setSending('');setModelStatus('Reply stopped.');}}>Stop</button>}
      {pending && allow && <div className="consent"><strong>Use this summary for this reply?</strong><p>{summary(pending)}</p><div className="actions"><button onClick={() => answer(pending, summary(pending))}>Allow once</button><button onClick={() => answer(pending)}>Continue without logs</button></div></div>}
      {proposal && <div className="actions"><button onClick={() => { apply(proposal); setProposal(null); }}>Apply smaller step</button><button onClick={() => setProposal(null)}>Dismiss proposal</button></div>}
      <form onSubmit={e => {e.preventDefault();void submit();}}><label>Message Lantern<textarea ref={field} rows={2} maxLength={800} value={input} disabled={busy} onChange={e=>setInput(e.target.value)} /></label><button className="primary" disabled={busy || !!(pending && allow)}>Send</button></form>
      {localChat.phase === 'ready' && <p className="hint">Powered by SmolLM2 · Runs on this device.</p>}
      <div className="actions"><button onClick={() => { setPoint(undefined); save({...data,dock:'left',x:undefined,y:undefined}); }}>Dock left</button><button onClick={() => { setPoint(undefined); save({...data,dock:'right',x:undefined,y:undefined}); }}>Dock right</button></div>
    </section>}
    <div className={'lantern-launcher dock-' + data.dock} data-art={visible} data-dragging={!!point}
      style={x !== undefined && y !== undefined ? { left:`clamp(var(--lantern-left), ${x}px, calc(100vw - 100px))`, top:`clamp(6px, ${y}px, calc(100dvh - var(--lantern-bottom) - 90px))`, right:'auto', bottom:'auto' } : undefined}>
      {cue && <div className="lantern-cue"><span id="lantern-cue-text">{cue}</span>{cue!=='Click me' && <button type="button" aria-label="Dismiss Lantern cue" onClick={()=>setShownCue(undefined)}>×</button>}</div>}
      <button ref={trigger} type="button" className={'lantern-float dock-' + data.dock} aria-expanded={open} aria-describedby={cue?'lantern-cue-text':undefined} data-thinking={busy} data-intro={intro && visible}
      onPointerDown={e => { if(e.button !== 0) return; pointRef.current=undefined; const rect=e.currentTarget.getBoundingClientRect(); drag.current={x:e.clientX,y:e.clientY,left:rect.left,top:rect.top,moved:false};e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={move} onPointerCancel={() => { drag.current=null;setPoint(undefined); }}
      onPointerUp={() => { if (drag.current?.moved && pointRef.current) save({...data,...pointRef.current}); }}
      onClick={e => { if(e.detail === 0 || !drag.current?.moved) {setOpen(!open);setIntro(false);setShownCue(undefined);} drag.current=null;setPoint(undefined); }}>
        {visible && <span className="lantern-art" aria-hidden="true"><span className="lantern-body"><i/><i/></span></span>}
        <span className="lantern-label">Ask Lantern</span>
      </button>
    </div>
  </>;
}

function asksAboutStep(question:string) {
  return /\b(smaller|my (?:current |next |saved )?step|make (?:it|my step) easier|change my (?:step|task)|what(?:'s| is) my next step)\b/i.test(question);
}
