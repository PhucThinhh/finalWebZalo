package com.chatapp.dto;

import jakarta.validation.constraints.NotBlank;

public class AiSuggestionRequest {

    @NotBlank(message = "Nội dung không được để trống")
    private String message;

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
