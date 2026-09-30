import { expect, test, type Page } from '@playwright/test'
import { createFighter, fillUpToBackground, finishFromBackground, nextButton } from './wizard.ts'

/* D202: proficiency grants from RHW/FRHoF feats and species that carry them in structured fields. Fighter stands in for the Wizard of the task text: the wizard helper is Fighter-only and the species/feat steps do not depend on the class. */

const HUMAN = { species: 'Human|XPHB' as const }
const humanStep = async (p: Page) => {
  await p.getByRole('checkbox', { name: 'Stealth', exact: true }).check()
  await p.getByRole('radio', { name: 'Medium', exact: true }).check()
}

/** The species step's skill checkboxes; the size radios share the list class. */
function skillOptions(page: Page) {
  return page.locator('.species-skill-picker__list li').filter({ has: page.getByRole('checkbox') })
}

function skillRow(page: Page, skill: string) {
  return page.locator('.sheet__skills li', { hasText: skill })
}

async function openBreakdown(page: Page, skill: string) {
  await page.getByRole('button', { name: `${skill} breakdown` }).click()
}

test('D202 a: Aberrant Anatomy — Perception with expertise from the feat; a later Skill Expert does not offer it', async ({ page }) => {
  await createFighter(page, {
    name: 'Aberrant',
    level: 6,
    ...HUMAN,
    onSpeciesStep: humanStep,
    feat: 'Aberrant Anatomy — Dark Gift',
    laterFeat: {
      level: 6,
      feat: 'Skill Expert',
      onFeatStep: async (p) => {
        const expertise = p.getByLabel('Skill Expert expertise', { exact: true })
        await expect(expertise.getByRole('option', { name: 'Athletics', exact: true })).toHaveCount(1)
        await expect(expertise.getByRole('option', { name: 'Perception', exact: true })).toHaveCount(0)
        // Skill Expert is a half-feat: its +1 ability is required to continue.
        await p.getByRole('group', { name: 'Level 6' }).getByRole('combobox', { name: 'Ability', exact: true }).selectOption('dexterity')
      },
    },
  })
  await expect(skillRow(page, 'Perception')).toContainText('★')
  await openBreakdown(page, 'Perception')
  await expect(page.getByText('feat (Aberrant Anatomy)').first()).toBeVisible()
})

test('D202 b: Boon of Terror at level 19 — Intimidation with expertise', async ({ page }) => {
  await createFighter(page, { name: 'Terror', level: 19, ...HUMAN, onSpeciesStep: humanStep, laterFeat: { level: 19, feat: 'Boon of Terror' } })
  await expect(skillRow(page, 'Intimidation')).toContainText('★')
})

test('D202 c: Echoing Soul asks for 2 skills, 1 language, 1 expertise and all four reach the sheet', async ({ page }) => {
  await createFighter(page, {
    name: 'Echo',
    level: 4,
    ...HUMAN,
    onSpeciesStep: humanStep,
    feat: 'Echoing Soul — Dark Gift',
    onFeatStep: async (p) => {
      await expect(p.getByLabel(/^Echoing Soul skill \d$/)).toHaveCount(2)
      await expect(p.getByLabel(/^Echoing Soul language/)).toHaveCount(1)
      await expect(p.getByLabel(/^Echoing Soul expertise/)).toHaveCount(1)
      await p.getByLabel('Echoing Soul skill 1', { exact: true }).selectOption('acrobatics')
      await p.getByLabel('Echoing Soul skill 2', { exact: true }).selectOption('history')
      await p.getByLabel('Echoing Soul language', { exact: true }).selectOption({ label: 'Giant' })
      await p.getByLabel('Echoing Soul expertise', { exact: true }).selectOption('acrobatics')
    },
  })
  await expect(skillRow(page, 'Acrobatics')).toContainText('★')
  await expect(skillRow(page, 'History')).toContainText('●')
  const card = page.locator('section', { has: page.getByRole('heading', { name: 'Proficiencies' }) })
  await expect(card.getByRole('listitem').filter({ hasText: 'LANGUAGES' })).toContainText('Giant')
})

test('D202 d: Symbiotic Being offers exactly its 10 skills and a language pick', async ({ page }) => {
  let listed = 0
  await createFighter(page, {
    name: 'Symbiote',
    level: 4,
    ...HUMAN,
    onSpeciesStep: humanStep,
    feat: 'Symbiotic Being — Dark Gift',
    onFeatStep: async (p) => {
      const skill = p.getByLabel('Symbiotic Being skill', { exact: true })
      listed = (await skill.getByRole('option').count()) - 1 // minus the "not chosen" placeholder
      await skill.selectOption('arcana')
      await expect(p.getByLabel('Symbiotic Being language', { exact: true })).toHaveCount(1)
    },
  })
  expect(listed).toBe(10)
  await expect(skillRow(page, 'Arcana')).toContainText('●')
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  await expect(page.getByText(/Choices not made yet: .*languages/)).toBeVisible()
})

test('D202 e: Lupin needs one of Perception/Stealth/Survival; the sheet shows it from the species', async ({ page }) => {
  await fillUpToBackground(page, {
    name: 'Lupin',
    level: 1,
    species: 'Lupin|RHW',
    onSpeciesStep: async (p) => {
      await expect(skillOptions(p)).toHaveText([/^Perception/, /^Stealth/, /^Survival/])
      await expect(nextButton(p)).toBeDisabled()
      await p.getByRole('radio', { name: 'Medium', exact: true }).check()
      await expect(nextButton(p)).toBeDisabled()
      await p.getByRole('checkbox', { name: 'Stealth', exact: true }).check()
      await expect(nextButton(p)).toBeEnabled()
    },
  })
  await finishFromBackground(page, { name: 'Lupin', level: 1, species: 'Lupin|RHW' })
  await expect(skillRow(page, 'Stealth')).toContainText('●')
  await openBreakdown(page, 'Stealth')
  await expect(page.getByText('proficiency (species)').first()).toBeVisible()
})

test('D202 f: Reborn needs one skill of any kind; the sheet shows it', async ({ page }) => {
  await fillUpToBackground(page, {
    name: 'Reborn',
    level: 1,
    species: 'Reborn|RHW',
    onSpeciesStep: async (p) => {
      await expect(skillOptions(p)).toHaveCount(18)
      await expect(nextButton(p)).toBeDisabled()
      await p.getByRole('radio', { name: 'Medium', exact: true }).check()
      await expect(nextButton(p)).toBeDisabled()
      await p.getByRole('checkbox', { name: 'Stealth', exact: true }).check()
      await expect(nextButton(p)).toBeEnabled()
    },
  })
  await finishFromBackground(page, { name: 'Reborn', level: 1, species: 'Reborn|RHW' })
  await expect(skillRow(page, 'Stealth')).toContainText('●')
  await openBreakdown(page, 'Stealth')
  await expect(page.getByText('proficiency (species)').first()).toBeVisible()
})
