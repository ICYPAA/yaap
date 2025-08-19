import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';

/**
 * Security monitoring and metrics collection
 */

interface SecurityEvent {
  timestamp: number;
  type: SecurityEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
  userId?: string;
  deviceId?: string;
}

enum SecurityEventType {
  // Authentication events
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  LOGOUT = 'logout',
  SESSION_EXPIRED = 'session_expired',
  SESSION_REFRESHED = 'session_refreshed',
  
  // Authorization events
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  PERMISSION_DENIED = 'permission_denied',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  
  // Rate limiting events
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  
  // Data protection events
  ENCRYPTION_ERROR = 'encryption_error',
  DECRYPTION_ERROR = 'decryption_error',
  DATA_VALIDATION_FAILURE = 'data_validation_failure',
  
  // Integrity events
  JAILBREAK_DETECTED = 'jailbreak_detected',
  DEBUGGER_DETECTED = 'debugger_detected',
  SIGNATURE_MISMATCH = 'signature_mismatch',
  
  // Network security events
  CERTIFICATE_ERROR = 'certificate_error',
  INSECURE_CONNECTION = 'insecure_connection',
  MITM_SUSPECTED = 'mitm_suspected',
  
  // User actions
  SCHEDULE_SHARED = 'schedule_shared',
  USER_BANNED = 'user_banned',
  DATA_EXPORTED = 'data_exported',
  ACCOUNT_DELETED = 'account_deleted'
}

interface SecurityMetrics {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  failedLoginAttempts: number;
  successfulLogins: number;
  unauthorizedAttempts: number;
  rateLimitViolations: number;
  integrityViolations: number;
  lastResetTime: number;
}

class SecurityMonitor {
  private readonly EVENTS_KEY = 'security_events';
  private readonly METRICS_KEY = 'security_metrics';
  private readonly MAX_EVENTS = 1000;
  private readonly EVENT_RETENTION_DAYS = 30;
  private events: SecurityEvent[] = [];
  private metrics: SecurityMetrics;

  constructor() {
    this.metrics = this.getDefaultMetrics();
    this.loadEvents();
    this.loadMetrics();
  }

  /**
   * Logs a security event
   */
  async logEvent(
    type: SecurityEventType,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: Record<string, any> = {},
    userId?: string,
    deviceId?: string
  ): Promise<void> {
    const event: SecurityEvent = {
      timestamp: Date.now(),
      type,
      severity,
      details,
      userId,
      deviceId
    };

    // Add to in-memory events
    this.events.push(event);

    // Update metrics
    this.updateMetrics(event);

    // Persist events
    await this.saveEvents();
    await this.saveMetrics();

    // Send to monitoring service for high severity events
    if (severity === 'high' || severity === 'critical') {
      this.sendToMonitoringService(event);
    }

    // Log to console in development
    if (__DEV__) {
      console.log(`[Security Event] ${type}:`, {
        severity,
        details,
        userId: userId?.substring(0, 8) + '...',
        deviceId: deviceId?.substring(0, 8) + '...'
      });
    }
  }

  /**
   * Updates metrics based on event
   */
  private updateMetrics(event: SecurityEvent): void {
    this.metrics.totalEvents++;
    
    // Update event type count
    this.metrics.eventsByType[event.type] = 
      (this.metrics.eventsByType[event.type] || 0) + 1;
    
    // Update severity count
    this.metrics.eventsBySeverity[event.severity] = 
      (this.metrics.eventsBySeverity[event.severity] || 0) + 1;

    // Update specific metrics
    switch (event.type) {
      case SecurityEventType.LOGIN_SUCCESS:
        this.metrics.successfulLogins++;
        break;
      case SecurityEventType.LOGIN_FAILURE:
        this.metrics.failedLoginAttempts++;
        break;
      case SecurityEventType.UNAUTHORIZED_ACCESS:
      case SecurityEventType.PERMISSION_DENIED:
        this.metrics.unauthorizedAttempts++;
        break;
      case SecurityEventType.RATE_LIMIT_EXCEEDED:
        this.metrics.rateLimitViolations++;
        break;
      case SecurityEventType.JAILBREAK_DETECTED:
      case SecurityEventType.DEBUGGER_DETECTED:
      case SecurityEventType.SIGNATURE_MISMATCH:
        this.metrics.integrityViolations++;
        break;
    }
  }

