/**
 * Supabase Database type definitions.
 *
 * This file was generated as a skeleton from the migration files in
 * supabase/migrations/. For a fully accurate and up-to-date version,
 * regenerate with:
 *
 *   npx supabase gen types typescript --linked > src/types/database.types.ts
 *
 * or, against the local dev database:
 *
 *   npx supabase gen types typescript --local > src/types/database.types.ts
 *
 * The skeleton below covers all current tables so that typed Supabase clients
 * compile without errors (AR-H1). Column types are modelled on the DDL in
 * supabase/migrations/ — expand or regenerate as the schema evolves.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      chunks: {
        Row: {
          id: string;
          content: string;
          embedding: number[] | null;
          source_pdf: string;
          page_number: number | null;
          section_title: string | null;
          image_refs: string[] | null;
          metadata: Json | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          content: string;
          embedding?: number[] | null;
          source_pdf: string;
          page_number?: number | null;
          section_title?: string | null;
          image_refs?: string[] | null;
          metadata?: Json | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          content?: string;
          embedding?: number[] | null;
          source_pdf?: string;
          page_number?: number | null;
          section_title?: string | null;
          image_refs?: string[] | null;
          metadata?: Json | null;
          created_at?: string | null;
        };
      };
      images: {
        Row: {
          id: string;
          path: string;
          caption: string | null;
          source_pdf: string;
          page_number: number | null;
          tags: string[] | null;
          created_at: string | null;
          image_source: string | null;
          blur_placeholder: string | null;
        };
        Insert: {
          id?: string;
          path: string;
          caption?: string | null;
          source_pdf: string;
          page_number?: number | null;
          tags?: string[] | null;
          created_at?: string | null;
          image_source?: string | null;
          blur_placeholder?: string | null;
        };
        Update: {
          id?: string;
          path?: string;
          caption?: string | null;
          source_pdf?: string;
          page_number?: number | null;
          tags?: string[] | null;
          created_at?: string | null;
          image_source?: string | null;
          blur_placeholder?: string | null;
        };
      };
      stories: {
        Row: {
          id: string;
          slug: string;
          title: string;
          subtitle: string | null;
          description: string | null;
          image_path: string | null;
          category: string;
          source_pdf: string | null;
          location: string | null;
          duration: string | null;
          display_order: number | null;
          is_active: boolean | null;
          related_stories: string[] | null;
          metadata: Json | null;
          created_at: string | null;
          updated_at: string | null;
          curation_status: string | null;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          subtitle?: string | null;
          description?: string | null;
          image_path?: string | null;
          category: string;
          source_pdf?: string | null;
          location?: string | null;
          duration?: string | null;
          display_order?: number | null;
          is_active?: boolean | null;
          related_stories?: string[] | null;
          metadata?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
          curation_status?: string | null;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          subtitle?: string | null;
          description?: string | null;
          image_path?: string | null;
          category?: string;
          source_pdf?: string | null;
          location?: string | null;
          duration?: string | null;
          display_order?: number | null;
          is_active?: boolean | null;
          related_stories?: string[] | null;
          metadata?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
          curation_status?: string | null;
        };
      };
      feature_flags: {
        Row: {
          id: string;
          flag_key: string;
          enabled: boolean;
          label: string;
          description: string | null;
          config: Json | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          flag_key: string;
          enabled?: boolean;
          label: string;
          description?: string | null;
          config?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          flag_key?: string;
          enabled?: boolean;
          label?: string;
          description?: string | null;
          config?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      user_profiles: {
        Row: {
          id: string;
          user_id: string;
          email: string;
          role: "user" | "admin";
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          email: string;
          role?: "user" | "admin";
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          email?: string;
          role?: "user" | "admin";
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      user_favorites: {
        Row: {
          id: string;
          user_id: string;
          story_id: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          story_id: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          story_id?: string;
          created_at?: string | null;
        };
      };
      story_suggestions: {
        Row: {
          id: string;
          story_id: string | null;
          question: string;
          answer: string | null;
          source_chunk_ids: string[] | null;
          attribution: string | null;
          created_at: string | null;
          session_id: string | null;
          is_anonymous: boolean | null;
        };
        Insert: {
          id?: string;
          story_id?: string | null;
          question: string;
          answer?: string | null;
          source_chunk_ids?: string[] | null;
          attribution?: string | null;
          created_at?: string | null;
          session_id?: string | null;
          is_anonymous?: boolean | null;
        };
        Update: {
          id?: string;
          story_id?: string | null;
          question?: string;
          answer?: string | null;
          source_chunk_ids?: string[] | null;
          attribution?: string | null;
          created_at?: string | null;
          session_id?: string | null;
          is_anonymous?: boolean | null;
        };
      };
      voice_purchases: {
        Row: {
          id: string;
          user_id: string;
          purchase_type: string;
          lemon_squeezy_order_id: string;
          expires_at: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          purchase_type: string;
          lemon_squeezy_order_id: string;
          expires_at: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          purchase_type?: string;
          lemon_squeezy_order_id?: string;
          expires_at?: string;
          created_at?: string | null;
        };
      };
      pending_bookings: {
        Row: {
          id: string;
          idempotency_key: string;
          conversation_id: string | null;
          venue_name: string;
          venue_phone: string;
          customer_name: string;
          customer_phone: string;
          party_size: number;
          booking_date: string;
          booking_time: string;
          special_requests: string | null;
          status: string;
          outcome_message: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          idempotency_key: string;
          conversation_id?: string | null;
          venue_name: string;
          venue_phone: string;
          customer_name: string;
          customer_phone: string;
          party_size: number;
          booking_date: string;
          booking_time: string;
          special_requests?: string | null;
          status?: string;
          outcome_message?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          idempotency_key?: string;
          conversation_id?: string | null;
          venue_name?: string;
          venue_phone?: string;
          customer_name?: string;
          customer_phone?: string;
          party_size?: number;
          booking_date?: string;
          booking_time?: string;
          special_requests?: string | null;
          status?: string;
          outcome_message?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      platform_costs: {
        Row: {
          id: string;
          service_name: string;
          amount_usd: number;
          billing_period_start: string;
          billing_period_end: string;
          category: string | null;
          notes: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          service_name: string;
          amount_usd: number;
          billing_period_start: string;
          billing_period_end: string;
          category?: string | null;
          notes?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          service_name?: string;
          amount_usd?: number;
          billing_period_start?: string;
          billing_period_end?: string;
          category?: string | null;
          notes?: string | null;
          created_at?: string | null;
        };
      };
      github_traffic_daily: {
        Row: {
          id: string;
          recorded_date: string;
          views: number | null;
          unique_visitors: number | null;
          clones: number | null;
          unique_cloners: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          recorded_date: string;
          views?: number | null;
          unique_visitors?: number | null;
          clones?: number | null;
          unique_cloners?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          recorded_date?: string;
          views?: number | null;
          unique_visitors?: number | null;
          clones?: number | null;
          unique_cloners?: number | null;
          created_at?: string | null;
        };
      };
      github_traffic_paths: {
        Row: {
          id: string;
          recorded_date: string;
          path: string;
          title: string | null;
          views: number | null;
          unique_visitors: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          recorded_date: string;
          path: string;
          title?: string | null;
          views?: number | null;
          unique_visitors?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          recorded_date?: string;
          path?: string;
          title?: string | null;
          views?: number | null;
          unique_visitors?: number | null;
          created_at?: string | null;
        };
      };
      github_traffic_referrers: {
        Row: {
          id: string;
          recorded_date: string;
          referrer: string;
          views: number | null;
          unique_visitors: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          recorded_date: string;
          referrer: string;
          views?: number | null;
          unique_visitors?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          recorded_date?: string;
          referrer?: string;
          views?: number | null;
          unique_visitors?: number | null;
          created_at?: string | null;
        };
      };
      marketing_accounts: {
        Row: {
          id: string;
          platform: string;
          account_name: string | null;
          account_id: string | null;
          is_active: boolean | null;
          metadata: Json | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          platform: string;
          account_name?: string | null;
          account_id?: string | null;
          is_active?: boolean | null;
          metadata?: Json | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          platform?: string;
          account_name?: string | null;
          account_id?: string | null;
          is_active?: boolean | null;
          metadata?: Json | null;
          created_at?: string | null;
        };
      };
      marketing_posts: {
        Row: {
          id: string;
          platform: string;
          content: string;
          hashtags: string[] | null;
          scheduled_for: string | null;
          published_at: string | null;
          status: string | null;
          post_id: string | null;
          metadata: Json | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          platform: string;
          content: string;
          hashtags?: string[] | null;
          scheduled_for?: string | null;
          published_at?: string | null;
          status?: string | null;
          post_id?: string | null;
          metadata?: Json | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          platform?: string;
          content?: string;
          hashtags?: string[] | null;
          scheduled_for?: string | null;
          published_at?: string | null;
          status?: string | null;
          post_id?: string | null;
          metadata?: Json | null;
          created_at?: string | null;
        };
      };
      marketing_content_bank: {
        Row: {
          id: string;
          content: string;
          platform: string | null;
          tone: string | null;
          tags: string[] | null;
          used_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          content: string;
          platform?: string | null;
          tone?: string | null;
          tags?: string[] | null;
          used_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          content?: string;
          platform?: string | null;
          tone?: string | null;
          tags?: string[] | null;
          used_at?: string | null;
          created_at?: string | null;
        };
      };
      marketing_agent_logs: {
        Row: {
          id: string;
          agent_name: string;
          action: string;
          result: Json | null;
          error: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          agent_name: string;
          action: string;
          result?: Json | null;
          error?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          agent_name?: string;
          action?: string;
          result?: Json | null;
          error?: string | null;
          created_at?: string | null;
        };
      };
      marketing_schedule: {
        Row: {
          id: string;
          platform: string;
          scheduled_for: string;
          content: string | null;
          status: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          platform: string;
          scheduled_for: string;
          content?: string | null;
          status?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          platform?: string;
          scheduled_for?: string;
          content?: string | null;
          status?: string | null;
          created_at?: string | null;
        };
      };
      admin_audit_log: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          resource_type: string | null;
          resource_id: string | null;
          details: Json | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          action: string;
          resource_type?: string | null;
          resource_id?: string | null;
          details?: Json | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          action?: string;
          resource_type?: string | null;
          resource_id?: string | null;
          details?: Json | null;
          created_at?: string | null;
        };
      };
      stripe_webhook_events: {
        Row: {
          id: string;
          stripe_event_id: string;
          event_type: string;
          payload: Json | null;
          processed_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          stripe_event_id: string;
          event_type: string;
          payload?: Json | null;
          processed_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          stripe_event_id?: string;
          event_type?: string;
          payload?: Json | null;
          processed_at?: string | null;
          created_at?: string | null;
        };
      };
      elevenlabs_webhook_events: {
        Row: {
          id: string;
          event_type: string;
          conversation_id: string | null;
          payload: Json | null;
          processed_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          event_type: string;
          conversation_id?: string | null;
          payload?: Json | null;
          processed_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          event_type?: string;
          conversation_id?: string | null;
          payload?: Json | null;
          processed_at?: string | null;
          created_at?: string | null;
        };
      };
      translate_webhook_events: {
        Row: {
          id: string;
          event_type: string;
          story_id: string | null;
          payload: Json | null;
          processed_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          event_type: string;
          story_id?: string | null;
          payload?: Json | null;
          processed_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          event_type?: string;
          story_id?: string | null;
          payload?: Json | null;
          processed_at?: string | null;
          created_at?: string | null;
        };
      };
      booking_sms_jobs: {
        Row: {
          id: string;
          booking_id: string;
          phone: string;
          message: string;
          status: string | null;
          attempts: number | null;
          created_at: string | null;
          sent_at: string | null;
        };
        Insert: {
          id?: string;
          booking_id: string;
          phone: string;
          message: string;
          status?: string | null;
          attempts?: number | null;
          created_at?: string | null;
          sent_at?: string | null;
        };
        Update: {
          id?: string;
          booking_id?: string;
          phone?: string;
          message?: string;
          status?: string | null;
          attempts?: number | null;
          created_at?: string | null;
          sent_at?: string | null;
        };
      };
      webhook_config: {
        Row: {
          id: string;
          webhook_type: string;
          url: string;
          secret: string | null;
          is_active: boolean | null;
          metadata: Json | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          webhook_type: string;
          url: string;
          secret?: string | null;
          is_active?: boolean | null;
          metadata?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          webhook_type?: string;
          url?: string;
          secret?: string | null;
          is_active?: boolean | null;
          metadata?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      match_chunks: {
        Args: {
          query_embedding: number[];
          match_threshold?: number;
          match_count?: number;
        };
        Returns: {
          id: string;
          content: string;
          source_pdf: string;
          page_number: number;
          section_title: string;
          image_refs: string[];
          similarity: number;
        }[];
      };
      has_active_voice_access: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      get_story_favorite_count: {
        Args: { p_story_id: string };
        Returns: number;
      };
      is_story_favorited: {
        Args: { p_user_id: string; p_story_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
