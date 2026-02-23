# ICYPAA Mobile App - Security Documentation

## Table of Contents
1. [Security Overview](#security-overview)
2. [Privacy & Anonymity Principles](#privacy--anonymity-principles)
3. [Authentication Security](#authentication-security)
4. [Authorization & Access Control](#authorization--access-control)
5. [Data Protection](#data-protection)
6. [Database Security](#database-security)
7. [Network Security](#network-security)
8. [Schedule Sharing Security](#schedule-sharing-security)
9. [Client-Side Security](#client-side-security)
10. [Security Best Practices](#security-best-practices)
11. [Incident Response](#incident-response)
12. [Compliance & Auditing](#compliance--auditing)

## Security Overview

The ICYPAA mobile application implements defense-in-depth security with multiple layers of protection:

```
┌─────────────────────────────────────────────────────────┐
│                   Security Layers                        │
├─────────────────────────────────────────────────────────┤
│  1. Client-Side Security (Device ID, Encryption)        │
│  2. Network Security (HTTPS)                            │
│  3. Authentication (OAuth, Multi-factor)                │
│  4. Authorization (RBAC, Permissions)                   │
│  5. Database Security (RLS, Encrypted at Rest)          │
│  6. Application Security (Input Validation, Sanitization)│
│  7. Monitoring & Auditing (Sentry, Logs)               │
└─────────────────────────────────────────────────────────┘
```

### Core Security Principles

1. **Privacy by Design**: Minimal data collection, maximum user control
2. **Anonymity First**: No unnecessary PII collection
3. **Explicit Consent**: All data sharing requires user approval
4. **Data Minimization**: Only collect what's absolutely necessary
5. **Defense in Depth**: Multiple security layers
6. **Zero Trust**: Verify everything, trust nothing

## Privacy & Anonymity Principles

### Minimal Data Collection

The app collects only essential information:

```typescript
// Minimal profile requirements
interface UserProfile {
  first_name: string;      // Required
  last_initial: string;    // Required (single character)
  profile_picture?: string; // Optional
  // No email, phone, address, or other PII required
}
```

### Anonymous Usage

Users can access 80% of app functionality without creating a profile:
- ✅ View complete event schedule
- ✅ Access venue information
- ✅ Read service information
- ✅ Save personal schedule (device-local)
- ❌ Share schedule with friends (requires profile)
- ❌ Access host features (requires authentication)

### Data Ownership

Users maintain complete control over their data:
- Delete account at any time
- Revoke sharing permissions instantly
- Export personal data on request
- No data retention after deletion

## Authentication Security

### Multi-Layer Authentication System

```
┌──────────────────────────────────────┐
│     Authentication Methods            │
├──────────────────────────────────────┤
│  1. Discord OAuth (Primary)          │
│     └─ Server membership verification │
│  2. Apple Sign-In (iOS compliance)   │
│  3. Email/Password (Admin backup)    │
│  4. Device ID (Anonymous access)     │
└──────────────────────────────────────┘
```

### Discord OAuth Security

```typescript
// Discord authentication with server verification
const authenticateWithDiscord = async () => {
  // Step 1: OAuth authentication
  const { data: authData, error: authError } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: {
      redirectTo: 'icypaa://auth/callback',
      scopes: 'identify guilds'
    }
  });

  // Step 2: Verify Discord server membership
  const isServerMember = await verifyDiscordServerMembership(
    authData.user.id,
    REQUIRED_DISCORD_SERVER_ID
  );

  if (!isServerMember) {
    await supabase.auth.signOut();
    throw new Error('Not a member of the required Discord server');
  }

  // Step 3: Assign role based on Discord roles
  const userRole = await assignRoleFromDiscord(authData.user);
  return { user: authData.user, role: userRole };
};
```

### Device ID System

Unique device identification for anonymous users:

```typescript
// Secure device ID generation
import * as Crypto from 'expo-crypto';

const generateDeviceId = async (): Promise<string> => {
  // Generate cryptographically secure random UUID
  const randomBytes = await Crypto.getRandomBytesAsync(16);
  
  // Format as UUID v4
  const hex = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    '4' + hex.slice(13, 16), // Version 4
    ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),
    hex.slice(20, 32)
  ].join('-');
};
```

### Session Management

```typescript
// Secure session handling
const SESSION_CONFIG = {
  expiresIn: 7 * 24 * 60 * 60, // 7 days
  refreshThreshold: 60 * 60,    // Refresh if < 1 hour remaining
  storage: AsyncStorage,         // Secure local storage
  encryption: true               // Encrypt session data
};

// Automatic session refresh
const refreshSession = async () => {
  const { data: { session }, error } = await supabase.auth.refreshSession();
  if (error) {
    // Force re-authentication
    await supabase.auth.signOut();
    navigateToLogin();
  }
  return session;
};
```

## Authorization & Access Control

### Role-Based Access Control (RBAC)

```typescript
// Permission matrix
const PERMISSIONS = {
  // Public permissions
  VIEW_SCHEDULE: ['*'],
  VIEW_VENUE: ['*'],
  
  // Authenticated user permissions
  SAVE_SCHEDULE: ['user', 'host_member', 'host_admin', 'super_admin'],
  SHARE_SCHEDULE: ['user', 'host_member', 'host_admin', 'super_admin'],
  
  // Host committee permissions
  VIEW_HOST_SECTION: ['host_member', 'host_admin', 'super_admin'],
  MANAGE_REQUESTS: ['host_admin', 'super_admin'],
  
  // Coordinator permissions
  MANAGE_ACCESSIBILITY: ['accessibility_coordinator', 'super_admin'],
  MANAGE_HOSPITALITY: ['hospitality_coordinator', 'super_admin'],
  MANAGE_VOLUNTEERS: ['volunteer_coordinator', 'super_admin'],
  
  // Admin permissions
  MANAGE_USERS: ['super_admin'],
  MANAGE_SYSTEM: ['super_admin']
};
```

### Protected Component Pattern

```typescript
// Higher-order component for role-based access
const ProtectedComponent: React.FC<{
  requiredPermission: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}> = ({ requiredPermission, fallback, children }) => {
  const { userRole, hasPermission } = useRole();
  
  if (!hasPermission(requiredPermission)) {
    return fallback || <AccessDenied />;
  }
  
  return <>{children}</>;
};

// Usage
<ProtectedComponent requiredPermission="VIEW_HOST_SECTION">
  <HostDashboard />
</ProtectedComponent>
```

## Data Protection

### Encryption at Rest

```typescript
// Encrypted storage for sensitive data
import * as SecureStore from 'expo-secure-store';

const encryptedStorage = {
  async setItem(key: string, value: any) {
    const encrypted = await SecureStore.setItemAsync(
      key,
      JSON.stringify(value),
      {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
      }
    );
    return encrypted;
  },
  
  async getItem(key: string) {
    const encrypted = await SecureStore.getItemAsync(key);
    return encrypted ? JSON.parse(encrypted) : null;
  }
};
```

### Data Sanitization

```typescript
// Input sanitization
const sanitizeUserInput = (input: string): string => {
  return input
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/[<>]/g, '')
    .slice(0, MAX_INPUT_LENGTH);
};

// Profile data validation
const validateProfileData = (data: any): boolean => {
  const schema = {
    first_name: /^[a-zA-Z]{1,50}$/,
    last_initial: /^[a-zA-Z]$/,
    profile_picture: /^data:image\/(jpeg|png|gif);base64,/
  };
  
  return Object.entries(schema).every(([key, pattern]) => 
    !data[key] || pattern.test(data[key])
  );
};
```

## Database Security

### Row Level Security (RLS) Policies

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY users_select_own ON users
  FOR SELECT USING (
    device_id = current_setting('request.headers')::json->>'x-device-id'
    OR auth.uid() = id
  );

CREATE POLICY users_update_own ON users
  FOR UPDATE USING (
    device_id = current_setting('request.headers')::json->>'x-device-id'
    OR auth.uid() = id
  );

-- Schedules are private by default
CREATE POLICY schedules_select_own ON schedules
  FOR SELECT USING (
    device_id = current_setting('request.headers')::json->>'x-device-id'
    OR user_id = auth.uid()
  );

-- Shared schedules require explicit permission
CREATE POLICY schedules_select_shared ON schedules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM schedules s2
      WHERE s2.device_id = current_setting('request.headers')::json->>'x-device-id'
      AND schedules.user_id = ANY(s2.shared_by)
    )
  );

-- Service requests visible only to coordinators
CREATE POLICY service_requests_select ON service_requests
  FOR SELECT USING (
    -- Requester can see their own
    device_id = current_setting('request.headers')::json->>'x-device-id'
    OR
    -- Coordinators can see relevant requests
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('accessibility_coordinator', 'hospitality_coordinator', 'super_admin')
    )
  );
```

### Secure Database Functions

```sql
-- Function to share schedule with security checks
CREATE OR REPLACE FUNCTION share_schedule_with_user(
  target_user_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  current_device_id TEXT;
  is_banned BOOLEAN;
BEGIN
  -- Get current device ID
  current_device_id := current_setting('request.headers')::json->>'x-device-id';
  
  -- Check if target user has banned current user
  SELECT EXISTS (
    SELECT 1 FROM schedules
    WHERE user_id = target_user_id
    AND current_device_id = ANY(banned)
  ) INTO is_banned;
  
  IF is_banned THEN
    RAISE EXCEPTION 'Cannot share schedule: User has blocked you';
  END IF;
  
  -- Add to pending requests
  UPDATE schedules
  SET requested_share = array_append(requested_share, target_user_id)
  WHERE device_id = current_device_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Network Security

### HTTPS Enforcement

```typescript
// Force HTTPS in production
const API_URL = process.env.NODE_ENV === 'production'
  ? 'https://api.icypaa.org'
  : 'http://localhost:3000';
```

### Request Security Headers

```typescript
// Custom Supabase client with security headers
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    headers: {
      'x-device-id': deviceId,
      'x-app-version': Constants.expoConfig?.version,
      'x-platform': Platform.OS,
      'x-request-id': generateRequestId(),
    }
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});
```

### API Rate Limiting

```typescript
// Client-side rate limiting
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly maxRequests = 100;
  private readonly timeWindow = 60000; // 1 minute

  async checkLimit(endpoint: string): Promise<boolean> {
    const now = Date.now();
    const requests = this.requests.get(endpoint) || [];
    
    // Remove old requests outside time window
    const validRequests = requests.filter(time => now - time < this.timeWindow);
    
    if (validRequests.length >= this.maxRequests) {
      throw new Error('Rate limit exceeded');
    }
    
    validRequests.push(now);
    this.requests.set(endpoint, validRequests);
    return true;
  }
}
```

## Schedule Sharing Security

### Mutual Consent System

```typescript
// Schedule sharing flow with security checks
const shareScheduleFlow = {
  // Step 1: Generate secure sharing link
  generateShareLink: async (userId: string) => {
    const token = await generateSecureToken();
    const expiresAt = Date.now() + (5 * 60 * 1000); // 5 minutes
    
    return {
      url: `icypaa://share/${token}`,
      qrCode: await generateQRCode(`icypaa://share/${token}`),
      expiresAt
    };
  },
  
  // Step 2: Request to share
  requestShare: async (token: string, requesterId: string) => {
    // Validate token
    if (!isValidToken(token) || isExpired(token)) {
      throw new Error('Invalid or expired sharing link');
    }
    
    // Check if banned
    const isBanned = await checkIfBanned(requesterId, token.ownerId);
    if (isBanned) {
      throw new Error('Cannot share: User has blocked you');
    }
    
    // Add to pending requests
    await addToPendingRequests(token.ownerId, requesterId);
  },
  
  // Step 3: Approve/deny request
  handleShareRequest: async (requestId: string, approved: boolean) => {
    if (approved) {
      await approveShareRequest(requestId);
    } else {
      await denyShareRequest(requestId);
    }
  },
  
  // Step 4: Revoke access
  revokeAccess: async (userId: string, targetUserId: string) => {
    await removeFromSharedList(userId, targetUserId);
    await notifyRevocation(targetUserId);
  }
};
```

### Ban System Implementation

```typescript
// User blocking functionality
const banUser = async (userToBan: string) => {
  const { error } = await supabase
    .from('schedules')
    .update({
      banned: supabase.sql`array_append(banned, ${userToBan})`,
      shared_with: supabase.sql`array_remove(shared_with, ${userToBan})`,
      shared_by: supabase.sql`array_remove(shared_by, ${userToBan})`
    })
    .eq('device_id', deviceId);
  
  if (!error) {
    // Remove from local cache
    await removeFromLocalSharedSchedules(userToBan);
  }
};
```

## Client-Side Security

### Secure Storage

```typescript
// Hierarchical storage security
const storage = {
  // Public data - AsyncStorage
  public: {
    async set(key: string, value: any) {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    },
    async get(key: string) {
      const value = await AsyncStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    }
  },
  
  // Sensitive data - SecureStore
  secure: {
    async set(key: string, value: any) {
      await SecureStore.setItemAsync(key, JSON.stringify(value));
    },
    async get(key: string) {
      const value = await SecureStore.getItemAsync(key);
      return value ? JSON.parse(value) : null;
    }
  }
};
```

### Code Obfuscation

```javascript
// Metro configuration for production builds
module.exports = {
  transformer: {
    minifierConfig: {
      keep_fnames: false,
      mangle: {
        toplevel: true,
        keep_classnames: false,
        keep_fnames: false
      },
      output: {
        ascii_only: true,
        quote_style: 3
      }
    }
  }
};
```

### Anti-Tampering Measures

```typescript
// App integrity verification
const verifyAppIntegrity = async () => {
  if (__DEV__) return true;
  
  // Check for jailbreak/root
  const isJailbroken = await checkJailbreak();
  if (isJailbroken) {
    Alert.alert('Security Warning', 'This device appears to be jailbroken');
  }
  
  // Verify app signature
  const signature = await getAppSignature();
  const isValid = await verifySignature(signature, EXPECTED_SIGNATURE);
  
  if (!isValid) {
    Alert.alert('Security Error', 'App integrity check failed');
    return false;
  }
  
  return true;
};
```

## Security Best Practices

### Development Security

1. **Environment Variables**: Never commit secrets to version control
   ```bash
   # .env.local (gitignored)
   SUPABASE_URL=your_url_here
   SUPABASE_ANON_KEY=your_key_here
   SENTRY_DSN=your_dsn_here
   ```

2. **Dependency Management**: Regular security audits
   ```bash
   npm audit
   npm audit fix
   ```

3. **Code Reviews**: Security-focused review checklist
   - [ ] No hardcoded secrets
   - [ ] Input validation implemented
   - [ ] Authentication checks in place
   - [ ] RLS policies verified
   - [ ] Error messages don't leak sensitive info

### Production Security

1. **Monitoring**: Real-time security event monitoring
2. **Updates**: Regular security patches and updates
3. **Backups**: Encrypted, regular backups with tested restore procedures
4. **Access Control**: Principle of least privilege for all systems

### Security Headers

```typescript
// Security headers for API responses
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};
```

## Incident Response

### Security Incident Workflow

```
1. Detection
   ├── Automated monitoring alerts
   ├── User reports
   └── Security audits

2. Assessment
   ├── Determine severity
   ├── Identify affected systems
   └── Estimate impact

3. Containment
   ├── Isolate affected systems
   ├── Revoke compromised credentials
   └── Block malicious actors

4. Eradication
   ├── Remove threat
   ├── Patch vulnerabilities
   └── Update security measures

5. Recovery
   ├── Restore systems
   ├── Verify integrity
   └── Monitor for recurrence

6. Post-Incident
   ├── Document lessons learned
   ├── Update security procedures
   └── Notify affected users (if required)
```

### Emergency Contacts

```typescript
const SECURITY_CONTACTS = {
  primary: 'security@icypaa.org',
  escalation: 'admin@icypaa.org',
  sentry: 'alerts configured in Sentry dashboard',
  supabase: 'support@supabase.io'
};
```

## Compliance & Auditing

### Privacy Compliance

- **GDPR**: Right to erasure, data portability, explicit consent
- **CCPA**: Data disclosure, deletion rights, opt-out mechanisms
- **COPPA**: No data collection from users under 13
- **App Store Guidelines**: Apple privacy requirements met
- **Google Play Policies**: Android privacy requirements met

### Audit Logging

```sql
-- Audit log table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP DEFAULT NOW(),
  user_id UUID,
  device_id TEXT,
  action TEXT NOT NULL,
  resource TEXT,
  details JSONB,
  ip_address INET,
  user_agent TEXT
);

-- Audit trigger for sensitive operations
CREATE OR REPLACE FUNCTION audit_sensitive_operation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    user_id,
    device_id,
    action,
    resource,
    details
  ) VALUES (
    auth.uid(),
    current_setting('request.headers')::json->>'x-device-id',
    TG_OP,
    TG_TABLE_NAME,
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply audit trigger to sensitive tables
CREATE TRIGGER audit_user_changes
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION audit_sensitive_operation();
```

### Security Metrics

```typescript
// Security monitoring metrics
const securityMetrics = {
  // Authentication metrics
  failedLoginAttempts: 0,
  successfulLogins: 0,
  suspiciousLoginPatterns: [],
  
  // Authorization metrics
  unauthorizedAccessAttempts: 0,
  privilegeEscalationAttempts: 0,
  
  // Data protection metrics
  encryptionFailures: 0,
  dataLeakageIncidents: 0,
  
  // Network security metrics
  rateLimitViolations: 0,
  suspiciousNetworkActivity: [],
  
  // Compliance metrics
  gdprRequests: 0,
  dataBreaches: 0,
  securityAudits: []
};
```

## Security Checklist

### Pre-Deployment
- [ ] All dependencies updated and audited
- [ ] Security headers configured
- [ ] RLS policies tested and verified
- [ ] Authentication flows tested
- [ ] Input validation implemented
- [ ] Error messages sanitized
- [ ] Logging configured (no sensitive data)
- [ ] Rate limiting implemented
- [ ] SSL/TLS certificates valid

### Post-Deployment
- [ ] Security monitoring active
- [ ] Incident response plan in place
- [ ] Regular security audits scheduled
- [ ] Backup and recovery tested
- [ ] User data export/deletion working
- [ ] Privacy policy updated
- [ ] Security contact information published

## Conclusion

The ICYPAA mobile app implements comprehensive security measures to protect user privacy and data while maintaining the core principle of anonymity central to the AA community. Through multiple layers of security, explicit consent mechanisms, and minimal data collection, the app provides a secure platform for conference attendees while respecting their privacy and autonomy.