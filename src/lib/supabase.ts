import { createClient } from '@supabase/supabase-js';
import type {
  CompanyProfileRecord,
  CompanyRecord,
  ProficiencyLevelRecord,
  SkillRequirementRecord,
  SkillSetRecord,
  SkillTopicRecord,
} from '../types';

// These are public browser-side values. Database access must remain restricted by Supabase RLS.
const url =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  'https://twitxvgayfqboufavuqd.supabase.co';
const key =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  'sb_publishable_dPYyPoltKOVUvZccQbmeBQ_fTd7oc_5';

export const supabase = url && key ? createClient(url, key) : null;

type Row = Record<string, unknown>;
type QueryResponse<T> = { data: T[] | null; error: { message: string } | null };

async function optionalRows<T extends Row = Row>(
  name: string,
  request: PromiseLike<QueryResponse<T>>,
  warnings: string[],
): Promise<T[]> {
  try {
    const result = await request;
    if (result.error) {
      warnings.push(name);
      console.warn('Optional Supabase dataset unavailable:', name, result.error.message);
      return [];
    }
    return result.data ?? [];
  } catch (error) {
    warnings.push(name);
    console.warn('Optional Supabase dataset could not be read:', name, error);
    return [];
  }
}

function nonEmptyRecord(input: Row): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== ''),
  );
}

function mergeByCompany(
  destination: Map<number, Record<string, unknown>>,
  rows: Row[],
  fieldMap: Record<string, string>,
): void {
  for (const row of rows) {
    const companyId = Number(row.company_id);
    if (!Number.isFinite(companyId)) continue;
    const mapped: Row = {};
    for (const [column, key] of Object.entries(fieldMap)) {
      if (row[column] !== null && row[column] !== undefined && String(row[column]).trim() !== '') {
        mapped[key] = row[column];
      }
    }
    if (!Object.keys(mapped).length) continue;
    destination.set(companyId, { ...(destination.get(companyId) || {}), ...mapped });
  }
}

