"""
Скрипт для инициализации базы данных с тестовыми данными
"""
from datetime import datetime, timedelta
from database.session import SessionLocal, engine, Base
from database.models import (
    User, Employee, Vehicle, Access, Pass,
    UserRole, PassStatus, PassDirection
)
from utils.security import get_password_hash
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def init_database():
    """Создание таблиц в базе данных"""
    logger.info("Создание таблиц в базе данных...")
    Base.metadata.create_all(bind=engine)
    logger.info("✓ Таблицы созданы")


def create_test_data():
    """Создание тестовых данных"""
    db = SessionLocal()
    
    try:
        logger.info("Создание тестовых данных...")
        
        # 1. Создание администратора
        logger.info("Создание администратора...")
        admin_user = User(
            username="admin",
            hashed_password=get_password_hash("admin123"),
            role=UserRole.ADMIN,
            is_active=True
        )
        db.add(admin_user)
        
        # 2. Создание оператора
        logger.info("Создание оператора...")
        operator_user = User(
            username="operator",
            hashed_password=get_password_hash("operator123"),
            role=UserRole.OPERATOR,
            is_active=True
        )
        db.add(operator_user)
        
        # 3. Создание сотрудников
        logger.info("Создание сотрудников...")
        employees = [
            Employee(
                full_name="Иванов Иван Иванович",
                position="Директор",
                contact_info="+7 (999) 111-11-11"
            ),
            Employee(
                full_name="Петров Петр Петрович",
                position="Менеджер",
                contact_info="+7 (999) 222-22-22"
            ),
            Employee(
                full_name="Сидорова Мария Александровна",
                position="Бухгалтер",
                contact_info="+7 (999) 333-33-33"
            ),
            Employee(
                full_name="Козлов Алексей Викторович",
                position="Водитель",
                contact_info="+7 (999) 444-44-44"
            ),
        ]
        
        for emp in employees:
            db.add(emp)
        
        db.commit()
        
        # Обновляем связь пользователей с сотрудниками
        admin_user.employee_id = employees[0].id
        operator_user.employee_id = employees[1].id
        
        # 4. Создание автомобилей
        logger.info("Создание автомобилей...")
        vehicles = [
            Vehicle(
                plate_number="А123БВ777",
                transport_type="Легковой автомобиль",
                employee_id=employees[0].id,
                is_guest=False,
                on_territory=False
            ),
            Vehicle(
                plate_number="В456ГД199",
                transport_type="Грузовой автомобиль",
                employee_id=employees[1].id,
                is_guest=False,
                on_territory=True
            ),
            Vehicle(
                plate_number="Е789ЖЗ777",
                transport_type="Легковой автомобиль",
                employee_id=employees[2].id,
                is_guest=False,
                on_territory=False
            ),
            Vehicle(
                plate_number="К012ЛМ199",
                transport_type="Грузовой автомобиль",
                employee_id=employees[3].id,
                is_guest=False,
                on_territory=False
            ),
            Vehicle(
                plate_number="Н345ОП777",
                transport_type="Легковой автомобиль",
                employee_id=None,
                is_guest=True,
                on_territory=False
            ),
        ]
        
        for vehicle in vehicles:
            db.add(vehicle)
        
        db.commit()
        
        # 5. Создание доступов
        logger.info("Создание доступов...")
        now = datetime.now()
        
        accesses = [
            # Бессрочный доступ для директора
            Access(
                vehicle_id=vehicles[0].id,
                valid_from=now - timedelta(days=365),
                valid_until=None,
                is_active=True
            ),
            # Доступ на год для менеджера
            Access(
                vehicle_id=vehicles[1].id,
                valid_from=now - timedelta(days=30),
                valid_until=now + timedelta(days=335),
                is_active=True
            ),
            # Доступ на полгода для бухгалтера
            Access(
                vehicle_id=vehicles[2].id,
                valid_from=now - timedelta(days=30),
                valid_until=now + timedelta(days=150),
                is_active=True
            ),
            # Истекший доступ для водителя
            Access(
                vehicle_id=vehicles[3].id,
                valid_from=now - timedelta(days=180),
                valid_until=now - timedelta(days=1),
                is_active=True
            ),
            # Временный доступ для гостя
            Access(
                vehicle_id=vehicles[4].id,
                valid_from=now,
                valid_until=now + timedelta(days=7),
                is_active=True
            ),
        ]
        
        for access in accesses:
            db.add(access)
        
        db.commit()
        
        # 6. Создание тестовых проездов
        logger.info("Создание тестовых проездов...")
        passes = [
            Pass(
                uuid="550e8400-e29b-41d4-a716-446655440001",
                vehicle_id=vehicles[0].id,
                plate_number_detected="А123БВ777",
                direction=PassDirection.ENTRY,
                video_path="/videos/test_entry_1.mp4",
                confidence_level=0.95,
                processing_time=3.5,
                status=PassStatus.COMPLETE,
                entry_exit_time=now - timedelta(hours=2),
                is_registered=True
            ),
            Pass(
                uuid="550e8400-e29b-41d4-a716-446655440002",
                vehicle_id=vehicles[1].id,
                plate_number_detected="В456ГД199",
                direction=PassDirection.ENTRY,
                video_path="/videos/test_entry_2.mp4",
                confidence_level=0.88,
                processing_time=4.2,
                status=PassStatus.COMPLETE,
                entry_exit_time=now - timedelta(hours=4),
                is_registered=True
            ),
            Pass(
                uuid="550e8400-e29b-41d4-a716-446655440003",
                vehicle_id=None,
                plate_number_detected="Х999УФ123",
                direction=PassDirection.ENTRY,
                video_path="/videos/test_entry_3.mp4",
                confidence_level=0.82,
                processing_time=5.1,
                status=PassStatus.COMPLETE,
                entry_exit_time=now - timedelta(hours=1),
                is_registered=False,
                logs="Незарегистрированная машина"
            ),
        ]
        
        for pass_record in passes:
            db.add(pass_record)
        
        db.commit()
        
        logger.info("✓ Тестовые данные созданы успешно!")
        logger.info("\nУчетные данные для входа:")
        logger.info("Администратор: admin / admin123")
        logger.info("Оператор: operator / operator123")
        
    except Exception as e:
        db.rollback()
        logger.error(f"✗ Ошибка при создании тестовых данных: {str(e)}")
        raise
    finally:
        db.close()


def main():
    """Основная функция"""
    logger.info("=" * 60)
    logger.info("Инициализация базы данных Vehicle Access Control")
    logger.info("=" * 60)
    
    # Создание таблиц
    init_database()
    
    # Создание тестовых данных
    create_test_data()
    
    logger.info("=" * 60)
    logger.info("Инициализация завершена!")
    logger.info("=" * 60)
    logger.info("\nЗапустите приложение командой: python main.py")
    logger.info("API документация: http://localhost:8000/docs")


if __name__ == "__main__":
    main()
