import { useEffect, useState } from 'react';
import {
  Building2,
  BrainCircuit,
  Search,
  RefreshCw,
  Database,
  AlertCircle,
  Bookmark,
  CalendarDays,
  ClipboardList,
  Globe,
  MapPin,
  Star,
  Target,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { loadData } from './lib/supabase';
import type {
  AppData,
  CompanyRecord,
  ProfileField,
  ProficiencyLevelRecord,
  SkillRequirementRecord,
  SkillSetRecord,
  SkillTopicRecord,
  SkillWithDetails,
} from './types';

type AppTab = 'companies' | 'skills' | 'tracker';
type AppView = AppTab | 'privacy' | 'terms';

type TrackerStatus =
  | 'Not tracked' | 'Interested' | 'Researching' | 'Applied'
  | 'Assessment' | 'Interview' | 'Offer' | 'Rejected' | 'Not pursuing';

type CompanyTrackerEntry = {
  saved: boolean;
  status: TrackerStatus;
  notes: string;
  followUpDate: string;
  updatedAt: string;
};
type TrackerStore = Record<string, CompanyTrackerEntry>;

const TRACKER_STORAGE_KEY = 'jssu-placement-tracker-v1';
const TRACKER_STATUSES: TrackerStatus[] = [
  'Not tracked', 'Interested', 'Researching', 'Applied',
  'Assessment', 'Interview', 'Offer', 'Rejected', 'Not pursuing',
];
const EMPTY_TRACKER_ENTRY: CompanyTrackerEntry = {
  saved: false, status: 'Not tracked', notes: '', followUpDate: '', updatedAt: '',
};

function readTrackerStore(): TrackerStore {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(TRACKER_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<CompanyTrackerEntry>>;
    if (!parsed || typeof parsed !== 'object') return {};
    const clean: TrackerStore = {};
    for (const [id, item] of Object.entries(parsed)) {
      if (!item || typeof item !== 'object') continue;
      clean[id] = {
        ...EMPTY_TRACKER_ENTRY,
        saved: Boolean(item.saved),
        status: TRACKER_STATUSES.includes(item.status as TrackerStatus) ? item.status as TrackerStatus : 'Not tracked',
        notes: typeof item.notes === 'string' ? item.notes : '',
        followUpDate: typeof item.followUpDate === 'string' ? item.followUpDate : '',
        updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : '',
      };
    }
    return clean;
  } catch {
    return {};
  }
}

function isTrackedEntry(item: CompanyTrackerEntry): boolean {
  return item.saved || item.status !== 'Not tracked' || Boolean(item.notes.trim()) || Boolean(item.followUpDate);
}

function findValueByKey(value: unknown, pattern: RegExp, depth = 0): unknown {
  if (depth > 7 || !value || typeof value !== 'object') return null;
  for (const [key, child] of Object.entries(value)) {
    if (pattern.test(key) && (typeof child === 'string' || typeof child === 'number')) {
      const candidate = String(child).trim();
      if (candidate && !/^n\/?a$/i.test(candidate)) return child;
    }
    if (child && typeof child === 'object') {
      const found = findValueByKey(child, pattern, depth + 1);
      if (found !== null && found !== undefined) return found;
    }
  }
  return null;
}

function socialUrl(value: unknown, platform: 'x' | 'generic' = 'generic'): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (platform === 'x' && /^@[\w]+$/.test(raw)) return 'https://x.com/' + raw.slice(1);
  return externalUrl(raw);
}

type HashRoute = {
  tab: AppView;
  companyId: string | null;
};

