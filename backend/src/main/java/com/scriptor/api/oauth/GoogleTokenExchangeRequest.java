package com.scriptor.api.oauth;

/**
 * Corps JSON attendu depuis le frontend pour l’échange code → jetons (proxy vers Google).
 */
public record GoogleTokenExchangeRequest(String code, String redirectUri, String codeVerifier) {}
