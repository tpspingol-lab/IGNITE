import { useEffect, useRef, useState } from 'react';

export const termsVersion = '2026-11-15';
export type LegalChoice = {version:string; acceptedAt:string};

export function PolicyCopy({notice}:{notice:'privacy'|'terms'}) {
  return notice === 'privacy' ? <section><h3>Privacy Notice</h3>
    <p>IGNITE stores settings, drafts, check-ins, logs, and conversations in browser storage for this site address. Selected meal photos are processed in browser memory. Clearing browser storage removes local records. You can export or delete your history in Settings.</p>
    <p>This local build uses essential browser storage to remember your choices and has no app analytics or tracking cookies. The production app caches its own public files for offline use. If you enable local chat or photo recognition, the browser requests public model files from Hugging Face and may cache them. Those requests can expose ordinary connection information such as your IP address. Your entries and photos are processed on this device.</p>
    <p>Lantern asks before using a summary of your records in a reply. The app computes those answers on this device. A backup contains your personal entries. Importing a backup changes records here only after you review and confirm it.</p>
  </section> : <section><h3>Terms of Use</h3>
    <p>IGNITE is a prototype for personal reflection and everyday routines. You decide whether to use a suggestion. Model replies and meal estimates can be inaccurate. This project is a prototype and is not medical advice.</p>
    <p>This build has no account or cloud recovery. You can stop using it at any time and remove your records in Settings.</p>
    <p className="hint">Prototype policy copy · pending review before public release · version {termsVersion}</p>
  </section>;
}

export function TermsGate({accept}:{accept:()=>boolean}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [agree,setAgree] = useState(false);
  const [failed,setFailed] = useState(false);
  const [notice,setNotice] = useState<'privacy'|'terms'>();
  useEffect(()=>{dialog.current?.showModal();},[]);
  return <dialog ref={dialog} className="card terms-gate" aria-labelledby="terms-heading" onCancel={event=>event.preventDefault()}>
    <h2 id="terms-heading">Key facts before you continue</h2>
    <dl><dt>Privacy</dt><dd>Your personal entries stay in this browser. You control log access in Lantern.</dd>
      <dt>Storage</dt><dd>Essential storage keeps your progress and preferences. Optional model downloads come from Hugging Face.</dd>
      <dt>Terms</dt><dd>IGNITE offers everyday well-being support. You choose what to try.</dd></dl>
    <div className="actions"><button className="text-button" onClick={()=>setNotice('privacy')}>Privacy Notice</button><button className="text-button" onClick={()=>setNotice('terms')}>Terms of Use</button></div>
    {notice && <div className="policy-detail"><button className="text-button" onClick={()=>setNotice(undefined)}>← Back to key facts</button><PolicyCopy notice={notice} /></div>}
    <label className="toggle"><input type="checkbox" checked={agree} onChange={event=>setAgree(event.target.checked)}/>I agree to the Terms of Use</label>
    <button className="primary" disabled={!agree} onClick={()=>setFailed(!accept())}>Continue</button>
    {failed && <p role="alert">Your choice couldn’t be saved. Check that browser storage is available and retry.</p>}
  </dialog>;
}
