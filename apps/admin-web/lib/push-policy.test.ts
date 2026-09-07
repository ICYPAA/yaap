import { describe, expect, it } from 'vitest'
import { pushAccess, isExpoPushToken, validatePushMessage } from './push-policy'
describe('push access and validation', () => {
  it('requires deliberate permission and reserves diagnostics for admin', () => {
    for (const roles of [
      [],
      [{ role: 'host', permissions: ['program:edit'] }],
      [{ role: 'steering' }],
    ])
      expect(pushAccess(roles)).toEqual({ admin: false, send: false })
    expect(
      pushAccess([{ role: 'host', permissions: ['notifications:send'] }]),
    ).toEqual({ admin: false, send: true })
    expect(pushAccess([{ role: 'admin' }])).toEqual({ admin: true, send: true })
  })
  it('accepts both Expo prefixes but rejects native tokens and malformed payloads', () => {
    expect(isExpoPushToken('ExpoPushToken[abc_123-xyz]')).toBe(true)
    expect(isExpoPushToken('ExponentPushToken[abc123]')).toBe(true)
    for (const value of [
      '',
      'abc123',
      'ExpoPushToken[]',
      'ExpoPushToken[x]junk',
    ])
      expect(isExpoPushToken(value)).toBe(false)
    expect(() => validatePushMessage(' ', 'message')).toThrow()
    expect(() => validatePushMessage('title', 'a'.repeat(1001))).toThrow()
    expect(validatePushMessage(' title ', ' message ')).toEqual({
      title: 'title',
      body: 'message',
    })
  })
})
