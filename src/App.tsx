import { useEffect, useState } from 'react';
import {
  Building2,
  BrainCircuit,
  Search,
  RefreshCw,
  Database,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { loadData } from './lib/supabase';
import type {
  AppData,
  CompanyRecord,
  CompanyProfileRecord,
  ProfileField,
  ProficiencyLevelRecord,
  SkillRequirementRecord,
  SkillSetRecord,
  SkillTopicRecord,
  SkillWithDetails,
} from './types';

type AppTab = 'companies' | 'skills';
type AppView = AppTab | 'privacy' | 'terms';

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
  const tab: AppTab = requestedTab === 'skills' ? 'skills' : 'companies';

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

    return searchable.includes(needle) &&
      (categoryFilter === 'all' || categoryOf(company) === categoryFilter);
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

  const profileFields: ProfileField[] = current
    ? [
        { label: 'Category', value: current.category },
        { label: 'Company type', value: current.nature_of_company },
        { label: 'Vision', value: full.vision_statement },
        { label: 'Mission', value: full.mission_statement },
        { label: 'Website', value: current.website_url, href: websiteUrl },
        ...(linkedinUrl
          ? [{ label: 'LinkedIn', value: 'View company profile', href: linkedinUrl }]
          : []),
      ]
    : [];

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

        {tab === 'privacy' ? (
          <section className="panel">
            <div className="details">
              <h2>Privacy</h2>
              <p>
                JSSU Placement Intelligence Hub displays company information, company profiles,
                skill requirements, and topic information from its configured company dataset.
                Values that are not present in the dataset are shown as unavailable.
              </p>
              <p>
                This application does not provide visitor accounts, sign-in, or a form to submit
                personal information. This statement describes the application interface and does
                not make claims about logs or retention practices of the hosting or data providers.
              </p>
              <p>
                The interface loads fonts from Google Fonts. When those fonts are requested, the
                browser connects to Google to retrieve them. Refer to Google's own documentation
                for how its services process technical request information.
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
        ) : tab === 'terms' ? (
          <section className="panel">
            <div className="details">
              <h2>Terms</h2>
              <p>
                JSSU Placement Intelligence Hub lets visitors browse the company information and
                skill details available in the configured dataset. Some values may be missing or
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
                    <b className="mark">
                      {(company.short_name || company.name || 'J').slice(0, 1)}
                    </b>
                    <span>
                      <strong>{displayValue(company.name)}</strong>
                      <small>{categoryOf(company)}</small>
                    </span>
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
                    <b className="mark big">
                      {(current.short_name || current.name || 'J').slice(0, 1)}
                    </b>
                    <div>
                      <span className="eyebrow">COMPANY PROFILE</span>
                      <h2>{displayValue(current.name)}</h2>
                      <p>{displayValue(current.headquarters_address)}</p>
                    </div>
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
                    <div className="note">
                      <Database size={15} /> Company details are shown as provided by the available dataset.
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
            <div className="panel-title">
              <div>
                <h2>Required skill matrix</h2>
                <p>{displayValue(current?.name)}</p>
              </div>
              <span>{skills.length} skill areas</span>
            </div>
            <div className="skill-grid">
              {skills.map((skill) => {
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
              {skills.length === 0 && (
                <p>No skill areas are available for this company.</p>
              )}
            </div>
            <div className="note">
              Select a company to review its available skill levels and topic details.
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
        </footer>
      </main>
    </div>
  );
}
