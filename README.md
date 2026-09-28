# Vehicle Accounting System

Система контроля въезда и выезда автомобилей на территорию предприятия. Система распознаёт госномера на видео и изображениях с камер (YOLO + OCR-модель на TensorFlow), определяет направление движения и проверяет, есть ли у машины действующий доступ. Все проезды она записывает в журнал.

Проект состоит из двух частей:

| Каталог | Назначение | Стек |
|---|---|---|
| [vehicle-accounting-system-backend](vehicle-accounting-system-backend/) | REST API, распознавание номеров, работа с БД | Python, FastAPI, SQLAlchemy, PostgreSQL, Ultralytics YOLO, TensorFlow, OpenCV, Dask |
| [vehicle-accounting-system-frontend](vehicle-accounting-system-frontend/) | Веб-интерфейс оператора и администратора | React 18, TypeScript, Vite, axios, react-router |

> English version: [README.en.md](README.en.md)

## Возможности

- **Распознавание номеров на видео**: видео загружается и обрабатывается в фоне по кадрам. Результат (номер, уверенность, направление, лучший кадр) сохраняется как событие проезда.
- **Распознавание номера на одном изображении**.
- **Определение направления** (въезд или выезд) по изменению размера рамки номера между кадрами. Если изменение меньше порога, направление берётся из последнего известного состояния машины (на территории или нет).
- **Проверка доступа**: у машины есть периоды доступа (`valid_from` / `valid_until`), и доступ может быть бессрочным. Незарегистрированные машины помечаются в журнале.
- **Справочники**: сотрудники, автомобили (включая гостевые), доступы.
- **Журнал событий и статистика**, список машин, которые сейчас на территории.
- **Экспорт** таблиц в Excel (`xlsx`) и Word (`docx`) из интерфейса.
- **Авторизация по JWT** с двумя ролями: `administrator` (управляет пользователями) и `operator`.

## Структура репозитория

```
vehicle-accounting-system/
├── vehicle-accounting-system-backend/
│   ├── main.py                  # точка входа FastAPI
│   ├── init_db.py               # создание таблиц и тестовых данных
│   ├── core/config.py           # настройки (читаются из .env)
│   ├── database/                # модели SQLAlchemy и сессия
│   ├── schemas/                 # Pydantic-схемы
│   ├── api/v1/                  # роутеры: auth, users, employees, vehicles,
│   │                            #          access, events, video, image
│   ├── services/                # VideoProcessingService (YOLO + OCR)
│   ├── utils/security.py        # хеширование паролей, JWT, проверка ролей
│   ├── test_api.py              # скрипт ручной проверки API
│   └── requirements.txt
└── vehicle-accounting-system-frontend/
    ├── scr/                     # исходники React (pages, services, components)
    ├── vite.config.ts
    └── package.json
```

## Требования

- Python 3.10–3.11 (TensorFlow 2.15 не поддерживает более новые версии)
- PostgreSQL 13+
- Node.js 18+
- Файлы весов моделей (их нет в репозитории, см. ниже)

## Запуск бэкенда

```bash
cd vehicle-accounting-system-backend

python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
```

### Модели

Каталог `models/` исключён из git. Поместите в него веса:

```
vehicle-accounting-system-backend/models/
├── yolo_plate_detector.pt    # детектор номерных знаков (Ultralytics YOLO)
└── plate_ocr_model.h5        # OCR-модель (Keras, CTC-декодирование)
```

Пути к моделям можно изменить через `YOLO_MODEL_PATH` и `OCR_MODEL_PATH`.

### База данных

Создайте базу в PostgreSQL:

```sql
CREATE DATABASE vehicle_access_db;
```

### Конфигурация

Настройки лежат в [core/config.py](vehicle-accounting-system-backend/core/config.py). Любую из них можно переопределить в файле `.env` в каталоге бэкенда:

```env
DATABASE_URL=postgresql://postgres:root@localhost:5432/vehicle_access_db
SECRET_KEY=замените-на-случайную-строку
ACCESS_TOKEN_EXPIRE_MINUTES=30

VIDEO_STORAGE_PATH=./storage/videos
MAX_VIDEO_SIZE_MB=500

YOLO_MODEL_PATH=./models/yolo_plate_detector.pt
YOLO_CONFIDENCE_THRESHOLD=0.5
OCR_MODEL_PATH=./models/plate_ocr_model.h5

# адрес Dask-планировщика; пусто — локальный режим
# DASK_SCHEDULER_ADDRESS=tcp://127.0.0.1:8786

# порог относительного изменения площади рамки для определения направления
BBOX_SIZE_THRESHOLD=0.15
```

