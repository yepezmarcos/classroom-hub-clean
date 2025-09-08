'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Provider = 'default' | 'gmail' | 'outlook' | 'office';

const KEYS = {
    defaultProvider: 'teacher_default_provider',
    defaultTone: 'teacher_default_tone',
    defaultTopic: 'teacher_default_topic',
    defaultCC: 'teacher_default_cc',
    defaultBCC: 'teacher_default_bcc',
    signature: 'teacher_signature',
    signatureInclude: 'teacher_signature_include',
    showCcBcc: 'teacher_default_show_ccbcc',
} as const;

export default function CommunicationSettingsPage() {
    const [provider, setProvider] = useState<Provider>('gmail');
    const [tone, setTone] = useState<'Neutral'|'Warm'|'Professional'|'Encouraging'|'Direct'>('Warm');
    const [topic, setTopic] = useState('General');
    const [cc, setCc] = useState('');
    const [bcc, setBcc] = useState('');
    const [showCcBcc, setShowCcBcc] = useState(false);
    const [signature, setSignature] = useState('');
    const [includeSignature, setIncludeSignature] = useState(true);
    const [savedAt, setSavedAt] = useState<number | null>(null);

    useEffect(() => {
        try {
            setProvider((localStorage.getItem(KEYS.defaultProvider) as Provider) || 'gmail');
            setTone((localStorage.getItem(KEYS.defaultTone) as any) || 'Warm');
            setTopic(localStorage.getItem(KEYS.defaultTopic) || 'General');
            setCc(localStorage.getItem(KEYS.defaultCC) || '');
            setBcc(localStorage.getItem(KEYS.defaultBCC) || '');
            setShowCcBcc(localStorage.getItem(KEYS.showCcBcc) === '1');
            setSignature(localStorage.getItem(KEYS.signature) || '');
            setIncludeSignature((localStorage.getItem(KEYS.signatureInclude) || '1') === '1');
        } catch {}
    }, []);

    function save() {
        try {
            localStorage.setItem(KEYS.defaultProvider, provider);
            localStorage.setItem(KEYS.defaultTone, tone);
            localStorage.setItem(KEYS.defaultTopic, topic);
            localStorage.setItem(KEYS.defaultCC, cc || '');
            localStorage.setItem(KEYS.defaultBCC, bcc || '');
            localStorage.setItem(KEYS.showCcBcc, showCcBcc ? '1' : '0');
            localStorage.setItem(KEYS.signature, signature || '');
            localStorage.setItem(KEYS.signatureInclude, includeSignature ? '1' : '0');
            setSavedAt(Date.now());
        } catch {}
    }

    function resetAll() {
        setProvider('gmail');
        setTone('Warm');
        setTopic('General');
        setCc('');
        setBcc('');
        setShowCcBcc(false);
        setSignature('');
        setIncludeSignature(true);
        save();
    }

    return (
        <div className="wrap">
            <div className="head">
                <div>
                    <h1 className="title">Communication Settings</h1>
                    <p className="muted">Defaults used by the Compose Email drawer (you can still change them per email).</p>
                </div>
                <Link className="btn" href="/contacts">← Back to Contacts</Link>
            </div>

            <div className="grid">
                <section className="card">
                    <div className="cardTitle">Defaults</div>
                    <div className="row">
                        <label>Default provider</label>
                        <select value={provider} onChange={e=>setProvider(e.target.value as Provider)}>
                            <option value="default">Default Mail app</option>
                            <option value="gmail">Gmail (web)</option>
                            <option value="outlook">Outlook.com</option>
                            <option value="office">Outlook 365 (web)</option>
                        </select>
                        <div className="help">Where “Send” opens by default.</div>
                    </div>

                    <div className="row">
                        <label>Default tone</label>
                        <select value={tone} onChange={e=>setTone(e.target.value as any)}>
                            <option>Neutral</option><option>Warm</option><option>Professional</option><option>Encouraging</option><option>Direct</option>
                        </select>
                        <div className="help">Used when AI generates / rephrases.</div>
                    </div>

                    <div className="row">
                        <label>Default topic</label>
                        <select value={topic} onChange={e=>setTopic(e.target.value)}>
                            <option>General</option><option>Progress</option><option>Concern</option><option>Positive</option>
                            <option>Attendance</option><option>Behavior</option><option>Assignment</option><option>Meeting</option>
                        </select>
                        <div className="help">Guides AI and template suggestions.</div>
                    </div>

                    <div className="row">
                        <label className="check">
                            <input type="checkbox" checked={showCcBcc} onChange={e=>setShowCcBcc(e.target.checked)} />
                            Start with CC/BCC visible
                        </label>
                        <div className="help">Useful if you often CC a co-teacher or counselor.</div>
                    </div>

                    {showCcBcc && (
                        <div className="grid2">
                            <div className="row">
                                <label>Default CC</label>
                                <input value={cc} onChange={e=>setCc(e.target.value)} placeholder="comma,separated@example.com" />
                            </div>
                            <div className="row">
                                <label>Default BCC</label>
                                <input value={bcc} onChange={e=>setBcc(e.target.value)} placeholder="comma,separated@example.com" />
                            </div>
                        </div>
                    )}
                </section>

                <section className="card">
                    <div className="cardTitle">Signature</div>
                    <div className="row">
                        <label className="check">
                            <input type="checkbox" checked={includeSignature} onChange={e=>setIncludeSignature(e.target.checked)} />
                            Include signature by default
                        </label>
                    </div>
                    <textarea
                        rows={8}
                        value={signature}
                        onChange={e=>setSignature(e.target.value)}
                        placeholder={`Thanks,\nMs. Doe\nGrade 5 • Room 12\nSchool Name`}
                    />
                    <div className="help">Used at the end of your message when “Include signature” is on.</div>
                </section>
            </div>

            <div className="actions">
                <button className="btn" onClick={resetAll}>Reset</button>
                <button className="btn btn-primary" onClick={save}>Save</button>
                {savedAt && <span className="muted">Saved.</span>}
            </div>

            <style jsx>{`
        .wrap { max-width: 980px; margin: 0 auto; padding: 16px; }
        .head { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom: 12px; }
        .title { font-size: 22px; font-weight: 800; letter-spacing: -0.01em; margin: 0 0 6px; }
        .muted { color: var(--muted); }
        .grid { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (max-width: 900px){ .grid { grid-template-columns: 1fr; } }
        .card { border: 1px solid var(--border); border-radius: 14px; padding: 12px; background: rgba(255,255,255,0.03); }
        .cardTitle { font-weight: 700; margin-bottom: 8px; }
        .row { display:flex; flex-direction:column; gap:6px; margin-bottom: 10px; }
        .grid2 { display:grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        label { font-size:12px; color: var(--muted); }
        .check { display:inline-flex; align-items:center; gap:8px; }
        select, input, textarea {
          width:100%; background: rgba(255,255,255,0.05); border:1px solid var(--border); border-radius:12px; padding:10px 12px; color:inherit;
        }
        .help { font-size:12px; color: var(--muted); }
        .actions { display:flex; gap:10px; align-items:center; margin-top: 12px; }
        .btn { border:1px solid var(--border); background: rgba(255,255,255,0.05); padding:10px 12px; border-radius:12px; }
        .btn-primary { background: rgba(99,102,241,0.22); border-color: rgba(99,102,241,0.55); }
      `}</style>
        </div>
    );
}'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

