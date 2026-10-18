package br.edu.univates.medicalfield.sync.web;

import java.util.Map;
import java.util.UUID;

import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import br.edu.univates.medicalfield.sync.model.UploadRequest;
import br.edu.univates.medicalfield.sync.service.SyncService;

@RestController
@RequestMapping("/sync")
public class SyncController {
    private final SyncService service;
    public SyncController(SyncService service) { this.service = service; }

    @PostMapping("/upload")
    public Map<String, Object> upload(@Valid @RequestBody UploadRequest request,
                                      @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
                                      Authentication authentication) {
        Jwt jwt = (Jwt) authentication.getPrincipal();
        return service.upload(request, UUID.fromString(jwt.getClaimAsString("professional_id")), authorization);
    }

    @GetMapping("/download")
    public Map<String, Object> download(@RequestParam(defaultValue = "0") long cursor,
                                        @RequestParam(defaultValue = "200") int limit) {
        return service.download(Math.max(0, cursor), limit);
    }
}

