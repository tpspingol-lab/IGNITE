import { expect, test, visit } from './browser';

test('five custom cups contribute their recorded volume and undo removes just one', async ({ page }) => {
  await visit(page);
  await page.getByRole('button', { name: 'Health', exact: true }).click();
  await page.getByRole('button', { name: 'Water', exact: true }).click();
  await page.getByRole('button', { name: 'Set a goal' }).click();
  await page.getByLabel('Quick-add cup size (mL)').fill('255');
  await page.getByLabel('Daily goal (mL)').fill('2000');
  await page.getByRole('button', { name: 'Save water preferences' }).click();
  const add = page.getByRole('button', { name: 'Add a glass · 255 mL', exact: true });
  for (let n = 0; n < 5; n++) await add.click();
  const total = page.getByRole('region', {name:"Today's water"});
  await expect(total.getByText('1,275 mL', { exact: true })).toBeVisible();
  await expect(page.getByText('725 mL to your 2,000 mL goal')).toBeVisible();
  await expect(page.getByText('64%', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(total.getByText('1,020 mL', { exact: true })).toBeVisible();
});

test('approximate sleep avoids precise minutes and precise replacement survives reload', async ({ page }) => {
  await visit(page);
  await page.getByRole('button', { name: 'Health', exact: true }).click();
  await page.getByRole('button', { name: 'Sleep', exact: true }).click();
  await page.getByRole('button', { name: 'Log 8 h or more' }).click();
  await expect(page.getByText('8 h or more · Approximate', { exact: true })).toBeVisible();
  await expect(page.getByText('1 approximate-only day', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Edit sleep entry', exact: true }).click();
  await page.getByLabel('Sleep duration type').selectOption('precise');
  await page.getByLabel('Hours slept').fill('8');
  await page.getByLabel('Extra minutes').fill('30');
  await page.getByRole('button', { name: 'Save entry changes' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Health', exact: true }).click();
  await page.getByRole('button', { name: 'Sleep', exact: true }).click();
  const history = page.getByRole('region', {name:'Daily history'});
  await expect(history.getByText('8 h 30 min', { exact: true })).toBeVisible();
  await expect(page.getByText('8 h or more · Approximate', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Delete sleep entry', exact: true }).click();
  await page.getByRole('button', { name: 'Undo deletion' }).click();
  await expect(history.getByText('8 h 30 min', { exact: true })).toBeVisible();
});
