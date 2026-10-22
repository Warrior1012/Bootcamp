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

function externalUrl(value: any): string | null {
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

function findLinkedInUrl(value: any, depth = 0): string | null {
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

function categoryOf(company: any): string {
  return String(company.category || company.nature_of_company || 'Other');
}

export default function App() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(true);
  const [q, setQ] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [tab, setTab] = useState('companies');

  async function refresh() {
    setBusy(true);
    setErr('');
    try {
      const result = await loadData();
      setData(result);
      setPage(1);
      if (selected === null && result.companies.length) {
        setSelected(result.companies[0].company_id);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Database request failed');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const allCompanies = data?.companies || [];
  const categories = Array.from(
    new Set(allCompanies.map((company: any) => categoryOf(company))),
  ).sort((a: string, b: string) => a.localeCompare(b));
  const needle = q.trim().toLowerCase();
  const companies = allCompanies.filter((company: any) => {
    const searchable = [
      company.name,
      company.short_name,
      company.category,
      company.nature_of_company,
      company.headquarters_address,
    ].filter(Boolean).join(' ').toLowerCase();

    return searchable.includes(needle) &&
      (categoryFilter === 'all' || categoryOf(company) === categoryFilter);
  });

  const totalPages = Math.max(1, Math.ceil(companies.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const visibleCompanies = companies.slice(startIndex, startIndex + pageSize);
  const rangeStart = companies.length ? startIndex + 1 : 0;
  const rangeEnd = Math.min(startIndex + pageSize, companies.length);

  const current = allCompanies.find((company: any) => company.company_id === selected);
  const profile = (data?.profiles || []).find((item: any) => item.company_id === selected);
  const full = {
    ...(profile?.short_json || {}),
    ...(profile?.full_json || {}),
    ...(current || {}),
  };
  const websiteUrl = externalUrl(current?.website_url);
  const linkedinUrl = findLinkedInUrl(full);

  const requirements = (data?.requirements || []).filter(
    (item: any) => item.company_id === selected,
  );
  const skills = (data?.skills || []).map((skill: any) => ({
    ...skill,
    req: requirements.find((item: any) => item.skill_set_id === skill.skill_set_id),
    topics: (data?.topics || []).filter(
      (topic: any) => topic.skill_set_id === skill.skill_set_id,
    ),
  }));

  const profileFields: any[] = current
    ? [
        ['Category', current.category, null],
        ['Founded', current.incorporation_year, null],
        ['Company type', current.nature_of_company, null],
        ['Vision', full.vision_statement, null],
        ['Mission', full.mission_statement, null],
        ['Website', current.website_url, websiteUrl],
        ...(linkedinUrl ? [['LinkedIn', 'View company profile', linkedinUrl]] : []),
      ]
    : [];

  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <span>J</span>
          <div>
            <b>JSSU</b>
            <small>Placement Intelligence</small>
          </div>
        </div>
        <p className="label">WORKSPACE</p>
        <button
          className={tab === 'companies' ? 'nav active' : 'nav'}
          onClick={() => setTab('companies')}
        >
          <Building2 size={17} /> Company directory
        </button>
        <button
          className={tab === 'skills' ? 'nav active' : 'nav'}
          onClick={() => setTab('skills')}
        >
          <BrainCircuit size={17} /> Skill intelligence
        </button>
        <div className="connection">
          <i style={{ background: data ? '#19a66a' : '#e7a23b' }} />
          <div>
            <b>Supabase</b>
            <small>{data ? 'Connected · read-only' : 'Connection status'}</small>
          </div>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <span className="eyebrow">JSS UNIVERSITY, NOIDA / BOOTCAMP</span>
            <h1>{tab === 'companies' ? 'Company directory' : 'Skill intelligence'}</h1>
          </div>
          <button className="refresh" onClick={() => void refresh()} disabled={busy}>
            <RefreshCw size={15} /> Refresh
          </button>
        </header>

        {err && (
          <div className="alert">
            <AlertCircle size={18} />
            <div>
              <b>Could not load live data</b>
              <p>{err}</p>
              <small>Check .env.local and Supabase SELECT policies.</small>
            </div>
          </div>
        )}

        {busy ? (
          <div className="loading">Connecting to your Supabase project…</div>
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
                    <option value={category} key={category}>{category}</option>
                  ))}
                </select>
              </label>

              <div className="company-results" aria-live="polite">
                {visibleCompanies.map((company: any) => (
                  <button
                    className={'company ' + (selected === company.company_id ? 'chosen' : '')}
                    key={company.company_id}
                    onClick={() => setSelected(company.company_id)}
                  >
                    <b className="mark">
                      {(company.short_name || company.name || '?').slice(0, 1)}
                    </b>
                    <span>
                      <strong>{company.name}</strong>
                      <small>{company.category || company.nature_of_company || 'Company profile'}</small>
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
                  <span>Showing <b>{rangeStart}–{rangeEnd}</b> of <b>{companies.length}</b></span>
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

            <section className="panel profile">
              {current ? (
                <>
                  <div className="profile-head">
                    <b className="mark big">
                      {(current.short_name || current.name || '?').slice(0, 1)}
                    </b>
                    <div>
                      <span className="eyebrow">COMPANY PROFILE</span>
                      <h2>{current.name}</h2>
                      <p>{current.headquarters_address || 'Headquarters not listed'}</p>
                    </div>
                  </div>
                  <div className="stats">
                    <div><small>Company ID</small><b>{current.company_id}</b></div>
                    <div><small>Skill requirements</small><b>{requirements.length}</b></div>
                    <div><small>Skill areas</small><b>{data.skills.length}</b></div>
                  </div>
                  <div className="details">
                    <h3>Company overview</h3>
                    <p>{full.overview_text || full.company_overview || 'No overview provided in the database.'}</p>
                    {profileFields.map(([label, value, href]) => (
                      <div className="field" key={String(label)}>
                        <span>{label}</span>
                        <b>
                          {href ? (
                            <a
                              className="external-link"
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {value} <ExternalLink size={13} />
                            </a>
                          ) : value || 'Not available'}
                        </b>
                      </div>
                    ))}
                    <div className="note">
                      <Database size={15} /> Live Supabase data. Missing values are shown honestly.
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
        ) : data ? (
          <section className="panel skills">
            <div className="panel-title">
              <div>
                <h2>Required skill matrix</h2>
                <p>{current ? current.name : 'Select a company from Company directory first'}</p>
              </div>
              <span>{skills.length} skill areas</span>
            </div>
            <div className="skill-grid">
              {skills.map((skill: any) => (
                <details className="skill" key={skill.skill_set_id}>
                  <summary>
                    <BrainCircuit size={18} />
                    <span>
                      <b>{skill.skill_set_name}</b>
                      <small>
                        {skill.req?.required_level
                          ? 'Target level ' + skill.req.required_level + '/10'
                          : 'No company requirement'}
                      </small>
                    </span>
                    <strong>{skill.req?.required_level || '—'}</strong>
                  </summary>
                  <div className="bar">
                    <i style={{ width: (Number(skill.req?.required_level) || 0) * 10 + '%' }} />
                  </div>
                  {skill.topics.map((topic: any) => (
                    <p className="topic" key={topic.level_number}>
                      <b>Level {topic.level_number}</b> {topic.topics}
                    </p>
                  ))}
                </details>
              ))}
            </div>
            <div className="note">
              <Database size={15} /> Skills, proficiency levels and topic roadmaps are read from Supabase.
            </div>
          </section>
        ) : null}

        <footer>Read-only Supabase connection · No service-role key in frontend</footer>
      </main>
    </div>
  );
}
