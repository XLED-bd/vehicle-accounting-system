"""
API endpoints для управления доступами
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime

from database.session import get_db
from database.models import Access, Vehicle, User
from schemas.schemas import AccessCreate, AccessUpdate, AccessResponse, AccessWithVehicle
from utils.security import get_current_active_user

router = APIRouter()


@router.get("", response_model=List[AccessWithVehicle])
async def get_accesses(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    is_active: Optional[bool] = None,
    vehicle_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение списка доступов с фильтрацией
    """
    query = db.query(Access).options(joinedload(Access.vehicle))
    
    if is_active is not None:
        query = query.filter(Access.is_active == is_active)
    
    if vehicle_id is not None:
        query = query.filter(Access.vehicle_id == vehicle_id)
    
    accesses = query.offset(skip).limit(limit).all()
    return accesses


@router.get("/active", response_model=List[AccessWithVehicle])
async def get_active_accesses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение всех активных доступов
    """
    current_time = datetime.now()
    
    accesses = db.query(Access).options(
        joinedload(Access.vehicle)
    ).filter(
        Access.is_active == True,
        Access.valid_from <= current_time
    ).filter(
        (Access.valid_until == None) | (Access.valid_until >= current_time)
    ).all()
    
    return accesses


@router.get("/expired", response_model=List[AccessWithVehicle])
async def get_expired_accesses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение истекших доступов
    """
    current_time = datetime.now()
    
    accesses = db.query(Access).options(
        joinedload(Access.vehicle)
    ).filter(
        Access.valid_until != None,
        Access.valid_until < current_time
    ).all()
    
    return accesses


@router.get("/{access_id}", response_model=AccessWithVehicle)
async def get_access(
    access_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение доступа по ID
    """
    access = db.query(Access).options(
        joinedload(Access.vehicle)
    ).filter(Access.id == access_id).first()
    
    if not access:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Access not found"
        )
    
    return access


@router.get("/vehicle/{vehicle_id}/accesses", response_model=List[AccessResponse])
async def get_vehicle_accesses(
    vehicle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение всех доступов для конкретного автомобиля
    """
    # Проверяем существование автомобиля
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found"
        )
    
    accesses = db.query(Access).filter(
        Access.vehicle_id == vehicle_id
    ).all()
    
    return accesses


@router.post("", response_model=AccessResponse, status_code=status.HTTP_201_CREATED)
async def create_access(
    access_data: AccessCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Создание нового доступа
    """
    # Проверяем существование автомобиля
    vehicle = db.query(Vehicle).filter(Vehicle.id == access_data.vehicle_id).first()
    
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found"
        )
    
    # Проверяем валидность дат
    if access_data.valid_until and access_data.valid_from >= access_data.valid_until:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="valid_from must be before valid_until"
        )
    
    new_access = Access(**access_data.model_dump())
    
    db.add(new_access)
    db.commit()
    db.refresh(new_access)
    
    return new_access


@router.put("/{access_id}", response_model=AccessResponse)
async def update_access(
    access_id: int,
    access_data: AccessUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Обновление доступа
    """
    access = db.query(Access).filter(Access.id == access_id).first()
    
    if not access:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Access not found"
        )
    
    update_data = access_data.model_dump(exclude_unset=True)
    
    # Проверяем валидность дат если они обновляются
    valid_from = update_data.get('valid_from', access.valid_from)
    valid_until = update_data.get('valid_until', access.valid_until)
    
    if valid_until and valid_from >= valid_until:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="valid_from must be before valid_until"
        )
    
    for field, value in update_data.items():
        setattr(access, field, value)
    
    db.commit()
    db.refresh(access)
    
    return access


@router.delete("/{access_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_access(
    access_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Удаление доступа
    """
    access = db.query(Access).filter(Access.id == access_id).first()
    
    if not access:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Access not found"
        )
    
    db.delete(access)
    db.commit()
    
    return None


@router.post("/{access_id}/deactivate", response_model=AccessResponse)
async def deactivate_access(
    access_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Деактивация доступа
    """
    access = db.query(Access).filter(Access.id == access_id).first()
    
    if not access:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Access not found"
        )
    
    access.is_active = False
    db.commit()
    db.refresh(access)
    
    return access


@router.post("/{access_id}/activate", response_model=AccessResponse)
async def activate_access(
    access_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Активация доступа
    """
    access = db.query(Access).filter(Access.id == access_id).first()
    
    if not access:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Access not found"
        )
    
    access.is_active = True
    db.commit()
    db.refresh(access)
    
    return access
