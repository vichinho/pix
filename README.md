<p align="center">
  <img src="docs/pix-icon-full.svg" alt="PIX" width="120" height="120" />
</p>

<h1 align="center">PIX</h1>

<p align="center"><em>Tu hada compañera en la Grieta.</em></p>

<p align="center">
  App de escritorio <strong>gratuita y local</strong> para <strong>League of Legends</strong>: perfil, rango,
  historial, builds y runas en selección de campeón, coach en vivo, coach de progreso
  y asistente de baneos — todo con tu propia clave de la Riot API.
</p>

<p align="center">
  <a href="https://vichinho.github.io/pix/">🌐 Sitio web</a> ·
  <a href="https://github.com/vichinho/pix/releases/latest">⬇️ Descargar</a> ·
  <a href="https://github.com/vichinho/pix/issues">🐛 Reportar un problema</a>
</p>

<p align="center">
  <img alt="Plataformas" src="https://img.shields.io/badge/Windows%20%C2%B7%20macOS%20%C2%B7%20Linux-2E1856?style=flat-square" />
  <img alt="Stack" src="https://img.shields.io/badge/Node.js%20%C2%B7%20TypeScript%20%C2%B7%20Electron-1A1033?style=flat-square" />
  <img alt="Idiomas" src="https://img.shields.io/badge/i18n-Espa%C3%B1ol%20%2F%20English-8FF0E8?style=flat-square&labelColor=1A1033" />
</p>

> **Aviso legal.** PIX es un proyecto personal **no oficial**. No está afiliado,
> asociado, autorizado ni patrocinado por Riot Games. *League of Legends* y *Riot Games*
> son marcas registradas de Riot Games, Inc. PIX es una herramienta de apoyo visual y
> consulta: **no** lee memoria del juego, **no** inyecta código y **no** automatiza
> acciones dentro de la partida.

---

## Índice

