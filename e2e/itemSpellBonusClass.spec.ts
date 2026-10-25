import { expect, test, type Locator, type Page } from '@playwright/test'

/* IB-1 (D403). INT 14 (+2), WIS 12 (+1), CHA 16 (+3); character level 2 → PB +2. Warlock +5 / DC 13, Wizard +4 / DC 12, Druid +3 / DC 11. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'

const cls = (className: string, level = 1) => ({ className, classSource: XPHB, subclass: null, level })

function seeded(id: string, classes: Record<string, unknown>[], inventory: Record<string, unknown>[], extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 66,
    id,
    name: id,
    classes,
    createdAtLevel: 1,
    abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 13, constitution: 10, intelligence: 14, wisdom: 12, charisma: 16 } },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    spellChoices: [],
    inventory,
    ...extra,
  }
}

const attuned = (name: string, source: string) => ({ name, source, quantity: 1, attuned: true })

async function open(page: Page, character: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
  await page.getByRole('tab', { name: 'Spells' }).click()
}

const attack = (page: Page, source: string): Locator => page.getByRole('button', { name: `${source} spell attack breakdown`, exact: true })
const dc = (page: Page, source: string): Locator => page.getByRole('button', { name: `${source} save DC breakdown`, exact: true })

test('IB-1 a: +1 Rod of the Pact Keeper raises the Warlock numbers only', async ({ page }) => {
  await open(page, seeded('ib1-a', [cls('Warlock'), cls('Wizard')], [attuned('+1 Rod of the Pact Keeper', 'XDMG')]))
  await expect(attack(page, 'Warlock')).toHaveText('+6')
  await expect(dc(page, 'Warlock')).toHaveText('14')
  await expect(attack(page, 'Wizard')).toHaveText('+4')
  await expect(dc(page, 'Wizard')).toHaveText('12')

  await attack(page, 'Warlock').click()
  await expect(page.getByRole('dialog')).toContainText('+1 Rod of the Pact Keeper')
  await page.keyboard.press('Escape')
  await attack(page, 'Wizard').click()
  await expect(page.getByRole('dialog')).not.toContainText('Rod of the Pact Keeper')
})

test('IB-1 b: +1 Arcane Grimoire raises the Wizard numbers only', async ({ page }) => {
  await open(page, seeded('ib1-b', [cls('Warlock'), cls('Wizard')], [attuned('+1 Arcane Grimoire', 'TCE')]))
  await expect(attack(page, 'Wizard')).toHaveText('+5')
  await expect(dc(page, 'Wizard')).toHaveText('13')
  await expect(attack(page, 'Warlock')).toHaveText('+5')
  await expect(dc(page, 'Warlock')).toHaveText('13')
})

test('IB-1 c: a single-class Druid gets +1 from a +1 Moon Sickle', async ({ page }) => {
  await open(page, seeded('ib1-c', [cls('Druid', 2)], [attuned('+1 Moon Sickle', 'TCE')]))
  await expect(attack(page, 'Druid')).toHaveText('+4')
  await expect(dc(page, 'Druid')).toHaveText('12')
})

test('IB-1 d: Robe of the Archmagi still gives a Wizard +2', async ({ page }) => {
  await open(page, seeded('ib1-d', [cls('Wizard', 2)], [attuned('Robe of the Archmagi', 'XDMG')]))
  await expect(attack(page, 'Wizard')).toHaveText('+6')
  await expect(dc(page, 'Wizard')).toHaveText('14')
})

test('IB-1 e: a Magic Initiate spell of a Warlock with the Rod gets no +1', async ({ page }) => {
  const magicInitiate = { className: 'Cleric', classSource: XPHB, cantrips: [{ name: 'Guidance', source: XPHB }, { name: 'Sacred Flame', source: XPHB }], spell: { name: 'Guiding Bolt', source: XPHB } }
  await open(
    page,
    seeded('ib1-e', [cls('Warlock', 2)], [attuned('+1 Rod of the Pact Keeper', 'XDMG')], {
      grantedFeats: [{ origin: 'species', name: 'Magic Initiate', source: XPHB, chosenAbility: 'wisdom', magicInitiate }],
    }),
  )
  await expect(attack(page, 'Warlock')).toHaveText('+6')
  await expect(attack(page, 'Magic Initiate')).toHaveText('+3')
  await expect(dc(page, 'Magic Initiate')).toHaveText('11')
})
