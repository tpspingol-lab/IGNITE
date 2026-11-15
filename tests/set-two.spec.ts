import {test, expect, visit, navigateTo} from './browser';

test('terms and setup persist independently, with an initial check-in in Progress', async ({page})=>{
  await page.clock.setFixedTime(new Date('2026-11-15T13:00:00Z'));
  await page.goto('/');
  const legal = page.getByRole('dialog',{name:'Key facts before you continue'});
  const proceed = legal.getByRole('button',{name:'Continue',exact:true});
  await expect(proceed).toBeDisabled();
  await legal.getByRole('button',{name:'Privacy Notice',exact:true}).click();
  await expect(legal.getByText(/no app analytics or tracking cookies/)).toBeVisible();
  await legal.getByRole('checkbox').check();
  await proceed.click();
  await page.getByRole('button',{name:'Set up IGNITE'}).click();
  await page.getByLabel('Physical Vitality',{exact:true}).check();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByLabel('Low energy',{exact:true}).check();
  await page.reload();
  await expect(legal).toHaveCount(0);
  await expect(page.getByLabel('Low energy',{exact:true})).toBeChecked();
  for (let i=0;i<4;i++) await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'Optional initial check-in'}).click();
  await page.getByLabel('How much physical energy did you have today?').selectOption('4');
  await page.getByLabel('How manageable did your emotions feel today?').selectOption('3');
  await page.getByLabel('How connected did you feel to the people who matter to you today?').selectOption('4');
  await page.getByLabel('How worthwhile did the things you did today feel?').selectOption('3');
  await page.getByRole('button',{name:'Save ratings'}).click();
  await expect(page.getByText('1 check-in in the last 7 days')).toBeVisible();
  await page.getByRole('button',{name:'View well-being progress'}).click();
  await expect(page.locator('.ring')).toContainText('3.5 / 5');
  await expect(page.locator('.ring')).toContainText('Feeling steady');
  await page.reload();
  await expect(page.locator('.ring')).toContainText('3.5 / 5');
  await expect(page.getByRole('row',{name:/Physical Vitality/}).locator('td[data-rating="4"]')).toHaveCount(1);
  await navigateTo(page,'Settings');
  await page.getByRole('button',{name:'Retake setup'}).click();
  await page.getByRole('button',{name:'Skip for now'}).click();
  await page.reload();
  await expect(page.getByRole('heading',{name:/Take a two-minute stretch break/})).toBeVisible();
  await page.getByRole('button',{name:'View well-being progress'}).click();
  await expect(page.getByRole('row',{name:/Physical Vitality/}).locator('td[data-rating="4"]')).toHaveCount(1);
});

test('Nov 15 Dubai ratings and outcomes share a week, while Nov 2–8 stays empty',async({page})=>{
  await page.clock.setFixedTime(new Date('2026-11-14T20:15:00Z'));
  await page.addInitScript(()=>{
    if (localStorage.getItem('ignite-veritas-v1')) return;
    localStorage.setItem('ignite-veritas-v1',JSON.stringify({
      settings:{zone:'Asia/Dubai',setup:true},
      history:[{id:'example',date:'2026-11-14T20:05:00Z',step:{title:'Review the first problem.'},outcome:'Done',barrier:''}],
    }));
  });
  await visit(page);
  await page.getByRole('button',{name:'Evening ratings'}).click();
  await page.getByLabel('How manageable did your emotions feel today?').selectOption('3');
  await page.getByRole('button',{name:'Save ratings'}).click();
  await page.reload();
  await page.getByRole('button',{name:'View well-being progress'}).click();
  await expect(page.getByText('Nov 9 – Nov 15, 2026',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Sunday, November 15'})).toBeVisible();
  await expect(page.getByRole('row',{name:/Emotional Balance/}).locator('td[data-rating="3"]')).toHaveCount(1);
  await expect(page.getByText('Review the first problem.')).toBeVisible();
  await page.getByRole('button',{name:'Previous week'}).click();
  await expect(page).toHaveURL(/week=2026-11-02/);
  await expect(page.getByText('Nov 2 – Nov 8, 2026',{exact:true})).toBeVisible();
  await expect(page.getByText('No completed step entries in this week.')).toBeVisible();
  await expect(page.locator('td[data-rating]')).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/week=2026-11-09/);
  await expect(page.getByRole('heading',{name:'Sunday, November 15'})).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/week=2026-11-02/);
  await page.getByRole('button',{name:'First check-in'}).click();
  await expect(page.getByRole('heading',{name:'Sunday, November 15'})).toBeVisible();
});

