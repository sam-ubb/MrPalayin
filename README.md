# 🤖 Mr Palayin - Discord Bot

Alternativa gratuita, extensible y modular a Mee6 enfocada en estudio, productividad y gamificación. Construido con Node.js (ESM), discord.js v14 y PostgreSQL.

---
## 🧩 Módulos Principales (Arquitectura Modular en `src/modules`)
Cada dominio expone servicios con nombres en español:
```
src/modules/
  configuracion/ (fusionarConfiguracion, modificarXP, ...)
  xp/            (obtenerUsuarioXP, obtenerLeaderboard, utilidades de cálculo XP)
  pomodoro/      (iniciarSesionPomodoro, iniciarSesionGrupal, rankingPomodoro...)
  economia/      (obtenerBalance, transferirMonedas, reclamarDiario...)
  moderacion/    (banearUsuario, expulsarUsuario, advertirUsuario, silenciarUsuario...)
  tareas/        (crearTarea, listarTareas, completarTarea, editarTarea...)
  insignias/     (otorgarInsignia, listarInsignias, metadataInsignias)
  misiones/      (obtenerOMisionesDiarias, incrementarMision)
  recordatorios/ (crearRecordatorio, obtenerRecordatoriosPendientes...)
  bienvenida/    (enviarBienvenida, enviarDMdeBienvenida)
```
Ventajas:
- Aislamiento de lógica de negocio
- Reutilización clara entre comandos / eventos / pollers
- Facilita pruebas unitarias por dominio

---
## 🚶 Flujo XP
1. Evento `messageCreate` llama a `procesarGananciaXP` (cooldown dinámico + ajuste por longitud + multiplicador de canal).
2. Se registra XP y nivel potencial (roles + mensaje level-up templado).
3. Hooks adicionales: economía (coins), misiones, badges, actividad, streak.

Archivo clave: `src/modules/xp/utilidades/calculoXP.js`.

---
## 🗂️ Estructura del Proyecto
```
src/
  commands/
    moderation/
    utility/
    levels/
  modules/            # NUEVO núcleo modular por dominio
  config/
  database/
    migrations/
  events/
  handlers/
  services/           # Servicios legacy (en transición, XP se apoya aquí todavía)
  utils/
  locales/
  index.js
```
Objetivo futuro: mover servicios legacy a repositorios por dominio y reducir dependencias directas de `database/index.js` fuera de `modules/*`.

---
## 🧪 Tests (Esqueleto Propuesto)
Crear carpeta raíz `tests/` con subcarpetas espejo a `modules/`:
```
tests/
  xp/
    calculoXP.test.js
  pomodoro/
    pomodoroServicio.test.js
  economia/
    economiaServicio.test.js
  ...
```
Herramientas sugeridas:
- Vitest o Jest (Vitest recomendado por rapidez en ESM)
- Testcontainers para PostgreSQL efímero (o docker-compose local)
- Semillas (fixtures) SQL mínimas por dominio

Ejemplo de test (pseudo):
```js
import { expect, it, beforeAll } from 'vitest';
import { procesarGananciaXP } from '../../src/modules/xp/utilidades/calculoXP.js';

it('aplica cooldown dinámico', async () => {
  const fakeMsg = { content: 'hola mundo', guild: { id: 'g1' }, author:{ id:'u1', bot:false }, channel:{ id:'c1' } };
  const r1 = await procesarGananciaXP(fakeMsg);
  expect(r1.xpGain).toBeGreaterThan(0);
  const r2 = await procesarGananciaXP(fakeMsg);
  expect(r2).toBeNull();
});
```
Scripts sugeridos:
```
npm i -D vitest @vitest/coverage c8
# package.json:
"test": "vitest --run",
"test:watch": "vitest"
```
Cobertura prioritaria:
- XP cálculo y cooldown
- Pomodoro (transiciones focus/break, estadísticas y ranking)
- Economía (transferencias y diario con bloqueo doble claim)
- Misiones (incrementos condicionados)
- Moderación (mutes expirando, warns listado)

---
## 📝 Migraciones / DB
(Se mantiene sección previa; ver más abajo en este README.)

---
## 🔄 Plan Futuro Refactor DB
- Extraer `database/index.js` en capas por dominio: `src/modules/<dominio>/repositorio/*`
- Reemplazar imports directos en comandos por funciones de servicio del módulo
- Añadir caché (en memoria o Redis) para leaderboard y multiplicadores XP

