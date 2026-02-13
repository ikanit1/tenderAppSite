# web/utils/pagination.py — pagination helper for web routes
import math
from dataclasses import dataclass


@dataclass
class PageInfo:
    """Pagination metadata for templates."""
    page: int
    per_page: int
    total: int
    total_pages: int

    @property
    def has_prev(self) -> bool:
        return self.page > 1

    @property
    def has_next(self) -> bool:
        return self.page < self.total_pages

    @property
    def prev_page(self) -> int:
        return max(1, self.page - 1)

    @property
    def next_page(self) -> int:
        return min(self.total_pages, self.page + 1)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.per_page

    @property
    def pages_range(self) -> list[int]:
        """Return a list of page numbers to display (window around current page)."""
        window = 2
        start = max(1, self.page - window)
        end = min(self.total_pages, self.page + window)
        return list(range(start, end + 1))


def get_page_info(page: int, per_page: int, total: int) -> PageInfo:
    """Create pagination info from request parameters."""
    page = max(1, page)
    per_page = max(1, min(per_page, 100))
    total_pages = max(1, math.ceil(total / per_page))
    page = min(page, total_pages)
    return PageInfo(
        page=page,
        per_page=per_page,
        total=total,
        total_pages=total_pages,
    )
