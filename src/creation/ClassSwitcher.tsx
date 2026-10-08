import type { ReactNode } from 'react'
import type { CharacterClass } from '../storage/character'

/** D333: step Class of a multiclass Edit — one tab per held class; the pressed one is the class whose picks are shown. */
export function ClassSwitcher({
	classes,
	active,
	onSwitch,
}: {
	classes: readonly CharacterClass[]
	active: { className: string; classSource: string }
	onSwitch: (to: { className: string; classSource: string }) => void
}): ReactNode {
	return (
		<div className="wizard__field">
			<div className="class-switcher" role="group" aria-label="Class to edit">
				{classes.map((entry) => {
					const pressed = entry.className === active.className && entry.classSource === active.classSource
					return (
						<button
							key={`${entry.className}|${entry.classSource}`}
							type="button"
							className="class-switcher__tab"
							aria-pressed={pressed}
							onClick={() => {
								if (!pressed) onSwitch({ className: entry.className, classSource: entry.classSource })
							}}
						>
							{entry.className} {entry.level}
							{entry.subclass ? ` (${entry.subclass})` : ''}
						</button>
					)
				})}
			</div>
			<p className="class-switcher__hint">Classes and their levels stay as they are. Switch class to change its own choices; changes to the other classes are kept.</p>
		</div>
	)
}
