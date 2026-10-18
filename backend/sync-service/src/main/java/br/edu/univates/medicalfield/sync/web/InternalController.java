package br.edu.univates.medicalfield.sync.web;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class InternalController {
    @GetMapping("/internal/health")
    public Map<String, String> health() { return Map.of("status", "ok", "service", "sync-service"); }
}

