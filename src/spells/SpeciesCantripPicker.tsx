import type { ReactNode } from 'react'
import { knownSpellNote, knownSpellReason, SPECIES_CANTRIP_PICKER_KEY, type KnownSpell } from './knownSpells'
import type { SpeciesCantripOption } from './speciesCantripData'

/** S2: the species' own cantrip pick (High Elf, Khoravar, Kobold; Draconic Sorcery). The wizard loads the options, so its Next gate and this list never disagree. */
export function SpeciesCantripPicker({
	options,
	value,
	onChange,
	alreadyKnown,
}: {
	options: SpeciesCantripOption[]
	value: { name: string; source: string } | null
	onChange: (cantrip: { name: string; source: string } | null) => void
	alreadyKnown: readonly KnownSpell[]
}): ReactNode {
	return (
		<div className="species-spellcasting-ability-picker">
			<label className="species-spellcasting-ability-picker__field">
				Species cantrip
				<select
					value={value ? `${value.name}|${value.source}` : ''}
					onChange={(event) => {
						const [name, source] = event.target.value.split('|')
						onChange(name && source ? { name, source } : null)
					}}
				>
					<option value="" disabled>
						Choose a cantrip…
					</option>
					{options.map((option) => {
						const known = knownSpellReason(alreadyKnown, option, SPECIES_CANTRIP_PICKER_KEY)
						const isCurrent = value?.name === option.name && value.source === option.source
						return (
							<option key={`${option.name}|${option.source}`} value={`${option.name}|${option.source}`} disabled={!isCurrent && known !== null}>
								{option.name} ({option.classNames.join(', ')}){known !== null ? ` ${knownSpellNote(known)}` : ''}
							</option>
						)
					})}
				</select>
			</label>
			{!options.some((option) => option.name === value?.name && option.source === value.source) && <p className="species-spellcasting-ability-picker__hint">Choose your species cantrip to continue.</p>}
		</div>
	)
}
