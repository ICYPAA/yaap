"use server"

import { hasPermission } from "@/utils/permissions"
import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export type ConferenceStatus = "none" | "planning" | "active"

export interface ConferenceState {
  id: boolean
  current_program_id: number | null
  status: ConferenceStatus
  updated_at: string
  updated_by: string | null
  programs?: any | null
}

export async function getConferenceState(): Promise<ConferenceState> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("conference_state")
    .select("*, programs(*)")
    .eq("id", true)
    .maybeSingle()

  if (error) {
    console.error("Error fetching conference state:", error)
  }

  return (
    data || {
      id: true,
      current_program_id: null,
      status: "none",
      updated_at: new Date().toISOString(),
      updated_by: null,
      programs: null
    }
  )
}

export async function getCurrentProgramOrNull() {
  const state = await getConferenceState()
  return state.current_program_id ? state.programs || null : null
}

export async function setConferenceState(input: {
  status: ConferenceStatus
  currentProgramId: number | null
}) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  const canEdit = await hasPermission(
    user.id,
    ["admin", "steering"],
    ["program:edit"]
  )

  if (!canEdit) {
    return { state: null, error: "Insufficient permissions" }
  }

  const status = input.status
  const currentProgramId = status === "none" ? null : input.currentProgramId

  if (status !== "none" && !currentProgramId) {
    return { state: null, error: "Select a program for planning or active status" }
  }

  const { data, error } = await supabase
    .from("conference_state")
    .update({
      status,
      current_program_id: currentProgramId,
      updated_at: new Date().toISOString(),
      updated_by: user.id
    })
    .eq("id", true)
    .select("*, programs(*)")
    .single()

  if (error) {
    console.error("Error updating conference state:", error)
    return { state: null, error: error.message }
  }

  revalidatePath("/host/program-management")
  revalidatePath("/host/shift-scheduling")
  revalidatePath("/host")

  return { state: data, error: null }
}
