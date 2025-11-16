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
    PostgrestVersion: "13.0.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_login_attempts: {
        Row: {
          api_key_hash: string | null
          created_at: string | null
          id: string
          ip_address: string
          success: boolean | null
          user_agent: string | null
        }
        Insert: {
          api_key_hash?: string | null
          created_at?: string | null
          id?: string
          ip_address: string
          success?: boolean | null
          user_agent?: string | null
        }
        Update: {
          api_key_hash?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string
          success?: boolean | null
          user_agent?: string | null
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          created_at: string | null
          id: string
          product_id: string | null
          quantity: number
          size: string | null
          ticket_id: string | null
          total_price: number
          unit_price: number
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          quantity: number
          size?: string | null
          ticket_id?: string | null
          total_price?: number
          unit_price: number
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          quantity?: number
          size?: string | null
          ticket_id?: string | null
          total_price?: number
          unit_price?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: Json | null
          cpf: string | null
          created_at: string | null
          email: string
          id: string
          name: string
          phone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: Json | null
          cpf?: string | null
          created_at?: string | null
          email: string
          id?: string
          name: string
          phone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: Json | null
          cpf?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string | null
          current_capacity: number | null
          description: string | null
          event_date: string
          id: string
          is_active: boolean | null
          location: string | null
          max_capacity: number | null
          name: string
          ticket_price: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_capacity?: number | null
          description?: string | null
          event_date: string
          id?: string
          is_active?: boolean | null
          location?: string | null
          max_capacity?: number | null
          name: string
          ticket_price?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_capacity?: number | null
          description?: string | null
          event_date?: string
          id?: string
          is_active?: boolean | null
          location?: string | null
          max_capacity?: number | null
          name?: string
          ticket_price?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          additional_notes: string | null
          created_at: string | null
          customer_data: Json
          customer_document: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          expired_at: string | null
          failed_at: string | null
          failure_reason: string | null
          id: string
          items: Json
          external_reference: string | null
          paid_at: string | null
          participants: Json | null
          payment_data: Json | null
          payment_gateway: string | null
          payment_id: string | null
          payment_method: string | null
          payment_status: string | null
          pix_qr_code: string | null
          pix_qr_code_base64: string | null
          pix_ticket_url: string | null
          shipping_address: Json | null
          status: string
          total: number
          total_amount: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          additional_notes?: string | null
          created_at?: string | null
          customer_data: Json
          customer_document?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          expired_at?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          items: Json
          external_reference?: string | null
          paid_at?: string | null
          participants?: Json | null
          payment_data?: Json | null
          payment_gateway?: string | null
          payment_id?: string | null
          payment_method?: string | null
          payment_status?: string | null
          pix_qr_code?: string | null
          pix_qr_code_base64?: string | null
          pix_ticket_url?: string | null
          shipping_address?: Json | null
          status?: string
          total: number
          total_amount?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          additional_notes?: string | null
          created_at?: string | null
          customer_data?: Json
          customer_document?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          expired_at?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          items?: Json
          external_reference?: string | null
          paid_at?: string | null
          participants?: Json | null
          payment_data?: Json | null
          payment_gateway?: string | null
          payment_id?: string | null
          payment_method?: string | null
          payment_status?: string | null
          pix_qr_code?: string | null
          pix_qr_code_base64?: string | null
          pix_ticket_url?: string | null
          shipping_address?: Json | null
          status?: string
          total?: number
          total_amount?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string | null
          display_order: number | null
          id: string
          image_url: string
          is_primary: boolean | null
          product_id: string
          updated_at: string | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url: string
          is_primary?: boolean | null
          product_id: string
          updated_at?: string | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url?: string
          is_primary?: boolean | null
          product_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          height: number | null
          id: string
          image_url: string | null
          in_stock: boolean | null
          length: number | null
          name: string
          price: number
          size: string | null
          sizes: string[] | null
          updated_at: string | null
          weight: number | null
          width: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          height?: number | null
          id?: string
          image_url?: string | null
          in_stock?: boolean | null
          length?: number | null
          name: string
          price: number
          size?: string | null
          sizes?: string[] | null
          updated_at?: string | null
          weight?: number | null
          width?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          height?: number | null
          id?: string
          image_url?: string | null
          in_stock?: boolean | null
          length?: number | null
          name?: string
          price?: number
          size?: string | null
          sizes?: string[] | null
          updated_at?: string | null
          weight?: number | null
          width?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          role: string | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          role?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      system_config: {
        Row: {
          created_at: string | null
          description: string | null
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      tickets: {
        Row: {
          buyer_email: string | null
          created_at: string | null
          event_id: string | null
          id: string
          quantity: number
          status: string | null
          ticket_type: string | null
          total_price: number
          unit_price: number
          user_id: string | null
        }
        Insert: {
          buyer_email?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          quantity: number
          status?: string | null
          ticket_type?: string | null
          total_price: number
          unit_price: number
          user_id?: string | null
        }
        Update: {
          buyer_email?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          quantity?: number
          status?: string | null
          ticket_type?: string | null
          total_price?: number
          unit_price?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          charge_id: string | null
          created_at: string | null
          event_id: string
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          provider: string
        }
        Insert: {
          charge_id?: string | null
          created_at?: string | null
          event_id: string
          event_type: string
          id?: string
          payload: Json
          processed_at?: string | null
          provider: string
        }
        Update: {
          charge_id?: string | null
          created_at?: string | null
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_order_by_charge_id: {
        Args: { charge_id: string }
        Returns: {
          id: string
          status: string
          total: number
          user_id: string
        }[]
      }
      get_user_orders: {
        Args: { user_uuid?: string }
        Returns: {
          created_at: string
          customer_data: Json
          id: string
          items: Json
          paid_at: string
          payment_data: Json
          status: string
          total: number
          updated_at: string
        }[]
      }
      is_admin_user: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_admin_user_safe: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      promote_user_to_admin: {
        Args: { user_id: string }
        Returns: boolean
      }
      validate_admin_api_key: {
        Args: { api_key: string }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const