'use client';
import React from 'react';

export function Fab({ label = 'Import roster', onClick }: { label?: string; onClick: () => void }) {
  return (
    <button className="ch-fab" onClick={onClick} aria-label={label}>
      ⬆️
      <span className="ch-fab-label">{label}</span>
      <style jsx>{`
        .ch-fab {
          position: fixed;
          right: 24px;
          bottom: 24px;
          width: 56px;
          height: 56px;
          border-radius: 9999px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          background: var(--accent, #3b82f6);
          color: #fff;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
          transition: transform 0.18s ease, box-shadow 0.18s ease;
          border: none;
          cursor: pointer;
          z-index: 50;
        }
        .ch-fab:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.22);
        }
        .ch-fab-label {
          position: absolute;
          right: 70px;
          background: var(--panel, #111);
          color: var(--text, #fff);
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12px;
          white-space: nowrap;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
          opacity: 0;
          transform: translateX(8px);
          pointer-events: none;
          transition: 0.18s ease;
        }
        .ch-fab:hover .ch-fab-label {
          opacity: 1;
          transform: translateX(0);
        }
      `}</style>
    </button>
  );
}
