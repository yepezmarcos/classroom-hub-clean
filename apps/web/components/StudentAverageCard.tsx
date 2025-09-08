'use client';

import React from 'react';
import { useStudentAverage } from '../lib/hooks/useStudentAverage';

type Props = {
  studentId: string;
  classroomId?: string; // pass if you want per-class average (optional)
  title?: string;
};

export default function StudentAverageCard({ studentId, classroomId, title = 'Average' }: Props) {
  const { data, loading } = useStudentAverage(studentId, classroomId);

  return (
    <div className="avg-card">
      <div className="head">
        <div className="title">{title}</div>
        {classroomId ? <div className="muted">Class scope</div> : <div className="muted">All assignments</div>}
      </div>

      <div className="row">
        <div className="big">{loading ? '—' : (data?.pct ?? '—')}%</div>
        <div className="muted">{loading ? '— / —' : `${data?.got ?? 0} / ${data?.max ?? 0}`}</div>
      </div>

      {/* Tiny breakdown (optional, hide if no data) */}
      {!loading && data && (
        <div className="breakdown">
          {Object.entries(data.byCategory).slice(0, 3).map(([k, v]) => {
            const pct = v.max > 0 ? Math.round((v.got / v.max) * 100) : null;
            return (
              <div key={k} className="chip">
                <span className="label">{k}</span>
                <span className="value">{pct ?? '—'}%</span>
              </div>
            );
          })}
        </div>
      )}

      <style jsx>{`
        .avg-card {
          border: 1px solid var(--border, #1f2547);
          background: var(--panel, #0e122b);
          border-radius: 14px;
          padding: 14px;
        }
        .head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .title {
          font-weight: 700;
        }
        .muted {
          color: var(--muted, #9aa3b2);
          font-size: 12px;
        }
        .row {
          display: flex;
          align-items: baseline;
          gap: 10px;
        }
        .big {
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.01em;
        }
        .breakdown {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 10px;
        }
        .chip {
          display: inline-flex;
          gap: 6px;
          align-items: center;
          padding: 6px 8px;
          border: 1px solid var(--border, #1f2547);
          border-radius: 999px;
          background: rgba(255,255,255,0.03);
          font-size: 12px;
        }
        .label { opacity: .8; }
        .value { font-weight: 700; }
      `}</style>
    </div>
  );
}