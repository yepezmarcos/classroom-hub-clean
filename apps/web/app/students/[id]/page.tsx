'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../lib/api';
import StudentAverageCard from '../../../components/StudentAverageCard';
import RecentEvidence from '../../../components/RecentEvidence';
import ComposeEmailDrawer from '../../../components/ComposeEmailDrawer';
import BehaviorLogCard from '../../../components/BehaviorLogCard';
import ShareParentLinkButton from '../../../components/ShareParentLinkButton';

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
type Note = {
    id: string;
    body: string;
    tags: string[];
    createdAt: string;
    author?: { name?: string | null; email?: string | null };
};
type StudentFromApi = {
    id: string;
    tenantId?: string;
    first: string;
    last: string;
    grade?: string | null;
    email?: string | null;
    gender?: string | null;
    pronouns?: string | null;
    iep?: boolean;
    ell?: boolean;
    medical?: boolean;
    createdAt?: string;
    updatedAt?: string;

    parents?: Guardian[];
    guardians?: Guardian[];
    links?: { relationship?: string | null; guardian: Guardian }[];

    enrollments?: { classroom?: { id: string; name: string } }[];
    notes?: Note[];
};
type CommentTemplate = {
    id: string;
    text: string;
    tags: string[];
    subject?: string | null;
    gradeBand?: string | null;
    topic?: string | null;
};
type Settings = {
    jurisdiction?: string;
    board?: string;
    terms?: number;
    subjects?: string[];
    gradeBands?: string[];
    lsCategories?: { id: string; label: string }[];
};

/* =========================
   Constants
   ========================= */
const DEFAULT_ON_LS = [
    { id: 'responsibility', label: 'Responsibility' },
    { id: 'organization', label: 'Organization' },
    { id: 'independent-work', label: 'Independent Work' },
    { id: 'collaboration', label: 'Collaboration' },
    { id: 'initiative', label: 'Initiative' },
    { id: 'self-regulation', label: 'Self-Regulation' },
];

const DEFAULT_LEVELS = [
    { id: 'E', label: 'Excellent', icon: '🟢' },
    { id: 'G', label: 'Good', icon: '🟡' },
    { id: 'S', label: 'Satisfactory', icon: '🟠' },
    { id: 'N', label: 'Needs Improvement', icon: '🔴' },
    { id: 'NS', label: 'Needs Support', icon: '🔴' },
] as const;
const DEFAULT_LEVEL_ORDER = ['E', 'G', 'S', 'N', 'NS'] as const;

const DEFAULT_LS_OPENERS: CommentTemplate[] = [
    { id: 'op-1', text: '🟢 {{First}} has demonstrated strong learning skills this term.', tags: ['learning', 'opener', 'level:E'] },
    { id: 'op-2', text: '🟡 {{First}} is making steady progress in learning skills.', tags: ['learning', 'opener', 'level:G'] },
    { id: 'op-3', text: '🟠 {{First}} is developing learning skills with growing consistency.', tags: ['learning', 'opener', 'level:S'] },
    { id: 'op-4', text: '🔴 {{First}} would benefit from additional support to build learning skills.', tags: ['learning', 'opener', 'level:N'] },
];

const DEFAULT_LS_NEXT: CommentTemplate[] = [
    { id: 'nx-1', text: 'Next, {{they}} should continue to set clear goals and monitor {{their}} progress.', tags: ['learning', 'next-steps', 'level:G', 'responsibility'] },
    { id: 'nx-2', text: 'A helpful focus will be organizing materials and meeting deadlines consistently.', tags: ['learning', 'next-steps', 'level:S', 'organization'] },
    { id: 'nx-3', text: 'Working with small prompts will help {{them}} follow routines more independently.', tags: ['learning', 'next-steps', 'level:N', 'independent-work'] },
];

const DEFAULT_EMAIL_TEMPLATES: CommentTemplate[] = [
    {
        id: 'def-1',
        subject: 'Term {{term}} progress for {{First}} (Grade {{grade}})',
        text:
            'Hello {{guardian_name}},\n\nI wanted to share a quick update about {{first}}. Recently, {{they}} has been making steady progress in {{subject_or_class}}. I’m proud of {{their}} effort, especially with {{example}}.\n\nNext, I’ll be focusing on {{next_focus}} in class. Any support you can provide at home—like {{home_support}}—would be wonderful.\n\nThank you for your partnership,\n{{teacher_name}}',
        tags: ['email', 'template', 'tone:warm', 'topic:Progress'],
    },
    {
        id: 'def-2',
        subject: 'Support plan for {{First}} (Term {{term}})',
        text:
            'Hello {{guardian_name}},\n\nI’m reaching out to discuss a support plan for {{first}}. Lately, I’ve noticed {{they}} has had difficulty with {{challenge}}. I plan to {{teacher_plan}}. At home, you might try {{home_strategy}}.\n\nLet me know if you have questions or suggestions.\n\nBest regards,\n{{teacher_name}}',
        tags: ['email', 'template', 'tone:professional', 'topic:Concern'],
    },
    {
        id: 'def-3',
        subject: 'Celebrating {{First}}’s success — Term {{term}}',
        text:
            'Hi {{guardian_name}},\n\nJust a quick note to celebrate {{first}}’s achievement in {{subject_or_class}}. {{They}} demonstrated {{strength}} this week, and it was great to see!\n\nI’ll continue to encourage {{first}} to {{next_step}}.\n\nThanks for your continued support,\n{{teacher_name}}',
        tags: ['email', 'template', 'tone:encouraging', 'topic:Positive'],
    },
];

/* ===== Term-aware SUBJECT comment defaults (by grade band & term) ===== */
const SUBJECT_DEFAULTS: Record<
    string,
    Record<string, { opener: string; evidence: string; next: string; conclusion: string }>
> = {
    'K-3': {
        T1: {
            opener: '{{First}} is building early skills in {{subject_or_class}} and shows curiosity during lessons.',
            evidence: 'Recently, {{they}} practiced {{skill_example}} and participated in group activities.',
            next: 'Next, {{they}} should keep practicing {{focus_skill}} with short, supported tasks.',
            conclusion: 'Overall, {{they}} is developing positively in Grade {{grade}} {{subject_or_class}}.',
        },
        T2: {
            opener: '{{First}} continues to grow in {{subject_or_class}} with increasing confidence.',
            evidence: 'In class, {{they}} can {{skill_example}} with occasional reminders.',
            next: 'A helpful focus will be {{focus_skill}} at home and school.',
            conclusion: '{{They}} is on track in Grade {{grade}} {{subject_or_class}}.',
        },
        T3: {
            opener: 'This term, {{First}} has made steady progress in {{subject_or_class}}.',
            evidence: 'Work samples show {{they}} can {{skill_example}} more independently.',
            next: 'Maintaining routines and reading/practice at home will support continued growth.',
            conclusion: 'Great effort this year, {{First}}!',
        },
    },
    '4-6': {
        T1: {
            opener: '{{First}} demonstrates developing understanding in {{subject_or_class}}.',
            evidence: 'Evidence includes {{skill_example}} and contributions to class discussion.',
            next: 'Next steps include strengthening {{focus_skill}} and explaining reasoning.',
            conclusion: '{{They}} is progressing appropriately for Grade {{grade}}.',
        },
        T2: {
            opener: '{{First}} shows growing consistency in {{subject_or_class}}.',
            evidence: '{{They}} can {{skill_example}} and apply feedback to improve.',
            next: 'Focusing on {{focus_skill}} will help deepen understanding.',
            conclusion: 'Keep it up, {{First}}.',
        },
        T3: {
            opener: '{{First}} has consolidated many skills in {{subject_or_class}}.',
            evidence: 'Tasks show {{they}} can {{skill_example}} with increasing independence.',
            next: 'Continuing to read, practice, and reflect will support next year’s learning.',
            conclusion: 'Well done this term.',
        },
    },
    '7-8': {
        T1: {
            opener: 'In {{subject_or_class}}, {{First}} is developing core skills and task persistence.',
            evidence: 'Assessments indicate {{they}} can {{skill_example}} with guidance.',
            next: 'Priorities include {{focus_skill}} and regular completion of practice tasks.',
            conclusion: '{{They}} is making steady progress in Grade {{grade}}.',
        },
        T2: {
            opener: '{{First}} is strengthening understanding of key concepts in {{subject_or_class}}.',
            evidence: '{{They}} applies feedback to refine work, especially on {{skill_example}}.',
            next: 'Targeted practice on {{focus_skill}} will improve accuracy and confidence.',
            conclusion: 'Good growth this term.',
        },
        T3: {
            opener: '{{First}} demonstrates increased independence and initiative in {{subject_or_class}}.',
            evidence: 'Work shows {{they}} can {{skill_example}} and justify reasoning.',
            next: 'Maintaining organized notes and review habits will support future success.',
            conclusion: 'Strong finish to the year.',
        },
    },
    '9-12': {
        T1: {
            opener: '{{First}} is engaging with course outcomes in {{subject_or_class}}.',
            evidence: 'Performance indicates {{they}} can {{skill_example}}; feedback is incorporated with support.',
            next: 'Next steps include {{focus_skill}} and consistent use of success criteria.',
            conclusion: '{{They}} is progressing toward course expectations.',
        },
        T2: {
            opener: '{{First}} demonstrates growing proficiency in {{subject_or_class}}.',
            evidence: 'Tasks show {{they}} can {{skill_example}} more consistently.',
            next: 'Prioritizing {{focus_skill}} will help extend learning.',
            conclusion: 'Keep building on these gains.',
        },
        T3: {
            opener: '{{First}} has consolidated key outcomes in {{subject_or_class}}.',
            evidence: '{{They}} demonstrates {{skill_example}} with increasing independence.',
            next: 'Continuing independent practice and reflection will support next steps.',
            conclusion: 'Great work this term.',
        },
    },
};

