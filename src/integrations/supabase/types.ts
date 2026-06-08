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
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_acceptances: {
        Row: {
          acceptance_text: string
          accepted_at: string
          accepted_by_email: string
          accepted_by_name: string
          checkbox_confirmed: boolean
          contract_summary_id: string
          created_at: string
          customer_id: string | null
          id: string
          ip: string | null
          quote_id: string
          user_agent: string | null
        }
        Insert: {
          acceptance_text: string
          accepted_at?: string
          accepted_by_email: string
          accepted_by_name: string
          checkbox_confirmed: boolean
          contract_summary_id: string
          created_at?: string
          customer_id?: string | null
          id?: string
          ip?: string | null
          quote_id: string
          user_agent?: string | null
        }
        Update: {
          acceptance_text?: string
          accepted_at?: string
          accepted_by_email?: string
          accepted_by_name?: string
          checkbox_confirmed?: boolean
          contract_summary_id?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          ip?: string | null
          quote_id?: string
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
            referencedRelation: "profiles"
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
      contract_summaries: {
        Row: {
          accepted_at: string | null
          accepted_ip: string | null
          accepted_user_agent: string | null
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
          pdf_url: string | null
          plan_name: string
          plan_type: Database["public"]["Enums"]["plan_type_kind"]
          price_rise_policy: string
          privacy_version: string
          public_token_hash: string | null
          quote_id: string
          quote_request_id: string
          router_charge: number
          service_address: string
          service_type: Database["public"]["Enums"]["service_interest_kind"]
          setup_charge: number
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
          pdf_url?: string | null
          plan_name: string
          plan_type: Database["public"]["Enums"]["plan_type_kind"]
          price_rise_policy: string
          privacy_version?: string
          public_token_hash?: string | null
          quote_id: string
          quote_request_id: string
          router_charge?: number
          service_address: string
          service_type: Database["public"]["Enums"]["service_interest_kind"]
          setup_charge?: number
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
          pdf_url?: string | null
          plan_name?: string
          plan_type?: Database["public"]["Enums"]["plan_type_kind"]
          price_rise_policy?: string
          privacy_version?: string
          public_token_hash?: string | null
          quote_id?: string
          quote_request_id?: string
          router_charge?: number
          service_address?: string
          service_type?: Database["public"]["Enums"]["service_interest_kind"]
          setup_charge?: number
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
      email_templates: {
        Row: {
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
            referencedRelation: "profiles"
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
      invoice_lines: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          line_total: number
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
          issue_date: string
          late_fee_amount: number | null
          late_fee_applied_at: string | null
          notes: string | null
          order_id: string | null
          overdue_notified_at: string | null
          pdf_url: string | null
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
          issue_date?: string
          late_fee_amount?: number | null
          late_fee_applied_at?: string | null
          notes?: string | null
          order_id?: string | null
          overdue_notified_at?: string | null
          pdf_url?: string | null
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
          issue_date?: string
          late_fee_amount?: number | null
          late_fee_applied_at?: string | null
          notes?: string | null
          order_id?: string | null
          overdue_notified_at?: string | null
          pdf_url?: string | null
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
      orders: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          admin_notes: string | null
          city: string | null
          created_at: string
          id: string
          installation_date: string | null
          notes: string | null
          plan_name: string
          plan_price: number
          postcode: string
          service_type: Database["public"]["Enums"]["service_type"]
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          admin_notes?: string | null
          city?: string | null
          created_at?: string
          id?: string
          installation_date?: string | null
          notes?: string | null
          plan_name: string
          plan_price: number
          postcode: string
          service_type: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          admin_notes?: string | null
          city?: string | null
          created_at?: string
          id?: string
          installation_date?: string | null
          notes?: string | null
          plan_name?: string
          plan_price?: number
          postcode?: string
          service_type?: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          created_at: string
          created_by: string | null
          currency: string
          customer_email: string
          customer_name: string
          due_date: string | null
          expires_at: string | null
          id: string
          invoice_id: string | null
          last_opened_at: string | null
          notes: string | null
          provider: string | null
          provider_reference: string | null
          status: string
          token_hash: string | null
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_number?: string | null
          amount?: number | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_email: string
          customer_name: string
          due_date?: string | null
          expires_at?: string | null
          id?: string
          invoice_id?: string | null
          last_opened_at?: string | null
          notes?: string | null
          provider?: string | null
          provider_reference?: string | null
          status?: string
          token_hash?: string | null
          type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_number?: string | null
          amount?: number | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_email?: string
          customer_name?: string
          due_date?: string | null
          expires_at?: string | null
          id?: string
          invoice_id?: string | null
          last_opened_at?: string | null
          notes?: string | null
          provider?: string | null
          provider_reference?: string | null
          status?: string
          token_hash?: string | null
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
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
          id: string
          invoice_prefix: string
          manual_mode_message: string
          residential_vat_display: string
          rewards_custom_rule: Json
          rewards_enabled: boolean
          rewards_unlock_rule: string
          sim_checkout_mode: string
          singleton: boolean
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
          id?: string
          invoice_prefix?: string
          manual_mode_message?: string
          residential_vat_display?: string
          rewards_custom_rule?: Json
          rewards_enabled?: boolean
          rewards_unlock_rule?: string
          sim_checkout_mode?: string
          singleton?: boolean
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
          id?: string
          invoice_prefix?: string
          manual_mode_message?: string
          residential_vat_display?: string
          rewards_custom_rule?: Json
          rewards_enabled?: boolean
          rewards_unlock_rule?: string
          sim_checkout_mode?: string
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
          vat_default_rate?: number
          vat_effective_date?: string | null
          vat_number?: string | null
          vat_scheme?: string
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
          customer_id: string | null
          customer_type: Database["public"]["Enums"]["customer_type_kind"]
          email: string
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
          customer_id?: string | null
          customer_type?: Database["public"]["Enums"]["customer_type_kind"]
          email: string
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
          customer_id?: string | null
          customer_type?: Database["public"]["Enums"]["customer_type_kind"]
          email?: string
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
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          admin_notes: string | null
          cease_fee_gross: number | null
          contract_length_months: number | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_notes: string | null
          customer_type: Database["public"]["Enums"]["customer_type_kind"]
          delivery_gross: number
          delivery_net: number
          delivery_vat_amount: number
          estimated_download_speed: number | null
          estimated_upload_speed: number | null
          expires_at: string
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
          plan_type: Database["public"]["Enums"]["plan_type_kind"]
          price_rise_policy: string
          public_token_hash: string | null
          quote_number: string
          quote_request_id: string
          reward_eligibility: string | null
          router_gross: number
          router_net: number
          router_vat_amount: number
          service_type: Database["public"]["Enums"]["service_interest_kind"]
          setup_gross: number
          setup_net: number
          setup_vat_amount: number
          speed_notes: string | null
          status: Database["public"]["Enums"]["quote_status_kind"]
          supplier_name: string | null
          supplier_product_id: string | null
          supplier_reference: string | null
          token_expires_at: string | null
          total_due_today_gross: number
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          cease_fee_gross?: number | null
          contract_length_months?: number | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_notes?: string | null
          customer_type: Database["public"]["Enums"]["customer_type_kind"]
          delivery_gross?: number
          delivery_net?: number
          delivery_vat_amount?: number
          estimated_download_speed?: number | null
          estimated_upload_speed?: number | null
          expires_at?: string
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
          plan_type: Database["public"]["Enums"]["plan_type_kind"]
          price_rise_policy?: string
          public_token_hash?: string | null
          quote_number?: string
          quote_request_id: string
          reward_eligibility?: string | null
          router_gross?: number
          router_net?: number
          router_vat_amount?: number
          service_type: Database["public"]["Enums"]["service_interest_kind"]
          setup_gross?: number
          setup_net?: number
          setup_vat_amount?: number
          speed_notes?: string | null
          status?: Database["public"]["Enums"]["quote_status_kind"]
          supplier_name?: string | null
          supplier_product_id?: string | null
          supplier_reference?: string | null
          token_expires_at?: string | null
          total_due_today_gross?: number
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          cease_fee_gross?: number | null
          contract_length_months?: number | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_notes?: string | null
          customer_type?: Database["public"]["Enums"]["customer_type_kind"]
          delivery_gross?: number
          delivery_net?: number
          delivery_vat_amount?: number
          estimated_download_speed?: number | null
          estimated_upload_speed?: number | null
          expires_at?: string
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
          plan_type?: Database["public"]["Enums"]["plan_type_kind"]
          price_rise_policy?: string
          public_token_hash?: string | null
          quote_number?: string
          quote_request_id?: string
          reward_eligibility?: string | null
          router_gross?: number
          router_net?: number
          router_vat_amount?: number
          service_type?: Database["public"]["Enums"]["service_interest_kind"]
          setup_gross?: number
          setup_net?: number
          setup_vat_amount?: number
          speed_notes?: string | null
          status?: Database["public"]["Enums"]["quote_status_kind"]
          supplier_name?: string | null
          supplier_product_id?: string | null
          supplier_reference?: string | null
          token_expires_at?: string | null
          total_due_today_gross?: number
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
      services: {
        Row: {
          activation_date: string | null
          created_at: string
          id: string
          identifiers: Json
          plan_name: string | null
          price_monthly: number
          provisioned_at: string | null
          service_type: string
          status: string
          supplier_ref: string | null
          supplier_reference: string | null
          suspension_reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activation_date?: string | null
          created_at?: string
          id?: string
          identifiers?: Json
          plan_name?: string | null
          price_monthly?: number
          provisioned_at?: string | null
          service_type: string
          status?: string
          supplier_ref?: string | null
          supplier_reference?: string | null
          suspension_reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activation_date?: string | null
          created_at?: string
          id?: string
          identifiers?: Json
          plan_name?: string | null
          price_monthly?: number
          provisioned_at?: string | null
          service_type?: string
          status?: string
          supplier_ref?: string | null
          supplier_reference?: string | null
          suspension_reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          created_at: string
          download_speed_label: string | null
          id: string
          notes: string | null
          product_name: string
          reverse_charge: boolean
          service_type: string
          supplier_cease_fee_net: number | null
          supplier_delivery_net: number | null
          supplier_id: string
          supplier_install_net: number | null
          supplier_monthly_net: number | null
          supplier_product_id: string | null
          supplier_router_net: number | null
          supplier_setup_net: number | null
          supplier_vat_rate: number
          technology: string | null
          updated_at: string
          upload_speed_label: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          download_speed_label?: string | null
          id?: string
          notes?: string | null
          product_name: string
          reverse_charge?: boolean
          service_type: string
          supplier_cease_fee_net?: number | null
          supplier_delivery_net?: number | null
          supplier_id: string
          supplier_install_net?: number | null
          supplier_monthly_net?: number | null
          supplier_product_id?: string | null
          supplier_router_net?: number | null
          supplier_setup_net?: number | null
          supplier_vat_rate?: number
          technology?: string | null
          updated_at?: string
          upload_speed_label?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          download_speed_label?: string | null
          id?: string
          notes?: string | null
          product_name?: string
          reverse_charge?: boolean
          service_type?: string
          supplier_cease_fee_net?: number | null
          supplier_delivery_net?: number | null
          supplier_id?: string
          supplier_install_net?: number | null
          supplier_monthly_net?: number | null
          supplier_product_id?: string | null
          supplier_router_net?: number | null
          supplier_setup_net?: number | null
          supplier_vat_rate?: number
          technology?: string | null
          updated_at?: string
          upload_speed_label?: string | null
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
          created_at: string
          description: string
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string
          description: string
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          updated_at?: string
          user_id?: string
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
    }
    Functions: {
      anonymize_old_account_deletions: { Args: never; Returns: number }
      calculate_next_invoice_date: {
        Args: {
          p_billing_day: number
          p_billing_mode: string
          p_current_date?: string
        }
        Returns: string
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
      expire_old_quotes: { Args: never; Returns: number }
      generate_account_number: { Args: never; Returns: string }
      generate_invoice_number: { Args: never; Returns: string }
      generate_user_account_number: { Args: never; Returns: string }
      get_platform_settings: {
        Args: never
        Returns: {
          api_mode: string
          business_vat_display: string
          created_at: string
          credit_note_prefix: string
          id: string
          invoice_prefix: string
          manual_mode_message: string
          residential_vat_display: string
          rewards_custom_rule: Json
          rewards_enabled: boolean
          rewards_unlock_rule: string
          sim_checkout_mode: string
          singleton: boolean
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
      contract_summary_status_kind:
        | "draft"
        | "issued"
        | "viewed"
        | "accepted"
        | "superseded"
        | "expired"
      customer_type_kind: "residential" | "business"
      margin_status_kind: "unknown" | "green" | "amber" | "red"
      order_status: "pending" | "confirmed" | "active" | "cancelled"
      plan_preference_kind: "flex" | "contract_saver" | "not_sure"
      plan_type_kind: "flex" | "contract_saver"
      quote_margin_check_status: "unknown" | "green" | "amber" | "red"
      quote_request_status:
        | "new"
        | "assigned"
        | "checking"
        | "quoted"
        | "expired"
        | "rejected"
        | "converted"
      quote_status_kind:
        | "draft"
        | "sent"
        | "viewed"
        | "accepted"
        | "rejected"
        | "expired"
        | "converted"
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
      ticket_priority: "low" | "medium" | "high" | "urgent"
      ticket_status: "open" | "in_progress" | "resolved" | "closed"
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
      contract_summary_status_kind: [
        "draft",
        "issued",
        "viewed",
        "accepted",
        "superseded",
        "expired",
      ],
      customer_type_kind: ["residential", "business"],
      margin_status_kind: ["unknown", "green", "amber", "red"],
      order_status: ["pending", "confirmed", "active", "cancelled"],
      plan_preference_kind: ["flex", "contract_saver", "not_sure"],
      plan_type_kind: ["flex", "contract_saver"],
      quote_margin_check_status: ["unknown", "green", "amber", "red"],
      quote_request_status: [
        "new",
        "assigned",
        "checking",
        "quoted",
        "expired",
        "rejected",
        "converted",
      ],
      quote_status_kind: [
        "draft",
        "sent",
        "viewed",
        "accepted",
        "rejected",
        "expired",
        "converted",
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
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: ["open", "in_progress", "resolved", "closed"],
    },
  },
} as const
