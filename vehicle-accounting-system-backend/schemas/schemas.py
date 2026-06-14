"""
Pydantic схемы для валидации данных
"""
from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from database.models import PassStatus, PassDirection, UserRole


# ==================== Схемы для Пользователей ====================

class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    role: UserRole = UserRole.OPERATOR


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)
    employee_id: Optional[int] = None


class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=100)
    password: Optional[str] = Field(None, min_length=6)
    role: Optional[UserRole] = None
    employee_id: Optional[int] = None
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    id: int
    employee_id: Optional[int]
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# ==================== Схемы для Авторизации ====================

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    username: Optional[str] = None


class LoginRequest(BaseModel):
    username: str
    password: str


# ==================== Схемы для Сотрудников ====================

class EmployeeBase(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255)
    position: Optional[str] = Field(None, max_length=255)
    contact_info: Optional[str] = None


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    position: Optional[str] = Field(None, max_length=255)
    contact_info: Optional[str] = None


class EmployeeResponse(EmployeeBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


# ==================== Схемы для Автомобилей ====================

class VehicleBase(BaseModel):
    plate_number: str = Field(..., min_length=1, max_length=20)
    transport_type: Optional[str] = Field(None, max_length=100)
    employee_id: Optional[int] = None
    is_guest: bool = False


class VehicleCreate(VehicleBase):
    pass


class VehicleUpdate(BaseModel):
    plate_number: Optional[str] = Field(None, min_length=1, max_length=20)
    transport_type: Optional[str] = Field(None, max_length=100)
    employee_id: Optional[int] = None
    is_guest: Optional[bool] = None
    on_territory: Optional[bool] = None


class VehicleResponse(VehicleBase):
    id: int
    on_territory: bool
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class VehicleWithEmployee(VehicleResponse):
    employee: Optional[EmployeeResponse] = None
    
    class Config:
        from_attributes = True


# ==================== Схемы для Доступов ====================

class AccessBase(BaseModel):
    vehicle_id: int
    valid_from: datetime
    valid_until: Optional[datetime] = None
    is_active: bool = True


class AccessCreate(AccessBase):
    pass


class AccessUpdate(BaseModel):
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    is_active: Optional[bool] = None


class AccessResponse(AccessBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class AccessWithVehicle(AccessResponse):
    vehicle: Optional[VehicleResponse] = None
    
    class Config:
        from_attributes = True


# ==================== Схемы для Проездов ====================

class PassBase(BaseModel):
    video_path: str


class PassCreate(PassBase):
    pass


class PassUpdate(BaseModel):
    status: Optional[PassStatus] = None
    logs: Optional[str] = None


class PassResponse(BaseModel):
    id: int
    uuid: str
    vehicle_id: Optional[int]
    plate_number_detected: Optional[str]
    direction: Optional[PassDirection]
    video_path: str
    confidence_level: Optional[float]
    processing_time: Optional[float]
    status: PassStatus
    logs: Optional[str]
    entry_exit_time: Optional[datetime]
    is_registered: bool
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class PassWithVehicle(PassResponse):
    vehicle: Optional[VehicleWithEmployee] = None
    
    class Config:
        from_attributes = True


# ==================== Схемы для обработки видео ====================

class VideoProcessRequest(BaseModel):
    """Запрос на обработку видео"""
    video_path: str = Field(..., description="Путь к видеофайлу")


class VideoProcessResponse(BaseModel):
    """Ответ на запрос обработки видео"""
    uuid: str = Field(..., description="UUID проезда")
    status: str = Field(..., description="Статус обработки")
    message: str = Field(..., description="Сообщение")


class EventResponse(BaseModel):
    """Ответ с информацией о событии проезда"""
    uuid: str
    status: PassStatus
    plate_number: Optional[str] = None
    direction: Optional[PassDirection] = None
    confidence_level: Optional[float] = None
    is_registered: bool = False
    entry_exit_time: Optional[datetime] = None
    vehicle: Optional[VehicleWithEmployee] = None
    employee: Optional[EmployeeResponse] = None
    processing_time: Optional[float] = None
    logs: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# ==================== Схемы для обработки изображений ====================

class ImageProcessResponse(BaseModel):
    """Ответ на запрос обработки изображения"""
    plate_number: Optional[str] = Field(None, description="Распознанный номерной знак")
    confidence: float = Field(0.0, description="Уверенность распознавания")
    vehicle_found: bool = Field(False, description="Найден ли автомобиль в базе")
    on_territory: Optional[bool] = Field(None, description="Новый статус (на территории или нет)")
    annotated_image: Optional[str] = Field(None, description="Изображение с выделением (base64 JPEG)")
    message: str = Field("", description="Статусное сообщение")


# ==================== Схемы для статистики ====================

class StatisticsResponse(BaseModel):
    """Статистика по проездам"""
    total_passes: int
    successful_passes: int
    failed_passes: int
    pending_passes: int
    registered_vehicles: int
    unregistered_entries: int
    vehicles_on_territory: int
