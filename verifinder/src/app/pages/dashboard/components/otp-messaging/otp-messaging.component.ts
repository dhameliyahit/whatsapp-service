import { Component, inject, signal, computed, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  WhatsAppService,
  WhatsAppMessageLog,
  MessageTemplateItem,
  NumberLookupResult,
  OtpSendResult,
  OtpVerifyResult
} from '../../../../core/services/whatsapp.service';
import { ToastService } from '../../../../core/services/toast.service';

export interface CountryItem {
  name: string;
  code: string;
  flag: string;
  placeholder: string;
}

export const COUNTRIES_LIST: CountryItem[] = [
  { name: 'India', code: '91', flag: '🇮🇳', placeholder: '98765 43210' },
  { name: 'United States', code: '1', flag: '🇺🇸', placeholder: '(555) 000-0000' },
  { name: 'United Kingdom', code: '44', flag: '🇬🇧', placeholder: '7911 123456' },
  { name: 'United Arab Emirates', code: '971', flag: '🇦🇪', placeholder: '50 123 4567' },
  { name: 'Saudi Arabia', code: '966', flag: '🇸🇦', placeholder: '50 123 4567' },
  { name: 'Canada', code: '1', flag: '🇨🇦', placeholder: '(555) 000-0000' },
  { name: 'Australia', code: '61', flag: '🇦🇺', placeholder: '412 345 678' },
  { name: 'Germany', code: '49', flag: '🇩🇪', placeholder: '151 23456789' },
  { name: 'France', code: '33', flag: '🇫🇷', placeholder: '6 12 34 56 78' },
  { name: 'Singapore', code: '65', flag: '🇸🇬', placeholder: '8123 4567' },
  { name: 'Pakistan', code: '92', flag: '🇵🇰', placeholder: '300 1234567' },
  { name: 'Bangladesh', code: '880', flag: '🇧🇩', placeholder: '1712 345678' },
  { name: 'Nigeria', code: '234', flag: '🇳🇬', placeholder: '802 123 4567' },
  { name: 'Brazil', code: '55', flag: '🇧🇷', placeholder: '11 91234-5678' },
  { name: 'Indonesia', code: '62', flag: '🇮🇩', placeholder: '812-3456-789' },
  { name: 'South Africa', code: '27', flag: '🇿🇦', placeholder: '71 123 4567' },
];

@Component({
  selector: 'app-otp-messaging',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './otp-messaging.component.html'
})
export class OtpMessagingComponent implements OnInit {
  readonly whatsAppService = inject(WhatsAppService);
  readonly toastService = inject(ToastService);

  readonly session = this.whatsAppService.sessionState;

  // Countries
  readonly countries = COUNTRIES_LIST;
  readonly selectedCountry = signal<CountryItem>(COUNTRIES_LIST[0]);
  readonly countrySearch = signal<string>('');
  readonly isCountryDropdownOpen = signal<boolean>(false);

  // Form Fields
  readonly localPhone = signal<string>('');
  readonly otpCode = signal<string>('482910');
  readonly brandName = signal<string>('Verifinder');
  readonly expiryMinutes = signal<number>(5);
  readonly messageText = signal<string>(
    '*Verifinder Verification Code*\n\nYour code is: *482910*\n\n• Valid for 5 minutes.\n• Do not share this code with anyone.\n\n_If you didn\'t request this, you can safely ignore this message._'
  );
  readonly isSending = signal<boolean>(false);

  // Phone WhatsApp Eligibility Lookup State
  readonly isCheckingNumber = signal<boolean>(false);
  readonly lookupStatus = signal<'idle' | 'valid' | 'invalid'>('idle');
  readonly lookupDetails = signal<string>('');

  // Templates
  readonly templates = signal<MessageTemplateItem[]>([]);
  readonly selectedTemplateId = signal<string>('preset_0');

