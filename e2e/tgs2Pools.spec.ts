import { expect, test, type Locator, type Page } from '@playwright/test'
import { chooseButton, expectStep, next, select } from './wizard.ts'

/* TGS2-3 (D367): usage trackers for the TGS2 homebrew subclass features, and the TGS2 source label. Seeds at schema 61. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const ACOLYTE = { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" }

function seeded(id: string, className: string, subclass: string, level: number, extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 61,
    id,
    name: id,
    classes: [{ className, classSource: XPHB, subclass, level }],
    levelOrder: Array.from({ length: level }, () => ({ className, classSource: XPHB })),
    createdAtLevel: level,
    abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 8, wisdom: 12, charisma: 10 } },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    background: ACOLYTE,
    hitPointLevels: Array.from({ length: level - 1 }, (_, index) => ({ level: index + 2, kind: 'average', dieResult: 6 })),
    ...extra,
  }
}

async function openSheet(page: Page, character: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
  await page.getByRole('tab', { name: 'Actions' }).click()
}

const counter = (page: Page, name: string): Locator => page.getByRole('tabpanel', { name: 'Actions' }).getByRole('group', { name: `${name} uses`, exact: true }).first()
const boxes = (page: Page, name: string): Locator => counter(page, name).getByRole('button')
const used = (page: Page, name: string): Locator => counter(page, name).locator('.sheet__use-box--used')

async function spend(page: Page, name: string): Promise<void> {
  await counter(page, name).getByRole('button', { name: `Use ${name}` }).first().click()
  await expect(used(page, name)).toHaveCount(1)
}

async function shortRest(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Short Rest', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Short Rest' })
  await drawer.getByRole('button', { name: 'Finish Short Rest' }).click()
  await expect(drawer).toHaveCount(0)
}

async function longRest(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Long Rest', exact: true }).click()
}

for (const [level, count] of [[3, 3], [7, 4]] as const) {
  test(`TGS2-3 a: Fighter ${level} Steel Hawk shows ${count} Launch boxes`, async ({ page }) => {
    await openSheet(page, seeded(`tgs2-a${level}`, 'Fighter', 'Steel Hawk', level))
    await expect(boxes(page, 'Launch')).toHaveCount(count)
  })
}

test('TGS2-3 b: a spent Launch use comes back on a Short Rest', async ({ page }) => {
  await openSheet(page, seeded('tgs2-b', 'Fighter', 'Steel Hawk', 3))
  await spend(page, 'Launch')
  await shortRest(page)
  await expect(used(page, 'Launch')).toHaveCount(0)
})

for (const [id, className, subclass, level, feature] of [
  ['c', 'Rogue', 'Grim Surgeon', 17, 'Bloodbound'],
  ['f', 'Ranger', 'Rocborne', 15, 'Hurricane'],
] as const) {
  test(`TGS2-3 ${id}: ${className} ${level} ${subclass} shows one ${feature} box restored by a Short Rest`, async ({ page }) => {
    await openSheet(page, seeded(`tgs2-${id}`, className, subclass, level))
    await expect(boxes(page, feature)).toHaveCount(1)
    await spend(page, feature)
    await shortRest(page)
    await expect(used(page, feature)).toHaveCount(0)
  })
}

for (const [id, className, subclass, level, feature] of [
  ['d', 'Monk', 'Way of the Aether', 17, 'Sight Beyond Sight'],
  ['g', 'Paladin', 'Oath of the Spelldrinker', 20, 'Arcane Conduit'],
] as const) {
  test(`TGS2-3 ${id}: ${className} ${level} ${subclass} shows one ${feature} box only a Long Rest restores`, async ({ page }) => {
    await openSheet(page, seeded(`tgs2-${id}`, className, subclass, level))
    await expect(boxes(page, feature)).toHaveCount(1)
    await spend(page, feature)
    await shortRest(page)
    await expect(used(page, feature)).toHaveCount(1)
    await longRest(page)
    await expect(used(page, feature)).toHaveCount(0)
  })
}

test('TGS2-3 e: the species picker labels Geleton "Geleton (TGS2)"', async ({ page }) => {
  await page.goto('/#/new')
  await page.getByLabel('Character name').fill('TGS2 label')
  await select(page, 'Class').selectOption('Fighter|XPHB')
  await select(page, 'Level').selectOption('1')
  await page.getByRole('checkbox', { name: 'Athletics', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Perception', exact: true }).check()
  for (const weapon of ['Longsword', 'Greatsword', 'Handaxe']) await chooseButton(page, weapon).first().click()
  await chooseButton(page, 'Defense').click()
  await next(page)
  await expectStep(page, 'Species')
  await expect(select(page, 'Species').locator('option[value="Geleton|GriffonsSaddlebag2"]')).toHaveText('Geleton (TGS2)')
})
