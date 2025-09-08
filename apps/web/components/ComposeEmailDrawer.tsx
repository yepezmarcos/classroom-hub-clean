'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/* =========================
   Types
   ========================= */

type Guardian = {
    name: string;
    email?: string | null;
    phone?: string | null;
    relationship?: string | null;
};

type CommentTemplate = {
    id: string;
    subject?: string | null;
    text: string;
    tags: string[];
};

type Provider = 'default' | 'gmail' | 'outlook' | 'office';

/* =========================
   Component
   ========================= */

export default function ComposeEmailDrawer({
                                               open,
                                               onClose,

                                               guardians,

                                               provider,
                                               setProvider,

                                               targetGuardian,
                                               setTargetGuardian,

                                               emailSubject,
                                               setEmailSubject,

                                               emailBody,
                                               setEmailBody,

                                               emailTopic,
                                               setEmailTopic,

                                               emailMethod,
                                               setEmailMethod,

                                               emailTone,
                                               setEmailTone,

                                               emailTemplates,
                                               onApplyTemplate,

                                               onSaveLog,
                                               onSend,
                                               onAi,
                                               aiLoading,

                                               onAiAdvanced,
                                               buildMailUrl, // kept for back-compat (unused here; we build cc/bcc aware links below)
                                           }: {
    open: boolean;
    onClose: () => void;

    guardians: Guardian[];

    provider: Provider;
    setProvider: (p: Provider) => void;

    targetGuardian: string; // comma-separated for multi
    setTargetGuardian: (v: string) => void;

    emailSubject: string;
    setEmailSubject: (v: string) => void;

    emailBody: string;
    setEmailBody: (v: string) => void;

    emailTopic: string;
    setEmailTopic: (v: string) => void;

    emailMethod: string;
    setEmailMethod: (v: string) => void;

    emailTone: 'Neutral' | 'Warm' | 'Professional' | 'Encouraging' | 'Direct';
    setEmailTone: (v: 'Neutral' | 'Warm' | 'Professional' | 'Encouraging' | 'Direct') => void;

    emailTemplates: CommentTemplate[];
    onApplyTemplate: (tpl: CommentTemplate, mode: 'insert' | 'replace') => void;

    onSaveLog: () => Promise<void>;
    onSend?: (to: string, subject: string, body: string, cc?: string, bcc?: string) => Promise<void>;

    onAi: (kind: 'generate' | 'rephrase' | 'condense' | 'proofread') => Promise<void>;
    aiLoading: boolean;

    onAiAdvanced?: (
        kind: 'generate' | 'rephrase' | 'condense' | 'proofread',
        options: { hint?: string; topic?: string; tone?: string; length?: 'Short' | 'Medium' | 'Long' }
    ) => Promise<{ subject?: string; body?: string }>;

    buildMailUrl: (provider: Provider, to: string, subject: string, body: string) => string;
}) {
    /* =========================
       Portal root (guarantees side-drawer from viewport edge)
       ========================= */
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    /* =========================
       Local state
       ========================= */
    const [localFilter, setLocalFilter] = useState('');
    const [sending, setSending] = useState(false);
    const [closing, setClosing] = useState(false);

    // Recipients as chips (comma-separated under the hood)
    const [cc, setCc] = useState('');
    const [bcc, setBcc] = useState('');
    const [showCcBcc, setShowCcBcc] = useState(false);

    // Signature
    const [signature, setSignature] = useState('');
    const [includeSignature, setIncludeSignature] = useState(true);

    // Template UI
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
    const [customizing, setCustomizing] =
        useState<{ id: string; subject: string; body: string } | null>(null);

    // AI Studio
    const [aiHint, setAiHint] = useState('');
    const [aiLength, setAiLength] = useState<'Short' | 'Medium' | 'Long'>('Medium');

    // Refs
    const subjectRef = useRef<HTMLInputElement | null>(null);

    /* =========================
       Effects
       ========================= */
    // Reset transient state on open/close
    useEffect(() => {
        if (!open) {
            setLocalFilter('');
            setSending(false);
            setCustomizing(null);
            setClosing(false);
            return;
        }
        const t = setTimeout(() => subjectRef.current?.focus(), 80);
        return () => clearTimeout(t);
    }, [open]);

    // Lock page scroll while open
    useEffect(() => {
        if (!open) return;
        const el = document.documentElement;
        const prev = el.style.overflow;
        el.style.overflow = 'hidden';
        return () => {
            el.style.overflow = prev;
        };
    }, [open]);

    // Load saved signature
    useEffect(() => {
        try {
            const saved = localStorage.getItem('teacher_signature') || '';
            const incl = localStorage.getItem('teacher_signature_include') || '1';
            setSignature(saved);
            setIncludeSignature(incl === '1');
        } catch {}
    }, []);

    // Load default comms prefs when opening
    useEffect(() => {
        if (!open) return;
        try {
            const dp = localStorage.getItem('teacher_default_provider') as Provider | null;
            if (dp) setProvider(dp);
            const dt = localStorage.getItem('teacher_default_tone') as any;
            if (dt) setEmailTone(dt);
            const dtopic = localStorage.getItem('teacher_default_topic');
            if (dtopic) setEmailTopic(dtopic);
            const show = localStorage.getItem('teacher_default_show_ccbcc') === '1';
            if (show) setShowCcBcc(true);
            // Prefill CC/BCC if empty
            const dcc = localStorage.getItem('teacher_default_cc') || '';
            const dbcc = localStorage.getItem('teacher_default_bcc') || '';
            if (show) {
                if (!cc) setCc(dcc);
                if (!bcc) setBcc(dbcc);
            }
        } catch {}
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Persist signature
    useEffect(() => {
        try {
            localStorage.setItem('teacher_signature', signature || '');
        } catch {}
    }, [signature]);
    useEffect(() => {
        try {
            localStorage.setItem('teacher_signature_include', includeSignature ? '1' : '0');
        } catch {}
    }, [includeSignature]);

    // Keyboard shortcuts
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'enter') {
                e.preventDefault();
                void handleSend();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                beginClose();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, provider, targetGuardian, emailSubject, emailBody, cc, bcc, includeSignature, signature, sending]);

    /* =========================
       Helpers
       ========================= */
    const recipients = useMemo(
        () => (targetGuardian || '').split(',').map((s) => s.trim()).filter(Boolean),
        [targetGuardian]
    );
    const invalidRecipients = useMemo(() => recipients.filter((r) => !isValidEmail(r)), [recipients]);

    function addRecipient(addr: string) {
        const v = (addr || '').trim();
        if (!v) return;
        const uniq = Array.from(new Set([...recipients, v]));
        setTargetGuardian(uniq.join(','));
    }
    function removeRecipient(addr: string) {
        setTargetGuardian(recipients.filter((r) => r !== addr).join(','));
    }
    function addAllGuardians() {
        const all = guardians.map((g) => g.email || '').filter(Boolean);
        const uniq = Array.from(new Set([...recipients, ...all]));
        setTargetGuardian(uniq.join(','));
    }

    function withSignature(body: string) {
        if (!includeSignature || !signature.trim()) return body;
        const sep = body.trim().endsWith('\n') ? '' : '\n\n';
        return `${body}${sep}—\n${signature.trim()}`;
    }

    // CC/BCC aware compose url (Gmail/Outlook/Office/mailto)
    function buildHref(
        p: Provider,
        to: string,
        subject: string,
        body: string,
        ccStr?: string,
        bccStr?: string
    ) {
        const enc = encodeURIComponent;
        const toParam = to || '';
        const ccParam = (ccStr || '').trim();
        const bccParam = (bccStr || '').trim();
        const baseBody = withSignature(body);

        if (p === 'gmail') {
            let url = `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(toParam)}&su=${enc(subject)}&body=${enc(
                baseBody
            )}`;
            if (ccParam) url += `&cc=${enc(ccParam)}`;
            if (bccParam) url += `&bcc=${enc(bccParam)}`;
            return url;
        }
        if (p === 'outlook') {
            let url = `https://outlook.live.com/mail/0/deeplink/compose?to=${enc(toParam)}&subject=${enc(
                subject
            )}&body=${enc(baseBody)}`;
            if (ccParam) url += `&cc=${enc(ccParam)}`;
            if (bccParam) url += `&bcc=${enc(bccParam)}`;
            return url;
        }
        if (p === 'office') {
            let url = `https://outlook.office.com/mail/deeplink/compose?to=${enc(toParam)}&subject=${enc(
                subject
            )}&body=${enc(baseBody)}`;
            if (ccParam) url += `&cc=${enc(ccParam)}`;
            if (bccParam) url += `&bcc=${enc(bccParam)}`;
            return url;
        }
        const parts = [
            `subject=${enc(subject)}`,
            `body=${enc(baseBody)}`,
            ccParam ? `cc=${enc(ccParam)}` : '',
            bccParam ? `bcc=${enc(bccParam)}` : '',
        ]
            .filter(Boolean)
            .join('&');
        return `mailto:${encodeURIComponent(toParam)}?${parts}`;
    }

    // Group templates by topic:* tag; fall back to "General"
    const templatesByTopic = useMemo(() => {
        const map = new Map<string, CommentTemplate[]>();
        for (const tpl of emailTemplates || []) {
            const tags = (tpl.tags || []).map((t) => t.toLowerCase());
            const topicTag = tags.find((t) => t.startsWith('topic:'));
            const topic = topicTag ? topicTag.split(':')[1] || 'General' : 'General';
            const key = topic.charAt(0).toUpperCase() + topic.slice(1);
            map.set(key, [...(map.get(key) || []), tpl]);
        }
        // sort groups alphabetically; keep “General” first
        const entries = Array.from(map.entries()).sort(([a], [b]) => {
            if (a === 'General') return -1;
            if (b === 'General') return 1;
            return a.localeCompare(b);
        });
        return entries;
    }, [emailTemplates]);

    const filteredTemplates = useMemo(() => {
        const q = localFilter.trim().toLowerCase();
        if (!q) return templatesByTopic;
        const hits: [string, CommentTemplate[]][] = [];
        for (const [topic, list] of templatesByTopic) {
            const subset = list.filter((t) => {
                const hay = `${t.subject || ''}\n${t.text || ''}\n${(t.tags || []).join(' ')}`.toLowerCase();
                return hay.includes(q);
            });
            if (subset.length) hits.push([topic, subset]);
        }
        return hits;
    }, [templatesByTopic, localFilter]);

    const to = recipients.join(',');
    const canSend =
        !!to && !!emailSubject.trim() && !!emailBody.trim() && invalidRecipients.length === 0;

    /* =========================
       Actions
       ========================= */
    function beginClose() {
        setClosing(true);
        // match slideOut duration
        setTimeout(() => {
            setClosing(false);
            onClose();
        }, 260);
    }

    async function handleSend() {
        if (!canSend || sending) return;
        try {
            setSending(true);
            // 1) auto-log
            if (onSend) {
                await onSend(to, emailSubject, withSignature(emailBody), cc, bcc);
            } else {
                await onSaveLog();
            }
            // 2) open provider compose
            const href = buildHref(provider, to, emailSubject, emailBody, cc, bcc);
            if (provider === 'default') window.location.href = href;
            else window.open(href, '_blank', 'noopener,noreferrer');
        } finally {
            setSending(false);
            // 3) slide out
            beginClose();
        }
    }

    async function handleAi(kind: 'generate' | 'rephrase' | 'condense' | 'proofread') {
        if (onAiAdvanced) {
            try {
                const res = await onAiAdvanced(kind, {
                    hint: aiHint || undefined,
                    topic: emailTopic,
                    tone: emailTone,
                    length: aiLength,
                });
                if (res?.subject) setEmailSubject(res.subject);
                if (res?.body) setEmailBody(res.body);
                return;
            } catch {
                // fall through to basic handler
            }
        }
        await onAi(kind);
    }

    function beginCustomize(tpl: CommentTemplate) {
        setCustomizing({
            id: tpl.id,
            subject: tpl.subject || '',
            body: tpl.text || '',
        });
    }
    function applyCustomize(mode: 'insert' | 'replace') {
        if (!customizing) return;
        const fakeTpl: CommentTemplate = {
            id: customizing.id,
            subject: customizing.subject,
            text: customizing.body,
            tags: [],
        };
        onApplyTemplate(fakeTpl, mode);
        setCustomizing(null);
    }

    /* =========================
       Render (portaled)
       ========================= */
    if (!open || !mounted) return null;

    const dialogTitleId = 'compose-title';

    const overlay = (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby={dialogTitleId}>
            {/* Backdrop with blur */}
            <button className="backdrop" onClick={beginClose} aria-label="Close email composer" />

            {/* Right drawer */}
            <div className={`panel ${closing ? 'closing' : 'opening'}`} role="document">
                {/* Header */}
                <div className="head">
                    <div className="headL">
                        <div id={dialogTitleId} className="title">✉️ Compose Email</div>
                        <div className="subtitle">
                            Draft, personalize, and send to guardians. Sending automatically saves this to the student log.
                        </div>
                    </div>
                    <button className="btn" onClick={beginClose} aria-label="Close composer">Close</button>
                </div>

                {/* Sticky toolbar */}
                <div className="toolbar" aria-label="Writing helpers">
                    <div className="chip-row">
                        <button
                            className="btn"
                            onClick={() => handleAi('generate')}
                            disabled={aiLoading || sending}
                            title="Create a fresh draft using the options on the right."
                        >
                            ✨ Generate
                        </button>
                        <button
                            className="btn"
                            onClick={() => handleAi('rephrase')}
                            disabled={aiLoading || sending}
                            title="Rewrite your draft with the selected tone."
                        >
                            🔁 Rephrase
                        </button>
                        <button
                            className="btn"
                            onClick={() => handleAi('condense')}
                            disabled={aiLoading || sending}
                            title="Shorten the message and keep essentials."
                        >
                            📉 Condense
                        </button>
                        <button
                            className="btn"
                            onClick={() => handleAi('proofread')}
                            disabled={aiLoading || sending}
                            title="Fix grammar and clarity; preserves meaning."
                        >
                            ✅ Proofread
                        </button>
                        {(aiLoading || sending) && <span className="muted">{sending ? 'Sending…' : 'Thinking…'}</span>}
                    </div>

                    <div className="chip-row right">
                        <label className="mini">Tone</label>
                        <select
                            className="input slim"
                            value={emailTone}
                            onChange={(e) => setEmailTone(e.target.value as any)}
                            disabled={sending}
                            aria-label="Select tone"
                        >
                            <option>Neutral</option>
                            <option>Warm</option>
                            <option>Professional</option>
                            <option>Encouraging</option>
                            <option>Direct</option>
                        </select>

                        <label className="mini">Topic</label>
                        <select
                            className="input slim"
                            value={emailTopic}
                            onChange={(e) => setEmailTopic(e.target.value)}
                            disabled={sending}
                            aria-label="Select topic"
                        >
                            <option>General</option>
                            <option>Progress</option>
                            <option>Concern</option>
                            <option>Positive</option>
                            <option>Attendance</option>
                            <option>Behavior</option>
                            <option>Assignment</option>
                            <option>Meeting</option>
                        </select>

                        <label className="mini">Length</label>
                        <select
                            className="input slim"
                            value={aiLength}
                            onChange={(e) => setAiLength(e.target.value as any)}
                            disabled={sending}
                            aria-label="Select length"
                        >
                            <option>Short</option>
                            <option>Medium</option>
                            <option>Long</option>
                        </select>
                    </div>
                </div>

                {/* Scrollable content */}
                <div className="stack-md">
                    {/* Recipients & Provider */}
                    <div className="grid2">
                        <div>
                            <div className="label">Step 1 — Recipients</div>
                            <div className="help">
                                Choose one or more guardians. Use <b>+ Add recipient…</b> or add everyone with <b>+ All</b>.
                            </div>
                            <div className="chips">
                                {recipients.map((addr) => (
                                    <span
                                        key={addr}
                                        className={`pill ${invalidRecipients.includes(addr) ? 'bad' : ''}`}
                                        title={invalidRecipients.includes(addr) ? 'Invalid email format' : ''}
                                    >
                                        {addr}
                                        <button className="pill-x" onClick={() => removeRecipient(addr)} aria-label={`Remove ${addr}`}>
                                            ×
                                        </button>
                                    </span>
                                ))}
                                <RecipientPicker guardians={guardians} onPick={addRecipient} disabled={sending} />
                                <button
                                    className="btn pill-add"
                                    onClick={addAllGuardians}
                                    disabled={sending || !guardians.some((g) => g.email)}
                                    title="Add all guardians"
                                >
                                    + All
                                </button>
                            </div>
                            {invalidRecipients.length > 0 && (
                                <div className="warn mt-1">
                                    Please remove or fix invalid addresses: {invalidRecipients.join(', ')}
                                </div>
                            )}
                            {to.includes(',') && <div className="sub mt-1">Sending to {recipients.length} recipients.</div>}
                        </div>

                        <div>
                            <div className="label">Step 2 — Provider</div>
                            <div className="help">Where should this open? (Your message is still saved to the log here.)</div>
                            <select
                                className="input"
                                value={provider}
                                onChange={(e) => setProvider(e.target.value as Provider)}
                                disabled={sending}
                                aria-label="Choose provider"
                            >
                                <option value="default">Default Mail app</option>
                                <option value="gmail">Gmail (web)</option>
                                <option value="outlook">Outlook.com</option>
                                <option value="office">Outlook 365 (web)</option>
                            </select>

                            <div className="ccbcc">
                                <label className="flag-check" title="Add optional recipients—others can see CC; BCC is hidden.">
                                    <input
                                        type="checkbox"
                                        checked={showCcBcc}
                                        onChange={(e) => setShowCcBcc(e.target.checked)}
                                    />{' '}
                                    CC/BCC
                                </label>
                            </div>
                            {showCcBcc && (
                                <div className="grid2 mt-1">
                                    <input
                                        className="input"
                                        placeholder="CC (comma separated)"
                                        value={cc}
                                        onChange={(e) => setCc(e.target.value)}
                                        disabled={sending}
                                    />
                                    <input
                                        className="input"
                                        placeholder="BCC (comma separated)"
                                        value={bcc}
                                        onChange={(e) => setBcc(e.target.value)}
                                        disabled={sending}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Subject / Body */}
                    <div>
                        <div className="label">Step 3 — Subject</div>
                        <div className="help">Keep it clear and specific (e.g., “Update on Jamal’s Math Progress”).</div>
                        <input
                            ref={subjectRef}
                            className="input"
                            value={emailSubject}
                            onChange={(e) => setEmailSubject(e.target.value)}
                            placeholder="Subject…"
                            disabled={sending}
                            aria-label="Email subject"
                        />
                        <div className="sub mt-1">{emailSubject.length}/120 characters</div>
                    </div>

                    <div>
                        <div className="label">Step 4 — Message</div>
                        <div className="help">
                            Share one positive, one area to grow, and the next step. Be concrete and supportive.
                        </div>
                        <textarea
                            className="input"
                            rows={12}
                            value={emailBody}
                            onChange={(e) => setEmailBody(e.target.value)}
                            placeholder="Write your message…"
                            disabled={sending}
                            aria-label="Email message body"
                        />
                        <div className="sub mt-1">{emailBody.length} characters</div>
                        <div className="chip-row mt-1">
                            <label className="flag-check">
                                <input
                                    type="checkbox"
                                    checked={includeSignature}
                                    onChange={(e) => setIncludeSignature(e.target.checked)}
                                />
                                Include signature
                            </label>
                            <SignatureEditor signature={signature} setSignature={setSignature} disabled={sending} />
                        </div>
                    </div>

                    {/* Templates */}
                    <div className="label flex-between">
                        <span>Templates</span>
                        <input
                            className="input slim"
                            placeholder="Filter templates…"
                            value={localFilter}
                            onChange={(e) => setLocalFilter(e.target.value)}
                            disabled={sending}
                            aria-label="Filter templates"
                        />
                    </div>
                    <div className="tmplList">
                        {filteredTemplates.length === 0 && <div className="muted">No matching templates.</div>}
                        {filteredTemplates.map(([topic, list]) => {
                            const isOpen = openGroups[topic] ?? true;
                            return (
                                <div key={topic} className="group">
                                    <button
                                        className="groupHead"
                                        onClick={() => setOpenGroups((m) => ({ ...m, [topic]: !isOpen }))}
                                        aria-expanded={isOpen}
                                        aria-controls={`group-${topic}`}
                                    >
                                        <div className="groupTitle">{topic}</div>
                                        <div className="muted">
                                            {list.length} template{list.length !== 1 ? 's' : ''}
                                        </div>
                                        <div className="caret">{isOpen ? '▴' : '▾'}</div>
                                    </button>
                                    {isOpen && (
                                        <div className="groupBody" id={`group-${topic}`}>
                                            {list.map((tpl) => (
                                                <div key={tpl.id} className="tmpl">
                                                    <div className="tmplHead">
                                                        <div className="tmplTitle">{tpl.subject || 'Untitled'}</div>
                                                        <div className="chip-row">
                                                            <button className="btn" onClick={() => onApplyTemplate(tpl, 'insert')} disabled={sending}>
                                                                Insert
                                                            </button>
                                                            <button className="btn" onClick={() => onApplyTemplate(tpl, 'replace')} disabled={sending}>
                                                                Replace
                                                            </button>
                                                            <button className="btn" onClick={() => beginCustomize(tpl)} disabled={sending}>
                                                                Customize
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <pre className="tmplBody">{tpl.text}</pre>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Sticky action bar */}
                <div className="actions wrap">
                    {!canSend && (
                        <div className="warn">
                            To send, add at least one valid recipient, a subject, and a message.
                        </div>
                    )}
                    <div className="spacer" />
                    <button
                        className="btn btn-primary"
                        onClick={handleSend}
                        disabled={!canSend || sending}
                        title="Auto-saves to log, opens your provider, then closes"
                    >
                        {sending
                            ? 'Sending…'
                            : `Send (opens ${
                                provider === 'default' ? 'Mail app' : provider === 'gmail' ? 'Gmail' : 'Outlook'
                            })`}
                    </button>
                    <button
                        className="btn"
                        onClick={onSaveLog}
                        disabled={!emailBody.trim() || !emailSubject.trim() || !to || sending}
                        title="Save this message to the student log without opening your email"
                    >
                        Save to Log (only)
                    </button>
                    <span className="muted tips">Tip: Press ⌘/Ctrl + Enter to send.</span>
                </div>

                {/* Customize modal (inside drawer) */}
                {customizing && (
                    <div className="customize" role="dialog" aria-modal="true" aria-label="Customize Template">
                        <div className="customPanel">
                            <div className="head">
                                <div className="title">Customize Template</div>
                                <button className="btn" onClick={() => setCustomizing(null)} aria-label="Close">Close</button>
                            </div>
                            <div className="stack-md">
                                <div>
                                    <div className="label">Subject</div>
                                    <input
                                        className="input"
                                        value={customizing.subject}
                                        onChange={(e) =>
                                            setCustomizing((v) => (v ? { ...v, subject: e.target.value } : v))
                                        }
                                    />
                                </div>
                                <div>
                                    <div className="label">Body</div>
                                    <textarea
                                        className="input"
                                        rows={10}
                                        value={customizing.body}
                                        onChange={(e) =>
                                            setCustomizing((v) => (v ? { ...v, body: e.target.value } : v))
                                        }
                                    />
                                </div>
                                <div className="chip-row">
                                    <button className="btn" onClick={() => applyCustomize('insert')}>Insert</button>
                                    <button className="btn btn-primary" onClick={() => applyCustomize('replace')}>Replace</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style jsx>{`
                /* Overlay pins to viewport; panel is fixed to the right and truly slides in */
                .overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 4000;
                    pointer-events: none; /* only children capture */
                }
                .backdrop {
                    position: absolute;
                    inset: 0;
                    background: rgba(8, 10, 22, 0.5);
                    backdrop-filter: blur(10px) saturate(0.9);
                    -webkit-backdrop-filter: blur(10px) saturate(0.9);
                    pointer-events: auto; /* clickable to close */
                }
                .panel {
                    --drawer-w: min(920px, 96vw);
                    position: fixed;
                    top: 0;
                    right: 0;
                    height: 100vh;
                    width: var(--drawer-w);
                    background: linear-gradient(180deg, rgba(18, 23, 53, 0.98), rgba(14, 18, 43, 0.98));
                    border-left: 1px solid var(--border, #1f2547);
                    padding: 16px 16px 0;
                    display: flex;
                    flex-direction: column;
                    box-shadow: -24px 0 80px rgba(0, 0, 0, 0.55);
                    pointer-events: auto; /* interactive */
                    will-change: transform, opacity;
                }
                .panel.opening {
                    animation: slideIn 360ms cubic-bezier(.2, .8, .2, 1);
                }
                .panel.closing {
                    animation: slideOut 240ms cubic-bezier(.2, .8, .2, 1) forwards;
                }
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: .7; }
                    to   { transform: translateX(0%);   opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0%); }
                    to   { transform: translateX(100%); }
                }

                /* Scrollable content area (keeps sticky footer visible) */
                .panel :global(.stack-md) { overflow: auto; flex: 1; }
                .stack-md { padding: 12px 2px 24px 2px; }

                /* Header + UI bits */
                .head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 6px; gap: 12px; }
                .headL { display: flex; flex-direction: column; gap: 4px; }
                .title { font-weight: 800; font-size: 20px; letter-spacing: -0.01em; }
                .subtitle { color: var(--muted); font-size: 12px; max-width: 58ch; }
                .label { font-size: 12px; color: var(--muted); margin-bottom: 6px; font-weight: 600; letter-spacing: .02em; text-transform: uppercase; }
                .help { color: var(--muted); font-size: 12px; margin-bottom: 8px; opacity: .95; }
                .muted { color: var(--muted); }
                .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
                @media (max-width: 820px) { .grid2 { grid-template-columns: 1fr; } }
                .input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; color: inherit; line-height: 1.35; }
                .input.slim { padding: 8px 10px; }
                .btn { border: 1px solid var(--border); background: rgba(255,255,255,0.05); padding: 10px 12px; border-radius: 12px; }
                .btn-primary { background: rgba(99,102,241,0.22); border-color: rgba(99,102,241,0.55); }
                .chip-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }

                /* Toolbar */
                .toolbar {
                    display: flex; align-items: center; justify-content: space-between; gap: 10px;
                    padding: 8px 2px; border-bottom: 1px solid var(--border);
                    position: sticky; top: 0; z-index: 1;
                    background: linear-gradient(180deg, rgba(18,23,53,0.98), rgba(14,18,43,0.98));
                }
                .mini { font-size: 11px; color: var(--muted); margin-right: 6px; }
                .right { margin-left: auto; }

                /* Recipients chips */
                .chips { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
                .pill {
                    display: inline-flex; gap: 8px; align-items: center;
                    padding: 6px 10px; border: 1px solid var(--border);
                    border-radius: 999px; background: rgba(255,255,255,0.04);
                    font-size: 12px;
                }
                .pill.bad { border-color: #e87b7b; background: rgba(232,123,123,0.15); }
                .pill-x { margin-left: 2px; border: none; background: transparent; color: inherit; cursor: pointer; opacity: .85; }
                .pill-add { padding: 6px 10px; border-radius: 999px; }

                .ccbcc { margin-top: 8px; }
                .flag-check { display: inline-flex; gap: 8px; align-items: center; }

                /* Templates */
                .tmplList { border: 1px solid var(--border); border-radius: 14px; padding: 10px; max-height: 340px; overflow: auto; background: rgba(255,255,255,0.03); }
                .group { border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: rgba(255,255,255,0.04); }
                .group + .group { margin-top: 10px; }
                .groupHead {
                    width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 10px;
                    padding: 10px 12px; border-bottom: 1px solid var(--border);
                    background: rgba(255,255,255,0.04);
                }
                .groupTitle { font-weight: 700; }
                .caret { opacity: .8; }
                .groupBody { padding: 10px; display: flex; flex-direction: column; gap: 10px; }

                .tmpl { border: 1px solid var(--border); border-radius: 12px; padding: 10px; background: rgba(255,255,255,0.05); }
                .tmplHead { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
                .tmplTitle { font-weight: 600; }
                .tmplBody { white-space: pre-wrap; margin: 8px 0 0 0; font-family: inherit; line-height: 1.42; font-size: 14px; }

                /* Sticky actions */
                .actions {
                    position: sticky; bottom: 0; left: 0; right: 0;
                    display: flex; align-items: center; gap: 10px;
                    padding: 10px 0 14px;
                    background: linear-gradient(180deg, transparent, rgba(14,18,43,0.95) 30%, rgba(14,18,43,0.98));
                    border-top: 1px solid var(--border);
                    margin-top: 4px;
                }
                .spacer { flex: 1; }
                .tips { margin-left: 8px; }
                .warn {
                    font-size: 12px; color: #f5c97a;
                    background: rgba(245,201,122,0.08);
                    border: 1px solid rgba(245,201,122,0.25);
                    padding: 6px 8px; border-radius: 10px;
                }
                .sub { font-size: 12px; color: var(--muted); }
                .mt-1 { margin-top: 4px; }

                /* Customize modal inside drawer */
                .customize {
                    position: fixed; inset: 0; z-index: 4100;
                    display: flex; align-items: center; justify-content: center;
                    background: rgba(0,0,0,0.35);
                    backdrop-filter: blur(3px);
                }
                .customPanel {
                    width: min(720px, 96vw);
                    background: var(--panel, #0e122b);
                    border: 1px solid var(--border);
                    border-radius: 14px;
                    padding: 14px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                }
            `}</style>
        </div>
    );

    return createPortal(overlay, document.body);
}

/* ============== Small subcomponents ============== */

function isValidEmail(s: string) {
    // Simple validation; good enough for UX
    return /^(?!.{255,})([A-Z0-9._%+-]{1,64})@([A-Z0-9.-]{1,253})\.[A-Z]{2,}$/i.test(s);
}

function RecipientPicker({
                             guardians,
                             onPick,
                             disabled,
                         }: {
    guardians: Guardian[];
    onPick: (email: string) => void;
    disabled?: boolean;
}) {
    const [val, setVal] = useState('');
    const options = useMemo(
        () =>
            guardians
                .filter((g) => g.email)
                .map((g) => ({
                    label: `${g.name || g.email} ${g.email ? `• ${g.email}` : ''}`,
                    value: g.email as string,
                })),
        [guardians]
    );

    return (
        <div className="recPicker">
            <select
                className="input slim"
                value={val}
                onChange={(e) => {
                    const v = e.target.value;
                    if (v) {
                        onPick(v);
                        setVal('');
                    }
                }}
                disabled={disabled}
                aria-label="Add recipient"
            >
                <option value="">+ Add recipient…</option>
                {options.map((o, i) => (
                    <option key={i} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
            <style jsx>{`
                .recPicker { display: inline-block; }
            `}</style>
        </div>
    );
}

function SignatureEditor({
                             signature,
                             setSignature,
                             disabled,
                         }: {
    signature: string;
    setSignature: (v: string) => void;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    return (
        <div className="sigWrap">
            <button className="btn" onClick={() => setOpen((v) => !v)} disabled={disabled}>
                {open ? 'Hide Signature' : 'Edit Signature'}
            </button>
            {open && (
                <textarea
                    className="input"
                    rows={4}
                    placeholder={`e.g., Thanks,
Ms. Doe
Grade 5 • Room 12
School Name`}
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    disabled={disabled}
                    style={{ marginTop: 8 }}
                    aria-label="Signature text"
                />
            )}
            <style jsx>{`
                .sigWrap { display: inline-flex; flex-direction: column; gap: 6px; }
            `}</style>
        </div>
    );
}
