import { expect, test, type Locator, type Page } from '@playwright/test'
import { createFighter } from './wizard.ts'

/*
 * D185/D186. Species traits take the class features' R-phrase grouping, plus D186's
 * attack-replacement frame (Breath Weapon → Action). A trait whose text starts at a
 * character level is absent below it; a trait joins Actions only with an R-phrase
 * group or tracked uses (once per rest, or Proficiency Bonus per Long Rest).
 */
function actions(page: Page): Locator {
  return page.getByRole('tabpanel', { name: 'Actions' })
}

function features(page: Page): Locator {
  return page.getByRole('tabpanel', { name: 'Features & Traits' })
}

function group(page: Page, name: string): Locator {
  return actions(page).getByRole('region', { name, exact: true })
}

function row(page: Page, groupName: string, trait: string): Locator {
  return group(page, groupName).locator('.sheet__group-row', { hasText: trait })
}

function speciesTrait(page: Page, trait: string): Locator {
  return features(page)
    .getByRole('region', { name: 'Species Traits', exact: true })
    .locator('.sheet__group-row')
    .filter({ has: page.locator('.sheet__group-row-name', { hasText: new RegExp(`^${trait}$`) }) })
}

async function createDragonborn(page: Page): Promise<void> {
  await createFighter(page, { name: 'Drake', level: 1, species: 'Dragonborn|XPHB',
    onSpeciesStep: async (p) => {
      await p.getByRole('combobox', { name: 'Draconic Ancestry', exact: true }).selectOption('Black')
    },
  })
}

async function createAasimar(page: Page, level: number): Promise<void> {
  await createFighter(page, { name: 'Halo', level, species: 'Aasimar|XPHB',
    onSpeciesStep: async (p) => {
      await p.getByRole('radio', { name: 'Medium', exact: true }).check()
    },
  })
}

test('D186 a: Dragonborn Breath Weapon is an Action row sourced "Dragonborn" with 2 use boxes at level 1; a Long Rest restores a use', async ({ page }) => {
  await createDragonborn(page)
  await page.getByRole('tab', { name: 'Actions' }).click()

  const breath = row(page, 'Action', 'Breath Weapon')
  await expect(breath).toHaveCount(1)
  await expect(breath).toContainText('Dragonborn')
  await expect(breath.locator('.sheet__use-box')).toHaveCount(2)
  const toggle = breath.getByRole('button', { name: 'Breath Weapon', exact: true })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  await expect(breath.locator('.sheet__group-row-text')).toContainText('exhalation')

  const used = breath.locator('.sheet__use-box--used')
  await breath.getByRole('button', { name: 'Use Breath Weapon' }).first().click()
  await expect(used).toHaveCount(1)
  await page.getByRole('button', { name: 'Long Rest', exact: true }).click()
  await expect(used).toHaveCount(0)

  await actions(page).getByRole('button', { name: 'Bonus Action', exact: true }).click()
  await expect(actions(page).getByText('Breath Weapon')).toHaveCount(0)
  await actions(page).getByRole('button', { name: 'Action', exact: true }).click()
  await expect(row(page, 'Action', 'Breath Weapon')).toHaveCount(1)
})

test('D186 b1: Aasimar 1 has no Celestial Revelation in Actions or Features & Traits; Healing Hands is an Action with 1 use box', async ({ page }) => {
  await createAasimar(page, 1)
  await page.getByRole('tab', { name: 'Actions' }).click()
  const healing = row(page, 'Action', 'Healing Hands')
  await expect(healing).toHaveCount(1)
  await expect(healing).toContainText('Aasimar')
  await expect(healing.locator('.sheet__use-box')).toHaveCount(1)
  await expect(actions(page).getByText('Celestial Revelation')).toHaveCount(0)

  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  await expect(speciesTrait(page, 'Healing Hands')).toHaveCount(1)
  await expect(speciesTrait(page, 'Celestial Revelation')).toHaveCount(0)
})

test('D186 b2: Aasimar 3 has Celestial Revelation under Bonus Action with 1 use box', async ({ page }) => {
  await createAasimar(page, 3)
  await page.getByRole('tab', { name: 'Actions' }).click()
  const revelation = row(page, 'Bonus Action', 'Celestial Revelation')
  await expect(revelation).toHaveCount(1)
  await expect(revelation.locator('.sheet__use-box')).toHaveCount(1)
  await expect(row(page, 'Action', 'Healing Hands')).toHaveCount(1)
})

test('D186 c: a High Elf’s Trance is in Features & Traits → Species Traits but not in Actions', async ({ page }) => {
  await createFighter(page, { name: 'Sylas', level: 1, species: 'Elf|XPHB',
    onSpeciesStep: async (p) => {
      await p.getByRole('combobox', { name: 'Elven Lineage', exact: true }).selectOption('High Elf')
      await p.getByRole('checkbox', { name: 'Insight', exact: true }).check()
      await p.getByRole('combobox', { name: 'Spellcasting ability', exact: true }).selectOption('Intelligence')
    },
  })
  await page.getByRole('tab', { name: 'Actions' }).click()
  await expect(actions(page).getByText('Trance')).toHaveCount(0)
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  await expect(speciesTrait(page, 'Trance')).toHaveCount(1)
})

test('D186 d: a Healing Hands use shows in Features & Traits; Finish Short Rest keeps it, Long Rest restores it', async ({ page }) => {
  await createAasimar(page, 1)
  await page.getByRole('tab', { name: 'Actions' }).click()
  const actionUsed = row(page, 'Action', 'Healing Hands').locator('.sheet__use-box--used')
  const featureUsed = speciesTrait(page, 'Healing Hands').locator('.sheet__use-box--used')

  await row(page, 'Action', 'Healing Hands').getByRole('button', { name: 'Use Healing Hands' }).click()
  await expect(actionUsed).toHaveCount(1)
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  await expect(featureUsed).toHaveCount(1)

  await page.getByRole('button', { name: 'Short Rest', exact: true }).click()
  await page.getByRole('dialog', { name: 'Short Rest' }).getByRole('button', { name: 'Finish Short Rest' }).click()
  await expect(page.getByRole('dialog', { name: 'Short Rest' })).toHaveCount(0)
  await expect(featureUsed).toHaveCount(1)

  await page.getByRole('button', { name: 'Long Rest', exact: true }).click()
  await expect(featureUsed).toHaveCount(0)
  await page.getByRole('tab', { name: 'Actions' }).click()
  await expect(actionUsed).toHaveCount(0)
})
