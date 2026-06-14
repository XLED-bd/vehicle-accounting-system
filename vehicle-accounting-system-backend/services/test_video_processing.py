"""
Юнит-тесты для VideoProcessingService
filepath: services/test_video_processing.py
"""
import unittest
from unittest.mock import Mock, patch, MagicMock
import numpy as np
from datetime import datetime

from services.video_processing import VideoProcessingService
from database.models import PassDirection


class TestVideoProcessingService(unittest.TestCase):
    """Тесты для VideoProcessingService"""
    
    def setUp(self):
        """Подготовка к каждому тесту"""
        self.service = VideoProcessingService()
    
    def test_calculate_bbox_size_valid_bbox(self):
        """Тест вычисления размера bbox с корректными координатами"""
        bbox = [10, 20, 100, 120]  # x1, y1, x2, y2
        expected_size = (100 - 10) * (120 - 20)  # 90 * 100 = 9000
        
        result = self.service.calculate_bbox_size(bbox)
        
        self.assertEqual(result, expected_size)
        self.assertEqual(result, 9000)
    
    def test_calculate_bbox_size_small_bbox(self):
        """Тест вычисления размера маленького bbox"""
        bbox = [0, 0, 50, 50]
        expected_size = 50 * 50  # 2500
        
        result = self.service.calculate_bbox_size(bbox)
        
        self.assertEqual(result, expected_size)
    
    def test_detect_plate_yolo_returns_bbox_and_confidence(self):
        """Тест детекции номера - проверка формата возвращаемых данных"""
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        
        result = self.service.detect_plate_yolo(frame)
        
        self.assertIsNotNone(result)
        self.assertEqual(len(result), 2)
        bbox, confidence = result
        
        self.assertEqual(len(bbox), 4)
        self.assertGreater(confidence, 0)
        self.assertLessEqual(confidence, 1.0)
    
    def test_recognize_plate_ocr_returns_plate_and_confidence(self):
        """Тест распознавания номера - проверка формата и диапазонов"""
        plate_image = np.zeros((100, 300, 3), dtype=np.uint8)
        
        plate_number, confidence = self.service.recognize_plate_ocr(plate_image)
        
        self.assertIsInstance(plate_number, str)
        self.assertGreater(len(plate_number), 0)
        self.assertGreater(confidence, 0)
        self.assertLessEqual(confidence, 1.0)
    
    def test_determine_direction_insufficient_data_uses_db(self):
        """Тест определения направления при недостаточных данных"""
        mock_db = Mock()
        bbox_sizes = [100]  # Недостаточно данных (нужно минимум 2)
        plate_number = "А123БВ777"
        
        with patch.object(
            self.service, 
            '_check_last_state', 
            return_value=PassDirection.ENTRY
        ) as mock_check:
            result = self.service.determine_direction(
                bbox_sizes, 
                mock_db, 
                plate_number
            )
            
            mock_check.assert_called_once_with(mock_db, plate_number)
            self.assertEqual(result, PassDirection.ENTRY)
    
    def test_determine_direction_increasing_size_is_entry(self):
        """Тест: увеличивающийся bbox = въезд"""
        mock_db = Mock()
        bbox_sizes = [1000.0, 1500.0, 2000.0]  # Увеличение > порога
        plate_number = "А123БВ777"
        
        with patch('services.video_processing.settings') as mock_settings:
            mock_settings.BBOX_SIZE_THRESHOLD = 0.1
            result = self.service.determine_direction(
                bbox_sizes,
                mock_db,
                plate_number
            )
            
            self.assertEqual(result, PassDirection.ENTRY)
    
    def test_determine_direction_decreasing_size_is_exit(self):
        """Тест: уменьшающийся bbox = выезд"""
        mock_db = Mock()
        bbox_sizes = [2000.0, 1500.0, 1000.0]  # Уменьшение > порога
        plate_number = "А123БВ777"
        
        with patch('services.video_processing.settings') as mock_settings:
            mock_settings.BBOX_SIZE_THRESHOLD = 0.1
            result = self.service.determine_direction(
                bbox_sizes,
                mock_db,
                plate_number
            )
            
            self.assertEqual(result, PassDirection.EXIT)


class TestVideoProcessingServiceIntegration(unittest.TestCase):
    """Интеграционные тесты с моками БД"""
    
    def setUp(self):
        """Подготовка к каждому тесту"""
        self.service = VideoProcessingService()
        self.mock_db = Mock()
    
    def test_check_vehicle_access_vehicle_not_found(self):
        """Тест проверки доступа - машина не найдена"""
        self.mock_db.query.return_value.filter.return_value.first.return_value = None
        has_access, vehicle = self.service.check_vehicle_access(
            self.mock_db,
            "А123БВ777"
        )
        self.assertFalse(has_access)
        self.assertIsNone(vehicle)
    
    def test_check_vehicle_access_vehicle_found_no_accesses(self):
        """Тест проверки доступа - машина найдена, но доступов нет"""
        mock_vehicle = Mock()
        mock_vehicle.id = 1
        
        query_mock = Mock()
        filter_mock = Mock()
        
        self.mock_db.query.return_value = query_mock
        query_mock.filter.return_value = filter_mock
        
        filter_mock.first.return_value = mock_vehicle
        filter_mock.all.return_value = []
        
        has_access, vehicle = self.service.check_vehicle_access(
            self.mock_db,
            "А123БВ777"
        )
        self.assertFalse(has_access)
        self.assertEqual(vehicle, mock_vehicle)


def run_tests():
    """Запуск всех тестов"""
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    suite.addTests(loader.loadTestsFromTestCase(TestVideoProcessingService))
    suite.addTests(loader.loadTestsFromTestCase(TestVideoProcessingServiceIntegration))
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_tests()
    exit(0 if success else 1)