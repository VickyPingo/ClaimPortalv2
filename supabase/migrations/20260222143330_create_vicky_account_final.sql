/*
  # Create Super Admin Account - vickypingo@gmail.com
  
  Creates authentication user with password Pretoria@1981
  Trigger will automatically create profile in profiles table
*/

DO $$
DECLARE
  new_user_id uuid;
BEGIN
  -- Check if user already exists
  SELECT id INTO new_user_id FROM auth.users WHERE email = 'vickypingo@gmail.com';
  
  IF new_user_id IS NULL THEN
    -- Generate ID
    new_user_id := gen_random_uuid();
    
    -- Create the auth user
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_user_id,
      'authenticated',
      'authenticated',
      'vickypingo@gmail.com',
      crypt('Pretoria@1981', gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Vicky Pingo"}',
      NOW(),
      NOW(),
      '',
      '',
      ''
    );
    
    -- Create identity
    INSERT INTO auth.identities (
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      new_user_id::text,
      new_user_id,
      format('{"sub":"%s","email":"vickypingo@gmail.com","email_verified":true,"provider":"email"}', new_user_id)::jsonb,
      'email',
      NOW(),
      NOW(),
      NOW()
    );
    
    RAISE NOTICE 'Created super admin account for vickypingo@gmail.com with ID: %', new_user_id;
  ELSE
    -- Update password for existing user
    UPDATE auth.users 
    SET 
      encrypted_password = crypt('Pretoria@1981', gen_salt('bf')),
      updated_at = NOW(),
      email_confirmed_at = NOW()
    WHERE id = new_user_id;
    
    RAISE NOTICE 'Updated password for vickypingo@gmail.com';
  END IF;
END $$;
