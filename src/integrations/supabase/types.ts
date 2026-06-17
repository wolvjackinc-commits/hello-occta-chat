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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      acceptance_certificates: {
        Row: {
          certificate_number: string
          contract_acceptance_id: string
          contract_summary_id: string
          created_at: string
          customer_id: string | null
          generated_at: string
          id: string
          journey_id: string | null
          quote_id: string
          sha256: string
          storage_key: string
        }
        Insert: {
          certificate_number: string
          contract_acceptance_id: string
          contract_summary_id: string
          created_at?: string
          customer_id?: string | null
          generated_at?: string
          id?: string
          journey_id?: string | null
          quote_id: string
          sha256: string
          storage_key: string
        }
        Update: {
          certificate_number?: string
          contract_acceptance_id?: string
          contract_summary_id?: string
          created_at?: string
          customer_id?: string | null
          generated_at?: string
          id?: string
          journey_id?: string | null
          quote_id?: string
          sha256?: string
          storage_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "acceptance_certificates_contract_acceptance_id_fkey"
            columns: ["contract_acceptance_id"]
            isOneToOne: true
            referencedRelation: "contract_acceptances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acceptance_certificates_contract_summary_id_fkey"
            columns: ["contract_summary_id"]
            isOneToOne: false
            referencedRelation: "contract_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acceptance_certificates_contract_summary_id_fkey"
            columns: ["contract_summary_id"]
            isOneToOne: false
            referencedRelation: "customer_contract_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acceptance_certificates_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "order_journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      account_deletions: {
        Row: {
          account_number: string | null
          deleted_at: string
          deleted_by: string
          email: string
          full_name: string | null
          id: string
          original_user_id: string
          reason: string | null
        }
        Insert: {
          account_number?: string | null
          deleted_at?: string
          deleted_by?: string
          email: string
          full_name?: string | null
          id?: string
          original_user_id: string
          reason?: string | null
        }
        Update: {
          account_number?: string | null
          deleted_at?: string
          deleted_by?: string
          email?: string
          full_name?: string | null
          id?: string
          original_user_id?: string
          reason?: string | null
        }
        Relationships: []
      }
      activity_log: {
        Row: {
          actor_id: string | null
          actor_type: string
          audit_locked: boolean
          complaint_id: string | null
          contract_summary_id: string | null
          customer_id: string | null
          details: Json
          event_type: string
          id: string
          invoice_id: string | null
          ip: string | null
          new_value: Json | null
          old_value: Json | null
          order_id: string | null
          quote_id: string | null
          severity: string
          source_module: string
          ticket_id: string | null
          title: string
          ts: string
          ua: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_type: string
          audit_locked?: boolean
          complaint_id?: string | null
          contract_summary_id?: string | null
          customer_id?: string | null
          details?: Json
          event_type: string
          id?: string
          invoice_id?: string | null
          ip?: string | null
          new_value?: Json | null
          old_value?: Json | null
          order_id?: string | null
          quote_id?: string | null
          severity?: string
          source_module?: string
          ticket_id?: string | null
          title: string
          ts?: string
          ua?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          audit_locked?: boolean
          complaint_id?: string | null
          contract_summary_id?: string | null
          customer_id?: string | null
          details?: Json
          event_type?: string
          id?: string
          invoice_id?: string | null
          ip?: string | null
          new_value?: Json | null
          old_value?: Json | null
          order_id?: string | null
          quote_id?: string | null
          severity?: string
          source_module?: string
          ticket_id?: string | null
          title?: string
          ts?: string
          ua?: string | null
        }
        Relationships: []
      }
      admin_reconciliation_tasks: {
        Row: {
          created_at: string
          id: string
          kind: string
          payload: Json
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
        }
        Relationships: []
      }
      admin_task_notes: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_task_notes_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "admin_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_tasks: {
        Row: {
          assigned_to: string | null
          cancelled_at: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          priority: string
          related_account_number: string | null
          related_contract_summary_id: string | null
          related_customer_id: string | null
          related_payment_request_id: string | null
          related_quote_id: string | null
          resolved_at: string | null
          status: string
          task_number: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          cancelled_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          related_account_number?: string | null
          related_contract_summary_id?: string | null
          related_customer_id?: string | null
          related_payment_request_id?: string | null
          related_quote_id?: string | null
          resolved_at?: string | null
          status?: string
          task_number?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          cancelled_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          related_account_number?: string | null
          related_contract_summary_id?: string | null
          related_customer_id?: string | null
          related_payment_request_id?: string | null
          related_quote_id?: string | null
          resolved_at?: string | null
          status?: string
          task_number?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_handoff_rules: {
        Row: {
          action: string
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          rule_text: string
          trigger_type: string
          updated_at: string
        }
        Insert: {
          action: string
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          rule_text: string
          trigger_type: string
          updated_at?: string
        }
        Update: {
          action?: string
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          rule_text?: string
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "admin_customer_search_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "customer_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_events: {
        Row: {
          created_at: string
          details: Json
          event_type: string
          id: string
          invoice_id: string | null
          service_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          event_type: string
          id?: string
          invoice_id?: string | null
          service_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          event_type?: string
          id?: string
          invoice_id?: string | null
          service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_runs: {
        Row: {
          details: Json
          errors_count: number
          finished_at: string | null
          id: string
          invoices_created: number
          run_date: string
          services_processed: number
          started_at: string
        }
        Insert: {
          details?: Json
          errors_count?: number
          finished_at?: string | null
          id?: string
          invoices_created?: number
          run_date: string
          services_processed?: number
          started_at?: string
        }
        Update: {
          details?: Json
          errors_count?: number
          finished_at?: string | null
          id?: string
          invoices_created?: number
          run_date?: string
          services_processed?: number
          started_at?: string
        }
        Relationships: []
      }
      billing_settings: {
        Row: {
          auto_pay_enabled: boolean
          billing_day: number | null
          billing_mode: string
          created_at: string
          id: string
          late_fee_grace_days: number | null
          next_invoice_date: string | null
          payment_terms_days: number
          preferred_payment_method: string | null
          updated_at: string
          user_id: string
          vat_enabled_default: boolean
          vat_rate_default: number
        }
        Insert: {
          auto_pay_enabled?: boolean
          billing_day?: number | null
          billing_mode?: string
          created_at?: string
          id?: string
          late_fee_grace_days?: number | null
          next_invoice_date?: string | null
          payment_terms_days?: number
          preferred_payment_method?: string | null
          updated_at?: string
          user_id: string
          vat_enabled_default?: boolean
          vat_rate_default?: number
        }
        Update: {
          auto_pay_enabled?: boolean
          billing_day?: number | null
          billing_mode?: string
          created_at?: string
          id?: string
          late_fee_grace_days?: number | null
          next_invoice_date?: string | null
          payment_terms_days?: number
          preferred_payment_method?: string | null
          updated_at?: string
          user_id?: string
          vat_enabled_default?: boolean
          vat_rate_default?: number
        }
        Relationships: []
      }
      campaign_drafts: {
        Row: {
          active: boolean
          approval_status: Database["public"]["Enums"]["campaign_approval_status"]
          approved_by: string | null
          campaign_type: Database["public"]["Enums"]["campaign_draft_type"]
          compliance_check_status: Database["public"]["Enums"]["campaign_compliance_status"]
          created_at: string
          created_by: string | null
          draft_copy: string | null
          ends_at: string | null
          id: string
          margin_check_status: Database["public"]["Enums"]["campaign_margin_status"]
          offer_terms: string | null
          performance_json: Json
          published_at: string | null
          starts_at: string | null
          target_audience: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          approval_status?: Database["public"]["Enums"]["campaign_approval_status"]
          approved_by?: string | null
          campaign_type: Database["public"]["Enums"]["campaign_draft_type"]
          compliance_check_status?: Database["public"]["Enums"]["campaign_compliance_status"]
          created_at?: string
          created_by?: string | null
          draft_copy?: string | null
          ends_at?: string | null
          id?: string
          margin_check_status?: Database["public"]["Enums"]["campaign_margin_status"]
          offer_terms?: string | null
          performance_json?: Json
          published_at?: string | null
          starts_at?: string | null
          target_audience?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          approval_status?: Database["public"]["Enums"]["campaign_approval_status"]
          approved_by?: string | null
          campaign_type?: Database["public"]["Enums"]["campaign_draft_type"]
          compliance_check_status?: Database["public"]["Enums"]["campaign_compliance_status"]
          created_at?: string
          created_by?: string | null
          draft_copy?: string | null
          ends_at?: string | null
          id?: string
          margin_check_status?: Database["public"]["Enums"]["campaign_margin_status"]
          offer_terms?: string | null
          performance_json?: Json
          published_at?: string | null
          starts_at?: string | null
          target_audience?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      campaign_recipients: {
        Row: {
          account_number: string | null
          bounced_at: string | null
          campaign_id: string
          created_at: string
          delivered_at: string | null
          email: string
          error_message: string | null
          failed_at: string | null
          full_name: string | null
          id: string
          open_count: number | null
          opened_at: string | null
          provider_message_id: string | null
          queued_at: string | null
          sent_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          account_number?: string | null
          bounced_at?: string | null
          campaign_id: string
          created_at?: string
          delivered_at?: string | null
          email: string
          error_message?: string | null
          failed_at?: string | null
          full_name?: string | null
          id?: string
          open_count?: number | null
          opened_at?: string | null
          provider_message_id?: string | null
          queued_at?: string | null
          sent_at?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          account_number?: string | null
          bounced_at?: string | null
          campaign_id?: string
          created_at?: string
          delivered_at?: string | null
          email?: string
          error_message?: string | null
          failed_at?: string | null
          full_name?: string | null
          id?: string
          open_count?: number | null
          opened_at?: string | null
          provider_message_id?: string | null
          queued_at?: string | null
          sent_at?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_customer_search_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "customer_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          bounced_count: number | null
          campaign_name: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          delivered_count: number | null
          failed_count: number | null
          id: string
          opened_count: number | null
          recipient_filter: Json | null
          scheduled_at: string | null
          sent_count: number | null
          started_at: string | null
          status: string
          template_id: string
          total_recipients: number | null
          updated_at: string
        }
        Insert: {
          bounced_count?: number | null
          campaign_name: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          delivered_count?: number | null
          failed_count?: number | null
          id?: string
          opened_count?: number | null
          recipient_filter?: Json | null
          scheduled_at?: string | null
          sent_count?: number | null
          started_at?: string | null
          status?: string
          template_id: string
          total_recipients?: number | null
          updated_at?: string
        }
        Update: {
          bounced_count?: number | null
          campaign_name?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          delivered_count?: number | null
          failed_count?: number | null
          id?: string
          opened_count?: number | null
          recipient_filter?: Json | null
          scheduled_at?: string | null
          sent_count?: number | null
          started_at?: string | null
          status?: string
          template_id?: string
          total_recipients?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_customer_search_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "customer_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_analytics: {
        Row: {
          created_at: string
          detected_category: string | null
          detected_intent: string | null
          id: string
          message_content: string
          message_type: string
          response_time_ms: number | null
          session_id: string
          tool_used: string | null
          user_id: string | null
          was_helpful: boolean | null
        }
        Insert: {
          created_at?: string
          detected_category?: string | null
          detected_intent?: string | null
          id?: string
          message_content: string
          message_type: string
          response_time_ms?: number | null
          session_id: string
          tool_used?: string | null
          user_id?: string | null
          was_helpful?: boolean | null
        }
        Update: {
          created_at?: string
          detected_category?: string | null
          detected_intent?: string | null
          id?: string
          message_content?: string
          message_type?: string
          response_time_ms?: number | null
          session_id?: string
          tool_used?: string | null
          user_id?: string | null
          was_helpful?: boolean | null
        }
        Relationships: []
      }
      communication_messages: {
        Row: {
          attachments_json: Json
          body: string
          channel: string
          created_at: string
          direction: string
          id: string
          metadata_json: Json
          sender_id: string | null
          sender_type: string
          subject: string | null
          thread_id: string
        }
        Insert: {
          attachments_json?: Json
          body: string
          channel: string
          created_at?: string
          direction: string
          id?: string
          metadata_json?: Json
          sender_id?: string | null
          sender_type: string
          subject?: string | null
          thread_id: string
        }
        Update: {
          attachments_json?: Json
          body?: string
          channel?: string
          created_at?: string
          direction?: string
          id?: string
          metadata_json?: Json
          sender_id?: string | null
          sender_type?: string
          subject?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "communication_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_threads: {
        Row: {
          channel: string
          created_at: string
          customer_id: string | null
          id: string
          related_complaint_id: string | null
          related_invoice_id: string | null
          related_order_id: string | null
          related_quote_id: string | null
          related_ticket_id: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          channel: string
          created_at?: string
          customer_id?: string | null
          id?: string
          related_complaint_id?: string | null
          related_invoice_id?: string | null
          related_order_id?: string | null
          related_quote_id?: string | null
          related_ticket_id?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          related_complaint_id?: string | null
          related_invoice_id?: string | null
          related_order_id?: string | null
          related_quote_id?: string | null
          related_ticket_id?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      communications_log: {
        Row: {
          created_at: string
          delivered_at: string | null
          error_message: string | null
          id: string
          invoice_id: string | null
          metadata: Json | null
          opened_at: string | null
          payment_request_id: string | null
          provider_message_id: string | null
          recipient_email: string
          sent_at: string | null
          status: string
          template_name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          opened_at?: string | null
          payment_request_id?: string | null
          provider_message_id?: string | null
          recipient_email: string
          sent_at?: string | null
          status?: string
          template_name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          opened_at?: string | null
          payment_request_id?: string | null
          provider_message_id?: string | null
          recipient_email?: string
          sent_at?: string | null
          status?: string
          template_name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communications_log_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_log_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_customer_search_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "customer_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_events: {
        Row: {
          actor_id: string | null
          actor_type: string
          complaint_id: string
          created_at: string
          details: Json
          event_type: string
          id: string
          title: string
          visibility: string
        }
        Insert: {
          actor_id?: string | null
          actor_type?: string
          complaint_id: string
          created_at?: string
          details?: Json
          event_type: string
          id?: string
          title: string
          visibility?: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          complaint_id?: string
          created_at?: string
          details?: Json
          event_type?: string
          id?: string
          title?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_events_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_evidence_links: {
        Row: {
          added_by: string | null
          complaint_id: string
          created_at: string
          evidence_type: string
          id: string
          related_id: string | null
          title: string
          url: string | null
        }
        Insert: {
          added_by?: string | null
          complaint_id: string
          created_at?: string
          evidence_type: string
          id?: string
          related_id?: string | null
          title: string
          url?: string | null
        }
        Update: {
          added_by?: string | null
          complaint_id?: string
          created_at?: string
          evidence_type?: string
          id?: string
          related_id?: string | null
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaint_evidence_links_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_letters: {
        Row: {
          body: string
          complaint_id: string
          created_at: string
          created_by: string | null
          id: string
          letter_type: string
          sent_at: string | null
          status: string
          subject: string
        }
        Insert: {
          body: string
          complaint_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          letter_type: string
          sent_at?: string | null
          status?: string
          subject: string
        }
        Update: {
          body?: string
          complaint_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          letter_type?: string
          sent_at?: string | null
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_letters_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          adr_provider: string | null
          adr_reference: string | null
          assigned_to: string | null
          category: string
          closed_at: string | null
          complaint_reference: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          customer_desired_outcome: string | null
          customer_id: string | null
          deadlock_issued_at: string | null
          first_response_due_at: string | null
          id: string
          linked_ticket_id: string | null
          opened_at: string
          priority: Database["public"]["Enums"]["complaint_priority"]
          resolved_at: string | null
          six_week_adr_eligible_at: string
          status: Database["public"]["Enums"]["complaint_status"]
          summary: string
          updated_at: string
        }
        Insert: {
          adr_provider?: string | null
          adr_reference?: string | null
          assigned_to?: string | null
          category: string
          closed_at?: string | null
          complaint_reference: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          customer_desired_outcome?: string | null
          customer_id?: string | null
          deadlock_issued_at?: string | null
          first_response_due_at?: string | null
          id?: string
          linked_ticket_id?: string | null
          opened_at?: string
          priority?: Database["public"]["Enums"]["complaint_priority"]
          resolved_at?: string | null
          six_week_adr_eligible_at: string
          status?: Database["public"]["Enums"]["complaint_status"]
          summary: string
          updated_at?: string
        }
        Update: {
          adr_provider?: string | null
          adr_reference?: string | null
          assigned_to?: string | null
          category?: string
          closed_at?: string | null
          complaint_reference?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          customer_desired_outcome?: string | null
          customer_id?: string | null
          deadlock_issued_at?: string | null
          first_response_due_at?: string | null
          id?: string
          linked_ticket_id?: string | null
          opened_at?: string
          priority?: Database["public"]["Enums"]["complaint_priority"]
          resolved_at?: string | null
          six_week_adr_eligible_at?: string
          status?: Database["public"]["Enums"]["complaint_status"]
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaints_linked_ticket_id_fkey"
            columns: ["linked_ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_acceptances: {
        Row: {
          acceptance_text: string
          acceptance_text_hash: string | null
          acceptance_text_version: string | null
          accepted_at: string
          accepted_at_europe_london: string | null
          accepted_by_email: string
          accepted_by_name: string
          accepted_by_user: string | null
          account_number: string | null
          address_confirmed: boolean
          checkbox_confirmed: boolean
          checkbox_consent: boolean
          checkbox_details_correct: boolean
          checkbox_received_read: boolean
          checkbox_understand_charges: boolean
          contract_summary_id: string
          created_at: string
          cs_version: number | null
          customer_id: string | null
          id: string
          ip: string | null
          journey_id: string | null
          mobile_snapshot: string | null
          pdf_sha256: string | null
          pdf_storage_key: string | null
          privacy_version: string | null
          quote_id: string
          quote_request_id: string | null
          session_id: string | null
          source_route: string | null
          terms_version: string | null
          user_agent: string | null
        }
        Insert: {
          acceptance_text: string
          acceptance_text_hash?: string | null
          acceptance_text_version?: string | null
          accepted_at?: string
          accepted_at_europe_london?: string | null
          accepted_by_email: string
          accepted_by_name: string
          accepted_by_user?: string | null
          account_number?: string | null
          address_confirmed?: boolean
          checkbox_confirmed: boolean
          checkbox_consent?: boolean
          checkbox_details_correct?: boolean
          checkbox_received_read?: boolean
          checkbox_understand_charges?: boolean
          contract_summary_id: string
          created_at?: string
          cs_version?: number | null
          customer_id?: string | null
          id?: string
          ip?: string | null
          journey_id?: string | null
          mobile_snapshot?: string | null
          pdf_sha256?: string | null
          pdf_storage_key?: string | null
          privacy_version?: string | null
          quote_id: string
          quote_request_id?: string | null
          session_id?: string | null
          source_route?: string | null
          terms_version?: string | null
          user_agent?: string | null
        }
        Update: {
          acceptance_text?: string
          acceptance_text_hash?: string | null
          acceptance_text_version?: string | null
          accepted_at?: string
          accepted_at_europe_london?: string | null
          accepted_by_email?: string
          accepted_by_name?: string
          accepted_by_user?: string | null
          account_number?: string | null
          address_confirmed?: boolean
          checkbox_confirmed?: boolean
          checkbox_consent?: boolean
          checkbox_details_correct?: boolean
          checkbox_received_read?: boolean
          checkbox_understand_charges?: boolean
          contract_summary_id?: string
          created_at?: string
          cs_version?: number | null
          customer_id?: string | null
          id?: string
          ip?: string | null
          journey_id?: string | null
          mobile_snapshot?: string | null
          pdf_sha256?: string | null
          pdf_storage_key?: string | null
          privacy_version?: string | null
          quote_id?: string
          quote_request_id?: string | null
          session_id?: string | null
          source_route?: string | null
          terms_version?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_acceptances_contract_summary_id_fkey"
            columns: ["contract_summary_id"]
            isOneToOne: false
            referencedRelation: "contract_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_acceptances_contract_summary_id_fkey"
            columns: ["contract_summary_id"]
            isOneToOne: false
            referencedRelation: "customer_contract_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_acceptances_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "admin_customer_search_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_acceptances_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_acceptances_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_acceptances_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "order_journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_acceptances_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_benefits: {
        Row: {
          active: boolean
          benefit_name: string
          benefit_type: Database["public"]["Enums"]["contract_benefit_type"]
          created_at: string
          customer_type: Database["public"]["Enums"]["benefit_customer_type"]
          description: string | null
          ends_at: string | null
          id: string
          internal_cost_estimate: number | null
          plan_type: Database["public"]["Enums"]["benefit_plan_type"]
          requires_margin_green: boolean
          starts_at: string | null
          terms_text: string | null
          updated_at: string
          value_label: string | null
        }
        Insert: {
          active?: boolean
          benefit_name: string
          benefit_type: Database["public"]["Enums"]["contract_benefit_type"]
          created_at?: string
          customer_type?: Database["public"]["Enums"]["benefit_customer_type"]
          description?: string | null
          ends_at?: string | null
          id?: string
          internal_cost_estimate?: number | null
          plan_type?: Database["public"]["Enums"]["benefit_plan_type"]
          requires_margin_green?: boolean
          starts_at?: string | null
          terms_text?: string | null
          updated_at?: string
          value_label?: string | null
        }
        Update: {
          active?: boolean
          benefit_name?: string
          benefit_type?: Database["public"]["Enums"]["contract_benefit_type"]
          created_at?: string
          customer_type?: Database["public"]["Enums"]["benefit_customer_type"]
          description?: string | null
          ends_at?: string | null
          id?: string
          internal_cost_estimate?: number | null
          plan_type?: Database["public"]["Enums"]["benefit_plan_type"]
          requires_margin_green?: boolean
          starts_at?: string | null
          terms_text?: string | null
          updated_at?: string
          value_label?: string | null
        }
        Relationships: []
      }
      contract_summaries: {
        Row: {
          accepted_at: string | null
          accepted_ip: string | null
          accepted_user_agent: string | null
          account_number: string | null
          business_monthly_ex_vat: number | null
          business_monthly_incl_vat: number | null
          cease_cancellation_charges: string | null
          complaints_adr_info: string
          contract_length: string
          created_at: string
          cs_number: string
          customer_email_snapshot: string
          customer_id: string | null
          customer_name_snapshot: string
          customer_type: Database["public"]["Enums"]["customer_type_kind"]
          delivery_charge: number
          digital_voice_warning: string | null
          emailed_at: string | null
          estimated_download_speed: number | null
          estimated_upload_speed: number | null
          id: string
          installation_charge: number
          issued_at: string | null
          monthly_price_incl_vat: number
          notice_period: string
          one_off_charges_json: Json
          payment_schedule: string
          pdf_generated_at: string | null
          pdf_generated_by: string | null
          pdf_sha256: string | null
          pdf_storage_key: string | null
          pdf_url: string | null
          plan_name: string
          plan_term: string | null
          plan_type: Database["public"]["Enums"]["plan_type_kind"]
          price_rise_policy: string
          privacy_version: string
          public_token_hash: string | null
          quote_id: string
          quote_request_id: string
          router_charge: number
          router_option: Json | null
          selected_addons: Json | null
          service_address: string
          service_type: Database["public"]["Enums"]["service_interest_kind"]
          setup_charge: number
          setup_option: Json | null
          speed_bucket: string | null
          speed_notes: string | null
          status: Database["public"]["Enums"]["contract_summary_status_kind"]
          terms_version: string
          token_expires_at: string | null
          updated_at: string
          version: number
          vulnerable_customer_note: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_ip?: string | null
          accepted_user_agent?: string | null
          account_number?: string | null
          business_monthly_ex_vat?: number | null
          business_monthly_incl_vat?: number | null
          cease_cancellation_charges?: string | null
          complaints_adr_info: string
          contract_length: string
          created_at?: string
          cs_number?: string
          customer_email_snapshot: string
          customer_id?: string | null
          customer_name_snapshot: string
          customer_type: Database["public"]["Enums"]["customer_type_kind"]
          delivery_charge?: number
          digital_voice_warning?: string | null
          emailed_at?: string | null
          estimated_download_speed?: number | null
          estimated_upload_speed?: number | null
          id?: string
          installation_charge?: number
          issued_at?: string | null
          monthly_price_incl_vat: number
          notice_period: string
          one_off_charges_json?: Json
          payment_schedule: string
          pdf_generated_at?: string | null
          pdf_generated_by?: string | null
          pdf_sha256?: string | null
          pdf_storage_key?: string | null
          pdf_url?: string | null
          plan_name: string
          plan_term?: string | null
          plan_type: Database["public"]["Enums"]["plan_type_kind"]
          price_rise_policy: string
          privacy_version?: string
          public_token_hash?: string | null
          quote_id: string
          quote_request_id: string
          router_charge?: number
          router_option?: Json | null
          selected_addons?: Json | null
          service_address: string
          service_type: Database["public"]["Enums"]["service_interest_kind"]
          setup_charge?: number
          setup_option?: Json | null
          speed_bucket?: string | null
          speed_notes?: string | null
          status?: Database["public"]["Enums"]["contract_summary_status_kind"]
          terms_version?: string
          token_expires_at?: string | null
          updated_at?: string
          version?: number
          vulnerable_customer_note?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_ip?: string | null
          accepted_user_agent?: string | null
          account_number?: string | null
          business_monthly_ex_vat?: number | null
          business_monthly_incl_vat?: number | null
          cease_cancellation_charges?: string | null
          complaints_adr_info?: string
          contract_length?: string
          created_at?: string
          cs_number?: string
          customer_email_snapshot?: string
          customer_id?: string | null
          customer_name_snapshot?: string
          customer_type?: Database["public"]["Enums"]["customer_type_kind"]
          delivery_charge?: number
          digital_voice_warning?: string | null
          emailed_at?: string | null
          estimated_download_speed?: number | null
          estimated_upload_speed?: number | null
          id?: string
          installation_charge?: number
          issued_at?: string | null
          monthly_price_incl_vat?: number
          notice_period?: string
          one_off_charges_json?: Json
          payment_schedule?: string
          pdf_generated_at?: string | null
          pdf_generated_by?: string | null
          pdf_sha256?: string | null
          pdf_storage_key?: string | null
          pdf_url?: string | null
          plan_name?: string
          plan_term?: string | null
          plan_type?: Database["public"]["Enums"]["plan_type_kind"]
          price_rise_policy?: string
          privacy_version?: string
          public_token_hash?: string | null
          quote_id?: string
          quote_request_id?: string
          router_charge?: number
          router_option?: Json | null
          selected_addons?: Json | null
          service_address?: string
          service_type?: Database["public"]["Enums"]["service_interest_kind"]
          setup_charge?: number
          setup_option?: Json | null
          speed_bucket?: string | null
          speed_notes?: string | null
          status?: Database["public"]["Enums"]["contract_summary_status_kind"]
          terms_version?: string
          token_expires_at?: string | null
          updated_at?: string
          version?: number
          vulnerable_customer_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_summaries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "admin_customer_search_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_summaries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_summaries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_summaries_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_summaries_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          reason?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      dd_intake_requests: {
        Row: {
          auth_tag: string | null
          bank_details_ciphertext: string
          bank_name: string | null
          created_at: string
          enc_alg: string
          enc_key_id: string
          id: string
          journey_id: string | null
          masked_account_last4: string
          masked_sort_last2: string
          nonce: string
          payer_authorised_confirmed: boolean
          payment_method_id: string
          uk_account_confirmed: boolean
        }
        Insert: {
          auth_tag?: string | null
          bank_details_ciphertext: string
          bank_name?: string | null
          created_at?: string
          enc_alg?: string
          enc_key_id: string
          id?: string
          journey_id?: string | null
          masked_account_last4: string
          masked_sort_last2: string
          nonce: string
          payer_authorised_confirmed?: boolean
          payment_method_id: string
          uk_account_confirmed?: boolean
        }
        Update: {
          auth_tag?: string | null
          bank_details_ciphertext?: string
          bank_name?: string | null
          created_at?: string
          enc_alg?: string
          enc_key_id?: string
          id?: string
          journey_id?: string | null
          masked_account_last4?: string
          masked_sort_last2?: string
          nonce?: string
          payer_authorised_confirmed?: boolean
          payment_method_id?: string
          uk_account_confirmed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "dd_intake_requests_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "order_journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dd_intake_requests_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      dd_mandates: {
        Row: {
          account_holder: string | null
          account_holder_name: string | null
          account_number_full: string | null
          bank_last4: string | null
          billing_address: string | null
          consent_ip: string | null
          consent_timestamp: string | null
          consent_user_agent: string | null
          created_at: string
          id: string
          mandate_reference: string | null
          payment_request_id: string | null
          provider: string | null
          provider_reference: string | null
          signature_name: string | null
          sort_code: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_holder?: string | null
          account_holder_name?: string | null
          account_number_full?: string | null
          bank_last4?: string | null
          billing_address?: string | null
          consent_ip?: string | null
          consent_timestamp?: string | null
          consent_user_agent?: string | null
          created_at?: string
          id?: string
          mandate_reference?: string | null
          payment_request_id?: string | null
          provider?: string | null
          provider_reference?: string | null
          signature_name?: string | null
          sort_code?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_holder?: string | null
          account_holder_name?: string | null
          account_number_full?: string | null
          bank_last4?: string | null
          billing_address?: string | null
          consent_ip?: string | null
          consent_timestamp?: string | null
          consent_user_agent?: string | null
          created_at?: string
          id?: string
          mandate_reference?: string | null
          payment_request_id?: string | null
          provider?: string | null
          provider_reference?: string | null
          signature_name?: string | null
          sort_code?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dd_mandates_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      dd_provider_config: {
        Row: {
          advance_notice_days: number
          created_at: string
          ddi_template_version: string | null
          guarantee_version: string | null
          id: string
          live_collection_enabled: boolean
          provider_approval_date: string | null
          provider_name: string | null
          provider_support_contact: string | null
          service_user_number: string | null
          singleton: boolean
          updated_at: string
        }
        Insert: {
          advance_notice_days?: number
          created_at?: string
          ddi_template_version?: string | null
          guarantee_version?: string | null
          id?: string
          live_collection_enabled?: boolean
          provider_approval_date?: string | null
          provider_name?: string | null
          provider_support_contact?: string | null
          service_user_number?: string | null
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          advance_notice_days?: number
          created_at?: string
          ddi_template_version?: string | null
          guarantee_version?: string | null
          id?: string
          live_collection_enabled?: boolean
          provider_approval_date?: string | null
          provider_name?: string | null
          provider_support_contact?: string | null
          service_user_number?: string | null
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      draft_order_packs: {
        Row: {
          contract_summary_id: string
          created_at: string
          generated_at: string
          generated_by: string | null
          id: string
          payment_request_id: string
          snapshot: Json
          version: number
        }
        Insert: {
          contract_summary_id: string
          created_at?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          payment_request_id: string
          snapshot: Json
          version?: number
        }
        Update: {
          contract_summary_id?: string
          created_at?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          payment_request_id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "draft_order_packs_contract_summary_id_fkey"
            columns: ["contract_summary_id"]
            isOneToOne: false
            referencedRelation: "contract_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_order_packs_contract_summary_id_fkey"
            columns: ["contract_summary_id"]
            isOneToOne: false
            referencedRelation: "customer_contract_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_order_packs_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          auto_send: boolean
          category: string
          created_at: string
          created_by: string | null
          html_body: string
          id: string
          is_active: boolean
          subject: string
          template_name: string
          text_body: string | null
          updated_at: string
          variables: string[] | null
        }
        Insert: {
          auto_send?: boolean
          category?: string
          created_at?: string
          created_by?: string | null
          html_body: string
          id?: string
          is_active?: boolean
          subject: string
          template_name: string
          text_body?: string | null
          updated_at?: string
          variables?: string[] | null
        }
        Update: {
          auto_send?: boolean
          category?: string
          created_at?: string
          created_by?: string | null
          html_body?: string
          id?: string
          is_active?: boolean
          subject?: string
          template_name?: string
          text_body?: string | null
          updated_at?: string
          variables?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_customer_search_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "customer_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      first_billing_jobs: {
        Row: {
          activation_date: string
          amount_minor: number | null
          attempts: number
          billable_days: number | null
          billing_anchor_day: number
          blocker: string | null
          calc_method: string
          created_at: string
          currency: string
          customer_id: string | null
          full_cycle_days: number | null
          id: string
          is_pro_rata: boolean
          last_error: string | null
          next_billing_date: string
          order_id: string
          payload: Json
          period_end: string | null
          period_start: string | null
          processed_at: string | null
          service_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          activation_date: string
          amount_minor?: number | null
          attempts?: number
          billable_days?: number | null
          billing_anchor_day: number
          blocker?: string | null
          calc_method?: string
          created_at?: string
          currency?: string
          customer_id?: string | null
          full_cycle_days?: number | null
          id?: string
          is_pro_rata?: boolean
          last_error?: string | null
          next_billing_date: string
          order_id: string
          payload?: Json
          period_end?: string | null
          period_start?: string | null
          processed_at?: string | null
          service_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          activation_date?: string
          amount_minor?: number | null
          attempts?: number
          billable_days?: number | null
          billing_anchor_day?: number
          blocker?: string | null
          calc_method?: string
          created_at?: string
          currency?: string
          customer_id?: string | null
          full_cycle_days?: number | null
          id?: string
          is_pro_rata?: boolean
          last_error?: string | null
          next_billing_date?: string
          order_id?: string
          payload?: Json
          period_end?: string | null
          period_start?: string | null
          processed_at?: string | null
          service_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "first_billing_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "first_billing_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "first_billing_jobs_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_flags: {
        Row: {
          created_at: string
          customer_id: string | null
          details: Json
          flag_type: Database["public"]["Enums"]["fraud_flag_type"]
          id: string
          referral_event_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reward_id: string | null
          severity: Database["public"]["Enums"]["fraud_flag_severity"]
          status: Database["public"]["Enums"]["fraud_flag_status"]
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          details?: Json
          flag_type: Database["public"]["Enums"]["fraud_flag_type"]
          id?: string
          referral_event_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reward_id?: string | null
          severity?: Database["public"]["Enums"]["fraud_flag_severity"]
          status?: Database["public"]["Enums"]["fraud_flag_status"]
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          details?: Json
          flag_type?: Database["public"]["Enums"]["fraud_flag_type"]
          id?: string
          referral_event_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reward_id?: string | null
          severity?: Database["public"]["Enums"]["fraud_flag_severity"]
          status?: Database["public"]["Enums"]["fraud_flag_status"]
        }
        Relationships: [
          {
            foreignKeyName: "fraud_flags_referral_event_id_fkey"
            columns: ["referral_event_id"]
            isOneToOne: false
            referencedRelation: "referral_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_flags_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "customer_rewards_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_flags_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_orders: {
        Row: {
          account_number: string | null
          additional_notes: string | null
          address_line1: string
          address_line2: string | null
          admin_notes: string | null
          city: string
          contract_end_date: string | null
          created_at: string
          current_provider: string | null
          date_of_birth: string | null
          email: string
          full_name: string
          gdpr_consent: boolean
          id: string
          in_contract: boolean | null
          linked_at: string | null
          linked_order_id: string | null
          marketing_consent: boolean | null
          order_number: string
          phone: string
          plan_name: string
          plan_price: number
          postcode: string
          preferred_switch_date: string | null
          selected_addons: Json | null
          service_type: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_number?: string | null
          additional_notes?: string | null
          address_line1: string
          address_line2?: string | null
          admin_notes?: string | null
          city: string
          contract_end_date?: string | null
          created_at?: string
          current_provider?: string | null
          date_of_birth?: string | null
          email: string
          full_name: string
          gdpr_consent?: boolean
          id?: string
          in_contract?: boolean | null
          linked_at?: string | null
          linked_order_id?: string | null
          marketing_consent?: boolean | null
          order_number: string
          phone: string
          plan_name: string
          plan_price: number
          postcode: string
          preferred_switch_date?: string | null
          selected_addons?: Json | null
          service_type: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_number?: string | null
          additional_notes?: string | null
          address_line1?: string
          address_line2?: string | null
          admin_notes?: string | null
          city?: string
          contract_end_date?: string | null
          created_at?: string
          current_provider?: string | null
          date_of_birth?: string | null
          email?: string
          full_name?: string
          gdpr_consent?: boolean
          id?: string
          in_contract?: boolean | null
          linked_at?: string | null
          linked_order_id?: string | null
          marketing_consent?: boolean | null
          order_number?: string
          phone?: string
          plan_name?: string
          plan_price?: number
          postcode?: string
          preferred_switch_date?: string | null
          selected_addons?: Json | null
          service_type?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      installation_bookings: {
        Row: {
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string
          id: string
          notes: string | null
          order_id: string
          order_type: string
          reminder_sent: boolean
          reminder_sent_at: string | null
          slot_id: string
          status: string
          technician_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_email: string
          customer_name: string
          customer_phone: string
          id?: string
          notes?: string | null
          order_id: string
          order_type: string
          reminder_sent?: boolean
          reminder_sent_at?: string | null
          slot_id: string
          status?: string
          technician_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          notes?: string | null
          order_id?: string
          order_type?: string
          reminder_sent?: boolean
          reminder_sent_at?: string | null
          slot_id?: string
          status?: string
          technician_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "installation_bookings_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "installation_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installation_bookings_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      installation_slots: {
        Row: {
          booked_count: number
          capacity: number
          created_at: string
          id: string
          is_active: boolean
          slot_date: string
          slot_time: string
          updated_at: string
        }
        Insert: {
          booked_count?: number
          capacity?: number
          created_at?: string
          id?: string
          is_active?: boolean
          slot_date: string
          slot_time: string
          updated_at?: string
        }
        Update: {
          booked_count?: number
          capacity?: number
          created_at?: string
          id?: string
          is_active?: boolean
          slot_date?: string
          slot_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoice_email_events: {
        Row: {
          created_at: string
          details: Json
          event_type: string
          id: string
          invoice_id: string
        }
        Insert: {
          created_at?: string
          details?: Json
          event_type: string
          id?: string
          invoice_id: string
        }
        Update: {
          created_at?: string
          details?: Json
          event_type?: string
          id?: string
          invoice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_email_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          line_total: number
          metadata: Json
          qty: number
          unit_price: number
          vat_rate: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          line_total?: number
          metadata?: Json
          qty?: number
          unit_price?: number
          vat_rate?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          line_total?: number
          metadata?: Json
          qty?: number
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          billing_period_end: string | null
          billing_period_start: string | null
          created_at: string
          currency: string
          due_date: string | null
          id: string
          invoice_number: string
          invoice_type: string
          issue_date: string
          late_fee_amount: number | null
          late_fee_applied_at: string | null
          notes: string | null
          order_id: string | null
          overdue_notified_at: string | null
          pdf_url: string | null
          pro_rata: Json | null
          service_id: string | null
          status: string
          subtotal: number
          tax: number | null
          total: number
          updated_at: string
          user_id: string
          vat_enabled: boolean
          vat_rate: number
          vat_total: number
        }
        Insert: {
          billing_period_end?: string | null
          billing_period_start?: string | null
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number: string
          invoice_type?: string
          issue_date?: string
          late_fee_amount?: number | null
          late_fee_applied_at?: string | null
          notes?: string | null
          order_id?: string | null
          overdue_notified_at?: string | null
          pdf_url?: string | null
          pro_rata?: Json | null
          service_id?: string | null
          status?: string
          subtotal?: number
          tax?: number | null
          total?: number
          updated_at?: string
          user_id: string
          vat_enabled?: boolean
          vat_rate?: number
          vat_total?: number
        }
        Update: {
          billing_period_end?: string | null
          billing_period_start?: string | null
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          invoice_type?: string
          issue_date?: string
          late_fee_amount?: number | null
          late_fee_applied_at?: string | null
          notes?: string | null
          order_id?: string | null
          overdue_notified_at?: string | null
          pdf_url?: string | null
          pro_rata?: Json | null
          service_id?: string | null
          status?: string
          subtotal?: number
          tax?: number | null
          total?: number
          updated_at?: string
          user_id?: string
          vat_enabled?: boolean
          vat_rate?: number
          vat_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_cancellation_events: {
        Row: {
          actor_type: string
          confirmation_text_version: string | null
          created_at: string
          details: Json | null
          event_type: string
          id: string
          ip: string | null
          journey_id: string
          reason_code: string | null
          reason_text: string | null
          ua: string | null
        }
        Insert: {
          actor_type?: string
          confirmation_text_version?: string | null
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          ip?: string | null
          journey_id: string
          reason_code?: string | null
          reason_text?: string | null
          ua?: string | null
        }
        Update: {
          actor_type?: string
          confirmation_text_version?: string | null
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          ip?: string | null
          journey_id?: string
          reason_code?: string | null
          reason_text?: string | null
          ua?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journey_cancellation_events_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "order_journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_decline_events: {
        Row: {
          created_at: string
          id: string
          ip: string | null
          journey_id: string
          reason_code: string
          reason_text: string | null
          ua: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip?: string | null
          journey_id: string
          reason_code: string
          reason_text?: string | null
          ua?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip?: string | null
          journey_id?: string
          reason_code?: string
          reason_text?: string | null
          ua?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journey_decline_events_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "order_journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_internal_notes: {
        Row: {
          author_user_id: string
          body: string
          contract_summary_id: string | null
          created_at: string
          customer_id: string
          id: string
          payment_request_id: string | null
          quote_id: string | null
          updated_at: string
        }
        Insert: {
          author_user_id: string
          body: string
          contract_summary_id?: string | null
          created_at?: string
          customer_id: string
          id?: string
          payment_request_id?: string | null
          quote_id?: string | null
          updated_at?: string
        }
        Update: {
          author_user_id?: string
          body?: string
          contract_summary_id?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          payment_request_id?: string | null
          quote_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      kb_article_versions: {
        Row: {
          article_id: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          title: string
          version: number
        }
        Insert: {
          article_id: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          title: string
          version: number
        }
        Update: {
          article_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "kb_article_versions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "kb_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_articles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          category_id: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          slug: string
          status: Database["public"]["Enums"]["kb_status"]
          title: string
          updated_at: string
          version: number
          visibility: Database["public"]["Enums"]["kb_visibility"]
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          category_id?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          slug: string
          status?: Database["public"]["Enums"]["kb_status"]
          title: string
          updated_at?: string
          version?: number
          visibility?: Database["public"]["Enums"]["kb_visibility"]
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          category_id?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          slug?: string
          status?: Database["public"]["Enums"]["kb_status"]
          title?: string
          updated_at?: string
          version?: number
          visibility?: Database["public"]["Enums"]["kb_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "kb_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "kb_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_categories: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          display_order: number
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name?: string
        }
        Relationships: []
      }
      manual_fulfilment_orders: {
        Row: {
          account_number: string | null
          activated_at: string | null
          cancelled_at: string | null
          contract_summary_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          journey_id: string | null
          notes: string | null
          payment_request_id: string | null
          readiness_confirmed: boolean
          selected_product_label: string | null
          status: Database["public"]["Enums"]["manual_fulfilment_status"]
          supplier_name: string | null
          supplier_portal_reference: string | null
          supplier_product_ref: string | null
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          activated_at?: string | null
          cancelled_at?: string | null
          contract_summary_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          journey_id?: string | null
          notes?: string | null
          payment_request_id?: string | null
          readiness_confirmed?: boolean
          selected_product_label?: string | null
          status?: Database["public"]["Enums"]["manual_fulfilment_status"]
          supplier_name?: string | null
          supplier_portal_reference?: string | null
          supplier_product_ref?: string | null
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          activated_at?: string | null
          cancelled_at?: string | null
          contract_summary_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          journey_id?: string | null
          notes?: string | null
          payment_request_id?: string | null
          readiness_confirmed?: boolean
          selected_product_label?: string | null
          status?: Database["public"]["Enums"]["manual_fulfilment_status"]
          supplier_name?: string | null
          supplier_portal_reference?: string | null
          supplier_product_ref?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_fulfilment_orders_contract_summary_id_fkey"
            columns: ["contract_summary_id"]
            isOneToOne: false
            referencedRelation: "contract_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_fulfilment_orders_contract_summary_id_fkey"
            columns: ["contract_summary_id"]
            isOneToOne: false
            referencedRelation: "customer_contract_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_fulfilment_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "admin_customer_search_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_fulfilment_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_fulfilment_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_fulfilment_orders_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "order_journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_fulfilment_orders_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: true
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      margin_rules: {
        Row: {
          active: boolean
          cease_risk_buffer: number
          created_at: string
          customer_type: string
          failed_payment_risk_buffer: number
          id: string
          install_cost_buffer: number
          minimum_contract_margin: number
          minimum_first_3_month_margin: number
          minimum_monthly_margin: number
          payment_processing_buffer: number
          plan_type: string
          reward_cost_buffer: number
          router_cost_buffer: number
          service_type: string
          support_cost_buffer: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          cease_risk_buffer?: number
          created_at?: string
          customer_type: string
          failed_payment_risk_buffer?: number
          id?: string
          install_cost_buffer?: number
          minimum_contract_margin?: number
          minimum_first_3_month_margin?: number
          minimum_monthly_margin?: number
          payment_processing_buffer?: number
          plan_type: string
          reward_cost_buffer?: number
          router_cost_buffer?: number
          service_type: string
          support_cost_buffer?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          cease_risk_buffer?: number
          created_at?: string
          customer_type?: string
          failed_payment_risk_buffer?: number
          id?: string
          install_cost_buffer?: number
          minimum_contract_margin?: number
          minimum_first_3_month_margin?: number
          minimum_monthly_margin?: number
          payment_processing_buffer?: number
          plan_type?: string
          reward_cost_buffer?: number
          router_cost_buffer?: number
          service_type?: string
          support_cost_buffer?: number
          updated_at?: string
        }
        Relationships: []
      }
      order_billing_snapshots: {
        Row: {
          created_at: string
          currency: string
          id: string
          journey_id: string
          monthly_minor: number
          one_off_lines: Json
          service_id: string | null
          snapshot: Json
          vat_included: boolean
          vat_rate: number | null
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          journey_id: string
          monthly_minor: number
          one_off_lines?: Json
          service_id?: string | null
          snapshot: Json
          vat_included?: boolean
          vat_rate?: number | null
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          journey_id?: string
          monthly_minor?: number
          one_off_lines?: Json
          service_id?: string | null
          snapshot?: Json
          vat_included?: boolean
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_billing_snapshots_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "order_journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_billing_snapshots_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      order_journeys: {
        Row: {
          billing_anchor_day: number | null
          cancellation_notes: string | null
          cancellation_reason: string | null
          cancellation_token_expires_at: string | null
          cancellation_token_hash: string | null
          cancellation_token_used_at: string | null
          cancelled_at: string | null
          completed_at: string | null
          consolidated_email_sent_at: string | null
          contract_acceptance_id: string | null
          contract_accepted_at: string | null
          contract_summary_id: string | null
          cooling_off_acknowledged: boolean
          cooling_off_acknowledged_at: string | null
          cooling_off_ends_at: string | null
          created_at: string
          current_step: string
          customer_id: string | null
          decline_notes: string | null
          decline_reason: string | null
          declined_at: string | null
          earliest_selectable_start_date: string | null
          id: string
          idempotency_key: string | null
          ip: string | null
          link_nonce_expires_at: string | null
          link_nonce_hash: string | null
          linked_at: string | null
          linked_customer_id: string | null
          manual_review_required: boolean
          order_id: string | null
          order_pack_sha256: string | null
          order_pack_storage_key: string | null
          payment_method: string | null
          preferred_start_date: string | null
          quote_continued_at: string | null
          quote_id: string
          start_date_selected_at: string | null
          status: string
          submitted_at: string | null
          token_hash: string
          ua: string | null
          updated_at: string
        }
        Insert: {
          billing_anchor_day?: number | null
          cancellation_notes?: string | null
          cancellation_reason?: string | null
          cancellation_token_expires_at?: string | null
          cancellation_token_hash?: string | null
          cancellation_token_used_at?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          consolidated_email_sent_at?: string | null
          contract_acceptance_id?: string | null
          contract_accepted_at?: string | null
          contract_summary_id?: string | null
          cooling_off_acknowledged?: boolean
          cooling_off_acknowledged_at?: string | null
          cooling_off_ends_at?: string | null
          created_at?: string
          current_step?: string
          customer_id?: string | null
          decline_notes?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          earliest_selectable_start_date?: string | null
          id?: string
          idempotency_key?: string | null
          ip?: string | null
          link_nonce_expires_at?: string | null
          link_nonce_hash?: string | null
          linked_at?: string | null
          linked_customer_id?: string | null
          manual_review_required?: boolean
          order_id?: string | null
          order_pack_sha256?: string | null
          order_pack_storage_key?: string | null
          payment_method?: string | null
          preferred_start_date?: string | null
          quote_continued_at?: string | null
          quote_id: string
          start_date_selected_at?: string | null
          status?: string
          submitted_at?: string | null
          token_hash: string
          ua?: string | null
          updated_at?: string
        }
        Update: {
          billing_anchor_day?: number | null
          cancellation_notes?: string | null
          cancellation_reason?: string | null
          cancellation_token_expires_at?: string | null
          cancellation_token_hash?: string | null
          cancellation_token_used_at?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          consolidated_email_sent_at?: string | null
          contract_acceptance_id?: string | null
          contract_accepted_at?: string | null
          contract_summary_id?: string | null
          cooling_off_acknowledged?: boolean
          cooling_off_acknowledged_at?: string | null
          cooling_off_ends_at?: string | null
          created_at?: string
          current_step?: string
          customer_id?: string | null
          decline_notes?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          earliest_selectable_start_date?: string | null
          id?: string
          idempotency_key?: string | null
          ip?: string | null
          link_nonce_expires_at?: string | null
          link_nonce_hash?: string | null
          linked_at?: string | null
          linked_customer_id?: string | null
          manual_review_required?: boolean
          order_id?: string | null
          order_pack_sha256?: string | null
          order_pack_storage_key?: string | null
          payment_method?: string | null
          preferred_start_date?: string | null
          quote_continued_at?: string | null
          quote_id?: string
          start_date_selected_at?: string | null
          status?: string
          submitted_at?: string | null
          token_hash?: string
          ua?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_journeys_contract_acceptance_id_fkey"
            columns: ["contract_acceptance_id"]
            isOneToOne: false
            referencedRelation: "contract_acceptances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_journeys_contract_summary_id_fkey"
            columns: ["contract_summary_id"]
            isOneToOne: false
            referencedRelation: "contract_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_journeys_contract_summary_id_fkey"
            columns: ["contract_summary_id"]
            isOneToOne: false
            referencedRelation: "customer_contract_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_journeys_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      order_messages: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          order_id: string
          order_type: string
          sender_id: string
          sender_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          order_id: string
          order_type: string
          sender_id: string
          sender_type: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          order_id?: string
          order_type?: string
          sender_id?: string
          sender_type?: string
        }
        Relationships: []
      }
      order_status_history: {
        Row: {
          actual_activation_date: string | null
          changed_at: string
          changed_by: string | null
          customer_note: string | null
          expected_activation_date: string | null
          giacom_reference: string | null
          id: string
          internal_note: string | null
          metadata: Json
          new_status: string
          order_id: string
          previous_status: string | null
          source: string
        }
        Insert: {
          actual_activation_date?: string | null
          changed_at?: string
          changed_by?: string | null
          customer_note?: string | null
          expected_activation_date?: string | null
          giacom_reference?: string | null
          id?: string
          internal_note?: string | null
          metadata?: Json
          new_status: string
          order_id: string
          previous_status?: string | null
          source?: string
        }
        Update: {
          actual_activation_date?: string | null
          changed_at?: string
          changed_by?: string | null
          customer_note?: string | null
          expected_activation_date?: string | null
          giacom_reference?: string | null
          id?: string
          internal_note?: string | null
          metadata?: Json
          new_status?: string
          order_id?: string
          previous_status?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          actual_activation_date: string | null
          address_line1: string | null
          address_line2: string | null
          admin_notes: string | null
          billing_anchor_day: number | null
          cancellation_preview: Json | null
          cancellation_requested_at: string | null
          cease_date: string | null
          city: string | null
          contract_acceptance_id: string | null
          contract_summary_id: string | null
          cooling_off_ends_at: string | null
          created_at: string
          customer_id: string | null
          entered_in_giacom_at: string | null
          etf_policy_snapshot: Json | null
          expected_activation_date: string | null
          giacom_product_ref: string | null
          giacom_reference: string | null
          guest_order_id: string | null
          id: string
          installation_date: string | null
          internal_notes: string | null
          journey_id: string | null
          lifecycle_status: string | null
          minimum_term_end_date: string | null
          notes: string | null
          occta_order_number: string | null
          payment_method: string | null
          payment_method_id: string | null
          plan_name: string
          plan_price: number
          postcode: string
          preferred_start_date: string | null
          quote_id: string | null
          router_reference: string | null
          service_type: Database["public"]["Enums"]["service_type"]
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_activation_date?: string | null
          address_line1?: string | null
          address_line2?: string | null
          admin_notes?: string | null
          billing_anchor_day?: number | null
          cancellation_preview?: Json | null
          cancellation_requested_at?: string | null
          cease_date?: string | null
          city?: string | null
          contract_acceptance_id?: string | null
          contract_summary_id?: string | null
          cooling_off_ends_at?: string | null
          created_at?: string
          customer_id?: string | null
          entered_in_giacom_at?: string | null
          etf_policy_snapshot?: Json | null
          expected_activation_date?: string | null
          giacom_product_ref?: string | null
          giacom_reference?: string | null
          guest_order_id?: string | null
          id?: string
          installation_date?: string | null
          internal_notes?: string | null
          journey_id?: string | null
          lifecycle_status?: string | null
          minimum_term_end_date?: string | null
          notes?: string | null
          occta_order_number?: string | null
          payment_method?: string | null
          payment_method_id?: string | null
          plan_name: string
          plan_price: number
          postcode: string
          preferred_start_date?: string | null
          quote_id?: string | null
          router_reference?: string | null
          service_type: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_activation_date?: string | null
          address_line1?: string | null
          address_line2?: string | null
          admin_notes?: string | null
          billing_anchor_day?: number | null
          cancellation_preview?: Json | null
          cancellation_requested_at?: string | null
          cease_date?: string | null
          city?: string | null
          contract_acceptance_id?: string | null
          contract_summary_id?: string | null
          cooling_off_ends_at?: string | null
          created_at?: string
          customer_id?: string | null
          entered_in_giacom_at?: string | null
          etf_policy_snapshot?: Json | null
          expected_activation_date?: string | null
          giacom_product_ref?: string | null
          giacom_reference?: string | null
          guest_order_id?: string | null
          id?: string
          installation_date?: string | null
          internal_notes?: string | null
          journey_id?: string | null
          lifecycle_status?: string | null
          minimum_term_end_date?: string | null
          notes?: string | null
          occta_order_number?: string | null
          payment_method?: string | null
          payment_method_id?: string | null
          plan_name?: string
          plan_price?: number
          postcode?: string
          preferred_start_date?: string | null
          quote_id?: string | null
          router_reference?: string | null
          service_type?: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "order_journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_attempts: {
        Row: {
          amount: number
          attempted_at: string
          created_at: string
          id: string
          invoice_id: string | null
          provider: string | null
          provider_ref: string | null
          reason: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount?: number
          attempted_at?: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          provider?: string | null
          provider_ref?: string | null
          reason?: string | null
          status: string
          user_id: string
        }
        Update: {
          amount?: number
          attempted_at?: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          provider?: string | null
          provider_ref?: string | null
          reason?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          account_holder_name: string | null
          active: boolean
          bank_name: string | null
          billing_anchor_day: number
          consent_at: string | null
          consent_text: string | null
          consent_version: string | null
          created_at: string
          customer_id: string | null
          dd_setup_status: string | null
          id: string
          idempotency_key: string | null
          ip: string | null
          journey_id: string | null
          masked_account_last4: string | null
          masked_sort_last2: string | null
          method: string
          service_id: string | null
          ua: string | null
          updated_at: string
        }
        Insert: {
          account_holder_name?: string | null
          active?: boolean
          bank_name?: string | null
          billing_anchor_day: number
          consent_at?: string | null
          consent_text?: string | null
          consent_version?: string | null
          created_at?: string
          customer_id?: string | null
          dd_setup_status?: string | null
          id?: string
          idempotency_key?: string | null
          ip?: string | null
          journey_id?: string | null
          masked_account_last4?: string | null
          masked_sort_last2?: string | null
          method: string
          service_id?: string | null
          ua?: string | null
          updated_at?: string
        }
        Update: {
          account_holder_name?: string | null
          active?: boolean
          bank_name?: string | null
          billing_anchor_day?: number
          consent_at?: string | null
          consent_text?: string | null
          consent_version?: string | null
          created_at?: string
          customer_id?: string | null
          dd_setup_status?: string | null
          id?: string
          idempotency_key?: string | null
          ip?: string | null
          journey_id?: string | null
          masked_account_last4?: string | null
          masked_sort_last2?: string | null
          method?: string
          service_id?: string | null
          ua?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "order_journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_methods_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_request_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          request_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          request_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_request_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_requests: {
        Row: {
          account_number: string | null
          amount: number | null
          completed_at: string | null
          contract_acceptance_id: string | null
          contract_summary_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_email: string
          customer_name: string
          due_date: string | null
          expires_at: string | null
          failed_at: string | null
          id: string
          invoice_id: string | null
          last_opened_at: string | null
          metadata: Json
          notes: string | null
          paid_at: string | null
          payment_request_number: string | null
          provider: string | null
          provider_checkout_url: string | null
          provider_payment_id: string | null
          provider_reference: string | null
          provider_session_id: string | null
          quote_id: string | null
          quote_request_id: string | null
          status: string
          token_hash: string | null
          type: string
          updated_at: string
          user_id: string | null
          webhook_verified: boolean
        }
        Insert: {
          account_number?: string | null
          amount?: number | null
          completed_at?: string | null
          contract_acceptance_id?: string | null
          contract_summary_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_email: string
          customer_name: string
          due_date?: string | null
          expires_at?: string | null
          failed_at?: string | null
          id?: string
          invoice_id?: string | null
          last_opened_at?: string | null
          metadata?: Json
          notes?: string | null
          paid_at?: string | null
          payment_request_number?: string | null
          provider?: string | null
          provider_checkout_url?: string | null
          provider_payment_id?: string | null
          provider_reference?: string | null
          provider_session_id?: string | null
          quote_id?: string | null
          quote_request_id?: string | null
          status?: string
          token_hash?: string | null
          type: string
          updated_at?: string
          user_id?: string | null
          webhook_verified?: boolean
        }
        Update: {
          account_number?: string | null
          amount?: number | null
          completed_at?: string | null
          contract_acceptance_id?: string | null
          contract_summary_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_email?: string
          customer_name?: string
          due_date?: string | null
          expires_at?: string | null
          failed_at?: string | null
          id?: string
          invoice_id?: string | null
          last_opened_at?: string | null
          metadata?: Json
          notes?: string | null
          paid_at?: string | null
          payment_request_number?: string | null
          provider?: string | null
          provider_checkout_url?: string | null
          provider_payment_id?: string | null
          provider_reference?: string | null
          provider_session_id?: string | null
          quote_id?: string | null
          quote_request_id?: string | null
          status?: string
          token_hash?: string | null
          type?: string
          updated_at?: string
          user_id?: string | null
          webhook_verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "payment_requests_contract_acceptance_id_fkey"
            columns: ["contract_acceptance_id"]
            isOneToOne: false
            referencedRelation: "contract_acceptances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_contract_summary_id_fkey"
            columns: ["contract_summary_id"]
            isOneToOne: false
            referencedRelation: "contract_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_contract_summary_id_fkey"
            columns: ["contract_summary_id"]
            isOneToOne: false
            referencedRelation: "customer_contract_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_customer_search_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "customer_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_customer_search_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "customer_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_categories: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          display_order: number
          id: string
          name: string
          plan_type: string
          service_type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name: string
          plan_type: string
          service_type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          plan_type?: string
          service_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          api_mode: string
          business_vat_display: string
          created_at: string
          credit_note_prefix: string
          fair_pricing: Json
          id: string
          invoice_issue_notice_days: number
          invoice_prefix: string
          legacy_onboarding_emails_suppressed: boolean
          manual_mode_message: string
          residential_vat_display: string
          rewards_custom_rule: Json
          rewards_enabled: boolean
          rewards_unlock_rule: string
          sim_checkout_mode: string
          singleton: boolean
          start_date_max_days: number
          unified_journey_enabled: boolean
          updated_at: string
          updated_by: string | null
          vat_default_rate: number
          vat_effective_date: string | null
          vat_number: string | null
          vat_scheme: string
        }
        Insert: {
          api_mode?: string
          business_vat_display?: string
          created_at?: string
          credit_note_prefix?: string
          fair_pricing?: Json
          id?: string
          invoice_issue_notice_days?: number
          invoice_prefix?: string
          legacy_onboarding_emails_suppressed?: boolean
          manual_mode_message?: string
          residential_vat_display?: string
          rewards_custom_rule?: Json
          rewards_enabled?: boolean
          rewards_unlock_rule?: string
          sim_checkout_mode?: string
          singleton?: boolean
          start_date_max_days?: number
          unified_journey_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
          vat_default_rate?: number
          vat_effective_date?: string | null
          vat_number?: string | null
          vat_scheme?: string
        }
        Update: {
          api_mode?: string
          business_vat_display?: string
          created_at?: string
          credit_note_prefix?: string
          fair_pricing?: Json
          id?: string
          invoice_issue_notice_days?: number
          invoice_prefix?: string
          legacy_onboarding_emails_suppressed?: boolean
          manual_mode_message?: string
          residential_vat_display?: string
          rewards_custom_rule?: Json
          rewards_enabled?: boolean
          rewards_unlock_rule?: string
          sim_checkout_mode?: string
          singleton?: boolean
          start_date_max_days?: number
          unified_journey_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
          vat_default_rate?: number
          vat_effective_date?: string | null
          vat_number?: string | null
          vat_scheme?: string
        }
        Relationships: []
      }
      points_ledger: {
        Row: {
          available_at: string | null
          bill_credit_delta: number
          created_at: string
          created_by: string | null
          customer_id: string
          expires_at: string | null
          id: string
          points_delta: number
          reason: string
          source_id: string | null
          source_type: Database["public"]["Enums"]["points_ledger_source"]
          status: Database["public"]["Enums"]["points_ledger_status"]
        }
        Insert: {
          available_at?: string | null
          bill_credit_delta?: number
          created_at?: string
          created_by?: string | null
          customer_id: string
          expires_at?: string | null
          id?: string
          points_delta?: number
          reason: string
          source_id?: string | null
          source_type: Database["public"]["Enums"]["points_ledger_source"]
          status?: Database["public"]["Enums"]["points_ledger_status"]
        }
        Update: {
          available_at?: string | null
          bill_credit_delta?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string
          expires_at?: string | null
          id?: string
          points_delta?: number
          reason?: string
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["points_ledger_source"]
          status?: Database["public"]["Enums"]["points_ledger_status"]
        }
        Relationships: []
      }
      pricing_rules: {
        Row: {
          active: boolean
          cease_fee_gross: number | null
          contract_length_months: number | null
          created_at: string
          customer_type: string
          delivery_sell_gross: number
          delivery_sell_net: number
          delivery_vat_amount: number
          id: string
          install_sell_gross: number
          install_sell_net: number
          install_vat_amount: number
          monthly_sell_gross: number
          monthly_sell_net: number
          monthly_vat_amount: number
          monthly_vat_rate: number
          notice_period: string | null
          plan_category_id: string
          price_rise_policy: string | null
          public_plan_name: string
          router_sell_gross: number
          router_sell_net: number
          router_vat_amount: number
          setup_sell_gross: number
          setup_sell_net: number
          setup_vat_amount: number
          supplier_product_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          cease_fee_gross?: number | null
          contract_length_months?: number | null
          created_at?: string
          customer_type: string
          delivery_sell_gross?: number
          delivery_sell_net?: number
          delivery_vat_amount?: number
          id?: string
          install_sell_gross?: number
          install_sell_net?: number
          install_vat_amount?: number
          monthly_sell_gross?: number
          monthly_sell_net?: number
          monthly_vat_amount?: number
          monthly_vat_rate?: number
          notice_period?: string | null
          plan_category_id: string
          price_rise_policy?: string | null
          public_plan_name: string
          router_sell_gross?: number
          router_sell_net?: number
          router_vat_amount?: number
          setup_sell_gross?: number
          setup_sell_net?: number
          setup_vat_amount?: number
          supplier_product_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          cease_fee_gross?: number | null
          contract_length_months?: number | null
          created_at?: string
          customer_type?: string
          delivery_sell_gross?: number
          delivery_sell_net?: number
          delivery_vat_amount?: number
          id?: string
          install_sell_gross?: number
          install_sell_net?: number
          install_vat_amount?: number
          monthly_sell_gross?: number
          monthly_sell_net?: number
          monthly_vat_amount?: number
          monthly_vat_rate?: number
          notice_period?: string | null
          plan_category_id?: string
          price_rise_policy?: string | null
          public_plan_name?: string
          router_sell_gross?: number
          router_sell_net?: number
          router_vat_amount?: number
          setup_sell_gross?: number
          setup_sell_net?: number
          setup_vat_amount?: number
          supplier_product_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_plan_category_id_fkey"
            columns: ["plan_category_id"]
            isOneToOne: false
            referencedRelation: "plan_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_rules_supplier_product_id_fkey"
            columns: ["supplier_product_id"]
            isOneToOne: false
            referencedRelation: "supplier_products"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_number: string | null
          address_line1: string | null
          address_line2: string | null
          admin_notes: string | null
          city: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          postcode: string | null
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          address_line1?: string | null
          address_line2?: string | null
          admin_notes?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          postcode?: string | null
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          address_line1?: string | null
          address_line2?: string | null
          admin_notes?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          postcode?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      provisioning_readiness: {
        Row: {
          admin_review_complete: boolean
          contract_summary_id: string
          created_at: string
          id: string
          installation_confirmed: boolean
          internal_notes_reviewed: boolean
          payment_request_id: string
          reviewer_notes: string | null
          reviewer_user_id: string | null
          router_confirmed: boolean
          updated_at: string
        }
        Insert: {
          admin_review_complete?: boolean
          contract_summary_id: string
          created_at?: string
          id?: string
          installation_confirmed?: boolean
          internal_notes_reviewed?: boolean
          payment_request_id: string
          reviewer_notes?: string | null
          reviewer_user_id?: string | null
          router_confirmed?: boolean
          updated_at?: string
        }
        Update: {
          admin_review_complete?: boolean
          contract_summary_id?: string
          created_at?: string
          id?: string
          installation_confirmed?: boolean
          internal_notes_reviewed?: boolean
          payment_request_id?: string
          reviewer_notes?: string | null
          reviewer_user_id?: string | null
          router_confirmed?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provisioning_readiness_contract_summary_id_fkey"
            columns: ["contract_summary_id"]
            isOneToOne: false
            referencedRelation: "contract_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provisioning_readiness_contract_summary_id_fkey"
            columns: ["contract_summary_id"]
            isOneToOne: false
            referencedRelation: "customer_contract_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provisioning_readiness_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: true
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_events: {
        Row: {
          actor_id: string | null
          actor_type: string
          contract_summary_id: string | null
          created_at: string
          details: Json
          event_type: string
          id: string
          quote_id: string | null
          quote_request_id: string | null
          title: string
        }
        Insert: {
          actor_id?: string | null
          actor_type?: string
          contract_summary_id?: string | null
          created_at?: string
          details?: Json
          event_type: string
          id?: string
          quote_id?: string | null
          quote_request_id?: string | null
          title: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          contract_summary_id?: string | null
          created_at?: string
          details?: Json
          event_type?: string
          id?: string
          quote_id?: string | null
          quote_request_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_events_contract_summary_id_fkey"
            columns: ["contract_summary_id"]
            isOneToOne: false
            referencedRelation: "contract_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_events_contract_summary_id_fkey"
            columns: ["contract_summary_id"]
            isOneToOne: false
            referencedRelation: "customer_contract_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_events_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_events_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_margin_checks: {
        Row: {
          checked_at: string
          checked_by: string | null
          estimated_contract_margin: number | null
          estimated_monthly_margin: number | null
          first_3_month_margin: number | null
          id: string
          quote_id: string
          reason: string | null
          reward_cost_assumption: number | null
          status: Database["public"]["Enums"]["quote_margin_check_status"]
          supplier_monthly_cost: number | null
          total_monthly_sell: number | null
        }
        Insert: {
          checked_at?: string
          checked_by?: string | null
          estimated_contract_margin?: number | null
          estimated_monthly_margin?: number | null
          first_3_month_margin?: number | null
          id?: string
          quote_id: string
          reason?: string | null
          reward_cost_assumption?: number | null
          status?: Database["public"]["Enums"]["quote_margin_check_status"]
          supplier_monthly_cost?: number | null
          total_monthly_sell?: number | null
        }
        Update: {
          checked_at?: string
          checked_by?: string | null
          estimated_contract_margin?: number | null
          estimated_monthly_margin?: number | null
          first_3_month_margin?: number | null
          id?: string
          quote_id?: string
          reason?: string | null
          reward_cost_assumption?: number | null
          status?: Database["public"]["Enums"]["quote_margin_check_status"]
          supplier_monthly_cost?: number | null
          total_monthly_sell?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_margin_checks_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_requests: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          assigned_admin_id: string | null
          business_name: string | null
          county: string | null
          created_at: string
          current_monthly_bill: number | null
          current_provider: string | null
          customer_facing_message: string | null
          customer_id: string | null
          customer_type: Database["public"]["Enums"]["customer_type_kind"]
          email: string
          final_quote_id: string | null
          full_name: string
          id: string
          ip: string | null
          marketing_consent: boolean
          message: string | null
          phone: string
          plan_preference: Database["public"]["Enums"]["plan_preference_kind"]
          postcode: string
          preferred_contact_method: string
          reference: string
          service_interest: Database["public"]["Enums"]["service_interest_kind"]
          source: string
          status: Database["public"]["Enums"]["quote_request_status"]
          town: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          assigned_admin_id?: string | null
          business_name?: string | null
          county?: string | null
          created_at?: string
          current_monthly_bill?: number | null
          current_provider?: string | null
          customer_facing_message?: string | null
          customer_id?: string | null
          customer_type?: Database["public"]["Enums"]["customer_type_kind"]
          email: string
          final_quote_id?: string | null
          full_name: string
          id?: string
          ip?: string | null
          marketing_consent?: boolean
          message?: string | null
          phone: string
          plan_preference?: Database["public"]["Enums"]["plan_preference_kind"]
          postcode: string
          preferred_contact_method?: string
          reference?: string
          service_interest: Database["public"]["Enums"]["service_interest_kind"]
          source?: string
          status?: Database["public"]["Enums"]["quote_request_status"]
          town?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          assigned_admin_id?: string | null
          business_name?: string | null
          county?: string | null
          created_at?: string
          current_monthly_bill?: number | null
          current_provider?: string | null
          customer_facing_message?: string | null
          customer_id?: string | null
          customer_type?: Database["public"]["Enums"]["customer_type_kind"]
          email?: string
          final_quote_id?: string | null
          full_name?: string
          id?: string
          ip?: string | null
          marketing_consent?: boolean
          message?: string | null
          phone?: string
          plan_preference?: Database["public"]["Enums"]["plan_preference_kind"]
          postcode?: string
          preferred_contact_method?: string
          reference?: string
          service_interest?: Database["public"]["Enums"]["service_interest_kind"]
          source?: string
          status?: Database["public"]["Enums"]["quote_request_status"]
          town?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_requests_assigned_admin_id_fkey"
            columns: ["assigned_admin_id"]
            isOneToOne: false
            referencedRelation: "admin_customer_search_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_requests_assigned_admin_id_fkey"
            columns: ["assigned_admin_id"]
            isOneToOne: false
            referencedRelation: "customer_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_requests_assigned_admin_id_fkey"
            columns: ["assigned_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "admin_customer_search_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_requests_final_quote_id_fkey"
            columns: ["final_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          admin_notes: string | null
          approved_at: string | null
          approved_by: string | null
          bucket_override_reason: string | null
          cease_fee_gross: number | null
          contract_length_months: number | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_intent_ip: string | null
          customer_intent_proceeded_at: string | null
          customer_intent_ua: string | null
          customer_notes: string | null
          customer_type: Database["public"]["Enums"]["customer_type_kind"]
          delivery_gross: number
          delivery_net: number
          delivery_vat_amount: number
          estimated_download_speed: number | null
          estimated_upload_speed: number | null
          expires_at: string
          final_snapshot: Json | null
          id: string
          installation_gross: number
          installation_net: number
          installation_vat_amount: number
          margin_amount: number | null
          margin_status: Database["public"]["Enums"]["margin_status_kind"]
          monthly_gross: number
          monthly_net: number
          monthly_vat_amount: number
          monthly_vat_rate: number
          notice_period: string
          plan_name: string
          plan_term: string | null
          plan_type: Database["public"]["Enums"]["plan_type_kind"]
          price_rise_policy: string
          public_token_hash: string | null
          quote_number: string
          quote_request_id: string
          reward_eligibility: string | null
          router_gross: number
          router_net: number
          router_option: Json | null
          router_vat_amount: number
          selected_addons: Json | null
          service_type: Database["public"]["Enums"]["service_interest_kind"]
          setup_gross: number
          setup_net: number
          setup_option: Json | null
          setup_vat_amount: number
          speed_bucket: string | null
          speed_notes: string | null
          status: Database["public"]["Enums"]["quote_status_kind"]
          supplier_name: string | null
          supplier_product_id: string | null
          supplier_reference: string | null
          token_expires_at: string | null
          total_due_today_gross: number
          unified_journey_opt_in: boolean
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bucket_override_reason?: string | null
          cease_fee_gross?: number | null
          contract_length_months?: number | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_intent_ip?: string | null
          customer_intent_proceeded_at?: string | null
          customer_intent_ua?: string | null
          customer_notes?: string | null
          customer_type: Database["public"]["Enums"]["customer_type_kind"]
          delivery_gross?: number
          delivery_net?: number
          delivery_vat_amount?: number
          estimated_download_speed?: number | null
          estimated_upload_speed?: number | null
          expires_at?: string
          final_snapshot?: Json | null
          id?: string
          installation_gross?: number
          installation_net?: number
          installation_vat_amount?: number
          margin_amount?: number | null
          margin_status?: Database["public"]["Enums"]["margin_status_kind"]
          monthly_gross?: number
          monthly_net?: number
          monthly_vat_amount?: number
          monthly_vat_rate?: number
          notice_period?: string
          plan_name: string
          plan_term?: string | null
          plan_type: Database["public"]["Enums"]["plan_type_kind"]
          price_rise_policy?: string
          public_token_hash?: string | null
          quote_number?: string
          quote_request_id: string
          reward_eligibility?: string | null
          router_gross?: number
          router_net?: number
          router_option?: Json | null
          router_vat_amount?: number
          selected_addons?: Json | null
          service_type: Database["public"]["Enums"]["service_interest_kind"]
          setup_gross?: number
          setup_net?: number
          setup_option?: Json | null
          setup_vat_amount?: number
          speed_bucket?: string | null
          speed_notes?: string | null
          status?: Database["public"]["Enums"]["quote_status_kind"]
          supplier_name?: string | null
          supplier_product_id?: string | null
          supplier_reference?: string | null
          token_expires_at?: string | null
          total_due_today_gross?: number
          unified_journey_opt_in?: boolean
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bucket_override_reason?: string | null
          cease_fee_gross?: number | null
          contract_length_months?: number | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_intent_ip?: string | null
          customer_intent_proceeded_at?: string | null
          customer_intent_ua?: string | null
          customer_notes?: string | null
          customer_type?: Database["public"]["Enums"]["customer_type_kind"]
          delivery_gross?: number
          delivery_net?: number
          delivery_vat_amount?: number
          estimated_download_speed?: number | null
          estimated_upload_speed?: number | null
          expires_at?: string
          final_snapshot?: Json | null
          id?: string
          installation_gross?: number
          installation_net?: number
          installation_vat_amount?: number
          margin_amount?: number | null
          margin_status?: Database["public"]["Enums"]["margin_status_kind"]
          monthly_gross?: number
          monthly_net?: number
          monthly_vat_amount?: number
          monthly_vat_rate?: number
          notice_period?: string
          plan_name?: string
          plan_term?: string | null
          plan_type?: Database["public"]["Enums"]["plan_type_kind"]
          price_rise_policy?: string
          public_token_hash?: string | null
          quote_number?: string
          quote_request_id?: string
          reward_eligibility?: string | null
          router_gross?: number
          router_net?: number
          router_option?: Json | null
          router_vat_amount?: number
          selected_addons?: Json | null
          service_type?: Database["public"]["Enums"]["service_interest_kind"]
          setup_gross?: number
          setup_net?: number
          setup_option?: Json | null
          setup_vat_amount?: number
          speed_bucket?: string | null
          speed_notes?: string | null
          status?: Database["public"]["Enums"]["quote_status_kind"]
          supplier_name?: string | null
          supplier_product_id?: string | null
          supplier_reference?: string | null
          token_expires_at?: string | null
          total_due_today_gross?: number
          unified_journey_opt_in?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_customer_search_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "customer_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "admin_customer_search_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          action: string
          created_at: string | null
          id: string
          identifier: string
          request_count: number | null
          window_start: string
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          identifier: string
          request_count?: number | null
          window_start?: string
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          identifier?: string
          request_count?: number | null
          window_start?: string
        }
        Relationships: []
      }
      receipts: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          method: string | null
          paid_at: string
          reference: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          method?: string | null
          paid_at?: string
          reference?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          method?: string | null
          paid_at?: string
          reference?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          customer_id: string | null
          expires_at: string | null
          id: string
          max_uses: number | null
          partner_id: string | null
          status: Database["public"]["Enums"]["referral_code_status"]
          usage_count: number
        }
        Insert: {
          code: string
          created_at?: string
          customer_id?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          partner_id?: string | null
          status?: Database["public"]["Enums"]["referral_code_status"]
          usage_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          customer_id?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          partner_id?: string | null
          status?: Database["public"]["Enums"]["referral_code_status"]
          usage_count?: number
        }
        Relationships: []
      }
      referral_events: {
        Row: {
          created_at: string
          details: Json
          event_type: Database["public"]["Enums"]["referral_event_type"]
          id: string
          ip_hash: string | null
          referral_code_id: string | null
          referred_customer_id: string | null
          referred_order_id: string | null
          referred_quote_id: string | null
          referred_quote_request_id: string | null
          referrer_customer_id: string | null
          user_agent_hash: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          event_type: Database["public"]["Enums"]["referral_event_type"]
          id?: string
          ip_hash?: string | null
          referral_code_id?: string | null
          referred_customer_id?: string | null
          referred_order_id?: string | null
          referred_quote_id?: string | null
          referred_quote_request_id?: string | null
          referrer_customer_id?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          event_type?: Database["public"]["Enums"]["referral_event_type"]
          id?: string
          ip_hash?: string | null
          referral_code_id?: string | null
          referred_customer_id?: string | null
          referred_order_id?: string | null
          referred_quote_id?: string | null
          referred_quote_request_id?: string | null
          referrer_customer_id?: string | null
          user_agent_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_events_referral_code_id_fkey"
            columns: ["referral_code_id"]
            isOneToOne: false
            referencedRelation: "customer_referral_codes_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_events_referral_code_id_fkey"
            columns: ["referral_code_id"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      retail_price_floors: {
        Row: {
          active: boolean
          created_at: string
          floor_monthly_gross: number
          id: string
          notes: string | null
          plan_term: string
          service_type: string
          speed_bucket: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          floor_monthly_gross: number
          id?: string
          notes?: string | null
          plan_term: string
          service_type: string
          speed_bucket: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          floor_monthly_gross?: number
          id?: string
          notes?: string | null
          plan_term?: string
          service_type?: string
          speed_bucket?: string
          updated_at?: string
        }
        Relationships: []
      }
      reward_accounts: {
        Row: {
          bill_credit_balance_cached: number
          created_at: string
          customer_id: string
          id: string
          points_balance_cached: number
          status: Database["public"]["Enums"]["reward_account_status"]
          updated_at: string
        }
        Insert: {
          bill_credit_balance_cached?: number
          created_at?: string
          customer_id: string
          id?: string
          points_balance_cached?: number
          status?: Database["public"]["Enums"]["reward_account_status"]
          updated_at?: string
        }
        Update: {
          bill_credit_balance_cached?: number
          created_at?: string
          customer_id?: string
          id?: string
          points_balance_cached?: number
          status?: Database["public"]["Enums"]["reward_account_status"]
          updated_at?: string
        }
        Relationships: []
      }
      rewards: {
        Row: {
          admin_approved_at: string | null
          admin_approved_by: string | null
          created_at: string
          customer_id: string
          id: string
          margin_check_status:
            | Database["public"]["Enums"]["quote_margin_check_status"]
            | null
          related_invoice_id: string | null
          related_order_id: string | null
          related_quote_id: string | null
          related_referral_event_id: string | null
          reversal_reason: string | null
          reward_currency: string
          reward_type: Database["public"]["Enums"]["reward_type"]
          reward_value: number | null
          status: Database["public"]["Enums"]["reward_status"]
          unlock_rule: Database["public"]["Enums"]["reward_unlock_rule"] | null
          updated_at: string
        }
        Insert: {
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          created_at?: string
          customer_id: string
          id?: string
          margin_check_status?:
            | Database["public"]["Enums"]["quote_margin_check_status"]
            | null
          related_invoice_id?: string | null
          related_order_id?: string | null
          related_quote_id?: string | null
          related_referral_event_id?: string | null
          reversal_reason?: string | null
          reward_currency?: string
          reward_type: Database["public"]["Enums"]["reward_type"]
          reward_value?: number | null
          status?: Database["public"]["Enums"]["reward_status"]
          unlock_rule?: Database["public"]["Enums"]["reward_unlock_rule"] | null
          updated_at?: string
        }
        Update: {
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          margin_check_status?:
            | Database["public"]["Enums"]["quote_margin_check_status"]
            | null
          related_invoice_id?: string | null
          related_order_id?: string | null
          related_quote_id?: string | null
          related_referral_event_id?: string | null
          reversal_reason?: string | null
          reward_currency?: string
          reward_type?: Database["public"]["Enums"]["reward_type"]
          reward_value?: number | null
          status?: Database["public"]["Enums"]["reward_status"]
          unlock_rule?: Database["public"]["Enums"]["reward_unlock_rule"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rewards_related_referral_event_id_fkey"
            columns: ["related_referral_event_id"]
            isOneToOne: false
            referencedRelation: "referral_events"
            referencedColumns: ["id"]
          },
        ]
      }
      service_activation_outbox: {
        Row: {
          attempts: number
          created_at: string
          id: string
          job_type: string
          journey_id: string | null
          last_error: string | null
          payload: Json
          processed_at: string | null
          service_id: string
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          job_type: string
          journey_id?: string | null
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          service_id: string
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          job_type?: string
          journey_id?: string | null
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          service_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_activation_outbox_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "order_journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_activation_outbox_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          activation_confirmed_at: string | null
          activation_confirmed_by: string | null
          activation_date: string | null
          activation_notes: string | null
          activation_reference: string | null
          actual_activation_date: string | null
          billing_anchor_day: number | null
          billing_enabled: boolean
          contract_summary_id: string | null
          contract_type: string | null
          created_at: string
          etf_policy_snapshot: Json | null
          id: string
          identifiers: Json
          journey_id: string | null
          minimum_term_end_date: string | null
          minimum_term_months: number | null
          next_billing_date: string | null
          notice_period_days: number | null
          order_id: string | null
          plan_name: string | null
          price_monthly: number
          provisioned_at: string | null
          selected_addons: Json | null
          service_address: string | null
          service_type: string
          status: string
          supplier_ref: string | null
          supplier_reference: string | null
          suspension_reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activation_confirmed_at?: string | null
          activation_confirmed_by?: string | null
          activation_date?: string | null
          activation_notes?: string | null
          activation_reference?: string | null
          actual_activation_date?: string | null
          billing_anchor_day?: number | null
          billing_enabled?: boolean
          contract_summary_id?: string | null
          contract_type?: string | null
          created_at?: string
          etf_policy_snapshot?: Json | null
          id?: string
          identifiers?: Json
          journey_id?: string | null
          minimum_term_end_date?: string | null
          minimum_term_months?: number | null
          next_billing_date?: string | null
          notice_period_days?: number | null
          order_id?: string | null
          plan_name?: string | null
          price_monthly?: number
          provisioned_at?: string | null
          selected_addons?: Json | null
          service_address?: string | null
          service_type: string
          status?: string
          supplier_ref?: string | null
          supplier_reference?: string | null
          suspension_reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activation_confirmed_at?: string | null
          activation_confirmed_by?: string | null
          activation_date?: string | null
          activation_notes?: string | null
          activation_reference?: string | null
          actual_activation_date?: string | null
          billing_anchor_day?: number | null
          billing_enabled?: boolean
          contract_summary_id?: string | null
          contract_type?: string | null
          created_at?: string
          etf_policy_snapshot?: Json | null
          id?: string
          identifiers?: Json
          journey_id?: string | null
          minimum_term_end_date?: string | null
          minimum_term_months?: number | null
          next_billing_date?: string | null
          notice_period_days?: number | null
          order_id?: string | null
          plan_name?: string | null
          price_monthly?: number
          provisioned_at?: string | null
          selected_addons?: Json | null
          service_address?: string | null
          service_type?: string
          status?: string
          supplier_ref?: string | null
          supplier_reference?: string | null
          suspension_reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "order_journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      site_copy: {
        Row: {
          created_at: string
          id: string
          key: string
          notes: string | null
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      supplier_products: {
        Row: {
          active: boolean
          bucket_hint: string | null
          care_level: string | null
          care_level_uplift_net: number | null
          connection_fee_net: number | null
          created_at: string
          disconnect_fee_after_12m_net: number | null
          disconnect_fee_in_12m_net: number | null
          download_speed_label: string | null
          download_speed_mbps: number | null
          etf_applies: boolean
          id: string
          migration_fee_net: number | null
          min_term_months: number | null
          network: string | null
          notes: string | null
          product_name: string
          quote_only: boolean
          reverse_charge: boolean
          router_compatible: string | null
          router_notes: string | null
          router_required: boolean
          service_type: string
          source_document: string | null
          source_page: string | null
          source_section: string | null
          supplier_cease_fee_net: number | null
          supplier_delivery_net: number | null
          supplier_id: string
          supplier_install_net: number | null
          supplier_monthly_net: number | null
          supplier_product_id: string | null
          supplier_router_net: number | null
          supplier_setup_net: number | null
          supplier_vat_rate: number
          tags: string[]
          technology: string | null
          updated_at: string
          upload_speed_label: string | null
          upload_speed_mbps: number | null
        }
        Insert: {
          active?: boolean
          bucket_hint?: string | null
          care_level?: string | null
          care_level_uplift_net?: number | null
          connection_fee_net?: number | null
          created_at?: string
          disconnect_fee_after_12m_net?: number | null
          disconnect_fee_in_12m_net?: number | null
          download_speed_label?: string | null
          download_speed_mbps?: number | null
          etf_applies?: boolean
          id?: string
          migration_fee_net?: number | null
          min_term_months?: number | null
          network?: string | null
          notes?: string | null
          product_name: string
          quote_only?: boolean
          reverse_charge?: boolean
          router_compatible?: string | null
          router_notes?: string | null
          router_required?: boolean
          service_type: string
          source_document?: string | null
          source_page?: string | null
          source_section?: string | null
          supplier_cease_fee_net?: number | null
          supplier_delivery_net?: number | null
          supplier_id: string
          supplier_install_net?: number | null
          supplier_monthly_net?: number | null
          supplier_product_id?: string | null
          supplier_router_net?: number | null
          supplier_setup_net?: number | null
          supplier_vat_rate?: number
          tags?: string[]
          technology?: string | null
          updated_at?: string
          upload_speed_label?: string | null
          upload_speed_mbps?: number | null
        }
        Update: {
          active?: boolean
          bucket_hint?: string | null
          care_level?: string | null
          care_level_uplift_net?: number | null
          connection_fee_net?: number | null
          created_at?: string
          disconnect_fee_after_12m_net?: number | null
          disconnect_fee_in_12m_net?: number | null
          download_speed_label?: string | null
          download_speed_mbps?: number | null
          etf_applies?: boolean
          id?: string
          migration_fee_net?: number | null
          min_term_months?: number | null
          network?: string | null
          notes?: string | null
          product_name?: string
          quote_only?: boolean
          reverse_charge?: boolean
          router_compatible?: string | null
          router_notes?: string | null
          router_required?: boolean
          service_type?: string
          source_document?: string | null
          source_page?: string | null
          source_section?: string | null
          supplier_cease_fee_net?: number | null
          supplier_delivery_net?: number | null
          supplier_id?: string
          supplier_install_net?: number | null
          supplier_monthly_net?: number | null
          supplier_product_id?: string | null
          supplier_router_net?: number | null
          supplier_setup_net?: number | null
          supplier_vat_rate?: number
          tags?: string[]
          technology?: string | null
          updated_at?: string
          upload_speed_label?: string | null
          upload_speed_mbps?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_profiles: {
        Row: {
          api_mode: Database["public"]["Enums"]["supplier_api_mode"]
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          notes: string | null
          portal_url: string | null
          reverse_charge_possible: boolean
          status: string
          supplier_name: string
          supplier_type: string
          updated_at: string
          vat_treatment_notes: string | null
        }
        Insert: {
          api_mode?: Database["public"]["Enums"]["supplier_api_mode"]
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          portal_url?: string | null
          reverse_charge_possible?: boolean
          status?: string
          supplier_name: string
          supplier_type: string
          updated_at?: string
          vat_treatment_notes?: string | null
        }
        Update: {
          api_mode?: Database["public"]["Enums"]["supplier_api_mode"]
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          portal_url?: string | null
          reverse_charge_possible?: boolean
          status?: string
          supplier_name?: string
          supplier_type?: string
          updated_at?: string
          vat_treatment_notes?: string | null
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string | null
          closed_at: string | null
          created_at: string
          description: string
          first_response_due_at: string | null
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          related_invoice_id: string | null
          related_order_id: string | null
          related_quote_id: string | null
          related_service_id: string | null
          resolution_due_at: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
          user_id: string
          vulnerable_customer_flag: boolean
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          closed_at?: string | null
          created_at?: string
          description: string
          first_response_due_at?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          related_invoice_id?: string | null
          related_order_id?: string | null
          related_quote_id?: string | null
          related_service_id?: string | null
          resolution_due_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
          user_id: string
          vulnerable_customer_flag?: boolean
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          closed_at?: string | null
          created_at?: string
          description?: string
          first_response_due_at?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          related_invoice_id?: string | null
          related_order_id?: string | null
          related_quote_id?: string | null
          related_service_id?: string | null
          resolution_due_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          updated_at?: string
          user_id?: string
          vulnerable_customer_flag?: boolean
        }
        Relationships: []
      }
      technicians: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          notes: string | null
          phone: string
          specializations: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          notes?: string | null
          phone: string
          specializations?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string
          specializations?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      ticket_internal_notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          ticket_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          ticket_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_internal_notes_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          created_at: string
          id: string
          is_staff_reply: boolean
          message: string
          sender_role: string | null
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_staff_reply?: boolean
          message: string
          sender_role?: string | null
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_staff_reply?: boolean
          message?: string
          sender_role?: string | null
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_files: {
        Row: {
          created_at: string
          description: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          uploaded_by: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type: string
          id?: string
          uploaded_by: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          uploaded_by?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      admin_customer_search_view: {
        Row: {
          account_number: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          full_name: string | null
          id: string | null
          latest_postcode: string | null
          latest_postcode_normalized: string | null
          phone: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      chat_analytics_summary: {
        Row: {
          assistant_messages: number | null
          avg_response_time_ms: number | null
          date: string | null
          detected_category: string | null
          detected_intent: string | null
          helpful_count: number | null
          unhelpful_count: number | null
          unique_sessions: number | null
          user_messages: number | null
        }
        Relationships: []
      }
      customer_contract_summaries: {
        Row: {
          accepted_at: string | null
          account_number: string | null
          business_monthly_ex_vat: number | null
          business_monthly_incl_vat: number | null
          cease_cancellation_charges: string | null
          complaints_adr_info: string | null
          contract_length: string | null
          created_at: string | null
          cs_number: string | null
          customer_email_snapshot: string | null
          customer_id: string | null
          customer_name_snapshot: string | null
          customer_type:
            | Database["public"]["Enums"]["customer_type_kind"]
            | null
          delivery_charge: number | null
          digital_voice_warning: string | null
          emailed_at: string | null
          estimated_download_speed: number | null
          estimated_upload_speed: number | null
          id: string | null
          installation_charge: number | null
          issued_at: string | null
          monthly_price_incl_vat: number | null
          notice_period: string | null
          one_off_charges_json: Json | null
          payment_schedule: string | null
          pdf_generated_at: string | null
          pdf_storage_key: string | null
          pdf_url: string | null
          plan_name: string | null
          plan_term: string | null
          plan_type: Database["public"]["Enums"]["plan_type_kind"] | null
          price_rise_policy: string | null
          privacy_version: string | null
          quote_id: string | null
          quote_request_id: string | null
          router_charge: number | null
          router_option: Json | null
          selected_addons: Json | null
          service_address: string | null
          service_type:
            | Database["public"]["Enums"]["service_interest_kind"]
            | null
          setup_charge: number | null
          setup_option: Json | null
          speed_bucket: string | null
          speed_notes: string | null
          status:
            | Database["public"]["Enums"]["contract_summary_status_kind"]
            | null
          terms_version: string | null
          token_expires_at: string | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          accepted_at?: string | null
          account_number?: string | null
          business_monthly_ex_vat?: number | null
          business_monthly_incl_vat?: number | null
          cease_cancellation_charges?: string | null
          complaints_adr_info?: string | null
          contract_length?: string | null
          created_at?: string | null
          cs_number?: string | null
          customer_email_snapshot?: string | null
          customer_id?: string | null
          customer_name_snapshot?: string | null
          customer_type?:
            | Database["public"]["Enums"]["customer_type_kind"]
            | null
          delivery_charge?: number | null
          digital_voice_warning?: string | null
          emailed_at?: string | null
          estimated_download_speed?: number | null
          estimated_upload_speed?: number | null
          id?: string | null
          installation_charge?: number | null
          issued_at?: string | null
          monthly_price_incl_vat?: number | null
          notice_period?: string | null
          one_off_charges_json?: Json | null
          payment_schedule?: string | null
          pdf_generated_at?: string | null
          pdf_storage_key?: string | null
          pdf_url?: string | null
          plan_name?: string | null
          plan_term?: string | null
          plan_type?: Database["public"]["Enums"]["plan_type_kind"] | null
          price_rise_policy?: string | null
          privacy_version?: string | null
          quote_id?: string | null
          quote_request_id?: string | null
          router_charge?: number | null
          router_option?: Json | null
          selected_addons?: Json | null
          service_address?: string | null
          service_type?:
            | Database["public"]["Enums"]["service_interest_kind"]
            | null
          setup_charge?: number | null
          setup_option?: Json | null
          speed_bucket?: string | null
          speed_notes?: string | null
          status?:
            | Database["public"]["Enums"]["contract_summary_status_kind"]
            | null
          terms_version?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          accepted_at?: string | null
          account_number?: string | null
          business_monthly_ex_vat?: number | null
          business_monthly_incl_vat?: number | null
          cease_cancellation_charges?: string | null
          complaints_adr_info?: string | null
          contract_length?: string | null
          created_at?: string | null
          cs_number?: string | null
          customer_email_snapshot?: string | null
          customer_id?: string | null
          customer_name_snapshot?: string | null
          customer_type?:
            | Database["public"]["Enums"]["customer_type_kind"]
            | null
          delivery_charge?: number | null
          digital_voice_warning?: string | null
          emailed_at?: string | null
          estimated_download_speed?: number | null
          estimated_upload_speed?: number | null
          id?: string | null
          installation_charge?: number | null
          issued_at?: string | null
          monthly_price_incl_vat?: number | null
          notice_period?: string | null
          one_off_charges_json?: Json | null
          payment_schedule?: string | null
          pdf_generated_at?: string | null
          pdf_storage_key?: string | null
          pdf_url?: string | null
          plan_name?: string | null
          plan_term?: string | null
          plan_type?: Database["public"]["Enums"]["plan_type_kind"] | null
          price_rise_policy?: string | null
          privacy_version?: string | null
          quote_id?: string | null
          quote_request_id?: string | null
          router_charge?: number | null
          router_option?: Json | null
          selected_addons?: Json | null
          service_address?: string | null
          service_type?:
            | Database["public"]["Enums"]["service_interest_kind"]
            | null
          setup_charge?: number | null
          setup_option?: Json | null
          speed_bucket?: string | null
          speed_notes?: string | null
          status?:
            | Database["public"]["Enums"]["contract_summary_status_kind"]
            | null
          terms_version?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_summaries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "admin_customer_search_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_summaries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_summaries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_summaries_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_summaries_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_guest_orders: {
        Row: {
          account_number: string | null
          additional_notes: string | null
          address_line1: string | null
          address_line2: string | null
          city: string | null
          contract_end_date: string | null
          created_at: string | null
          current_provider: string | null
          email: string | null
          full_name: string | null
          gdpr_consent: boolean | null
          id: string | null
          in_contract: boolean | null
          linked_at: string | null
          marketing_consent: boolean | null
          order_number: string | null
          phone: string | null
          plan_name: string | null
          plan_price: number | null
          postcode: string | null
          preferred_switch_date: string | null
          selected_addons: Json | null
          service_type: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          account_number?: string | null
          additional_notes?: string | null
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          contract_end_date?: string | null
          created_at?: string | null
          current_provider?: string | null
          email?: string | null
          full_name?: string | null
          gdpr_consent?: boolean | null
          id?: string | null
          in_contract?: boolean | null
          linked_at?: string | null
          marketing_consent?: boolean | null
          order_number?: string | null
          phone?: string | null
          plan_name?: string | null
          plan_price?: number | null
          postcode?: string | null
          preferred_switch_date?: string | null
          selected_addons?: Json | null
          service_type?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          account_number?: string | null
          additional_notes?: string | null
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          contract_end_date?: string | null
          created_at?: string | null
          current_provider?: string | null
          email?: string | null
          full_name?: string | null
          gdpr_consent?: boolean | null
          id?: string | null
          in_contract?: boolean | null
          linked_at?: string | null
          marketing_consent?: boolean | null
          order_number?: string | null
          phone?: string | null
          plan_name?: string | null
          plan_price?: number | null
          postcode?: string | null
          preferred_switch_date?: string | null
          selected_addons?: Json | null
          service_type?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      customer_orders: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          billing_anchor_day: number | null
          city: string | null
          cooling_off_ends_at: string | null
          created_at: string | null
          id: string | null
          installation_date: string | null
          journey_id: string | null
          notes: string | null
          payment_method: string | null
          plan_name: string | null
          plan_price: number | null
          postcode: string | null
          preferred_start_date: string | null
          service_type: Database["public"]["Enums"]["service_type"] | null
          status: Database["public"]["Enums"]["order_status"] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          billing_anchor_day?: number | null
          city?: string | null
          cooling_off_ends_at?: string | null
          created_at?: string | null
          id?: string | null
          installation_date?: string | null
          journey_id?: string | null
          notes?: string | null
          payment_method?: string | null
          plan_name?: string | null
          plan_price?: number | null
          postcode?: string | null
          preferred_start_date?: string | null
          service_type?: Database["public"]["Enums"]["service_type"] | null
          status?: Database["public"]["Enums"]["order_status"] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          billing_anchor_day?: number | null
          city?: string | null
          cooling_off_ends_at?: string | null
          created_at?: string | null
          id?: string | null
          installation_date?: string | null
          journey_id?: string | null
          notes?: string | null
          payment_method?: string | null
          plan_name?: string | null
          plan_price?: number | null
          postcode?: string | null
          preferred_start_date?: string | null
          service_type?: Database["public"]["Enums"]["service_type"] | null
          status?: Database["public"]["Enums"]["order_status"] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "order_journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_points_ledger_view: {
        Row: {
          available_at: string | null
          bill_credit_delta: number | null
          created_at: string | null
          customer_id: string | null
          expires_at: string | null
          id: string | null
          points_delta: number | null
          reason: string | null
          source_type:
            | Database["public"]["Enums"]["points_ledger_source"]
            | null
          status: Database["public"]["Enums"]["points_ledger_status"] | null
        }
        Insert: {
          available_at?: string | null
          bill_credit_delta?: number | null
          created_at?: string | null
          customer_id?: string | null
          expires_at?: string | null
          id?: string | null
          points_delta?: number | null
          reason?: string | null
          source_type?:
            | Database["public"]["Enums"]["points_ledger_source"]
            | null
          status?: Database["public"]["Enums"]["points_ledger_status"] | null
        }
        Update: {
          available_at?: string | null
          bill_credit_delta?: number | null
          created_at?: string | null
          customer_id?: string | null
          expires_at?: string | null
          id?: string | null
          points_delta?: number | null
          reason?: string | null
          source_type?:
            | Database["public"]["Enums"]["points_ledger_source"]
            | null
          status?: Database["public"]["Enums"]["points_ledger_status"] | null
        }
        Relationships: []
      }
      customer_profile: {
        Row: {
          account_number: string | null
          address_line1: string | null
          address_line2: string | null
          city: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          full_name: string | null
          id: string | null
          phone: string | null
          postcode: string | null
          updated_at: string | null
        }
        Insert: {
          account_number?: string | null
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          phone?: string | null
          postcode?: string | null
          updated_at?: string | null
        }
        Update: {
          account_number?: string | null
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          phone?: string | null
          postcode?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      customer_referral_codes_view: {
        Row: {
          code: string | null
          created_at: string | null
          customer_id: string | null
          expires_at: string | null
          id: string | null
          max_uses: number | null
          status: Database["public"]["Enums"]["referral_code_status"] | null
          usage_count: number | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          customer_id?: string | null
          expires_at?: string | null
          id?: string | null
          max_uses?: number | null
          status?: Database["public"]["Enums"]["referral_code_status"] | null
          usage_count?: number | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          customer_id?: string | null
          expires_at?: string | null
          id?: string | null
          max_uses?: number | null
          status?: Database["public"]["Enums"]["referral_code_status"] | null
          usage_count?: number | null
        }
        Relationships: []
      }
      customer_reward_accounts_view: {
        Row: {
          bill_credit_balance_cached: number | null
          created_at: string | null
          customer_id: string | null
          id: string | null
          points_balance_cached: number | null
          status: Database["public"]["Enums"]["reward_account_status"] | null
          updated_at: string | null
        }
        Insert: {
          bill_credit_balance_cached?: number | null
          created_at?: string | null
          customer_id?: string | null
          id?: string | null
          points_balance_cached?: number | null
          status?: Database["public"]["Enums"]["reward_account_status"] | null
          updated_at?: string | null
        }
        Update: {
          bill_credit_balance_cached?: number | null
          created_at?: string | null
          customer_id?: string | null
          id?: string | null
          points_balance_cached?: number | null
          status?: Database["public"]["Enums"]["reward_account_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      customer_rewards_view: {
        Row: {
          created_at: string | null
          customer_id: string | null
          id: string | null
          reward_currency: string | null
          reward_type: Database["public"]["Enums"]["reward_type"] | null
          reward_value: number | null
          status: Database["public"]["Enums"]["reward_status"] | null
          unlock_rule: Database["public"]["Enums"]["reward_unlock_rule"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          id?: string | null
          reward_currency?: string | null
          reward_type?: Database["public"]["Enums"]["reward_type"] | null
          reward_value?: number | null
          status?: Database["public"]["Enums"]["reward_status"] | null
          unlock_rule?: Database["public"]["Enums"]["reward_unlock_rule"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          id?: string | null
          reward_currency?: string | null
          reward_type?: Database["public"]["Enums"]["reward_type"] | null
          reward_value?: number | null
          status?: Database["public"]["Enums"]["reward_status"] | null
          unlock_rule?: Database["public"]["Enums"]["reward_unlock_rule"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      dd_mandates_list: {
        Row: {
          account_holder: string | null
          account_number_masked: string | null
          bank_last4: string | null
          consent_timestamp: string | null
          created_at: string | null
          has_bank_details: boolean | null
          id: string | null
          mandate_reference: string | null
          payment_request_id: string | null
          sort_code_masked: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          account_holder?: string | null
          account_number_masked?: never
          bank_last4?: string | null
          consent_timestamp?: string | null
          created_at?: string | null
          has_bank_details?: never
          id?: string | null
          mandate_reference?: string | null
          payment_request_id?: string | null
          sort_code_masked?: never
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          account_holder?: string | null
          account_number_masked?: never
          bank_last4?: string | null
          consent_timestamp?: string | null
          created_at?: string | null
          has_bank_details?: never
          id?: string | null
          mandate_reference?: string | null
          payment_request_id?: string | null
          sort_code_masked?: never
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dd_mandates_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings_public: {
        Row: {
          api_mode: string | null
          business_vat_display: string | null
          created_at: string | null
          id: string | null
          manual_mode_message: string | null
          residential_vat_display: string | null
          rewards_custom_rule: Json | null
          rewards_enabled: boolean | null
          rewards_unlock_rule: string | null
          sim_checkout_mode: string | null
          singleton: boolean | null
          updated_at: string | null
          vat_default_rate: number | null
          vat_effective_date: string | null
          vat_number: string | null
          vat_scheme: string | null
        }
        Insert: {
          api_mode?: string | null
          business_vat_display?: string | null
          created_at?: string | null
          id?: string | null
          manual_mode_message?: string | null
          residential_vat_display?: string | null
          rewards_custom_rule?: Json | null
          rewards_enabled?: boolean | null
          rewards_unlock_rule?: string | null
          sim_checkout_mode?: string | null
          singleton?: boolean | null
          updated_at?: string | null
          vat_default_rate?: number | null
          vat_effective_date?: string | null
          vat_number?: string | null
          vat_scheme?: string | null
        }
        Update: {
          api_mode?: string | null
          business_vat_display?: string | null
          created_at?: string | null
          id?: string | null
          manual_mode_message?: string | null
          residential_vat_display?: string | null
          rewards_custom_rule?: Json | null
          rewards_enabled?: boolean | null
          rewards_unlock_rule?: string | null
          sim_checkout_mode?: string | null
          singleton?: boolean | null
          updated_at?: string | null
          vat_default_rate?: number | null
          vat_effective_date?: string | null
          vat_number?: string | null
          vat_scheme?: string | null
        }
        Relationships: []
      }
      public_contract_benefits_view: {
        Row: {
          active: boolean | null
          benefit_name: string | null
          benefit_type:
            | Database["public"]["Enums"]["contract_benefit_type"]
            | null
          customer_type:
            | Database["public"]["Enums"]["benefit_customer_type"]
            | null
          description: string | null
          ends_at: string | null
          id: string | null
          plan_type: Database["public"]["Enums"]["benefit_plan_type"] | null
          starts_at: string | null
          terms_text: string | null
          value_label: string | null
        }
        Insert: {
          active?: boolean | null
          benefit_name?: string | null
          benefit_type?:
            | Database["public"]["Enums"]["contract_benefit_type"]
            | null
          customer_type?:
            | Database["public"]["Enums"]["benefit_customer_type"]
            | null
          description?: string | null
          ends_at?: string | null
          id?: string | null
          plan_type?: Database["public"]["Enums"]["benefit_plan_type"] | null
          starts_at?: string | null
          terms_text?: string | null
          value_label?: string | null
        }
        Update: {
          active?: boolean | null
          benefit_name?: string | null
          benefit_type?:
            | Database["public"]["Enums"]["contract_benefit_type"]
            | null
          customer_type?:
            | Database["public"]["Enums"]["benefit_customer_type"]
            | null
          description?: string | null
          ends_at?: string | null
          id?: string | null
          plan_type?: Database["public"]["Enums"]["benefit_plan_type"] | null
          starts_at?: string | null
          terms_text?: string | null
          value_label?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_approve_final_quote: {
        Args: { _quote_id: string }
        Returns: undefined
      }
      admin_link_quote_request: {
        Args: { _new_user_id: string; _qr_id: string; _reason: string }
        Returns: undefined
      }
      admin_override_quote_floor: {
        Args: { _quote_id: string; _reason: string }
        Returns: undefined
      }
      admin_reject_quote_request: {
        Args: { _qr_id: string; _reason: string }
        Returns: undefined
      }
      admin_request_more_info: {
        Args: { _message: string; _qr_id: string }
        Returns: undefined
      }
      admin_set_quote_unified_opt_in: {
        Args: { _enabled: boolean; _quote_id: string }
        Returns: boolean
      }
      anonymize_old_account_deletions: { Args: never; Returns: number }
      calculate_next_invoice_date: {
        Args: {
          p_billing_day: number
          p_billing_mode: string
          p_current_date?: string
        }
        Returns: string
      }
      can_create_manual_fulfilment: {
        Args: { _payment_request_id: string }
        Returns: boolean
      }
      can_create_manual_fulfilment_for_journey: {
        Args: { _journey_id: string }
        Returns: boolean
      }
      can_override_red_margin: { Args: { _user_id: string }; Returns: boolean }
      can_send_quote: { Args: { _quote_id: string }; Returns: boolean }
      check_rate_limit: {
        Args: {
          _action: string
          _identifier: string
          _max_requests?: number
          _window_minutes?: number
        }
        Returns: boolean
      }
      compute_cooling_off: {
        Args: { _accepted_at: string }
        Returns: {
          cooling_off_ends_at: string
          earliest_selectable_start_date: string
        }[]
      }
      confirm_service_live_tx: {
        Args: {
          _activation_notes: string
          _activation_reference: string
          _actor: string
          _actual_activation_date: string
          _customer_note: string
          _giacom_reference: string
          _internal_note: string
          _order_id: string
        }
        Returns: Json
      }
      current_reward_unlock_rule: {
        Args: never
        Returns: Database["public"]["Enums"]["reward_unlock_rule"]
      }
      customer_accept_contract_summary: {
        Args: {
          _acceptance_text: string
          _checkbox_confirmed: boolean
          _cs_id: string
          _ip: string
          _user_agent: string
        }
        Returns: Json
      }
      customer_add_ticket_message: {
        Args: { _message: string; _ticket_id: string }
        Returns: string
      }
      customer_create_complaint: {
        Args: {
          _category: string
          _contact_email?: string
          _contact_phone?: string
          _desired_outcome?: string
          _summary: string
        }
        Returns: string
      }
      customer_create_ticket: {
        Args: {
          _category: string
          _description: string
          _priority?: string
          _subject: string
          _vulnerable?: boolean
        }
        Returns: string
      }
      customer_proceed_with_quote_authed: {
        Args: { _quote_id: string }
        Returns: Json
      }
      customer_proceed_with_quote_by_token: {
        Args: { _ip?: string; _token_hash: string; _ua?: string }
        Returns: Json
      }
      expire_old_quotes: { Args: never; Returns: number }
      generate_acceptance_certificate_number: { Args: never; Returns: string }
      generate_account_number: { Args: never; Returns: string }
      generate_complaint_reference: { Args: never; Returns: string }
      generate_invoice_number: { Args: never; Returns: string }
      generate_occta_order_number: { Args: never; Returns: string }
      generate_payment_request_number: { Args: never; Returns: string }
      generate_safe_account_number: { Args: never; Returns: string }
      generate_user_account_number: { Args: never; Returns: string }
      get_customer_communication_messages: {
        Args: { _thread_id: string }
        Returns: {
          body: string
          channel: string
          created_at: string
          direction: string
          id: string
          sender_type: string
          subject: string
        }[]
      }
      get_customer_communication_threads: {
        Args: never
        Returns: {
          channel: string
          created_at: string
          id: string
          status: string
          subject: string
          updated_at: string
        }[]
      }
      get_customer_complaint_events: {
        Args: { _complaint_id: string }
        Returns: {
          actor_type: string
          created_at: string
          event_type: string
          id: string
          title: string
        }[]
      }
      get_customer_complaint_letters: {
        Args: never
        Returns: {
          body: string
          complaint_id: string
          id: string
          letter_type: string
          sent_at: string
          subject: string
        }[]
      }
      get_customer_complaints: {
        Args: never
        Returns: {
          adr_provider: string
          adr_reference: string
          category: string
          complaint_reference: string
          deadlock_issued_at: string
          id: string
          opened_at: string
          priority: string
          resolved_at: string
          six_week_adr_eligible_at: string
          status: string
          summary: string
        }[]
      }
      get_customer_contract_summary_acceptance: {
        Args: { _cs_id: string }
        Returns: {
          acceptance_text: string
          accepted_at: string
          accepted_by_email: string
          accepted_by_name: string
          contract_summary_id: string
          cs_version: number
          id: string
          pdf_sha256: string
          privacy_version: string
          terms_version: string
        }[]
      }
      get_customer_contract_summary_by_id: {
        Args: { _id: string }
        Returns: {
          accepted_at: string
          account_number: string
          business_monthly_ex_vat: number
          business_monthly_incl_vat: number
          cease_cancellation_charges: string
          complaints_adr_info: string
          contract_length: string
          cs_number: string
          customer_email_snapshot: string
          customer_name_snapshot: string
          customer_type: string
          delivery_charge: number
          digital_voice_warning: string
          estimated_download_speed: number
          estimated_upload_speed: number
          id: string
          installation_charge: number
          issued_at: string
          monthly_price_incl_vat: number
          notice_period: string
          one_off_charges_json: Json
          payment_schedule: string
          pdf_storage_key: string
          plan_name: string
          plan_type: string
          price_rise_policy: string
          privacy_version: string
          quote_id: string
          quote_request_id: string
          router_charge: number
          service_address: string
          service_type: string
          setup_charge: number
          speed_notes: string
          status: string
          terms_version: string
          version: number
        }[]
      }
      get_customer_points_ledger: {
        Args: { _limit?: number }
        Returns: {
          available_at: string
          bill_credit_delta: number
          created_at: string
          expires_at: string
          id: string
          points_delta: number
          reason: string
          source_type: string
          status: string
        }[]
      }
      get_customer_quote_by_id: {
        Args: { _id: string }
        Returns: {
          approved_at: string
          contract_length_months: number
          customer_intent_proceeded_at: string
          customer_notes: string
          customer_type: string
          delivery_gross: number
          estimated_download_speed: number
          estimated_upload_speed: number
          expires_at: string
          id: string
          installation_gross: number
          monthly_gross: number
          monthly_net: number
          monthly_vat_amount: number
          notice_period: string
          plan_name: string
          plan_type: string
          price_rise_policy: string
          quote_number: string
          quote_request_reference: string
          router_gross: number
          selected_addons: Json
          service_type: string
          setup_gross: number
          speed_notes: string
          status: string
          total_due_today_gross: number
        }[]
      }
      get_customer_quote_requests: {
        Args: never
        Returns: {
          created_at: string
          customer_facing_message: string
          customer_type: string
          final_quote_id: string
          id: string
          message: string
          plan_preference: string
          postcode: string
          reference: string
          service_interest: string
          source: string
          status: string
        }[]
      }
      get_customer_quotes: {
        Args: never
        Returns: {
          approved_at: string
          contract_length_months: number
          created_at: string
          customer_intent_proceeded_at: string
          customer_notes: string
          customer_type: string
          delivery_gross: number
          expires_at: string
          id: string
          installation_gross: number
          monthly_gross: number
          monthly_net: number
          notice_period: string
          plan_name: string
          plan_type: string
          quote_number: string
          quote_request_reference: string
          router_gross: number
          service_type: string
          setup_gross: number
          status: string
          total_due_today_gross: number
        }[]
      }
      get_customer_referral_codes: {
        Args: never
        Returns: {
          code: string
          created_at: string
          expires_at: string
          id: string
          status: string
          usage_count: number
        }[]
      }
      get_customer_reward_account: {
        Args: never
        Returns: {
          bill_credit_balance: number
          points_balance: number
          status: string
          updated_at: string
        }[]
      }
      get_customer_rewards: {
        Args: never
        Returns: {
          created_at: string
          id: string
          reward_currency: string
          reward_type: string
          reward_value: number
          status: string
          unlock_rule: string
        }[]
      }
      get_customer_ticket_messages: {
        Args: { _ticket_id: string }
        Returns: {
          created_at: string
          id: string
          is_staff_reply: boolean
          message: string
          sender_role: string
        }[]
      }
      get_customer_tickets: {
        Args: never
        Returns: {
          category: string
          closed_at: string
          created_at: string
          first_response_due_at: string
          id: string
          priority: string
          resolution_due_at: string
          status: string
          subject: string
          updated_at: string
        }[]
      }
      get_order_journey_by_token: {
        Args: { _token_hash: string }
        Returns: {
          billing_anchor_day: number
          completed_at: string
          contract_accepted_at: string
          contract_summary_id: string
          cooling_off_ends_at: string
          current_step: string
          id: string
          payment_method: string
          preferred_start_date: string
          quote_id: string
          status: string
        }[]
      }
      get_platform_settings: {
        Args: never
        Returns: {
          api_mode: string
          business_vat_display: string
          created_at: string
          credit_note_prefix: string
          fair_pricing: Json
          id: string
          invoice_issue_notice_days: number
          invoice_prefix: string
          legacy_onboarding_emails_suppressed: boolean
          manual_mode_message: string
          residential_vat_display: string
          rewards_custom_rule: Json
          rewards_enabled: boolean
          rewards_unlock_rule: string
          sim_checkout_mode: string
          singleton: boolean
          start_date_max_days: number
          unified_journey_enabled: boolean
          updated_at: string
          updated_by: string | null
          vat_default_rate: number
          vat_effective_date: string | null
          vat_number: string | null
          vat_scheme: string
        }
        SetofOptions: {
          from: "*"
          to: "platform_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_public_contract_benefits: {
        Args: never
        Returns: {
          benefit_name: string
          benefit_type: string
          customer_type: string
          description: string
          ends_at: string
          id: string
          plan_type: string
          starts_at: string
          terms_text: string
          value_label: string
        }[]
      }
      get_public_kb_articles: {
        Args: never
        Returns: {
          category_id: string
          content: string
          id: string
          slug: string
          title: string
          updated_at: string
        }[]
      }
      has_accepted_contract_summary: {
        Args: { _quote_id: string }
        Returns: boolean
      }
      has_billing_access: { Args: never; Returns: boolean }
      has_compliance_access: { Args: { _user_id: string }; Returns: boolean }
      has_finance_access: { Args: { _user_id: string }; Returns: boolean }
      has_marketing_access: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      is_vat_active: { Args: never; Returns: boolean }
      link_quote_requests_to_user: {
        Args: { _user_id: string }
        Returns: number
      }
      log_audit_action: {
        Args: {
          _action: string
          _entity: string
          _entity_id?: string
          _metadata?: Json
        }
        Returns: string
      }
      log_event: {
        Args: {
          _actor_type: string
          _complaint_id?: string
          _contract_summary_id?: string
          _customer_id?: string
          _details?: Json
          _event_type: string
          _invoice_id?: string
          _ip?: string
          _new_value?: Json
          _old_value?: Json
          _order_id?: string
          _quote_id?: string
          _severity?: string
          _source_module?: string
          _ticket_id?: string
          _title: string
          _ua?: string
        }
        Returns: string
      }
      lookup_guest_order: {
        Args: { _email: string; _order_number: string }
        Returns: {
          address_line1: string
          city: string
          created_at: string
          email: string
          full_name: string
          id: string
          order_number: string
          plan_name: string
          plan_price: number
          postcode: string
          service_type: string
          status: string
        }[]
      }
      next_anchor_billing_date: {
        Args: { _anchor_day: number; _from: string }
        Returns: string
      }
      quote_below_retail_floor: {
        Args: { _quote_id: string }
        Returns: boolean
      }
      recompute_reward_balances: {
        Args: { _customer_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "user"
        | "super_admin"
        | "finance_admin"
        | "support_agent"
        | "sales_agent"
        | "compliance_admin"
        | "marketing_admin"
        | "auditor"
      benefit_customer_type: "residential" | "business" | "both"
      benefit_plan_type: "flex" | "contract_saver" | "both"
      campaign_approval_status:
        | "draft"
        | "margin_check"
        | "compliance_check"
        | "admin_approval"
        | "approved"
        | "published"
        | "paused"
        | "rejected"
      campaign_compliance_status:
        | "not_checked"
        | "passed"
        | "failed"
        | "needs_review"
      campaign_draft_type:
        | "homepage_banner"
        | "landing_page"
        | "referral_offer"
        | "contract_saver_offer"
        | "b2b_offer"
        | "email"
        | "sms"
        | "seo_draft"
        | "ads_copy"
        | "winback"
        | "failed_payment_recovery"
      campaign_margin_status: "not_checked" | "green" | "amber" | "red"
      complaint_priority: "normal" | "high" | "urgent"
      complaint_status:
        | "open"
        | "investigating"
        | "waiting_customer"
        | "resolved"
        | "deadlock_issued"
        | "referred_to_adr"
        | "closed"
      contract_benefit_type:
        | "streaming_reward"
        | "bill_credit"
        | "extra_points"
        | "setup_discount"
        | "router_delivery"
        | "digital_voice_setup"
        | "bundle_discount"
        | "custom"
      contract_summary_status_kind:
        | "draft"
        | "issued"
        | "viewed"
        | "accepted"
        | "superseded"
        | "expired"
      customer_type_kind: "residential" | "business"
      fraud_flag_severity: "low" | "medium" | "high"
      fraud_flag_status: "open" | "reviewed" | "dismissed" | "confirmed"
      fraud_flag_type:
        | "self_referral"
        | "duplicate_email"
        | "duplicate_phone"
        | "duplicate_address"
        | "duplicate_payment"
        | "suspicious_pattern"
        | "failed_payment"
        | "cancellation_before_unlock"
        | "manual_review"
      kb_status: "draft" | "approved" | "archived"
      kb_visibility: "public" | "internal" | "support_only"
      manual_fulfilment_status:
        | "ready_for_manual_order"
        | "order_entered_in_supplier_portal"
        | "supplier_acknowledged"
        | "installation_pending"
        | "active"
        | "cancelled"
      margin_status_kind: "unknown" | "green" | "amber" | "red"
      order_status: "pending" | "confirmed" | "active" | "cancelled"
      plan_preference_kind: "flex" | "contract_saver" | "not_sure"
      plan_type_kind: "flex" | "contract_saver"
      points_ledger_source:
        | "bill_payment"
        | "referral"
        | "contract_bonus"
        | "admin_adjustment"
        | "reversal"
        | "expiry"
        | "campaign"
      points_ledger_status:
        | "pending"
        | "approved"
        | "used"
        | "reversed"
        | "expired"
      quote_margin_check_status: "unknown" | "green" | "amber" | "red"
      quote_request_status:
        | "new"
        | "assigned"
        | "checking"
        | "quoted"
        | "expired"
        | "rejected"
        | "converted"
        | "in_review"
        | "needs_info"
        | "draft_quote_created"
        | "final_quote_ready"
        | "closed"
        | "contract_summary_generated"
        | "contract_summary_accepted"
      quote_status_kind:
        | "draft"
        | "sent"
        | "viewed"
        | "accepted"
        | "rejected"
        | "expired"
        | "converted"
        | "approved"
        | "contract_summary_generated"
        | "contract_summary_accepted"
      referral_code_status: "active" | "paused" | "expired" | "blocked"
      referral_event_type:
        | "clicked"
        | "quote_started"
        | "quote_submitted"
        | "quote_sent"
        | "contract_accepted"
        | "payment_cleared"
        | "service_activated"
        | "reward_eligible"
        | "reward_approved"
        | "reward_reversed"
      reward_account_status: "active" | "suspended" | "closed"
      reward_status:
        | "pending"
        | "eligible"
        | "approved"
        | "issued"
        | "used"
        | "reversed"
        | "expired"
        | "blocked"
      reward_type:
        | "bill_credit"
        | "points"
        | "streaming_gift"
        | "gift_card"
        | "contract_benefit"
        | "partner_commission"
      reward_unlock_rule:
        | "first_cleared_payment"
        | "second_cleared_payment"
        | "custom_rule"
      service_interest_kind:
        | "broadband"
        | "sim"
        | "digital_voice"
        | "business"
        | "switching"
        | "bundle"
        | "other"
      service_type: "broadband" | "sim" | "landline"
      supplier_api_mode: "manual" | "live" | "testing"
      ticket_priority: "low" | "medium" | "high" | "urgent" | "normal"
      ticket_status:
        | "open"
        | "in_progress"
        | "resolved"
        | "closed"
        | "waiting_customer"
        | "waiting_occta"
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
    Enums: {
      app_role: [
        "admin",
        "user",
        "super_admin",
        "finance_admin",
        "support_agent",
        "sales_agent",
        "compliance_admin",
        "marketing_admin",
        "auditor",
      ],
      benefit_customer_type: ["residential", "business", "both"],
      benefit_plan_type: ["flex", "contract_saver", "both"],
      campaign_approval_status: [
        "draft",
        "margin_check",
        "compliance_check",
        "admin_approval",
        "approved",
        "published",
        "paused",
        "rejected",
      ],
      campaign_compliance_status: [
        "not_checked",
        "passed",
        "failed",
        "needs_review",
      ],
      campaign_draft_type: [
        "homepage_banner",
        "landing_page",
        "referral_offer",
        "contract_saver_offer",
        "b2b_offer",
        "email",
        "sms",
        "seo_draft",
        "ads_copy",
        "winback",
        "failed_payment_recovery",
      ],
      campaign_margin_status: ["not_checked", "green", "amber", "red"],
      complaint_priority: ["normal", "high", "urgent"],
      complaint_status: [
        "open",
        "investigating",
        "waiting_customer",
        "resolved",
        "deadlock_issued",
        "referred_to_adr",
        "closed",
      ],
      contract_benefit_type: [
        "streaming_reward",
        "bill_credit",
        "extra_points",
        "setup_discount",
        "router_delivery",
        "digital_voice_setup",
        "bundle_discount",
        "custom",
      ],
      contract_summary_status_kind: [
        "draft",
        "issued",
        "viewed",
        "accepted",
        "superseded",
        "expired",
      ],
      customer_type_kind: ["residential", "business"],
      fraud_flag_severity: ["low", "medium", "high"],
      fraud_flag_status: ["open", "reviewed", "dismissed", "confirmed"],
      fraud_flag_type: [
        "self_referral",
        "duplicate_email",
        "duplicate_phone",
        "duplicate_address",
        "duplicate_payment",
        "suspicious_pattern",
        "failed_payment",
        "cancellation_before_unlock",
        "manual_review",
      ],
      kb_status: ["draft", "approved", "archived"],
      kb_visibility: ["public", "internal", "support_only"],
      manual_fulfilment_status: [
        "ready_for_manual_order",
        "order_entered_in_supplier_portal",
        "supplier_acknowledged",
        "installation_pending",
        "active",
        "cancelled",
      ],
      margin_status_kind: ["unknown", "green", "amber", "red"],
      order_status: ["pending", "confirmed", "active", "cancelled"],
      plan_preference_kind: ["flex", "contract_saver", "not_sure"],
      plan_type_kind: ["flex", "contract_saver"],
      points_ledger_source: [
        "bill_payment",
        "referral",
        "contract_bonus",
        "admin_adjustment",
        "reversal",
        "expiry",
        "campaign",
      ],
      points_ledger_status: [
        "pending",
        "approved",
        "used",
        "reversed",
        "expired",
      ],
      quote_margin_check_status: ["unknown", "green", "amber", "red"],
      quote_request_status: [
        "new",
        "assigned",
        "checking",
        "quoted",
        "expired",
        "rejected",
        "converted",
        "in_review",
        "needs_info",
        "draft_quote_created",
        "final_quote_ready",
        "closed",
        "contract_summary_generated",
        "contract_summary_accepted",
      ],
      quote_status_kind: [
        "draft",
        "sent",
        "viewed",
        "accepted",
        "rejected",
        "expired",
        "converted",
        "approved",
        "contract_summary_generated",
        "contract_summary_accepted",
      ],
      referral_code_status: ["active", "paused", "expired", "blocked"],
      referral_event_type: [
        "clicked",
        "quote_started",
        "quote_submitted",
        "quote_sent",
        "contract_accepted",
        "payment_cleared",
        "service_activated",
        "reward_eligible",
        "reward_approved",
        "reward_reversed",
      ],
      reward_account_status: ["active", "suspended", "closed"],
      reward_status: [
        "pending",
        "eligible",
        "approved",
        "issued",
        "used",
        "reversed",
        "expired",
        "blocked",
      ],
      reward_type: [
        "bill_credit",
        "points",
        "streaming_gift",
        "gift_card",
        "contract_benefit",
        "partner_commission",
      ],
      reward_unlock_rule: [
        "first_cleared_payment",
        "second_cleared_payment",
        "custom_rule",
      ],
      service_interest_kind: [
        "broadband",
        "sim",
        "digital_voice",
        "business",
        "switching",
        "bundle",
        "other",
      ],
      service_type: ["broadband", "sim", "landline"],
      supplier_api_mode: ["manual", "live", "testing"],
      ticket_priority: ["low", "medium", "high", "urgent", "normal"],
      ticket_status: [
        "open",
        "in_progress",
        "resolved",
        "closed",
        "waiting_customer",
        "waiting_occta",
      ],
    },
  },
} as const
