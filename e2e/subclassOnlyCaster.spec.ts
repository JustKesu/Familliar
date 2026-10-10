import { expect, test, type Locator, type Page } from '@playwright/test'
import { expectStep, fillUpToBackground, next, nextButton, select, stepBar, takeStartingEquipment, wizardNav, chooseButton } from './wizard.js'

/* D342: a new Fighter who picks Eldritch Knight spells and then switches to Champion keeps none of them (Fighter has no spellcasting of its own). */
const addSpells = (page: Page): Locator => page.getByRole('region', { name: 'Add Spells' })
const counter = (page: Page, label: 'Cantrips' | 'Prepared'): Locator => page.locator('.manage-spells__counter', { hasText: new RegExp(`^${label}:`) })

async function fill(page: Page, label: 'Cantrips' | 'Prepared', button: RegExp): Promise<string[]> {
  const [, , max] = (await counter(page, label).innerText()).match(/(\d+)\/(\d+)/)!.map(Number)
  const names: string[] = []
  for (let i = 0; i < max!; i++) {
    const target = addSpells(page).getByRole('button', { name: button, disabled: false }).first()
    names.push(((await target.getAttribute('aria-label')) ?? '').replace(button, '').trim())
    await target.click()
  }
  await expect(counter(page, label)).toHaveText(`${label}: ${max}/${max}`)
  return names
}

test('F-16b: new Fighter, Eldritch Knight spells picked, back to Class and Champion — nothing is saved from the spell picks', async ({ page }) => {
  await fillUpToBackground(page, { name: 'Knight Switch', level: 3, species: 'Dwarf|XPHB', subclass: 'Eldritch Knight' })
  await next(page)
  await expectStep(page, 'Proficiencies')
  await page.getByRole('checkbox', { name: 'Dwarvish (XPHB)' }).check()
  await page.getByRole('checkbox', { name: 'Elvish (XPHB)' }).check()
  await next(page)
  await expectStep(page, 'Ability scores')
  const scores: [string, string][] = [['Strength', '15'], ['Dexterity', '14'], ['Constitution', '13'], ['Intelligence', '12'], ['Wisdom', '10'], ['Charisma', '8']]
  for (const [ability, score] of scores) await select(page, ability).selectOption({ label: score })
  await next(page)
  await expectStep(page, 'Spells')
  const picked = [...(await fill(page, 'Cantrips', /^Add /)), ...(await fill(page, 'Prepared', /^Prepare /))]
  expect(picked.length).toBeGreaterThan(0)

  await stepBar(page).getByRole('button', { name: /Class and level/ }).click()
  await expect(async () => {
    for (const toggle of await page.locator('.option-list__toggle[aria-expanded="false"]').all()) await toggle.click({ timeout: 1000 })
    await chooseButton(page, 'Champion').click({ timeout: 1000 })
  }).toPass({ timeout: 20_000 })
  const create = wizardNav(page).getByRole('button', { name: 'Create character' })
  for (let walked = 0; walked < 12 && !(await create.isVisible()); walked++) {
    const step = (await page.locator('[aria-current="step"]').innerText()).toLowerCase()
    if (step.includes('hit points')) await page.getByRole('button', { name: /Use the average/ }).click()
    if (step.includes('starting equipment')) await takeStartingEquipment(page)
    await nextButton(page).click()
  }
  await create.click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)
  await expect(page.locator('.sheet__classes')).toHaveText('Fighter 3 (Champion)')

  const saved = JSON.parse((await page.evaluate(() => localStorage.getItem('familliar:characters'))) ?? '[]') as { name: string; spellChoices?: { spells: unknown[] }[] }[]
  const character = saved.find((entry) => entry.name === 'Knight Switch')!
  expect((character.spellChoices ?? []).flatMap((entry) => entry.spells)).toEqual([])

  if ((await page.getByRole('tab', { name: 'Spells', exact: true }).count()) > 0) {
    await page.getByRole('tab', { name: 'Spells', exact: true }).click()
    const panel = page.getByRole('tabpanel', { name: 'Spells' })
    for (const name of picked) await expect(panel.locator('.sheet__spell-name', { hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) })).toHaveCount(0)
  }
})
