package com.chatapp.dto;

import jakarta.validation.constraints.NotBlank;

public class LockAppealRequest {

    @NotBlank(message = "Số điện thoại không được để trống")
    private String phone;

    @NotBlank(message = "Nội dung phản hồi không được để trống")
    private String message;

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
