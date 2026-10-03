import { expect, test, type Locator, type Page } from '@playwright/test'
import { chooseButton, createFighter, expectStep, next, nextButton, select, speciesCantripSelect, wizardNav, type FighterOptions } from './wizard.ts'

/* S2: a species cantrip chosen from a class spell list (High Elf, Khoravar, Kobold; Draconic Sorcery). */
const STORAGE_KEY = 'familliar:characters'

const option = (page: Page, value: string): Locator => speciesCantripSelect(page).locator(`option[value="${value}|XPHB"]`)
const lineage = (page: Page, name: string): Locator => page.locator('select', { has: page.locator('option', { hasText: name }) })

async function highElfStep(page: Page): Promise<void> {
  await page.getByRole('combobox', { name: 'Elven Lineage', exact: true }).selectOption('High Elf')
  await page.getByRole('checkbox', { name: 'Insight', exact: true }).check()
  await page.getByRole('combobox', { name: 'Spellcasting ability', exact: true }).selectOption('Charisma')
}

const highElf = (name: string, extra: Partial<FighterOptions> = {}): FighterOptions => ({
  name,
  level: 1,
  species: 'Elf|XPHB',
  speciesCantrip: 'Fire Bolt|XPHB',
  onSpeciesStep: highElfStep,
  ...extra,
})

/** The Class step of a level-1 Fighter, then the given species; stays on the Species step. */
async function toSpeciesStep(page: Page, species: string): Promise<void> {
  await page.goto('/#/new')
  await page.getByLabel('Character name').fill('Cantrip Check')
  await select(page, 'Class').selectOption('Fighter|XPHB')
  await page.getByRole('checkbox', { name: 'Athletics', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Perception', exact: true }).check()
  for (const weapon of ['Longsword', 'Greatsword', 'Handaxe']) await chooseButton(page, weapon).first().click()
  await chooseButton(page, 'Defense').click()
  await next(page)
  await expectStep(page, 'Species')
  await select(page, 'Species').selectOption(species)
}

const storedCantrips = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]').map((c: { speciesCantrip?: unknown }) => c.speciesCantrip ?? null), STORAGE_KEY)

const spellsPanel = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Spells' })
const spellRow = (page: Page, name: string): Locator =>
  spellsPanel(page).locator('.sheet__spell-row', { has: page.locator('.sheet__spell-name', { hasText: new RegExp(`^${name}$`) }) })
const actionRow = (page: Page, name: string): Locator =>
  page.getByRole('tabpanel', { name: 'Actions' }).locator('.sheet__action-row', { has: page.getByRole('button', { name: `${name} breakdown`, exact: true }) })

async function editToSpecies(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Edit character' }).click()
  await expectStep(page, 'Class and level')
  await next(page)
  await expectStep(page, 'Species')
}

async function saveEdit(page: Page): Promise<void> {
  const save = wizardNav(page).getByRole('button', { name: 'Save changes' })
  for (let steps = 0; steps < 10 && !(await save.isVisible()); steps++) await next(page)
  await save.click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)
}

test('S2 a: a new High Elf Fighter needs a Wizard cantrip; Fire Bolt reaches the Spells tab with the species ability and the Actions tab', async ({ page }) => {
  await createFighter(
    page,
    highElf('Sylas', {
      speciesCantrip: undefined,
      onSpeciesStep: async (p) => {
        await highElfStep(p)
        await expect(nextButton(p)).toBeDisabled()
        await expect(p.getByText('Choose your species cantrip to continue.')).toBeVisible()
        await expect(option(p, 'Fire Bolt')).toHaveText('Fire Bolt (Wizard)')
        await expect(option(p, 'Sacred Flame')).toHaveCount(0)
        await speciesCantripSelect(p).selectOption('Fire Bolt|XPHB')
        await expect(nextButton(p)).toBeEnabled()
      },
    }),
  )
  expect(await storedCantrips(page)).toEqual([{ name: 'Fire Bolt', source: 'XPHB' }])

  await page.getByRole('tab', { name: 'Spells' }).click()
  const bolt = spellRow(page, 'Fire Bolt')
  await expect(bolt).toHaveCount(1)
  await bolt.locator('.sheet__group-row-toggle').click()
  await expect(bolt).toContainText('from species (Elf; High Elf Lineage)')
  // Charisma 8 (standard array, no bonus): modifier −1, so the species entry's spell attack is +1 at proficiency bonus 2.
  await expect(spellsPanel(page).getByRole('group', { name: 'Elf; High Elf Lineage spellcasting' })).toContainText('+1')

  await page.getByRole('tab', { name: 'Actions' }).click()
  await expect(actionRow(page, 'Fire Bolt').getByRole('button', { name: 'Roll Fire Bolt spell attack' })).toBeVisible()
  await expect(actionRow(page, 'Fire Bolt').locator('.sheet__action-to-hit')).toContainText('+1')
})

