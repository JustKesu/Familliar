/**
 * W-8 crop state in the image's own pixels: `zoom` 1 = the square just covers
 * the image's shorter side (no empty edges), `cx`/`cy` = centre of the square.
 * Independent of how large the frame is drawn, so a resized window never moves the crop.
 */
export interface Crop {
	zoom: number
	cx: number
	cy: number
}

export interface ImageSize {
	width: number
	height: number
}

export const MAX_ZOOM = 4

/** Side of the source square at this zoom. */
export function cropSide(image: ImageSize, zoom: number): number {
	return Math.min(image.width, image.height) / zoom
}

function clampNumber(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value))
}

/** Keeps zoom in [1, MAX_ZOOM] and the square fully inside the image. */
export function clampCrop(image: ImageSize, crop: Crop): Crop {
	const zoom = clampNumber(crop.zoom, 1, MAX_ZOOM)
	const half = cropSide(image, zoom) / 2
	return { zoom, cx: clampNumber(crop.cx, half, image.width - half), cy: clampNumber(crop.cy, half, image.height - half) }
}

export function initialCrop(image: ImageSize): Crop {
	return { zoom: 1, cx: image.width / 2, cy: image.height / 2 }
}

/** The part of the image the frame shows. */
export function sourceRect(image: ImageSize, crop: Crop): { x: number; y: number; size: number } {
	const clamped = clampCrop(image, crop)
	const size = cropSide(image, clamped.zoom)
	return { x: clamped.cx - size / 2, y: clamped.cy - size / 2, size }
}

/** Moves the image by a drag of (dx, dy) frame pixels: dragging right shows more of the left. */
export function panCrop(image: ImageSize, crop: Crop, dx: number, dy: number, frame: number): Crop {
	const perPixel = cropSide(image, crop.zoom) / frame
	return clampCrop(image, { ...crop, cx: crop.cx - dx * perPixel, cy: crop.cy - dy * perPixel })
}

/** Zooms keeping the image point under `anchor` (frame fractions 0–1, default the centre) where it is. */
export function zoomCrop(image: ImageSize, crop: Crop, zoom: number, anchor = { x: 0.5, y: 0.5 }): Crop {
	const { x, y, size } = sourceRect(image, crop)
	const pointX = x + anchor.x * size
	const pointY = y + anchor.y * size
	const nextZoom = clampNumber(zoom, 1, MAX_ZOOM)
	const nextSize = cropSide(image, nextZoom)
	return clampCrop(image, { zoom: nextZoom, cx: pointX - anchor.x * nextSize + nextSize / 2, cy: pointY - anchor.y * nextSize + nextSize / 2 })
}