---
## 🧠 Roadmap de Documentación
- Generar docs automáticas de comandos (script que lea `commands` y compile markdown)
- Tabla de endpoints internos (servicios) para contributors
- Guía de extensión: cómo añadir nuevo dominio (`src/modules/nuevo`) + comando

---
## Secciones Previas

> Las secciones siguientes permanecen prácticamente iguales (funcionalidad, variables de entorno, etc.) y han sido actualizadas ya para reflejar la modularidad.

---
## 🔐 Variables de Entorno (.env)
```
DISCORD_TOKEN=tu_token
DATABASE_URL=postgres://user:pass@host:5432/db
LOG_LEVEL=info          # error|warn|info|debug
XP_COOLDOWN_SECONDS=60  # base, ajustado dinámicamente
XP_MIN=15
XP_MAX=25
WELCOME_DM_ENABLED=true
DB_SSL=false             # true si usas hosting con SSL
```

---
## 📦 Instalación
1. Clonar repositorio
2. `npm install`
3. Configurar `.env`
4. Crear BD PostgreSQL y usuario
5. (Opcional) Ejecutar sólo migraciones: `npm run migrate`
6. Iniciar: `npm start` (o `npm run dev` con nodemon)

---
## 🧪 Comandos (Resumen)
| Módulo | Slash Commands |
|--------|----------------|
| XP & Niveles | /level, /leaderboard |
| Config | /config ... |
| Pomodoro | /pomodoro (start/status/stop/group-start/group-join/group-leave/group-status/skip/group-skip) |
| Productividad | /pomodoro-top, /tasks (add/list/listall/edit/done/delete) |
| Economía | /economy (balance/give/daily/leaderboard) |
| Moderación | /ban /kick /clear /warn (add/list) /mute |
| Recordatorios | /remind (según implementación actual) |
| Badges | /badges |
| Info | /help /ping /userinfo /serverinfo /stats |

---
## 🧠 Fórmula de Nivel
Definida en `src/config/constants.js` (ej. `Math.floor(0.1 * Math.sqrt(xp))`). Ajustable.

---
## ⚙️ Personalización
- Mensajes de level-up: `/config levelup-message-set` con placeholders
- Multiplicadores XP: `/config xp-rate-set`
- Roles por nivel: `/config add-level-role`
- Idioma: `/config locale es|en`

---
## 🛡️ Moderación
- Acciones registradas en `moderation_logs`
- Mutes temporales con expiración automática
- Warns consultables y persistentes

---
## 🍅 Pomodoro Avanzado
- Ciclos focus/break
- Descansos largos según configuración de sesión (long break)
- Tags para clasificación temática
- Skip de fases

---
## 🏅 Badges
Ejemplos:
- streak_3, streak_7, streak_30 (rachas)
- focus_500, focus_2000 (minutos foco)
- wealth_1k, wealth_10k (economía)

---
## 🌍 Internacionalización
- Archivos en `src/locales`
- Fallback: es
- Fácil agregar otro idioma añadiendo `<lang>.json` y usando `/config locale`

---
## 🚦 Rate Limiting
- Token bucket (commands y componentes)
- Cooldown dinámico XP + reducción si mensajes largos

---
## 🧰 Scripts NPM
```
npm start        # Arranque producción
npm run dev      # Nodemon
npm run migrate  # Ejecutar migraciones SQL
```

---
## 🗺️ Roadmap Sugerido
- Migraciones JS up/down (node-pg-migrate) completas
- Panel web / dashboard
- Semanal missions & más tipos
- Tienda y sistema de ítems
- Cache distribuida (Redis) + sharding
- Métricas (Prometheus / Grafana)
- Tests unitarios e integración
- Más badges y logros condicionales

---
## 🛡️ Buenas Prácticas & Seguridad
- Validaciones de entrada (niveles, multiplicadores, cantidades)
- Transacciones para transferencias de coins
- Minimizar permisos del bot a los necesarios

---
## 📜 Licencia
MIT

---
## 🤝 Contribuir
1. Haz fork
2. Crea rama feature: `git checkout -b feature/nueva-funcionalidad`
3. Commit: `git commit -m "feat: añade X"`
4. Push y PR

---
¡Feliz estudio y productividad! 🎓🍅
