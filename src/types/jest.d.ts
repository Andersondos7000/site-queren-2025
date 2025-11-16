/// <reference types="@testing-library/jest-dom" />

import '@testing-library/jest-dom';

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveTextContent(text: string | RegExp): R;
      toHaveAttribute(attr: string, value?: string): R;
      toHaveClass(className: string): R;
      toBeVisible(): R;
      toBeDisabled(): R;
      toBeEnabled(): R;
      toHaveValue(value: string | number): R;
      toBeChecked(): R;
      toHaveFocus(): R;
      toBeEmptyDOMElement(): R;
      toContainElement(element: HTMLElement | null): R;
      toHaveDisplayValue(value: string | RegExp | (string | RegExp)[]): R;
      toBePartiallyChecked(): R;
      toHaveErrorMessage(text: string | RegExp): R;
      toHaveDescription(text: string | RegExp): R;
      toHaveAccessibleName(text: string | RegExp): R;
      toHaveAccessibleDescription(text: string | RegExp): R;
      toHaveStyle(css: string | Record<string, any>): R;
      toBeRequired(): R;
      toBeInvalid(): R;
      toBeValid(): R;
    }
  }
}

export {};