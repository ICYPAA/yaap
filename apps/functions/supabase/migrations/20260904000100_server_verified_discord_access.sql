-- Discord OAuth creates the Supabase session, while this table records the
-- separate, server-side authorization decision for the configured host guild.

CREATE TABLE public.discord_memberships (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  discord_user_id text NOT NULL,
  guild_id text NOT NULL,
  discord_roles text[] NOT NULL DEFAULT '{}',
  is_member boolean NOT NULL DEFAULT false,
  verified_at timestamptz NOT NULL DEFAULT now(),
  verification_source text NOT NULL DEFAULT 'oauth'
    CHECK (verification_source IN ('oauth', 'bot')),
  UNIQUE (guild_id, discord_user_id)
);

-- Enforcement is deliberately opt-in so deploying the schema before the
-- guild secret, Edge Function, and synchronization worker cannot lock existing
-- Discord users out of the admin or mobile apps.
CREATE TABLE public.discord_access_config (
  id boolean PRIMARY KEY DEFAULT true,
  enforce_membership boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discord_access_config_singleton CHECK (id)
);

INSERT INTO public.discord_access_config (id, enforce_membership)
VALUES (true, false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.discord_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discord_access_config ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.discord_memberships TO authenticated;
GRANT ALL ON public.discord_memberships TO service_role;
REVOKE ALL ON public.discord_access_config FROM anon, authenticated;
GRANT ALL ON public.discord_access_config TO service_role;

-- Email/password accounts are explicitly provisioned recovery accounts. A
-- Discord session must also have a fresh, positive membership verification.
CREATE OR REPLACE FUNCTION public.has_valid_host_identity()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN COALESCE(auth.jwt() -> 'app_metadata' ->> 'provider', '') = 'email'
      THEN true
    WHEN COALESCE(auth.jwt() -> 'app_metadata' ->> 'provider', '') = 'discord'
      THEN
        NOT COALESCE((
          SELECT enforce_membership
          FROM public.discord_access_config
          WHERE discord_access_config.id = true
        ), false)
        OR EXISTS (
          SELECT 1
          FROM public.discord_memberships
          WHERE discord_memberships.user_id = auth.uid()
            AND discord_memberships.is_member
            AND discord_memberships.verified_at > now() - interval '7 days'
        )
    ELSE false
  END;
$$;

REVOKE ALL ON FUNCTION public.has_valid_host_identity() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_valid_host_identity() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_valid_host_identity() TO service_role;

CREATE OR REPLACE FUNCTION public.check_role_management_permission()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_valid_host_identity()
    AND EXISTS (
      SELECT 1
      FROM public.roles
      WHERE roles.user_id = auth.uid()
        AND roles.role IN ('admin', 'steering')
    );
$$;

REVOKE ALL ON FUNCTION public.check_role_management_permission() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_role_management_permission()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_role_management_permission()
  TO service_role;

CREATE OR REPLACE FUNCTION public.can_manage_conference()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_valid_host_identity()
    AND EXISTS (
      SELECT 1
      FROM public.roles
      WHERE roles.user_id = auth.uid()
        AND (
          roles.role IN ('admin', 'steering')
          OR roles.permissions @> ARRAY['program:edit']::text[]
        )
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_conference() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_conference() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_conference() TO service_role;

CREATE POLICY "Members can read their Discord verification"
ON public.discord_memberships
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.check_role_management_permission()
);

-- Hiding a user's role when their Discord verification is absent or stale
-- makes the existing role-based policies fail closed without duplicating the
-- membership expression across every host table.
DROP POLICY IF EXISTS "Authenticated users can get user's role" ON public.roles;

CREATE POLICY "Authorized users can read roles"
ON public.roles
FOR SELECT
TO authenticated
USING (
  (
    user_id = auth.uid()
    AND public.has_valid_host_identity()
  )
  OR public.check_role_management_permission()
);

-- This RPC is SECURITY DEFINER, so its sensitive-column decision must include
-- the same identity check explicitly rather than relying on roles RLS.
CREATE OR REPLACE FUNCTION public.get_volunteering_interest_safe()
RETURNS TABLE (
  id integer,
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
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    volunteering.id,
    volunteering.name,
    volunteering.last_initial,
    CASE WHEN public.has_valid_host_identity() AND EXISTS (
      SELECT 1
      FROM public.roles
      WHERE roles.user_id = auth.uid()
        AND (
          roles.role IN ('admin', 'steering')
          OR roles.permissions @> ARRAY['volunteering:sensitive']::text[]
        )
    ) THEN volunteering.email ELSE NULL END,
    CASE WHEN public.has_valid_host_identity() AND EXISTS (
      SELECT 1
      FROM public.roles
      WHERE roles.user_id = auth.uid()
        AND (
          roles.role IN ('admin', 'steering')
          OR roles.permissions @> ARRAY['volunteering:sensitive']::text[]
        )
    ) THEN volunteering.phone ELSE NULL END,
    volunteering.type,
    volunteering.data,
    volunteering.status,
    volunteering.created_at
  FROM public.volunteering_interest AS volunteering;
$$;

REVOKE ALL ON FUNCTION public.get_volunteering_interest_safe() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_volunteering_interest_safe()
  TO authenticated;
