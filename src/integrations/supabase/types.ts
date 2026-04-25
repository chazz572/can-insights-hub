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
      api_keys: {
        Row: {
          created_at: string
          id: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          scopes: string[]
          team_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          scopes?: string[]
          team_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          scopes?: string[]
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      can_uploads: {
        Row: {
          content_type: string | null
          created_at: string
          file_id: string
          file_size: number | null
          filename: string
          storage_path: string
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          file_id?: string
          file_size?: number | null
          filename: string
          storage_path: string
        }
        Update: {
          content_type?: string | null
          created_at?: string
          file_id?: string
          file_size?: number | null
          filename?: string
          storage_path?: string
        }
        Relationships: []
      }
      fleet_vehicles: {
        Row: {
          created_at: string
          health_score: number
          id: string
          last_analysis_id: string | null
          make: string | null
          mileage: number | null
          model: string | null
          model_year: number | null
          status: string
          team_id: string | null
          updated_at: string
          user_id: string
          vehicle_name: string
          vin: string | null
        }
        Insert: {
          created_at?: string
          health_score?: number
          id?: string
          last_analysis_id?: string | null
          make?: string | null
          mileage?: number | null
          model?: string | null
          model_year?: number | null
          status?: string
          team_id?: string | null
          updated_at?: string
          user_id: string
          vehicle_name: string
          vin?: string | null
        }
        Update: {
          created_at?: string
          health_score?: number
          id?: string
          last_analysis_id?: string | null
          make?: string | null
          mileage?: number | null
          model?: string | null
          model_year?: number | null
          status?: string
          team_id?: string | null
          updated_at?: string
          user_id?: string
          vehicle_name?: string
          vin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fleet_vehicles_last_analysis_id_fkey"
            columns: ["last_analysis_id"]
            isOneToOne: false
            referencedRelation: "saved_analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_vehicles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_name: string | null
          created_at: string
          display_name: string | null
          id: string
          onboarding_completed: boolean
          preferences: Json
          role_title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          onboarding_completed?: boolean
          preferences?: Json
          role_title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          onboarding_completed?: boolean
          preferences?: Json
          role_title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_analyses: {
        Row: {
          created_at: string
          file_id: string
          health_score: number
          id: string
          notes: string | null
          result_snapshot: Json
          tags: string[]
          team_id: string | null
          title: string
          updated_at: string
          user_id: string
          vehicle_label: string | null
        }
        Insert: {
          created_at?: string
          file_id: string
          health_score?: number
          id?: string
          notes?: string | null
          result_snapshot?: Json
          tags?: string[]
          team_id?: string | null
          title: string
          updated_at?: string
          user_id: string
          vehicle_label?: string | null
        }
        Update: {
          created_at?: string
          file_id?: string
          health_score?: number
          id?: string
          notes?: string | null
          result_snapshot?: Json
          tags?: string[]
          team_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          vehicle_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_analyses_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_comparisons: {
        Row: {
          baseline_file_id: string | null
          comparison_file_id: string | null
          comparison_type: string
          created_at: string
          id: string
          summary: Json
          team_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          baseline_file_id?: string | null
          comparison_file_id?: string | null
          comparison_type?: string
          created_at?: string
          id?: string
          summary?: Json
          team_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          baseline_file_id?: string | null
          comparison_file_id?: string | null
          comparison_type?: string
          created_at?: string
          id?: string
          summary?: Json
          team_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_comparisons_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_analyses: {
        Row: {
          created_at: string
          expires_at: string | null
          file_id: string | null
          id: string
          result_snapshot: Json
          revoked_at: string | null
          share_token: string
          title: string | null
          user_id: string
          view_count: number
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          file_id?: string | null
          id?: string
          result_snapshot?: Json
          revoked_at?: string | null
          share_token: string
          title?: string | null
          user_id: string
          view_count?: number
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          file_id?: string | null
          id?: string
          result_snapshot?: Json
          revoked_at?: string | null
          share_token?: string
          title?: string | null
          user_id?: string
          view_count?: number
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          member_role: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_role?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          billing_status: string
          created_at: string
          created_by: string
          id: string
          name: string
          plan_tier: string
          seat_limit: number
          updated_at: string
        }
        Insert: {
          billing_status?: string
          created_at?: string
          created_by: string
          id?: string
          name: string
          plan_tier?: string
          seat_limit?: number
          updated_at?: string
        }
        Update: {
          billing_status?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          plan_tier?: string
          seat_limit?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_team_admin: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
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
