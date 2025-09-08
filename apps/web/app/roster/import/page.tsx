'use client';
import React, { useState } from 'react';

export default function RosterImport() {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<any>(null);
    const [mapping, setMapping] = useState<Record<string,string>>({});
    const [classroomCode, setClassroomCode] = useState('HRA-24');

    const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
    const headers: HeadersInit = { 'x-tenant-id': 'default' };

    const doPreview = async () => {
        if (!file) return;
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(`${API}/roster/preview`, { method: 'POST', body: fd, headers });
        const json = await res.json();
        setPreview(json);
        setMapping(json.mapping || {});
    };

    const doCommit = async () => {
        const res = await fetch(`${API}/roster/commit`, {
            method: 'POST',
            headers: { ...headers, 'content-type': 'application/json' },
            body: JSON.stringify({ mapping, rows: preview.sample, classroomCode, upsertClassroomName: 'Homeroom A' })
        });
        alert(await res.text());
    };

    return (
        <div className="p-6 space-y-4">
            <h1 className="text-2xl font-bold">Roster Import</h1>
            <input type="file" accept=".csv" onChange={e => setFile(e.target.files?.[0] || null)} />
            <button className="px-3 py-2 rounded bg-black text-white" onClick={doPreview}>Preview</button>

            {preview && (
                <>
                    <div>
                        <label className="font-semibold">Classroom Code:</label>
                        <input className="border ml-2 px-2 py-1" value={classroomCode} onChange={e=>setClassroomCode(e.target.value)} />
                    </div>
                    <h2 className="font-semibold">Header Mapping</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {preview.headers.map((h: string) => (
                            <div key={h} className="flex items-center gap-2">
                                <span className="w-48 truncate">{h}</span>
                                <select className="border px-2 py-1"
                                        value={mapping[h] || ''}
                                        onChange={(e)=>setMapping({...mapping,[h]:e.target.value})}>
                                    <option value="">(ignore)</option>
                                    {['first','last','studentId','email','grade','pronouns','gender','guardianEmail','guardianName','guardianPhone']
                                        .map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        ))}
                    </div>

                    <h2 className="font-semibold mt-4">Preview (first {preview.sample.length})</h2>
                    <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-64">{JSON.stringify(preview.sample,null,2)}</pre>

                    <button className="px-3 py-2 rounded bg-emerald-600 text-white" onClick={doCommit}>Commit Import</button>
                </>
            )}
        </div>
    );
}