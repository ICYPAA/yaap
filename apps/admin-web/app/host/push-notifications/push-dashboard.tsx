'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { getPushDashboard, sendPush, checkPushReceipts } from './actions'

type Receipt = {
  status: string
  message?: string
  details?: { error?: string }
}
type Dashboard = Awaited<ReturnType<typeof getPushDashboard>>
export function PushDashboard({
  initial,
  testMode = false,
}: {
  initial: Dashboard
  testMode?: boolean
}) {
  const [data, setData] = useState(initial)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [token, setToken] = useState('')
  const [review, setReview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [requestId, setRequestId] = useState<string | null>(null)
  const ready =
    data.configured &&
    !data.historyError &&
    (testMode || data.state.status === 'active')
  const program = Array.isArray(data.state.programs)
    ? data.state.programs[0]
    : data.state.programs
  async function deliver() {
    setBusy(true)
    setError('')
    setNotice('')
    const id = requestId || crypto.randomUUID()
    setRequestId(id)
    try {
      const result = await sendPush({
        id,
        title,
        body,
        token,
        audience: testMode ? 'test' : 'subscribers',
        programId: data.state.current_program_id,
      })
      setNotice(
        `${result.accepted_count} of ${result.recipient_count} accepted by Expo. Check receipts for delivery results.${result.error_message ? ` ${result.error_message}` : ''}`,
      )
      setReview(false)
      setData(await getPushDashboard(testMode))
      setRequestId(null)
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Send failed. Refresh history before trying again.',
      )
    } finally {
      setBusy(false)
    }
  }
  async function receipts(id: string) {
    setBusy(true)
    setError('')
    try {
      const result = await checkPushReceipts(id)
      setNotice(
        Object.keys(result).length
          ? 'Receipts updated below.'
          : 'Receipts are not ready yet. Check again in about 15 minutes.',
      )
      setData(await getPushDashboard(testMode))
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Receipt check failed.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap justify-between gap-4">
        <Link href="/host" className="text-sm underline">
          ← Dashboard
        </Link>
        <Link href="/help/push-notifications" className="text-sm underline">
          Setup & delivery guide
        </Link>
      </div>
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary">
          {testMode ? 'Administrator tools' : 'Host committee'}
        </p>
        <h1 className="text-3xl font-bold">
          {testMode ? 'Push diagnostics' : 'Push notifications'}
        </h1>
        <p className="text-muted-foreground">
          {testMode
            ? 'Send a test to one device and inspect its delivery receipts.'
            : 'Send an announcement to devices that opted in to app notifications.'}
        </p>
      </header>
      {data.access.admin && (
        <Link
          className="inline-block underline"
          href={
            testMode ? '/host/push-notifications' : '/admin/push-notifications'
          }
        >
          {testMode
            ? 'Open committee announcements'
            : 'Open administrator diagnostics'}
        </Link>
      )}
      {testMode && (
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>
              Server delivery credentials:{' '}
              {data.configured ? 'Configured' : 'Missing'}
            </p>
            <p>
              Expo access token:{' '}
              {data.enhancedSecurityToken
                ? 'Configured'
                : 'Not set — required if enhanced push security is enabled'}
            </p>
            <p className="text-sm text-muted-foreground">
              APNs and FCM credentials must also be configured in EAS. A
              real-device test and its receipts verify delivery.
            </p>
          </CardContent>
        </Card>
      )}
      {!ready && (
        <p role="status" className="rounded-lg border p-4">
          {data.historyError ||
            (!data.configured
              ? 'Server delivery credentials are missing. Ask the administrator to complete push setup.'
              : 'There is no active conference. Committee announcements are unavailable until a conference is active.')}
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>
            {testMode
              ? 'Single-device test'
              : `Announcement${program?.title ? ` · ${program.title}` : ''}`}
          </CardTitle>
          <CardDescription>
            {testMode
              ? 'The title will be prefixed with [TEST]. Only the entered device receives it.'
              : 'Review the message and audience before sending.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              setReview(true)
              setError('')
            }}
          >
            <fieldset disabled={busy || review} className="space-y-4">
              {testMode && (
                <label className="block space-y-2">
                  <span>Test device Expo push token</span>
                  <Input
                    required
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    autoComplete="off"
                    placeholder="ExpoPushToken[…]"
                  />
                  <span className="text-sm text-muted-foreground">
                    In the app, open Notification diagnostics → Refresh token.
                    Copy the token from your own test device.
                  </span>
                </label>
              )}
              <label className="block space-y-2">
                <span>Title</span>
                <Input
                  required
                  maxLength={100}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label className="block space-y-2">
                <span>Message</span>
                <Textarea
                  required
                  maxLength={1000}
                  rows={4}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </label>
            </fieldset>
            {review ? (
              <div className="space-y-4 rounded-lg border bg-muted/40 p-4">
                <p className="text-sm font-medium">
                  {testMode
                    ? 'To: one test device'
                    : 'To: all opted-in app devices'}
                </p>
                <div>
                  <p className="font-semibold">
                    {testMode ? '[TEST] ' : ''}
                    {title}
                  </p>
                  <p className="whitespace-pre-wrap">{body}</p>
                </div>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    disabled={!ready || busy}
                    onClick={deliver}
                  >
                    {busy
                      ? 'Sending…'
                      : testMode
                        ? 'Send test notification'
                        : 'Send announcement'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setReview(false)
                      setRequestId(null)
                    }}
                  >
                    Edit
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="submit"
                disabled={!ready || busy || !title.trim() || !body.trim()}
              >
                Review {testMode ? 'test' : 'announcement'}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive p-4 text-destructive"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg border p-4">
          {notice}
        </p>
      )}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Recent delivery attempts</CardTitle>
            <Button
              variant="outline"
              disabled={busy}
              onClick={async () => {
                try {
                  setData(await getPushDashboard(testMode))
                  setNotice('History refreshed.')
                } catch {
                  setError('History could not be refreshed.')
                }
              }}
            >
              Refresh history
            </Button>
          </div>
          <CardDescription>
            Expo acceptance is not proof of delivery. Receipts report the
            handoff to Apple or Google; check the device too.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.runs.length === 0 && (
            <p className="text-muted-foreground">No delivery attempts yet.</p>
          )}
          {data.runs.map((run) => (
            <article key={run.id} className="space-y-2 rounded-lg border p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <h3 className="font-semibold">
                  {run.audience === 'test' ? '[TEST] ' : ''}
                  {run.title}
                </h3>
                <span className="text-sm text-muted-foreground">
                  {new Date(run.created_at).toLocaleString()}
                </span>
              </div>
              <p className="whitespace-pre-wrap">{run.body}</p>
              <p className="text-sm">
                {run.status} · {run.accepted_count}/{run.recipient_count}{' '}
                accepted · {run.error_count} failed or unconfirmed
              </p>
              {run.error_message && (
                <p className="text-sm text-destructive">{run.error_message}</p>
              )}
              {(run.tickets || [])
                .filter((ticket: { status: string }) => ticket.status !== 'ok')
                .map(
                  (
                    ticket: { message?: string; details?: { error?: string } },
                    index: number,
                  ) => (
                    <p key={index} className="text-sm text-destructive">
                      {ticket.details?.error}: {ticket.message}
                    </p>
                  ),
                )}
              <p className="text-sm">
                Receipts:{' '}
                {
                  Object.values(
                    (run.receipts as Record<string, Receipt>) || {},
                  ).filter((r: Receipt) => r.status === 'ok').length
                }{' '}
                handed off,{' '}
                {
                  Object.values(
                    (run.receipts as Record<string, Receipt>) || {},
                  ).filter((r: Receipt) => r.status === 'error').length
                }{' '}
                errors,{' '}
                {Math.max(
                  0,
                  run.accepted_count - Object.keys(run.receipts || {}).length,
                )}{' '}
                pending
              </p>
              {Object.entries((run.receipts as Record<string, Receipt>) || {})
                .filter(([, r]) => r.status === 'error')
                .map(([id, r]) => (
                  <p key={id} className="text-sm text-destructive">
                    {r.details?.error}: {r.message}
                  </p>
                ))}
              <Button
                variant="outline"
                size="sm"
                disabled={busy || !run.accepted_count}
                onClick={() => receipts(run.id)}
              >
                Check receipts
              </Button>
            </article>
          ))}
        </CardContent>
      </Card>
    </main>
  )
}
