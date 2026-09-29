import { useEffect, useRef, useState, type ReactNode } from 'react'

/*
 * D224: cursor-following flame drawn behind the whole app. Pointer position and
 * particles are plain variables inside the effect — no React state, context or
 * store is touched on mouse move or per frame (D116: the sheet re-renders whole).
 */

interface Particle {
	x: number
	y: number
	vx: number
	vy: number
	r: number
	life: number
	decay: number
	ph: number
}

const SPRITE = 64
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

const rand = (min: number, max: number): number => min + Math.random() * (max - min)

function cssColour(name: string): string {
	return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function makeSprite(colour: string): HTMLCanvasElement {
	const sprite = document.createElement('canvas')
	sprite.width = SPRITE
	sprite.height = SPRITE
	const ctx = sprite.getContext('2d')!
	const c = SPRITE / 2
	const fill = ctx.createRadialGradient(c, c, 0, c, c, c)
	fill.addColorStop(0, colour)
	fill.addColorStop(0.45, colour)
	fill.addColorStop(1, 'transparent')
	ctx.fillStyle = fill
	ctx.fillRect(0, 0, SPRITE, SPRITE)
	// The mask softens the edge so no hard circle survives the stretch.
	const mask = ctx.createRadialGradient(c, c, 0, c, c, c)
	mask.addColorStop(0, 'rgba(0,0,0,1)')
	mask.addColorStop(0.5, 'rgba(0,0,0,0.55)')
	mask.addColorStop(1, 'rgba(0,0,0,0)')
	ctx.globalCompositeOperation = 'destination-in'
	ctx.fillStyle = mask
	ctx.fillRect(0, 0, SPRITE, SPRITE)
	return sprite
}

function flameEnabled(): boolean {
	return document.documentElement.dataset.flame === 'on' && !window.matchMedia?.(REDUCED_MOTION).matches
}

/** Mounts the canvas only while the flame is switched on and motion is allowed. */
export default function FlameBackground(): ReactNode {
	const [enabled, setEnabled] = useState(flameEnabled)
	const canvasRef = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const update = (): void => setEnabled(flameEnabled())
		const observer = new MutationObserver(update)
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-flame'] })
		const media = window.matchMedia?.(REDUCED_MOTION)
		media?.addEventListener('change', update)
		return () => {
			observer.disconnect()
			media?.removeEventListener('change', update)
		}
	}, [])

	useEffect(() => {
		const canvas = canvasRef.current
		const ctx = canvas?.getContext('2d')
		if (!canvas || !ctx) return

		let accent = makeSprite(cssColour('--accent'))
		let hot = makeSprite(cssColour('--flame-hot'))
		let light = document.documentElement.dataset.theme === 'light'
		const particles: Particle[] = []
		let x = 0
		let y = 0
		let inside = false
		let prev: { x: number; y: number } | null = null
		let raf = 0

		const resize = (): void => {
			const dpr = Math.min(window.devicePixelRatio || 1, 2)
			canvas.width = Math.round(window.innerWidth * dpr)
			canvas.height = Math.round(window.innerHeight * dpr)
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
		}

		const spawn = (): void => {
			const px = prev ? prev.x : x
			const py = prev ? prev.y : y
			const mvx = x - px
			const mvy = y - py
			const n = 2.2 + Math.min(Math.hypot(mvx, mvy) / 5, 14)
			const count = Math.floor(n) + (Math.random() < n - Math.floor(n) ? 1 : 0)
			for (let i = 0; i < count; i++) {
				const t = Math.random()
				particles.push({
					x: px + mvx * t + rand(-8, 8),
					y: py + mvy * t + rand(-4, 6),
					vx: rand(-0.3, 0.3) - mvx * 0.05,
					vy: rand(-1.3, -0.5) - mvy * 0.05,
					r: rand(6, 12),
					life: 1,
					decay: rand(0.011, 0.02),
					ph: rand(0, Math.PI * 2),
				})
			}
			prev = { x, y }
		}

		const draw = (p: Particle): void => {
			const age = 1 - p.life
			const env = Math.min(1, age * 6) * p.life
			const stretch = 1 + Math.min(Math.hypot(p.vx, p.vy) * 0.9, 2.2)
			const s = p.r * 2.4
			ctx.save()
			ctx.translate(p.x, p.y)
			ctx.rotate(Math.atan2(p.vy, p.vx))
			ctx.globalAlpha = env * (light ? 0.55 : 0.42)
			ctx.drawImage(accent, -s * stretch * 0.65, -s / 2, s * stretch, s)
			if (age > 0.12 && age < 0.5) {
				const h = s * 0.5
				ctx.globalAlpha = env * (light ? 0.3 : 0.22)
				ctx.drawImage(hot, -h * stretch * 0.65, -h / 2, h * stretch, h)
			}
			ctx.restore()
		}

		const frame = (): void => {
			ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
			ctx.globalCompositeOperation = light ? 'source-over' : 'lighter'
			if (inside) spawn()
			for (let i = particles.length - 1; i >= 0; i--) {
				const p = particles[i]
				p.ph += 0.09
				p.vx = p.vx * 0.96 + Math.sin(p.ph) * 0.05
				p.vy -= 0.012
				p.x += p.vx
				p.y += p.vy
				p.r *= 0.978
				p.life -= p.decay
				if (p.life <= 0 || p.r < 0.4) {
					particles.splice(i, 1)
					continue
				}
				draw(p)
			}
			raf = inside || particles.length ? requestAnimationFrame(frame) : 0
		}

		const start = (): void => {
			if (!raf && !document.hidden) raf = requestAnimationFrame(frame)
		}

		const onMove = (e: PointerEvent): void => {
			x = e.clientX
			y = e.clientY
			inside = true
			start()
		}
		const onLeave = (): void => {
			inside = false
			prev = null
		}
		const onVisibility = (): void => {
			if (document.hidden) {
				cancelAnimationFrame(raf)
				raf = 0
			} else if (inside || particles.length) start()
		}
		const onTheme = (): void => {
			light = document.documentElement.dataset.theme === 'light'
			accent = makeSprite(cssColour('--accent'))
			hot = makeSprite(cssColour('--flame-hot'))
		}

		resize()
		const themeObserver = new MutationObserver(onTheme)
		themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
		window.addEventListener('pointermove', onMove, { passive: true })
		window.addEventListener('resize', resize)
		document.documentElement.addEventListener('pointerleave', onLeave)
		document.addEventListener('visibilitychange', onVisibility)

		return () => {
			cancelAnimationFrame(raf)
			themeObserver.disconnect()
			window.removeEventListener('pointermove', onMove)
			window.removeEventListener('resize', resize)
			document.documentElement.removeEventListener('pointerleave', onLeave)
			document.removeEventListener('visibilitychange', onVisibility)
		}
	}, [enabled])

	if (!enabled) return null
	return (
		<canvas
			ref={canvasRef}
			aria-hidden="true"
			data-flame-canvas=""
			style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: -1, pointerEvents: 'none' }}
		/>
	)
}
