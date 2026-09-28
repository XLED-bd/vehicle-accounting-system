# Vehicle Accounting System

A system for controlling vehicle entry to and exit from company premises. It recognizes license plates in camera video and images (YOLO + a TensorFlow OCR model), determines the direction of travel, checks whether the vehicle has valid access, and records every pass in a log.

The project has two parts:

| Directory | Purpose | Stack |
|---|---|---|
| [vehicle-accounting-system-backend](vehicle-accounting-system-backend/) | REST API, plate recognition, database | Python, FastAPI, SQLAlchemy, PostgreSQL, Ultralytics YOLO, TensorFlow, OpenCV, Dask |
| [vehicle-accounting-system-frontend](vehicle-accounting-system-frontend/) | Web UI for operators and administrators | React 18, TypeScript, Vite, axios, react-router |

> Русская версия: [README.md](README.md)

## Features

- **Plate recognition in video**: an uploaded video is processed frame by frame in the background. The result (plate number, confidence, direction, best frame) is saved as a pass event.
- **Plate recognition in a single image**.
- **Direction detection** (entry or exit) from how the plate bounding box changes in size across frames. If the change is below the threshold, the direction is taken from the vehicle's last known state (on premises or not).
- **Access checks**: each vehicle has access periods (`valid_from` / `valid_until`), and access can be permanent. Unregistered vehicles are flagged in the log.
- **Reference data**: employees, vehicles (including guest vehicles), access permits.
- **Event log and statistics**, plus a list of vehicles currently on the premises.
- **Export** of tables to Excel (`xlsx`) and Word (`docx`) from the UI.
- **JWT authentication** with two roles: `administrator` (manages users) and `operator`.

## Repository layout

```
vehicle-accounting-system/
├── vehicle-accounting-system-backend/
│   ├── main.py                  # FastAPI entry point
│   ├── init_db.py               # creates tables and seed data
│   ├── core/config.py           # settings (read from .env)
│   ├── database/                # SQLAlchemy models and session
│   ├── schemas/                 # Pydantic schemas
│   ├── api/v1/                  # routers: auth, users, employees, vehicles,
│   │                            #          access, events, video, image
│   ├── services/                # VideoProcessingService (YOLO + OCR)
│   ├── utils/security.py        # password hashing, JWT, role checks
│   ├── test_api.py              # manual API check script
│   └── requirements.txt
└── vehicle-accounting-system-frontend/
    ├── scr/                     # React sources (pages, services, components)
    ├── vite.config.ts
    └── package.json
```

## Requirements

- Python 3.10–3.11 (TensorFlow 2.15 does not support newer versions)
- PostgreSQL 13+
- Node.js 18+
- Model weight files (not included in the repository, see below)

## Running the backend

```bash
cd vehicle-accounting-system-backend

python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
```

### Models

The `models/` directory is excluded from git. Put the weights there:

```
vehicle-accounting-system-backend/models/
├── yolo_plate_detector.pt    # license plate detector (Ultralytics YOLO)
└── plate_ocr_model.h5        # OCR model (Keras, CTC decoding)
```

You can change the paths with `YOLO_MODEL_PATH` and `OCR_MODEL_PATH`.

### Database

Create the database in PostgreSQL:

```sql
CREATE DATABASE vehicle_access_db;
```

### Configuration

Settings live in [core/config.py](vehicle-accounting-system-backend/core/config.py). Any of them can be overridden in a `.env` file in the backend directory:

```env
DATABASE_URL=postgresql://postgres:root@localhost:5432/vehicle_access_db
SECRET_KEY=replace-with-a-random-string
ACCESS_TOKEN_EXPIRE_MINUTES=30

VIDEO_STORAGE_PATH=./storage/videos
MAX_VIDEO_SIZE_MB=500

YOLO_MODEL_PATH=./models/yolo_plate_detector.pt
YOLO_CONFIDENCE_THRESHOLD=0.5
OCR_MODEL_PATH=./models/plate_ocr_model.h5

# Dask scheduler address; leave empty for local mode
# DASK_SCHEDULER_ADDRESS=tcp://127.0.0.1:8786

# relative bounding-box area change threshold for direction detection
BBOX_SIZE_THRESHOLD=0.15
```

