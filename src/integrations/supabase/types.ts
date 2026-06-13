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
      activity_logs: {
        Row: {
          action: string
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          app_name: string
          auto_reconnect: boolean
          dark_mode: boolean
          default_channel: string | null
          id: string
          posting_delay_ms: number
          updated_at: string
          user_id: string
        }
        Insert: {
          app_name?: string
          auto_reconnect?: boolean
          dark_mode?: boolean
          default_channel?: string | null
          id?: string
          posting_delay_ms?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          app_name?: string
          auto_reconnect?: boolean
          dark_mode?: boolean
          default_channel?: string | null
          id?: string
          posting_delay_ms?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      auto_posting_jobs: {
        Row: {
          ai_keywords: string | null
          ai_theme: string | null
          button_account_id: string | null
          caption_source: string
          channel_id: string
          channel_name: string | null
          completed_at: string | null
          consecutive_failures: number
          created_at: string
          failed_count: number
          id: string
          image_source: string
          interval_seconds: number
          last_error: string | null
          mode_posting: string
          next_run_at: string | null
          paused_at: string | null
          sent_count: number
          started_at: string | null
          status: string
          stopped_at: string | null
          total_posts: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_keywords?: string | null
          ai_theme?: string | null
          button_account_id?: string | null
          caption_source?: string
          channel_id: string
          channel_name?: string | null
          completed_at?: string | null
          consecutive_failures?: number
          created_at?: string
          failed_count?: number
          id?: string
          image_source?: string
          interval_seconds?: number
          last_error?: string | null
          mode_posting?: string
          next_run_at?: string | null
          paused_at?: string | null
          sent_count?: number
          started_at?: string | null
          status?: string
          stopped_at?: string | null
          total_posts?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_keywords?: string | null
          ai_theme?: string | null
          button_account_id?: string | null
          caption_source?: string
          channel_id?: string
          channel_name?: string | null
          completed_at?: string | null
          consecutive_failures?: number
          created_at?: string
          failed_count?: number
          id?: string
          image_source?: string
          interval_seconds?: number
          last_error?: string | null
          mode_posting?: string
          next_run_at?: string | null
          paused_at?: string | null
          sent_count?: number
          started_at?: string | null
          status?: string
          stopped_at?: string | null
          total_posts?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_posting_jobs_button_account_id_fkey"
            columns: ["button_account_id"]
            isOneToOne: false
            referencedRelation: "telegram_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_posting_jobs_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "telegram_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_posting_logs: {
        Row: {
          caption_text: string | null
          channel_id: string | null
          created_at: string
          error_message: string | null
          id: string
          image_url: string | null
          job_id: string
          post_id: string | null
          sent_at: string | null
          status: string
          telegram_message_id: number | null
          user_id: string
        }
        Insert: {
          caption_text?: string | null
          channel_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          image_url?: string | null
          job_id: string
          post_id?: string | null
          sent_at?: string | null
          status: string
          telegram_message_id?: number | null
          user_id: string
        }
        Update: {
          caption_text?: string | null
          channel_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          image_url?: string | null
          job_id?: string
          post_id?: string | null
          sent_at?: string | null
          status?: string
          telegram_message_id?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_posting_logs_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "telegram_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_posting_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "auto_posting_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      caption_templates: {
        Row: {
          caption_text: string
          channel_id: string | null
          channel_name: string | null
          created_at: string
          id: string
          status: string
          template_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          caption_text: string
          channel_id?: string | null
          channel_name?: string | null
          created_at?: string
          id?: string
          status?: string
          template_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          caption_text?: string
          channel_id?: string | null
          channel_name?: string | null
          created_at?: string
          id?: string
          status?: string
          template_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "caption_templates_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "telegram_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      content_drafts: {
        Row: {
          buttons: Json
          caption: string
          created_at: string
          id: string
          media: Json
          repeat_type: string
          scheduled_at: string | null
          source: string
          telegram_account_id: string | null
          template_id: string | null
          title: string
          updated_at: string
          user_id: string
          variables: Json
        }
        Insert: {
          buttons?: Json
          caption?: string
          created_at?: string
          id?: string
          media?: Json
          repeat_type?: string
          scheduled_at?: string | null
          source?: string
          telegram_account_id?: string | null
          template_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
          variables?: Json
        }
        Update: {
          buttons?: Json
          caption?: string
          created_at?: string
          id?: string
          media?: Json
          repeat_type?: string
          scheduled_at?: string | null
          source?: string
          telegram_account_id?: string | null
          template_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          variables?: Json
        }
        Relationships: []
      }
      content_library: {
        Row: {
          brand: string | null
          caption: string | null
          category: string | null
          channel_id: string | null
          created_at: string
          file_size: number | null
          id: string
          is_favorite: boolean
          last_used_at: string | null
          media_url: string | null
          mime_type: string | null
          platform: string
          tags: string[]
          thumb_url: string | null
          title: string
          type: string
          updated_at: string
          used_count: number
          user_id: string
        }
        Insert: {
          brand?: string | null
          caption?: string | null
          category?: string | null
          channel_id?: string | null
          created_at?: string
          file_size?: number | null
          id?: string
          is_favorite?: boolean
          last_used_at?: string | null
          media_url?: string | null
          mime_type?: string | null
          platform?: string
          tags?: string[]
          thumb_url?: string | null
          title?: string
          type?: string
          updated_at?: string
          used_count?: number
          user_id: string
        }
        Update: {
          brand?: string | null
          caption?: string | null
          category?: string | null
          channel_id?: string | null
          created_at?: string
          file_size?: number | null
          id?: string
          is_favorite?: boolean
          last_used_at?: string | null
          media_url?: string | null
          mime_type?: string | null
          platform?: string
          tags?: string[]
          thumb_url?: string | null
          title?: string
          type?: string
          updated_at?: string
          used_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_library_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "telegram_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      content_templates: {
        Row: {
          caption: string
          category: string
          created_at: string
          default_buttons: Json
          description: string | null
          id: string
          last_used_at: string | null
          name: string
          updated_at: string
          use_count: number
          user_id: string
          variables: Json
        }
        Insert: {
          caption?: string
          category?: string
          created_at?: string
          default_buttons?: Json
          description?: string | null
          id?: string
          last_used_at?: string | null
          name: string
          updated_at?: string
          use_count?: number
          user_id: string
          variables?: Json
        }
        Update: {
          caption?: string
          category?: string
          created_at?: string
          default_buttons?: Json
          description?: string | null
          id?: string
          last_used_at?: string | null
          name?: string
          updated_at?: string
          use_count?: number
          user_id?: string
          variables?: Json
        }
        Relationships: []
      }
      deleted_posts_history: {
        Row: {
          buttons: Json | null
          caption: string | null
          deleted_at: string
          deleted_reason: string | null
          id: string
          image_url: string | null
          original_post_id: string
          restored: boolean
          title: string | null
          user_id: string
        }
        Insert: {
          buttons?: Json | null
          caption?: string | null
          deleted_at?: string
          deleted_reason?: string | null
          id?: string
          image_url?: string | null
          original_post_id: string
          restored?: boolean
          title?: string | null
          user_id: string
        }
        Update: {
          buttons?: Json | null
          caption?: string | null
          deleted_at?: string
          deleted_reason?: string | null
          id?: string
          image_url?: string | null
          original_post_id?: string
          restored?: boolean
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      post_buttons: {
        Row: {
          button_text: string
          button_url: string
          created_at: string
          id: string
          post_id: string
          sort_order: number
        }
        Insert: {
          button_text: string
          button_url: string
          created_at?: string
          id?: string
          post_id: string
          sort_order?: number
        }
        Update: {
          button_text?: string
          button_url?: string
          created_at?: string
          id?: string
          post_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_buttons_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posting_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          message: string | null
          post_id: string | null
          status: string
          telegram_account_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          message?: string | null
          post_id?: string | null
          status: string
          telegram_account_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          message?: string | null
          post_id?: string | null
          status?: string
          telegram_account_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posting_logs_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posting_logs_telegram_account_id_fkey"
            columns: ["telegram_account_id"]
            isOneToOne: false
            referencedRelation: "telegram_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          caption: string
          created_at: string
          error_message: string | null
          id: string
          image_url: string | null
          media: Json
          platform: string
          sent_at: string | null
          status: string
          telegram_account_id: string | null
          telegram_chat_id: string | null
          telegram_message_id: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          caption?: string
          created_at?: string
          error_message?: string | null
          id?: string
          image_url?: string | null
          media?: Json
          platform?: string
          sent_at?: string | null
          status?: string
          telegram_account_id?: string | null
          telegram_chat_id?: string | null
          telegram_message_id?: number | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          caption?: string
          created_at?: string
          error_message?: string | null
          id?: string
          image_url?: string | null
          media?: Json
          platform?: string
          sent_at?: string | null
          status?: string
          telegram_account_id?: string | null
          telegram_chat_id?: string | null
          telegram_message_id?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_telegram_account_id_fkey"
            columns: ["telegram_account_id"]
            isOneToOne: false
            referencedRelation: "telegram_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          available_at: string | null
          created_at: string
          id: string
          last_run_at: string | null
          post_id: string
          processing_started_at: string | null
          queue_position: number
          repeat_type: string
          retry_count: number
          scheduled_at: string
          sent_at: string | null
          status: string
          telegram_account_id: string | null
          user_id: string
        }
        Insert: {
          available_at?: string | null
          created_at?: string
          id?: string
          last_run_at?: string | null
          post_id: string
          processing_started_at?: string | null
          queue_position?: number
          repeat_type?: string
          retry_count?: number
          scheduled_at: string
          sent_at?: string | null
          status?: string
          telegram_account_id?: string | null
          user_id: string
        }
        Update: {
          available_at?: string | null
          created_at?: string
          id?: string
          last_run_at?: string | null
          post_id?: string
          processing_started_at?: string | null
          queue_position?: number
          repeat_type?: string
          retry_count?: number
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          telegram_account_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_telegram_account_id_fkey"
            columns: ["telegram_account_id"]
            isOneToOne: false
            referencedRelation: "telegram_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_configs: {
        Row: {
          bot_name: string
          bot_token: string
          bot_username: string | null
          channel_id: string
          channel_name: string | null
          connection_status: string
          created_at: string
          id: string
          is_active: boolean
          is_connected: boolean
          last_error: string | null
          last_tested_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bot_name?: string
          bot_token: string
          bot_username?: string | null
          channel_id: string
          channel_name?: string | null
          connection_status?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_connected?: boolean
          last_error?: string | null
          last_tested_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bot_name?: string
          bot_token?: string
          bot_username?: string | null
          channel_id?: string
          channel_name?: string | null
          connection_status?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_connected?: boolean
          last_error?: string | null
          last_tested_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      telegram_inline_buttons: {
        Row: {
          button_text: string
          button_url: string
          created_at: string
          id: string
          is_active: boolean
          sort_order: number
          telegram_account_id: string
          updated_at: string
        }
        Insert: {
          button_text: string
          button_url: string
          created_at?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          telegram_account_id: string
          updated_at?: string
        }
        Update: {
          button_text?: string
          button_url?: string
          created_at?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          telegram_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_inline_buttons_telegram_account_id_fkey"
            columns: ["telegram_account_id"]
            isOneToOne: false
            referencedRelation: "telegram_configs"
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
      users_profile: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          status?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "operator"
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
      app_role: ["admin", "operator"],
    },
  },
} as const
