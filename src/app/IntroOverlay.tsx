import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { parseRoute } from '../navigation/route'
import { T, createSparks, heatTarget, spawnRate } from './introSparks'
import './intro.css'

const PLAYED_KEY = 'familliar:intro-played'
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'
const WORD = 'FAMILLIAR'
const LIST_SLIDE_MS = 1300

let decision: boolean | undefined

/** D312: once per tab, only when the tab opens on the list. Cached per page load so StrictMode's double render cannot flip it. */
function shouldPlay(): boolean {
	if (decision !== undefined) return decision
	decision = false
	try {
		if (window.sessionStorage.getItem(PLAYED_KEY) !== null) return false
		window.sessionStorage.setItem(PLAYED_KEY, '1')
	} catch {
		return false
	}
	// No matchMedia (jsdom) counts as reduced motion, so unit tests never see the intro.
	decision =
		typeof window.matchMedia === 'function' &&
		!window.matchMedia(REDUCED_MOTION).matches &&
		parseRoute(window.location.hash).view === 'list'
	return decision
}

/** Per-frame work lives in refs and DOM classes; the only React update is the final unmount (D116). */
export default function IntroOverlay(): ReactNode {
	const [playing, setPlaying] = useState(shouldPlay)
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const bgRef = useRef<HTMLDivElement>(null)
	const titleRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const canvas = canvasRef.current
		const bg = bgRef.current
		const title = titleRef.current
		const ctx = canvas?.getContext('2d')
		const app = document.getElementById('root')
		if (!canvas || !ctx || !bg || !title || !app) return

		const html = document.documentElement
		const letters = Array.from(title.querySelectorAll<HTMLElement>('.intro__word span'))
		const rule = title.querySelector('.intro__rule')!
		const sub = title.querySelector('.intro__sub')!
		const sparks = createSparks()
		let raf = 0
		let t0 = 0
		let last = 0
		let running = false
		let spawnAcc = 0
		let heat = 0
		let faded = false
		let goneAt = Infinity
		let startTimer = 0
		let listTimer = 0
		let disposed = false

		const fit = (): void => {
			const dpr = Math.min(2, window.devicePixelRatio || 1)
			const W = window.innerWidth
			const H = window.innerHeight
			canvas.width = Math.round(W * dpr)
			canvas.height = Math.round(H * dpr)
			canvas.style.width = `${W}px`
			canvas.style.height = `${H}px`
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
			sparks.resize(W, H)
		}

		const finish = (skip: boolean, now: number): void => {
			faded = true
			for (const el of [bg, title]) {
				el.classList.toggle('intro--skip', skip)
				el.classList.add('intro--out')
			}
			app.inert = false
			html.dataset.intro = 'in'
			listTimer = window.setTimeout(() => delete html.dataset.intro, LIST_SLIDE_MS)
			if (skip) running = false
			goneAt = now + (skip ? 200 : (T.end - T.fade) * 1000)
		}

		const removeListeners = (): void => {
			window.removeEventListener('resize', fit)
			window.removeEventListener('click', skip)
			window.removeEventListener('keydown', skip)
		}

		const frame = (now: number): void => {
			const dt = Math.min(0.05, (now - last) / 1000)
			last = now
			const t = (now - t0) / 1000

			if (running) {
				letters.forEach((l, i) => {
					if (t >= T.letter0 + i * T.step && !l.classList.contains('lit')) {
						l.classList.add('lit')
						sparks.burstAt(l.getBoundingClientRect())
					}
				})
				if (t >= T.rule) rule.classList.add('in')
				if (t >= T.sub) sub.classList.add('in')
				if (t >= T.fade && !faded) finish(false, now)
				spawnAcc += spawnRate(t) * dt
				while (spawnAcc >= 1) {
					spawnAcc -= 1
					sparks.ambient()
				}
				if (t > T.end) running = false
			}

			heat += (heatTarget(t, running) - heat) * Math.min(1, dt * 6)
			sparks.update(dt)
			sparks.draw(ctx, heat)
			if (now >= goneAt) {
				bg.style.display = 'none'
				title.style.display = 'none'
			}
			if (running || sparks.count || heat > 0.01 || now < goneAt) {
				raf = requestAnimationFrame(frame)
			} else {
				raf = 0
				removeListeners()
				setPlaying(false)
			}
		}

		const play = (): void => {
			sparks.readTheme()
			fit()
			running = true
			t0 = last = performance.now()
			raf = requestAnimationFrame(frame)
		}

		function skip(): void {
			if (faded) return
			const now = performance.now()
			finish(true, now)
			if (!raf) {
				window.clearTimeout(startTimer)
				last = now
				raf = requestAnimationFrame(frame)
			}
		}

		app.inert = true
		html.dataset.intro = 'play'
		fit()
		window.addEventListener('resize', fit)
		window.addEventListener('click', skip)
		window.addEventListener('keydown', skip)
		// The preview waits for the fonts plus a beat, so the word never ignites in a fallback face.
		const start = (): void => {
			if (!disposed && !faded) startTimer = window.setTimeout(play, 350)
		}
		document.fonts.ready.then(start, start)

		return () => {
			disposed = true
			cancelAnimationFrame(raf)
			window.clearTimeout(startTimer)
			window.clearTimeout(listTimer)
			removeListeners()
			app.inert = false
			delete html.dataset.intro
		}
	}, [])

	if (!playing) return null
	return createPortal(
		<div className="intro" aria-hidden="true" data-intro-overlay="">
			<div ref={bgRef} className="intro__bg" />
			<canvas ref={canvasRef} className="intro__sparks" />
			<div ref={titleRef} className="intro__title">
				<p className="intro__word">
					{[...WORD].map((letter, i) => (
						<span key={i}>{letter}</span>
					))}
				</p>
				<div className="intro__rule" />
				<div className="intro__sub">Welcome, adventurer</div>
			</div>
		</div>,
		document.body,
	)
}
