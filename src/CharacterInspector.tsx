import type { ReactNode } from 'react'
import type { Character } from './storage/character'
import { ABILITIES } from './abilities/abilityScores'

/*
 * TEMPORARY SCAFFOLDING — a debugging aid, not a feature.
 *
 * Shows exactly what is stored on a `Character` record, with nothing
 * hidden, calculated, or derived. This is NOT the character sheet
 * (PHASE1.md build order step 5) — no modifiers, no proficiency bonus,
 * no formatting decisions beyond "not set" for absent fields. Thrown away
 * once the real sheet exists.
 */

const ABILITY_LABELS: Record<(typeof ABILITIES)[number], string> = {
	strength: 'Strength',
	dexterity: 'Dexterity',
	constitution: 'Constitution',
	intelligence: 'Intelligence',
	wisdom: 'Wisdom',
	charisma: 'Charisma',
}

function NotSet(): ReactNode {
	return <em>not set</em>
}

export function CharacterInspector({ character }: { character: Character | null }): ReactNode {
	if (!character) {
		return (
			<aside className="inspector">
				<h2>Inspect</h2>
				<p>Select a character to see its stored contents.</p>
			</aside>
		)
	}

	return (
		<aside className="inspector">
			<h2>Inspect: {character.name}</h2>

			<dl className="inspector__fields">
				<dt>id</dt>
				<dd>{character.id}</dd>

				<dt>name</dt>
				<dd>{character.name}</dd>

				<dt>classes</dt>
				<dd>
					{character.classes.length === 0 ? (
						<NotSet />
					) : (
						<ul className="inspector__classes">
							{character.classes.map((c, index) => (
								<li key={index}>
									className: {c.className}; source: {c.classSource}; subclass:{' '}
									{c.subclass === null ? <NotSet /> : c.subclass}; level: {c.level}
								</li>
							))}
						</ul>
					)}
				</dd>

				<dt>species</dt>
				<dd>
					{!character.species ? (
						<NotSet />
					) : (
						<span>
							name: {character.species.name}; source: {character.species.source}
						</span>
					)}
				</dd>

				<dt>abilityScores</dt>
				<dd>
					{!character.abilityScores ? (
						<NotSet />
					) : (
						<>
							<p>method: {character.abilityScores.method}</p>
							<ul className="inspector__scores">
								{ABILITIES.map((ability) => (
									<li key={ability}>
										{ABILITY_LABELS[ability]}: {character.abilityScores!.scores[ability]}
									</li>
								))}
							</ul>
							{character.abilityScores.rolledSets ? (
								<>
									<p>rolled sets (as stored, in roll order):</p>
									<ul className="inspector__rolls">
										{character.abilityScores.rolledSets.map((set, index) => (
											<li key={index}>
												Set {index + 1}: [{set.dice.join(', ')}] → {set.total}
											</li>
										))}
									</ul>
								</>
							) : (
								<p>rolled sets: <NotSet /></p>
							)}
						</>
					)}
				</dd>

				<dt>background</dt>
				<dd>
					{!character.background ? (
						<NotSet />
					) : (
						<span>
							name: {character.background.name}; source: {character.background.source}
						</span>
					)}
				</dd>

				<dt>abilityBonus</dt>
				<dd>
					{!character.abilityBonus ? (
						<NotSet />
					) : (
						<ul className="inspector__ability-bonus">
							{Object.entries(character.abilityBonus).map(([ability, amount]) => (
								<li key={ability}>
									{ABILITY_LABELS[ability as keyof typeof ABILITY_LABELS]}: +{amount}
								</li>
							))}
						</ul>
					)}
				</dd>

				<dt>languages</dt>
				<dd>
					{!character.languages ? (
						<NotSet />
					) : (
						<span>
							Common (automatic),{' '}
							{character.languages.map((l) => `${l.name} (${l.source})`).join(', ')}
						</span>
					)}
				</dd>
			</dl>
		</aside>
	)
}

export default CharacterInspector
