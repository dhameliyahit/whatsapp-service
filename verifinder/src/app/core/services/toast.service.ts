import { Injectable, signal } from '@angular/core';
import { Toast, ToastType } from '../models/toast.model';

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  readonly toasts = signal<Toast[]>([]);

  /**
   * Display a new toast notification
   */
  show(type: ToastType, title: string, message?: string, duration: number = 4000): string {
    const id = 'toast_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    const newToast: Toast = {
      id,
      type,
      title,
      message,
      duration,
      timestamp: new Date(),
      isClosing: false
    };

    // Prepend new toast (max 5 visible at a time)
    this.toasts.update(current => [newToast, ...current].slice(0, 5));

    // Auto dismiss with exit animation
    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }

    return id;
  }

  success(title: string, message?: string, duration: number = 4000): string {
    return this.show('success', title, message, duration);
  }

  error(title: string, message?: string, duration: number = 5000): string {
    return this.show('error', title, message, duration);
  }

  info(title: string, message?: string, duration: number = 4000): string {
    return this.show('info', title, message, duration);
  }

  warning(title: string, message?: string, duration: number = 4500): string {
    return this.show('warning', title, message, duration);
  }

  /**
   * Triggers the exit animation before removing the toast
   */
  dismiss(id: string): void {
    const current = this.toasts();
    const target = current.find(t => t.id === id);
    if (!target || target.isClosing) {
      return;
    }

    // Set isClosing flag to trigger exit transition
    this.toasts.update(list =>
      list.map(t => (t.id === id ? { ...t, isClosing: true } : t))
    );

    // Remove from store after animation completes (250ms)
    setTimeout(() => {
      this.remove(id);
    }, 250);
  }

  remove(id: string): void {
    this.toasts.update(current => current.filter(t => t.id !== id));
  }

  clear(): void {
    this.toasts.set([]);
  }
}
