import { expect, test } from '@playwright/test';

const stamp = Date.now();
const email = `e2e.${stamp}@example.com`;
const password = 'ForgePass1';

test.describe.serial('AlgoForge core journeys', () => {
  test('register, empty dashboard, theme switch, vault note, graph, logout', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /your code/i })).toBeVisible();
    await expect(page.getByText(/your patterns/i)).toBeVisible();

    await page.getByTestId('theme-daylight').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'daylight');

    await page.getByLabel(/display name/i).fill('E2E Pilot');
    await page.getByLabel(/^email/i).fill(email);
    await page.getByLabel(/^password/i).fill(password);
    await page.getByRole('button', { name: /create my account/i }).click();

    await expect(page.getByText(/coding universe is empty/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'daylight');

    await page.getByTestId('theme-dreamscape').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dreamscape');
    await expect(page.getByText(/coding universe is empty/i)).toBeVisible();

    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: /vault/i }).click();
    await page.getByTestId('new-note').click();
    await page.getByTestId('note-title').fill('Two pointers window');
    await page.getByTestId('note-core').fill('Advance the right pointer, shrink the left.');
    await page.getByTestId('save-note').click();
    await expect(page.getByRole('heading', { name: 'Two pointers window' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Two pointers window' })).toBeVisible();

    await page.goto('/graph');
    await page.getByTestId('kg-node-binary-search').click();
    await expect(page.getByRole('heading', { name: 'Binary Search' })).toBeVisible();
    await expect(page.getByText(/halve a sorted or monotone search space/i)).toBeVisible();

    await page.goto('/next');
    await expect(page.getByRole('heading', { name: /no candidates matched/i })).toBeVisible();
    await expect(page.getByText(/catalogue is empty|no imported history/i).first()).toBeVisible();

    await page.getByTestId('logout').click();
    await expect(page.getByRole('button', { name: /enter algoforge/i })).toBeVisible();
    await page.goto('/');
    await expect(page).toHaveURL(/login/);
  });

  test('rejects a bad login and an unknown Codeforces handle', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/^email/i).fill(email);
    await page.getByLabel(/^password/i).fill('WrongPass1');
    await page.getByRole('button', { name: /enter algoforge/i }).click();
    await expect(page.getByText(/email or password is incorrect/i)).toBeVisible();

    await page.getByLabel(/^password/i).fill(password);
    await page.getByRole('button', { name: /enter algoforge/i }).click();
    await expect(page.getByRole('heading', { name: /coding universe is empty/i })).toBeVisible({ timeout: 20_000 });

    await page.goto('/connect');
    await page.getByTestId('cf-handle').fill('no_such_cf_user_zzz');
    await page.getByTestId('cf-connect').click();
    await expect(page.getByText(/no codeforces user exists with that handle/i)).toBeVisible({ timeout: 25_000 });
  });
});
