export async function POST(req) {
  const { password } = await req.json();
  if (password && password === process.env.ADMIN_PASSWORD) {
    return Response.json({ success: true });
  }
  return Response.json({ success: false }, { status: 401 });
}
