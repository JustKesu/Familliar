import { useId, type ReactNode } from 'react'
import { usePortraitUpload } from './usePortraitUpload'

/** W31: the optional portrait square left of the Character name field (`children`), one row. */
export function WizardPortrait({ portrait, onChange, children }: { portrait?: string; onChange: (portrait: string | null) => void; children: ReactNode }): ReactNode {
	const labelId = useId()
	const upload = usePortraitUpload(onChange)

	return (
		<>
			<div className="wizard-portrait__row">
				<div className="wizard-portrait">
					<button type="button" className="wizard-portrait__square" aria-labelledby={labelId} onClick={upload.choose}>
						{portrait ? <img src={portrait} alt="" /> : <span className="wizard-portrait__plus" aria-hidden="true">+</span>}
					</button>
					<span id={labelId} className="wizard-portrait__label">
						Portrait (optional)
					</span>
					{portrait && (
						<button
							type="button"
							className="wizard-portrait__remove"
							onClick={() => {
								upload.clearError()
								onChange(null)
							}}
						>
							Remove
						</button>
					)}
				</div>
				{children}
			</div>
			{upload.error && <p className="error">{upload.error}</p>}
			{upload.elements}
		</>
	)
}
