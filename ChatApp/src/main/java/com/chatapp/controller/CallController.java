package com.chatapp.controller;

import com.chatapp.dto.CallSignalDTO;
import com.chatapp.service.CallService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class CallController {

    private final CallService callService;

    @MessageMapping("/call.signal")
    public void callSignal(CallSignalDTO dto) {
        callService.handleSignal(dto);
    }
}