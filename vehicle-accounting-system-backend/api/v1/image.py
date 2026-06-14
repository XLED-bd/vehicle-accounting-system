"""
API endpoint для обработки изображений с номерными знаками
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
import logging
from pathlib import Path

from database.session import get_db
from database.models import Vehicle, User
from schemas.schemas import ImageProcessResponse
from services.video_processing import video_service
from utils.security import get_current_active_user

router = APIRouter()
logger = logging.getLogger(__name__)

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


@router.post("/image", response_model=ImageProcessResponse)
async def process_image(
    file: UploadFile = File(..., description="Изображение для обработки"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Обработка изображения с автомобильным номером.

    1. Детектирует номерной знак на изображении (YOLO).
    2. Распознаёт символы номера (OCR).
    3. Ищет автомобиль в БД и **инвертирует** флаг `on_territory`:
       - если был `True`  → становится `False` (выехал)
       - если был `False` → становится `True`  (въехал)
    4. Возвращает аннотированное изображение (base64 JPEG) и метаданные.
    """
    file_extension = Path(file.filename).suffix.lower()
    if file_extension not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Неподдерживаемый формат. Допустимые: {sorted(ALLOWED_IMAGE_EXTENSIONS)}",
        )

    image_data = await file.read()
    if not image_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Файл пустой",
        )

    # Детекция и OCR
    try:
        detection_result = video_service.process_image(image_data)
    except Exception as e:
        logger.error(f"Ошибка при обработке изображения: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка обработки изображения: {str(e)}",
        )

    if detection_result.get("error"):
        return ImageProcessResponse(
            annotated_image=detection_result.get("annotated_image"),
            message=detection_result["error"],
        )

    plate_number = detection_result.get("plate_number")
    confidence = detection_result.get("confidence", 0.0)
    annotated_image = detection_result.get("annotated_image")

    if not plate_number:
        return ImageProcessResponse(
            annotated_image=annotated_image,
            confidence=confidence,
            message="Номерной знак не обнаружен",
        )

    # Ищем автомобиль в БД и переключаем статус
    vehicle = db.query(Vehicle).filter(Vehicle.plate_number == plate_number).first()

    if not vehicle:
        return ImageProcessResponse(
            plate_number=plate_number,
            confidence=confidence,
            vehicle_found=False,
            annotated_image=annotated_image,
            message=f"Автомобиль {plate_number} не найден в базе данных",
        )

    previous_status = vehicle.on_territory
    vehicle.on_territory = not previous_status

    try:
        db.commit()
        db.refresh(vehicle)
    except Exception as e:
        db.rollback()
        logger.error(f"Ошибка обновления статуса автомобиля {plate_number}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка обновления статуса в базе данных",
        )

    direction_msg = "въехал на территорию" if vehicle.on_territory else "выехал с территории"
    logger.info(
        f"Автомобиль {plate_number}: on_territory {previous_status} → {vehicle.on_territory}"
    )

    return ImageProcessResponse(
        plate_number=plate_number,
        confidence=confidence,
        vehicle_found=True,
        on_territory=vehicle.on_territory,
        annotated_image=annotated_image,
        message=f"Автомобиль {plate_number} {direction_msg}",
    )
