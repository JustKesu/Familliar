/// <reference lib="dom" />
// DOM types for the code these tests run inside the page (image decoding, canvas pixels).
import { expect, test, type Locator, type Page } from '@playwright/test'
import { createFighter, expectStep, next, wizardNav } from './wizard.ts'

/* W-8 (W2, W3, W31): portrait upload with the crop dialog, in the wizard and in the sheet header. */

const STORAGE_KEY = 'familliar:characters'
const FIXTURE = 'e2e/fixtures/portrait-600x400.png'
const NOT_AN_IMAGE = 'e2e/fixtures/not-an-image.png'
const UNREADABLE = 'This image could not be read. Try a JPEG or PNG.'

const square = (page: Page) => page.getByRole('button', { name: 'Portrait (optional)', exact: true })
const frame = (page: Page) => page.getByRole('button', { name: 'Portrait', exact: true })
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Crop portrait' })
const cropArea = (page: Page) => dialog(page).getByRole('group', { name: /^Image position/ })

async function upload(page: Page, trigger: Locator, file: string | { name: string; mimeType: string; buffer: Buffer }): Promise<void> {
  const chooser = page.waitForEvent('filechooser')
  await trigger.click()
  await (await chooser).setFiles(file)
}

async function apply(page: Page): Promise<void> {
  await dialog(page).getByRole('button', { name: 'Apply' }).click()
  await expect(dialog(page)).toHaveCount(0)
}

async function squareSource(page: Page): Promise<string> {
  return (await square(page).locator('img').getAttribute('src')) ?? ''
}

async function storedPortrait(page: Page): Promise<string | undefined> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0]?.portrait, STORAGE_KEY)
}

/** The decoded size of a data URL and the RGB at a few points, drawn at its own size. */
async function inspect(page: Page, url: string, points: [number, number][]): Promise<{ size: [number, number]; rgb: number[][] }> {
  return page.evaluate(
    async ({ url, points }) => {
      const image = new Image()
      image.src = url
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d')!
      context.drawImage(image, 0, 0)
      return { size: [image.naturalWidth, image.naturalHeight] as [number, number], rgb: points.map(([x, y]) => [...context.getImageData(x, y, 1, 1).data.slice(0, 3)]) }
    },
    { url, points },
  )
}

const isRed = ([r, , b]: number[]) => r > 150 && b < 110
const isBlue = ([r, , b]: number[]) => b > 150 && r < 110

async function openWizard(page: Page): Promise<void> {
  await page.goto('/#/new')
  await expectStep(page, 'Class and level')
}

test('W-8 a: wizard upload → Crop portrait → Apply; the sheet header shows the image and storage holds a 256×256 JPEG', async ({ page }) => {
  await createFighter(page, {
    name: 'Pia',
    level: 1,
    species: 'Dwarf|XPHB',
    onClassStep: async (p) => {
      await expect(square(p)).toHaveText('+')
      await upload(p, square(p), FIXTURE)
      await expect(dialog(p)).toBeVisible()
      await apply(p)
      await expect(square(p).locator('img')).toHaveCount(1)
    },
  })

  await expect(page.getByAltText('Portrait of Pia')).toBeVisible()
  await expect(frame(page)).toHaveText('')
  const stored = (await storedPortrait(page)) ?? ''
  expect(stored.startsWith('data:image/jpeg;base64,')).toBe(true)
  // Default crop of the 600×400 fixture: its middle 400×400, left half red and right half blue.
  const { size, rgb } = await inspect(page, stored, [[40, 128], [216, 128]])
  expect(size).toEqual([256, 256])
  expect(isRed(rgb[0]!)).toBe(true)
  expect(isBlue(rgb[1]!)).toBe(true)
})

test('W-8 b: dragging, the Zoom slider, the wheel and the arrow keys each change the stored crop', async ({ page }) => {
  await openWizard(page)
  const applied = async (move: () => Promise<void>): Promise<string> => {
    await upload(page, square(page), FIXTURE)
    await expect(dialog(page)).toBeVisible()
    await move()
    await apply(page)
    return squareSource(page)
  }

  const plain = await applied(async () => {})
  expect(await applied(async () => {})).toBe(plain)

  const dragged = await applied(async () => {
    const box = (await cropArea(page).boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2, { steps: 5 })
    await page.mouse.up()
    await expect(dialog(page)).toBeVisible()
  })
  expect(dragged).not.toBe(plain)

  const zoomed = await applied(async () => {
    await dialog(page).getByLabel('Zoom').press('End')
  })
  expect(zoomed).not.toBe(plain)

  const wheeled = await applied(async () => {
    const box = (await cropArea(page).boundingBox())!
    await page.mouse.move(box.x + box.width / 4, box.y + box.height / 4)
    await page.mouse.wheel(0, -400)
  })
  expect(wheeled).not.toBe(plain)

  const keyed = await applied(async () => {
    await expect(cropArea(page)).toBeFocused()
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight')
  })
  expect(keyed).not.toBe(plain)
})

test('W-8 c: Cancel, Esc and a click outside the crop dialog leave the square empty', async ({ page }) => {
  await openWizard(page)
  for (const close of [
    () => dialog(page).getByRole('button', { name: 'Cancel' }).click(),
    () => page.keyboard.press('Escape'),
    () => page.mouse.click(4, 4),
  ]) {
    await upload(page, square(page), FIXTURE)
    await expect(dialog(page)).toBeVisible()
    await close()
    await expect(dialog(page)).toHaveCount(0)
    await expect(square(page)).toHaveText('+')
  }
})

