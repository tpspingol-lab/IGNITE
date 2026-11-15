import { test, expect, visit, navigateTo } from './browser';

test('Lantern gives a concrete confidence exercise and follows the topic', async ({page}) => {
  await visit(page);
  await page.getByRole('button',{name:'Ask Lantern',exact:true}).click();
  const message = page.getByLabel('Message Lantern');
  await message.fill('how to gather confidence');
  await page.getByRole('button',{name:'Send',exact:true}).click();
  await expect(page.getByRole('log')).toContainText('write one sentence');
  await message.fill('then suggest');
  await page.getByRole('button',{name:'Send',exact:true}).click();
  await expect(page.getByRole('log')).toContainText('share one opinion');
  await expect(page.getByRole('log')).not.toContainText('Avoid medical advice');
});

test('preserves evening drafts, scores three rated days, and handles edits',async({page})=>{
  await page.clock.setFixedTime(new Date('2026-11-11T21:00:00Z'));
  await page.addInitScript(()=>{
    if (localStorage.getItem('ignite-veritas-v1')) return;
    localStorage.setItem('ignite-veritas-v1',JSON.stringify({settings:{zone:'UTC'},checks:[9,10].map(day=>({date:'2026-11-'+String(day).padStart(2,'0'),zone:'UTC',version:'ignite-pillars-v1',updated:'2026-11-11T21:00:00Z',ratings:[4,4,4,4]}))}));
  });
  await visit(page);
  await page.getByRole('button',{name:'Check in',exact:true}).click();
  const selects=page.locator('.rating-field select');
  await selects.nth(0).selectOption('4');
  await page.reload();
  await page.getByRole('button',{name:'Resume check-in'}).click();
  await expect(selects.nth(0)).toHaveValue('4');
  for(let i=1;i<4;i++) await selects.nth(i).selectOption('4');
  await page.getByRole('button',{name:'Save ratings'}).click();
  await expect(page.getByText('Evening check-in',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'View well-being progress'}).click();
  await expect(page.locator('.ring')).toContainText('4.0 / 5');
  await expect(page.locator('.ring')).toContainText('Doing well');
  await page.getByRole('button',{name:'Edit ratings'}).click();
  await selects.nth(0).selectOption('');
  await page.getByRole('button',{name:'Save ratings'}).click();
  await expect(page.locator('.ring')).toContainText('4.0 / 5');
  await expect(page.getByRole('row',{name:/Emotional Balance/})).toContainText('3 / 3');
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Delete check-in'}).click();
  await expect(page.getByRole('row',{name:/Emotional Balance/})).toContainText('2 / 3');
});

test('Lantern asks before using a targeted summary and retains chat between tabs',async({page})=>{
  await visit(page);
  await page.getByRole('button',{name:'Ask Lantern',exact:true}).press('Enter');
  const message=page.getByLabel('Message Lantern');
  await message.fill('How much water did I log?');
  await page.getByRole('button',{name:'Send',exact:true}).click();
  await expect(page.getByText('No water entries recorded today.')).toBeVisible();
  await page.getByRole('button',{name:'Allow once'}).click();
  await expect(page.getByRole('log')).toContainText('No water entries recorded today.');
  await page.getByRole('button',{name:'Dock left'}).click();
  await expect(page.getByRole('button',{name:'Ask Lantern',exact:true})).toHaveClass(/dock-left/);
  await page.getByRole('button',{name:'Close Ask IGNITE'}).click();
  await page.getByRole('button',{name:'Water Log'}).click();
  await page.getByRole('button',{name:'Precise amount'}).click();
  await page.getByLabel('Volume (mL)').fill('500');
  await page.getByRole('button',{name:'Add a glass'}).click();
  await page.getByRole('button',{name:'Ask Lantern',exact:true}).click();
  await message.fill('How much water did I log?');
  await page.getByRole('button',{name:'Send',exact:true}).click();
  await expect(page.getByText('Water: 500 mL recorded today.')).toBeVisible();
  await page.getByRole('button',{name:'Allow once'}).click();
  await expect(page.getByRole('log')).toContainText('Water: 500 mL recorded today.');
  await expect(page.getByRole('log')).toContainText('No water entries recorded today.');
});

test('dismissed morning prompt stays dismissed on return',async({page})=>{
  await page.clock.setFixedTime(new Date('2026-11-11T09:00:00Z'));
  await page.addInitScript(()=>{if(!localStorage.getItem('ignite-veritas-v1'))localStorage.setItem('ignite-veritas-v1',JSON.stringify({settings:{zone:'UTC'}}));});
  await visit(page);
  await expect(page.getByText('Morning check-in',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Skip',exact:true}).click();
  await page.reload();
  await expect(page.getByText('Morning check-in',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Take a five-minute break.'})).toBeVisible();
});

test('dragging Lantern saves its position through reload',async({page})=>{
  await visit(page);
  const lantern=page.getByRole('button',{name:'Ask Lantern',exact:true});
  const rect=(await lantern.boundingBox())!;
  await page.mouse.move(rect.x+30,rect.y+30);
  await page.mouse.down();
  await page.mouse.move(rect.x-60,rect.y-85,{steps:8});
  await page.mouse.up();
  await expect(lantern).toHaveAttribute('aria-expanded','false');
  const moved=(await lantern.boundingBox())!;
  expect(moved.y).toBeLessThan(rect.y-80);
  await page.reload();
  const restored=(await lantern.boundingBox())!;
  expect(restored.y).toBeCloseTo(moved.y,0);
});

test('changing the time zone preserves saved dates and original zones',async({page})=>{
  await page.clock.setFixedTime(new Date('2026-11-11T21:00:00Z'));
  await page.addInitScript(()=>{if(!localStorage.getItem('ignite-veritas-v1'))localStorage.setItem('ignite-veritas-v1',JSON.stringify({settings:{zone:'UTC'}}));});
  await visit(page);
  await page.getByRole('button',{name:'Evening ratings'}).click();
  await page.locator('.rating-field select').first().selectOption('3');
  await page.getByRole('button',{name:'Save ratings'}).click();
  await navigateTo(page,'Settings');
  await page.getByRole('button',{name:'Schedule',exact:true}).click();
  await page.getByLabel('Time zone').selectOption('Asia/Dubai');
  await page.reload();
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Today',exact:true}).click();
  await page.getByRole('button',{name:'View well-being progress'}).click();
  await page.getByRole('button',{name:'First check-in'}).click();
  await expect(page.getByRole('heading',{name:'Wednesday, November 11'})).toBeVisible();
  await page.getByText('Details',{exact:true}).click();
  await expect(page.getByText('UTC',{exact:true})).toBeVisible();
  await expect(page.locator('.ring')).toHaveText('Gathering data');
});

test('saves a Field Note and adds its confirmed action to Today',async({page})=>{
  await visit(page);
  await navigateTo(page,'Resources');
  await page.getByRole('button',{name:'Sleep',exact:true}).click();
  await page.getByRole('button',{name:'Save guide',exact:true}).click();
  await expect(page.getByRole('button',{name:'Unsave guide'})).toBeVisible();
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Add action to Today'}).click();
  await expect(page.getByRole('heading',{name:'Take two minutes to wind down.'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading',{name:'Take two minutes to wind down.'})).toBeVisible();
});
