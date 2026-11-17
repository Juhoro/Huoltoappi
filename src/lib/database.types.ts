
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "audit_events": {
                  Row: {
                    "action": string,"actor": string | null,"created_at": string,"data": Json | null,"entity": string,"entity_id": string | null,"id": number,"organization_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor"?: string | null,"created_at"?: string,"data"?: Json | null,"entity": string,"entity_id"?: string | null,"id"?: never,"organization_id": string
                  }
                  Update: {
                    "action"?: string,"actor"?: string | null,"created_at"?: string,"data"?: Json | null,"entity"?: string,"entity_id"?: string | null,"id"?: never,"organization_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_events_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"customers": {
                  Row: {
                    "address": string | null,"city": string | null,"created_at": string,"email": string | null,"id": string,"lat": number | null,"lng": number | null,"name": string,"notes": string | null,"organization_id": string,"phone": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"city"?: string | null,"created_at"?: string,"email"?: string | null,"id"?: string,"lat"?: number | null,"lng"?: number | null,"name": string,"notes"?: string | null,"organization_id": string,"phone"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"city"?: string | null,"created_at"?: string,"email"?: string | null,"id"?: string,"lat"?: number | null,"lng"?: number | null,"name"?: string,"notes"?: string | null,"organization_id"?: string,"phone"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "customers_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"geocode_cache": {
                  Row: {
                    "created_at": string,"display_name": string | null,"lat": number | null,"lng": number | null,"query": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"lat"?: number | null,"lng"?: number | null,"query": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"lat"?: number | null,"lng"?: number | null,"query"?: string
                  }
                  Relationships: [
                    
                  ]
                },"job_attachments": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"job_id": string,"organization_id": string,"path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"job_id": string,"organization_id": string,"path": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"job_id"?: string,"organization_id"?: string,"path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_attachments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_attachments_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_attachments_organization_id_job_id_fkey"
      columns: ["organization_id","job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"job_extra_work": {
                  Row: {
                    "created_at": string,"created_by": string | null,"decided_at": string | null,"decided_by": string | null,"description": string,"estimated_hours": number | null,"event_id": string | null,"id": string,"job_id": string,"organization_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"decided_at"?: string | null,"decided_by"?: string | null,"description": string,"estimated_hours"?: number | null,"event_id"?: string | null,"id"?: string,"job_id": string,"organization_id": string,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"decided_at"?: string | null,"decided_by"?: string | null,"description"?: string,"estimated_hours"?: number | null,"event_id"?: string | null,"id"?: string,"job_id"?: string,"organization_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_extra_work_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_extra_work_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_extra_work_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_extra_work_organization_id_job_id_fkey"
      columns: ["organization_id","job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"job_materials": {
                  Row: {
                    "created_at": string,"description": string,"id": string,"job_id": string,"missing": boolean,"organization_id": string,"product_id": string | null,"qty_needed": number,"unit": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description": string,"id"?: string,"job_id": string,"missing"?: boolean,"organization_id": string,"product_id"?: string | null,"qty_needed": number,"unit"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"id"?: string,"job_id"?: string,"missing"?: boolean,"organization_id"?: string,"product_id"?: string | null,"qty_needed"?: number,"unit"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_materials_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_materials_organization_id_job_id_fkey"
      columns: ["organization_id","job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "job_materials_organization_id_product_id_fkey"
      columns: ["organization_id","product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"job_reports": {
                  Row: {
                    "ai_used": boolean,"confirmed_at": string | null,"confirmed_by": string | null,"created_at": string,"created_by": string,"id": string,"job_id": string,"organization_id": string,"raw_text": string,"structured": Json | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_used"?: boolean,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"created_by": string,"id"?: string,"job_id": string,"organization_id": string,"raw_text"?: string,"structured"?: Json | null,"version": number
                  }
                  Update: {
                    "ai_used"?: boolean,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"created_by"?: string,"id"?: string,"job_id"?: string,"organization_id"?: string,"raw_text"?: string,"structured"?: Json | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_reports_confirmed_by_fkey"
      columns: ["confirmed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_reports_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_reports_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_reports_organization_id_job_id_fkey"
      columns: ["organization_id","job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"job_status_events": {
                  Row: {
                    "actor": string | null,"created_at": string,"from_status": string | null,"id": number,"job_id": string,"note": string | null,"organization_id": string,"to_status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor"?: string | null,"created_at"?: string,"from_status"?: string | null,"id"?: never,"job_id": string,"note"?: string | null,"organization_id": string,"to_status": string
                  }
                  Update: {
                    "actor"?: string | null,"created_at"?: string,"from_status"?: string | null,"id"?: never,"job_id"?: string,"note"?: string | null,"organization_id"?: string,"to_status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_status_events_actor_fkey"
      columns: ["actor"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_status_events_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_status_events_organization_id_job_id_fkey"
      columns: ["organization_id","job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"job_visits": {
                  Row: {
                    "assigned_to": string | null,"created_at": string,"duration_minutes": number | null,"id": string,"job_id": string,"organization_id": string,"sort": number,"start_time": string | null,"status": string,"visit_date": string,"visit_duration": number | null
                  }
                  ComputedFields: "visit_duration"
                  Insert: {
                    "assigned_to"?: string | null,"created_at"?: string,"duration_minutes"?: number | null,"id"?: string,"job_id": string,"organization_id": string,"sort"?: number,"start_time"?: string | null,"status"?: string,"visit_date"?: string
                  }
                  Update: {
                    "assigned_to"?: string | null,"created_at"?: string,"duration_minutes"?: number | null,"id"?: string,"job_id"?: string,"organization_id"?: string,"sort"?: number,"start_time"?: string | null,"status"?: string,"visit_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_visits_assigned_to_fkey"
      columns: ["assigned_to"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_visits_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_visits_organization_id_job_id_fkey"
      columns: ["organization_id","job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"jobs": {
                  Row: {
                    "address": string | null,"billable_at": string | null,"city": string | null,"completed_at": string | null,"contact_name": string | null,"contact_phone": string | null,"create_event_id": string | null,"created_at": string,"created_by": string | null,"customer_id": string | null,"description": string,"estimated_hours": number | null,"id": string,"invoiced_at": string | null,"lat": number | null,"lng": number | null,"organization_id": string,"priority": string,"quote_id": string | null,"status": string,"title": string,"waiting_reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"billable_at"?: string | null,"city"?: string | null,"completed_at"?: string | null,"contact_name"?: string | null,"contact_phone"?: string | null,"create_event_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string | null,"description"?: string,"estimated_hours"?: number | null,"id"?: string,"invoiced_at"?: string | null,"lat"?: number | null,"lng"?: number | null,"organization_id": string,"priority"?: string,"quote_id"?: string | null,"status"?: string,"title": string,"waiting_reason"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"billable_at"?: string | null,"city"?: string | null,"completed_at"?: string | null,"contact_name"?: string | null,"contact_phone"?: string | null,"create_event_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string | null,"description"?: string,"estimated_hours"?: number | null,"id"?: string,"invoiced_at"?: string | null,"lat"?: number | null,"lng"?: number | null,"organization_id"?: string,"priority"?: string,"quote_id"?: string | null,"status"?: string,"title"?: string,"waiting_reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "jobs_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jobs_organization_id_customer_id_fkey"
      columns: ["organization_id","customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "jobs_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jobs_organization_id_quote_id_fkey"
      columns: ["organization_id","quote_id"]
isOneToOne: false
      referencedRelation: "quotes"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"location_pings": {
                  Row: {
                    "accuracy": number | null,"id": number,"lat": number,"lng": number,"organization_id": string,"recorded_at": string,"shift_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accuracy"?: number | null,"id"?: never,"lat": number,"lng": number,"organization_id": string,"recorded_at"?: string,"shift_id": string,"user_id": string
                  }
                  Update: {
                    "accuracy"?: number | null,"id"?: never,"lat"?: number,"lng"?: number,"organization_id"?: string,"recorded_at"?: string,"shift_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "location_pings_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "location_pings_organization_id_shift_id_fkey"
      columns: ["organization_id","shift_id"]
isOneToOne: false
      referencedRelation: "shifts"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "location_pings_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"material_picks": {
                  Row: {
                    "created_at": string,"event_id": string,"id": string,"job_material_id": string,"organization_id": string,"picked_by": string | null,"qty": number,"source": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_id": string,"id"?: string,"job_material_id": string,"organization_id": string,"picked_by"?: string | null,"qty": number,"source"?: string
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"id"?: string,"job_material_id"?: string,"organization_id"?: string,"picked_by"?: string | null,"qty"?: number,"source"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "material_picks_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "material_picks_organization_id_job_material_id_fkey"
      columns: ["organization_id","job_material_id"]
isOneToOne: false
      referencedRelation: "job_material_status"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "material_picks_organization_id_job_material_id_fkey"
      columns: ["organization_id","job_material_id"]
isOneToOne: false
      referencedRelation: "job_materials"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "material_picks_picked_by_fkey"
      columns: ["picked_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"material_scans": {
                  Row: {
                    "code": string,"created_at": string,"event_id": string,"id": string,"job_material_id": string | null,"normalized_code": string,"organization_id": string,"product_id": string | null,"qty": number | null,"result": string,"scanned_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"event_id": string,"id"?: string,"job_material_id"?: string | null,"normalized_code": string,"organization_id": string,"product_id"?: string | null,"qty"?: number | null,"result": string,"scanned_by"?: string | null
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"event_id"?: string,"id"?: string,"job_material_id"?: string | null,"normalized_code"?: string,"organization_id"?: string,"product_id"?: string | null,"qty"?: number | null,"result"?: string,"scanned_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "material_scans_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "material_scans_scanned_by_fkey"
      columns: ["scanned_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"material_usage": {
                  Row: {
                    "created_at": string,"description": string,"id": string,"job_id": string,"job_material_id": string | null,"organization_id": string,"product_id": string | null,"qty": number,"recorded_by": string | null,"unit": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description": string,"id"?: string,"job_id": string,"job_material_id"?: string | null,"organization_id": string,"product_id"?: string | null,"qty": number,"recorded_by"?: string | null,"unit"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"id"?: string,"job_id"?: string,"job_material_id"?: string | null,"organization_id"?: string,"product_id"?: string | null,"qty"?: number,"recorded_by"?: string | null,"unit"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "material_usage_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "material_usage_organization_id_job_id_fkey"
      columns: ["organization_id","job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "material_usage_organization_id_job_material_id_fkey"
      columns: ["organization_id","job_material_id"]
isOneToOne: false
      referencedRelation: "job_material_status"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "material_usage_organization_id_job_material_id_fkey"
      columns: ["organization_id","job_material_id"]
isOneToOne: false
      referencedRelation: "job_materials"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "material_usage_organization_id_product_id_fkey"
      columns: ["organization_id","product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "material_usage_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"organization_members": {
                  Row: {
                    "active": boolean,"created_at": string,"organization_id": string,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"organization_id": string,"role": string,"user_id": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"organization_id"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organization_members_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "organization_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "created_at": string,"default_vat_rate": number,"hourly_rate": number,"id": string,"name": string,"public_form_enabled": boolean,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"default_vat_rate"?: number,"hourly_rate"?: number,"id"?: string,"name": string,"public_form_enabled"?: boolean,"slug": string
                  }
                  Update: {
                    "created_at"?: string,"default_vat_rate"?: number,"hourly_rate"?: number,"id"?: string,"name"?: string,"public_form_enabled"?: boolean,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"product_barcodes": {
                  Row: {
                    "code": string,"created_at": string,"created_by": string | null,"id": string,"multiplier": number,"normalized_code": string,"organization_id": string,"product_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"multiplier"?: number,"normalized_code": string,"organization_id": string,"product_id": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"multiplier"?: number,"normalized_code"?: string,"organization_id"?: string,"product_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_barcodes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_barcodes_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_barcodes_organization_id_product_id_fkey"
      columns: ["organization_id","product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"products": {
                  Row: {
                    "active": boolean,"category": string,"created_at": string,"id": string,"name": string,"organization_id": string,"pack_size": number,"price": number,"sku": string | null,"sku_type": string,"unit": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"category"?: string,"created_at"?: string,"id"?: string,"name": string,"organization_id": string,"pack_size"?: number,"price"?: number,"sku"?: string | null,"sku_type"?: string,"unit"?: string
                  }
                  Update: {
                    "active"?: boolean,"category"?: string,"created_at"?: string,"id"?: string,"name"?: string,"organization_id"?: string,"pack_size"?: number,"price"?: number,"sku"?: string | null,"sku_type"?: string,"unit"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "color": string,"created_at": string,"full_name": string,"id": string,"phone": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string,"created_at"?: string,"full_name"?: string,"id": string,"phone"?: string | null
                  }
                  Update: {
                    "color"?: string,"created_at"?: string,"full_name"?: string,"id"?: string,"phone"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"public_request_log": {
                  Row: {
                    "created_at": string,"id": number,"ip_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"ip_hash": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"ip_hash"?: string
                  }
                  Relationships: [
                    
                  ]
                },"quote_lines": {
                  Row: {
                    "description": string,"id": string,"kind": string,"organization_id": string,"product_id": string | null,"qty": number,"quote_id": string,"sort": number,"unit": string,"unit_price": number,"vat_rate": number
                  }
                  ComputedFields: never
                  Insert: {
                    "description": string,"id"?: string,"kind"?: string,"organization_id": string,"product_id"?: string | null,"qty"?: number,"quote_id": string,"sort"?: number,"unit"?: string,"unit_price"?: number,"vat_rate"?: number
                  }
                  Update: {
                    "description"?: string,"id"?: string,"kind"?: string,"organization_id"?: string,"product_id"?: string | null,"qty"?: number,"quote_id"?: string,"sort"?: number,"unit"?: string,"unit_price"?: number,"vat_rate"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "quote_lines_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quote_lines_organization_id_product_id_fkey"
      columns: ["organization_id","product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "quote_lines_organization_id_quote_id_fkey"
      columns: ["organization_id","quote_id"]
isOneToOne: false
      referencedRelation: "quotes"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"quote_requests": {
                  Row: {
                    "address": string | null,"city": string | null,"contact_name": string,"created_at": string,"created_by": string | null,"customer_id": string | null,"description": string,"email": string | null,"id": string,"organization_id": string,"phone": string | null,"source": string,"status": string,"urgent": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"city"?: string | null,"contact_name": string,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string | null,"description": string,"email"?: string | null,"id"?: string,"organization_id": string,"phone"?: string | null,"source"?: string,"status"?: string,"urgent"?: boolean
                  }
                  Update: {
                    "address"?: string | null,"city"?: string | null,"contact_name"?: string,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string | null,"description"?: string,"email"?: string | null,"id"?: string,"organization_id"?: string,"phone"?: string | null,"source"?: string,"status"?: string,"urgent"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "quote_requests_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quote_requests_organization_id_customer_id_fkey"
      columns: ["organization_id","customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "quote_requests_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"quotes": {
                  Row: {
                    "accepted_at": string | null,"address": string | null,"city": string | null,"created_at": string,"created_by": string | null,"customer_id": string,"description": string,"estimated_hours": number,"id": string,"organization_id": string,"quote_request_id": string | null,"sent_at": string | null,"status": string,"title": string,"valid_until": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"address"?: string | null,"city"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_id": string,"description"?: string,"estimated_hours"?: number,"id"?: string,"organization_id": string,"quote_request_id"?: string | null,"sent_at"?: string | null,"status"?: string,"title": string,"valid_until"?: string | null
                  }
                  Update: {
                    "accepted_at"?: string | null,"address"?: string | null,"city"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string,"description"?: string,"estimated_hours"?: number,"id"?: string,"organization_id"?: string,"quote_request_id"?: string | null,"sent_at"?: string | null,"status"?: string,"title"?: string,"valid_until"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "quotes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quotes_organization_id_customer_id_fkey"
      columns: ["organization_id","customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "quotes_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quotes_organization_id_quote_request_id_fkey"
      columns: ["organization_id","quote_request_id"]
isOneToOne: false
      referencedRelation: "quote_requests"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"shifts": {
                  Row: {
                    "auto_closed": boolean,"ended_at": string | null,"id": string,"organization_id": string,"started_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auto_closed"?: boolean,"ended_at"?: string | null,"id"?: string,"organization_id": string,"started_at"?: string,"user_id": string
                  }
                  Update: {
                    "auto_closed"?: boolean,"ended_at"?: string | null,"id"?: string,"organization_id"?: string,"started_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shifts_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shifts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"time_entries": {
                  Row: {
                    "corrected_minutes": number | null,"correction_reason": string | null,"created_at": string,"ended_at": string | null,"event_id": string,"id": string,"job_id": string,"organization_id": string,"started_at": string,"user_id": string,"visit_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "corrected_minutes"?: number | null,"correction_reason"?: string | null,"created_at"?: string,"ended_at"?: string | null,"event_id": string,"id"?: string,"job_id": string,"organization_id": string,"started_at": string,"user_id": string,"visit_id"?: string | null
                  }
                  Update: {
                    "corrected_minutes"?: number | null,"correction_reason"?: string | null,"created_at"?: string,"ended_at"?: string | null,"event_id"?: string,"id"?: string,"job_id"?: string,"organization_id"?: string,"started_at"?: string,"user_id"?: string,"visit_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "time_entries_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "time_entries_organization_id_job_id_fkey"
      columns: ["organization_id","job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "time_entries_organization_id_visit_id_fkey"
      columns: ["organization_id","visit_id"]
isOneToOne: false
      referencedRelation: "job_visits"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "time_entries_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "job_material_status": {
                  Row: {
                    "description": string,"id": string,"job_id": string,"missing": boolean,"organization_id": string,"product_id": string | null,"qty_needed": number,"qty_picked": number | null,"qty_used": number | null,"unit": string
                  }
                  ComputedFields: never
                  Insert: {
                           "description"?: string | null,"id"?: string | null,"job_id"?: string | null,"missing"?: boolean | null,"organization_id"?: string | null,"product_id"?: string | null,"qty_needed"?: number | null,"qty_picked"?: never,"qty_used"?: never,"unit"?: string | null
                         }
                        Update: {
                           "description"?: string | null,"id"?: string | null,"job_id"?: string | null,"missing"?: boolean | null,"organization_id"?: string | null,"product_id"?: string | null,"qty_needed"?: number | null,"qty_picked"?: never,"qty_used"?: never,"unit"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "job_materials_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_materials_organization_id_job_id_fkey"
      columns: ["organization_id","job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "job_materials_organization_id_product_id_fkey"
      columns: ["organization_id","product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"job_readiness": {
                  Row: {
                    "job_id": string,"lines": number | null,"lines_missing": number | null,"lines_ready": number | null,"readiness": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"job_time_totals": {
                  Row: {
                    "job_id": string,"minutes": number | null,"running": boolean | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"latest_locations": {
                  Row: {
                    "accuracy": number | null,"lat": number,"lng": number,"organization_id": string,"recorded_at": string,"shift_open": boolean | null,"user_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "location_pings_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "location_pings_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "_audit":
{ Args: { "p_action": string,"p_data"?: Json,"p_entity": string,"p_id": string,"p_org": string }; Returns: undefined
                           },
"_next_free_time":
{ Args: { "p_date": string,"p_user": string }; Returns: string
                           },
"_require_admin":
{ Args: { "p_org": string }; Returns: undefined
                           },
"_require_job":
{ Args: { "p_job": string }; Returns: {
              "address": string | null,
"billable_at": string | null,
"city": string | null,
"completed_at": string | null,
"contact_name": string | null,
"contact_phone": string | null,
"create_event_id": string | null,
"created_at": string,
"created_by": string | null,
"customer_id": string | null,
"description": string,
"estimated_hours": number | null,
"id": string,
"invoiced_at": string | null,
"lat": number | null,
"lng": number | null,
"organization_id": string,
"priority": string,
"quote_id": string | null,
"status": string,
"title": string,
"waiting_reason": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "jobs"
        isOneToOne: true
        isSetofReturn: false
      } },
"_require_member":
{ Args: { "p_org": string }; Returns: undefined
                           },
"_set_job_status":
{ Args: { "p_job": Omit<Database["public"]['Tables']["jobs"]['Row'], Database["public"]['Tables']["jobs"]['ComputedFields']>,"p_note"?: string,"p_to": string }; Returns: undefined
                           },
"accept_quote":
{ Args: { "p_quote_id": string }; Returns: undefined
                           },
"add_extra_work":
{ Args: { "p_description": string,"p_event_id": string,"p_hours"?: number,"p_job_id": string }; Returns: string
                           },
"approve_billing":
{ Args: { "p_job_id": string }; Returns: undefined
                           },
"assign_visit":
{ Args: { "p_date": string,"p_duration_minutes"?: number,"p_job_id": string,"p_start_time"?: string,"p_user_id": string,"p_visit_id"?: string }; Returns: string
                           },
"can_see_customer":
{ Args: { "p_customer": string }; Returns: boolean
                           },
"can_see_job":
{ Args: { "p_job": string }; Returns: boolean
                           },
"cancel_visit":
{ Args: { "p_visit_id": string }; Returns: undefined
                           },
"complete_job":
{ Args: { "p_job_id": string }; Returns: undefined
                           },
"correct_time":
{ Args: { "p_entry_id": string,"p_minutes": number,"p_reason": string }; Returns: undefined
                           },
"create_direct_job":
{ Args: { "p_address"?: string,"p_assigned_to"?: string,"p_city"?: string,"p_contact_name"?: string,"p_contact_phone"?: string,"p_customer_id"?: string,"p_customer_name"?: string,"p_description"?: string,"p_estimated_hours"?: number,"p_event_id": string,"p_lat"?: number,"p_lng"?: number,"p_materials"?: Json,"p_org": string,"p_priority"?: string,"p_title": string,"p_visit_date"?: string }; Returns: string
                           },
"create_job_from_quote":
{ Args: { "p_assigned_to"?: string,"p_quote_id": string,"p_visit_date"?: string }; Returns: string
                           },
"decide_extra_work":
{ Args: { "p_approve": boolean,"p_id": string }; Returns: undefined
                           },
"end_shift":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"is_admin":
{ Args: { "p_org": string }; Returns: boolean
                           },
"is_member":
{ Args: { "p_org": string }; Returns: boolean
                           },
"link_barcode":
{ Args: { "p_code": string,"p_multiplier"?: number,"p_org": string,"p_product_id": string }; Returns: undefined
                           },
"log_scan":
{ Args: { "p_code": string,"p_event_id": string,"p_org": string,"p_result": string }; Returns: undefined
                           },
"maintenance_cleanup":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"mark_invoiced":
{ Args: { "p_job_ids": (string)[] }; Returns: number
                           },
"normalize_barcode":
{ Args: { "p_code": string }; Returns: string
                           },
"record_pick":
{ Args: { "p_code"?: string,"p_event_id": string,"p_job_material_id": string,"p_qty": number,"p_source"?: string }; Returns: Json
                           },
"reopen_job":
{ Args: { "p_job_id": string,"p_reason": string }; Returns: undefined
                           },
"save_report":
{ Args: { "p_ai_used"?: boolean,"p_confirm"?: boolean,"p_job_id": string,"p_raw_text": string,"p_structured"?: Json }; Returns: string
                           },
"save_usage":
{ Args: { "p_items": Json,"p_job_id": string }; Returns: undefined
                           },
"set_job_waiting":
{ Args: { "p_job_id": string,"p_reason": string }; Returns: undefined
                           },
"set_material_missing":
{ Args: { "p_job_material_id": string,"p_missing": boolean }; Returns: undefined
                           },
"set_visit_time":
{ Args: { "p_duration_minutes"?: number,"p_start_time": string,"p_visit_id": string }; Returns: undefined
                           },
"shares_org":
{ Args: { "p_user": string }; Returns: boolean
                           },
"start_shift":
{ Args: { "p_org": string }; Returns: string
                           },
"start_work":
{ Args: { "p_event_id": string,"p_job_id": string,"p_started_at"?: string,"p_visit_id"?: string }; Returns: string
                           },
"stop_work":
{ Args: { "p_corrected_minutes"?: number,"p_ended_at"?: string,"p_reason"?: string,"p_start_event_id": string }; Returns: undefined
                           },
"visit_duration":
{ Args: { "p_visit": Omit<Database["public"]['Tables']["job_visits"]['Row'], Database["public"]['Tables']["job_visits"]['ComputedFields']> }; Returns: number
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
