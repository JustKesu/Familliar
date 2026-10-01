import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useModal } from '../app/ConfirmDialog'
import { PORTRAIT_MAX_LENGTH } from '../storage/character'
import { initialCrop, MAX_ZOOM, panCrop, sourceRect, zoomCrop, type ImageSize } from './cropMath'

export interface LoadedImage extends ImageSize {
	/** Object URL of the chosen file; the caller revokes it when the dialog closes. */
	src: string
}

const PORTRAIT_SIZE = 256
const ARROW_STEP = 10
const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-ARROW_STEP, 0], ArrowRight: [ARROW_STEP, 0], ArrowUp: [0, -ARROW_STEP], ArrowDown: [0, ARROW_STEP] }

/** W2: only the cropped square is kept — 256×256 JPEG, transparency filled with the theme's surface colour. */
function renderPortrait(image: HTMLImageElement, rect: { x: number; y: number; size: number }, fill: string): string {
	const canvas = document.createElement('canvas')
	canvas.width = PORTRAIT_SIZE
	canvas.height = PORTRAIT_SIZE
	const context = canvas.getContext('2d')!
	context.fillStyle = fill
	context.fillRect(0, 0, PORTRAIT_SIZE, PORTRAIT_SIZE)
	context.imageSmoothingQuality = 'high'
	context.drawImage(image, rect.x, rect.y, rect.size, rect.size, 0, 0, PORTRAIT_SIZE, PORTRAIT_SIZE)
	// A noisy photo can exceed the storage cap at 0.85; a lower quality is better than a refused save.
	for (const quality of [0.85, 0.7, 0.5]) {
		const url = canvas.toDataURL('image/jpeg', quality)
		if (url.length <= PORTRAIT_MAX_LENGTH) return url
	}
	return canvas.toDataURL('image/jpeg', 0.3)
}

/** D116: dragging and zooming change only this dialog's state; nothing outside re-renders or is stored until Apply. */
export function PortraitCropDialog({ image, onApply, onCancel }: { image: LoadedImage; onApply: (portrait: string) => void; onCancel: () => void }): ReactNode {
	const id = useId()
	const backdropRef = useRef<HTMLDivElement>(null)
	const dialogRef = useRef<HTMLDivElement>(null)
	const frameRef = useRef<HTMLDivElement>(null)
	const imageRef = useRef<HTMLImageElement>(null)
	const drag = useRef<{ pointerId: number; x: number; y: number } | null>(null)
	const pressedOnBackdrop = useRef(false)
	const [crop, setCrop] = useState(() => initialCrop(image))
	const [frame, setFrame] = useState(320)
	useModal(backdropRef, dialogRef, frameRef, onCancel)

	useLayoutEffect(() => {
		const measure = () => frameRef.current && setFrame(frameRef.current.clientWidth || 320)
		measure()
		window.addEventListener('resize', measure)
		return () => window.removeEventListener('resize', measure)
	}, [])

	// React's wheel listener is passive, and the page behind must not scroll while zooming.
	useEffect(() => {
		const element = frameRef.current
		if (!element) return
		function handleWheel(event: WheelEvent): void {
			event.preventDefault()
			const box = element!.getBoundingClientRect()
			const anchor = { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height }
			setCrop((current) => zoomCrop(image, current, current.zoom * Math.exp(-event.deltaY * 0.002), anchor))
		}
		element.addEventListener('wheel', handleWheel, { passive: false })
		return () => element.removeEventListener('wheel', handleWheel)
	}, [image])

	const { x, y, size } = sourceRect(image, crop)
	const scale = frame / size

	function apply(): void {
		if (!imageRef.current || !frameRef.current) return
		const fill = getComputedStyle(frameRef.current).getPropertyValue('--surface').trim()
		onApply(renderPortrait(imageRef.current, sourceRect(image, crop), fill))
	}

	return createPortal(
		<div
			ref={backdropRef}
			className="confirm-dialog__backdrop"
			onPointerDown={(event) => (pressedOnBackdrop.current = event.target === event.currentTarget)}
			// A drag that ends outside the dialog must not count as a click outside.
			onClick={(event) => event.target === event.currentTarget && pressedOnBackdrop.current && onCancel()}
		>
			<div ref={dialogRef} className="confirm-dialog portrait-crop" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} tabIndex={-1}>
				<h2 id={`${id}-title`} className="confirm-dialog__title portrait-crop__title">
					Crop portrait
				</h2>
				<div
					ref={frameRef}
					className="portrait-crop__frame"
					role="group"
					aria-label="Image position — drag or use the arrow keys"
					tabIndex={0}
					onPointerDown={(event) => {
						event.currentTarget.setPointerCapture(event.pointerId)
						drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
					}}
					onPointerMove={(event) => {
						const start = drag.current
						if (!start || start.pointerId !== event.pointerId) return
						const dx = event.clientX - start.x
						const dy = event.clientY - start.y
						drag.current = { ...start, x: event.clientX, y: event.clientY }
						setCrop((current) => panCrop(image, current, dx, dy, frame))
					}}
					onPointerUp={() => (drag.current = null)}
					onPointerCancel={() => (drag.current = null)}
					onKeyDown={(event) => {
						const step = ARROWS[event.key]
						if (!step) return
						event.preventDefault()
						setCrop((current) => panCrop(image, current, step[0], step[1], frame))
					}}
				>
					<img
						ref={imageRef}
						src={image.src}
						width={image.width}
						height={image.height}
						alt=""
						draggable={false}
						className="portrait-crop__image"
						style={{ transform: `translate(${-x * scale}px, ${-y * scale}px) scale(${scale})` }}
					/>
				</div>
				<label className="portrait-crop__zoom" htmlFor={`${id}-zoom`}>
					Zoom
				</label>
				<input
					id={`${id}-zoom`}
					className="portrait-crop__slider"
					type="range"
					min={1}
					max={MAX_ZOOM}
					step={0.01}
					value={crop.zoom}
					onChange={(event) => setCrop((current) => zoomCrop(image, current, Number(event.target.value)))}
				/>
				<div className="confirm-dialog__actions">
					<button type="button" className="btn--accent-outline" onClick={onCancel}>
						Cancel
					</button>
					<button type="button" className="btn--accent" onClick={apply}>
						Apply
					</button>
				</div>
			</div>
		</div>,
		document.body,
	)
}
