import AsyncStorage from "@react-native-async-storage/async-storage"
import { Program } from "../types/program"
import { withDeviceId } from "./supabase"
import { clearStoredProgram, storeProgramDesign } from "./theme"

export type ConferenceStatus = "none" | "planning" | "active"

export type CurrentConferenceState = {
  status: ConferenceStatus
  currentProgramId: number | null
  program: Program | null
}

const DEFAULT_STATE: CurrentConferenceState = {
  status: "none",
  currentProgramId: null,
  program: null
}

const normalizeProgram = (programs: unknown): Program | null => {
  if (!programs) return null
  if (Array.isArray(programs)) return (programs[0] as Program | undefined) || null
  return programs as Program
}

const normalizeStatus = (status: unknown): ConferenceStatus => {
  if (status === "planning" || status === "active") return status
  return "none"
}

export const fetchAndStoreCurrentConferenceState =
  async (): Promise<CurrentConferenceState> => {
    const supabaseWithDeviceId = await withDeviceId()
    const { data, error } = await supabaseWithDeviceId
      .from("conference_state")
      .select("status,current_program_id,programs(*)")
      .eq("id", true)
      .maybeSingle()

    if (error) {
      throw error
    }

    const status = normalizeStatus(data?.status)
    const program = normalizeProgram(data?.programs)
    const currentProgramId =
      typeof data?.current_program_id === "number" ? data.current_program_id : null

    if (status === "none" || !program) {
      await clearStoredProgram()
      await AsyncStorage.setItem(
        "conference_state",
        JSON.stringify(DEFAULT_STATE)
      )
      return DEFAULT_STATE
    }

    const state: CurrentConferenceState = {
      status,
      currentProgramId: currentProgramId || program.id,
      program
    }

    await storeProgramDesign(program)
    await AsyncStorage.setItem("conference_state", JSON.stringify(state))

    return state
  }

export const getStoredCurrentConferenceState =
  async (): Promise<CurrentConferenceState | null> => {
    try {
      const json = await AsyncStorage.getItem("conference_state")
      return json ? (JSON.parse(json) as CurrentConferenceState) : null
    } catch (error) {
      console.error("Error reading stored conference state:", error)
      return null
    }
  }

export const getCurrentConferenceProgramId = async (): Promise<number | null> => {
  const storedState = await getStoredCurrentConferenceState()
  if (storedState?.status === "active" && storedState.currentProgramId) {
    return storedState.currentProgramId
  }

  const currentState = await fetchAndStoreCurrentConferenceState()
  return currentState.status === "active" ? currentState.currentProgramId : null
}
