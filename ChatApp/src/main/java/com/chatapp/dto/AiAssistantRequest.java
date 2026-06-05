package com.chatapp.dto;

import jakarta.validation.constraints.NotBlank;

public class AiAssistantRequest {

    @NotBlank(message = "Câu hỏi không được để trống")
    private String question;

    private String context;

    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
    }

    public String getContext() {
        return context;
    }

    public void setContext(String context) {
        this.context = context;
    }
}
