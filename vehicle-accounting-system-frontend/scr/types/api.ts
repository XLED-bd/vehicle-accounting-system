/**
 * TypeScript типы для API
 * Сгенерированы на основе OpenAPI схемы
 */

// Базовые типы
export type UserRole = 'administrator' | 'operator';
export type PassStatus = 'pending' | 'running' | 'complete' | 'failed';
export type PassDirection = 'entry' | 'exit' | 'unknown';

// Auth
export interface LoginRequest {
  username: string;
  password: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface UserResponse {
  id: number;
  username: string;
  role: UserRole;
  employee_id: number | null;
  is_active: boolean;
  created_at: string;
}

export interface UserCreate {
  username: string;
  password: string;
  role?: UserRole;
  employee_id?: number | null;
}

export interface UserUpdate {
  username?: string;
  password?: string;
  role?: UserRole;
  employee_id?: number | null;
  is_active?: boolean;
}

// Employee
export interface EmployeeResponse {
  id: number;
  full_name: string;
  position: string | null;
  contact_info: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface EmployeeCreate {
  full_name: string;
  position?: string | null;
  contact_info?: string | null;
}

export interface EmployeeUpdate {
  full_name?: string;
  position?: string | null;
  contact_info?: string | null;
}

// Vehicle
export interface VehicleResponse {
  id: number;
  plate_number: string;
  transport_type: string | null;
  employee_id: number | null;
  is_guest: boolean;
  on_territory: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface VehicleWithEmployee extends VehicleResponse {
  employee: EmployeeResponse | null;
}

export interface VehicleCreate {
  plate_number: string;
  transport_type?: string | null;
  employee_id?: number | null;
  is_guest?: boolean;
}

export interface VehicleUpdate {
  plate_number?: string;
  transport_type?: string | null;
  employee_id?: number | null;
  is_guest?: boolean;
  on_territory?: boolean;
}

// Access
export interface AccessResponse {
  id: number;
  vehicle_id: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface AccessWithVehicle extends AccessResponse {
  vehicle: VehicleResponse | null;
}

export interface AccessCreate {
  vehicle_id: number;
  valid_from: string;
  valid_until?: string | null;
  is_active?: boolean;
}

export interface AccessUpdate {
  valid_from?: string;
  valid_until?: string | null;
  is_active?: boolean;
}

// Pass (Event)
export interface PassResponse {
  id: number;
  uuid: string;
  vehicle_id: number | null;
  plate_number_detected: string | null;
  direction: PassDirection | null;
  video_path: string;
  confidence_level: number | null;
  processing_time: number | null;
  status: PassStatus;
  logs: string | null;
  entry_exit_time: string | null;
  is_registered: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface EventResponse {
  uuid: string;
  status: PassStatus;
  plate_number: string | null;
  direction: PassDirection | null;
  confidence_level: number | null;
  is_registered: boolean;
  entry_exit_time: string | null;
  vehicle: VehicleWithEmployee | null;
  employee: EmployeeResponse | null;
  processing_time: number | null;
  logs: string | null;
  created_at: string;
}

// Video
export interface VideoProcessResponse {
  uuid: string;
  status: string;
  message: string;
}

// Statistics
export interface StatisticsResponse {
  total_passes: number;
  successful_passes: number;
  failed_passes: number;
  pending_passes: number;
  registered_vehicles: number;
  unregistered_entries: number;
  vehicles_on_territory: number;
}

// API Error
export interface APIError {
  detail: string;
}

// Pagination
export interface PaginationParams {
  skip?: number;
  limit?: number;
}
