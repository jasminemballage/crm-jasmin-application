import { test, expect } from '@playwright/test';

test.skip(process.env.CRM_UI_TEST_SHARED !== '1', 'Serveur partagé QA sans accès réels requis.');
test('connexion : redirection protégée, erreur lisible et formulaire mobile', async ({page}, testInfo) => {
  await page.route('**/api/auth/login', route => route.fulfill({status:401,json:{error:'Identifiants de test refusés.'}}));
  await page.goto('/commandes');
  await expect(page).toHaveURL(/\/connexion\?next=/);
  await expect(page.getByRole('heading',{name:'Votre espace partagé.'})).toBeVisible();
  await page.getByLabel('Email', {exact:true}).fill('test@example.invalid');
  await page.getByLabel('Mot de passe', {exact:true}).fill('fixture-not-a-real-password');
  await page.getByRole('button',{name:'Se connecter',exact:true}).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Identifiants de test refusés.');
  await expect(page.getByRole('button',{name:'Se connecter',exact:true})).toBeEnabled();
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByRole('heading',{name:'Votre espace partagé.'})).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await page.screenshot({path:testInfo.outputPath('connexion-mobile.png'),fullPage:true});
});