/* =========================
   Helpers
   ========================= */
function slugify(s: string) {
    return String(s || '')
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
function deriveGuardians(s?: Partial<StudentFromApi> | null): Guardian[] {
    if (!s) return [];
    if (Array.isArray(s.parents) && s.parents.length) return s.parents;
    if (Array.isArray(s.guardians) && s.guardians.length) return s.guardians;
    if (Array.isArray(s.links) && s.links.length) {
        return s.links
            .map(l => ({
                name: l.guardian?.name ?? '',
                email: l.guardian?.email ?? null,
                phone: l.guardian?.phone ?? null,
                relationship: l.relationship ?? null,
            }))
            .filter(g => g.name || g.email || g.phone);
    }
    return [];
}
function splitPronouns(p?: string | null) {
    const [subj = 'they', obj = 'them', possAdj = 'their'] = (p || '').toLowerCase().split('/').map(x => x.trim());
    const possPron = subj === 'he' ? 'his' : subj === 'she' ? 'hers' : 'theirs';
    return {
        subj,
        obj,
        possAdj,
        possPron,
        Subj: subj.charAt(0).toUpperCase() + subj.slice(1),
        Obj: obj.charAt(0).toUpperCase() + obj.slice(1),
        PossAdj: possAdj.charAt(0).toUpperCase() + possAdj.slice(1),
        PossPron: possPron.charAt(0).toUpperCase() + possPron.slice(1),
    };
}
function normalizePlaceholders(text: string) {
    return (text || '')
        .replace(/\{name\}|\{Name\}/g, '{{first}}')
        .replace(/\{HeSheThey\}/g, '{{They}}')
        .replace(/\{heshethey\}/g, '{{they}}')
        .replace(/\{himherthem\}/g, '{{them}}')
        .replace(/\{his\/hertheir\}|\{hishertheir\}/g, '{{their}}');
}
function stripMarkers(raw: string) {
    let s = raw || '';
    s = s.replace(/^[^\p{L}\p{N}"'(\[]+\s*/u, '');
    s = s.replace(/^\s*\[(?:E|G|S|N|NS|NextSteps|Next|Opener|Opening)\]\s*/i, '');
    return s.trim();
}
function buildContext(opts: {
    student?: StudentFromApi | null;
    guardians?: Guardian[];
    targetGuardianEmail?: string;
    subjectId?: string;
    extra?: Record<string, string>;
    term?: string;
}) {
    const s = opts.student;
    const gAll = opts.guardians || [];
    const g =
        gAll.find(x => x.email && x.email === opts.targetGuardianEmail) ||
        gAll[0] || { name: '', email: '', phone: '', relationship: '' };
    const p = splitPronouns(s?.pronouns || '');
    const subjectOrClass =
        opts.subjectId && opts.subjectId.trim()
            ? opts.subjectId
            : (s?.enrollments || []).map(e => e.classroom?.name).filter(Boolean)[0] || 'class';
    return {
        first: s?.first || '',
        First: (s?.first || '').charAt(0).toUpperCase() + (s?.first || '').slice(1),
        last: s?.last || '',
        grade: s?.grade || '',
        gender: s?.gender || '',
        pronouns: s?.pronouns || '',
        they: p.subj,
        them: p.obj,
        their: p.possAdj,
        theirs: p.possPron,
        They: p.Subj,
        Them: p.Obj,
        Their: p.PossAdj,
        Theirs: p.PossPron,
        guardian_name: g?.name || '',
        guardian_email: g?.email || '',
        guardian_phone: g?.phone || '',
        guardian_relationship: g?.relationship || '',
        subject_or_class: subjectOrClass,
        teacher_name: 'Teacher',
        term: opts.term || '',
        ...(opts.extra || {}),
    };
}
function fillTemplate(text: string, ctx: Record<string, string>) {
    const t = normalizePlaceholders(text || '');
    return t.replace(/\{\{\s*([\w\.\-]+)\s*\}\}/g, (_, key) => ctx[key] ?? '');
}
function isEmailNote(n: Note) {
    const t = (n.tags || []).map(x => x.toLowerCase());
    return (
        t.includes('email') ||
        t.includes('parent-email') ||
        t.includes('guardian-email') ||
        t.some(x => x === 'method:email' || x.startsWith('method:email'))
    );
}
function byJur(tags: string[], jur: string) {
    if (!jur) return true;
    const tl = (tags || []).map(t => t.toLowerCase());
    return tl.includes(jur.toLowerCase());
}
function hasCat(tags: string[], catId: string) {
    const target = slugify(catId);
    const tl = (tags || []).map(t => t.toLowerCase());
    if (tl.some(t => t.startsWith('category:') && slugify(t.split(':')[1] || '') === target)) return true;
    if (tl.some(t => t.startsWith('ls:') && slugify(t.split(':').slice(1).join(':')) === target)) return true;
    return tl.some(t => t.includes(target));
}
function isNext(tags: string[], text: string) {
    const tl = (tags || []).map(t => t.toLowerCase());
    return (
        tl.includes('next-steps') ||
        tl.some(t => t === 'level:nextsteps') ||
        /next|support|improv|goal|target|should|encouraged/i.test(text)
    );
}
function isOpener(tags: string[]) {
    const tl = (tags || []).map(t => t.toLowerCase());
    return tl.includes('opener') || tl.includes('opening');
}
function extractLevel(tags: string[]) {
    for (const raw of tags || []) {
        const m = String(raw).toLowerCase().match(/^level:([\w\-]+)$/);
        if (m) return m[1].toUpperCase();
    }
    return null;
}
function getLevelIcon(lv?: string | null) {
    const m: Record<string, string> = { E: '🟢', G: '🟡', S: '🟠', N: '🔴', NS: '🔴' };
    return lv ? m[lv] || '⬤' : '';
}
function autoPronouns(g?: string | null) {
    switch ((g || '').toLowerCase()) {
        case 'male':
            return 'he/him/his';
        case 'female':
            return 'she/her/her';
        case 'nonbinary':
            return 'they/them/their';
        default:
            return '';
    }
}

/* ===== Grade band helpers & defaults ===== */
function parseNumericGrade(raw?: string | null): number | null {
    const s = (raw || '').toString().trim().toUpperCase();
    if (!s) return null;
    if (s === 'K' || s === 'JK' || s === 'SK') return 0;
    const m = s.match(/\d{1,2}/);
    return m ? parseInt(m[0], 10) : null;
}
function gradeBand(grade?: string | null) {
    const g = parseNumericGrade(grade);
    if (g === null) return '4-6';
    if (g <= 3) return 'K-3';
    if (g <= 6) return '4-6';
    if (g <= 8) return '7-8';
    return '9-12';
}
function termKey(term: string) {
    const m = (term || '').toUpperCase().match(/T([1-3])/);
    return m ? `T${m[1]}` : 'T1';
}
function termAwareSubjectDefaults(student: StudentFromApi | null | undefined, subjectId: string, term: string) {
    const band = gradeBand(student?.grade);
    const tk = termKey(term);
    const base = SUBJECT_DEFAULTS[band]?.[tk] || SUBJECT_DEFAULTS['4-6'].T1;
    const ctx = buildContext({ student, subjectId, term, extra: { skill_example: 'key skills', focus_skill: 'core strategies' } });
    return {
        opener: fillTemplate(base.opener, ctx),
        evidence: fillTemplate(base.evidence, ctx),
        next: fillTemplate(base.next, ctx),
        conclusion: fillTemplate(base.conclusion, ctx),
    };
}
function defaultEmailSubject(student: StudentFromApi | null | undefined, subjectId: string, term: string) {
    const ctx = buildContext({ student, subjectId, term });
    const g = parseNumericGrade(student?.grade);
    let base = 'Term {{term}} update for {{First}}';
    if (g !== null) base = `Term {{term}} update — Grade {{grade}}: {{First}}`;
    if (subjectId) base += ' ({{subject_or_class}})';
    return fillTemplate(base, ctx);
}

/* =========================
   Page
   ========================= */
export default function StudentProfilePage() {
    const params = useParams<{ id: string }>();
    const id = params?.id as string;

    const [student, setStudent] = useState<StudentFromApi | null>(null);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [bank, setBank] = useState<CommentTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [bankLoading, setBankLoading] = useState(false);

    // edit state
    const [edit, setEdit] = useState(false);
    function editable() {
        return {
            first: student?.first || '',
            last: student?.last || '',
            grade: student?.grade || '',
            email: student?.email || '',
            gender: student?.gender || '',
            pronouns: student?.pronouns || '',
            iep: !!student?.iep,
            ell: !!student?.ell,
            medical: !!student?.medical,
        };
    }
    const [form, setForm] = useState(editable());
    useEffect(() => {
        setForm(editable());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [student?.id]);
    function setFormField<K extends keyof typeof form>(k: K, v: any) {
        const next = { ...form, [k]: v };
        if (k === 'gender' && (!next.pronouns || !next.pronouns.trim())) next.pronouns = autoPronouns(v);
        setForm(next);
    }

    // general state
    const [mode, setMode] = useState<'learning' | 'subject'>('learning');
    const TERMS = useMemo(() => Array.from({ length: settings?.terms || 3 }, (_, i) => `T${i + 1}`), [settings?.terms]);
    const [term, setTerm] = useState('T1');
    const LS_CATEGORIES = useMemo(() => (settings?.lsCategories?.length ? settings.lsCategories : DEFAULT_ON_LS), [settings?.lsCategories]);
    const courses = useMemo(() => (student?.enrollments || []).map(e => e.classroom?.name).filter(Boolean) as string[], [student]);
    const SUBJECTS = useMemo(() => (settings?.subjects?.length ? settings.subjects : courses), [settings?.subjects, courses]);
    const [category, setCategory] = useState(LS_CATEGORIES[0]?.id || 'responsibility');
    const [subjectId, setSubjectId] = useState<string>('');
    useEffect(() => {
        if (!subjectId && SUBJECTS.length) setSubjectId(SUBJECTS[0] as string);
    }, [SUBJECTS, subjectId]);

    // dynamic levels (from settings/bank)
    const AVAILABLE_LEVELS = useMemo(() => {
        const fromSettings = (settings as any)?.lsLevels as { id: string; label: string; icon?: string }[] | undefined;
        if (fromSettings?.length) return fromSettings;

        const set = new Set<string>();
        for (const t of bank) {
            const lv = extractLevel(t.tags || []);
            if (lv) set.add(lv);
        }
        if (set.size === 0) return [...DEFAULT_LEVELS];
        const ids = Array.from(set);
        const order = [...DEFAULT_LEVEL_ORDER, ...ids.filter(id => !DEFAULT_LEVEL_ORDER.includes(id as any))];
        return order.map(id => ({ id, label: id, icon: getLevelIcon(id) }));
    }, [bank, settings]);

    // filters
    const [levelFilter, setLevelFilter] = useState<string>('All');

    // subject composer
    const [opener, setOpener] = useState('');
    const [evidence, setEvidence] = useState('');
    const [nextSteps, setNextSteps] = useState('');
    const [conclusion, setConclusion] = useState('');
    const [insertSlot, setInsertSlot] = useState<'opener' | 'evidence' | 'conclusion' | 'next'>('opener');

    // learning master comment
    type Part = { id: string; text: string };
    const [finalParts, setFinalParts] = useState<Part[]>([]);
    const finalComment = useMemo(() => finalParts.map(p => p.text.trim()).filter(Boolean).join(' '), [finalParts]);
    const [selectedPartIndex, setSelectedPartIndex] = useState<number | null>(null);

    // live preview + counts
    const subjectJoined = useMemo(() => [opener, evidence, nextSteps, conclusion].map(s => s.trim()).filter(Boolean).join(' '), [opener, evidence, nextSteps, conclusion]);
    const subjectWordCount = useMemo(() => (subjectJoined ? subjectJoined.trim().split(/\s+/).length : 0), [subjectJoined]);
    const learningWordCount = useMemo(() => (finalComment ? finalComment.trim().split(/\s+/).length : 0), [finalComment]);

    // collapsibles
    const [openLsCard, setOpenLsCard] = useState<Record<string, boolean>>({});
    const [showPastLearning, setShowPastLearning] = useState(false);
    const [showPastSubject, setShowPastSubject] = useState(false);
    const [showEmailLog, setShowEmailLog] = useState(false);
    const [showAssignmentEvidence, setShowAssignmentEvidence] = useState(false);
    const [showQuickNote, setShowQuickNote] = useState(false);

    // email compose
    const guardians = useMemo(() => deriveGuardians(student), [student]);
    const [emailOpen, setEmailOpen] = useState(false);
    const [provider, setProvider] = useState<'default' | 'gmail' | 'outlook' | 'office'>('default');
    const [targetGuardian, setTargetGuardian] = useState<string>('');
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');
    const [emailTopic, setEmailTopic] = useState('General');
    const [emailMethod, setEmailMethod] = useState('Email');
    const [emailTone, setEmailTone] = useState<'Neutral' | 'Warm' | 'Professional' | 'Encouraging' | 'Direct'>('Neutral');
    const [emailBankSearch, setEmailBankSearch] = useState('');
    const [aiEmailLoading, setAiEmailLoading] = useState(false);

    // quick notes
    const [quickNote, setQuickNote] = useState('');
    const [flagNote, setFlagNote] = useState('');

    // per-card state
    const [searchMap, setSearchMap] = useState<Record<string, string>>({});
    const [panelLevel, setPanelLevel] = useState<Record<string, string>>({});
    const [panelNextCat, setPanelNextCat] = useState<Record<string, string>>({});

    /* ====== Data loads ====== */
    async function load() {
        setLoading(true);
        try {
            const [s, cfg] = await Promise.all([api(`/students/${id}?hydrate=1`), api('/settings')]);
            setStudent(s || null);
            setSettings(cfg || {});
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        void load();
    }, [id]);

    useEffect(() => {
        (async () => {
            setBankLoading(true);
            try {
                const all = await api('/comments');
                setBank(Array.isArray(all) ? all : []);
            } catch {
                setBank([]);
            } finally {
                setBankLoading(false);
            }
        })();
    }, []);

    /* ====== Saves ====== */
    async function saveStudent() {
        await api(`/students/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({
                first: form.first,
                last: form.last,
                grade: form.grade || null,
                email: form.email || null,
                gender: form.gender || null,
                pronouns: form.pronouns || null,
                iep: !!form.iep,
                ell: !!form.ell,
                medical: !!form.medical,
            }),
        });
        setEdit(false);
        await load();
    }
    async function addQuickNote() {
        const body = String(quickNote || '').trim();
        if (!body) return;
        try {
            await api(`/students/${id}/notes`, { method: 'POST', body: JSON.stringify({ body, tags: ['comment'] }) });
            setQuickNote('');
            await load();
        } catch {
            alert('Could not add note. Please try again.');
        }
    }
    async function addFlagNote() {
        const body = String(flagNote || '').trim();
        if (!body) return;
        try {
            const tags = ['comment', 'flag', 'flag-note'];
            await api(`/students/${id}/notes`, { method: 'POST', body: JSON.stringify({ body, tags }) });
            setFlagNote('');
            await load();
        } catch {
            alert('Could not add flag note. Please try again.');
        }
    }
    async function saveLearningComment() {
        const text = finalComment.trim();
        if (!text) return;
        const jur = (settings?.jurisdiction || '').toLowerCase();
        const idsInFinal = new Set(finalParts.map(p => p.id));
        const tagsFromBank = (bank || []).filter(t => idsInFinal.has(t.id)).flatMap(t => t.tags || []).map(t => t.toLowerCase());
        const catTags = new Set<string>();
        for (const c of (settings?.lsCategories || DEFAULT_ON_LS)) {
            if (tagsFromBank.some(t => hasCat([t], c.id))) catTags.add(`category:${c.id}`);
        }
        const tags = ['comment', 'learning', `term:${term}`, ...Array.from(catTags)];
        if (jur) tags.push(jur);

        await api(`/students/${id}/notes`, { method: 'POST', body: JSON.stringify({ body: text, tags }) });
        setFinalParts([]);
        await load();
    }
    async function saveSubjectComment() {
        const parts = [opener, evidence, nextSteps, conclusion].map(t => t.trim()).filter(Boolean);
        if (!parts.length) return;
        const body = parts.join('\n\n');
        const tags: string[] = ['comment', 'subject'];
        if (subjectId) tags.push(`subject:${subjectId}`);
        if (term) tags.push(`term:${term}`);
        await api(`/students/${id}/notes`, { method: 'POST', body: JSON.stringify({ body, tags }) });
        setOpener('');
        setEvidence('');
        setNextSteps('');
        setConclusion('');
        await load();
    }
    async function saveEmailToLog() {
        const to = guardians.find(g => g.email === targetGuardian)?.email || '';
        const subj = emailSubject.trim();
        const body = emailBody.trim();
        if (!to || !subj || !body) return;
        await api(`/students/${id}/notes`, {
            method: 'POST',
            body: JSON.stringify({
                body: `Email (${emailMethod}) to ${to} — Topic: ${emailTopic}\n\nSubject: ${subj}\n\n${body}`,
                tags: ['email', `topic:${emailTopic}`, `method:${emailMethod}`],
            }),
        });
        setEmailOpen(false);
        setEmailSubject('');
        setEmailBody('');
        await load();
    }

    /* ====== AI: comment composer (learning/subject) ====== */
    async function aiCompose(kind: 'generate' | 'rephrase' | 'condense' | 'proofread') {
        try {
            const payload: any = {
                kind,
                student: {
                    first: student?.first,
                    last: student?.last,
                    grade: student?.grade,
                    gender: student?.gender,
                    pronouns: student?.pronouns,
                    flags: { iep: !!student?.iep, ell: !!student?.ell, medical: !!student?.medical },
                    courses,
                },
                settings,
                context: { mode, term, category, level: levelFilter, subject: subjectId },
            };
            if (mode === 'learning') payload.text = finalComment;
            else payload.draft = { opener, evidence, next: nextSteps, conclusion };

            const res = await api('/api/comments-extra/compose', { method: 'POST', body: JSON.stringify(payload) });

            if (mode === 'learning') {
                const text = (res?.text || res?.body || '').toString().trim();
                if (text) setFinalParts([{ id: `ai-${Date.now()}`, text }]);
            } else {
                const nextOpener = res?.opener ?? res?.parts?.opener ?? res?.sections?.opener;
                const nextEvidence = res?.evidence ?? res?.parts?.evidence ?? res?.sections?.evidence;
                const nextNext = res?.nextSteps ?? res?.parts?.next ?? res?.sections?.next;
                const nextConclusion = res?.conclusion ?? res?.parts?.conclusion ?? res?.sections?.conclusion;
                const allText = res?.text;

                if (allText && (!nextOpener && !nextEvidence && !nextNext && !nextConclusion)) {
                    const chunks = String(allText).split(/\n{2,}/);
                    setOpener((chunks[0] || '').trim());
                    setEvidence((chunks[1] || '').trim());
                    setNextSteps((chunks[2] || '').trim());
                    setConclusion(chunks.slice(3).join('\n\n').trim());
                } else {
                    if (typeof nextOpener === 'string') setOpener(nextOpener.trim());
                    if (typeof nextEvidence === 'string') setEvidence(nextEvidence.trim());
                    if (typeof nextNext === 'string') setNextSteps(nextNext.trim());
                    if (typeof nextConclusion === 'string') setConclusion(nextConclusion.trim());
                }
            }
        } catch {
            alert('AI compose is not available right now.');
        }
    }
    function aiAssist(action: 'expand' | 'rephrase' | 'condense' | 'proofread') {
        if (mode === 'learning' && action === 'expand') {
            void aiCompose('generate');
            return;
        }
        void aiCompose(action as any);
    }

    // Slot-specific AI for subject fields
    async function aiOnSlot(slot: 'opener' | 'evidence' | 'next' | 'conclusion', action: 'rephrase' | 'condense' | 'proofread' | 'generate') {
        try {
            const draft: any = { opener, evidence, next: nextSteps, conclusion };
            const payload: any = {
                kind: action === 'generate' ? 'generate' : action,
                scope: { slot },
                student: {
                    first: student?.first,
                    last: student?.last,
                    grade: student?.grade,
                    gender: student?.gender,
                    pronouns: student?.pronouns,
                    flags: { iep: !!student?.iep, ell: !!student?.ell, medical: !!student?.medical },
                    courses,
                },
                settings,
                context: { mode: 'subject', term, category, level: levelFilter, subject: subjectId },
                draft: { [slot]: draft[slot] || '' },
            };
            const res = await api('/api/comments-extra/compose', { method: 'POST', body: JSON.stringify(payload) });

            const replacement =
                (typeof res?.[slot] === 'string' && res?.[slot]) ? res?.[slot] :
                    (typeof res?.parts?.[slot] === 'string' && res?.parts?.[slot]) ? res?.parts?.[slot] :
                        (typeof res?.text === 'string' && res?.text) ? res?.text : '';

            if (replacement.trim()) {
                if (slot === 'opener') setOpener(replacement.trim());
                if (slot === 'evidence') setEvidence(replacement.trim());
                if (slot === 'next') setNextSteps(replacement.trim());
                if (slot === 'conclusion') setConclusion(replacement.trim());
            } else {
                alert('No suggestion returned for this slot.');
            }
        } catch {
            alert('AI action failed for this slot.');
        }
    }

    /* ====== AI: Email helper for drawer ====== */
    async function aiForEmail(kind: 'generate' | 'rephrase' | 'condense' | 'proofread') {
        try {
            setAiEmailLoading(true);
            const payload: any = {
                kind,
                student: {
                    first: student?.first,
                    last: student?.last,
                    grade: student?.grade,
                    gender: student?.gender,
                    pronouns: student?.pronouns,
                    flags: { iep: !!student?.iep, ell: !!student?.ell, medical: !!student?.medical },
                    courses,
                },
                settings,
                context: { mode: 'email', term, subject: subjectId, tone: emailTone, topic: emailTopic },
                draft: { subject: emailSubject, body: emailBody },
            };
            const res = await api('/api/comments-extra/compose', { method: 'POST', body: JSON.stringify(payload) });
            const nextSubject = (res?.subject ?? res?.parts?.subject ?? res?.headers?.subject ?? '').toString();
            const nextBody = (res?.body ?? res?.text ?? res?.parts?.body ?? '').toString();

            if (nextSubject) setEmailSubject(nextSubject);
            if (nextBody) setEmailBody(nextBody);
        } catch {
            alert('AI email helper is not available right now.');
        } finally {
            setAiEmailLoading(false);
        }
    }

    /* ====== Jurisdiction seeding for bank ====== */
    async function seedForJurisdiction() {
        const j = (settings?.jurisdiction || 'generic').toLowerCase();
        const attempts = [
            { url: `/api/comments-extra/seed/${encodeURIComponent(j)}`, method: 'POST' as const },
            { url: '/api/comments-extra/seed', method: 'POST' as const, body: JSON.stringify({ jurisdiction: j }) },
            { url: `/comments-extra/seed/${encodeURIComponent(j)}`, method: 'POST' as const },
            { url: '/comments-extra/seed', method: 'POST' as const, body: JSON.stringify({ jurisdiction: j }) },
            { url: '/comments-extra/seed/ontario', method: 'POST' as const },
        ];
        for (const a of attempts) {
            try {
                await api(a.url, { method: a.method, body: a.body });
                break;
            } catch {}
        }
        try {
            const all = await api('/comments');
            setBank(Array.isArray(all) ? all : []);
        } catch {}
    }

    /* ====== Learning dropdown data ====== */
    const jur = (settings?.jurisdiction || '').toLowerCase();
    const lsList = (settings?.lsCategories || DEFAULT_ON_LS).map(c => ({ id: c.id, label: c.label }));

    type Section = { id: string; label: string; type: 'opener' | 'category' | 'next' };
    const learningSections: Section[] = useMemo(
        () => [{ id: 'opener', label: 'Opener', type: 'opener' }, ...lsList.map(c => ({ id: c.id, label: c.label, type: 'category' as const })), { id: 'next-steps', label: 'Next Steps', type: 'next' }],
        [lsList]
    );

    // COLLAPSE ALL LS CARDS BY DEFAULT
    useEffect(() => {
        setOpenLsCard(prev => {
            if (Object.keys(prev).length) return prev;
            const init: Record<string, boolean> = {};
            for (const s of learningSections) init[s.id] = false;
            return init;
        });
    }, [learningSections]);

    function filterForSection(section: Section): CommentTemplate[] {
        const items: CommentTemplate[] = [];
        for (const tpl of bank || []) {
            const tags = tpl.tags || [];
            if (jur && !byJur(tags, jur)) continue;

            if (section.type === 'opener') {
                if (isOpener(tags)) items.push(tpl);
            } else if (section.type === 'category') {
                if (hasCat(tags, section.id) && !isNext(tags, tpl.text)) items.push(tpl);
            } else if (section.type === 'next') {
                if (isNext(tags, tpl.text)) items.push(tpl);
            }
        }
        if (items.length === 0) {
            if (section.type === 'opener') return DEFAULT_LS_OPENERS;
            if (section.type === 'next') return DEFAULT_LS_NEXT;
        }
        return items;
    }

    function onTogglePick(section: Section, tpl: CommentTemplate) {
        const ctx = buildContext({ student, guardians, targetGuardianEmail: targetGuardian, subjectId, term });
        const raw = fillTemplate(tpl.text || '', ctx).trim();
        const txt = stripMarkers(raw);
        if (!txt) return;

        const existsIdx = finalParts.findIndex(p => p.id === tpl.id);
        if (existsIdx >= 0) {
            setFinalParts(parts => parts.filter(p => p.id !== tpl.id));
            if (selectedPartIndex !== null && existsIdx === selectedPartIndex) setSelectedPartIndex(null);
            return;
        }
        setFinalParts(parts => [...parts, { id: tpl.id, text: txt }]);
    }
    function isPicked(tplId: string) {
        return finalParts.some(p => p.id === tplId);
    }
    function moveSelected(dir: -1 | 1) {
        if (selectedPartIndex === null) return;
        const idx = selectedPartIndex,
            j = idx + dir;
        if (j < 0 || j >= finalParts.length) return;
        setFinalParts(parts => {
            const next = parts.slice();
            const [item] = next.splice(idx, 1);
            next.splice(j, 0, item);
            return next;
        });
        setSelectedPartIndex(j);
    }
    function removeSelected() {
        if (selectedPartIndex === null) return;
        setFinalParts(parts => parts.filter((_, i) => i !== selectedPartIndex));
        setSelectedPartIndex(null);
    }

    /* ====== Subject suggestions bank ====== */
    const [bankSearch, setBankSearch] = useState('');
    const bankFiltered = useMemo(() => {
        const q = bankSearch.toLowerCase();
        const list: string[] = [];
        const seen = new Set<string>();
        for (const c of bank || []) {
            const tags = (c.tags || []).map(t => t.toLowerCase());
            if (jur && !tags.includes(jur)) continue;
            if (mode === 'learning') continue;
            const subj = (subjectId || '').toLowerCase();
            const okSubj = subj ? tags.includes(`subject:${subj}`) || (c.subject || '').toLowerCase() === subj : true;
            const t = (c.text || '').trim();
            if (!okSubj) continue;
            if (t && (!q || t.toLowerCase().includes(q)) && !seen.has(t)) {
                seen.add(t);
                list.push(t);
                if (list.length >= 160) break;
            }
        }
        return list;
    }, [bank, bankSearch, mode, subjectId, jur]);

    function insertFromBank(snippet: string) {
        const ctx = buildContext({ student, guardians, targetGuardianEmail: targetGuardian, subjectId, term });
        const txt = fillTemplate(snippet, ctx);
        switch (insertSlot) {
            case 'opener':
                setOpener(v => (v ? `${v} ${txt}` : txt));
                break;
            case 'evidence':
                setEvidence(v => (v ? `${v} ${txt}` : txt));
                break;
            case 'next':
                setNextSteps(v => (v ? `${v} ${txt}` : txt));
                break;
            case 'conclusion':
                setConclusion(v => (v ? `${v} ${txt}` : txt));
                break;
        }
    }

    /* ====== Email templates ====== */
    const emailTemplates = useMemo(() => {
        const q = emailBankSearch.toLowerCase();
        const candidates = (bank || []).filter(c => {
            const tags = (c.tags || []).map(t => t.toLowerCase());
            const em =
                tags.includes('email') ||
                tags.includes('email-template') ||
                tags.includes('template:email') ||
                tags.some(t => t.startsWith('method:email')) ||
                tags.some(t => t.startsWith('topic:'));
            if (!em) return false;
            if (jur && !tags.includes(jur)) return false;
            return true;
        });
        const list = candidates.length ? candidates : DEFAULT_EMAIL_TEMPLATES;
        const filtered = list.filter(tpl => {
            if (!q) return true;
            const hay = `${tpl.subject || ''}\n${tpl.text || ''}`.toLowerCase();
            return hay.includes(q);
        });
        if (emailTopic && emailTopic !== 'General') {
            const topicKey = `topic:${emailTopic.toLowerCase()}`;
            return filtered.filter(tpl => (tpl.tags || []).map(t => t.toLowerCase()).includes(topicKey));
        }
        return filtered;
    }, [bank, emailBankSearch, emailTopic, jur]);

    function applyEmailTemplate(tpl: CommentTemplate, mode: 'insert' | 'replace') {
        const ctx = buildContext({ student, guardians, targetGuardianEmail: targetGuardian, subjectId, term });
        const subj = tpl.subject ? fillTemplate(tpl.subject, ctx).trim() : '';
        const body = fillTemplate(tpl.text || '', ctx).trim();
        if (mode === 'replace') {
            setEmailSubject(subj || emailSubject || defaultEmailSubject(student, subjectId, term));
            setEmailBody(body);
            return;
        }
        if (!emailSubject.trim()) setEmailSubject(subj || defaultEmailSubject(student, subjectId, term));
        if (body) setEmailBody(prev => (prev ? `${prev}\n\n${body}` : body));
    }

    /* ====== Derived lists ====== */
    const emailLog = useMemo(() => (student?.notes || []).filter(isEmailNote), [student?.notes]);
    const pastLearning = useMemo(() => (student?.notes || []).filter(n => (n.tags || []).map(t => t.toLowerCase()).includes('learning')), [student?.notes]);
    const pastSubject = useMemo(() => (student?.notes || []).filter(n => (n.tags || []).map(t => t.toLowerCase()).includes('subject')), [student?.notes]);

    const assignmentEvidence = useMemo(() => {
        const all = student?.notes || [];
        const notes = all.filter(n => (n.tags || []).some(t => /^assignment:/.test(t)));
        const map = new Map<string, Note[]>();
        for (const n of notes) {
            const aTag = (n.tags || []).find(t => /^assignment:/.test(t));
            const key = aTag || 'assignment:unknown';
            map.set(key, [...(map.get(key) || []), n]);
        }
        return Array.from(map.entries()).map(([key, list]) => ({ key, list }));
    }, [student?.notes]);

    /* ====== Term-aware defaults: apply on demand ====== */
    function applySubjectDefaults() {
        const d = termAwareSubjectDefaults(student, subjectId, term);
        setOpener(d.opener);
        setEvidence(d.evidence);
        setNextSteps(d.next);
        setConclusion(d.conclusion);
    }

    /* ====== Email default subject when opening ====== */
    useEffect(() => {
        if (emailOpen && !emailSubject.trim()) {
            setEmailSubject(defaultEmailSubject(student, subjectId, term));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [emailOpen]);

    /* ====== Helpers: open email with a body ====== */
    function openEmailWithBody(body: string, subjectOverride?: string) {
        const subj = subjectOverride || defaultEmailSubject(student, subjectId, term);
        setEmailSubject(subj);
        setEmailBody(body);
        setEmailOpen(true);
    }

    /* ====== Reset filters util ====== */
    function resetAllFilters() {
        setLevelFilter('All');
        setBankSearch('');
        setSearchMap({});
        setPanelLevel({});
        setPanelNextCat({});
    }

    /* ====== Render ====== */
    if (loading)
        return (
            <div className="space-y-4">
                <div className="card">
                    <div className="title">Loading…</div>
                </div>
            </div>
        );
    if (!student) {
        return (
            <div className="space-y-4">
                <div className="card">
                    <div className="title">Student not found</div>
                </div>
                <div className="card">
                    <Link className="btn" href="/students">
                        ← Back to Students
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="card">
                <div className="header-row">
                    <div>
                        <h2 className="title">🧑‍🎓 {student.first} {student.last}</h2>
                        <div className="sub mt-1">
                            {(student.pronouns || student.gender || '')}
                            {student.grade ? ` · Grade ${student.grade}` : ''}
                        </div>
                    </div>
                    <div className="actions">
                        {/* keep popover safe */}
                        <div className="overlay-anchor"><ShareParentLinkButton studentId={student.id} /></div>
                        <Link className="btn" href={`/students/${student.id}/report`}>📄 Report</Link>
                        {!edit && <button className="btn" onClick={() => setEdit(true)}>✏️ Edit</button>}
                        {edit && (
                            <>
                                <button className="btn" onClick={() => { setEdit(false); setForm(editable()); }}>Cancel</button>
                                <button className="btn btn-primary" onClick={saveStudent}>Save</button>
                            </>
                        )}
                        <Link className="btn" href="/students">← Back</Link>
                    </div>
                </div>
            </div>

            {/* Details + Guardians */}
            <div className="card">
                {!edit ? (
                    <div className="grid2">
                        <div className="stack-lg">
                            <StudentAverageCard studentId={student.id} />

                            <div className="field">
                                <div className="label">Email</div>
                                <div className="sub">{student.email || '—'}</div>
                            </div>

                            <div className="field">
                                <div className="label">Flags</div>
                                <div className="flex-between mt-2 wrap-gap">
                                    <div className="flag-row">
                                        {student.iep && <span className="flag pill">🧩 IEP</span>}
                                        {student.ell && <span className="flag pill">🗣️ ELL</span>}
                                        {student.medical && <span className="flag pill">🏥 Medical</span>}
                                        {!student.iep && !student.ell && !student.medical && <span className="muted">—</span>}
                                    </div>
                                    <div className="inline-note">
                                        <input
                                            className="input"
                                            placeholder="Log a quick flag note…"
                                            value={flagNote}
                                            onKeyDown={(e) => { if (e.key === 'Enter' && flagNote.trim()) { e.preventDefault(); void addFlagNote(); } }}
                                            onChange={(e) => setFlagNote(e.target.value)}
                                        />
                                        <button className="btn btn-primary" type="button" onClick={addFlagNote} disabled={!flagNote.trim()}>📝 Add</button>
                                    </div>
                                </div>
                            </div>

                            <div className="field">
                                <div className="label">Courses</div>
                                {courses.length ? <ul className="sub mt-2">{courses.map(c => <li key={c}>{c}</li>)}</ul> : <div className="muted sub mt-2">—</div>}
                            </div>
                        </div>

                        <div className="field">
                            <div className="label">👪 Guardians</div>
                            {guardians.length === 0 && <div className="muted mt-2">No guardian on file.</div>}
                            {guardians.length > 0 && (
                                <div className="table-wrap mt-3">
                                    <table className="w-full text-sm">
                                        <thead>
                                        <tr className="text-left text-[var(--muted)]">
                                            <th className="py-2">Name</th>
                                            <th>Relationship</th>
                                            <th>Contact</th>
                                            <th></th>
                                        </tr>
                                        </thead>
                                        <tbody>
                                        {guardians.map((g, i) => (
                                            <tr key={i} className="border-t border-[var(--border)]">
                                                <td className="py-2">{g.name || '—'}</td>
                                                <td>{g.relationship || '—'}</td>
                                                <td>
                                                    <div className="sub">{g.email || '—'}</div>
                                                    <div className="sub">{g.phone || ''}</div>
                                                </td>
                                                <td className="text-right">
                                                    {g.email && <button className="btn" onClick={() => { setEmailOpen(true); setTargetGuardian(g.email || ''); }}>Email</button>}
                                                </td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="grid2">
                        <div className="grid3 gap-lg">
                            <div><div className="label">First</div><input className="input" value={form.first} onChange={e => setFormField('first', e.target.value)} /></div>
                            <div><div className="label">Last</div><input className="input" value={form.last} onChange={e => setFormField('last', e.target.value)} /></div>
                            <div><div className="label">Grade</div><input className="input" value={form.grade} onChange={e => setFormField('grade', e.target.value)} /></div>
                            <div><div className="label">Student Email</div><input className="input" value={form.email} onChange={e => setFormField('email', e.target.value)} /></div>
                            <div>
                                <div className="label">Gender</div>
                                <select className="input" value={form.gender} onChange={e => setFormField('gender', e.target.value)}>
                                    <option value="">—</option><option>male</option><option>female</option><option>nonbinary</option><option>unspecified</option>
                                </select>
                            </div>
                            <div><div className="label">Pronouns</div><input className="input" value={form.pronouns} onChange={e => setFormField('pronouns', e.target.value)} placeholder="auto from gender" /></div>
                            <div className="col-span-3">
                                <div className="label">Flags</div>
                                <div className="flag-row mt-2">
                                    <label className="flag-check"><input type="checkbox" checked={form.iep} onChange={e => setFormField('iep', e.target.checked)} /> 🧩 IEP</label>
                                    <label className="flag-check"><input type="checkbox" checked={form.ell} onChange={e => setFormField('ell', e.target.checked)} /> 🗣️ ELL</label>
                                    <label className="flag-check"><input type="checkbox" checked={form.medical} onChange={e => setFormField('medical', e.target.checked)} /> 🏥 Medical</label>
                                </div>
                            </div>
                        </div>
                        <div className="muted">Guardian editing happens when adding/importing on the Students page.</div>
                    </div>
                )}
            </div>

            {/* Behavior Log */}
            <div className="card">
                <BehaviorLogCard studentId={student.id} notes={student.notes || []} onUpdated={load} />
            </div>

            {/* ===================== Comment Generator ===================== */}
            <div className="card card-overflow-visible">
                <div className="header-row">
                    <h3 className="title">🧩 Comment Generator</h3>
                    <div className="actions wrap">
                        <div className="chip">
                            <span>Mode</span>
                            <select value={mode} onChange={e => setMode(e.target.value as any)}>
                                <option value="learning">Learning Skills</option>
                                <option value="subject">Subject</option>
                            </select>
                        </div>
                        <div className="chip">
                            <span>Term</span>
                            <select value={term} onChange={e => setTerm(e.target.value)}>{TERMS.map(t => <option key={t} value={t}>{t}</option>)}</select>
                        </div>
                        {mode === 'subject' && (
                            <>
                                <div className="chip">
                                    <span>Category</span>
                                    <select value={category} onChange={e => setCategory(e.target.value)}>
                                        {LS_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                    </select>
                                </div>
                                <div className="chip">
                                    <span>Subject</span>
                                    <select value={subjectId} onChange={e => setSubjectId(e.target.value)}>
                                        {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </>
                        )}
                        {mode === 'learning' && (
                            <div className="chip">
                                <span>Level</span>
                                <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)}>
                                    <option value="All">All</option>
                                    {AVAILABLE_LEVELS.map(l => <option key={l.id} value={l.id}>{l.id}</option>)}
                                </select>
                            </div>
                        )}
                        <button className="btn" onClick={resetAllFilters}>Reset filters</button>
                    </div>
                </div>

                {mode === 'learning' ? (
                    /* ===== LEARNING SKILLS ===== */
                    <div className="gridLearning mt-4">
                        {/* LEFT: Mini-cards grid */}
                        <div className="lsGrid">
                            {([{ id: 'opener', label: 'Opener', type: 'opener' as const }, ...lsList.map(c => ({ id: c.id, label: c.label, type: 'category' as const })), { id: 'next-steps', label: 'Next Steps', type: 'next' as const }] as const).map(sec => {
                                const base = filterForSection(sec).filter(tpl => {
                                    if (levelFilter === 'All') return true;
                                    return extractLevel(tpl.tags || []) === levelFilter;
                                });

                                const q = (searchMap[sec.id] || '').toLowerCase();
                                let filtered = base;

                                if (sec.type !== 'next') {
                                    const lv = panelLevel[sec.id] || 'All';
                                    if (lv !== 'All') filtered = filtered.filter(tpl => extractLevel(tpl.tags || []) === lv);
                                } else {
                                    const catId = panelNextCat[sec.id] || '';
                                    if (catId) filtered = filtered.filter(tpl => hasCat(tpl.tags || [], catId));
                                }

                                const items = filtered.filter(t => !q || (t.text || '').toLowerCase().includes(q));
                                const levelsPresent = Array.from(new Set(base.map(t => extractLevel(t.tags || [])).filter(Boolean))) as string[];
                                const catCounts: Record<string, number> = {};
                                for (const c of lsList) { catCounts[c.id] = base.filter(t => hasCat(t.tags || [], c.id)).length; }

                                const isOpen = openLsCard[sec.id] === true;

                                return (
                                    <div key={sec.id} className={`miniCard ${isOpen ? 'open' : ''}`} aria-expanded={isOpen}>
                                        <button className="miniHead" onClick={() => setOpenLsCard(m => ({ ...m, [sec.id]: !isOpen }))}>
                                            <span className="miniTitle">{sec.label}</span>
                                            <span className="muted">{items.length} suggestion{items.length !== 1 ? 's' : ''}</span>
                                            <span className="miniCaret">{isOpen ? '▴' : '▾'}</span>
                                        </button>

                                        {isOpen && (
                                            <div className="miniBody">
                                                <div className="miniTools">
                                                    <div className="miniToolsRow">
                                                        <input
                                                            className="input"
                                                            placeholder={`Search ${sec.label.toLowerCase()}…`}
                                                            value={searchMap[sec.id] || ''}
                                                            onChange={e => setSearchMap(m => ({ ...m, [sec.id]: e.target.value }))}
                                                        />
                                                        <button className="btn" onClick={() => {
                                                            setSearchMap(m => ({ ...m, [sec.id]: '' }));
                                                            setPanelLevel(m => ({ ...m, [sec.id]: 'All' }));
                                                            setPanelNextCat(m => ({ ...m, [sec.id]: '' }));
                                                        }}>Reset</button>
                                                    </div>

                                                    {sec.type !== 'next' ? (
                                                        <div className="chip-row">
                                                            <span className="muted">Filter level:</span>
                                                            {AVAILABLE_LEVELS.map(l => levelsPresent.includes(l.id) ? (
                                                                <button
                                                                    key={l.id}
                                                                    className={`btn ms-chip ${ (panelLevel[sec.id] || 'All') === l.id ? 'on' : ''}`}
                                                                    onClick={() => setPanelLevel(m => ({ ...m, [sec.id]: (m[sec.id] || 'All') === l.id ? 'All' : l.id }))}
                                                                >
                                                                    {l.icon || getLevelIcon(l.id)} {l.id}
                                                                </button>
                                                            ) : null)}
                                                        </div>
                                                    ) : (
                                                        <div className="chip-row">
                                                            <span className="muted">Filter by category:</span>
                                                            {lsList.map(c => (
                                                                <button
                                                                    key={c.id}
                                                                    className={`btn ms-chip ${ (panelNextCat[sec.id] || '') === c.id ? 'on' : ''}`}
                                                                    onClick={() => setPanelNextCat(m => ({ ...m, [sec.id]: (m[sec.id] || '') === c.id ? '' : c.id }))}
                                                                    title={catCounts[c.id] ? `${catCounts[c.id]} item(s)` : '0 item(s)'}
                                                                >
                                                                    {c.label}{catCounts[c.id] ? ` (${catCounts[c.id]})` : ''}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="ms-list">
                                                    {bankLoading && <div className="muted">Loading…</div>}
                                                    {!bankLoading && items.length === 0 && (
                                                        <div className="muted">
                                                            No templates. <button className="link" onClick={seedForJurisdiction}>Load samples for {(settings?.jurisdiction || 'your region')}</button>
                                                        </div>
                                                    )}
                                                    {items.map(tpl => {
                                                        const lv = extractLevel(tpl.tags || []);
                                                        const picked = isPicked(tpl.id);
                                                        return (
                                                            <label key={tpl.id} className="ms-item">
                                                                <input type="checkbox" checked={picked} onChange={() => onTogglePick(sec as any, tpl)} />
                                                                <span className="ms-lv">{getLevelIcon(lv)}</span>
                                                                <span className="ms-text">{tpl.text}</span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* RIGHT: Final Comment */}
                        <div className="stack-md">
                            <div className="label">Final Comment <span className="muted">({learningWordCount} words)</span></div>
                            <div className="chip-row">
                                <button className="btn" onClick={() => aiAssist('expand')} disabled={!finalComment.trim()}>✨ Expand</button>
                                <button className="btn" onClick={() => aiAssist('rephrase')} disabled={!finalComment.trim()}>🔁 Rephrase</button>
                                <button className="btn" onClick={() => aiAssist('condense')} disabled={!finalComment.trim()}>📉 Shorten</button>
                                <button className="btn" onClick={() => aiAssist('proofread')} disabled={!finalComment.trim()}>✅ Proofread</button>
                                <button className="btn" onClick={() => { if (finalComment.trim()) openEmailWithBody(finalComment.trim(), `Learning Skills — ${defaultEmailSubject(student, '', term)}`); }} disabled={!finalComment.trim()}>✉️ Email this</button>
                            </div>
                            <textarea
                                className="input"
                                rows={14}
                                value={finalComment}
                                onChange={e => {
                                    setFinalParts([{ id: 'manual', text: e.target.value }]);
                                    setSelectedPartIndex(null);
                                }}
                                placeholder="Selections and edits appear here in order…"
                            />
                            <div className="actions wrap">
                                <div className="chip-row">
                                    <button className="btn" onClick={() => moveSelected(-1)} disabled={selectedPartIndex === null || selectedPartIndex <= 0}>Move Up</button>
                                    <button className="btn" onClick={() => moveSelected(1)} disabled={selectedPartIndex === null || selectedPartIndex >= finalParts.length - 1}>Move Down</button>
                                    <button className="btn" onClick={removeSelected} disabled={selectedPartIndex === null}>Remove</button>
                                    <span className="muted">{selectedPartIndex === null ? '—' : `${selectedPartIndex + 1} selected`}</span>
                                </div>
                                <div className="chip-row">
                                    <button className="btn" onClick={() => { navigator.clipboard.writeText(finalComment || ''); }} disabled={!finalComment.trim()}>Copy</button>
                                    <button className="btn btn-primary" onClick={saveLearningComment} disabled={!finalComment.trim()}>Save to Reports</button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* ===== SUBJECT ===== */
                    <div className="grid2 gap-xl mt-4">
                        <div className="composer-grid">
                            <div>
                                <div className="label">Opener</div>
                                <textarea className="input" rows={3} value={opener} onChange={e => setOpener(e.target.value)} />
                                <div className="chip-row mt-1">
                                    <button className="btn" onClick={() => aiOnSlot('opener', 'rephrase')} disabled={!opener.trim()}>🔁 Rephrase</button>
                                    <button className="btn" onClick={() => aiOnSlot('opener', 'condense')} disabled={!opener.trim()}>📉 Shorten</button>
                                    <button className="btn" onClick={() => aiOnSlot('opener', 'proofread')} disabled={!opener.trim()}>✅ Proofread</button>
                                </div>
                            </div>

                            <div>
                                <div className="label">Evidence</div>
                                <textarea className="input" rows={3} value={evidence} onChange={e => setEvidence(e.target.value)} />
                                <div className="chip-row mt-1">
                                    <button className="btn" onClick={() => aiOnSlot('evidence', 'rephrase')} disabled={!evidence.trim()}>🔁 Rephrase</button>
                                    <button className="btn" onClick={() => aiOnSlot('evidence', 'condense')} disabled={!evidence.trim()}>📉 Shorten</button>
                                    <button className="btn" onClick={() => aiOnSlot('evidence', 'proofread')} disabled={!evidence.trim()}>✅ Proofread</button>
                                </div>
                            </div>

                            <div>
                                <div className="label">Next Steps</div>
                                <textarea className="input" rows={3} value={nextSteps} onChange={e => setNextSteps(e.target.value)} />
                                <div className="chip-row mt-1">
                                    <button className="btn" onClick={() => aiOnSlot('next', 'rephrase')} disabled={!nextSteps.trim()}>🔁 Rephrase</button>
                                    <button className="btn" onClick={() => aiOnSlot('next', 'condense')} disabled={!nextSteps.trim()}>📉 Shorten</button>
                                    <button className="btn" onClick={() => aiOnSlot('next', 'proofread')} disabled={!nextSteps.trim()}>✅ Proofread</button>
                                </div>
                            </div>

                            <div>
                                <div className="label">Conclusion</div>
                                <textarea className="input" rows={3} value={conclusion} onChange={e => setConclusion(e.target.value)} />
                                <div className="chip-row mt-1">
                                    <button className="btn" onClick={() => aiOnSlot('conclusion', 'rephrase')} disabled={!conclusion.trim()}>🔁 Rephrase</button>
                                    <button className="btn" onClick={() => aiOnSlot('conclusion', 'condense')} disabled={!conclusion.trim()}>📉 Shorten</button>
                                    <button className="btn" onClick={() => aiOnSlot('conclusion', 'proofread')} disabled={!conclusion.trim()}>✅ Proofread</button>
                                </div>
                            </div>

                            <div className="composer-actions">
                                <div className="chip-row">
                                    <div className="chip">
                                        <span>Insert into</span>
                                        <select value={insertSlot} onChange={e => setInsertSlot(e.target.value as any)}>
                                            <option value="opener">Opener</option>
                                            <option value="evidence">Evidence</option>
                                            <option value="next">Next Steps</option>
                                            <option value="conclusion">Conclusion</option>
                                        </select>
                                    </div>
                                    <button className="btn" onClick={applySubjectDefaults}>✨ Apply Defaults</button>
                                </div>
                                <div className="actions">
                                    <button className="btn" onClick={() => { setOpener(''); setEvidence(''); setNextSteps(''); setConclusion(''); }}>Clear</button>
                                    <button className="btn" onClick={() => { if (subjectJoined.trim()) openEmailWithBody(subjectJoined.trim()); }} disabled={!opener.trim() && !evidence.trim() && !nextSteps.trim() && !conclusion.trim()}>✉️ Email this</button>
                                    <button className="btn btn-primary" onClick={saveSubjectComment} disabled={!opener.trim() && !evidence.trim() && !nextSteps.trim() && !conclusion.trim()}>💾 Save Comment</button>
                                </div>
                            </div>

                            {/* Live Preview */}
                            <div className="preview">
                                <div className="flex-between">
                                    <div className="label">Live Preview (joined)</div>
                                    <div className="sub">{subjectWordCount} words</div>
                                </div>
                                <div className="preview-body">{subjectJoined || <span className="muted">Nothing to preview yet.</span>}</div>
                            </div>
                        </div>

                        {/* Suggestions + Recent Evidence together */}
                        <div className="stack-md">
                            <div className="label">Suggestions</div>
                            <div className="chip"><input className="input bare" placeholder="Filter suggestions…" value={bankSearch} onChange={e => setBankSearch(e.target.value)} /></div>
                            <div className="bank">
                                {bankFiltered.length === 0 && <div className="muted">No matching templates.</div>}
                                {bankFiltered.map((t, i) => (
                                    <button key={i} className="snippet" onClick={() => insertFromBank(t)}>{t}</button>
                                ))}
                            </div>

                            <RecentEvidence notes={(student?.notes || [])} subjectId={subjectId} onInsert={(txt) => insertFromBank(txt)} />
                        </div>
                    </div>
                )}
            </div>

            {/* ===================== Bottom (collapsed by default) ===================== */}
            <div className="grid2 gap-xl">
                <div className="stack-md">
                    <div className="card">
                        <div className="flex-between">
                            <span className="title">🕓 Past Learning Skill Comments</span>
                            <button className="btn" onClick={() => setShowPastLearning(v => !v)}>{showPastLearning ? 'Hide' : 'Show'}</button>
                        </div>
                        {showPastLearning && (
                            <div className="table-wrap mt-3">
                                {pastLearning.length === 0 && <div className="muted">None yet.</div>}
                                {pastLearning.length > 0 && (
                                    <table className="w-full text-sm">
                                        <thead><tr className="text-left text-[var(--muted)]"><th className="py-2">When</th><th>Tags</th><th>Body</th></tr></thead>
                                        <tbody>
                                        {pastLearning.map(n => (
                                            <tr key={n.id} className="border-t border-[var(--border)]">
                                                <td className="py-2">{new Date(n.createdAt).toLocaleString()}</td>
                                                <td className="sub">{(n.tags || []).join(', ')}</td>
                                                <td style={{ whiteSpace: 'pre-wrap' }}>{n.body}</td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="card">
                        <div className="flex-between">
                            <h3 className="title">🗒️ Quick Note</h3>
                            <button className="btn" onClick={() => setShowQuickNote(v => !v)}>{showQuickNote ? 'Hide' : 'Show'}</button>
                        </div>
                        {showQuickNote && (
                            <>
                                <textarea className="input mt-3" placeholder="Write a quick note…" value={quickNote} onChange={e => setQuickNote(e.target.value)} />
                                <div className="mt-2"><button className="btn btn-primary" onClick={addQuickNote} disabled={!quickNote.trim()}>Add Note</button></div>
                            </>
                        )}
                    </div>
                </div>

                <div className="stack-md">
                    <div className="card">
                        <div className="flex-between">
                            <span className="title">📚 Past Subject Comments</span>
                            <button className="btn" onClick={() => setShowPastSubject(v => !v)}>{showPastSubject ? 'Hide' : 'Show'}</button>
                        </div>
                        {showPastSubject && (
                            <div className="table-wrap mt-3">
                                {pastSubject.length === 0 && <div className="muted">None yet.</div>}
                                {pastSubject.length > 0 && (
                                    <table className="w-full text-sm">
                                        <thead><tr className="text-left text-[var(--muted)]"><th className="py-2">When</th><th>Tags</th><th>Body</th></tr></thead>
                                        <tbody>
                                        {pastSubject.map(n => (
                                            <tr key={n.id} className="border-t border-[var(--border)]">
                                                <td className="py-2">{new Date(n.createdAt).toLocaleString()}</td>
                                                <td className="sub">{(n.tags || []).join(', ')}</td>
                                                <td style={{ whiteSpace: 'pre-wrap' }}>{n.body}</td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="card">
                        <div className="flex-between">
                            <span className="title">📌 Assignment Evidence</span>
                            <button className="btn" onClick={() => setShowAssignmentEvidence(v => !v)}>{showAssignmentEvidence ? 'Hide' : 'Show'}</button>
                        </div>
                        {showAssignmentEvidence && (
                            <>
                                {assignmentEvidence.length === 0 && <div className="muted mt-2">No assignment-linked notes yet.</div>}
                                {assignmentEvidence.length > 0 && (
                                    <div className="table-wrap mt-3">
                                        <table className="w-full text-sm">
                                            <thead>
                                            <tr className="text-left text-[var(--muted)]">
                                                <th className="py-2">Assignment</th>
                                                <th>When</th>
                                                <th>Tags</th>
                                                <th>Excerpt</th>
                                            </tr>
                                            </thead>
                                            <tbody>
                                            {assignmentEvidence.map(group => {
                                                const human = group.key.replace(/^assignment:/, '') || 'unknown';
                                                return group.list.map(n => (
                                                    <tr key={n.id} className="border-t border-[var(--border)]">
                                                        <td className="py-2">{human}</td>
                                                        <td className="sub">{new Date(n.createdAt).toLocaleString()}</td>
                                                        <td className="sub">{(n.tags || []).join(', ')}</td>
                                                        <td style={{ whiteSpace: 'pre-wrap' }}>{n.body.length > 160 ? n.body.slice(0, 160) + '…' : n.body}</td>
                                                    </tr>
                                                ));
                                            })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="card">
                        <div className="flex-between">
                            <span className="title">📧 Email Log</span>
                            <div className="actions wrap">
                                <button className="btn" onClick={() => setShowEmailLog(v => !v)}>{showEmailLog ? 'Hide' : 'Show'}</button>
                                <button className="btn btn-primary" onClick={() => setEmailOpen(true)}>Compose Email</button>
                            </div>
                        </div>
                        {showEmailLog && (
                            <>
                                {emailLog.length === 0 && <div className="muted mt-2">No emails logged.</div>}
                                {emailLog.length > 0 && (
                                    <div className="table-wrap mt-3">
                                        <table className="w-full text-sm">
                                            <thead><tr className="text-left text-[var(--muted)]"><th className="py-2">When</th><th>Author</th><th>Tags</th><th>Body</th></tr></thead>
                                            <tbody>
                                            {emailLog.map(n => (
                                                <tr key={n.id} className="border-t border-[var(--border)]">
                                                    <td className="py-2">{new Date(n.createdAt).toLocaleString()}</td>
                                                    <td className="sub">{n.author?.name || n.author?.email || '—'}</td>
                                                    <td className="sub">{(n.tags || []).join(', ')}</td>
                                                    <td style={{ whiteSpace: 'pre-wrap' }}>{n.body}</td>
                                                </tr>
                                            ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ✅ Compose Email Drawer mount */}
            {emailOpen && (
                <ComposeEmailDrawer
                    open={emailOpen}
                    onClose={() => setEmailOpen(false)}
                    guardians={guardians}
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
                    onApplyTemplate={applyEmailTemplate}
                    onSaveLog={saveEmailToLog}
                    onAi={aiForEmail}
                    aiLoading={aiEmailLoading}
                    buildMailUrl={(prov, to, subject, body) => {
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

            {/* Styles */}
            <style jsx>{`
                .title { font-size: 18px; font-weight: 700; display:flex; align-items:center; gap:8px; }
                .sub { font-size: 12px; color: var(--muted); }
                .muted { color: var(--muted); }
                .mt-1 { margin-top: 4px; }
                .mt-2 { margin-top: 8px; }
                .mt-3 { margin-top: 12px; }

                .card {
                    background: var(--panel, #0e122b);
                    border: 1px solid var(--border, #1f2547);
                    border-radius: 14px;
                    padding: 16px;
                    position: relative; /* ensure stacking context for hover lift */
                    overflow: visible;
                }
                .card-overflow-visible { overflow: visible; }
                .header-row { display:flex; align-items:center; justify-content:space-between; gap: 14px; flex-wrap:wrap; position: relative; z-index: 5; }
                .actions { display:flex; gap:10px; align-items:center; }
                .actions.wrap { flex-wrap: wrap; row-gap: 8px; }
                .chip-row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
                .chip-row.roomy { row-gap: 10px; }
                .chip { display:inline-flex; align-items:center; gap:10px; padding:8px 12px; border:1px solid var(--border); border-radius:9999px; background: rgba(255,255,255,0.03); }
                .chip select, .chip .input.bare { background: transparent; color: inherit; border: none; outline: none; }

                .field + .field { margin-top: 16px; }

                .grid2 { display:grid; grid-template-columns: 1.2fr 1fr; gap: 20px; }
                .gap-xl { gap: 22px; }
                @media (max-width: 1100px) { .grid2 { grid-template-columns: 1fr; } }

                .grid3 { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 16px; }
                @media (max-width: 900px) { .grid3 { grid-template-columns: 1fr; } }
                .stack-lg { display:flex; flex-direction:column; gap: 16px; }
                .stack-md { display:flex; flex-direction:column; gap: 12px; }

                .label { font-size: 12px; color: var(--muted); margin-bottom: 6px; }
                .input {
                    width: 100%;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    padding: 12px 14px;
                    color: inherit; line-height: 1.35;
                }

                .flag-row { display: flex; gap: 8px; flex-wrap: wrap; }
                .flag.pill { padding: 4px 10px; border-radius: 9999px; background: rgba(255,255,255,0.06); border: 1px solid var(--border); }
                .flag-check { display: inline-flex; gap: 8px; align-items: center; margin-right: 12px; }

                .inline-note { display:flex; gap:8px; align-items:center; min-width: 340px; }
                .inline-note .input { padding: 10px 12px; }

                .wrap-gap { gap: 10px; flex-wrap: wrap; }
                .flex-between { display:flex; align-items:center; justify-content:space-between; gap:10px; }
                .table-wrap { overflow-x:auto; }

                .btn { border:1px solid var(--border); background: rgba(255,255,255,0.05); padding:10px 12px; border-radius:12px; }
                .btn.on { background: rgba(99, 102, 241, 0.22); border-color: rgba(99, 102, 241, 0.55); }
                .btn-primary { background: rgba(99, 102, 241, 0.22); border-color: rgba(99, 102, 241, 0.55); }
                .link { text-decoration: underline; }

                /* Learning layout */
                .gridLearning { display:grid; grid-template-columns: 1.2fr 1fr; gap: 22px; }
                @media (max-width: 1100px) { .gridLearning { grid-template-columns: 1fr; } }

                /* Mini-cards grid */
                .lsGrid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 14px;
                }
                @media (max-width: 900px) { .lsGrid { grid-template-columns: 1fr; } }

                .miniCard { border: 1px solid var(--border); border-radius: 14px; background: rgba(255,255,255,0.03); }
                .miniHead {
                    width: 100%;
                    display:flex; align-items:center; justify-content:space-between;
                    gap:12px; padding: 10px 12px;
                    border-bottom: 1px solid var(--border);
                    background: rgba(255,255,255,0.03);
                    border-radius: 14px 14px 0 0;
                }
                .miniTitle { font-weight: 700; }
                .miniCaret { opacity: .7; }
                .miniBody { padding: 10px; display:flex; flex-direction:column; gap: 10px; max-height: 340px; overflow: auto; }
                .miniTools {
                    position: sticky; top: 0; z-index: 6; background: #0b1020;
                    padding-bottom: 10px; margin-bottom: 8px; border-bottom: 1px solid var(--border);
                }
                .miniToolsRow { display:flex; gap:8px; align-items:center; }

                .ms-list { display:flex; flex-direction:column; gap:10px; }
                .ms-item {
                    display:flex; align-items:flex-start; gap:12px;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    padding: 10px 12px;
                }
                .ms-item:hover { background: rgba(255,255,255,0.07); }
                .ms-item input { margin-top: 3px; }
                .ms-lv { width: 18px; text-align: center; opacity: .85; }
                .ms-text { white-space: pre-wrap; line-height: 1.42; }

                /* Subject composer */
                .composer-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 18px 20px; }
                @media (max-width: 1000px) { .composer-grid { grid-template-columns: 1fr; } }
                .composer-actions { grid-column: 1 / -1; display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:6px; }

                /* Bank / Templates */
                .bank { max-height: 360px; overflow: auto; border: 1px solid var(--border); border-radius: 14px; padding: 12px; margin-top: 8px; }
                .snippet { display:block; width:100%; text-align:left; background: rgba(255,255,255,0.05); border:1px solid var(--border); border-radius:12px; padding:12px 14px; margin-bottom:10px; white-space: pre-wrap; line-height: 1.42; }

                /* Live Preview */
                .preview { grid-column: 1 / -1; border: 1px solid var(--border); border-radius: 12px; padding: 10px; background: rgba(255,255,255,0.03); }
                .preview-body { white-space: pre-wrap; line-height: 1.45; margin-top: 6px; }

                /* Overlay safety */
                .overlay-anchor { position: relative; z-index: 1000; }
                .card:focus-within, .card:hover { z-index: 20; }

                /* Catch common portaled popovers/menus to ensure always-on-top */
                :global([role="menu"]),
                :global([role="dialog"]),
                :global([role="listbox"]),
                :global([data-radix-popover-content]),
                :global([data-radix-dropdown-menu-content]),
                :global(.headlessui-portal),
                :global(.tippy-box),
                :global(.chakra-portal),
                :global(.mantine-Popover-dropdown),
                :global(.react-select__menu),
                :global(.Select__menu),
                :global(.rc-select-dropdown),
                :global(.dropdown-menu),
                :global(.popover),
                :global(.menu),
                :global(.tooltip) {
                    z-index: 2147483647 !important;
                    position: relative;
                }
                .overlay-anchor > :global(*) { position: relative; z-index: inherit; }
            `}</style>
        </div>
    );
}