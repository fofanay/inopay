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
      admin_activity_logs: {
        Row: {
          action_type: string
          created_at: string
          deployment_id: string | null
          description: string | null
          id: string
          metadata: Json | null
          server_id: string | null
          status: string
          title: string
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          deployment_id?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          server_id?: string | null
          status?: string
          title: string
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          deployment_id?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          server_id?: string | null
          status?: string
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_activity_logs_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "server_deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_activity_logs_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "user_servers"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_config: {
        Row: {
          config_key: string
          config_value: Json
          created_at: string | null
          id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          config_key: string
          config_value?: Json
          created_at?: string | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          config_key?: string
          config_value?: Json
          created_at?: string | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      banned_users: {
        Row: {
          banned_at: string
          banned_by: string | null
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          banned_at?: string
          banned_by?: string | null
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          banned_at?: string
          banned_by?: string | null
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      cleaning_cache: {
        Row: {
          api_cost_cents: number | null
          cleaned_at: string
          cleaned_content: string | null
          created_at: string
          file_hash: string
          file_path: string
          id: string
          project_id: string | null
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          api_cost_cents?: number | null
          cleaned_at?: string
          cleaned_content?: string | null
          created_at?: string
          file_hash: string
          file_path: string
          id?: string
          project_id?: string | null
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          api_cost_cents?: number | null
          cleaned_at?: string
          cleaned_content?: string | null
          created_at?: string
          file_hash?: string
          file_path?: string
          id?: string
          project_id?: string | null
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaning_cache_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_analysis"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaning_estimates: {
        Row: {
          actual_cost_cents: number | null
          actual_tokens_used: number | null
          admin_approved: boolean | null
          admin_approved_at: string | null
          admin_approved_by: string | null
          created_at: string
          estimated_cost_cents: number
          estimated_tokens: number
          excluded_paths: string[] | null
          id: string
          margin_cents: number | null
          margin_percentage: number | null
          project_id: string | null
          project_name: string
          requires_admin_approval: boolean | null
          sale_price_cents: number | null
          status: string | null
          total_files: number
          total_lines: number
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_cost_cents?: number | null
          actual_tokens_used?: number | null
          admin_approved?: boolean | null
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          created_at?: string
          estimated_cost_cents?: number
          estimated_tokens?: number
          excluded_paths?: string[] | null
          id?: string
          margin_cents?: number | null
          margin_percentage?: number | null
          project_id?: string | null
          project_name: string
          requires_admin_approval?: boolean | null
          sale_price_cents?: number | null
          status?: string | null
          total_files?: number
          total_lines?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_cost_cents?: number | null
          actual_tokens_used?: number | null
          admin_approved?: boolean | null
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          created_at?: string
          estimated_cost_cents?: number
          estimated_tokens?: number
          excluded_paths?: string[] | null
          id?: string
          margin_cents?: number | null
          margin_percentage?: number | null
          project_id?: string | null
          project_name?: string
          requires_admin_approval?: boolean | null
          sale_price_cents?: number | null
          status?: string | null
          total_files?: number
          total_lines?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaning_estimates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_analysis"
            referencedColumns: ["id"]
          },
        ]
      }
      deployment_history: {
        Row: {
          cleaned_dependencies: string[] | null
          coolify_url: string | null
          cost_analysis: Json | null
          created_at: string
          deployed_url: string | null
          deployment_type: string
          files_uploaded: number | null
          host: string | null
          hosting_type: string | null
          id: string
          liberation_report_generated: boolean | null
          portability_score_after: number | null
          portability_score_before: number | null
          project_name: string
          provider: string
          server_ip: string | null
          services_replaced: Json | null
          status: string
          user_id: string
        }
        Insert: {
          cleaned_dependencies?: string[] | null
          coolify_url?: string | null
          cost_analysis?: Json | null
          created_at?: string
          deployed_url?: string | null
          deployment_type?: string
          files_uploaded?: number | null
          host?: string | null
          hosting_type?: string | null
          id?: string
          liberation_report_generated?: boolean | null
          portability_score_after?: number | null
          portability_score_before?: number | null
          project_name: string
          provider: string
          server_ip?: string | null
          services_replaced?: Json | null
          status?: string
          user_id: string
        }
        Update: {
          cleaned_dependencies?: string[] | null
          coolify_url?: string | null
          cost_analysis?: Json | null
          created_at?: string
          deployed_url?: string | null
          deployment_type?: string
          files_uploaded?: number | null
          host?: string | null
          hosting_type?: string | null
          id?: string
          liberation_report_generated?: boolean | null
          portability_score_after?: number | null
          portability_score_before?: number | null
          project_name?: string
          provider?: string
          server_ip?: string | null
          services_replaced?: Json | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      email_campaigns: {
        Row: {
          clicked_count: number | null
          created_at: string | null
          description: string | null
          id: string
          last_run: string | null
          list_id: string | null
          name: string | null
          opened_count: number | null
          scheduled_at: string | null
          sent_count: number | null
          status: string | null
          template_id: string | null
          trigger_days: number | null
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          clicked_count?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          last_run?: string | null
          list_id?: string | null
          name?: string | null
          opened_count?: number | null
          scheduled_at?: string | null
          sent_count?: number | null
          status?: string | null
          template_id?: string | null
          trigger_days?: number | null
          trigger_type: string
          updated_at?: string | null
        }
        Update: {
          clicked_count?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          last_run?: string | null
          list_id?: string | null
          name?: string | null
          opened_count?: number | null
          scheduled_at?: string | null
          sent_count?: number | null
          status?: string | null
          template_id?: string | null
          trigger_days?: number | null
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "email_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_contacts: {
        Row: {
          created_at: string
          custom_fields: Json | null
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          source: string | null
          status: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_fields?: Json | null
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          source?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_fields?: Json | null
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          source?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      email_list_contacts: {
        Row: {
          contact_id: string
          id: string
          list_id: string
          subscribed_at: string
        }
        Insert: {
          contact_id: string
          id?: string
          list_id: string
          subscribed_at?: string
        }
        Update: {
          contact_id?: string
          id?: string
          list_id?: string
          subscribed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_list_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "email_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_list_contacts_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "email_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      email_lists: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          campaign_id: string | null
          clicked_at: string | null
          id: string
          opened_at: string | null
          sent_at: string | null
          status: string | null
          subject: string
          template_id: string | null
          user_email: string
          user_id: string
        }
        Insert: {
          campaign_id?: string | null
          clicked_at?: string | null
          id?: string
          opened_at?: string | null
          sent_at?: string | null
          status?: string | null
          subject: string
          template_id?: string | null
          user_email: string
          user_id: string
        }
        Update: {
          campaign_id?: string | null
          clicked_at?: string | null
          id?: string
          opened_at?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string
          template_id?: string | null
          user_email?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sends: {
        Row: {
          campaign_id: string | null
          clicked_at: string | null
          contact_id: string | null
          created_at: string
          error_message: string | null
          id: string
          metadata: Json | null
          opened_at: string | null
          recipient_email: string
          recipient_name: string | null
          sent_at: string | null
          status: string
          subject: string
          template_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          clicked_at?: string | null
          contact_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          opened_at?: string | null
          recipient_email: string
          recipient_name?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          template_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          clicked_at?: string | null
          contact_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          opened_at?: string | null
          recipient_email?: string
          recipient_name?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "email_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          category: string | null
          created_at: string | null
          html_content: string
          id: string
          is_active: boolean | null
          name: string
          subject: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          html_content: string
          id?: string
          is_active?: boolean | null
          name: string
          subject: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          html_content?: string
          id?: string
          is_active?: boolean | null
          name?: string
          subject?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      health_check_logs: {
        Row: {
          checked_at: string
          deployment_id: string | null
          error_message: string | null
          http_status: number | null
          id: string
          response_time_ms: number | null
          status: string
        }
        Insert: {
          checked_at?: string
          deployment_id?: string | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          response_time_ms?: number | null
          status: string
        }
        Update: {
          checked_at?: string
          deployment_id?: string | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          response_time_ms?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_check_logs_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "server_deployments"
            referencedColumns: ["id"]
          },
        ]
      }
      liberation_upsell_views: {
        Row: {
          converted: boolean | null
          converted_at: string | null
          created_at: string | null
          files_count: number | null
          id: string
          offer_clicked: string | null
          offers_shown: string[] | null
          project_name: string
          purchase_id: string | null
          user_id: string
        }
        Insert: {
          converted?: boolean | null
          converted_at?: string | null
          created_at?: string | null
          files_count?: number | null
          id?: string
          offer_clicked?: string | null
          offers_shown?: string[] | null
          project_name: string
          purchase_id?: string | null
          user_id: string
        }
        Update: {
          converted?: boolean | null
          converted_at?: string | null
          created_at?: string | null
          files_count?: number | null
          id?: string
          offer_clicked?: string | null
          offers_shown?: string[] | null
          project_name?: string
          purchase_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "liberation_upsell_views_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "user_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          email: string
          id: string
          is_active: boolean | null
          source: string | null
          subscribed_at: string | null
          unsubscribed_at: string | null
        }
        Insert: {
          email: string
          id?: string
          is_active?: boolean | null
          source?: string | null
          subscribed_at?: string | null
          unsubscribed_at?: string | null
        }
        Update: {
          email?: string
          id?: string
          is_active?: boolean | null
          source?: string | null
          subscribed_at?: string | null
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      otp_verifications: {
        Row: {
          attempts: number
          created_at: string
          email: string
          expires_at: string
          id: string
          max_attempts: number
          otp_code: string
          password_hash: string
          verified: boolean
        }
        Insert: {
          attempts?: number
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          max_attempts?: number
          otp_code: string
          password_hash: string
          verified?: boolean
        }
        Update: {
          attempts?: number
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          max_attempts?: number
          otp_code?: string
          password_hash?: string
          verified?: boolean
        }
        Relationships: []
      }
      pending_liberation_payments: {
        Row: {
          base_token_cost_cents: number
          created_at: string
          excess_files: number
          files_data: Json | null
          id: string
          inopay_margin_multiplier: number
          max_files_allowed: number
          paid_at: string | null
          processed_at: string | null
          project_id: string | null
          project_name: string
          selected_paths: string[] | null
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          supplement_amount_cents: number
          total_files: number
          updated_at: string
          user_id: string
        }
        Insert: {
          base_token_cost_cents: number
          created_at?: string
          excess_files: number
          files_data?: Json | null
          id?: string
          inopay_margin_multiplier?: number
          max_files_allowed?: number
          paid_at?: string | null
          processed_at?: string | null
          project_id?: string | null
          project_name: string
          selected_paths?: string[] | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          supplement_amount_cents: number
          total_files: number
          updated_at?: string
          user_id: string
        }
        Update: {
          base_token_cost_cents?: number
          created_at?: string
          excess_files?: number
          files_data?: Json | null
          id?: string
          inopay_margin_multiplier?: number
          max_files_allowed?: number
          paid_at?: string | null
          processed_at?: string | null
          project_id?: string | null
          project_name?: string
          selected_paths?: string[] | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          supplement_amount_cents?: number
          total_files?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          billing_address_line1: string | null
          billing_address_line2: string | null
          billing_city: string | null
          billing_country: string | null
          billing_postal_code: string | null
          company_name: string | null
          created_at: string | null
          first_name: string | null
          id: string
          last_login_at: string | null
          last_login_ip: unknown
          last_name: string | null
          phone: string | null
          phone_verified: boolean | null
          profile_completed: boolean | null
          updated_at: string | null
          vat_number: string | null
        }
        Insert: {
          avatar_url?: string | null
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_postal_code?: string | null
          company_name?: string | null
          created_at?: string | null
          first_name?: string | null
          id: string
          last_login_at?: string | null
          last_login_ip?: unknown
          last_name?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          profile_completed?: boolean | null
          updated_at?: string | null
          vat_number?: string | null
        }
        Update: {
          avatar_url?: string | null
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_postal_code?: string | null
          company_name?: string | null
          created_at?: string | null
          first_name?: string | null
          id?: string
          last_login_at?: string | null
          last_login_ip?: unknown
          last_name?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          profile_completed?: boolean | null
          updated_at?: string | null
          vat_number?: string | null
        }
        Relationships: []
      }
      projects_analysis: {
        Row: {
          created_at: string
          detected_issues: Json | null
          file_name: string | null
          id: string
          portability_score: number | null
          project_name: string
          recommendations: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          detected_issues?: Json | null
          file_name?: string | null
          id?: string
          portability_score?: number | null
          project_name: string
          recommendations?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          detected_issues?: Json | null
          file_name?: string | null
          id?: string
          portability_score?: number | null
          project_name?: string
          recommendations?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      security_audit_logs: {
        Row: {
          action: string
          created_at: string
          deployment_id: string | null
          details: Json | null
          id: string
          server_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          deployment_id?: string | null
          details?: Json | null
          id?: string
          server_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          deployment_id?: string | null
          details?: Json | null
          id?: string
          server_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_audit_logs_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "server_deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_audit_logs_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "user_servers"
            referencedColumns: ["id"]
          },
        ]
      }
      server_deployments: {
        Row: {
          auto_restart_count: number | null
          consecutive_failures: number | null
          coolify_app_uuid: string | null
          created_at: string
          deployed_url: string | null
          domain: string | null
          error_message: string | null
          github_repo_url: string | null
          health_status: string | null
          id: string
          last_health_check: string | null
          last_restart_at: string | null
          last_retry_at: string | null
          project_name: string
          retry_count: number | null
          secrets_cleaned: boolean | null
          secrets_cleaned_at: string | null
          server_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_restart_count?: number | null
          consecutive_failures?: number | null
          coolify_app_uuid?: string | null
          created_at?: string
          deployed_url?: string | null
          domain?: string | null
          error_message?: string | null
          github_repo_url?: string | null
          health_status?: string | null
          id?: string
          last_health_check?: string | null
          last_restart_at?: string | null
          last_retry_at?: string | null
          project_name: string
          retry_count?: number | null
          secrets_cleaned?: boolean | null
          secrets_cleaned_at?: string | null
          server_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_restart_count?: number | null
          consecutive_failures?: number | null
          coolify_app_uuid?: string | null
          created_at?: string
          deployed_url?: string | null
          domain?: string | null
          error_message?: string | null
          github_repo_url?: string | null
          health_status?: string | null
          id?: string
          last_health_check?: string | null
          last_restart_at?: string | null
          last_retry_at?: string | null
          project_name?: string
          retry_count?: number | null
          secrets_cleaned?: boolean | null
          secrets_cleaned_at?: string | null
          server_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_deployments_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "user_servers"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          credits_remaining: number | null
          current_period_end: string | null
          current_period_start: string | null
          free_credits: number | null
          id: string
          plan_type: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_remaining?: number | null
          current_period_end?: string | null
          current_period_start?: string | null
          free_credits?: number | null
          id?: string
          plan_type?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_remaining?: number | null
          current_period_end?: string | null
          current_period_start?: string | null
          free_credits?: number | null
          id?: string
          plan_type?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sync_configurations: {
        Row: {
          allowed_branches: string[] | null
          created_at: string | null
          deployment_id: string
          github_repo_url: string
          github_webhook_secret: string
          id: string
          last_sync_at: string | null
          last_sync_commit: string | null
          last_sync_error: string | null
          last_sync_status: string | null
          sync_count: number | null
          sync_enabled: boolean | null
          time_saved_minutes: number | null
          updated_at: string | null
          user_id: string
          widget_token: string | null
          widget_token_created_at: string | null
          widget_token_last_ip: string | null
          widget_token_revoked: boolean | null
          widget_token_used_at: string | null
          zen_mode: boolean | null
        }
        Insert: {
          allowed_branches?: string[] | null
          created_at?: string | null
          deployment_id: string
          github_repo_url: string
          github_webhook_secret: string
          id?: string
          last_sync_at?: string | null
          last_sync_commit?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          sync_count?: number | null
          sync_enabled?: boolean | null
          time_saved_minutes?: number | null
          updated_at?: string | null
          user_id: string
          widget_token?: string | null
          widget_token_created_at?: string | null
          widget_token_last_ip?: string | null
          widget_token_revoked?: boolean | null
          widget_token_used_at?: string | null
          zen_mode?: boolean | null
        }
        Update: {
          allowed_branches?: string[] | null
          created_at?: string | null
          deployment_id?: string
          github_repo_url?: string
          github_webhook_secret?: string
          id?: string
          last_sync_at?: string | null
          last_sync_commit?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          sync_count?: number | null
          sync_enabled?: boolean | null
          time_saved_minutes?: number | null
          updated_at?: string | null
          user_id?: string
          widget_token?: string | null
          widget_token_created_at?: string | null
          widget_token_last_ip?: string | null
          widget_token_revoked?: boolean | null
          widget_token_used_at?: string | null
          zen_mode?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_configurations_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "server_deployments"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_history: {
        Row: {
          commit_message: string | null
          commit_sha: string
          completed_at: string | null
          duration_ms: number | null
          error_message: string | null
          files_changed: string[] | null
          files_cleaned: string[] | null
          id: string
          started_at: string | null
          status: string | null
          sync_config_id: string
          user_id: string
        }
        Insert: {
          commit_message?: string | null
          commit_sha: string
          completed_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          files_changed?: string[] | null
          files_cleaned?: string[] | null
          id?: string
          started_at?: string | null
          status?: string | null
          sync_config_id: string
          user_id: string
        }
        Update: {
          commit_message?: string | null
          commit_sha?: string
          completed_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          files_changed?: string[] | null
          files_cleaned?: string[] | null
          id?: string
          started_at?: string | null
          status?: string | null
          sync_config_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_history_sync_config_id_fkey"
            columns: ["sync_config_id"]
            isOneToOne: false
            referencedRelation: "sync_configurations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          action_url: string | null
          created_at: string
          id: string
          message: string
          read: boolean
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          id?: string
          message: string
          read?: boolean
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_purchases: {
        Row: {
          amount: number
          created_at: string | null
          currency: string
          deployment_id: string | null
          id: string
          is_subscription: boolean | null
          metadata: Json | null
          server_id: string | null
          service_type: string
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          subscription_ends_at: string | null
          subscription_status: string | null
          updated_at: string | null
          used: boolean | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string
          deployment_id?: string | null
          id?: string
          is_subscription?: boolean | null
          metadata?: Json | null
          server_id?: string | null
          service_type: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          subscription_ends_at?: string | null
          subscription_status?: string | null
          updated_at?: string | null
          used?: boolean | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string
          deployment_id?: string | null
          id?: string
          is_subscription?: boolean | null
          metadata?: Json | null
          server_id?: string | null
          service_type?: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          subscription_ends_at?: string | null
          subscription_status?: string | null
          updated_at?: string | null
          used?: boolean | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_purchases_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "server_deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_purchases_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "user_servers"
            referencedColumns: ["id"]
          },
        ]
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
      user_servers: {
        Row: {
          anon_key: string | null
          coolify_token: string | null
          coolify_url: string | null
          created_at: string
          db_host: string | null
          db_name: string | null
          db_password: string | null
          db_port: number | null
          db_status: string | null
          db_url: string | null
          db_user: string | null
          error_message: string | null
          id: string
          ip_address: string
          jwt_secret: string | null
          name: string
          provider: string | null
          service_role_key: string | null
          setup_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          anon_key?: string | null
          coolify_token?: string | null
          coolify_url?: string | null
          created_at?: string
          db_host?: string | null
          db_name?: string | null
          db_password?: string | null
          db_port?: number | null
          db_status?: string | null
          db_url?: string | null
          db_user?: string | null
          error_message?: string | null
          id?: string
          ip_address: string
          jwt_secret?: string | null
          name: string
          provider?: string | null
          service_role_key?: string | null
          setup_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          anon_key?: string | null
          coolify_token?: string | null
          coolify_url?: string | null
          created_at?: string
          db_host?: string | null
          db_name?: string | null
          db_password?: string | null
          db_port?: number | null
          db_status?: string | null
          db_url?: string | null
          db_user?: string | null
          error_message?: string | null
          id?: string
          ip_address?: string
          jwt_secret?: string | null
          name?: string
          provider?: string | null
          service_role_key?: string | null
          setup_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          api_key: string | null
          api_provider: string
          created_at: string
          default_repo_private: boolean | null
          github_destination_token: string | null
          github_destination_username: string | null
          github_source_token: string | null
          github_token: string | null
          id: string
          language: string | null
          preferred_deploy_platform: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key?: string | null
          api_provider?: string
          created_at?: string
          default_repo_private?: boolean | null
          github_destination_token?: string | null
          github_destination_username?: string | null
          github_source_token?: string | null
          github_token?: string | null
          id?: string
          language?: string | null
          preferred_deploy_platform?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string | null
          api_provider?: string
          created_at?: string
          default_repo_private?: boolean | null
          github_destination_token?: string | null
          github_destination_username?: string | null
          github_source_token?: string | null
          github_token?: string | null
          id?: string
          language?: string | null
          preferred_deploy_platform?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_otps: { Args: never; Returns: undefined }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      trigger_storage_cleanup: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
