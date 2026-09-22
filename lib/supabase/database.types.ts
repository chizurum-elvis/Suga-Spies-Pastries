import type { PaymentTables, PaymentFunctions } from "@/lib/payments/database";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type AuditAction = "insert" | "update" | "delete";
type CatalogueStatus = "draft" | "published" | "archived";
type ImageSource = "local" | "storage";
type OptionSelection = "single" | "multiple" | "quantity";
type FulfillmentMethod = "delivery";
type BlackoutScope = FulfillmentMethod;
type CheckoutDraftStatus =
  "selecting" | "ready_for_details" | "ready_for_payment" | "expired";
type CapacityStatus = "active" | "released";
type CapacitySource = "phone" | "instagram" | "admin" | "other" | "website";
type CapacityHoldStatus = "active" | "expired" | "released" | "consumed";

type DeliverySettingsRow = {
  singleton: boolean;
  version: number;
  origin_address: string;
  allowed_cities: string[];
  base_distance_meters: number;
  base_fee_cents: number;
  extra_km_fee_cents: number;
  maximum_distance_meters: number;
  free_delivery_threshold_cents: number;
  quote_minutes: number;
  updated_at: string;
};
type DeliveryDetailsRow = {
  checkout_draft_id: string;
  version: number;
  input: Json;
  quote: Json | null;
  status: "unverified" | "quoted" | "confirmed";
  updated_at: string;
};

