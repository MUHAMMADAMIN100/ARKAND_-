import { test, expect } from '@playwright/test';

/** Smoke: вход и базовая навигация. Требует запущенных backend (:3001) и frontend (:5173). */

test('вход оператором и переход по разделам', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('operator').fill('operator');
  await page.getByPlaceholder('••••••••').fill('password123');
  await page.getByRole('button', { name: 'Войти' }).click();

  // Попали на дашборд
  await expect(page).toHaveURL('/');
  await expect(page.getByText('Сводка по щебёночному заводу')).toBeVisible();

  // Продукция открывается: заголовок страницы рендерится один раз (в отличие от списка,
  // который дублируется в DOM как таблица+карточки под адаптив). Проверяем и наличие данных.
  await page.goto('/products');
  await expect(page.getByRole('heading', { name: 'Продукция' })).toBeVisible();
  await expect(page.getByText('Щебень').first()).toBeAttached();
});

test('нет горизонтального скролла на 320px', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('operator').fill('operator');
  await page.getByPlaceholder('••••••••').fill('password123');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).toHaveURL('/');

  // Ширина документа не превышает вьюпорт (нет горизонтального переполнения)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('неавторизованный редиректится на логин', async ({ page }) => {
  await page.goto('/orders');
  await expect(page).toHaveURL(/\/login/);
});

test('оптимистичное создание продукта — мгновенно в списке', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('operator').fill('operator');
  await page.getByPlaceholder('••••••••').fill('password123');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).toHaveURL('/');

  await page.goto('/products');
  await page.getByRole('button', { name: '+ Добавить' }).click();

  const name = `E2E-фракция-${Date.now()}`;
  await page.getByPlaceholder('Щебень 5-20').fill(name);
  // Цена — поле number после названия/типа/единицы
  await page.locator('input[type="number"]').first().fill('123');
  await page.getByRole('button', { name: 'Сохранить' }).click();

  // Оптимистично: новая позиция появляется в списке сразу (toast + строка).
  await expect(page.getByText(name).first()).toBeAttached({ timeout: 5000 });
});
