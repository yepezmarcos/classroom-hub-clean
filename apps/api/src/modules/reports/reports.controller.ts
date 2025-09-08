import { Body, Controller, Headers, Param, Post } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

type BoardKey = 'auto'|'ontario'|'generic';

function ontarioLevelFromPercent(pct: number | null | undefined) {
  if (pct == null || !isFinite(pct)) return null;
  if (pct >= 90) return '4';
  if (pct >= 85) return '4-';
  if (pct >= 78) return '3+';
  if (pct >= 73) return '3';
  if (pct >= 70) return '3-';
  if (pct >= 65) return '2+';
  if (pct >= 60) return '2';
  if (pct >= 57) return '2-';
  if (pct >= 53) return '1+';
  if (pct >= 50) return '1';
  if (pct >= 45) return '1-';
  return 'R';
}
const clamp = (n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));

@Controller('reports')
export class ReportsController {
  constructor(private prisma: PrismaService) {}

  // --- helpers (resilient to schema variations) ---
  private async getAssignments(classroomId: string, tenantId?: string|null, subject?: string|null, term?: string|null) {
    const where: any = { classroomId };
    if (tenantId) where.tenantId = tenantId;
    // optional filters
    if (subject) {
      // try exact subject field if present; else prefix “[Subject] ” in name; else category match
      where.OR = [
        { subject: subject },
        { name: { startsWith: `[${subject}] ` } },
        { category: subject },
      ];
    }
    if (term) where.term = term;
    const orderBy: any = { name: 'asc' };
    try { return await (this.prisma as any).assignment.findMany({ where, orderBy }); }
    catch { return await (this.prisma as any).assignment.findMany({ where }); }
  }

  private async getClassroom(classroomId: string) {
    try { return await (this.prisma as any).classroom.findUnique({ where: { id: classroomId } }); }
    catch { return null; }
  }

  /** Try enrollment -> else students with any grade in these assignments */
  private async getStudentsForClass(classroomId: string, assignmentIds: string[]) {
    const p:any = this.prisma as any;

    // Attempt Enrollment paths
    for (const key of ['enrollment','enrollments','classroomEnrollment','classroomStudent']) {
      if (p[key]?.findMany) {
        try {
          const rows = await p[key].findMany({
            where: { classroomId },
            include: { student: true },
            take: 1000,
          });
          const students = rows.map((r:any)=>r.student).filter(Boolean);
          if (students.length) return students;
        } catch {}
      }
    }

    // Fallback: from grades table over assignmentIds
    try {
      const grades = await p.grade.findMany({
        where: { assignmentId: { in: assignmentIds } },
        select: { studentId: true },
      });
      const ids = Array.from(new Set(grades.map((g:any)=>g.studentId).filter(Boolean)));
      if (!ids.length) return [];
      return await p.student.findMany({ where: { id: { in: ids } } });
    } catch { return []; }
  }

  private async getGradesForAssignments(assignmentIds: string[], tenantId?: string|null) {
    const where:any = { assignmentId: { in: assignmentIds } };
    if (tenantId) where.tenantId = tenantId;
    try { return await (this.prisma as any).grade.findMany({ where }); }
    catch { return []; }
  }

  private levelFor(board: BoardKey, pct: number|null) {
    const b = board==='auto' ? 'ontario' : board;
    if (b==='ontario') return ontarioLevelFromPercent(pct ?? null);
    if (pct==null) return null;
    return (pct>=80?'4-':pct>=70?'3':pct>=60?'2':pct>=50?'1':'R');
  }

