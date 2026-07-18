# PIX

Companion app personal para **League of Legends**. Detecta el estado del cliente,
muestra perfil e historial reciente y asiste durante champion select con
recomendaciones de campeones y builds por línea.

Este repositorio contiene el **núcleo backend** del proyecto (Fase 0 → Fase 1 de la
[especificación](docs/architecture.md)). El primer módulo implementado por completo
es la **detección del cliente** (LCU), con contratos tipados, API local y tests.

> **Aviso legal:** PIX es un proyecto personal **no oficial**. No está
> afiliado, asociado, autorizado ni patrocinado por Riot Games. League of Legends
> y Riot Games son marcas registradas de Riot Games, Inc. La app es una herramienta
> de apoyo visual y consulta: no lee memoria del juego, no inyecta código, no
> automatiza decisiones ni acciones dentro de la partida.

## Estado actual

| Módulo | Estado |
|---|---|
| Detección del cliente (LCU lockfile + gameflow phase) | ✅ Implementado |
| API local (`/api/client/status`) | ✅ Implementado |
| Champion select (rol asignado, campeón elegido, bans) | ✅ Implementado |
| Tipo de partida (casual/normal/ranked/flex/práctica/…) | ✅ Implementado |
| Recomendaciones de campeones por rol (reglas) | ✅ Implementado |
| Recomendaciones personalizadas por historial | ✅ Implementado |
| Estadísticas de rendimiento reciente (winrate/KDA) | ✅ Implementado |
| Análisis de composición ARAM + mejor opción de banca | ✅ Implementado |
| Perfil e historial de partidas (Riot API) | ✅ Implementado |
| Build del campeón (runas/items/hechizos/skill order) | ✅ Seed curada |
| Interfaz web (dashboard) servida por el backend | ✅ Implementado |
| Catálogo de campeones (nombre/icono, Data Dragon) | ✅ Implementado |
| Runas + hechizos del campeón en champ select · build in-game | ✅ Implementado |
| Detección del campeón en partida (Live Client API) | ✅ Implementado |
| Iconos reales de ítems, hechizos y habilidades en la build | ✅ Implementado |
| Página de runas con iconos al estilo LoL | ✅ Implementado |
| Builds genéricas por clase (marksman/mago/tanque/…) | ✅ Implementado |
| Build del campeón visible también en ARAM | ✅ Implementado |
| Interfaz rediseñada (minimalista/profesional) | ✅ Implementado |
| Builds | 🚧 Stub (501) |
| Settings | 🚧 Stub (501) |

## Stack

- Node.js + TypeScript (ESM)
- Express (backend local)
- Zod (validación de configuración y contratos)
- Vitest (tests)

La UI (React + Vite) y el shell de escritorio (Electron) se incorporarán en fases
posteriores; el backend está diseñado para ser consumido por esa UI vía HTTP local.

## Cómo funciona la detección del cliente

Mientras el cliente de LoL está abierto, escribe un archivo `lockfile` con el
formato `LeagueClient:<pid>:<port>:<password>:<protocol>`. El backend:

1. Localiza el `lockfile` según el SO (o vía `LOL_LOCKFILE_PATH`).
2. Lo parsea para obtener puerto y credenciales locales (`src/infrastructure/lcu/lockfile.ts`).
3. Se conecta al LCU en `127.0.0.1` con basic-auth (usuario `riot`) sobre el
   certificado autofirmado de Riot (`lcu-connector.ts`).
4. Consulta `/lol-gameflow/v1/gameflow-phase` y `/lol-summoner/v1/current-summoner`
   y consolida un `ClientStatus` tolerante a fallos (`client-detector.ts`).

Si el cliente está cerrado, `/api/client/status` responde `DISCONNECTED` sin errores.

## Uso

```bash
npm install
cp .env.example .env      # configura RIOT_API_KEY, región, etc.

npm run dev               # backend + UI en modo watch
npm run typecheck
npm test
```

Luego abre el **dashboard** en el navegador: **http://127.0.0.1:3535/**

### App de escritorio (Electron)

Para usar PIX como una app nativa (doble clic, sin navegador ni terminal) —ideal
para compartir con amigos— hay un envoltorio de Electron que arranca el backend
en un puerto local libre y abre una ventana propia:

