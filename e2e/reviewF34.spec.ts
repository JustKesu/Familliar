import { expect, test, type Locator, type Page } from '@playwright/test'

/* F-34: fixes from the F-31 to F-33 review (D362). Seeded as in spellModifierF33.spec.ts. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'

function seeded(id: string, className: string, level: number, extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 61,
    id,
    name: id,
    classes: [{ className, classSource: XPHB, subclass: null, level }],
    levelOrder: Array.from({ length: level }, () => ({ className, classSource: XPHB })),
    createdAtLevel: level,
    abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 16, wisdom: 10, charisma: 12 } },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    spellChoices: [],
    ...extra,
  }
}

async function open(page: Page, subject: { id: string }, url = `/#/character/${subject.id}`): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([subject]) },
  )
  await page.goto(url)
}

test('F-34 a: the Remove button of a manual Magic Initiate (Cleric) is named by its displayed name', async ({ page }) => {
  const feat = {
    origin: 'manual',
    name: 'Magic Initiate; Cleric',
    source: XPHB,
    chosenAbility: 'wisdom',
    magicInitiate: { className: 'Cleric', classSource: XPHB, cantrips: [{ name: 'Guidance', source: XPHB }, { name: 'Sacred Flame', source: XPHB }], spell: { name: 'Bless', source: XPHB } },
  }
  await open(page, seeded('f34-a', 'Fighter', 4, { grantedFeats: [feat] }))
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  await page.getByRole('button', { name: 'Manage Feats', exact: true }).click()
  const panel = page.getByRole('dialog', { name: 'Manage Feats' })
  const remove = panel.getByRole('region', { name: 'My Feats' }).getByRole('button', { name: 'Remove Magic Initiate (Cleric)', exact: true })
  await expect(remove).toHaveCount(1)
})

test('F-34 c: Wizard 1 INT 16 — Green-Flame Blade shows no "0" damage line, the secondary creature line stays', async ({ page }) => {
  await open(page, seeded('f34-c', 'Wizard', 1, { spellChoices: [{ className: 'Wizard', classSource: XPHB, spells: [{ name: 'Green-Flame Blade', source: 'TCE' }] }] }))
  await page.getByRole('tab', { name: 'Spells' }).click()
  const row: Locator = page
    .getByRole('tabpanel', { name: 'Spells' })
    .getByRole('region', { name: 'Cantrips', exact: true })
    .locator('.sheet__spell-row', { has: page.locator('.sheet__spell-name', { hasText: /^Green-Flame Blade$/ }) })
    .locator('.sheet__spell-effect')
  await expect(row).toContainText('3 fire damage to secondary creature')
  await expect(row).not.toContainText('0 fire damage')
})

test('F-35 b: Wizard 5 INT 16 — Green-Flame Blade lists the on-hit damage before the secondary creature line', async ({ page }) => {
  await open(page, seeded('f35-b', 'Wizard', 5, { spellChoices: [{ className: 'Wizard', classSource: XPHB, spells: [{ name: 'Green-Flame Blade', source: 'TCE' }] }] }))
  await page.getByRole('tab', { name: 'Spells' }).click()
  const effect = page
    .getByRole('tabpanel', { name: 'Spells' })
    .getByRole('region', { name: 'Cantrips', exact: true })
    .locator('.sheet__spell-row', { has: page.locator('.sheet__spell-name', { hasText: /^Green-Flame Blade$/ }) })
    .locator('.sheet__spell-effect')
  const text = await effect.innerText()
  expect(text).toContain('1d8 + 3 fire damage to secondary creature')
  expect(text.indexOf('1d8 fire damage')).toBeGreaterThanOrEqual(0)
  expect(text.indexOf('1d8 fire damage')).toBeLessThan(text.indexOf('secondary creature'))
})

test('F-34 d: an Air Genasi shows "Genasi (Air)" in the sheet header and on the start screen; the stored name stays "Air"', async ({ page }) => {
  await open(page, seeded('f34-d', 'Fighter', 1, { species: { name: 'Air', source: 'MPMM' } }))
  await expect(page.locator('.sheet__species')).toContainText('Genasi (Air)')
  const identity = (await page.locator('.sheet__identity').innerText()).replace(/\s+/g, ' ')
  expect(identity).toContain('Genasi (Air) · Medium')
  expect(identity).not.toMatch(/\) ?\(/)
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0].species.name, STORAGE_KEY)).toBe('Air')

  await page.goto('/#/')
  await expect(page.locator('.char-card__sub')).toContainText('Genasi (Air)')
})
