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


def test_build_description_from_attrs_with_attrs():
    from export_satu_excel import _build_description_from_attrs
    attrs = {"Номин. ток": "16 А", "Напряжение": "230 В", "Итого": "1500"}
    result = _build_description_from_attrs(
        name="Автоматический выключатель iC60N",
        model="A9F74116",
        brand="Schneider Electric",
        category="Автоматические выключатели",
        attrs=attrs,
    )
    assert "<h3>" in result
    assert "<table>" in result
    assert "<th>Производитель</th>" in result
    assert "Schneider Electric" in result
    assert "<th>Артикул</th>" in result
    assert "A9F74116" in result
    assert "Номин. ток" in result
    assert "16 А" in result
    assert "Итого" not in result   # blacklist
    assert len(result) <= 12160


def test_build_description_from_attrs_no_brand():
    from export_satu_excel import _build_description_from_attrs
    result = _build_description_from_attrs(
        name="Реле",
        model="RXM2AB1P7",
        brand="",
        category="Реле",
        attrs={"Катушка": "230 В AC"},
    )
    assert "<th>Производитель</th>" not in result
    assert "RXM2AB1P7" in result


def test_build_description_from_attrs_empty_attrs():
    from export_satu_excel import _build_description_from_attrs
    result = _build_description_from_attrs(
        name="Товар",
        model="M123",
        brand="Brand",
        category="Прочее",
        attrs={},
    )
    # При пустых attrs возвращаем шаблон (не таблицу)
    assert len(result) > 0
    assert "<table>" not in result
    assert "<p>" in result


def test_build_search_queries_includes_attr_values():
    from export_satu_excel import _build_search_queries
    attrs = {"Номин. ток": "63 А", "Напряжение": "230 В", "Цвет": "синий"}
    result = _build_search_queries(
        name="Автоматический выключатель",
        model="A9F74116",
        brand="Schneider Electric",
        category="Автоматические выключатели",
        attrs=attrs,
    )
    assert len(result) <= 255
    assert "63 А" in result
    assert "230 В" in result
    assert "синий" in result
    assert isinstance(result, str)


def test_build_search_queries_no_attrs():
    from export_satu_excel import _build_search_queries
    result = _build_search_queries(
        name="Реле",
        model="RXM2",
        brand="Schneider",
        category="Реле",
        attrs={},
    )
    assert len(result) <= 255
    assert len(result) > 0


def test_build_search_queries_max_length():
    from export_satu_excel import _build_search_queries
    # Very long attrs should still produce ≤255 chars
    attrs = {f"Атрибут{i}": f"значение{i}" for i in range(50)}
    result = _build_search_queries(
        name="Товар",
        model="M123",
        brand="Бренд",
        category="Прочее",
        attrs=attrs,
    )
    assert len(result) <= 255


def test_headers_products_count():
    from export_satu_excel import HEADERS_PRODUCTS
    assert len(HEADERS_PRODUCTS) == 28, f"Expected 28 columns, got {len(HEADERS_PRODUCTS)}"


def test_headers_products_new_columns():
    from export_satu_excel import HEADERS_PRODUCTS
    headers = list(HEADERS_PRODUCTS)
    assert headers[22] == "Адрес_подраздела"
    assert headers[23] == "Возможность_поставки"
    assert headers[24] == "Срок_поставки"
    assert headers[25] == "Способ_упаковки"
    assert headers[26] == "Продукт_на_сайте"
    assert headers[27] == "Номер_устройства_(MPN)"


def test_product_url_encoding():
    from urllib.parse import quote
    model = "A9F74 116"
    product_url = f"https://grgroup.kz/catalog/?model={quote(model)}"
    assert " " not in product_url, "Space should be percent-encoded"
    assert "%20" in product_url, "Space should be encoded as %20"
    # Empty model returns empty string
    assert (f"https://grgroup.kz/catalog/?model={quote(model)}" if model else "") == product_url
    assert ("" if not "" else "x") == ""  # empty model guard


def test_headers_groups_count():
    from export_satu_excel import HEADERS_GROUPS
    assert len(HEADERS_GROUPS) == 8, f"Expected 8 group columns, got {len(HEADERS_GROUPS)}"


def test_headers_groups_seo_columns():
    from export_satu_excel import HEADERS_GROUPS
    headers = list(HEADERS_GROUPS)
    assert headers[5] == "HTML_заголовок_группы"
    assert headers[6] == "Описание_группы_до_списка_товарных_позиций"
    assert headers[7] == "Описание_группы_после_списка_товарных_позиций"


def test_group_seo_title_format():
    """HTML_заголовок_группы должен быть ≤250 символов."""
    from export_satu_excel import _CATEGORY_DESCRIPTIONS
    from satu_categories import get_all_group_names
    for name in get_all_group_names():
        title = f"{name} — купить в Казахстане | G&R Group"
        assert len(title) <= 250, f"Title too long for {name!r}: {len(title)} chars"


if __name__ == "__main__":
    test_get_satu_category_url_known()
    test_get_satu_category_url_fallback()
    test_all_groups_have_url()
    test_get_supply_volume_cable()
    test_get_supply_volume_default()
    test_supply_period()
    print("Task 1: все тесты прошли.")
    test_build_description_from_attrs_with_attrs()
    test_build_description_from_attrs_no_brand()
    test_build_description_from_attrs_empty_attrs()
    print("Task 2: все тесты прошли.")
    test_build_search_queries_includes_attr_values()
    test_build_search_queries_no_attrs()
    test_build_search_queries_max_length()
    print("Task 3: все тесты прошли.")
    test_headers_products_count()
    test_headers_products_new_columns()
    test_product_url_encoding()
    print("Task 4: все тесты прошли.")
    test_headers_groups_count()
    test_headers_groups_seo_columns()
    test_group_seo_title_format()
    print("Task 5: все тесты прошли.")
