/**
 * Type definitions for Legislative Red Team database schema
 */

/**
 * US Code table row
 */
export interface UsCode {
  citation: string; // Primary key
  text: string;
  identifier_path: string;
  embedding?: number[]; // vector type
  created_at?: string;
  updated_at?: string;
}

/**
 * Bills table row
 */
export interface Bill {
  congress_id: string; // Primary key (e.g., "118-hr-1234")
  last_version_xml?: string | null;
  title?: string | null;
  sponsor?: string | null;
  introduced_date?: string | null;
  status?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Loopholes table row
 */
export interface Loophole {
  id?: number; // Auto-generated
  bill_id?: string | null; // Foreign key to bills
  type: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  affected_sections?: string[] | null;
  detected_at?: string;
  reviewed?: boolean;
  reviewed_at?: string | null;
  reviewer_notes?: string | null;
}

/**
 * Database interface for type-safe queries
 */
export interface Database {
  public: {
    Tables: {
      us_code: {
        Row: UsCode;
        Insert: Omit<UsCode, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<UsCode, 'created_at' | 'updated_at'>>;
      };
      bills: {
        Row: Bill;
        Insert: Omit<Bill, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Bill, 'created_at' | 'updated_at'>>;
      };
      loopholes: {
        Row: Loophole;
        Insert: Omit<Loophole, 'id' | 'detected_at'>;
        Update: Partial<Omit<Loophole, 'id' | 'detected_at'>>;
      };
    };
  };
}