test('appearance persists and system preference applies before page code',async({page})=>{
  await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});
  await visit(page);
  const shell = page.locator('.app-shell');
  await expect(shell).toHaveCSS('background-color','rgb(18, 37, 35)');
  await expect(page.locator('.lantern-body i').first()).toHaveCSS('animation-name','none');
  await navigateTo(page,'Settings');
  await page.getByLabel('Appearance').selectOption('light');
  await expect(shell).toHaveCSS('background-color','rgb(247, 243, 233)');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await navigateTo(page,'Settings');
  await page.getByLabel('Appearance').selectOption('dark');
  await page.emulateMedia({colorScheme:'light',reducedMotion:'reduce'});
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await expect(shell).toHaveCSS('background-color','rgb(18, 37, 35)');
  await expect(page.locator('.brand img')).not.toHaveCSS('filter','none');
});

test('failed local model stays retryable and guided chat remains available', async ({page})=>{
  await page.route('https://huggingface.co/**',route=>route.abort());
  await visit(page);
  await page.getByRole('button',{name:'Ask Lantern',exact:true}).press('Enter');
  await page.getByRole('button',{name:'Enable local chat'}).click();
  await expect(page.getByRole('button',{name:'Retry local chat'})).toBeVisible();
  await page.getByLabel('Message Lantern').fill('How can I wind down?');
  await page.getByRole('button',{name:'Send',exact:true}).click();
  await expect(page.getByRole('log')).toContainText('reading one page');
  await page.reload();
  await page.getByRole('button',{name:'Ask Lantern',exact:true}).click();
  await expect(page.getByText(/Local chat ready/)).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Enable local chat'})).toBeVisible();
  await expect(page.getByRole('log')).toContainText('reading one page');
});

test('meal Field Note opens the manual meal logger',async({page})=>{
  await visit(page);
  await navigateTo(page,'Resources');
  await page.getByRole('button',{name:'Meals & energy',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Plan one easy meal'})).toBeVisible();
  await page.getByRole('button',{name:'Open Health → Meals'}).click();
  await expect(page.getByLabel('Dish name')).toBeVisible();
});

test('partial-week comparison ignores the prior weekend and includes it for past weeks',async({page})=>{
  await page.clock.setFixedTime(new Date('2026-11-11T18:00:00Z'));
  await page.addInitScript(()=>{
    if (localStorage.getItem('ignite-veritas-v1')) return;
    const makeRow = (day:number,value:number)=>({date:'2026-11-'+String(day).padStart(2,'0'),version:'ignite-pillars-v1',zone:'UTC',updated:'2026-11-11T18:00:00Z',ratings:[value,value,value,value]});
    localStorage.setItem('ignite-veritas-v1',JSON.stringify({settings:{zone:'UTC',setup:true},
      checks:[makeRow(2,2),makeRow(3,2),makeRow(4,2),makeRow(7,5),makeRow(8,5),makeRow(9,3),makeRow(10,3),makeRow(11,3)]}));
  });
  await visit(page);
  await page.getByRole('button',{name:'View well-being progress'}).click();
  await expect(page.getByText('Previous week · Nov 2 – Nov 4',{exact:true}).locator('..')).toContainText('2.0 / 5');
  await expect(page.getByText('Selected week · Nov 9 – Nov 11',{exact:true}).locator('..')).toContainText('3.0 / 5');
  await expect(page.getByRole('button',{name:'Thursday, November 12'})).toBeDisabled();
  await page.getByRole('button',{name:'Previous week'}).click();
  await expect(page.getByText('Selected week · Nov 2 – Nov 8',{exact:true}).locator('..')).toContainText('3.2 / 5');
});
