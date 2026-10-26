// ⚠️ 임시 DB 타입 — PGlite 로 베이스라인 마이그레이션을 적용해 생성 (_integration/tools/gen-types.mjs)
// 실 Supabase 연결 후 `npm run db:types` 결과로 반드시 교체한다 (병합 3파트 계획 · 파트 2).
// 생성: 2026-10-26T08:41:08.128Z · 마이그레이션: 20261006000100_a_foundation.sql, 20261006000200_b_designs_materials_estimates.sql, 20261006000300_c_requests_photos_schedule.sql, 20261006000900_a_grants_hardening.sql, 20261013000100_a_password_reset_scope.sql, 20261013000110_a_field_project_scope.sql, 20261013000120_a_file_visibility.sql, 20261013000130_a_assignment_notify.sql, 20261013000140_a_client_projects_archive.sql, 20261013000150_a_created_by_defaults.sql, 20261013000200_b_confirmations_reconfirm.sql, 20261013000210_b_created_by_defaults.sql, 20261013000300_c_request_status_guard.sql, 20261024000100_a_home_template.sql, 20261025000100_a_page_theme.sql, 20261026000100_a_site_admin.sql

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      admin_audit_events: {
        Row: {
          id: number
          actor_id: string | null
          action: string
          target_type: string
          target_id: string | null
          detail: Json
          occurred_at: string
        }
        Insert: {
          id?: never
          actor_id?: string | null
          action: string
          target_type: string
          target_id?: string | null
          detail?: Json
          occurred_at?: string
        }
        Update: {
          id?: never
          actor_id?: string | null
          action?: string
          target_type?: string
          target_id?: string | null
          detail?: Json
          occurred_at?: string
        }
        Relationships: []
      }
      audit_events: {
        Row: {
          id: number
          company_id: string | null
          project_id: string | null
          actor_id: string | null
          event_type: string
          object_type: string
          object_id: string
          before: Json | null
          after: Json | null
          occurred_at: string
        }
        Insert: {
          id?: never
          company_id?: string | null
          project_id?: string | null
          actor_id?: string | null
          event_type: string
          object_type: string
          object_id: string
          before?: Json | null
          after?: Json | null
          occurred_at?: string
        }
        Update: {
          id?: never
          company_id?: string | null
          project_id?: string | null
          actor_id?: string | null
          event_type?: string
          object_type?: string
          object_id?: string
          before?: Json | null
          after?: Json | null
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      client_projects: {
        Row: {
          id: string
          company_id: string
          client_id: string
          project_id: string
          created_at: string
          archived_at: string | null
        }
        Insert: {
          id?: string
          company_id: string
          client_id: string
          project_id: string
          created_at?: string
          archived_at?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          client_id?: string
          project_id?: string
          created_at?: string
          archived_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          id: string
          company_id: string
          name: string
          phone: string
          email: string | null
          memo: string
          user_id: string | null
          created_by: string
          created_at: string
          updated_at: string
          archived_at: string | null
          version: number
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          phone?: string
          email?: string | null
          memo?: string
          user_id?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
          archived_at?: string | null
          version?: number
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          phone?: string
          email?: string | null
          memo?: string
          user_id?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
          archived_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          id: string
          slug: string
          name: string
          logo_file_id: string | null
          created_by: string
          created_at: string
          updated_at: string
          version: number
        }
        Insert: {
          id?: string
          slug: string
          name: string
          logo_file_id?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
          version?: number
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          logo_file_id?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "companies_logo_file_id_fkey"
            columns: ["logo_file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          id: string
          company_id: string
          user_id: string
          role: Database["public"]["Enums"]["member_role"]
          removed_at: string | null
          created_at: string
          updated_at: string
          version: number
        }
        Insert: {
          id?: string
          company_id: string
          user_id: string
          role: Database["public"]["Enums"]["member_role"]
          removed_at?: string | null
          created_at?: string
          updated_at?: string
          version?: number
        }
        Update: {
          id?: string
          company_id?: string
          user_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          removed_at?: string | null
          created_at?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_quotas: {
        Row: {
          company_id: string
          quota_bytes: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          quota_bytes?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          quota_bytes?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_quotas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          company_id: string
          default_home_message: string
          updated_at: string
          version: number
          id: string | null
          default_home_sections: Json
          default_home_theme: string
          default_page_images: Json
          default_page_tone: string
        }
        Insert: {
          company_id: string
          default_home_message?: string
          updated_at?: string
          version?: number
          id?: never
          default_home_sections?: Json
          default_home_theme?: string
          default_page_images?: Json
          default_page_tone?: string
        }
        Update: {
          company_id?: string
          default_home_message?: string
          updated_at?: string
          version?: number
          id?: never
          default_home_sections?: Json
          default_home_theme?: string
          default_page_images?: Json
          default_page_tone?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      confirmations: {
        Row: {
          id: string
          company_id: string
          project_id: string
          target_type: string
          target_id: string
          target_revision: number
          snapshot: Json
          confirmed_by: string
          confirmed_at: string
          invalidated_at: string | null
          invalidated_by: string | null
          invalidated_reason: string | null
        }
        Insert: {
          id?: string
          company_id: string
          project_id: string
          target_type: string
          target_id: string
          target_revision: number
          snapshot: Json
          confirmed_by: string
          confirmed_at?: string
          invalidated_at?: string | null
          invalidated_by?: string | null
          invalidated_reason?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          project_id?: string
          target_type?: string
          target_id?: string
          target_revision?: number
          snapshot?: Json
          confirmed_by?: string
          confirmed_at?: string
          invalidated_at?: string | null
          invalidated_by?: string | null
          invalidated_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "confirmations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "confirmations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      design_previews: {
        Row: {
          id: string
          company_id: string
          project_id: string
          design_id: string
          design_version_id: string | null
          file_id: string
          label: string
          pdf_page: number | null
          created_by: string
          created_at: string
          archived_at: string | null
        }
        Insert: {
          id?: string
          company_id: string
          project_id: string
          design_id: string
          design_version_id?: string | null
          file_id: string
          label: string
          pdf_page?: number | null
          created_by: string
          created_at?: string
          archived_at?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          project_id?: string
          design_id?: string
          design_version_id?: string | null
          file_id?: string
          label?: string
          pdf_page?: number | null
          created_by?: string
          created_at?: string
          archived_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "design_previews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_previews_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "designs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_previews_design_version_id_fkey"
            columns: ["design_version_id"]
            isOneToOne: false
            referencedRelation: "design_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_previews_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: true
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_previews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      design_versions: {
        Row: {
          id: string
          company_id: string
          project_id: string
          design_id: string
          version_no: number
          file_id: string
          note: string
          uploaded_by: string
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          project_id: string
          design_id: string
          version_no: number
          file_id: string
          note?: string
          uploaded_by: string
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          project_id?: string
          design_id?: string
          version_no?: number
          file_id?: string
          note?: string
          uploaded_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_versions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_versions_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "designs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_versions_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: true
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      designs: {
        Row: {
          id: string
          company_id: string
          project_id: string
          title: string
          description: string
          is_public: boolean
          confirm_state: Database["public"]["Enums"]["confirm_state"]
          current_version: number
          created_by: string
          created_at: string
          updated_at: string
          archived_at: string | null
          version: number
        }
        Insert: {
          id?: string
          company_id: string
          project_id: string
          title: string
          description?: string
          is_public?: boolean
          confirm_state?: Database["public"]["Enums"]["confirm_state"]
          current_version?: number
          created_by: string
          created_at?: string
          updated_at?: string
          archived_at?: string | null
          version?: number
        }
        Update: {
          id?: string
          company_id?: string
          project_id?: string
          title?: string
          description?: string
          is_public?: boolean
          confirm_state?: Database["public"]["Enums"]["confirm_state"]
          current_version?: number
          created_by?: string
          created_at?: string
          updated_at?: string
          archived_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "designs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "designs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_versions: {
        Row: {
          id: string
          company_id: string
          project_id: string
          estimate_id: string
          version_no: number
          version_label: string
          file_id: string
          change_note: string
          is_public: boolean
          published_at: string | null
          uploaded_by: string
          created_at: string
          updated_at: string
          archived_at: string | null
          version: number
        }
        Insert: {
          id?: string
          company_id: string
          project_id: string
          estimate_id: string
          version_no: number
          version_label: string
          file_id: string
          change_note: string
          is_public?: boolean
          published_at?: string | null
          uploaded_by: string
          created_at?: string
          updated_at?: string
          archived_at?: string | null
          version?: number
        }
        Update: {
          id?: string
          company_id?: string
          project_id?: string
          estimate_id?: string
          version_no?: number
          version_label?: string
          file_id?: string
          change_note?: string
          is_public?: boolean
          published_at?: string | null
          uploaded_by?: string
          created_at?: string
          updated_at?: string
          archived_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "estimate_versions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_versions_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_versions_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: true
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates: {
        Row: {
          id: string
          company_id: string
          project_id: string
          title: string
          created_by: string
          created_at: string
          updated_at: string
          archived_at: string | null
          version: number
        }
        Insert: {
          id?: string
          company_id: string
          project_id: string
          title: string
          created_by: string
          created_at?: string
          updated_at?: string
          archived_at?: string | null
          version?: number
        }
        Update: {
          id?: string
          company_id?: string
          project_id?: string
          title?: string
          created_by?: string
          created_at?: string
          updated_at?: string
          archived_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "estimates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          id: string
          company_id: string
          project_id: string | null
          kind: Database["public"]["Enums"]["file_kind"]
          bucket: string
          path: string
          original_name: string
          mime: string
          size_bytes: number
          sha256: string | null
          status: Database["public"]["Enums"]["file_status"]
          reject_reason: string | null
          width: number | null
          height: number | null
          derived_from: string | null
          owner_type: string | null
          owner_id: string | null
          uploaded_by: string
          created_at: string
          finalized_at: string | null
        }
        Insert: {
          id?: string
          company_id: string
          project_id?: string | null
          kind: Database["public"]["Enums"]["file_kind"]
          bucket?: string
          path: string
          original_name: string
          mime: string
          size_bytes: number
          sha256?: string | null
          status?: Database["public"]["Enums"]["file_status"]
          reject_reason?: string | null
          width?: number | null
          height?: number | null
          derived_from?: string | null
          owner_type?: string | null
          owner_id?: string | null
          uploaded_by: string
          created_at?: string
          finalized_at?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          project_id?: string | null
          kind?: Database["public"]["Enums"]["file_kind"]
          bucket?: string
          path?: string
          original_name?: string
          mime?: string
          size_bytes?: number
          sha256?: string | null
          status?: Database["public"]["Enums"]["file_status"]
          reject_reason?: string | null
          width?: number | null
          height?: number | null
          derived_from?: string | null
          owner_type?: string | null
          owner_id?: string | null
          uploaded_by?: string
          created_at?: string
          finalized_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "files_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_derived_from_fkey"
            columns: ["derived_from"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          id: string
          company_id: string
          project_id: string | null
          email: string
          member_role: Database["public"]["Enums"]["member_role"] | null
          participant_role: Database["public"]["Enums"]["participant_role"] | null
          can_confirm: boolean
          valid_from: string | null
          valid_until: string | null
          token_hash: string
          expires_at: string
          created_by: string
          created_at: string
          accepted_at: string | null
          accepted_by: string | null
          revoked_at: string | null
        }
        Insert: {
          id?: string
          company_id: string
          project_id?: string | null
          email: string
          member_role?: Database["public"]["Enums"]["member_role"] | null
          participant_role?: Database["public"]["Enums"]["participant_role"] | null
          can_confirm?: boolean
          valid_from?: string | null
          valid_until?: string | null
          token_hash: string
          expires_at?: string
          created_by: string
          created_at?: string
          accepted_at?: string | null
          accepted_by?: string | null
          revoked_at?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          project_id?: string | null
          email?: string
          member_role?: Database["public"]["Enums"]["member_role"] | null
          participant_role?: Database["public"]["Enums"]["participant_role"] | null
          can_confirm?: boolean
          valid_from?: string | null
          valid_until?: string | null
          token_hash?: string
          expires_at?: string
          created_by?: string
          created_at?: string
          accepted_at?: string | null
          accepted_by?: string | null
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          id: string
          company_id: string
          project_id: string
          name: string
          category: string
          space: Database["public"]["Enums"]["material_space"]
          spec: string
          quantity: number | null
          unit: string
          unit_price: number | null
          image_file_id: string | null
          location_note: string
          description: string
          is_public: boolean
          confirm_state: Database["public"]["Enums"]["confirm_state"]
          revision: number
          created_by: string
          created_at: string
          updated_at: string
          archived_at: string | null
          version: number
        }
        Insert: {
          id?: string
          company_id: string
          project_id: string
          name: string
          category?: string
          space?: Database["public"]["Enums"]["material_space"]
          spec?: string
          quantity?: number | null
          unit?: string
          unit_price?: number | null
          image_file_id?: string | null
          location_note?: string
          description?: string
          is_public?: boolean
          confirm_state?: Database["public"]["Enums"]["confirm_state"]
          revision?: number
          created_by: string
          created_at?: string
          updated_at?: string
          archived_at?: string | null
          version?: number
        }
        Update: {
          id?: string
          company_id?: string
          project_id?: string
          name?: string
          category?: string
          space?: Database["public"]["Enums"]["material_space"]
          spec?: string
          quantity?: number | null
          unit?: string
          unit_price?: number | null
          image_file_id?: string | null
          location_note?: string
          description?: string
          is_public?: boolean
          confirm_state?: Database["public"]["Enums"]["confirm_state"]
          revision?: number
          created_by?: string
          created_at?: string
          updated_at?: string
          archived_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "materials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_image_file_id_fkey"
            columns: ["image_file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          id: string
          recipient_id: string
          company_id: string
          project_id: string | null
          type: string
          object_type: string
          object_id: string
          created_at: string
          read_at: string | null
        }
        Insert: {
          id?: string
          recipient_id: string
          company_id: string
          project_id?: string | null
          type: string
          object_type: string
          object_id: string
          created_at?: string
          read_at?: string | null
        }
        Update: {
          id?: string
          recipient_id?: string
          company_id?: string
          project_id?: string | null
          type?: string
          object_type?: string
          object_id?: string
          created_at?: string
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          id: string
          company_id: string
          project_id: string
          file_id: string
          thumb_file_id: string | null
          phase: Database["public"]["Enums"]["photo_phase"]
          captured_on: string | null
          description: string
          is_public: boolean
          uploaded_by: string
          uploader_role: string
          created_at: string
          updated_at: string
          archived_at: string | null
          version: number
        }
        Insert: {
          id?: string
          company_id: string
          project_id: string
          file_id: string
          thumb_file_id?: string | null
          phase?: Database["public"]["Enums"]["photo_phase"]
          captured_on?: string | null
          description?: string
          is_public?: boolean
          uploaded_by: string
          uploader_role: string
          created_at?: string
          updated_at?: string
          archived_at?: string | null
          version?: number
        }
        Update: {
          id?: string
          company_id?: string
          project_id?: string
          file_id?: string
          thumb_file_id?: string | null
          phase?: Database["public"]["Enums"]["photo_phase"]
          captured_on?: string | null
          description?: string
          is_public?: boolean
          uploaded_by?: string
          uploader_role?: string
          created_at?: string
          updated_at?: string
          archived_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "photos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: true
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_thumb_file_id_fkey"
            columns: ["thumb_file_id"]
            isOneToOne: true
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          user_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          created_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          display_name: string
          locale: string
          created_at: string
          updated_at: string
          version: number
          suspended_at: string | null
          anonymized_at: string | null
        }
        Insert: {
          id: string
          display_name: string
          locale?: string
          created_at?: string
          updated_at?: string
          version?: number
          suspended_at?: string | null
          anonymized_at?: string | null
        }
        Update: {
          id?: string
          display_name?: string
          locale?: string
          created_at?: string
          updated_at?: string
          version?: number
          suspended_at?: string | null
          anonymized_at?: string | null
        }
        Relationships: []
      }
      project_participants: {
        Row: {
          id: string
          company_id: string
          project_id: string
          user_id: string
          role: Database["public"]["Enums"]["participant_role"]
          can_confirm: boolean
          valid_from: string | null
          valid_until: string | null
          revoked_at: string | null
          invited_by: string | null
          created_at: string
          updated_at: string
          version: number
        }
        Insert: {
          id?: string
          company_id: string
          project_id: string
          user_id: string
          role: Database["public"]["Enums"]["participant_role"]
          can_confirm?: boolean
          valid_from?: string | null
          valid_until?: string | null
          revoked_at?: string | null
          invited_by?: string | null
          created_at?: string
          updated_at?: string
          version?: number
        }
        Update: {
          id?: string
          company_id?: string
          project_id?: string
          user_id?: string
          role?: Database["public"]["Enums"]["participant_role"]
          can_confirm?: boolean
          valid_from?: string | null
          valid_until?: string | null
          revoked_at?: string | null
          invited_by?: string | null
          created_at?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_participants_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_participants_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          id: string
          company_id: string
          name: string
          site_address: string
          start_date: string | null
          end_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          current_phase: string
          is_public: boolean
          home_message: string
          home_sections: Json
          created_by: string
          created_at: string
          updated_at: string
          archived_at: string | null
          version: number
          home_theme: string
          page_images: Json
          page_tone: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          site_address?: string
          start_date?: string | null
          end_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          current_phase?: string
          is_public?: boolean
          home_message?: string
          home_sections?: Json
          created_by: string
          created_at?: string
          updated_at?: string
          archived_at?: string | null
          version?: number
          home_theme?: string
          page_images?: Json
          page_tone?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          site_address?: string
          start_date?: string | null
          end_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          current_phase?: string
          is_public?: boolean
          home_message?: string
          home_sections?: Json
          created_by?: string
          created_at?: string
          updated_at?: string
          archived_at?: string | null
          version?: number
          home_theme?: string
          page_images?: Json
          page_tone?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      request_corrections: {
        Row: {
          id: string
          company_id: string
          project_id: string
          request_id: string
          author_id: string
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          project_id: string
          request_id: string
          author_id: string
          body: string
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          project_id?: string
          request_id?: string
          author_id?: string
          body?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_corrections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_corrections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_corrections_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_replies: {
        Row: {
          id: string
          company_id: string
          project_id: string
          request_id: string
          author_id: string
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          project_id: string
          request_id: string
          author_id: string
          body: string
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          project_id?: string
          request_id?: string
          author_id?: string
          body?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_replies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_replies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_replies_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          id: string
          company_id: string
          project_id: string
          author_id: string
          title: string
          body: string
          status: Database["public"]["Enums"]["request_status"]
          created_at: string
          updated_at: string
          archived_at: string | null
          version: number
        }
        Insert: {
          id?: string
          company_id: string
          project_id: string
          author_id: string
          title: string
          body: string
          status?: Database["public"]["Enums"]["request_status"]
          created_at?: string
          updated_at?: string
          archived_at?: string | null
          version?: number
        }
        Update: {
          id?: string
          company_id?: string
          project_id?: string
          author_id?: string
          title?: string
          body?: string
          status?: Database["public"]["Enums"]["request_status"]
          created_at?: string
          updated_at?: string
          archived_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_events: {
        Row: {
          id: string
          company_id: string
          project_id: string
          title: string
          description: string
          start_date: string
          start_time: string | null
          end_date: string | null
          end_time: string | null
          is_public: boolean
          related_type: string | null
          related_id: string | null
          created_by: string
          created_at: string
          updated_at: string
          archived_at: string | null
          version: number
        }
        Insert: {
          id?: string
          company_id: string
          project_id: string
          title: string
          description?: string
          start_date: string
          start_time?: string | null
          end_date?: string | null
          end_time?: string | null
          is_public?: boolean
          related_type?: string | null
          related_id?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
          archived_at?: string | null
          version?: number
        }
        Update: {
          id?: string
          company_id?: string
          project_id?: string
          title?: string
          description?: string
          start_date?: string
          start_time?: string | null
          end_date?: string | null
          end_time?: string | null
          is_public?: boolean
          related_type?: string | null
          related_id?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
          archived_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "schedule_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          id: boolean
          photo_max_bytes: number
          photo_batch_max: number
          design_max_bytes: number
          default_quota_bytes: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          photo_max_bytes?: number
          photo_batch_max?: number
          design_max_bytes?: number
          default_quota_bytes?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          photo_max_bytes?: number
          photo_batch_max?: number
          design_max_bytes?: number
          default_quota_bytes?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: {
        Args: {
          p_user: string
          p_token_hash: string
        }
        Returns: Json
      }
      add_design_version: {
        Args: {
          p_design: string
          p_file: string
          p_note: string
        }
        Returns: string
      }
      admin_anonymize_user: {
        Args: {
          p_user: string
        }
        Returns: undefined
      }
      admin_audit: {
        Args: {
          p_limit?: number
          p_offset?: number
        }
        Returns: { id: number; actor_id: string; actor_name: string; action: string; target_type: string; target_id: string; detail: Json; occurred_at: string }[]
      }
      admin_change_company_owner: {
        Args: {
          p_company: string
          p_new_owner: string
        }
        Returns: undefined
      }
      admin_cleanup_candidates: {
        Args: never
        Returns: { id: string; company_id: string; company_name: string; kind: Database["public"]["Enums"]["file_kind"]; status: Database["public"]["Enums"]["file_status"]; original_name: string; size_bytes: number; bucket: string; path: string; created_at: string }[]
      }
      admin_companies: {
        Args: {
          p_search?: string
          p_limit?: number
          p_offset?: number
        }
        Returns: { id: string; slug: string; name: string; created_at: string; owner_id: string; owner_name: string; member_count: number; project_count: number; storage_bytes: number; quota_bytes: number }[]
      }
      admin_company_members: {
        Args: {
          p_company: string
        }
        Returns: { user_id: string; display_name: string; role: Database["public"]["Enums"]["member_role"] }[]
      }
      admin_dashboard: {
        Args: never
        Returns: { companies: number; users: number; projects: number; storage_bytes: number; signups_7d: number; suspended_users: number }[]
      }
      admin_log_password_reset: {
        Args: {
          p_user: string
        }
        Returns: undefined
      }
      admin_purge_files: {
        Args: {
          p_ids: string[]
        }
        Returns: number
      }
      admin_purge_read_notifications: {
        Args: {
          p_days?: number
        }
        Returns: number
      }
      admin_set_company_quota: {
        Args: {
          p_company: string
          p_quota_bytes: number
        }
        Returns: undefined
      }
      admin_set_user_suspended: {
        Args: {
          p_user: string
          p_suspended: boolean
        }
        Returns: undefined
      }
      admin_update_site_settings: {
        Args: {
          p_photo_max_bytes: number
          p_photo_batch_max: number
          p_design_max_bytes: number
          p_default_quota_bytes: number
        }
        Returns: undefined
      }
      admin_users: {
        Args: {
          p_search?: string
          p_limit?: number
          p_offset?: number
        }
        Returns: { id: string; email: string; display_name: string; created_at: string; last_sign_in_at: string; suspended_at: string; anonymized_at: string; memberships: Json; participation_count: number; is_admin: boolean }[]
      }
      can_issue_password_reset: {
        Args: {
          p_actor: string
          p_company: string
          p_target: string
        }
        Returns: boolean
      }
      company_storage_usage: {
        Args: {
          p_company: string
        }
        Returns: number
      }
      confirm_target: {
        Args: {
          p_target_type: string
          p_target_id: string
          p_revision: number
        }
        Returns: string
      }
      create_company_with_owner: {
        Args: {
          p_user: string
          p_company_name: string
          p_slug: string
          p_display_name: string
        }
        Returns: string
      }
      create_design: {
        Args: {
          p_project: string
          p_title: string
          p_description: string
          p_file: string
          p_note: string
          p_is_public: boolean
        }
        Returns: string
      }
      field_projects: {
        Args: never
        Returns: { id: string; company_id: string; name: string; site_address: string }[]
      }
      is_platform_admin: {
        Args: never
        Returns: boolean
      }
      project_brief: {
        Args: {
          p_project: string
        }
        Returns: { id: string; company_id: string; name: string; site_address: string; is_public: boolean; archived_at: string }[]
      }
      request_reconfirm: {
        Args: {
          p_target_type: string
          p_target_id: string
          p_reason: string
        }
        Returns: undefined
      }
      withdraw_me: {
        Args: never
        Returns: undefined
      }
    }
    Enums: {
      confirm_state: "none" | "confirmed" | "needs_reconfirm"
      file_kind: "design_original" | "design_preview" | "material_image" | "estimate_pdf" | "photo_original" | "photo_thumb" | "company_logo"
      file_status: "pending" | "ready" | "rejected"
      material_space: "living" | "kitchen" | "bathroom" | "bedroom" | "entrance" | "balcony" | "utility" | "common" | "other"
      member_role: "owner" | "manager" | "pm"
      participant_role: "pm" | "customer" | "field"
      photo_phase: "demolition" | "plumbing" | "electrical" | "carpentry" | "tile" | "paint" | "film" | "wallpaper" | "flooring" | "furniture" | "lighting" | "finishing" | "other"
      project_status: "planned" | "active" | "on_hold" | "completed"
      request_status: "open" | "in_progress" | "resolved"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]

export const Constants = {
  public: {
    Enums: {
      confirm_state: ["none", "confirmed", "needs_reconfirm"],
      file_kind: ["design_original", "design_preview", "material_image", "estimate_pdf", "photo_original", "photo_thumb", "company_logo"],
      file_status: ["pending", "ready", "rejected"],
      material_space: ["living", "kitchen", "bathroom", "bedroom", "entrance", "balcony", "utility", "common", "other"],
      member_role: ["owner", "manager", "pm"],
      participant_role: ["pm", "customer", "field"],
      photo_phase: ["demolition", "plumbing", "electrical", "carpentry", "tile", "paint", "film", "wallpaper", "flooring", "furniture", "lighting", "finishing", "other"],
      project_status: ["planned", "active", "on_hold", "completed"],
      request_status: ["open", "in_progress", "resolved"],
    },
  },
} as const
