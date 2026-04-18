# Image unique : build frontend (Vite) + backend (Spring Boot) via Maven, puis JAR exécutable.
# À lancer depuis la racine du dépôt (dossiers scriptor/, backend/, config/ présents).

FROM eclipse-temurin:21-jdk-jammy AS build
WORKDIR /w

COPY scriptor/package.json scriptor/package-lock.json ./scriptor/
COPY backend/pom.xml ./backend/

COPY scriptor ./scriptor
COPY backend ./backend
COPY config ./config

RUN apt-get update \
    && apt-get install -y --no-install-recommends maven ca-certificates \
    && cd backend && mvn -q -DskipTests package \
    && apt-get purge -y maven \
    && rm -rf /var/lib/apt/lists/*

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

COPY --from=build /w/backend/target/scriptor.jar /app/scriptor.jar
COPY config /app/config

ENV SCR_CONFIG_DIR=/app/config
ENV SCR_DATA_DIR=/app/config/data
ENV SCR_SQLITE_PATH=/app/config/data/scriptor.db

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/scriptor.jar"]
