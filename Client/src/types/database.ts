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
      bot_edit_history: {
        Row: {
          created_at: string
          edit_request: string
          id: string
          proposed_changes: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          edit_request: string
          id?: string
          proposed_changes?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          edit_request?: string
          id?: string
          proposed_changes?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_edit_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_conversations: {
        Row: {
          bot_response: string
          conversation_id: string
          created_at: string
          id: string
          user_id: string
          user_message: string
        }
        Insert: {
          bot_response: string
          conversation_id: string
          created_at?: string
          id?: string
          user_id: string
          user_message: string
        }
        Update: {
          bot_response?: string
          conversation_id?: string
          created_at?: string
          id?: string
          user_id?: string
          user_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      faq_entries: {
        Row: {
          answer: string
          created_at: string | null
          id: string
          is_active: boolean | null
          question: string
          sort_order: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          answer: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          question: string
          sort_order?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          answer?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          question?: string
          sort_order?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "faq_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_delayed_jobs: {
        Row: {
          created_at: string
          execute_at: string
          id: string
          node_id: string
          session_id: string
          status: string
        }
        Insert: {
          created_at?: string
          execute_at: string
          id?: string
          node_id: string
          session_id: string
          status?: string
        }
        Update: {
          created_at?: string
          execute_at?: string
          id?: string
          node_id?: string
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_delayed_jobs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "subscriber_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_message_log: {
        Row: {
          content: string | null
          created_at: string
          direction: string
          id: string
          message_type: string
          node_id: string | null
          session_id: string
          status: string
          workflow_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          direction: string
          id?: string
          message_type?: string
          node_id?: string | null
          session_id: string
          status?: string
          workflow_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          direction?: string
          id?: string
          message_type?: string
          node_id?: string | null
          session_id?: string
          status?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_message_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "subscriber_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_message_log_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_processed_messages: {
        Row: {
          created_at: string | null
          id_message: string
        }
        Insert: {
          created_at?: string | null
          id_message: string
        }
        Update: {
          created_at?: string | null
          id_message?: string
        }
        Relationships: []
      }
      form_fields: {
        Row: {
          allow_other: boolean | null
          created_at: string
          description: string | null
          field_type: string
          id: string
          is_required: boolean
          label: string
          options: Json | null
          placeholder: string | null
          sort_order: number
        }
        Insert: {
          allow_other?: boolean | null
          created_at?: string
          description?: string | null
          field_type: string
          id?: string
          is_required?: boolean
          label: string
          options?: Json | null
          placeholder?: string | null
          sort_order?: number
        }
        Update: {
          allow_other?: boolean | null
          created_at?: string
          description?: string | null
          field_type?: string
          id?: string
          is_required?: boolean
          label?: string
          options?: Json | null
          placeholder?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      form_responses: {
        Row: {
          additional_info: string | null
          bot_prompt: string | null
          business_description: string
          business_name: string
          created_at: string
          has_products: boolean | null
          id: string
          scraped_content: string | null
          target_audience: string | null
          tone: string | null
          updated_at: string
          user_id: string
          website_url: string | null
          workflow_id: string | null
        }
        Insert: {
          additional_info?: string | null
          bot_prompt?: string | null
          business_description: string
          business_name: string
          created_at?: string
          has_products?: boolean | null
          id?: string
          scraped_content?: string | null
          target_audience?: string | null
          tone?: string | null
          updated_at?: string
          user_id: string
          website_url?: string | null
          workflow_id?: string | null
        }
        Update: {
          additional_info?: string | null
          bot_prompt?: string | null
          business_description?: string
          business_name?: string
          created_at?: string
          has_products?: boolean | null
          id?: string
          scraped_content?: string | null
          target_audience?: string | null
          tone?: string | null
          updated_at?: string
          user_id?: string
          website_url?: string | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      form_settings: {
        Row: {
          closing_text: string | null
          closing_title: string | null
          id: string
          opening_text: string | null
          opening_title: string | null
          updated_at: string | null
        }
        Insert: {
          closing_text?: string | null
          closing_title?: string | null
          id?: string
          opening_text?: string | null
          opening_title?: string | null
          updated_at?: string | null
        }
        Update: {
          closing_text?: string | null
          closing_title?: string | null
          id?: string
          opening_text?: string | null
          opening_title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      integrations: {
        Row: {
          config: Json | null
          created_at: string
          id: string
          integration_type: string
          status: string
          user_id: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          id?: string
          integration_type: string
          status?: string
          user_id: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          id?: string
          integration_type?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      node_analytics: {
        Row: {
          clicked: number
          delivered: number
          id: string
          node_id: string
          sent: number
          workflow_id: string
        }
        Insert: {
          clicked?: number
          delivered?: number
          id?: string
          node_id: string
          sent?: number
          workflow_id: string
        }
        Update: {
          clicked?: number
          delivered?: number
          id?: string
          node_id?: string
          sent?: number
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "node_analytics_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          attributes: Json | null
          category: string | null
          created_at: string
          currency: string | null
          description: string | null
          id: string
          image_urls: Json | null
          name: string
          price: string | null
          product_url: string | null
          scrape_job_id: string
          source_url: string | null
          user_id: string
        }
        Insert: {
          attributes?: Json | null
          category?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          image_urls?: Json | null
          name: string
          price?: string | null
          product_url?: string | null
          scrape_job_id: string
          source_url?: string | null
          user_id: string
        }
        Update: {
          attributes?: Json | null
          category?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          image_urls?: Json | null
          name?: string
          price?: string | null
          product_url?: string | null
          scrape_job_id?: string
          source_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_scrape_job_id_fkey"
            columns: ["scrape_job_id"]
            isOneToOne: false
            referencedRelation: "scrape_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_flow_id: string | null
          bot_status: string
          created_at: string
          credits_balance: number
          email: string
          full_name: string
          greenapi_instance_id: string | null
          greenapi_token: string | null
          id: string
          language: string
          phone: string | null
          plan_tier: Database["public"]["Enums"]["subscription_tier"] | null
          role: string
          status: string
          subscription_end_date: string | null
          subscription_start_date: string | null
          updated_at: string
          website_url: string | null
          workflow_id: string | null
        }
        Insert: {
          active_flow_id?: string | null
          bot_status?: string
          created_at?: string
          credits_balance?: number
          email: string
          full_name: string
          greenapi_instance_id?: string | null
          greenapi_token?: string | null
          id: string
          language?: string
          phone?: string | null
          plan_tier?: Database["public"]["Enums"]["subscription_tier"] | null
          role?: string
          status?: string
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          updated_at?: string
          website_url?: string | null
          workflow_id?: string | null
        }
        Update: {
          active_flow_id?: string | null
          bot_status?: string
          created_at?: string
          credits_balance?: number
          email?: string
          full_name?: string
          greenapi_instance_id?: string | null
          greenapi_token?: string | null
          id?: string
          language?: string
          phone?: string | null
          plan_tier?: Database["public"]["Enums"]["subscription_tier"] | null
          role?: string
          status?: string
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          updated_at?: string
          website_url?: string | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_flow_id_fkey"
            columns: ["active_flow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      scrape_jobs: {
        Row: {
          base_url: string
          created_at: string
          id: string
          scraped_pages: number | null
          status: string
          total_pages: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          base_url: string
          created_at?: string
          id?: string
          scraped_pages?: number | null
          status?: string
          total_pages?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          base_url?: string
          created_at?: string
          id?: string
          scraped_pages?: number | null
          status?: string
          total_pages?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scrape_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scraped_data: {
        Row: {
          content: string | null
          id: string
          scraped_at: string
          url: string
          user_id: string
        }
        Insert: {
          content?: string | null
          id?: string
          scraped_at?: string
          url: string
          user_id: string
        }
        Update: {
          content?: string | null
          id?: string
          scraped_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scraped_data_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scraped_pages: {
        Row: {
          created_at: string
          depth: number | null
          id: string
          images: Json | null
          meta_description: string | null
          page_title: string | null
          scrape_job_id: string
          text_content: string | null
          url: string
          user_id: string
          videos: Json | null
        }
        Insert: {
          created_at?: string
          depth?: number | null
          id?: string
          images?: Json | null
          meta_description?: string | null
          page_title?: string | null
          scrape_job_id: string
          text_content?: string | null
          url: string
          user_id: string
          videos?: Json | null
        }
        Update: {
          created_at?: string
          depth?: number | null
          id?: string
          images?: Json | null
          meta_description?: string | null
          page_title?: string | null
          scrape_job_id?: string
          text_content?: string | null
          url?: string
          user_id?: string
          videos?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "scraped_pages_scrape_job_id_fkey"
            columns: ["scrape_job_id"]
            isOneToOne: false
            referencedRelation: "scrape_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scraped_pages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriber_sessions: {
        Row: {
          created_at: string
          current_node_id: string | null
          id: string
          last_message_at: string | null
          phone: string
          status: string
          variables: Json
          workflow_id: string
        }
        Insert: {
          created_at?: string
          current_node_id?: string | null
          id?: string
          last_message_at?: string | null
          phone: string
          status?: string
          variables?: Json
          workflow_id: string
        }
        Update: {
          created_at?: string
          current_node_id?: string | null
          id?: string
          last_message_at?: string | null
          phone?: string
          status?: string
          variables?: Json
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriber_sessions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          status: string
          subject: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          status?: string
          subject?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          status?: string
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          bot_response: string
          conversation_id: string
          created_at: string
          id: string
          user_id: string
          user_message: string
        }
        Insert: {
          bot_response: string
          conversation_id: string
          created_at?: string
          id?: string
          user_id: string
          user_message: string
        }
        Update: {
          bot_response?: string
          conversation_id?: string
          created_at?: string
          id?: string
          user_id?: string
          user_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          created_at: string
          flow_json: Json
          id: string
          name: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          flow_json?: Json
          id?: string
          name?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          flow_json?: Json
          id?: string
          name?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflows_user_id_fkey"
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
      admin_add_form_field: {
        Args: {
          p_allow_other?: boolean
          p_description?: string
          p_field_type: string
          p_is_required?: boolean
          p_label: string
          p_options?: Json
          p_placeholder: string
          p_sort_order?: number
        }
        Returns: undefined
      }
      admin_delete_form_field: { Args: { p_id: string }; Returns: undefined }
      admin_get_counts: {
        Args: never
        Returns: {
          open_tickets: number
          pending_users: number
        }[]
      }
      admin_get_form_settings: {
        Args: never
        Returns: {
          closing_text: string
          closing_title: string
          id: string
          opening_text: string
          opening_title: string
        }[]
      }
      admin_get_profile: {
        Args: { p_id: string }
        Returns: {
          active_flow_id: string | null
          bot_status: string
          created_at: string
          credits_balance: number
          email: string
          full_name: string
          greenapi_instance_id: string | null
          greenapi_token: string | null
          id: string
          language: string
          phone: string | null
          plan_tier: Database["public"]["Enums"]["subscription_tier"] | null
          role: string
          status: string
          subscription_end_date: string | null
          subscription_start_date: string | null
          updated_at: string
          website_url: string | null
          workflow_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_form_fields: {
        Args: never
        Returns: {
          allow_other: boolean
          created_at: string
          description: string
          field_type: string
          id: string
          is_required: boolean
          label: string
          options: Json
          placeholder: string
          sort_order: number
        }[]
      }
      admin_list_profiles: {
        Args: { p_status?: string }
        Returns: {
          active_flow_id: string | null
          bot_status: string
          created_at: string
          credits_balance: number
          email: string
          full_name: string
          greenapi_instance_id: string | null
          greenapi_token: string | null
          id: string
          language: string
          phone: string | null
          plan_tier: Database["public"]["Enums"]["subscription_tier"] | null
          role: string
          status: string
          subscription_end_date: string | null
          subscription_start_date: string | null
          updated_at: string
          website_url: string | null
          workflow_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_tickets: {
        Args: never
        Returns: {
          conversation_id: string
          created_at: string
          id: string
          status: string
          subject: string
          updated_at: string
          user_email: string
          user_id: string
          user_name: string
        }[]
      }
      admin_list_user_integrations: {
        Args: { p_user_id: string }
        Returns: {
          integration_type: string
        }[]
      }
      admin_update_field_order: {
        Args: { p_id: string; p_sort_order: number }
        Returns: undefined
      }
      admin_update_form_field: {
        Args: {
          p_allow_other?: boolean
          p_description?: string
          p_id: string
          p_is_required?: boolean
          p_label: string
          p_options?: Json
          p_placeholder: string
        }
        Returns: undefined
      }
      admin_update_form_settings: {
        Args: {
          p_closing_text?: string
          p_closing_title?: string
          p_opening_text?: string
          p_opening_title?: string
        }
        Returns: undefined
      }
      admin_update_profile_status: {
        Args: { p_id: string; p_status: string }
        Returns: undefined
      }
      get_max_revisions: {
        Args: { tier: Database["public"]["Enums"]["subscription_tier"] }
        Returns: number
      }
      get_monthly_credits: {
        Args: { tier: Database["public"]["Enums"]["subscription_tier"] }
        Returns: number
      }
      get_my_profile: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          language: string
          phone: string
          role: string
          status: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      search_products: {
        Args: { p_limit?: number; p_query: string; p_user_id: string }
        Returns: {
          category: string
          description: string
          id: string
          image_urls: Json
          name: string
          price: string
          product_url: string
          similarity: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      subscription_tier: "basic" | "pro" | "premium"
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
      subscription_tier: ["basic", "pro", "premium"],
    },
  },
} as const
