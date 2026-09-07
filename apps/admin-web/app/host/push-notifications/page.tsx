import Link from 'next/link'
import { getPushDashboard } from './actions'
import { PushDashboard } from './push-dashboard'

export default async function PushNotificationsPage() {
  try {
    const data = await getPushDashboard()
    return <PushDashboard initial={data} />
  } catch (error) {
    return (
      <div className="p-8 space-y-4">
        <h1 className="text-2xl font-bold">Push notifications</h1>
        <p>
          {error instanceof Error
            ? error.message
            : 'Unable to load notifications.'}
        </p>
        <Link href="/host" className="underline">
          Back to dashboard
        </Link>
      </div>
    )
  }
}
