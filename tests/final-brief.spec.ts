import { test, expect, visit, navigateTo } from './browser';

test('submitted skips count, and check-in and step deletion can be undone',async({page})=>{
  await page.clock.setFixedTime(new Date('2026-11-15T14:00:00Z'));
  await visit(page);
  await page.getByRole('button',{name:'Evening ratings'}).click();
  await page.getByRole('button',{name:'Save ratings'}).click();
  await expect(page.getByText('1 check-in in the last 7 days')).toBeVisible();
  await page.getByRole('button',{name:'Done',exact:true}).click();
  await page.getByRole('button',{name:'Too big',exact:true}).click();
  await page.getByRole('button',{name:'View well-being progress'}).click();
  await expect(page.getByText('Submitted · all pillars skipped')).toBeVisible();
  await expect(page.locator('td[data-rating]')).toHaveCount(0);
  await expect(page.getByText('Done · Too big',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Edit outcome'}).click();
  await page.getByRole('combobox',{name:'Outcome',exact:true}).selectOption('Partly done');
  await page.getByRole('button',{name:'Save outcome'}).click();
  await expect(page.getByText('Partly done · Too big',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Delete entry'}).click();
  await page.getByRole('button',{name:'Undo step deletion'}).click();
  await expect(page.getByText('Partly done · Too big',{exact:true})).toBeVisible();
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Delete check-in'}).click();
  await expect(page.getByText('No pillar ratings for this day.')).toBeVisible();
  await page.getByRole('button',{name:'Undo check-in deletion'}).click();
  await expect(page.getByText('Submitted · all pillars skipped')).toBeVisible();
});

test('scratchpad persists on navigation and saves to the same Today note',async({page})=>{
  await visit(page);
  await navigateTo(page,'Resources');
  await page.getByLabel('Scratchpad').fill('Pack the science notebook.');
  await page.reload();
  await expect(page.getByLabel('Scratchpad')).toHaveValue('Pack the science notebook.');
  await page.getByRole('button',{name:'Save to Today’s note'}).click();
  await expect(page.getByLabel('Scratchpad')).toBeEmpty();
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Today',exact:true}).click();
  await page.getByRole('button',{name:'Open journal draft'}).click();
  await expect(page.getByLabel('What’s on your mind?')).toHaveValue('Pack the science notebook.');
});
