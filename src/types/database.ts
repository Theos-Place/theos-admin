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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      application_status_history: {
        Row: {
          application_id: string
          assigned_to: string | null
          changed_by: string | null
          created_at: string | null
          from_status: string | null
          id: string
          notes: string | null
          to_status: string | null
        }
        Insert: {
          application_id: string
          assigned_to?: string | null
          changed_by?: string | null
          created_at?: string | null
          from_status?: string | null
          id?: string
          notes?: string | null
          to_status?: string | null
        }
        Update: {
          application_id?: string
          assigned_to?: string | null
          changed_by?: string | null
          created_at?: string | null
          from_status?: string | null
          id?: string
          notes?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_status_history_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_status_history_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_status_history_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          applicant_id: string
          applied_at: string | null
          assigned_to: string | null
          created_at: string | null
          id: string
          notes: string | null
          status: string
          updated_at: string | null
          vacancy_id: string
        }
        Insert: {
          applicant_id: string
          applied_at?: string | null
          assigned_to?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string | null
          vacancy_id: string
        }
        Update: {
          applicant_id?: string
          applied_at?: string | null
          assigned_to?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string | null
          vacancy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_vacancy_id_fkey"
            columns: ["vacancy_id"]
            isOneToOne: false
            referencedRelation: "vacancies"
            referencedColumns: ["id"]
          },
        ]
      }
      areas: {
        Row: {
          area_type: string
          created_at: string | null
          description: string | null
          id: string
          ideal_capacity: number | null
          is_active: boolean | null
          leader_id: string | null
          name: string
          parent_id: string | null
          updated_at: string | null
        }
        Insert: {
          area_type: string
          created_at?: string | null
          description?: string | null
          id?: string
          ideal_capacity?: number | null
          is_active?: boolean | null
          leader_id?: string | null
          name: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          area_type?: string
          created_at?: string | null
          description?: string | null
          id?: string
          ideal_capacity?: number | null
          is_active?: boolean | null
          leader_id?: string | null
          name?: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "areas_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "areas_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "areas_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          new_data: Json | null
          old_data: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
        }
        Relationships: []
      }
      channel_configs: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          is_verified: boolean | null
          last_verified_at: string | null
          name: string
          smtp_from_email: string | null
          smtp_from_name: string | null
          smtp_host: string | null
          smtp_port: number | null
          smtp_user: string | null
          type: string
          updated_at: string | null
          wa_account_id: string | null
          wa_phone_number: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          last_verified_at?: string | null
          name: string
          smtp_from_email?: string | null
          smtp_from_name?: string | null
          smtp_host?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          type: string
          updated_at?: string | null
          wa_account_id?: string | null
          wa_phone_number?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          last_verified_at?: string | null
          name?: string
          smtp_from_email?: string | null
          smtp_from_name?: string | null
          smtp_host?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          type?: string
          updated_at?: string | null
          wa_account_id?: string | null
          wa_phone_number?: string | null
        }
        Relationships: []
      }
      committee_goals: {
        Row: {
          committee_id: string
          created_at: string | null
          description: string
          due_date: string | null
          id: string
          status: string
        }
        Insert: {
          committee_id: string
          created_at?: string | null
          description: string
          due_date?: string | null
          id?: string
          status?: string
        }
        Update: {
          committee_id?: string
          created_at?: string | null
          description?: string
          due_date?: string | null
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "committee_goals_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      donations: {
        Row: {
          amount: number
          created_at: string | null
          donation_date: string
          family_unit_id: string | null
          id: string
          imported_at: string | null
          is_identified: boolean | null
          member_id: string | null
          source_file: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          donation_date: string
          family_unit_id?: string | null
          id?: string
          imported_at?: string | null
          is_identified?: boolean | null
          member_id?: string | null
          source_file?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          donation_date?: string
          family_unit_id?: string | null
          id?: string
          imported_at?: string | null
          is_identified?: boolean | null
          member_id?: string | null
          source_file?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donations_family_unit_id_fkey"
            columns: ["family_unit_id"]
            isOneToOne: false
            referencedRelation: "family_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
        ]
      }
      duplicate_dismissals: {
        Row: {
          dismissed_at: string | null
          member_a: string
          member_b: string
        }
        Insert: {
          dismissed_at?: string | null
          member_a: string
          member_b: string
        }
        Update: {
          dismissed_at?: string | null
          member_a?: string
          member_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "duplicate_dismissals_member_a_fkey"
            columns: ["member_a"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplicate_dismissals_member_a_fkey"
            columns: ["member_a"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplicate_dismissals_member_b_fkey"
            columns: ["member_b"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplicate_dismissals_member_b_fkey"
            columns: ["member_b"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          created_at: string | null
          doc_type: string
          employee_id: string
          expires_at: string | null
          file_url: string | null
          id: string
          notes: string | null
          title: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          doc_type: string
          employee_id: string
          expires_at?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          title: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          doc_type?: string
          employee_id?: string
          expires_at?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          contract_type: string | null
          created_at: string | null
          created_by: string | null
          department: string | null
          employee_code: string | null
          employment_type: string | null
          end_date: string | null
          id: string
          member_id: string | null
          notes: string | null
          position: string
          position_id: string | null
          salary: number | null
          salary_currency: string | null
          start_date: string
          status: string | null
          termination_reason: string | null
          updated_at: string | null
          vacation_days_total: number | null
          vacation_days_used: number | null
        }
        Insert: {
          contract_type?: string | null
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          employee_code?: string | null
          employment_type?: string | null
          end_date?: string | null
          id?: string
          member_id?: string | null
          notes?: string | null
          position: string
          position_id?: string | null
          salary?: number | null
          salary_currency?: string | null
          start_date: string
          status?: string | null
          termination_reason?: string | null
          updated_at?: string | null
          vacation_days_total?: number | null
          vacation_days_used?: number | null
        }
        Update: {
          contract_type?: string | null
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          employee_code?: string | null
          employment_type?: string | null
          end_date?: string | null
          id?: string
          member_id?: string | null
          notes?: string | null
          position?: string
          position_id?: string | null
          salary?: number | null
          salary_currency?: string | null
          start_date?: string
          status?: string | null
          termination_reason?: string | null
          updated_at?: string | null
          vacation_days_total?: number | null
          vacation_days_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "paid_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      event_checkins: {
        Row: {
          checked_in_at: string | null
          checked_in_by: string | null
          event_id: string
          guest_name: string | null
          id: string
          member_id: string | null
          method: string | null
          notes: string | null
          sub_event_id: string | null
        }
        Insert: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          event_id: string
          guest_name?: string | null
          id?: string
          member_id?: string | null
          method?: string | null
          notes?: string | null
          sub_event_id?: string | null
        }
        Update: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          event_id?: string
          guest_name?: string | null
          id?: string
          member_id?: string | null
          method?: string | null
          notes?: string | null
          sub_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_checkins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_checkins_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_checkins_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_checkins_sub_event_id_fkey"
            columns: ["sub_event_id"]
            isOneToOne: false
            referencedRelation: "sub_events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_exceptions: {
        Row: {
          created_at: string | null
          exception_date: string
          id: string
          override_event_id: string | null
          parent_event_id: string
        }
        Insert: {
          created_at?: string | null
          exception_date: string
          id?: string
          override_event_id?: string | null
          parent_event_id: string
        }
        Update: {
          created_at?: string | null
          exception_date?: string
          id?: string
          override_event_id?: string | null
          parent_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_exceptions_override_event_id_fkey"
            columns: ["override_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_exceptions_parent_event_id_fkey"
            columns: ["parent_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_organizing_committees: {
        Row: {
          committee_id: string
          event_id: string
        }
        Insert: {
          committee_id: string
          event_id: string
        }
        Update: {
          committee_id?: string
          event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_organizing_committees_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_organizing_committees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          event_id: string
          id: string
          member_id: string
          payment_status: string
          registered_at: string | null
        }
        Insert: {
          event_id: string
          id?: string
          member_id: string
          payment_status?: string
          registered_at?: string | null
        }
        Update: {
          event_id?: string
          id?: string
          member_id?: string
          payment_status?: string
          registered_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
        ]
      }
      event_types: {
        Row: {
          color: string
          created_at: string | null
          description: string | null
          icon: string
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string
          created_at?: string | null
          description?: string | null
          icon?: string
          id: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string
          created_at?: string | null
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      event_volunteers: {
        Row: {
          assigned_by: string | null
          created_at: string | null
          event_id: string
          id: string
          member_id: string
          role: string | null
          status: string | null
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string | null
          event_id: string
          id?: string
          member_id: string
          role?: string | null
          status?: string | null
        }
        Update: {
          assigned_by?: string | null
          created_at?: string | null
          event_id?: string
          id?: string
          member_id?: string
          role?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_volunteers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_volunteers_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_volunteers_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          cancellation_reason: string | null
          committee_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          ends_at: string | null
          event_type: string
          flyer_url: string | null
          id: string
          is_active: boolean | null
          is_public: boolean | null
          is_recurring: boolean | null
          is_virtual: boolean | null
          location: string | null
          location_url: string | null
          max_capacity: number | null
          parent_event_id: string | null
          payment_amount: number | null
          recurrence_end: string | null
          recurrence_rule: string | null
          requires_checkin: boolean | null
          requires_payment: boolean | null
          requires_registration: boolean | null
          requires_survey: boolean | null
          sede_id: string | null
          server_price: number | null
          servers_pay: boolean
          starts_at: string
          status: string | null
          title: string
          updated_at: string | null
          virtual_url: string | null
        }
        Insert: {
          cancellation_reason?: string | null
          committee_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          event_type: string
          flyer_url?: string | null
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          is_recurring?: boolean | null
          is_virtual?: boolean | null
          location?: string | null
          location_url?: string | null
          max_capacity?: number | null
          parent_event_id?: string | null
          payment_amount?: number | null
          recurrence_end?: string | null
          recurrence_rule?: string | null
          requires_checkin?: boolean | null
          requires_payment?: boolean | null
          requires_registration?: boolean | null
          requires_survey?: boolean | null
          sede_id?: string | null
          server_price?: number | null
          servers_pay?: boolean
          starts_at: string
          status?: string | null
          title: string
          updated_at?: string | null
          virtual_url?: string | null
        }
        Update: {
          cancellation_reason?: string | null
          committee_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          event_type?: string
          flyer_url?: string | null
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          is_recurring?: boolean | null
          is_virtual?: boolean | null
          location?: string | null
          location_url?: string | null
          max_capacity?: number | null
          parent_event_id?: string | null
          payment_amount?: number | null
          recurrence_end?: string | null
          recurrence_rule?: string | null
          requires_checkin?: boolean | null
          requires_payment?: boolean | null
          requires_registration?: boolean | null
          requires_survey?: boolean | null
          sede_id?: string | null
          server_price?: number | null
          servers_pay?: boolean
          starts_at?: string
          status?: string | null
          title?: string
          updated_at?: string | null
          virtual_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_event_type_fkey"
            columns: ["event_type"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_parent_event_id_fkey"
            columns: ["parent_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sedes"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          created_at: string | null
          family_unit_id: string | null
          id: string
          linked_by: string | null
          member_id: string | null
          relation: string
        }
        Insert: {
          created_at?: string | null
          family_unit_id?: string | null
          id?: string
          linked_by?: string | null
          member_id?: string | null
          relation: string
        }
        Update: {
          created_at?: string | null
          family_unit_id?: string | null
          id?: string
          linked_by?: string | null
          member_id?: string | null
          relation?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_unit_id_fkey"
            columns: ["family_unit_id"]
            isOneToOne: false
            referencedRelation: "family_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_members_linked_by_fkey"
            columns: ["linked_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_members_linked_by_fkey"
            columns: ["linked_by"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
        ]
      }
      family_units: {
        Row: {
          created_at: string | null
          id: string
          name: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string | null
        }
        Relationships: []
      }
      family_unlink_requests: {
        Row: {
          created_at: string | null
          family_unit_id: string | null
          id: string
          processed_at: string | null
          processed_by: string | null
          reason: string | null
          requester_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          family_unit_id?: string | null
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          requester_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          family_unit_id?: string | null
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          requester_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_unlink_requests_family_unit_id_fkey"
            columns: ["family_unit_id"]
            isOneToOne: false
            referencedRelation: "family_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_unlink_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_unlink_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_unlink_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_unlink_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_request_status_history: {
        Row: {
          changed_by: string | null
          created_at: string | null
          from_status: string | null
          id: string
          notes: string | null
          request_id: string
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          from_status?: string | null
          id?: string
          notes?: string | null
          request_id: string
          to_status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          from_status?: string | null
          id?: string
          notes?: string | null
          request_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_request_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_request_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_request_status_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "finance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_requests: {
        Row: {
          amount: number | null
          created_at: string | null
          id: string
          member_id: string
          payment_id: string | null
          reason: string
          request_type: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          study_group_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          id?: string
          member_id: string
          payment_id?: string | null
          reason: string
          request_type: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          study_group_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          id?: string
          member_id?: string
          payment_id?: string | null
          reason?: string
          request_type?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          study_group_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_requests_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_requests_study_group_id_fkey"
            columns: ["study_group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      form_fields: {
        Row: {
          conditions: Json | null
          created_at: string | null
          description: string | null
          field_type: string
          form_id: string
          help_text: string | null
          id: string
          is_required: boolean | null
          label: string
          options: Json | null
          placeholder: string | null
          scale_max: number | null
          scale_max_label: string | null
          scale_min: number | null
          scale_min_label: string | null
          sort_order: number | null
        }
        Insert: {
          conditions?: Json | null
          created_at?: string | null
          description?: string | null
          field_type: string
          form_id: string
          help_text?: string | null
          id?: string
          is_required?: boolean | null
          label: string
          options?: Json | null
          placeholder?: string | null
          scale_max?: number | null
          scale_max_label?: string | null
          scale_min?: number | null
          scale_min_label?: string | null
          sort_order?: number | null
        }
        Update: {
          conditions?: Json | null
          created_at?: string | null
          description?: string | null
          field_type?: string
          form_id?: string
          help_text?: string | null
          id?: string
          is_required?: boolean | null
          label?: string
          options?: Json | null
          placeholder?: string | null
          scale_max?: number | null
          scale_max_label?: string | null
          scale_min?: number | null
          scale_min_label?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_response_values: {
        Row: {
          created_at: string | null
          field_id: string
          id: string
          response_id: string
          value_json: Json | null
          value_text: string | null
        }
        Insert: {
          created_at?: string | null
          field_id: string
          id?: string
          response_id: string
          value_json?: Json | null
          value_text?: string | null
        }
        Update: {
          created_at?: string | null
          field_id?: string
          id?: string
          response_id?: string
          value_json?: Json | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_response_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "form_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_response_values_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "form_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      form_responses: {
        Row: {
          form_id: string
          guest_email: string | null
          guest_name: string | null
          id: string
          ip_address: unknown
          member_id: string | null
          submitted_at: string | null
        }
        Insert: {
          form_id: string
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          ip_address?: unknown
          member_id?: string | null
          submitted_at?: string | null
        }
        Update: {
          form_id?: string
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          ip_address?: unknown
          member_id?: string | null
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_responses_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_responses_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_responses_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          allow_multiple_responses: boolean | null
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          ends_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          is_active: boolean | null
          is_public: boolean | null
          requires_auth: boolean | null
          slug: string | null
          starts_at: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          allow_multiple_responses?: boolean | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          requires_auth?: boolean | null
          slug?: string | null
          starts_at?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          allow_multiple_responses?: boolean | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          requires_auth?: boolean | null
          slug?: string | null
          starts_at?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          created_at: string | null
          duplicates: number | null
          filename: string
          id: string
          identified: number | null
          imported_at: string | null
          imported_by: string | null
          status: string
          total_rows: number | null
          unidentified: number | null
        }
        Insert: {
          created_at?: string | null
          duplicates?: number | null
          filename: string
          id?: string
          identified?: number | null
          imported_at?: string | null
          imported_by?: string | null
          status?: string
          total_rows?: number | null
          unidentified?: number | null
        }
        Update: {
          created_at?: string | null
          duplicates?: number | null
          filename?: string
          id?: string
          identified?: number | null
          imported_at?: string | null
          imported_by?: string | null
          status?: string
          total_rows?: number | null
          unidentified?: number | null
        }
        Relationships: []
      }
      internal_notifications: {
        Row: {
          body: string | null
          created_at: string | null
          id: string
          link: string | null
          read: boolean | null
          recipient_member_id: string
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          id?: string
          link?: string | null
          read?: boolean | null
          recipient_member_id: string
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          id?: string
          link?: string | null
          read?: boolean | null
          recipient_member_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_notifications_recipient_member_id_fkey"
            columns: ["recipient_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_notifications_recipient_member_id_fkey"
            columns: ["recipient_member_id"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
        ]
      }
      leader_evaluations: {
        Row: {
          comments: string | null
          created_at: string | null
          evaluation_date: string
          group_id: string | null
          id: string
          leader_id: string
          score: number
        }
        Insert: {
          comments?: string | null
          created_at?: string | null
          evaluation_date?: string
          group_id?: string | null
          id?: string
          leader_id: string
          score: number
        }
        Update: {
          comments?: string | null
          created_at?: string | null
          evaluation_date?: string
          group_id?: string | null
          id?: string
          leader_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "leader_evaluations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leader_evaluations_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "study_leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      member_lists: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          filters: Json | null
          id: string
          is_dynamic: boolean
          last_used_at: string | null
          member_count: number
          member_ids: Json
          name: string
          segment_label: string | null
          tags: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          filters?: Json | null
          id?: string
          is_dynamic?: boolean
          last_used_at?: string | null
          member_count?: number
          member_ids?: Json
          name: string
          segment_label?: string | null
          tags?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          filters?: Json | null
          id?: string
          is_dynamic?: boolean
          last_used_at?: string | null
          member_count?: number
          member_ids?: Json
          name?: string
          segment_label?: string | null
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_lists_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_lists_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
        ]
      }
      member_recommendations: {
        Row: {
          created_at: string | null
          id: string
          justification: string | null
          member_id: string
          recommended_by: string | null
          recommended_for: string
          study_group_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          justification?: string | null
          member_id: string
          recommended_by?: string | null
          recommended_for: string
          study_group_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          justification?: string | null
          member_id?: string
          recommended_by?: string | null
          recommended_for?: string
          study_group_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_recommendations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_recommendations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_recommendations_recommended_by_fkey"
            columns: ["recommended_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_recommendations_recommended_by_fkey"
            columns: ["recommended_by"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_recommendations_study_group_id_fkey"
            columns: ["study_group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      member_roles: {
        Row: {
          granted_at: string | null
          granted_by: string | null
          id: string
          is_active: boolean | null
          member_id: string | null
          revoked_at: string | null
          revoked_by: string | null
          role: string
          status_detail: string | null
        }
        Insert: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          is_active?: boolean | null
          member_id?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role: string
          status_detail?: string | null
        }
        Update: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          is_active?: boolean | null
          member_id?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role?: string
          status_detail?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_roles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_roles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          address: string | null
          allergies: string | null
          auth_user_id: string | null
          birth_date: string | null
          canton: string | null
          cedula: string | null
          cedula_normalized: string | null
          created_at: string | null
          deactivated_at: string | null
          deactivated_by: string | null
          deactivation_reason: string | null
          district: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          external_id: string | null
          field_updated_at: Json | null
          first_name: string
          gender: string | null
          id: string
          is_active: boolean | null
          is_donor: boolean | null
          last_name: string
          marital_status: string | null
          medications: string | null
          occupation: string | null
          phone: string | null
          photo_url: string | null
          province: string | null
          sede_id: string | null
          smart_link_token: string | null
          updated_at: string | null
          wallet_pass_id: string | null
          workplace: string | null
        }
        Insert: {
          address?: string | null
          allergies?: string | null
          auth_user_id?: string | null
          birth_date?: string | null
          canton?: string | null
          cedula?: string | null
          cedula_normalized?: string | null
          created_at?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          deactivation_reason?: string | null
          district?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          external_id?: string | null
          field_updated_at?: Json | null
          first_name: string
          gender?: string | null
          id?: string
          is_active?: boolean | null
          is_donor?: boolean | null
          last_name: string
          marital_status?: string | null
          medications?: string | null
          occupation?: string | null
          phone?: string | null
          photo_url?: string | null
          province?: string | null
          sede_id?: string | null
          smart_link_token?: string | null
          updated_at?: string | null
          wallet_pass_id?: string | null
          workplace?: string | null
        }
        Update: {
          address?: string | null
          allergies?: string | null
          auth_user_id?: string | null
          birth_date?: string | null
          canton?: string | null
          cedula?: string | null
          cedula_normalized?: string | null
          created_at?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          deactivation_reason?: string | null
          district?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          external_id?: string | null
          field_updated_at?: Json | null
          first_name?: string
          gender?: string | null
          id?: string
          is_active?: boolean | null
          is_donor?: boolean | null
          last_name?: string
          marital_status?: string | null
          medications?: string | null
          occupation?: string | null
          phone?: string | null
          photo_url?: string | null
          province?: string | null
          sede_id?: string | null
          smart_link_token?: string | null
          updated_at?: string | null
          wallet_pass_id?: string | null
          workplace?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_sede_id_fkey"
            columns: ["sede_id"]
            isOneToOne: false
            referencedRelation: "sedes"
            referencedColumns: ["id"]
          },
        ]
      }
      message_broadcasts: {
        Row: {
          body: string
          channel: string
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          failed_count: number | null
          id: string
          recipient_filter: Json | null
          scheduled_at: string | null
          segment_label: string | null
          sent_count: number | null
          smtp_config_id: string | null
          started_at: string | null
          status: string | null
          subject: string | null
          template_id: string | null
          total_recipients: number | null
          updated_at: string | null
          whatsapp_config_id: string | null
        }
        Insert: {
          body: string
          channel: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          failed_count?: number | null
          id?: string
          recipient_filter?: Json | null
          scheduled_at?: string | null
          segment_label?: string | null
          sent_count?: number | null
          smtp_config_id?: string | null
          started_at?: string | null
          status?: string | null
          subject?: string | null
          template_id?: string | null
          total_recipients?: number | null
          updated_at?: string | null
          whatsapp_config_id?: string | null
        }
        Update: {
          body?: string
          channel?: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          failed_count?: number | null
          id?: string
          recipient_filter?: Json | null
          scheduled_at?: string | null
          segment_label?: string | null
          sent_count?: number | null
          smtp_config_id?: string | null
          started_at?: string | null
          status?: string | null
          subject?: string | null
          template_id?: string | null
          total_recipients?: number | null
          updated_at?: string | null
          whatsapp_config_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_broadcasts_smtp_config_id_fkey"
            columns: ["smtp_config_id"]
            isOneToOne: false
            referencedRelation: "channel_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_broadcasts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_broadcasts_whatsapp_config_id_fkey"
            columns: ["whatsapp_config_id"]
            isOneToOne: false
            referencedRelation: "channel_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      message_logs: {
        Row: {
          attempts: number | null
          broadcast_id: string | null
          channel: string
          claimed_at: string | null
          created_at: string | null
          delivered_at: string | null
          error_message: string | null
          id: string
          last_error: string | null
          member_id: string | null
          recipient: string
          scheduled_date: string | null
          sent_at: string | null
          status: string | null
        }
        Insert: {
          attempts?: number | null
          broadcast_id?: string | null
          channel: string
          claimed_at?: string | null
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          last_error?: string | null
          member_id?: string | null
          recipient: string
          scheduled_date?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          attempts?: number | null
          broadcast_id?: string | null
          channel?: string
          claimed_at?: string | null
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          last_error?: string | null
          member_id?: string | null
          recipient?: string
          scheduled_date?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_logs_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "message_broadcasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          category: string | null
          channel: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          name: string
          subject: string | null
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          body: string
          category?: string | null
          channel: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          subject?: string | null
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          body?: string
          category?: string | null
          channel?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          subject?: string | null
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      paid_positions: {
        Row: {
          committee_id: string | null
          contract_type: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          salary_max: number | null
          salary_min: number | null
          updated_at: string | null
        }
        Insert: {
          committee_id?: string | null
          contract_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          salary_max?: number | null
          salary_min?: number | null
          updated_at?: string | null
        }
        Update: {
          committee_id?: string | null
          contract_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          salary_max?: number | null
          salary_min?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paid_positions_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_donation: boolean | null
          name: string
          type: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_donation?: boolean | null
          name: string
          type: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_donation?: boolean | null
          name?: string
          type?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          entity_type: string | null
          event_id: string | null
          gateway_ref: string | null
          id: string
          member_id: string | null
          paid_at: string | null
          payment_date: string
          payment_method: string | null
          recorded_by: string | null
          reference_code: string | null
          scholarship: boolean | null
          scholarship_id: string | null
          scholarship_reason: string | null
          sinpe_confirmation: string | null
          status: string | null
          study_group_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          entity_type?: string | null
          event_id?: string | null
          gateway_ref?: string | null
          id?: string
          member_id?: string | null
          paid_at?: string | null
          payment_date?: string
          payment_method?: string | null
          recorded_by?: string | null
          reference_code?: string | null
          scholarship?: boolean | null
          scholarship_id?: string | null
          scholarship_reason?: string | null
          sinpe_confirmation?: string | null
          status?: string | null
          study_group_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          entity_type?: string | null
          event_id?: string | null
          gateway_ref?: string | null
          id?: string
          member_id?: string | null
          paid_at?: string | null
          payment_date?: string
          payment_method?: string | null
          recorded_by?: string | null
          reference_code?: string | null
          scholarship?: boolean | null
          scholarship_id?: string | null
          scholarship_reason?: string | null
          sinpe_confirmation?: string | null
          status?: string | null
          study_group_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "payment_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "scholarships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_study_group_id_fkey"
            columns: ["study_group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      position_records: {
        Row: {
          contract_type: string | null
          created_at: string | null
          employee_id: string
          end_date: string | null
          id: string
          position_name: string
          start_date: string | null
        }
        Insert: {
          contract_type?: string | null
          created_at?: string | null
          employee_id: string
          end_date?: string | null
          id?: string
          position_name: string
          start_date?: string | null
        }
        Update: {
          contract_type?: string | null
          created_at?: string | null
          employee_id?: string
          end_date?: string | null
          id?: string
          position_name?: string
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "position_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          member_id: string | null
          method: string | null
          notes: string | null
          payment_id: string
          processed_at: string | null
          processed_by: string | null
          reason: string | null
          requested_at: string | null
          sinpe_pending: boolean | null
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          member_id?: string | null
          method?: string | null
          notes?: string | null
          payment_id: string
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          requested_at?: string | null
          sinpe_pending?: boolean | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          member_id?: string | null
          method?: string | null
          notes?: string | null
          payment_id?: string
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          requested_at?: string | null
          sinpe_pending?: boolean | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refunds_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_changes: {
        Row: {
          approved_by: string | null
          change_date: string
          created_at: string | null
          employee_id: string
          id: string
          new_salary: number
          previous_salary: number | null
          reason: string | null
        }
        Insert: {
          approved_by?: string | null
          change_date?: string
          created_at?: string | null
          employee_id: string
          id?: string
          new_salary: number
          previous_salary?: number | null
          reason?: string | null
        }
        Update: {
          approved_by?: string | null
          change_date?: string
          created_at?: string | null
          employee_id?: string
          id?: string
          new_salary?: number
          previous_salary?: number | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_changes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      scholarships: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          created_by: string | null
          discount_type: string | null
          discount_value: number | null
          entity_type: string | null
          event_id: string | null
          final_amount: number | null
          id: string
          is_used: boolean | null
          member_id: string
          notes: string | null
          original_amount: number | null
          reason: string
          status: string | null
          study_group_id: string | null
          updated_at: string | null
          used_at: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          discount_type?: string | null
          discount_value?: number | null
          entity_type?: string | null
          event_id?: string | null
          final_amount?: number | null
          id?: string
          is_used?: boolean | null
          member_id: string
          notes?: string | null
          original_amount?: number | null
          reason: string
          status?: string | null
          study_group_id?: string | null
          updated_at?: string | null
          used_at?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          discount_type?: string | null
          discount_value?: number | null
          entity_type?: string | null
          event_id?: string | null
          final_amount?: number | null
          id?: string
          is_used?: boolean | null
          member_id?: string
          notes?: string | null
          original_amount?: number | null
          reason?: string
          status?: string | null
          study_group_id?: string | null
          updated_at?: string | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scholarships_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarships_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarships_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarships_study_group_id_fkey"
            columns: ["study_group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      sedes: {
        Row: {
          age_group: string | null
          code: string
          created_at: string | null
          day: string | null
          id: string
          is_active: boolean | null
          is_historical: boolean | null
          location: string | null
          name: string
          time: string | null
          updated_at: string | null
          waze_url: string | null
        }
        Insert: {
          age_group?: string | null
          code: string
          created_at?: string | null
          day?: string | null
          id?: string
          is_active?: boolean | null
          is_historical?: boolean | null
          location?: string | null
          name: string
          time?: string | null
          updated_at?: string | null
          waze_url?: string | null
        }
        Update: {
          age_group?: string | null
          code?: string
          created_at?: string | null
          day?: string | null
          id?: string
          is_active?: boolean | null
          is_historical?: boolean | null
          location?: string | null
          name?: string
          time?: string | null
          updated_at?: string | null
          waze_url?: string | null
        }
        Relationships: []
      }
      service_positions: {
        Row: {
          area_id: string
          base_area_id: string | null
          created_at: string | null
          description: string | null
          expires_at: string | null
          functions: string | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          location: string | null
          max_volunteers: number | null
          profile: string | null
          quantity: number | null
          requirements: string | null
          study_requirement: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          area_id: string
          base_area_id?: string | null
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          functions?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          location?: string | null
          max_volunteers?: number | null
          profile?: string | null
          quantity?: number | null
          requirements?: string | null
          study_requirement?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          area_id?: string
          base_area_id?: string | null
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          functions?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          location?: string | null
          max_volunteers?: number | null
          profile?: string | null
          quantity?: number | null
          requirements?: string | null
          study_requirement?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_positions_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_positions_base_area_id_fkey"
            columns: ["base_area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      study_attendance: {
        Row: {
          created_at: string | null
          id: string
          member_id: string
          notes: string | null
          present: boolean | null
          recorded_by: string | null
          session_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          member_id: string
          notes?: string | null
          present?: boolean | null
          recorded_by?: string | null
          session_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          member_id?: string
          notes?: string | null
          present?: boolean | null
          recorded_by?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "study_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      study_enrollments: {
        Row: {
          completed_at: string | null
          created_at: string | null
          drop_reason: string | null
          dropped_at: string | null
          enrolled_at: string | null
          grade: number | null
          group_id: string | null
          id: string
          member_id: string
          notes: string | null
          plan_id: string | null
          status: string | null
          transferred_to: string | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          drop_reason?: string | null
          dropped_at?: string | null
          enrolled_at?: string | null
          grade?: number | null
          group_id?: string | null
          id?: string
          member_id: string
          notes?: string | null
          plan_id?: string | null
          status?: string | null
          transferred_to?: string | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          drop_reason?: string | null
          dropped_at?: string | null
          enrolled_at?: string | null
          grade?: number | null
          group_id?: string | null
          id?: string
          member_id?: string
          notes?: string | null
          plan_id?: string | null
          status?: string | null
          transferred_to?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "study_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_enrollments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_enrollments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_enrollments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "study_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_enrollments_transferred_to_fkey"
            columns: ["transferred_to"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      study_groups: {
        Row: {
          co_leader_id: string | null
          created_at: string | null
          current_week: number | null
          ends_at: string | null
          id: string
          is_leader_training: boolean | null
          leader_id: string | null
          location: string | null
          max_students: number | null
          name: string
          plan_id: string
          schedule: string | null
          schedule_days: string[] | null
          schedule_time: string | null
          sede: string | null
          starts_at: string | null
          status: string | null
          training_modality: string | null
          updated_at: string | null
          whatsapp_group_url: string | null
          zone: string | null
        }
        Insert: {
          co_leader_id?: string | null
          created_at?: string | null
          current_week?: number | null
          ends_at?: string | null
          id?: string
          is_leader_training?: boolean | null
          leader_id?: string | null
          location?: string | null
          max_students?: number | null
          name: string
          plan_id: string
          schedule?: string | null
          schedule_days?: string[] | null
          schedule_time?: string | null
          sede?: string | null
          starts_at?: string | null
          status?: string | null
          training_modality?: string | null
          updated_at?: string | null
          whatsapp_group_url?: string | null
          zone?: string | null
        }
        Update: {
          co_leader_id?: string | null
          created_at?: string | null
          current_week?: number | null
          ends_at?: string | null
          id?: string
          is_leader_training?: boolean | null
          leader_id?: string | null
          location?: string | null
          max_students?: number | null
          name?: string
          plan_id?: string
          schedule?: string | null
          schedule_days?: string[] | null
          schedule_time?: string | null
          sede?: string | null
          starts_at?: string | null
          status?: string | null
          training_modality?: string | null
          updated_at?: string | null
          whatsapp_group_url?: string | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "study_groups_co_leader_id_fkey"
            columns: ["co_leader_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_groups_co_leader_id_fkey"
            columns: ["co_leader_id"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_groups_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_groups_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_groups_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "study_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      study_leaders: {
        Row: {
          availability_status: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          member_id: string
          qualified_study_codes: string[] | null
          updated_at: string | null
          zone_preference: string[] | null
        }
        Insert: {
          availability_status?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          member_id: string
          qualified_study_codes?: string[] | null
          updated_at?: string | null
          zone_preference?: string[] | null
        }
        Update: {
          availability_status?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          member_id?: string
          qualified_study_codes?: string[] | null
          updated_at?: string | null
          zone_preference?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "study_leaders_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_leaders_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
        ]
      }
      study_notification_recipients: {
        Row: {
          created_at: string | null
          id: string
          member_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          member_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_notification_recipients_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_notification_recipients_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
        ]
      }
      study_plans: {
        Row: {
          auto_promote: boolean | null
          code: string | null
          commitments: string | null
          cost: number | null
          created_at: string | null
          description: string | null
          difficulty: string | null
          duration_weeks: number | null
          id: string
          is_active: boolean | null
          is_curricular: boolean
          level: string
          max_students: number | null
          mentor_id: string | null
          min_attendance_pct: number | null
          name: string
          next_study_code: string | null
          prerequisite_code: string | null
          requires_attendance: boolean | null
          requires_bus_talk: boolean
          requires_donor: boolean | null
          requires_grade: boolean | null
          requires_invitation: boolean
          requires_payment: boolean | null
          requires_server: boolean | null
          updated_at: string | null
        }
        Insert: {
          auto_promote?: boolean | null
          code?: string | null
          commitments?: string | null
          cost?: number | null
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          duration_weeks?: number | null
          id?: string
          is_active?: boolean | null
          is_curricular?: boolean
          level: string
          max_students?: number | null
          mentor_id?: string | null
          min_attendance_pct?: number | null
          name: string
          next_study_code?: string | null
          prerequisite_code?: string | null
          requires_attendance?: boolean | null
          requires_bus_talk?: boolean
          requires_donor?: boolean | null
          requires_grade?: boolean | null
          requires_invitation?: boolean
          requires_payment?: boolean | null
          requires_server?: boolean | null
          updated_at?: string | null
        }
        Update: {
          auto_promote?: boolean | null
          code?: string | null
          commitments?: string | null
          cost?: number | null
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          duration_weeks?: number | null
          id?: string
          is_active?: boolean | null
          is_curricular?: boolean
          level?: string
          max_students?: number | null
          mentor_id?: string | null
          min_attendance_pct?: number | null
          name?: string
          next_study_code?: string | null
          prerequisite_code?: string | null
          requires_attendance?: boolean | null
          requires_bus_talk?: boolean
          requires_donor?: boolean | null
          requires_grade?: boolean | null
          requires_invitation?: boolean
          requires_payment?: boolean | null
          requires_server?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "study_plans_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_plans_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
        ]
      }
      study_request_status_history: {
        Row: {
          changed_by: string | null
          created_at: string | null
          from_status: string | null
          id: string
          notes: string | null
          request_id: string
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          from_status?: string | null
          id?: string
          notes?: string | null
          request_id: string
          to_status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          from_status?: string | null
          id?: string
          notes?: string | null
          request_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_request_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_request_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_request_status_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "study_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      study_requests: {
        Row: {
          created_at: string | null
          current_group_id: string | null
          existing_group_id: string | null
          id: string
          member_id: string
          plan_id: string | null
          proposed_location: string | null
          proposed_schedule: string | null
          reason: string
          request_type: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_group_id?: string | null
          existing_group_id?: string | null
          id?: string
          member_id: string
          plan_id?: string | null
          proposed_location?: string | null
          proposed_schedule?: string | null
          reason: string
          request_type: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_group_id?: string | null
          existing_group_id?: string | null
          id?: string
          member_id?: string
          plan_id?: string | null
          proposed_location?: string | null
          proposed_schedule?: string | null
          reason?: string
          request_type?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "study_requests_current_group_id_fkey"
            columns: ["current_group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_requests_existing_group_id_fkey"
            columns: ["existing_group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_requests_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "study_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
        ]
      }
      study_sessions: {
        Row: {
          created_at: string | null
          created_by: string | null
          group_id: string
          id: string
          notes: string | null
          session_date: string
          topic: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          group_id: string
          id?: string
          notes?: string | null
          session_date: string
          topic?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          group_id?: string
          id?: string
          notes?: string | null
          session_date?: string
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_events: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          max_capacity: number
          name: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          max_capacity?: number
          name: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          max_capacity?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      vacancies: {
        Row: {
          commitment: string | null
          committee_id: string
          created_at: string | null
          description: string | null
          functions: string[] | null
          id: string
          position: string | null
          position_id: string | null
          published_at: string | null
          schedule: string | null
          slots_filled: number | null
          slots_total: number | null
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          commitment?: string | null
          committee_id: string
          created_at?: string | null
          description?: string | null
          functions?: string[] | null
          id?: string
          position?: string | null
          position_id?: string | null
          published_at?: string | null
          schedule?: string | null
          slots_filled?: number | null
          slots_total?: number | null
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          commitment?: string | null
          committee_id?: string
          created_at?: string | null
          description?: string | null
          functions?: string[] | null
          id?: string
          position?: string | null
          position_id?: string | null
          published_at?: string | null
          schedule?: string | null
          slots_filled?: number | null
          slots_total?: number | null
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vacancies_committee_id_fkey"
            columns: ["committee_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacancies_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "service_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      vacation_records: {
        Row: {
          created_at: string | null
          days: number
          employee_id: string
          end_date: string
          id: string
          notes: string | null
          start_date: string
          status: string
          type: string
        }
        Insert: {
          created_at?: string | null
          days?: number
          employee_id: string
          end_date: string
          id?: string
          notes?: string | null
          start_date: string
          status?: string
          type: string
        }
        Update: {
          created_at?: string | null
          days?: number
          employee_id?: string
          end_date?: string
          id?: string
          notes?: string | null
          start_date?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "vacation_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteers: {
        Row: {
          created_at: string | null
          end_date: string | null
          id: string
          member_id: string
          notes: string | null
          position_id: string
          start_date: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          member_id: string
          notes?: string | null
          position_id: string
          start_date?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          member_id?: string
          notes?: string | null
          position_id?: string
          start_date?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "volunteers_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteers_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "vw_asistentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteers_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "service_positions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      vw_asistencia_mensual: {
        Row: {
          event_type: string | null
          eventos_realizados: number | null
          mes: string | null
          miembros_unicos: number | null
          total_asistentes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "events_event_type_fkey"
            columns: ["event_type"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_asistencia_semanal: {
        Row: {
          event_type: string | null
          evento: string | null
          miembros: number | null
          semana: string | null
          total_asistentes: number | null
          visitantes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "events_event_type_fkey"
            columns: ["event_type"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_asistentes: {
        Row: {
          canton: string | null
          cedula: string | null
          id: string | null
          nombre: string | null
          phone: string | null
          province: string | null
          total_asistencias: number | null
          ultima_asistencia: string | null
        }
        Relationships: []
      }
      vw_resumen_financiero: {
        Row: {
          cantidad_pagos: number | null
          categoria: string | null
          currency: string | null
          mes: string | null
          tipo: string | null
          total: number | null
          total_becas: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      charla_sede_code: { Args: { p_title: string }; Returns: string }
      dashboard_sums: {
        Args: { p_month_start: string; p_month_start_date: string }
        Returns: {
          income_this_month: number
          servers_unique: number
          total_recipients: number
        }[]
      }
      donation_stats: { Args: never; Returns: Json }
      find_duplicate_pairs: {
        Args: never
        Returns: {
          member_a: string
          member_b: string
          reasons: string[]
        }[]
      }
      merge_members: {
        Args: { dup_id: string; keep_id: string; soft?: boolean }
        Returns: undefined
      }
      payment_stats: { Args: never; Returns: Json }
      refresh_donor_flags: { Args: never; Returns: undefined }
      refresh_member_sedes: { Args: never; Returns: undefined }
      study_dashboard_stats: {
        Args: never
        Returns: {
          categoria: string
          estado: string
          estudiantes: number
          grupos: number
        }[]
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
