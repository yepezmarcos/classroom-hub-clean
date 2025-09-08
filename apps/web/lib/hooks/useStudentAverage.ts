'use client';

import { useEffect, useState } from 'react';

export type StudentAverageData = {
  studentId: string;
  classroomId?: string;
  got: number;
  max: number;
  pct: number | null;
  byCategory: Record<string, { got: number; max: number }>;
  bySubject: Record<string, { got: number; max: number }>;
};

export function useStudentAverage(studentId: string, classroomId?: string) {
  const [data, setData] = useState<StudentAverageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;
    const params = new URLSearchParams({ studentId });
    if (classroomId) params.set('classroomId', classroomId);

    setLoading(true);
    fetch(`/api/aggregate/student?${params.toString()}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setData(j))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [studentId, classroomId]);

  return { data, loading };
}