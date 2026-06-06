import { Metadata } from "next"
import EventCreationForm from "./event-creation-form"
import { getTranslations } from "next-intl/server"
import { getConferenceState } from "@/lib/conference-state"

export const metadata: Metadata = {
  title: "Create Event | Host",
  description: "Create a new event for the current conference"
}

export default async function CreateEventPage() {
  const t = await getTranslations("pages.event-creation-form.CreateEventPage")
  const conferenceState = await getConferenceState()
  const currentProgram = conferenceState.current_program_id
    ? conferenceState.programs
    : null
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8 text-center">{t('title')}</h1>
      <EventCreationForm
        conferenceStartDate={currentProgram?.start_date}
        conferenceEndDate={currentProgram?.end_date}
      />
    </div>
  )
}
