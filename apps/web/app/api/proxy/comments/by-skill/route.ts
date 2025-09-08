import { NextRequest } from 'next/server';
import { forward } from '../../_lib';

export function GET(req: NextRequest) {
  // expects ?skill=collaboration&level=G (level optional)
  return forward(req, '/comments/by-skill');
}