// Относительный путь /catalog в production — запросы на тот же хост (grgroup.kz), Nginx проксирует локально
const PRODUCT_API_ORIGIN = import.meta.env.VITE_PRODUCT_API_ORIGIN || 'http://localhost:8001';

export interface AssistantChatRequest {
  message: string;
  budget?: number | null;
  brands?: string[] | null;
  cart?: string[];
}

export interface AssistantChatResponse {
  text: string;
  product_models: string[];
}

export interface Product {
  name: string;
  model: string;
  brand: string;
  quantity: number;
  price_rrc: number;
  final_price: number;
  discount: number;
  discount_amount: number;
  image?: string;
  category?: string;
  images?: string[];
}

export interface ProductDetail extends Product {
  description: string;
  attributes: Record<string, string>;
  product_url?: string;
}

export async function sendAssistantMessage(
  request: AssistantChatRequest
): Promise<AssistantChatResponse> {
  const response = await fetch(`${PRODUCT_API_ORIGIN}/api/assistant/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    let detail = `Ошибка ${response.status}`;
    try {
      const body = await response.json();
      if (body && typeof body.detail === 'string') detail = body.detail;
      else if (body && typeof body.detail === 'object' && Array.isArray(body.detail)) detail = body.detail.map((d: unknown) => String(d)).join('; ');
    } catch {
      try {
        detail = await response.text() || detail;
      } catch {
        // keep default
      }
    }
    throw new Error(detail);
  }

  return response.json();
}

export async function getProducts(params?: {
  brand?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ products: Product[]; count: number; total?: number }> {
  const searchParams = new URLSearchParams();
  if (params?.brand) searchParams.set('brand', params.brand);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.offset) searchParams.set('offset', String(params.offset));

  const url = `${PRODUCT_API_ORIGIN}/products${searchParams.toString() ? `?${searchParams}` : ''}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    products: data.products || [],
    count: data.count || 0,
    total: data.total,
  };
}

export async function getProductByModel(model: string): Promise<Product> {
  const encodedModel = encodeURIComponent(model);
  const response = await fetch(`${PRODUCT_API_ORIGIN}/products/${encodedModel}`);

  if (!response.ok) {
    throw new Error(`Product not found: ${response.status}`);
  }

  return response.json();
}

export async function getProductDetail(model: string): Promise<ProductDetail> {
  const encodedModel = encodeURIComponent(model);
  const response = await fetch(`${PRODUCT_API_ORIGIN}/api/products/${encodedModel}/detail`);

  if (!response.ok) {
    throw new Error(`Product detail not found: ${response.status}`);
  }

  return response.json();
}

export function getProductImageUrl(model: string, index?: number): string {
  const encodedModel = encodeURIComponent(model);
  const baseUrl = `${PRODUCT_API_ORIGIN}/api/products/${encodedModel}/image`;
  return index !== undefined ? `${baseUrl}?index=${index}` : baseUrl;
}
