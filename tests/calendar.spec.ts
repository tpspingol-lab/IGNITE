import {readFile} from 'node:fs/promises';
import {test,expect,visit,navigateTo} from './browser';

test('downloads a recurring calendar with the configured local times and only selected reminders',async({page})=>{
  await page.clock.setFixedTime(new Date('2026-11-15T08:00:00Z'));
  await visit(page);
  const more=page.getByRole('button',{name:'More',exact:true});
  if (await more.isVisible()) await more.click();
  await navigateTo(page,'Settings');
  await page.getByRole('button',{name:'Schedule',exact:true}).click();
  await page.getByLabel('Time zone').selectOption('Asia/Dubai');
  await page.getByLabel('Wake time',{exact:true}).fill('07:35');
  await page.getByLabel('Bedtime',{exact:true}).fill('02:00');
  await page.getByRole('button',{name:'Reminders',exact:true}).click();

  async function readCalendar() {
    const download=page.waitForEvent('download');
    await page.getByRole('button',{name:'Download calendar reminders'}).click();
    const file=await download;
    expect(file.suggestedFilename()).toMatch(/\.ics$/);
    return readFile(await file.path(),'utf8');
  }

  const both=await readCalendar();
  expect(both).toMatch(/^BEGIN:VCALENDAR\r\nVERSION:2\.0\r\n/);
  expect(both).toContain('DTSTART:20261116T073500\r\nRRULE:FREQ=DAILY');
  expect(both).toContain('DTSTART:20261115T200000\r\nRRULE:FREQ=DAILY');
  const publicAppUrl=process.env.VITE_PUBLIC_APP_URL;
  if (publicAppUrl) expect(both.replace(/\r\n /g,'')).toContain('URL:'+new URL(publicAppUrl).href);
  else expect(both).not.toMatch(/^URL:/m);
  expect(both).toContain('\r\nBEGIN:VALARM\r\n');
  expect(both.split('\r\n').filter(line=>line==='BEGIN:VEVENT')).toHaveLength(2);
  expect(both.split('\r\n').every(line=>Buffer.byteLength(line)<=75)).toBe(true);

  await page.getByLabel('Morning check-in',{exact:true}).uncheck();
  const eveningOnly=await readCalendar();
  expect(eveningOnly).not.toContain('SUMMARY:IGNITE Morning check-in');
  expect(eveningOnly).toContain('SUMMARY:IGNITE Evening check-in');
  await page.getByLabel('Evening check-in',{exact:true}).uncheck();
  await expect(page.getByRole('button',{name:'Download calendar reminders'})).toBeDisabled();
});
