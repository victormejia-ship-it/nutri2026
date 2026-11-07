import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const stamp = Date.now().toString(36);

async function register(page: Page, email: string) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  await page.getByRole('button', { name: 'Crear una cuenta nueva' }).click();
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill('secreta123');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByTestId('user-email')).toHaveText(email);
}

test('Firebase: cuenta, proyecto en Firestore, guardado, revisión, exportación y aislamiento por usuario', async ({ page, browser }) => {
  await register(page, `a-${stamp}@ejemplo.mx`);
  await expect(page.getByText('Firebase · datos de tu cuenta')).toBeVisible();

  await page.getByLabel('Nombre del proyecto').fill('Cocina Firebase');
  await page.getByRole('button', { name: 'Crear y abrir editor' }).click();
  await page.waitForURL(/\/editor\/?\?id=/);
  await expect(page.getByTestId('model-svg')).toBeVisible();

  await page.getByTestId('mod-width').fill('900');
  await expect(page.getByTestId('model-svg')).toContainText('900 mm · ANCHO');
  await page.getByTestId('save').click();
  await expect(page.getByTestId('save-state')).toHaveText('Guardado');

  await page.getByTestId('tab-history').click();
  await page.getByTestId('revision-note').fill('Rev Firebase');
  await page.getByTestId('create-revision').click();
  await expect(page.getByRole('cell', { name: 'Rev Firebase' })).toBeVisible();

  // Ofertas demo cargadas para la cuenta y cotización incompleta
  await page.getByTestId('tab-quote').click();
  await expect(page.getByTestId('quote-status')).toHaveText('INCOMPLETO');

  // Exportación generada en el navegador
  await page.getByTestId('tab-export').click();
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-parts-csv').click()]);
  const text = await readFile((await csv.path())!, 'utf8');
  expect(text.charCodeAt(0)).toBe(0xfeff);
  expect(text).toContain('M01-HORIZONTAL');
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-pdf').click()]);
  expect((await readFile((await pdf.path())!)).subarray(0, 5).toString()).toBe('%PDF-');

  // Persistencia: recargar mantiene el cambio
  const url = page.url();
  await page.reload();
  await expect(page.getByTestId('mod-width')).toHaveValue('900');

  // Otro usuario no ve ni puede abrir el proyecto
  const other = await (await browser.newContext()).newPage();
  await register(other, `b-${stamp}@ejemplo.mx`);
  await expect(other.getByText('Cocina Firebase')).toHaveCount(0);
  await other.goto(url);
  await expect(other.getByText('Proyecto no encontrado')).toBeVisible();

  // Cerrar sesión vuelve al inicio de sesión
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
});

test('Firebase: captura de oferta e importación CSV', async ({ page }) => {
  await register(page, `c-${stamp}@ejemplo.mx`);
  await page.goto('/proveedores/');
  await page.getByLabel('SKU').fill('MEL18-FB');
  await page.getByLabel('Precio por presentación (MXN)').fill('1160');
  await page.getByLabel('Folio de cotización').fill('F-FB-1');
  await page.getByRole('button', { name: 'Registrar oferta' }).click();
  await expect(page.getByText('Oferta registrada.')).toBeVisible();
  await expect(page.getByRole('cell', { name: /MEL18-FB/ })).toBeVisible();
  await page.getByLabel('Contenido CSV').fill('supplierId;productKey;sku;description;packQuantity;purchaseUnit;price;taxIncluded;taxRatePct;priceStatus;verifiedAt;validUntil;sourceUrl;quoteReference;available;reliability;capturedBy;notes\ntym_forest;edge:pvc19x045;CANTO-FB;Canto 19 mm rollo 50 m;50;rollo;"450,00";si;16;COTIZADO;2026-01-10;;;F-2;;media;E2E;\n');
  await page.getByRole('button', { name: 'Importar', exact: true }).click();
  await expect(page.getByText(/Importadas 1 oferta/)).toBeVisible();
});