type Provider = 'default' | 'gmail' | 'outlook' | 'office';
type Tone = 'Neutral'|'Warm'|'Professional'|'Encouraging'|'Direct';

const KEYS = {
    defaultProvider: 'teacher_default_provider',
    defaultTone: 'teacher_default_tone',
    defaultTopic: 'teacher_default_topic',
    defaultCC: 'teacher_default_cc',
    defaultBCC: 'teacher_default_bcc',
    signature: 'teacher_signature',
    signatureInclude: 'teacher_signature_include',
    showCcBcc: 'teacher_default_show_ccbcc',
} as const;

const DEFAULTS = {
    provider: 'gmail' as Provider,
    tone: 'Warm' as Tone,
    topic: 'General',
    cc: '',
    bcc: '',
    showCcBcc: false,
    signature: '',
    includeSignature: true,
};

export default function CommunicationSettingsPage() {
    const [provider, setProvider] = useState<Provider>(DEFAULTS.provider);
    const [tone, setTone] = useState<Tone>(DEFAULTS.tone);
    const [topic, setTopic] = useState<string>(DEFAULTS.topic);
    const [cc, setCc] = useState<string>(DEFAULTS.cc);
    const [bcc, setBcc] = useState<string>(DEFAULTS.bcc);
    const [showCcBcc, setShowCcBcc] = useState<boolean>(DEFAULTS.showCcBcc);
    const [signature, setSignature] = useState<string>(DEFAULTS.signature);
    const [includeSignature, setIncludeSignature] = useState<boolean>(DEFAULTS.includeSignature);

    const [savedAt, setSavedAt] = useState<number | null>(null);
    const [showRaw, setShowRaw] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Load from localStorage once
    useEffect(() => {
        try {
            setProvider((localStorage.getItem(KEYS.defaultProvider) as Provider) || DEFAULTS.provider);
            setTone((localStorage.getItem(KEYS.defaultTone) as Tone) || DEFAULTS.tone);
            setTopic(localStorage.getItem(KEYS.defaultTopic) || DEFAULTS.topic);
            setCc(localStorage.getItem(KEYS.defaultCC) || DEFAULTS.cc);
            setBcc(localStorage.getItem(KEYS.defaultBCC) || DEFAULTS.bcc);
            setShowCcBcc(localStorage.getItem(KEYS.showCcBcc) === '1');
            setSignature(localStorage.getItem(KEYS.signature) || DEFAULTS.signature);
            setIncludeSignature((localStorage.getItem(KEYS.signatureInclude) || '1') === '1');
        } catch {}
    }, []);

    function save() {
        try {
            localStorage.setItem(KEYS.defaultProvider, provider);
            localStorage.setItem(KEYS.defaultTone, tone);
            localStorage.setItem(KEYS.defaultTopic, topic);
            localStorage.setItem(KEYS.defaultCC, cc || '');
            localStorage.setItem(KEYS.defaultBCC, bcc || '');
            localStorage.setItem(KEYS.showCcBcc, showCcBcc ? '1' : '0');
            localStorage.setItem(KEYS.signature, signature || '');
            localStorage.setItem(KEYS.signatureInclude, includeSignature ? '1' : '0');
            setSavedAt(Date.now());
            // brief “Saved” tick
            setTimeout(() => setSavedAt(null), 1500);
        } catch {}
    }

    function resetAll() {
        setProvider(DEFAULTS.provider);
        setTone(DEFAULTS.tone);
        setTopic(DEFAULTS.topic);
        setCc(DEFAULTS.cc);
        setBcc(DEFAULTS.bcc);
        setShowCcBcc(DEFAULTS.showCcBcc);
        setSignature(DEFAULTS.signature);
        setIncludeSignature(DEFAULTS.includeSignature);

        // persist immediately
        try {
            localStorage.setItem(KEYS.defaultProvider, DEFAULTS.provider);
            localStorage.setItem(KEYS.defaultTone, DEFAULTS.tone);
            localStorage.setItem(KEYS.defaultTopic, DEFAULTS.topic);
            localStorage.setItem(KEYS.defaultCC, DEFAULTS.cc);
            localStorage.setItem(KEYS.defaultBCC, DEFAULTS.bcc);
            localStorage.setItem(KEYS.showCcBcc, DEFAULTS.showCcBcc ? '1' : '0');
            localStorage.setItem(KEYS.signature, DEFAULTS.signature);
            localStorage.setItem(KEYS.signatureInclude, DEFAULTS.includeSignature ? '1' : '0');
            setSavedAt(Date.now());
            setTimeout(() => setSavedAt(null), 1500);
        } catch {}
    }

    // Export / Import (local JSON file)
    function exportSettings() {
        const data = {
            provider, tone, topic, cc, bcc, showCcBcc, signature, includeSignature,
            _meta: { exportedAt: new Date().toISOString(), app: 'classroom-hub' },
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'communication-settings.json';
        a.click();
        URL.revokeObjectURL(url);
    }
    function importSettingsFromFile(file: File) {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const json = JSON.parse(String(reader.result || '{}'));
                if (json.provider) setProvider(json.provider);
                if (json.tone) setTone(json.tone);
                if (json.topic) setTopic(json.topic);
                if (typeof json.cc === 'string') setCc(json.cc);
                if (typeof json.bcc === 'string') setBcc(json.bcc);
                if (typeof json.showCcBcc === 'boolean') setShowCcBcc(json.showCcBcc);
                if (typeof json.signature === 'string') setSignature(json.signature);
                if (typeof json.includeSignature === 'boolean') setIncludeSignature(json.includeSignature);
                // persist
                setTimeout(save, 0);
            } catch (e) {
                alert('Invalid settings file.');
            }
        };
        reader.readAsText(file);
    }

    const preview = useMemo(() => {
        const lines = [
            `Provider: ${labelForProvider(provider)}`,
            `Default tone: ${tone}`,
            `Default topic: ${topic}`,
            showCcBcc ? `CC: ${cc || '—'}` : '',
            showCcBcc ? `BCC: ${bcc || '—'}` : '',
            includeSignature ? `Signature: ON` : `Signature: OFF`,
        ].filter(Boolean);
        return lines.join('\n');
    }, [provider, tone, topic, cc, bcc, showCcBcc, includeSignature]);

    return (
        <div className="wrap">
            <div className="head">
                <div>
                    <h1 className="title">Communication Settings</h1>
                    <p className="muted">
                        These are the defaults used by the <b>Compose Email</b> drawer. You can still change them per email.
                    </p>
                </div>
                <div className="chip-row">
                    <Link className="btn" href="/contacts">← Back to Contacts</Link>
                    <Link className="btn" href="/settings/templates">Manage Templates</Link>
                </div>
            </div>

            <div className="grid">
                {/* LEFT: Defaults */}
                <section className="card">
                    <div className="cardTitle">Defaults</div>

                    <div className="row">
                        <label>Default provider</label>
                        <select className="input" value={provider} onChange={e=>setProvider(e.target.value as Provider)}>
                            <option value="default">Default Mail app</option>
                            <option value="gmail">Gmail (web)</option>
                            <option value="outlook">Outlook.com</option>
                            <option value="office">Outlook 365 (web)</option>
                        </select>
                        <div className="help">Where “Send” opens by default.</div>
                    </div>

                    <div className="row">
                        <label>Default tone</label>
                        <select className="input" value={tone} onChange={e=>setTone(e.target.value as Tone)}>
                            <option>Neutral</option><option>Warm</option><option>Professional</option><option>Encouraging</option><option>Direct</option>
                        </select>
                        <div className="help">Used when AI generates or rephrases.</div>
                    </div>

                    <div className="row">
                        <label>Default topic</label>
                        <select className="input" value={topic} onChange={e=>setTopic(e.target.value)}>
                            <option>General</option><option>Progress</option><option>Concern</option><option>Positive</option>
                            <option>Attendance</option><option>Behavior</option><option>Assignment</option><option>Meeting</option>
                        </select>
                        <div className="help">Guides AI and template grouping (topic:* tags).</div>
                    </div>

                    <div className="row">
                        <label className="check">
                            <input type="checkbox" checked={showCcBcc} onChange={e=>setShowCcBcc(e.target.checked)} />
                            Start with CC/BCC visible
                        </label>
                        <div className="help">Helpful if you often CC a co-teacher or counselor.</div>
                    </div>

                    {showCcBcc && (
                        <div className="grid2">
                            <div className="row">
                                <label>Default CC</label>
                                <input
                                    className="input"
                                    value={cc}
                                    onChange={e=>setCc(e.target.value)}
                                    placeholder="comma,separated@example.com"
                                />
                                <div className="help">Will prefill in the Compose drawer (you can edit per email).</div>
                            </div>
                            <div className="row">
                                <label>Default BCC</label>
                                <input
                                    className="input"
                                    value={bcc}
                                    onChange={e=>setBcc(e.target.value)}
                                    placeholder="comma,separated@example.com"
                                />
                                <div className="help">Useful to archive your messages automatically.</div>
                            </div>
                        </div>
                    )}
                </section>

                {/* RIGHT: Signature & Preview */}
                <section className="card">
                    <div className="cardTitle">Signature</div>
                    <div className="row">
                        <label className="check">
                            <input type="checkbox" checked={includeSignature} onChange={e=>setIncludeSignature(e.target.checked)} />
                            Include signature by default
                        </label>
                    </div>
                    <textarea
                        className="input"
                        rows={8}
                        value={signature}
                        onChange={e=>setSignature(e.target.value)}
                        placeholder={`Thanks,\nMs. Doe\nGrade 5 • Room 12\nSchool Name`}
                    />
                    <div className="help">Appended to the end of your message when “Include signature” is on.</div>

                    <div className="divider" />

                    <div className="cardTitle">Live Preview</div>
                    <pre className="preview">{preview}</pre>

                    <div className="row">
                        <label className="check">
                            <input type="checkbox" checked={showRaw} onChange={e=>setShowRaw(e.target.checked)} />
                            Show raw values
                        </label>
                        {showRaw && (
                            <pre className="preview small">
{JSON.stringify({
    provider, tone, topic, cc, bcc, showCcBcc, signature: signature ? '(set)' : '', includeSignature
}, null, 2)}
              </pre>
                        )}
                    </div>
                </section>
            </div>

            {/* Actions */}
            <div className="actions">
                <div className="chip-row">
                    <button className="btn" onClick={resetAll} title="Restore factory defaults">Restore defaults</button>
                    <button className="btn" onClick={exportSettings} title="Download a JSON backup of these settings">Export</button>
                    <input ref={fileInputRef} type="file" accept="application/json" hidden
                           onChange={(e)=>{ const f = e.target.files?.[0]; if (f) { importSettingsFromFile(f); e.currentTarget.value=''; }}} />
                    <button className="btn" onClick={()=>fileInputRef.current?.click()} title="Load a previously exported settings file">Import</button>
                </div>
                <div className="spacer" />
                <button className="btn btn-primary" onClick={save}>
                    {savedAt ? 'Saved ✓' : 'Save'}
                </button>
            </div>

            <style jsx>{`
        .wrap { max-width: 1100px; margin: 0 auto; padding: 16px; }
        .head { display:flex; align-items:flex-start; justify-content:space-between; gap: 12px; margin-bottom: 12px; }
        .title { font-size: 22px; font-weight: 800; letter-spacing: -0.01em; margin: 0 0 6px; }
        .muted { color: var(--muted); }
        .chip-row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
        .btn { border:1px solid var(--border); background: rgba(255,255,255,0.05); padding:10px 12px; border-radius:12px; }
        .btn-primary { background: rgba(99,102,241,0.22); border-color: rgba(99,102,241,0.55); }
        .grid { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (max-width: 900px){ .grid { grid-template-columns: 1fr; } }

        .card { border: 1px solid var(--border); border-radius: 14px; padding: 12px; background: rgba(255,255,255,0.03); }
        .cardTitle { font-weight: 700; margin-bottom: 8px; }

        .row { display:flex; flex-direction:column; gap:6px; margin-bottom: 10px; }
        .grid2 { display:grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        label { font-size:12px; color: var(--muted); }
        .check { display:inline-flex; align-items:center; gap:8px; }
        .input {
          width:100%; background: rgba(255,255,255,0.05); border:1px solid var(--border);
          border-radius:12px; padding:10px 12px; color:inherit;
        }
        select.input, input.input, textarea.input { appearance: none; }
        .help { font-size:12px; color: var(--muted); }
        .divider { height:1px; background: var(--border); margin: 10px 0; border-radius: 1px; }

        .preview {
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 10px 12px;
          white-space: pre-wrap;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          line-height: 1.45;
        }
        .small { font-size: 12px; opacity: .9; }

        .actions {
          display:flex; align-items:center; gap:10px; margin-top: 12px;
          position: sticky; bottom: 0; padding: 8px 0;
          backdrop-filter: saturate(1.2) blur(2px);
        }
        .spacer { flex: 1; }
      `}</style>
        </div>
    );
}

function labelForProvider(p: Provider) {
    if (p === 'gmail') return 'Gmail (web)';
    if (p === 'outlook') return 'Outlook.com';
    if (p === 'office') return 'Outlook 365 (web)';
    return 'Default Mail app';
}