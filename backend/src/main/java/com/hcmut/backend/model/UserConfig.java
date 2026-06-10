package com.hcmut.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.util.UUID;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;


@Data
@Entity
@Table(name = "userconfigs")
public class UserConfig {

    @Id
    private UUID userId;

    @OneToOne
    @MapsId
    @JoinColumn(name = "user_id")
    private User user;





    @JsonProperty("autoDimEnabled")
    @Column(name = "auto_dim_enabled" ,columnDefinition = "boolean default true")
    private Boolean autoDimEnabled = true;

    @JsonProperty("autoSleepEnabled")
    @Column(name = "auto_sleep_enabled", columnDefinition = "boolean default true")
    private Boolean autoSleepEnabled = true;

    private Integer manualLightLevel;

    @Column(columnDefinition = "integer default 3")
    @Max(value = 60, message = "Sleep timeout cannot exceed 60 minutes")
    private Integer sleepTimeoutMins = 3;

    @Min(value = 20, message = "Min distance must be >= 20")
    private Integer distanceThresholdMin;

    @Max(value = 200, message = "Max distance must be <= 200")
    private Integer distanceThresholdMax;
    
}
