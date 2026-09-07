'use server'

import {
  requirePushAccess,
  pushServiceClient,
  expoPushRequest,
} from '@/lib/push-server'
import { isExpoPushToken, validatePushMessage } from '@/lib/push-policy'

export async function getPushDashboard(adminOnly = false) {
  const { user, access, client } = await requirePushAccess(adminOnly)
  const { data: state, error: stateError } = await client
    .from('conference_state')
    .select('status,current_program_id,programs(title)')
    .eq('id', true)
    .single()
  if (stateError) throw new Error('Conference status could not be loaded.')
  let query = client
    .from('push_notification_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)
  if (!access.admin) query = query.eq('created_by', user.id)
  const { data: runs, error } = await query
  return {
    state,
    runs: runs || [],
    historyError: error
      ? 'Apply the push notification migration to enable delivery history.'
      : null,
    access,
    configured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    enhancedSecurityToken: Boolean(process.env.EXPO_ACCESS_TOKEN),
  }
}

export async function sendPush(input: {
  id: string
  title: string
  body: string
  audience: 'test' | 'subscribers'
  token?: string
  programId?: number
}) {
  if (!['test', 'subscribers'].includes(input.audience))
    throw new Error('Invalid audience.')
  const { user } = await requirePushAccess(input.audience === 'test')
  const message = validatePushMessage(input.title, input.body)
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input.id,
    )
  )
    throw new Error('Invalid send request.')
  const service = pushServiceClient()
  const { data: previous, error: previousError } = await service
    .from('push_notification_runs')
    .select('*')
    .eq('id', input.id)
    .maybeSingle()
  if (previousError)
    throw new Error(
      'Delivery history is unavailable. Apply the push notification migration before sending.',
    )
  if (previous) {
    if (previous.created_by !== user.id)
      throw new Error('Invalid send request.')
    return previous
  }
  const { count, error: limitError } = await service
    .from('push_notification_runs')
    .select('id', { count: 'exact', head: true })
    .eq('created_by', user.id)
    .gte('created_at', new Date(Date.now() - 60000).toISOString())
  if (limitError || (count || 0) >= 3)
    throw new Error('Please wait a minute before sending another notification.')

  const tokens = new Set<string>()
  let programId: number | null = null
  if (input.audience === 'test') {
    if (!input.token || !isExpoPushToken(input.token.trim()))
      throw new Error('Paste a valid Expo push token from your test device.')
    tokens.add(input.token.trim())
  } else {
    const { data: state, error } = await service
      .from('conference_state')
      .select('status,current_program_id')
      .eq('id', true)
      .single()
    if (
      error ||
      state.status !== 'active' ||
      state.current_program_id !== input.programId
    )
      throw new Error(
        'The selected conference is no longer active. Reload before sending.',
      )
    programId = state.current_program_id
    // Paginate rather than silently stopping at the default 1,000-row API limit.
    for (let offset = 0; ; offset += 1000) {
      const { data, error: recipientsError } = await service
        .from('users')
        .select('id,expo_push_token')
        .eq('settings->>notifications', 'true')
        .not('expo_push_token', 'is', null)
        .order('id')
        .range(offset, offset + 999)
      if (recipientsError)
        throw new Error('Notification subscribers could not be loaded.')
      for (const row of data || [])
        if (isExpoPushToken(row.expo_push_token))
          tokens.add(row.expo_push_token)
      if ((data?.length || 0) < 1000) break
    }
    if (tokens.size === 0)
      throw new Error(
        'No opted-in devices have a valid push token. No notification was sent.',
      )
  }
  const { error: reserveError } = await service
    .from('push_notification_runs')
    .insert({
      id: input.id,
      created_by: user.id,
      program_id: programId,
      audience: input.audience,
      ...message,
      recipient_count: tokens.size,
    })
  if (reserveError)
    throw new Error(
      'This send could not be reserved or is already running. Reload delivery history before retrying.',
    )

  const tickets: {
    status: string
    id?: string
    message?: string
    details?: { error?: string }
  }[] = []
  let errorMessage: string | null = null
  try {
    const recipients = Array.from(tokens)
    for (let offset = 0; offset < recipients.length; offset += 100) {
      if (offset) await new Promise((resolve) => setTimeout(resolve, 250))
      const batch = recipients.slice(offset, offset + 100)
      const result = await expoPushRequest(
        'send',
        batch.map((to) => ({
          to,
          ...message,
          title:
            input.audience === 'test'
              ? `[TEST] ${message.title}`
              : message.title,
          sound: 'default',
          channelId: 'default',
          data: {
            program_id: programId,
            screen: '/notifications',
            test: input.audience === 'test',
          },
        })),
      )
      if (!Array.isArray(result) || result.length !== batch.length)
        throw new Error(
          'Expo returned an incomplete ticket response. Check delivery history before retrying.',
        )
      tickets.push(...result)
    }
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : 'Push delivery failed.'
  }
  const accepted = tickets.filter(
    (ticket) => ticket.status === 'ok' && ticket.id,
  ).length
  const { data: run, error: saveError } = await service
    .from('push_notification_runs')
    .update({
      accepted_count: accepted,
      error_count: tokens.size - accepted,
      tickets,
      status: errorMessage
        ? 'failed'
        : accepted === tokens.size
          ? 'accepted'
          : 'partial',
      error_message: errorMessage,
    })
    .eq('id', input.id)
    .select('*')
    .single()
  if (saveError)
    throw new Error(
      'Delivery was attempted, but its result could not be saved. Do not resend without checking Expo logs.',
    )
  return run
}

export async function checkPushReceipts(runId: string) {
  const { user, access } = await requirePushAccess()
  const service = pushServiceClient()
  const { data: run, error } = await service
    .from('push_notification_runs')
    .select('*')
    .eq('id', runId)
    .single()
  if (error || (!access.admin && run.created_by !== user.id))
    throw new Error('Delivery record not found.')
  const ids = (run.tickets || [])
    .filter((ticket: { id?: string }) => ticket.id)
    .map((ticket: { id: string }) => ticket.id)
  if (!ids.length) throw new Error('There are no accepted tickets to check.')
  const receipts: Record<
    string,
    { status: string; message?: string; details?: { error?: string } }
  > = { ...run.receipts }
  for (let offset = 0; offset < ids.length; offset += 1000)
    Object.assign(
      receipts,
      await expoPushRequest('getReceipts', {
        ids: ids.slice(offset, offset + 1000),
      }),
    )
  const { error: saveError } = await service
    .from('push_notification_runs')
    .update({ receipts })
    .eq('id', runId)
  if (saveError)
    throw new Error('Receipts were fetched but could not be saved.')
  return receipts
}
