"""Юнит-тесты для satu_categories и export_satu_excel."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from satu_categories import (
    get_satu_category_url, get_supply_volume,
    SUPPLY_PERIOD, DEFAULT_SUPPLY_VOLUME,
    get_all_group_names,
)


def test_get_satu_category_url_known():
    assert get_satu_category_url("Коммутаторы") == "https://satu.kz/Kommutatory"
    assert get_satu_category_url("Реле") == "https://satu.kz/Rele"
    assert get_satu_category_url("Блоки питания") == "https://satu.kz/Bloki-pitaniya"


def test_get_satu_category_url_fallback():
    assert get_satu_category_url("Несуществующая") == "https://satu.kz/Elektrooborudovanie"
    assert get_satu_category_url("Прочее") == "https://satu.kz/Elektrooborudovanie"


def test_all_groups_have_url():
    """Каждая группа из get_all_group_names() должна иметь URL."""
    for name in get_all_group_names():
        url = get_satu_category_url(name)
        assert url.startswith("https://satu.kz/"), f"Bad URL for {name!r}: {url}"


def test_get_supply_volume_cable():
    assert get_supply_volume("Кабель и провод") == 1000
    assert get_supply_volume("Кабельные каналы") == 500
    assert get_supply_volume("Лотки и аксессуары лотков") == 200


def test_get_supply_volume_default():
    assert get_supply_volume("Реле") == DEFAULT_SUPPLY_VOLUME
    assert get_supply_volume("Прочее") == DEFAULT_SUPPLY_VOLUME
    assert get_supply_volume("Неизвестная") == DEFAULT_SUPPLY_VOLUME


def test_supply_period():
    assert SUPPLY_PERIOD == "месяц"


if __name__ == "__main__":
    test_get_satu_category_url_known()
    test_get_satu_category_url_fallback()
    test_all_groups_have_url()
    test_get_supply_volume_cable()
    test_get_supply_volume_default()
    test_supply_period()
    print("Task 1: все тесты прошли.")
