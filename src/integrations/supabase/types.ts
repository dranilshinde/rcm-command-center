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
      admin_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          full_name: string
          hospital_id: string
          id: string
          invited_by: string | null
          last_sent_at: string
          organization_id: string
          revoked_at: string | null
          revoked_by: string | null
          role_key: string
          send_count: number
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          full_name?: string
          hospital_id: string
          id?: string
          invited_by?: string | null
          last_sent_at?: string
          organization_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          role_key: string
          send_count?: number
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          full_name?: string
          hospital_id?: string
          id?: string
          invited_by?: string | null
          last_sent_at?: string
          organization_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          role_key?: string
          send_count?: number
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_invitations_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      admissions: {
        Row: {
          admission_date: string
          branch_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          department_id: string | null
          diagnosis: string | null
          discharge_date: string | null
          employee_code: string | null
          hospital_id: string
          id: string
          insurer_id: string | null
          ip_number: string | null
          member_id: string | null
          organization_id: string
          patient_id: string
          policy_holder_name: string | null
          policy_number: string | null
          policy_type: string | null
          status: string
          tpa_id: string | null
          treating_doctor: string | null
          treatment: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admission_date: string
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          department_id?: string | null
          diagnosis?: string | null
          discharge_date?: string | null
          employee_code?: string | null
          hospital_id: string
          id?: string
          insurer_id?: string | null
          ip_number?: string | null
          member_id?: string | null
          organization_id: string
          patient_id: string
          policy_holder_name?: string | null
          policy_number?: string | null
          policy_type?: string | null
          status?: string
          tpa_id?: string | null
          treating_doctor?: string | null
          treatment?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admission_date?: string
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          department_id?: string | null
          diagnosis?: string | null
          discharge_date?: string | null
          employee_code?: string | null
          hospital_id?: string
          id?: string
          insurer_id?: string | null
          ip_number?: string | null
          member_id?: string | null
          organization_id?: string
          patient_id?: string
          policy_holder_name?: string | null
          policy_number?: string | null
          policy_type?: string | null
          status?: string
          tpa_id?: string | null
          treating_doctor?: string | null
          treatment?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admissions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissions_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissions_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissions_tpa_id_fkey"
            columns: ["tpa_id"]
            isOneToOne: false
            referencedRelation: "tpas"
            referencedColumns: ["id"]
          },
        ]
      }
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
      bank_receipts: {
        Row: {
          amount: number
          claim_id: string | null
          claim_payment_id: string | null
          created_at: string
          created_by: string | null
          hospital_id: string
          id: string
          match_method: string | null
          match_status: string
          matched_at: string | null
          matched_by: string | null
          narration: string | null
          organization_id: string
          payer_name: string | null
          receipt_date: string
          source_file: string | null
          updated_at: string
          updated_by: string | null
          utr_number: string | null
          variance: number | null
        }
        Insert: {
          amount: number
          claim_id?: string | null
          claim_payment_id?: string | null
          created_at?: string
          created_by?: string | null
          hospital_id: string
          id?: string
          match_method?: string | null
          match_status?: string
          matched_at?: string | null
          matched_by?: string | null
          narration?: string | null
          organization_id: string
          payer_name?: string | null
          receipt_date: string
          source_file?: string | null
          updated_at?: string
          updated_by?: string | null
          utr_number?: string | null
          variance?: number | null
        }
        Update: {
          amount?: number
          claim_id?: string | null
          claim_payment_id?: string | null
          created_at?: string
          created_by?: string | null
          hospital_id?: string
          id?: string
          match_method?: string | null
          match_status?: string
          matched_at?: string | null
          matched_by?: string | null
          narration?: string | null
          organization_id?: string
          payer_name?: string | null
          receipt_date?: string
          source_file?: string | null
          updated_at?: string
          updated_by?: string | null
          utr_number?: string | null
          variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_receipts_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_receipts_claim_payment_id_fkey"
            columns: ["claim_payment_id"]
            isOneToOne: false
            referencedRelation: "claim_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_receipts_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_receipts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      claim_couriers: {
        Row: {
          agency: string | null
          claim_id: string
          created_at: string
          created_by: string | null
          destination: string | null
          dispatch_date: string | null
          hospital_id: string
          id: string
          organization_id: string
          provider: string | null
          sender_name: string | null
          tracking_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agency?: string | null
          claim_id: string
          created_at?: string
          created_by?: string | null
          destination?: string | null
          dispatch_date?: string | null
          hospital_id: string
          id?: string
          organization_id: string
          provider?: string | null
          sender_name?: string | null
          tracking_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agency?: string | null
          claim_id?: string
          created_at?: string
          created_by?: string | null
          destination?: string | null
          dispatch_date?: string | null
          hospital_id?: string
          id?: string
          organization_id?: string
          provider?: string | null
          sender_name?: string | null
          tracking_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_couriers_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_couriers_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_followups: {
        Row: {
          author_name: string | null
          channel: string
          claim_id: string
          commitment_amount: number | null
          commitment_date: string | null
          contact_name: string | null
          created_at: string
          created_by: string | null
          hospital_id: string
          id: string
          next_followup_at: string | null
          notes: string | null
          organization_id: string
          outcome: string
          spoc_id: string | null
        }
        Insert: {
          author_name?: string | null
          channel?: string
          claim_id: string
          commitment_amount?: number | null
          commitment_date?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          hospital_id: string
          id?: string
          next_followup_at?: string | null
          notes?: string | null
          organization_id: string
          outcome: string
          spoc_id?: string | null
        }
        Update: {
          author_name?: string | null
          channel?: string
          claim_id?: string
          commitment_amount?: number | null
          commitment_date?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          hospital_id?: string
          id?: string
          next_followup_at?: string | null
          notes?: string | null
          organization_id?: string
          outcome?: string
          spoc_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_followups_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_followups_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_followups_spoc_id_fkey"
            columns: ["spoc_id"]
            isOneToOne: false
            referencedRelation: "tpa_spocs"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_notes: {
        Row: {
          author_id: string | null
          author_name: string | null
          body: string
          claim_id: string
          created_at: string
          hospital_id: string
          id: string
          organization_id: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          body: string
          claim_id: string
          created_at?: string
          hospital_id: string
          id?: string
          organization_id: string
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          body?: string
          claim_id?: string
          created_at?: string
          hospital_id?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_notes_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_notes_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_payments: {
        Row: {
          amount: number
          claim_id: string
          created_at: string
          created_by: string | null
          hospital_id: string
          id: string
          organization_id: string
          payment_date: string | null
          receipt_no: string | null
          tds_amount: number
          updated_at: string
          updated_by: string | null
          utr_number: string | null
        }
        Insert: {
          amount?: number
          claim_id: string
          created_at?: string
          created_by?: string | null
          hospital_id: string
          id?: string
          organization_id: string
          payment_date?: string | null
          receipt_no?: string | null
          tds_amount?: number
          updated_at?: string
          updated_by?: string | null
          utr_number?: string | null
        }
        Update: {
          amount?: number
          claim_id?: string
          created_at?: string
          created_by?: string | null
          hospital_id?: string
          id?: string
          organization_id?: string
          payment_date?: string | null
          receipt_no?: string | null
          tds_amount?: number
          updated_at?: string
          updated_by?: string | null
          utr_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_payments_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_payments_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_queries: {
        Row: {
          category: string
          claim_id: string
          created_at: string
          created_by: string | null
          due_at: string | null
          hospital_id: string
          id: string
          organization_id: string
          query_text: string
          raised_at: string
          replied_at: string | null
          replied_by: string | null
          reply_text: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string
          claim_id: string
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          hospital_id: string
          id?: string
          organization_id: string
          query_text: string
          raised_at?: string
          replied_at?: string | null
          replied_by?: string | null
          reply_text?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          claim_id?: string
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          hospital_id?: string
          id?: string
          organization_id?: string
          query_text?: string
          raised_at?: string
          replied_at?: string | null
          replied_by?: string | null
          reply_text?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_queries_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_queries_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_status_history: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          claim_id: string
          created_at: string
          from_status: string | null
          hospital_id: string
          id: string
          note: string | null
          organization_id: string
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          claim_id: string
          created_at?: string
          from_status?: string | null
          hospital_id: string
          id?: string
          note?: string | null
          organization_id: string
          to_status: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          claim_id?: string
          created_at?: string
          from_status?: string | null
          hospital_id?: string
          id?: string
          note?: string | null
          organization_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_status_history_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_status_history_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          admission_id: string
          approved_amount: number
          assigned_to: string | null
          branch_id: string | null
          case_ref_id: string | null
          claim_code: string
          claim_date: string
          claimed_amount: number
          copay: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          document_submitted_at: string | null
          escalation_level: number
          external_claim_no: string | null
          hospital_discount: number
          hospital_id: string
          id: string
          initial_claim_no: string | null
          insurer_comments: string | null
          invoice_number: string | null
          last_status_at: string
          next_followup_at: string | null
          organization_id: string
          patient_id: string
          patient_paid: number
          payment_date: string | null
          priority: string
          readiness_gaps: Json
          readiness_score: number
          reconciled: boolean
          settled_amount: number
          short_payment: number | null
          shortfall_amount: number
          sla_due_at: string | null
          sla_process: string | null
          status: string
          tds_amount: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admission_id: string
          approved_amount?: number
          assigned_to?: string | null
          branch_id?: string | null
          case_ref_id?: string | null
          claim_code?: string
          claim_date?: string
          claimed_amount?: number
          copay?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          document_submitted_at?: string | null
          escalation_level?: number
          external_claim_no?: string | null
          hospital_discount?: number
          hospital_id: string
          id?: string
          initial_claim_no?: string | null
          insurer_comments?: string | null
          invoice_number?: string | null
          last_status_at?: string
          next_followup_at?: string | null
          organization_id: string
          patient_id: string
          patient_paid?: number
          payment_date?: string | null
          priority?: string
          readiness_gaps?: Json
          readiness_score?: number
          reconciled?: boolean
          settled_amount?: number
          short_payment?: number | null
          shortfall_amount?: number
          sla_due_at?: string | null
          sla_process?: string | null
          status?: string
          tds_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admission_id?: string
          approved_amount?: number
          assigned_to?: string | null
          branch_id?: string | null
          case_ref_id?: string | null
          claim_code?: string
          claim_date?: string
          claimed_amount?: number
          copay?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          document_submitted_at?: string | null
          escalation_level?: number
          external_claim_no?: string | null
          hospital_discount?: number
          hospital_id?: string
          id?: string
          initial_claim_no?: string | null
          insurer_comments?: string | null
          invoice_number?: string | null
          last_status_at?: string
          next_followup_at?: string | null
          organization_id?: string
          patient_id?: string
          patient_paid?: number
          payment_date?: string | null
          priority?: string
          readiness_gaps?: Json
          readiness_score?: number
          reconciled?: boolean
          settled_amount?: number
          short_payment?: number | null
          shortfall_amount?: number
          sla_due_at?: string | null
          sla_process?: string | null
          status?: string
          tds_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claims_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "admissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      denials: {
        Row: {
          amount: number
          appeal_submitted_at: string | null
          category: string
          claim_id: string
          closed_at: string | null
          created_at: string
          created_by: string | null
          hospital_id: string
          id: string
          kind: string
          organization_id: string
          owner_id: string | null
          reason: string | null
          recovered_amount: number
          resolution_note: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount?: number
          appeal_submitted_at?: string | null
          category?: string
          claim_id: string
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          hospital_id: string
          id?: string
          kind?: string
          organization_id: string
          owner_id?: string | null
          reason?: string | null
          recovered_amount?: number
          resolution_note?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          appeal_submitted_at?: string | null
          category?: string
          claim_id?: string
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          hospital_id?: string
          id?: string
          kind?: string
          organization_id?: string
          owner_id?: string | null
          reason?: string | null
          recovered_amount?: number
          resolution_note?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "denials_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "denials_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "denials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "denials_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      engine_runs: {
        Row: {
          finished_at: string | null
          id: string
          started_at: string
          stats: Json
          triggered_by: string | null
        }
        Insert: {
          finished_at?: string | null
          id?: string
          started_at?: string
          stats?: Json
          triggered_by?: string | null
        }
        Update: {
          finished_at?: string | null
          id?: string
          started_at?: string
          stats?: Json
          triggered_by?: string | null
        }
        Relationships: []
      }
      escalations: {
        Row: {
          claim_id: string | null
          created_at: string
          created_by: string | null
          hospital_id: string
          id: string
          level: number
          notified_roles: string[]
          organization_id: string
          reason: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          rule_id: string | null
          spoc_id: string | null
          status: string
          task_id: string | null
          updated_at: string
        }
        Insert: {
          claim_id?: string | null
          created_at?: string
          created_by?: string | null
          hospital_id: string
          id?: string
          level?: number
          notified_roles?: string[]
          organization_id: string
          reason: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          rule_id?: string | null
          spoc_id?: string | null
          status?: string
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          claim_id?: string | null
          created_at?: string
          created_by?: string | null
          hospital_id?: string
          id?: string
          level?: number
          notified_roles?: string[]
          organization_id?: string
          reason?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          rule_id?: string | null
          spoc_id?: string | null
          status?: string
          task_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalations_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalations_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalations_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "reminder_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalations_spoc_id_fkey"
            columns: ["spoc_id"]
            isOneToOne: false
            referencedRelation: "tpa_spocs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalations_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
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
          rohini_id: string | null
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
          rohini_id?: string | null
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
          rohini_id?: string | null
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
      import_job_rows: {
        Row: {
          claim_id: string | null
          created_at: string
          errors: Json
          id: string
          job_id: string
          organization_id: string
          row_number: number
          status: string
        }
        Insert: {
          claim_id?: string | null
          created_at?: string
          errors?: Json
          id?: string
          job_id: string
          organization_id: string
          row_number: number
          status: string
        }
        Update: {
          claim_id?: string | null
          created_at?: string
          errors?: Json
          id?: string
          job_id?: string
          organization_id?: string
          row_number?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_job_rows_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_job_rows_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          created_rows: number
          error_rows: number
          file_name: string
          hospital_id: string | null
          id: string
          import_type: string
          organization_id: string
          status: string
          total_rows: number
          updated_at: string
          updated_rows: number
          valid_rows: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          created_rows?: number
          error_rows?: number
          file_name: string
          hospital_id?: string | null
          id?: string
          import_type?: string
          organization_id: string
          status?: string
          total_rows?: number
          updated_at?: string
          updated_rows?: number
          valid_rows?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          created_rows?: number
          error_rows?: number
          file_name?: string
          hospital_id?: string | null
          id?: string
          import_type?: string
          organization_id?: string
          status?: string
          total_rows?: number
          updated_at?: string
          updated_rows?: number
          valid_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      insurers: {
        Row: {
          aliases: string[]
          created_at: string
          created_by: string | null
          deleted_at: string | null
          escalation_email: string | null
          id: string
          insurer_type: string
          name: string
          organization_id: string
          payer_code: string
          portal_url: string | null
          preferred_channel: string
          relationship_notes: string | null
          status: string
          support_email: string | null
          support_phone: string | null
          target_payment_days: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          aliases?: string[]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          escalation_email?: string | null
          id?: string
          insurer_type?: string
          name: string
          organization_id: string
          payer_code: string
          portal_url?: string | null
          preferred_channel?: string
          relationship_notes?: string | null
          status?: string
          support_email?: string | null
          support_phone?: string | null
          target_payment_days?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          aliases?: string[]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          escalation_email?: string | null
          id?: string
          insurer_type?: string
          name?: string
          organization_id?: string
          payer_code?: string
          portal_url?: string | null
          preferred_channel?: string
          relationship_notes?: string | null
          status?: string
          support_email?: string | null
          support_phone?: string | null
          target_payment_days?: number | null
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
      patients: {
        Row: {
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          deleted_at: string | null
          full_name: string
          gender: string | null
          hospital_id: string
          id: string
          member_id: string | null
          organization_id: string
          phone: string | null
          uhid: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          full_name: string
          gender?: string | null
          hospital_id: string
          id?: string
          member_id?: string | null
          organization_id: string
          phone?: string | null
          uhid?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          full_name?: string
          gender?: string | null
          hospital_id?: string
          id?: string
          member_id?: string | null
          organization_id?: string
          phone?: string | null
          uhid?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      preauths: {
        Row: {
          admission_id: string
          approved_amount: number | null
          created_at: string
          created_by: string | null
          decided_at: string | null
          hospital_id: string
          id: string
          kind: string
          organization_id: string
          reference_no: string | null
          remarks: string | null
          requested_amount: number
          requested_at: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admission_id: string
          approved_amount?: number | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          hospital_id: string
          id?: string
          kind?: string
          organization_id: string
          reference_no?: string | null
          remarks?: string | null
          requested_amount?: number
          requested_at?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admission_id?: string
          approved_amount?: number | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          hospital_id?: string
          id?: string
          kind?: string
          organization_id?: string
          reference_no?: string | null
          remarks?: string | null
          requested_amount?: number
          requested_at?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "preauths_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "admissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preauths_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preauths_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      reminder_rules: {
        Row: {
          created_at: string
          created_by: string | null
          escalation_level: number
          hospital_id: string | null
          id: string
          insurer_id: string | null
          is_active: boolean
          name: string
          notify_roles: string[]
          organization_id: string | null
          rule_key: string
          threshold_hours: number
          tpa_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          escalation_level?: number
          hospital_id?: string | null
          id?: string
          insurer_id?: string | null
          is_active?: boolean
          name: string
          notify_roles?: string[]
          organization_id?: string | null
          rule_key: string
          threshold_hours: number
          tpa_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          escalation_level?: number
          hospital_id?: string | null
          id?: string
          insurer_id?: string | null
          is_active?: boolean
          name?: string
          notify_roles?: string[]
          organization_id?: string | null
          rule_key?: string
          threshold_hours?: number
          tpa_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminder_rules_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_rules_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_rules_tpa_id_fkey"
            columns: ["tpa_id"]
            isOneToOne: false
            referencedRelation: "tpas"
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
      sla_rules: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          hospital_id: string | null
          id: string
          insurer_id: string | null
          is_active: boolean
          organization_id: string | null
          process: string
          target_hours: number
          tpa_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          hospital_id?: string | null
          id?: string
          insurer_id?: string | null
          is_active?: boolean
          organization_id?: string | null
          process: string
          target_hours: number
          tpa_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          hospital_id?: string | null
          id?: string
          insurer_id?: string | null
          is_active?: boolean
          organization_id?: string | null
          process?: string
          target_hours?: number
          tpa_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sla_rules_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_rules_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_rules_tpa_id_fkey"
            columns: ["tpa_id"]
            isOneToOne: false
            referencedRelation: "tpas"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          amount_at_stake: number
          assigned_to: string | null
          branch_id: string | null
          claim_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          entity_id: string | null
          entity_type: string
          escalation_level: number
          hospital_id: string
          id: string
          last_reminded_at: string | null
          organization_id: string
          priority: string
          rule_id: string | null
          spoc_id: string | null
          status: string
          task_type: string
          team_id: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount_at_stake?: number
          assigned_to?: string | null
          branch_id?: string | null
          claim_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          entity_id?: string | null
          entity_type?: string
          escalation_level?: number
          hospital_id: string
          id?: string
          last_reminded_at?: string | null
          organization_id: string
          priority?: string
          rule_id?: string | null
          spoc_id?: string | null
          status?: string
          task_type?: string
          team_id?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount_at_stake?: number
          assigned_to?: string | null
          branch_id?: string | null
          claim_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          entity_id?: string | null
          entity_type?: string
          escalation_level?: number
          hospital_id?: string
          id?: string
          last_reminded_at?: string | null
          organization_id?: string
          priority?: string
          rule_id?: string | null
          spoc_id?: string | null
          status?: string
          task_type?: string
          team_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_spoc_id_fkey"
            columns: ["spoc_id"]
            isOneToOne: false
            referencedRelation: "tpa_spocs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
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
          aliases: string[]
          created_at: string
          created_by: string | null
          deleted_at: string | null
          escalation_email: string | null
          id: string
          name: string
          organization_id: string
          portal_url: string | null
          preferred_channel: string
          relationship_notes: string | null
          status: string
          support_email: string | null
          support_phone: string | null
          target_payment_days: number | null
          tpa_code: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          aliases?: string[]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          escalation_email?: string | null
          id?: string
          name: string
          organization_id: string
          portal_url?: string | null
          preferred_channel?: string
          relationship_notes?: string | null
          status?: string
          support_email?: string | null
          support_phone?: string | null
          target_payment_days?: number | null
          tpa_code: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          aliases?: string[]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          escalation_email?: string | null
          id?: string
          name?: string
          organization_id?: string
          portal_url?: string | null
          preferred_channel?: string
          relationship_notes?: string | null
          status?: string
          support_email?: string | null
          support_phone?: string | null
          target_payment_days?: number | null
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
      pick_reminder_rule: {
        Args: {
          _hosp: string
          _ins: string
          _key: string
          _org: string
          _tpa: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          escalation_level: number
          hospital_id: string | null
          id: string
          insurer_id: string | null
          is_active: boolean
          name: string
          notify_roles: string[]
          organization_id: string | null
          rule_key: string
          threshold_hours: number
          tpa_id: string | null
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "reminder_rules"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pick_spoc: {
        Args: { _hosp: string; _ins: string; _level: number; _tpa: string }
        Returns: string
      }
      role_recipients: {
        Args: { _hosp: string; _roles: string[] }
        Returns: string[]
      }
      run_rcm_engine: { Args: never; Returns: Json }
      sla_hours: {
        Args: {
          _default: number
          _hosp: string
          _ins: string
          _process: string
          _tpa: string
        }
        Returns: number
      }
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
