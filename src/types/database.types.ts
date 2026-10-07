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
      hosting_pools: {
        Row: {
          anon_key: string
          created_at: string
          id: string
          kind: string
          label: string
          supabase_url: string
        }
        Insert: {
          anon_key: string
          created_at?: string
          id?: string
          kind: string
          label: string
          supabase_url: string
        }
        Update: {
          anon_key?: string
          created_at?: string
          id?: string
          kind?: string
          label?: string
          supabase_url?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          currency: string
          due_date: string | null
          id: string
          issued_date: string | null
          paid_at: string | null
          school_id: string
          status: string
          subscription_id: string | null
        }
        Insert: {
          amount: number
          currency?: string
          due_date?: string | null
          id?: string
          issued_date?: string | null
          paid_at?: string | null
          school_id: string
          status?: string
          subscription_id?: string | null
        }
        Update: {
          amount?: number
          currency?: string
          due_date?: string | null
          id?: string
          issued_date?: string | null
          paid_at?: string | null
          school_id?: string
          status?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      license_keys: {
        Row: {
          expires_on: string
          id: string
          issued_at: string
          issued_by: string | null
          key_id: number
          key_text: string
          school_id: string
          sent_at: string | null
          sent_to: string | null
        }
        Insert: {
          expires_on: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          key_id: number
          key_text: string
          school_id: string
          sent_at?: string | null
          sent_to?: string | null
        }
        Update: {
          expires_on?: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          key_id?: number
          key_text?: string
          school_id?: string
          sent_at?: string | null
          sent_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "license_keys_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      license_secrets: {
        Row: {
          created_at: string
          school_id: string
          secret: string
        }
        Insert: {
          created_at?: string
          school_id: string
          secret: string
        }
        Update: {
          created_at?: string
          school_id?: string
          secret?: string
        }
        Relationships: [
          {
            foreignKeyName: "license_secrets_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      operations_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          id: string
          school_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          school_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operations_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          default_grace_days: number
          id: boolean
          platform_domain: string
          require_mfa: boolean
        }
        Insert: {
          default_grace_days?: number
          id?: boolean
          platform_domain?: string
          require_mfa?: boolean
        }
        Update: {
          default_grace_days?: number
          id?: boolean
          platform_domain?: string
          require_mfa?: boolean
        }
        Relationships: []
      }
      releases: {
        Row: {
          applied_at: string
          id: string
          migration_version: string
          notes: string | null
          school_id: string
          status: string
        }
        Insert: {
          applied_at?: string
          id?: string
          migration_version: string
          notes?: string | null
          school_id: string
          status: string
        }
        Update: {
          applied_at?: string
          id?: string
          migration_version?: string
          notes?: string | null
          school_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "releases_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_checklist: {
        Row: {
          done_at: string
          done_by: string | null
          note: string | null
          school_id: string
          step_key: string
        }
        Insert: {
          done_at?: string
          done_by?: string | null
          note?: string | null
          school_id: string
          step_key: string
        }
        Update: {
          done_at?: string
          done_by?: string | null
          note?: string | null
          school_id?: string
          step_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_checklist_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_domains: {
        Row: {
          created_at: string
          domain_type: string
          hostname: string
          id: string
          is_primary: boolean
          school_id: string
        }
        Insert: {
          created_at?: string
          domain_type: string
          hostname: string
          id?: string
          is_primary?: boolean
          school_id: string
        }
        Update: {
          created_at?: string
          domain_type?: string
          hostname?: string
          id?: string
          is_primary?: boolean
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_domains_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_projects: {
        Row: {
          anon_key: string
          created_at: string
          id: string
          kind: string
          region: string
          schema_version: string | null
          school_id: string
          secrets_ref: string | null
          supabase_project_ref: string
          supabase_url: string
          updated_at: string
        }
        Insert: {
          anon_key: string
          created_at?: string
          id?: string
          kind?: string
          region?: string
          schema_version?: string | null
          school_id: string
          secrets_ref?: string | null
          supabase_project_ref: string
          supabase_url: string
          updated_at?: string
        }
        Update: {
          anon_key?: string
          created_at?: string
          id?: string
          kind?: string
          region?: string
          schema_version?: string | null
          school_id?: string
          secrets_ref?: string | null
          supabase_project_ref?: string
          supabase_url?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_projects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          code: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          plan: string
          school_type: string | null
          size_tier: string | null
          status: string
        }
        Insert: {
          code: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          plan?: string
          school_type?: string | null
          size_tier?: string | null
          status?: string
        }
        Update: {
          code?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          plan?: string
          school_type?: string | null
          size_tier?: string | null
          status?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_cycle: string
          created_at: string
          currency: string
          current_period_end: string | null
          id: string
          last_reminder_sent_at: string | null
          license_expires_on: string | null
          plan: string
          price_amount: number
          reminder_window_days: number
          school_id: string
          status: string
        }
        Insert: {
          billing_cycle: string
          created_at?: string
          currency?: string
          current_period_end?: string | null
          id?: string
          last_reminder_sent_at?: string | null
          license_expires_on?: string | null
          plan: string
          price_amount: number
          reminder_window_days?: number
          school_id: string
          status?: string
        }
        Update: {
          billing_cycle?: string
          created_at?: string
          currency?: string
          current_period_end?: string | null
          id?: string
          last_reminder_sent_at?: string | null
          license_expires_on?: string | null
          plan?: string
          price_amount?: number
          reminder_window_days?: number
          school_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      tpi_staff: {
        Row: {
          active: boolean
          created_at: string
          full_name: string
          role: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          full_name: string
          role: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          full_name?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_tpi_staff: {
        Args: { p_email: string; p_full_name: string; p_role: string }
        Returns: undefined
      }
      assert_publishable_key: { Args: { p_key: string }; Returns: undefined }
      create_license_secret: { Args: { p_school_id: string }; Returns: string }
      create_school: {
        Args: {
          p_billing_cycle: string
          p_code: string
          p_contact_email: string
          p_contact_name: string
          p_contact_phone: string
          p_name: string
          p_plan: string
          p_price: number
          p_publishable_key: string
          p_region: string
          p_supabase_url: string
        }
        Returns: Json
      }
      delete_school: {
        Args: { p_confirm_code: string; p_school_id: string }
        Returns: undefined
      }
      generate_license_key: {
        Args: { p_school_id: string; p_years?: number }
        Returns: Json
      }
      has_tpi_role: { Args: { p_roles: string[] }; Returns: boolean }
      list_tpi_staff: {
        Args: never
        Returns: {
          active: boolean
          email: string
          full_name: string
          last_sign_in_at: string
          role: string
          user_id: string
        }[]
      }
      log_operation: {
        Args: { p_action: string; p_details?: Json; p_school_id?: string }
        Returns: undefined
      }
      mark_license_key_sent: {
        Args: { p_key_row: string; p_sent_to: string }
        Returns: undefined
      }
      register_hosting_pool: {
        Args: { p_key: string; p_kind: string; p_label: string; p_url: string }
        Returns: undefined
      }
      resolve_school_by_hostname: {
        Args: { p_hostname: string }
        Returns: {
          anon_key: string
          school_code: string
          school_id: string
          school_name: string
          status: string
          supabase_url: string
        }[]
      }
      rotate_license_secret: { Args: { p_school_id: string }; Returns: string }
      set_school_profile: {
        Args: {
          p_hosting: string
          p_school_id: string
          p_tier: string
          p_type: string
        }
        Returns: undefined
      }
      set_school_status: {
        Args: { p_reason?: string; p_school_id: string; p_status: string }
        Returns: undefined
      }
      set_tpi_staff_active: {
        Args: { p_active: boolean; p_user_id: string }
        Returns: undefined
      }
      subscriptions_due: {
        Args: { p_within_days?: number }
        Returns: {
          code: string
          contact_email: string
          days_left: number
          last_reminder_sent_at: string
          license_expires_on: string
          name: string
          school_id: string
          state: string
        }[]
      }
      update_my_staff_name: {
        Args: { p_full_name: string }
        Returns: undefined
      }
      update_school_project: {
        Args: {
          p_publishable_key: string
          p_region?: string
          p_school_id: string
          p_supabase_url: string
        }
        Returns: undefined
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
