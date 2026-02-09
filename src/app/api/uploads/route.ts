import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";

export async function POST(req: Request) {
  try {
    await requireSession(req);
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const files = formData.getAll("files");

  if (!files.length) {
    return NextResponse.json({ success: false, error: "No files uploaded." }, { status: 400 });
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });

  const uploaded = await Promise.all(
    files
      .filter((file): file is File => file instanceof File)
      .map(async (file) => {
        const safeName = file.name.replace(/\s+/g, "-");
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
        const filepath = path.join(uploadDir, filename);
        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(filepath, buffer);
        const url = `/uploads/${filename}`;
        return {
          id: `att-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          url,
          type: file.type || "application/octet-stream",
          size: file.size,
        };
      }),
  );

  return NextResponse.json({ success: true, data: uploaded });
}

export async function DELETE(req: Request) {
  try {
    await requireSession(req);
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const url = body?.url;
  if (!url || typeof url !== "string") {
    return NextResponse.json({ success: false, error: "Missing url." }, { status: 400 });
  }

  if (url.startsWith("/uploads/")) {
    const filename = url.replace("/uploads/", "");
    const filepath = path.join(process.cwd(), "public", "uploads", filename);
    try {
      await unlink(filepath);
    } catch {
      // ignore if missing
    }
  }
  return NextResponse.json({ success: true, data: { url } });
}
