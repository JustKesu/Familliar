import { useEffect, useState, type ReactNode } from 'react'
import type { CharacterLanguage } from '../storage/character'
import { FEATURE_LANGUAGE_TYPES, type ClassFeatureLanguageGrant } from './classFeatureLanguages'
import { loadLanguages, type LanguageEntry } from './languageData'

/**
 * One select per free language a class feature grants (D172). `value` holds
 * every class-feature pick; `known` names the languages the character has
 * from anywhere else, which are never offered.
 */
export function FeatureLanguageSlots({
	grants,
	value,
	known,
	onChange,
}: {
	grants: readonly ClassFeatureLanguageGrant[]
	value: readonly CharacterLanguage[]
	known: readonly string[]
	onChange: (languages: CharacterLanguage[]) => void
}): ReactNode {
	const [languages, setLanguages] = useState<LanguageEntry[] | null>(null)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false
		loadLanguages(FEATURE_LANGUAGE_TYPES)
			.then((loaded) => {
				if (!cancelled) setLanguages(loaded)
			})
			.catch((reason: unknown) => {
				if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason))
			})
		return () => {
			cancelled = true
		}
	}, [])

	const choiceGrants = grants.flatMap((grant) => (grant.choice ? [{ ...grant, choice: grant.choice }] : []))
	if (choiceGrants.length === 0) return null
	if (error) return <p className="error">Could not load languages: {error}</p>
	if (!languages) return <p>Loading languages…</p>

	const taken = new Set([...known, ...value.map((language) => language.name)].map((name) => name.toLowerCase()))

	return (
		<ul className="language-picker__list">
			{choiceGrants.flatMap(({ featureName, choice }) => {
				const picks = value.filter((language) => language.grantedBy === choice.grantedBy)
				const choose = (slot: number, key: string): void => {
					const entry = languages.find((language) => `${language.name}|${language.source}` === key)
					const next: (CharacterLanguage | undefined)[] = [...picks]
					next[slot] = entry ? { ...entry, grantedBy: choice.grantedBy } : undefined
					onChange([...value.filter((language) => language.grantedBy !== choice.grantedBy), ...next.filter((pick) => pick !== undefined)])
				}
				return Array.from({ length: choice.count }, (_, slot) => {
					const current = picks[slot]
					const options = languages.filter((language) => language.name === current?.name || !taken.has(language.name.toLowerCase()))
					return (
						<li key={`${choice.grantedBy}:${slot}`}>
							<label>
								{featureName} language{choice.count > 1 ? ` ${slot + 1}` : ''}:{' '}
								<select value={current ? `${current.name}|${current.source}` : ''} onChange={(event) => choose(slot, event.target.value)}>
									<option value="">— not chosen —</option>
									{options.map((language) => (
										<option key={`${language.name}|${language.source}`} value={`${language.name}|${language.source}`}>
											{language.name}
										</option>
									))}
								</select>
							</label>
						</li>
					)
				})
			})}
		</ul>
	)
}
