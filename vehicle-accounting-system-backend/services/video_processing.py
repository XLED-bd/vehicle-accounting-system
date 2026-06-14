"""
Сервис для обработки видео и распознавания номеров
"""
import cv2
import numpy as np
from typing import Tuple, Optional, List
import logging
from datetime import datetime
from pathlib import Path
import dask
from dask import delayed
from dask.distributed import Client, get_client
import uuid as uuid_lib
import tensorflow as tf
from ultralytics import YOLO

from core.config import settings
from database.models import Pass, PassStatus, PassDirection, Vehicle, Access
from sqlalchemy.orm import Session
from sqlalchemy import func

logger = logging.getLogger(__name__)


class VideoProcessingService:
    """Сервис для обработки видео"""

    def __init__(self):
        self.yolo_model = None
        self.ocr_model = None
        self._initialize_models()

    def _initialize_models(self):
        """Загрузка YOLO и OCR моделей"""
        logger.info("Инициализация моделей...")
        self.yolo_model = YOLO(settings.YOLO_MODEL_PATH)
        self.ocr_model = tf.keras.models.load_model(
            filepath=settings.OCR_MODEL_PATH, compile=False
        )
        self.ocr_model.trainable = False
        logger.info("Модели успешно загружены")

    # ------------------------------------------------------------------
    # YOLO детекция номерного знака
    # ------------------------------------------------------------------

    def detect_plate_yolo(self, frame: np.ndarray) -> Optional[Tuple[List, float]]:
        """
        Детекция номера на кадре с помощью YOLO.

        Возвращает (bbox_coordinates, confidence) или None если номер не найден.
        bbox_coordinates = [x1, y1, x2, y2]
        """
        results = self.yolo_model(frame, conf=settings.YOLO_CONFIDENCE_THRESHOLD)

        if results and len(results[0].boxes) > 0:
            # Берём детекцию с наибольшей уверенностью
            boxes = results[0].boxes
            best_idx = int(boxes.conf.argmax())
            bbox = boxes.xyxy[best_idx].cpu().numpy().tolist()
            confidence = float(boxes.conf[best_idx].cpu().numpy())
            return bbox, confidence

        return None

    # ------------------------------------------------------------------
    # OCR распознавание номера
    # ------------------------------------------------------------------

    def _preprocess_plate_image(self, plate_image: np.ndarray) -> np.ndarray:
        """
        Предобработка изображения номерного знака для подачи в OCR модель.

        Повторяет логику DataGenerator.py из ocr_car_plate-main:
        1. Поворот на 90° по часовой стрелке
        2. Resize до (OCR_IMAGE_HEIGHT × OCR_IMAGE_WIDTH) = (200 × 50)
        3. Нормализация в [0, 1]
        4. Добавление batch-измерения
        """
        plate = cv2.rotate(plate_image, cv2.ROTATE_90_CLOCKWISE)
        # cv2.resize принимает (width, height) → numpy shape (height, width, channels)
        plate = cv2.resize(plate, (settings.OCR_IMAGE_WIDTH, settings.OCR_IMAGE_HEIGHT))
        plate = plate.astype(np.float32) / 255.0
        return np.expand_dims(plate, axis=0)  # (1, 200, 50, 3)

    def _decode_ctc_predictions(
        self, pred_logits: np.ndarray
    ) -> Tuple[str, float]:
        """
        Декодирование CTC-логитов в строку номера и оценку уверенности.

        Повторяет decode_batch_predictions из test.py.
        """
        vocab = list(settings.OCR_VOCABULARY)

        input_len = np.ones(pred_logits.shape[0]) * pred_logits.shape[1]

        # CTC greedy decoder (blank_index=-1 как при обучении)
        decoded, _ = tf.nn.ctc_greedy_decoder(
            tf.transpose(pred_logits, perm=[1, 0, 2]),
            input_len,
            blank_index=-1,
        )
        indices = tf.sparse.to_dense(decoded[0]).numpy()

        # Конвертируем индексы в строку
        plate_number = "".join(
            vocab[idx] for idx in indices[0] if idx < len(vocab)
        )

        # Уверенность: среднее максимальных softmax-вероятностей по временным шагам
        probabilities = tf.nn.softmax(pred_logits, axis=-1).numpy()
        max_probs = np.max(probabilities, axis=-1)  # (batch, time)
        confidence = float(np.mean(max_probs[0]))

        return plate_number, confidence

    def recognize_plate_ocr(self, plate_image: np.ndarray) -> Tuple[str, float]:
        """
        Распознавание номерного знака с помощью TensorFlow OCR-модели.

        Возвращает: (plate_number, confidence)
        """
        preprocessed = self._preprocess_plate_image(plate_image)
        pred_logits = self.ocr_model.predict_on_batch(preprocessed)
        plate_number, confidence = self._decode_ctc_predictions(pred_logits)
        return plate_number, confidence

    # ------------------------------------------------------------------
    # Вспомогательные методы
    # ------------------------------------------------------------------

    def calculate_bbox_size(self, bbox: List) -> float:
        """Вычисление площади bbox"""
        x1, y1, x2, y2 = bbox
        return (x2 - x1) * (y2 - y1)

    def determine_direction(
        self,
        bbox_sizes: List[float],
        db: Session,
        plate_number: str,
    ) -> PassDirection:
        """
        Определение направления движения.

        Логика:
        1. Если bbox увеличивается — въезд
        2. Если bbox уменьшается — выезд
        3. Если изменение мало или данных недостаточно — смотрим последнее
           состояние в БД
        """
        if len(bbox_sizes) < 2:
            return self._check_last_state(db, plate_number)

        size_change = (bbox_sizes[-1] - bbox_sizes[0]) / bbox_sizes[0]

        if abs(size_change) < settings.BBOX_SIZE_THRESHOLD:
            return self._check_last_state(db, plate_number)

        return PassDirection.ENTRY if size_change > 0 else PassDirection.EXIT

    @staticmethod
    def _normalize_plate(plate_number: str) -> str:
        """Нормализация номера: убираем пробелы, приводим к верхнему регистру"""
        return plate_number.replace(' ', '').upper()

    def _check_last_state(self, db: Session, plate_number: str) -> PassDirection:
        """Определение направления по последнему состоянию в БД"""
        normalized = self._normalize_plate(plate_number)
        vehicle = db.query(Vehicle).filter(
            func.upper(Vehicle.plate_number) == normalized
        ).first()

        if not vehicle:
            return PassDirection.UNKNOWN

        return PassDirection.EXIT if vehicle.on_territory else PassDirection.ENTRY

    def check_vehicle_access(
        self,
        db: Session,
        plate_number: str,
        check_time: datetime = None,
    ) -> Tuple[bool, Optional[Vehicle]]:
        """
        Проверка доступа машины.

        Возвращает: (has_access, vehicle)
        """
        from datetime import timezone as _tz
        check_time = check_time or datetime.now(_tz.utc)

        normalized = self._normalize_plate(plate_number)
        vehicle = db.query(Vehicle).filter(
            func.upper(Vehicle.plate_number) == normalized
        ).first()

        if not vehicle:
            return False, None

        accesses = db.query(Access).filter(
            Access.vehicle_id == vehicle.id,
            Access.is_active == True,
        ).all()

        for access in accesses:
            if access.is_valid_at(check_time):
                return True, vehicle

        return False, vehicle

    # ------------------------------------------------------------------
    # Обработка изображения
    # ------------------------------------------------------------------

    def process_image(self, image_data: bytes) -> dict:
        """
        Обработка одного изображения: детекция номерного знака и OCR.

        Возвращает словарь:
        {
            "plate_number": str | None,
            "confidence": float,
            "bbox": [x1, y1, x2, y2] | None,
            "annotated_image": bytes,   # JPEG с нарисованным bbox и номером
            "error": str | None
        }
        """
        import base64

        result = {
            "plate_number": None,
            "confidence": 0.0,
            "bbox": None,
            "annotated_image": None,
            "error": None,
        }

        nparr = np.frombuffer(image_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            result["error"] = "Не удалось декодировать изображение"
            result["annotated_image"] = base64.b64encode(image_data).decode("utf-8")
            return result

        annotated = frame.copy()

        detection = self.detect_plate_yolo(frame)
        if detection is None:
            _, buffer = cv2.imencode(".jpg", annotated)
            result["annotated_image"] = base64.b64encode(buffer.tobytes()).decode("utf-8")
            return result

        bbox, yolo_conf = detection
        x1, y1, x2, y2 = (int(c) for c in bbox)

        # Рисуем рамку вокруг номера
        cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 3)

        plate_image = frame[y1:y2, x1:x2]
        if plate_image.size > 0:
            plate_number, ocr_conf = self.recognize_plate_ocr(plate_image)
        else:
            plate_number, ocr_conf = "", 0.0

        confidence = yolo_conf * ocr_conf

        # Рисуем распознанный номер над рамкой
        label = plate_number if plate_number else "???"
        font_scale = max(0.8, min(2.0, (x2 - x1) / 150))
        cv2.putText(
            annotated,
            label,
            (x1, max(y1 - 10, 20)),
            cv2.FONT_HERSHEY_SIMPLEX,
            font_scale,
            (0, 255, 0),
            2,
            cv2.LINE_AA,
        )

        _, buffer = cv2.imencode(".jpg", annotated)
        result["plate_number"] = plate_number or None
        result["confidence"] = confidence
        result["bbox"] = [x1, y1, x2, y2]
        result["annotated_image"] = base64.b64encode(buffer.tobytes()).decode("utf-8")
        return result

    # ------------------------------------------------------------------
    # Обработка видео (Dask)
    # ------------------------------------------------------------------

    def _save_best_frame(self, frame: np.ndarray, bbox: List, plate_number: str, pass_uuid: str) -> Optional[str]:
        """
        Рисует bbox и номер на кадре, сохраняет JPEG в storage/frames/{uuid}.jpg.
        Возвращает путь к файлу или None при ошибке.
        """
        try:
            annotated = frame.copy()
            x1, y1, x2, y2 = (int(c) for c in bbox)
            cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 3)
            label = plate_number if plate_number else "???"
            font_scale = max(0.8, min(2.0, (x2 - x1) / 150))
            cv2.putText(
                annotated,
                label,
                (x1, max(y1 - 10, 20)),
                cv2.FONT_HERSHEY_SIMPLEX,
                font_scale,
                (0, 255, 0),
                2,
                cv2.LINE_AA,
            )
            frames_dir = Path("./storage/frames")
            frames_dir.mkdir(parents=True, exist_ok=True)
            frame_path = str(frames_dir / f"{pass_uuid}.jpg")
            cv2.imwrite(frame_path, annotated)
            return frame_path
        except Exception as e:
            logger.error(f"Ошибка сохранения кадра для {pass_uuid}: {e}")
            return None

    @delayed
    def process_video_frame_by_frame(
        self,
        video_path: str,
        pass_uuid: str,
    ) -> dict:
        """
        Покадровая обработка видео (выполняется в Dask).

        Возвращает словарь с результатами обработки.
        """
        logger.info(f"Начало обработки видео {video_path} для проезда {pass_uuid}")

        start_time = datetime.now()
        results = {
            "uuid": pass_uuid,
            "plate_number": None,
            "confidence": 0.0,
            "direction": PassDirection.UNKNOWN,
            "bbox_sizes": [],
            "frame_path": None,
            "error": None,
            "processing_time": 0.0,
        }

        try:
            cap = cv2.VideoCapture(video_path)

            if not cap.isOpened():
                raise RuntimeError(f"Не удалось открыть видео: {video_path}")

            frame_count = 0
            detected_plates = []
            bbox_sizes = []

            best_confidence = 0.0
            best_frame_data = None   # (frame, bbox, plate_number)

            frame_skip = 1

            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                frame_count += 1
                if frame_count % frame_skip != 0:
                    continue

                detection = self.detect_plate_yolo(frame)
                if detection is None:
                    continue

                bbox, yolo_conf = detection
                bbox_size = self.calculate_bbox_size(bbox)
                bbox_sizes.append(bbox_size)

                x1, y1, x2, y2 = (int(c) for c in bbox)
                plate_image = frame[y1:y2, x1:x2]

                if plate_image.size == 0:
                    continue

                plate_number, ocr_conf = self.recognize_plate_ocr(plate_image)
                combined_conf = yolo_conf * ocr_conf

                detected_plates.append(
                    {
                        "plate_number": plate_number,
                        "confidence": combined_conf,
                        "bbox_size": bbox_size,
                    }
                )

                if combined_conf > best_confidence:
                    best_confidence = combined_conf
                    best_frame_data = (frame.copy(), bbox, plate_number)

            cap.release()

            if detected_plates:
                best = max(detected_plates, key=lambda x: x["confidence"])
                results["plate_number"] = best["plate_number"]
                results["confidence"] = best["confidence"]
                results["bbox_sizes"] = bbox_sizes

            # Сохраняем лучший аннотированный кадр
            if best_frame_data is not None:
                frame_img, best_bbox, best_plate = best_frame_data
                results["frame_path"] = self._save_best_frame(
                    frame_img, best_bbox, best_plate, pass_uuid
                )

            processing_time = (datetime.now() - start_time).total_seconds()
            results["processing_time"] = processing_time

            logger.info(
                f"Видео обработано: {pass_uuid}, "
                f"Номер: {results['plate_number']}, "
                f"Уверенность: {results['confidence']:.2f}, "
                f"Время: {processing_time:.2f}с"
            )

        except Exception as e:
            logger.error(f"Ошибка при обработке видео {pass_uuid}: {e}")
            results["error"] = str(e)

        return results

    # ------------------------------------------------------------------
    # Обновление записи в БД
    # ------------------------------------------------------------------

    def update_pass_with_results(
        self,
        db: Session,
        pass_uuid: str,
        results: dict,
    ):
        """Обновление записи проезда результатами обработки"""
        pass_record = db.query(Pass).filter(Pass.uuid == pass_uuid).first()

        if not pass_record:
            logger.error(f"Проезд {pass_uuid} не найден в БД")
            return

        try:
            if results.get("error"):
                pass_record.status = PassStatus.FAILED
                pass_record.logs = results["error"]
            else:
                plate_number = results.get("plate_number")

                if not plate_number:
                    pass_record.status = PassStatus.FAILED
                    pass_record.logs = "Номер не распознан"
                else:
                    has_access, vehicle = self.check_vehicle_access(
                        db, plate_number
                    )

                    direction = self.determine_direction(
                        results.get("bbox_sizes", []),
                        db,
                        plate_number,
                    )

                    pass_record.plate_number_detected = plate_number
                    pass_record.confidence_level = results.get("confidence")
                    pass_record.direction = direction
                    pass_record.is_registered = has_access
                    pass_record.entry_exit_time = datetime.now()
                    pass_record.processing_time = results.get("processing_time")
                    pass_record.status = PassStatus.COMPLETE

                    if vehicle:
                        pass_record.vehicle_id = vehicle.id

                        if direction == PassDirection.ENTRY:
                            vehicle.on_territory = True
                        elif direction == PassDirection.EXIT:
                            vehicle.on_territory = False
                    else:
                        pass_record.logs = "Незарегистрированная машина"

            db.commit()
            logger.info(f"Проезд {pass_uuid} обновлён в БД")

        except Exception as e:
            db.rollback()
            logger.error(f"Ошибка при обновлении проезда {pass_uuid}: {e}")
            pass_record.status = PassStatus.FAILED
            pass_record.logs = f"Ошибка обновления БД: {e}"
            db.commit()


# Глобальный экземпляр сервиса
video_service = VideoProcessingService()
