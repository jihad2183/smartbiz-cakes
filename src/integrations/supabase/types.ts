export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      admin_requests: {
        Row: {
          created_at: string;
          decided_at: string | null;
          email: string | null;
          id: string;
          message: string | null;
          status: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          decided_at?: string | null;
          email?: string | null;
          id?: string;
          message?: string | null;
          status?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          decided_at?: string | null;
          email?: string | null;
          id?: string;
          message?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      cakes: {
        Row: {
          available: boolean;
          category: string;
          created_at: string;
          description: string;
          id: string;
          image_url: string | null;
          name: string;
          price: number;
          stock: number | null;
          stock_num: number | null;
          tags: string;
        };
        Insert: {
          available?: boolean;
          category?: string;
          created_at?: string;
          description?: string;
          id?: string;
          image_url?: string | null;
          name: string;
          price?: number;
          stock?: number | null;
          stock_num?: number | null;
          tags?: string;
        };
        Update: {
          available?: boolean;
          category?: string;
          created_at?: string;
          description?: string;
          id?: string;
          image_url?: string | null;
          name?: string;
          price?: number;
          stock?: number | null;
          stock_num?: number | null;
          tags?: string;
        };
        Relationships: [];
      };
      cart_items: {
        Row: {
          cake_id: string;
          cake_name: string;
          image_url: string | null;
          pounds: number;
          quantity: number;
          unit_price: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          cake_id: string;
          cake_name: string;
          image_url?: string | null;
          pounds: number;
          quantity: number;
          unit_price: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          cake_id?: string;
          cake_name?: string;
          image_url?: string | null;
          pounds?: number;
          quantity?: number;
          unit_price?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      expenses: {
        Row: {
          amount: number;
          category: string;
          created_at: string;
          id: string;
          note: string;
          spent_on: string;
          title: string;
        };
        Insert: {
          amount?: number;
          category?: string;
          created_at?: string;
          id?: string;
          note?: string;
          spent_on?: string;
          title: string;
        };
        Update: {
          amount?: number;
          category?: string;
          created_at?: string;
          id?: string;
          note?: string;
          spent_on?: string;
          title?: string;
        };
        Relationships: [];
      };
      ingredients: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          quantity: number;
          reorder_level: number;
          unit: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          quantity?: number;
          reorder_level?: number;
          unit?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          quantity?: number;
          reorder_level?: number;
          unit?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          cake_id: string | null;
          cake_name: string;
          id: string;
          image_url: string | null;
          order_id: string;
          pounds: number;
          quantity: number;
          quantity_num: number | null;
          unit_price: number;
        };
        Insert: {
          cake_id?: string | null;
          cake_name: string;
          id?: string;
          image_url?: string | null;
          order_id: string;
          pounds?: number;
          quantity: number;
          quantity_num?: number | null;
          unit_price: number;
        };
        Update: {
          cake_id?: string | null;
          cake_name?: string;
          id?: string;
          image_url?: string | null;
          order_id?: string;
          pounds?: number;
          quantity?: number;
          quantity_num?: number | null;
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          address: string | null;
          cancelled_at: string | null;
          cancellation_note: string | null;
          created_at: string;
          customer_name: string | null;
          delivery_area: string | null;
          delivery_charge: number;
          delivery_date: string | null;
          delivery_latitude: number | null;
          delivery_longitude: number | null;
          delivery_map_address: string | null;
          discount: number;
          fulfillment_type: string;
          id: string;
          note: string | null;
          payment_method: string;
          payment_status: string;
          phone: string | null;
          status: string;
          transaction_reference: string | null;
          total: number;
          user_id: string;
          voucher_id: string | null;
        };
        Insert: {
          address?: string | null;
          cancelled_at?: string | null;
          cancellation_note?: string | null;
          created_at?: string;
          customer_name?: string | null;
          delivery_area?: string | null;
          delivery_charge?: number;
          delivery_date?: string | null;
          delivery_latitude?: number | null;
          delivery_longitude?: number | null;
          delivery_map_address?: string | null;
          discount?: number;
          fulfillment_type?: string;
          id?: string;
          note?: string | null;
          payment_method?: string;
          payment_status?: string;
          phone?: string | null;
          status?: string;
          transaction_reference?: string | null;
          total?: number;
          user_id: string;
          voucher_id?: string | null;
        };
        Update: {
          address?: string | null;
          cancelled_at?: string | null;
          cancellation_note?: string | null;
          created_at?: string;
          customer_name?: string | null;
          delivery_area?: string | null;
          delivery_charge?: number;
          delivery_date?: string | null;
          delivery_latitude?: number | null;
          delivery_longitude?: number | null;
          delivery_map_address?: string | null;
          discount?: number;
          fulfillment_type?: string;
          id?: string;
          note?: string | null;
          payment_method?: string;
          payment_status?: string;
          phone?: string | null;
          status?: string;
          transaction_reference?: string | null;
          total?: number;
          user_id?: string;
          voucher_id?: string | null;
        };
        Relationships: [];
      };
      order_payment_entries: {
        Row: {
          amount: number;
          created_at: string;
          entry_type: string;
          id: string;
          note: string;
          order_id: string;
          recorded_by: string | null;
          reference: string | null;
        };
        Insert: {
          amount: number;
          created_at?: string;
          entry_type: string;
          id?: string;
          note?: string;
          order_id: string;
          recorded_by?: string | null;
          reference?: string | null;
        };
        Update: {
          amount?: number;
          created_at?: string;
          entry_type?: string;
          id?: string;
          note?: string;
          order_id?: string;
          recorded_by?: string | null;
          reference?: string | null;
        };
        Relationships: [];
      };
      customer_addresses: {
        Row: {
          address_line: string;
          area: string | null;
          city: string | null;
          created_at: string;
          id: string;
          phone: string;
          postal_code: string | null;
          recipient_name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          address_line: string;
          area?: string | null;
          city?: string | null;
          created_at?: string;
          id?: string;
          phone: string;
          postal_code?: string | null;
          recipient_name: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          address_line?: string;
          area?: string | null;
          city?: string | null;
          created_at?: string;
          id?: string;
          phone?: string;
          postal_code?: string | null;
          recipient_name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      customer_referrals: {
        Row: {
          created_at: string;
          id: string;
          referral_code: string;
          referred_user_id: string;
          referrer_user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          referral_code: string;
          referred_user_id: string;
          referrer_user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          referral_code?: string;
          referred_user_id?: string;
          referrer_user_id?: string;
        };
        Relationships: [];
      };
      payment_methods: {
        Row: {
          enabled: boolean;
          id: string;
          instructions: string;
          label: string;
          updated_at: string;
        };
        Insert: {
          enabled?: boolean;
          id: string;
          instructions?: string;
          label: string;
          updated_at?: string;
        };
        Update: {
          enabled?: boolean;
          id?: string;
          instructions?: string;
          label?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      support_requests: {
        Row: {
          category: string;
          created_at: string;
          description: string;
          id: string;
          order_id: string | null;
          status: string;
          subject: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          description: string;
          id?: string;
          order_id?: string | null;
          status?: string;
          subject: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          description?: string;
          id?: string;
          order_id?: string | null;
          status?: string;
          subject?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          address: string | null;
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          location_address: string | null;
          location_latitude: number | null;
          location_longitude: number | null;
          location_updated_at: string | null;
          phone: string | null;
          referral_code: string;
        };
        Insert: {
          address?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          location_address?: string | null;
          location_latitude?: number | null;
          location_longitude?: number | null;
          location_updated_at?: string | null;
          phone?: string | null;
          referral_code?: string;
        };
        Update: {
          address?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          location_address?: string | null;
          location_latitude?: number | null;
          location_longitude?: number | null;
          location_updated_at?: string | null;
          phone?: string | null;
          referral_code?: string;
        };
        Relationships: [];
      };
      voucher_eligibility: {
        Row: {
          user_id: string;
          voucher_id: string;
        };
        Insert: {
          user_id: string;
          voucher_id: string;
        };
        Update: {
          user_id?: string;
          voucher_id?: string;
        };
        Relationships: [];
      };
      voucher_redemptions: {
        Row: {
          id: string;
          order_id: string;
          redeemed_at: string;
          user_id: string;
          voucher_id: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          redeemed_at?: string;
          user_id: string;
          voucher_id: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          redeemed_at?: string;
          user_id?: string;
          voucher_id?: string;
        };
        Relationships: [];
      };
      vouchers: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          discount_type: string;
          discount_value: number;
          eligible_to_all: boolean;
          expires_at: string | null;
          id: string;
          is_welcome: boolean;
          max_discount: number | null;
          min_order: number;
        };
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          discount_type: string;
          discount_value: number;
          eligible_to_all?: boolean;
          expires_at?: string | null;
          id?: string;
          is_welcome?: boolean;
          max_discount?: number | null;
          min_order?: number;
        };
        Update: {
          active?: boolean;
          code?: string;
          created_at?: string;
          discount_type?: string;
          discount_value?: number;
          eligible_to_all?: boolean;
          expires_at?: string | null;
          id?: string;
          is_welcome?: boolean;
          max_discount?: number | null;
          min_order?: number;
        };
        Relationships: [];
      };
      welcome_voucher_settings: {
        Row: {
          active: boolean;
          discount_type: string;
          discount_value: number;
          id: number;
          max_discount: number | null;
          min_order: number;
          updated_at: string;
          validity_days: number;
        };
        Insert: {
          active?: boolean;
          discount_type?: string;
          discount_value?: number;
          id: number;
          max_discount?: number | null;
          min_order?: number;
          updated_at?: string;
          validity_days?: number;
        };
        Update: {
          active?: boolean;
          discount_type?: string;
          discount_value?: number;
          id?: number;
          max_discount?: number | null;
          min_order?: number;
          updated_at?: string;
          validity_days?: number;
        };
        Relationships: [];
      };
      site_content: {
        Row: {
          key: string;
          updated_at: string;
          value: string;
        };
        Insert: {
          key: string;
          updated_at?: string;
          value?: string;
        };
        Update: {
          key?: string;
          updated_at?: string;
          value?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      decide_admin_request: {
        Args: { _approve: boolean; _request_id: string };
        Returns: undefined;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      place_order: {
        Args: {
          _address: string;
          _delivery_date: string | null;
          _delivery_area: string;
          _items: Json;
          _fulfillment_type: string;
          _name: string;
          _note: string;
          _payment_method: string;
          _phone: string;
          _transaction_reference: string;
          _voucher_code: string;
        };
        Returns: string;
      };
      place_order_once: {
        Args: {
          _address: string;
          _delivery_date: string | null;
          _delivery_area: string;
          _fulfillment_type: string;
          _idempotency_key: string;
          _items: Json;
          _name: string;
          _note: string;
          _payment_method: string;
          _phone: string;
          _transaction_reference: string;
          _voucher_code: string;
        };
        Returns: string;
      };
      place_order_with_location: {
        Args: {
          _address: string;
          _delivery_date: string | null;
          _fulfillment_type: string;
          _idempotency_key: string;
          _items: Json;
          _latitude: number | null;
          _longitude: number | null;
          _map_address: string | null;
          _name: string;
          _note: string;
          _payment_method: string;
          _phone: string;
          _transaction_reference: string;
          _voucher_code: string;
        };
        Returns: string;
      };
      record_customer_referral: {
        Args: { _code: string };
        Returns: undefined;
      };
      record_order_payment: {
        Args: {
          _amount: number;
          _entry_type: string;
          _note?: string;
          _order_id: string;
          _reference?: string | null;
        };
        Returns: string;
      };
      save_profile_location_if_missing: {
        Args: {
          _address?: string | null;
          _latitude: number;
          _longitude: number;
        };
        Returns: boolean;
      };
      validate_voucher: {
        Args: { _code: string; _subtotal: number };
        Returns: Json;
      };
    };
    Enums: {
      app_role: "admin" | "customer";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "customer"],
    },
  },
} as const;
