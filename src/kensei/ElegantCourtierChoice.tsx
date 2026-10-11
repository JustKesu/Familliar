import type { ReactNode } from 'react'
import type { ElegantCourtierSave } from '../storage/character'

/** D344: shown only when Wisdom saves are already proficient, so Elegant Courtier grants Intelligence or Charisma instead. */
export function ElegantCourtierChoice({ value, onChange }: { value: ElegantCourtierSave | null; onChange: (save: ElegantCourtierSave | null) => void }): ReactNode {
	return (
		<fieldset className="feat-sub-choices">
			<legend>Elegant Courtier (Samurai): already proficient in Wisdom saves — choose another save</legend>
			{(['intelligence', 'charisma'] as const).map((save) => (
				<label key={save}>
					<input type="radio" name="elegant-courtier-save" checked={value === save} onChange={() => onChange(save)} /> {save === 'intelligence' ? 'Intelligence' : 'Charisma'}
				</label>
			))}
		</fieldset>
	)
}
