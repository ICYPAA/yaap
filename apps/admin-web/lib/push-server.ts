import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import { pushAccess } from './push-policy'

export async function requirePushAccess(adminOnly = false) {
  const client = await createClient()
  const {
    data: { user },
    error,
  } = await client.auth.getUser()
  if (error || !user) throw new Error('Sign in to manage push notifications.')
  const { data: roles, error: rolesError } = await client
    .from('roles')
    .select('role,permissions')
    .eq('user_id', user.id)
  if (rolesError)
    throw new Error('Your notification permissions could not be verified.')
  const access = pushAccess(roles || [])
  if (adminOnly ? !access.admin : !access.send)
    throw new Error(
      'You do not have permission to use this notification section.',
    )
  return { user, access, client }
}

export function pushServiceClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error(
      'Push delivery is not configured: the server service role key is missing.',
    )
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function expoPushRequest(
  path: 'send' | 'getReceipts',
  payload: unknown,
) {
  const response = await fetch(`https://exp.host/--/api/v2/push/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.EXPO_ACCESS_TOKEN
        ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
        : {}),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
    cache: 'no-store',
  })
  const result = await response.json()
  if (!response.ok || result.errors?.length) {
    throw new Error(
      result.errors?.[0]?.message ||
        `Expo returned HTTP ${response.status}. Check push credentials and enhanced push security.`,
    )
  }
  return result.data
}
