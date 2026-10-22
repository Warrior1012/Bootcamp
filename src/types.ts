export interface CompanyRecord {
  company_id: number;
  name: string | null;
  short_name: string | null;
  category: string | null;
  incorporation_year: string | number | null;
  nature_of_company: string | null;
  headquarters_address: string | null;
  employee_size: string | number | null;
  website_url: string | null;
  overview_text: string | null;
}

export interface CompanyProfileRecord {
  company_id: number;
  short_json: Record<string, unknown> | null;
  full_json: Record<string, unknown> | null;
}

export interface SkillSetRecord {
  skill_set_id: number;
  skill_set_name: string | null;
  short_name: string | null;
  skill_set_description: string | null;
}

export interface SkillRequirementRecord {
  company_id: number;
  skill_set_id: number;
  required_level: number | string | null;
  required_proficiency_level_id: number | string | null;
}

export interface SkillTopicRecord {
  skill_set_id: number;
  level_number: number | string | null;
  topics: string | null;
}

export interface ProficiencyLevelRecord {
  proficiency_level_id: number | string;
  proficiency_name: string | null;
  proficiency_code: string | null;
  proficiency_description: string | null;
}

export interface AppData {
  companies: CompanyRecord[];
  profiles: CompanyProfileRecord[];
  skills: SkillSetRecord[];
  requirements: SkillRequirementRecord[];
  topics: SkillTopicRecord[];
  proficiency: ProficiencyLevelRecord[];
}

export interface SkillWithDetails extends SkillSetRecord {
  req: SkillRequirementRecord | undefined;
  proficiency: ProficiencyLevelRecord | undefined;
  topics: SkillTopicRecord[];
}

export interface ProfileField {
  label: string;
  value: unknown;
  href?: string | null;
}
