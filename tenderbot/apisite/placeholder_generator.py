"""Модуль для генерации placeholder изображений"""
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO
from typing import Optional


def generate_placeholder_image(text: str, width: int = 400, height: int = 300) -> bytes:
    """
    Генерирует placeholder изображение с текстом
    
    Args:
        text: Текст для отображения
        width: Ширина изображения
        height: Высота изображения
    
    Returns:
        bytes: PNG изображение в виде байтов
    """
    # Создаем изображение с серым фоном
    img = Image.new('RGB', (width, height), color=(204, 204, 204))
    draw = ImageDraw.Draw(img)
    
    # Пытаемся использовать системный шрифт
    try:
        # Пробуем использовать стандартный шрифт
        font_size = min(width // len(text) if text else 20, 40)
        font_size = max(font_size, 16)  # Минимум 16px
        
        try:
            # Пробуем загрузить системный шрифт
            font = ImageFont.truetype("arial.ttf", font_size)
        except:
            try:
                font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", font_size)
            except:
                # Используем дефолтный шрифт
                font = ImageFont.load_default()
    except:
        font = ImageFont.load_default()
    
    # Вычисляем размер текста для центрирования
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    # Центрируем текст
    x = (width - text_width) // 2
    y = (height - text_height) // 2
    
    # Рисуем текст темно-серым цветом
    draw.text((x, y), text, fill=(102, 102, 102), font=font)
    
    # Сохраняем в BytesIO
    img_bytes = BytesIO()
    img.save(img_bytes, format='PNG')
    img_bytes.seek(0)
    
    return img_bytes.getvalue()
