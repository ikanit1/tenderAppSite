"""Клиент для работы с B2B API"""
import requests
import json
import logging
from typing import Dict, Optional
from config import B2B_API_URL, API_KEY, CACHE_FILE

logger = logging.getLogger(__name__)


class B2BClient:
    """Клиент для получения данных из B2B API"""
    
    def __init__(self, api_url: str = B2B_API_URL, api_key: str = API_KEY):
        self.api_url = api_url
        self.api_key = api_key
    
    def fetch_products(self) -> Optional[Dict]:
        """
        Получает данные о товарах из API
        
        Returns:
            Dict с полями 'updated' и 'products' или None при ошибке
        """
        try:
            params = {"api_key": self.api_key}
            response = requests.get(self.api_url, params=params, timeout=30)
            
            if response.status_code == 401:
                raise ValueError("API-ключ не передан")
            elif response.status_code == 403:
                raise ValueError("Неверный API-ключ")
            elif response.status_code != 200:
                raise ValueError(f"Ошибка API: {response.status_code}")
            
            return response.json()
        
        except requests.exceptions.RequestException as e:
            logger.error(f"Ошибка при запросе к API: {e}")
            return None
        except json.JSONDecodeError as e:
            logger.error(f"Ошибка парсинга JSON: {e}")
            return None
        except Exception as e:
            logger.error(f"Неожиданная ошибка: {e}")
            return None
    
    def save_cache(self, data: Dict) -> bool:
        """Сохраняет данные в кэш"""
        try:
            CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            logger.error(f"Ошибка сохранения кэша: {e}")
            return False
    
    def load_cache(self) -> Optional[Dict]:
        """Загружает данные из кэша"""
        try:
            if not CACHE_FILE.exists():
                return None
            
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Ошибка загрузки кэша: {e}")
            return None
    
    def update_products(self, use_cache: bool = True) -> Dict:
        """
        Обновляет данные о товарах
        
        Args:
            use_cache: Использовать кэш при ошибке API
        
        Returns:
            Dict с данными о товарах
        """
        data = self.fetch_products()
        
        if data:
            self.save_cache(data)
            return data
        
        # Если API недоступен, используем кэш
        if use_cache:
            cached_data = self.load_cache()
            if cached_data:
                logger.info("Используются данные из кэша")
                return cached_data
        
        return {"updated": None, "products": []}
