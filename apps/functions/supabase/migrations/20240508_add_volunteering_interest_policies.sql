-- Create policy to enable all users to read non-sensitive volunteering_interest data
DROP POLICY IF EXISTS "Anyone can read volunteering interest" ON volunteering_interest;
CREATE POLICY "Authenticated users can read non-sensitive volunteering interest data" ON volunteering_interest
    FOR SELECT USING (auth.role() = 'authenticated');

-- Create policy specifically for sensitive data (email, phone) access
CREATE POLICY "Only authorized users can access sensitive volunteer data" ON volunteering_interest
    FOR SELECT
    USING (
        auth.role() = 'authenticated' AND (
            -- Check if the user has admin or steering role
            EXISTS (
                SELECT 1 FROM roles
                WHERE roles.user_id = auth.uid()
                AND roles.role IN ('admin', 'steering')
            )
            OR
            -- Check if the user has volunteering:sensitive permission
            EXISTS (
                SELECT 1 FROM roles
                WHERE roles.user_id = auth.uid()
                AND roles.permissions::text[] @> ARRAY['volunteering:sensitive']
            )
        )
    );

-- Create policy to enable all users to insert volunteering_interest
CREATE POLICY IF NOT EXISTS "Anyone can submit volunteering interest" ON volunteering_interest
    FOR INSERT WITH CHECK (true);

-- Create policy to allow only specific roles to update volunteering_interest
CREATE POLICY IF NOT EXISTS "Only admins, steering committee or members with volunteering:edit permission can update" ON volunteering_interest
    FOR UPDATE USING (
        auth.role() = 'authenticated' AND (
            -- Check if the user has admin or steering role
            EXISTS (
                SELECT 1 FROM roles
                WHERE roles.user_id = auth.uid()
                AND roles.role IN ('admin', 'steering')
            )
            OR
            -- Check if the user has volunteering:edit permission
            EXISTS (
                SELECT 1 FROM roles
                WHERE roles.user_id = auth.uid()
                AND roles.permissions::text[] @> ARRAY['volunteering:edit']
            )
        )
    );

-- Create policy to prevent users from deleting volunteering_interest records
-- Only allow deletion by users with admin role for data management purposes
CREATE POLICY IF NOT EXISTS "Only admins can delete volunteering interest" ON volunteering_interest
    FOR DELETE USING (
        auth.role() = 'authenticated' AND
        EXISTS (
            SELECT 1 FROM roles
            WHERE roles.user_id = auth.uid()
            AND roles.role = 'admin'
        )
    );

-- Create security definer function to get volunteering interest without sensitive data
CREATE OR REPLACE FUNCTION public.get_volunteering_interest_safe()
RETURNS TABLE (
    id int,
    name text,
    last_initial text,
    email text,
    phone text,
    type text,
    data jsonb,
    status text,
    created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT
        v.id,
        v.name,
        v.last_initial,
        -- Return email based on permissions
        CASE WHEN EXISTS (
            SELECT 1 FROM roles
            WHERE roles.user_id = auth.uid()
            AND (
                roles.role IN ('admin', 'steering') OR
                roles.permissions::text[] @> ARRAY['volunteering:sensitive']
            )
        ) THEN v.email ELSE NULL END as email,
        -- Return phone based on permissions
        CASE WHEN EXISTS (
            SELECT 1 FROM roles
            WHERE roles.user_id = auth.uid()
            AND (
                roles.role IN ('admin', 'steering') OR
                roles.permissions::text[] @> ARRAY['volunteering:sensitive']
            )
        ) THEN v.phone ELSE NULL END as phone,
        v.type,
        v.data,
        v.status,
        v.created_at
    FROM volunteering_interest v;
$$;