test('S2 b: Khoravar offers one merged Cleric, Druid and Wizard list, each cantrip labelled with its classes', async ({ page }) => {
  await toSpeciesStep(page, 'Khoravar|EFA')
  await expect(option(page, 'Sacred Flame')).toHaveText('Sacred Flame (Cleric)')
  await expect(option(page, 'Shillelagh')).toHaveText('Shillelagh (Druid)')
  await expect(option(page, 'Fire Bolt')).toHaveText('Fire Bolt (Wizard)')
  await expect(option(page, 'Light')).toHaveText('Light (Cleric, Wizard)')
  await expect(nextButton(page)).toBeDisabled()
})

test('S2 c: Kobold with Draconic Sorcery offers Sorcerer cantrips only', async ({ page }) => {
  await toSpeciesStep(page, 'Kobold|MPMM')
  await expect(speciesCantripSelect(page)).toHaveCount(0)
  await lineage(page, 'Draconic Sorcery').selectOption({ label: 'Draconic Sorcery' })
  await expect(option(page, 'Fire Bolt')).toHaveText('Fire Bolt (Sorcerer)')
  await expect(option(page, 'Sacred Flame')).toHaveCount(0)
  await expect(option(page, 'Shillelagh')).toHaveCount(0)
  await lineage(page, 'Draconic Sorcery').selectOption({ label: 'Craftiness' })
  await expect(speciesCantripSelect(page)).toHaveCount(0)
})

const cantrips = ['Fire Bolt', 'Mage Hand', 'Light']
const leveled = ['Magic Missile', 'Shield', 'Sleep', 'Detect Magic']
const HIGH_ELF_WIZARD = {
  schemaVersion: 56,
  id: 's2-wizard',
  name: 'Elven Wizard',
  classes: [{ className: 'Wizard', classSource: 'XPHB', subclass: null, level: 1 }],
  createdAtLevel: 1,
  abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 15, wisdom: 12, charisma: 10 } },
  species: { name: 'Elf; High Elf Lineage', source: 'XPHB' },
  speciesSkills: ['perception'],
  speciesSpellcastingAbility: 'intelligence',
  speciesCantrip: { name: 'Prestidigitation', source: 'XPHB' },
  background: { name: 'Acolyte', source: 'XPHB', skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
  abilityBonus: { intelligence: 2, wisdom: 1 },
  classSkills: ['arcana', 'history'],
  languages: [
    { name: 'Common', source: 'XPHB', grantedBy: 'automatic' },
    { name: 'Dwarvish', source: 'XPHB', grantedBy: 'creation' },
    { name: 'Elvish', source: 'XPHB', grantedBy: 'creation' },
  ],
  spellChoices: [{ className: 'Wizard', classSource: 'XPHB', spells: [...cantrips, ...leveled].map((name) => ({ name, source: 'XPHB' })) }],
}

test('S2 d: a Wizard High Elf cannot take a class cantrip as the species cantrip, and the Spells step does not offer the species cantrip again', async ({ page }) => {
  await page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
    },
    { key: STORAGE_KEY, value: JSON.stringify([HIGH_ELF_WIZARD]) },
  )
  await page.goto(`/#/character/${HIGH_ELF_WIZARD.id}`)
  await editToSpecies(page)
  await expect(speciesCantripSelect(page)).toHaveValue('Prestidigitation|XPHB')
  await expect(option(page, 'Fire Bolt')).toHaveJSProperty('disabled', true)
  await expect(option(page, 'Fire Bolt')).toHaveText('Fire Bolt (Wizard) (already have it from the Spells step)')
  await expect(nextButton(page)).toBeEnabled()

  for (let steps = 0; steps < 6 && !(await page.locator('[aria-current="step"]').textContent())?.includes('Spells'); steps++) await next(page)
  await expectStep(page, 'Spells')
  const offered = page
    .getByRole('region', { name: 'Add Spells' })
    .locator('.manage-spells__row', { has: page.locator('.manage-spells__name', { hasText: /^Prestidigitation$/ }) })
  await expect(offered).toContainText('(already have it from your species cantrip)')
  await expect(offered.locator('.manage-spells__button')).toBeDisabled()
})

