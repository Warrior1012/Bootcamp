import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const supabase = url && key ? createClient(url, key) : null;
export async function loadData() {
 if (!supabase) throw new Error('Supabase not configured. Copy .env.example to .env.local and add the publishable/anon key.');
 const results = await Promise.all([
  supabase.from('companies').select('company_id,name,short_name,category,incorporation_year,nature_of_company,headquarters_address,employee_size,website_url,overview_text').order('name'),
  supabase.from('company_json').select('company_id,short_json,full_json'),
  supabase.from('skill_set_master').select('skill_set_id,skill_set_name,short_name,skill_set_description').order('skill_set_id'),
  supabase.from('company_skill_levels').select('company_id,skill_set_id,required_level,required_proficiency_level_id'),
  supabase.from('skill_set_topics').select('skill_set_id,level_number,topics').order('level_number'),
  supabase.from('proficiency_levels').select('proficiency_level_id,proficiency_name,proficiency_code,proficiency_description').order('proficiency_level_id')
 ]);
 const failed = results.find(x => x.error)?.error;
 if (failed) throw failed;
 return { companies:results[0].data??[], profiles:results[1].data??[], skills:results[2].data??[], requirements:results[3].data??[], topics:results[4].data??[], proficiency:results[5].data??[] };
}