  private computeSummary(students:any[], assignments:any[], grades:any[], board:BoardKey) {
    // maps
    const A = new Map<string, any>(); for (const a of assignments) A.set(a.id, a);
    const S = new Map<string, any>(); for (const s of students) S.set(s.id, s);

    // student -> { got, max, pct, lvl, byCategory: {cat:{got,max,pct}} , byAssignment:[] }
    const perStudent: Record<string, any> = {};
    for (const s of students) perStudent[s.id] = { got:0, max:0, byCategory:{}, byAssignment:[] as any[] };

    for (const g of grades) {
      const a = A.get(g.assignmentId); if (!a) continue;
      const srow = perStudent[g.studentId]; if (!srow) continue;
      const sc = typeof g.score === 'number' ? g.score : null;
      const mx = typeof a.max === 'number' ? a.max : 0;
      srow.byAssignment.push({ assignmentId: a.id, name: a.name, category: a.category||'Uncategorized', max: mx, score: sc });
      if (mx>0 && sc!=null) { srow.got += sc; srow.max += mx; }
      const cat = (a.category||'Uncategorized');
      if (!srow.byCategory[cat]) srow.byCategory[cat] = { got:0, max:0 };
      if (mx>0 && sc!=null) { srow.byCategory[cat].got += sc; srow.byCategory[cat].max += mx; }
    }

    for (const sid of Object.keys(perStudent)) {
      const t = perStudent[sid];
      t.pct = t.max>0 ? (t.got/t.max)*100 : null;
      t.lvl = this.levelFor(board, t.pct);
      for (const cat of Object.keys(t.byCategory)) {
        const c = t.byCategory[cat];
        c.pct = c.max>0 ? (c.got/c.max)*100 : null;
      }
    }

    // class aggregates
    const classAgg = {
      students: students.length,
      assignments: assignments.length,
      avgPct: null as number|null,
      medPct: null as number|null,
    };
    const pcts = Object.values(perStudent).map((x:any)=>x.pct).filter((x:any)=>typeof x==='number') as number[];
    if (pcts.length) {
      const avg = pcts.reduce((a,b)=>a+b,0)/pcts.length;
      const sorted = pcts.slice().sort((a,b)=>a-b);
      const m = Math.floor(sorted.length/2);
      const med = sorted.length%2?sorted[m]:(sorted[m-1]+sorted[m])/2;
      classAgg.avgPct = Math.round(avg*10)/10;
      classAgg.medPct = Math.round(med*10)/10;
    }

    return { perStudent, classAgg };
  }

