import { expect, test, type Locator, type Page } from '@playwright/test'
import { createFighter } from './wizard.ts'

/*
 * D185. Species traits take the same qualification and R-phrase grouping as class
 * features. Breath Weapon opens "When you take the Attack action…", a trigger the
 * R-phrase frames skip (D182), so it lands in Other, not Action. The species data
 * carries no level, so no trait is level-gated and no use boxes appear (species
 * traits are not in the resource model's input).
 */
function actions(page: Page): Locator {
  return page.getByRole('tabpanel', { name: 'Actions' })
}

function group(page: Page, name: string): Locator {
  return actions(page).getByRole('region', { name, exact: true })
}

function row(page: Page, groupName: string, trait: string): Locator {
  return group(page, groupName).locator('.sheet__group-row', { hasText: trait })
}

test('D185 a/b: Dragonborn Breath Weapon is a collapsed Other row sourced "Dragonborn", and only the Other (and All) filter shows it', async ({ page }) => {
  await createFighter(page, { name: 'Drake', level: 1, species: 'Dragonborn|XPHB',
    onSpeciesStep: async (p) => {
      await p.getByRole('combobox', { name: 'Draconic Ancestry', exact: true }).selectOption('Black')
    },
  })
  await page.getByRole('tab', { name: 'Actions' }).click()

  const breath = row(page, 'Other', 'Breath Weapon')
  await expect(breath).toHaveCount(1)
  await expect(breath).toContainText('Dragonborn')
  const toggle = breath.getByRole('button', { name: 'Breath Weapon', exact: true })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  await expect(breath.locator('.sheet__group-row-text')).toContainText('exhalation')
  await expect(breath.locator('.sheet__use-box')).toHaveCount(0)

  await actions(page).getByRole('button', { name: 'Bonus Action', exact: true }).click()
  await expect(group(page, 'Other')).toHaveCount(0)
  await expect(actions(page).getByText('Breath Weapon')).toHaveCount(0)
  await actions(page).getByRole('button', { name: 'Other', exact: true }).click()
  await expect(row(page, 'Other', 'Breath Weapon')).toHaveCount(1)
})

test('D185 c: Aasimar shows Healing Hands under Action and Celestial Revelation under Bonus Action', async ({ page }) => {
  await createFighter(page, { name: 'Halo', level: 3, species: 'Aasimar|XPHB',
    onSpeciesStep: async (p) => {
      await p.getByRole('radio', { name: 'Medium', exact: true }).check()
    },
  })
  await page.getByRole('tab', { name: 'Actions' }).click()
  await expect(row(page, 'Action', 'Healing Hands')).toHaveCount(1)
  await expect(row(page, 'Bonus Action', 'Celestial Revelation')).toHaveCount(1)
  await expect(row(page, 'Action', 'Healing Hands')).toContainText('Aasimar')
})
