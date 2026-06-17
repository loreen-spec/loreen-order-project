import { NextRequest, NextResponse } from "next/server";
import { addCommentToNotion, fetchComments } from "@/lib/notion";

export async function GET(req: NextRequest) {
  const pageId = req.nextUrl.searchParams.get("pageId");
  if (!pageId) return NextResponse.json({ error: "pageId required" }, { status: 400 });

  try {
    const comments = await fetchComments(pageId);
    return NextResponse.json(comments);
  } catch (error) {
    console.error("Fetch comments error:", error);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { pageId, comment, author } = await req.json();
  if (!pageId || !comment) return NextResponse.json({ error: "pageId and comment required" }, { status: 400 });

  try {
    await addCommentToNotion(pageId, comment, author ?? "팀원");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Add comment error:", error);
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }
}
