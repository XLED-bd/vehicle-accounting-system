"""
API endpoints для управления автомобилями
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

from database.session import get_db
from database.models import Vehicle, User
from schemas.schemas import VehicleCreate, VehicleUpdate, VehicleResponse, VehicleWithEmployee
from utils.security import get_current_active_user

router = APIRouter()


@router.get("", response_model=List[VehicleWithEmployee])
async def get_vehicles(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    on_territory: Optional[bool] = None,
    is_guest: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение списка автомобилей с фильтрацией
    """
    query = db.query(Vehicle).options(joinedload(Vehicle.employee))
    
    if on_territory is not None:
        query = query.filter(Vehicle.on_territory == on_territory)
    
    if is_guest is not None:
        query = query.filter(Vehicle.is_guest == is_guest)
    
    vehicles = query.offset(skip).limit(limit).all()
    return vehicles


@router.get("/on-territory", response_model=List[VehicleWithEmployee])
async def get_vehicles_on_territory(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение списка автомобилей, находящихся на территории
    """
    vehicles = db.query(Vehicle).options(
        joinedload(Vehicle.employee)
    ).filter(
        Vehicle.on_territory == True
    ).all()
    
    return vehicles


@router.get("/{vehicle_id}", response_model=VehicleWithEmployee)
async def get_vehicle(
    vehicle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение автомобиля по ID
    """
    vehicle = db.query(Vehicle).options(
        joinedload(Vehicle.employee)
    ).filter(Vehicle.id == vehicle_id).first()
    
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found"
        )
    
    return vehicle


@router.get("/plate/{plate_number}", response_model=VehicleWithEmployee)
async def get_vehicle_by_plate(
    plate_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение автомобиля по номеру
    """
    vehicle = db.query(Vehicle).options(
        joinedload(Vehicle.employee)
    ).filter(Vehicle.plate_number == plate_number).first()
    
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vehicle with plate number {plate_number} not found"
        )
    
    return vehicle


@router.post("", response_model=VehicleResponse, status_code=status.HTTP_201_CREATED)
async def create_vehicle(
    vehicle_data: VehicleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Создание нового автомобиля
    """
    # Проверяем, существует ли уже автомобиль с таким номером
    existing_vehicle = db.query(Vehicle).filter(
        Vehicle.plate_number == vehicle_data.plate_number
    ).first()
    
    if existing_vehicle:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Vehicle with plate number {vehicle_data.plate_number} already exists"
        )
    
    new_vehicle = Vehicle(**vehicle_data.model_dump())
    
    db.add(new_vehicle)
    db.commit()
    db.refresh(new_vehicle)
    
    return new_vehicle


@router.put("/{vehicle_id}", response_model=VehicleResponse)
async def update_vehicle(
    vehicle_id: int,
    vehicle_data: VehicleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Обновление автомобиля
    """
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found"
        )
    
    # Если обновляется номер, проверяем уникальность
    update_data = vehicle_data.model_dump(exclude_unset=True)
    
    if 'plate_number' in update_data:
        existing = db.query(Vehicle).filter(
            Vehicle.plate_number == update_data['plate_number'],
            Vehicle.id != vehicle_id
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Vehicle with plate number {update_data['plate_number']} already exists"
            )
    
    for field, value in update_data.items():
        setattr(vehicle, field, value)
    
    db.commit()
    db.refresh(vehicle)
    
    return vehicle


@router.delete("/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vehicle(
    vehicle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Удаление автомобиля
    """
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found"
        )
    
    db.delete(vehicle)
    db.commit()
    
    return None
