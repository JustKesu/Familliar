import { expect, test, type Page } from '@playwright/test'
import { chooseButton, createFighter, expectStep, next, select, stepBar, wizardNav } from './wizard.ts'

const FIGHTER = { name: 'Edda', level: 1, species: 'Dwarf|XPHB' }

async function fillFighterClassStep(page: Page): Promise<void> {
  await page.getByLabel('Character name').fill('Brann')
  await select(page, 'Class').selectOption('Fighter|XPHB')
  await page.getByRole('checkbox', { name: 'Athletics', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Perception', exact: true }).check()
  for (const weapon of ['Longsword', 'Greatsword', 'Handaxe']) {
    await chooseButton(page, weapon).first().click()
  }
  await chooseButton(page, 'Defense').first().click()
}

const stepButton = (page: Page, name: string) => stepBar(page).getByRole('button', { name, exact: true })

test('W9 a: the step bar reaches back freely and forward only past complete steps', async ({ page }) => {
  await page.goto('/#/new')
  await expectStep(page, 'Class and level')
  await expect(stepButton(page, '2. Species')).toBeDisabled()
  await expect(stepButton(page, '3. Background')).toBeDisabled()

  await fillFighterClassStep(page)
  await next(page)
  await expectStep(page, 'Species')

  await stepButton(page, '1. Class and level').click()
  await expectStep(page, 'Class and level')
  await expect(page.getByLabel('Character name')).toHaveValue('Brann')
  await expect(select(page, 'Class')).toHaveValue('Fighter|XPHB')

  await stepButton(page, '2. Species').click()
  await expectStep(page, 'Species')
  await expect(stepButton(page, '3. Background')).toBeDisabled()
})

test('W23 c+d: Cancel leaves a fresh wizard at once, and asks once something was typed', async ({ page }) => {
  await test.step('c: nothing filled — no dialog', async () => {
    await page.goto('/#/new')
    await expectStep(page, 'Class and level')
    await wizardNav(page).getByRole('button', { name: 'Cancel' }).click()
    await expect(page).toHaveURL(/#\/$/)
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
  })

  await test.step('d: Keep editing / Esc keep the name, Discard leaves', async () => {
    await page.goto('/#/new')
    await page.getByLabel('Character name').fill('Brann')
    const cancel = wizardNav(page).getByRole('button', { name: 'Cancel' })
    const dialog = page.getByRole('alertdialog', { name: 'Cancel character creation?' })

    await cancel.click()
    await expect(dialog).toContainText('Your choices will be lost.')
    await expect(dialog.getByRole('button', { name: 'Keep editing' })).toBeFocused()
    await dialog.getByRole('button', { name: 'Keep editing' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(cancel).toBeFocused()
    await expect(page.getByLabel('Character name')).toHaveValue('Brann')

    await cancel.click()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(page.getByLabel('Character name')).toHaveValue('Brann')

    await cancel.click()
    await dialog.getByRole('button', { name: 'Discard' }).click()
    await expect(page).toHaveURL(/#\/$/)
  })
})

test('W9 b + W23 e: Edit Character reaches every step; a changed name asks before it is discarded', async ({ page }) => {
  await createFighter(page, FIGHTER)
  await page.getByRole('button', { name: 'Edit character' }).click()
  await expectStep(page, 'Class and level')

  await test.step('b: every step is reachable, Review and back', async () => {
    const steps = stepBar(page).getByRole('button')
    for (const button of await steps.all()) await expect(button).toBeEnabled()
    await steps.last().click()
    await expectStep(page, 'Review and save')
    await expect(wizardNav(page).getByRole('button', { name: 'Save changes' })).toBeEnabled()
    await stepButton(page, '1. Class and level').click()
    await expectStep(page, 'Class and level')
  })

  await test.step('e: Discard keeps the stored name', async () => {
    await page.getByLabel('Character name').fill('Renamed')
    await wizardNav(page).getByRole('button', { name: 'Cancel' }).click()
    const dialog = page.getByRole('alertdialog', { name: 'Discard your changes?' })
    await expect(dialog).toContainText('Changes you made will be lost.')
    await dialog.getByRole('button', { name: 'Discard' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Edda' })).toBeVisible()
  })
})

test('W23 f + W28 g: level-up Cancel asks and changes nothing; Remove level asks with the dropped list', async ({ page }) => {
  await createFighter(page, FIGHTER)

  await test.step('f: Cancel level up → Discard keeps level 1', async () => {
    await page.getByRole('button', { name: 'Level up to 2' }).click()
    await expectStep(page, 'Hit points')
    await page.getByRole('radio', { name: /^Average/ }).check()
    await wizardNav(page).getByRole('button', { name: 'Cancel' }).click()
    const dialog = page.getByRole('alertdialog', { name: 'Cancel level up?' })
    await expect(dialog).toContainText('Choices for this level will be lost.')
    await dialog.getByRole('button', { name: 'Discard' }).click()
    await expect(page.getByRole('button', { name: 'Level up to 2' })).toBeVisible()
  })

  await test.step('level up for real', async () => {
    await page.getByRole('button', { name: 'Level up to 2' }).click()
    await page.getByRole('radio', { name: /^Average/ }).check()
    await next(page)
    await wizardNav(page).getByRole('button', { name: 'Save level 2' }).click()
    await expect(page.getByRole('button', { name: 'Remove level 2' })).toBeVisible()
  })

  await test.step('g: Keep level, then Remove level', async () => {
    const dialog = page.getByRole('alertdialog', { name: 'Remove level 2?' })
    await page.getByRole('button', { name: 'Remove level 2' }).click()
    await expect(dialog).toContainText('Choices made at this level will be lost.')
    await expect(dialog.getByRole('listitem').first()).toBeVisible()
    await dialog.getByRole('button', { name: 'Keep level' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Level up to 3' })).toBeVisible()

    await page.getByRole('button', { name: 'Remove level 2' }).click()
    await dialog.getByRole('button', { name: 'Remove level', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Level up to 2' })).toBeVisible()
  })
})
