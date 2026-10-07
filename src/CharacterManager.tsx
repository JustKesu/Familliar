import { useEffect, useState } from 'react'
import { CharacterList } from './characters/CharacterList'
import { CharacterStore, type CharacterTextField, type HitPointFields, type RestFields } from './storage/characterStore'
import { StorageError } from './storage/errors'
import type {
	AbilityIncreaseMap,
	Character,
	CharacterFamiliar,
	CharacterInventoryItem,
	CharacterLanguage,
	CharacterSpellChoice,
	CharacterToolChoice,
	CharacterWildShapeForms,
	ConcentrationRef,
	FeatChoiceDetails,
	SpentSpellSlots,
} from './storage/character'
import type { FeatInstanceKey, FeatRef } from './featAsi/featInstances'
import { CharacterWizard } from './creation/CharacterWizard'
import { CharacterSheet } from './sheet/CharacterSheet'
import { LevelUpWizardGate } from './levelUp/LevelUpWizardGate'
import { characterUpdateInput } from './levelUp/levelRemoval'
import { currentHpAfterMaxHpChange } from './calculation/maxHitPoints'
import { loadCharacterMaxHp } from './hitPoints/hpDefault'
import { isMulticlass } from './calculation/characterLevel'
import type { CharacterRoute } from './navigation/route'
import type { Navigate } from './navigation/useRoute'

/*
 * Routes a character to the list, the sheet or a wizard and owns the store
 * handlers; the list itself lives in characters/CharacterList.tsx (D308).
 *
 * Rework R1b (D145, D151): the list, the sheet and the wizard are separate
 * views selected by `route`, never rendered together. `route` and `navigate`
 * come from the one `useRoute` hook at App level.
 */

function describeError(error: unknown): string {
	if (error instanceof StorageError) return error.message
	return error instanceof Error ? error.message : String(error)
}

function download(filename: string, contents: string): void {
	const blob = new Blob([contents], { type: 'application/json' })
	const url = URL.createObjectURL(blob)
	const link = document.createElement('a')
	link.href = url
	link.download = filename
	link.click()
	URL.revokeObjectURL(url)
}

