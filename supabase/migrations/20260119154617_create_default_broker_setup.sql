/*
  # Create Default Brokerage and Setup

  ## Changes
  Creates a default brokerage for testing and development purposes.

  ## 1. Default Data
  - Creates a default brokerage with a known UUID
  - This brokerage will be used for demo purposes

  ## 2. Important Notes
  - Brokers can sign up and will be automatically added to this brokerage
  - In production, each brokerage would have their own instance
*/

-- Create default brokerage if it doesn't exist
INSERT INTO brokerages (id, name, brand_color)
VALUES ('00000000-0000-0000-0000-000000000001', 'Demo Brokerage', '#1e40af')
ON CONFLICT (id) DO NOTHING;
