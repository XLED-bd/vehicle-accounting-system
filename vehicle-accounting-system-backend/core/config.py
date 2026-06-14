"""
Конфигурация приложения
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Настройки приложения"""
    
    # Настройки базы данных
    DATABASE_URL: str = "postgresql://postgres:root@localhost:5432/vehicle_access_db"
    
    # Настройки JWT
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Настройки приложения
    PROJECT_NAME: str = "Vehicle Access Control"
    API_V1_PREFIX: str = "/api/v1"
    
    # Настройки для обработки видео
    VIDEO_STORAGE_PATH: str = "./storage/videos"
    MAX_VIDEO_SIZE_MB: int = 500
    ALLOWED_VIDEO_EXTENSIONS: list = [".mp4", ".avi", ".mov", ".mkv"]
    
    # Настройки YOLO
    YOLO_MODEL_PATH: str = "./models/yolo_plate_detector.pt"
    YOLO_CONFIDENCE_THRESHOLD: float = 0.5
    
    # Настройки TensorFlow модели распознавания номеров
    OCR_MODEL_PATH: str = "./models/plate_ocr_model.h5"
    # Словарь символов для OCR
    OCR_VOCABULARY: str = "_-1234567890ABEKMHOPCTYX="
    # Размер входного изображения для OCR: [высота, ширина, каналы]
    OCR_IMAGE_HEIGHT: int = 200
    OCR_IMAGE_WIDTH: int = 50
    
    # Настройки Dask
    DASK_SCHEDULER_ADDRESS: Optional[str] = None  # None для локального режима
    
    # Настройки для определения направления
    BBOX_SIZE_THRESHOLD: float = 0.15  # Порог изменения размера bbox для определения направления
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
