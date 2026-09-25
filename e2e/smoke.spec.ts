import { expect, test } from '@playwright/test'
import { createFighter } from './wizard.ts'

test('app loads, lists characters, creates a level 1 Fighter and opens its sheet', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('No characters saved yet.')).toBeVisible()
  await page.getByRole('button', { name: 'New character' }).click()

  await createFighter(page, { name: 'Smoke Test', level: 1, species: 'Dwarf|XPHB' })
  await expect(page.getByText('Smoke Test').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Proficiencies' })).toBeVisible()

  await page.goto('/')
  await expect(page.getByText('Smoke Test')).toBeVisible()
  await expect(page.getByText('Fighter 1')).toBeVisible()
})
