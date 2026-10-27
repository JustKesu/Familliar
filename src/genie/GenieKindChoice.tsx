import type { ReactNode } from 'react'
import { GENIE_KINDS, type GenieKind } from '../storage/character'

export function GenieKindChoice({ value, onChange }: { value: GenieKind | null; onChange: (kind: GenieKind) => void }): ReactNode {
	return (
		<fieldset className="feat-sub-choices">
			<legend>Genie Kind (The Genie): choose your patron's kind</legend>
			{GENIE_KINDS.map((kind) => (
				<label key={kind}>
					<input type="radio" name="genie-kind" checked={value === kind} onChange={() => onChange(kind)} /> {kind}
				</label>
			))}
		</fieldset>
	)
}
