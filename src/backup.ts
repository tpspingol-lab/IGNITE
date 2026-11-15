type Dictionary = Record<string, unknown>;
type Guard = (value: unknown) => boolean;
type CollectionSummary = { checkIns:number; steps:number; healthLogs:number; chatMessages:number; tasks:number };

const version = 1;
const maxLength = 5_000_000;
const object = (value:unknown):value is Dictionary => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value:unknown,max=80_000) => typeof value === 'string' && value.length<=max;
const nonempty = (value:unknown) => typeof value === 'string' && value.trim().length>0 && value.length<=4000;
const integer = (min:number,max:number):Guard => value=>typeof value==='number' && Number.isInteger(value) && value>=min && value<=max;
const decimal = (value:unknown) => typeof value==='number' && Number.isFinite(value) && value>=0;
const boolean = (value:unknown) => typeof value==='boolean';
const choice = (...options:unknown[]):Guard => value=>options.includes(value);
const optional = (guard:Guard):Guard => value=>value===undefined || guard(value);
const nullable = (guard:Guard):Guard => value=>value===null || guard(value);
const fields = (guards:Record<string,Guard>):Guard => value=>object(value) && Object.entries(guards).every(([key,guard])=>guard(value[key]));
const list = (guard:Guard):Guard => value=>Array.isArray(value) && value.every(item=>guard(item));
const lookup = (key:Guard, guard:Guard):Guard => value=>object(value) && Object.entries(value).every(([property,item])=>key(property) && guard(item));
const date = (value:unknown) => {
  if (typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value+'T00:00:00.000Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10)===value;
};
const instant = (value:unknown) => typeof value==='string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  && date(value.slice(0,10)) && Number.isFinite(Date.parse(value));
const clock = (value:unknown) => typeof value==='string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const partialSchedule = lookup(choice('wake','win','stop'),clock);
const zone = (value:unknown) => {
  if (typeof value!=='string' || value.length>80) return false;
  try { new Intl.DateTimeFormat('en',{timeZone:value}); return true; }
  catch { return false; }
};
const ratings = (value:unknown) => Array.isArray(value) && value.length===4 && value.every(nullable(integer(1,5)));
const reflection = fields({note:text,tag:text});
const stepLength = integer(1,1440);
const step = fields({ title:nonempty, minutes:stepLength, reason:text,
  smaller:optional(nullable(fields({title:nonempty,minutes:stepLength}))) });
const settings = fields({
  zone:optional(zone),setup:optional(boolean),goals:optional(value=>Array.isArray(value) && value.length===4 && value.every(boolean)),
  habits:optional(text),morning:optional(boolean),evening:optional(boolean),reduce:optional(boolean),
  logAccess:optional(choice('ask','never')),theme:optional(choice('system','light','dark')),barriers:optional(list(text)),
  stepSize:optional(choice(2,5,10)),textSize:optional(choice('standard','large')),units:optional(choice('metric','us')),
  clockStyle:optional(choice('system','12','24')),mascotVisible:optional(boolean),
});
const checkIn = fields({ date,zone,version:nonempty,updated:instant,ratings,note:optional(text),tag:optional(text) });
const outcome = fields({ id:nonempty,date:value=>date(value)||instant(value),day:optional(date),zone:optional(zone),step,
  outcome:choice('Done','Partly done','Skipped',''),barrier:text });
const task = fields({id:nonempty,label:nonempty,minutes:stepLength,original:stepLength,later:boolean,done:optional(boolean)});
const log = fields({ id:nonempty,day:date,text:nonempty,enteredAt:optional(instant),zone:optional(zone),
  ml:optional(integer(1,5000)),label:optional(value=>nonempty(value) && text(value,80)),grams:optional(integer(1,5000)),
  quality:optional(text),minutes:optional(integer(0,1440)),band:optional(choice('Under 6 h','6 to under 7 h','7 to under 8 h','8 h or more')) });
const message = fields({role:choice('user','assistant'),text});
const healthGroups = ['sleep','water','meals','activity'] as const;

function requireCollection(value:unknown, guard:Guard, name:string, unique?:(row:Dictionary)=>string) {
  if (!Array.isArray(value) || !value.every(guard)) throw new Error('Invalid '+name+' in the backup.');
  if (unique) {
    const keys=value.map(unique);
    if (new Set(keys).size!==keys.length) throw new Error('Duplicate records in '+name+'.');
  }
  return value.length;
}

const byId=(row:Dictionary)=>String(row.id);

function verifyRecords(data:Dictionary):CollectionSummary {
  const { extras, lantern } = data;
  if (!object(extras) || !fields({wake:clock,win:clock,stop:clock,waterCupMl:optional(integer(1,5000)),
    waterGoalMl:optional(integer(1,10000)),savedGuides:optional(list(text))})(extras)) {
    throw new Error('Invalid health settings in the backup.');
  }
  if (!object(lantern) || !fields({dock:choice('left','right'),x:optional(decimal),y:optional(decimal),
    introSeen:optional(boolean),cueDay:optional(date)})(lantern)) {
    throw new Error('Invalid Lantern settings in the backup.');
  }
  const summary = {
    checkIns:requireCollection(data.checks,checkIn,'check-ins',row=>JSON.stringify([row.date,row.version])),
    steps:requireCollection(data.history,outcome,'step history',byId),
    healthLogs:healthGroups.reduce((total,group)=>total+requireCollection(extras[group],row=>{
      if (!object(row) || !log(row)) return false;
      if (group==='sleep') return row.band===undefined ? optional(integer(0,1439))(row.minutes) : row.minutes===undefined;
      if (group==='activity') return optional(integer(1,1440))(row.minutes);
      return true;
    },group+' history',byId),0),
    chatMessages:requireCollection(lantern.messages,message,'chat history'),
    tasks:requireCollection(extras.tasks,task,'plan tasks',byId),
  };
  requireCollection(data.journalHistory,fields({date,note:text,tag:text}),'journal history');
  return summary;
}

export function createBackup<T>(data:T) {
  return {app:'IGNITE' as const,version,exportedAt:new Date().toISOString(),data};
}

export function parseBackup(input:string):{data:unknown;summary:CollectionSummary;legacy:boolean} {
  if (input.length>maxLength) throw new Error('This backup is too large to restore here.');
  let payload:unknown;
  try { payload=JSON.parse(input); }
  catch { throw new Error('Choose a valid IGNITE JSON backup.'); }
  if (!object(payload)) throw new Error('Choose a valid IGNITE JSON backup.');

  const remaining:unknown[]=[payload];
  while (remaining.length) {
    const value=remaining.pop();
    if (value===null || typeof value!=='object') continue;
    for (const [name,item] of Object.entries(value)) {
      if (name==='__proto__' || name==='prototype' || name==='constructor') throw new Error('The backup contains an unsafe field.');
      remaining.push(item);
    }
  }

  const legacy = !Object.hasOwn(payload,'app') && !Object.hasOwn(payload,'version');
  if (!legacy && (payload.app!=='IGNITE' || payload.version!==version || !instant(payload.exportedAt))) {
    throw new Error('This IGNITE backup version is unsupported.');
  }
  const data = legacy ? {
    settings:{},checks:[],prompts:{},ratingDrafts:{},ratingContext:{},lantern:{dock:'right',messages:[]},journalHistory:[],
    ...payload,
  } : payload.data;
  if (!object(data) || !fields({
    draft:fields({note:text,tag:choice('','nervousness','disappointment','sadness','anger','neutral','unsure'),
      time:integer(1,1440),energy:text}),
    active:nullable(step),smaller:nullable(step),settings,
    prompts:lookup(value=>typeof value==='string' && date(value.slice(0,10))
      && /^:(?:morning|evening|manual)$/.test(value.slice(10)),choice('completed','skipped')),
    ratingDrafts:lookup(date,ratings),ratingContext:lookup(date,reflection),scratch:optional(text),
    stepRetry:optional(nullable(fields({original:step,smaller:step,day:date,recordId:optional(nonempty)}))),
    legal:optional(fields({version:nonempty,acceptedAt:instant})),
    setupDraft:optional(fields({stage:integer(0,5),preferences:settings,schedule:partialSchedule})),
  })(data)) throw new Error('The backup has invalid IGNITE settings or drafts.');
  return {data,summary:verifyRecords(data),legacy};
}
