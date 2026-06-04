import { Paperclip, Send, Smile, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import EmojiPicker from "emoji-picker-react";
import { suggestMessageByAiApi, uploadFileApi } from "../api/chatApi";

function ChatInput({
  input,
  setInput,
  onSend,
  onSendFile,
  onOpenPoll,
  replyToMessage,
  onCancelReply,
}) {
  const textareaRef = useRef(null);
  const fileRef = useRef(null);

  const [showEmoji, setShowEmoji] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  }, [input]);

  const clearAiPanel = () => {
    setAiSuggestions([]);
    setAiError("");
  };

  const buildFallbackSuggestions = (text) => {
    const clean = text.trim();
    return [
      `Mình muốn nói là ${clean}`,
      `Ý mình là ${clean}`,
      `Nói cách khác, ${clean}`,
      `Mình diễn đạt lại một chút: ${clean}`,
    ];
  };

  const handleSend = () => {
    const text = input?.trim();
    if (!text) return;

    onSend(text);
    setInput("");
    setShowEmoji(false);
    clearAiPanel();
  };

  const handleGenerateAiSuggestions = async () => {
    const text = input?.trim();
    if (!text) {
      setAiError("Nhập tin nhắn trước rồi bấm AI để gợi ý.");
      setAiSuggestions([]);
      return;
    }

    try {
      setAiLoading(true);
      setAiError("");

      const res = await suggestMessageByAiApi(text);
      const suggestions = Array.isArray(res.data?.suggestions)
        ? res.data.suggestions
        : [];

      setAiSuggestions(suggestions);
      if (suggestions.length === 0) {
        setAiError("AI chưa tạo được gợi ý phù hợp.");
      }
    } catch (err) {
      console.log("AI suggest lỗi:", err);
      setAiSuggestions(buildFallbackSuggestions(text));
      setAiError(
        "Backend AI chưa sẵn sàng. Đang hiển thị gợi ý tạm, hãy restart backend để dùng Gemini thật."
      );
    } finally {
      setAiLoading(false);
    }
  };

  const handleEmojiClick = (emojiData) => {
    setInput((prev) => prev + emojiData.emoji);
    clearAiPanel();
  };

  const handleSelectFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreviewFile({
      file,
      url: URL.createObjectURL(file),
      isImage: file.type.startsWith("image"),
    });
  };

  const handleUploadFile = async () => {
    if (!previewFile) return;

    try {
      setLoading(true);
      const res = await uploadFileApi(previewFile.file);
      onSendFile(res.data);
      setPreviewFile(null);
    } catch (err) {
      console.log("Upload lỗi:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 py-3 border-t border-slate-700/50 bg-[#111827]/75 relative">
      {previewFile && (
        <div className="mb-3 relative w-fit max-w-full">
          {previewFile.isImage ? (
            <img
              src={previewFile.url}
              className="w-32 rounded-lg border border-slate-700"
              alt=""
            />
          ) : (
            <div className="bg-slate-800 px-3 py-2 rounded-lg text-slate-100 truncate max-w-[320px]">
              {previewFile.file.name}
            </div>
          )}

          <button
            type="button"
            onClick={() => setPreviewFile(null)}
            className="absolute -top-2 -right-2 bg-black text-white text-xs px-2 rounded"
          >
            ×
          </button>
        </div>
      )}

      {replyToMessage && (
        <div className="mb-3 max-w-5xl mx-auto rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 flex items-start gap-3">
          <div className="w-1 self-stretch rounded-full bg-blue-400" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-blue-300">
              Trả lời {replyToMessage.senderName || "tin nhắn"}
            </div>
            <div className="text-sm text-slate-300 truncate">
              {replyToMessage.content || "Tin nhắn"}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="text-slate-400 hover:text-white px-2"
            title="Bỏ trả lời"
          >
            ×
          </button>
        </div>
      )}

      {(aiSuggestions.length > 0 || aiError || aiLoading) && (
        <div className="mb-3 max-w-5xl mx-auto rounded-2xl border border-emerald-500/30 bg-slate-900/95 shadow-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/70 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-300 flex items-center justify-center">
                <Sparkles size={17} />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">Gợi ý AI</div>
                <div className="text-xs text-slate-400 truncate">
                  Chọn một câu để thay vào ô nhập
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={clearAiPanel}
              className="text-slate-400 hover:text-white px-2"
              title="Đóng gợi ý AI"
            >
              ×
            </button>
          </div>

          <div className="p-3 space-y-2">
            {aiLoading && (
              <div className="text-sm text-slate-300 px-2 py-2">
                AI đang viết lại tin nhắn...
              </div>
            )}

            {!aiLoading &&
              aiSuggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion}_${index}`}
                  type="button"
                  onClick={() => {
                    setInput(suggestion);
                    clearAiPanel();
                    textareaRef.current?.focus();
                  }}
                  className="w-full text-left rounded-xl bg-slate-800/80 hover:bg-emerald-500/15 border border-slate-700 hover:border-emerald-500/40 px-4 py-3 text-sm text-slate-100 transition"
                >
                  {suggestion}
                </button>
              ))}

            {!aiLoading && aiError && (
              <div className="text-sm text-amber-300 px-2 py-2">{aiError}</div>
            )}
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto space-y-2">
        <input type="file" ref={fileRef} hidden onChange={handleSelectFile} />

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-9 h-9 rounded-full hover:bg-slate-700 text-slate-300 flex items-center justify-center transition shrink-0"
            title="Đính kèm"
          >
            <Paperclip size={20} />
          </button>

          <button
            type="button"
            onClick={handleGenerateAiSuggestions}
            disabled={aiLoading}
            title="AI gợi ý cách diễn đạt"
            className={`w-9 h-9 rounded-full transition shrink-0 flex items-center justify-center ${
              aiSuggestions.length > 0 || aiLoading
                ? "bg-emerald-600 text-white hover:bg-emerald-500"
                : "hover:bg-slate-700 text-slate-300"
            } disabled:opacity-60`}
          >
            <Sparkles size={20} />
          </button>

          <button
            type="button"
            onClick={onOpenPoll}
            className="w-9 h-9 rounded-full hover:bg-slate-700 text-slate-300 flex items-center justify-center shrink-0"
            title="Tạo bình chọn"
          >
            📊
          </button>
        </div>

        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              clearAiPanel();
            }}
            placeholder="Nhập tin nhắn..."
            rows="1"
            className="min-w-0 flex-1 max-h-32 bg-slate-800 text-white px-5 py-3 rounded-3xl outline-none resize-none leading-5"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />

          <button
            type="button"
            onClick={() => setShowEmoji((prev) => !prev)}
            className="w-11 h-11 rounded-full hover:bg-slate-700 text-slate-300 flex items-center justify-center transition shrink-0"
            title="Biểu cảm"
          >
            <Smile size={22} />
          </button>

          <button
            type="button"
            onClick={previewFile ? handleUploadFile : handleSend}
            className="w-11 h-11 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition shrink-0"
            title="Gửi"
          >
            <Send size={21} />
          </button>
        </div>
      </div>

      {loading && <div className="text-xs text-slate-400 mt-2">Đang upload...</div>}

      {showEmoji && (
        <div className="absolute bottom-24 right-10 z-50">
          <EmojiPicker onEmojiClick={handleEmojiClick} theme="dark" />
        </div>
      )}
    </div>
  );
}

export default ChatInput;
