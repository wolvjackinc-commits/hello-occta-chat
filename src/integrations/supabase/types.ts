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
          created_at: string
          id: string
          late_fee_grace_days: number | null
          preferred_payment_method: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_pay_enabled?: boolean
          created_at?: string
          id?: string
          late_fee_grace_days?: number | null
          preferred_payment_method?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_pay_enabled?: boolean
          created_at?: string
          id?: string
          late_fee_grace_days?: number | null
          preferred_payment_method?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          vat_total: number
        }
        Insert: {
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
          vat_total?: number
        }
        Update: {
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
      check_rate_limit: {
        Args: {
          _action: string
          _identifier: string
          _max_requests?: number
          _window_minutes?: number
        }
        Returns: boolean
      }
      generate_account_number: { Args: never; Returns: string }
      generate_user_account_number: { Args: never; Returns: string }
      has_billing_access: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      log_audit_action: {
        Args: {
          _action: string
          _entity: string
          _entity_id?: string
          _metadata?: Json
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
      app_role: "admin" | "user"
      order_status: "pending" | "confirmed" | "active" | "cancelled"
      service_type: "broadband" | "sim" | "landline"
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
      app_role: ["admin", "user"],
      order_status: ["pending", "confirmed", "active", "cancelled"],
      service_type: ["broadband", "sim", "landline"],
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: ["open", "in_progress", "resolved", "closed"],
    },
  },
} as const
