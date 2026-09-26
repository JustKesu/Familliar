import { expect, test, type Locator, type Page } from '@playwright/test'
import { createFighter, select } from './wizard.ts'

/* D194: RHW (Ravenloft: The Horrors Within). Casters are saved characters seeded into storage like classFreeCasts.spec.ts. */
const STORAGE_KEY = 'familliar:characters'

async function subclassRadios(page: Page, classValue: string): Promise<(name: string) => Locator> {
  await page.goto('/#/new')
  await select(page, 'Class').selectOption(classValue)
  await select(page, 'Level').selectOption('3')
  return (name) => page.getByRole('radio', { name, exact: true })
}

test('D194 a: Sorcerer 3 offers Shadow Sorcery and not Shadow Magic', async ({ page }) => {
  const radio = await subclassRadios(page, 'Sorcerer|XPHB')
  await expect(radio('Shadow Sorcery')).toHaveCount(1)
  await expect(radio('Shadow Magic')).toHaveCount(0)
})

test('D194 b: Cleric 3 offers one Grave Domain, Rogue 3 one Phantom, Wizard 3 no Bladesinging', async ({ page }) => {
  let radio = await subclassRadios(page, 'Cleric|XPHB')
  await expect(radio('Grave Domain')).toHaveCount(1)
  radio = await subclassRadios(page, 'Rogue|XPHB')
  await expect(radio('Phantom')).toHaveCount(1)
  radio = await subclassRadios(page, 'Wizard|XPHB')
  await expect(page.getByRole('radio', { name: 'Evoker', exact: true })).toHaveCount(1)
  await expect(radio('Bladesinging')).toHaveCount(0)
})

test('D194 f: Artificer 3 offers Reanimator', async ({ page }) => {
  const radio = await subclassRadios(page, 'Artificer|EFA')
  await expect(radio('Reanimator')).toHaveCount(1)
})

function shadowSorcerer(id: string, level: number, metamagic = true) {
  return {
    schemaVersion: 48,
    id,
    name: id,
    classes: [{ className: 'Sorcerer', classSource: 'XPHB', subclass: 'Shadow Sorcery', level }],
    abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 10, charisma: 16 } },
    spellChoices: [],
    optionalFeatureChoices: metamagic ? [{ featureType: 'MM', choices: [{ name: 'Quickened Spell', level: 2 }, { name: 'Twinned Spell', level: 2 }] }] : [],
  }
}

async function openSpells(page: Page, saved: { id: string }): Promise<Locator> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([saved]) },
  )
  await page.goto(`/#/character/${saved.id}`)
  await page.getByRole('tab', { name: 'Spells' }).click()
  return page.getByRole('tabpanel', { name: 'Spells' })
}

test('D194 c: Shadow Sorcerer 3 — Bane, Darkness, Inflict Wounds, Pass without Trace are always prepared', async ({ page }) => {
  const panel = await openSpells(page, shadowSorcerer('d194-shadow-3', 3))
  for (const spell of ['Bane', 'Darkness', 'Inflict Wounds', 'Pass without Trace']) {
    const row = panel.locator('.sheet__spell-row', { has: page.locator('.sheet__spell-name', { hasText: new RegExp(`^${spell}$`) }) }).first()
    await row.getByRole('button', { name: spell, exact: true }).click()
    await expect(row.locator('.sheet__spell-provenance')).toContainText('always prepared (Shadow Sorcery)')
  }
})

test('D194 d: Shadow Sorcerer 6 — USE Summon Beast (Beasts of Ill Omen) spends 3 Sorcery Points', async ({ page }) => {
  const panel = await openSpells(page, shadowSorcerer('d194-shadow-6', 6))
  const use = panel.locator('.sheet__spell-row--use', { has: page.locator('.sheet__spell-name', { hasText: /^Summon Beast$/ }) })
  await expect(use.locator('.sheet__spell-notes')).toContainText('Sorcery Point')
  await expect(use.locator('.sheet__spell-notes')).toContainText('6 / 6')
  await use.getByRole('button', { name: 'Use Summon Beast', exact: true }).click()
  await expect(use.locator('.sheet__spell-notes')).toContainText('3 / 6')
})

test('D196: Shadow Sorcerer 6 with no Metamagic — Sorcery Points 6 / 6 from Font of Magic; USE Summon Beast spends 3 twice, then disables', async ({ page }) => {
  const panel = await openSpells(page, shadowSorcerer('d196-shadow-6', 6, false))
  const use = panel.locator('.sheet__spell-row--use', { has: page.locator('.sheet__spell-name', { hasText: /^Summon Beast$/ }) })
  const button = use.getByRole('button', { name: 'Use Summon Beast', exact: true })
  await expect(use.locator('.sheet__spell-notes')).toContainText('Sorcery Point 6 / 6')
  await button.click()
  await expect(use.locator('.sheet__spell-notes')).toContainText('Sorcery Point 3 / 6')
  await button.click()
  await expect(use.locator('.sheet__spell-notes')).toContainText('Sorcery Point 0 / 6')
  await expect(button).toBeDisabled()
})

test('D194 e:a Dark Gift feat is selectable at a feat choice, labelled "Dark Gift" with its campaign as a note', async ({ page }) => {
  await createFighter(page, {
    name: 'D194 Dark Gift',
    level: 4,
    species: 'Dwarf|XPHB',
    feat: 'Echoing Soul — Dark Gift',
    onFeatStep: async (step) => {
      const item = step.getByRole('group', { name: 'Level 4' }).locator('li', { has: step.getByRole('radio', { name: 'Echoing Soul — Dark Gift', exact: true }) })
      await expect(item.getByRole('radio')).toBeChecked()
      await expect(item).toContainText('Ravenloft campaign')
    },
  })
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  await expect(page.getByRole('tabpanel', { name: 'Features & Traits' }).getByText('Echoing Soul').first()).toBeVisible()
})
