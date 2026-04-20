package com.scriptor.api.config;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import jakarta.validation.ConstraintViolationException;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.async.AsyncRequestTimeoutException;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.LocalDateTime;
import java.util.stream.Collectors;

/**
 * Gestionnaire centralisé des exceptions pour toute l'API.
 * Assure que le Frontend reçoit toujours un JSON standardisé, même en cas de crash brutal du Backend.
 * Facilite grandement la maintenance et le débogage.
 */
@Slf4j
@RestControllerAdvice
@Order(1)
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleMethodArgumentNotValid(MethodArgumentNotValidException ex, WebRequest request) {
        String details = ex.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(this::formatFieldError)
                .collect(Collectors.joining("; "));
        ErrorResponse body = buildError(
                HttpStatus.BAD_REQUEST,
                details.isBlank() ? "Requête invalide" : details,
                request
        );
        return new ResponseEntity<>(body, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handleConstraintViolation(ConstraintViolationException ex, WebRequest request) {
        String details = ex.getConstraintViolations()
                .stream()
                .map(v -> v.getPropertyPath() + ": " + v.getMessage())
                .collect(Collectors.joining("; "));
        ErrorResponse body = buildError(
                HttpStatus.BAD_REQUEST,
                details.isBlank() ? "Paramètre de requête invalide" : details,
                request
        );
        return new ResponseEntity<>(body, HttpStatus.BAD_REQUEST);
    }

    /**
     * Spring Boot 3.2+ : chemins non résolus (ex. confondus avec des fichiers statiques) lèvent cette
     * exception. Sans handler dédié, {@link #handleAllExceptions} la transforme abusivement en HTTP 500.
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNoResource(NoResourceFoundException ex, WebRequest request) {
        log.debug("Ressource introuvable : {}", ex.getMessage());
        ErrorResponse body = new ErrorResponse();
        body.setTimestamp(LocalDateTime.now().toString());
        body.setStatus(HttpStatus.NOT_FOUND.value());
        body.setError("Non trouvé");
        body.setMessage(ex.getMessage() != null ? ex.getMessage() : "Ressource introuvable");
        body.setPath(request.getDescription(false).replace("uri=", ""));
        return new ResponseEntity<>(body, HttpStatus.NOT_FOUND);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ErrorResponse> handleResponseStatus(ResponseStatusException ex, WebRequest request) {
        HttpStatus status = HttpStatus.resolve(ex.getStatusCode().value());
        if (status == null) status = HttpStatus.INTERNAL_SERVER_ERROR;
        ErrorResponse body = buildError(
                status,
                ex.getReason() != null ? ex.getReason() : status.getReasonPhrase(),
                request
        );
        return new ResponseEntity<>(body, status);
    }

    @ExceptionHandler(AsyncRequestTimeoutException.class)
    public ResponseEntity<ErrorResponse> handleAsyncTimeout(AsyncRequestTimeoutException ex, WebRequest request) {
        log.warn("Timeout async sur la route {}", request.getDescription(false));

        ErrorResponse body = buildError(
                HttpStatus.GATEWAY_TIMEOUT,
                "L'IA met trop de temps à répondre (timeout). Essayez un modèle plus léger ou réessayez dans quelques secondes.",
                request
        );

        return new ResponseEntity<>(body, HttpStatus.GATEWAY_TIMEOUT);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleAllExceptions(Exception ex, WebRequest request) {
        // 1. On trace l'erreur dans les logs (console + fichier scriptor-ia.log)
        log.error("Erreur non gérée interceptée sur la route {} : {}", request.getDescription(false), ex.getMessage(), ex);

        // 2. On construit une réponse JSON propre et sécurisée (on ne renvoie pas la StackTrace au client)
        ErrorResponse errorResponse = new ErrorResponse();
        errorResponse.setTimestamp(LocalDateTime.now().toString());
        errorResponse.setStatus(HttpStatus.INTERNAL_SERVER_ERROR.value());
        errorResponse.setError("Erreur Interne du Serveur Scriptor");
        
        // On récupère le message de notre RuntimeException s'il existe, sinon message générique
        String message = ex.getMessage() != null ? ex.getMessage() : "Une erreur technique inattendue est survenue.";
        // Sécurité : masquer les erreurs internes complexes
        if (message.contains("NullPointerException")) message = "Une donnée requise est manquante pour cette opération.";
        
        errorResponse.setMessage(message);
        errorResponse.setPath(request.getDescription(false).replace("uri=", ""));

        return new ResponseEntity<>(errorResponse, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    private ErrorResponse buildError(HttpStatus status, String message, WebRequest request) {
        ErrorResponse body = new ErrorResponse();
        body.setTimestamp(LocalDateTime.now().toString());
        body.setStatus(status.value());
        body.setError(status.getReasonPhrase());
        body.setMessage(message);
        body.setPath(request.getDescription(false).replace("uri=", ""));
        return body;
    }

    private String formatFieldError(FieldError err) {
        return err.getField() + ": " + err.getDefaultMessage();
    }

    @Data
    public static class ErrorResponse {
        private String timestamp;
        private int status;
        private String error;
        private String message;
        private String path;
    }
}
