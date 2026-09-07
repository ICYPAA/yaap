import React from 'react'
import { act, create, ReactTestRenderer } from 'react-test-renderer'
import { ThemeProvider, useTheme } from '../ThemeContext'
import { useCurrentConference } from '../CurrentConferenceContext'
import { theme as defaultTheme } from '../../constants/theme'

jest.mock('../CurrentConferenceContext', () => ({ useCurrentConference: jest.fn() }))
jest.mock('../../lib/storage', () => ({ getThemeMode: jest.fn().mockResolvedValue('light'), setThemeMode: jest.fn() }))

it('applies each selected archive theme and restores the default after exit', async () => {
  let selectedTheme: ReturnType<typeof useTheme>
  function Consumer() { selectedTheme = useTheme(); return null }
  const conference = { program: null, archiveProgram: null, archiveDetails: null } as any
  ;(useCurrentConference as jest.Mock).mockImplementation(() => conference)
  let renderer: ReactTestRenderer
  await act(async () => { renderer = create(<ThemeProvider><Consumer /></ThemeProvider>) })
  expect(selectedTheme!.theme.colors.primary).toBe(defaultTheme.colors.primary)
  conference.archiveProgram = { id: 4 }
  conference.archiveDetails = { id: 4, design: { colors: { primary: '#17406A', secondary: '#E6C29A' } } }
  await act(async () => { renderer!.update(<ThemeProvider><Consumer /></ThemeProvider>) })
  expect(selectedTheme!.theme.colors.primary).toBe('#17406A')
  conference.archiveProgram = { id: 3 }
  conference.archiveDetails = { id: 3, design: { colors: { primary: '#2B8D9B' } } }
  await act(async () => { renderer!.update(<ThemeProvider><Consumer /></ThemeProvider>) })
  expect(selectedTheme!.theme.colors.primary).toBe('#2B8D9B')
  expect(selectedTheme!.theme.colors.secondary).toBe(defaultTheme.colors.secondary)
  conference.archiveProgram = null
  conference.archiveDetails = null
  await act(async () => { renderer!.update(<ThemeProvider><Consumer /></ThemeProvider>) })
  expect(selectedTheme!.programDesign).toBeNull()
  expect(selectedTheme!.theme.colors.primary).toBe(defaultTheme.colors.primary)
  await act(async () => { renderer!.unmount() })
})