```bash
npm run electron:dev          # compila y abre la app en modo desarrollo
npm run electron:build        # genera un instalador para tu sistema operativo
npm run electron:build:win    # fuerza el instalador de Windows (NSIS)
npm run electron:build:mac    # DMG de macOS
npm run electron:build:linux  # AppImage de Linux
```

Los instaladores quedan en `release/`. La clave de la Riot API se pega desde
**Ajustes** dentro de la propia app (no hace falta `.env`) y los datos del usuario
(ajustes, identidad, caché de partidas) se guardan en la carpeta de datos del
sistema operativo, no dentro del paquete, para que sobrevivan a las
actualizaciones.

La UI (dark theme, sin paso de build) se sirve desde `public/` y consume la API local:
muestra estado del cliente, perfil, historial y estadísticas. El panel de contexto es
**dinámico**: en champ select muestra los campeones recomendados para tu línea y las
runas/hechizos de tu pick (con nombre e icono del campeón); en ARAM, el análisis de
composición; y ya **en partida**, la build completa del campeón. Es la base para migrar
luego a React/Electron.

Ejemplos de respuesta con el cliente cerrado:

```bash
curl http://127.0.0.1:3535/api/client/status
# {"connected":false,"clientState":"DISCONNECTED","summoner":null,"lastUpdated":"..."}

curl http://127.0.0.1:3535/api/champ-select/session
# {"active":false,"session":null}
```

`/api/game/queue` clasifica el tipo de partida a partir del `queueId` que reporta el
cliente. Categorías: `CASUAL_SWIFTPLAY` (eliges rol y campeón en la sala),
`NORMAL_DRAFT` (normal/reclutamiento con picks y bans), `RANKED_SOLO`, `RANKED_FLEX`,
`ARAM`, `CO_OP_VS_AI`, `CLASH`, `PRACTICE_TOOL`, `CUSTOM` y `OTHER`:

```json
{
  "active": true,
  "queue": {
    "queueId": 420,
    "category": "RANKED_SOLO",
    "label": "Clasificatoria Solo/Dúo",
    "isRanked": true,
    "isPracticeTool": false,
    "isCustom": false,
    "gameMode": "CLASSIC",
    "mapId": 11,
    "rawName": "Clasificatoria Solo/Dúo",
    "rawType": "RANKED_SOLO_5x5"
  }
}
```

`/api/recommendations` sugiere campeones por línea con un motor de reglas
determinístico (base de meta + bono por comfort pick). Si no se pasa `?role=`,
intenta detectar el rol desde champion select y excluye los campeones baneados:

```bash
curl "http://127.0.0.1:3535/api/recommendations?role=MIDDLE&limit=3"
# {"role":"MIDDLE","recommendations":[
#   {"championId":103,"championName":"Ahri","score":80,"reason":"meta_pick"}, ...]}
```

`/api/player/profile` y `/api/player/matches` usan la **Riot API oficial** (requieren
`RIOT_API_KEY`). Resuelven tu identidad desde la query (`?gameName=&tagLine=`) o, si se
omite, desde el cliente local. Sin key configurada devuelven `503 riot_not_configured`:

```bash
curl "http://127.0.0.1:3535/api/player/profile?gameName=Vishox&tagLine=LAS"
# {"puuid":"...","gameName":"Vishox","tagLine":"LAS","summonerLevel":312,...}

curl "http://127.0.0.1:3535/api/player/matches?gameName=Vishox&tagLine=LAS&count=5"
# {"matches":[{"matchId":"LA1_1","championName":"Ahri","role":"MIDDLE","kills":8,...}]}
```

`/api/builds?championId=101&role=MIDDLE` devuelve la build recomendada (hechizos,
página de runas, ítems iniciales/core/situacionales y orden de habilidades). Usa un
**proveedor abstraído** (`BuildProvider`) con una **seed curada local** como fallback;
los campeones aún no cubiertos responden `404 build_not_found`.

```bash
curl "http://127.0.0.1:3535/api/builds?championId=101&role=MIDDLE"
# {"championName":"Xerath","runes":{"keystone":"Cometa Arcano",...},"coreItems":[...],"skillOrder":["Q","W","E"],"source":"curated"}
```

