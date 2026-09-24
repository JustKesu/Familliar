import { useEffect, useState, type ReactNode } from 'react'
import { FEATURE_LANGUAGE_TYPES, featureLanguageOptions } from '../languages/classFeatureLanguages'
import { loadLanguages, type LanguageEntry } from '../languages/languageData'
import type { CharacterLanguage, CharacterSubclassSkill } from '../storage/character'
import { toolChoiceOptions } from '../toolProficiencies/classToolChoices'
import { ANY_TOOL_CATEGORIES } from '../toolProficiencies/speciesToolChoices'
import { loadToolCategoryOptions } from '../toolProficiencies/toolProficiencyData'
import { ALL_SKILLS } from './classSkillData'
import type { SubclassSkillGrant } from './subclassSkillGrants'

function capitalize(word: string): string {
	return word.charAt(0).toUpperCase() + word.slice(1)
}

/** Loads once, only while `wanted`; `null` until then. */
function useLoaded<T>(wanted: boolean, load: () => Promise<T>): { value: T | null; error: string | null } {
	const [value, setValue] = useState<T | null>(null)
	const [error, setError] = useState<string | null>(null)
	useEffect(() => {
		if (!wanted) return
		let cancelled = false
		load()
			.then((loaded) => {
				if (!cancelled) setValue(loaded)
			})
			.catch((reason: unknown) => {
				if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason))
			})
		return () => {
			cancelled = true
		}
	}, [wanted])
	return { value, error }
}

/**
 * D177: one select per subclass skill pick. A skill-or-language grant (Cavalier,
 * Samurai) offers both in the same select, so storing one clears the other.
 * `heldSkills` / `knownLanguages` are what the character has elsewhere and are never offered.
 */
export function SubclassSkillSlots({
	grants,
	skills,
	languages,
	heldSkills,
	knownLanguages,
	onChange,
}: {
	grants: readonly SubclassSkillGrant[]
	skills: readonly CharacterSubclassSkill[]
	languages: readonly CharacterLanguage[]
	heldSkills: readonly string[]
	knownLanguages: readonly string[]
	onChange: (skills: CharacterSubclassSkill[], languages: CharacterLanguage[]) => void
}): ReactNode {
	const choiceGrants = grants.flatMap((grant) => (grant.choice ? [{ subclass: grant.subclass, choice: grant.choice }] : []))
	const wantsLanguages = choiceGrants.some((grant) => grant.choice.orLanguage)
	const loaded = useLoaded(wantsLanguages, () => loadLanguages(FEATURE_LANGUAGE_TYPES))

	if (choiceGrants.length === 0) return null
	if (loaded.error) return <p className="error">Could not load languages: {loaded.error}</p>
	if (wantsLanguages && !loaded.value) return <p>Loading languages…</p>

	const takenSkills = new Set([...heldSkills, ...skills.map((pick) => pick.name)])
	const takenLanguages = new Set([...knownLanguages, ...languages.map((language) => language.name)].map((name) => name.toLowerCase()))

	return (
		<ul className="language-picker__list">
			{choiceGrants.map(({ subclass, choice }) => {
				const skill = skills.find((pick) => pick.grantedBy === choice.grantedBy)
				const language = choice.orLanguage ? languages.find((entry) => entry.grantedBy === choice.orLanguage) : undefined
				const value = skill ? `skill:${skill.name}` : language ? `language:${language.name}|${language.source}` : ''
				const choose = (key: string): void => {
					const nextSkills = skills.filter((pick) => pick.grantedBy !== choice.grantedBy)
					const nextLanguages = languages.filter((entry) => entry.grantedBy !== choice.orLanguage)
					if (key.startsWith('skill:')) nextSkills.push({ grantedBy: choice.grantedBy, name: key.slice('skill:'.length) })
					const entry = (loaded.value ?? []).find((candidate: LanguageEntry) => `language:${candidate.name}|${candidate.source}` === key)
					if (entry && choice.orLanguage) nextLanguages.push({ name: entry.name, source: entry.source, grantedBy: choice.orLanguage })
					onChange(nextSkills, nextLanguages)
				}
				const skillOptions = choice.from.filter((name) => name === skill?.name || !takenSkills.has(name))
				return (
					<li key={choice.grantedBy}>
						<label>
							{subclass} skill{choice.orLanguage ? ' or language' : ''}:{' '}
							<select value={value} onChange={(event) => choose(event.target.value)}>
								<option value="">— not chosen —</option>
								<optgroup label="Skill">
									{skillOptions.map((name) => (
										<option key={name} value={`skill:${name}`}>
											{capitalize(name)}
										</option>
									))}
								</optgroup>
								{choice.orLanguage && (
									<optgroup label="Language">
										{featureLanguageOptions(loaded.value ?? [], takenLanguages, language?.name).map((entry) => (
											<option key={`${entry.name}|${entry.source}`} value={`language:${entry.name}|${entry.source}`}>
												{entry.name}
											</option>
										))}
									</optgroup>
								)}
							</select>
						</label>
					</li>
				)
			})}
		</ul>
	)
}

/** D177: Khoravar's one skill or tool, one select; storing one clears the other. */
export function SpeciesSkillOrToolSlot({
	owner,
	skill,
	tool,
	heldSkills,
	heldTools,
	onChange,
}: {
	owner: string
	skill: string | null
	tool: string | null
	heldSkills: readonly string[]
	heldTools: readonly string[]
	onChange: (pick: { skill: string | null; tool: string | null }) => void
}): ReactNode {
	const loaded = useLoaded(true, async () => (await Promise.all(ANY_TOOL_CATEGORIES.map(loadToolCategoryOptions))).flat().sort((a, b) => a.localeCompare(b)))

	if (loaded.error) return <p className="error">Could not load tools: {loaded.error}</p>
	if (!loaded.value) return <p>Loading tools…</p>

	const value = skill ? `skill:${skill}` : tool ? `tool:${tool}` : ''
	const choose = (key: string): void =>
		onChange({ skill: key.startsWith('skill:') ? key.slice('skill:'.length) : null, tool: key.startsWith('tool:') ? key.slice('tool:'.length) : null })

	return (
		<ul className="language-picker__list">
			<li>
				<label>
					{owner} skill or tool:{' '}
					<select value={value} onChange={(event) => choose(event.target.value)}>
						<option value="">— not chosen —</option>
						<optgroup label="Skill">
							{ALL_SKILLS.filter((name) => name === skill || !heldSkills.includes(name)).map((name) => (
								<option key={name} value={`skill:${name}`}>
									{capitalize(name)}
								</option>
							))}
						</optgroup>
						<optgroup label="Tool">
							{toolChoiceOptions(loaded.value, new Set(heldTools.map((name) => name.toLowerCase())), tool ?? undefined).map((name) => (
								<option key={name} value={`tool:${name}`}>
									{name}
								</option>
							))}
						</optgroup>
					</select>
				</label>
			</li>
		</ul>
	)
}