  /**
   * Sends event to monitoring service (Sentry)
   */
  private sendToMonitoringService(event: SecurityEvent): void {
    try {
      Sentry.captureMessage(`Security Event: ${event.type}`, {
        level: this.mapSeverityToSentryLevel(event.severity),
        tags: {
          event_type: event.type,
          severity: event.severity
        },
        extra: {
          details: event.details,
          timestamp: new Date(event.timestamp).toISOString()
        }
      });
    } catch (error) {
      console.error('Failed to send event to Sentry:', error);
    }
  }

  /**
   * Maps severity to Sentry level
   */
  private mapSeverityToSentryLevel(severity: string): Sentry.SeverityLevel {
    switch (severity) {
      case 'critical':
        return 'fatal';
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
      default:
        return 'info';
    }
  }

  /**
   * Gets recent events
   */
  getRecentEvents(limit: number = 100): SecurityEvent[] {
    return this.events
      .slice(-limit)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Gets events by type
   */
  getEventsByType(type: SecurityEventType, limit: number = 100): SecurityEvent[] {
    return this.events
      .filter(e => e.type === type)
      .slice(-limit)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Gets current metrics
   */
  getMetrics(): SecurityMetrics {
    return { ...this.metrics };
  }

  /**
   * Checks for suspicious patterns
   */
  async checkForSuspiciousPatterns(): Promise<{
    suspicious: boolean;
    patterns: string[];
  }> {
    const patterns: string[] = [];
    const recentEvents = this.getRecentEvents(100);
    
    // Check for multiple failed login attempts
    const recentFailedLogins = recentEvents.filter(
      e => e.type === SecurityEventType.LOGIN_FAILURE &&
      e.timestamp > Date.now() - 5 * 60 * 1000 // Last 5 minutes
    );
    
    if (recentFailedLogins.length >= 5) {
      patterns.push('Multiple failed login attempts detected');
    }

    // Check for rate limit violations
    const rateLimitViolations = recentEvents.filter(
      e => e.type === SecurityEventType.RATE_LIMIT_EXCEEDED &&
      e.timestamp > Date.now() - 10 * 60 * 1000 // Last 10 minutes
    );
    
    if (rateLimitViolations.length >= 10) {
      patterns.push('Excessive rate limit violations');
    }

    // Check for authorization failures
    const authFailures = recentEvents.filter(
      e => (e.type === SecurityEventType.UNAUTHORIZED_ACCESS ||
            e.type === SecurityEventType.PERMISSION_DENIED) &&
      e.timestamp > Date.now() - 15 * 60 * 1000 // Last 15 minutes
    );
    
    if (authFailures.length >= 3) {
      patterns.push('Multiple authorization failures');
    }

    // Check for integrity violations
    const integrityIssues = recentEvents.filter(
      e => (e.type === SecurityEventType.JAILBREAK_DETECTED ||
            e.type === SecurityEventType.DEBUGGER_DETECTED ||
            e.type === SecurityEventType.SIGNATURE_MISMATCH)
    );
    
    if (integrityIssues.length > 0) {
      patterns.push('App integrity violations detected');
    }

    return {
      suspicious: patterns.length > 0,
      patterns
    };
  }

  /**
   * Loads events from storage
   */
  private async loadEvents(): Promise<void> {
    try {
      const eventsJson = await AsyncStorage.getItem(this.EVENTS_KEY);
      if (eventsJson) {
        const allEvents = JSON.parse(eventsJson) as SecurityEvent[];
        
        // Filter out old events
        const cutoffTime = Date.now() - (this.EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
        this.events = allEvents.filter(e => e.timestamp > cutoffTime);
        
        // Limit to max events
        if (this.events.length > this.MAX_EVENTS) {
          this.events = this.events.slice(-this.MAX_EVENTS);
        }
      }
    } catch (error) {
      console.error('Error loading security events:', error);
      this.events = [];
    }
  }

  /**
   * Saves events to storage
   */
  private async saveEvents(): Promise<void> {
    try {
      // Clean up old events
      const cutoffTime = Date.now() - (this.EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      this.events = this.events.filter(e => e.timestamp > cutoffTime);
      
      // Limit to max events
      if (this.events.length > this.MAX_EVENTS) {
        this.events = this.events.slice(-this.MAX_EVENTS);
      }
      
      await AsyncStorage.setItem(this.EVENTS_KEY, JSON.stringify(this.events));
    } catch (error) {
      console.error('Error saving security events:', error);
    }
  }

  /**
   * Loads metrics from storage
   */
  private async loadMetrics(): Promise<void> {
    try {
      const metricsJson = await AsyncStorage.getItem(this.METRICS_KEY);
      if (metricsJson) {
        this.metrics = JSON.parse(metricsJson);
      }
    } catch (error) {
      console.error('Error loading security metrics:', error);
      this.metrics = this.getDefaultMetrics();
    }
  }

  /**
   * Saves metrics to storage
   */
  private async saveMetrics(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.METRICS_KEY, JSON.stringify(this.metrics));
    } catch (error) {
      console.error('Error saving security metrics:', error);
    }
  }

  /**
   * Gets default metrics
   */
  private getDefaultMetrics(): SecurityMetrics {
    return {
      totalEvents: 0,
      eventsByType: {},
      eventsBySeverity: {},
      failedLoginAttempts: 0,
      successfulLogins: 0,
      unauthorizedAttempts: 0,
      rateLimitViolations: 0,
      integrityViolations: 0,
      lastResetTime: Date.now()
    };
  }

  /**
   * Resets metrics
   */
  async resetMetrics(): Promise<void> {
    this.metrics = this.getDefaultMetrics();
    await this.saveMetrics();
  }

  /**
   * Exports security report
   */
  async exportSecurityReport(): Promise<string> {
    const report = {
      generated_at: new Date().toISOString(),
      metrics: this.metrics,
      recent_events: this.getRecentEvents(50),
      suspicious_patterns: await this.checkForSuspiciousPatterns()
    };
    
    return JSON.stringify(report, null, 2);
  }
}

// Singleton instance
let monitorInstance: SecurityMonitor | null = null;

/**
 * Gets the singleton security monitor instance
 */
export const getSecurityMonitor = (): SecurityMonitor => {
  if (!monitorInstance) {
    monitorInstance = new SecurityMonitor();
  }
  return monitorInstance;
};

/**
 * Convenience function to log security events
 */
export const logSecurityEvent = async (
  type: SecurityEventType,
  severity: 'low' | 'medium' | 'high' | 'critical',
  details: Record<string, any> = {},
  userId?: string,
  deviceId?: string
): Promise<void> => {
  const monitor = getSecurityMonitor();
  await monitor.logEvent(type, severity, details, userId, deviceId);
};

/**
 * React hook for security monitoring
 */
export const useSecurityMonitor = () => {
  const monitor = getSecurityMonitor();
  
  return {
    logEvent: (
      type: SecurityEventType,
      severity: 'low' | 'medium' | 'high' | 'critical',
      details?: Record<string, any>
    ) => monitor.logEvent(type, severity, details),
    getMetrics: () => monitor.getMetrics(),
    getRecentEvents: (limit?: number) => monitor.getRecentEvents(limit),
    checkSuspiciousPatterns: () => monitor.checkForSuspiciousPatterns(),
    exportReport: () => monitor.exportSecurityReport()
  };
};

// Export event types for use in other modules
export { SecurityEventType };