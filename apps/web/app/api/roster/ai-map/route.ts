import { NextRequest, NextResponse } from 'next/server';

function heuristic(headers: string[]) {
  const h = headers.map(x => x.toLowerCase().trim());
  const find = (...keys: string[]) =>
    headers[h.findIndex(v => keys.some(k => v.includes(k)))] ?? null;

  return {
    first: find('first', 'firstname', 'given'),
    last: find('last', 'lastname', 'surname', 'family'),
    grade: find('grade', 'gr', 'year'),
    email: find('student email', 'student_email', 'email'),
    gender: find('gender', 'sex'),
    pronouns: find('pronoun'),
    guardian_name: find('parent', 'guardian', 'caregiver', 'mother', 'father', 'contact name'),
    guardian_email: find('parent email', 'guardian email', 'contact email'),
    guardian_phone: find('phone', 'parent phone', 'guardian phone', 'contact phone', 'cell'),
    guardian_relationship: find('relationship', 'relation'),
    iep: find('iep', 'individual education'),
    ell: find('ell', 'esl', 'english learner'),
    medical: find('medical', 'health'),
  };
}

export async function POST(req: NextRequest) {
  try {
    const { headers, sample } = await req.json();

    // Fallback heuristics first
    let map = heuristic(headers || []);
    // If OpenAI key present, try to refine
    const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_PUBLIC || process.env.OPENAI_API_KEY_PRIVATE;
    if (apiKey) {
      const sys = `You map CSV headers to Student fields. Valid fields:
first,last,grade,email,gender,pronouns,guardian_name,guardian_email,guardian_phone,guardian_relationship,iep,ell,medical.
Return strictly JSON {header->field} picking from those fields, and omit unknowns.`;
      const user = `Headers: ${JSON.stringify(headers)}\nSample rows: ${JSON.stringify(sample?.slice?.(0,5) || [])}`;
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{role:'system', content: sys}, {role:'user', content: user}],
          temperature: 0,
          response_format: { type: 'json_object' }
        })
      });
      if (r.ok) {
        const j = await r.json();
        const text = j?.choices?.[0]?.message?.content || '{}';
        const ai = JSON.parse(text);
        // fold AI map (ai is { "Source Header": "field" })
        const normalized: Record<string,string|null> = { ...map };
        for (const [hdr, field] of Object.entries(ai || {})) {
          if (!field) continue;
          const f = String(field).toLowerCase().trim();
          if (['first','last','grade','email','gender','pronouns','guardian_name','guardian_email','guardian_phone','guardian_relationship','iep','ell','medical'].includes(f)) {
            normalized[hdr] = f as any;
          }
        }
        map = normalized;
      }
    }

    return NextResponse.json({ map });
  } catch (e:any) {
    return NextResponse.json({ map: {} }, { status: 200 });
  }
}