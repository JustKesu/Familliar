import { useCallback, useRef, useState, type ReactNode } from 'react'
import { PortraitCropDialog, type LoadedImage } from './PortraitCropDialog'

const MAX_FILE_BYTES = 20 * 1024 * 1024
export const PORTRAIT_TOO_LARGE = 'This image is too large (max 20 MB).'
export const PORTRAIT_UNREADABLE = 'This image could not be read. Try a JPEG or PNG.'

/** Decoded through <img>, which applies EXIF orientation (CSS image-orientation: from-image), as does drawImage of it — checked by e2e portrait.spec.ts h. */
async function loadImage(file: File): Promise<LoadedImage> {
	const src = URL.createObjectURL(file)
	const image = new Image()
	image.src = src
	try {
		await image.decode()
		if (image.naturalWidth === 0 || image.naturalHeight === 0) throw new Error('empty image')
		return { src, width: image.naturalWidth, height: image.naturalHeight }
	} catch {
		URL.revokeObjectURL(src)
		throw new Error(PORTRAIT_UNREADABLE)
	}
}

/** W2: file chooser → crop dialog → `onApply(dataUrl)`. Render `elements` somewhere; `error` is for the caller to show next to its control. */
export function usePortraitUpload(onApply: (portrait: string) => void): { choose: () => void; error: string | null; clearError: () => void; elements: ReactNode } {
	const inputRef = useRef<HTMLInputElement>(null)
	const [error, setError] = useState<string | null>(null)
	const [image, setImage] = useState<LoadedImage | null>(null)
	const clearError = useCallback(() => setError(null), [])

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
					if (file.size > MAX_FILE_BYTES) {
						setError(PORTRAIT_TOO_LARGE)
						return
					}
					loadImage(file).then(
						(loaded) => {
							setError(null)
							setImage(loaded)
						},
						() => setError(PORTRAIT_UNREADABLE),
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
				/>
			)}
		</>
	)

	return { choose: () => inputRef.current?.click(), error, clearError, elements }
}
