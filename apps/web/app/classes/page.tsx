
'use client';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

type Class = { id: string; name: string; grade?: string | null; subject?: string | null };

export default function Classes() {
const [rows, setRows] = useState<Class[]>([]);
const [name, setName] = useState('');
const [grade, setGrade] = useState('');
const [subject, setSubject] = useState('');

async function load() { setRows(await api('/classes')); }
useEffect(() => { load(); }, []);

async function add() {
if (!name) return;
await api('/classes', { method: 'POST', body: JSON.stringify({ name, grade, subject }) });
setName(''); setGrade(''); setSubject('');
await load();
}

return (
<div className="card">
<h2>🏫 Classes</h2>
<div className="hstack" style={{ marginBottom:12 }}>
<input placeholder="Class name" value={name} onChange={e=>setName(e.target.value)} />
<input placeholder="Grade" value={grade} onChange={e=>setGrade(e.target.value)} />
<input placeholder="Subject" value={subject} onChange={e=>setSubject(e.target.value)} />
<button className="primary" onClick={add}>Add</button>
</div>
<div className="table-wrap">
<table>
<thead><tr><th>Name</th><th>Grade</th><th>Subject</th></tr></thead>
<tbody>
{rows.map(c => <tr key={c.id}><td>{c.name}</td><td>{c.grade}</td><td>{c.subject}</td></tr>)}
</tbody>
</table>
</div>
</div>
);
}
