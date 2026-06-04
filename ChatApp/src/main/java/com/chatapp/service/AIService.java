package com.chatapp.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

@Service
public class AIService {

    @Value("${gemini.api.key}")
    private String apiKey;

    private final ObjectMapper mapper = new ObjectMapper();

    public String askAI(String message) {
        try {
            JsonNode root = callGemini(message);

            if (root.has("error")) {
                return "AI lỗi: " + root.path("error").path("message").asText();
            }

            JsonNode candidates = root.path("candidates");

            if (!candidates.isArray() || candidates.isEmpty()) {
                return "AI không có phản hồi";
            }

            return extractText(root);
        } catch (Exception e) {
            e.printStackTrace();
            return "AI lỗi rồi";
        }
    }

    public List<String> suggestMessageRewrites(String message) {
        String cleanMessage = message == null ? "" : message.trim();
        if (cleanMessage.isEmpty()) {
            return List.of();
        }

        String prompt = """
                Bạn là trợ lý viết tin nhắn tiếng Việt cho ứng dụng chat.
                Hãy viết lại câu sau thành 4 câu gợi ý có cùng ý nghĩa, tự nhiên hơn, phong phú hơn.
                Giữ đúng ý người dùng, không thêm thông tin mới, không dài dòng quá mức.
                Mỗi câu phải phù hợp để gửi trực tiếp trong chat.
                Chỉ trả về JSON array string, không markdown, không giải thích.

                Tin nhắn gốc: %s
                """.formatted(cleanMessage);

        try {
            String rawText = extractText(callGemini(prompt));
            return parseSuggestionList(rawText, cleanMessage);
        } catch (Exception e) {
            e.printStackTrace();
            return fallbackSuggestions(cleanMessage);
        }
    }

    public String answerWithContext(String question, String context) {
        String cleanQuestion = question == null ? "" : question.trim();
        String cleanContext = context == null ? "" : context.trim();

        if (cleanQuestion.isEmpty()) {
            return "Bạn hãy nhập câu hỏi để AI hỗ trợ.";
        }

        String prompt = """
                Bạn là trợ lý AI trong ứng dụng chat Zalo clone.
                Nhiệm vụ:
                - Trả lời bằng tiếng Việt tự nhiên, ngắn gọn, dễ hiểu.
                - Nếu câu hỏi liên quan đến dữ liệu tài khoản, bạn bè online, file, ảnh, link, hội thoại hoặc tin nhắn thì chỉ dựa trên CONTEXT được cung cấp.
                - Nếu context không có đủ dữ liệu, nói rõ là hiện tại app chưa có dữ liệu đó thay vì bịa.
                - Nếu người dùng hỏi kiến thức chung, hãy trả lời như một trợ lý AI bình thường.
                - Khi liệt kê file/ảnh/link, ưu tiên tên, thời gian, người gửi nếu context có.

                CONTEXT:
                %s

                CÂU HỎI:
                %s
                """.formatted(cleanContext.isEmpty() ? "Không có context từ app." : cleanContext, cleanQuestion);

        try {
            return extractText(callGemini(prompt)).trim();
        } catch (Exception e) {
            e.printStackTrace();
            return "AI chưa trả lời được lúc này. Bạn kiểm tra lại backend hoặc Gemini API key.";
        }
    }

    private JsonNode callGemini(String prompt) throws IOException {
        URL url = new URL(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey
        );

        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);

        ObjectNode body = mapper.createObjectNode();
        ArrayNode contents = body.putArray("contents");
        ObjectNode content = contents.addObject();
        ArrayNode parts = content.putArray("parts");
        parts.addObject().put("text", prompt);

        try (OutputStream os = conn.getOutputStream()) {
            os.write(mapper.writeValueAsBytes(body));
        }

        int status = conn.getResponseCode();
        InputStream is = status >= 200 && status < 300
                ? conn.getInputStream()
                : conn.getErrorStream();

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            StringBuilder response = new StringBuilder();
            String line;

            while ((line = reader.readLine()) != null) {
                response.append(line);
            }

            String json = response.toString();
            System.out.println("Gemini response: " + json);
            return mapper.readTree(json);
        }
    }

    private String extractText(JsonNode root) {
        if (root.has("error")) {
            throw new IllegalStateException(root.path("error").path("message").asText("AI error"));
        }

        JsonNode candidates = root.path("candidates");
        if (!candidates.isArray() || candidates.isEmpty()) {
            throw new IllegalStateException("AI không có phản hồi");
        }

        JsonNode parts = candidates.get(0).path("content").path("parts");
        if (!parts.isArray() || parts.isEmpty()) {
            throw new IllegalStateException("AI không trả lời");
        }

        return parts.get(0).path("text").asText("");
    }

    private List<String> parseSuggestionList(String rawText, String originalMessage) throws IOException {
        String text = rawText == null ? "" : rawText.trim();
        int start = text.indexOf('[');
        int end = text.lastIndexOf(']');

        if (start >= 0 && end > start) {
            text = text.substring(start, end + 1);
        }

        JsonNode node = mapper.readTree(text);
        List<String> suggestions = new ArrayList<>();

        if (node.isArray()) {
            for (JsonNode item : node) {
                String value = item.asText("").trim();
                if (!value.isEmpty() && !suggestions.contains(value)) {
                    suggestions.add(value);
                }
                if (suggestions.size() == 4) {
                    break;
                }
            }
        }

        return suggestions.isEmpty() ? fallbackSuggestions(originalMessage) : suggestions;
    }

    private List<String> fallbackSuggestions(String message) {
        String clean = message == null ? "" : message.trim();
        if (clean.isEmpty()) {
            return List.of();
        }

        return List.of(
                clean,
                "Ý mình là " + clean,
                "Mình muốn nói là " + clean,
                "Nói cách khác, " + clean
        );
    }
}
