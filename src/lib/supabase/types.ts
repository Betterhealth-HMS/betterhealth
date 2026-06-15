export type Role =
  | "receptionist"
  | "nurse"
  | "doctor"
  | "lab_technician"
  | "pharmacist"
  | "manager"
  | "admin";

export type VisitStatus =
  | "registered"
  | "triage"
  | "lab"
  | "consultation"
  | "pharmacy"
  | "completed"
  | "cancelled";

export type VisitType =
  | "walk_in"
  | "appointment"
  | "pre_employment"
  | "iod"
  | "periodic"
  | "fitness_for_duty";

export type Priority = "normal" | "urgent" | "emergency";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          role: Role;
          department: string | null;
          employee_number: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      patients: {
        Row: {
          id: string;
          patient_number: string;
          full_name: string;
          date_of_birth: string;
          gender: "male" | "female" | "other" | null;
          blood_type: string | null;
          id_number: string | null;
          employer: string | null;
          occupation: string | null;
          contact_phone: string | null;
          contact_email: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          medical_aid_provider: string | null;
          medical_aid_number: string | null;
          allergies: string[] | null;
          chronic_conditions: string[] | null;
          notes: string | null;
          created_at: string;
          created_by: string | null;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["patients"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["patients"]["Insert"]>;
      };
      visits: {
        Row: {
          id: string;
          visit_number: string;
          patient_id: string;
          visit_type: VisitType;
          chief_complaint: string | null;
          status: VisitStatus;
          priority: Priority;
          registered_at: string;
          registered_by: string | null;
          triage_started_at: string | null;
          triage_completed_at: string | null;
          lab_ordered_at: string | null;
          lab_completed_at: string | null;
          consultation_started_at: string | null;
          consultation_completed_at: string | null;
          pharmacy_sent_at: string | null;
          pharmacy_completed_at: string | null;
          completed_at: string | null;
          assigned_doctor: string | null;
          assigned_nurse: string | null;
          assigned_room: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["visits"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["visits"]["Insert"]>;
      };
      vitals: {
        Row: {
          id: string;
          visit_id: string;
          blood_pressure_systolic: number | null;
          blood_pressure_diastolic: number | null;
          pulse_rate: number | null;
          temperature: number | null;
          weight_kg: number | null;
          height_cm: number | null;
          bmi: number | null;
          oxygen_saturation: number | null;
          respiratory_rate: number | null;
          blood_glucose: number | null;
          pain_scale: number | null;
          notes: string | null;
          recorded_at: string;
          recorded_by: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["vitals"]["Row"], "id" | "recorded_at">;
        Update: Partial<Database["public"]["Tables"]["vitals"]["Insert"]>;
      };
      lab_orders: {
        Row: {
          id: string;
          visit_id: string;
          test_name: string;
          test_code: string | null;
          status: "pending" | "in_progress" | "completed" | "cancelled";
          urgency: "routine" | "urgent" | "stat";
          ordered_by: string | null;
          ordered_at: string;
          result_value: string | null;
          result_unit: string | null;
          result_reference_range: string | null;
          result_flag: "normal" | "low" | "high" | "critical" | null;
          result_notes: string | null;
          completed_at: string | null;
          completed_by: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["lab_orders"]["Row"], "id" | "ordered_at">;
        Update: Partial<Database["public"]["Tables"]["lab_orders"]["Insert"]>;
      };
      consultation_notes: {
        Row: {
          id: string;
          visit_id: string;
          subjective: string | null;
          objective: string | null;
          assessment: string | null;
          plan: string | null;
          diagnosis_code: string | null;
          diagnosis_description: string | null;
          follow_up_required: boolean;
          follow_up_date: string | null;
          follow_up_instructions: string | null;
          work_status: "fit" | "fit_with_restrictions" | "temporarily_unfit" | "unfit" | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["consultation_notes"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["consultation_notes"]["Insert"]>;
      };
      prescriptions: {
        Row: {
          id: string;
          visit_id: string;
          prescribed_by: string | null;
          prescribed_at: string;
          status: "pending" | "dispensed" | "partially_dispensed" | "cancelled";
          dispensed_at: string | null;
          dispensed_by: string | null;
          notes: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["prescriptions"]["Row"], "id" | "prescribed_at">;
        Update: Partial<Database["public"]["Tables"]["prescriptions"]["Insert"]>;
      };
      prescription_items: {
        Row: {
          id: string;
          prescription_id: string;
          medication_name: string;
          dosage: string;
          frequency: string;
          duration: string | null;
          quantity: number | null;
          instructions: string | null;
          is_dispensed: boolean;
        };
        Insert: Omit<Database["public"]["Tables"]["prescription_items"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["prescription_items"]["Insert"]>;
      };
      rooms: {
        Row: {
          id: string;
          room_number: string;
          room_name: string;
          department: string;
          status: "ready" | "occupied" | "cleaning" | "maintenance" | "reserved";
          current_visit_id: string | null;
          last_cleaned_at: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["rooms"]["Row"], "id" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["rooms"]["Insert"]>;
      };
      inventory: {
        Row: {
          id: string;
          item_code: string | null;
          item_name: string;
          category: "medication" | "consumable" | "equipment" | "lab_reagent" | "vaccine";
          unit: string;
          current_stock: number;
          reorder_level: number;
          unit_cost: number | null;
          location: string | null;
          expiry_date: string | null;
          supplier: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["inventory"]["Row"], "id" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["inventory"]["Insert"]>;
      };
      appointments: {
        Row: {
          id: string;
          appointment_number: string;
          patient_id: string;
          appointment_type: string;
          scheduled_date: string;
          scheduled_time: string;
          assigned_doctor: string | null;
          status: "scheduled" | "confirmed" | "arrived" | "completed" | "cancelled" | "no_show";
          notes: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["appointments"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["appointments"]["Insert"]>;
      };
      shift_handovers: {
        Row: {
          id: string;
          shift_date: string;
          shift_type: "morning" | "afternoon" | "night";
          handover_time: string;
          outgoing_staff_id: string | null;
          incoming_staff_id: string | null;
          patient_summary: string | null;
          outstanding_items: string | null;
          incidents_log: string | null;
          equipment_status: string | null;
          stock_alerts: string | null;
          general_notes: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["shift_handovers"]["Row"], "id" | "created_at" | "handover_time">;
        Update: Partial<Database["public"]["Tables"]["shift_handovers"]["Insert"]>;
      };
      checklist_templates: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          category: string;
          shift_type: string;
          items: { text: string; required: boolean }[];
          is_active: boolean;
          sort_order: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["checklist_templates"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["checklist_templates"]["Insert"]>;
      };
      audit_checklists: {
        Row: {
          id: string;
          checklist_date: string;
          checklist_type: string;
          shift_type: string;
          status: "pending" | "in_progress" | "completed" | "completed_with_issues";
          items: ChecklistItem[];
          completed_by: string | null;
          completed_at: string | null;
          notes: string | null;
          template_id: string | null;
          acknowledged_by: string | null;
          acknowledged_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["audit_checklists"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["audit_checklists"]["Insert"]>;
      };
    };
  };
}

export type ChecklistItem = {
  id: string;
  text: string;
  required: boolean;
  checked: boolean;
  notes?: string;
};

export type ChecklistTemplateRow = Database["public"]["Tables"]["checklist_templates"]["Row"];
