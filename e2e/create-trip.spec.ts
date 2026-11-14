import { expect, test } from '@playwright/test';
import { latestOtpCode } from './support/mail';

// Next year, so the trip stays "upcoming" whenever the suite runs.
const YEAR = new Date().getFullYear() + 1;
const TRIP = `Lisbon ${YEAR}`;

test('an account holder creates a trip and sees it in "My trips"', async ({ page }, testInfo) => {
  const email = `e2e-create-${testInfo.project.name}-${Date.now()}@example.com`;

  await page.goto('/trips/new');
  await expect(page).toHaveURL(/\/sign-in\?returnUrl=%2Ftrips%2Fnew$/);

  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByLabel('One-time code').fill(await latestOtpCode(email));
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/profile\/setup\?returnUrl=%2Ftrips%2Fnew$/);
  await page.getByLabel('Your name').fill('Anna');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(/\/trips\/new$/);
  await page.getByLabel('Trip name').fill(TRIP);
  await page.getByLabel('Start date').fill(`${YEAR}-05-10`);
  await page.getByLabel('End date').fill(`${YEAR}-05-01`);
  await page.getByRole('combobox', { name: 'Base currency' }).fill('eur');
  await page.getByRole('option', { name: 'EUR — Euro' }).click();

  // An end date before the start date: explained next to the field, values kept.
  await page.getByRole('button', { name: 'Create trip' }).click();
  await expect(page.getByText('The end date cannot be before the start date.')).toBeVisible();
  await expect(page).toHaveURL(/\/trips\/new$/);
  await expect(page.getByLabel('Trip name')).toHaveValue(TRIP);
  await expect(page.getByLabel('Start date')).toHaveValue(`${YEAR}-05-10`);
  await expect(page.getByRole('combobox', { name: 'Base currency' })).toHaveValue('EUR — Euro');

  await page.getByLabel('End date').fill(`${YEAR}-05-17`);
  await page.getByRole('button', { name: 'Create trip' }).click();

  await expect(page).toHaveURL(/\/trips\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(TRIP);
  await expect(page.getByText('Base currency: EUR')).toBeVisible();
  const members = page.getByRole('listitem');
  await expect(members).toHaveCount(1);
  await expect(members).toContainText('Anna');
  await expect(members).toContainText('you');
  await expect(members).toContainText('Organizer');

  await page.getByRole('link', { name: 'All trips' }).click();
  const upcoming = page.locator('section', {
    has: page.getByRole('heading', { name: 'Current and upcoming' }),
  });
  const card = upcoming.getByRole('link', { name: new RegExp(TRIP) });
  await expect(card).toContainText(`May 10, ${YEAR} – May 17, ${YEAR}`);
  await expect(card).toContainText('EUR');
  await expect(card).toContainText('Participants: 1');
  await expect(card).toContainText('Organizer');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
