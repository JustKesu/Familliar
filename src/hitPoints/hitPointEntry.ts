import { fixedAverage } from '../calculation/maxHitPoints'
import type { CharacterHitPointLevel } from '../storage/character'

/**
 * W20: what the wizard accepts for one level (2 up). Stricter than the stored-data check
 * (describeHitPointLevelsError allows 0) so the wizard never writes what that check would reject.
 * `faces` null = hit die not loaded (or the lookup failed): nothing can be judged, so nothing is valid.
 */
export function isValidHitPointEntry(entry: CharacterHitPointLevel, faces: number | null): boolean {
	if (faces === null || !Number.isInteger(entry.dieResult) || entry.dieResult < 1) return false
	if (entry.kind === 'average') return entry.dieResult === fixedAverage(faces)
	if (entry.kind === 'maximum') return entry.dieResult === faces
	return entry.dieResult <= faces
}