  // Filtered countries for autocomplete dropdown
  readonly filteredCountries = computed(() => {
    const q = this.countrySearch().trim().toLowerCase();
    if (!q) return this.countries;
    return this.countries.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.includes(q)
    );
  });

  // Full normalized phone with country code
  readonly fullPhoneNumber = computed(() => {
    const raw = this.localPhone().replace(/\D/g, '');
    return `${this.selectedCountry().code}${raw}`;
  });

  // Test OTP Verification states (Connected to backend OtpVerification engine)
  readonly activeVerificationId = signal<string | null>(null);
  readonly lastSentOtp = signal<string | null>(null);
  readonly lastSentPhone = signal<string | null>(null);
  readonly lastSentAt = signal<string | null>(null);
  readonly verificationInput = signal<string>('');
  readonly isVerifying = signal<boolean>(false);
  readonly verificationResult = signal<'idle' | 'success' | 'failed'>('idle');
  readonly verificationFeedback = signal<string>('');
  readonly attemptsRemaining = signal<number | null>(null);

  // Recent logs
  readonly recentLogs = signal<WhatsAppMessageLog[]>([]);

  ngOnInit(): void {
    this.loadTemplates();
    this.loadLogs();
  }

  async loadTemplates(): Promise<void> {
    try {
      const list = await this.whatsAppService.getTemplates();
      this.templates.set(list);
    } catch {
      // defaults handled
    }
  }

  selectCountry(country: CountryItem): void {
    this.selectedCountry.set(country);
    this.isCountryDropdownOpen.set(false);
    this.countrySearch.set('');
    this.lookupStatus.set('idle');
  }

  toggleCountryDropdown(): void {
    this.isCountryDropdownOpen.update((v) => !v);
  }

  onPhoneInputChange(value: string): void {
    this.localPhone.set(value);
    this.lookupStatus.set('idle');
  }

  /**
   * Check if recipient phone number is active on WhatsApp
   */
  async onCheckWhatsAppEligibility(): Promise<void> {
    const cleanLocal = this.localPhone().replace(/\D/g, '');
    if (!cleanLocal || cleanLocal.length < 5) {
      this.toastService.warning('Enter Phone', 'Please enter a valid phone number to check.');
      return;
    }

    if (this.session().status !== 'connected') {
      this.toastService.warning('Gateway Offline', 'Connect your WhatsApp gateway to check numbers.');
      return;
    }

    const full = this.fullPhoneNumber();
    this.isCheckingNumber.set(true);
    try {
      const res = await this.whatsAppService.lookupNumber(full);
      if (res.registered) {
        this.lookupStatus.set('valid');
        this.lookupDetails.set(`+${full} is registered on WhatsApp.`);
        this.toastService.success('WhatsApp Active', `+${full} is registered on WhatsApp.`);
      } else {
        this.lookupStatus.set('invalid');
        this.lookupDetails.set(`+${full} is NOT found on WhatsApp.`);
        this.toastService.warning('Not on WhatsApp', `+${full} has no active WhatsApp account.`);
      }
    } catch (err: any) {
      this.lookupStatus.set('idle');
      this.toastService.error('Lookup Error', err?.error?.message || err?.message || 'Could not verify number.');
    } finally {
      this.isCheckingNumber.set(false);
    }
  }

  applyTemplate(template: MessageTemplateItem): void {
    this.selectedTemplateId.set(template._id);
    const code = this.otpCode();
    const brand = this.brandName() || 'Verifinder';
    const mins = this.expiryMinutes();

    const formatted = template.body
      .replace(/\{\{code\}\}/g, code)
      .replace(/\{\{brand\}\}/g, brand)
      .replace(/\{\{minutes\}\}/g, mins.toString());

    this.messageText.set(formatted);
  }

  generateRandomOtp(): void {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const oldCode = this.otpCode();
    this.otpCode.set(code);

    const currentMsg = this.messageText();
    if (currentMsg.includes(oldCode)) {
      this.messageText.set(currentMsg.replace(oldCode, code));
    } else {
      this.messageText.set(
        `*${this.brandName()} Verification Code*\n\nYour code is: *${code}*\n\n• Valid for ${this.expiryMinutes()} minutes.\n• Do not share this code.`
      );
    }
    this.verificationResult.set('idle');
  }

  /**
   * Dispatch OTP using Backend OTP Verification Engine (salted hash + TTL)
   */
  async onSendOtp(): Promise<void> {
    const cleanLocal = this.localPhone().replace(/\D/g, '');
    if (!cleanLocal || cleanLocal.length < 5) {
      this.toastService.warning('Invalid Phone', 'Please enter a valid phone number.');
      return;
    }

    const msg = this.messageText().trim();
    if (!msg) {
      this.toastService.warning('Empty Message', 'Please enter a message to send.');
      return;
    }

    if (this.session().status !== 'connected') {
      this.toastService.error('Gateway Offline', 'Please connect WhatsApp gateway before sending messages.');
      return;
    }

    const fullPhone = this.fullPhoneNumber();
    const activeCode = this.otpCode();

    this.isSending.set(true);
    try {
      const res: OtpSendResult = await this.whatsAppService.sendOtpVerification({
        to: fullPhone,
        brandName: this.brandName(),
        codeLength: activeCode.length,
        expiryMinutes: this.expiryMinutes(),
        templateText: msg,
      });

      this.activeVerificationId.set(res.verificationId);
      this.lastSentOtp.set(activeCode);
      this.lastSentPhone.set(fullPhone);
      this.lastSentAt.set(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
      this.verificationInput.set('');
      this.verificationResult.set('idle');
      this.attemptsRemaining.set(3);

      this.toastService.success('Code Dispatched', `Verification code sent to +${fullPhone}.`);
      this.loadLogs();
    } catch (err: any) {
      this.toastService.error('Send Failed', err?.error?.message || err?.message || 'Failed to deliver message.');
    } finally {
      this.isSending.set(false);
    }
  }

  /**
   * Verify code using backend OtpVerification engine
   */
  async onVerifyTestOtp(): Promise<void> {
    const input = this.verificationInput().trim();
    if (!input) {
      this.toastService.warning('Empty Code', 'Please enter the code to test.');
      return;
    }

    const vId = this.activeVerificationId();
    const phone = this.lastSentPhone() || this.fullPhoneNumber();

    this.isVerifying.set(true);
    try {
      const res: OtpVerifyResult = await this.whatsAppService.verifyOtpCode({
        verificationId: vId || undefined,
        to: !vId ? phone : undefined,
        code: input,
      });

      if (res.valid) {
        this.verificationResult.set('success');
        this.verificationFeedback.set(`Code '${input}' verified successfully! Verification confirmed.`);
        this.toastService.success('Code Verified', 'The OTP code is valid and verified.');
      } else {
        this.verificationResult.set('failed');
        this.attemptsRemaining.set(res.attemptsRemaining !== undefined ? res.attemptsRemaining : null);
        this.verificationFeedback.set(res.message || 'Incorrect verification code.');
        this.toastService.error('Verification Failed', res.message || 'Invalid code.');
      }
    } catch (err: any) {
      this.verificationResult.set('failed');
      const msg = err?.error?.message || err?.message || 'Verification failed.';
      this.verificationFeedback.set(msg);
      if (err?.error?.data?.attemptsRemaining !== undefined) {
        this.attemptsRemaining.set(err.error.data.attemptsRemaining);
      }
      this.toastService.error('Verification Error', msg);
    } finally {
      this.isVerifying.set(false);
    }
  }

  autofillTestOtp(): void {
    const code = this.lastSentOtp() || this.otpCode();
    this.verificationInput.set(code);
  }

  resetDefaultMessage(): void {
    const code = this.otpCode();
    const brand = this.brandName() || 'Verifinder';
    this.messageText.set(
      `*${brand} Verification Code*\n\nYour code is: *${code}*\n\n• Valid for 5 minutes.\n• Do not share this code with anyone.\n\n_If you didn't request this, you can safely ignore this message._`
    );
  }

  insertCodeIntoMessage(): void {
    const code = this.otpCode();
    const current = this.messageText();
    if (!current.includes(code)) {
      this.messageText.set(`${current} (Verification Code: ${code})`);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.country-dropdown-wrapper')) {
      this.isCountryDropdownOpen.set(false);
    }
  }

  async loadLogs(): Promise<void> {
    if (this.session().status !== 'connected') return;
    try {
      const res = await this.whatsAppService.getLogs(1, 5);
      this.recentLogs.set(res?.logs || []);
    } catch {
      // ignore
    }
  }
}
