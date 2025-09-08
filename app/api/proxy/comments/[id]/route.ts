// app/api/proxy/comments/[id]/route.ts
import { forward } from '../../_lib';

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  return forward(_req, `/comments/${encodeURIComponent(params.id)}`, {
    method: 'DELETE',
  });
}