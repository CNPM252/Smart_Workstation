package com.hcmut.backend.event;

import com.hcmut.backend.model.Device;
import com.hcmut.backend.model.EventLog;
import com.hcmut.backend.repository.DeviceRepository;
import com.hcmut.backend.repository.EventLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class SystemEventListener {

    private final EventLogRepository eventLogRepository;
    private final DeviceRepository deviceRepository;

    @Async
    @EventListener
    @Transactional
    public void handleSystemEvent(SystemEvent event) {
        EventLog log = new EventLog();
        log.setActedByUser(event.getActedByUser());
        log.setEventType(event.getEventType());
        log.setDescription(event.getDescription());

        if (event.getMacAddress() != null && !event.getMacAddress().isEmpty()) {
            Device device = deviceRepository.findById(event.getMacAddress()).orElse(null);
            log.setDevice(device);
        }

        eventLogRepository.save(log);
    }
}