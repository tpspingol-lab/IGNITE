import { test, expect, visit } from './browser';

test('reopening restores the exact step and Too big offers a smaller one', async ({ page, context }) => {
  await page.clock.setFixedTime(new Date('2026-11-15T11:00:00Z'));
  await visit(page);
  await page.getByRole('button', { name: 'Start check-in' }).click();
  await page.getByLabel('What’s on your mind?').fill('I keep replaying my presentation.');
  await page.reload();
  await page.getByRole('button', { name: 'Resume check-in' }).click();
  await expect(page.getByLabel('What’s on your mind?')).toHaveValue('I keep replaying my presentation.');
  await page.getByLabel('Emotion tag').selectOption('disappointment');
  await page.getByRole('button', { name: 'Review my step' }).click();
  await expect(page.getByRole('heading', { name: 'Write a short reflection.' })).toBeVisible();
  await page.getByRole('button', { name: 'Save my step' }).click();
  await page.close();
  const reopened = await context.newPage();
  await reopened.clock.setFixedTime(new Date('2026-11-15T11:00:00Z'));
  await visit(reopened);
  await expect(reopened.getByRole('heading', { name: 'Write a short reflection.' })).toBeVisible();
  await reopened.getByRole('button', { name: 'How did it go?' }).click();
  await reopened.getByLabel('Outcome').selectOption('Skipped');
  await reopened.getByLabel('What got in the way?').selectOption('Too big');
  await reopened.getByRole('button', { name: 'Save outcome' }).click();
  await expect(reopened.getByText('A smaller step will appear tomorrow. You can also try it now.')).toBeVisible();
  await expect(reopened.getByRole('heading', { name: 'Write a short reflection.' })).toBeVisible();
  await reopened.clock.setFixedTime(new Date('2026-11-16T11:00:00Z'));
  await reopened.reload();
  await expect(reopened.getByRole('heading', { name: 'Name one thing you handled well.' })).toBeVisible();
  await expect(reopened.getByText('You said this step felt too big, so this version asks less of you.')).toBeVisible();
  await reopened.getByRole('button',{name:'Keep original step'}).click();
  await expect(reopened.getByRole('heading', { name: 'Write a short reflection.' })).toBeVisible();
});

test('Too big offers a smaller step today and keeps the original feedback',async ({page})=>{
  await page.clock.setFixedTime(new Date('2026-11-15T11:00:00Z'));
  await visit(page);
  await page.getByRole('button',{name:'Too big',exact:true}).click();
  await page.reload();
  await expect(page.getByText('Feedback saved',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Try a smaller step now'}).click();
  await expect(page.getByRole('heading',{name:'Pause for one minute.'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading',{name:'Pause for one minute.'})).toBeVisible();
  await page.getByRole('button',{name:'View well-being progress'}).click();
  await expect(page.getByRole('listitem').filter({hasText:'Take a five-minute break.'})).toContainText('Too big');
});
