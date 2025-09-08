import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data');
const FILE = path.join(DATA_DIR, 'dev.json');

type Student = {
  id: string;
  first: string;
  last: string;
  grade?: string;
  flags?: { iep?: boolean; ell?: boolean; medical?: boolean };
};

type Classroom = { id: string; name: string; code: string; grade?: string; subject?: string };

type Settings = {
  theme?: 'light' | 'dark';
  palette?: string;
  gradingScheme?: 'points' | 'percent' | 'levels';
};

type DevData = {
  students: Student[];
  classrooms: Classroom[];
  settings: Settings;
};

const defaultData: DevData = {
  students: [
    { id: 'stu_1', first: 'Alex', last: 'Rivera', grade: '5', flags: { iep: false, ell: true } },
    { id: 'stu_2', first: 'Jess', last: 'Kim', grade: '5', flags: { iep: false, ell: false } },
    { id: 'stu_3', first: 'Sam', last: 'Chen', grade: '5', flags: { iep: true, ell: false } },
  ],
  classrooms: [
    { id: 'cls_1', name: 'Homeroom A', code: 'HRA-24', grade: '5', subject: 'Homeroom' },
    { id: 'cls_2', name: 'Math A', code: 'MATH-5A', grade: '5', subject: 'Math' },
  ],
  settings: { theme: 'light', palette: 'indigo', gradingScheme: 'levels' },
};

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify(defaultData, null, 2));
}

export function loadDev(): DevData {
  try {
    ensureFile();
    return JSON.parse(fs.readFileSync(FILE, 'utf-8'));
  } catch {
    return JSON.parse(JSON.stringify(defaultData));
  }
}

export function saveDev(data: Partial<DevData>) {
  const current = loadDev();
  const merged = { ...current, ...data };
  fs.writeFileSync(FILE, JSON.stringify(merged, null, 2));
  return merged;
}