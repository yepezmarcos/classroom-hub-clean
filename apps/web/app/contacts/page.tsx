'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import ComposeEmailDrawer from '../../components/ComposeEmailDrawer';
import { api } from '../lib/api';

/* =========================
   Types
   ========================= */
type Guardian = {
    id?: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    relationship?: string | null;
};

type StudentFromApi = {
    id: string;
    first: string;
    last: string;
    grade?: string | null;

    parents?: Guardian[];
    guardians?: Guardian[];
    links?: { relationship?: string | null; guardian: Guardian }[];
};

type ContactRow = {
    key: string;
    name: string;
    email: string | null;
    phone: string | null;
    relationship: string | null;
    students: { id: string; name: string; grade: string | null }[];
};

/* =========================
   Helpers
   ========================= */
function deriveGuardians(s?: Partial<StudentFromApi> | null): Guardian[] {
    if (!s) return [];
    if (Array.isArray(s.parents) && s.parents.length) return s.parents;
    if (Array.isArray(s.guardians) && s.guardians.length) return s.guardians;
    if (Array.isArray(s.links) && s.links.length) {
        return s.links
            .map((l) => ({
                name: l.guardian?.name ?? '',
                email: l.guardian?.email ?? null,
                phone: l.guardian?.phone ?? null,
                relationship: l.relationship ?? null,
            }))
            .filter((g) => g.name || g.email || g.phone);
    }
    return [];
}

function contactKey(g: Guardian) {
    const email = (g.email || '').toLowerCase().trim();
    if (email) return `email:${email}`;
    const phone = (g.phone || '').replace(/\D/g, '');
    if (phone) return `phone:${phone}:${(g.name || '').trim().toLowerCase()}`;
    return `name:${(g.name || '').trim().toLowerCase()}`;
}

type CommentTemplate = {
    id: string;
    subject?: string | null;
    text: string;
    tags: string[];
};

const DEFAULT_EMAIL_TEMPLATES: CommentTemplate[] = [
    {
        id: 'def-1',
        subject: 'Quick update about {{First}}',
        text:
            'Hello {{guardian_name}},\n\nI wanted to share a quick update about {{first}}. Recently, {{they}} has been making steady progress in {{subject_or_class}}. I’m proud of {{their}} effort.\n\nBest,\n{{teacher_name}}',
        tags: ['email', 'template', 'topic:Progress', 'tone:warm'],
    },
    {
        id: 'def-2',
        subject: 'Support plan for {{First}}',
        text:
            'Hello {{guardian_name}},\n\nI’m reaching out to discuss support for {{first}}. Lately, {{they}} has had difficulty with {{challenge}}. I plan to {{teacher_plan}}.\n\nThank you,\n{{teacher_name}}',
        tags: ['email', 'template', 'topic:Concern', 'tone:professional'],
    },
];

/* =========================
   Page
   ========================= */
