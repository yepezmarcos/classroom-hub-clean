import { NextRequest } from 'next/server';
import { forward } from '../_lib';

export function GET(req: NextRequest) {
  return forward(req, '/settings');
}

export function PUT(req: NextRequest) {
  return forward(req, '/settings', { method: 'PUT' });
}

export function POST(req: NextRequest) {
  return forward(req, '/settings', { method: 'POST' });
}