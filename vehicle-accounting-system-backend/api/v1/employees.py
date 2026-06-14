"""
API endpoints для управления сотрудниками
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List

from database.session import get_db
from database.models import Employee, User
from schemas.schemas import EmployeeCreate, EmployeeUpdate, EmployeeResponse
from utils.security import get_current_active_user

router = APIRouter()


@router.get("", response_model=List[EmployeeResponse])
async def get_employees(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение списка всех сотрудников
    """
    employees = db.query(Employee).offset(skip).limit(limit).all()
    return employees


@router.get("/{employee_id}", response_model=EmployeeResponse)
async def get_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Получение сотрудника по ID
    """
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    
    return employee


@router.get("/search/by-name")
async def search_employees_by_name(
    name: str = Query(..., min_length=2),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Поиск сотрудников по имени
    """
    employees = db.query(Employee).filter(
        Employee.full_name.ilike(f"%{name}%")
    ).all()
    
    return employees


@router.post("", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    employee_data: EmployeeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Создание нового сотрудника
    """
    new_employee = Employee(**employee_data.model_dump())
    
    db.add(new_employee)
    db.commit()
    db.refresh(new_employee)
    
    return new_employee


@router.put("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: int,
    employee_data: EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Обновление сотрудника
    """
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    
    update_data = employee_data.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(employee, field, value)
    
    db.commit()
    db.refresh(employee)
    
    return employee


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Удаление сотрудника
    """
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    
    db.delete(employee)
    db.commit()
    
    return None
