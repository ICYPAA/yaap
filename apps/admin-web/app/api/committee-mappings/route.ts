import { createClient } from "@/utils/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("committee_mappings")
      .select("input_name, mapped_to")
      .order("input_name", { ascending: true })

    if (error) {
      console.error("Error fetching committee mappings:", error)
      return NextResponse.json(
        { error: "Failed to fetch mappings" },
        { status: 500 }
      )
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error("Error in committee mappings API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
