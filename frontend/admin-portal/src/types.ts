export interface Professional {
  id: string;
  display_name?: string;
  displayName?: string;
  license_type?: string;
  licenseType?: string;
  license_number?: string;
  licenseNumber?: string;
  email?: string | null;
  roles: string[];
}

export interface AuthResult {
  access_token: string;
  expires_at: string;
  professional: Professional;
}

export type JsonRecord = Record<string, unknown>;

