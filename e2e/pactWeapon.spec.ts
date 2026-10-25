import { expect, test, type Locator, type Page } from '@playwright/test'

/* PW-1 (D401). A Warlock 9 seeded at schema 66; the pact weapon is marked through the Manage Inventory panel. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'

function warlock(id: string, invocations: { name: string; source: string }[], inventory: Record<string, unknown>[]) {
  return {
    schemaVersion: 66,
    id,
    name: id,
    classes: [{ className: 'Warlock', classSource: XPHB, subclass: null, level: 9 }],
    abilityScores: { method: 'standardArray', scores: { strength: 16, dexterity: 14, constitution: 13, intelligence: 8, wisdom: 10, charisma: 15 } },
    optionalFeatureChoices: [{ featureType: 'EI', choices: invocations }],
    inventory,
  }
}

const BLADE = [
  { name: 'Pact of the Blade', source: XPHB },
  { name: 'Improved Pact Weapon', source: 'XGE' },
  { name: 'Lifedrinker', source: XPHB },
]
const held = (name: string, extra: Record<string, unknown> = {}) => ({ name, source: XPHB, quantity: 1, equipped: 'held', ...extra })

async function open(page: Page, character: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
}

async function openManage(page: Page): Promise<Locator> {
  await page.getByRole('tab', { name: 'Inventory' }).click()
  await page.getByRole('button', { name: 'Manage Inventory', exact: true }).click()
  return page.getByRole('dialog', { name: 'Manage Inventory' }).getByRole('region', { name: 'My Inventory' })
}

const pactToggle = (panel: Locator, label: string): Locator => panel.getByRole('button', { name: `Pact weapon: ${label}`, exact: true })

async function actionRow(page: Page, label: string): Promise<Locator> {
  await page.getByRole('tab', { name: 'Actions' }).click()
  return page.getByRole('tabpanel', { name: 'Actions' }).locator('.sheet__action-row', { has: page.getByRole('button', { name: `${label} breakdown`, exact: true }) })
}

test('PW-1 a: no Pact weapon toggle without Pact of the Blade', async ({ page }) => {
  await open(page, warlock('pw1-a', [{ name: 'Agonizing Blast', source: XPHB }], [held('Mace')]))
  const panel = await openManage(page)
  await expect(panel.getByRole('button', { name: 'Put down Mace' })).toBeVisible()
  await expect(panel.getByRole('button', { name: /^Pact weapon/ })).toHaveCount(0)
})

test('PW-1 b, c, e, f: one marked weapon gets Improved Pact Weapon and Lifedrinker; the mark moves and survives reload', async ({ page }) => {
  await open(page, warlock('pw1-b', BLADE, [held('Mace'), held('Sickle'), { name: 'Rations', source: XPHB, quantity: 1 }]))
  let panel = await openManage(page)
  await expect(pactToggle(panel, 'Mace')).toHaveAttribute('aria-pressed', 'false')
  await expect(panel.getByRole('button', { name: /^Pact weapon: Rations/ })).toHaveCount(0)

  await pactToggle(panel, 'Mace').click()
  await expect(pactToggle(panel, 'Mace')).toHaveAttribute('aria-pressed', 'true')
  await pactToggle(panel, 'Sickle').click()
  await expect(pactToggle(panel, 'Sickle')).toHaveAttribute('aria-pressed', 'true')
  await expect(pactToggle(panel, 'Mace')).toHaveAttribute('aria-pressed', 'false')
  await page.keyboard.press('Escape')

  // STR +3, PB +4; Improved Pact Weapon +1 on the Sickle only.
  const sickle = await actionRow(page, 'Sickle')
  await expect(sickle.getByRole('button', { name: 'Roll Sickle to hit' })).toHaveText('+8')
  await expect(sickle.locator('.sheet__action-damage')).toHaveText(/1d4 \+ 4\s+Slashing\s*\+ 1d6 Necrotic, Psychic, or Radiant/i)
  const mace = await actionRow(page, 'Mace')
  await expect(mace.getByRole('button', { name: 'Roll Mace to hit' })).toHaveText('+7')
  await expect(mace.locator('.sheet__action-damage')).not.toContainText('Necrotic')

  await page.reload()
  panel = await openManage(page)
  await expect(pactToggle(panel, 'Sickle')).toHaveAttribute('aria-pressed', 'true')
  await expect(pactToggle(panel, 'Mace')).toHaveAttribute('aria-pressed', 'false')
  await page.keyboard.press('Escape')
  await expect((await actionRow(page, 'Sickle')).getByRole('button', { name: 'Roll Sickle to hit' })).toHaveText('+8')
})

test('PW-1 d: a pact weapon with its own magic bonus gets no Improved Pact Weapon +1', async ({ page }) => {
  await open(page, warlock('pw1-d', BLADE, [held('Mace', { magicBonus: 1 })]))
  const panel = await openManage(page)
  await pactToggle(panel, 'Mace +1').click()
  await expect(pactToggle(panel, 'Mace +1')).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  const mace = await actionRow(page, 'Mace +1')
  // STR +3, PB +4, the mace's own +1 — no second +1.
  await expect(mace.getByRole('button', { name: 'Roll Mace +1 to hit' })).toHaveText('+8')
  await expect(mace.locator('.sheet__action-damage')).toContainText('1d6 + 4')
})
