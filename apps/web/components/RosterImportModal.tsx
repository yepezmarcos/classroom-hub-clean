'use client';
import React, { useState } from 'react';
import { api, apiUpload } from '../lib/api';

type Mapping = {
  studentId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  preferredName?: string | null;
  grade?: string | null;
  email?: string | null;
  dob?: string | null;
  iep?: string | null;
  ell?: string | null;
  medical?: string | null;
  guardian1Name?: string | null;
  guardian1Email?: string | null;
  guardian1Phone?: string | null;
  guardian2Name?: string | null;
  guardian2Email?: string | null;
  guardian2Phone?: string | null;
  homeroom?: string | null;
  school?: string | null;
  classroom?: string | null;
};

const TARGETS: { key: keyof Mapping; label: string; required?: boolean }[] = [
  { key: 'studentId', label: 'Student ID' },
  { key: 'firstName', label: 'First name', required: true },
  { key: 'lastName', label: 'Last name', required: true },
  { key: 'preferredName', label: 'Preferred name' },
  { key: 'grade', label: 'Grade' },
  { key: 'email', label: 'Student email' },
  { key: 'dob', label: 'Date of birth' },
  { key: 'iep', label: 'IEP (yes/no)' },
  { key: 'ell', label: 'ELL (yes/no)' },
  { key: 'medical', label: 'Medical (yes/no)' },
  { key: 'guardian1Name', label: 'Guardian 1 name' },
  { key: 'guardian1Email', label: 'Guardian 1 email' },
  { key: 'guardian1Phone', label: 'Guardian 1 phone' },
  { key: 'guardian2Name', label: 'Guardian 2 name' },
  { key: 'guardian2Email', label: 'Guardian 2 email' },
  { key: 'guardian2Phone', label: 'Guardian 2 phone' },
  { key: 'school', label: 'School' },
  { key: 'homeroom', label: 'Homeroom / Teacher' },
  { key: 'classroom', label: 'Class / Section' },
];

export function RosterImportModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [sample, setSample] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [result, setResult] = useState<any | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setLoading(true);
    try {
      const data = await apiUpload('/import/preview', { file: f });
      setColumns(data.columns || []);
      setMapping(data.mapping || {});
      setSample(data.sample || []);
    } finally {
      setLoading(false);
    }
  }

  async function commit() {
    setLoading(true);
    try {
      const res = await api('/import/commit', {
        method: 'POST',
        body: JSON.stringify({ mapping, rows: sample, createClasses: true }),
      });
      setResult(res);
      onDone();
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="ch-modal">
      <div className="ch-panel">
        <div className="ch-hdr">
          <h3>Import roster</h3>
          <button onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="ch-body">
          <div className="ch-row">
            <input type="file" accept=".csv,text/csv" onChange={handleFile} />
            {fileName && <span className="ch-muted">{fileName}</span>}
          </div>

          {columns.length > 0 && (
            <>
              <div className="ch-grid">
                {TARGETS.map((t) => (
                  <label key={t.key} className="ch-map">
                    <div className="ch-lbl">
                      {t.label}
                      {t.required && <span className="ch-req">*</span>}
                    </div>
                    <select
                      value={(mapping[t.key] || '') as string}
                      onChange={(e) => setMapping({ ...mapping, [t.key]: e.target.value || null })}
                    >
                      <option value="">— None —</option>
                      {columns.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>

              <div className="ch-card">
                <div className="ch-muted" style={{ marginBottom: 6 }}>
                  Preview (first {sample.length} rows)
                </div>
                <div style={{ overflow: 'auto', maxHeight: 240 }}>
                  <table>
                    <thead>
                      <tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr>
                    </thead>
                    <tbody>
                      {sample.slice(0, 20).map((r, i) => (
                        <tr key={i}>{columns.map((c) => <td key={c}>{String(r[c] ?? '')}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="ch-actions">
                <button onClick={commit} disabled={loading} className="ch-primary">
                  {loading ? 'Importing…' : 'Import'}
                </button>
                <button onClick={onClose} className="ch-ghost">
                  Cancel
                </button>
              </div>

              {result && (
                <div className="ch-card" style={{ marginTop: 12 }}>
                  <div>
                    Imported students: <b>{result.createdStudents + result.updatedStudents}</b> (new{' '}
                    {result.createdStudents}, updated {result.updatedStudents})
                  </div>
                  <div>
                    Guardians created: <b>{result.createdGuardians}</b>
                  </div>
                  <div>
                    Classes created: <b>{result.createdClasses}</b>
                  </div>
                  <div>
                    Enrollments: <b>{result.createdEnrollments}</b>
                  </div>
                  {result.errors?.length ? <pre className="ch-error">{result.errors.join('\n')}</pre> : null}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .ch-modal {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.35);
          display: grid;
          place-items: center;
          z-index: 60;
          animation: ch-fade 0.18s ease-in;
        }
        .ch-panel {
          width: min(100vw - 32px, 980px);
          background: var(--panel, #111);
          color: var(--text, #fff);
          border-radius: 16px;
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
          overflow: hidden;
        }
        .ch-hdr {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border, #333);
        }
        .ch-body {
          padding: 16px;
          display: grid;
          gap: 12px;
        }
        .ch-grid {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        @media (min-width: 900px) {
          .ch-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        .ch-map {
          display: grid;
          gap: 4px;
        }
        .ch-lbl {
          font-size: 12px;
          color: var(--muted, #bbb);
        }
        .ch-req {
          color: var(--accent, #3b82f6);
          margin-left: 4px;
        }
        .ch-row {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }
        .ch-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }
        .ch-muted {
          color: var(--muted, #9aa);
        }
        .ch-card {
          border: 1px solid var(--border, #333);
          border-radius: 12px;
          padding: 10px;
          background: var(--panel, #111);
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th,
        td {
          border: 1px solid var(--border, #333);
          padding: 6px 8px;
          font-size: 12px;
        }
        .ch-primary {
          background: var(--accent, #3b82f6);
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
        }
        .ch-ghost {
          background: transparent;
          border: 1px solid var(--border, #333);
          padding: 8px 12px;
          border-radius: 10px;
          color: var(--text, #fff);
        }
        @keyframes ch-fade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
