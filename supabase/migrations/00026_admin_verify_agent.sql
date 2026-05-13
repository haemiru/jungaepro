-- Super Admin: verify / unverify agent
-- Allows super admin to toggle agent_profiles.is_verified

CREATE OR REPLACE FUNCTION admin_verify_agent(
  target_agent_id UUID,
  verified BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.jwt() ->> 'email' NOT IN ('junominu@gmail.com') THEN
    RAISE EXCEPTION 'Unauthorized: super admin access only';
  END IF;

  UPDATE agent_profiles
  SET is_verified = verified
  WHERE id = target_agent_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agent not found';
  END IF;
END;
$$;
