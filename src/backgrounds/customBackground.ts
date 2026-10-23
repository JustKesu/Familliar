import type { StartingEquipmentOffer } from '../inventory/startingEquipmentData'
import { CUSTOM_BACKGROUND_SOURCE } from '../storage/character'
import type { BackgroundEntry, BackgroundToolProficiency } from './backgroundData'
import type { BackgroundChoice } from './BackgroundPicker'

/** Not a data key: the tool category of a custom background's pick, which toolProficiencyData.ts resolves. */
export const ANY_PHB_TOOL = 'anyPhbTool'

/** D383: a custom background's equipment is 50 GP only. */
export const CUSTOM_BACKGROUND_EQUIPMENT: StartingEquipmentOffer = {
	options: [{ key: 'A', label: 'Option A', elements: [{ kind: 'coins', copper: 5000, label: '50 gp' }] }],
}

// One object for every render: ToolProficiencyPicker reloads whenever its toolProficiency changes identity.
const CUSTOM_TOOL_PROFICIENCY: BackgroundToolProficiency = { kind: 'category', category: ANY_PHB_TOOL, label: 'any tool' }

/**
 * D383: the BackgroundEntry a choice stands for — a backgrounds.json entry, or one built from a custom
 * background's picks. Until those picks are complete the tuples are short; the step's gate waits for them.
 */
export function resolveBackgroundEntry(choice: BackgroundChoice | null, backgrounds: readonly BackgroundEntry[]): BackgroundEntry | undefined {
	if (!choice) return undefined
	if (choice.source !== CUSTOM_BACKGROUND_SOURCE) return backgrounds.find((b) => b.name === choice.name && b.source === choice.source)
	return {
		name: choice.name,
		source: CUSTOM_BACKGROUND_SOURCE,
		abilityChoices: (choice.custom?.abilityChoices ?? []) as BackgroundEntry['abilityChoices'],
		skillProficiencies: (choice.custom?.skills ?? []) as BackgroundEntry['skillProficiencies'],
		toolProficiency: CUSTOM_TOOL_PROFICIENCY,
		originFeat: null,
		startingEquipment: CUSTOM_BACKGROUND_EQUIPMENT,
	}
}

/** D383: a custom background has a name, two skills and three distinct abilities. */
export function isCustomBackgroundComplete(choice: BackgroundChoice): boolean {
	return choice.name.trim() !== '' && choice.custom?.skills.length === 2 && new Set(choice.custom.abilityChoices).size === 3
}
