import { Bot, Loader2, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function AiAssistantBox({ open, onClose, onAsk }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Mình có thể hỗ trợ trả lời câu hỏi chung, kiểm tra bạn online, tìm file, ảnh, link và tóm tắt dữ liệu trong hội thoại đang mở.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, open]);

  const handleSubmit = async () => {
    const text = question.trim();
    if (!text || loading) return;

    setQuestion("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const answer = await onAsk(text);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: answer || "AI chưa có phản hồi.",
        },
      ]);
    } catch (error) {
      console.log("AI assistant error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "AI chưa trả lời được lúc này. Hãy kiểm tra backend hoặc Gemini API key.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed left-[104px] top-6 z-[1200] w-[390px] max-w-[calc(100vw-120px)] overflow-hidden rounded-2xl border border-emerald-500/30 bg-[#0f172a] text-slate-100 shadow-2xl">
      <div className="px-4 py-3 border-b border-slate-700/70 bg-[#111827] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-300 flex items-center justify-center">
            <Bot size={21} />
          </span>
          <div className="min-w-0">
            <div className="font-bold text-white flex items-center gap-2">
              AI Chatbox <Sparkles size={15} className="text-emerald-300" />
            </div>
            <div className="text-xs text-slate-400 truncate">
              Hỏi AI hoặc hỏi dữ liệu trong tài khoản
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-full hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center"
          title="Đóng AI"
        >
          <X size={19} />
        </button>
      </div>

      <div ref={scrollRef} className="h-[calc(100vh-220px)] min-h-[360px] max-h-[620px] overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((message, index) => {
          const isUser = message.role === "user";

          return (
            <div
              key={`${message.role}_${index}`}
              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[86%] rounded-2xl px-4 py-2.5 text-sm leading-6 whitespace-pre-wrap ${
                  isUser
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-800 border border-slate-700 text-slate-100"
                }`}
              >
                {message.content}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-2.5 bg-slate-800 border border-slate-700 text-slate-300 flex items-center gap-2 text-sm">
              <Loader2 size={16} className="animate-spin" />
              AI đang đọc dữ liệu...
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-slate-700/70 bg-[#111827]">
        <div className="flex items-end gap-2">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Hỏi: ai đang online, tìm file PDF, ảnh trong chat..."
            rows={1}
            className="min-h-[44px] max-h-28 flex-1 resize-none rounded-2xl bg-slate-800 px-4 py-3 text-sm text-white outline-none border border-slate-700 focus:border-emerald-500/60"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!question.trim() || loading}
            className="w-11 h-11 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center disabled:opacity-50"
            title="Gửi câu hỏi"
          >
            <Send size={19} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default AiAssistantBox;
