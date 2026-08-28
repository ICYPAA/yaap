import { Program } from "../types/program"

export const resolveProgramDetails = (
  queriedProgram: Program | null | undefined,
  currentConferenceProgram: Program | null | undefined,
  programId: number | null
): Program | null => {
  if (queriedProgram?.id === programId) return queriedProgram
  if (currentConferenceProgram?.id === programId) {
    return currentConferenceProgram
  }
  return null
}
