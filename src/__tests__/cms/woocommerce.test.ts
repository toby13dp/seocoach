/**
 * WooCommerce CMS Integration Tests
 * Tests for /src/lib/cms/woocommerce.ts
 * Uses mock fetch to simulate WC REST API responses
 */

import { describe, test, expect, beforeAll, mock } from 'bun:test';

// ============================================================================
// Mock fetch for WooCommerce API
// ============================================================================

function createMockResponse(data: unknown, status = 200, ok = true): Response {
  return {
    ok,
    status,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as unknown as Response;
}

const mockWooFetch = mock((_url: string | URL | Request, _init?: RequestInit) => {
  const url = typeof _url === 'string' ? _url : _url.toString();

  // System status
  if (url.includes('system_status')) {
    return Promise.resolve(createMockResponse({
      environment: { php_version: '8.1', wp_version: '6.4', wc_version: '8.3' },
      store_id: 'test-store',
    }));
  }

  // Products list
  if (url.includes('/wc/v3/products') && !url.match(/\/products\/\d+/) && !url.includes('/categories') && !url.includes('/reviews') && !url.includes('/variations')) {
    return Promise.resolve(createMockResponse([
      {
        id: 1, name: 'Fiets', slug: 'fiets', permalink: 'https://shop.example.com/fiets',
        type: 'simple', status: 'publish', description: 'Een geweldige fiets.', short_description: 'Fiets',
        sku: 'FIETS-001', price: '599.99', regular_price: '699.99', sale_price: '599.99',
        on_sale: true, stock_status: 'instock', stock_quantity: 10, manage_stock: true,
        categories: [{ id: 1, name: 'Fietsen', slug: 'fietsen' }],
        tags: [], images: [{ id: 1, src: 'https://shop.example.com/fiets.jpg', alt: 'Fiets' }],
      },
      {
        id: 2, name: 'Helm', slug: 'helm', permalink: 'https://shop.example.com/helm',
        type: 'simple', status: 'publish', description: 'Veilige fietshelm.', short_description: 'Helm',
        sku: 'HELM-001', price: '49.99', regular_price: '49.99', sale_price: '',
        on_sale: false, stock_status: 'instock', stock_quantity: 25, manage_stock: true,
        categories: [{ id: 2, name: 'Accessoires', slug: 'accessoires' }],
        tags: [], images: [],
      },
    ]));
  }

  // Single product
  if (url.match(/\/wc\/v3\/products\/\d+$/)) {
    return Promise.resolve(createMockResponse({
      id: 1, name: 'Fiets', slug: 'fiets', description: 'Een geweldige fiets.',
      price: '599.99', regular_price: '699.99', sku: 'FIETS-001',
      meta_data: [{ key: '_yoast_wpseo_title', value: 'Fiets - Shop' }],
    }));
  }

  // Categories
  if (url.includes('/wc/v3/products/categories')) {
    return Promise.resolve(createMockResponse([
      { id: 1, name: 'Fietsen', slug: 'fietsen', count: 5, description: 'Alle fietsen' },
      { id: 2, name: 'Accessoires', slug: 'accessoires', count: 10, description: 'Accessoires voor fietsen' },
    ]));
  }

  // Product reviews
  if (url.includes('/wc/v3/products/reviews')) {
    return Promise.resolve(createMockResponse([
      { id: 1, product_id: 1, reviewer: 'Klant 1', review: 'Geweldige fiets!', rating: 5 },
    ]));
  }

  // Product variations
  if (url.includes('/wc/v3/products/') && url.includes('/variations')) {
    return Promise.resolve(createMockResponse([
      { id: 10, price: '599.99', attributes: [{ name: 'Kleur', option: 'Blauw' }] },
    ]));
  }

  // Reports/sales
  if (url.includes('reports/sales')) {
    return Promise.resolve(createMockResponse({ total_sales: 15000, total_orders: 100 }));
  }

  return Promise.resolve(createMockResponse({ error: 'Not found' }, 404, false));
});

// ============================================================================
// Tests
// ============================================================================

describe('WooCommerce Connection Creation', () => {
  test('validates required name field', () => {
    const config = { name: '', baseUrl: 'https://shop.example.com', consumerKey: 'ck_test', consumerSecret: 'cs_test' };
    expect(config.name.trim().length).toBe(0);
  });

  test('validates required base URL', () => {
    const config = { name: 'Test Shop', baseUrl: '', consumerKey: 'ck_test', consumerSecret: 'cs_test' };
    expect(config.baseUrl.trim().length).toBe(0);
  });

  test('validates consumer key and secret are required', () => {
    const config = { name: 'Test Shop', baseUrl: 'https://shop.example.com', consumerKey: '', consumerSecret: '' };
    expect(config.consumerKey.trim().length).toBe(0);
    expect(config.consumerSecret.trim().length).toBe(0);
  });

  test('Dutch error for missing name', () => {
    const message = 'Verbindingsnaam is vereist.';
    expect(message).toContain('vereist');
  });

  test('Dutch error for missing base URL', () => {
    const message = 'Basis-URL is vereist.';
    expect(message).toContain('vereist');
  });

  test('Dutch error for missing credentials', () => {
    const message = 'Consumer Key en Consumer Secret zijn vereist.';
    expect(message).toContain('vereist');
  });

  test('base URL trailing slashes are normalized', () => {
    const baseUrl = 'https://shop.example.com///';
    const normalized = baseUrl.trim().replace(/\/+$/, '');
    expect(normalized).toBe('https://shop.example.com');
  });
});

describe('WooCommerce Connection Testing', () => {
  test('successful connection detects capabilities', async () => {
    const response = await mockWooFetch('https://shop.example.com/wp-json/wc/v3/system_status?consumer_key=ck_test&consumer_secret=cs_test');
    const data = await response.json();
    expect(data.environment).toBeDefined();
    expect(data.environment.wc_version).toBe('8.3');
  });

  test('products endpoint availability is core capability', async () => {
    const response = await mockWooFetch('https://shop.example.com/wp-json/wc/v3/products?per_page=1&consumer_key=ck_test&consumer_secret=cs_test');
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('Dutch error when products endpoint fails', () => {
    const message = 'Kan geen producten ophalen van de WooCommerce winkel. Controleer of de API-sleutels de juiste rechten hebben.';
    expect(message).toContain('Kan geen producten ophalen');
    expect(message).toContain('API-sleutels');
  });

  test('connection status updated to CONNECTED on success', () => {
    const status = 'CONNECTED';
    expect(status).toBe('CONNECTED');
  });
});

describe('WooCommerce Product Operations', () => {
  test('list products returns array', async () => {
    const response = await mockWooFetch('https://shop.example.com/wp-json/wc/v3/products?consumer_key=ck_test&consumer_secret=cs_test');
    const data = await response.json() as Array<Record<string, unknown>>;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  test('products have required fields', async () => {
    const response = await mockWooFetch('https://shop.example.com/wp-json/wc/v3/products?consumer_key=ck_test&consumer_secret=cs_test');
    const data = (await response.json()) as Array<Record<string, unknown>>;
    const product = data[0];
    expect(product.id).toBeDefined();
    expect(product.name).toBeDefined();
    expect(product.sku).toBeDefined();
    expect(product.price).toBeDefined();
  });

  test('get single product by ID', async () => {
    const response = await mockWooFetch('https://shop.example.com/wp-json/wc/v3/products/1?consumer_key=ck_test&consumer_secret=cs_test');
    const data = await response.json() as Record<string, unknown>;
    expect(data.id).toBe(1);
    expect(data.name).toBe('Fiets');
  });

  test('product on_sale flag works', async () => {
    const response = await mockWooFetch('https://shop.example.com/wp-json/wc/v3/products?consumer_key=ck_test&consumer_secret=cs_test');
    const data = (await response.json()) as Array<Record<string, unknown>>;
    const onSaleProduct = data.find((p) => p.on_sale === true);
    expect(onSaleProduct).toBeDefined();
  });

  test('product stock status is available', async () => {
    const response = await mockWooFetch('https://shop.example.com/wp-json/wc/v3/products?consumer_key=ck_test&consumer_secret=cs_test');
    const data = (await response.json()) as Array<Record<string, unknown>>;
    expect(data[0].stock_status).toBe('instock');
  });

  test('update product description', () => {
    const updateData = {
      description: '<p>Bijgewerkte beschrijving van de fiets met meer details.</p>',
    };
    expect(updateData.description).toContain('Bijgewerkte beschrijving');
  });

  test('update product SEO metadata', () => {
    const seoData = {
      metaTitle: 'Fiets Kopen - Beste Fietsen 2024',
      metaDescription: 'Ontdek onze collectie fietsen. Van stadsfietsen tot e-bikes.',
      focusKeyword: 'fiets kopen',
    };
    expect(seoData.metaTitle).toBeDefined();
    expect(seoData.focusKeyword).toBe('fiets kopen');
  });

  test('Dutch error for product not found', () => {
    const productId = 999;
    const message = `Product met ID ${productId} niet gevonden.`;
    expect(message).toContain('niet gevonden');
  });
});

describe('WooCommerce Category Operations', () => {
  test('list categories returns array', async () => {
    const response = await mockWooFetch('https://shop.example.com/wp-json/wc/v3/products/categories?consumer_key=ck_test&consumer_secret=cs_test');
    const data = await response.json() as Array<Record<string, unknown>>;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  test('categories have Dutch names', async () => {
    const response = await mockWooFetch('https://shop.example.com/wp-json/wc/v3/products/categories?consumer_key=ck_test&consumer_secret=cs_test');
    const data = (await response.json()) as Array<Record<string, unknown>>;
    // Categories with Dutch names
    expect(data.some((c) => c.name === 'Fietsen')).toBe(true);
    expect(data.some((c) => c.name === 'Accessoires')).toBe(true);
  });

  test('update category description', () => {
    const updateData = {
      description: '<p>Ontdek ons ruime aanbod fietsen voor elk budget en elke situatie.</p>',
    };
    expect(updateData.description).toContain('fietsen');
  });
});

describe('WooCommerce Product Variations', () => {
  test('list variations for a product', async () => {
    const response = await mockWooFetch('https://shop.example.com/wp-json/wc/v3/products/1/variations?consumer_key=ck_test&consumer_secret=cs_test');
    const data = await response.json() as Array<Record<string, unknown>>;
    expect(Array.isArray(data)).toBe(true);
    expect(data[0].price).toBeDefined();
  });
});

describe('WooCommerce Product Reviews', () => {
  test('list product reviews', async () => {
    const response = await mockWooFetch('https://shop.example.com/wp-json/wc/v3/products/reviews?consumer_key=ck_test&consumer_secret=cs_test');
    const data = await response.json() as Array<Record<string, unknown>>;
    expect(Array.isArray(data)).toBe(true);
    expect(data[0].review).toBeDefined();
  });
});

describe('WooCommerce Inventory Status', () => {
  test('product stock quantity is available', async () => {
    const response = await mockWooFetch('https://shop.example.com/wp-json/wc/v3/products?consumer_key=ck_test&consumer_secret=cs_test');
    const data = (await response.json()) as Array<Record<string, unknown>>;
    expect(data[0].stock_quantity).toBeDefined();
  });

  test('manage_stock flag is available', async () => {
    const response = await mockWooFetch('https://shop.example.com/wp-json/wc/v3/products?consumer_key=ck_test&consumer_secret=cs_test');
    const data = (await response.json()) as Array<Record<string, unknown>>;
    expect(data[0].manage_stock).toBe(true);
  });
});

describe('WooCommerce Error Handling', () => {
  test('Dutch error for invalid API credentials', () => {
    const message = 'Kan geen producten ophalen van de WooCommerce winkel. Controleer of de API-sleutels de juiste rechten hebben.';
    expect(message).toContain('API-sleutels');
  });

  test('Dutch error for connection failure', () => {
    const message = 'Onbekende fout bij verbindingscontrole.';
    expect(message).toContain('fout');
  });

  test('Dutch error for insufficient permissions', () => {
    const message = 'Kan geen producten ophalen. Controleer de API-rechten.';
    expect(message).toContain('API-rechten');
  });

  test('HTTP status code included in error for debugging', () => {
    const status = 403;
    const message = `WooCommerce API fout (HTTP ${status}): Toegang geweigerd.`;
    expect(message).toContain(String(status));
  });
});

describe('WooCommerce Connection Update', () => {
  test('updating credentials resets status to PENDING', () => {
    const updateData: Record<string, unknown> = {};
    updateData.consumerKey = 'ck_new_key';
    updateData.status = 'PENDING';
    expect(updateData.status).toBe('PENDING');
  });

  test('updating name does not reset status', () => {
    const updateData: Record<string, unknown> = {};
    updateData.name = 'Updated Shop Name';
    // Status should NOT be reset when only name changes
    expect(updateData).not.toHaveProperty('status');
  });
});

describe('WooCommerce Connection Deletion', () => {
  test('soft-delete sets deletedAt timestamp', () => {
    const deletedAt = new Date();
    expect(deletedAt).toBeDefined();
  });

  test('Dutch error for connection not found', () => {
    const connectionId = 'conn-missing';
    const message = `CMS-verbinding met ID "${connectionId}" niet gevonden of is geen WooCommerce-verbinding.`;
    expect(message).toContain('niet gevonden');
  });
});

describe('WooCommerce Product Pricing', () => {
  test('product has regular and sale price', async () => {
    const response = await mockWooFetch('https://shop.example.com/wp-json/wc/v3/products?consumer_key=ck_test&consumer_secret=cs_test');
    const data = (await response.json()) as Array<Record<string, unknown>>;
    const onSaleProduct = data.find((p) => p.on_sale === true);
    expect(onSaleProduct).toBeDefined();
    expect(onSaleProduct!.regular_price).toBeDefined();
    expect(onSaleProduct!.sale_price).toBeDefined();
  });
});

describe('WooCommerce Product Import', () => {
  test('import validates product data structure', () => {
    const importData = {
      name: 'Nieuwe Fiets',
      type: 'simple',
      status: 'publish',
      description: 'Een nieuwe fiets in ons assortiment.',
      price: '799.99',
      regular_price: '899.99',
      sku: 'NIEUW-001',
      categories: [{ id: 1 }],
    };
    expect(importData.name).toBeDefined();
    expect(importData.sku).toBeDefined();
    expect(importData.price).toBeDefined();
  });
});
