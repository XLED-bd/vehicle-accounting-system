"""
API endpoints для обработки видео
"""
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import uuid
import logging
import aiofiles
from pathlib import Path
from datetime import datetime
import dask
from dask.threaded import get

from database.session import get_db
from database.models import Pass, PassStatus, User
from schemas.schemas import VideoProcessResponse
from services.video_processing import video_service
from utils.security import get_current_active_user
from core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


def process_video_task(video_path: str, pass_uuid: str, db: Session):
    """
    Фоновая задача для обработки видео
    """
    try:
        logger.info(f"Запуск обработки видео для проезда {pass_uuid}")
        
        # Обновляем статус на "running"
        pass_record = db.query(Pass).filter(Pass.uuid == pass_uuid).first()
        if pass_record:
            pass_record.status = PassStatus.RUNNING
            db.commit()
        
        # Создаем delayed задачу
        delayed_task = video_service.process_video_frame_by_frame(
            video_path,
            pass_uuid
        )
        
        # Выполняем задачу с помощью Dask
        # Используем синхронный планировщик для простоты
        results = dask.compute(delayed_task, scheduler='threads')[0]
        
        # Обновляем запись в БД с результатами
        video_service.update_pass_with_results(db, pass_uuid, results)
        
        logger.info(f"Обработка видео завершена для проезда {pass_uuid}")
        
    except Exception as e:
        logger.error(f"Ошибка в фоновой задаче для проезда {pass_uuid}: {str(e)}")
        
        # Обновляем статус на failed
        pass_record = db.query(Pass).filter(Pass.uuid == pass_uuid).first()
        if pass_record:
            pass_record.status = PassStatus.FAILED
            pass_record.logs = f"Ошибка обработки: {str(e)}"
            db.commit()
    finally:
        db.close()


@router.post("/video", response_model=VideoProcessResponse, status_code=status.HTTP_202_ACCEPTED)
async def process_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="Видеофайл для обработки"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Запуск обработки видео

    Принимает загружаемый видеофайл (multipart/form-data), сохраняет его на диск,
    создает запись в БД и запускает асинхронную обработку.
    Возвращает UUID проезда для последующего отслеживания.
    """
    # Проверяем расширение файла
    file_extension = Path(file.filename).suffix.lower()
    if file_extension not in settings.ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid video format. Allowed: {settings.ALLOWED_VIDEO_EXTENSIONS}"
        )

    # Сохраняем файл в хранилище
    storage_dir = Path(settings.VIDEO_STORAGE_PATH)
    storage_dir.mkdir(parents=True, exist_ok=True)

    pass_uuid = str(uuid.uuid4())
    video_filename = f"{pass_uuid}{file_extension}"
    video_path = str(storage_dir / video_filename)

    try:
        async with aiofiles.open(video_path, "wb") as out_file:
            while chunk := await file.read(1024 * 1024):  # читаем по 1 МБ
                await out_file.write(chunk)
    except Exception as e:
        logger.error(f"Ошибка сохранения файла: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save video file: {str(e)}"
        )
    
    # Создаем запись в БД
    try:
        new_pass = Pass(
            uuid=pass_uuid,
            video_path=video_path,
            status=PassStatus.PENDING,
            created_at=datetime.now()
        )
        
        db.add(new_pass)
        db.commit()
        db.refresh(new_pass)
        
        logger.info(f"Создана запись проезда: {pass_uuid}")
        
    except Exception as e:
        db.rollback()
        logger.error(f"Ошибка создания записи проезда: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create pass record: {str(e)}"
        )
    
    # Запускаем обработку в фоновом режиме
    # Создаем новую сессию для фоновой задачи
    from database.session import SessionLocal
    background_db = SessionLocal()
    
    background_tasks.add_task(
        process_video_task,
        video_path,
        pass_uuid,
        background_db
    )
    
    return VideoProcessResponse(
        uuid=pass_uuid,
        status="processing_started",
        message=f"Video processing started. Use UUID {pass_uuid} to check status."
    )


@router.get("/video/status/{pass_uuid}")
async def get_video_status(
    pass_uuid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение статуса обработки видео по UUID
    """
    pass_record = db.query(Pass).filter(Pass.uuid == pass_uuid).first()
    
    if not pass_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pass with UUID {pass_uuid} not found"
        )
    
    frame_path = Path("./storage/frames") / f"{pass_uuid}.jpg"

    return {
        "uuid": pass_record.uuid,
        "status": pass_record.status,
        "plate_number": pass_record.plate_number_detected,
        "direction": pass_record.direction,
        "confidence": pass_record.confidence_level,
        "is_registered": pass_record.is_registered,
        "processing_time": pass_record.processing_time,
        "logs": pass_record.logs,
        "has_frame": frame_path.exists(),
        "created_at": pass_record.created_at,
        "updated_at": pass_record.updated_at
    }


@router.get("/video/frame/{pass_uuid}")
async def get_video_frame(
    pass_uuid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Получение лучшего аннотированного кадра из обработанного видео.
    Возвращает JPEG изображение с выделенным номерным знаком.
    """
    pass_record = db.query(Pass).filter(Pass.uuid == pass_uuid).first()
    if not pass_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Проезд {pass_uuid} не найден",
        )

    frame_path = Path("./storage/frames") / f"{pass_uuid}.jpg"
    if not frame_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Кадр ещё не готов или номер не был обнаружен",
        )

    return FileResponse(
        path=str(frame_path),
        media_type="image/jpeg",
        filename=f"frame_{pass_uuid}.jpg",
    )
