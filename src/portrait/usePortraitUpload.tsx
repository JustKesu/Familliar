import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { downscaledSize } from './cropMath'
import { PortraitCropDialog, type LoadedImage } from './PortraitCropDialog'

const MAX_FILE_BYTES = 20 * 1024 * 1024
export const PORTRAIT_TOO_LARGE = 'This image is too large (max 20 MB).'
export const PORTRAIT_UNREADABLE = 'This image could not be read. Try a JPEG or PNG.'

/** D268: a copy of the decoded image at `size`, so a huge photo is not kept at full size while cropping. */
async function downscaledUrl(image: HTMLImageElement, size: { width: number; height: number }): Promise<string> {
	const canvas = document.createElement('canvas')
	canvas.width = size.width
	canvas.height = size.height
	canvas.getContext('2d')!.drawImage(image, 0, 0, size.width, size.height)
	// PNG, because the crop later fills any transparency itself.
	const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
	if (!blob) throw new Error('could not encode the downscaled image')
	return URL.createObjectURL(blob)
}

/** Decoded through <img>, which applies EXIF orientation (CSS image-orientation: from-image), as does drawImage of it — checked by e2e portrait.spec.ts h. */
async function loadImage(file: File): Promise<LoadedImage> {
	const original = URL.createObjectURL(file)
	const image = new Image()
	image.src = original
	try {
		await image.decode()
		if (image.naturalWidth === 0 || image.naturalHeight === 0) throw new Error('empty image')
		const natural = { width: image.naturalWidth, height: image.naturalHeight }
		const size = downscaledSize(natural)
		if (size === natural) return { src: original, ...natural }
		const src = await downscaledUrl(image, size)
		URL.revokeObjectURL(original)
		image.src = ''
		return { src, ...size }
	} catch {
		URL.revokeObjectURL(original)
		throw new Error(PORTRAIT_UNREADABLE)
	}
}

/**
 * W2: file chooser → crop dialog → `onApply(dataUrl)`. Render `elements` somewhere; `error` is for the caller to show next to its control.
 * `returnFocus` gets the focus back when the dialog closes (the control that opened the chooser may have unmounted).
 */
export function usePortraitUpload(
	onApply: (portrait: string) => void,
	returnFocus?: RefObject<HTMLElement | null>,
): { choose: () => void; error: string | null; clearError: () => void; elements: ReactNode } {
	const inputRef = useRef<HTMLInputElement>(null)
	const [error, setError] = useState<string | null>(null)
	const [image, setImage] = useState<LoadedImage | null>(null)
	const clearError = useCallback(() => setError(null), [])
	// Only the latest file picked may open the dialog; an earlier, slower decode is dropped.
	const request = useRef(0)
	const openSrc = useRef<string | null>(null)
	openSrc.current = image?.src ?? null

	useEffect(
		() => () => {
			request.current++
			if (openSrc.current) URL.revokeObjectURL(openSrc.current)
		},
		[],
	)

	const wasOpen = useRef(false)
	useEffect(() => {
		// Runs after the dialog's own cleanup, which returned focus to the then-active element.
		if (wasOpen.current && !image) returnFocus?.current?.focus()
		wasOpen.current = image !== null
	}, [image, returnFocus])

	function close(): void {
		if (image) URL.revokeObjectURL(image.src)
		setImage(null)
	}

	const elements = (
		<>
			<input
				ref={inputRef}
				type="file"
				accept="image/*"
				hidden
				onChange={(event) => {
					const file = event.target.files?.[0]
					event.target.value = ''
					if (!file) return
					const mine = ++request.current
					if (file.size > MAX_FILE_BYTES) {
						setError(PORTRAIT_TOO_LARGE)
						return
					}
					loadImage(file).then(
						(loaded) => {
							if (mine !== request.current) {
								URL.revokeObjectURL(loaded.src)
								return
							}
							setError(null)
							setImage(loaded)
						},
						() => {
							if (mine === request.current) setError(PORTRAIT_UNREADABLE)
						},
					)
				}}
			/>
			{image && (
				<PortraitCropDialog
					image={image}
					onCancel={close}
					onApply={(portrait) => {
						close()
						onApply(portrait)
					}}
					onFail={() => {
						close()
						setError(PORTRAIT_UNREADABLE)
					}}
				/>
			)}
		</>
	)

	return { choose: () => inputRef.current?.click(), error, clearError, elements }
}
