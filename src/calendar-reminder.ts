import { clockAt, localDate, plusDays } from './wellbeing';
import type { Settings } from './wellbeing';

export function eveningReminderTime(bedtime:string) {
  const [hour,minute] = bedtime.split(':').map(Number);
  return bedtime<='02:00'?'20:00':String(hour-2).padStart(2,'0')+':'+String(minute).padStart(2,'0');
}

function publicAppUrl() {
  try {
    const url=new URL(import.meta.env.VITE_PUBLIC_APP_URL);
    if (url.protocol==='https:' && !url.username && !url.password) return url.href;
  } catch { /* The local build can omit a public address. */ }
}

function foldLine(line:string) {
  const encoder=new TextEncoder();
  let folded='', size=0;
  for (const character of line) {
    const bytes=encoder.encode(character).length;
    if (size+bytes>75) {folded+='\r\n ';size=1;}
    folded+=character;
    size+=bytes;
  }
  return folded;
}

export function downloadReminders(settings:Settings, wake:string, bedtime:string) {
  const now=new Date();
  const stamp = now.toISOString().replace(/[-:]|\.\d{3}/g,'');
  const day = localDate(settings.zone,now);
  const clock = clockAt(settings.zone,now);
  const link = publicAppUrl();
  const events = [
    { enabled:settings.morning, name:'Morning', start:wake },
    { enabled:settings.evening, name:'Evening', start:eveningReminderTime(bedtime) }
  ].filter(reminder=>reminder.enabled);
  if (!events.length) return;
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//IGNITE//Check-in reminders//EN',...events.flatMap(event=>{
    const upcoming=event.start<=clock?plusDays(day,1):day;
    const dateTime=upcoming.replaceAll('-','')+'T'+event.start.replace(':','')+'00';
    return [
      'BEGIN:VEVENT','UID:'+crypto.randomUUID()+'@ignite.local','DTSTAMP:'+stamp,
      'DTSTART:'+dateTime,'RRULE:FREQ=DAILY','SUMMARY:IGNITE '+event.name+' check-in',
      ...(link?['URL:'+link]:[]),'BEGIN:VALARM','TRIGGER:PT0M','ACTION:DISPLAY','DESCRIPTION:Time for an IGNITE check-in','END:VALARM','END:VEVENT',
    ];
  }),'END:VCALENDAR',''];
  const url=URL.createObjectURL(new Blob([lines.map(foldLine).join('\r\n')],{type:'text/calendar;charset=utf-8'}));
  const download=document.createElement('a');download.href=url;download.download='ignite-check-ins.ics';download.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
