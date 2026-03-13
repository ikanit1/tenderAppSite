"""Pydantic модели для валидации данных"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class Product(BaseModel):
    """Модель товара"""
    name: str = Field(..., description="Наименование товара")
    model: str = Field(..., description="Модель / артикул")
    brand: str = Field(..., description="Производитель товара")
    quantity: int = Field(..., ge=0, description="Остаток")
    price_rrc: float = Field(..., ge=0, description="Розничная цена")
    final_price: float = Field(..., ge=0, description="Итоговая цена со скидкой")
    discount: float = Field(0, ge=0, le=100, description="Процент скидки")
    discount_amount: float = Field(0, ge=0, description="Сумма скидки")
    image: Optional[str] = Field(None, description="URL главного изображения товара")
    category: Optional[str] = Field(None, description="Категория товара из портала")
    images: Optional[list[str]] = Field(None, description="Список URL всех изображений товара")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Dahua IPC-HFW1230",
                "model": "IPC-HFW1230",
                "brand": "Dahua",
                "quantity": 15,
                "price_rrc": 28500,
                "final_price": 27075,
                "discount": 5.0,
                "discount_amount": 1425
            }
        }


class ProductsResponse(BaseModel):
    """Ответ со списком товаров"""
    updated: Optional[str] = Field(None, description="Дата последнего обновления")
    count: int = Field(..., description="Количество товаров в ответе")
    products: list[Product] = Field(..., description="Список товаров")
    total: Optional[int] = Field(None, description="Всего товаров до пагинации")
    limit: Optional[int] = Field(None, description="Лимит запроса")
    offset: Optional[int] = Field(None, description="Смещение")
    brands: Optional[list[str]] = Field(None, description="Список брендов для фильтра (из полного каталога)")


class HealthResponse(BaseModel):
    """Ответ проверки здоровья сервиса"""
    status: str = Field(..., description="Статус сервиса")
    last_update: Optional[str] = Field(None, description="Дата последнего обновления")
    products_count: int = Field(..., description="Количество товаров в кэше")
