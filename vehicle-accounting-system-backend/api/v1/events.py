"""
API endpoints для получения информации о событиях проезда
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

from database.session import get_db
from database.models import Pass, User, Vehicle, Employee, PassStatus
from schemas.schemas import EventResponse, PassWithVehicle, PassResponse, StatisticsResponse
from utils.security import get_current_active_user

router = APIRouter()


@router.get("/events/{uuid}", response_model=EventResponse)
async def get_event_by_uuid(
    uuid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение информации о проезде по UUID
    
    Возвращает номер машины, сотрудника и все детали проезда
    """
    # Загружаем проезд с связанными данными
    pass_record = db.query(Pass).options(
        joinedload(Pass.vehicle).joinedload(Vehicle.employee)
    ).filter(Pass.uuid == uuid).first()
    
    if not pass_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with UUID {uuid} not found"
        )
    
    # Формируем ответ
    response = {
        "uuid": pass_record.uuid,
        "status": pass_record.status,
        "plate_number": pass_record.plate_number_detected,
        "direction": pass_record.direction,
        "confidence_level": pass_record.confidence_level,
        "is_registered": pass_record.is_registered,
        "entry_exit_time": pass_record.entry_exit_time,
        "processing_time": pass_record.processing_time,
        "logs": pass_record.logs,
        "created_at": pass_record.created_at,
        "vehicle": None,
        "employee": None
    }
    
    # Добавляем информацию о машине и сотруднике
    if pass_record.vehicle:
        vehicle_data = {
            "id": pass_record.vehicle.id,
            "plate_number": pass_record.vehicle.plate_number,
            "transport_type": pass_record.vehicle.transport_type,
            "employee_id": pass_record.vehicle.employee_id,
            "is_guest": pass_record.vehicle.is_guest,
            "on_territory": pass_record.vehicle.on_territory,
            "created_at": pass_record.vehicle.created_at,
            "updated_at": pass_record.vehicle.updated_at
        }
        
        if pass_record.vehicle.employee:
            employee_data = {
                "id": pass_record.vehicle.employee.id,
                "full_name": pass_record.vehicle.employee.full_name,
                "position": pass_record.vehicle.employee.position,
                "contact_info": pass_record.vehicle.employee.contact_info,
                "created_at": pass_record.vehicle.employee.created_at,
                "updated_at": pass_record.vehicle.employee.updated_at
            }
            vehicle_data["employee"] = employee_data
            response["employee"] = employee_data
        
        response["vehicle"] = vehicle_data
    
    return response


@router.get("/events", response_model=List[PassResponse])
async def get_all_events(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status_filter: Optional[PassStatus] = None,
    registered_only: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение списка всех событий проезда с фильтрацией
    """
    query = db.query(Pass)
    
    # Применяем фильтры
    if status_filter:
        query = query.filter(Pass.status == status_filter)
    
    if registered_only is not None:
        query = query.filter(Pass.is_registered == registered_only)
    
    # Сортируем по дате создания (новые первыми)
    query = query.order_by(Pass.created_at.desc())
    
    # Пагинация
    passes = query.offset(skip).limit(limit).all()
    
    return passes


@router.get("/events/recent/unregistered", response_model=List[PassResponse])
async def get_recent_unregistered_events(
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение недавних проездов незарегистрированных машин
    """
    passes = db.query(Pass).filter(
        Pass.is_registered == False,
        Pass.status == PassStatus.COMPLETE
    ).order_by(
        Pass.created_at.desc()
    ).limit(limit).all()
    
    return passes


@router.get("/events/vehicle/{plate_number}", response_model=List[PassResponse])
async def get_events_by_plate(
    plate_number: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение всех проездов конкретной машины по номеру
    """
    passes = db.query(Pass).filter(
        Pass.plate_number_detected == plate_number
    ).order_by(
        Pass.created_at.desc()
    ).offset(skip).limit(limit).all()
    
    if not passes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No events found for plate number {plate_number}"
        )
    
    return passes


@router.get("/statistics", response_model=StatisticsResponse)
async def get_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение общей статистики по проездам
    """
    total_passes = db.query(Pass).count()
    successful_passes = db.query(Pass).filter(Pass.status == PassStatus.COMPLETE).count()
    failed_passes = db.query(Pass).filter(Pass.status == PassStatus.FAILED).count()
    pending_passes = db.query(Pass).filter(
        Pass.status.in_([PassStatus.PENDING, PassStatus.RUNNING])
    ).count()
    
    registered_vehicles = db.query(Vehicle).count()
    unregistered_entries = db.query(Pass).filter(
        Pass.is_registered == False,
        Pass.status == PassStatus.COMPLETE
    ).count()
    
    vehicles_on_territory = db.query(Vehicle).filter(
        Vehicle.on_territory == True
    ).count()
    
    return {
        "total_passes": total_passes,
        "successful_passes": successful_passes,
        "failed_passes": failed_passes,
        "pending_passes": pending_passes,
        "registered_vehicles": registered_vehicles,
        "unregistered_entries": unregistered_entries,
        "vehicles_on_territory": vehicles_on_territory
    }