- [¿Qué es PIX?](#qué-es-pix)
- [Características](#características)
- [Instalación (usuarios)](#instalación-usuarios)
- [Cómo funciona](#cómo-funciona)
- [Desarrollo](#desarrollo)
- [Empaquetado y releases](#empaquetado-y-releases)
- [API local](#api-local)
- [Idiomas](#idiomas)
- [Privacidad](#privacidad)
- [Roadmap](#roadmap)
- [Licencia](#licencia)

---

## ¿Qué es PIX?

PIX es una **app de escritorio** que se ejecuta junto al cliente de League of Legends y
convierte cada sesión en una ventaja. Detecta automáticamente en qué punto estás —menú,
selección de campeón o partida— y muestra lo útil en cada momento: tu perfil y rango,
tu historial, builds y runas recomendadas, un coach en vivo y feedback tras la partida.

Todo corre **en tu equipo**. No hay servidor de PIX ni cuentas: usas **tu propia clave
de la Riot API**, guardada localmente. A diferencia de las webs de estadísticas, PIX es
**personal y en tiempo real** — lee tu cliente local y trabaja con *tus* datos.

## Características

### 🎯 En selección de campeón
- **Campeones recomendados** para tu rol (motor de reglas: meta + comfort pick).
- **Runas, hechizos, build e ítems** del campeón que eliges, con la **matriz de subida de habilidades** (niveles 1–18).
- **Bans sugeridos para ti**: los campeones contra los que *tú* más pierdes, sacados de tu historial.
- Aplica **runas** y **set de objetos** directo al cliente con un clic (LCU).

### ⚔️ En partida
- **Coach en vivo**: temporizadores de dragón, heraldo y barón, y avisos de power-spike (Live Client Data API).
- **Análisis de composición en ARAM**: mezcla AD/AP, frontline, sustain y CC, qué le falta al equipo y la mejor elección de tu banca.
- **Build completa** del campeón en juego, con iconos reales de ítems, hechizos y habilidades.

### 📊 Fuera de partida
- **Perfil y rango**: nivel, emblema de liga, LP, winrate y mejor liga histórica.
- **Historial y estadísticas**: partidas recientes con KDA y winrate por campeón (filtros de ARAM y clasificatoria).
- **Coach de progreso**: metas editables con tendencia (KDA, muertes, CS/min, visión), tu «foco de la semana» e insights (mejor campeón, mejor horario, peor matchup, marcador de hoy).
- **Maestría de campeones** y **explorador de builds** para cualquier campeón por línea.
- **Resumen post-partida** en lenguaje natural y **detector de tilt** (aviso ante rachas de derrotas).

### 🧩 General
- **Español e inglés**, con selector en la barra superior.
- **100% local y privado**: sin servidor propio, sin cuentas, sin rastreo.
- Interfaz oscura y minimalista, empaquetada como app nativa (Windows, macOS, Linux).

## Instalación (usuarios)

1. Descarga el instalador para tu sistema desde la [**última release**](https://github.com/vichinho/pix/releases/latest):
   - **Windows** → `PIX-Setup-x.y.z.exe`
   - **macOS** → `PIX-x.y.z-arm64.dmg`
   - **Linux** → `PIX-x.y.z.AppImage`
2. Ábrelo. En Windows, la primera vez aparecerá *"editor desconocido"* (la app no está firmada): **Más información → Ejecutar de todas formas**.
3. Consigue una **Development API Key** gratis en [developer.riotgames.com](https://developer.riotgames.com/) (empieza por `RGAPI-`) y pégala en **⚙️ Ajustes** dentro de PIX.
4. Abre el cliente de LoL — PIX detecta tu cuenta automáticamente.

> ⚠️ Las claves de desarrollo de Riot **caducan cada 24 h**. Cuando expire, genera una nueva y vuelve a pegarla en Ajustes.

## Cómo funciona

PIX es un **backend local en Node.js** (Express) con una **UI web estática** (servida en
`127.0.0.1`), todo empaquetado en un **shell de Electron**. Combina cuatro fuentes:

| Fuente | Uso | Requiere clave |
|---|---|---|
| **LCU** (League Client API) | Estado del cliente, selección de campeón, aplicar runas/ítems | No |
| **Live Client Data API** (`:2999`) | Campeón, objetivos y estado en partida | No |
| **Riot API** (account/summoner/league/mastery/match) | Perfil, rango, maestría e historial | Sí (tu key) |
| **Data Dragon** | Nombres, iconos, splash, runas y hechizos | No |

- El **lockfile** del cliente da puerto y credenciales locales; PIX se conecta al LCU por
  `127.0.0.1` con basic-auth sobre el certificado de Riot. Si el cliente está cerrado,
  la API responde `DISCONNECTED` sin errores.
- Los datos del usuario (ajustes, identidad, caché de partidas) se guardan en la **carpeta
  de datos del sistema operativo**, fuera del paquete, para sobrevivir a las actualizaciones.

Arquitectura limpia por capas: `domain` (contratos) → `application` (casos de uso) →
`infrastructure` (LCU, Riot, Data Dragon, builds) → `api` (Express).

## Desarrollo

**Requisitos:** Node.js ≥ 20.

```bash
npm install
cp .env.example .env       # opcional: RIOT_API_KEY, región, locale…

npm run dev                # backend + UI en modo watch (http://127.0.0.1:3535)
npm run typecheck          # TypeScript sin emitir
npm test                   # tests con Vitest
npm run lint               # ESLint
```

Abre el **dashboard** en `http://127.0.0.1:3535/`. La clave de la Riot API puede venir del
`.env` (`RIOT_API_KEY`) o pegarse desde **Ajustes** en la propia interfaz.

### Estructura

```text
src/
├─ domain/            # Contratos y entidades compartidas
├─ application/       # Casos de uso (perfil, historial, builds, ARAM, recomendaciones…)
├─ infrastructure/
│  ├─ lcu/            # Lockfile, conector, detector, champ select, ARAM, cola
│  ├─ live/           # Live Client Data API (partida en curso)
│  ├─ riot/           # Cliente de la Riot API (account, summoner, league, mastery, match)
│  ├─ champions/      # Pool, arquetipos y proveedores de builds
│  └─ persistence/    # Identidad y ajustes en disco
├─ api/               # Servidor Express y rutas locales
├─ config/            # Carga y validación de configuración (Zod)
└─ index.ts           # Punto de entrada / startServer()
public/               # UI web estática: index.html, styles.css, app.js, i18n.js
electron/             # Proceso principal y preload de la app de escritorio
site/                 # Landing (GitHub Pages)
tests/                # Tests unitarios (Vitest)
docs/                 # Arquitectura, decisiones y assets del logo
```

## Empaquetado y releases

La app se empaqueta con **electron-builder**:

```bash
npm run electron:dev          # compila y abre la app en desarrollo
npm run electron:build        # instalador para tu sistema (queda en release/)
npm run electron:build:win    # NSIS (Windows)
npm run electron:build:mac    # DMG (macOS)
npm run electron:build:linux  # AppImage (Linux)
```

**Releases automáticas.** Empujar un tag `vX.Y.Z` (o lanzar el workflow *Construir y
publicar instaladores*) compila en runners de GitHub para Windows, macOS y Linux y
publica los instaladores en la [Release](https://github.com/vichinho/pix/releases)
correspondiente. La **landing** (`site/`) se despliega a GitHub Pages en cada cambio.

## API local

Todas las rutas viven bajo `http://127.0.0.1:3535/api`. Las que usan la Riot API
requieren `RIOT_API_KEY` (o clave configurada en Ajustes); sin ella responden
`503 riot_not_configured`.

| Ruta | Descripción |
|---|---|
| `GET /api/client/status` | Estado del cliente (LCU). |
| `GET /api/game/queue` | Tipo de cola/partida (ranked, ARAM, práctica…). |
| `GET /api/champ-select/session` | Rol, campeón elegido, bans y fase. |
| `GET /api/recommendations` | Campeones sugeridos por rol (`?personalized=true` usa tu historial). |
| `GET /api/builds` | Build del campeón (runas, ítems, hechizos, skill order). |
| `GET /api/aram/analysis` | Análisis de composición y mejor opción de banca. |
| `GET /api/live/champion` · `GET /api/live/game` | Campeón y estado de la partida en curso. |
| `GET /api/player/profile` · `/matches` · `/stats` · `/mastery` | Perfil, historial, estadísticas y maestría (Riot API). |
| `POST /api/runes/apply` · `POST /api/items/apply` | Aplica runas / set de ítems al cliente. |
| `GET · PUT /api/settings` | Estado y configuración de la clave de la Riot API. |

```bash
curl http://127.0.0.1:3535/api/client/status
# {"connected":false,"clientState":"DISCONNECTED","summoner":null,...}

curl "http://127.0.0.1:3535/api/builds?championId=101&role=MIDDLE"
# {"championName":"Xerath","runes":{...},"coreItems":[...],"skillOrder":["Q","W","E"],"source":"curated"}
```

> Las builds combinan una **cadena de proveedores** con fallback: seed curada →
> clasificación por campeón → arquetipo por clase → genérica. La arquitectura permite
> anteponer una fuente externa vía `FallbackBuildProvider`.

## Idiomas

La interfaz está en **español e inglés**, con selector ES/EN en la barra superior (se
recuerda entre sesiones). El sistema vive en `public/i18n.js` con el patrón «texto como
clave»: el español es la clave y el *fallback*, y solo se sustituye por inglés cuando
corresponde. Los nombres de campeones/objetos vienen de Data Dragon; los consejos curados
por campeón están por ahora en español.

## Privacidad

PIX corre por completo en tu computadora. Usa **tu propia** clave de la Riot API, guardada
localmente, para leer **tu** perfil y tus partidas — y nada más. No hay servidor de PIX,
ni cuentas, ni telemetría.

## Roadmap

- [x] Detección del cliente, champ select, tipo de cola y coach en vivo (LCU + Live Client).
- [x] Perfil, historial, estadísticas y maestría (Riot API).
- [x] Builds con proveedores en cascada, runas/ítems aplicables al cliente.
- [x] Coach de progreso y asistente de baneos personalizado.
- [x] App de escritorio (Electron) e internacionalización ES/EN.
- [ ] Traducir los consejos por campeón al inglés.
- [ ] Firma de código de los instaladores y auto-actualización.
- [ ] Récord contra tu rival de línea y guía de matchup.

## Licencia

Proyecto personal de uso no comercial. *League of Legends* © Riot Games, Inc. PIX no está
avalado por Riot Games ni refleja sus opiniones.
