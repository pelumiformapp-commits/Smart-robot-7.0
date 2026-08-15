import pdfParse from "pdf-parse/lib/pdf-parse.js";

export async function POST(req) {
  const { data, mimeType } = await req.json();
  if (!data || !mimeType) {
    return Response.json({ error: "data and mimeType are required" }, { status: 400 });
  }

  const buffer = Buffer.from(data, "base64");

  try {
    if (mimeType === "application/pdf") {
      const parsed = await pdfParse(buffer);
      return Response.json({ text: parsed.text.slice(0, 12000) });
    }
    if (mimeType.startsWith("text/")) {
      return Response.json({ text: buffer.toString("utf8").slice(0, 12000) });
    }
    return Response.json({ error: "Only PDF and plain text files are supported." }, { status: 400 });
  } catch (err) {
    console.log("Document extraction failed:", err.message);
    return Response.json({ error: "Could not read that file." }, { status: 500 });
  }
}
