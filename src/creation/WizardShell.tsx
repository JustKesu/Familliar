import type { ReactNode } from 'react'

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
}: {
	label: string
	onCancel: () => void
	onBack: () => void
	backDisabled: boolean
	primaryLabel: string
	onPrimary: () => void
	primaryDisabled: boolean
	isSave: boolean
}): ReactNode {
	return (
		<div className="wizard__nav" role="group" aria-label={label}>
			<button type="button" className="wizard__cancel" onClick={onCancel}>
				Cancel
			</button>
			<div className="wizard__nav-main">
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
