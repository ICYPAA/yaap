import { Metadata } from "next"
import EventCreationForm from "./event-creation-form"
import { useTranslations } from 'next-intl';

export const metadata: Metadata = {
  title: "Create Event | 65th ICYPAA",
  description:
    "Create a new event for the 65th International Conference of Young People in AA"
}

export default function CreateEventPage() {
  const t = useTranslations('pages.event-creation-form.CreateEventPage');
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8 text-center">{t('title')}</h1>
      <EventCreationForm />
    </div>
  )
}
