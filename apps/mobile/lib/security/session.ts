import { supabase } from '../supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { Session } from '@supabase/supabase-js';

/**
 * Session management with auto-refresh and security features
 */

const SESSION_KEY = 'supabase_session';
const SESSION_REFRESH_THRESHOLD = 60 * 60; // Refresh if less than 1 hour remaining
const SESSION_CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
const MAX_SESSION_AGE = 7 * 24 * 60 * 60; // 7 days

class SessionManager {
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: any = null;
  private sessionStartTime: number = Date.now();
  private refreshAttempts: number = 0;
  private maxRefreshAttempts: number = 3;

  /**
   * Initializes the session manager
   */
  async initialize(): Promise<void> {
    // Restore session from storage
    await this.restoreSession();

    // Set up automatic session refresh
    this.startSessionCheck();

    // Monitor app state changes
    this.monitorAppState();

    // Listen for auth state changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await this.saveSession(session);
        this.refreshAttempts = 0;
      } else if (event === 'SIGNED_OUT') {
        await this.clearSession();
      }
    });
  }

  /**
   * Restores session from secure storage
   */
  private async restoreSession(): Promise<Session | null> {
    try {
      const sessionJson = await AsyncStorage.getItem(SESSION_KEY);
      
      if (!sessionJson) {
        return null;
      }

      const session = JSON.parse(sessionJson) as Session;

      // Validate session age
      if (this.isSessionTooOld(session)) {
        await this.clearSession();
        return null;
      }

      // Set the session in Supabase
      const { data, error } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token
      });

      if (error) {
        console.error('Error restoring session:', error);
        await this.clearSession();
        return null;
      }

      return data.session;
    } catch (error) {
      console.error('Error restoring session:', error);
      await this.clearSession();
      return null;
    }
  }

  /**
   * Saves session to secure storage
   */
  private async saveSession(session: Session | null): Promise<void> {
    try {
      if (!session) {
        await this.clearSession();
        return;
      }

      // Add metadata to session
      const sessionWithMetadata = {
        ...session,
        saved_at: Date.now(),
        app_version: process.env.EXPO_PUBLIC_APP_VERSION
      };

      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(sessionWithMetadata));
      this.sessionStartTime = Date.now();
    } catch (error) {
      console.error('Error saving session:', error);
    }
  }

  /**
   * Clears the session from storage
   */
  private async clearSession(): Promise<void> {
    try {
      await AsyncStorage.removeItem(SESSION_KEY);
      this.refreshAttempts = 0;
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  }

  /**
   * Checks if session needs refresh
   */
  private async checkAndRefreshSession(): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        return;
      }

      // Supabase returns expires_at as Unix timestamp in seconds
      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
      const now = Date.now();
      const timeUntilExpiry = (expiresAt - now) / 1000;

      // Refresh if less than threshold remaining
      if (timeUntilExpiry < SESSION_REFRESH_THRESHOLD) {
        await this.refreshSession();
      }
    } catch (error) {
      console.error('Error checking session:', error);
    }
  }

  /**
   * Refreshes the current session
   */
  async refreshSession(): Promise<Session | null> {
    try {
      if (this.refreshAttempts >= this.maxRefreshAttempts) {
        console.error('Max refresh attempts reached, signing out');
        await supabase.auth.signOut();
        return null;
      }

      this.refreshAttempts++;
      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        console.error('Error refreshing session:', error);
        
        if (error.message.includes('Invalid Refresh Token')) {
          // Token is invalid, force re-authentication
          await supabase.auth.signOut();
        }
        
        return null;
      }

      if (data.session) {
        await this.saveSession(data.session);
        this.refreshAttempts = 0;
      }

      return data.session;
    } catch (error) {
      console.error('Error refreshing session:', error);
      return null;
    }
  }

  /**
   * Starts the periodic session check
   */
  private startSessionCheck(): void {
    // Clear any existing interval
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Check immediately
    this.checkAndRefreshSession();

    // Set up periodic check
    this.checkInterval = setInterval(() => {
      this.checkAndRefreshSession();
    }, SESSION_CHECK_INTERVAL);
  }

  /**
   * Stops the periodic session check
   */
  private stopSessionCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Monitors app state changes
   */
  private monitorAppState(): void {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active') {
          this.startSessionCheck();
        } else if (nextAppState === 'background') {
          this.stopSessionCheck();
        }
      }
    );
  }

  /**
   * Checks if a session is too old
   */
  private isSessionTooOld(session: any): boolean {
    if (!session.saved_at) {
      return false;
    }

    const age = (Date.now() - session.saved_at) / 1000;
    return age > MAX_SESSION_AGE;
  }

  /**
   * Gets the current session
   */
  async getSession(): Promise<Session | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  }

  /**
   * Signs out and clears session
   */
  async signOut(): Promise<void> {
    await supabase.auth.signOut();
    await this.clearSession();
  }

  /**
   * Validates the current session
   */
  async validateSession(): Promise<boolean> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      return !error && !!user;
    } catch {
      return false;
    }
  }

  /**
   * Gets session metadata
   */
  async getSessionMetadata(): Promise<{
    isActive: boolean;
    expiresIn: number | null;
    userId: string | null;
    email: string | null;
  }> {
    const session = await this.getSession();

    if (!session) {
      return {
        isActive: false,
        expiresIn: null,
        userId: null,
        email: null
      };
    }

    // Supabase returns expires_at as Unix timestamp in seconds
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    const expiresIn = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));

    return {
      isActive: true,
      expiresIn,
      userId: session.user?.id || null,
      email: session.user?.email || null
    };
  }

  /**
   * Cleanup on unmount
   */
  cleanup(): void {
    this.stopSessionCheck();
    
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }
}

// Singleton instance
let sessionManagerInstance: SessionManager | null = null;

/**
 * Gets the singleton session manager instance
 */
export const getSessionManager = (): SessionManager => {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager();
  }
  return sessionManagerInstance;
};

/**
 * React hook for session management
 */
export const useSession = () => {
  const sessionManager = getSessionManager();
  
  return {
    getSession: () => sessionManager.getSession(),
    refreshSession: () => sessionManager.refreshSession(),
    validateSession: () => sessionManager.validateSession(),
    getMetadata: () => sessionManager.getSessionMetadata(),
    signOut: () => sessionManager.signOut()
  };
};
