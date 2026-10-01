import { describe, expect, it } from 'vitest'
import { clampCrop, initialCrop, MAX_ZOOM, panCrop, sourceRect, zoomCrop, type Crop } from './cropMath'

const WIDE = { width: 600, height: 400 }
const TALL = { width: 300, height: 900 }

function covers(image: { width: number; height: number }, crop: Crop): boolean {
	const { x, y, size } = sourceRect(image, crop)
	return x >= -1e-9 && y >= -1e-9 && x + size <= image.width + 1e-9 && y + size <= image.height + 1e-9
}

describe('crop math (W-8)', () => {
	it('minimum zoom covers the frame: the square is the shorter side, centred', () => {
		expect(sourceRect(WIDE, initialCrop(WIDE))).toEqual({ x: 100, y: 0, size: 400 })
		expect(sourceRect(TALL, initialCrop(TALL))).toEqual({ x: 0, y: 300, size: 300 })
	})

	it('zoom is clamped to 1…MAX_ZOOM', () => {
		expect(clampCrop(WIDE, { zoom: 0.2, cx: 300, cy: 200 }).zoom).toBe(1)
		expect(clampCrop(WIDE, { zoom: 99, cx: 300, cy: 200 }).zoom).toBe(MAX_ZOOM)
		expect(sourceRect(WIDE, { zoom: 2, cx: 300, cy: 200 }).size).toBe(200)
	})

	it('panning never uncovers the frame, at any zoom', () => {
		for (const zoom of [1, 1.5, 2, 3, MAX_ZOOM]) {
			let crop = zoomCrop(WIDE, initialCrop(WIDE), zoom)
			for (const [dx, dy] of [[5000, 0], [-5000, 0], [0, 5000], [0, -5000], [300, -200]]) {
				crop = panCrop(WIDE, crop, dx, dy, 320)
				expect(covers(WIDE, crop)).toBe(true)
			}
		}
	})

	it('dragging right shows more of the left; at zoom 1 the wide image moves only sideways', () => {
		const moved = panCrop(WIDE, initialCrop(WIDE), 80, 80, 320)
		// 80 frame px × 400/320 image px per frame px = 100.
		expect(sourceRect(WIDE, moved)).toEqual({ x: 0, y: 0, size: 400 })
	})

	it('zooming keeps the anchored point in place and stays covered', () => {
		const start = initialCrop(WIDE)
		const zoomed = zoomCrop(WIDE, start, 2, { x: 0, y: 0 })
		expect(sourceRect(WIDE, zoomed)).toEqual({ x: 100, y: 0, size: 200 })
		const back = zoomCrop(WIDE, { zoom: 4, cx: 25, cy: 25 }, 1)
		expect(covers(WIDE, back)).toBe(true)
	})
})
