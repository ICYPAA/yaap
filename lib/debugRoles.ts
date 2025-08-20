import { supabase } from "./supabase"

/**
 * Debug function to test role access
 * Call this after successful login to diagnose role fetching issues
 */
export async function debugRoleAccess(userId?: string) {
  console.log("=== ROLE ACCESS DEBUG START ===")
  
  // 1. Check current session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  console.log("1. SESSION CHECK:")
  console.log("   - Session exists:", !!session)
  console.log("   - User ID:", session?.user?.id)
  console.log("   - User email:", session?.user?.email)
  console.log("   - Access token exists:", !!session?.access_token)
  console.log("   - Session error:", sessionError)
  
  const targetUserId = userId || session?.user?.id
  if (!targetUserId) {
    console.log("ERROR: No user ID available")
    return
  }
  
  // 2. Test direct query without RLS
  console.log("\n2. TESTING QUERIES FOR USER:", targetUserId)
  
  // Test 1: Basic select
  console.log("\n   Test 1: Basic select with RLS")
  const { data: test1, error: error1 } = await supabase
    .from("roles")
    .select("*")
    .eq("user_id", targetUserId)
  console.log("   - Data:", test1)
  console.log("   - Error:", error1)
  
  // Test 2: Count query
  console.log("\n   Test 2: Count query")
  const { count, error: countError } = await supabase
    .from("roles")
    .select("*", { count: 'exact', head: true })
    .eq("user_id", targetUserId)
  console.log("   - Count:", count)
  console.log("   - Error:", countError)
  
  // Test 3: Query without user_id filter to see if we can access table at all
  console.log("\n   Test 3: Query all roles (limited to 5)")
  const { data: allRoles, error: allError } = await supabase
    .from("roles")
    .select("user_id, role")
    .limit(5)
  console.log("   - Can access table:", !allError)
  console.log("   - Number of rows visible:", allRoles?.length || 0)
  console.log("   - Error:", allError)
  
  // Test 4: Try RPC call if available
  console.log("\n   Test 4: Check if user_id matches session")
  console.log("   - Target user_id:", targetUserId)
  console.log("   - Session user_id:", session?.user?.id)
  console.log("   - IDs match:", targetUserId === session?.user?.id)
  
  // Test 5: Try with different syntax
  console.log("\n   Test 5: Alternative query syntax")
  const { data: test5, error: error5 } = await supabase
    .from("roles")
    .select()
    .filter("user_id", "eq", targetUserId)
    .single()
  console.log("   - Data:", test5)
  console.log("   - Error:", error5)
  
  console.log("\n=== ROLE ACCESS DEBUG END ===")
  
  // Return summary
  return {
    hasSession: !!session,
    userId: targetUserId,
    canAccessTable: !allError,
    foundRole: !!test1 && test1.length > 0,
    roleData: test1?.[0] || null
  }
}

/**
 * Test creating or updating a role (requires appropriate permissions)
 */
export async function testRoleUpsert(userId: string, role: string = "host") {
  console.log("=== TESTING ROLE UPSERT ===")
  
  const { data, error } = await supabase
    .from("roles")
    .upsert({
      user_id: userId,
      role: role,
      permissions: [],
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    })
    .select()
  
  console.log("Upsert result:")
  console.log("- Data:", data)
  console.log("- Error:", error)
  
  return { data, error }
}