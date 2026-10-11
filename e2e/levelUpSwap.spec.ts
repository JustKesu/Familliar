import { expect, test, type Locator, type Page } from '@playwright/test'
import { chooseButton, wizardNav } from './wizard.ts'

/* F-20a (D345): replacing one Eldritch Invocation or Metamagic option on a level up. Seeded at schema 61. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const refs = (names: string[]) => names.map((name) => ({ name, source: XPHB }))
const ACOLYTE = { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" }
// Warlock 4: 3 cantrips, 5 prepared; Warlock 5: 6 prepared (classes.json).
const WARLOCK_SPELLS = ['Eldritch Blast', 'Minor Illusion', 'Prestidigitation', 'Hex', 'Armor of Agathys', 'Hold Person', 'Misty Step', 'Spider Climb', 'Counterspell']

function seeded(id: string, className: string, subclass: string, level: number, extra: Record<string, unknown>) {
  return {
    schemaVersion: 61,
    id,
    name: id,
    classes: [{ className, classSource: XPHB, subclass, level }],
    levelOrder: Array.from({ length: level }, () => ({ className, classSource: XPHB })),
    createdAtLevel: level,
    abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 15 } },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    background: ACOLYTE,
    featAsiChoices: [{ level: 4, kind: 'asi', increases: { charisma: 2 } }],
    ...extra,
  }
}

/** Warlock 4 has 3 invocations, Warlock 5 has 5 (classes.json EI progression). */
function warlock(id: string, level: 4 | 5, invocations: string[], extra: Record<string, unknown> = {}) {
  return seeded(id, 'Warlock', 'Fiend Patron', level, {
    classSkills: ['arcana', 'deception'],
    spellChoices: [{ className: 'Warlock', classSource: XPHB, spells: refs(WARLOCK_SPELLS.slice(0, level === 4 ? 8 : 9)) }],
    optionalFeatureChoices: [{ featureType: 'EI', choices: refs(invocations) }],
    ...extra,
  })
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

async function stored(page: Page, id: string): Promise<Record<string, unknown>> {
  return (await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]'), STORAGE_KEY)).find((entry: Record<string, unknown>) => entry['id'] === id)
}

async function storedOptions(page: Page, id: string, featureType: string): Promise<{ choices: { name: string; level?: number }[]; spellChoices?: unknown[] }> {
  const options = (await stored(page, id))['optionalFeatureChoices'] as { featureType: string; choices: { name: string; level?: number }[] }[]
  return options.find((entry) => entry.featureType === featureType)!
}

const currentStep = (page: Page): Locator => page.locator('[aria-current="step"]')
const nextOf = (page: Page): Locator => wizardNav(page).getByRole('button', { name: 'Next', exact: true })
const replaceGroup = (page: Page): Locator => page.getByRole('group', { name: 'Replace one', exact: true })
const featureOptions = (page: Page): Locator => page.locator('.sheet__feature-options')

async function fillSpells(page: Page): Promise<void> {
  const addSpells = page.getByRole('region', { name: 'Add Spells' })
  for (const [label, button] of [
    ['Cantrips', /^Add /],
    ['Prepared', /^Prepare /],
  ] as const) {
    const counter = page.locator('.manage-spells__counter', { hasText: new RegExp(`^${label}:`) })
    if ((await counter.count()) === 0) continue
    for (;;) {
      const [, have, max] = (await counter.innerText()).match(/(\d+)\/(\d+)/)!.map(Number)
      if (have! >= max!) break
      await addSpells.getByRole('button', { name: button, disabled: false }).first().click()
      await expect(counter).toHaveText(new RegExp(`^${label}: ${have! + 1}/`))
    }
  }
}

async function openOptionList(page: Page, legend: string): Promise<void> {
  const toggle = page.getByRole('button', { name: new RegExp(`^${legend}`), expanded: false })
  if ((await toggle.count()) > 0) await toggle.click()
}

/** Opens Level up, takes `label` ("Warlock 4 → 5"), walks to the save; `options` runs on the class-options step. Returns the steps seen. */
async function levelUp(page: Page, label: string, level: number, options?: (page: Page) => Promise<void>): Promise<string[]> {
  await page.locator('.sheet__level-up').click()
  await page.getByRole('dialog', { name: 'Level up which class?' }).getByRole('button', { name: label, exact: true }).click()
  await expect(page).toHaveURL(/\/level-up/)
  const seen: string[] = []
  for (let i = 0; i < 12; i++) {
    const step = (await currentStep(page).textContent()) ?? ''
    seen.push(step)
    if (/Review and save/.test(step)) {
      await wizardNav(page).getByRole('button', { name: `Save level ${level}` }).click()
      await expect(page).not.toHaveURL(/\/level-up/)
      return seen
    }
    if (/Spells/.test(step)) await fillSpells(page)
    if (/Eldritch Invocations|Metamagic/.test(step)) await options?.(page)
    if (/Hit points/.test(step)) {
      await page.getByRole('radiogroup', { name: `Level ${level} hit points method`, exact: true }).getByRole('radio', { name: /^Average/ }).check()
    }
    await nextOf(page).click()
    await expect(currentStep(page)).not.toHaveText(step)
  }
  throw new Error(`Level up did not reach Review: ${seen.join(' / ')}`)
}

test('F-20a a, d: Warlock 4 → 5 replaces Agonizing Blast with Repelling Blast; Remove level 5 keeps Repelling Blast', async ({ page }) => {
  await openSheet(page, warlock('f20a-a', 4, ['Agonizing Blast', 'Armor of Shadows', "Devil's Sight"]))
  await levelUp(page, 'Warlock 4 → 5', 5, async (p) => {
    await replaceGroup(p).getByRole('button', { name: 'Replace Agonizing Blast', exact: true }).click()
    await expect(replaceGroup(p)).toContainText('Replacing Agonizing Blast')
    await openOptionList(p, 'Eldritch Invocations')
    await chooseButton(p, 'Repelling Blast').click()
    await chooseButton(p, 'Pact of the Blade').click()
    await expect(nextOf(p)).toBeDisabled()
    await chooseButton(p, 'Mask of Many Faces').click()
    await expect(nextOf(p)).toBeEnabled()
  })

  // EI progression: 5 invocations at Warlock 5.
  const invocations = await storedOptions(page, 'f20a-a', 'EI')
  expect(invocations.choices.map((choice) => choice.name).sort()).toEqual(['Armor of Shadows', "Devil's Sight", 'Mask of Many Faces', 'Pact of the Blade', 'Repelling Blast'])
  expect(invocations.choices.find((choice) => choice.name === 'Repelling Blast')!.level).toBeUndefined()
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  const listed = featureOptions(page).filter({ hasText: 'Armor of Shadows' })
  await expect(listed).toContainText('Repelling Blast')
  await expect(listed).not.toContainText('Agonizing Blast')

  // d: the replacement took the creation pick's (absent) stamp, so it survives Remove level 5.
  await page.getByRole('button', { name: 'Remove level 5', exact: true }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Remove level 5?' })
  await expect(dialog).toContainText('Mask of Many Faces')
  await expect(dialog).not.toContainText('Repelling Blast')
  await dialog.getByRole('button', { name: 'Remove level', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect((await storedOptions(page, 'f20a-a', 'EI')).choices.map((choice) => choice.name).sort()).toEqual(['Armor of Shadows', "Devil's Sight", 'Repelling Blast'])
  await expect(featureOptions(page).filter({ hasText: 'Armor of Shadows' })).toContainText('Repelling Blast')
})

test('F-20a b: Pact of the Blade cannot be replaced while Thirsting Blade needs it', async ({ page }) => {
  await openSheet(page, warlock('f20a-b', 5, ['Pact of the Blade', 'Thirsting Blade', 'Agonizing Blast', 'Armor of Shadows', "Devil's Sight"]))
  await levelUp(page, 'Warlock 5 → 6', 6, async (p) => {
    const blade = replaceGroup(p).getByRole('listitem').filter({ hasText: 'Replace Pact of the Blade' })
    await expect(blade.getByRole('button')).toBeDisabled()
    await expect(blade).toContainText('Required by Thirsting Blade.')
    await expect(replaceGroup(p).getByRole('button', { name: 'Replace Thirsting Blade', exact: true })).toBeEnabled()
  })
})

test('F-20a c: replacing Pact of the Tome drops its spells', async ({ page }) => {
  const tome = { optionName: 'Pact of the Tome', cantrips: refs(['Guidance', 'Light', 'Sacred Flame']), spells: refs(['Detect Magic', 'Find Familiar']) }
  const held = refs(['Pact of the Tome', 'Agonizing Blast', 'Armor of Shadows', "Devil's Sight", 'Mask of Many Faces'])
  await openSheet(page, warlock('f20a-c', 5, [], { optionalFeatureChoices: [{ featureType: 'EI', choices: held, spellChoices: [tome] }] }))
  await page.getByRole('tab', { name: 'Spells' }).click()
  await expect(page.getByRole('tabpanel', { name: 'Spells' })).toContainText('Guidance')

  await levelUp(page, 'Warlock 5 → 6', 6, async (p) => {
    await replaceGroup(p).getByRole('button', { name: 'Replace Pact of the Tome', exact: true }).click()
    await openOptionList(p, 'Eldritch Invocations')
    await chooseButton(p, 'Pact of the Blade').click()
    await expect(nextOf(p)).toBeEnabled()
  })

  const invocations = await storedOptions(page, 'f20a-c', 'EI')
  expect(invocations.choices.map((choice) => choice.name)).toContain('Pact of the Blade')
  expect(invocations.choices.map((choice) => choice.name)).not.toContain('Pact of the Tome')
  expect(invocations.spellChoices).toBeUndefined()
  await page.getByRole('tab', { name: 'Spells' }).click()
  await expect(page.getByRole('tabpanel', { name: 'Spells' })).not.toContainText('Guidance')
})

test('F-20a e: Warlock 5 → 6 walks the invocations step with nothing to add; Next works without a swap', async ({ page }) => {
  const invocations = ['Agonizing Blast', 'Armor of Shadows', "Devil's Sight", 'Mask of Many Faces', 'Pact of the Blade']
  await openSheet(page, warlock('f20a-e', 5, invocations))
  const steps = await levelUp(page, 'Warlock 5 → 6', 6, async (p) => {
    await expect(replaceGroup(p)).toBeVisible()
    await expect(nextOf(p)).toBeEnabled()
  })
  expect(steps.some((step) => /Eldritch Invocations/.test(step))).toBe(true)
  expect((await storedOptions(page, 'f20a-e', 'EI')).choices.map((choice) => choice.name)).toEqual(invocations)
})

test('F-20a f: Sorcerer 4 → 5 replaces Careful Spell with Distant Spell', async ({ page }) => {
  // Sorcerer 4: 5 cantrips, 7 prepared (classes.json).
  await openSheet(
    page,
    seeded('f20a-f', 'Sorcerer', 'Wild Magic Sorcery', 4, {
      classSkills: ['arcana', 'deception'],
      spellChoices: [
        {
          className: 'Sorcerer',
          classSource: XPHB,
          spells: refs(['Fire Bolt', 'Light', 'Mage Hand', 'Ray of Frost', 'Prestidigitation', 'Burning Hands', 'Magic Missile', 'Shield', 'Chromatic Orb', 'Scorching Ray', 'Mirror Image', 'Misty Step']),
        },
      ],
      optionalFeatureChoices: [{ featureType: 'MM', choices: refs(['Careful Spell', 'Quickened Spell']) }],
    }),
  )
  await levelUp(page, 'Sorcerer 4 → 5', 5, async (p) => {
    await replaceGroup(p).getByRole('button', { name: 'Replace Careful Spell', exact: true }).click()
    await expect(nextOf(p)).toBeDisabled()
    await openOptionList(p, 'Metamagic')
    await chooseButton(p, 'Distant Spell').click()
    await expect(nextOf(p)).toBeEnabled()
  })
  expect((await storedOptions(page, 'f20a-f', 'MM')).choices.map((choice) => choice.name)).toEqual(['Quickened Spell', 'Distant Spell'])
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  const metamagic = featureOptions(page).filter({ hasText: 'Quickened Spell' })
  await expect(metamagic).toContainText('Distant Spell')
  await expect(metamagic).not.toContainText('Careful Spell')
})