export type Database = {
  public: {
    Tables: PaymentTables & {
      delivery_settings: {
        Row: DeliverySettingsRow;
        Insert: Partial<DeliverySettingsRow> & { origin_address: string };
        Update: Partial<DeliverySettingsRow>;
        Relationships: [];
      };
      checkout_delivery_details: {
        Row: DeliveryDetailsRow;
        Insert: Partial<DeliveryDetailsRow> &
          Pick<DeliveryDetailsRow, "checkout_draft_id" | "input">;
        Update: Partial<DeliveryDetailsRow>;
        Relationships: [];
      };
      delivery_audit_events: {
        Row: {
          id: number;
          checkout_draft_id: string | null;
          action: string;
          actor_user_id: string | null;
          version: number;
          occurred_at: string;
          configuration: Json | null;
        };
        Insert: {
          checkout_draft_id?: string;
          action: string;
          actor_user_id?: string;
          version: number;
          configuration?: Json | null;
        };
        Update: never;
        Relationships: [];
      };
      delivery_request_limits: {
        Row: { bucket: string; window_start: string; request_count: number };
        Insert: { bucket: string; window_start: string; request_count: number };
        Update: { request_count?: number };
        Relationships: [];
      };
      admin_users: {
        Row: {
          user_id: string;
          role: "owner";
          is_active: boolean;
          display_name: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          role?: "owner";
          is_active?: boolean;
          display_name?: string | null;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          role?: "owner";
          is_active?: boolean;
          display_name?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          status: CatalogueStatus;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          status?: CatalogueStatus;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          status?: CatalogueStatus;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          category_id: string;
          name: string;
          slug: string;
          short_description: string | null;
          description: string | null;
          base_price_cents: number;
          currency: "CAD";
          is_starting_price: boolean;
          unit_label: string | null;
          minimum_quantity: number;
          quantity_step: number;
          maximum_quantity: number | null;
          status: CatalogueStatus;
          is_available: boolean;
          ingredients: string | null;
          allergen_information: string | null;
          customer_instructions: string | null;
          display_order: number;
          version: number;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          name: string;
          slug: string;
          short_description?: string | null;
          description?: string | null;
          base_price_cents: number;
          currency?: "CAD";
          is_starting_price?: boolean;
          unit_label?: string | null;
          minimum_quantity?: number;
          quantity_step?: number;
          maximum_quantity?: number | null;
          status?: CatalogueStatus;
          is_available?: boolean;
          ingredients?: string | null;
          allergen_information?: string | null;
          customer_instructions?: string | null;
          display_order?: number;
          version?: number;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string;
          name?: string;
          slug?: string;
          short_description?: string | null;
          description?: string | null;
          base_price_cents?: number;
          currency?: "CAD";
          is_starting_price?: boolean;
          unit_label?: string | null;
          minimum_quantity?: number;
          quantity_step?: number;
          maximum_quantity?: number | null;
          status?: CatalogueStatus;
          is_available?: boolean;
          ingredients?: string | null;
          allergen_information?: string | null;
          customer_instructions?: string | null;
          display_order?: number;
          version?: number;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      product_images: {
        Row: {
          id: string;
          product_id: string;
          source_type: ImageSource;
          path: string;
          alt_text: string;
          object_position: string;
          width: number | null;
          height: number | null;
          is_primary: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          source_type: ImageSource;
          path: string;
          alt_text: string;
          object_position?: string;
          width?: number | null;
          height?: number | null;
          is_primary?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          source_type?: ImageSource;
          path?: string;
          alt_text?: string;
          object_position?: string;
          width?: number | null;
          height?: number | null;
          is_primary?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_variants: {
        Row: {
          id: string;
          product_id: string;
          name: string;
          sku: string | null;
          price_cents: number | null;
          minimum_quantity: number | null;
          quantity_step: number | null;
          maximum_quantity: number | null;
          status: CatalogueStatus;
          is_available: boolean;
          is_default: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          name: string;
          sku?: string | null;
          price_cents?: number | null;
          minimum_quantity?: number | null;
          quantity_step?: number | null;
          maximum_quantity?: number | null;
          status?: CatalogueStatus;
          is_available?: boolean;
          is_default?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          name?: string;
          sku?: string | null;
          price_cents?: number | null;
          minimum_quantity?: number | null;
          quantity_step?: number | null;
          maximum_quantity?: number | null;
          status?: CatalogueStatus;
          is_available?: boolean;
          is_default?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_option_groups: {
        Row: {
          id: string;
          product_id: string;
          name: string;
          selection_type: OptionSelection;
          is_required: boolean;
          minimum_selections: number;
          maximum_selections: number | null;
          status: CatalogueStatus;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          name: string;
          selection_type: OptionSelection;
          is_required?: boolean;
          minimum_selections?: number;
          maximum_selections?: number | null;
          status?: CatalogueStatus;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          name?: string;
          selection_type?: OptionSelection;
          is_required?: boolean;
          minimum_selections?: number;
          maximum_selections?: number | null;
          status?: CatalogueStatus;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_option_groups_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_option_values: {
        Row: {
          id: string;
          option_group_id: string;
          name: string;
          description: string | null;
          price_delta_cents: number;
          status: CatalogueStatus;
          is_available: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          option_group_id: string;
          name: string;
          description?: string | null;
          price_delta_cents?: number;
          status?: CatalogueStatus;
          is_available?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          option_group_id?: string;
          name?: string;
          description?: string | null;
          price_delta_cents?: number;
          status?: CatalogueStatus;
          is_available?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_option_values_option_group_id_fkey";
            columns: ["option_group_id"];
            isOneToOne: false;
            referencedRelation: "product_option_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      fulfillment_settings: {
        Row: {
          singleton: boolean;
          business_timezone: "America/Toronto";
          minimum_notice_days: number;
          booking_horizon_months: number;
          daily_capacity: number;
          hold_minutes: number;
          updated_at: string;
        };
        Insert: {
          singleton?: boolean;
          business_timezone?: "America/Toronto";
          minimum_notice_days?: number;
          booking_horizon_months?: number;
          daily_capacity?: number;
          hold_minutes?: number;
          updated_at?: string;
        };
        Update: {
          singleton?: boolean;
          business_timezone?: "America/Toronto";
          minimum_notice_days?: number;
          booking_horizon_months?: number;
          daily_capacity?: number;
          hold_minutes?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      fulfillment_hours: {
        Row: {
          id: string;
          fulfillment_method: FulfillmentMethod;
          iso_weekday: number;
          is_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          fulfillment_method: FulfillmentMethod;
          iso_weekday: number;
          is_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          fulfillment_method?: FulfillmentMethod;
          iso_weekday?: number;
          is_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      fulfillment_blackouts: {
        Row: {
          id: string;
          fulfillment_date: string;
          scope: BlackoutScope;
          public_reason: string | null;
          internal_note: string | null;
          version: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          fulfillment_date: string;
          scope?: BlackoutScope;
          public_reason?: string | null;
          internal_note?: string | null;
          version?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          fulfillment_date?: string;
          scope?: BlackoutScope;
          public_reason?: string | null;
          internal_note?: string | null;
          version?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      checkout_drafts: {
        Row: {
          id: string;
          access_token_hash: string;
          cart_payload: Json;
          cart_fingerprint: string;
          cart_validation_snapshot: Json;
          pricing_fingerprint: string;
          fulfillment_method: FulfillmentMethod;
          fulfillment_date: string;
          status: CheckoutDraftStatus;
          schema_version: number;
          version: number;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          access_token_hash: string;
          cart_payload: Json;
          cart_fingerprint: string;
          cart_validation_snapshot: Json;
          pricing_fingerprint: string;
          fulfillment_method: FulfillmentMethod;
          fulfillment_date: string;
          status?: CheckoutDraftStatus;
          schema_version?: number;
          version?: number;
          expires_at: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          access_token_hash?: string;
          cart_payload?: Json;
          cart_fingerprint?: string;
          cart_validation_snapshot?: Json;
          pricing_fingerprint?: string;
          fulfillment_method?: FulfillmentMethod;
          fulfillment_date?: string;
          status?: CheckoutDraftStatus;
          schema_version?: number;
          version?: number;
          expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      capacity_days: {
        Row: {
          fulfillment_date: string;
          capacity_limit: number;
          created_at: string;
        };
        Insert: {
          fulfillment_date: string;
          capacity_limit?: number;
          created_at?: string;
        };
        Update: {
          fulfillment_date?: string;
          capacity_limit?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      capacity_adjustments: {
        Row: {
          id: string;
          fulfillment_date: string;
          source: CapacitySource;
          status: CapacityStatus;
          customer_reference: string | null;
          internal_note: string | null;
          created_by: string | null;
          released_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          fulfillment_date: string;
          source: CapacitySource;
          status?: CapacityStatus;
          customer_reference?: string | null;
          internal_note?: string | null;
          created_by?: string | null;
          released_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          fulfillment_date?: string;
          source?: CapacitySource;
          status?: CapacityStatus;
          customer_reference?: string | null;
          internal_note?: string | null;
          created_by?: string | null;
          released_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      capacity_holds: {
        Row: {
          id: string;
          checkout_draft_id: string;
          fulfillment_date: string;
          idempotency_key: string;
          status: CapacityHoldStatus;
          payment_pending: boolean;
          expires_at: string;
          released_at: string | null;
          consumed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          checkout_draft_id: string;
          fulfillment_date: string;
          idempotency_key: string;
          status?: CapacityHoldStatus;
          payment_pending?: boolean;
          expires_at: string;
          released_at?: string | null;
          consumed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          checkout_draft_id?: string;
          fulfillment_date?: string;
          idempotency_key?: string;
          status?: CapacityHoldStatus;
          payment_pending?: boolean;
          expires_at?: string;
          released_at?: string | null;
          consumed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "capacity_holds_checkout_draft_id_fkey";
            columns: ["checkout_draft_id"];
            isOneToOne: false;
            referencedRelation: "checkout_drafts";
            referencedColumns: ["id"];
          },
        ];
      };
      fulfillment_audit_events: {
        Row: {
          id: number;
          entity_table: string;
          entity_id: string;
          action: AuditAction;
          actor_user_id: string | null;
          before_data: Json | null;
          after_data: Json | null;
          occurred_at: string;
        };
        Insert: {
          id?: number;
          entity_table: string;
          entity_id: string;
          action: AuditAction;
          actor_user_id?: string | null;
          before_data?: Json | null;
          after_data?: Json | null;
          occurred_at?: string;
        };
        Update: {
          id?: number;
          entity_table?: string;
          entity_id?: string;
          action?: AuditAction;
          actor_user_id?: string | null;
          before_data?: Json | null;
          after_data?: Json | null;
          occurred_at?: string;
        };
        Relationships: [];
      };
      catalog_audit_events: {
        Row: {
          id: number;
          actor_user_id: string | null;
          entity_table: string;
          entity_id: string;
          action: AuditAction;
          before_data: Json | null;
          after_data: Json | null;
          occurred_at: string;
        };
        Insert: {
          id?: number;
          actor_user_id?: string | null;
          entity_table: string;
          entity_id: string;
          action: AuditAction;
          before_data?: Json | null;
          after_data?: Json | null;
          occurred_at?: string;
        };
        Update: {
          id?: number;
          actor_user_id?: string | null;
          entity_table?: string;
          entity_id?: string;
          action?: AuditAction;
          before_data?: Json | null;
          after_data?: Json | null;
          occurred_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: PaymentFunctions & {
      mutate_delivery_details: {
        Args: {
          p_draft_id: string;
          p_draft_version: number;
          p_details_version: number;
          p_action: string;
          p_payload?: Json;
        };
        Returns: number;
      };
      allow_delivery_provider_request: {
        Args: { p_draft_id: string };
        Returns: boolean;
      };
      reserve_fulfillment_capacity: {
        Args: {
          p_checkout_draft_id: string;
          p_idempotency_key: string;
          p_evaluated_at?: string;
        };
        Returns: {
          hold_id: string;
          expires_at: string;
          fulfillment_date: string;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
