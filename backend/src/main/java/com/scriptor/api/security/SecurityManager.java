package com.scriptor.api.security;

import lombok.extern.slf4j.Slf4j;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.security.Security;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.Set;
import java.util.Base64;

/**
 * Service responsable de la sécurité et du chiffrement des données sensibles.
 * Utilise AES-256 en mode GCM avec le provider Bouncy Castle.
 */
@Slf4j
@Service
public class SecurityManager {

    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int TAG_LENGTH_BIT = 128;
    private static final int IV_LENGTH_BYTE = 12;
    private static final int AES_KEY_SIZE = 256;

    private final SecretKey secretKey;
    private final SecureRandom secureRandom;

    public SecurityManager(@Value("${scriptor.config.dir:./config}") String configDir) {
        // Enregistrement de Bouncy Castle comme fournisseur de sécurité cryptographique
        Security.addProvider(new BouncyCastleProvider());
        this.secureRandom = new SecureRandom();
        
        try {
            Path keyPath = Paths.get(configDir, ".master.key");
            
            if (Files.exists(keyPath)) {
                // Chargement de la clé maître persistante
                byte[] decodedKey = Base64.getDecoder().decode(Files.readAllBytes(keyPath));
                this.secretKey = new SecretKeySpec(decodedKey, 0, decodedKey.length, "AES");
                log.info("SecurityManager : Clé maître AES-256 chargée avec succès depuis le stockage local.");
            } else {
                // Premier lancement : Génération et sauvegarde de la nouvelle clé
                KeyGenerator keyGen = KeyGenerator.getInstance("AES", BouncyCastleProvider.PROVIDER_NAME);
                keyGen.init(AES_KEY_SIZE, this.secureRandom);
                this.secretKey = keyGen.generateKey();
                
                if (!Files.exists(keyPath.getParent())) Files.createDirectories(keyPath.getParent());
                Files.write(keyPath, Base64.getEncoder().encode(this.secretKey.getEncoded()));
                secureKeyFilePermissions(keyPath);
                log.info("SecurityManager : Nouvelle clé maître AES-256 générée et sauvegardée.");
            }
        } catch (Exception e) {
            log.error("Erreur critique lors de l'initialisation de la clé AES-256.", e);
            throw new RuntimeException("Impossible d'initialiser le SecurityManager", e);
        }
    }

    /**
     * Chiffre une clé API en AES-256 GCM avant son stockage local.
     *
     * @param plainApiKey La clé API en clair.
     * @return La clé chiffrée encodée en Base64 (incluant le vecteur d'initialisation).
     */
    public String encryptApiKey(String plainApiKey) {
        if (plainApiKey == null || plainApiKey.isBlank()) {
            return null;
        }

        try {
            // 1. Génération d'un vecteur d'initialisation (IV) unique pour chaque chiffrement
            byte[] iv = new byte[IV_LENGTH_BYTE];
            secureRandom.nextBytes(iv);

            // 2. Initialisation du Cipher en mode chiffrement
            Cipher cipher = Cipher.getInstance(ALGORITHM, BouncyCastleProvider.PROVIDER_NAME);
            GCMParameterSpec ivSpec = new GCMParameterSpec(TAG_LENGTH_BIT, iv);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, ivSpec);

            // 3. Chiffrement
            byte[] cipherText = cipher.doFinal(plainApiKey.getBytes(StandardCharsets.UTF_8));

            // 4. Concaténation de l'IV et du message chiffré (l'IV est nécessaire pour le déchiffrement)
            byte[] encryptedData = new byte[iv.length + cipherText.length];
            System.arraycopy(iv, 0, encryptedData, 0, iv.length);
            System.arraycopy(cipherText, 0, encryptedData, iv.length, cipherText.length);

            return Base64.getEncoder().encodeToString(encryptedData);

        } catch (Exception e) {
            // Log sécurisé : on ne loggue JAMAIS la clé en clair, uniquement sa longueur pour le debug
            log.error("Échec du chiffrement de la clé API (longueur fournie: {} caractères).", plainApiKey.length());
            throw new RuntimeException("Erreur lors du chiffrement de la clé API.");
        }
    }

    /**
     * Déchiffre une clé API préalablement chiffrée et encodée en Base64.
     *
     * @param encryptedApiKey La chaîne chiffrée (Base64).
     * @return La clé API en clair prête à être injectée dans le LLMProvider.
     */
    public String decryptApiKey(String encryptedApiKey) {
        if (encryptedApiKey == null || encryptedApiKey.isBlank()) {
            return null;
        }

        try {
            byte[] decodedData = Base64.getDecoder().decode(encryptedApiKey);

            // 1. Extraction de l'IV (les 12 premiers octets)
            byte[] iv = new byte[IV_LENGTH_BYTE];
            System.arraycopy(decodedData, 0, iv, 0, iv.length);
            GCMParameterSpec ivSpec = new GCMParameterSpec(TAG_LENGTH_BIT, iv);

            // 2. Extraction du message chiffré
            byte[] cipherText = new byte[decodedData.length - IV_LENGTH_BYTE];
            System.arraycopy(decodedData, IV_LENGTH_BYTE, cipherText, 0, cipherText.length);

            // 3. Déchiffrement
            Cipher cipher = Cipher.getInstance(ALGORITHM, BouncyCastleProvider.PROVIDER_NAME);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, ivSpec);

            byte[] plainText = cipher.doFinal(cipherText);
            return new String(plainText, StandardCharsets.UTF_8);

        } catch (Exception e) {
            // Log sécurisé : on évite de logguer le payload corrompu qui pourrait fuiter dans les logs
            log.error("Échec du déchiffrement de la clé API. Les données sont corrompues ou la clé maître a changé.");
            throw new RuntimeException("Erreur lors du déchiffrement de la clé API.");
        }
    }

    private void secureKeyFilePermissions(Path keyPath) {
        try {
            var view = Files.getFileAttributeView(
                    keyPath,
                    java.nio.file.attribute.PosixFileAttributeView.class
            );
            if (view != null) {
                Set<PosixFilePermission> ownerOnly = PosixFilePermissions.fromString("rw-------");
                Files.setPosixFilePermissions(keyPath, ownerOnly);
                return;
            }
            // Fallback Windows/ACL indisponible : limiter via API File.
            File file = keyPath.toFile();
            file.setReadable(false, false);
            file.setWritable(false, false);
            file.setExecutable(false, false);
            file.setReadable(true, true);
            file.setWritable(true, true);
        } catch (Exception e) {
            log.warn("Impossible de durcir les permissions du fichier clé maître: {}", keyPath, e);
        }
    }
}
