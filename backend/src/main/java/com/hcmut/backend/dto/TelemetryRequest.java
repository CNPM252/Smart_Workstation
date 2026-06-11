package com.hcmut.backend.dto;

import lombok.Data;

@Data
public class TelemetryRequest {
    private String macAddress;
    private String currentUserId;
    private Integer distance;
    private Integer light;
    private Boolean motion;
    private String status;

}