function CharacterManager({ route, navigate }: { route: CharacterRoute; navigate: Navigate }) {
	const [store] = useState(() => {
		try {
			return { store: new CharacterStore(), error: null as string | null }
		} catch (error) {
			return { store: null, error: describeError(error) }
		}
	})

	const [characters, setCharacters] = useState<Character[]>([])
	/** Set once `refresh` has run at least once — guards the route-validation effect below against the initial render, where `characters` is still `[]` and a valid id would otherwise look unknown (see R1b report). */
	const [charactersLoaded, setCharactersLoaded] = useState(false)
	const [loadError, setLoadError] = useState<string | null>(null)
	const [actionError, setActionError] = useState<string | null>(null)

	function refresh(): void {
		if (!store.store) return
		try {
			setCharacters(store.store.list())
			setLoadError(null)
		} catch (error) {
			setLoadError(describeError(error))
		} finally {
			setCharactersLoaded(true)
		}
	}

	useEffect(refresh, [store])

	/* Unknown/invalid id, or one that stopped existing (the character whose sheet/wizard was open got deleted) — back to the list, replacing rather than pushing (build order brief, R1b table). */
	useEffect(() => {
		if (!charactersLoaded) return
		if (route.view !== 'sheet' && route.view !== 'edit' && route.view !== 'level-up') return
		if (characters.some((character) => character.id === route.id)) return
		navigate({ view: 'list' }, { replace: true })
	}, [charactersLoaded, route, characters, navigate])

	function withErrorHandling(action: () => void): void {
		try {
			action()
			setActionError(null)
			refresh()
		} catch (error) {
			setActionError(describeError(error))
		}
	}

	function handleWizardSaved(character: Character): void {
		refresh()
		navigate({ view: 'sheet', id: character.id }, { replace: true })
	}

	function handleRename(id: string, name: string): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.rename(id, name))
	}

	function handleChooseFamiliar(id: string, familiar: CharacterFamiliar | null): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.setFamiliar(id, familiar))
	}

	function handleEditFamiliarHitPoints(id: string, hitPoints: { currentHp?: number; temporaryHitPoints?: number }): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.setFamiliarHitPoints(id, hitPoints))
	}

	function handleEditWildShapeForms(id: string, wildShapeForms: CharacterWildShapeForms[]): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.setWildShapeForms(id, wildShapeForms))
	}

	function handleEditInventory(id: string, inventory: CharacterInventoryItem[]): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.setInventory(id, inventory))
	}

	function handleEditCurrency(id: string, copper: number): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.setCurrency(id, copper))
	}

	function handleEditHitPoints(id: string, hitPoints: HitPointFields): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.setHitPoints(id, hitPoints))
	}

	function handleEditResourceUses(id: string, resourceUses: Record<string, number> | undefined): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.setResourceUses(id, resourceUses))
	}

	function handleEditSpentSpellSlots(id: string, spentSpellSlots: SpentSpellSlots | undefined): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.setSpentSpellSlots(id, spentSpellSlots))
	}

	function handleEditSpentHitDice(id: string, spentHitDice: Record<string, number> | undefined): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.setSpentHitDice(id, spentHitDice))
	}

	function handleEditConcentration(id: string, spell: ConcentrationRef | null): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.setConcentration(id, spell))
	}

	function handleEditHeroicInspiration(id: string, on: boolean): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.setHeroicInspiration(id, on))
	}

	function handleEditConditions(id: string, conditions: string[]): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.setConditions(id, conditions))
	}

	function handleEditExhaustion(id: string, level: number): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.setExhaustion(id, level))
	}

	function handleAddManualFeat(id: string, feat: { name: string; source: string }): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.addManualFeat(id, feat))
	}

	function handleRemoveManualFeat(id: string, key: string): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.removeManualFeat(id, key))
	}

	function handleEditFeatChoice(id: string, key: FeatInstanceKey, feat: FeatRef, details: FeatChoiceDetails): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.setFeatChoiceDetails(id, key, feat, details))
	}

	function handleEditAsiIncreases(id: string, level: number, increases: AbilityIncreaseMap): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.setAsiIncreases(id, level, increases))
	}

	function handleEditLanguages(id: string, languages: CharacterLanguage[]): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.setLanguages(id, languages))
	}

	function handleEditToolChoices(id: string, toolChoices: CharacterToolChoice[]): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.setToolChoices(id, toolChoices))
	}

	function handleEditSpellChoices(id: string, spellChoices: CharacterSpellChoice[]): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.setSpellChoices(id, spellChoices))
	}

	function handleEditText(id: string, field: CharacterTextField, text: string): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.setText(id, field, text))
	}

	function handleEditPortrait(id: string, portrait: string | null): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.setPortrait(id, portrait))
	}

	function handleRest(id: string, rest: RestFields): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.applyRest(id, rest))
	}

	function handleDelete(id: string): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.delete(id))
	}

	function handleExport(id: string): void {
		if (!store.store) return
		try {
			const json = store.store.exportCharacter(id)
			const character = characters.find((c) => c.id === id)
			const filename = `${character?.name ?? 'character'}.json`.replace(/[\\/:*?"<>|]/g, '_')
			download(filename, json)
			setActionError(null)
		} catch (error) {
			setActionError(describeError(error))
		}
	}

	function handleImportFile(file: File): void {
		if (!store.store) return
		file
			.text()
			.then((text) => {
				withErrorHandling(() => store.store?.import(text))
			})
			.catch((error: unknown) => {
				setActionError(describeError(error))
			})
	}

	if (!store.store) {
		return (
			<main>
				<p className="error">Storage unavailable: {store.error}</p>
			</main>
		)
	}
	const characterStore = store.store

	if (route.view === 'list') {
		return (
			<CharacterList
				characters={characters}
				loadError={loadError}
				actionError={actionError}
				onNew={() => navigate({ view: 'new' })}
				onOpen={(id) => navigate({ view: 'sheet', id })}
				onRename={handleRename}
				onExport={handleExport}
				onDelete={handleDelete}
				onImportFile={handleImportFile}
			/>
		)
	}

	if (route.view === 'new') {
		return (
			<main>
				{actionError && <p className="error">{actionError}</p>}
				<div className="char-create">
					<CharacterWizard store={characterStore} onSaved={handleWizardSaved} onCancel={() => navigate({ view: 'list' }, { replace: true })} />
				</div>
			</main>
		)
	}

	/* sheet / edit / level-up all need the character; while it is missing (route just arrived or is about to be redirected by the effect above), render nothing rather than a view for a character that is not there. */
	const character = characters.find((c) => c.id === route.id)
	if (!character) return null

	if (route.view === 'sheet') {
		return (
			<main className="sheet-view">
				{actionError && <p className="error">{actionError}</p>}
				<CharacterSheet
					character={character}
					onChooseFamiliar={(familiar) => handleChooseFamiliar(character.id, familiar)}
					onEditFamiliarHitPoints={(hitPoints) => handleEditFamiliarHitPoints(character.id, hitPoints)}
					onEditWildShapeForms={(forms) => handleEditWildShapeForms(character.id, forms)}
					onEditInventory={(inventory) => handleEditInventory(character.id, inventory)}
					onEditCurrency={(copper) => handleEditCurrency(character.id, copper)}
					onEditHitPoints={(hitPoints) => handleEditHitPoints(character.id, hitPoints)}
					onEditResourceUses={(resourceUses) => handleEditResourceUses(character.id, resourceUses)}
					onEditSpentSpellSlots={(spentSpellSlots) => handleEditSpentSpellSlots(character.id, spentSpellSlots)}
					onEditSpentHitDice={(spentHitDice) => handleEditSpentHitDice(character.id, spentHitDice)}
					onEditConcentration={(spell) => handleEditConcentration(character.id, spell)}
					onEditHeroicInspiration={(on) => handleEditHeroicInspiration(character.id, on)}
						onEditConditions={(conditions) => handleEditConditions(character.id, conditions)}
						onEditExhaustion={(level) => handleEditExhaustion(character.id, level)}
					onAddManualFeat={(feat) => handleAddManualFeat(character.id, feat)}
					onRemoveManualFeat={(key) => handleRemoveManualFeat(character.id, key)}
					onEditFeatChoice={(key, feat, details) => handleEditFeatChoice(character.id, key, feat, details)}
					onEditAsiIncreases={(level, increases) => handleEditAsiIncreases(character.id, level, increases)}
					onEditLanguages={(languages) => handleEditLanguages(character.id, languages)}
					onEditToolChoices={(toolChoices) => handleEditToolChoices(character.id, toolChoices)}
					onEditSpellChoices={(spellChoices) => handleEditSpellChoices(character.id, spellChoices)}
						onEditText={(field, text) => handleEditText(character.id, field, text)}
					onRest={(rest) => handleRest(character.id, rest)}
					onEditPortrait={(portrait) => handleEditPortrait(character.id, portrait)}
					onEditCharacter={() => navigate({ view: 'edit', id: character.id })}
					onLevelUp={(gains) =>
						navigate(
							// D330: a class entered (class level 1) is named in the route too.
							isMulticlass(character.classes) || gains.classLevel === 1
								? { view: 'level-up', id: character.id, levelClass: { className: gains.className, classSource: gains.classSource } }
								: { view: 'level-up', id: character.id },
						)
					}
					onRemoveLevel={(result) => {
						/* D107: currentHp drops by the same amount maxHp drops, only when it was already set. */
						if (character.currentHp === undefined) {
							withErrorHandling(() => store.store?.update(result.id, characterUpdateInput(result)))
							return
						}
						Promise.all([loadCharacterMaxHp(character), loadCharacterMaxHp(result)])
							.then(([before, after]) => {
								const currentHp = currentHpAfterMaxHpChange(character.currentHp, before, after)
								const adjusted = currentHp !== undefined ? { ...result, currentHp } : result
								withErrorHandling(() => store.store?.update(adjusted.id, characterUpdateInput(adjusted)))
							})
							.catch(() => withErrorHandling(() => store.store?.update(result.id, characterUpdateInput(result))))
					}}
				/>
			</main>
		)
	}

	if (route.view === 'edit') {
		if (isMulticlass(character.classes)) {
			return <BounceToSheet onBounce={() => navigate({ view: 'sheet', id: character.id }, { replace: true })} />
		}
		return (
			<main>
				{actionError && <p className="error">{actionError}</p>}
				<div className="char-create">
					<CharacterWizard
						store={characterStore}
						character={character}
						onSaved={handleWizardSaved}
						/* Nothing has been written at this point — the stored character is untouched. */
						onCancel={() => navigate({ view: 'sheet', id: character.id }, { replace: true })}
					/>
				</div>
			</main>
		)
	}

	return (
		<main>
			{actionError && <p className="error">{actionError}</p>}
			<div className="char-create">
				<LevelUpWizardGate
					store={characterStore}
					character={character}
					levelClass={route.levelClass}
					onSaved={handleWizardSaved}
					onCancel={() => navigate({ view: 'sheet', id: character.id }, { replace: true })}
					onUnavailable={() => navigate({ view: 'sheet', id: character.id }, { replace: true })}
				/>
			</div>
		</main>
	)
}

/** D316: a typed #/edit/<id> for a multiclass character never shows the wizard. */
function BounceToSheet({ onBounce }: { onBounce: () => void }): null {
	useEffect(onBounce, [onBounce])
	return null
}

export default CharacterManager
