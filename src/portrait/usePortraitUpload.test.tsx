// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PORTRAIT_UNREADABLE, usePortraitUpload } from './usePortraitUpload'

/** jsdom has no image decoding or canvas: Image decodes when the test says so, the canvas is a stub. */
let finishDecode: Array<() => void>
let imageSize: { width: number; height: number }
let created: number
const revoke = vi.fn()

class FakeImage {
	src = ''
	naturalWidth = imageSize.width
	naturalHeight = imageSize.height
	decode(): Promise<void> {
		return new Promise((resolve) => finishDecode.push(resolve))
	}
}

function Host({ onApply }: { onApply: (portrait: string) => void }) {
	const upload = usePortraitUpload(onApply)
	return (
		<>
			{upload.elements}
			{upload.error && <p>{upload.error}</p>}
		</>
	)
}

function pick(container: HTMLElement): void {
	const input = container.querySelector('input[type="file"]')!
	fireEvent.change(input, { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } })
}

const decoded = (index: number) => act(async () => finishDecode[index]())

beforeEach(() => {
	finishDecode = []
	imageSize = { width: 600, height: 400 }
	created = 0
	revoke.mockClear()
	vi.stubGlobal('Image', FakeImage)
	Object.assign(URL, { createObjectURL: () => `blob:${++created}`, revokeObjectURL: revoke })
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect: vi.fn(), drawImage: vi.fn() } as unknown as CanvasRenderingContext2D)
	HTMLCanvasElement.prototype.toBlob = (callback) => callback(new Blob(['png']))
})

afterEach(() => {
	cleanup()
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})

describe('usePortraitUpload (F-4)', () => {
	it('a decode that finishes after a newer pick is ignored and its object URL revoked', async () => {
		const { container } = render(<Host onApply={vi.fn()} />)
		pick(container)
		pick(container)
		await decoded(1)
		expect(screen.getByRole('dialog').querySelector('img')!.getAttribute('src')).toBe('blob:2')
		await decoded(0)
		expect(screen.getAllByRole('dialog')).toHaveLength(1)
		expect(screen.getByRole('dialog').querySelector('img')!.getAttribute('src')).toBe('blob:2')
		expect(revoke).toHaveBeenCalledWith('blob:1')
		expect(revoke).not.toHaveBeenCalledWith('blob:2')
	})

	it('revokes the open image’s object URL when the host unmounts', async () => {
		const { container, unmount } = render(<Host onApply={vi.fn()} />)
		pick(container)
		await decoded(0)
		expect(screen.getByRole('dialog')).toBeTruthy()
		expect(revoke).not.toHaveBeenCalled()
		unmount()
		expect(revoke).toHaveBeenCalledWith('blob:1')
	})

	it('a decode that finishes after the host unmounted is revoked and opens nothing', async () => {
		const { container, unmount } = render(<Host onApply={vi.fn()} />)
		pick(container)
		unmount()
		await decoded(0)
		expect(revoke).toHaveBeenCalledWith('blob:1')
		expect(screen.queryByRole('dialog')).toBeNull()
	})

	it('Apply with a canvas that cannot encode closes the dialog, says the image could not be read and applies nothing', async () => {
		vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(() => {
			throw new DOMException('tainted', 'SecurityError')
		})
		const onApply = vi.fn()
		const { container } = render(<Host onApply={onApply} />)
		pick(container)
		await decoded(0)
		fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
		expect(screen.queryByRole('dialog')).toBeNull()
		expect(screen.getByText(PORTRAIT_UNREADABLE)).toBeTruthy()
		expect(onApply).not.toHaveBeenCalled()
		expect(revoke).toHaveBeenCalledWith('blob:1')
	})

	it('Apply with a working canvas hands the data URL over and closes', async () => {
		vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,AAAA')
		const onApply = vi.fn()
		const { container } = render(<Host onApply={onApply} />)
		pick(container)
		await decoded(0)
		fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
		expect(onApply).toHaveBeenCalledWith('data:image/jpeg;base64,AAAA')
		expect(screen.queryByRole('dialog')).toBeNull()
	})

	it('a large image is replaced by a 2048-capped copy and the full-size URL is released (D268)', async () => {
		imageSize = { width: 5000, height: 3000 }
		const { container } = render(<Host onApply={vi.fn()} />)
		pick(container)
		await decoded(0)
		const image = screen.getByRole('dialog').querySelector('img')!
		expect(image.getAttribute('src')).toBe('blob:2')
		expect([image.getAttribute('width'), image.getAttribute('height')]).toEqual(['2048', '1229'])
		expect(revoke).toHaveBeenCalledWith('blob:1')
	})
})
