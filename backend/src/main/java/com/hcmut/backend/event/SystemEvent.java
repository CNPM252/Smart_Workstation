package com.hcmut.backend.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class SystemEvent extends ApplicationEvent {
    private final String actedByUser;
    private final String eventType;
    private final String description; // chuỗi JSON
    private final String macAddress;  // null nếu không có thiết bị

    public SystemEvent(Object source, String actedByUser, String eventType, String description, String macAddress) {
        super(source);
        this.actedByUser = actedByUser;
        this.eventType = eventType;
        this.description = description;
        this.macAddress = macAddress;
    }
}