function readHashRoute(hash?: string): HashRoute {
  const value = (hash ?? (typeof window === 'undefined' ? '' : window.location.hash)).replace(/^#/, '');

  if (value === 'privacy' || value === 'terms') {
    return { tab: value, companyId: null };
  }

  const params = new URLSearchParams(value);
  const requestedTab = params.get('tab');
  const tab: AppTab = requestedTab === 'skills' ? 'skills' : requestedTab === 'tracker' ? 'tracker' : 'companies';

  return {
    tab,
    companyId: params.get('company'),
  };
}

function appHash(tab: AppTab, companyId: number | null): string {
  if (companyId === null) return '#tab=' + tab;
  return '#company=' + encodeURIComponent(String(companyId)) + '&tab=' + tab;
}

function replaceHash(hash: string): void {
  if (typeof window === 'undefined' || window.location.hash === hash) return;
  window.history.replaceState(
    window.history.state,
    '',
    window.location.pathname + window.location.search + hash,
  );
}

function externalUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  if (!input || /\s/.test(input)) return null;

  const candidate = /^https?:\/\//i.test(input)
    ? input
    : /^(?:www\.)?[\w.-]+\.[a-z]{2,}(?:[/:?#].*)?$/i.test(input)
      ? 'https://' + input
      : null;

  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function findLinkedInUrl(value: unknown, depth = 0): string | null {
  if (depth > 6 || !value || typeof value !== 'object') return null;

  for (const [key, child] of Object.entries(value)) {
    if (/linkedin/i.test(key) && typeof child === 'string') {
      const url = externalUrl(child);
      if (url) {
        const host = new URL(url).hostname.toLowerCase();
        if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) return url;
      }
    }
    if (child && typeof child === 'object') {
      const found = findLinkedInUrl(child, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function categoryOf(company: CompanyRecord): string {
  const category = typeof company.category === 'string' ? company.category.trim() : '';
  const nature = typeof company.nature_of_company === 'string' ? company.nature_of_company.trim() : '';
  return category || nature || 'Not available';
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return 'Not available';
  if (typeof value === 'string') return value.trim() || 'Not available';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return 'Not available';
}

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function routeCompany(companies: CompanyRecord[], routeId: string | null): CompanyRecord | null {
  if (routeId !== null) {
    const match = companies.find((company) => String(company.company_id) === routeId);
    if (match) return match;
  }
  return companies[0] ?? null;
}

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(true);
  const [q, setQ] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [tab, setTab] = useState<AppView>(() => readHashRoute().tab);
  const [tracker, setTracker] = useState<TrackerStore>(() => readTrackerStore());
  const [directoryMode, setDirectoryMode] = useState<'all' | 'saved' | 'tracked'>('all');
  const [skillQuery, setSkillQuery] = useState('');
  const [requiredOnly, setRequiredOnly] = useState(false);
  const [comparisonIds, setComparisonIds] = useState<number[]>([]);

  async function refresh() {
    setBusy(true);
    setErr(false);
    try {
      const result = await loadData();
      setData(result);
      setPage(1);
    } catch (error) {
      console.error('Could not load company data.', error);
      setErr(true);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(TRACKER_STORAGE_KEY, JSON.stringify(tracker));
    } catch {
      // Keep the dashboard functional when browser storage is disabled or full.
    }
  }, [tracker]);

  useEffect(() => {
    function syncFromHash() {
      const route = readHashRoute();
      setTab(route.tab);

      if (route.tab === 'privacy' || route.tab === 'terms') return;

      if (!data) {
        if (route.companyId !== null) {
          const parsedId = Number(route.companyId);
          setSelected(Number.isFinite(parsedId) ? parsedId : null);
        }
        return;
      }

      const company = routeCompany(data.companies || [], route.companyId);
      setSelected(company ? company.company_id : null);
      const normalizedHash = appHash(route.tab, company ? company.company_id : null);
      replaceHash(normalizedHash);
    }

    window.addEventListener('hashchange', syncFromHash);
    syncFromHash();
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, [data]);

  const allCompanies: CompanyRecord[] = data?.companies || [];
  const categories = Array.from(
    new Set<string>(allCompanies.map((company) => categoryOf(company))),
  ).sort((a: string, b: string) => a.localeCompare(b));
  const needle = q.trim().toLowerCase();
  const companies = allCompanies.filter((company) => {
    const searchable = [
      company.name,
      company.short_name,
      company.category,
      company.nature_of_company,
      company.headquarters_address,
    ]
      .filter((value) => hasValue(value))
      .join(' ')
      .toLowerCase();

    const savedProfile = (data?.profiles || []).find((item) => String(item.company_id) === String(company.company_id));
    const extendedSearch = [
      ...Object.values(savedProfile?.short_json || {}),
      ...Object.values(savedProfile?.full_json || {}),
    ].filter((value) => typeof value === 'string').join(' ').toLowerCase();
    const item = tracker[String(company.company_id)] || EMPTY_TRACKER_ENTRY;
    return (searchable + ' ' + extendedSearch).includes(needle) &&
      (categoryFilter === 'all' || categoryOf(company) === categoryFilter) &&
      (directoryMode === 'all' ||
        (directoryMode === 'saved' && item.saved) ||
        (directoryMode === 'tracked' && isTrackedEntry(item)));
  });

  const totalPages = Math.max(1, Math.ceil(companies.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const visibleCompanies = companies.slice(startIndex, startIndex + pageSize);
  const rangeStart = companies.length ? startIndex + 1 : 0;
  const rangeEnd = Math.min(startIndex + pageSize, companies.length);

  const current = allCompanies.find((company) => String(company.company_id) === String(selected));
  const profile = (data?.profiles || []).find(
    (item) => String(item.company_id) === String(selected),
  );
  const full: Record<string, unknown> = {
    ...(profile?.short_json || {}),
    ...(profile?.full_json || {}),
    ...(current || {}),
  };
  const websiteUrl = externalUrl(current?.website_url);
  const linkedinUrl = findLinkedInUrl(full);

  const requirements: SkillRequirementRecord[] = (data?.requirements || []).filter(
    (item) => String(item.company_id) === String(selected),
  );
  const skills: SkillWithDetails[] = (data?.skills || [])
    .map((skill: SkillSetRecord) => {
      const requirement = requirements.find(
        (item) => String(item.skill_set_id) === String(skill.skill_set_id),
      );
      const proficiency = requirement
        ? (data?.proficiency || []).find(
            (item: ProficiencyLevelRecord) =>
              String(item.proficiency_level_id) ===
              String(requirement.required_proficiency_level_id),
          )
        : undefined;
      return {
        ...skill,
        req: requirement,
        proficiency,
        topics: (data?.topics || []).filter(
          (topic: SkillTopicRecord) => String(topic.skill_set_id) === String(skill.skill_set_id),
        ),
      };
    })
    .sort((a, b) => {
      const levelA = a.req?.required_level;
      const levelB = b.req?.required_level;
      const hasLevelA = hasValue(levelA) && Number.isFinite(Number(levelA));
      const hasLevelB = hasValue(levelB) && Number.isFinite(Number(levelB));

      if (hasLevelA && hasLevelB) return Number(levelB) - Number(levelA);
      if (hasLevelA) return -1;
      if (hasLevelB) return 1;
      return displayValue(a.skill_set_name).localeCompare(displayValue(b.skill_set_name));
    });

  const entry = current ? tracker[String(current.company_id)] || EMPTY_TRACKER_ENTRY : EMPTY_TRACKER_ENTRY;
  const logoUrl = socialUrl(full.logo_url);
  const xUrl = socialUrl(full.twitter_url || full.x_url || full.twitter_handle, 'x');
  const instagramUrl = socialUrl(findValueByKey(full, /instagram.*url/i));
  const facebookUrl = socialUrl(findValueByKey(full, /facebook.*url/i));
  const youtubeUrl = socialUrl(findValueByKey(full, /youtube.*url|youtube_channel/i));
  const careerUrl = socialUrl(findValueByKey(full, /career.*url|job.*portal.*url|recruitment.*url/i));
  const profileLinks = [
    ...(websiteUrl ? [{ label: 'Official website', href: websiteUrl }] : []),
    ...(linkedinUrl ? [{ label: 'LinkedIn', href: linkedinUrl }] : []),
    ...(instagramUrl ? [{ label: 'Instagram', href: instagramUrl }] : []),
    ...(facebookUrl ? [{ label: 'Facebook', href: facebookUrl }] : []),
    ...(xUrl ? [{ label: 'X / Twitter', href: xUrl }] : []),
    ...(youtubeUrl ? [{ label: 'YouTube', href: youtubeUrl }] : []),
    ...(careerUrl ? [{ label: 'Careers page', href: careerUrl }] : []),
    ...(current?.name ? [{ label: 'Find jobs', href: 'https://www.linkedin.com/jobs/search/?keywords=' + encodeURIComponent(current.name) }] : []),
    ...(current?.name ? [{ label: 'Search internships', href: 'https://www.google.com/search?q=' + encodeURIComponent(current.name + ' internships careers') }] : []),
  ];
  const signalFields: [string, unknown][] = [
    ['CEO / leadership', full.ceo_name || full.key_leaders],
    ['Technology stack', full.tech_stack],
    ['Focus sectors', full.focus_sectors],
    ['Hiring velocity', full.hiring_velocity],
    ['Learning culture', full.learning_culture || full.training_spend],
    ['Work culture', full.work_culture_summary || full.core_values],
    ['Recent news', full.recent_news],
    ['Key competitors', full.key_competitors],
    ['Growth signal', full.yoy_growth_rate],
  ].filter((item) => hasValue(item[1]));
  const profileFields: ProfileField[] = current
    ? [
        { label: 'Category', value: current.category },
        { label: 'Company type', value: current.nature_of_company },
        { label: 'Founded', value: current.incorporation_year },
        { label: 'Vision', value: full.vision_statement },
        { label: 'Mission', value: full.mission_statement },
        { label: 'Headquarters', value: current.headquarters_address },
        { label: 'Website', value: current.website_url, href: websiteUrl },
        ...(linkedinUrl ? [{ label: 'LinkedIn', value: 'View company profile', href: linkedinUrl }] : []),
      ]
    : [];

  const trackedCompanies = allCompanies.filter((company) => isTrackedEntry(tracker[String(company.company_id)] || EMPTY_TRACKER_ENTRY));
  const savedCount = allCompanies.filter((company) => (tracker[String(company.company_id)] || EMPTY_TRACKER_ENTRY).saved).length;
  const activeCount = trackedCompanies.filter((company) =>
    ['Applied', 'Assessment', 'Interview', 'Offer'].includes((tracker[String(company.company_id)] || EMPTY_TRACKER_ENTRY).status),
  ).length;
  const todayKey = new Date().toLocaleDateString('en-CA');
  const followUpsDue = trackedCompanies.filter((company) => {
    const date = (tracker[String(company.company_id)] || EMPTY_TRACKER_ENTRY).followUpDate;
    return Boolean(date) && date <= todayKey;
  });
  const visibleSkills = skills.filter((skill) => {
    const text = [skill.skill_set_name, skill.short_name, skill.skill_set_description, ...skill.topics.map((topic) => topic.topics || '')].join(' ').toLowerCase();
    return text.includes(skillQuery.trim().toLowerCase()) && (!requiredOnly || Boolean(skill.req));
  });

  function updateTracker(companyId: number, patch: Partial<CompanyTrackerEntry>) {
    const id = String(companyId);
    setTracker((previous) => ({
      ...previous,
      [id]: { ...EMPTY_TRACKER_ENTRY, ...(previous[id] || {}), ...patch, updatedAt: new Date().toISOString() },
    }));
  }

  function toggleSaved(companyId: number) {
    const item = tracker[String(companyId)] || EMPTY_TRACKER_ENTRY;
    updateTracker(companyId, { saved: !item.saved });
  }

  function toggleComparison(companyId: number) {
    setComparisonIds((previous) => previous.includes(companyId)
      ? previous.filter((id) => id !== companyId)
      : previous.length < 3 ? [...previous, companyId] : previous);
  }

  function companyLogo(companyId: number): string | null {
    const item = (data?.profiles || []).find((profileItem) => String(profileItem.company_id) === String(companyId));
    return socialUrl(item?.full_json?.logo_url || item?.short_json?.logo_url);
  }

  function writeRoute(hash: string) {
    if (window.location.hash !== hash) window.location.hash = hash.slice(1);
  }

  function navigateToAppTab(nextTab: AppTab) {
    const fallbackCompany = allCompanies.find(
      (company) => String(company.company_id) === String(selected),
    ) || allCompanies[0] || null;
    const companyId = fallbackCompany ? fallbackCompany.company_id : null;

    setTab(nextTab);
    setSelected(companyId);
    writeRoute(appHash(nextTab, companyId));
  }

  function navigateToStaticPage(nextTab: 'privacy' | 'terms') {
    setTab(nextTab);
    writeRoute('#' + nextTab);
  }

  function selectCompany(companyId: number, nextTab: AppTab, scrollToProfile: boolean) {
    setSelected(companyId);
    setTab(nextTab);
    writeRoute(appHash(nextTab, companyId));

    if (
      scrollToProfile &&
      window.matchMedia('(max-width: 780px)').matches
    ) {
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth';
      window.requestAnimationFrame(() => {
        document.getElementById('company-profile')?.scrollIntoView({
          behavior,
          block: 'start',
        });
      });
    }
  }

  const selectedForSkills = current ? String(current.company_id) : '';

  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <span>J</span>
          <div>
            <b>JSSU</b>
            <small>Placement Intelligence Hub</small>
          </div>
        </div>
        <p className="label">WORKSPACE</p>
        <button
          className={tab === 'companies' ? 'nav active' : 'nav'}
          aria-current={tab === 'companies' ? 'page' : undefined}
          onClick={() => navigateToAppTab('companies')}
        >
          <Building2 size={17} /> Company directory
        </button>
        <button
          className={tab === 'skills' ? 'nav active' : 'nav'}
          aria-current={tab === 'skills' ? 'page' : undefined}
          onClick={() => navigateToAppTab('skills')}
        >
          <BrainCircuit size={17} /> Skill intelligence
        </button>
        <button
          className={tab === 'tracker' ? 'nav active' : 'nav'}
          aria-current={tab === 'tracker' ? 'page' : undefined}
          onClick={() => navigateToAppTab('tracker')}
        >
          <ClipboardList size={17} /> My tracker
          {trackedCompanies.length > 0 && <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800 }}>{trackedCompanies.length}</span>}
        </button>
        <div className="connection">
          <i style={{ background: data ? '#19a66a' : '#e7a23b' }} />
          <div>
            <b>Company data</b>
            <small>{data ? 'Company information available' : 'Company directory'}</small>
          </div>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <span className="eyebrow">JSS UNIVERSITY, NOIDA</span>
            <h1>
              {tab === 'companies'
                ? 'Company directory'
                : tab === 'skills'
                  ? 'Skill intelligence'
                  : tab === 'tracker'
                    ? 'Company tracker'
                    : tab === 'privacy'
                      ? 'Privacy'
                      : 'Terms'}
            </h1>
          </div>
          <button
            className="refresh"
            onClick={() => void refresh()}
            disabled={busy}
            aria-label="Refresh data"
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </header>

        {err && (
          <div className="alert" role="alert">
            <AlertCircle size={18} />
            <div>
              <b>Could not load company data. Please try again.</b>
              <button
                type="button"
                className="page-button"
                onClick={() => void refresh()}
                disabled={busy}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {!busy && data && tab !== 'privacy' && tab !== 'terms' && (
          <section className="stats" aria-label="Workspace summary" style={{ marginBottom: 20, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
            <div><small>Companies</small><b>{allCompanies.length}</b></div>
            <div><small>Saved</small><b>{savedCount}</b></div>
            <div><small>In progress</small><b>{activeCount}</b></div>
            <div><small>Follow-ups due</small><b>{followUpsDue.length}</b></div>
          </section>
        )}
        {data?.warnings && data.warnings.length > 0 && tab !== 'privacy' && tab !== 'terms' && (
          <div className="note" role="status" style={{ marginBottom: 16, marginTop: 0 }}>
            <Database size={15} /> Some optional datasets could not be loaded: {data.warnings.join(', ')}. Company browsing remains available.
          </div>
        )}

        {tab === 'privacy' ? (
          <section className="panel">
            <div className="details">
              <h3>Privacy</h3>
              <p>
                JSSU Placement Intelligence Hub presents read-only public company information,
                company profiles, skill requirements, and topic information from its configured dataset.
                Values that are not present in the dataset are shown as unavailable.
              </p>
              <p>
                This application does not provide visitor accounts or sign-in. Saved companies,
                application stages, follow-up dates and notes are stored in this browser and are not
                synced to an account or database. Avoid entering sensitive personal information.
                This statement does not make claims about logs or retention practices of the hosting
                or data providers.
              </p>
              <p>
                The interface loads fonts from Google Fonts. When those fonts are requested, the
                browser connects to Google to retrieve them. Refer to Google's own documentation
                for how its services process technical request information.
              </p>
              <div className="note">
                Add the owner's contact email before public release. Tracker information stays in this browser.
              </div>
              <p>
                <a href={appHash('companies', selected ?? (allCompanies[0]?.company_id ?? null))}>
                  Return to the company directory
                </a>
              </p>
            </div>
          </section>
        ) : tab === 'terms' ? (
          <section className="panel">
            <div className="details">
              <h3>Terms</h3>
              <p>
                JSSU Placement Intelligence Hub lets visitors browse read-only public company
                information and skill details available in the configured dataset. Some values may be missing or
                may change when the source data is updated.
              </p>
              <p>
                Company websites and social profile links, when available, open on external
                websites. The contents and availability of those external websites are outside this
                application's interface.
              </p>
              <p>
                Check important company details against the relevant company's own sources before
                relying on them.
              </p>
              <div className="note">
                TODO: Add the owner's contact email before public release.
              </div>
              <p>
                <a href={appHash('companies', selected ?? (allCompanies[0]?.company_id ?? null))}>
                  Return to the company directory
                </a>
              </p>
            </div>
          </section>
        ) : busy && !data ? (
          <div className="loading">Loading companies...</div>
        ) : data && tab === 'companies' ? (
          <div className="layout">
            <section className="panel list">
              <div className="panel-title">
                <div>
                  <h2>Companies</h2>
                  <p>{allCompanies.length} total companies</p>
                </div>
                <span>{companies.length} results</span>
              </div>

              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 12 }}>
                {([
                  ['all', 'All companies'],
                  ['saved', 'Saved'],
                  ['tracked', 'Tracked'],
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    className="page-button"
                    aria-pressed={directoryMode === mode}
                    onClick={() => { setDirectoryMode(mode); setPage(1); }}
                    style={directoryMode === mode ? { background: '#e4e9de', boxShadow: 'inset 0 0 0 1px #788a79' } : undefined}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <label className="search">
                <Search size={16} />
                <input
                  value={q}
                  onChange={(event) => {
                    setQ(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search name, sector or location"
                  aria-label="Search companies"
                />
              </label>

              <label className="filter-control">
                <span>Filter by category</span>
                <select
                  className="filter-select"
                  value={categoryFilter}
                  onChange={(event) => {
                    setCategoryFilter(event.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter companies by category"
                >
                  <option value="all">All categories</option>
                  {categories.map((category: string) => (
                    <option value={category} key={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <div className="company-results" aria-live="polite">
                {visibleCompanies.map((company) => (
                  <button
                    className={'company ' + (selected === company.company_id ? 'chosen' : '')}
                    key={company.company_id}
                    aria-pressed={selected === company.company_id}
                    onClick={() => selectCompany(company.company_id, 'companies', true)}
                  >
                    <b className="mark" style={{ position: 'relative', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {(company.short_name || company.name || 'J').slice(0, 1)}
                      {companyLogo(company.company_id) && (
                        <img src={companyLogo(company.company_id) || undefined} alt="" loading="lazy"
                          onError={(event) => { event.currentTarget.style.display = 'none'; }}
                          style={{ position: 'absolute', inset: 2, width: 'calc(100% - 4px)', height: 'calc(100% - 4px)', objectFit: 'contain', background: '#fffef9' }} />
                      )}
                    </b>
                    <span>
                      <strong>{displayValue(company.name)}</strong>
                      <small>{categoryOf(company)}{(tracker[String(company.company_id)] || EMPTY_TRACKER_ENTRY).status !== 'Not tracked' ? ' · ' + (tracker[String(company.company_id)] || EMPTY_TRACKER_ENTRY).status : ''}</small>
                    </span>
                    {(tracker[String(company.company_id)] || EMPTY_TRACKER_ENTRY).saved && <Star size={14} aria-label="Saved company" fill="currentColor" />}
                  </button>
                ))}
                {visibleCompanies.length === 0 && (
                  <div className="empty-results">
                    <Search size={19} />
                    <b>No matching companies</b>
                    <span>Try another search or category.</span>
                    <button
                      type="button"
                      onClick={() => {
                        setQ('');
                        setCategoryFilter('all');
                        setPage(1);
                      }}
                    >
                      Clear filters
                    </button>
                  </div>
                )}
              </div>

              <div className="pagination">
                <div className="pagination-summary">
                  <span>
                    Showing <b>{rangeStart} to {rangeEnd}</b> of <b>{companies.length}</b>
                  </span>
                  <label className="page-size">
                    <span>Per page</span>
                    <select
                      value={pageSize}
                      onChange={(event) => {
                        setPageSize(Number(event.target.value));
                        setPage(1);
                      }}
                      aria-label="Companies per page"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                    </select>
                  </label>
                </div>
                <div className="pagination-actions">
                  <button
                    type="button"
                    className="page-button"
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    disabled={safePage <= 1}
                    aria-label="Previous company page"
                  >
                    <ChevronLeft size={15} /> Previous
                  </button>
                  <span className="page-count">{safePage} / {totalPages}</span>
                  <button
                    type="button"
                    className="page-button"
                    onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                    disabled={safePage >= totalPages}
                    aria-label="Next company page"
                  >
                    Next <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </section>

            <section className="panel profile" id="company-profile">
              {current ? (
                <>
                  <div className="profile-head">
                    <b className="mark big" style={{ position: 'relative', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {(current.short_name || current.name || 'J').slice(0, 1)}
                      {logoUrl && <img src={logoUrl} alt={displayValue(current.name) + ' logo'}
                        onError={(event) => { event.currentTarget.style.display = 'none'; }}
                        style={{ position: 'absolute', inset: 3, width: 'calc(100% - 6px)', height: 'calc(100% - 6px)', objectFit: 'contain', background: '#fffef9' }} />}
                    </b>
                    <div style={{ flex: 1 }}>
                      <span className="eyebrow">COMPANY PROFILE · ID {current.company_id}</span>
                      <h2>{displayValue(current.name)}</h2>
                      <p><MapPin size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {displayValue(current.headquarters_address)}</p>
                    </div>
                  </div>
                  <div style={{ padding: '12px 22px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, borderBottom: '1px solid #d8dbcf' }}>
                    <button type="button" className="page-button" onClick={() => toggleSaved(current.company_id)} aria-pressed={entry.saved}>
                      <Star size={14} fill={entry.saved ? 'currentColor' : 'none'} /> {entry.saved ? 'Saved to shortlist' : 'Save company'}
                    </button>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11, color: '#59665e', fontWeight: 700 }}>
                      Tracker
                      <select className="filter-select" value={entry.status}
                        onChange={(event) => updateTracker(current.company_id, { status: event.target.value as TrackerStatus })}
                        aria-label="Company tracker status" style={{ width: 'auto', minWidth: 138, padding: '7px 8px' }}>
                        {TRACKER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </label>
                    <button type="button" className="page-button" onClick={() => toggleComparison(current.company_id)} aria-pressed={comparisonIds.includes(current.company_id)}>
                      <Target size={14} /> {comparisonIds.includes(current.company_id) ? 'Remove comparison' : 'Compare'}
                    </button>
                    <button type="button" className="page-button" onClick={() => navigateToAppTab('tracker')}>
                      <ClipboardList size={14} /> Track & notes
                    </button>
                  </div>
                  <div className="stats">
                    <div>
                      <small>Employee size</small>
                      <b>{displayValue(current.employee_size)}</b>
                    </div>
                    <div>
                      <small>Skill requirements</small>
                      <b>{requirements.length}</b>
                    </div>
                    <div>
                      <small>Founded</small>
                      <b>{displayValue(current.incorporation_year)}</b>
                    </div>
                  </div>
                  <div className="details">
                    <h3>Company overview</h3>
                    <p>{displayValue(full.overview_text || full.company_overview)}</p>
                    {profileFields.map((field) => (
                      <div className="field" key={field.label}>
                        <span>{field.label}</span>
                        <b>
                          {field.href ? (
                            <a
                              className="external-link"
                              href={field.href}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {displayValue(field.value)} <ExternalLink size={13} />
                            </a>
                          ) : (
                            displayValue(field.value)
                          )}
                        </b>
                      </div>
                    ))}
                    <div style={{ marginTop: 18 }}>
                      <h3>Company links</h3>
                      <p style={{ marginBottom: 12 }}>Links from the company profile, alongside clearly labelled job-search shortcuts.</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {profileLinks.map((link) => (
                          <a key={link.label} className="external-link page-button" href={link.href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                            {link.label} <ExternalLink size={12} />
                          </a>
                        ))}
                      </div>
                    </div>
                    {signalFields.length > 0 && (
                      <div style={{ marginTop: 22 }}>
                        <h3>Research signals</h3>
                        <p>Additional context available in the company profile dataset.</p>
                        {signalFields.map(([label, value]) => (
                          <div className="field" key={label}><span>{label}</span><b>{displayValue(value)}</b></div>
                        ))}
                      </div>
                    )}
                    <div style={{ marginTop: 22 }}>
                      <h3>Application notes</h3>
                      <p>Keep track of referrals, roles to target, questions and the next action.</p>
                      <label className="filter-control">
                        <span>Next follow-up date</span>
                        <input type="date" value={entry.followUpDate} onChange={(event) => updateTracker(current.company_id, { followUpDate: event.target.value })}
                          style={{ padding: '9px 10px', border: '1px solid #b9c0b2', borderRadius: 3, background: '#fffef9', color: '#293637', fontSize: 12 }} />
                      </label>
                      <label className="filter-control" style={{ marginTop: 12 }}>
                        <span>Notes (stored in this browser)</span>
                        <textarea value={entry.notes} onChange={(event) => updateTracker(current.company_id, { notes: event.target.value })}
                          placeholder="Example: tailor CV for embedded systems; ask alumni for a referral…" rows={3}
                          style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: 10, border: '1px solid #b9c0b2', borderRadius: 3, background: '#fffef9', color: '#293637', fontSize: 12, lineHeight: 1.6 }} />
                      </label>
                    </div>
                    {comparisonIds.length > 0 && (
                      <div style={{ marginTop: 22 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                          <h3>Company comparison ({comparisonIds.length}/3)</h3>
                          <button type="button" className="page-button" onClick={() => setComparisonIds([])}>Clear comparison</button>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, textAlign: 'left' }}>
                            <thead><tr>
                              <th style={{ padding: '9px 8px', borderBottom: '1px solid #c9cec2' }}>Signal</th>
                              {comparisonIds.map((id) => <th key={id} style={{ padding: '9px 8px', borderBottom: '1px solid #c9cec2' }}>{displayValue(allCompanies.find((company) => company.company_id === id)?.short_name || allCompanies.find((company) => company.company_id === id)?.name)}</th>)}
                            </tr></thead>
                            <tbody>
                              {([
                                ['Category', (id: number) => allCompanies.find((company) => company.company_id === id)?.category],
                                ['Headquarters', (id: number) => allCompanies.find((company) => company.company_id === id)?.headquarters_address],
                                ['Founded', (id: number) => allCompanies.find((company) => company.company_id === id)?.incorporation_year],
                                ['Technology', (id: number) => (data?.profiles || []).find((item) => item.company_id === id)?.full_json?.tech_stack],
                                ['Growth', (id: number) => (data?.profiles || []).find((item) => item.company_id === id)?.full_json?.yoy_growth_rate],
                                ['Hiring velocity', (id: number) => (data?.profiles || []).find((item) => item.company_id === id)?.full_json?.hiring_velocity],
                              ] as const).map(([label, getValue]) => (
                                <tr key={label}>
                                  <td style={{ padding: '9px 8px', borderBottom: '1px solid #e0e2d9', color: '#59665e' }}>{label}</td>
                                  {comparisonIds.map((id) => <td key={id} style={{ padding: '9px 8px', borderBottom: '1px solid #e0e2d9', minWidth: 120 }}>{displayValue(getValue(id))}</td>)}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    <div className="note">
                      <Database size={15} /> Company details come from the configured dataset. Job-search shortcuts open external services; notes stay in browser storage.
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-profile">
                  <Building2 size={22} />
                  <h2>No company selected</h2>
                  <p>Select a company from the directory to view its profile.</p>
                </div>
              )}
            </section>
          </div>
        ) : data && tab === 'tracker' ? (
          <section className="panel skills">
            <div className="panel-title">
              <div><h2>My company tracker</h2><p>Shortlist companies, manage application stages and remember your next action.</p></div>
              <span>{trackedCompanies.length} tracked</span>
            </div>
            <div className="note" style={{ marginTop: 0, marginBottom: 18 }}>
              <Bookmark size={15} /> Saved companies, stages, dates and notes are stored only in this browser, not synced across devices or written to Supabase.
            </div>
            {followUpsDue.length > 0 && (
              <div className="alert" role="status">
                <CalendarDays size={18} />
                <div><b>{followUpsDue.length} follow-up{followUpsDue.length === 1 ? '' : 's'} due</b>
                  <p>Review your next action for {followUpsDue.map((company) => company.short_name || company.name).join(', ')}.</p>
                </div>
              </div>
            )}
            {trackedCompanies.length === 0 ? (
              <div className="empty-results">
                <ClipboardList size={24} /><b>Your tracker is empty</b>
                <span>Save a company or choose a tracker stage from any company profile to begin.</span>
                <button type="button" onClick={() => navigateToAppTab('companies')}>Explore companies</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 14 }}>
                {trackedCompanies.slice().sort((a, b) => {
                  const dateA = tracker[String(a.company_id)]?.followUpDate || '9999-12-31';
                  const dateB = tracker[String(b.company_id)]?.followUpDate || '9999-12-31';
                  return dateA.localeCompare(dateB);
                }).map((company) => {
                  const item = tracker[String(company.company_id)] || EMPTY_TRACKER_ENTRY;
                  const logo = companyLogo(company.company_id);
                  return (
                    <article key={company.company_id} className="skill" style={{ background: '#fffef9' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                        <div className="mark" style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                          {(company.short_name || company.name || 'J').slice(0, 1)}
                          {logo && <img src={logo} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} style={{ position: 'absolute', inset: 2, width: 'calc(100% - 4px)', height: 'calc(100% - 4px)', objectFit: 'contain', background: '#fffef9' }} />}
                        </div>
                        <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                          <b style={{ display: 'block', color: '#293637', fontSize: 13 }}>{displayValue(company.name)}</b>
                          <small style={{ display: 'block', marginTop: 4, color: '#69766d' }}>{categoryOf(company)} · ID {company.company_id}</small>
                          <button type="button" className="page-button" style={{ marginTop: 9 }} onClick={() => selectCompany(company.company_id, 'companies', true)}>Open company profile</button>
                        </div>
                        <label className="filter-control" style={{ width: 175, margin: 0 }}>
                          <span>Application stage</span>
                          <select className="filter-select" value={item.status} onChange={(event) => updateTracker(company.company_id, { status: event.target.value as TrackerStatus })}>
                            {TRACKER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                          </select>
                        </label>
                        <button type="button" className="page-button" onClick={() => toggleSaved(company.company_id)} aria-pressed={item.saved}>
                          <Star size={13} fill={item.saved ? 'currentColor' : 'none'} /> {item.saved ? 'Unsave' : 'Save'}
                        </button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, .65fr) minmax(0, 1.35fr)', gap: 12, marginTop: 14 }}>
                        <label className="filter-control" style={{ margin: 0 }}>
                          <span>Follow-up date</span>
                          <input type="date" value={item.followUpDate} onChange={(event) => updateTracker(company.company_id, { followUpDate: event.target.value })} style={{ padding: '9px 10px', border: '1px solid #b9c0b2', borderRadius: 3, background: '#fffef9', color: '#293637', fontSize: 12 }} />
                        </label>
                        <label className="filter-control" style={{ margin: 0 }}>
                          <span>Notes / next action</span>
                          <textarea value={item.notes} onChange={(event) => updateTracker(company.company_id, { notes: event.target.value })} rows={2} placeholder="What do you need to do next?" style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: 9, border: '1px solid #b9c0b2', borderRadius: 3, background: '#fffef9', color: '#293637', fontSize: 12, lineHeight: 1.5 }} />
                        </label>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ) : data && tab === 'skills' ? (
          <section className="panel skills">
            <label className="filter-control">
              <span>Select company</span>
              <select
                className="filter-select"
                value={selectedForSkills}
                onChange={(event) => {
                  const chosenCompany = allCompanies.find(
                    (company) => String(company.company_id) === event.target.value,
                  );
                  if (chosenCompany) selectCompany(chosenCompany.company_id, 'skills', false);
                }}
                aria-label="Select company for skill intelligence"
              >
                {allCompanies.length === 0 ? (
                  <option value="">Not available</option>
                ) : (
                  allCompanies.map((company) => (
                    <option key={company.company_id} value={String(company.company_id)}>
                      {displayValue(company.name)}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="search" style={{ marginTop: 14 }}>
              <Search size={16} />
              <input value={skillQuery} onChange={(event) => setSkillQuery(event.target.value)}
                placeholder="Search skills, tools or learning topics" aria-label="Search skill roadmap" />
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <button type="button" className="page-button" aria-pressed={requiredOnly}
                onClick={() => setRequiredOnly((value) => !value)}
                style={requiredOnly ? { background: '#e4e9de', boxShadow: 'inset 0 0 0 1px #788a79' } : undefined}>
                <Target size={13} /> {requiredOnly ? 'Showing required skills' : 'Show required skills only'}
              </button>
              <span style={{ color: '#69766d', fontSize: 10 }}>
                {visibleSkills.length} matching skill areas · {skills.reduce((sum, skill) => sum + skill.topics.length, 0)} roadmap topics
              </span>
            </div>
            <div className="panel-title">
              <div>
                <h2>Required skill matrix</h2>
                <p>{displayValue(current?.name)}</p>
              </div>
              <span>{visibleSkills.length} skill areas</span>
            </div>
            <div className="skill-grid">
              {visibleSkills.map((skill) => {}
                const level = skill.req?.required_level;
                const levelIsPresent = hasValue(level);
                const proficiencyName = skill.proficiency?.proficiency_name;
                const levelText = levelIsPresent
                  ? 'Target level ' + displayValue(level) + '/10' +
                    (hasValue(proficiencyName) ? ' · ' + displayValue(proficiencyName) : '')
                  : hasValue(proficiencyName)
                    ? displayValue(proficiencyName)
                    : 'No company requirement';

                return (
                  <details className="skill" key={skill.skill_set_id}>
                    <summary>
                      <BrainCircuit size={18} />
                      <span>
                        <b>{displayValue(skill.skill_set_name)}</b>
                        <small>{levelText}</small>
                      </span>
                      <strong>{levelIsPresent ? displayValue(level) : 'Not required'}</strong>
                    </summary>
                    <div className="bar">
                      <i
                        style={{
                          width: (levelIsPresent && Number.isFinite(Number(level))
                            ? Math.min(10, Math.max(0, Number(level)))
                            : 0) * 10 + '%',
                        }}
                      />
                    </div>
                    {skill.topics.map((topic, index) => (
                      <p className="topic" key={String(topic.level_number) + '-' + index}>
                        <b>Level {displayValue(topic.level_number)}</b> {displayValue(topic.topics)}
                      </p>
                    ))}
                  </details>
                );
              })}
              {visibleSkills.length === 0 && (
                <div className="empty-results" style={{ gridColumn: '1 / -1' }}>
                  <BrainCircuit size={22} /><b>No matching skills</b>
                  <span>Try a different search or turn off the required-skills-only filter.</span>
                </div>
              )}
            </div>
            <div className="note">
              <TrendingUp size={15} /> Roadmaps are loaded from Supabase. A missing company requirement is not evidence that a skill is unimportant.
            </div>
          </section>
        ) : null}

        <footer>
          JSS University, Noida
          {' | '}
          <a href="#privacy" onClick={(event) => { event.preventDefault(); navigateToStaticPage('privacy'); }}>
            Privacy
          </a>
          {' | '}
          <a href="#terms" onClick={(event) => { event.preventDefault(); navigateToStaticPage('terms'); }}>
            Terms
          </a>
          {' | '}
          <a href="#tab=tracker" onClick={(event) => { event.preventDefault(); navigateToAppTab('tracker'); }}>
            My tracker
          </a>
        </footer>
      </main>
    </div>
  );
}
