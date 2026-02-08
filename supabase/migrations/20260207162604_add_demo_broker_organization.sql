/*
  # Add Demo Broker Organization
  
  1. Changes
    - Insert 'Demo Broker' organization with slug 'demo'
    - This gives you a test broker organization to log into
    
  2. Notes
    - Uses a fixed UUID so it's consistent across deployments
    - Slug 'demo' allows access via demo.yourdomain.com in production
*/

-- Insert Demo Broker organization
INSERT INTO organizations (id, name, slug, primary_color, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Demo Broker',
  'demo',
  '#1e40af',
  now()
)
ON CONFLICT (id) DO NOTHING;
