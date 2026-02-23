# ICYPAA Mobile App - Architecture Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Application Architecture](#application-architecture)
4. [Data Architecture](#data-architecture)
5. [Authentication & Authorization](#authentication--authorization)
6. [Offline-First Design](#offline-first-design)
7. [Network Communication](#network-communication)
8. [State Management](#state-management)
9. [Performance Optimizations](#performance-optimizations)
10. [Deployment Architecture](#deployment-architecture)

## System Overview

The ICYPAA mobile application is a React Native conference guide built with Expo, designed with two primary philosophies:
- **Offline-First Functionality**: Complete app functionality without internet connectivity
- **Network Efficiency**: Optimized data fetching to minimize network requests

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Mobile Application                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    Presentation Layer                │   │
│  │              (React Native + Expo Router)            │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Business Logic Layer                │   │
│  │           (Context Providers + Services)             │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    Data Access Layer                 │   │
│  │        (AsyncStorage + Supabase Client)              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                         Backend Services                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                     Supabase Platform                │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │   │
│  │  │PostgreSQL│  │   Auth   │  │  Edge Functions  │  │   │
│  │  │    +     │  │ (Discord,│  │                  │  │   │
│  │  │   RLS    │  │  Apple)  │  │                  │  │   │
│  │  └──────────┘  └──────────┘  └──────────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Core Technologies
- **React Native**: 0.76.9 - Cross-platform mobile framework
- **Expo**: ~52.0.42 - Managed workflow and build system
- **TypeScript**: Type-safe development
- **Expo Router**: 4.0.20 - File-based navigation

### Backend Services
- **Supabase**: 2.49.1 - Backend-as-a-Service platform
  - PostgreSQL database with Row Level Security
  - Authentication (Discord OAuth, Apple Sign-In, Email/Password)
  - Real-time subscriptions
  - Edge Functions for custom business logic

### UI/UX Libraries
- **React Native Paper**: Material Design components
- **React Native Reanimated**: 4.0.1 - Smooth animations
- **React Native Gesture Handler**: 2.22.1 - Touch interactions
- **Expo Haptics**: 14.0.0 - Tactile feedback

### Storage & State
- **AsyncStorage**: 1.23.1 - Local data persistence
- **React Context API**: Global state management
- **Device ID System**: Anonymous user identification

### Development & Monitoring
- **Sentry**: @sentry/react-native - Error tracking and monitoring
- **Expo Updates**: Over-the-air updates
- **EAS Build**: Cloud build infrastructure

## Application Architecture

### Project Structure

```
/icypaa
├── /app                    # Screen components (Expo Router)
│   ├── /(tabs)            # Tab navigation screens
│   │   ├── index.tsx      # Program/Schedule
│   │   ├── maps.tsx       # Accommodations
│   │   ├── services.tsx   # Services
│   │   ├── profile.tsx    # Profile
│   │   └── host.tsx       # Host (restricted)
│   ├── _layout.tsx        # Root layout with providers
│   └── linking.tsx        # Deep linking configuration
├── /components            # Reusable UI components
│   ├── /protected        # Role-based access components
│   ├── /themed           # Themed UI elements
│   └── /ui               # Generic UI components
├── /context              # React Context providers
│   ├── RoleContext.tsx   # Authentication & permissions
│   ├── ThemeContext.tsx  # Dark/light mode
│   ├── FeatureContext.tsx # Feature flags
│   └── I18nContext.tsx   # Internationalization
├── /lib                  # Core business logic
│   ├── supabase.ts       # Supabase client configuration
│   ├── permissions.ts    # Permission definitions
│   └── utils.ts          # Utility functions
├── /types                # TypeScript definitions
├── /locales              # i18n translations
└── /migrations           # Database schema & RLS policies
```

### Navigation Architecture

The app uses Expo Router's file-based routing with a tab navigation structure:

```typescript
// Tab Navigation Structure
<Tabs>
  <Tab name="index" title="Program" icon="calendar" />
  <Tab name="maps" title="Accommodations" icon="map" />
  <Tab name="services" title="Services" icon="help-circle" />
  <Tab name="profile" title="Profile" icon="account" />
  <Tab name="host" title="Host" icon="shield" requiresAuth />
</Tabs>
```

### Component Architecture

Components follow a hierarchical structure with clear separation of concerns:

1. **Screen Components** (`/app/(tabs)/*`): Top-level route components
2. **Feature Components** (`/components/features/*`): Complex feature-specific components
3. **UI Components** (`/components/ui/*`): Reusable presentation components
4. **Protected Components** (`/components/protected/*`): Role-based access wrappers

## Data Architecture

### Database Schema

```sql
-- Core Tables
CREATE TABLE users (
  id UUID PRIMARY KEY,
  device_id TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_initial TEXT,
  profile_picture TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE schedules (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  device_id TEXT NOT NULL,
  saved_events JSONB DEFAULT '[]',
  shared_with INTEGER[] DEFAULT '{}',
  shared_by INTEGER[] DEFAULT '{}',
  banned INTEGER[] DEFAULT '{}'
);

CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  location TEXT,
  type TEXT,
  day INTEGER
);

-- Row Level Security enabled on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
```

### Data Flow

```
User Action → Context Provider → Service Layer → Supabase Client
                                       ↓
                              Local Storage (AsyncStorage)
                                       ↓
                              Backend Database (PostgreSQL)
```

### Caching Strategy

1. **Event Data**: Cached locally on app launch, refreshed every 5 seconds when active
2. **User Schedules**: Persisted locally, synced with backend on changes
3. **Shared Schedules**: Cached after initial fetch, updated via real-time subscriptions
4. **Settings**: Stored locally, synced to backend for backup

## Authentication & Authorization

### Authentication Flow

```
1. User Opens App
   ↓
2. Check Device ID in AsyncStorage
   ↓
3. Device ID Exists?
   ├─ Yes → Load cached data
   └─ No → Generate new Device ID
   ↓
4. Optional Profile Creation
   ├─ Discord OAuth → Verify server membership
   ├─ Apple Sign-In → iOS compliance
   └─ Email/Password → Admin fallback
   ↓
5. Role Assignment based on authentication
```

### Role-Based Access Control (RBAC)

```typescript
enum UserRole {
  ADMIN = 'admin',
  ADVISORY = 'advisory',
  STEERING = 'steering',
  HOST = 'host'
}

// Permission mapping
const ROLE_PERMISSIONS = {
  [UserRole.ADMIN]: ['*'], // All permissions
  [UserRole.ADVISORY]: ['*'],
  [UserRole.STEERING]: ['*'],
  [UserRole.HOST]: ['view_public', 'manage_own_schedule']
};
```

### Device ID System

The app uses a unique device identifier for anonymous authentication:

```typescript
// Device ID generation and storage
const getOrCreateDeviceId = async () => {
  let deviceId = await AsyncStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = generateUUID();
    await AsyncStorage.setItem('device_id', deviceId);
  }
  return deviceId;
};

// Custom Supabase client with device ID header
const supabaseWithDeviceId = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    headers: {
      'x-device-id': deviceId
    }
  }
});
```

## Offline-First Design

### Local Storage Architecture

```
AsyncStorage
├── device_id           # Unique device identifier
├── user_profile        # User profile data
├── saved_events        # User's saved schedule
├── shared_schedules    # Friends' schedules
├── event_cache         # All conference events
├── settings            # App preferences
└── feature_flags       # Dynamic feature toggles
```

### Synchronization Strategy

1. **Initial Load**: Fetch all essential data on first launch
2. **Background Sync**: Poll for updates every 5 seconds when app is active
3. **Optimistic Updates**: Apply changes locally first, then sync
4. **Conflict Resolution**: Server data takes precedence on conflicts
5. **Error Recovery**: Queue failed operations for retry

### Offline Capabilities

- ✅ Browse complete event schedule
- ✅ View saved personal schedule
- ✅ Access venue maps and information
- ✅ View cached friend schedules
- ✅ Modify app settings
- ❌ Share schedules (requires network)
- ❌ Submit service requests (requires network)

## Network Communication

### API Communication Pattern

```typescript
// Standard API call pattern with error handling
const fetchData = async () => {
  try {
    // Check cache first
    const cached = await AsyncStorage.getItem('cache_key');
    if (cached && !isExpired(cached)) {
      return JSON.parse(cached);
    }
    
    // Fetch from backend
    const { data, error } = await supabase
      .from('table')
      .select('*');
    
    if (error) throw error;
    
    // Update cache
    await AsyncStorage.setItem('cache_key', JSON.stringify(data));
    return data;
  } catch (error) {
    // Fallback to cached data
    const cached = await AsyncStorage.getItem('cache_key');
    return cached ? JSON.parse(cached) : [];
  }
};
```

### Real-time Subscriptions

```typescript
// Real-time schedule updates
const subscription = supabase
  .channel('schedule_changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'schedules',
    filter: `device_id=eq.${deviceId}`
  }, handleScheduleChange)
  .subscribe();
```

## State Management

### Context Provider Architecture

```
<RoleProvider>                 # Authentication & permissions
  <ThemeProvider>              # UI theming
    <FeatureProvider>          # Feature flags
      <I18nProvider>           # Internationalization
        <DebugProvider>        # Development tools
          <App />
        </DebugProvider>
      </I18nProvider>
    </FeatureProvider>
  </ThemeProvider>
</RoleProvider>
```

### State Flow

1. **Global State**: Managed via React Context for app-wide data
2. **Local State**: Component-level state for UI interactions
3. **Persistent State**: AsyncStorage for data that survives app restarts
4. **Server State**: Supabase for authoritative data source

## Performance Optimizations

### Code Splitting
- Lazy loading of tab screens
- Dynamic imports for heavy components
- Conditional loading based on user roles

### Memory Management
- Image optimization with expo-image
- List virtualization for long scrollable content
- Proper cleanup of subscriptions and listeners

### Network Optimization
- Request batching where possible
- Compression of API responses
- Minimal data transfer (only required fields)
- Strategic use of caching headers

### Rendering Optimization
- React.memo for expensive components
- useMemo/useCallback for computed values
- Optimistic UI updates
- Debounced search inputs

## Deployment Architecture

### Build Process

```
1. Development
   ├── Local development with Expo Go
   └── Hot reloading enabled

2. Preview/Testing
   ├── EAS Build development builds
   └── Internal testing distribution

3. Production
   ├── EAS Build production builds
   ├── App Store (iOS)
   └── Google Play Store (Android)
```

### Update Strategy

1. **Over-the-Air Updates**: Minor updates via Expo Updates
2. **Native Updates**: Major updates through app stores
3. **Feature Flags**: Gradual rollout of new features
4. **Rollback Capability**: Quick reversion if issues detected

### Environment Configuration

```typescript
// Environment-specific configuration
const ENV = {
  development: {
    SUPABASE_URL: 'https://dev.supabase.co',
    SENTRY_DSN: null,
    DEBUG: true
  },
  staging: {
    SUPABASE_URL: 'https://staging.supabase.co',
    SENTRY_DSN: 'staging-dsn',
    DEBUG: false
  },
  production: {
    SUPABASE_URL: 'https://prod.supabase.co',
    SENTRY_DSN: 'production-dsn',
    DEBUG: false
  }
};
```

### Monitoring & Analytics

- **Error Tracking**: Sentry for crash reports and error monitoring
- **Performance Monitoring**: Custom metrics for API response times
- **User Analytics**: Anonymous usage statistics (respecting privacy)
- **Health Checks**: Automated backend availability monitoring

## Scalability Considerations

### Horizontal Scaling
- Supabase auto-scales database connections
- Edge Functions scale automatically
- CDN for static assets

### Vertical Scaling
- Database connection pooling
- Optimized queries with proper indexing
- Caching at multiple levels