> ⚠️ Change `SECRET_KEY` and the database password before deploying. The defaults are only suitable for local development.

### Initialization and startup

```bash
# create tables and load seed data
python init_db.py

# start the server at http://localhost:8000
python main.py
```

`init_db.py` creates test users:

| Role | Username | Password |
|---|---|---|
| Administrator | `admin` | `admin123` |
| Operator | `operator` | `operator123` |

The script expects an empty database. Running it a second time fails with a uniqueness error.

API documentation once the server is running:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Running the frontend

```bash
cd vehicle-accounting-system-frontend
npm install
npm run dev
```

The app opens at http://localhost:3000. The API address is set in `.env`:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

If the variable is not set, requests go to `/api/v1` and the Vite proxy forwards them to `http://localhost:8000`.

Production build:

```bash
npm run build     # output in dist/
npm run preview
```

### UI pages

| Path | Page |
|---|---|
| `/login` | Sign in |
| `/` | Dashboard with statistics |
| `/events` | Pass log |
| `/video` | Upload video for recognition |
| `/image` | Recognize a plate from a photo |
| `/vehicles` | Vehicles |
| `/employees` | Employees |
| `/access` | Access permits |
| `/users` | Users (administrator only) |
| `/about` | About |

## API

All routes are prefixed with `/api/v1`. Every route except `/auth/login*` requires the `Authorization: Bearer <token>` header.

| Group | Main endpoints |
|---|---|
| Auth | `POST /auth/login` (form-data), `POST /auth/login/json`, `POST /auth/register`, `GET /auth/me` |
| Video | `POST /video` (multipart, returns the pass UUID), `GET /video/status/{uuid}`, `GET /video/frame/{uuid}` |
| Images | `POST /image` |
| Events | `GET /events`, `GET /events/{uuid}`, `GET /events/recent/unregistered`, `GET /events/vehicle/{plate}`, `GET /statistics` |
| Vehicles | CRUD `/vehicles`, `GET /vehicles/on-territory`, `GET /vehicles/plate/{plate}` |
| Employees | CRUD `/employees`, `GET /employees/search/by-name` |
| Access | CRUD `/access`, `GET /access/active`, `GET /access/expired`, `POST /access/{id}/activate`, `POST /access/{id}/deactivate` |
| Users | CRUD `/users` (administrator only) |

Service routes: `GET /` and `GET /health`.

### How video is processed

1. `POST /video` saves the file (`.mp4`, `.avi`, `.mov`, `.mkv`) to `storage/videos/`, creates a `Pass` record with status `pending`, and immediately returns `202 Accepted` with the UUID.
2. A background task reads the video frame by frame. YOLO finds the license plate and the OCR model reads the characters (`OCR_VOCABULARY` alphabet, CTC decoding).
3. The result with the highest confidence across all frames is kept and its frame is saved. The direction is derived from how the box area changes.
4. The plate is matched against registered vehicles and their active access permits. The pass record gets status `complete` (or `failed` with an error log), and the vehicle's `on_territory` flag is updated.
5. The client polls `GET /video/status/{uuid}` until processing finishes.

## Data model

- **Employee**: an employee (full name, position, contact info).
- **Vehicle**: a vehicle (plate number, type, owning employee, guest flag, "on premises" flag).
- **Access**: an access period for a vehicle; can be active or inactive, and is permanent when `valid_until = NULL`.
- **Pass**: a pass event (UUID, recognized plate, direction, confidence, processing time, status, video path, whether the vehicle is registered).
- **User**: a system user with the `administrator` or `operator` role.

Tables are created automatically on application startup (`Base.metadata.create_all`). The project has no Alembic migrations yet.

## Testing

```bash
cd vehicle-accounting-system-backend

# unit tests for the recognition service (model files required)
python -m unittest services.test_video_processing

# manual endpoint checks against a running server
python test_api.py
```
