import { test, expect, visit, navigateTo } from './browser';

test('runs the emotion model in-browser and accepts a correction', async ({ page }) => {
  await visit(page);
  await page.getByRole('button', { name: 'Start check-in' }).click();
  await page.getByLabel('What’s on your mind?').fill('You take that back right now! [NAME] does not deserve this.');
  await page.getByRole('button', { name: 'Suggest an emotion' }).click();
  await expect(page.getByLabel('Emotion tag')).toHaveValue('anger');
  await page.getByLabel('Emotion tag').selectOption('disappointment');
  await page.getByRole('button', { name: 'Review my step' }).click();
  await expect(page.getByRole('heading', { name: 'Write a short reflection.' })).toBeVisible();
});

test('recovers from an unavailable emotion model without losing the draft', async ({ page }) => {
  await page.route('**/emotion-model.json', route => route.abort());
  await visit(page);
  await page.getByRole('button', { name: 'Start check-in' }).click();
  const journal = page.getByLabel('What’s on your mind?');
  await journal.fill('Fictional check-in about a presentation.');
  await page.getByRole('button', { name: 'Suggest an emotion' }).click();
  await expect(page.getByText('Suggestion unavailable.', { exact: false })).toBeVisible();
  await expect(journal).toHaveValue('Fictional check-in about a presentation.');
  await page.getByLabel('Emotion tag').selectOption('disappointment');
  await page.getByRole('button', { name: 'Review my step' }).click();
  await expect(page.getByRole('heading', { name: 'Write a short reflection.' })).toBeVisible();
});

test('logs health entries, undoes water, and deletes saved history', async ({ page }) => {
  await visit(page);
  await page.getByRole('button', { name: 'Health', exact: true }).click();
  await page.getByRole('button', { name: 'Water', exact: true }).click();
  await page.getByRole('button', { name: 'Add a glass' }).click();
  await page.getByRole('button', { name: 'Add a glass' }).click();
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Health', exact: true }).click();
  await page.getByRole('button', { name: 'Water', exact: true }).click();
  await expect(page.locator('.water strong')).toHaveText('1');
  await page.getByRole('button', { name: 'Movement', exact: true }).click();
  await page.getByLabel('Movement').fill('Easy walk');
  await page.getByRole('button', { name: 'Log activity' }).click();
  await expect(page.getByText('Easy walk · 20 min')).toBeVisible();
  await page.getByRole('button', { name: 'Sleep', exact: true }).click();
  await page.getByRole('button', { name: 'Save sleep' }).click();
  await expect(page.getByRole('region',{name:'Daily history'}).getByText('7 h 0 min',{exact:true})).toBeVisible();
  await page.getByRole('button', { name: 'Meals', exact: true }).click();
  await page.getByLabel('Dish name').fill('pancakes');
  await page.getByLabel('Portion (grams)').fill('50');
  await page.getByRole('button', { name: 'Confirm meal' }).click();
  await expect(page.getByText(/Estimated per confirmed portion: 141 kcal/)).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete my history' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Health', exact: true }).click();
  await page.getByRole('button', { name: 'Water', exact: true }).click();
  await expect(page.locator('.water strong')).toHaveText('0');
});

test('keeps the meal photo and manual form available when the model cannot download', async ({ page }) => {
  await page.route('https://huggingface.co/**', route => route.abort());
  await visit(page);
  await page.getByRole('button', { name: 'Health', exact: true }).click();
  await page.getByRole('button', { name: 'Meals', exact: true }).click();
  await page.getByLabel('Upload a meal photo').setInputFiles({
    name: 'fictional-meal.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==', 'base64'),
  });
  await expect(page.getByAltText('Selected meal')).toBeVisible();
  await page.getByRole('button', { name: 'Identify meal' }).click();
  await expect(page.getByText(/Photo identification is unavailable/)).toBeVisible();
  await expect(page.getByAltText('Selected meal')).toBeVisible();
  await page.getByLabel('Dish name').fill('Homemade mixed dish');
  await page.getByRole('button', { name: 'Confirm meal' }).click();
  await expect(page.getByText('No nutrition estimate for this dish.', { exact: false })).toBeVisible();
  await expect(page.getByText('Homemade mixed dish', {exact:true})).toBeVisible();
});

test('supports keyboard entry and keeps the planner and guide actions reachable', async ({ page }) => {
  await visit(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Today', exact:true })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  const nav = page.getByRole('navigation');
  await nav.getByRole('button', { name: 'Plan' }).focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('Stopping time').fill('00:00');
  await page.getByLabel('Task', { exact: true }).fill('Review presentation notes');
  await page.getByRole('button', { name: 'Add task' }).click();
  await expect(page.getByText(/exceeds your stopping time/)).toBeVisible();
  await page.getByRole('button', { name: 'Shorten' }).click();
  await expect(page.getByText('Review presentation notes · 10 min')).toBeVisible();
  await page.getByRole('button', { name: 'Move' }).click();
  await expect(page.getByRole('heading', { name: 'Tomorrow', exact: true }).locator('..')).toContainText('Review presentation notes');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('heading', { name: 'Tonight', exact: true }).locator('..')).toContainText('Review presentation notes');
  await navigateTo(page,'Resources');
  await page.getByRole('button', { name: 'Confidence' }).click();
  await expect(page.getByRole('heading', { name: 'Practice noticing what went well' })).toBeFocused();
  await page.getByRole('button', { name: 'Back to resources' }).click();
  await expect(page.getByRole('button', { name: 'Confidence' })).toBeFocused();
});
