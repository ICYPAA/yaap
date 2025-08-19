# ICYPAA Mobile Application

A comprehensive conference guide mobile application built with React Native, TypeScript, and Expo. Designed with anonymity-first principles and robust offline capabilities to serve as an indispensable tool for conference attendees.

## Overview

The ICYPAA mobile app provides attendees with a complete conference experience through five main sections:

- **Program** - Browse and save conference events, view timeline/list views, and filter by event type
- **Accommodations** - Access venue information, hospitality schedules, and local recommendations
- **Services** - Request support, volunteer opportunities, and accessibility accommodations
- **Profile** - Manage optional profile, privacy settings, and app preferences
- **Host** (Restricted) - Administrative tools for host committee members

## Key Features

### 🔒 Privacy & Anonymity First
- Optional profile creation with minimal PII requirements
- All data sharing is explicit and user-controlled
- Complete control over schedule sharing with QR codes
- Anonymous device-based authentication for services

### 📱 Offline-First Architecture
- All essential conference data cached locally
- Browse program, maps, and saved schedule without internet
- Network-efficient data synchronization
- Battery and data usage optimized

### 🎯 Core Functionality
- **Event Management** - Save events, view personalized schedule, time conflict detection
- **Schedule Sharing** - Share your schedule via QR code with granular privacy controls
- **Real-time Updates** - Push notifications for schedule changes and announcements
- **Multi-view Program** - Timeline and list views with advanced filtering
- **Accessibility** - Full support for screen readers, high contrast modes, and accessibility services
- **Bid Committee Support** - Special bid schedule section for committee events

## Tech Stack

- **Frontend**: React Native with Expo SDK
- **Language**: TypeScript
- **Backend**: Supabase (PostgreSQL, Auth, Realtime)
- **State Management**: React Context API
- **Styling**: React Native StyleSheet with theme support
- **Navigation**: Expo Router (file-based routing)
- **Security**: Client-side encryption, rate limiting, device integrity checks

## Documentation

For detailed information about specific aspects of the application:

- [**Project Instructions**](./CLAUDE.md) - Comprehensive development guidelines and app architecture
- [**Security**](./SECURITY.md) - Security policies, threat model, and implementation details
- [**Deployment**](./DEPLOYMENT.md) - Release process, update types, and deployment strategies
- [**Services Guide**](./supabase/SERVICES.md) - Backend services and API documentation

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac only) or Android Emulator
- Expo Go app for physical device testing

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/icypaa.git
   cd icypaa
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase credentials
   ```

4. Start the development server:
   ```bash
   npx expo start
   ```

5. Run on your device:
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app for physical device

## Development

### Project Structure

```
icypaa/
├── app/                  # Expo Router screens (file-based routing)
│   ├── (tabs)/          # Tab navigation screens
│   ├── (auth)/          # Authentication screens
│   └── _layout.tsx      # Root layout
├── components/          # Reusable UI components
├── context/            # React Context providers
├── lib/                # Utilities and helpers
│   └── security/       # Security modules
├── types/              # TypeScript type definitions
├── assets/             # Images and static files
└── supabase/           # Backend configuration
```

### Available Scripts

```bash
# Development
npm start              # Start Expo development server
npm run ios           # Run on iOS simulator
npm run android       # Run on Android emulator
npm run web           # Run in web browser

# Testing & Quality
npm run lint          # Run ESLint
npm run typecheck     # Run TypeScript compiler
npm test              # Run test suite

# Building
npm run build:ios     # Build iOS app
npm run build:android # Build Android app
npm run build:web     # Build web app
```

### Key Components

- **EventDetailsModal** - Displays detailed event information with CTA links
- **SafetyModal** - Shows safety and anonymity policies on first launch
- **BidSchedule** - Specialized component for bid committee events
- **ProtectedComponent** - Role-based access control wrapper

## Security

The app implements comprehensive security measures:

- **Device Security**: Cryptographically secure device ID generation
- **Rate Limiting**: Client-side request throttling
- **Input Sanitization**: XSS and injection prevention
- **Session Management**: Auto-refresh with secure token handling
- **App Integrity**: Jailbreak/root detection and signature verification

See [SECURITY.md](./SECURITY.md) for complete security documentation.

## Deployment

The app supports three update types:

1. **OTA Updates** - JavaScript bundle updates via Expo
2. **Native Updates** - Binary updates through app stores
3. **Forced Updates** - Critical updates with version enforcement

See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment procedures.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

For support, questions, or feedback:

- Use the in-app Support Chat feature
- Contact a Host Committee member at the conference
- Open an issue on GitHub

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built for the ICYPAA community
- Powered by Expo and React Native
- Backend infrastructure by Supabase