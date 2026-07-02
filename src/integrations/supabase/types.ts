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
      announcements: {
        Row: {
          audience_roles: Database["public"]["Enums"]["app_role"][] | null
          body: string
          created_by: string | null
          id: string
          published_at: string
          title: string
        }
        Insert: {
          audience_roles?: Database["public"]["Enums"]["app_role"][] | null
          body: string
          created_by?: string | null
          id?: string
          published_at?: string
          title: string
        }
        Update: {
          audience_roles?: Database["public"]["Enums"]["app_role"][] | null
          body?: string
          created_by?: string | null
          id?: string
          published_at?: string
          title?: string
        }
        Relationships: []
      }
      attempt_answers: {
        Row: {
          attempt_id: string
          id: string
          is_correct: boolean | null
          question_id: string
          selected_option_id: string | null
        }
        Insert: {
          attempt_id: string
          id?: string
          is_correct?: boolean | null
          question_id: string
          selected_option_id?: string | null
        }
        Update: {
          attempt_id?: string
          id?: string
          is_correct?: boolean | null
          question_id?: string
          selected_option_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attempt_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_answers_selected_option_id_fkey"
            columns: ["selected_option_id"]
            isOneToOne: false
            referencedRelation: "question_options"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          id: string
          ip: string | null
          metadata: Json
          target: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json
          target?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json
          target?: string | null
        }
        Relationships: []
      }
      centers: {
        Row: {
          city: string | null
          code: string
          created_at: string
          id: string
          name: string
          region: string | null
        }
        Insert: {
          city?: string | null
          code: string
          created_at?: string
          id?: string
          name: string
          region?: string | null
        }
        Update: {
          city?: string | null
          code?: string
          created_at?: string
          id?: string
          name?: string
          region?: string | null
        }
        Relationships: []
      }
      certificates: {
        Row: {
          cert_code: string
          course_id: string
          expires_at: string | null
          id: string
          issued_at: string
          score_percent: number | null
          user_id: string
        }
        Insert: {
          cert_code: string
          course_id: string
          expires_at?: string | null
          id?: string
          issued_at?: string
          score_percent?: number | null
          user_id: string
        }
        Update: {
          cert_code?: string
          course_id?: string
          expires_at?: string | null
          id?: string
          issued_at?: string
          score_percent?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_categories: {
        Row: {
          description: string | null
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      courses: {
        Row: {
          category_id: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          is_published: boolean
          slug: string
          target_roles: Database["public"]["Enums"]["app_role"][] | null
          title: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_published?: boolean
          slug: string
          target_roles?: Database["public"]["Enums"]["app_role"][] | null
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_published?: boolean
          slug?: string
          target_roles?: Database["public"]["Enums"]["app_role"][] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "course_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          center_id: string | null
          created_at: string
          designation: string | null
          email: string
          employee_code: string | null
          full_name: string
          id: string
          joined_at: string | null
          phone: string | null
          status: Database["public"]["Enums"]["employee_status"]
          updated_at: string
        }
        Insert: {
          center_id?: string | null
          created_at?: string
          designation?: string | null
          email: string
          employee_code?: string | null
          full_name: string
          id: string
          joined_at?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
        }
        Update: {
          center_id?: string | null
          created_at?: string
          designation?: string | null
          email?: string
          employee_code?: string | null
          full_name?: string
          id?: string
          joined_at?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed_at: string | null
          id: string
          lesson_id: string
          updated_at: string
          user_id: string
          watched_seconds: number
        }
        Insert: {
          completed_at?: string | null
          id?: string
          lesson_id: string
          updated_at?: string
          user_id: string
          watched_seconds?: number
        }
        Update: {
          completed_at?: string | null
          id?: string
          lesson_id?: string
          updated_at?: string
          user_id?: string
          watched_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          course_id: string
          created_at: string
          duration_seconds: number | null
          id: string
          key_notes: string | null
          pdf_url: string | null
          resources: Json
          sort_order: number
          title: string
          transcript: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          course_id: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          key_notes?: string | null
          pdf_url?: string | null
          resources?: Json
          sort_order?: number
          title: string
          transcript?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          key_notes?: string | null
          pdf_url?: string | null
          resources?: Json
          sort_order?: number
          title?: string
          transcript?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          created_at: string
          email: string
          id: number
          ip: string | null
          success: boolean
        }
        Insert: {
          created_at?: string
          email: string
          id?: number
          ip?: string | null
          success?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          id?: number
          ip?: string | null
          success?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      pending_bootstrap: {
        Row: {
          created_at: string
          email: string
          full_name: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
        }
        Relationships: []
      }
      question_options: {
        Row: {
          id: string
          is_correct: boolean
          option_text: string
          question_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          is_correct?: boolean
          option_text: string
          question_id: string
          sort_order?: number
        }
        Update: {
          id?: string
          is_correct?: boolean
          option_text?: string
          question_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          id: string
          image_url: string | null
          points: number
          prompt: string
          quiz_id: string
          sort_order: number
          type: Database["public"]["Enums"]["question_type"]
        }
        Insert: {
          id?: string
          image_url?: string | null
          points?: number
          prompt: string
          quiz_id: string
          sort_order?: number
          type?: Database["public"]["Enums"]["question_type"]
        }
        Update: {
          id?: string
          image_url?: string | null
          points?: number
          prompt?: string
          quiz_id?: string
          sort_order?: number
          type?: Database["public"]["Enums"]["question_type"]
        }
        Relationships: [
          {
            foreignKeyName: "questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          finished_at: string | null
          id: string
          passed: boolean | null
          quiz_id: string
          score_percent: number | null
          started_at: string
          user_id: string
        }
        Insert: {
          finished_at?: string | null
          id?: string
          passed?: boolean | null
          quiz_id: string
          score_percent?: number | null
          started_at?: string
          user_id: string
        }
        Update: {
          finished_at?: string | null
          id?: string
          passed?: boolean | null
          quiz_id?: string
          score_percent?: number | null
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          course_id: string | null
          created_at: string
          id: string
          lesson_id: string | null
          max_attempts: number | null
          pass_percent: number
          randomize: boolean
          time_limit_seconds: number | null
          title: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          id?: string
          lesson_id?: string | null
          max_attempts?: number | null
          pass_percent?: number
          randomize?: boolean
          time_limit_seconds?: number | null
          title: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          id?: string
          lesson_id?: string | null
          max_attempts?: number | null
          pass_percent?: number
          randomize?: boolean
          time_limit_seconds?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role:
        | "super_admin"
        | "hr_admin"
        | "regional_manager"
        | "center_head_doctor"
        | "front_office"
        | "therapist"
        | "trainer"
        | "auditor"
      employee_status: "active" | "disabled" | "pending"
      question_type: "mcq" | "true_false" | "image"
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
      app_role: [
        "super_admin",
        "hr_admin",
        "regional_manager",
        "center_head_doctor",
        "front_office",
        "therapist",
        "trainer",
        "auditor",
      ],
      employee_status: ["active", "disabled", "pending"],
      question_type: ["mcq", "true_false", "image"],
    },
  },
} as const
