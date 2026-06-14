from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, Enum as SQLEnum, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.session import Base
import enum
from datetime import datetime, timezone


class PassStatus(str, enum.Enum):
    """Статусы обработки проезда"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETE = "complete"
    FAILED = "failed"


class PassDirection(str, enum.Enum):
    """Направление проезда"""
    ENTRY = "entry"  # Въезд
    EXIT = "exit"    # Выезд
    UNKNOWN = "unknown"  # Не определено


class UserRole(str, enum.Enum):
    """Роли пользователей"""
    ADMIN = "administrator"
    OPERATOR = "operator"


class Employee(Base):
    """Модель сотрудника"""
    __tablename__ = "employees"
    
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(255), nullable=False, comment="ФИО сотрудника")
    position = Column(String(255), nullable=True, comment="Должность")
    contact_info = Column(Text, nullable=True, comment="Контактная информация")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Связи
    vehicles = relationship("Vehicle", back_populates="employee")
    
    def __repr__(self):
        return f"<Employee {self.full_name}>"


class Vehicle(Base):
    """Модель автомобиля"""
    __tablename__ = "vehicles"
    
    id = Column(Integer, primary_key=True, index=True)
    plate_number = Column(String(20), unique=True, nullable=False, index=True, comment="Номер машины")
    transport_type = Column(String(100), nullable=True, comment="Тип транспорта")
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True, comment="ID сотрудника")
    is_guest = Column(Boolean, default=False, comment="Гостевая машина")
    on_territory = Column(Boolean, default=False, comment="На территории (true/false)")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Связи
    employee = relationship("Employee", back_populates="vehicles")
    passes = relationship("Pass", back_populates="vehicle")
    accesses = relationship("Access", back_populates="vehicle")
    
    def __repr__(self):
        return f"<Vehicle {self.plate_number}>"


class Access(Base):
    """Модель доступа"""
    __tablename__ = "accesses"
    
    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=False, comment="ID номера машины")
    valid_from = Column(DateTime(timezone=True), nullable=False, comment="Начало периода действия")
    valid_until = Column(DateTime(timezone=True), nullable=True, comment="Конец периода действия (NULL = бессрочно)")
    is_active = Column(Boolean, default=True, comment="Активен ли доступ")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Связи
    vehicle = relationship("Vehicle", back_populates="accesses")
    
    def is_valid_at(self, check_time: datetime = None) -> bool:
        """Проверка валидности доступа на момент времени"""
        if not self.is_active:
            return False

        if check_time is None:
            check_time = datetime.now(timezone.utc)

        # Приводим check_time к тому же типу (aware/naive), что и DB-значения
        def make_comparable(dt: datetime, reference: datetime) -> datetime:
            if reference is None:
                return dt
            if reference.tzinfo is not None and dt.tzinfo is None:
                return dt.replace(tzinfo=timezone.utc)
            if reference.tzinfo is None and dt.tzinfo is not None:
                return dt.replace(tzinfo=None)
            return dt

        check_time = make_comparable(check_time, self.valid_from)

        if check_time < self.valid_from:
            return False

        if self.valid_until:
            check_time_until = make_comparable(check_time, self.valid_until)
            if check_time_until > self.valid_until:
                return False

        return True
    
    def __repr__(self):
        return f"<Access vehicle_id={self.vehicle_id}>"


class Pass(Base):
    """Модель проезда"""
    __tablename__ = "passes"
    
    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, nullable=False, index=True, comment="UUID проезда")
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=True, comment="ID машины")
    plate_number_detected = Column(String(20), nullable=True, comment="Распознанный номер")
    direction = Column(SQLEnum(PassDirection), nullable=True, comment="Направление (въезд/выезд)")
    video_path = Column(String(500), nullable=False, comment="Путь до видео")
    confidence_level = Column(Float, nullable=True, comment="Уверенность распознавания")
    processing_time = Column(Float, nullable=True, comment="Время обработки (секунды)")
    status = Column(SQLEnum(PassStatus), default=PassStatus.PENDING, nullable=False, comment="Статус обработки")
    logs = Column(Text, nullable=True, comment="Логи/ошибки при обработке")
    entry_exit_time = Column(DateTime(timezone=True), nullable=True, comment="Время въезда/выезда")
    is_registered = Column(Boolean, default=False, comment="Зарегистрирована ли машина")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Связи
    vehicle = relationship("Vehicle", back_populates="passes")
    
    def __repr__(self):
        return f"<Pass {self.uuid} - {self.status}>"


class User(Base):
    """Модель пользователя системы"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True, comment="Логин")
    hashed_password = Column(String(255), nullable=False, comment="Хеш пароля")
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True, comment="ID сотрудника")
    role = Column(SQLEnum(UserRole), default=UserRole.OPERATOR, nullable=False, comment="Роль")
    is_active = Column(Boolean, default=True, comment="Активен ли пользователь")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Связи
    employee = relationship("Employee")
    
    def __repr__(self):
        return f"<User {self.username} - {self.role}>"
