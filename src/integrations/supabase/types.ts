export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          branch_id: string | null
          created_at: string
          hospital_id: string | null
          id: string
          module: string
          new_value: Json | null
          old_value: Json | null
          organization_id: string | null
          record_id: string | null
          record_label: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          branch_id?: string | null
          created_at?: string
          hospital_id?: string | null
          id?: string
          module: string
          new_value?: Json | null
          old_value?: Json | null
          organization_id?: string | null
          record_id?: string | null
          record_label?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          branch_id?: string | null
          created_at?: string
          hospital_id?: string | null
          id?: string
          module?: string
          new_value?: Json | null
          old_value?: Json | null
          organization_id?: string | null
          record_id?: string | null
          record_label?: string | null
        }
        Relationships: []
      }
      branches: {
        Row: {
          address: string | null
          city: string | null
          code: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          hospital_id: string
          id: string
          name: string
          organization_id: string
          state: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          hospital_id: string
          id?: string
          name: string
          organization_id: string
          state?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          hospital_id?: string
          id?: string
          name?: string
          organization_id?: string
          state?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          branch_id: string | null
          code: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          dept_type: string
          hospital_id: string
          id: string
          name: string
          organization_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          dept_type?: string
          hospital_id: string
          id?: string
          name: string
          organization_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          dept_type?: string
          hospital_id?: string
          id?: string
          name?: string
          organization_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_groups: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          headquarters_city: string | null
          id: string
          name: string
          organization_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          headquarters_city?: string | null
          id?: string
          name: string
          organization_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          headquarters_city?: string | null
          id?: string
          name?: string
          organization_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hospital_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hospitals: {
        Row: {
          bed_count: number | null
          city: string | null
          code: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          go_live_date: string | null
          hospital_group_id: string | null
          id: string
          name: string
          organization_id: string
          state: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bed_count?: number | null
          city?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          go_live_date?: string | null
          hospital_group_id?: string | null
          id?: string
          name: string
          organization_id: string
          state?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bed_count?: number | null
          city?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          go_live_date?: string | null
          hospital_group_id?: string | null
          id?: string
          name?: string
          organization_id?: string
          state?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hospitals_hospital_group_id_fkey"
            columns: ["hospital_group_id"]
            isOneToOne: false
            referencedRelation: "hospital_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospitals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      insurers: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          insurer_type: string
          name: string
          organization_id: string
          payer_code: string
          portal_url: string | null
          status: string
          support_email: string | null
          support_phone: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          insurer_type?: string
          name: string
          organization_id: string
          payer_code: string
          portal_url?: string | null
          status?: string
          support_email?: string | null
          support_phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          insurer_type?: string
          name?: string
          organization_id?: string
          payer_code?: string
          portal_url?: string | null
          status?: string
          support_email?: string | null
          support_phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insurers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      master_list_items: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          hospital_id: string | null
          id: string
          is_active: boolean
          label: string
          list_id: string
          metadata: Json
          organization_id: string | null
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          hospital_id?: string | null
          id?: string
          is_active?: boolean
          label: string
          list_id: string
          metadata?: Json
          organization_id?: string | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          hospital_id?: string | null
          id?: string
          is_active?: boolean
          label?: string
          list_id?: string
          metadata?: Json
          organization_id?: string | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "master_list_items_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "master_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_list_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      master_lists: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "master_lists_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          branch_id: string | null
          category: string
          created_at: string
          hospital_id: string | null
          id: string
          link_to: string | null
          organization_id: string | null
          read_at: string | null
          severity: string
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          branch_id?: string | null
          category?: string
          created_at?: string
          hospital_id?: string | null
          id?: string
          link_to?: string | null
          organization_id?: string | null
          read_at?: string | null
          severity?: string
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          branch_id?: string | null
          category?: string
          created_at?: string
          hospital_id?: string | null
          id?: string
          link_to?: string | null
          organization_id?: string | null
          read_at?: string | null
          severity?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_checklists: {
        Row: {
          created_at: string
          hospital_id: string
          id: string
          organization_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hospital_id: string
          id?: string
          organization_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hospital_id?: string
          id?: string
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_checklists_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: true
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_checklists_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_steps: {
        Row: {
          checklist_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          hospital_id: string
          id: string
          notes: string | null
          organization_id: string
          sort_order: number
          status: string
          step_key: string
          title: string
          updated_at: string
        }
        Insert: {
          checklist_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          hospital_id: string
          id?: string
          notes?: string | null
          organization_id: string
          sort_order?: number
          status?: string
          step_key: string
          title: string
          updated_at?: string
        }
        Update: {
          checklist_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          hospital_id?: string
          id?: string
          notes?: string | null
          organization_id?: string
          sort_order?: number
          status?: string
          step_key?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_steps_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "onboarding_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_steps_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_steps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          org_type: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          org_type?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          org_type?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      permissions: {
        Row: {
          action: string
          created_at: string
          id: string
          module: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          module: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          module?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          availability: string
          backup_user_id: string | null
          created_at: string
          created_by: string | null
          email: string | null
          employee_code: string | null
          full_name: string
          id: string
          is_platform_user: boolean
          job_title: string | null
          last_active_at: string | null
          organization_id: string | null
          phone: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          availability?: string
          backup_user_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          employee_code?: string | null
          full_name?: string
          id: string
          is_platform_user?: boolean
          job_title?: string | null
          last_active_at?: string | null
          organization_id?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          availability?: string
          backup_user_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          employee_code?: string | null
          full_name?: string
          id?: string
          is_platform_user?: boolean
          job_title?: string | null
          last_active_at?: string | null
          organization_id?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_system: boolean
          key: string
          name: string
          organization_id: string | null
          role_level: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          key: string
          name: string
          organization_id?: string | null
          role_level?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          key?: string
          name?: string
          organization_id?: string | null
          role_level?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          created_at: string
          hospital_id: string | null
          id: string
          key: string
          organization_id: string | null
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          hospital_id?: string | null
          id?: string
          key: string
          organization_id?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          created_at?: string
          hospital_id?: string | null
          id?: string
          key?: string
          organization_id?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "settings_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          role_in_team: string
          team_id: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          role_in_team?: string
          team_id: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          role_in_team?: string
          team_id?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          branch_id: string | null
          code: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          department_id: string | null
          hospital_id: string
          id: string
          manager_id: string | null
          name: string
          organization_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          department_id?: string | null
          hospital_id: string
          id?: string
          manager_id?: string | null
          name: string
          organization_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          department_id?: string | null
          hospital_id?: string
          id?: string
          manager_id?: string | null
          name?: string
          organization_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tpa_spocs: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          designation: string | null
          email: string | null
          escalation_level: number
          hospital_id: string | null
          id: string
          insurer_id: string | null
          location: string | null
          name: string
          organization_id: string
          phone: string | null
          status: string
          tpa_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          designation?: string | null
          email?: string | null
          escalation_level?: number
          hospital_id?: string | null
          id?: string
          insurer_id?: string | null
          location?: string | null
          name: string
          organization_id: string
          phone?: string | null
          status?: string
          tpa_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          designation?: string | null
          email?: string | null
          escalation_level?: number
          hospital_id?: string | null
          id?: string
          insurer_id?: string | null
          location?: string | null
          name?: string
          organization_id?: string
          phone?: string | null
          status?: string
          tpa_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tpa_spocs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tpa_spocs_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tpa_spocs_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tpa_spocs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tpa_spocs_tpa_id_fkey"
            columns: ["tpa_id"]
            isOneToOne: false
            referencedRelation: "tpas"
            referencedColumns: ["id"]
          },
        ]
      }
      tpas: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          organization_id: string
          portal_url: string | null
          status: string
          support_email: string | null
          support_phone: string | null
          tpa_code: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          organization_id: string
          portal_url?: string | null
          status?: string
          support_email?: string | null
          support_phone?: string | null
          tpa_code: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          organization_id?: string
          portal_url?: string | null
          status?: string
          support_email?: string | null
          support_phone?: string | null
          tpa_code?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tpas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          hospital_id: string | null
          id: string
          organization_id: string | null
          role_id: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          hospital_id?: string | null
          id?: string
          organization_id?: string | null
          role_id: string
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          hospital_id?: string | null
          id?: string
          organization_id?: string | null
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_scopes: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          hospital_group_id: string | null
          hospital_id: string | null
          id: string
          organization_id: string | null
          scope_type: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          hospital_group_id?: string | null
          hospital_id?: string | null
          id?: string
          organization_id?: string | null
          scope_type: string
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          hospital_group_id?: string | null
          hospital_id?: string | null
          id?: string
          organization_id?: string | null
          scope_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_scopes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_scopes_hospital_group_id_fkey"
            columns: ["hospital_group_id"]
            isOneToOne: false
            referencedRelation: "hospital_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_scopes_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_scopes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_scopes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_user: {
        Args: { _email: string; _full_name?: string; _user_id: string }
        Returns: string
      }
      can_access_branch: {
        Args: { _branch_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_hospital: {
        Args: { _hospital_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_org: {
        Args: { _organization_id: string; _user_id: string }
        Returns: boolean
      }
      has_permission: {
        Args: { _action: string; _module: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
