import { expect, test, type Page } from '@playwright/test';

type Hook = {
  useProjectStore: { getState: () => any };
  useUiStore: { getState: () => any };
};

async function rooms(page: Page): Promise<number> {
  return page.evaluate(() => ((window as any).__vhp as Hook).useProjectStore.getState().project.floors[0].rooms.length);
}

/** Screen position of a plan point given in feet. */
async function screen(page: Page, xFt: number, yFt: number) {
  const v = await page.evaluate(() => ((window as any).__vhp as Hook).useUiStore.getState().view);
  const box = (await page.locator('main').boundingBox())!;
  return { x: box.x + v.x + xFt * 304.8 * v.scale, y: box.y + v.y + yFt * 304.8 * v.scale };
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?e2e');
  const welcome = page.getByRole('dialog', { name: /Welcome/ });
  await welcome.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(welcome).toBeHidden();
});

test('loads the sample house with its checks', async ({ page }) => {
  await expect(page.getByText('Sample — 60×58 north-facing 2BHK').first()).toBeVisible();
  await expect(page.getByText('1,196 sq ft')).toBeVisible();
  await expect(page.getByText(/Common bath \(Ground floor\) has no window/)).toBeVisible();
});

test('draw a room, move it, undo and redo', async ({ page }) => {
  const before = await rooms(page);
  await page.getByRole('button', { name: 'Study' }).click();
  const a = await screen(page, 45, 50);
  const b = await screen(page, 55, 56);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 5 });
  await page.mouse.up();
  expect(await rooms(page)).toBe(before + 1);
  await expect(page.getByRole('textbox', { name: 'Width' })).toHaveValue(`10'-0"`);

  const c = await screen(page, 50, 53);
  const d = await screen(page, 52, 53);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(d.x, d.y, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole('textbox', { name: 'X position' })).toHaveValue(`47'-0"`);

  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  expect(await rooms(page)).toBe(before);
  await page.keyboard.press('Control+y');
  expect(await rooms(page)).toBe(before + 1);
});

test('edit a room size by typing', async ({ page }) => {
  await page.getByRole('row', { name: /Kitchen/ }).click();
  const width = page.getByRole('textbox', { name: 'Width' });
  await width.fill(`14'6"`);
  await width.press('Enter');
  await expect(width).toHaveValue(`14'-6"`);
  await width.fill('nonsense');
  await width.press('Enter');
  await expect(width).toHaveAttribute('aria-invalid', 'true');
});

test('project survives a reload', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Project name' }).fill('My house');
  await page.getByRole('textbox', { name: 'Project name' }).press('Enter');
  await page.waitForTimeout(1200); // autosave debounce
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Project name' })).toHaveValue('My house');
});

test('exports PDF, PNG and project file', async ({ page }) => {
  await page.getByRole('button', { name: 'Export & print' }).click();
  for (const [button, ext] of [
    ['Download PDF', '.pdf'],
    ['Download PNG', '.png'],
    ['Download project file', '.vhp.json'],
  ] as const) {
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: button }).click();
    expect((await download).suggestedFilename()).toContain(ext);
  }
});

test('@phone toolbar fits on a phone screen', async ({ page }) => {
  const header = page.locator('header');
  const box = (await header.boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await expect(page.getByRole('button', { name: 'Export & print' })).toBeInViewport();
});

test('set a 29×41 house on a 60×58 plot and move it by typing a gap', async ({ page }) => {
  await page.getByRole('button', { name: 'Projects & templates' }).click();
  await page.getByRole('button', { name: /Blank plot/ }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', { name: 'Plot settings', exact: true }).click();
  const dlg = page.getByRole('dialog');
  for (const [label, v] of [['Width (east–west)', '60'], ['Depth (north–south)', '58']] as const) {
    await dlg.getByLabel(label).fill(v);
    await dlg.getByLabel(label).press('Enter');
  }
  await dlg.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Add house outline' }).first().click();
  for (const [label, v] of [['House width', '29'], ['House depth', '41']] as const) {
    await page.getByRole('textbox', { name: label }).fill(v);
    await page.getByRole('textbox', { name: label }).press('Enter');
  }
  const west = page.getByRole('textbox', { name: 'West gap' });
  await west.fill('10');
  await west.press('Enter');
  await expect(page.getByRole('textbox', { name: 'East gap' })).toHaveValue(`21'-0"`);
  await page.getByRole('button', { name: 'Centre north–south' }).click();
  await expect(page.getByRole('textbox', { name: 'North gap' })).toHaveValue(`8'-6"`);
  await expect(page.getByRole('textbox', { name: 'South gap' })).toHaveValue(`8'-6"`);
  await expect(page.getByText('2,291 sq ft')).toBeVisible();
});

test('Vaasthu tab: score, Tamil explanations and rule editing', async ({ page }) => {
  await page.getByRole('tab', { name: 'Vaasthu' }).click();
  await expect(page.getByText('/ 100 advisory score')).toBeVisible();
  await page.getByRole('button', { name: 'தமிழ்' }).click();
  await expect(page.getByText('வாஸ்து வழிகாட்டல்')).toBeVisible();
  await page.getByRole('button', { name: 'English' }).click();
  await page.getByRole('button', { name: 'Edit rules' }).click();
  await expect(page.getByRole('dialog', { name: 'Vaasthu rules for this project' })).toBeVisible();
});

test('mark a door as the main entrance', async ({ page }) => {
  await page.evaluate(() => {
    const s = (window as any).__vhp.useProjectStore.getState();
    const door = s.project.floors[0].openings.find((o: any) => o.label === 'D1');
    s.select({ kind: 'opening', id: door.id });
  });
  const box = page.getByRole('checkbox', { name: /Main entrance/ });
  await expect(box).not.toBeChecked();
  await box.check();
  const mains = await page.evaluate(() =>
    (window as any).__vhp.useProjectStore.getState().project.floors[0].openings.filter((o: any) => o.isMain).map((o: any) => o.label),
  );
  expect(mains).toEqual(['D1']);
});

test('paint dialog changes the exterior colour', async ({ page }) => {
  await page.getByRole('button', { name: 'Choose paint, floors & roof' }).click();
  await page.getByRole('button', { name: 'Exterior walls: Sky blue' }).click();
  const c = await page.evaluate(() => (window as any).__vhp.useProjectStore.getState().project.finishes.exteriorWall);
  expect(c).toBe('#cbe0ee');
});

test('3D view loads without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.getByRole('button', { name: '3D view' }).click();
  await expect(page.getByTestId('view-3d').locator('canvas')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Top' }).click();
  await page.getByLabel('Remove roof to look inside').check();
  await page.getByRole('button', { name: '2D plan' }).click();
  await expect(page.locator('main canvas').first()).toBeVisible();
  expect(errors).toEqual([]);
});
