import React from 'react'
import { Redirect } from 'expo-router'
import { ConferenceStatusScreen } from '../components/ConferenceStatusScreen'
import { useCurrentConference } from '../context/CurrentConferenceContext'

export default function LandingScreen() {
  const { status } = useCurrentConference()
  return status === 'active' ? <Redirect href="/(tabs)/program" /> : <ConferenceStatusScreen />
}
