import { test, expect, visit } from './browser';

test('first Lantern cue moves the art without moving its keyboard target', async ({page}, info) => {
  await page.emulateMedia({reducedMotion:info.project.name==='narrow'?'reduce':'no-preference'});
  await visit(page);
  const launcher = page.getByRole('button',{name:'Ask Lantern',exact:true});
  const art = launcher.locator('.lantern-art');
  await expect(page.getByText('Click me',{exact:true})).toBeVisible();
  const before = await launcher.boundingBox();
  if (info.project.name !== 'narrow') {
    await expect(art).toHaveCSS('animation-name','lantern-welcome');
    const timeline = await art.evaluate(async element=>{
      const animation = element.getAnimations().find(animation=>animation instanceof CSSAnimation && animation.animationName==='lantern-welcome');
      if (!animation) return [];
      animation.pause();
      const frames: string[] = [];
      for (const at of [0,170,510,900]) {
        animation.currentTime=at;
        frames.push(getComputedStyle(element).transform);
      }
      return frames;
    });
    expect(new Set(timeline).size).toBeGreaterThan(2);
  } else {
    await expect(art).toHaveCSS('animation-name','none');
  }
  expect(await launcher.boundingBox()).toEqual(before);
  await launcher.press('Enter');
  await expect(page.getByLabel('Message Lantern')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(launcher).toBeFocused();
  await page.reload();
  await expect(launcher).toBeVisible();
  await expect(page.getByText('Click me',{exact:true})).toHaveCount(0);
});

test('dismissed Lantern cue stays dismissed and log answers use the permitted summary', async ({page}) => {
  await page.clock.setFixedTime(new Date('2026-11-15T19:00:00Z'));
  await page.addInitScript(()=>{
    if (localStorage.getItem('ignite-veritas-v1')) return;
    const original={title:'Review all the notes.',minutes:10,reason:'Prepare for class.',smaller:{title:'Look at one page.',minutes:1}};
    const smaller={...original.smaller,reason:'The previous step felt too big.'};
    localStorage.setItem('ignite-veritas-v1',JSON.stringify({
      settings:{setup:true,zone:'UTC'}, lantern:{messages:[],dock:'right',introSeen:true},
      stepRetry:{original,smaller,day:'2026-11-15'},
      extras:{water:Array.from({length:5},(_,id)=>({id:String(id),day:'2026-11-15',text:'255 mL',ml:255}))},
    }));
  });
  await visit(page);
  await expect(page.getByText('Want a smaller step?',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Dismiss Lantern cue'}).click();
  await page.reload();
  await expect(page.getByText('Want a smaller step?',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Ask Lantern',exact:true}).press('Enter');
  const composer=page.getByLabel('Message Lantern');
  const send=page.getByRole('button',{name:'Send'});
  await composer.fill('I feel overwhelmed with schoolwork. What can I do right now?');
  await send.click();
  await expect(page.getByRole('log')).toContainText('opening the assignment');
  await composer.fill('How much water did I log today?');
  await send.click();
  await expect(page.getByRole('log')).not.toContainText(/1,?275 mL/);
  await page.getByRole('button',{name:'Allow once'}).click();
  await expect(page.getByRole('log')).toContainText(/1,?275 mL/);
  await composer.fill('How much did I sleep today?');
  await send.click();
  await page.getByRole('button',{name:'Allow once'}).click();
  await expect(page.getByRole('log')).toContainText('No sleep entries recorded today.');
});

test('hiding the mascot leaves a text launcher and usable chat', async ({page}) => {
  await page.addInitScript(()=>{
    if (localStorage.getItem('ignite-veritas-v1')) return;
    localStorage.setItem('ignite-veritas-v1',JSON.stringify({settings:{setup:true,mascotVisible:false}}));
  });
  await visit(page);
  const launcher=page.getByRole('button',{name:'Ask Lantern',exact:true});
  await expect(launcher).toBeVisible();
  await expect(launcher.locator('.lantern-art')).toHaveCount(0);
  await launcher.press('Enter');
  await expect(page.getByLabel('Message Lantern')).toBeFocused();
});
