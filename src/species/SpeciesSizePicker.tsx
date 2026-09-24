import type { ReactNode } from 'react'

const SIZE_NAMES: Record<string, string> = { T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large' }

/** D175: the size a species that offers several is played as. Renders nothing for a species with one size. */
export function SpeciesSizePicker({ options, value, onChange }: { options: readonly string[]; value: string | null; onChange: (size: string) => void }): ReactNode {
	if (options.length < 2) return null
	return (
		<div className="species-skill-picker">
			<p className="species-skill-picker__remaining">Choose a size.</p>
			<ul className="species-skill-picker__list">
				{options.map((size) => (
					<li key={size} className="species-skill-picker__item">
						<label>
							<input type="radio" name="species-size" checked={value === size} onChange={() => onChange(size)} />
							{SIZE_NAMES[size] ?? size}
						</label>
					</li>
				))}
			</ul>
		</div>
	)
}
