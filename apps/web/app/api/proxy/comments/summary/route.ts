import { NextRequest } from 'next/server';
import { forward } from '../../_lib';

export function GET(req: NextRequest) {
  return forward(req, '/comments/summary');
}