export async function loadData() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  const companyResult = await supabase
    .from('companies')
    .select('company_id,name,short_name,category,incorporation_year,nature_of_company,headquarters_address,employee_size,website_url,overview_text')
    .order('name');
  if (companyResult.error) throw companyResult.error;

  const warnings: string[] = [];
  const [
    profilesRaw,
    skills,
    requirements,
    topics,
    proficiency,
    logos,
    brand,
    compensation,
    talent,
    technology,
    leaders,
    recentNews,
    financials,
  ] = await Promise.all([
    optionalRows<Row>('company_json', supabase.from('company_json').select('company_id,short_json,full_json'), warnings),
    optionalRows<SkillSetRecord>('skill_set_master', supabase.from('skill_set_master').select('skill_set_id,skill_set_name,short_name,skill_set_description').order('skill_set_id'), warnings),
    optionalRows<SkillRequirementRecord>('company_skill_levels', supabase.from('company_skill_levels').select('company_id,skill_set_id,required_level,required_proficiency_level_id'), warnings),
    optionalRows<SkillTopicRecord>('skill_set_topics', supabase.from('skill_set_topics').select('skill_set_id,level_number,topics').order('level_number'), warnings),
    optionalRows<ProficiencyLevelRecord>('proficiency_levels', supabase.from('proficiency_levels').select('proficiency_level_id,proficiency_name,proficiency_code,proficiency_description').order('proficiency_level_id'), warnings),
    optionalRows<Row>('company_logo', supabase.from('company_logo').select('company_id,logo_url,company_logo_id').order('company_logo_id'), warnings),
    optionalRows<Row>('company_brand_reputation', supabase.from('company_brand_reputation').select('company_id,brand_sentiment_score,website_quality,website_rating,social_media_followers,glassdoor_rating,indeed_rating,google_rating'), warnings),
    optionalRows<Row>('company_compensation', supabase.from('company_compensation').select('company_id,fixed_vs_variable_pay,bonus_predictability'), warnings),
    optionalRows<Row>('company_talent_growth', supabase.from('company_talent_growth').select('company_id,training_spend,onboarding_quality,internal_mobility,role_clarity,early_ownership,execution_thinking_balance,automation_level,company_maturity,brand_value,skill_relevance,exposure_quality,external_recognition'), warnings),
    optionalRows<Row>('company_technologies', supabase.from('company_technologies').select('company_id,r_and_d_investment,ai_ml_adoption_level'), warnings),
    optionalRows<Row>('company_people', supabase.from('company_people').select('company_id,ceo_name,ceo_linkedin_url,contact_person_name,contact_person_title'), warnings),
    optionalRows<Row>('company_recent_news', supabase.from('company_recent_news').select('company_id,recent_news,recent_news_id').order('recent_news_id'), warnings),
    optionalRows<Row>('company_financials', supabase.from('company_financials').select('company_id,annual_revenue,annual_profit,valuation,yoy_growth_rate,profitability_status,total_capital_raised'), warnings),
  ]);

  const merged = new Map<number, CompanyProfileRecord>();
  for (const raw of profilesRaw) {
    const id = Number(raw.company_id);
    if (!Number.isFinite(id)) continue;
    const existing = merged.get(id) || { company_id: id, short_json: {}, full_json: {} };
    merged.set(id, {
      company_id: id,
      short_json: { ...(existing.short_json || {}), ...((raw.short_json as Record<string, unknown> | null) || {}) },
      full_json: { ...(existing.full_json || {}), ...((raw.full_json as Record<string, unknown> | null) || {}) },
    });
  }

  const supplement = new Map<number, Record<string, unknown>>();
  mergeByCompany(supplement, logos, { logo_url: 'logo_url' });
  mergeByCompany(supplement, brand, {
    brand_sentiment_score: 'brand_sentiment_score',
    website_quality: 'website_quality',
    website_rating: 'website_rating',
    social_media_followers: 'social_media_followers',
    glassdoor_rating: 'glassdoor_rating',
    indeed_rating: 'indeed_rating',
    google_rating: 'google_rating',
  });
  mergeByCompany(supplement, compensation, {
    fixed_vs_variable_pay: 'fixed_vs_variable_pay',
    bonus_predictability: 'bonus_predictability',
  });
  mergeByCompany(supplement, talent, {
    training_spend: 'training_spend',
    onboarding_quality: 'onboarding_quality',
    internal_mobility: 'internal_mobility',
    role_clarity: 'role_clarity',
    early_ownership: 'early_ownership',
    execution_thinking_balance: 'execution_thinking_balance',
    automation_level: 'automation_level',
    company_maturity: 'company_maturity',
    brand_value: 'brand_value',
    skill_relevance: 'skill_relevance',
    exposure_quality: 'exposure_quality',
    external_recognition: 'external_recognition',
  });
  mergeByCompany(supplement, technology, {
    r_and_d_investment: 'r_and_d_investment',
    ai_ml_adoption_level: 'ai_ml_adoption_level',
  });
  mergeByCompany(supplement, leaders, {
    ceo_name: 'ceo_name',
    ceo_linkedin_url: 'ceo_linkedin_url',
    contact_person_name: 'contact_person_name',
    contact_person_title: 'contact_person_title',
  });
  mergeByCompany(supplement, financials, {
    annual_revenue: 'annual_revenue',
    annual_profit: 'annual_profit',
    valuation: 'valuation',
    yoy_growth_rate: 'yoy_growth_rate',
    profitability_status: 'profitability_status',
    total_capital_raised: 'total_capital_raised',
  });
  const newsByCompany = new Map<number, string[]>();
  for (const row of recentNews) {
    const id = Number(row.company_id);
    if (!Number.isFinite(id) || typeof row.recent_news !== 'string' || !row.recent_news.trim()) continue;
    newsByCompany.set(id, [...(newsByCompany.get(id) || []), row.recent_news.trim()]);
  }
  for (const [id, news] of newsByCompany) {
    supplement.set(id, { ...(supplement.get(id) || {}), recent_news: news.join(' · ') });
  }

  for (const [id, values] of supplement) {
    const record = merged.get(id) || { company_id: id, short_json: {}, full_json: {} };
    const existingShort = nonEmptyRecord((record.short_json || {}) as Row);
    const existingFull = nonEmptyRecord((record.full_json || {}) as Row);
    merged.set(id, {
      company_id: id,
      short_json: { ...values, ...existingShort },
      // Prefer normalized tables when they have a value, then retain the richer JSON profile.
      full_json: { ...existingFull, ...values },
    });
  }

  if (!profilesRaw.length && companyResult.data.length) warnings.push('company_json (no visible profile rows)');
  if (!skills.length) warnings.push('skill_set_master (no visible skill rows)');
  if (!topics.length) warnings.push('skill_set_topics (no visible topic rows)');
  if (!requirements.length) warnings.push('company_skill_levels (no visible company-specific requirements)');
  const uniqueWarnings = [...new Set(warnings)];

  return {
    companies: (companyResult.data ?? []) as CompanyRecord[],
    profiles: [...merged.values()],
    skills,
    requirements,
    topics,
    proficiency,
    warnings: uniqueWarnings,
  };
}