test('S2 e: changing High Elf to Wood Elf drops the cantrip from the saved character', async ({ page }) => {
  const options = highElf('Turncoat Elf')
  await createFighter(page, {
    ...options,
    speciesCantrip: undefined,
    onSpeciesStep: async (p) => {
      await highElfStep(p)
      await speciesCantripSelect(p).selectOption('Fire Bolt|XPHB')
      await p.getByRole('combobox', { name: 'Elven Lineage', exact: true }).selectOption('Wood Elf')
      await p.getByRole('checkbox', { name: 'Insight', exact: true }).check()
      await p.getByRole('combobox', { name: 'Spellcasting ability', exact: true }).selectOption('Wisdom')
      await expect(speciesCantripSelect(p)).toHaveCount(0)
    },
  })
  expect(await storedCantrips(page)).toEqual([null])
})

test('S2 f: Edit Character keeps the cantrip, and changing it is saved', async ({ page }) => {
  await createFighter(page, highElf('Edit Elf'))
  await editToSpecies(page)
  await expect(speciesCantripSelect(page)).toHaveValue('Fire Bolt|XPHB')
  await speciesCantripSelect(page).selectOption('Ray of Frost|XPHB')
  await saveEdit(page)
  expect(await storedCantrips(page)).toEqual([{ name: 'Ray of Frost', source: 'XPHB' }])
  await page.getByRole('tab', { name: 'Spells' }).click()
  await expect(spellRow(page, 'Ray of Frost')).toHaveCount(1)
  await expect(spellRow(page, 'Fire Bolt')).toHaveCount(0)
})

test('S2 g: a schema-55 High Elf without the cantrip loads, says it is not chosen, and Edit Character blocks Species until it is', async ({ page }) => {
  await createFighter(page, highElf('Old Elf'))
  await page.evaluate((key) => {
    const all = JSON.parse(localStorage.getItem(key) ?? '[]')
    for (const character of all) {
      delete character.speciesCantrip
      character.schemaVersion = 55
    }
    localStorage.setItem(key, JSON.stringify(all))
  }, STORAGE_KEY)
  await page.reload()

  await page.getByRole('tab', { name: 'Spells' }).click()
  await expect(spellsPanel(page)).toContainText('Cantrip not chosen yet — choose it in Edit Character.')

  await editToSpecies(page)
  await expect(nextButton(page)).toBeDisabled()
  await speciesCantripSelect(page).selectOption('Mage Hand|XPHB')
  await expect(nextButton(page)).toBeEnabled()
  await saveEdit(page)
  await page.getByRole('tab', { name: 'Spells' }).click()
  await expect(spellsPanel(page).getByText('Cantrip not chosen yet')).toHaveCount(0)
  await expect(spellRow(page, 'Mage Hand')).toHaveCount(1)
})

test('S2 h: importing a v55 High Elf works; a malformed speciesCantrip is refused', async ({ page }) => {
  const v55 = { schemaVersion: 55, id: 's2-import', name: 'Imported Elf', classes: [], species: { name: 'Elf; High Elf Lineage', source: 'XPHB' } }
  await page.goto('/#/')
  const file = page.locator('input[type="file"]')
  await file.setInputFiles({ name: 'elf.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([v55])) })
  await expect(page.locator('.char-grid')).toContainText('Imported Elf')

  const broken = { ...v55, schemaVersion: 56, id: 's2-broken', name: 'Broken Elf', speciesCantrip: 'Fire Bolt' }
  await file.setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([broken])) })
  await expect(page.locator('.error')).toContainText('speciesCantrip must be an object')
  await expect(page.locator('.char-grid')).not.toContainText('Broken Elf')
})