test('W-8 d + g: Remove empties the square; a non-image file shows the error and opens no dialog', async ({ page }) => {
  await openWizard(page)
  await upload(page, square(page), FIXTURE)
  await apply(page)
  await page.getByRole('button', { name: 'Remove', exact: true }).click()
  await expect(square(page)).toHaveText('+')
  await expect(page.getByRole('button', { name: 'Remove', exact: true })).toHaveCount(0)

  await upload(page, square(page), NOT_AN_IMAGE)
  await expect(page.getByText(UNREADABLE)).toBeVisible()
  await expect(dialog(page)).toHaveCount(0)
  await expect(square(page)).toHaveText('+')
})

test('W-8 d + e + g: no portrait shows the letter; the sheet menu uploads, survives a reload and removes', async ({ page }) => {
  // createFighter never touches the portrait, so getting to the sheet proves Next was never locked by it.
  await createFighter(page, { name: 'Edda', level: 1, species: 'Dwarf|XPHB' })
  await expect(frame(page)).toHaveText('E')
  await expect(page.getByAltText('Portrait of Edda')).toHaveCount(0)

  await frame(page).click()
  await expect(page.getByRole('menuitem', { name: 'Upload image' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Remove' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)

  await frame(page).click()
  await upload(page, page.getByRole('menuitem', { name: 'Upload image' }), NOT_AN_IMAGE)
  await expect(page.getByText(UNREADABLE)).toBeVisible()
  expect(await storedPortrait(page)).toBeUndefined()
  await page.keyboard.press('Escape')
  await expect(page.getByText(UNREADABLE)).toHaveCount(0)

  await frame(page).click()
  await upload(page, page.getByRole('menuitem', { name: 'Upload image' }), FIXTURE)
  await apply(page)
  await expect(page.getByAltText('Portrait of Edda')).toBeVisible()
  expect(await storedPortrait(page)).toMatch(/^data:image\/jpeg;base64,/)
  await page.reload()
  await expect(page.getByAltText('Portrait of Edda')).toBeVisible()

  await frame(page).click()
  await page.getByRole('menuitem', { name: 'Remove' }).click()
  await expect(frame(page)).toHaveText('E')
  await expect(page.getByAltText('Portrait of Edda')).toHaveCount(0)
  expect(await storedPortrait(page)).toBeUndefined()
})

test('W-8 f: Edit Character shows and keeps the portrait; a level up keeps it and shows no portrait control', async ({ page }) => {
  await createFighter(page, {
    name: 'Ivo',
    level: 1,
    species: 'Dwarf|XPHB',
    onClassStep: async (p) => {
      await upload(p, square(p), FIXTURE)
      await apply(p)
    },
  })
  const stored = (await storedPortrait(page))!
  expect(stored).toMatch(/^data:image\/jpeg;base64,/)

  await page.getByRole('button', { name: 'Edit character' }).click()
  await expectStep(page, 'Class and level')
  expect(await squareSource(page)).toBe(stored)
  const saveChanges = wizardNav(page).getByRole('button', { name: 'Save changes' })
  for (let steps = 0; steps < 12 && !(await saveChanges.isVisible()); steps++) await next(page)
  await saveChanges.click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)
  expect(await storedPortrait(page)).toBe(stored)

  await page.getByRole('button', { name: 'Level up to 2' }).click()
  const saveLevel = wizardNav(page).getByRole('button', { name: 'Save level 2' })
  for (let steps = 0; steps < 8 && !(await saveLevel.isVisible()); steps++) {
    await expect(square(page)).toHaveCount(0)
    const average = page.getByRole('radio', { name: 'Average (6)' })
    if (await average.isVisible()) await average.check()
    await next(page)
  }
  await expect(square(page)).toHaveCount(0)
  await saveLevel.click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)
  expect(await storedPortrait(page)).toBe(stored)
  await expect(page.getByAltText('Portrait of Ivo')).toBeVisible()
})

test('W-8 h: a phone JPEG with EXIF orientation 6 is cropped upright', async ({ page }) => {
  await openWizard(page)
  // 600×400, left red / right blue, tagged "rotate 90° clockwise": upright it is 400×600, red on top.
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 600
    canvas.height = 400
    const context = canvas.getContext('2d')!
    context.fillStyle = 'rgb(220, 30, 30)'
    context.fillRect(0, 0, 300, 400)
    context.fillStyle = 'rgb(30, 60, 220)'
    context.fillRect(300, 0, 300, 400)
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.95))
    const jpeg = [...new Uint8Array(await blob.arrayBuffer())]
    const exif = [0xff, 0xe1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0, 0, 0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, 6, 0, 0, 0, 0, 0, 0]
    const at = jpeg[2] === 0xff && jpeg[3] === 0xe0 ? 4 + ((jpeg[4]! << 8) | jpeg[5]!) : 2
    return [...jpeg.slice(0, at), ...exif, ...jpeg.slice(at)]
  })

  await upload(page, square(page), { name: 'phone.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(bytes) })
  const natural = await dialog(page).locator('img').evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])
  expect(natural).toEqual([400, 600])
  await apply(page)
  const { rgb } = await inspect(page, await squareSource(page), [[40, 40], [216, 40], [40, 216]])
  expect(isRed(rgb[0]!)).toBe(true)
  expect(isRed(rgb[1]!)).toBe(true)
  expect(isBlue(rgb[2]!)).toBe(true)
})