> Las builds son curadas (marcadas `patch:"curado"`), pensadas como fallback y punto
> de partida ajustable por parche; la arquitectura permite anteponer un proveedor
> externo (op.gg/u.gg u otra fuente) vía `FallbackBuildProvider`.

`/api/aram/analysis` (sólo en ARAM, normal o de evento) lee tu equipo y la **banca**
de campeones, analiza la **composición** (mezcla AD/AP, frontline, sustain/curación,
CC, poke), dice si está **equilibrada o qué le falta**, y recomienda la **mejor opción**
disponible (tu campeón actual o uno de la banca) para cubrir los huecos del equipo:

```jsonc
{
  "isAram": true,
  "currentComp": {
    "balanced": false,
    "missing": ["daño mágico (equipo demasiado AD)", "un frontline / tanque", "sustain o curación (clave en ARAM)"],
    "strengths": ["composición de poke fuerte"]
  },
  "bestOption": {
    "championId": 54, "championName": "Malphite", "fitScore": 100,
    "fillsGaps": ["aporta daño mágico", "aporta frontline", "aporta engage"]
  }
  // ...team, bench, options
}
```

> Cobertura: el análisis usa un dataset curado de campeones. Los que aún no estén
> en el dataset se marcan con `"unknown": true` y no se evalúan (se informa aparte).

`/api/player/stats` resume tu rendimiento reciente (winrate y KDA por campeón y por
rol). Y `/api/recommendations?personalized=true` combina el pool meta con tu historial:
tus campeones dominados en el rol (≥2 partidas) entran como candidatos y suben por
comfort + winrate (requiere `RIOT_API_KEY`):

```bash
curl "http://127.0.0.1:3535/api/player/stats"
# {"totalGames":20,"winRate":0.55,"byChampion":[{"championName":"Syndra","games":6,"winRate":0.66,"kda":3.1},...],"byRole":[...]}

curl "http://127.0.0.1:3535/api/recommendations?personalized=true&role=MIDDLE"
# {"role":"MIDDLE","recommendations":[...],"personalized":true,"basedOnGames":20}
```

Durante champion select, `/api/champ-select/session` devuelve `active:true` con el
rol asignado, el campeón elegido, si el pick está confirmado y los bans:

```json
{
  "active": true,
  "session": {
    "phase": "BAN_PICK",
    "assignedRole": "MIDDLE",
    "localPlayerCellId": 2,
    "selectedChampionId": 103,
    "pickCompleted": false,
    "bans": [17, 55]
  }
}
```

## Estructura

```text
src/
├─ domain/            # Contratos/entidades compartidas (types.ts)
├─ application/       # Casos de uso (get-client-status.ts)
├─ infrastructure/
│  ├─ lcu/            # Lockfile, conector, detector, champ select, ARAM, cola
│  ├─ riot/           # Cliente de la Riot API (account, summoner, match)
│  └─ champions/      # Seed de pool, metadatos y builds de campeones
public/               # UI web estática (dashboard): index.html, styles.css, app.js
├─ api/               # Servidor Express y rutas locales
├─ config/            # Carga y validación de configuración (Zod)
└─ index.ts           # Punto de entrada del backend
tests/                # Tests unitarios (Vitest)
docs/                 # Arquitectura y decisiones
```

## Idiomas (i18n)

La interfaz está disponible en **español e inglés**, con un selector ES/EN en la
barra superior (se recuerda entre sesiones). El sistema vive en `public/i18n.js`
con el patrón "texto como clave": el español es la clave y el fallback, y solo se
sustituye por inglés cuando corresponde. Los datos de campeones/objetos vienen de
Data Dragon en el idioma configurado en el backend; los consejos curados por
campeón (`public/champion-tips.js`) están por ahora solo en español.

## Próximos pasos

Integrar Riot API (perfil + historial), lectura de la sesión de champion select,
motor de recomendaciones por reglas y proveedor de builds con fallback local, app
de escritorio (Electron) e internacionalización ES/EN — ya implementados. Pendiente
de cara a publicar: traducir los consejos por campeón al inglés, firma de código de
los instaladores y auto-actualización.
