export type PushRole = { role: string; permissions?: string[] | null }

export function pushAccess(roles: PushRole[]) {
  const admin = roles.some((row) => row.role === 'admin')
  return {
    admin,
    send:
      admin ||
      roles.some((row) => row.permissions?.includes('notifications:send')),
  }
}

export const isExpoPushToken = (token: string) =>
  /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(token)

export function validatePushMessage(title: string, body: string) {
  if (!title.trim() || title.trim().length > 100)
    throw new Error('Enter a title between 1 and 100 characters.')
  if (!body.trim() || body.trim().length > 1000)
    throw new Error('Enter a message between 1 and 1,000 characters.')
  return { title: title.trim(), body: body.trim() }
}
