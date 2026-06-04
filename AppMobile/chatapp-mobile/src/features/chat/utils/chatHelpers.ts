export const normalizeData = (data: any) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.content)) return data.content;
  return [];
};

export const formatTime = (dateString: string) => {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const isImageFile = (url: string) => {
  const lower = String(url || "").toLowerCase();
  return (
    lower.includes(".png") ||
    lower.includes(".jpg") ||
    lower.includes(".jpeg") ||
    lower.includes(".webp") ||
    lower.includes(".gif")
  );
};

export const extractUploadedFileUrl = (uploadRes: any) => {
  let rawUrl =
    typeof uploadRes === "string"
      ? uploadRes
      : uploadRes?.fileUrl ||
        uploadRes?.url ||
        uploadRes?.data?.fileUrl ||
        uploadRes?.data?.url ||
        uploadRes?.result?.fileUrl ||
        uploadRes?.result?.url ||
        "";

  return normalizeMobileFileUrl(rawUrl);
};

export const normalizeMobileFileUrl = (url: string) => {
  const raw = String(url || "").trim();
  if (!raw) return "";

  if (raw.startsWith("/")) {
    return `http://10.0.2.2:8080${raw}`;
  }

  if (raw.includes("localhost:8080")) {
    return raw.replace("localhost:8080", "10.0.2.2:8080");
  }

  return raw;
};

export const getCurrentUserId = (user: any) => {
  return (
    user?.id ??
    user?.userId ??
    user?.data?.id ??
    user?.data?.userId ??
    null
  );
};

export const getReceiverIdFromRoom = (
  roomId: string,
  currentUserId: number | string
) => {
  if (!roomId || !currentUserId) return null;

  const parts = String(roomId).split("_");
  if (parts.length !== 2) return null;

  const a = Number(parts[0]);
  const b = Number(parts[1]);
  const me = Number(currentUserId);

  if (a === me) return b;
  if (b === me) return a;
  return null;
};

export const buildPayload = ({
  currentUserId,
  roomId,
  content,
  type,
  fileUrl,
  replyTo,
}: {
  currentUserId: number | string;
  roomId: string;
  content: string | null;
  type: string;
  fileUrl: string | null;
  replyTo?: any;
}) => {
  const receiverId = getReceiverIdFromRoom(roomId, currentUserId);

  return {
    senderId: Number(currentUserId),
    receiverId: receiverId ? Number(receiverId) : null,
    roomId: String(roomId),
    content,
    type,
    fileUrl,
    originalSenderId:
      replyTo?.senderId != null ? Number(replyTo.senderId) : null,
    originalContent:
      replyTo?.content ||
      replyTo?.text ||
      replyTo?.originalContent ||
      (replyTo?.fileUrl ? "Tệp đính kèm" : null),
    originalMessageId: replyTo?.id ? String(replyTo.id) : null,
  };
};
