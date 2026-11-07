import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function createProject(page: Page, name: string) {
  await page.goto('/');
  await page.getByLabel('Nombre del proyecto').fill(name);
  await page.getByLabel('Plantilla inicial').selectOption('kitchen_base');
  await page.getByRole('button', { name: 'Crear y abrir editor' }).click();
  await page.waitForURL(/\/editor\/?\?id=/);
  await expect(page.getByTestId('model-svg')).toBeVisible();
}

test('crear proyecto, cambiar medidas, cajones, proveedor, precio pendiente, guardar, revisión y exportar', async ({ page }) => {
  await createProject(page, 'E2E Cocina');

  // Cambiar medidas: el SVG y el despiece se actualizan
  await page.getByTestId('mod-width').fill('900');
  await expect(page.getByTestId('model-svg')).toContainText('900 mm · ANCHO');
  await page.getByTestId('tab-parts').click();
  await expect(page.getByTestId('parts-table')).toContainText('M01-HORIZONTAL');
  await expect(page.getByTestId('parts-table').locator('tr', { hasText: 'M01-HORIZONTAL' })).toContainText('864');

  // Error bloqueante si W <= 2T
  await page.getByTestId('tab-model').click();
  await page.getByTestId('mod-width').fill('30');
  await expect(page.getByRole('alert').filter({ hasText: 'no existe plan fabricable' })).toBeVisible();
  await page.getByTestId('mod-width').fill('800');
  await expect(page.getByRole('alert').filter({ hasText: 'no existe plan fabricable' })).toHaveCount(0);

  // Agregar cajones; sin corredera no se calcula caja
  await page.getByTestId('mod-front').selectOption('drawers');
  await page.getByTestId('mod-drawers').fill('3');
  await page.getByTestId('tab-parts').click();
  await expect(page.getByTestId('parts-table')).toContainText('M01-DRAWER_FRONT');
  await expect(page.getByTestId('parts-table')).not.toContainText('M01-DRAWER_SIDE');
  await page.getByTestId('mod-slide').selectOption('slide-generic-telescopic');
  await expect(page.getByTestId('parts-table')).toContainText('M01-DRAWER_SIDE');
  await expect(page.getByTestId('parts-table').locator('tr', { hasText: 'M01-DRAWER_SIDE' })).toContainText('Pendiente validación');

  // Precio pendiente => cotización INCOMPLETA
  await page.getByTestId('tab-quote').click();
  await expect(page.getByTestId('quote-status')).toHaveText('INCOMPLETO');

  // Elegir proveedor: corredera SmartSlide con oferta estimada del prototipo
  await page.getByTestId('mod-slide').selectOption('slide-samet-smartslide-350');
  await page.getByTestId('tab-offers').click();
  await page.getByTestId('offer-demo-tym-slide-smart').check();
  await page.getByTestId('offer-demo-pajaro-mel18').check();
  await page.getByTestId('tab-quote').click();
  const table = page.getByTestId('quote-table');
  await expect(table.locator('tr', { hasText: 'SmartSlide' })).toContainText('ESTIMATED');
  await expect(table.locator('tr', { hasText: 'Melamina 18 mm' })).toContainText('PENDING');
  await expect(page.getByTestId('quote-status')).toHaveText('INCOMPLETO');

  // Guardar y congelar revisión
  await page.getByTestId('save').click();
  await expect(page.getByTestId('save-state')).toHaveText('Guardado');
  await page.getByTestId('tab-history').click();
  await page.getByTestId('revision-note').fill('Primera revisión E2E');
  await page.getByTestId('create-revision').click();
  await expect(page.getByRole('cell', { name: 'Primera revisión E2E' })).toBeVisible();

  // Descargar exportaciones
  await page.getByTestId('tab-export').click();
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-parts-csv').click()]);
  expect(csv.suggestedFilename()).toMatch(/-despiece\.csv$/);
  const text = await readFile((await csv.path())!, 'utf8');
  expect(text.charCodeAt(0)).toBe(0xfeff);
  expect(text).toContain('M01-DRAWER_FRONT');
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-pdf').click()]);
  expect(pdf.suggestedFilename()).toMatch(/-expediente\.pdf$/);
  const bytes = await readFile((await pdf.path())!);
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');

  // El proyecto guardado se reabre sin cambios
  await page.reload();
  await page.getByTestId('tab-parts').click();
  await expect(page.getByTestId('parts-table')).toContainText('M01-DRAWER_FRONT');
});

test('clóset y escritorio con herrería exigen validación', async ({ page }) => {
  await createProject(page, 'E2E Recámara');
  await page.getByTestId('add-module').selectOption('wardrobe');
  await page.getByTestId('add-module').selectOption('desk');
  await page.getByTestId('mod-desk-structure').selectOption('steel');
  await page.getByTestId('tab-qc').click();
  await expect(page.getByTestId('issues-list')).toContainText('ANTITIP_REQUIRED');
  await expect(page.getByTestId('issues-list')).toContainText('STEEL_LOAD_VALIDATION_REQUIRED');
  await expect(page.getByTestId('release-status')).toHaveText('Pendiente de validación');
  await page.getByTestId('tab-hardware').click();
  await expect(page.getByText(/barra\(s\) de 6.1 m/)).toBeVisible();
});

test('proveedores: captura manual y CSV', async ({ page }) => {
  await page.goto('/proveedores');
  await page.getByLabel('SKU').fill('MEL18-E2E');
  await page.getByLabel('Precio por presentación (MXN)').fill('1160');
  await page.getByLabel('Folio de cotización').fill('F-E2E-1');
  await page.getByRole('button', { name: 'Registrar oferta' }).click();
  await expect(page.getByText('Oferta registrada.')).toBeVisible();
  await expect(page.getByRole('cell', { name: /MEL18-E2E/ })).toBeVisible();
  await page.getByLabel('Contenido CSV').fill('supplierId;productKey;sku;description;packQuantity;purchaseUnit;price;taxIncluded;taxRatePct;priceStatus;verifiedAt;validUntil;sourceUrl;quoteReference;available;reliability;capturedBy;notes\ntym_forest;edge:pvc19x045;CANTO-E2E;Canto 19 mm rollo 50 m;50;rollo;"450,00";si;16;COTIZADO;2026-01-10;;;F-2;;media;E2E;\n');
  await page.getByRole('button', { name: 'Importar', exact: true }).click();
  await expect(page.getByText(/Importadas 1 oferta/)).toBeVisible();
});
