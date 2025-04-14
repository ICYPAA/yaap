import { addDeviceIdHeader, supabase } from "./supabase"

// Wrapper for Supabase queries that adds device ID headers
export const supabaseWithDeviceId = {
  // Wrapper for 'from' to add device ID header to all operations
  from: (table: string) => {
    const query = supabase.from(table)

    // Wrap each method to add device ID header
    const enhancedQuery = {
      ...query,

      // Enhanced select method
      select: async (columns?: string, options?: any) => {
        const headers = await addDeviceIdHeader()
        return query.select(columns, options).headers(headers)
      },

      // Enhanced insert method
      insert: async (values: any, options?: any) => {
        const headers = await addDeviceIdHeader()
        return query.insert(values, options).headers(headers)
      },

      // Enhanced update method
      update: async (values: any, options?: any) => {
        const headers = await addDeviceIdHeader()
        return query.update(values, options).headers(headers)
      },

      // Enhanced delete method
      delete: async (options?: any) => {
        const headers = await addDeviceIdHeader()
        return query.delete(options).headers(headers)
      },

      // Pass through other methods
      eq: (column: string, value: any) => {
        return enhancedQuery
      },
      neq: (column: string, value: any) => {
        return enhancedQuery
      },
      in: (column: string, values: any[]) => {
        return enhancedQuery
      }
      // Add other filter methods as needed
    }

    return enhancedQuery
  },

  // Add other methods as needed (auth, storage, etc.)
  auth: supabase.auth,
  storage: supabase.storage,
  rpc: async (functionName: string, params?: any) => {
    const headers = await addDeviceIdHeader()
    return supabase.rpc(functionName, params).headers(headers)
  }
}

// Example usage:
// Instead of: supabase.from('table').select()
// Use: supabaseWithDeviceId.from('table').select()