export default function ContactsPage() {
    const [rows, setRows] = useState<ContactRow[]>([]);
    const [loading, setLoading] = useState(true);

    // search
    const [q, setQ] = useState('');

    // selection
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
    const selectedCount = selectedKeys.size;

    // email compose
    const [emailOpen, setEmailOpen] = useState(false);
    const [provider, setProvider] = useState<'default' | 'gmail' | 'outlook' | 'office'>('default');
    const [targetGuardian, setTargetGuardian] = useState<string>('');
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');
    const [emailTopic, setEmailTopic] = useState('General');
    const [emailMethod, setEmailMethod] = useState('Email');
    const [emailTone, setEmailTone] = useState<'Neutral' | 'Warm' | 'Professional' | 'Encouraging' | 'Direct'>('Neutral');

    const [aiEmailLoading, setAiEmailLoading] = useState(false);
    const emailTemplates = DEFAULT_EMAIL_TEMPLATES;

    // compose context to know who to log for on send
    const [composeRecipients, setComposeRecipients] = useState<ContactRow[]>([]);

    /* ===== Load contacts with fallback ===== */
    async function load() {
        setLoading(true);
        try {
            // Try /contacts if available
            try {
                const maybeContacts = await api('/contacts');
                if (Array.isArray(maybeContacts) && maybeContacts.length) {
                    const map = new Map<string, ContactRow>();
                    for (const c of maybeContacts) {
                        const g: Guardian = {
                            id: c.id,
                            name: c.name || c.fullName || '(no name)',
                            email: c.email || null,
                            phone: c.phone || null,
                            relationship: c.relationship || null,
                        };
                        const key = contactKey(g);
                        const r =
                            map.get(key) ||
                            ({
                                key,
                                name: g.name,
                                email: g.email || null,
                                phone: g.phone || null,
                                relationship: g.relationship || null,
                                students: [],
                            } as ContactRow);

                        const links = Array.isArray(c.students) ? c.students : Array.isArray(c.links) ? c.links : [];
                        for (const link of links) {
                            const sid = link?.studentId || link?.id;
                            const sname = link?.studentName || link?.name;
                            if (sid && sname) {
                                r.students.push({ id: String(sid), name: String(sname), grade: (link?.grade as string) ?? null });
                            }
                        }
                        map.set(key, r);
                    }
                    setRows(Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name)));
                    return;
                }
            } catch {
                // ignore and fall through
            }

            // Fallback: build from students (hydrate each)
            const studentsList: StudentFromApi[] = await api('/students');
            if (!Array.isArray(studentsList) || studentsList.length === 0) {
                setRows([]);
                return;
            }

            const results = await Promise.allSettled(studentsList.map((s) => api(`/students/${s.id}?hydrate=1`)));

            const map = new Map<string, ContactRow>();
            results.forEach((res, idx) => {
                if (res.status !== 'fulfilled' || !res.value) return;
                const sDetail = res.value as StudentFromApi;
                const gs = deriveGuardians(sDetail);
                if (!gs.length) return;

                const fallback = studentsList[idx];
                const studentInfo = {
                    id: sDetail.id || fallback.id,
                    name: `${sDetail.first || fallback.first || ''} ${sDetail.last || fallback.last || ''}`.trim(),
                    grade: sDetail.grade ?? fallback.grade ?? null,
                };

                for (const g of gs) {
                    const key = contactKey(g);
                    const r =
                        map.get(key) ||
                        ({
                            key,
                            name: g.name || '(no name)',
                            email: g.email || null,
                            phone: g.phone || null,
                            relationship: g.relationship || null,
                            students: [],
                        } as ContactRow);
                    if (!r.students.some((s) => s.id === studentInfo.id)) {
                        r.students.push(studentInfo);
                    }
                    map.set(key, r);
                }
            });

            setRows(Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name)));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load();
    }, []);

    /* ===== Derived UI ===== */
    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase();
        if (!term) return rows;
        return rows.filter((r) => {
            const hay =
                `${r.name} ${r.email || ''} ${r.phone || ''} ${r.relationship || ''} ${r.students.map((s) => s.name).join(' ')}`
                    .toLowerCase()
                    .replace(/\s+/g, ' ');
            return hay.includes(term);
        });
    }, [rows, q]);

    const selectedContacts = useMemo(
        () => filtered.filter((r) => selectedKeys.has(r.key)),
        [filtered, selectedKeys]
    );

    /* ===== Email drawer helpers ===== */
    function openComposeFor(contact: ContactRow) {
        setComposeRecipients([contact]);
        setTargetGuardian(contact.email || '');
        setEmailSubject(`Regarding ${contact.students[0]?.name ?? 'your student'}`);
        setEmailBody('');
        setEmailOpen(true);
    }

    function openBulkCompose() {
        const recips = selectedContacts.filter((c) => !!c.email);
        if (recips.length === 0) return;
        setComposeRecipients(recips);

        const allEmails = recips.map((c) => c.email!).join(',');
        setTargetGuardian(allEmails);
        setEmailSubject('Update regarding your student');
        setEmailBody('');

        setEmailOpen(true);
    }

    async function saveEmailToLogOnly() {
        // Save to log for the currently composed recipients (single or bulk)
        await logForRecipients(composeRecipients, emailSubject, emailBody);
    }

    async function logForRecipients(recipients: ContactRow[], subject: string, body: string) {
        if (!body.trim()) return;
        const tagSubject = subject?.trim() ? `subject:${subject.trim()}` : null;

        const jobs: Promise<any>[] = [];
        for (const r of recipients) {
            for (const s of r.students) {
                jobs.push(
                    api(`/students/${s.id}/notes`, {
                        method: 'POST',
                        body: JSON.stringify({
                            body,
                            tags: ['email', 'contacts', r.email ? `to:${r.email}` : null, tagSubject].filter(Boolean),
                        }),
                    }).catch(() => {})
                );
            }
        }
        await Promise.allSettled(jobs);
    }

    async function aiForEmail(kind: 'generate' | 'rephrase' | 'condense' | 'proofread') {
        try {
            setAiEmailLoading(true);
            if (kind === 'proofread') {
                setEmailBody((b) => b.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim());
                return;
            }
            if (kind === 'condense') {
                setEmailBody((b) => (b.length > 600 ? b.slice(0, 600) + '…' : b));
                return;
            }
            if (kind === 'rephrase') {
                setEmailBody((b) => (b ? `Thanks for reading.\n\n${b}` : b));
                return;
            }
            if (kind === 'generate') {
                setEmailBody((b) => (b && b.trim() ? b : 'Hello, I wanted to quickly touch base about your student.\n\nBest regards,\nTeacher'));
                return;
            }
        } finally {
            setAiEmailLoading(false);
        }
    }

    // guardians list for drawer (if bulk, prepend "All selected")
    const drawerGuardians = useMemo(() => {
        if (composeRecipients.length <= 1) {
            const c = composeRecipients[0];
            if (!c) return [];
            return [{ name: c.name || c.email || '(no name)', email: c.email || '' }];
        }
        const withEmail = composeRecipients.filter((c) => !!c.email);
        const allEmails = withEmail.map((c) => c.email!).join(',');
        return [
            { name: `All selected (${withEmail.length})`, email: allEmails },
            ...withEmail.map((c) => ({ name: `${c.name}`, email: c.email! })),
        ];
    }, [composeRecipients]);

    // onSend from the drawer: log first, then drawer will open provider
    async function onSendAndLog(to: string, subject: string, body: string) {
        // If user manually changes "To" to only one address, still log for all currently targeted recipients.
        const toSet = new Set(
            to.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
        );

        // Find which recipients are in scope by email
        const scope =
            composeRecipients.length > 0
                ? composeRecipients.filter((r) => r.email && toSet.has(r.email.toLowerCase()))
                : [];

        const recipientsForLog = scope.length > 0 ? scope : composeRecipients;

        await logForRecipients(recipientsForLog, subject, body);

        // After send, you may want to close the drawer:
        // setEmailOpen(false);
    }

    /* ===== Selection handlers ===== */
    function toggleRow(k: string) {
        setSelectedKeys((prev) => {
            const next = new Set(prev);
            if (next.has(k)) next.delete(k);
            else next.add(k);
            return next;
        });
    }

    function toggleAllVisible() {
        const visibleKeys = filtered.map((r) => r.key);
        const allSelected = visibleKeys.every((k) => selectedKeys.has(k));
        setSelectedKeys((prev) => {
            if (allSelected) {
                const next = new Set(prev);
                visibleKeys.forEach((k) => next.delete(k));
                return next;
            } else {
                const next = new Set(prev);
                visibleKeys.forEach((k) => next.add(k));
                return next;
            }
        });
    }

    const anySelectedWithEmail = selectedContacts.some((c) => !!c.email);

    return (
        <div className="space-y-6">
            <div className="card">
                <div className="header-row">
                    <h2 className="title">👪 Contacts</h2>
                    <div className="actions wrap">
                        <Link className="btn" href="/students">← Students</Link>
                    </div>
                </div>

                <div className="chip-row mt-2">
                    <div className="chip">
                        <input
                            className="input bare"
                            placeholder="Search name, email, phone, student…"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                        />
                    </div>
                    <span className="muted">{loading ? 'Loading…' : `${filtered.length} contact${filtered.length !== 1 ? 's' : ''}`}</span>

                    <span className="flex-spacer" />

                    <div className="chip-row">
                        <button className="btn" onClick={toggleAllVisible} disabled={loading || filtered.length === 0}>
                            {filtered.every((r) => selectedKeys.has(r.key)) ? 'Unselect all' : 'Select all (visible)'}
                        </button>
                        <button className="btn btn-primary" onClick={openBulkCompose} disabled={!anySelectedWithEmail}>
                            Bulk Email {selectedCount > 0 ? `(${selectedCount})` : ''}
                        </button>
                    </div>
                </div>
            </div>

            <div className="card">
                {loading && <div className="muted">Loading contacts…</div>}

                {!loading && filtered.length === 0 && (
                    <div className="muted">
                        No contacts found. If your API doesn’t expose <code>/contacts</code>, we automatically build this list by hydrating each
                        student and extracting guardians.
                    </div>
                )}

                {!loading && filtered.length > 0 && (
                    <div className="table-wrap mt-2">
                        <table className="w-full text-sm">
                            <thead>
                            <tr className="text-left text-[var(--muted)]">
                                <th className="py-2 w-[44px]">
                                    <input
                                        type="checkbox"
                                        checked={filtered.length > 0 && filtered.every((r) => selectedKeys.has(r.key))}
                                        onChange={toggleAllVisible}
                                    />
                                </th>
                                <th className="py-2">Name</th>
                                <th>Email</th>
                                <th>Phone</th>
                                <th>Relationship</th>
                                <th>Students</th>
                                <th></th>
                            </tr>
                            </thead>
                            <tbody>
                            {filtered.map((c) => (
                                <tr key={c.key} className="border-t border-[var(--border)]">
                                    <td className="py-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedKeys.has(c.key)}
                                            onChange={() => toggleRow(c.key)}
                                        />
                                    </td>
                                    <td className="py-2">{c.name || '—'}</td>
                                    <td className="sub">{c.email || '—'}</td>
                                    <td className="sub">{c.phone || '—'}</td>
                                    <td className="sub">{c.relationship || '—'}</td>
                                    <td className="sub">
                                        {c.students.length === 0 && '—'}
                                        {c.students.length > 0 && (
                                            <ul className="list">
                                                {c.students.map((s) => (
                                                    <li key={s.id}>
                                                        <Link className="link" href={`/students/${s.id}`}>
                                                            {s.name}
                                                        </Link>
                                                        {s.grade ? ` · G${s.grade}` : ''}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </td>
                                    <td className="text-right">
                                        {c.email ? (
                                            <button className="btn" onClick={() => openComposeFor(c)}>
                                                Email
                                            </button>
                                        ) : (
                                            <span className="muted">—</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Drawer */}
            {emailOpen && (
                <ComposeEmailDrawer
                    open={emailOpen}
                    onClose={() => setEmailOpen(false)}
                    guardians={drawerGuardians.map((g) => ({ name: g.name, email: g.email }))}
                    provider={provider}
                    setProvider={setProvider}
                    targetGuardian={targetGuardian}
                    setTargetGuardian={setTargetGuardian}
                    emailSubject={emailSubject}
                    setEmailSubject={setEmailSubject}
                    emailBody={emailBody}
                    setEmailBody={setEmailBody}
                    emailTopic={emailTopic}
                    setEmailTopic={setEmailTopic}
                    emailMethod={emailMethod}
                    setEmailMethod={setEmailMethod}
                    emailTone={emailTone}
                    setEmailTone={setEmailTone}
                    emailTemplates={emailTemplates}
                    onApplyTemplate={(tpl, mode) => {
                        const body = tpl.text || '';
                        const subject = tpl.subject || '';
                        if (mode === 'replace') {
                            if (subject && !emailSubject.trim()) setEmailSubject(subject);
                            if (body) setEmailBody(body);
                            return;
                        }
                        // insert
                        if (subject && !emailSubject.trim()) setEmailSubject(subject);
                        if (body) setEmailBody((prev) => (prev ? `${prev}\n\n${body}` : body));
                    }}
                    onSaveLog={saveEmailToLogOnly}
                    onSend={onSendAndLog}
                    onAi={aiForEmail}
                    aiLoading={aiEmailLoading}
                    buildMailUrl={(prov,to,subject,body)=>{
                        const enc = encodeURIComponent;
                        switch (prov) {
                            case 'gmail': return `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(to)}&su=${enc(subject)}&body=${enc(body)}`;
                            case 'outlook': return `https://outlook.live.com/mail/0/deeplink/compose?to=${enc(to)}&subject=${enc(subject)}&body=${enc(body)}`;
                            case 'office': return `https://outlook.office.com/mail/deeplink/compose?to=${enc(to)}&subject=${enc(subject)}&body=${enc(body)}`;
                            default: return `mailto:${encodeURIComponent(to)}?subject=${enc(subject)}&body=${enc(body)}`;
                        }
                    }}
                />
            )}

            <style jsx>{`
        .title { font-size: 18px; font-weight: 700; display:flex; align-items:center; gap:8px; }
        .sub { font-size: 12px; color: var(--muted); }
        .muted { color: var(--muted); }
        .mt-2 { margin-top: 8px; }

        .card {
          background: var(--panel, #0e122b);
          border: 1px solid var(--border, #1f2547);
          border-radius: 14px;
          padding: 16px;
        }
        .header-row { display:flex; align-items:center; justify-content:space-between; gap: 14px; flex-wrap:wrap; }
        .actions { display:flex; gap:10px; align-items:center; }
        .actions.wrap { flex-wrap: wrap; row-gap: 8px; }
        .chip-row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
        .chip-row .flex-spacer { flex: 1; }
        .chip { display:inline-flex; align-items:center; gap:10px; padding:8px 12px; border:1px solid var(--border); border-radius:9999px; background: rgba(255,255,255,0.03); }
        .chip .input.bare { background: transparent; color: inherit; border: none; outline: none; min-width: 240px; }

        .table-wrap { overflow-x:auto; }
        .btn { border:1px solid var(--border); background: rgba(255,255,255,0.05); padding:10px 12px; border-radius:12px; }
        .btn-primary { background: rgba(99, 102, 241, 0.22); border-color: rgba(99, 102, 241, 0.55); }
        .link { text-decoration: underline; }
        .list { display: grid; gap: 4px; }
        .text-right { text-align: right; }
      `}</style>
        </div>
    );
}