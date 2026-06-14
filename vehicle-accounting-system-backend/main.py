from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from api.v1 import video, events, auth, users, vehicles, employees, access, image
from database.session import engine, Base
from core.config import settings

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Управление жизненным циклом приложения"""
    logger.info("Запуск приложения...")
    # Создание таблиц в БД
    Base.metadata.create_all(bind=engine)
    logger.info("Таблицы БД созданы")
    yield
    logger.info("Остановка приложения...")


# Создание приложения FastAPI
app = FastAPI(
    title="Vehicle Access Control API",
    description="API для контроля въезда и выезда автомобилей на территорию предприятия",
    version="1.0.0",
    lifespan=lifespan
)

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение роутеров
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Авторизация"])
app.include_router(video.router, prefix="/api/v1", tags=["Обработка видео"])
app.include_router(events.router, prefix="/api/v1", tags=["События проезда"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Пользователи"])
app.include_router(vehicles.router, prefix="/api/v1/vehicles", tags=["Автомобили"])
app.include_router(employees.router, prefix="/api/v1/employees", tags=["Сотрудники"])
app.include_router(access.router, prefix="/api/v1/access", tags=["Доступы"])
app.include_router(image.router, prefix="/api/v1", tags=["Обработка изображений"])


@app.get("/")
async def root():
    """Корневой endpoint"""
    return {
        "message": "Vehicle Access Control API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Проверка здоровья приложения"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