> ⚠️ Перед развёртыванием обязательно смените `SECRET_KEY` и пароль БД. Значения по умолчанию подходят только для локальной разработки.

### Инициализация и старт

```bash
# создать таблицы и заполнить тестовыми данными
python init_db.py

# запустить сервер на http://localhost:8000
python main.py
```

`init_db.py` создаёт тестовых пользователей:

| Роль | Логин | Пароль |
|---|---|---|
| Администратор | `admin` | `admin123` |
| Оператор | `operator` | `operator123` |

Скрипт рассчитан на пустую базу: повторный запуск завершится ошибкой уникальности.

Документация API после запуска:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Запуск фронтенда

```bash
cd vehicle-accounting-system-frontend
npm install
npm run dev
```

Приложение откроется на http://localhost:3000. Адрес API задаётся в `.env`:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

Если переменная не задана, запросы идут на `/api/v1`, и Vite-прокси перенаправляет их на `http://localhost:8000`.

Сборка для продакшена:

```bash
npm run build     # результат в dist/
npm run preview
```

### Страницы интерфейса

| Путь | Страница |
|---|---|
| `/login` | Вход |
| `/` | Дашборд со статистикой |
| `/events` | Журнал проездов |
| `/video` | Загрузка видео на распознавание |
| `/image` | Распознавание номера по фото |
| `/vehicles` | Автомобили |
| `/employees` | Сотрудники |
| `/access` | Доступы |
| `/users` | Пользователи (только администратор) |
| `/about` | О системе |

## API

Все маршруты имеют префикс `/api/v1`. Для всех, кроме `/auth/login*`, нужен заголовок `Authorization: Bearer <token>`.

| Группа | Основные эндпоинты |
|---|---|
| Авторизация | `POST /auth/login` (form-data), `POST /auth/login/json`, `POST /auth/register`, `GET /auth/me` |
| Видео | `POST /video` (multipart, возвращает UUID проезда), `GET /video/status/{uuid}`, `GET /video/frame/{uuid}` |
| Изображения | `POST /image` |
| События | `GET /events`, `GET /events/{uuid}`, `GET /events/recent/unregistered`, `GET /events/vehicle/{plate}`, `GET /statistics` |
| Автомобили | CRUD `/vehicles`, `GET /vehicles/on-territory`, `GET /vehicles/plate/{plate}` |
| Сотрудники | CRUD `/employees`, `GET /employees/search/by-name` |
| Доступы | CRUD `/access`, `GET /access/active`, `GET /access/expired`, `POST /access/{id}/activate`, `POST /access/{id}/deactivate` |
| Пользователи | CRUD `/users` (только администратор) |

Служебные маршруты: `GET /` и `GET /health`.

### Как обрабатывается видео

1. `POST /video` сохраняет файл (`.mp4`, `.avi`, `.mov`, `.mkv`) в `storage/videos/`, создаёт запись `Pass` со статусом `pending` и сразу возвращает `202 Accepted` с UUID.
2. Фоновая задача читает видео по кадрам. YOLO ищет номерной знак, OCR-модель распознаёт символы (словарь `OCR_VOCABULARY`, CTC-декодирование).
3. Из всех кадров выбирается результат с максимальной уверенностью, лучший кадр сохраняется. По динамике площади рамки определяется направление.
4. Номер сверяется со справочником автомобилей и активными доступами. Запись проезда получает статус `complete` (или `failed` с логом ошибки), у машины обновляется флаг `on_territory`.
5. Клиент опрашивает `GET /video/status/{uuid}`, пока обработка не закончится.

## Модель данных

- **Employee**: сотрудник (ФИО, должность, контакты).
- **Vehicle**: автомобиль (номер, тип, владелец-сотрудник, признак гостя, признак «на территории»).
- **Access**: период доступа автомобиля; бывает активным или неактивным и бессрочным при `valid_until = NULL`.
- **Pass**: событие проезда (UUID, распознанный номер, направление, уверенность, время обработки, статус, путь к видео, зарегистрирована ли машина).
- **User**: пользователь системы с ролью `administrator` или `operator`.

Таблицы создаются автоматически при старте приложения (`Base.metadata.create_all`). Миграций Alembic в проекте пока нет.

## Тестирование

```bash
cd vehicle-accounting-system-backend

# юнит-тесты сервиса распознавания (нужны файлы моделей)
python -m unittest services.test_video_processing

# ручная проверка эндпоинтов на запущенном сервере
python test_api.py
```
