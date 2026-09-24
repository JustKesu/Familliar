import { createContext, useEffect, useState, type MutableRefObject, type ReactNode } from 'react'
import type { RollMode } from './roll'
import type { RollReport } from './RollHistory'

/* D165: the advantage switch is one sheet-wide choice, not one per button. */
export const RollModeContext = createContext<{ mode: RollMode; setMode: (mode: RollMode) => void }>({ mode: 'normal', setMode: () => {} })

/** The nav element the "Rolls" button is portalled into while a sheet is open (D165). */
export const RollsNavSlot = createContext<HTMLElement | null>(null)

const MODE_LABELS: Record<RollMode, string> = { normal: 'Normal', advantage: 'Advantage', disadvantage: 'Disadvantage' }

export function RollModeSwitch({ mode, onChange }: { mode: RollMode; onChange: (mode: RollMode) => void }): ReactNode {
	return (
		<div className="roll-mode" role="group" aria-label="Roll mode">
			{(Object.keys(MODE_LABELS) as RollMode[]).map((option) => (
				<button
					key={option}
					type="button"
					className={option === mode ? 'roll-mode__option roll-mode__option--active' : 'roll-mode__option'}
					aria-pressed={option === mode}
					onClick={() => onChange(option)}
				>
					{MODE_LABELS[option]}
				</button>
			))}
		</div>
	)
}

export const ROLL_TOAST_MS = 6000

/**
 * Owns its own state so the 6-second timer never re-renders the sheet (D116):
 * the sheet only calls `showRef.current`, which sets state in here.
 */
export function RollToast({ showRef }: { showRef: MutableRefObject<((report: RollReport) => void) | null> }): ReactNode {
	const [report, setReport] = useState<RollReport | null>(null)

	useEffect(() => {
		showRef.current = (next) => setReport({ ...next })
		return () => {
			showRef.current = null
		}
	}, [showRef])

	useEffect(() => {
		if (!report) return
		const timer = setTimeout(() => setReport(null), ROLL_TOAST_MS)
		return () => clearTimeout(timer)
	}, [report])

	const detail = report?.detail
	return (
		<div className="roll-toast-region" aria-live="polite">
			{report && (
				<div className="roll-toast">
					<button type="button" className="roll-toast__close" aria-label="Close roll result" onClick={() => setReport(null)}>
						×
					</button>
					<div className="roll-toast__label">{report.label}</div>
					{detail ? (
						<>
							<div className="roll-toast__dice">
								{detail.dice.map((die, index) => (
									<span key={index} className={index === detail.keptIndex || detail.keptIndex === null ? 'roll-toast__die' : 'roll-toast__die roll-toast__die--unused'}>
										{die}
									</span>
								))}
							</div>
							<div className="roll-toast__sum">
								{detail.total - detail.modifier} {detail.modifier < 0 ? '−' : '+'} {Math.abs(detail.modifier)} = <span className="roll-toast__total">{detail.total}</span>
							</div>
						</>
					) : (
						<div className="roll-toast__sum">{report.text}</div>
					)}
				</div>
			)}
		</div>
	)
}
