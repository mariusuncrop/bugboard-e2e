import type { Locator, Page } from '@playwright/test';

export class LoginPage {
  readonly form: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly formError: Locator;
  readonly emailError: Locator;
  readonly passwordError: Locator;

  constructor(readonly page: Page) {
    this.form = page.getByTestId('login-form');
    this.email = page.getByTestId('login-email');
    this.password = page.getByTestId('login-password');
    this.submit = page.getByTestId('login-submit');
    this.formError = page.getByTestId('login-error');
    this.emailError = page.getByTestId('error-email');
    this.passwordError = page.getByTestId('error-password');
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }

  demoAccount(email: string): Locator {
    return this.page.getByTestId(`demo-account-${email}`);
  }
}
