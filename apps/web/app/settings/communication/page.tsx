"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';

// Define Provider type
type Provider = 'default' | 'gmail' | 'outlook' | 'office';

// Key constants for localStorage
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

// Default settings values
const DEFAULTS = {
  defaultProvider: 'gmail' as Provider,
  defaultTone: 'Warm' as 'Neutral' | 'Warm' | 'Professional' | 'Encouraging' | 'Direct',
  defaultTopic: 'General',
  defaultCC: '',
  defaultBCC: '',
  showCcBcc: false,
  signature: '',
  signatureInclude: true,
};

export default function CommunicationSettingsPage() {
  // State variables
  const [provider, setProvider] = useState<Provider>(DEFAULTS.defaultProvider);
  const [tone, setTone] = useState<'Neutral' | 'Warm' | 'Professional' | 'Encouraging' | 'Direct'>(DEFAULTS.defaultTone);
  const [topic, setTopic] = useState<string>(DEFAULTS.defaultTopic);
  const [cc, setCc] = useState<string>(DEFAULTS.defaultCC);
  const [bcc, setBcc] = useState<string>(DEFAULTS.defaultBCC);
  const [showCcBcc, setShowCcBcc] = useState<boolean>(DEFAULTS.showCcBcc);
  const [signature, setSignature] = useState<string>(DEFAULTS.signature);
  const [includeSignature, setIncludeSignature] = useState<boolean>(DEFAULTS.signatureInclude);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Load saved settings on mount
  useEffect(() => {
    try {
      setProvider((localStorage.getItem(KEYS.defaultProvider) as Provider) || DEFAULTS.defaultProvider);
      setTone((localStorage.getItem(KEYS.defaultTone) as any) || DEFAULTS.defaultTone);
      setTopic(localStorage.getItem(KEYS.defaultTopic) || DEFAULTS.defaultTopic);
      setCc(localStorage.getItem(KEYS.defaultCC) || DEFAULTS.defaultCC);
      setBcc(localStorage.getItem(KEYS.defaultBCC) || DEFAULTS.defaultBCC);
      setShowCcBcc(localStorage.getItem(KEYS.showCcBcc) === '1');
      setSignature(localStorage.getItem(KEYS.signature) || DEFAULTS.signature);
      setIncludeSignature((localStorage.getItem(KEYS.signatureInclude) || '1') === '1');
    } catch {
      // If localStorage is unavailable, ignore
    }
  }, []);

  // Save settings to localStorage
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
    } catch {
      // Ignore save errors
    }
  }

  // Reset settings to defaults
  function reset() {
    setProvider(DEFAULTS.defaultProvider);
    setTone(DEFAULTS.defaultTone);
    setTopic(DEFAULTS.defaultTopic);
    setCc(DEFAULTS.defaultCC);
    setBcc(DEFAULTS.defaultBCC);
    setShowCcBcc(DEFAULTS.showCcBcc);
    setSignature(DEFAULTS.signature);
    setIncludeSignature(DEFAULTS.signatureInclude);
    setSavedAt(null);
  }

  // Export settings as a JSON file
  function exportSettings() {
    const settings = {
      provider,
      tone,
      topic,
      cc,
      bcc,
      showCcBcc,
      signature,
      includeSignature,
    };
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'communication-settings.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  // Import settings from a JSON file
  function importSettings(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        setProvider(data.provider || DEFAULTS.defaultProvider);
        setTone(data.tone || DEFAULTS.defaultTone);
        setTopic(data.topic || DEFAULTS.defaultTopic);
        setCc(data.cc || DEFAULTS.defaultCC);
        setBcc(data.bcc || DEFAULTS.defaultBCC);
        setShowCcBcc(Boolean(data.showCcBcc));
        setSignature(data.signature || DEFAULTS.signature);
        setIncludeSignature(Boolean(data.includeSignature));
      } catch {
        // Ignore import errors
      }
    };
    reader.readAsText(file);
  }

  // Provide human-friendly labels for providers
  function labelForProvider(p: Provider) {
    switch (p) {
      case 'gmail':
        return 'Gmail';
      case 'outlook':
        return 'Outlook';
      case 'office':
        return 'Office 365';
      default:
        return 'Default';
    }
  }

  return (
    <div className="communication-settings">
      <h1>Communication Settings</h1>
      <div className="form-section">
        <label>
          Default Email Provider
          <select value={provider} onChange={(e) => setProvider(e.target.value as Provider)}>
            <option value="default">Default</option>
            <option value="gmail">Gmail</option>
            <option value="outlook">Outlook</option>
            <option value="office">Office 365</option>
          </select>
        </label>
        <label>
          Default Tone
          <select value={tone} onChange={(e) => setTone(e.target.value as any)}>
            <option value="Neutral">Neutral</option>
            <option value="Warm">Warm</option>
            <option value="Professional">Professional</option>
            <option value="Encouraging">Encouraging</option>
            <option value="Direct">Direct</option>
          </select>
        </label>
        <label>
          Default Topic
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="General" />
        </label>
        <label>
          <input type="checkbox" checked={showCcBcc} onChange={() => setShowCcBcc(!showCcBcc)} />
          Show CC/BCC Fields by Default
        </label>
        {showCcBcc && (
          <>
            <label>
              Default CC
              <input value={cc} onChange={(e) => setCc(e.target.value)} />
            </label>
            <label>
              Default BCC
              <input value={bcc} onChange={(e) => setBcc(e.target.value)} />
            </label>
          </>
        )}
        <label>
          Signature
          <textarea value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Your email signature" />
        </label>
        <label>
          <input type="checkbox" checked={includeSignature} onChange={() => setIncludeSignature(!includeSignature)} />
          Include signature by default
        </label>
      </div>
      <div className="actions">
        <button type="button" onClick={save}>
          Save Settings
        </button>
        <button type="button" onClick={reset}>
          Reset to Defaults
        </button>
        <button type="button" onClick={exportSettings}>
          Export Settings
        </button>
        <label className="import-button">
          Import Settings
          <input
            type="file"
            accept="application/json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                importSettings(file);
              }
            }}
            style={{ display: 'none' }}
          />
        </label>
      </div>
      {savedAt && <p>Last saved at {new Date(savedAt).toLocaleString()}</p>}
      <Link href="/">Back to Dashboard</Link>
    </div>
  );
}
