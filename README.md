# LearNity

Полный проект состоит из двух приложений:

- `server/` — Express + PostgreSQL + JWT + роли + миграции + LMS API.
- `client/` — Vite + React + Router v6 + Context/useReducer + защищённые маршруты.

## 1) Запуск backend (`server`)

```bash
cd server
cp .env.example .env
npm install
npm run migrate
npm run dev
```

Backend по умолчанию стартует на `http://localhost:4000`.

### Основные backend-эндпоинты

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET/POST/PATCH/DELETE /api/courses`
- `GET/POST /api/courses/:courseId/lessons`, `PATCH/DELETE /api/lessons/:id`
- `GET/POST /api/lessons/:lessonId/assignments`, `PATCH/DELETE /api/assignments/:id`, `POST /api/assignments/:id/submit`
- `GET/POST/DELETE /api/common-words`
- `GET/POST/DELETE /api/personal-words/my`
  - `POST /api/personal-words/my` **автоматически** создаёт `user_word_progress` с `source_type='personal'` в транзакции.
- `GET /api/repetition/today`, `POST /api/repetition/review`
- `GET /api/stats/my`

## 2) Запуск frontend (`client`)

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

Frontend по умолчанию стартует на `http://localhost:5173`.

## 3) Переменные окружения

### server/.env.example

- `PORT`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `CORS_ORIGIN` (можно указать несколько origin через запятую)

### client/.env.example

- `VITE_API_BASE_URL` (например, `http://localhost:4000/api`)

## 4) Миграции

SQL миграции находятся в `server/src/migrations/*.sql`.

Запуск:

```bash
cd server
npm run migrate
```

Скрипт создаёт таблицу `schema_migrations` и выполняет только новые SQL-файлы.
