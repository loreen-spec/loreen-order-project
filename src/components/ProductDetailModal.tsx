"use client";
import { useEffect, useState, useRef } from "react";
import { X, Send, MessageCircle, ExternalLink, Layers, Calendar, Building2, AlertTriangle } from "lucide-react";
import type { Product, Comment } from "@/types";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";

interface Props {
  product: Product;
  onClose: () => void;
}

export default function ProductDetailModal({ product, onClose }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("나");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadComments();
  }, [product.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  async function loadComments() {
    setLoading(true);
    try {
      const res = await fetch(`/api/comments?pageId=${product.notionPageId}`);
      const data = await res.json();
      setComments(Array.isArray(data) ? data : []);
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: product.notionPageId, comment: text.trim(), author }),
      });
      setText("");
      await loadComments();
    } catch {
      alert("댓글 등록에 실패했습니다.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-3xl shadow-float w-full max-w-lg max-h-[85vh] flex flex-col animate-slide-down">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${STATUS_COLOR[product.status]}`}>
                {product.statusLabel || STATUS_LABEL[product.status]}
              </span>
              {product.status === "delayed" && (
                <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
                  <AlertTriangle size={12} /> 지연 확인 필요
                </span>
              )}
            </div>
            <h3 className="font-display font-bold text-lg text-gray-900 truncate">{product.name}</h3>
          </div>
          <button onClick={onClose} className="ml-3 w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors shrink-0">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-3 gap-3 px-6 py-4 border-b border-gray-100">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1 text-gray-400 text-xs">
              <Building2 size={11} /> 업체
            </div>
            <div className="font-medium text-sm text-gray-800">{product.vendor || "—"}</div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1 text-gray-400 text-xs">
              <Calendar size={11} /> 입고예정
            </div>
            <div className="font-medium text-sm text-gray-800">
              {product.arrivalDate ? format(parseISO(product.arrivalDate), "M/d (EEE)", { locale: ko }) : "—"}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1 text-gray-400 text-xs">
              <Layers size={11} /> 발주수량
            </div>
            <div className="font-display font-bold text-sm text-indigo-600">{product.orderQuantity.toLocaleString()}장</div>
          </div>
        </div>

        {product.notes && (
          <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500">{product.notes}</p>
          </div>
        )}

        {/* Comments */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-2">
            <MessageCircle size={13} />
            {loading ? "불러오는 중..." : `댓글 ${comments.length}개`}
          </div>
          {!loading && comments.length === 0 && (
            <div className="text-center py-6 text-gray-400 text-sm">
              {product.status === "delayed" ? "지연 사유를 댓글로 남겨주세요." : "아직 댓글이 없어요."}
            </div>
          )}
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold shrink-0">
                {c.author.charAt(0)}
              </div>
              <div className="flex-1 bg-gray-50 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-xs font-semibold text-gray-700">{c.author}</span>
                  <span className="text-[10px] text-gray-400">
                    {format(new Date(c.createdAt), "M/d HH:mm")}
                  </span>
                </div>
                <p className="text-sm text-gray-800 leading-relaxed">{c.body}</p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Comment input */}
        <form onSubmit={submitComment} className="p-4 border-t border-gray-100 flex items-center gap-2">
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="이름"
            className="w-16 text-xs border border-gray-200 rounded-lg px-2 py-2 text-center bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={product.status === "delayed" ? "지연 사유를 입력하세요..." : "댓글을 입력하세요..."}
            className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-gray-50"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors shrink-0"
          >
            <Send size={15} />
          </button>
        </form>

        <div className="px-4 pb-4 text-center">
          <a
            href={`https://notion.so/${product.notionPageId.replace(/-/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 transition-colors"
          >
            <ExternalLink size={11} /> 노션에서 보기
          </a>
        </div>
      </div>
    </div>
  );
}
