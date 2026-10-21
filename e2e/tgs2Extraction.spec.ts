import { expect, test, type Page } from '@playwright/test'
import { chooseButton, createFighter, expectStep, next, select } from './wizard.ts'

/* TGS2-1 (D365): homebrew The Griffon's Saddlebag, Book 2 — 7 subclasses and 2 species. Seeds at schema 61. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const ACOLYTE = { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" }

function seeded(id: string, className: string, subclass: string | null, level: number, extra: Record<string, unknown>) {
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
}

test('TGS2-1 a / TGS2-2 a: the wizard species step lists Etherean and Geleton without 2014 blocks',async ({ page }) => {
  await page.goto('/#/new')
  await page.getByLabel('Character name').fill('TGS2 species')
  await select(page, 'Class').selectOption('Fighter|XPHB')
  await select(page, 'Level').selectOption('1')
  await page.getByRole('checkbox', { name: 'Athletics', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Perception', exact: true }).check()
  for (const weapon of ['Longsword', 'Greatsword', 'Handaxe']) await chooseButton(page, weapon).first().click()
  await chooseButton(page, 'Defense').click()
  await next(page)
  await expectStep(page, 'Species')
  for (const name of ['Etherean', 'Geleton']) {
    await expect(select(page, 'Species').locator(`option[value="${name}|GriffonsSaddlebag2"]`)).toHaveCount(1)
  }

  // TGS2-2 (D366): the 2014 rule blocks are gone from both species cards.
  const card = page.locator('.species-card')
  for (const [name, trait] of [['Etherean', 'Veil Shift'], ['Geleton', 'Wakeful']]) {
    await select(page, 'Species').selectOption(`${name}|GriffonsSaddlebag2`)
    await expect(card.getByRole('heading', { name: trait, exact: true })).toBeVisible()
    for (const removed of ['Age', 'Alignment', 'Ability Score Increase']) {
      await expect(card.getByRole('heading', { name: removed, exact: true })).toHaveCount(0)
    }
    await expect(card).not.toContainText('Ability Score Increase')
  }
})

test('TGS2-2 b: Geleton offers Small and Medium; Small is saved and shown in the sheet header', async ({ page }) => {
  await createFighter(page, {
    name: 'Geleton small',
    level: 1,
    species: 'Geleton|GriffonsSaddlebag2',
    onSpeciesStep: async (p) => {
      await expect(p.getByRole('radio', { name: 'Medium', exact: true })).toHaveCount(1)
      await p.getByRole('radio', { name: 'Small', exact: true }).check()
    },
  })
  const identity = (await page.locator('.sheet__identity').innerText()).replace(/\s+/g, ' ')
  expect(identity).toContain('Geleton · Small')
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0].speciesSize, STORAGE_KEY)).toBe('S')
})

test('TGS2-2 c: Etherean has no size choice and the sheet shows Medium', async ({ page }) => {
  await createFighter(page, {
    name: 'Etherean medium',
    level: 1,
    species: 'Etherean|GriffonsSaddlebag2',
    onSpeciesStep: async (p) => {
      await expect(p.getByRole('radio', { name: 'Small', exact: true })).toHaveCount(0)
      await expect(p.getByRole('radio', { name: 'Medium', exact: true })).toHaveCount(0)
    },
  })
  const identity = (await page.locator('.sheet__identity').innerText()).replace(/\s+/g, ' ')
  expect(identity).toContain('Etherean · Medium')
})

test('TGS2-1 b: Barbarian 3 Path of the Infernal shows its level 3 features', async ({ page }) => {
  await openSheet(
    page,
    seeded('tgs2-b', 'Barbarian', 'Path of the Infernal', 3, {
      classSkills: ['athletics', 'intimidation'],
      masteries: [{ name: 'Greataxe' }, { name: 'Handaxe' }],
    }),
  )
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  const barbarian = page.getByRole('tabpanel', { name: 'Features & Traits' }).getByRole('region', { name: 'Barbarian Features', exact: true })
  for (const name of ['Hellborn', 'Hellfire Claw']) {
    await expect(barbarian.locator('.sheet__group-row-name').filter({ hasText: new RegExp(`^${name}$`) })).toHaveCount(1)
  }
  await expect(barbarian).not.toContainText('Infernal Warrior')
})

test('TGS2-1 c: levelling a Fighter 2 to 3 offers Steel Hawk', async ({ page }) => {
  await openSheet(
    page,
    seeded('tgs2-c', 'Fighter', null, 2, {
      classSkills: ['athletics', 'perception'],
      masteries: ['Longsword', 'Greatsword', 'Handaxe'].map((name) => ({ name })),
      fightingStyles: [{ className: 'Fighter', classSource: XPHB, name: 'Defense', source: XPHB }],
    }),
  )
  await page.locator('.sheet__level-up').click()
  await page.getByRole('dialog', { name: 'Level up which class?' }).getByRole('button', { name: 'Fighter 2 → 3', exact: true }).click()
  await expect(page).toHaveURL(/\/level-up/)
  await expect(chooseButton(page, 'Steel Hawk')).toHaveCount(1)
})
