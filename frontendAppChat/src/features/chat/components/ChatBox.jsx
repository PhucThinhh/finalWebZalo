import React, {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { deleteMessageApi, recallMessageApi } from "../api/chatApi";

const BASE_URL = "http://localhost:8080";

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😡"];
import PollMessageCard from "./PollMessageCard";

const ChatBox = memo(
  ({
    messages = [],
    setMessages,
    messagesEndRef,
    currentUserId,
    onForwardMessage,
    onReplyMessage,
    onOpenUserProfile,
    onReactMessage,
    onPinMessage,
    onUnpinMessage,
    showSearch = false,
    onCloseSearch,
    chatBackground,
    onClearReactions,
    pollRealtimeMap = {},
  }) => {
    const [, setSelectedMessageId] = useState(null);
    const [hoveredMessageId, setHoveredMessageId] = useState(null);
    const [reactionPickerId, setReactionPickerId] = useState(null);
    const [menuMessageId, setMenuMessageId] = useState(null);

    const [previewPdf, setPreviewPdf] = useState(null);
    const [searchKeyword, setSearchKeyword] = useState("");
    const [matchIndexes, setMatchIndexes] = useState([]);
    const [activeMatchPos, setActiveMatchPos] = useState(-1);

    const messageRefs = useRef({});
    const scrollBoxRef = useRef(null);
    const reactionCloseTimer = useRef(null);

    const previousLastMessageIdRef = useRef(null);
    const previousScrollTopRef = useRef(0);

    const openReactionPicker = (messageId) => {
      if (reactionCloseTimer.current) {
        clearTimeout(reactionCloseTimer.current);
      }

      setReactionPickerId(messageId);
    };

    const closeReactionPickerLater = () => {
      if (reactionCloseTimer.current) {
        clearTimeout(reactionCloseTimer.current);
      }

      reactionCloseTimer.current = setTimeout(() => {
        setReactionPickerId(null);
      }, 180);
    };

    useEffect(() => {
      return () => {
        if (reactionCloseTimer.current) {
          clearTimeout(reactionCloseTimer.current);
        }
      };
    }, []);

    // ================= URL NORMALIZER =================
    const normalizeUrl = (url) => {
      if (!url) return "";

      const normalized = String(url).trim();

      if (normalized.startsWith("data:")) {
        return normalized;
      }

      if (normalized.includes("localhost:5173")) {
        return normalized.replace("localhost:5173", "localhost:8080");
      }

      if (normalized.includes("127.0.0.1:5173")) {
        return normalized.replace("127.0.0.1:5173", "localhost:8080");
      }

      if (normalized.includes("10.0.2.2:8080")) {
        return normalized.replace("10.0.2.2:8080", "localhost:8080");
      }

      if (normalized.startsWith("http")) {
        return normalized;
      }

      if (normalized.startsWith("/")) {
        return `${BASE_URL}${normalized}`;
      }

      return `${BASE_URL}/uploads/${normalized}`;
    };

    const getFileUrl = normalizeUrl;
    const getAvatarUrl = normalizeUrl;
    const getBackgroundUrl = normalizeUrl;

    const backgroundImageUrl = getBackgroundUrl(chatBackground);

    // ================= AUTO SCROLL =================
    // Chỉ cuộn khi tin nhắn CUỐI thay đổi.
    // Update reaction không đổi lastMessageId => không cuộn.
    // ================= AUTO SCROLL =================
    // Chỉ cuộn khi có tin nhắn mới thật.
    // Nếu chỉ update reaction thì giữ nguyên vị trí đang đọc.
    useLayoutEffect(() => {
      if (showSearch) return;

      const scrollBox = scrollBoxRef.current;
      if (!scrollBox) return;

      const lastMessage = messages[messages.length - 1];
      const lastMessageId = lastMessage?._id || lastMessage?.id || null;

      const oldLastMessageId = previousLastMessageIdRef.current;

      // Lần đầu load history
      if (!oldLastMessageId && lastMessageId) {
        previousLastMessageIdRef.current = lastMessageId;

        requestAnimationFrame(() => {
          messagesEndRef?.current?.scrollIntoView({ behavior: "auto" });
        });

        return;
      }

      // Nếu id tin nhắn cuối không đổi => chỉ là reaction/recall/delete update
      // => không kéo xuống cuối, trả scrollTop về vị trí cũ
      if (String(oldLastMessageId) === String(lastMessageId)) {
        scrollBox.scrollTop = previousScrollTopRef.current;
        return;
      }

      // Có tin nhắn mới thật
      previousLastMessageIdRef.current = lastMessageId;

      requestAnimationFrame(() => {
        messagesEndRef?.current?.scrollIntoView({ behavior: "smooth" });
      });
    }, [messages, messagesEndRef, showSearch]);

    // ================= CLICK OUTSIDE =================
    useEffect(() => {
      const handleClickOutside = () => {
        setSelectedMessageId(null);
        setMenuMessageId(null);
        setReactionPickerId(null);
      };

      window.addEventListener("click", handleClickOutside);

      return () => window.removeEventListener("click", handleClickOutside);
    }, []);

    // ================= FILTER XOÁ 1 CHIỀU =================
    const visibleMessages = useMemo(() => {
      return messages.filter((msg) => {
        if (!msg.deletedBy) return true;
        return Number(msg.deletedBy) !== Number(currentUserId);
      });
    }, [messages, currentUserId]);

    const normalizedKeyword = searchKeyword.trim().toLowerCase();

    const getSearchableText = (msg) => {
      return String(msg?.content || msg?.text || msg?.originalContent || "");
    };

    const scrollToMatch = (matchPos) => {
      if (matchPos < 0 || matchPos >= matchIndexes.length) return;

      const targetMessageIndex = matchIndexes[matchPos];
      const targetMessage = visibleMessages[targetMessageIndex];
      const targetId = targetMessage?._id || targetMessage?.id;

      if (!targetId) return;

      const node = messageRefs.current[targetId];

      node?.scrollIntoView?.({
        behavior: "smooth",
        block: "center",
      });
    };

    useEffect(() => {
      if (!showSearch) {
        setSearchKeyword("");
        setMatchIndexes([]);
        setActiveMatchPos(-1);
      }
    }, [showSearch]);

    useEffect(() => {
      if (!normalizedKeyword) {
        setMatchIndexes([]);
        setActiveMatchPos(-1);
        return;
      }

      const indexes = [];

      visibleMessages.forEach((msg, index) => {
        const text = getSearchableText(msg).toLowerCase();

        if (text.includes(normalizedKeyword)) {
          indexes.push(index);
        }
      });

      setMatchIndexes(indexes);

      if (indexes.length === 0) {
        setActiveMatchPos(-1);
        return;
      }

      setActiveMatchPos(indexes.length - 1);
    }, [normalizedKeyword, visibleMessages]);

    useEffect(() => {
      if (activeMatchPos >= 0) {
        scrollToMatch(activeMatchPos);
      }
    }, [activeMatchPos, matchIndexes]);

    const jumpPrev = () => {
      if (matchIndexes.length === 0) return;

      setActiveMatchPos((prev) =>
        prev <= 0 ? matchIndexes.length - 1 : prev - 1
      );
    };

    const jumpNext = () => {
      if (matchIndexes.length === 0) return;

      setActiveMatchPos((prev) =>
        prev >= matchIndexes.length - 1 ? 0 : prev + 1
      );
    };

    const escapeRegex = (value) => {
      return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    };

    const renderHighlightedText = (text) => {
      const safeText = String(text || "");

      if (!normalizedKeyword) return safeText;

      const regex = new RegExp(`(${escapeRegex(normalizedKeyword)})`, "gi");
      const parts = safeText.split(regex);

      return parts.map((part, idx) => {
        const isHit = part.toLowerCase() === normalizedKeyword;

        if (!isHit) {
          return <React.Fragment key={idx}>{part}</React.Fragment>;
        }

        return (
          <mark
            key={idx}
            className="bg-yellow-300/90 text-slate-900 px-0.5 rounded-sm"
          >
            {part}
          </mark>
        );
      });
    };

    // ================= DELETE =================
    const handleDeleteMessage = async (id) => {
      try {
        await deleteMessageApi(id);

        setMessages((prev) =>
          prev.map((m) =>
            String(m.id || m._id) === String(id)
              ? {
                  ...m,
                  deletedBy: currentUserId,
                }
              : m
          )
        );
      } catch (err) {
        console.log("Delete error:", err);
      }
    };

    // ================= RECALL =================
    const handleRecallMessage = async (id) => {
      try {
        await recallMessageApi(id);

        setMessages((prev) =>
          prev.map((m) =>
            String(m.id || m._id) === String(id)
              ? {
                  ...m,
                  isRecalled: true,
                  content: null,
                }
              : m
          )
        );
      } catch (err) {
        console.log("Recall error:", err);
      }
    };

    // ================= REACTION =================
    const handleReactMessage = async (messageId, emoji) => {
      if (!messageId || !emoji) return;

      try {
        await onReactMessage?.(messageId, emoji);
      } catch (error) {
        console.log("React error:", error);
      }
    };

    const handleClearReactions = async (messageId) => {
      if (!messageId) return;

      try {
        await onClearReactions?.(messageId);
      } catch (error) {
        console.log("Clear reactions error:", error);
      }
    };

    const renderReactions = (reactions = [], messageId, isMe) => {
      const list = Array.isArray(reactions)
        ? reactions.filter((r) => r?.emoji && Number(r?.count || 0) > 0)
        : [];

      if (list.length === 0) return null;

      const totalCount = list.reduce(
        (total, reaction) => total + Number(reaction.count || 0),
        0
      );

      // Lấy tối đa 4 emoji để cụm không quá dài
      const visibleEmojis = list.slice(0, 4);

      return (
        <div
          className={`absolute -bottom-5 z-20 ${isMe ? "right-1" : "left-1"}`}
        >
          <div className="h-7 px-2 rounded-full bg-white border border-slate-200 shadow-md flex items-center gap-1">
            {visibleEmojis.map((reaction, index) => (
              <button
                key={`${reaction.emoji}-${index}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleReactMessage(messageId, reaction.emoji);
                }}
                className="text-lg leading-none hover:scale-125 transition -mr-0.5"
                title={`${reaction.emoji} ${reaction.count}`}
              >
                {reaction.emoji}
              </button>
            ))}

            <span className="text-sm font-semibold text-slate-700 ml-1">
              {totalCount}
            </span>
          </div>
        </div>
      );
    };

    const renderAvatarFallback = (senderName) => {
      const firstChar = String(senderName || "U")
        .charAt(0)
        .toUpperCase();

      return (
        <div className="w-full h-full flex items-center justify-center text-xs text-white font-semibold">
          {firstChar}
        </div>
      );
    };

    const isImageFile = (url) => {
      return String(url || "").match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i);
    };

    const isPdfFile = (url) => {
      return String(url || "").match(/\.pdf(\?|$)/i);
    };

    const messageById = useMemo(() => {
      const map = new Map();
      visibleMessages.forEach((message) => {
        const id = message?._id || message?.id;
        if (id) map.set(String(id), message);
      });
      return map;
    }, [visibleMessages]);

    const getReplyPreview = (msg) => {
      if (!msg?.originalMessageId && !msg?.originalContent) return null;

      const original = messageById.get(String(msg.originalMessageId || ""));
      const content =
        msg.originalContent ||
        original?.content ||
        original?.text ||
        (original?.fileUrl ? "Tệp đính kèm" : "Tin nhắn");
      const senderName =
        original?.senderName ||
        original?.sender?.username ||
        (Number(msg.originalSenderId) === Number(currentUserId)
          ? "Bạn"
          : "Tin nhắn");

      return { content, senderName };
    };

    const buildReplyTarget = (msg, senderName) => ({
      id: msg?._id || msg?.id,
      senderId: msg?.senderId || msg?.sender?._id || msg?.sender || msg?.userId,
      senderName,
      content:
        msg?.content ||
        msg?.text ||
        msg?.originalContent ||
        (msg?.fileUrl ? "Tệp đính kèm" : "Tin nhắn"),
    });

    // ================= RENDER =================
    return (
      <div className="h-full w-full relative overflow-hidden bg-[#0f172a]">
        {/* BACKGROUND IMAGE */}
        {backgroundImageUrl && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `url("${backgroundImageUrl}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              zIndex: 0,
            }}
          />
        )}

        {/* DARK OVERLAY */}
        {backgroundImageUrl && (
          <div
            className="absolute inset-0 pointer-events-none bg-[#0f172a]/20"
            style={{
              zIndex: 1,
            }}
          />
        )}

        {/* CONTENT SCROLL */}
        <div
          ref={scrollBoxRef}
          onScroll={(e) => {
            previousScrollTopRef.current = e.currentTarget.scrollTop;
          }}
          className="relative z-10 h-full overflow-y-auto p-4 pt-4"
        >
          <div className="space-y-4 min-h-full">
            {showSearch && (
              <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-3 border-b border-slate-700/70 bg-[#111827]/95 px-5 py-3 shadow-xl backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <input
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    placeholder="Tìm trong cuộc trò chuyện..."
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none"
                  />

                  <button
                    onClick={jumpPrev}
                    disabled={matchIndexes.length === 0}
                    className="px-2.5 py-2 rounded-lg bg-slate-800 text-slate-200 disabled:opacity-40"
                  >
                    ↑
                  </button>

                  <button
                    onClick={jumpNext}
                    disabled={matchIndexes.length === 0}
                    className="px-2.5 py-2 rounded-lg bg-slate-800 text-slate-200 disabled:opacity-40"
                  >
                    ↓
                  </button>

                  <button
                    onClick={onCloseSearch}
                    className="px-2.5 py-2 rounded-lg bg-slate-800 text-slate-300"
                  >
                    ✕
                  </button>
                </div>

                <div className="text-xs text-slate-400 mt-1">
                  {matchIndexes.length === 0
                    ? "Không có kết quả"
                    : `Kết quả: ${activeMatchPos + 1}/${matchIndexes.length}`}
                </div>
              </div>
            )}

            {visibleMessages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-500 italic">
                Bắt đầu cuộc trò chuyện...
              </div>
            ) : (
              visibleMessages.map((msg) => {
                const senderId =
                  msg.senderId || msg.sender?._id || msg.sender || msg.userId;

                const isMe = Number(senderId) === Number(currentUserId);
                const isBot = Number(senderId) === 0;
                const messageId = msg._id || msg.id;

                if (msg.type === "SYSTEM") {
                  return (
                    <div
                      id={`msg-${messageId}`}
                      key={messageId}
                      ref={(node) => {
                        if (node) messageRefs.current[messageId] = node;
                      }}
                      className="flex justify-center"
                    >
                      <div className="max-w-[80%] px-4 py-1.5 rounded-full bg-black/25 text-white/90 text-xs text-center backdrop-blur-sm shadow-sm">
                        {msg.content}
                      </div>
                    </div>
                  );
                }

                const isGroupMessage = String(msg.roomId || "").startsWith(
                  "group_"
                );

                const showSenderAvatar = !isMe && !isBot;
                const showSenderName = isGroupMessage && !isMe && !isBot;

                const senderName =
                  msg.senderName ||
                  msg.sender?.username ||
                  msg.username ||
                  "Người dùng";

                const senderAvatar =
                  msg.senderAvatar || msg.sender?.avatar || msg.avatar || null;

                const replyPreview = getReplyPreview(msg);

                return (
                  <div
                    id={`msg-${messageId}`}
                    key={messageId}
                    ref={(node) => {
                      if (node) messageRefs.current[messageId] = node;
                    }}
                    onMouseEnter={() => setHoveredMessageId(messageId)}
                    onMouseLeave={() => {
                      setHoveredMessageId(null);
                      closeReactionPickerLater();
                    }}
                    className={`flex ${
                      isBot
                        ? "justify-center"
                        : isMe
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`flex gap-2 ${
                        isBot
                          ? "justify-center"
                          : isMe
                          ? "justify-end"
                          : "justify-start"
                      } ${isBot ? "max-w-[90%]" : "max-w-[78%]"}`}
                    >
                      {/* AVATAR NGƯỜI GỬI */}
                      {showSenderAvatar && (
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenUserProfile?.({
                              id: senderId,
                              username: senderName,
                              avatar: senderAvatar,
                            });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              onOpenUserProfile?.({
                                id: senderId,
                                username: senderName,
                                avatar: senderAvatar,
                              });
                            }
                          }}
                          className={`w-8 h-8 rounded-full overflow-hidden bg-slate-600 flex-shrink-0 ${
                            showSenderName ? "mt-5" : "mt-1"
                          } cursor-pointer hover:ring-2 hover:ring-blue-400 transition`}
                        >
                          {senderAvatar ? (
                            <img
                              src={getAvatarUrl(senderAvatar)}
                              alt={senderName}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            renderAvatarFallback(senderName)
                          )}
                        </div>
                      )}

                      <div
                        className={`flex flex-col ${
                          isBot
                            ? "items-center"
                            : isMe
                            ? "items-end"
                            : "items-start"
                        }`}
                      >
                        {/* TÊN NGƯỜI GỬI - CHỈ HIỆN TRONG GROUP */}
                        {showSenderName && (
                          <div className="text-[12px] text-slate-300 font-medium mb-1 ml-1 drop-shadow">
                            {senderName}
                          </div>
                        )}

                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          className="relative group pb-5"
                        >
                          {/* MESSAGE */}
                          <div
                            className={`relative px-4 py-2 shadow-md ${
                              isBot
                                ? "bg-emerald-950/80 border border-emerald-700/50 text-emerald-50 rounded-2xl"
                                : isMe
                                ? "bg-indigo-600 text-white rounded-2xl rounded-tr-none"
                                : "bg-slate-700/95 text-slate-100 rounded-2xl rounded-tl-none"
                            }`}
                          >
                            {msg.pinned && (
                              <span
                                className={`absolute -top-2 ${
                                  isMe ? "-left-2" : "-right-2"
                                } w-6 h-6 rounded-full bg-amber-400 text-white text-xs flex items-center justify-center shadow-md`}
                                title="Tin nhắn đã ghim"
                              >
                                📌
                              </span>
                            )}
                            {isBot && (
                              <div className="text-[10px] uppercase tracking-wide text-emerald-400/90 mb-1 font-medium">
                                Trợ lý AI
                              </div>
                            )}

                            {!msg.isRecalled && replyPreview && (
                              <div
                                className={`mb-2 rounded-lg border-l-4 px-3 py-2 ${
                                  isMe
                                    ? "bg-indigo-900/35 border-blue-300"
                                    : "bg-slate-900/45 border-blue-400"
                                }`}
                              >
                                <div className="text-[13px] font-semibold text-slate-100 truncate">
                                  {replyPreview.senderName}
                                </div>
                                <div className="text-[13px] text-slate-300 line-clamp-2 break-words">
                                  {replyPreview.content}
                                </div>
                              </div>
                            )}

                            {msg.isRecalled ? (
                              <p className="italic text-slate-400">
                                {isMe
                                  ? "Bạn đã thu hồi tin nhắn"
                                  : "Tin nhắn đã được thu hồi"}
                              </p>
                            ) : msg.type === "POLL" ? (
                              <PollMessageCard
                                pollId={msg.pollId}
                                currentUserId={currentUserId}
                                pollRealtime={pollRealtimeMap?.[msg.pollId]}
                              />
                            ) : msg.type === "CALL" ? (
                              (() => {
                                const content = String(msg.content || "");

                                const rawStatus = String(
                                  msg.callStatus || ""
                                ).toUpperCase();

                                const isMissed =
                                  rawStatus === "MISSED" ||
                                  content.includes("Cuộc gọi nhỡ") ||
                                  content.includes("Không trả lời");

                                const isRejected =
                                  rawStatus === "REJECTED" ||
                                  content.toLowerCase().includes("từ chối") ||
                                  content.toLowerCase().includes("bị từ chối");

                                const isEnded =
                                  rawStatus === "ENDED" ||
                                  content.includes("Cuộc gọi thoại đi") ||
                                  content.includes("Cuộc gọi thoại đến");

                                const durationText =
                                  msg.callDuration ||
                                  content.split("·")?.[1]?.trim() ||
                                  "0 phút 0 giây";

                                const title = isMissed
                                  ? isMe
                                    ? "Cuộc gọi thoại đi"
                                    : "Cuộc gọi nhỡ"
                                  : isRejected
                                  ? "Cuộc gọi bị từ chối"
                                  : content.includes("Cuộc gọi thoại đến")
                                  ? "Cuộc gọi thoại đến"
                                  : "Cuộc gọi thoại đi";

                                const subText = isEnded
                                  ? durationText
                                  : "Không trả lời";

                                return (
                                  <div className="w-[210px] rounded-xl bg-blue-950/70 border border-blue-800/60 px-3 py-3">
                                    <div className="text-sm font-semibold text-slate-100">
                                      {title}
                                    </div>

                                    <div className="flex items-center gap-2 mt-2 text-slate-300 text-sm">
                                      <span>
                                        {isMissed
                                          ? "📞"
                                          : isRejected
                                          ? "📵"
                                          : "📱"}
                                      </span>

                                      <span>{subText}</span>
                                    </div>

                                    <div className="h-px bg-blue-800/60 my-2" />

                                    <button
                                      type="button"
                                      className="text-blue-300 text-sm font-medium hover:text-blue-200"
                                    >
                                      Gọi lại
                                    </button>
                                  </div>
                                );
                              })()
                            ) : msg.type === "FILE" ? (
                              isImageFile(msg.fileUrl) ? (
                                <img
                                  src={getFileUrl(msg.fileUrl)}
                                  alt="file"
                                  className="w-40 rounded-lg"
                                />
                              ) : isPdfFile(msg.fileUrl) ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewPdf(getFileUrl(msg.fileUrl));
                                  }}
                                  className="flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-lg hover:bg-slate-700"
                                >
                                  📕 {String(msg.fileUrl).split("/").pop()}
                                </button>
                              ) : (
                                <a
                                  href={getFileUrl(msg.fileUrl)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-lg hover:bg-slate-700"
                                >
                                  📎 {String(msg.fileUrl).split("/").pop()}
                                </a>
                              )
                            ) : msg.type === "FORWARD" ? (
                              <div className="text-sm">
                                <div
                                  className={`text-xs mb-1 ${
                                    isMe
                                      ? "text-indigo-100/80"
                                      : "text-slate-300"
                                  }`}
                                >
                                  Chuyển tiếp
                                </div>

                                {msg.fileUrl ? (
                                  isImageFile(msg.fileUrl) ? (
                                    <img
                                      src={getFileUrl(msg.fileUrl)}
                                      alt="forward-file"
                                      className="w-40 rounded-lg"
                                    />
                                  ) : (
                                    <a
                                      href={getFileUrl(msg.fileUrl)}
                                      target="_blank"
                                      rel="noreferrer"
                                      className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                                        isMe
                                          ? "bg-indigo-700/50 text-white"
                                          : "bg-slate-600 text-slate-100"
                                      }`}
                                    >
                                      📎 {String(msg.fileUrl).split("/").pop()}
                                    </a>
                                  )
                                ) : (
                                  <div
                                    className={`px-3 py-2 rounded-lg break-words ${
                                      isMe
                                        ? "bg-indigo-700/50 text-white"
                                        : "bg-slate-600 text-slate-100"
                                    }`}
                                  >
                                    {renderHighlightedText(
                                      msg.originalContent ||
                                        msg.content ||
                                        msg.text ||
                                        "Tin nhắn"
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-[15px] break-words">
                                {renderHighlightedText(msg.content || msg.text)}
                              </p>
                            )}
                          </div>

                          {/* HOVER ACTIONS GIỐNG ZALO */}
                          {!msg.isRecalled &&
                            !isBot &&
                            hoveredMessageId === messageId && (
                              <div
                                className={`absolute top-1/2 -translate-y-1/2 z-[80] flex items-center gap-2 ${
                                  isMe ? "right-full mr-2" : "left-full ml-2"
                                }`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {/* LIKE NHỎ */}
                                <div
                                  className="relative"
                                  onMouseEnter={() =>
                                    openReactionPicker(messageId)
                                  }
                                  onMouseLeave={closeReactionPickerLater}
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReactMessage(messageId, "👍");
                                    }}
                                    className="w-9 h-9 rounded-full bg-white text-slate-600 shadow-md border border-slate-200 flex items-center justify-center hover:bg-slate-50"
                                    title="Thả cảm xúc"
                                  >
                                    👍
                                  </button>

                                  {/* EMOJI PICKER */}
                                  {reactionPickerId === messageId && (
                                    <div
                                      className={`absolute bottom-full mb-1 flex items-center gap-1 rounded-full bg-white px-3 py-2 shadow-xl border border-slate-200 z-[100] ${
                                        isMe ? "right-0" : "left-0"
                                      }`}
                                      onMouseEnter={() =>
                                        openReactionPicker(messageId)
                                      }
                                      onMouseLeave={closeReactionPickerLater}
                                    >
                                      {/* Cầu nối vô hình để rê chuột từ nút like lên picker không bị mất */}
                                      <div className="absolute -bottom-3 left-0 right-0 h-3 bg-transparent" />

                                      {REACTION_EMOJIS.map((emoji) => (
                                        <button
                                          key={emoji}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleReactMessage(
                                              messageId,
                                              emoji
                                            );
                                            setReactionPickerId(null);
                                          }}
                                          className="w-9 h-9 rounded-full hover:bg-slate-100 text-xl transition hover:scale-125"
                                          title={`Thả ${emoji}`}
                                        >
                                          {emoji}
                                        </button>
                                      ))}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleClearReactions(messageId);
                                          setReactionPickerId(null);
                                        }}
                                        className="w-9 h-9 rounded-full hover:bg-red-50 text-slate-500 hover:text-red-500 text-xl transition hover:scale-125 flex items-center justify-center"
                                        title="Xoá cảm xúc của bạn"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* CHUYỂN TIẾP NHANH */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onReplyMessage?.(
                                      buildReplyTarget(msg, senderName)
                                    );
                                  }}
                                  className="w-9 h-9 rounded-full bg-white text-blue-600 shadow-md border border-slate-200 flex items-center justify-center hover:bg-slate-50"
                                  title="Trả lời"
                                >
                                  ”
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onForwardMessage?.(msg);
                                  }}
                                  className="w-9 h-9 rounded-full bg-white text-slate-600 shadow-md border border-slate-200 flex items-center justify-center hover:bg-slate-50"
                                  title="Chuyển tiếp"
                                >
                                  ↪
                                </button>

                                {/* BA CHẤM */}
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setMenuMessageId((prev) =>
                                        prev === messageId ? null : messageId
                                      );
                                    }}
                                    className="w-9 h-9 rounded-full bg-white text-slate-600 shadow-md border border-slate-200 flex items-center justify-center hover:bg-slate-50"
                                    title="Thêm"
                                  >
                                    ...
                                  </button>

                                  {menuMessageId === messageId && (
                                    <div
                                      className={`absolute top-full mt-2 w-40 rounded-xl bg-white text-slate-800 shadow-xl border border-slate-200 overflow-hidden ${
                                        isMe ? "right-0" : "left-0"
                                      }`}
                                    >
                                      {msg.pinned ? (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onUnpinMessage?.(messageId);
                                            setMenuMessageId(null);
                                          }}
                                          className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50"
                                        >
                                          Bỏ ghim
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onPinMessage?.(messageId);
                                            setMenuMessageId(null);
                                          }}
                                          className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50"
                                        >
                                          📌 Ghim tin nhắn
                                        </button>
                                      )}

                                      {isMe && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRecallMessage(messageId);
                                            setMenuMessageId(null);
                                          }}
                                          className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50"
                                        >
                                          Thu hồi
                                        </button>
                                      )}

                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteMessage(messageId);
                                          setMenuMessageId(null);
                                        }}
                                        className="w-full px-4 py-2.5 text-left text-sm text-red-500 hover:bg-red-50"
                                      >
                                        Xoá
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                          {/* REACTIONS */}
                          {renderReactions(msg.reactions, messageId, isMe)}
                        </div>

                        {/* TIME */}
                        {(msg.createdAt || msg.time) && (
                          <span className="text-[10px] text-slate-400 mt-1 px-1 drop-shadow">
                            {msg.createdAt
                              ? new Date(msg.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : msg.time}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            <div ref={messagesEndRef} className="h-1 w-full" />
          </div>
        </div>

        {/* PDF PREVIEW */}
        {previewPdf && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[999]">
            <div className="bg-slate-900 rounded-xl w-[80%] h-[80%] relative">
              <button
                onClick={() => setPreviewPdf(null)}
                className="absolute top-2 right-2 text-white bg-red-500 px-3 py-1 rounded"
              >
                ✕
              </button>

              <iframe
                src={previewPdf}
                title="PDF Preview"
                className="w-full h-full rounded-xl"
              />
            </div>
          </div>
        )}

        
      </div>
    );
  }
);

export default ChatBox;