  private htmlEscape(s:string){ return s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c] as string)); }

  private buildClassHtml(ctx:{
    classroom:any, subject?:string|null, term?:string|null, board:BoardKey,
    students:any[], assignments:any[], perStudent:Record<string,any>, classAgg:any
  }) {
    const title = `${ctx.classroom?.name || 'Class'} — Report${ctx.subject?` • ${ctx.subject}`:''}${ctx.term?` • ${ctx.term}`:''}`;
    const rows = ctx.students.map((s:any)=>{
      const t = ctx.perStudent[s.id] || {};
      const byCat = t.byCategory||{};
      const catBits = Object.keys(byCat).map(k=>{
        const c = byCat[k];
        const pct = c.pct==null?'—':`${Math.round(c.pct*10)/10}%`;
        return `<span class="cat"><b>${this.htmlEscape(k)}</b> ${Math.round(c.got*10)/10}/${Math.round(c.max*10)/10} (${pct})</span>`;
      }).join(' ');
      const pct = t.pct==null?'—':`${Math.round(t.pct*10)/10}%`;
      const lvl = t.lvl ?? '';
      return `
        <tr>
          <td>${this.htmlEscape(s.last||'')}, ${this.htmlEscape(s.first||'')}</td>
          <td class="num">${Math.round((t.got||0)*10)/10}</td>
          <td class="num">${Math.round((t.max||0)*10)/10}</td>
          <td class="num">${pct}</td>
          <td class="lvl">${this.htmlEscape(lvl)}</td>
          <td>${catBits}</td>
        </tr>
      `;
    }).join('');

    const css = `
      body{font-family:ui-sans-serif,system-ui,-apple-system; background:#0b1020; color:#e6e8f5; margin:24px;}
      .card{background:#0e122b;border:1px solid #1f2547;border-radius:12px;padding:16px;margin-bottom:14px;}
      h1{margin:0 0 8px;font-size:20px}
      .muted{color:#9aa1c7}
      table{width:100%; border-collapse:collapse;}
      th, td{border-bottom:1px solid #1f2547; padding:8px; vertical-align:top;}
      th{text-align:left; color:#9aa1c7; font-weight:600;}
      td.num{text-align:right;}
      .lvl{font-weight:700}
      .cats .cat{display:inline-block;border:1px solid #1f2547;border-radius:999px;padding:2px 8px;margin:2px;background:#0b1020}
      .hdr{display:flex;justify-content:space-between;align-items:flex-end;gap:12px}
      .right{color:#9aa1c7}
      .pill{display:inline-block;border:1px solid #1f2547;border-radius:999px;padding:2px 10px;margin-left:6px;background:#0b1020}
      @media print { body{background:#fff;color:#000} .card{background:#fff;border-color:#ddd} td,th{border-color:#eee} }
    `;

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${this.htmlEscape(title)}</title>
<style>${css}</style></head>
<body>
  <div class="card">
    <div class="hdr">
      <h1>${this.htmlEscape(title)}</h1>
      <div class="right">
        <span class="pill">Students: ${ctx.classAgg.students}</span>
        <span class="pill">Assignments: ${ctx.classAgg.assignments}</span>
        <span class="pill">Avg: ${ctx.classAgg.avgPct??'—'}%</span>
        <span class="pill">Med: ${ctx.classAgg.medPct??'—'}%</span>
        <span class="pill">Board: ${this.htmlEscape(ctx.board)}</span>
      </div>
    </div>
    <div class="muted">Generated ${new Date().toLocaleString()}</div>
  </div>

  <div class="card">
    <table>
      <thead>
        <tr>
          <th>Student</th>
          <th class="num">Got</th>
          <th class="num">Max</th>
          <th class="num">Percent</th>
          <th>Level</th>
          <th>Category breakdown</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</body></html>`;
  }

  private buildStudentHtml(ctx:{
    classroom:any, student:any, subject?:string|null, term?:string|null, board:BoardKey,
    totals:any
  }) {
    const s = ctx.student;
    const t = ctx.totals;
    const title = `${s.last||''}, ${s.first||''} — ${ctx.classroom?.name||'Class'}${ctx.subject?` • ${ctx.subject}`:''}${ctx.term?` • ${ctx.term}`:''}`;
    const css = `
      body{font-family:ui-sans-serif,system-ui,-apple-system;background:#0b1020;color:#e6e8f5;margin:24px;}
      .card{background:#0e122b;border:1px solid #1f2547;border-radius:12px;padding:16px;margin-bottom:14px;}
      h1{margin:0 0 8px;font-size:20px}
      .muted{color:#9aa1c7}
      .grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
      .pill{display:inline-block;border:1px solid #1f2547;border-radius:999px;padding:2px 10px;background:#0b1020}
      table{width:100%;border-collapse:collapse;}
      th,td{border-bottom:1px solid #1f2547;padding:8px}
      th{text-align:left;color:#9aa1c7}
      td.num{text-align:right}
      .lvl{font-weight:700}
      @media print { body{background:#fff;color:#000} .card{background:#fff;border-color:#ddd} td,th{border-color:#eee} }
    `;
    const catRows = Object.keys(t.byCategory||{}).map(k=>{
      const c = t.byCategory[k];
      const pct = c.pct==null?'—':`${Math.round(c.pct*10)/10}%`;
      return `<tr><td>${this.htmlEscape(k)}</td><td class="num">${Math.round(c.got*10)/10}/${Math.round(c.max*10)/10}</td><td class="num">${pct}</td></tr>`;
    }).join('');
    const assignRows = (t.byAssignment||[]).map((a:any)=>{
      const pct = (a.max>0 && typeof a.score==='number') ? `${Math.round((a.score/a.max)*1000)/10}%` : '—';
      return `<tr><td>${this.htmlEscape(a.name)}</td><td>${this.htmlEscape(a.category||'Uncategorized')}</td><td class="num">${a.score ?? '—'}/${a.max}</td><td class="num">${pct}</td></tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${this.htmlEscape(title)}</title>
<style>${css}</style></head>
<body>
  <div class="card">
    <h1>${this.htmlEscape(title)}</h1>
    <div class="muted">Generated ${new Date().toLocaleString()}</div>
  </div>
  <div class="card">
    <div class="grid">
      <div><div class="muted">Points</div><div><b>${Math.round(t.got*10)/10}</b> / ${Math.round(t.max*10)/10}</div></div>
      <div><div class="muted">Percent</div><div><b>${t.pct==null?'—':`${Math.round(t.pct*10)/10}%`}</b></div></div>
      <div><div class="muted">Level</div><div class="lvl"><b>${t.lvl ?? '—'}</b></div></div>
      <div><div class="muted">Board</div><div><span class="pill">${this.htmlEscape(ctx.board)}</span></div></div>
    </div>
  </div>
  <div class="card">
    <h3>Category Averages</h3>
    <table>
      <thead><tr><th>Category</th><th class="num">Points</th><th class="num">Percent</th></tr></thead>
      <tbody>${catRows || '<tr><td colspan="3" class="muted">No data</td></tr>'}</tbody>
    </table>
  </div>
  <div class="card">
    <h3>Assignment Breakdown</h3>
    <table>
      <thead><tr><th>Assignment</th><th>Category</th><th class="num">Score</th><th class="num">Percent</th></tr></thead>
      <tbody>${assignRows || '<tr><td colspan="4" class="muted">No data</td></tr>'}</tbody>
    </table>
  </div>
</body></html>`;
  }

  // Try saving report to profile: StudentNote -> Note -> Comment (bank)
  private async saveToProfile(studentId:string, html:string, tags:string[]) {
    const p:any = this.prisma as any;
    const payload = {
      title: 'Report Card (auto)',
      body: html,
      tags,
    };
    for (const key of ['studentNote','studentNotes','note','notes']) {
      if (p[key]?.create) {
        try {
          // try formats commonly found
          const attempt = [
            { data: { studentId, ...payload } },
            { data: { student: { connect: { id: studentId } }, ...payload } },
            { data: { ...payload } },
          ];
          for (const variant of attempt) {
            try { await p[key].create(variant); return { savedVia: key }; } catch {}
          }
        } catch {}
      }
    }
    // Fallback: Comments bank
    for (const key of Object.keys(p).filter((k:string)=>/comment/i.test(k))) {
      if (p[key]?.create) {
        try {
          await p[key].create({ data: { text: `[Report:${new Date().toISOString()}]`, tags: ['report','html',...tags], body: html } });
          return { savedVia: key };
        } catch {}
      }
    }
    return { savedVia: null };
  }

  @Post('class')
  async classReport(
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Body() body: { classroomId: string; subject?: string|null; term?: string|null; board?: BoardKey; saveToProfiles?: boolean }
  ) {
    const classroomId = body.classroomId;
    const subject = body.subject || null;
    const term = body.term || null;
    const board: BoardKey = (body.board || 'auto');

    const classroom = await this.getClassroom(classroomId);
    const assignments = await this.getAssignments(classroomId, tenantId, subject, term);
    const assignmentIds = assignments.map((a:any)=>a.id);
    const students = await this.getStudentsForClass(classroomId, assignmentIds);
    const grades = await this.getGradesForAssignments(assignmentIds, tenantId);

    const { perStudent, classAgg } = this.computeSummary(students, assignments, grades, board);
    const html = this.buildClassHtml({ classroom, subject, term, board, students, assignments, perStudent, classAgg });

    let savedCount = 0;
    if (body.saveToProfiles) {
      for (const s of students) {
        const t = perStudent[s.id];
        const indivHtml = this.buildStudentHtml({ classroom, student:s, subject, term, board, totals: t });
        const res = await this.saveToProfile(s.id, indivHtml, [subject||'', term||'', 'class-report'].filter(Boolean));
        if (res.savedVia) savedCount++;
      }
    }

    return {
      ok: true,
      classroom: { id: classroomId, name: classroom?.name || null },
      counts: { students: students.length, assignments: assignments.length, saved: savedCount },
      html,
    };
  }

  @Post('student/:id')
  async studentReport(
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Param('id') studentId: string,
    @Body() body: { classroomId: string; subject?: string|null; term?: string|null; board?: BoardKey; save?: boolean }
  ) {
    const classroomId = body.classroomId;
    const subject = body.subject || null;
    const term = body.term || null;
    const board: BoardKey = (body.board || 'auto');

    const classroom = await this.getClassroom(classroomId);
    const assignments = await this.getAssignments(classroomId, tenantId, subject, term);
    const assignmentIds = assignments.map((a:any)=>a.id);
    const grades = await this.getGradesForAssignments(assignmentIds, tenantId);

    // students: fetch this one
    const student = await (this.prisma as any).student.findUnique({ where: { id: studentId } }).catch(()=>null);
    const { perStudent } = this.computeSummary([student].filter(Boolean), assignments, grades, board);
    const totals = perStudent[studentId] || { got:0, max:0, pct:null, lvl:null, byCategory:{}, byAssignment:[] };

    const html = this.buildStudentHtml({ classroom, student, subject, term, board, totals });

    let savedVia: string | null = null;
    if (body.save && student) {
      const res = await this.saveToProfile(student.id, html, [subject||'', term||'', 'student-report'].filter(Boolean));
      savedVia = res.savedVia;
    }

    return { ok: true, student: student ? { id: student.id, first: student.first, last: student.last } : null, html, savedVia };
  }
}