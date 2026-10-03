/* Particle field and timeline of the intro (D312), ported from docs/mockups/intro-preview.html. */

export const T = { letter0: 0.5, step: 0.14, rule: 1.8, sub: 1.9, fade: 4.4, end: 5.6 }
const BURST = 16

interface Particle {
	x: number
	y: number
	vx: number
	vy: number
	life: number
	max: number
	r: number
	wob: number
	kind: 0 | 1
	trail: number[]
	tlen: number
}

/** Ambient embers per second at time t: 70→150 over the first second, back to 0 over a second after the fade. */
export function spawnRate(t: number): number {
	return t < T.fade ? 70 + 80 * Math.min(1, t / 1.0) : Math.max(0, 150 * (1 - (t - T.fade) / 1.0))
}

/** Bottom-edge glow level the heat eases towards. */
export function heatTarget(t: number, running: boolean): number {
	if (!running) return 0
	return t < T.fade ? Math.min(1, t / 0.9) : Math.max(0, 1 - (t - T.fade) / 1.2)
}

export function mix(a: number[], b: number[], t: number): string {
	return `${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)}`
}

const triple = (value: string, fallback: string): number[] => (value.trim() || fallback).split(',').map(Number)

export function createSparks() {
	const particles: Particle[] = []
	let W = 0
	let H = 0
	let rgb = '0,244,248'
	let blend: GlobalCompositeOperation = 'lighter'
	let hot = [225, 255, 255]
	let cool = [0, 244, 248]
	let clock = 0
	const glowSprite = document.createElement('canvas')
	glowSprite.width = glowSprite.height = 64

	return {
		get count(): number {
			return particles.length
		},

		readTheme(): void {
			const cs = getComputedStyle(document.documentElement)
			cool = triple(cs.getPropertyValue('--spark'), rgb)
			rgb = cool.join(',')
			blend = (cs.getPropertyValue('--blend').trim() || blend) as GlobalCompositeOperation
			hot = triple(cs.getPropertyValue('--spark-hot'), '225,255,255')
			const g = glowSprite.getContext('2d')
			if (!g) return
			g.clearRect(0, 0, 64, 64)
			const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32)
			rg.addColorStop(0, `rgba(${rgb},0.9)`)
			rg.addColorStop(0.35, `rgba(${rgb},0.28)`)
			rg.addColorStop(1, `rgba(${rgb},0)`)
			g.fillStyle = rg
			g.fillRect(0, 0, 64, 64)
		},

		resize(width: number, height: number): void {
			W = width
			H = height
		},

		ambient(): void {
			const big = Math.random() < 0.12
			const vy = -(45 + Math.random() * (big ? 60 : 130))
			particles.push({
				x: W * (0.5 + (Math.random() - 0.5) * (0.4 + 0.6 * Math.random())),
				y: H + 6,
				vx: (Math.random() - 0.5) * 30,
				vy,
				life: 0,
				max: (H / -vy) * (0.35 + Math.random() * 0.6),
				r: big ? 1.8 + Math.random() * 1.4 : 0.7 + Math.random() * 1.1,
				wob: Math.random() * 6.28,
				kind: 0,
				trail: [],
				tlen: big ? 5 : 8,
			})
		},

		burstAt(a: { left: number; top: number; width: number; height: number }): void {
			const cx = a.left + a.width / 2
			const cy = a.top + a.height * 0.55
			for (let i = 0; i < BURST; i++) {
				const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5
				const sp = 30 + Math.random() * 130
				particles.push({
					x: cx + (Math.random() - 0.5) * a.width * 0.6,
					y: cy + (Math.random() - 0.5) * a.height * 0.4,
					vx: Math.cos(ang) * sp,
					vy: Math.sin(ang) * sp,
					life: 0,
					max: 0.5 + Math.random() * 0.7,
					r: 0.6 + Math.random() * 1.3,
					wob: Math.random() * 6.28,
					kind: 1,
					trail: [],
					tlen: 6,
				})
			}
		},

		update(dt: number): void {
			clock += dt
			for (let i = particles.length - 1; i >= 0; i--) {
				const p = particles[i]
				p.life += dt
				if (p.life >= p.max) {
					particles.splice(i, 1)
					continue
				}
				p.trail.push(p.x, p.y)
				if (p.trail.length > p.tlen * 2) p.trail.splice(0, 2)
				if (p.kind === 0) {
					// Buoyant ember: rises faster as it goes, pushed sideways by swirling heat.
					const swirl = Math.sin(p.y * 0.018 + clock * 2.3 + p.wob) * 55 + Math.sin(p.y * 0.047 - clock * 3.1) * 25
					p.vx += (swirl + (Math.random() - 0.5) * 160) * dt
					p.vx *= Math.pow(0.25, dt)
					p.vy -= 22 * dt
				} else {
					p.vx *= Math.pow(0.08, dt)
					p.vy = p.vy * Math.pow(0.08, dt) - 45 * dt
					p.vx += (Math.random() - 0.5) * 120 * dt
				}
				p.x += p.vx * dt
				p.y += p.vy * dt
			}
		},

		draw(ctx: CanvasRenderingContext2D, level: number): void {
			ctx.clearRect(0, 0, W, H)
			ctx.globalCompositeOperation = blend

			// Heat glow along the bottom edge, flickering like a fire just out of frame.
			if (level > 0.01) {
				const fl = 0.8 + 0.12 * Math.sin(clock * 9) + 0.08 * Math.sin(clock * 23 + 1.3)
				const g = ctx.createLinearGradient(0, H, 0, H * 0.55)
				g.addColorStop(0, `rgba(${rgb},${(0.2 * level * fl).toFixed(3)})`)
				g.addColorStop(0.4, `rgba(${rgb},${(0.06 * level * fl).toFixed(3)})`)
				g.addColorStop(1, `rgba(${rgb},0)`)
				ctx.fillStyle = g
				ctx.fillRect(0, H * 0.55, W, H * 0.45)
			}

			ctx.lineCap = 'round'
			for (const p of particles) {
				const k = 1 - p.life / p.max
				const tw = 0.7 + 0.2 * Math.sin(p.life * 31 + p.wob) + 0.1 * Math.sin(p.life * 57 + p.wob * 2)
				const a = Math.min(1, k * 1.6) * tw
				const col = mix(cool, hot, Math.pow(k, 1.4) * 0.85)

				const tr = p.trail
				const n = tr.length / 2
				for (let j = 1; j < n; j++) {
					const f = j / n
					ctx.strokeStyle = `rgba(${col},${(a * f * 0.45).toFixed(3)})`
					ctx.lineWidth = p.r * (0.35 + 1.1 * f)
					ctx.beginPath()
					ctx.moveTo(tr[(j - 1) * 2], tr[(j - 1) * 2 + 1])
					ctx.lineTo(j === n - 1 ? p.x : tr[j * 2], j === n - 1 ? p.y : tr[j * 2 + 1])
					ctx.stroke()
				}
				const hs = p.r * 9
				ctx.globalAlpha = Math.max(0, a * 0.55)
				ctx.drawImage(glowSprite, p.x - hs / 2, p.y - hs / 2, hs, hs)
				ctx.globalAlpha = 1
				ctx.fillStyle = `rgba(${col},${a.toFixed(3)})`
				ctx.beginPath()
				ctx.arc(p.x, p.y, p.r * 0.9, 0, 6.2832)
				ctx.fill()
			}
			ctx.globalCompositeOperation = 'source-over'
		},
	}
}
