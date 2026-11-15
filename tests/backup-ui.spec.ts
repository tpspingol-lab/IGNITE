import {readFile} from 'node:fs/promises';
import {test,expect,visit} from './browser';

test('previews and confirms a backup restore without duplicating records',async({page})=>{
  await visit(page);
  async function openSettings() {
    const more=page.getByRole('button',{name:'More',exact:true});
    if (await more.isVisible()) await more.click();
    await page.getByRole('button',{name:'Settings',exact:true}).click();
    await page.getByRole('button',{name:'Privacy & data',exact:true}).click();
  }
  async function saveMeal(dish:string) {
    await page.getByRole('button',{name:'Today',exact:true}).click();
    await page.getByRole('button',{name:'Meal Log'}).click();
    await page.getByLabel('Dish name').fill(dish);
    await page.getByRole('button',{name:'Confirm meal'}).click();
  }
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ignite-veritas-v1')!));
  await saveMeal('Fictional meal in backup');
  await openSettings();
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export backup'}).click();
  const backup=await readFile(await (await download).path());
  expect(JSON.parse(backup.toString())).toMatchObject({app:'IGNITE',version:1});

  await saveMeal('Fictional meal added later');
  await openSettings();
  const legal=(await saved()).legal;
  const input=page.getByLabel('Import backup');
  await input.setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"app":"IGNITE","version":99}')});
  await expect(page.getByRole('alert')).toContainText(/version is unsupported/);
  await expect(page.getByRole('button',{name:'Replace saved data'})).toHaveCount(0);

  async function selectBackup() {
    await input.setInputFiles({name:'ignite-backup.json',mimeType:'application/json',buffer:backup});
    await expect(page.getByRole('heading',{name:'Backup preview'})).toBeVisible();
    await expect(page.getByText(/1 health logs/)).toBeVisible();
  }
  await selectBackup();
  expect((await saved()).extras.meals).toHaveLength(2);
  await page.getByRole('button',{name:'Cancel import'}).click();
  expect((await saved()).extras.meals).toHaveLength(2);
  for (let i=0;i<2;i++) {
    await selectBackup();
    await page.getByRole('button',{name:'Replace saved data'}).click();
    await expect(page.getByText('Backup restored on this device.')).toBeVisible();
    expect((await saved()).extras.meals.map((row:{text:string})=>row.text)).toEqual(['Fictional meal in backup']);
  }
  await page.reload();
  expect((await saved()).extras.meals).toHaveLength(1);
  expect((await saved()).legal).toEqual(legal);
});
