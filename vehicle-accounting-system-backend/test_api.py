"""
Скрипт для тестирования API endpoints
"""
import requests
import time
import json
from typing import Optional

BASE_URL = "http://localhost:8000/api/v1"


class APITester:
    """Класс для тестирования API"""
    
    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
        self.token: Optional[str] = None
        self.headers = {}
    
    def print_response(self, title: str, response: requests.Response):
        """Красивый вывод ответа"""
        print(f"\n{'='*60}")
        print(f"📋 {title}")
        print(f"{'='*60}")
        print(f"Status Code: {response.status_code}")
        
        try:
            data = response.json()
            print(json.dumps(data, indent=2, ensure_ascii=False))
        except:
            print(response.text)
        
        print(f"{'='*60}\n")
    
    def test_login(self, username: str = "admin", password: str = "admin123"):
        """Тест авторизации"""
        print("🔐 Тестирование авторизации...")
        
        response = requests.post(
            f"{self.base_url}/auth/login/json",
            json={"username": username, "password": password}
        )
        
        self.print_response("Авторизация", response)
        
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
            print("✅ Авторизация успешна!\n")
            return True
        else:
            print("❌ Ошибка авторизации!\n")
            return False
    
    def test_get_current_user(self):
        """Тест получения информации о текущем пользователе"""
        print("👤 Получение информации о текущем пользователе...")
        
        response = requests.get(
            f"{self.base_url}/auth/me",
            headers=self.headers
        )
        
        self.print_response("Текущий пользователь", response)
    
    def test_get_vehicles(self):
        """Тест получения списка автомобилей"""
        print("🚗 Получение списка автомобилей...")
        
        response = requests.get(
            f"{self.base_url}/vehicles",
            headers=self.headers
        )
        
        self.print_response("Список автомобилей", response)
        return response.json() if response.status_code == 200 else []
    
    def test_get_vehicles_on_territory(self):
        """Тест получения автомобилей на территории"""
        print("📍 Получение автомобилей на территории...")
        
        response = requests.get(
            f"{self.base_url}/vehicles/on-territory",
            headers=self.headers
        )
        
        self.print_response("Автомобили на территории", response)
    
    def test_get_employees(self):
        """Тест получения списка сотрудников"""
        print("👥 Получение списка сотрудников...")
        
        response = requests.get(
            f"{self.base_url}/employees",
            headers=self.headers
        )
        
        self.print_response("Список сотрудников", response)
    
    def test_get_accesses(self):
        """Тест получения доступов"""
        print("🔑 Получение списка доступов...")
        
        response = requests.get(
            f"{self.base_url}/access",
            headers=self.headers
        )
        
        self.print_response("Список доступов", response)
    
    def test_get_active_accesses(self):
        """Тест получения активных доступов"""
        print("✅ Получение активных доступов...")
        
        response = requests.get(
            f"{self.base_url}/access/active",
            headers=self.headers
        )
        
        self.print_response("Активные доступы", response)
    
    def test_get_events(self):
        """Тест получения событий проезда"""
        print("📊 Получение событий проезда...")
        
        response = requests.get(
            f"{self.base_url}/events",
            headers=self.headers
        )
        
        self.print_response("События проезда", response)
        return response.json() if response.status_code == 200 else []
    
    def test_get_event_by_uuid(self, uuid: str):
        """Тест получения события по UUID"""
        print(f"🔍 Получение события по UUID: {uuid}...")
        
        response = requests.get(
            f"{self.base_url}/events/{uuid}",
            headers=self.headers
        )
        
        self.print_response(f"Событие {uuid}", response)
    
    def test_get_statistics(self):
        """Тест получения статистики"""
        print("📈 Получение статистики...")
        
        response = requests.get(
            f"{self.base_url}/statistics",
            headers=self.headers
        )
        
        self.print_response("Статистика", response)
    
    def test_process_video(self, video_path: str = "/videos/test.mp4"):
        """Тест обработки видео"""
        print(f"🎥 Отправка видео на обработку: {video_path}...")
        
        response = requests.post(
            f"{self.base_url}/video",
            headers=self.headers,
            json={"video_path": video_path}
        )
        
        self.print_response("Обработка видео", response)
        
        if response.status_code == 202:
            uuid = response.json()["uuid"]
            print(f"✅ Видео отправлено на обработку. UUID: {uuid}")
            return uuid
        else:
            print("❌ Ошибка отправки видео")
            return None
    
    def test_get_video_status(self, uuid: str):
        """Тест получения статуса обработки видео"""
        print(f"⏳ Проверка статуса обработки: {uuid}...")
        
        response = requests.get(
            f"{self.base_url}/video/status/{uuid}",
            headers=self.headers
        )
        
        self.print_response(f"Статус обработки {uuid}", response)
        return response.json() if response.status_code == 200 else None
    
    def test_create_employee(self):
        """Тест создания сотрудника"""
        print("➕ Создание нового сотрудника...")
        
        employee_data = {
            "full_name": "Тестов Тест Тестович",
            "position": "Тестировщик",
            "contact_info": "+7 (999) 999-99-99"
        }
        
        response = requests.post(
            f"{self.base_url}/employees",
            headers=self.headers,
            json=employee_data
        )
        
        self.print_response("Создание сотрудника", response)
        return response.json() if response.status_code == 201 else None
    
    def test_create_vehicle(self, employee_id: int):
        """Тест создания автомобиля"""
        print("➕ Создание нового автомобиля...")
        
        vehicle_data = {
            "plate_number": "Т999ЕСТ777",
            "transport_type": "Легковой",
            "employee_id": employee_id,
            "is_guest": False
        }
        
        response = requests.post(
            f"{self.base_url}/vehicles",
            headers=self.headers,
            json=vehicle_data
        )
        
        self.print_response("Создание автомобиля", response)
        return response.json() if response.status_code == 201 else None
    
    def run_all_tests(self):
        """Запуск всех тестов"""
        print("\n" + "="*60)
        print("🚀 ЗАПУСК ТЕСТОВ API")
        print("="*60 + "\n")
        
        # Авторизация
        if not self.test_login():
            print("❌ Тесты прерваны из-за ошибки авторизации")
            return
        
        # Информация о пользователе
        self.test_get_current_user()
        
        # Автомобили
        self.test_get_vehicles()
        self.test_get_vehicles_on_territory()
        
        # Сотрудники
        self.test_get_employees()
        
        # Доступы
        self.test_get_accesses()
        self.test_get_active_accesses()
        
        # События
        events = self.test_get_events()
        if events and len(events) > 0:
            self.test_get_event_by_uuid(events[0]["uuid"])
        
        # Статистика
        self.test_get_statistics()
        
        # Создание тестовых данных
        print("\n" + "="*60)
        print("🔧 ТЕСТИРОВАНИЕ СОЗДАНИЯ ДАННЫХ")
        print("="*60 + "\n")
        
        employee = self.test_create_employee()
        if employee:
            vehicle = self.test_create_vehicle(employee["id"])
        
        print("\n" + "="*60)
        print("✅ ВСЕ ТЕСТЫ ЗАВЕРШЕНЫ")
        print("="*60 + "\n")


def main():
    """Главная функция"""
    print("""
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║        🚗 Vehicle Access Control API Tester 🚗           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    """)
    
    # Проверяем доступность API
    try:
        response = requests.get(f"{BASE_URL.replace('/api/v1', '')}/health", timeout=5)
        if response.status_code != 200:
            print("❌ API недоступен. Убедитесь, что сервер запущен.")
            return
    except requests.exceptions.RequestException:
        print("❌ Не удается подключиться к API.")
        print("   Убедитесь, что сервер запущен: python main.py")
        return
    
    print("✅ API доступен")
    print(f"🔗 Базовый URL: {BASE_URL}")
    
    # Запуск тестов
    tester = APITester(BASE_URL)
    tester.run_all_tests()
    
    print("\n💡 Совет: Откройте интерактивную документацию")
    print("   👉 http://localhost:8000/docs\n")


if __name__ == "__main__":
    main()
