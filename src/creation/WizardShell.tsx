import { useEffect, useRef, useState, type ReactNode } from 'react'

export interface WizardStepItem {
	key: string
	label: string
	current: boolean
	reachable: boolean
}

/** W8/W9: the horizontal step bar; a reachable step is a button, the rest are disabled. */
export function WizardStepList({ steps, onGoTo }: { steps: WizardStepItem[]; onGoTo: (key: string) => void }): ReactNode {
	return (
		<nav className="wizard__steps-nav" aria-label="Wizard steps">
			<ol className="wizard__steps">
				{steps.map((step, index) => (
					<li key={step.key}>
						<button
							type="button"
							className={step.current ? 'wizard__step wizard__step--active' : 'wizard__step'}
							aria-current={step.current ? 'step' : undefined}
							disabled={!step.reachable}
							onClick={() => onGoTo(step.key)}
						>
							{index + 1}. {step.label}
						</button>
					</li>
				))}
			</ol>
		</nav>
	)
}

/** D430: the phone bar — one row "i / n · Label" that opens the step list and Cancel as a dropdown. */
export function WizardMobileStepBar({ steps, onGoTo, onCancel }: { steps: WizardStepItem[]; onGoTo: (key: string) => void; onCancel: () => void }): ReactNode {
	const [open, setOpen] = useState(false)
	const rootRef = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (!open) return
		const close = (event: PointerEvent): void => {
			if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
		}
		const escape = (event: KeyboardEvent): void => {
			if (event.key === 'Escape') setOpen(false)
		}
		document.addEventListener('pointerdown', close)
		document.addEventListener('keydown', escape)
		return () => {
			document.removeEventListener('pointerdown', close)
			document.removeEventListener('keydown', escape)
		}
	}, [open])
	const index = steps.findIndex((step) => step.current)
	const current = steps[index]
	return (
		<div className="wizard__mobile-bar" ref={rootRef}>
			<button type="button" className="wizard__step-toggle" aria-expanded={open} aria-controls="wizard-step-panel" onClick={() => setOpen(!open)}>
				<span>
					{index + 1} / {steps.length} · {current?.label}
				</span>
				<span className="wizard__step-chevron" aria-hidden="true">
					{open ? '▴' : '▾'}
				</span>
			</button>
			<div className="wizard__progress" aria-hidden="true">
				<span style={{ width: `${((index + 1) / Math.max(steps.length, 1)) * 100}%` }} />
			</div>
			<div id="wizard-step-panel" className={open ? 'wizard__step-panel' : 'wizard__step-panel wizard__step-panel--closed'}>
				<WizardStepList
					steps={steps}
					onGoTo={(key) => {
						setOpen(false)
						onGoTo(key)
					}}
				/>
				<button
					type="button"
					className="wizard__cancel"
					onClick={() => {
						setOpen(false)
						onCancel()
					}}
				>
					Cancel
				</button>
			</div>
		</div>
	)
}

/** W10: Cancel apart from Back/Next so it is hard to hit instead of the save; rendered in the bar and under the step. */
export function WizardNavButtons({
	label,
	onCancel,
	onBack,
	backDisabled,
	primaryLabel,
	onPrimary,
	primaryDisabled,
	isSave,
	note = null,
}: {
	label: string
	onCancel: () => void
	onBack: () => void
	backDisabled: boolean
	primaryLabel: string
	onPrimary: () => void
	primaryDisabled: boolean
	isSave: boolean
	/** Why the primary button is disabled, shown beside it; null shows nothing. */
	note?: string | null
}): ReactNode {
	return (
		<div className="wizard__nav" role="group" aria-label={label}>
			<button type="button" className="wizard__cancel" onClick={onCancel}>
				Cancel
			</button>
			<div className="wizard__nav-main">
				{note !== null && <p className="wizard__nav-note">{note}</p>}
				<button type="button" className="btn--accent-outline" onClick={onBack} disabled={backDisabled}>
					Back
				</button>
				<button type="button" className={isSave ? 'btn--accent wizard__save' : 'btn--accent'} onClick={onPrimary} disabled={primaryDisabled}>
					{primaryLabel}
				</button>
			</div>
		</div>
	)
}
