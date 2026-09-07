import Link from 'next/link'
import { getPushDashboard } from '../../host/push-notifications/actions'
import { PushDashboard } from '../../host/push-notifications/push-dashboard'

export default async function PushDiagnosticsPage() {
  try {
    const data = await getPushDashboard(true)
    return <PushDashboard initial={data} testMode />
  } catch (error) {
    return (
      <div className="p-8 space-y-4">
        <h1 className="text-2xl font-bold">Push diagnostics</h1>
        <p>
          {error instanceof Error
            ? error.message
            : 'Unable to load diagnostics.'}
        </p>
        <Link href="/host" className="underline">
          Back to dashboard
        </Link>
      </div>
    )
  }
}
