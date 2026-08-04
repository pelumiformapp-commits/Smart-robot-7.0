export async function GET() {
  const res = await fetch("https://api.cerebras.ai/v1/models", {
    headers: { Authorization: `Bearer ${process.env.CEREBRAS_API_KEY}` },
  });
  const data = await res.json();
  return Response.json(data);
}
