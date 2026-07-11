-- 신규 개공 가입 시 자동 승인 (사용자 결정 2026-07-12)
-- 1) agent_profiles.is_verified 기본값 false → true
-- 2) handle_new_user 트리거의 프로필 생성 시 is_verified = true
-- 효과: 가입 즉시 공개 포털(slug.jungaepro.com)이 살아나 온보딩 병목 제거.
--       자격 검증은 사후에 슈퍼관리자가 필요 시 인증 해제로 처리.

ALTER TABLE public.agent_profiles ALTER COLUMN is_verified SET DEFAULT true;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  _agent_data JSONB;
  _invite_code TEXT;
  _staff_role TEXT;
  _agent_profile_id UUID;
BEGIN
  INSERT INTO public.users (id, email, role, display_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      (NEW.raw_user_meta_data ->> 'role')::public.user_role,
      'customer'
    ),
    COALESCE(
      NEW.raw_user_meta_data ->> 'display_name',
      SPLIT_PART(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data ->> 'phone'
  )
  ON CONFLICT (id) DO NOTHING;

  -- agent_profiles 자동 생성 (자동 승인: is_verified = true)
  IF (NEW.raw_user_meta_data ->> 'role') = 'agent' THEN
    _agent_data := NEW.raw_user_meta_data -> 'agent_data';
    IF _agent_data IS NOT NULL THEN
      INSERT INTO public.agent_profiles (
        user_id, office_name, representative, business_number,
        license_number, address, phone, is_verified
      ) VALUES (
        NEW.id,
        _agent_data ->> 'officeName',
        _agent_data ->> 'representative',
        _agent_data ->> 'businessNumber',
        _agent_data ->> 'licenseNumber',
        _agent_data ->> 'address',
        _agent_data ->> 'phone',
        true
      )
      ON CONFLICT (user_id) DO NOTHING;
    END IF;
  END IF;

  -- staff 초대코드 처리: agent_settings 테이블에서 조회
  IF (NEW.raw_user_meta_data ->> 'role') = 'staff' THEN
    _invite_code := NEW.raw_user_meta_data ->> 'invite_code';
    _staff_role := COALESCE(NEW.raw_user_meta_data ->> 'staff_role', 'assistant');

    IF _invite_code IS NOT NULL THEN
      SELECT ap.id INTO _agent_profile_id
        FROM public.agent_settings s
        JOIN public.agent_profiles ap ON ap.id = s.agent_id
        WHERE s.setting_key = 'invite_code'
          AND (s.setting_value ->> 'code') = UPPER(_invite_code);

      IF _agent_profile_id IS NOT NULL THEN
        INSERT INTO public.staff_members (
          agent_profile_id, user_id, role, permissions, is_active
        ) VALUES (
          _agent_profile_id,
          NEW.id,
          _staff_role::public.staff_role,
          CASE WHEN _staff_role = 'associate_agent'
            THEN '{"property_create":true,"property_delete":false,"contract_create":true,"contract_approve":false,"e_signature":false,"customer_view":true,"ai_tools":true,"co_brokerage":false,"settings":false}'::jsonb
            ELSE '{"property_create":true,"property_delete":false,"contract_create":false,"contract_approve":false,"e_signature":false,"customer_view":true,"ai_tools":false,"co_brokerage":false,"settings":false}'::jsonb
          END,
          true
        )
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
