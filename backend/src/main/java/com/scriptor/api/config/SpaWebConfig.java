package com.scriptor.api.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

import java.io.IOException;

/**
 * Sert le frontend Vite (build dans classpath:/static/) et renvoie index.html pour le routage SPA.
 * Les routes {@code /api/**} restent gérées par les contrôleurs (priorité plus haute).
 * Désactivable pour les tests ({@code scriptor.spa.enabled=false}).
 */
@Configuration
@ConditionalOnProperty(name = "scriptor.spa.enabled", havingValue = "true", matchIfMissing = true)
public class SpaWebConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Priorité la plus basse : les @RestController (/api/**) doivent matcher avant le fallback SPA.
        registry.setOrder(Ordered.LOWEST_PRECEDENCE);
        registry
            .addResourceHandler("/**")
                .addResourceLocations("classpath:/static/")
                .resourceChain(true)
                .addResolver(new PathResourceResolver() {
                    @Override
                    protected Resource getResource(String resourcePath, Resource location) throws IOException {
                        if (resourcePath != null && resourcePath.startsWith("api/")) {
                            return null;
                        }
                        // Bloque explicitement les chemins sensibles et les dotfiles (/.env, /.git/config, ...).
                        if (resourcePath != null && (resourcePath.startsWith(".") || resourcePath.contains("/."))) {
                            return null;
                        }
                        if (resourcePath == null || resourcePath.isEmpty()) {
                            return new ClassPathResource("static/index.html");
                        }
                        Resource resource = location.createRelative(resourcePath);
                        if (resource.exists() && resource.isReadable()) {
                            return resource;
                        }
                        // Ne fallback pas vers index.html pour les chemins qui ressemblent à des fichiers
                        // (assets absents, .map, etc.) : on laisse Spring répondre 404.
                        if (resourcePath.contains(".")) {
                            return null;
                        }
                        return new ClassPathResource("static/index.html");
                    }
                });
    }
}
