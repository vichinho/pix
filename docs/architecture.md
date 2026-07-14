# Arquitectura

LoL Companion sigue una arquitectura **local-first** con capas limpias. El backend
local expone una API HTTP consumida por la UI (React/Electron en fases futuras).

## Capas

- **Domain** (`src/domain`): entidades y contratos (`ClientStatus`, `Role`,
  `ChampionBuild`, …). Sin dependencias de infraestructura.
- **Application** (`src/application`): casos de uso que coordinan dominio e
  infraestructura (p.ej. `GetClientStatusUseCase`).
- **Infrastructure** (`src/infrastructure`): acceso a la League Client API (LCU),
  Riot API (futuro), persistencia (futuro SQLite) y logging.
- **API** (`src/api`): servidor Express que traduce HTTP local ↔ casos de uso.

## Inyección de dependencias

`ClientDetector` recibe `loadCredentials` y `connectorFactory` por constructor, lo
que permite testear el flujo completo (fase del gameflow + summoner + tolerancia a
fallos) sin un cliente de LoL real, usando un conector falso.

## Contratos de la API local

| Método | Ruta | Estado |
|---|---|---|
| GET | `/api/health` | ✅ |
| GET | `/api/client/status` | ✅ |
| GET | `/api/player/profile` | 🚧 501 |
| GET | `/api/player/matches` | 🚧 501 |
| GET | `/api/champ-select/session` | ✅ |
| GET | `/api/game/queue` | ✅ |
| GET | `/api/recommendations?role=TOP` | ✅ |
| GET | `/api/aram/analysis` | ✅ |
| GET | `/api/builds?championId=24&role=TOP` | 🚧 501 |
| GET · PUT | `/api/settings` | 🚧 501 |

## Decisiones (ADR resumidas)

- **ADR-001** Producto: app de escritorio con UI web local (el acceso al LCU es local).
- **ADR-002** DB: SQLite para el MVP.
- **ADR-003** Lenguaje: TypeScript end-to-end.
- **ADR-004** Recomendación: reglas determinísticas simples primero.

## Seguridad

- La `RIOT_API_KEY` vive sólo en el proceso backend (variables de entorno), nunca
  en el frontend.
- La conexión al LCU es siempre a `127.0.0.1` con credenciales locales efímeras del
  lockfile; la verificación TLS se relaja únicamente para ese agente loopback.
