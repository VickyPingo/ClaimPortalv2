export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      brokerages: {
        Row: {
          id: string
          name: string
          logo_url: string | null
          brand_color: string | null
          notification_email: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          logo_url?: string | null
          brand_color?: string | null
          notification_email?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          logo_url?: string | null
          brand_color?: string | null
          notification_email?: string | null
          created_at?: string
        }
      }
      broker_users: {
        Row: {
          id: string
          brokerage_id: string
          phone: string
          name: string
          role: string
          created_at: string
        }
        Insert: {
          id?: string
          brokerage_id: string
          phone: string
          name: string
          role?: string
          created_at?: string
        }
        Update: {
          id?: string
          brokerage_id?: string
          phone?: string
          name?: string
          role?: string
          created_at?: string
        }
      }
      clients: {
        Row: {
          id: string
          brokerage_id: string
          phone: string
          name: string | null
          created_at: string
        }
        Insert: {
          id?: string
          brokerage_id: string
          phone: string
          name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          brokerage_id?: string
          phone?: string
          name?: string | null
          created_at?: string
        }
      }
      claims: {
        Row: {
          id: string
          brokerage_id: string
          client_id: string | null
          claimant_name: string | null
          claimant_phone: string | null
          claimant_email: string | null
          incident_type: 'motor_accident' | 'burst_geyser'
          status: 'new' | 'investigating' | 'resolved'
          location_lat: number | null
          location_lng: number | null
          location_address: string | null
          accident_date_time: string | null
          car_condition: string | null
          panel_beater_location: string | null
          driver_license_photo_url: string | null
          license_disk_photo_url: string | null
          third_party_license_photo_url: string | null
          third_party_disk_photo_url: string | null
          damage_photo_urls: Json | null
          voice_note_url: string | null
          voice_transcript_en: string | null
          third_party_details: Json | null
          media_urls: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          brokerage_id: string
          client_id?: string | null
          claimant_name?: string | null
          claimant_phone?: string | null
          claimant_email?: string | null
          incident_type: 'motor_accident' | 'burst_geyser'
          status?: 'new' | 'investigating' | 'resolved'
          location_lat?: number | null
          location_lng?: number | null
          location_address?: string | null
          accident_date_time?: string | null
          car_condition?: string | null
          panel_beater_location?: string | null
          driver_license_photo_url?: string | null
          license_disk_photo_url?: string | null
          third_party_license_photo_url?: string | null
          third_party_disk_photo_url?: string | null
          damage_photo_urls?: Json | null
          voice_note_url?: string | null
          voice_transcript_en?: string | null
          third_party_details?: Json | null
          media_urls?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          brokerage_id?: string
          client_id?: string | null
          claimant_name?: string | null
          claimant_phone?: string | null
          claimant_email?: string | null
          incident_type?: 'motor_accident' | 'burst_geyser'
          status?: 'new' | 'investigating' | 'resolved'
          location_lat?: number | null
          location_lng?: number | null
          location_address?: string | null
          accident_date_time?: string | null
          car_condition?: string | null
          panel_beater_location?: string | null
          driver_license_photo_url?: string | null
          license_disk_photo_url?: string | null
          third_party_license_photo_url?: string | null
          third_party_disk_photo_url?: string | null
          damage_photo_urls?: Json | null
          voice_note_url?: string | null
          voice_transcript_en?: string | null
          third_party_details?: Json | null
          media_urls?: Json
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
